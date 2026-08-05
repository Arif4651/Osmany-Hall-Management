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
[Authorize(Roles = Roles.HallAdministrators)]
[Route("api/due")]
public sealed class DueController(
    HallDbContext db,
    CurrentUserService currentUser,
    BillingCalculationService billing,
    BillingPeriodService periods) : ControllerBase
{
    [HttpGet]
    public async Task<IReadOnlyList<DueRowDto>> Get([FromQuery] int month, [FromQuery] int year, [FromQuery] string? gender, CancellationToken cancellationToken)
    {
        if (month is < 1 or > 12) return [];

        // Calculates only on a cache miss, and at most once across concurrent viewers.
        await billing.EnsureMonthCalculatedAsync(month, year, cancellationToken);

        var overrides = await db.DueAdjustments.AsNoTracking()
            .Where(x => x.BillingMonth == month && x.BillingYear == year)
            .Select(x => x.StudentId).Distinct().ToListAsync(cancellationToken);
        var overrideIds = overrides.ToHashSet();
        var query = db.MonthlyBillCache.AsNoTracking()
            .Where(x => x.Month == month && x.Year == year);
        var adminWing = await currentUser.GetAdminWingAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(adminWing)) query = query.Where(x => x.Student!.Gender == adminWing);
        else if (gender is "Male" or "Female") query = query.Where(x => x.Student!.Gender == gender);
        var rows = await query
            .OrderBy(x => x.Student!.StudentName)
            .Select(x => new
            {
                x.StudentId,
                StudentName = x.Student!.StudentName,
                StudentCode = x.Student.StudentId,
                x.Student.HallId,
                x.Student.Gender,
                x.DueBill,
                x.Student.MobileNumber,
                x.Student.Department,
            })
            .ToListAsync(cancellationToken);

        return rows.Select(x => new DueRowDto(
            x.StudentId, x.StudentName, x.StudentCode,
            x.HallId, x.Gender, month, year, x.DueBill, overrideIds.Contains(x.StudentId),
            x.MobileNumber, x.Department)).ToList();
    }

    [HttpPost("adjustments")]
    public async Task<IActionResult> Adjust(SaveDueAdjustmentRequest request, CancellationToken cancellationToken)
    {
        if (request.BillingMonth is < 1 or > 12 || request.AdjustedAmount < 0m) return BadRequest(new { message = "Invalid due adjustment." });
        if (await periods.IsLockedAsync(request.BillingMonth, request.BillingYear, cancellationToken))
            return StatusCode(403, new { message = "Billing period is closed." });
        var adminWing = await currentUser.GetAdminWingAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(adminWing)
            && !await db.Students.AnyAsync(x => x.Id == request.StudentId && x.Gender == adminWing, cancellationToken))
            return Forbid();
        await billing.RecalculateMonthAsync(request.BillingMonth, request.BillingYear, cancellationToken);
        var previous = await db.MonthlyBillCache.AsNoTracking()
            .Where(x => x.StudentId == request.StudentId && x.Month == request.BillingMonth && x.Year == request.BillingYear)
            .Select(x => x.DueBill).FirstOrDefaultAsync(cancellationToken);
        db.DueAdjustments.Add(new DueAdjustment
        {
            StudentId = request.StudentId,
            BillingMonth = request.BillingMonth,
            BillingYear = request.BillingYear,
            AdjustedAmount = request.AdjustedAmount,
            PreviousAmount = previous,
            Note = request.Note?.Trim(),
            AdjustedById = currentUser.UserId,
        });
        await db.SaveChangesAsync(cancellationToken);
        await billing.RecalculateForwardAsync(request.BillingMonth, request.BillingYear, cancellationToken);
        return NoContent();
    }
}
