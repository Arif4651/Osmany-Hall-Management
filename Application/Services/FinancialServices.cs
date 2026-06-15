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

        if (!item.IsStored)
        {
            if (transactions.Count > 0)
            {
                var minDate = transactions.Min(x => x.Date);
                var maxDate = transactions.Max(x => x.Date);
                var students = await db.Students.AsNoTracking().Where(x => x.Gender == item.Wing).ToListAsync(cancellationToken);
                var overrides = await db.GlobalMealOverrides.AsNoTracking()
                    .Where(x => x.Wing == item.Wing && x.EffectiveFrom <= maxDate && x.EffectiveTo >= minDate)
                    .ToListAsync(cancellationToken);
                var statuses = await db.MealStatusHistory.AsNoTracking()
                    .Where(x => x.EffectiveFrom <= maxDate && (x.EffectiveTo == null || x.EffectiveTo >= minDate))
                    .ToListAsync(cancellationToken);
                var preferences = await db.MealPreferenceHistory.AsNoTracking()
                    .Where(x => x.EffectiveFrom <= maxDate && (x.EffectiveTo == null || x.EffectiveTo >= minDate))
                    .ToListAsync(cancellationToken);

                foreach (var transaction in transactions)
                {
                    if (transaction.Quantity <= 0m) throw new InvalidOperationException("Quantity must be greater than zero.");
                    if (string.IsNullOrWhiteSpace(transaction.MealPeriod))
                    {
                        transaction.ParticipantCount = 0;
                        transaction.Rate = 0m;
                        transaction.WacSnapshot = 0m;
                        continue;
                    }

                    var participantsCount = students.Count(student =>
                    {
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
                            .Where(x => x.StudentId == student.Id && x.MealPeriod == transaction.MealPeriod && x.DayOfWeek == transaction.Date.DayOfWeek && x.EffectiveFrom <= transaction.Date && (x.EffectiveTo == null || x.EffectiveTo >= transaction.Date))
                            .OrderByDescending(x => x.EffectiveFrom)
                            .FirstOrDefault()?.OptionItemId;

                        return FinancialMath.IsChargeParticipant(
                            item.Category,
                            item.Id,
                            item.LinkedOptionId,
                            on,
                            selected);
                    });

                    transaction.ParticipantCount = participantsCount;
                    transaction.Rate = participantsCount > 0 ? (transaction.TotalCost / participantsCount) : 0m;
                    transaction.WacSnapshot = transaction.Rate;
                }
            }

            var lastTx = transactions.LastOrDefault();
            item.CurrentStockQuantity = lastTx != null ? (decimal)(lastTx.ParticipantCount ?? 0) : 0m;
            item.CurrentWac = lastTx != null ? lastTx.Rate : 0m;
            item.Stock = item.CurrentStockQuantity;
            item.AveragePrice = item.CurrentWac;
            item.TotalStockValue = transactions.Sum(x => x.TotalCost);
        }
        else
        {
            decimal quantity = 0m;
            decimal wac = 0m;
            foreach (var transaction in transactions)
            {
                if (transaction.Quantity <= 0m) throw new InvalidOperationException("Quantity must be greater than zero.");
                
                if (transaction.TransactionType == "in")
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

        var targetDayOfWeek = effectiveFrom.DayOfWeek;

        var current = await db.MealPreferenceHistory
            .Where(x => x.StudentId == studentId && x.MealPeriod == mealPeriod && x.DayOfWeek == targetDayOfWeek && x.EffectiveTo == null)
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
            DayOfWeek = targetDayOfWeek,
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

    /// <summary>
    /// Admin-only override: sets the meal status for a specific date even when a newer record already
    /// exists. If a future open record is present, a bounded single-day record is inserted/updated for
    /// <paramref name="targetDate"/> so the future chain is not disturbed.
    /// </summary>
    public async Task AdminForceStatusAsync(Guid studentId, string mealPeriod, bool isOn, DateOnly targetDate, CancellationToken cancellationToken)
    {
        ValidatePeriod(mealPeriod);

        // Check whether a future open record (EffectiveTo == null) beyond targetDate already exists.
        var allOpen = await db.MealStatusHistory
            .Where(x => x.StudentId == studentId && x.MealPeriod == mealPeriod && x.EffectiveTo == null)
            .ToListAsync(cancellationToken);

        var hasFuture = allOpen.Any(x => x.EffectiveFrom > targetDate);

        if (!hasFuture)
        {
            // No future record — behave exactly like the normal SetStatusAsync path.
            await SetStatusAsync(studentId, mealPeriod, isOn, targetDate, cancellationToken);
            return;
        }

        // A future record exists. We must not close it. Instead we upsert a bounded record for exactly targetDate.
        // First check if a bounded record already covers targetDate.
        var bounded = await db.MealStatusHistory
            .Where(x => x.StudentId == studentId
                && x.MealPeriod == mealPeriod
                && x.EffectiveFrom == targetDate
                && x.EffectiveTo == targetDate)
            .FirstOrDefaultAsync(cancellationToken);

        if (bounded is not null)
        {
            bounded.IsOn = isOn;
            return;
        }

        // Check if a record that starts on targetDate exists (open or ending on the same day).
        var sameStart = await db.MealStatusHistory
            .Where(x => x.StudentId == studentId && x.MealPeriod == mealPeriod && x.EffectiveFrom == targetDate)
            .FirstOrDefaultAsync(cancellationToken);

        if (sameStart is not null)
        {
            // Narrow it to a single day.
            sameStart.IsOn = isOn;
            sameStart.EffectiveTo = targetDate;
            return;
        }

        // Find the open record that was active on targetDate (EffectiveFrom <= targetDate) and split it:
        // close the current record at targetDate-1, insert the single-day override, then re-open a new
        // record for targetDate+1 restoring the original value.
        var covering = allOpen
            .Where(x => x.EffectiveFrom <= targetDate)
            .OrderByDescending(x => x.EffectiveFrom)
            .FirstOrDefault();

        if (covering is not null)
        {
            var originalIsOn = covering.IsOn;
            covering.EffectiveTo = targetDate.AddDays(-1);

            // Single-day override.
            db.MealStatusHistory.Add(new MealStatusHistory
            {
                StudentId = studentId,
                MealPeriod = mealPeriod,
                IsOn = isOn,
                EffectiveFrom = targetDate,
                EffectiveTo = targetDate,
            });

            // Restore original value from targetDate+1 only if no future record already starts there.
            var restoreDate = targetDate.AddDays(1);
            var futureAlreadyCovers = allOpen.Any(x => x.EffectiveFrom <= restoreDate);
            if (!futureAlreadyCovers)
            {
                db.MealStatusHistory.Add(new MealStatusHistory
                {
                    StudentId = studentId,
                    MealPeriod = mealPeriod,
                    IsOn = originalIsOn,
                    EffectiveFrom = restoreDate,
                    EffectiveTo = null,
                });
            }
        }
        else
        {
            // No covering record for targetDate; just insert a single-day bounded record.
            db.MealStatusHistory.Add(new MealStatusHistory
            {
                StudentId = studentId,
                MealPeriod = mealPeriod,
                IsOn = isOn,
                EffectiveFrom = targetDate,
                EffectiveTo = targetDate,
            });
        }
    }

    /// <summary>
    /// Admin-only override: sets the meal preference for a specific date even when a newer record already
    /// exists, using the same bounded single-day strategy as <see cref="AdminForceStatusAsync"/>.
    /// </summary>
    public async Task AdminForcePreferenceAsync(Guid studentId, string mealPeriod, Guid? optionItemId, DateOnly targetDate, CancellationToken cancellationToken)
    {
        ValidatePeriod(mealPeriod);

        if (optionItemId.HasValue && !await db.InventoryItems.AnyAsync(
                x => x.Id == optionItemId && x.Category == "Options" && !x.IsDeleted, cancellationToken))
        {
            throw new InvalidOperationException("The selected option item is not active.");
        }

        var targetDayOfWeek = targetDate.DayOfWeek;

        var allOpen = await db.MealPreferenceHistory
            .Where(x => x.StudentId == studentId && x.MealPeriod == mealPeriod && x.DayOfWeek == targetDayOfWeek && x.EffectiveTo == null)
            .ToListAsync(cancellationToken);

        var hasFuture = allOpen.Any(x => x.EffectiveFrom > targetDate);

        if (!hasFuture)
        {
            await SetPreferenceAsync(studentId, mealPeriod, optionItemId, targetDate, cancellationToken);
            return;
        }

        // Upsert bounded single-day record.
        var bounded = await db.MealPreferenceHistory
            .Where(x => x.StudentId == studentId
                && x.MealPeriod == mealPeriod
                && x.DayOfWeek == targetDayOfWeek
                && x.EffectiveFrom == targetDate
                && x.EffectiveTo == targetDate)
            .FirstOrDefaultAsync(cancellationToken);

        if (bounded is not null)
        {
            bounded.OptionItemId = optionItemId;
            return;
        }

        var sameStart = await db.MealPreferenceHistory
            .Where(x => x.StudentId == studentId && x.MealPeriod == mealPeriod && x.DayOfWeek == targetDayOfWeek && x.EffectiveFrom == targetDate)
            .FirstOrDefaultAsync(cancellationToken);

        if (sameStart is not null)
        {
            sameStart.OptionItemId = optionItemId;
            sameStart.EffectiveTo = targetDate;
            return;
        }

        var covering = allOpen
            .Where(x => x.EffectiveFrom <= targetDate)
            .OrderByDescending(x => x.EffectiveFrom)
            .FirstOrDefault();

        if (covering is not null)
        {
            var originalOptionItemId = covering.OptionItemId;
            covering.EffectiveTo = targetDate.AddDays(-1);

            db.MealPreferenceHistory.Add(new MealPreferenceHistory
            {
                StudentId = studentId,
                MealPeriod = mealPeriod,
                OptionItemId = optionItemId,
                EffectiveFrom = targetDate,
                EffectiveTo = targetDate,
                DayOfWeek = targetDayOfWeek,
            });

            // Restore original preference from targetDate+1 only if no future record already covers it.
            var prefRestoreDate = targetDate.AddDays(1);
            var prefFutureCovers = allOpen.Any(x => x.EffectiveFrom <= prefRestoreDate);
            if (!prefFutureCovers)
            {
                db.MealPreferenceHistory.Add(new MealPreferenceHistory
                {
                    StudentId = studentId,
                    MealPeriod = mealPeriod,
                    OptionItemId = originalOptionItemId,
                    EffectiveFrom = prefRestoreDate,
                    EffectiveTo = null,
                    DayOfWeek = targetDayOfWeek,
                });
            }
        }
        else
        {
            db.MealPreferenceHistory.Add(new MealPreferenceHistory
            {
                StudentId = studentId,
                MealPeriod = mealPeriod,
                OptionItemId = optionItemId,
                EffectiveFrom = targetDate,
                EffectiveTo = targetDate,
                DayOfWeek = targetDayOfWeek,
            });
        }
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

public sealed class BillingCalculationService(
    HallDbContext db,
    BillingPeriodService periods,
    InventoryTransactionService inventory)
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

        var nonStoredItemIds = await db.StockTransactions.AsNoTracking()
            .Include(x => x.Item)
            .Where(x => x.Date >= from && x.Date <= to && x.Item != null && !x.Item.IsStored)
            .Select(x => x.ItemId)
            .Distinct()
            .ToListAsync(cancellationToken);

        foreach (var itemId in nonStoredItemIds)
        {
            await inventory.RebuildItemAsync(itemId, cancellationToken);
        }

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
