namespace HallBackend.Application.Dtos;

public sealed record AttendanceHallLocationDto(
    Guid Id,
    string HallId,
    string HallName,
    double Latitude,
    double Longitude,
    int RadiusMeters,
    int MaxAccuracyMeters,
    bool IsActive,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc);

public sealed record AttendanceHallOptionDto(string HallId, string HallName, string Gender, int StudentCount, bool IsConfigured);

public sealed record SaveAttendanceHallLocationRequest(
    string HallId,
    string? HallName,
    double Latitude,
    double Longitude,
    int RadiusMeters,
    int? MaxAccuracyMeters,
    bool IsActive = true);

public sealed record AttendanceSessionDto(
    Guid Id,
    string HallId,
    string HallName,
    TimeOnly StartTime,
    TimeOnly EndTime,
    bool IsActive,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc);

public sealed record SaveAttendanceSessionRequest(
    string HallId,
    string? HallName,
    TimeOnly StartTime,
    TimeOnly EndTime,
    bool IsActive = true);

public sealed record MarkAttendanceRequest(double Latitude, double Longitude, double AccuracyMeters);

public sealed record StudentAttendanceCurrentDto(
    AttendanceSessionDto? Session,
    DateOnly AttendanceDate,
    string? AssignedHallId,
    string? AssignedHallName,
    string Status,
    DateTime? MarkedAtUtc,
    string Message);

public sealed record MarkAttendanceResponse(
    string Status,
    DateTime MarkedAtUtc,
    double DistanceFromHallMeters,
    string HallName,
    string Message);

public sealed record StudentAttendanceHistoryRowDto(
    Guid Id,
    DateOnly AttendanceDate,
    TimeOnly StartTime,
    TimeOnly EndTime,
    DateTime MarkedAtUtc,
    string Status);

public sealed record StudentAttendanceMonthDayDto(
    DateOnly Date,
    string DayName,
    string Status,
    DateTime? MarkedAtUtc);

public sealed record StudentAttendanceMonthDto(
    int Year,
    int Month,
    string MonthName,
    int TotalDays,
    int PresentDays,
    int AbsentDays,
    IReadOnlyList<StudentAttendanceMonthDayDto> Days);

public sealed record AttendanceSheetSummaryDto(int TotalStudents, int Present, int Absent, decimal AttendancePercentage);

public sealed record AttendanceSheetRowDto(
    Guid StudentRecordId,
    string StudentId,
    string StudentName,
    string HallId,
    string HallName,
    string RoomNo,
    string Gender,
    string Department,
    string Level,
    string Status,
    DateTime? MarkedAtUtc,
    double? AccuracyMeters,
    double? DistanceFromHallMeters);

public sealed record AttendanceSheetResponse(
    AttendanceSessionDto? Session,
    DateOnly AttendanceDate,
    AttendanceSheetSummaryDto Summary,
    IReadOnlyList<AttendanceSheetRowDto> Rows,
    int Page,
    int PageSize,
    int Total,
    int TotalPages);
