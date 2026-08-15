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

    /// <summary>
    /// The date this student actually joined the hall — distinct from <see cref="Entity.CreatedAtUtc"/>,
    /// which only records when the account row was inserted and can be days after the real move-in
    /// date if an admin was creating the record late. Billing and reporting must never count a
    /// student as a meal/subsidy participant on a date before this one: without that check, a
    /// hall-wide meal override dated before a student joined would retroactively bill them for
    /// meals that happened before they existed at the hall.
    /// </summary>
    public DateOnly JoinDate { get; set; }

    public string Status { get; set; } = "active";
    public bool LoginAccessEnabled { get; set; } = true;
    public bool ReactivationEligible { get; set; }
    public bool PermanentDeleteEligible { get; set; }

    public AppUser? User { get; set; }
}
