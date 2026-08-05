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
    private readonly Dictionary<(string Wing, string MealPeriod), List<GlobalMealOverride>> overrides;
    private readonly Dictionary<(Guid StudentId, string MealPeriod), List<MealStatusHistory>> statuses;
    private readonly Dictionary<(Guid StudentId, string MealPeriod, DayOfWeek DayOfWeek), List<MealPreferenceHistory>> preferences;

    private MealResolutionContext(
        List<Student> students,
        Dictionary<(string, string), List<GlobalMealOverride>> overrides,
        Dictionary<(Guid, string), List<MealStatusHistory>> statuses,
        Dictionary<(Guid, string, DayOfWeek), List<MealPreferenceHistory>> preferences)
    {
        Students = students;
        StudentsByWing = students.GroupBy(x => x.Gender).ToDictionary(g => g.Key, g => g.ToList());
        this.overrides = overrides;
        this.statuses = statuses;
        this.preferences = preferences;
    }

    public IReadOnlyList<Student> Students { get; }

    public IReadOnlyDictionary<string, List<Student>> StudentsByWing { get; }

    public static async Task<MealResolutionContext> LoadAsync(
        HallDbContext db,
        DateOnly from,
        DateOnly to,
        CancellationToken cancellationToken)
    {
        var students = await db.Students.AsNoTracking().ToListAsync(cancellationToken);
        var overrideRows = await db.GlobalMealOverrides.AsNoTracking()
            .Where(x => x.EffectiveFrom <= to && x.EffectiveTo >= from)
            .ToListAsync(cancellationToken);
        var statusRows = await db.MealStatusHistory.AsNoTracking()
            .Where(x => x.EffectiveFrom <= to && (x.EffectiveTo == null || x.EffectiveTo >= from))
            .ToListAsync(cancellationToken);
        var preferenceRows = await db.MealPreferenceHistory.AsNoTracking()
            .Where(x => x.EffectiveFrom <= to && (x.EffectiveTo == null || x.EffectiveTo >= from))
            .ToListAsync(cancellationToken);

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
                .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.EffectiveFrom).ToList()));
    }

    /// <summary>The wing-level override in effect for that period and date, if any. Beats individual status.</summary>
    public GlobalMealOverride? FindOverride(string wing, string mealPeriod, DateOnly date)
        => overrides.TryGetValue((wing, mealPeriod), out var rows)
            ? rows.FirstOrDefault(x => x.EffectiveFrom <= date && x.EffectiveTo >= date)
            : null;

    /// <summary>Whether the student's meal was on, honouring <paramref name="wingOverride"/> when supplied.</summary>
    public bool IsMealOn(Guid studentId, string mealPeriod, DateOnly date, GlobalMealOverride? wingOverride)
    {
        if (wingOverride is not null) return wingOverride.IsOn;
        return statuses.TryGetValue((studentId, mealPeriod), out var rows)
            && (rows.FirstOrDefault(x => x.EffectiveFrom <= date && (x.EffectiveTo == null || x.EffectiveTo >= date))?.IsOn ?? false);
    }

    /// <summary>The option the student had selected for that meal on that weekday, if any.</summary>
    public Guid? FindSelectedOption(Guid studentId, string mealPeriod, DateOnly date)
        => preferences.TryGetValue((studentId, mealPeriod, date.DayOfWeek), out var rows)
            ? rows.FirstOrDefault(x => x.EffectiveFrom <= date && (x.EffectiveTo == null || x.EffectiveTo >= date))?.OptionItemId
            : null;

    /// <summary>Students in the item's wing who are charged for it on that date and meal period.</summary>
    public List<Student> Participants(InventoryItem item, string mealPeriod, DateOnly date)
    {
        if (!StudentsByWing.TryGetValue(item.Wing, out var wingStudents)) return [];
        var wingOverride = FindOverride(item.Wing, mealPeriod, date);
        return wingStudents
            .Where(student => FinancialMath.IsChargeParticipant(
                item.Category,
                item.Id,
                item.LinkedOptionId,
                IsMealOn(student.Id, mealPeriod, date, wingOverride),
                FindSelectedOption(student.Id, mealPeriod, date)))
            .ToList();
    }

    /// <summary>Headcount for <see cref="Participants"/> without materialising the list.</summary>
    public int CountParticipants(InventoryItem item, string mealPeriod, DateOnly date)
    {
        if (!StudentsByWing.TryGetValue(item.Wing, out var wingStudents)) return 0;
        var wingOverride = FindOverride(item.Wing, mealPeriod, date);
        return wingStudents
            .Count(student => FinancialMath.IsChargeParticipant(
                item.Category,
                item.Id,
                item.LinkedOptionId,
                IsMealOn(student.Id, mealPeriod, date, wingOverride),
                FindSelectedOption(student.Id, mealPeriod, date)));
    }
}
