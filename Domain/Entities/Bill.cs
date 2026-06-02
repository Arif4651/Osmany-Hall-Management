using HallBackend.Domain.Common;

namespace HallBackend.Domain.Entities;

public sealed class Bill : Entity
{
    public Guid StudentId { get; set; }
    public Student? Student { get; set; }
    public string BillNo { get; set; } = string.Empty;
    public string Period { get; set; } = string.Empty;
    public decimal MealCost { get; set; }
    public decimal Utility { get; set; }
    public decimal Service { get; set; }
    public decimal Total { get; set; }
    public string Status { get; set; } = "pending";
    public DateOnly DueDate { get; set; }
    public ICollection<Payment> Payments { get; set; } = [];
}
