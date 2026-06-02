using HallBackend.Domain.Common;

namespace HallBackend.Domain.Entities;

public sealed class Notification : Entity
{
    public Guid? StudentId { get; set; }
    public Student? Student { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateOnly Date { get; set; }
    public bool IsRead { get; set; }
}
