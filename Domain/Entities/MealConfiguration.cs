using HallBackend.Domain.Common;

namespace HallBackend.Domain.Entities;

public sealed class MealConfiguration : Entity
{
    public Guid MealDayId { get; set; }
    public MealDay? MealDay { get; set; }
    public Guid MealTypeId { get; set; }
    public MealType? MealType { get; set; }
    public string Status { get; set; } = "active";
    public ICollection<MealItem> Items { get; set; } = [];
}
