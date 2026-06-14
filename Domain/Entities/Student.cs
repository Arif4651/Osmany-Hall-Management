using HallBackend.Domain.Common;

namespace HallBackend.Domain.Entities;

public sealed class Student : Entity
{
    public string StudentName { get; set; } = string.Empty;
    public string StudentId { get; set; } = string.Empty;
    public string RollNumber { get; set; } = string.Empty;
    public string Gender { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public string HallId { get; set; } = string.Empty;
    public string MobileNumber { get; set; } = string.Empty;
    public string Level { get; set; } = string.Empty;
    public string HallName { get; set; } = string.Empty;
    public string RoomNo { get; set; } = string.Empty;
    public string Status { get; set; } = "active";
    public bool LoginAccessEnabled { get; set; } = true;
    public bool ReactivationEligible { get; set; }
    public bool PermanentDeleteEligible { get; set; }

    public AppUser? User { get; set; }
}
