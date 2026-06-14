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
        var students = await db.Students.AsNoTracking().ToListAsync(cancellationToken);
        var statuses = await db.MealStatusHistory.AsNoTracking()
            .Where(x => x.EffectiveFrom <= to && (x.EffectiveTo == null || x.EffectiveTo >= from))
            .ToListAsync(cancellationToken);
        var overrides = await db.GlobalMealOverrides.AsNoTracking()
            .Where(x => x.EffectiveFrom <= to && x.EffectiveTo >= from)
            .ToListAsync(cancellationToken);
        var subsidies = await db.DswSubsidies.AsNoTracking()
            .Where(x => x.Date >= from && x.Date <= to && !x.IsReversed)
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
                var subsidyAmount = subsidies
                    .Where(x => x.Date == date
                        && x.MealPeriod == period
                        && (effectiveGender == "All" || x.Wing == effectiveGender))
                    .Sum(x => x.SubsidyAmount);
                var netCost = transactionCost - subsidyAmount;
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
                return new DailyCostMealDto(netCost, filtered.Count, filtered.Count == 0 ? 0m : netCost / filtered.Count);
            }
            var breakfast = Meal("breakfast");
            var lunch = Meal("lunch");
            var dinner = Meal("dinner");
            // Total per head = sum of each meal's per-head cost for this day
            var totalPerHead = breakfast.PerHead + lunch.PerHead + dinner.PerHead;
            rows.Add(new DailyCostRowDto(date, breakfast, lunch, dinner, totalPerHead));
        }


        // Footer totals: sum of each day's per-head for each period
        var breakfastTotal = new DailyCostMealDto(
            rows.Sum(x => x.Breakfast.Cost),
            rows.Sum(x => x.Breakfast.Students),
            rows.Sum(x => x.Breakfast.PerHead));
        var lunchTotal = new DailyCostMealDto(
            rows.Sum(x => x.Lunch.Cost),
            rows.Sum(x => x.Lunch.Students),
            rows.Sum(x => x.Lunch.PerHead));
        var dinnerTotal = new DailyCostMealDto(
            rows.Sum(x => x.Dinner.Cost),
            rows.Sum(x => x.Dinner.Students),
            rows.Sum(x => x.Dinner.PerHead));
        var grand = new DailyCostMealDto(
            breakfastTotal.Cost + lunchTotal.Cost + dinnerTotal.Cost,
            breakfastTotal.Students + lunchTotal.Students + dinnerTotal.Students,
            breakfastTotal.PerHead + lunchTotal.PerHead + dinnerTotal.PerHead);
        return new DailyCostReportDto(month, year, effectiveGender, rows, breakfastTotal, lunchTotal, dinnerTotal, grand);
    }
}
