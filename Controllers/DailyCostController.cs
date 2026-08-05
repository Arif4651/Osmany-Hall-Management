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
    [Microsoft.AspNetCore.OutputCaching.OutputCache(PolicyName = "daily-cost-cache")]
    public async Task<ActionResult<DailyCostReportDto>> Get(
        [FromQuery] int month, [FromQuery] int year, [FromQuery] string gender = "All",
        CancellationToken cancellationToken = default)
    {
        if (month is < 1 or > 12 || gender is not ("All" or "Male" or "Female"))
            return BadRequest(new { message = "Invalid filters." });

        var currentStudentId = await db.Users.AsNoTracking()
            .Where(x => x.Id == currentUser.UserId)
            .Select(x => x.StudentId)
            .FirstOrDefaultAsync(cancellationToken);

        var effectiveGender = await currentUser.GetMealWingAsync(gender, cancellationToken);
        var from = new DateOnly(year, month, 1);
        var to = from.AddMonths(1).AddDays(-1);

        var transactions = await db.StockTransactions.AsNoTracking()
            .Include(x => x.Item)
            .Where(x => x.TransactionType == "out" && x.Date >= from && x.Date <= to)
            .ToListAsync(cancellationToken);

        // Optimize: Filter students by effectiveGender first
        var studentsQuery = db.Students.AsNoTracking();
        if (effectiveGender != "All")
        {
            studentsQuery = studentsQuery.Where(x => x.Gender == effectiveGender);
        }
        var students = await studentsQuery.ToListAsync(cancellationToken);

        var statuses = await db.MealStatusHistory.AsNoTracking()
            .Where(x => x.EffectiveFrom <= to && (x.EffectiveTo == null || x.EffectiveTo >= from))
            .ToListAsync(cancellationToken);
        
        // Optimize: Group statuses by (StudentId, MealPeriod) to avoid O(N) lookup in loop
        var statusesGrouped = statuses
            .GroupBy(x => new { x.StudentId, x.MealPeriod })
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.EffectiveFrom).ToList());

        var overrides = await db.GlobalMealOverrides.AsNoTracking()
            .Where(x => x.EffectiveFrom <= to && x.EffectiveTo >= from)
            .ToListAsync(cancellationToken);

        // Optimize: Group overrides by (Wing, MealPeriod)
        var overridesGrouped = overrides
            .GroupBy(x => new { x.Wing, x.MealPeriod })
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.EffectiveFrom).ToList());

        var subsidies = await db.DswSubsidies.AsNoTracking()
            .Where(x => x.Date >= from && x.Date <= to && !x.IsReversed)
            .ToListAsync(cancellationToken);

        var preferences = await db.MealPreferenceHistory.AsNoTracking()
            .Where(x => x.EffectiveFrom <= to && (x.EffectiveTo == null || x.EffectiveTo >= from))
            .ToListAsync(cancellationToken);

        // Optimize: Group preferences by (StudentId, MealPeriod, DayOfWeek)
        var preferencesGrouped = preferences
            .GroupBy(x => new { x.StudentId, x.MealPeriod, x.DayOfWeek })
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.EffectiveFrom).ToList());

        var optionItems = await db.InventoryItems.AsNoTracking()
            .Where(x => x.Category == "Options" && !x.IsDeleted)
            .ToListAsync(cancellationToken);

        // Optimize: bucket transactions and subsidies by (Date, MealPeriod) once. The loop below
        // runs ~90 times per report (days x meal periods) and previously rescanned both full
        // month lists on every pass. Wing filtering is applied here so it happens once per row.
        var transactionsGrouped = transactions
            .Where(x => effectiveGender == "All" || (x.Item != null && x.Item.Wing == effectiveGender))
            .GroupBy(x => (x.Date, x.MealPeriod))
            .ToDictionary(g => g.Key, g => g.ToList());
        var subsidiesGrouped = subsidies
            .Where(x => effectiveGender == "All" || x.Wing == effectiveGender)
            .GroupBy(x => (x.Date, x.MealPeriod))
            .ToDictionary(g => g.Key, g => g.Sum(y => y.SubsidyAmount));

        var rows = new List<DailyCostRowDto>();

        var today = DateOnly.FromDateTime(DateTime.Today);
        var tomorrow = today.AddDays(1);

        for (var date = from; date <= to; date = date.AddDays(1))
        {
            DailyCostMealDto Meal(string period)
            {
                var periodTxs = transactionsGrouped.TryGetValue((date, period), out var bucket)
                    ? bucket
                    : [];

                var transactionCost = periodTxs.Sum(x => x.TotalCost);
                var subsidyAmount = subsidiesGrouped.GetValueOrDefault((date, period));
                var netCost = transactionCost - subsidyAmount;

                var participants = students.Where(student =>
                {
                    if (effectiveGender != "All" && student.Gender != effectiveGender) return false;
                    
                    // Optimize: Look up in grouped dictionary for overrides
                    if (overridesGrouped.TryGetValue(new { Wing = student.Gender, MealPeriod = period }, out var wingOverrides))
                    {
                        var mealOverride = wingOverrides.FirstOrDefault(x => x.EffectiveFrom <= date && x.EffectiveTo >= date);
                        if (mealOverride is not null)
                        {
                            return mealOverride.IsOn;
                        }
                    }

                    // Optimize: Look up in grouped dictionary for statuses
                    if (statusesGrouped.TryGetValue(new { StudentId = student.Id, MealPeriod = period }, out var studentStatuses))
                    {
                        var activeStatus = studentStatuses
                            .FirstOrDefault(x => x.EffectiveFrom <= date && (x.EffectiveTo == null || x.EffectiveTo >= date));
                        return activeStatus?.IsOn == true;
                    }

                    return false;
                }).ToList();

                var totalStudents = participants.Count;
                var overallPerHead = FinancialMath.PerHead(netCost, totalStudents);

                // Let's resolve the preferences for these participants using grouped lookup
                var participantPreferences = participants.Select(student =>
                {
                    Guid? selectedOptionId = null;
                    if (preferencesGrouped.TryGetValue(new { StudentId = student.Id, MealPeriod = period, DayOfWeek = date.DayOfWeek }, out var studentPrefs))
                    {
                        selectedOptionId = studentPrefs
                            .FirstOrDefault(x => x.EffectiveFrom <= date && (x.EffectiveTo == null || x.EffectiveTo >= date))
                            ?.OptionItemId;
                    }
                    return new { Student = student, OptionId = selectedOptionId };
                }).ToList();

                // Get active options that have students or transactions
                var activeOptions = optionItems
                    .Where(opt => (effectiveGender == "All" || opt.Wing == effectiveGender)
                        && (participantPreferences.Any(x => x.OptionId == opt.Id)
                            || periodTxs.Any(t => t.ItemId == opt.Id || (t.Item != null && t.Item.LinkedOptionId == opt.Id))))
                    .ToList();

                var optionBreakdowns = new List<DailyCostOptionBreakdownDto>();
                decimal myCost = 0m;

                if (activeOptions.Count > 0)
                {
                    // Common transactions: not in active options and not linked to active options
                    var activeOptionIds = activeOptions.Select(x => x.Id).ToHashSet();
                    var commonTxCostRobust = periodTxs
                        .Where(t => t.Item == null || (t.Item.Category != "Options" && (!t.Item.LinkedOptionId.HasValue || !activeOptionIds.Contains(t.Item.LinkedOptionId.Value))))
                        .Sum(t => t.TotalCost);

                    var netCommonCost = commonTxCostRobust - subsidyAmount;
                    var commonPerHead = FinancialMath.PerHead(netCommonCost, totalStudents);
                    optionBreakdowns.Add(new DailyCostOptionBreakdownDto(Guid.Empty, "Common", netCommonCost, totalStudents, commonPerHead));

                    foreach (var opt in activeOptions)
                    {
                        var optStudentsCount = participantPreferences.Count(x => x.OptionId == opt.Id);
                        var optTxCost = periodTxs
                            .Where(t => t.Item != null && (t.ItemId == opt.Id || (t.Item.LinkedOptionId.HasValue && t.Item.LinkedOptionId.Value == opt.Id)))
                            .Sum(t => t.TotalCost);

                        var optPerHead = FinancialMath.PerHead(optTxCost, optStudentsCount);
                        var totalOptPerHead = commonPerHead + optPerHead;

                        optionBreakdowns.Add(new DailyCostOptionBreakdownDto(opt.Id, opt.Item, optTxCost, optStudentsCount, totalOptPerHead));
                    }
                }

                if (currentStudentId.HasValue)
                {
                    var studentPreference = participantPreferences.FirstOrDefault(x => x.Student.Id == currentStudentId.Value);
                    if (studentPreference is not null)
                    {
                        foreach (var tx in periodTxs)
                        {
                            if (tx.Item is null)
                            {
                                myCost += FinancialMath.PerHead(tx.TotalCost, totalStudents);
                                continue;
                            }

                            var chargedStudents = participantPreferences.Count(x => FinancialMath.IsChargeParticipant(
                                tx.Item.Category,
                                tx.Item.Id,
                                tx.Item.LinkedOptionId,
                                true,
                                x.OptionId));

                            if (chargedStudents == 0) continue;
                            var isCharged = FinancialMath.IsChargeParticipant(
                                tx.Item.Category,
                                tx.Item.Id,
                                tx.Item.LinkedOptionId,
                                true,
                                studentPreference.OptionId);

                            if (isCharged)
                            {
                                myCost += tx.TotalCost / chargedStudents;
                            }
                        }
                    }
                }

                return new DailyCostMealDto(netCost, totalStudents, overallPerHead, myCost, optionBreakdowns);
            }

            DailyCostMealDto breakfast;
            DailyCostMealDto lunch;
            DailyCostMealDto dinner;
            decimal totalPerHead;
            decimal totalMyCost;
            List<DailyCostOptionBreakdownDto> rowOptions;

            if (date > tomorrow)
            {
                breakfast = new DailyCostMealDto(0m, 0, 0m, 0m, new List<DailyCostOptionBreakdownDto>());
                lunch = new DailyCostMealDto(0m, 0, 0m, 0m, new List<DailyCostOptionBreakdownDto>());
                dinner = new DailyCostMealDto(0m, 0, 0m, 0m, new List<DailyCostOptionBreakdownDto>());
                totalPerHead = 0m;
                totalMyCost = 0m;
                rowOptions = new List<DailyCostOptionBreakdownDto>();
            }
            else
            {
                breakfast = Meal("breakfast");
                lunch = Meal("lunch");
                dinner = Meal("dinner");
                totalPerHead = breakfast.PerHead + lunch.PerHead + dinner.PerHead;
                totalMyCost = breakfast.MyCost + lunch.MyCost + dinner.MyCost;
                rowOptions = new List<DailyCostOptionBreakdownDto>();
            }

            rows.Add(new DailyCostRowDto(date, breakfast, lunch, dinner, totalPerHead, totalMyCost, rowOptions));
        }

        // Footer totals: sum of each day's per-head for each period
        var breakfastTotal = new DailyCostMealDto(
            rows.Sum(x => x.Breakfast.Cost),
            rows.Sum(x => x.Breakfast.Students),
            rows.Sum(x => x.Breakfast.PerHead),
            rows.Sum(x => x.Breakfast.MyCost),
            new List<DailyCostOptionBreakdownDto>());

        var lunchTotal = new DailyCostMealDto(
            rows.Sum(x => x.Lunch.Cost),
            rows.Sum(x => x.Lunch.Students),
            rows.Sum(x => x.Lunch.PerHead),
            rows.Sum(x => x.Lunch.MyCost),
            new List<DailyCostOptionBreakdownDto>());

        var dinnerTotal = new DailyCostMealDto(
            rows.Sum(x => x.Dinner.Cost),
            rows.Sum(x => x.Dinner.Students),
            rows.Sum(x => x.Dinner.PerHead),
            rows.Sum(x => x.Dinner.MyCost),
            new List<DailyCostOptionBreakdownDto>());

        var grand = new DailyCostMealDto(
            breakfastTotal.Cost + lunchTotal.Cost + dinnerTotal.Cost,
            breakfastTotal.Students + lunchTotal.Students + dinnerTotal.Students,
            breakfastTotal.PerHead + lunchTotal.PerHead + dinnerTotal.PerHead,
            breakfastTotal.MyCost + lunchTotal.MyCost + dinnerTotal.MyCost,
            new List<DailyCostOptionBreakdownDto>());

        return new DailyCostReportDto(month, year, effectiveGender, rows, breakfastTotal, lunchTotal, dinnerTotal, grand);
    }
}
