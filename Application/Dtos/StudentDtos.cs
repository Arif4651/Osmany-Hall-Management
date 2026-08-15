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
    bool PermanentDeleteEligible,
    DateOnly JoinDate);

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

    /// <summary>
    /// When the student actually joined the hall. Defaults to today when omitted on create.
    /// Billing/meal/subsidy participation never counts a student before this date — an admin
    /// creating the record after the fact should backdate this to the real move-in date so
    /// historical billing for that gap resolves correctly.
    /// </summary>
    public DateOnly? JoinDate { get; set; }
}

/// <summary>
/// Returned once, immediately after an admin creates a student account or resets its password.
/// <see cref="TemporaryPassword"/> is never stored in the clear and is not retrievable again —
/// the admin must hand it to the student out of band, who is then forced to change it at login.
/// </summary>
public sealed record StudentCredentialDto(StudentDto Student, string TemporaryPassword);

/// <param name="FilteredIds">
/// Not every matching id — only the subset of the caller-supplied <c>selectedIds</c> query
/// parameter that still matches the current filter, so a bulk selection can be pruned as filters
/// change without downloading the whole matched set on every page turn. Empty when no
/// <c>selectedIds</c> was supplied. For the full matching set (e.g. "select all"), call
/// <c>GET /api/students/filtered-ids</c> instead.
/// </param>
public sealed record StudentListResponse(IReadOnlyList<StudentDto> Items, int Page, int PageSize, int Total, int TotalPages, IReadOnlyList<Guid> FilteredIds);
public sealed record StudentFilterOptionsResponse(IReadOnlyList<string> Departments, IReadOnlyList<string> Levels, IReadOnlyList<string> Halls);
public sealed record BulkStudentRequest(IReadOnlyList<Guid> SelectedStudentIds, Dictionary<string, string> UpdateFields, bool Force = false);
public sealed record BulkStudentResponse(int UpdatedCount, IReadOnlyList<Guid> TargetIds, int DeletedCount = 0, IReadOnlyList<Guid>? DeletedIds = null, IReadOnlyList<Guid>? SkippedIds = null);
public sealed record StudentProfileUpdateRequest(string MobileNumber, string RoomNo);
