using HallBackend.Domain.Common;

namespace HallBackend.Domain.Entities;

public sealed class MealDay : Entity
{
    public string Code { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public ICollection<MealConfiguration> Configurations { get; set; } = [];
}
