using HallBackend.Domain.Common;

namespace HallBackend.Domain.Entities;

public static class AttendanceStatus
{
    public const string Present = "Present";
}

public sealed class AttendanceHallLocation : Entity
{
    public string HallId { get; set; } = string.Empty;
    public string HallName { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public int RadiusMeters { get; set; } = 100;
    public int MaxAccuracyMeters { get; set; } = 150;
    public bool IsActive { get; set; } = true;
}

public sealed class AttendanceSession : Entity
{
    public string HallId { get; set; } = string.Empty;
    public string HallName { get; set; } = string.Empty;
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public bool IsActive { get; set; } = true;
    public Guid CreatedById { get; set; }
    public AppUser? CreatedBy { get; set; }
    public ICollection<AttendanceRecord> Records { get; set; } = new List<AttendanceRecord>();
}

public sealed class AttendanceRecord : Entity
{
    public Guid SessionId { get; set; }
    public AttendanceSession? Session { get; set; }
    public Guid StudentId { get; set; }
    public Student? Student { get; set; }
    public DateOnly AttendanceDate { get; set; }
    public DateTime MarkedAtUtc { get; set; } = DateTime.UtcNow;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public double AccuracyMeters { get; set; }
    public double DistanceFromHallMeters { get; set; }
    public string Status { get; set; } = AttendanceStatus.Present;
}
