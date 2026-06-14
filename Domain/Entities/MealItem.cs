using HallBackend.Domain.Common;

namespace HallBackend.Domain.Entities;

public sealed class MealItem : Entity
{
    public Guid MealConfigurationId { get; set; }
    public MealConfiguration? MealConfiguration { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Cost { get; set; }
    public bool IsOptional { get; set; }
    public Guid? InventoryItemId { get; set; }
    public InventoryItem? InventoryItem { get; set; }
}
