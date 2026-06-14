using HallBackend.Domain.Common;

namespace HallBackend.Domain.Entities;

public sealed class AppUser : Entity
{
    public string FullName { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string NormalizedUserName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string NormalizedEmail { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Designation { get; set; } = string.Empty;
    public string? Wing { get; set; }
    public bool MustChangePassword { get; set; }
    public DateTime? LastLoginAtUtc { get; set; }
    public bool IsActive { get; set; } = true;
    public Guid? StudentId { get; set; }
    public Student? Student { get; set; }
}
