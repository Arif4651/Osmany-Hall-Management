using HallBackend.Domain.Common;

namespace HallBackend.Domain.Entities;

public sealed class InventoryItem : Entity
{
    public string Item { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public decimal Stock { get; set; }
    public decimal Threshold { get; set; }
    public string Status { get; set; } = "active";
}
