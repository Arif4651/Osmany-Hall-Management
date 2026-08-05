using System.Collections.Concurrent;
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

/// <summary>
/// A request supplied values the domain rejects. Carries a message written for the user, so
/// the exception middleware may safely return it with HTTP 400 — unlike a bare
/// <see cref="InvalidOperationException"/>, which may come from the framework and whose
/// message could expose internals.
/// </summary>
public sealed class DomainValidationException(string message) : InvalidOperationException(message);

public sealed class InventoryTransactionService(
    HallDbContext db,
    BillingPeriodService periods)
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
        var latestYear = DateTime.UtcNow.Year + 1;
        if (year < EarliestBillingYear || year > latestYear)
        {
            throw new DomainValidationException($"Year must be between {EarliestBillingYear} and {latestYear}.");
        }
    }

    /// <summary>
    /// Ensures the month has been calculated, doing the work at most once across concurrent
    /// callers. Read endpoints should prefer this over recalculating on every cache miss.
    /// </summary>
    public async Task EnsureMonthCalculatedAsync(int month, int year, CancellationToken cancellationToken)
    {
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
        if (await periods.IsLockedAsync(month, year, cancellationToken))
        {
            return await ReadCacheAsync(month, year, cancellationToken);
        }

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
        var rangeEnd = end.AddMonths(1).AddDays(-1);

        // Rebuild each affected non-stored item once for the whole range rather than once per
        // month — RebuildItemAsync replays the item's full history either way — and reuse the
        // meal history it loaded for every month instead of re-querying it twelve times.
        var meals = await RebuildNonStoredItemsAsync(cursor, rangeEnd, cancellationToken);

        while (cursor <= end)
        {
            if (await periods.IsLockedAsync(cursor.Month, cursor.Year, cancellationToken)) break;
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
