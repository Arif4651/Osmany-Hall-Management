using HallBackend.Application.Dtos;
using HallBackend.Application.Services;
using HallBackend.Domain.Constants;
using HallBackend.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Controllers;

[ApiController]
[Authorize(Roles = Roles.HallAdministrators)]
[Route("api/daily-cost")]
public sealed class DailyCostController(HallDbContext db, CurrentUserService currentUser) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<DailyCostReportDto>> Get(
        [FromQuery] int month, [FromQuery] int year, [FromQuery] string gender = "All",
        CancellationToken cancellationToken = default)
    {
        if (month is < 1 or > 12 || gender is not ("All" or "Male" or "Female"))
            return BadRequest(new { message = "Invalid filters." });
        var adminWing = await currentUser.GetAdminWingAsync(cancellationToken);
        var effectiveGender = !string.IsNullOrWhiteSpace(adminWing) ? adminWing : gender;
        var from = new DateOnly(year, month, 1);
        var to = from.AddMonths(1).AddDays(-1);
        var transactions = await db.StockTransactions.AsNoTracking()
            .Include(x => x.Item)
            .Where(x => x.TransactionType == "out" && x.Date >= from && x.Date <= to)
            .ToListAsync(cancellationToken);
        var subsidies = await db.DswSubsidies.AsNoTracking()
            .Where(x => !x.IsReversed && x.Date >= from && x.Date <= to)
            .ToListAsync(cancellationToken);
        var students = await db.Students.AsNoTracking().ToListAsync(cancellationToken);
        var statuses = await db.MealStatusHistory.AsNoTracking()
            .Where(x => x.EffectiveFrom <= to && (x.EffectiveTo == null || x.EffectiveTo >= from))
            .ToListAsync(cancellationToken);
        var overrides = await db.GlobalMealOverrides.AsNoTracking()
            .Where(x => x.EffectiveFrom <= to && x.EffectiveTo >= from)
            .ToListAsync(cancellationToken);
        var rows = new List<DailyCostRowDto>();
        for (var date = from; date <= to; date = date.AddDays(1))
        {
            DailyCostMealDto Meal(string period)
            {
                var transactionCost = transactions
                    .Where(x => x.Date == date
                        && x.MealPeriod == period
                        && (effectiveGender == "All" || x.Item != null && x.Item.Wing == effectiveGender))
                    .Sum(x => x.TotalCost);
                var subsidyCost = subsidies
                    .Where(x => x.Date == date
                        && x.MealPeriod == period
                        && (effectiveGender == "All" || x.Wing == effectiveGender))
                    .Sum(x => x.SubsidyAmount);
                var participants = students.Where(student =>
                {
                    var mealOverride = overrides
                        .Where(x => x.Wing == student.Gender
                            && x.MealPeriod == period
                            && x.EffectiveFrom <= date
                            && x.EffectiveTo >= date)
                        .OrderByDescending(x => x.EffectiveFrom)
                        .FirstOrDefault();
                    return mealOverride is not null
                        ? mealOverride.IsOn
                        : statuses
                            .Where(x => x.StudentId == student.Id && x.MealPeriod == period && x.EffectiveFrom <= date && (x.EffectiveTo == null || x.EffectiveTo >= date))
                            .OrderByDescending(x => x.EffectiveFrom)
                            .FirstOrDefault()?.IsOn == true;
                }).ToList();
                var filtered = effectiveGender == "All" ? participants : participants.Where(x => x.Gender == effectiveGender).ToList();
                var totalCost = transactionCost - subsidyCost;
                var filteredCost = FinancialMath.ProportionalCost(totalCost, filtered.Count, participants.Count);
                return new DailyCostMealDto(filteredCost, filtered.Count, filtered.Count == 0 ? 0m : filteredCost / filtered.Count);
            }
            var breakfast = Meal("breakfast");
            var lunch = Meal("lunch");
            var dinner = Meal("dinner");
            var totalCost = breakfast.Cost + lunch.Cost + dinner.Cost;
            var count = breakfast.Students + lunch.Students + dinner.Students;
            rows.Add(new DailyCostRowDto(date, breakfast, lunch, dinner, totalCost, count == 0 ? 0m : totalCost / count));
        }

        static DailyCostMealDto Total(IEnumerable<DailyCostMealDto> meals)
        {
            var list = meals.ToList();
            var cost = list.Sum(x => x.Cost);
            var students = list.Sum(x => x.Students);
            return new DailyCostMealDto(cost, students, students == 0 ? 0m : cost / students);
        }
        var breakfastTotal = Total(rows.Select(x => x.Breakfast));
        var lunchTotal = Total(rows.Select(x => x.Lunch));
        var dinnerTotal = Total(rows.Select(x => x.Dinner));
        var grand = Total(rows.SelectMany(x => new[] { x.Breakfast, x.Lunch, x.Dinner }));
        return new DailyCostReportDto(month, year, effectiveGender, rows, breakfastTotal, lunchTotal, dinnerTotal, grand);
    }
}
