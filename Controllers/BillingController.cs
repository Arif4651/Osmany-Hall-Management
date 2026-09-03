using HallBackend.Application.Dtos;
using HallBackend.Application.Services;
using HallBackend.Domain.Constants;
using HallBackend.Domain.Entities;
using HallBackend.Infrastructure.Data;
using HallBackend.Infrastructure.Authorization;
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
    BillingCalculationService billing) : ControllerBase
{
    [HttpGet("monthly")]
    [RequirePermission(MenuKeys.AdminBilling, PermissionActions.View)]
    public async Task<ActionResult<IReadOnlyList<MonthlyBillDto>>> GetMonthly(
        [FromQuery] int month, [FromQuery] int year, [FromQuery] string? gender,
        [FromQuery] string? status, CancellationToken cancellationToken)
    {
        // ── Performance: read from cache first ───────────────────────────────
        // Calculates only on a cache miss, and at most once even when several admins open
        // the same month together. Explicit recalculation is available via POST
        // /billing/recalculate. Write operations (save service bill, payment approval,
        // subsidy changes) trigger RecalculateForwardAsync automatically.
        await billing.EnsureMonthCalculatedAsync(month, year, cancellationToken);

        var overrides = await db.DueAdjustments.AsNoTracking()
            .Where(x => x.BillingMonth == month && x.BillingYear == year)
            .Select(x => x.StudentId).Distinct().ToListAsync(cancellationToken);
        var overrideIds = overrides.ToHashSet();
        var query = db.MonthlyBillCache.AsNoTracking().Include(x => x.Student)
            .Where(x => x.Month == month && x.Year == year);
        // Null means "all wings" — a genuinely wing-less admin/super_admin. Wing admins are
        // always locked to their own wing here, even if they have cross-wing Payment Verification access.
        var wingFilter = await currentUser.GetOwnWingFilterAsync(gender, cancellationToken);
        if (wingFilter is not null) query = query.Where(x => x.Student!.Gender == wingFilter);
        var rows = await query.OrderBy(x => x.Student!.StudentName).ToListAsync(cancellationToken);
        var result = rows.Select(x => ToDto(x, overrideIds.Contains(x.StudentId))).ToList();
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
    [RequirePermission(MenuKeys.AdminBilling, PermissionActions.Edit)]
    public async Task<IActionResult> Recalculate(
        [FromQuery] int month, [FromQuery] int year, CancellationToken cancellationToken)
    {
        if (month is < 1 or > 12) return BadRequest(new { message = "Invalid month." });
        // Forward, not just this month — otherwise later months keep a stale carried-due figure
        // that this recalculation never touches.
        await billing.RecalculateForwardAsync(month, year, cancellationToken);
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
        return ToDto(row, overridden);
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

    [HttpGet("me/guest-meals")]
    public async Task<ActionResult<StudentGuestMealBreakdownDto>> GetMyGuestMeals(
        [FromQuery] int month, [FromQuery] int year, CancellationToken cancellationToken)
    {
        if (month is < 1 or > 12) return BadRequest(new { message = "Invalid month." });
        var studentId = await currentUser.GetStudentIdAsync(cancellationToken);
        var student = await db.Students.AsNoTracking().FirstOrDefaultAsync(x => x.Id == studentId, cancellationToken);
        if (student is null) return NotFound();

        return await BuildGuestMealBreakdownAsync(student, month, year, cancellationToken);
    }

    [HttpGet("students/{studentId:guid}/guest-meals")]
    [RequirePermission(MenuKeys.AdminBilling, PermissionActions.View)]
    public async Task<ActionResult<StudentGuestMealBreakdownDto>> GetStudentGuestMeals(
        Guid studentId, [FromQuery] int month, [FromQuery] int year, CancellationToken cancellationToken)
    {
        if (month is < 1 or > 12) return BadRequest(new { message = "Invalid month." });
        var student = await db.Students.AsNoTracking().FirstOrDefaultAsync(x => x.Id == studentId, cancellationToken);
        if (student is null) return NotFound();

        var wingFilter = await currentUser.GetOwnWingFilterAsync(null, cancellationToken);
        if (wingFilter is not null && !string.Equals(student.Gender, wingFilter, StringComparison.OrdinalIgnoreCase))
            return Forbid();

        return await BuildGuestMealBreakdownAsync(student, month, year, cancellationToken);
    }

    private async Task<StudentGuestMealBreakdownDto> BuildGuestMealBreakdownAsync(
        Student student, int month, int year, CancellationToken cancellationToken)
    {
        var from = new DateOnly(year, month, 1);
        var to = from.AddMonths(1).AddDays(-1);

        var guestMeals = await db.GuestMealRequests.AsNoTracking()
            .Where(x => x.StudentId == student.Id && x.Date >= from && x.Date <= to)
            .OrderBy(x => x.Date).ThenBy(x => x.MealPeriod)
            .ToListAsync(cancellationToken);

        if (guestMeals.Count == 0)
        {
            return new StudentGuestMealBreakdownDto(
                student.Id,
                student.StudentName,
                student.RollNumber,
                month,
                year,
                0m,
                0,
                Array.Empty<GuestMealBreakdownItemDto>());
        }

        var transactions = await db.StockTransactions.AsNoTracking()
            .Include(x => x.Item)
            .Where(x => x.TransactionType == "out" && x.Date >= from && x.Date <= to)
            .ToListAsync(cancellationToken);

        var meals = await MealResolutionContext.LoadAsync(db, from, to, cancellationToken);
        var mealUnitCosts = new Dictionary<(DateOnly Date, string MealPeriod), decimal>();

        foreach (var transaction in transactions)
        {
            if (transaction.Item is null || string.IsNullOrWhiteSpace(transaction.MealPeriod)) continue;
            if (string.IsNullOrWhiteSpace(transaction.Item.Wing)) continue;
            if (!string.Equals(transaction.Item.Wing, student.Gender, StringComparison.OrdinalIgnoreCase)) continue;

            var participants = meals.Participants(transaction.Item, transaction.MealPeriod, transaction.Date, transaction.CreatedAtUtc);
            if (participants.Count == 0) continue;
            var share = transaction.TotalCost / participants.Count;
            var key = (transaction.Date, transaction.MealPeriod.ToLowerInvariant());
            mealUnitCosts[key] = mealUnitCosts.GetValueOrDefault(key) + share;
        }

        var items = guestMeals.Select(g =>
        {
            var unitCost = mealUnitCosts.GetValueOrDefault((g.Date, g.MealPeriod.ToLowerInvariant()), 0m);
            var totalCost = Math.Round(unitCost * g.GuestCount, 2);
            return new GuestMealBreakdownItemDto(
                g.Id,
                g.Date,
                g.Date.DayOfWeek.ToString(),
                g.MealPeriod,
                g.GuestCount,
                Math.Round(unitCost, 2),
                totalCost,
                g.CreatedAtUtc);
        }).ToList();

        var totalBill = items.Sum(x => x.TotalCost);
        var totalCount = items.Sum(x => x.GuestCount);

        return new StudentGuestMealBreakdownDto(
            student.Id,
            student.StudentName,
            student.RollNumber,
            month,
            year,
            totalBill,
            totalCount,
            items);
    }

    [HttpPut("service-bills")]
    [RequirePermission(MenuKeys.AdminBilling, PermissionActions.Edit)]
    public async Task<IActionResult> SaveServiceBill(SaveServiceBillRequest request, CancellationToken cancellationToken)
    {
        if (request.Month is < 1 or > 12 || request.AmountPerStudent < 0m) return BadRequest(new { message = "Invalid service bill." });
        var wing = await currentUser.GetManagedWingAsync(request.Wing, cancellationToken);
        var version = await db.ServiceBills.Where(x => x.Month == request.Month && x.Year == request.Year && x.Wing == wing)
            .Select(x => (int?)x.Version).MaxAsync(cancellationToken) ?? 0;
        db.ServiceBills.Add(new ServiceBill
        {
            Month = request.Month,
            Year = request.Year,
            Wing = wing,
            AmountPerStudent = request.AmountPerStudent,
            Version = version + 1,
            AddedById = currentUser.UserId,
        });
        await db.SaveChangesAsync(cancellationToken);
        await billing.RecalculateForwardAsync(request.Month, request.Year, cancellationToken);
        return NoContent();
    }

    [HttpDelete("service-bills")]
    [RequirePermission(MenuKeys.AdminBilling, PermissionActions.Delete)]
    public async Task<IActionResult> DeleteServiceBill([FromQuery] int month, [FromQuery] int year, [FromQuery] string? wing, CancellationToken cancellationToken)
    {
        var resolvedWing = await currentUser.GetManagedWingAsync(wing, cancellationToken);
        var rows = await db.ServiceBills.Where(x => x.Month == month && x.Year == year && x.Wing == resolvedWing).ToListAsync(cancellationToken);
        db.ServiceBills.RemoveRange(rows);
        await db.SaveChangesAsync(cancellationToken);
        await billing.RecalculateForwardAsync(month, year, cancellationToken);
        return NoContent();
    }

    [HttpGet("service-bills")]
    [RequirePermission(MenuKeys.AdminBilling, PermissionActions.View)]
    public async Task<ActionResult<decimal>> GetServiceBill([FromQuery] int month, [FromQuery] int year, [FromQuery] string? wing, CancellationToken cancellationToken)
    {
        var resolvedWing = await currentUser.GetManagedWingAsync(wing, cancellationToken);
        var service = await db.ServiceBills.AsNoTracking()
            .Where(x => x.Month == month && x.Year == year && x.Wing == resolvedWing)
            .OrderByDescending(x => x.Version)
            .Select(x => x.AmountPerStudent)
            .FirstOrDefaultAsync(cancellationToken);
        return Ok(service);
    }

    private static MonthlyBillDto ToDto(MonthlyBillCache x, bool overridden)
    {
        // Read from what was actually paid. Comparing DueBill to TotalBill inferred payment from
        // the wrong thing: a manual adjustment moves DueBill away from TotalBill without a single
        // taka being paid, which reported a student who had paid nothing as "Partial Paid".
        var status = FinancialMath.IsCredit(x.DueBill)
            ? "Credit"
            : x.DueBill == 0m
                ? "Paid"
                : x.TotalApprovedPaid > 0m ? "Partial Paid" : "Unpaid";
        return new MonthlyBillDto(
            x.StudentId, x.Student?.StudentName ?? string.Empty, x.Student?.RollNumber ?? string.Empty,
            x.Student?.HallId ?? string.Empty, x.Student?.Gender ?? string.Empty,
            x.Month, x.Year, x.ServiceBill, x.MonthlyBill, x.DswSubsidy, x.GuestMealBill, x.CarriedDue, x.DueBill,
            x.TotalBill, status, overridden, false, x.OthersBill, x.Adjustment, x.TotalApprovedPaid);
    }
}
