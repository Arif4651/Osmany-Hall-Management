using HallBackend.Application.Dtos;
using HallBackend.Domain.Entities;
using HallBackend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Application.Services;

/// <summary>
/// Per-date, per-meal opt-ins for optional consumables (Tea first).
///
/// Unlike the standing meal preference, a selection here means one meal on one date and nothing
/// more — there is no "until changed" semantics, and absence of a row is absence of consumption.
/// Eligibility and the marking cutoff are both enforced here rather than in the controller, so
/// every write path gets the same rules.
/// </summary>
public sealed class AdditionalMealService(HallDbContext db)
{
    /// <summary>Raised for a rule the student can act on; surfaces as 400 via the middleware.</summary>
    private static DomainValidationException Invalid(string message) => new(message);

    public static bool IsEligible(string? studentGender, string eligibleWing)
        => eligibleWing == "All"
            || (!string.IsNullOrWhiteSpace(studentGender)
                && string.Equals(studentGender, eligibleWing, StringComparison.OrdinalIgnoreCase));

    /// <summary>
    /// Earliest date a student may still change. Mirrors the guest-meal rule at
    /// MealsController.GetEarliestGuestDate: tomorrow, or the day after once the cutoff has passed.
    /// Marking the past would rewrite a month whose counts may already be billed.
    /// </summary>
    public async Task<DateOnly> GetEarliestEditableDateAsync(string wing, CancellationToken cancellationToken)
    {
        // Use the wing-specific cutoff; fall back to any row if the wing's row hasn't been seeded yet.
        var cutoff = await db.MealSettings.AsNoTracking()
            .Where(x => x.Wing == wing)
            .OrderBy(x => x.CreatedAtUtc)
            .Select(x => (TimeOnly?)x.CutoffTime)
            .FirstOrDefaultAsync(cancellationToken)
            ?? await db.MealSettings.AsNoTracking()
                .OrderBy(x => x.CreatedAtUtc)
                .Select(x => (TimeOnly?)x.CutoffTime)
                .FirstOrDefaultAsync(cancellationToken)
            ?? new TimeOnly(17, 0);

        var daysAhead = HallClock.TimeOfDay >= cutoff ? 2 : 1;
        return HallClock.Today.AddDays(daysAhead);
    }

    public async Task<IReadOnlyList<AdditionalMealItem>> GetEligibleItemsAsync(
        string? studentGender, CancellationToken cancellationToken)
    {
        var items = await db.AdditionalMealItems.AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.SortOrder).ThenBy(x => x.Name)
            .ToListAsync(cancellationToken);
        return items.Where(x => IsEligible(studentGender, x.EligibleWing)).ToList();
    }

    /// <summary>
    /// The student's panel for one date: every meal slot from the meal_types table, each carrying
    /// the items this student may take and whether they have already marked it.
    /// </summary>
    public async Task<AdditionalMealDayDto> GetDayAsync(
        Guid studentId, DateOnly date, CancellationToken cancellationToken)
    {
        var gender = await db.Students.AsNoTracking()
            .Where(x => x.Id == studentId).Select(x => x.Gender)
            .FirstOrDefaultAsync(cancellationToken);

        var items = await GetEligibleItemsAsync(gender, cancellationToken);

        // Slots come from the meal_types table so a hall that renames or adds a meal is followed
        // automatically — never from a hardcoded list.
        var mealTypes = await db.MealTypes.AsNoTracking()
            .OrderBy(x => x.SortOrder)
            .Select(x => new { x.Code, x.Label })
            .ToListAsync(cancellationToken);

        var selected = await db.AdditionalMealSelections.AsNoTracking()
            .Where(x => x.StudentId == studentId && x.Date == date)
            .Select(x => new { x.ItemId, x.MealPeriod })
            .ToListAsync(cancellationToken);
        var selectedKeys = selected.Select(x => (x.ItemId, x.MealPeriod)).ToHashSet();

        var earliest = await GetEarliestEditableDateAsync(gender ?? string.Empty, cancellationToken);
        var isEditable = date >= earliest;

        var slots = mealTypes.Select(meal => new AdditionalMealDaySlotDto(
            meal.Code,
            meal.Label,
            items.Select(item => new AdditionalMealDayItemDto(
                item.Id, item.Name, selectedKeys.Contains((item.Id, meal.Code)))).ToList()))
            .ToList();

        return new AdditionalMealDayDto(
            date,
            isEditable,
            isEditable ? null : $"Selections can only be changed from {earliest:dd MMM yyyy}.",
            slots);
    }

    /// <summary>
    /// A whole month at once — the shape the student's month grid renders from. One query per
    /// concern rather than one request per date.
    /// </summary>
    public async Task<AdditionalMealMonthDto> GetMonthAsync(
        Guid studentId, int month, int year, CancellationToken cancellationToken)
    {
        var from = new DateOnly(year, month, 1);
        var to = from.AddMonths(1).AddDays(-1);

        var gender = await db.Students.AsNoTracking()
            .Where(x => x.Id == studentId).Select(x => x.Gender)
            .FirstOrDefaultAsync(cancellationToken);

        var items = await GetEligibleItemsAsync(gender, cancellationToken);

        var mealTypes = await db.MealTypes.AsNoTracking()
            .OrderBy(x => x.SortOrder)
            .Select(x => new AdditionalMealPeriodDto(x.Code, x.Label))
            .ToListAsync(cancellationToken);

        var marks = await db.AdditionalMealSelections.AsNoTracking()
            .Where(x => x.StudentId == studentId && x.Date >= from && x.Date <= to)
            .Select(x => new AdditionalMealMarkDto(x.Date, x.MealPeriod, x.ItemId))
            .ToListAsync(cancellationToken);

        var earliest = await GetEarliestEditableDateAsync(gender ?? string.Empty, cancellationToken);

        var days = Enumerable.Range(0, to.Day)
            .Select(offset => from.AddDays(offset))
            .Select(date => new AdditionalMealMonthDayDto(date, date >= earliest))
            .ToList();

        return new AdditionalMealMonthDto(
            month, year, earliest, mealTypes,
            items.Select(x => new AdditionalMealItemSummaryDto(x.Id, x.Name)).ToList(),
            days, marks);
    }

    /// <summary>
    /// Marks or clears one slot. Idempotent: re-marking an already-marked slot is a no-op rather
    /// than a duplicate, which together with the unique index makes double submission harmless.
    /// </summary>
    public async Task SaveSelectionAsync(
        Guid studentId,
        SaveAdditionalMealSelectionRequest request,
        CancellationToken cancellationToken)
    {
        var student = await db.Students.AsNoTracking()
            .Where(x => x.Id == studentId)
            .Select(x => new { x.Gender, x.Status })
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw Invalid("Student record not found.");

        var item = await db.AdditionalMealItems.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.ItemId, cancellationToken)
            ?? throw Invalid("Unknown item.");

        if (!item.IsActive) throw Invalid($"{item.Name} is not currently available.");

        // Server-side eligibility: the UI hides ineligible items, but the API must not trust it.
        if (!IsEligible(student.Gender, item.EligibleWing))
            throw Invalid($"{item.Name} is not available to your wing.");

        var mealExists = await db.MealTypes.AsNoTracking()
            .AnyAsync(x => x.Code == request.MealPeriod, cancellationToken);
        if (!mealExists) throw Invalid("Invalid meal period.");

        var earliest = await GetEarliestEditableDateAsync(student.Gender, cancellationToken);
        if (request.Date < earliest)
            throw Invalid($"Selections can only be changed from {earliest:dd MMM yyyy} onwards.");

        var existing = await db.AdditionalMealSelections.FirstOrDefaultAsync(
            x => x.StudentId == studentId
                && x.ItemId == request.ItemId
                && x.Date == request.Date
                && x.MealPeriod == request.MealPeriod,
            cancellationToken);

        if (!request.Selected)
        {
            if (existing is not null) db.AdditionalMealSelections.Remove(existing);
        }
        else if (existing is null)
        {
            db.AdditionalMealSelections.Add(new AdditionalMealSelection
            {
                StudentId = studentId,
                ItemId = request.ItemId,
                Date = request.Date,
                MealPeriod = request.MealPeriod,
                Quantity = item.DefaultQuantity <= 0 ? 1 : item.DefaultQuantity,
            });
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Monthly consumption per student for one item and wing — the denominator the Others Bill is
    /// divided by. Returns every eligible active student, including those with zero, so the admin
    /// preview shows a complete roster — plus anyone else who actually consumed that month.
    ///
    /// The second half matters: restricting the roster to currently-active students meant a
    /// student who took tea and was later deactivated dropped out of both the numerator and the
    /// denominator. Regenerating the bill after they left then divided the same pooled amount
    /// across fewer units, silently raising the unit rate for everyone who stayed and writing off
    /// the departed student's share entirely.
    /// </summary>
    public async Task<IReadOnlyList<(Guid StudentId, int Count)>> GetMonthlyConsumptionAsync(
        int month, int year, Guid itemId, string wing, CancellationToken cancellationToken)
    {
        var from = new DateOnly(year, month, 1);
        var to = from.AddMonths(1).AddDays(-1);

        var counts = await db.AdditionalMealSelections.AsNoTracking()
            .Where(x => x.ItemId == itemId && x.Date >= from && x.Date <= to
                && x.Student != null && x.Student.Gender == wing)
            .GroupBy(x => x.StudentId)
            .Select(x => new { StudentId = x.Key, Count = x.Sum(y => y.Quantity) })
            .ToDictionaryAsync(x => x.StudentId, x => x.Count, cancellationToken);

        var activeStudentIds = await db.Students.AsNoTracking()
            .Where(x => x.Status == MealResolutionContext.BillableStatus && x.Gender == wing)
            .OrderBy(x => x.StudentName)
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        var roster = activeStudentIds.Concat(counts.Keys.Except(activeStudentIds)).Distinct().ToList();
        return roster.Select(id => (id, counts.GetValueOrDefault(id))).ToList();
    }

    /// <summary>Counts for the admin report, grouped by date, meal, item or student.</summary>
    /// <summary>
    /// The Additional Items roster for one date — who took what, in which slot — meant to sit
    /// beside the regular Meal Sheet rather than as a standalone monthly report. Only students
    /// with at least one mark that day are returned.
    /// </summary>
    public async Task<AdditionalMealSheetDto> GetSheetAsync(
        DateOnly date, string? wingFilter, CancellationToken cancellationToken)
    {
        var mealTypes = await db.MealTypes.AsNoTracking()
            .OrderBy(x => x.SortOrder)
            .Select(x => new AdditionalMealPeriodDto(x.Code, x.Label))
            .ToListAsync(cancellationToken);

        var query = db.AdditionalMealSelections.AsNoTracking()
            .Include(x => x.Item)
            .Include(x => x.Student)
            .Where(x => x.Date == date);

        if (wingFilter is "Male" or "Female") query = query.Where(x => x.Student!.Gender == wingFilter);

        var marks = await query.ToListAsync(cancellationToken);

        var rows = marks
            .GroupBy(x => x.StudentId)
            .Select(g =>
            {
                var student = g.First().Student;
                return new AdditionalMealSheetRowDto(
                    g.Key,
                    student?.HallId ?? string.Empty,
                    student?.StudentId ?? string.Empty,
                    student?.StudentName ?? string.Empty,
                    student?.RoomNo ?? string.Empty,
                    student?.Gender ?? string.Empty,
                    g.Select(x => new AdditionalMealSheetMarkDto(x.MealPeriod, x.Item?.Name ?? string.Empty)).ToList());
            })
            .OrderBy(x => x.Room).ThenBy(x => x.Name)
            .ToList();

        return new AdditionalMealSheetDto(date, wingFilter ?? "All", marks.Sum(x => x.Quantity), mealTypes, rows);
    }
}
