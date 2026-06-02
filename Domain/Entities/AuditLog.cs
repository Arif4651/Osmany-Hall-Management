using HallBackend.Domain.Common;

namespace HallBackend.Domain.Entities;

public sealed class AuditLog : Entity
{
    public string Actor { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string Module { get; set; } = string.Empty;
    public DateOnly Date { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
}
