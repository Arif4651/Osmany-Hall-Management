using HallBackend.Domain.Common;

namespace HallBackend.Domain.Entities;

public sealed class StudentMealPreference : Entity
{
    public Guid StudentId { get; set; }
    public Student? Student { get; set; }
    public Guid MealTypeId { get; set; }
    public MealType? MealType { get; set; }
    public bool Enabled { get; set; } = true;
    public Guid? OptionItemId { get; set; }
}
