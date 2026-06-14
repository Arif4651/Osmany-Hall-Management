namespace HallBackend.Application.Dtos;

public sealed record StudentDto(
    Guid Id,
    string StudentName,
    string StudentId,
    string RollNumber,
    string Gender,
    string Department,
    string HallId,
    string MobileNumber,
    string Level,
    string HallName,
    string RoomNo,
    string Status,
    bool LoginAccessEnabled,
    bool ReactivationEligible,
    bool PermanentDeleteEligible);

public sealed class StudentUpsertRequest
{
    public string? StudentName { get; set; }
    public string? StudentId { get; set; }
    public string? RollNumber { get; set; }
    public string? Gender { get; set; }
    public string? Department { get; set; }
    public string? HallId { get; set; }
    public string? MobileNumber { get; set; }
    public string? Level { get; set; }
    public string? HallName { get; set; }
    public string? RoomNo { get; set; }
    public string? Status { get; set; }
}

public sealed record StudentListResponse(IReadOnlyList<StudentDto> Items, int Page, int PageSize, int Total, int TotalPages, IReadOnlyList<Guid> FilteredIds);
public sealed record StudentFilterOptionsResponse(IReadOnlyList<string> Departments, IReadOnlyList<string> Levels, IReadOnlyList<string> Halls);
public sealed record BulkStudentRequest(IReadOnlyList<Guid> SelectedStudentIds, Dictionary<string, string> UpdateFields, bool Force = false);
public sealed record BulkStudentResponse(int UpdatedCount, IReadOnlyList<Guid> TargetIds, int DeletedCount = 0, IReadOnlyList<Guid>? DeletedIds = null, IReadOnlyList<Guid>? SkippedIds = null);
public sealed record StudentProfileUpdateRequest(string MobileNumber, string RoomNo);
