using HallBackend.Application.Dtos;
using HallBackend.Application.Services;
using HallBackend.Domain.Constants;
using HallBackend.Domain.Entities;
using HallBackend.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Controllers;

[ApiController]
[Authorize]
[Route("api/billing")]
public sealed class BillingController(
    HallDbContext db,
    CurrentUserService currentUser,
    BillingCalculationService billing,
    BillingPeriodService periods) : ControllerBase
{
    [HttpGet("monthly")]
    [Authorize(Roles = Roles.HallAdministrators)]
    public async Task<ActionResult<IReadOnlyList<MonthlyBillDto>>> GetMonthly(
        [FromQuery] int month, [FromQuery] int year, [FromQuery] string? gender,
        [FromQuery] string? status, CancellationToken cancellationToken)
    {
        // ── Performance: read from cache first ───────────────────────────────
        // Calculates only on a cache miss, and at most once even when several admins open
        // the same month together. Explicit recalculation is available via POST
        // /billing/recalculate. Write operations (save service bill, close/unlock period,
        // payment approval, subsidy changes) trigger RecalculateForwardAsync automatically.
        await billing.EnsureMonthCalculatedAsync(month, year, cancellationToken);

        var locked = await periods.IsLockedAsync(month, year, cancellationToken);
        var overrides = await db.DueAdjustments.AsNoTracking()
            .Where(x => x.BillingMonth == month && x.BillingYear == year)
            .Select(x => x.StudentId).Distinct().ToListAsync(cancellationToken);
        var overrideIds = overrides.ToHashSet();
        var query = db.MonthlyBillCache.AsNoTracking().Include(x => x.Student)
            .Where(x => x.Month == month && x.Year == year);
        var adminWing = await currentUser.GetAdminWingAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(adminWing)) query = query.Where(x => x.Student!.Gender == adminWing);
        if (!string.IsNullOrWhiteSpace(gender) && gender != "All") query = query.Where(x => x.Student!.Gender == gender);
        var rows = await query.OrderBy(x => x.Student!.StudentName).ToListAsync(cancellationToken);
        var result = rows.Select(x => ToDto(x, overrideIds.Contains(x.StudentId), locked)).ToList();
        if (!string.IsNullOrWhiteSpace(status) && status != "All")
            result = result.Where(x => x.Status.Equals(status, StringComparison.OrdinalIgnoreCase)).ToList();
        return result;
    }

    /// <summary>
    /// Admin-only explicit recalculation trigger. Call this after bulk data entry
    /// or whenever you need to force a fresh bill computation outside the normal
    /// write-triggered path.
    /// </summary>
    [HttpPost("recalculate")]
    [Authorize(Roles = Roles.HallAdministrators)]
    public async Task<IActionResult> Recalculate(
        [FromQuery] int month, [FromQuery] int year, CancellationToken cancellationToken)
    {
        if (month is < 1 or > 12) return BadRequest(new { message = "Invalid month." });
        await billing.RecalculateMonthAsync(month, year, cancellationToken);
        return NoContent();
    }

    [HttpGet("me")]
    public async Task<ActionResult<MonthlyBillDto>> GetMine(
        [FromQuery] int month, [FromQuery] int year, CancellationToken cancellationToken)
    {
        var studentId = await currentUser.GetStudentIdAsync(cancellationToken);

        // ── Performance: read from cache, only recalc if the month has none ──
        // Validates the period and collapses concurrent first-views of a month into a single
        // calculation — this endpoint is student-reachable with an arbitrary month and year.
        await billing.EnsureMonthCalculatedAsync(month, year, cancellationToken);

        var row = await db.MonthlyBillCache.AsNoTracking().Include(x => x.Student)
            .FirstOrDefaultAsync(x => x.StudentId == studentId && x.Month == month && x.Year == year, cancellationToken);
        if (row is null) return NotFound();

        var overridden = await db.DueAdjustments.AnyAsync(x => x.StudentId == studentId && x.BillingMonth == month && x.BillingYear == year, cancellationToken);
        return ToDto(row, overridden, await periods.IsLockedAsync(month, year, cancellationToken));
    }

    [HttpGet("me/subsidies")]
    public async Task<ActionResult<IReadOnlyList<StudentBillSubsidyAdjustmentDto>>> GetMySubsidies(
        [FromQuery] int month, [FromQuery] int year, CancellationToken cancellationToken)
    {
        var studentId = await currentUser.GetStudentIdAsync(cancellationToken);
        var from = new DateOnly(year, month, 1);
        var to = from.AddMonths(1).AddDays(-1);
        var rows = await db.DswSubsidyDistributions.AsNoTracking()
            .Include(x => x.Subsidy)
            .Where(x => x.StudentId == studentId
                && x.Date >= from
                && x.Date <= to
                && x.Subsidy != null
                && !x.Subsidy.IsReversed)
            .OrderByDescending(x => x.Date)
            .ThenBy(x => x.MealPeriod)
            .Select(x => new StudentBillSubsidyAdjustmentDto(
                x.SubsidyId,
                x.Date,
                x.MealPeriod,
                x.SubsidyAmount,
                x.Subsidy!.Notes))
            .ToListAsync(cancellationToken);
        return rows;
    }

    [HttpPut("service-bills")]
    [Authorize(Roles = Roles.HallAdministrators)]
    public async Task<IActionResult> SaveServiceBill(SaveServiceBillRequest request, CancellationToken cancellationToken)
    {
        if (request.Month is < 1 or > 12 || request.AmountPerStudent < 0m) return BadRequest(new { message = "Invalid service bill." });
        if (await periods.IsLockedAsync(request.Month, request.Year, cancellationToken))
            return StatusCode(403, new { message = "Billing period is closed." });
        var version = await db.ServiceBills.Where(x => x.Month == request.Month && x.Year == request.Year)
            .Select(x => (int?)x.Version).MaxAsync(cancellationToken) ?? 0;
        db.ServiceBills.Add(new ServiceBill
        {
            Month = request.Month,
            Year = request.Year,
            AmountPerStudent = request.AmountPerStudent,
            Version = version + 1,
            AddedById = currentUser.UserId,
        });
        await db.SaveChangesAsync(cancellationToken);
        await billing.RecalculateForwardAsync(request.Month, request.Year, cancellationToken);
        return NoContent();
    }

    [HttpDelete("service-bills")]
    [Authorize(Roles = Roles.HallAdministrators)]
    public async Task<IActionResult> DeleteServiceBill([FromQuery] int month, [FromQuery] int year, CancellationToken cancellationToken)
    {
        if (await periods.IsLockedAsync(month, year, cancellationToken))
            return StatusCode(403, new { message = "Billing period is closed." });
        var rows = await db.ServiceBills.Where(x => x.Month == month && x.Year == year).ToListAsync(cancellationToken);
        db.ServiceBills.RemoveRange(rows);
        await db.SaveChangesAsync(cancellationToken);
        await billing.RecalculateForwardAsync(month, year, cancellationToken);
        return NoContent();
    }

    [HttpPost("periods/close")]
    [Authorize(Roles = Roles.HallAdministrators)]
    public async Task<IActionResult> ClosePeriod(CloseBillingPeriodRequest request, CancellationToken cancellationToken)
    {
        if (request.Month is < 1 or > 12) return BadRequest(new { message = "Invalid month." });
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await billing.RecalculateMonthAsync(request.Month, request.Year, cancellationToken);
        var period = await db.BillingPeriods.FirstOrDefaultAsync(x => x.Month == request.Month && x.Year == request.Year, cancellationToken);
        if (period is null)
        {
            period = new BillingPeriod { Month = request.Month, Year = request.Year };
            db.BillingPeriods.Add(period);
        }
        period.IsLocked = true;
        period.LockedAtUtc = DateTime.UtcNow;
        period.LockedById = currentUser.UserId;
        var caches = await db.MonthlyBillCache.Where(x => x.Month == request.Month && x.Year == request.Year).ToListAsync(cancellationToken);
        foreach (var cache in caches) cache.IsFinal = true;
        var services = await db.ServiceBills.Where(x => x.Month == request.Month && x.Year == request.Year).ToListAsync(cancellationToken);
        foreach (var service in services) service.IsLocked = true;
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("periods/unlock")]
    [Authorize(Roles = Roles.SuperAdmin)]
    public async Task<IActionResult> UnlockPeriod(UnlockBillingPeriodRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Note)) return BadRequest(new { message = "An unlock note is required." });
        var period = await db.BillingPeriods.FirstOrDefaultAsync(x => x.Month == request.Month && x.Year == request.Year, cancellationToken);
        if (period is null || !period.IsLocked) return NotFound(new { message = "Locked billing period was not found." });
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        period.IsLocked = false;
        period.UnlockNote = request.Note.Trim();
        db.BillingPeriodUnlockAudits.Add(new BillingPeriodUnlockAudit
        {
            Month = request.Month,
            Year = request.Year,
            Note = request.Note.Trim(),
            UnlockedById = currentUser.UserId,
        });
        var caches = await db.MonthlyBillCache.Where(x => x.Month == request.Month && x.Year == request.Year).ToListAsync(cancellationToken);
        foreach (var cache in caches) cache.IsFinal = false;
        var services = await db.ServiceBills.Where(x => x.Month == request.Month && x.Year == request.Year).ToListAsync(cancellationToken);
        foreach (var service in services) service.IsLocked = false;
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        await billing.RecalculateForwardAsync(request.Month, request.Year, cancellationToken);
        return NoContent();
    }

    [HttpGet("periods")]
    [Authorize(Roles = Roles.HallAdministrators)]
    public async Task<IReadOnlyList<BillingPeriodDto>> GetPeriods(CancellationToken cancellationToken)
        => await db.BillingPeriods.AsNoTracking().OrderByDescending(x => x.Year).ThenByDescending(x => x.Month)
            .Select(x => new BillingPeriodDto(x.Month, x.Year, x.IsLocked, x.LockedAtUtc)).ToListAsync(cancellationToken);

    [HttpGet("service-bills")]
    [Authorize(Roles = Roles.HallAdministrators)]
    public async Task<ActionResult<decimal>> GetServiceBill([FromQuery] int month, [FromQuery] int year, CancellationToken cancellationToken)
    {
        var service = await db.ServiceBills.AsNoTracking()
            .Where(x => x.Month == month && x.Year == year)
            .OrderByDescending(x => x.Version)
            .Select(x => x.AmountPerStudent)
            .FirstOrDefaultAsync(cancellationToken);
        return Ok(service);
    }

    private static MonthlyBillDto ToDto(MonthlyBillCache x, bool overridden, bool locked)
    {
        var status = x.DueBill == 0m ? "Paid" : x.DueBill == x.TotalBill ? "Unpaid" : "Partial Paid";
        return new MonthlyBillDto(
            x.StudentId, x.Student?.StudentName ?? string.Empty, x.Student?.RollNumber ?? string.Empty,
            x.Student?.HallId ?? string.Empty, x.Student?.Gender ?? string.Empty,
            x.Month, x.Year, x.ServiceBill, x.MonthlyBill, x.DswSubsidy, x.GuestMealBill, x.CarriedDue, x.DueBill,
            x.TotalBill, status, overridden, locked);
    }
}
