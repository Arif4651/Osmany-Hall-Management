using HallBackend.Application.Dtos;
using HallBackend.Application.Services;
using HallBackend.Domain.Constants;
using HallBackend.Domain.Entities;
using HallBackend.Infrastructure.Data;
using HallBackend.Infrastructure.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace HallBackend.Controllers;

[ApiController]
[Authorize]
[Route("api/billing/subsidies")]
public sealed class DswSubsidiesController(
    HallDbContext db,
    CurrentUserService currentUser,
    BillingCalculationService billing) : ControllerBase
{
    [HttpPost]
    [RequirePermission(MenuKeys.AdminBilling, PermissionActions.Create)]
    public async Task<IActionResult> Create(
        CreateDswSubsidyRequest request,
        CancellationToken cancellationToken)
    {
        if (request.SubsidyAmount <= 0m)
            return BadRequest(new { message = "Subsidy amount must be greater than zero." });
        if (!MealHistoryService.MealPeriods.Contains(request.MealPeriod))
            return BadRequest(new { message = "Invalid meal period." });

        var selectedWing = await currentUser.GetManagedWingAsync(request.Wing, cancellationToken);

        var students = await db.Students.AsNoTracking()
            // JoinDate: a student who joined after request.Date cannot have been eligible for a
            // meal on that date — without this, editing an old subsidy after a new student joins
            // would silently add them to a distribution for a date before they existed.
            .Where(x => x.Status == MealResolutionContext.BillableStatus && x.Gender == selectedWing && x.JoinDate <= request.Date)
            .OrderBy(x => x.StudentName)
            .ToListAsync(cancellationToken);
        var studentIds = students.Select(x => x.Id).ToList();
        var statuses = await db.MealStatusHistory.AsNoTracking()
            .Where(x => studentIds.Contains(x.StudentId)
                && x.EffectiveFrom <= request.Date
                && (x.EffectiveTo == null || x.EffectiveTo >= request.Date))
            .ToListAsync(cancellationToken);
        var overrides = await db.GlobalMealOverrides.AsNoTracking()
            .Where(x => x.Wing == selectedWing
                && x.MealPeriod == request.MealPeriod
                && x.EffectiveFrom <= request.Date
                && x.EffectiveTo >= request.Date)
            .OrderByDescending(x => x.EffectiveFrom)
            .ToListAsync(cancellationToken);

        var activeOverride = overrides.FirstOrDefault();
        var eligibleStudents = students
            .Where(student => activeOverride is not null
                ? activeOverride.IsOn
                : statuses
                    .Where(x => x.StudentId == student.Id && x.MealPeriod == request.MealPeriod)
                    .OrderByDescending(x => x.EffectiveFrom)
                    .FirstOrDefault()?.IsOn == true)
            .ToList();

        if (eligibleStudents.Count == 0)
            return BadRequest(new { message = "No eligible meal-active students were found for the selected date and meal." });

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var perStudentSubsidy = request.SubsidyAmount / eligibleStudents.Count;
            // Plain division does not reconcile: ৳1,000 over 3 students rounds to ৳333.33 each
            // at 2dp and loses a paisa. AllocateByConsumption (one "unit" per eligible student)
            // hands the leftover paisa out by largest remainder so the distributions always sum
            // to exactly SubsidyAmount.
            var allocations = FinancialMath.AllocateByConsumption(
                request.SubsidyAmount,
                eligibleStudents.Select(s => (StudentId: s.Id, Count: 1)).ToList());
            var entity = new DswSubsidy
            {
                Wing = selectedWing,
                SubsidyAmount = request.SubsidyAmount,
                Date = request.Date,
                MealPeriod = request.MealPeriod,
                EligibleStudentCount = eligibleStudents.Count,
                // Display-only average; the ground truth is each distribution row's own amount.
                PerStudentSubsidy = perStudentSubsidy,
                Notes = request.Notes?.Trim(),
                CreatedById = currentUser.UserId,
            };
            db.DswSubsidies.Add(entity);
            await db.SaveChangesAsync(cancellationToken);

            db.DswSubsidyDistributions.AddRange(allocations.Select(allocation => new DswSubsidyDistribution
            {
                SubsidyId = entity.Id,
                StudentId = allocation.StudentId,
                Date = request.Date,
                MealPeriod = request.MealPeriod,
                SubsidyAmount = allocation.Amount,
            }));
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            await billing.RecalculateForwardAsync(request.Date.Month, request.Date.Year, cancellationToken);
            return Ok(new
            {
                entity.Id,
                entity.Wing,
                entity.Date,
                entity.MealPeriod,
                entity.SubsidyAmount,
                entity.EligibleStudentCount,
                entity.PerStudentSubsidy,
            });
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException postgres && postgres.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            await transaction.RollbackAsync(cancellationToken);
            return Conflict(new { message = "A DSW subsidy is already active for this wing, date, and meal period." });
        }
    }

    [HttpGet]
    [RequirePermission(MenuKeys.AdminBilling, PermissionActions.View)]
    public async Task<ActionResult<IReadOnlyList<DswSubsidyDto>>> GetSubsidies(
        [FromQuery] int month, [FromQuery] int year, [FromQuery] string? wing, CancellationToken cancellationToken)
    {
        var selectedWing = await currentUser.GetManagedWingAsync(wing, cancellationToken);
        var from = new DateOnly(year, month, 1);
        var to = from.AddMonths(1).AddDays(-1);
        var query = db.DswSubsidies.AsNoTracking().Where(x => x.Wing == selectedWing && x.Date >= from && x.Date <= to && !x.IsReversed);
        
        return await query.OrderByDescending(x => x.Date).ThenBy(x => x.MealPeriod)
            .Select(x => new DswSubsidyDto(x.Id, x.Wing, x.SubsidyAmount, x.Date, x.MealPeriod, x.EligibleStudentCount, x.PerStudentSubsidy, x.Notes))
            .ToListAsync(cancellationToken);
    }

    [HttpPut("{id:guid}")]
    [RequirePermission(MenuKeys.AdminBilling, PermissionActions.Edit)]
    public async Task<IActionResult> Update(Guid id, CreateDswSubsidyRequest request, CancellationToken cancellationToken)
    {
        var subsidy = await db.DswSubsidies.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (subsidy is null) return NotFound();

        // A wing admin must not be able to reach into the other wing's subsidy — GetManagedWingAsync
        // only pins the caller's own wing, it does not check that the row being edited is theirs.
        var adminWing = await currentUser.GetAdminWingAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(adminWing) && subsidy.Wing != adminWing) return Forbid();

        if (request.SubsidyAmount <= 0m)
            return BadRequest(new { message = "Subsidy amount must be greater than zero." });
        if (!MealHistoryService.MealPeriods.Contains(request.MealPeriod))
            return BadRequest(new { message = "Invalid meal period." });

        var selectedWing = await currentUser.GetManagedWingAsync(request.Wing, cancellationToken);

        var students = await db.Students.AsNoTracking()
            // JoinDate: a student who joined after request.Date cannot have been eligible for a
            // meal on that date — without this, editing an old subsidy after a new student joins
            // would silently add them to a distribution for a date before they existed.
            .Where(x => x.Status == MealResolutionContext.BillableStatus && x.Gender == selectedWing && x.JoinDate <= request.Date)
            .OrderBy(x => x.StudentName)
            .ToListAsync(cancellationToken);
        var studentIds = students.Select(x => x.Id).ToList();
        var statuses = await db.MealStatusHistory.AsNoTracking()
            .Where(x => studentIds.Contains(x.StudentId)
                && x.EffectiveFrom <= request.Date
                && (x.EffectiveTo == null || x.EffectiveTo >= request.Date))
            .ToListAsync(cancellationToken);
        var overrides = await db.GlobalMealOverrides.AsNoTracking()
            .Where(x => x.Wing == selectedWing
                && x.MealPeriod == request.MealPeriod
                && x.EffectiveFrom <= request.Date
                && x.EffectiveTo >= request.Date)
            .OrderByDescending(x => x.EffectiveFrom)
            .ToListAsync(cancellationToken);

        var activeOverride = overrides.FirstOrDefault();
        var eligibleStudents = students
            .Where(student => activeOverride is not null
                ? activeOverride.IsOn
                : statuses
                    .Where(x => x.StudentId == student.Id && x.MealPeriod == request.MealPeriod)
                    .OrderByDescending(x => x.EffectiveFrom)
                    .FirstOrDefault()?.IsOn == true)
            .ToList();

        if (eligibleStudents.Count == 0)
            return BadRequest(new { message = "No eligible meal-active students were found for the selected date and meal." });

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var oldDistributions = await db.DswSubsidyDistributions.Where(x => x.SubsidyId == id).ToListAsync(cancellationToken);
            db.DswSubsidyDistributions.RemoveRange(oldDistributions);

            var perStudentSubsidy = request.SubsidyAmount / eligibleStudents.Count;
            var allocations = FinancialMath.AllocateByConsumption(
                request.SubsidyAmount,
                eligibleStudents.Select(s => (StudentId: s.Id, Count: 1)).ToList());

            subsidy.Wing = selectedWing;
            subsidy.SubsidyAmount = request.SubsidyAmount;
            var oldDate = subsidy.Date;
            subsidy.Date = request.Date;
            subsidy.MealPeriod = request.MealPeriod;
            subsidy.EligibleStudentCount = eligibleStudents.Count;
            subsidy.PerStudentSubsidy = perStudentSubsidy;
            subsidy.Notes = request.Notes?.Trim();

            db.DswSubsidyDistributions.AddRange(allocations.Select(allocation => new DswSubsidyDistribution
            {
                SubsidyId = subsidy.Id,
                StudentId = allocation.StudentId,
                Date = request.Date,
                MealPeriod = request.MealPeriod,
                SubsidyAmount = allocation.Amount,
            }));

            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            var minDate = oldDate < request.Date ? oldDate : request.Date;
            await billing.RecalculateForwardAsync(minDate.Month, minDate.Year, cancellationToken);

            return Ok(new
            {
                subsidy.Id,
                subsidy.Wing,
                subsidy.Date,
                subsidy.MealPeriod,
                subsidy.SubsidyAmount,
                subsidy.EligibleStudentCount,
                subsidy.PerStudentSubsidy,
            });
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException postgres && postgres.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            await transaction.RollbackAsync(cancellationToken);
            return Conflict(new { message = "A DSW subsidy is already active for this wing, date, and meal period." });
        }
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission(MenuKeys.AdminBilling, PermissionActions.Delete)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var subsidy = await db.DswSubsidies.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (subsidy is null) return NotFound();

        var adminWing = await currentUser.GetAdminWingAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(adminWing) && subsidy.Wing != adminWing) return Forbid();

        var distributions = await db.DswSubsidyDistributions.Where(x => x.SubsidyId == id).ToListAsync(cancellationToken);
        db.DswSubsidyDistributions.RemoveRange(distributions);
        db.DswSubsidies.Remove(subsidy);

        await db.SaveChangesAsync(cancellationToken);
        await billing.RecalculateForwardAsync(subsidy.Date.Month, subsidy.Date.Year, cancellationToken);
        return NoContent();
    }

    [HttpPost("recalculate")]
    [RequirePermission(MenuKeys.AdminBilling, PermissionActions.Edit)]
    public async Task<IActionResult> Recalculate(
        [FromQuery] int month,
        [FromQuery] int year,
        CancellationToken cancellationToken)
    {
        // Forward, not just this month: a manual recalculation must also refresh every later
        // month's carried-due, or that chain silently keeps a stale figure (M6).
        await billing.RecalculateForwardAsync(month, year, cancellationToken);
        return NoContent();
    }
}
