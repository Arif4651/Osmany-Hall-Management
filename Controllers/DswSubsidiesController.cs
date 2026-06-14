using HallBackend.Application.Dtos;
using HallBackend.Application.Services;
using HallBackend.Domain.Constants;
using HallBackend.Domain.Entities;
using HallBackend.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace HallBackend.Controllers;

[ApiController]
[Authorize(Roles = Roles.HallAdministrators)]
[Route("api/billing/subsidies")]
public sealed class DswSubsidiesController(
    HallDbContext db,
    CurrentUserService currentUser,
    BillingCalculationService billing,
    BillingPeriodService periods) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create(
        CreateDswSubsidyRequest request,
        CancellationToken cancellationToken)
    {
        if (request.SubsidyAmount <= 0m)
            return BadRequest(new { message = "Subsidy amount must be greater than zero." });
        if (!MealHistoryService.MealPeriods.Contains(request.MealPeriod))
            return BadRequest(new { message = "Invalid meal period." });

        await periods.EnsureOpenAsync(request.Date, cancellationToken);
        var selectedWing = await currentUser.GetManagedWingAsync(request.Wing, cancellationToken);

        var students = await db.Students.AsNoTracking()
            .Where(x => x.Status == "active" && x.Gender == selectedWing)
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
            var entity = new DswSubsidy
            {
                Wing = selectedWing,
                SubsidyAmount = request.SubsidyAmount,
                Date = request.Date,
                MealPeriod = request.MealPeriod,
                EligibleStudentCount = eligibleStudents.Count,
                PerStudentSubsidy = perStudentSubsidy,
                Notes = request.Notes?.Trim(),
                CreatedById = currentUser.UserId,
            };
            db.DswSubsidies.Add(entity);
            await db.SaveChangesAsync(cancellationToken);

            db.DswSubsidyDistributions.AddRange(eligibleStudents.Select(student => new DswSubsidyDistribution
            {
                SubsidyId = entity.Id,
                StudentId = student.Id,
                Date = request.Date,
                MealPeriod = request.MealPeriod,
                SubsidyAmount = perStudentSubsidy,
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

    [HttpPost("recalculate")]
    public async Task<IActionResult> Recalculate(
        [FromQuery] int month,
        [FromQuery] int year,
        CancellationToken cancellationToken)
    {
        await billing.RecalculateMonthAsync(month, year, cancellationToken);
        return NoContent();
    }
}
