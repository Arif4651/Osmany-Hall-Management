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
[Route("api/due")]
public sealed class DueController(
    HallDbContext db,
    CurrentUserService currentUser,
    BillingCalculationService billing,
    ILogger<DueController> logger) : ControllerBase
{
    /// <summary>
    /// Serializes the read-then-write in <see cref="Adjust"/> per student/month: two admins
    /// correcting the same due at once both read the same "previous" figure before either had
    /// written, so both deltas applied against the same baseline and the second admin's intended
    /// correction landed on top of the first's rather than replacing it. Keyed per (student,
    /// month, year) so unrelated adjustments never wait on each other.
    /// </summary>
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, SemaphoreSlim> AdjustmentLocks = new();

    private static SemaphoreSlim LockFor(Guid studentId, int month, int year)
        => AdjustmentLocks.GetOrAdd($"{studentId}:{year}-{month}", _ => new SemaphoreSlim(1, 1));


    [HttpGet]
    [RequirePermission(MenuKeys.AdminDue, PermissionActions.View)]
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
        var wingFilter = await currentUser.GetOwnWingFilterAsync(gender, cancellationToken);
        if (wingFilter is not null) query = query.Where(x => x.Student!.Gender == wingFilter);
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
    [RequirePermission(MenuKeys.AdminDue, PermissionActions.Edit)]
    public async Task<IActionResult> Adjust(SaveDueAdjustmentRequest request, CancellationToken cancellationToken)
    {
        // A negative target is allowed: it grants the student a credit, the same balance an
        // overpayment produces. Only the period is genuinely constrained.
        if (request.BillingMonth is < 1 or > 12) return BadRequest(new { message = "Invalid due adjustment." });
        var studentWing = await db.Students.AsNoTracking()
            .Where(x => x.Id == request.StudentId)
            .Select(x => x.Gender)
            .FirstOrDefaultAsync(cancellationToken);
        if (studentWing is null) return NotFound(new { message = "Student not found." });
        if (!await currentUser.CanManageOwnWingFinanceAsync(studentWing, cancellationToken)) return Forbid();

        var gate = LockFor(request.StudentId, request.BillingMonth, request.BillingYear);
        await gate.WaitAsync(cancellationToken);
        bool recalculated;
        try
        {
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

            // The adjustment is committed by this point, so a failure rebuilding the derived bills is
            // not a failure of the adjustment — reporting it as one told the admin their change had
            // been rejected while it was sitting in the database. The figures can be rebuilt from the
            // Recalculate action; losing track of what was saved cannot be undone.
            recalculated = await TryRecalculateForwardAsync(request.BillingMonth, request.BillingYear, cancellationToken);
        }
        finally
        {
            gate.Release();
        }

        return Ok(new
        {
            recalculated,
            message = recalculated
                ? null
                : "The override was saved, but the bill totals could not be rebuilt just now. Use Recalculate on Bill Management to refresh them.",
        });
    }

    private async Task<bool> TryRecalculateForwardAsync(int month, int year, CancellationToken cancellationToken)
    {
        try
        {
            await billing.RecalculateForwardAsync(month, year, cancellationToken);
            return true;
        }
        catch (Exception error) when (error is not OperationCanceledException)
        {
            logger.LogError(error, "Bill rebuild after a due adjustment for {Month}/{Year} failed.", month, year);
            return false;
        }
    }
}
