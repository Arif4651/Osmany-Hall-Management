using HallBackend.Domain.Common;

namespace HallBackend.Domain.Entities;

public sealed class InventoryItem : Entity
{
    public string Item { get; set; } = string.Empty;
    public string Wing { get; set; } = "Male";
    public string Category { get; set; } = string.Empty;
    public string Unit { get; set; } = "kg";
    public Guid? LinkedOptionId { get; set; }
    public InventoryItem? LinkedOption { get; set; }
    public ICollection<InventoryItem> LinkedOthers { get; set; } = [];
    public decimal CurrentStockQuantity { get; set; }
    public decimal CurrentWac { get; set; }
    public bool IsStored { get; set; } = true;
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAtUtc { get; set; }
    public Guid CreatedById { get; set; }
    public AppUser? CreatedBy { get; set; }

    // Kept during the data migration so existing inventory records can be normalized.
    public decimal Stock { get; set; }
    public decimal Threshold { get; set; }
    public decimal AveragePrice { get; set; }
    public decimal TotalStockValue { get; set; }
    public DateOnly? LastMovementDate { get; set; }
    public string Status { get; set; } = "active";
    public ICollection<StockTransaction> StockTransactions { get; set; } = [];
}
