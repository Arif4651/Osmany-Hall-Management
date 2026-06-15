using HallBackend.Domain.Common;

namespace HallBackend.Domain.Entities;

public sealed class Notice : Entity
{
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string TargetWing { get; set; } = "All"; // "All", "Male", "Female"
    public Guid CreatedById { get; set; }
    public AppUser? CreatedBy { get; set; }
}
