using HallBackend.Domain.Common;

namespace HallBackend.Domain.Entities;

public sealed class MealType : Entity
{
    public string Code { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public TimeOnly StartsAt { get; set; }
    public TimeOnly EndsAt { get; set; }
    public ICollection<MealConfiguration> Configurations { get; set; } = [];
}
