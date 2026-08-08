using HallBackend.Domain.Common;

namespace HallBackend.Domain.Entities;

/// <summary>
/// An optional consumable a student can opt into per meal — Tea first, with Milk/Coffee and
/// anything similar added later from the admin screen rather than in code.
/// </summary>
public sealed class AdditionalMealItem : Entity
{
    /// <summary>Stable lowercase identifier, e.g. "tea". Never reused once billed against.</summary>
    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Which students may select this: "Male", "Female", or "All". Matched against
    /// <see cref="Student.Gender"/> so eligibility never duplicates the gender data.
    /// Widening this later is what lets the male wing adopt an item with no deploy.
    /// </summary>
    public string EligibleWing { get; set; } = "Female";

    /// <summary>Units recorded per selection. One tea per meal today; kept configurable.</summary>
    public int DefaultQuantity { get; set; } = 1;

    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
}

/// <summary>
/// One student's opt-in for a single date and meal slot.
///
/// Deliberately NOT a standing preference: unlike <see cref="MealPreferenceHistory"/>, which
/// carries EffectiveFrom/EffectiveTo and persists until changed, a row here means exactly one
/// meal on exactly one date. Absence of a row is absence of consumption.
///
/// Shape mirrors <see cref="GuestMealRequest"/>, which solves the same student+date+meal problem.
/// </summary>
public sealed class AdditionalMealSelection : Entity
{
    public Guid StudentId { get; set; }
    public Student? Student { get; set; }

    public Guid ItemId { get; set; }
    public AdditionalMealItem? Item { get; set; }

    public DateOnly Date { get; set; }

    /// <summary>Meal type code from the meal_types table (breakfast / lunch / dinner / …).</summary>
    public string MealPeriod { get; set; } = string.Empty;

    /// <summary>Units consumed. Counts as this many when the monthly bill is apportioned.</summary>
    public int Quantity { get; set; } = 1;
}

/// <summary>
/// A generated Others Bill: the admin's pooled monthly amount for one item and wing, frozen
/// together with the consumption it was divided by.
///
/// This row and its <see cref="OthersBillAllocation"/> children are a snapshot, not a view.
/// Bill recalculation reads them and never recomputes them, so a student changing their
/// selections after generation cannot silently move anyone's finalized amount — the admin has to
/// regenerate deliberately. This is what replaces the removed period-locking mechanism.
/// </summary>
public sealed class OthersBill : Entity
{
    public int Month { get; set; }
    public int Year { get; set; }

    public Guid ItemId { get; set; }
    public AdditionalMealItem? Item { get; set; }

    /// <summary>Scoped per wing, like DswSubsidy, so one wing's usage cannot move the other's rate.</summary>
    public string Wing { get; set; } = "Female";

    /// <summary>The pooled amount the admin entered.</summary>
    public decimal TotalAmount { get; set; }

    /// <summary>Sum of every eligible student's units for the month, as it stood at generation.</summary>
    public int TotalConsumptionCount { get; set; }

    /// <summary>TotalAmount / TotalConsumptionCount, stored for audit and display.</summary>
    public decimal UnitRate { get; set; }

    public string? Notes { get; set; }

    public Guid GeneratedById { get; set; }
    public AppUser? GeneratedBy { get; set; }
    public DateTime GeneratedAtUtc { get; set; } = DateTime.UtcNow;

    public ICollection<OthersBillAllocation> Allocations { get; set; } = [];
}

/// <summary>
/// One student's frozen share of an <see cref="OthersBill"/>. Mirrors DswSubsidyDistribution.
/// </summary>
public sealed class OthersBillAllocation : Entity
{
    public Guid OthersBillId { get; set; }
    public OthersBill? OthersBill { get; set; }

    public Guid StudentId { get; set; }
    public Student? Student { get; set; }

    /// <summary>The student's units at generation time — kept so old bills stay explainable.</summary>
    public int ConsumptionCount { get; set; }

    public decimal AllocatedAmount { get; set; }
}
