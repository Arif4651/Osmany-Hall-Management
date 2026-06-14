using HallBackend.Domain.Common;

namespace HallBackend.Domain.Entities;

/// <summary>
/// Represents an admin-level override that forces all students' meal status
/// ON or OFF for a given meal period within a date range.
/// Takes priority over individual <see cref="MealStatusHistory"/> records.
/// </summary>
public sealed class GlobalMealOverride : Entity
{
    public string Wing { get; set; } = "Male";

    /// <summary>The meal period this override applies to (breakfast / lunch / dinner).</summary>
    public string MealPeriod { get; set; } = string.Empty;

    /// <summary>First day the override is active (inclusive).</summary>
    public DateOnly EffectiveFrom { get; set; }

    /// <summary>Last day the override is active (inclusive).</summary>
    public DateOnly EffectiveTo { get; set; }

    /// <summary>
    /// When true, all students are forced ON for this period.
    /// When false, all students are forced OFF.
    /// </summary>
    public bool IsOn { get; set; }

    /// <summary>Optional admin note explaining the reason for the override.</summary>
    public string? Note { get; set; }

    /// <summary>Admin who created this override.</summary>
    public Guid CreatedById { get; set; }
    public AppUser? CreatedBy { get; set; }
}
