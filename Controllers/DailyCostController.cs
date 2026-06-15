using HallBackend.Application.Dtos;
using HallBackend.Application.Services;
using HallBackend.Domain.Constants;
using HallBackend.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Controllers;

[ApiController]
[Authorize(Roles = Roles.HallAdministrators + "," + Roles.Student)]
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
        var effectiveGender = await currentUser.GetMealWingAsync(gender, cancellationToken);
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
        var preferences = await db.MealPreferenceHistory.AsNoTracking()
            .Where(x => x.EffectiveFrom <= to && (x.EffectiveTo == null || x.EffectiveTo >= from))
            .ToListAsync(cancellationToken);
        var optionItems = await db.InventoryItems.AsNoTracking()
            .Where(x => x.Category == "Options" && !x.IsDeleted)
            .ToListAsync(cancellationToken);

        var rows = new List<DailyCostRowDto>();

        List<DailyCostOptionBreakdownDto> AggregateTotalOptions(IEnumerable<DailyCostMealDto> meals)
        {
            return meals
                .SelectMany(m => m.Options)
                .GroupBy(o => o.Name)
                .Select(g => new DailyCostOptionBreakdownDto(
                    Guid.Empty,
                    g.Key,
                    g.Sum(x => x.Cost),
                    g.Sum(x => x.Students),
                    g.Sum(x => x.PerHead)
                ))
                .OrderBy(x => x.Name)
                .ToList();
        }

        List<DailyCostOptionBreakdownDto> AggregateRowOptions(DailyCostMealDto b, DailyCostMealDto l, DailyCostMealDto d)
        {
            var dailyOptions = b.Options.Concat(l.Options).Concat(d.Options)
                .Select(x => x.Name)
                .Distinct()
                .ToList();

            var breakdowns = new List<DailyCostOptionBreakdownDto>();
            foreach (var optName in dailyOptions)
            {
                decimal cost = 0m;
                int studentsCount = 0;
                decimal perHead = 0m;

                // Breakfast
                var bOpt = b.Options.FirstOrDefault(x => x.Name == optName);
                if (bOpt is not null)
                {
                    cost += bOpt.Cost;
                    studentsCount += bOpt.Students;
                    perHead += bOpt.PerHead;
                }
                else
                {
                    perHead += b.PerHead;
                }

                // Lunch
                var lOpt = l.Options.FirstOrDefault(x => x.Name == optName);
                if (lOpt is not null)
                {
                    cost += lOpt.Cost;
                    studentsCount += lOpt.Students;
                    perHead += lOpt.PerHead;
                }
                else
                {
                    perHead += l.PerHead;
                }

                // Dinner
                var dOpt = d.Options.FirstOrDefault(x => x.Name == optName);
                if (dOpt is not null)
                {
                    cost += dOpt.Cost;
                    studentsCount += dOpt.Students;
                    perHead += dOpt.PerHead;
                }
                else
                {
                    perHead += d.PerHead;
                }

                breakdowns.Add(new DailyCostOptionBreakdownDto(Guid.Empty, optName, cost, studentsCount, perHead));
            }

            return breakdowns.OrderBy(x => x.Name).ToList();
        }

        var today = DateOnly.FromDateTime(DateTime.Today);
        var tomorrow = today.AddDays(1);

        for (var date = from; date <= to; date = date.AddDays(1))
        {
            DailyCostMealDto Meal(string period)
            {
                var periodTxs = transactions
                    .Where(x => x.Date == date
                        && x.MealPeriod == period
                        && (effectiveGender == "All" || x.Item != null && x.Item.Wing == effectiveGender))
                    .ToList();

                var transactionCost = periodTxs.Sum(x => x.TotalCost);
                var subsidyAmount = subsidies
                    .Where(x => x.Date == date
                        && x.MealPeriod == period
                        && (effectiveGender == "All" || x.Wing == effectiveGender))
                    .Sum(x => x.SubsidyAmount);
                var netCost = transactionCost - subsidyAmount;

                var participants = students.Where(student =>
                {
                    if (effectiveGender != "All" && student.Gender != effectiveGender) return false;
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

                var totalStudents = participants.Count;
                var overallPerHead = totalStudents == 0 ? 0m : netCost / totalStudents;

                // Let's resolve the preferences for these participants
                var participantPreferences = participants.Select(student =>
                {
                    var selectedOptionId = preferences
                        .Where(x => x.StudentId == student.Id && x.MealPeriod == period && x.EffectiveFrom <= date && (x.EffectiveTo == null || x.EffectiveTo >= date))
                        .OrderByDescending(x => x.EffectiveFrom)
                        .FirstOrDefault()?.OptionItemId;
                    return new { Student = student, OptionId = selectedOptionId };
                }).ToList();

                // Get active options that have students or transactions
                var activeOptions = optionItems
                    .Where(opt => (effectiveGender == "All" || opt.Wing == effectiveGender)
                        && (participantPreferences.Any(x => x.OptionId == opt.Id)
                            || periodTxs.Any(t => t.ItemId == opt.Id || (t.Item != null && t.Item.LinkedOptionId == opt.Id))))
                    .ToList();

                var optionBreakdowns = new List<DailyCostOptionBreakdownDto>();

                if (activeOptions.Count > 0)
                {
                    // Common transactions: not in active options and not linked to active options
                    var activeOptionIds = activeOptions.Select(x => x.Id).ToHashSet();
                    var commonTxCostRobust = periodTxs
                        .Where(t => t.Item == null || (t.Item.Category != "Options" && (!t.Item.LinkedOptionId.HasValue || !activeOptionIds.Contains(t.Item.LinkedOptionId.Value))))
                        .Sum(t => t.TotalCost);

                    var netCommonCost = commonTxCostRobust - subsidyAmount;
                    var commonPerHead = totalStudents > 0 ? netCommonCost / totalStudents : 0m;

                    foreach (var opt in activeOptions)
                    {
                        var optStudentsCount = participantPreferences.Count(x => x.OptionId == opt.Id);
                        var optTxCost = periodTxs
                            .Where(t => t.Item != null && (t.ItemId == opt.Id || (t.Item.LinkedOptionId.HasValue && t.Item.LinkedOptionId.Value == opt.Id)))
                            .Sum(t => t.TotalCost);

                        var optPerHead = optStudentsCount > 0 ? optTxCost / optStudentsCount : 0m;
                        var totalOptPerHead = commonPerHead + optPerHead;

                        optionBreakdowns.Add(new DailyCostOptionBreakdownDto(opt.Id, opt.Item, optTxCost, optStudentsCount, totalOptPerHead));
                    }

                    var noOptionStudentsCount = participantPreferences.Count(x => !x.OptionId.HasValue || !activeOptionIds.Contains(x.OptionId.Value));
                    if (noOptionStudentsCount > 0)
                    {
                        optionBreakdowns.Add(new DailyCostOptionBreakdownDto(Guid.Empty, "No Option", 0m, noOptionStudentsCount, commonPerHead));
                    }
                }

                return new DailyCostMealDto(netCost, totalStudents, overallPerHead, optionBreakdowns);
            }

            DailyCostMealDto breakfast;
            DailyCostMealDto lunch;
            DailyCostMealDto dinner;
            decimal totalPerHead;
            List<DailyCostOptionBreakdownDto> rowOptions;

            if (date > tomorrow)
            {
                breakfast = new DailyCostMealDto(0m, 0, 0m, new List<DailyCostOptionBreakdownDto>());
                lunch = new DailyCostMealDto(0m, 0, 0m, new List<DailyCostOptionBreakdownDto>());
                dinner = new DailyCostMealDto(0m, 0, 0m, new List<DailyCostOptionBreakdownDto>());
                totalPerHead = 0m;
                rowOptions = new List<DailyCostOptionBreakdownDto>();
            }
            else
            {
                breakfast = Meal("breakfast");
                lunch = Meal("lunch");
                dinner = Meal("dinner");
                totalPerHead = breakfast.PerHead + lunch.PerHead + dinner.PerHead;
                rowOptions = AggregateRowOptions(breakfast, lunch, dinner);
            }

            rows.Add(new DailyCostRowDto(date, breakfast, lunch, dinner, totalPerHead, rowOptions));
        }

        // Footer totals: sum of each day's per-head for each period
        var breakfastOptionsTotal = AggregateTotalOptions(rows.Select(x => x.Breakfast));
        var breakfastTotal = new DailyCostMealDto(
            rows.Sum(x => x.Breakfast.Cost),
            rows.Sum(x => x.Breakfast.Students),
            rows.Sum(x => x.Breakfast.PerHead),
            breakfastOptionsTotal);

        var lunchOptionsTotal = AggregateTotalOptions(rows.Select(x => x.Lunch));
        var lunchTotal = new DailyCostMealDto(
            rows.Sum(x => x.Lunch.Cost),
            rows.Sum(x => x.Lunch.Students),
            rows.Sum(x => x.Lunch.PerHead),
            lunchOptionsTotal);

        var dinnerOptionsTotal = AggregateTotalOptions(rows.Select(x => x.Dinner));
        var dinnerTotal = new DailyCostMealDto(
            rows.Sum(x => x.Dinner.Cost),
            rows.Sum(x => x.Dinner.Students),
            rows.Sum(x => x.Dinner.PerHead),
            dinnerOptionsTotal);

        var grandOptionsTotal = AggregateTotalOptions(new[] { breakfastTotal, lunchTotal, dinnerTotal });
        var grand = new DailyCostMealDto(
            breakfastTotal.Cost + lunchTotal.Cost + dinnerTotal.Cost,
            breakfastTotal.Students + lunchTotal.Students + dinnerTotal.Students,
            breakfastTotal.PerHead + lunchTotal.PerHead + dinnerTotal.PerHead,
            grandOptionsTotal);

        return new DailyCostReportDto(month, year, effectiveGender, rows, breakfastTotal, lunchTotal, dinnerTotal, grand);
    }
}
