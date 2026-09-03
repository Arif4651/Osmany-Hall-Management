using HallBackend.Domain.Entities;
using HallBackend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Application.Services;

/// <summary>
/// Meal history for a date range, loaded once and pre-grouped for lookup.
/// <para>
/// A recalculation resolves "was this student charged for this item on this date" for every
/// transaction and every student. Loading and scanning the history tables per month, and again
/// per item, dominated that cost; sharing one context collapses it to a single load plus
/// dictionary hits. It also keeps the participation rules in one place, so the wing override,
/// meal status and day-of-week preference lookups cannot drift apart between callers.
/// </para>
/// <para>
/// The range must cover every date the caller will ask about — a wider range is safe, a
/// narrower one silently yields wrong participant counts for dates outside it.
/// </para>
/// </summary>
public sealed class MealResolutionContext
{
    /// <summary>
    /// The single definition of "counts as a hall resident for billing purposes". Every module
    /// that computes a headcount or a per-student share — the meal sheet, meal counts, DSW
    /// eligibility, the tea/Others Bill roster, and this billing engine — must use the same rule,
    /// or the divisor one screen shows never matches the divisor another one billed against.
    /// </summary>
    public const string BillableStatus = "active";

    public sealed record MenuOptionConfig(
        HashSet<Guid> AvailableOptionItemIds,
        Guid? DefaultOptionItemId);

    private static readonly Dictionary<string, DayOfWeek> DayCodeToDayOfWeek = new(StringComparer.OrdinalIgnoreCase)
    {
        ["sun"] = DayOfWeek.Sunday,
        ["mon"] = DayOfWeek.Monday,
        ["tue"] = DayOfWeek.Tuesday,
        ["wed"] = DayOfWeek.Wednesday,
        ["thu"] = DayOfWeek.Thursday,
        ["fri"] = DayOfWeek.Friday,
        ["sat"] = DayOfWeek.Saturday,
    };

    private readonly Dictionary<(string Wing, string MealPeriod), List<GlobalMealOverride>> overrides;
    private readonly Dictionary<(Guid StudentId, string MealPeriod), List<MealStatusHistory>> statuses;
    private readonly Dictionary<(Guid StudentId, string MealPeriod, DayOfWeek DayOfWeek), List<MealPreferenceHistory>> preferences;
    private readonly Dictionary<Guid, Student> studentsById;
    private readonly Dictionary<(string Wing, DayOfWeek DayOfWeek, string MealPeriod), MenuOptionConfig> menuOptions;
    private readonly Dictionary<string, TimeOnly> wingCutoffs;

    public MealResolutionContext(
        List<Student> students,
        Dictionary<(string, string), List<GlobalMealOverride>> overrides,
        Dictionary<(Guid, string), List<MealStatusHistory>> statuses,
        Dictionary<(Guid, string, DayOfWeek), List<MealPreferenceHistory>> preferences,
        Dictionary<(string Wing, DayOfWeek DayOfWeek, string MealPeriod), MenuOptionConfig>? menuOptions = null,
        Dictionary<string, TimeOnly>? wingCutoffs = null)
    {
        Students = students;
        StudentsByWing = students.GroupBy(x => x.Gender).ToDictionary(g => g.Key, g => g.ToList());
        studentsById = students.ToDictionary(x => x.Id);
        this.overrides = overrides;
        this.statuses = statuses;
        this.preferences = preferences;
        this.menuOptions = menuOptions ?? [];
        this.wingCutoffs = wingCutoffs ?? new Dictionary<string, TimeOnly>(StringComparer.OrdinalIgnoreCase);
    }

    public bool IsCutoffPassed(DateOnly targetDate, string wing)
    {
        var cutoff = wingCutoffs.GetValueOrDefault(wing, new TimeOnly(17, 0));
        var daysAhead = HallClock.TimeOfDay >= cutoff ? 2 : 1;
        var earliest = HallClock.Today.AddDays(daysAhead);
        return targetDate < earliest;
    }

    public IReadOnlyList<Student> Students { get; }

    public IReadOnlyDictionary<string, List<Student>> StudentsByWing { get; }

    public static async Task<MealResolutionContext> LoadAsync(
        HallDbContext db,
        DateOnly from,
        DateOnly to,
        CancellationToken cancellationToken)
    {
        // Only billable-status students participate — matching the Meal Sheet, meal counts, DSW
        // eligibility and Others Bill consumption, which have always filtered this way. Billing
        // used to load every student regardless of status, so a graduated or archived student
        // whose meal was left on kept being charged and kept diluting everyone else's share.
        var students = await db.Students.AsNoTracking()
            .Where(x => x.Status == BillableStatus)
            .ToListAsync(cancellationToken);
        var overrideRows = await db.GlobalMealOverrides.AsNoTracking()
            .Where(x => x.EffectiveFrom <= to && x.EffectiveTo >= from)
            .ToListAsync(cancellationToken);
        var statusRows = await db.MealStatusHistory.AsNoTracking()
            .Where(x => x.EffectiveFrom <= to && (x.EffectiveTo == null || x.EffectiveTo >= from))
            .ToListAsync(cancellationToken);
        var preferenceRows = await db.MealPreferenceHistory.AsNoTracking()
            .Where(x => x.EffectiveFrom <= to && (x.EffectiveTo == null || x.EffectiveTo >= from))
            .ToListAsync(cancellationToken);

        var menuConfigs = await db.MealConfigurations.AsNoTracking()
            .Include(x => x.MealDay)
            .Include(x => x.MealType)
            .Include(x => x.Items)
            .ThenInclude(x => x.InventoryItem)
            .ToListAsync(cancellationToken);

        var menuOptionsMap = new Dictionary<(string Wing, DayOfWeek DayOfWeek, string MealPeriod), MenuOptionConfig>();
        foreach (var config in menuConfigs)
        {
            if (string.IsNullOrWhiteSpace(config.Wing)
                || config.MealDay is null
                || !DayCodeToDayOfWeek.TryGetValue(config.MealDay.Code, out var dow)
                || config.MealType is null)
            {
                continue;
            }

            var optionalItems = config.Items
                .Where(x => x.IsOptional
                    && x.InventoryItemId.HasValue
                    && x.InventoryItem != null
                    && !x.InventoryItem.IsDeleted
                    && x.InventoryItem.Category == "Options")
                .ToList();

            var availableIds = optionalItems.Select(x => x.InventoryItemId!.Value).ToHashSet();
            var defaultId = optionalItems.FirstOrDefault(x => x.IsDefault)?.InventoryItemId;

            menuOptionsMap[(config.Wing, dow, config.MealType.Code)] = new MenuOptionConfig(availableIds, defaultId);
        }

        var settingRows = await db.MealSettings.AsNoTracking().ToListAsync(cancellationToken);
        var wingCutoffs = settingRows
            .Where(x => !string.IsNullOrWhiteSpace(x.Wing))
            .ToDictionary(x => x.Wing!, x => x.CutoffTime, StringComparer.OrdinalIgnoreCase);

        return new MealResolutionContext(
            students,
            overrideRows
                .GroupBy(x => (x.Wing, x.MealPeriod))
                .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.EffectiveFrom).ToList()),
            statusRows
                .GroupBy(x => (x.StudentId, x.MealPeriod))
                .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.EffectiveFrom).ToList()),
            preferenceRows
                .GroupBy(x => (x.StudentId, x.MealPeriod, x.DayOfWeek))
                .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.EffectiveFrom).ToList()),
            menuOptionsMap,
            wingCutoffs);
    }

    /// <summary>The wing-level override in effect for that period and date, if any. Beats individual status.</summary>
    public GlobalMealOverride? FindOverride(string wing, string mealPeriod, DateOnly date)
        => overrides.TryGetValue((wing, mealPeriod), out var rows)
            ? rows.FirstOrDefault(x => x.EffectiveFrom <= date && x.EffectiveTo >= date)
            : null;

    /// <summary>
    /// Whether the student's meal was on, honouring <paramref name="wingOverride"/> when supplied.
    /// <para>
    /// <paramref name="asOfUtc"/> is the moment the caller is charging against — a specific stock
    /// transaction's <c>CreatedAtUtc</c>, when called from billing. Every field here is a plain
    /// <see cref="DateOnly"/>, so on every day *after* the status took effect this parameter
    /// changes nothing — the whole day is unambiguously on. It only matters on the exact day a
    /// status (or wing override) both takes effect and was created — only reachable through an
    /// admin same-day action (the emergency per-student toggle, or a wing-wide override created
    /// for today), since the student-facing cutoff in
    /// MealsController.GetEarliestStudentChangeDateAsync blocks any same-day self-service change.
    /// Without this check, switching a meal on for today at noon — for one student or the whole
    /// wing — would retroactively count as participation in a stock-out recorded at 10am that
    /// day, charging for food that was already stocked out before anyone was turned on. Pass null
    /// (the default) for callers with no specific transaction to charge against, such as a live
    /// headcount preview before any stock-out exists yet — there is nothing to compare against.
    /// </para>
    /// </summary>
    public bool IsMealOn(Guid studentId, string mealPeriod, DateOnly date, GlobalMealOverride? wingOverride, DateTime? asOfUtc = null)
    {
        if (wingOverride is not null)
        {
            return wingOverride.IsOn && !TurnedOnAfter(wingOverride.EffectiveFrom, wingOverride.CreatedAtUtc, date, asOfUtc);
        }

        if (!statuses.TryGetValue((studentId, mealPeriod), out var rows)) return false;

        var active = rows.FirstOrDefault(x => x.EffectiveFrom <= date && (x.EffectiveTo == null || x.EffectiveTo >= date));
        if (active is null || !active.IsOn) return false;

        return !TurnedOnAfter(active.EffectiveFrom, active.CreatedAtUtc, date, asOfUtc);
    }

    /// <summary>
    /// True when a same-day "on" record was created after the transaction it's being checked
    /// against — see <see cref="IsMealOn"/>. Shared by the individual-status and wing-override
    /// paths so the same-day rule can't drift between the two ways a meal gets turned on.
    /// </summary>
    private static bool TurnedOnAfter(DateOnly effectiveFrom, DateTime createdAtUtc, DateOnly date, DateTime? asOfUtc)
        => asOfUtc.HasValue
        && effectiveFrom == date
        && DateOnly.FromDateTime(createdAtUtc) == date
        && createdAtUtc > asOfUtc.Value;

    /// <summary>
    /// The option the student has resolved for that meal on that date:
    /// returns the student's valid saved preference if present on that day's configured menu;
    /// otherwise falls back to the menu's default optional item if configured.
    /// </summary>
    public Guid? FindSelectedOption(Guid studentId, string mealPeriod, DateOnly date)
    {
        if (!studentsById.TryGetValue(studentId, out var student)) return null;

        var wing = student.Gender;
        menuOptions.TryGetValue((wing, date.DayOfWeek, mealPeriod), out var menuConfig);

        Guid? savedOptionId = null;
        if (preferences.TryGetValue((studentId, mealPeriod, date.DayOfWeek), out var rows))
        {
            savedOptionId = rows.FirstOrDefault(x => x.EffectiveFrom <= date && (x.EffectiveTo == null || x.EffectiveTo >= date))?.OptionItemId;
        }

        // Student has a valid saved selection that is currently active on the configured menu
        if (savedOptionId.HasValue && menuConfig != null && menuConfig.AvailableOptionItemIds.Contains(savedOptionId.Value))
        {
            return savedOptionId.Value;
        }

        // Cutoff/auto-assignment fallback: admin configured default item for this meal,
        // ONLY if the cutoff for this target date has already passed.
        if (IsCutoffPassed(date, wing) && menuConfig?.DefaultOptionItemId != null)
        {
            return menuConfig.DefaultOptionItemId.Value;
        }

        return null;
    }

    /// <summary>
    /// Students in the item's wing who are charged for it on that date and meal period.
    /// <paramref name="asOfUtc"/> — see <see cref="IsMealOn"/> — should be the charging
    /// transaction's own <c>CreatedAtUtc</c> when one exists.
    /// </summary>
    public List<Student> Participants(InventoryItem item, string mealPeriod, DateOnly date, DateTime? asOfUtc = null)
    {
        if (!StudentsByWing.TryGetValue(item.Wing, out var wingStudents)) return [];
        var wingOverride = FindOverride(item.Wing, mealPeriod, date);
        return wingStudents
            .Where(student => HasJoinedBy(student, date) && FinancialMath.IsChargeParticipant(
                item.Category,
                item.Id,
                item.LinkedOptionId,
                IsMealOn(student.Id, mealPeriod, date, wingOverride, asOfUtc),
                FindSelectedOption(student.Id, mealPeriod, date)))
            .ToList();
    }

    /// <summary>
    /// Headcount for <see cref="Participants"/> without materialising the list.
    /// <paramref name="asOfUtc"/> — see <see cref="IsMealOn"/>.
    /// </summary>
    public int CountParticipants(InventoryItem item, string mealPeriod, DateOnly date, DateTime? asOfUtc = null)
    {
        if (!StudentsByWing.TryGetValue(item.Wing, out var wingStudents)) return 0;
        var wingOverride = FindOverride(item.Wing, mealPeriod, date);
        return wingStudents
            .Count(student => HasJoinedBy(student, date) && FinancialMath.IsChargeParticipant(
                item.Category,
                item.Id,
                item.LinkedOptionId,
                IsMealOn(student.Id, mealPeriod, date, wingOverride, asOfUtc),
                FindSelectedOption(student.Id, mealPeriod, date)));
    }

    /// <summary>
    /// Whether the student had already joined the hall as of <paramref name="date"/>. A wing-wide
    /// meal override forces every current student's meal "on" for its date range with no idea who
    /// existed at the hall when it was created — without this check, a student created today
    /// would be retroactively billed for an override dated before they joined.
    /// </summary>
    public static bool HasJoinedBy(Student student, DateOnly date) => student.JoinDate <= date;
}
