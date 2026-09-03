using HallBackend.Application.Dtos;
using HallBackend.Application.Services;
using HallBackend.Domain.Constants;
using HallBackend.Infrastructure.Data;
using HallBackend.Infrastructure.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Controllers;

[ApiController]
[Authorize]
[RequirePermission(MenuKeys.AdminDailyCost, PermissionActions.View, AltMenuKey = MenuKeys.StudentDailyCost)]
[Route("api/daily-cost")]
public sealed class DailyCostController(HallDbContext db, CurrentUserService currentUser) : ControllerBase
{
    // Not output-cached: the response carries the caller's own MyCost figures, and caching by
    // anything other than the exact user would leak one student's personal costs to another.
    [HttpGet]
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

        // GetMealWingAsync would silently turn "All" into "Male" for a wingless admin/super_admin
        // — it has no way to say "every wing". GetMealWingFilterAsync does, returning null, which
        // this report already treats as "All" everywhere below (every effectiveGender != "All"
        // branch was written expecting this and was previously unreachable for such a caller).
        var effectiveGender = await currentUser.GetMealWingFilterAsync(gender, cancellationToken) ?? "All";
        var from = new DateOnly(year, month, 1);
        var to = from.AddMonths(1).AddDays(-1);

        var transactions = await db.StockTransactions.AsNoTracking()
            .Include(x => x.Item)
            .Where(x => x.TransactionType == "out" && x.Date >= from && x.Date <= to)
            .ToListAsync(cancellationToken);

        // Optimize: Filter students by effectiveGender first
        // Billable-status only (MealResolutionContext.BillableStatus) — matching the billing
        // engine, the Meal Sheet and meal counts, so this report's per-head figures agree with
        // what students are actually charged rather than diluting the divisor with departed
        // students whose meal status was left on.
        var studentsQuery = db.Students.AsNoTracking().Where(x => x.Status == MealResolutionContext.BillableStatus);
        if (effectiveGender != "All")
        {
            studentsQuery = studentsQuery.Where(x => x.Gender == effectiveGender);
        }
        var students = await studentsQuery.ToListAsync(cancellationToken);

        // Shared with the billing engine (BillingCalculationService) rather than re-querying and
        // re-grouping overrides/statuses/preferences by hand a second time here: two independent
        // copies of "who counts as on for this meal" are two things that can silently drift apart
        // — which is exactly what happened before this changed. `asOfUtc` support (excluding a
        // same-day toggle from a stock-out recorded before it) lives once, in this class, and both
        // callers get it automatically instead of one having the fix and the other not.
        var meals = await MealResolutionContext.LoadAsync(db, from, to, cancellationToken);

        var subsidies = await db.DswSubsidies.AsNoTracking()
            .Where(x => x.Date >= from && x.Date <= to && !x.IsReversed)
            .ToListAsync(cancellationToken);

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

        var today = HallClock.Today;
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
                    // A wing override doesn't know who existed at the hall when it was created —
                    // without this, a student created today would show as a meal participant on
                    // a past date their own account didn't exist on yet.
                    if (!MealResolutionContext.HasJoinedBy(student, date)) return false;

                    var wingOverride = meals.FindOverride(student.Gender, period, date);
                    return meals.IsMealOn(student.Id, period, date, wingOverride);
                }).ToList();

                var periodGuests = effectiveGender == "All"
                    ? meals.GetGuestMeals("Male", period, date).Concat(meals.GetGuestMeals("Female", period, date)).ToList()
                    : meals.GetGuestMeals(effectiveGender, period, date).ToList();

                var totalGuestMeals = periodGuests.Sum(x => x.GuestCount);
                var regularStudents = participants.Count;
                var totalMeals = regularStudents + totalGuestMeals;
                var overallPerHead = FinancialMath.PerHead(netCost, totalMeals);

                var participantPreferences = participants
                    .Select(student => new { Student = student, OptionId = meals.FindSelectedOption(student.Id, period, date) })
                    .ToList();

                // Get active options that have students, guests, or transactions
                var activeOptions = optionItems
                    .Where(opt => (effectiveGender == "All" || opt.Wing == effectiveGender)
                        && (participantPreferences.Any(x => x.OptionId == opt.Id)
                            || periodGuests.Any(g => meals.FindSelectedOption(g.StudentId, period, date) == opt.Id)
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
                    var commonPerHead = FinancialMath.PerHead(netCommonCost, totalMeals);
                    optionBreakdowns.Add(new DailyCostOptionBreakdownDto(Guid.Empty, "Common", netCommonCost, totalMeals, commonPerHead, totalGuestMeals, totalMeals));

                    foreach (var opt in activeOptions)
                    {
                        var optRegularCount = participantPreferences.Count(x => x.OptionId == opt.Id);
                        var optGuestCount = periodGuests
                            .Where(g => meals.FindSelectedOption(g.StudentId, period, date) == opt.Id)
                            .Sum(g => g.GuestCount);
                        var optTotalCount = optRegularCount + optGuestCount;

                        var optTxCost = periodTxs
                            .Where(t => t.Item != null && (t.ItemId == opt.Id || (t.Item.LinkedOptionId.HasValue && t.Item.LinkedOptionId.Value == opt.Id)))
                            .Sum(t => t.TotalCost);

                        var optPerHead = FinancialMath.PerHead(optTxCost, optTotalCount);
                        var totalOptPerHead = commonPerHead + optPerHead;

                        optionBreakdowns.Add(new DailyCostOptionBreakdownDto(opt.Id, opt.Item, optTxCost, optTotalCount, totalOptPerHead, optGuestCount, optTotalCount));
                    }
                }

                if (currentStudentId.HasValue)
                {
                    var isCurrentStudentOn = participants.Any(p => p.Id == currentStudentId.Value);
                    var currentStudentGuests = periodGuests.Where(g => g.StudentId == currentStudentId.Value).Sum(g => g.GuestCount);
                    var myPortions = (isCurrentStudentOn ? 1 : 0) + currentStudentGuests;

                    if (myPortions > 0)
                    {
                        foreach (var tx in periodTxs)
                        {
                            if (tx.Item is null)
                            {
                                myCost += FinancialMath.PerHead(tx.TotalCost, totalMeals) * myPortions;
                                continue;
                            }

                            var totalTxCount = meals.CountTotalParticipants(tx.Item, period, date, tx.CreatedAtUtc);
                            if (totalTxCount == 0) continue;
                            var share = tx.TotalCost / totalTxCount;

                            if (isCurrentStudentOn)
                            {
                                var chargedStudents = meals.Participants(tx.Item, period, date, tx.CreatedAtUtc);
                                if (chargedStudents.Any(p => p.Id == currentStudentId.Value))
                                {
                                    myCost += share;
                                }
                            }

                            if (currentStudentGuests > 0)
                            {
                                var chargedGuests = meals.GuestParticipants(tx.Item, period, date);
                                if (chargedGuests.Any(g => g.StudentId == currentStudentId.Value))
                                {
                                    myCost += share * currentStudentGuests;
                                }
                            }
                        }

                        // Matches overallPerHead, which is netCost (gross minus subsidy) divided
                        // across every participant regardless of option
                        if (totalMeals > 0)
                        {
                            myCost -= (subsidyAmount / totalMeals) * myPortions;
                        }
                    }
                }

                return new DailyCostMealDto(netCost, totalMeals, overallPerHead, myCost, optionBreakdowns, totalGuestMeals, totalMeals);
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

        // Footer totals: sum of each day's per-head for each period. Students is the average
        // headcount over the days that actually have data, not a sum — summing a headcount
        // across every day of the month produced a number in the thousands with no meaning (a
        // 30-day month with 100 students reported 3,000 "students"). Days beyond tomorrow are
        // still zeroed above and excluded here, so they cannot drag the average down.
        var daysWithData = rows.Count(x => x.Date <= tomorrow);
        int AverageStudents(Func<DailyCostRowDto, int> selector)
            => daysWithData == 0 ? 0 : (int)Math.Round(rows.Sum(selector) / (decimal)daysWithData, MidpointRounding.AwayFromZero);

        var breakfastTotal = new DailyCostMealDto(
            rows.Sum(x => x.Breakfast.Cost),
            AverageStudents(x => x.Breakfast.Students),
            rows.Sum(x => x.Breakfast.PerHead),
            rows.Sum(x => x.Breakfast.MyCost),
            new List<DailyCostOptionBreakdownDto>());

        var lunchTotal = new DailyCostMealDto(
            rows.Sum(x => x.Lunch.Cost),
            AverageStudents(x => x.Lunch.Students),
            rows.Sum(x => x.Lunch.PerHead),
            rows.Sum(x => x.Lunch.MyCost),
            new List<DailyCostOptionBreakdownDto>());

        var dinnerTotal = new DailyCostMealDto(
            rows.Sum(x => x.Dinner.Cost),
            AverageStudents(x => x.Dinner.Students),
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
