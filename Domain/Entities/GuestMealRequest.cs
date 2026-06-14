using HallBackend.Domain.Common;

namespace HallBackend.Domain.Entities;

/// <summary>
/// Records a student's request for one or more extra (guest) meals
/// on a specific date and meal period.
/// One record per student per meal period per date (enforced by unique index).
/// </summary>
public sealed class GuestMealRequest : Entity
{
    public Guid StudentId { get; set; }
    public Student? Student { get; set; }

    /// <summary>breakfast / lunch / dinner</summary>
    public string MealPeriod { get; set; } = string.Empty;

    /// <summary>The date the guest meal applies to.</summary>
    public DateOnly Date { get; set; }

    /// <summary>Number of extra guest meals (1–20).</summary>
    public int GuestCount { get; set; }
}
