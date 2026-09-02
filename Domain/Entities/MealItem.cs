using HallBackend.Domain.Common;

namespace HallBackend.Domain.Entities;

public sealed class MealItem : Entity
{
    public Guid MealConfigurationId { get; set; }
    public MealConfiguration? MealConfiguration { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Cost { get; set; }
    public bool IsOptional { get; set; }
    /// <summary>
    /// When true, this optional item is the admin-designated default fallback.
    /// Automatically assigned to a student whose meal is ON but no selection was
    /// made before the daily cutoff. At most one item per MealConfiguration should
    /// be marked default — enforced at the API layer (items are deleted/re-inserted
    /// on every save, so a DB unique constraint would need a partial index that EF
    /// cannot express cleanly for this case).
    /// </summary>
    public bool IsDefault { get; set; }
    public Guid? InventoryItemId { get; set; }
    public InventoryItem? InventoryItem { get; set; }
}
