using HallBackend.Domain.Entities;
using HallBackend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Application.Services;

public sealed class BillingPeriodService(HallDbContext db)
{
    public async Task<bool> IsLockedAsync(int month, int year, CancellationToken cancellationToken)
        => await db.BillingPeriods.AsNoTracking()
            .AnyAsync(x => x.Month == month && x.Year == year && x.IsLocked, cancellationToken);

    public async Task EnsureOpenAsync(DateOnly date, CancellationToken cancellationToken)
    {
        if (await IsLockedAsync(date.Month, date.Year, cancellationToken))
        {
            throw new BillingPeriodClosedException();
        }
    }
}

public sealed class BillingPeriodClosedException : InvalidOperationException
{
    public BillingPeriodClosedException() : base("Billing period is closed.") { }
}

public sealed class InventoryTransactionService(
    HallDbContext db,
    BillingPeriodService periods)
{
    public async Task RebuildItemAsync(Guid itemId, CancellationToken cancellationToken)
    {
        var item = await db.InventoryItems.FirstOrDefaultAsync(x => x.Id == itemId, cancellationToken)
            ?? throw new InvalidOperationException("Inventory item was not found.");
        var transactions = await db.StockTransactions
            .Where(x => x.ItemId == itemId)
            .OrderBy(x => x.Date)
            .ThenBy(x => x.CreatedAtUtc)
            .ThenBy(x => x.Id)
            .ToListAsync(cancellationToken);

        decimal quantity = 0m;
        decimal wac = 0m;
        foreach (var transaction in transactions)
        {
            if (transaction.Quantity <= 0m) throw new InvalidOperationException("Quantity must be greater than zero.");
            
            if (!item.IsStored)
            {
                transaction.WacSnapshot = transaction.Rate;
                transaction.TotalCost = transaction.Quantity * transaction.Rate;
            }
            else if (transaction.TransactionType == "in")
            {
                if (transaction.Rate < 0m) throw new InvalidOperationException("Rate cannot be negative.");
                var nextQuantity = quantity + transaction.Quantity;
                wac = FinancialMath.WeightedAverageCost(quantity, wac, transaction.Quantity, transaction.Rate);
                quantity = nextQuantity;
                transaction.WacSnapshot = wac;
                transaction.TotalCost = transaction.Quantity * transaction.Rate;
            }
            else
            {
                if (transaction.Quantity > quantity)
                {
                    throw new InvalidOperationException($"Stock-out quantity exceeds available stock for {item.Item} on {transaction.Date:yyyy-MM-dd}.");
                }
                transaction.Rate = wac;
                transaction.WacSnapshot = wac;
                transaction.TotalCost = transaction.Quantity * wac;
                quantity -= transaction.Quantity;
            }
        }

        if (!item.IsStored)
        {
            item.CurrentStockQuantity = 0m;
            item.CurrentWac = 0m;
            item.Stock = 0m;
            item.AveragePrice = 0m;
            item.TotalStockValue = 0m;
        }
        else
        {
            item.CurrentStockQuantity = quantity;
            item.CurrentWac = wac;
            item.Stock = quantity;
            item.AveragePrice = wac;
            item.TotalStockValue = quantity * wac;
        }
        item.LastMovementDate = transactions.LastOrDefault()?.Date;
        item.Status = item.IsDeleted ? "archived" : item.Stock <= item.Threshold ? "low-stock" : "active";
    }

    public async Task EnsureDatesOpenAsync(params DateOnly[] dates)
    {
        foreach (var date in dates.Distinct())
        {
            await periods.EnsureOpenAsync(date, CancellationToken.None);
        }
    }
}

public sealed class MealHistoryService(HallDbContext db)
{
    public static readonly string[] MealPeriods = ["breakfast", "lunch", "dinner"];

    public async Task SetPreferenceAsync(Guid studentId, string mealPeriod, Guid? optionItemId, DateOnly effectiveFrom, CancellationToken cancellationToken)
    {
        ValidatePeriod(mealPeriod);
        if (optionItemId.HasValue && !await db.InventoryItems.AnyAsync(
                x => x.Id == optionItemId && x.Category == "Options" && !x.IsDeleted, cancellationToken))
        {
            throw new InvalidOperationException("The selected option item is not active.");
        }

        var current = await db.MealPreferenceHistory
            .Where(x => x.StudentId == studentId && x.MealPeriod == mealPeriod && x.EffectiveTo == null)
            .ToListAsync(cancellationToken);
        if (current.Any(x => x.EffectiveFrom > effectiveFrom))
            throw new InvalidOperationException("A newer meal preference already exists.");
        var sameDay = current.FirstOrDefault(x => x.EffectiveFrom == effectiveFrom);
        if (sameDay is not null)
        {
            sameDay.OptionItemId = optionItemId;
            return;
        }
        foreach (var row in current) row.EffectiveTo = effectiveFrom.AddDays(-1);
        db.MealPreferenceHistory.Add(new MealPreferenceHistory
        {
            StudentId = studentId,
            MealPeriod = mealPeriod,
            OptionItemId = optionItemId,
            EffectiveFrom = effectiveFrom,
        });
    }

    public async Task SetStatusAsync(Guid studentId, string mealPeriod, bool isOn, DateOnly effectiveFrom, CancellationToken cancellationToken)
    {
        ValidatePeriod(mealPeriod);
        var current = await db.MealStatusHistory
            .Where(x => x.StudentId == studentId && x.MealPeriod == mealPeriod && x.EffectiveTo == null)
            .ToListAsync(cancellationToken);
        if (current.Any(x => x.EffectiveFrom > effectiveFrom))
            throw new InvalidOperationException("A newer meal status already exists.");
        var sameDay = current.FirstOrDefault(x => x.EffectiveFrom == effectiveFrom);
        if (sameDay is not null)
        {
            sameDay.IsOn = isOn;
            return;
        }
        foreach (var row in current) row.EffectiveTo = effectiveFrom.AddDays(-1);
        db.MealStatusHistory.Add(new MealStatusHistory
        {
            StudentId = studentId,
            MealPeriod = mealPeriod,
            IsOn = isOn,
            EffectiveFrom = effectiveFrom,
        });
    }

    private static void ValidatePeriod(string mealPeriod)
    {
        if (!MealPeriods.Contains(mealPeriod)) throw new InvalidOperationException("Invalid meal period.");
    }
}

public sealed record MonthlyBillResult(
    Guid StudentId,
    decimal MonthlyBill,
    decimal DswSubsidy,
    decimal GuestMealBill,
    decimal ServiceBill,
    decimal CarriedDue,
    decimal ApprovedPaid,
    decimal DueBill,
    decimal TotalBill);

public sealed class BillingCalculationService(HallDbContext db, BillingPeriodService periods)
{
    public async Task<IReadOnlyList<MonthlyBillResult>> RecalculateMonthAsync(int month, int year, CancellationToken cancellationToken)
    {
        if (month is < 1 or > 12) throw new InvalidOperationException("Month must be between 1 and 12.");
        if (await periods.IsLockedAsync(month, year, cancellationToken))
        {
            return await ReadCacheAsync(month, year, cancellationToken);
        }

        var from = new DateOnly(year, month, 1);
        var to = from.AddMonths(1).AddDays(-1);
        var students = await db.Students.AsNoTracking().ToListAsync(cancellationToken);
        var transactions = await db.StockTransactions.AsNoTracking()
            .Include(x => x.Item)
            .Where(x => x.TransactionType == "out" && x.Date >= from && x.Date <= to)
            .OrderBy(x => x.Date)
            .ToListAsync(cancellationToken);
        var statuses = await db.MealStatusHistory.AsNoTracking()
            .Where(x => x.EffectiveFrom <= to && (x.EffectiveTo == null || x.EffectiveTo >= from))
            .ToListAsync(cancellationToken);
        var preferences = await db.MealPreferenceHistory.AsNoTracking()
            .Where(x => x.EffectiveFrom <= to && (x.EffectiveTo == null || x.EffectiveTo >= from))
            .ToListAsync(cancellationToken);

        var overrides = await db.GlobalMealOverrides.AsNoTracking()
            .Where(x => x.EffectiveFrom <= to && x.EffectiveTo >= from)
            .ToListAsync(cancellationToken);
        var guestMeals = await db.GuestMealRequests.AsNoTracking()
            .Where(x => x.Date >= from && x.Date <= to)
            .ToListAsync(cancellationToken);
        var subsidyTotals = await db.DswSubsidyDistributions.AsNoTracking()
            .Include(x => x.Subsidy)
            .Where(x => x.Date >= from
                && x.Date <= to
                && x.Subsidy != null
                && !x.Subsidy.IsReversed)
            .GroupBy(x => x.StudentId)
            .Select(x => new { StudentId = x.Key, Amount = x.Sum(y => y.SubsidyAmount) })
            .ToDictionaryAsync(x => x.StudentId, x => x.Amount, cancellationToken);

        var monthly = students.ToDictionary(x => x.Id, _ => 0m);
        var guestBill = students.ToDictionary(x => x.Id, _ => 0m);
        foreach (var transaction in transactions)
        {
            if (transaction.Item is null || string.IsNullOrWhiteSpace(transaction.MealPeriod)) continue;
            var transactionWing = transaction.Item.Wing;
            if (string.IsNullOrWhiteSpace(transactionWing)) continue;

            var participants = students.Where(student =>
            {
                if (student.Gender != transactionWing) return false;
                // Check global override first; fall back to individual status
                var globalOverride = overrides
                    .Where(x => x.Wing == student.Gender
                        && x.MealPeriod == transaction.MealPeriod
                        && x.EffectiveFrom <= transaction.Date
                        && x.EffectiveTo >= transaction.Date)
                    .OrderByDescending(x => x.EffectiveFrom)
                    .FirstOrDefault();

                bool on;
                if (globalOverride is not null)
                {
                    on = globalOverride.IsOn;
                }
                else
                {
                    on = statuses
                        .Where(x => x.StudentId == student.Id && x.MealPeriod == transaction.MealPeriod && x.EffectiveFrom <= transaction.Date && (x.EffectiveTo == null || x.EffectiveTo >= transaction.Date))
                        .OrderByDescending(x => x.EffectiveFrom)
                        .FirstOrDefault()?.IsOn ?? false;
                }

                var selected = preferences
                    .Where(x => x.StudentId == student.Id && x.MealPeriod == transaction.MealPeriod && x.EffectiveFrom <= transaction.Date && (x.EffectiveTo == null || x.EffectiveTo >= transaction.Date))
                    .OrderByDescending(x => x.EffectiveFrom)
                    .FirstOrDefault()?.OptionItemId;
                return FinancialMath.IsChargeParticipant(
                    transaction.Item.Category,
                    transaction.Item.Id,
                    transaction.Item.LinkedOptionId,
                    on,
                    selected);
            }).ToList();

            if (participants.Count == 0) continue;
            var share = transaction.TotalCost / participants.Count;
            foreach (var participant in participants) monthly[participant.Id] += share;

            // Guest meals: add share per guest count for each requesting student
            var transactionGuests = guestMeals
                .Where(x => x.Date == transaction.Date && x.MealPeriod == transaction.MealPeriod);
            foreach (var guest in transactionGuests)
            {
                if (!guestBill.ContainsKey(guest.StudentId)) continue;
                guestBill[guest.StudentId] += share * guest.GuestCount;
            }
        }

        var service = await db.ServiceBills.AsNoTracking()
            .Where(x => x.Month == month && x.Year == year)
            .OrderByDescending(x => x.Version)
            .Select(x => x.AmountPerStudent)
            .FirstOrDefaultAsync(cancellationToken);
        var previous = from.AddMonths(-1);
        var hasPreviousCache = await db.MonthlyBillCache.AsNoTracking()
            .AnyAsync(x => x.Month == previous.Month && x.Year == previous.Year, cancellationToken);
        if (!hasPreviousCache)
        {
            var previousFrom = new DateOnly(previous.Year, previous.Month, 1);
            var previousTo = previousFrom.AddMonths(1).AddDays(-1);
            var hasPreviousSources =
                await db.StockTransactions.AnyAsync(x => x.TransactionType == "out" && x.Date >= previousFrom && x.Date <= previousTo, cancellationToken)
                || await db.ServiceBills.AnyAsync(x => x.Month == previous.Month && x.Year == previous.Year, cancellationToken)
                || await db.PaymentSubmissions.AnyAsync(x => x.BillingMonth == previous.Month && x.BillingYear == previous.Year, cancellationToken)
                || await db.DueAdjustments.AnyAsync(x => x.BillingMonth == previous.Month && x.BillingYear == previous.Year, cancellationToken);
            if (hasPreviousSources) await RecalculateMonthAsync(previous.Month, previous.Year, cancellationToken);
        }
        var previousDue = await db.MonthlyBillCache.AsNoTracking()
            .Where(x => x.Month == previous.Month && x.Year == previous.Year)
            .ToDictionaryAsync(x => x.StudentId, x => x.DueBill, cancellationToken);
        var previousOverrides = await LatestOverridesAsync(previous.Month, previous.Year, cancellationToken);
        var currentOverrides = await LatestOverridesAsync(month, year, cancellationToken);
        var payments = await db.PaymentSubmissions.AsNoTracking()
            .Where(x => x.BillingMonth == month && x.BillingYear == year && x.Status == "approved")
            .GroupBy(x => x.StudentId)
            .Select(x => new { StudentId = x.Key, Amount = x.Sum(y => y.ApprovedAmount ?? 0m) })
            .ToDictionaryAsync(x => x.StudentId, x => x.Amount, cancellationToken);

        var existing = await db.MonthlyBillCache.Where(x => x.Month == month && x.Year == year).ToDictionaryAsync(x => x.StudentId, cancellationToken);
        var results = new List<MonthlyBillResult>();
        foreach (var student in students)
        {
            var carried = previousOverrides.GetValueOrDefault(student.Id, previousDue.GetValueOrDefault(student.Id));
            var subsidy = subsidyTotals.GetValueOrDefault(student.Id);
            var monthlyAfterSubsidy = monthly[student.Id] - subsidy;
            var total = monthlyAfterSubsidy + guestBill[student.Id] + service + carried;
            var approved = payments.GetValueOrDefault(student.Id);
            var adjustedDue = currentOverrides.TryGetValue(student.Id, out var overrideDue)
                ? overrideDue
                : (decimal?)null;
            var due = FinancialMath.CalculateDue(total, approved, adjustedDue);
            var result = new MonthlyBillResult(student.Id, monthlyAfterSubsidy, subsidy, guestBill[student.Id], service, carried, approved, due, total);
            results.Add(result);

            if (!existing.TryGetValue(student.Id, out var cache))
            {
                cache = new MonthlyBillCache { StudentId = student.Id, Month = month, Year = year };
                db.MonthlyBillCache.Add(cache);
            }
            cache.MonthlyBill = result.MonthlyBill;
            cache.DswSubsidy = result.DswSubsidy;
            cache.GuestMealBill = result.GuestMealBill;
            cache.ServiceBill = result.ServiceBill;
            cache.CarriedDue = result.CarriedDue;
            cache.TotalApprovedPaid = result.ApprovedPaid;
            cache.DueBill = result.DueBill;
            cache.TotalBill = result.TotalBill;
            cache.IsFinal = false;
            cache.LastCalculatedAtUtc = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(cancellationToken);
        return results;
    }

    public async Task RecalculateForwardAsync(int month, int year, CancellationToken cancellationToken)
    {
        var cursor = new DateOnly(year, month, 1);
        var end = DateOnly.FromDateTime(DateTime.Today).AddMonths(1);
        while (cursor <= end)
        {
            if (await periods.IsLockedAsync(cursor.Month, cursor.Year, cancellationToken)) break;
            await RecalculateMonthAsync(cursor.Month, cursor.Year, cancellationToken);
            cursor = cursor.AddMonths(1);
        }
    }

    private async Task<Dictionary<Guid, decimal>> LatestOverridesAsync(int month, int year, CancellationToken cancellationToken)
    {
        var rows = await db.DueAdjustments.AsNoTracking()
            .Where(x => x.BillingMonth == month && x.BillingYear == year)
            .OrderByDescending(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);
        return rows.GroupBy(x => x.StudentId).ToDictionary(x => x.Key, x => x.First().AdjustedAmount);
    }

    private async Task<IReadOnlyList<MonthlyBillResult>> ReadCacheAsync(int month, int year, CancellationToken cancellationToken)
        => await db.MonthlyBillCache.AsNoTracking()
            .Where(x => x.Month == month && x.Year == year)
            .Select(x => new MonthlyBillResult(x.StudentId, x.MonthlyBill, x.DswSubsidy, x.GuestMealBill, x.ServiceBill, x.CarriedDue, x.TotalApprovedPaid, x.DueBill, x.TotalBill))
            .ToListAsync(cancellationToken);
}
