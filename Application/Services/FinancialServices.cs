using System.Collections.Concurrent;
using HallBackend.Domain.Entities;
using HallBackend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Application.Services;

/// <summary>
/// A request supplied values the domain rejects. Carries a message written for the user, so
/// the exception middleware may safely return it with HTTP 400 — unlike a bare
/// <see cref="InvalidOperationException"/>, which may come from the framework and whose
/// message could expose internals.
/// </summary>
public sealed class DomainValidationException(string message) : InvalidOperationException(message);

public sealed class InventoryTransactionService(HallDbContext db)
{
    public async Task RebuildItemAsync(Guid itemId, CancellationToken cancellationToken)
        => await RebuildItemAsync(itemId, null, cancellationToken);

    /// <param name="meals">
    /// Pre-loaded meal history shared across a batch of rebuilds. Must span every transaction
    /// date of this item; pass null to have the item load its own for exactly its own range.
    /// </param>
    public async Task RebuildItemAsync(Guid itemId, MealResolutionContext? meals, CancellationToken cancellationToken)
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
                meals ??= await MealResolutionContext.LoadAsync(
                    db,
                    transactions.Min(x => x.Date),
                    transactions.Max(x => x.Date),
                    cancellationToken);

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

                    var participantsCount = meals.CountParticipants(item, transaction.MealPeriod, transaction.Date);

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
            // ── Batch (lot) costing ──────────────────────────────────────────────────
            // Each stock-in keeps its own rate; a stock-out is priced at the rate of the one
            // batch it names. Rows recorded before the cutover stay exactly as the old
            // weighted-average run left them, so no historical bill moves — the opening batch
            // created by the migration carries whatever stock they left behind.
            var batches = new Dictionary<Guid, StockTransaction>();

            foreach (var transaction in transactions)
            {
                if (transaction.Quantity <= 0m) throw new InvalidOperationException("Quantity must be greater than zero.");

                if (transaction.IsPreBatchLegacy)
                {
                    transaction.RemainingQuantity = 0m;
                    continue;
                }

                if (transaction.TransactionType == "in")
                {
                    if (transaction.Rate < 0m) throw new InvalidOperationException("Rate cannot be negative.");
                    transaction.RemainingQuantity = transaction.Quantity;
                    transaction.WacSnapshot = transaction.Rate;
                    transaction.TotalCost = transaction.Quantity * transaction.Rate;
                    batches[transaction.Id] = transaction;
                }
                else
                {
                    if (!transaction.SourceBatchId.HasValue || !batches.TryGetValue(transaction.SourceBatchId.Value, out var batch))
                    {
                        throw new InvalidOperationException(
                            $"The stock-out of {item.Item} on {transaction.Date:yyyy-MM-dd} is not linked to a stock-in batch.");
                    }
                    if (transaction.Quantity > batch.RemainingQuantity)
                    {
                        throw new InvalidOperationException(
                            $"Stock-out of {transaction.Quantity:0.####} {item.Unit} on {transaction.Date:yyyy-MM-dd} exceeds the "
                            + $"{batch.RemainingQuantity:0.####} {item.Unit} left in the {item.Item} batch received on {batch.Date:yyyy-MM-dd}.");
                    }

                    // Priced at the batch's own rate — no blending across batches.
                    transaction.Rate = batch.Rate;
                    transaction.WacSnapshot = batch.Rate;
                    transaction.TotalCost = transaction.Quantity * batch.Rate;
                    transaction.RemainingQuantity = 0m;
                    batch.RemainingQuantity -= transaction.Quantity;
                }
            }

            var openBatches = batches.Values.Where(x => x.RemainingQuantity > 0m).ToList();
            var quantity = openBatches.Sum(x => x.RemainingQuantity);
            var stockValue = openBatches.Sum(x => x.RemainingQuantity * x.Rate);

            item.CurrentStockQuantity = quantity;
            // Kept only as a headline valuation figure for reports and the item list; nothing
            // is costed from it any more.
            item.CurrentWac = quantity == 0m ? 0m : stockValue / quantity;
            item.Stock = quantity;
            item.AveragePrice = item.CurrentWac;
            item.TotalStockValue = stockValue;
        }
        item.LastMovementDate = transactions.LastOrDefault()?.Date;
        item.Status = item.IsDeleted ? "archived" : item.Stock <= item.Threshold ? "low-stock" : "active";
    }
}

public sealed class MealHistoryService(HallDbContext db)
{
    public static readonly string[] MealPeriods = ["breakfast", "lunch", "dinner"];

    public static bool GetEffectiveStatus(
        Guid studentId,
        string wing,
        string mealPeriod,
        DateOnly date,
        IEnumerable<MealStatusHistory> statuses,
        IEnumerable<GlobalMealOverride> overrides)
    {
        var globalOverride = overrides
            .Where(x => x.Wing == wing
                && x.MealPeriod == mealPeriod
                && x.EffectiveFrom <= date
                && x.EffectiveTo >= date)
            .OrderByDescending(x => x.EffectiveFrom)
            .ThenByDescending(x => x.CreatedAtUtc)
            .FirstOrDefault();

        if (globalOverride is not null)
        {
            return globalOverride.IsOn;
        }

        return statuses
            .Where(x => x.StudentId == studentId
                && x.MealPeriod == mealPeriod
                && x.EffectiveFrom <= date
                && (x.EffectiveTo == null || x.EffectiveTo >= date))
            .OrderByDescending(x => x.EffectiveFrom)
            .ThenByDescending(x => x.CreatedAtUtc)
            .FirstOrDefault()?.IsOn ?? false;
    }

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
    decimal OthersBill,
    decimal ServiceBill,
    decimal CarriedDue,
    decimal Adjustment,
    decimal ApprovedPaid,
    decimal DueBill,
    decimal TotalBill);

public sealed class BillingCalculationService(
    HallDbContext db,
    InventoryTransactionService inventory)
{
    /// <summary>Earliest billing year accepted from a request. Guards against absurd inputs.</summary>
    private const int EarliestBillingYear = 2000;

    /// <summary>
    /// One in-flight recalculation per billing month. Recalculating is whole-hall work, and
    /// read endpoints trigger it on a cache miss — so without this gate, every student opening
    /// their bill on the 1st of the month starts an identical computation simultaneously.
    /// </summary>
    private static readonly ConcurrentDictionary<(int Year, int Month), SemaphoreSlim> MonthLocks = new();

    /// <summary>
    /// Rejects out-of-range periods before they reach the calculation. Callers reach this from
    /// query strings, so an unvalidated year would let anyone force work for arbitrary dates.
    /// </summary>
    public static void ValidatePeriod(int month, int year)
    {
        if (month is < 1 or > 12)
        {
            throw new DomainValidationException("Month must be between 1 and 12.");
        }
        var today = DateTime.UtcNow;
        if (year < EarliestBillingYear || year > today.Year)
        {
            throw new DomainValidationException($"Year must be between {EarliestBillingYear} and {today.Year}.");
        }
        // A month that has not started has no consumption to bill, so calculating one would only
        // produce a bill of zeros that looks authoritative.
        if (IsFuturePeriod(month, year))
        {
            throw new DomainValidationException("Billing period cannot be in the future.");
        }
    }

    /// <summary>A period that has not started yet, and so has nothing to bill.</summary>
    public static bool IsFuturePeriod(int month, int year)
    {
        var today = DateTime.UtcNow;
        return year > today.Year || (year == today.Year && month > today.Month);
    }

    /// <summary>
    /// Ensures the month has been calculated, doing the work at most once across concurrent
    /// callers. Read endpoints should prefer this over recalculating on every cache miss.
    ///
    /// A month that has not started is a no-op rather than an error: nothing is billed yet, so the
    /// honest answer is an empty bill. Throwing turned "there is nothing here yet" into a red
    /// failure on a page the reader had simply paged forward into.
    /// </summary>
    public async Task EnsureMonthCalculatedAsync(int month, int year, CancellationToken cancellationToken)
    {
        if (month is < 1 or > 12)
        {
            throw new DomainValidationException("Month must be between 1 and 12.");
        }
        if (IsFuturePeriod(month, year)) return;

        ValidatePeriod(month, year);
        if (await HasCachedBillsAsync(month, year, cancellationToken)) return;

        var gate = MonthLocks.GetOrAdd((year, month), _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken);
        try
        {
            // A concurrent caller may have finished the work while we waited on the gate.
            if (await HasCachedBillsAsync(month, year, cancellationToken)) return;
            await RecalculateMonthAsync(month, year, cancellationToken);
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task<bool> HasCachedBillsAsync(int month, int year, CancellationToken cancellationToken)
        => await db.MonthlyBillCache.AsNoTracking()
            .AnyAsync(x => x.Month == month && x.Year == year, cancellationToken);

    public async Task<IReadOnlyList<MonthlyBillResult>> RecalculateMonthAsync(int month, int year, CancellationToken cancellationToken)
        => await RecalculateMonthAsync(month, year, null, cancellationToken);

    /// <param name="sharedMeals">
    /// Meal history already loaded and rebuilt against by the caller, spanning at least this
    /// month. Null means this call owns the rebuild and loads history for its own month.
    /// </param>
    private async Task<IReadOnlyList<MonthlyBillResult>> RecalculateMonthAsync(
        int month,
        int year,
        MealResolutionContext? sharedMeals,
        CancellationToken cancellationToken)
    {
        ValidatePeriod(month, year);

        var from = new DateOnly(year, month, 1);
        var to = from.AddMonths(1).AddDays(-1);

        // A range recalculation rebuilds every affected item once up front and hands the same
        // history down; rebuilding and reloading per month would repeat identical work.
        var meals = sharedMeals ?? await RebuildNonStoredItemsAsync(from, to, cancellationToken);
        var students = meals.Students;

        var transactions = await db.StockTransactions.AsNoTracking()
            .Include(x => x.Item)
            .Where(x => x.TransactionType == "out" && x.Date >= from && x.Date <= to)
            .OrderBy(x => x.Date)
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

        // Read from the generated snapshot rather than recomputing from current selections. That
        // is what stops a routine recalculation from silently moving an already-generated Others
        // Bill when a student changes their marks afterwards.
        var othersBillTotals = await db.OthersBillAllocations.AsNoTracking()
            .Where(x => x.OthersBill != null && x.OthersBill.Month == month && x.OthersBill.Year == year)
            .GroupBy(x => x.StudentId)
            .Select(x => new { StudentId = x.Key, Amount = x.Sum(y => y.AllocatedAmount) })
            .ToDictionaryAsync(x => x.StudentId, x => x.Amount, cancellationToken);

        var guestMealsGrouped = guestMeals
            .GroupBy(x => (x.Date, x.MealPeriod))
            .ToDictionary(g => g.Key, g => g.ToList());

        var monthly = students.ToDictionary(x => x.Id, _ => 0m);
        var guestBill = students.ToDictionary(x => x.Id, _ => 0m);
        foreach (var transaction in transactions)
        {
            if (transaction.Item is null || string.IsNullOrWhiteSpace(transaction.MealPeriod)) continue;
            if (string.IsNullOrWhiteSpace(transaction.Item.Wing)) continue;

            var participants = meals.Participants(transaction.Item, transaction.MealPeriod, transaction.Date);

            if (participants.Count == 0) continue;
            var share = transaction.TotalCost / participants.Count;
            foreach (var participant in participants) monthly[participant.Id] += share;

            // Guest meals: add share per guest count for each requesting student
            if (guestMealsGrouped.TryGetValue((transaction.Date, transaction.MealPeriod), out var transactionGuests))
            {
                foreach (var guest in transactionGuests)
                {
                    if (!guestBill.ContainsKey(guest.StudentId)) continue;
                    guestBill[guest.StudentId] += share * guest.GuestCount;
                }
            }
        }

        // Service bill is set independently per wing — a Male wing admin's entry never charges
        // Female wing students, and vice versa.
        var serviceByWing = await db.ServiceBills.AsNoTracking()
            .Where(x => x.Month == month && x.Year == year)
            .GroupBy(x => x.Wing)
            .Select(g => new { Wing = g.Key, Amount = g.OrderByDescending(x => x.Version).Select(x => x.AmountPerStudent).First() })
            .ToDictionaryAsync(x => x.Wing, x => x.Amount, cancellationToken);
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
                || await db.DueAdjustments.AnyAsync(x => x.BillingMonth == previous.Month && x.BillingYear == previous.Year, cancellationToken)
                || await db.OthersBills.AnyAsync(x => x.Month == previous.Month && x.Year == previous.Year, cancellationToken);
            if (hasPreviousSources) await RecalculateMonthAsync(previous.Month, previous.Year, cancellationToken);
        }
        // The previous month's cached DueBill already carries any adjustment made to it, so it is
        // the single source for what rolls forward — no second lookup of that month's overrides.
        var previousDue = await db.MonthlyBillCache.AsNoTracking()
            .Where(x => x.Month == previous.Month && x.Year == previous.Year)
            .ToDictionaryAsync(x => x.StudentId, x => x.DueBill, cancellationToken);
        var adjustments = await AdjustmentTotalsAsync(month, year, cancellationToken);
        var payments = await db.PaymentSubmissions.AsNoTracking()
            .Where(x => x.BillingMonth == month && x.BillingYear == year && x.Status == "approved")
            .GroupBy(x => x.StudentId)
            .Select(x => new { StudentId = x.Key, Amount = x.Sum(y => y.ApprovedAmount ?? 0m) })
            .ToDictionaryAsync(x => x.StudentId, x => x.Amount, cancellationToken);

        var existing = await db.MonthlyBillCache.Where(x => x.Month == month && x.Year == year).ToDictionaryAsync(x => x.StudentId, cancellationToken);
        var results = new List<MonthlyBillResult>();
        foreach (var student in students)
        {
            var carried = previousDue.GetValueOrDefault(student.Id);
            var subsidy = subsidyTotals.GetValueOrDefault(student.Id);
            var othersBill = othersBillTotals.GetValueOrDefault(student.Id);
            var service = serviceByWing.GetValueOrDefault(student.Gender);
            // A manual correction is one more charge line, not an override of the result: it goes
            // into the total alongside everything else, so the components still add up to what the
            // student is shown and payments still work the balance down.
            var adjustment = adjustments.GetValueOrDefault(student.Id);
            // MonthlyBill is reported at its raw, pre-subsidy value — the subsidy is shown as its
            // own line item — but the subsidy still comes out of the total exactly as before.
            var total = monthly[student.Id] - subsidy + guestBill[student.Id] + othersBill + service + carried + adjustment;
            var approved = payments.GetValueOrDefault(student.Id);
            var due = FinancialMath.CalculateDue(total, approved);
            var result = new MonthlyBillResult(student.Id, monthly[student.Id], subsidy, guestBill[student.Id], othersBill, service, carried, adjustment, approved, due, total);
            results.Add(result);

            if (!existing.TryGetValue(student.Id, out var cache))
            {
                cache = new MonthlyBillCache { StudentId = student.Id, Month = month, Year = year };
                db.MonthlyBillCache.Add(cache);
            }
            cache.MonthlyBill = result.MonthlyBill;
            cache.DswSubsidy = result.DswSubsidy;
            cache.GuestMealBill = result.GuestMealBill;
            cache.OthersBill = result.OthersBill;
            cache.ServiceBill = result.ServiceBill;
            cache.CarriedDue = result.CarriedDue;
            cache.Adjustment = result.Adjustment;
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
        var now = DateTime.UtcNow;
        var currentPeriod = new DateOnly(now.Year, now.Month, 1);

        // The current month is the last one that can be billed: a month that has not started has
        // no consumption, and ValidatePeriod rejects it outright. Running to today + 1 month, as
        // this used to, meant every forward pass ended by asking for next month and throwing
        // "Billing period cannot be in the future" — after the caller had already committed its
        // write, so the change landed but the request came back as a failure.
        if (cursor > currentPeriod) return;
        var end = currentPeriod;

        // Everything from the edited month up to now is rebuilt, so the carried-due chain stays
        // continuous; nothing beyond exists to rebuild, because future months are never billed.
        var rangeEnd = end.AddMonths(1).AddDays(-1);

        // Rebuild each affected non-stored item once for the whole range rather than once per
        // month — RebuildItemAsync replays the item's full history either way — and reuse the
        // meal history it loaded for every month instead of re-querying it twelve times.
        var meals = await RebuildNonStoredItemsAsync(cursor, rangeEnd, cancellationToken);

        while (cursor <= end)
        {
            await RecalculateMonthAsync(cursor.Month, cursor.Year, meals, cancellationToken);
            cursor = cursor.AddMonths(1);
        }
    }

    /// <summary>
    /// Recomputes every non-stored item with activity in the range and returns the meal history
    /// used, loaded wide enough for the caller to reuse across the whole range.
    /// </summary>
    private async Task<MealResolutionContext> RebuildNonStoredItemsAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        var nonStoredItemIds = await db.StockTransactions.AsNoTracking()
            .Where(x => x.Date >= from && x.Date <= to && x.Item != null && !x.Item.IsStored)
            .Select(x => x.ItemId)
            .Distinct()
            .ToListAsync(cancellationToken);

        // A rebuild replays the item's entire ledger, so the shared history has to span every
        // one of its transactions — a context limited to [from, to] would produce wrong
        // participant counts for that item's transactions outside the range.
        var historyFrom = from;
        var historyTo = to;
        if (nonStoredItemIds.Count > 0)
        {
            var itemTransactions = db.StockTransactions.AsNoTracking()
                .Where(x => nonStoredItemIds.Contains(x.ItemId));
            var earliest = await itemTransactions.MinAsync(x => (DateOnly?)x.Date, cancellationToken);
            var latest = await itemTransactions.MaxAsync(x => (DateOnly?)x.Date, cancellationToken);
            if (earliest.HasValue && earliest.Value < historyFrom) historyFrom = earliest.Value;
            if (latest.HasValue && latest.Value > historyTo) historyTo = latest.Value;
        }

        var meals = await MealResolutionContext.LoadAsync(db, historyFrom, historyTo, cancellationToken);

        foreach (var itemId in nonStoredItemIds)
        {
            await inventory.RebuildItemAsync(itemId, meals, cancellationToken);
        }

        // Persist before the billing pass: it reads transactions with AsNoTracking, which
        // queries the database and would otherwise miss the recomputed costs.
        if (nonStoredItemIds.Count > 0)
        {
            await db.SaveChangesAsync(cancellationToken);
        }

        return meals;
    }

    /// <summary>
    /// The net signed correction each student carries for the month.
    ///
    /// Each row records the due the admin was looking at (<c>PreviousAmount</c>) and the due they
    /// asked for (<c>AdjustedAmount</c>); the difference is that entry's contribution. Summing
    /// them lets a month be corrected repeatedly — every entry moves the balance by what the admin
    /// intended at the time, and the earlier entries are neither lost nor re-applied.
    /// </summary>
    private async Task<Dictionary<Guid, decimal>> AdjustmentTotalsAsync(int month, int year, CancellationToken cancellationToken)
        => await db.DueAdjustments.AsNoTracking()
            .Where(x => x.BillingMonth == month && x.BillingYear == year)
            .GroupBy(x => x.StudentId)
            .Select(g => new { StudentId = g.Key, Amount = g.Sum(x => x.AdjustedAmount - x.PreviousAmount) })
            .ToDictionaryAsync(x => x.StudentId, x => x.Amount, cancellationToken);
}
