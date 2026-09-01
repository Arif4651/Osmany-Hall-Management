using HallBackend.Domain.Common;

namespace HallBackend.Domain.Entities;

public sealed class MealSetting : Entity
{
    public string Wing { get; set; } = "Male";
    public TimeOnly CutoffTime { get; set; } = new(17, 0);
    public int ForecastMaxOptions { get; set; } = 6;
}
