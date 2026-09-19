namespace HallBackend.Application.Dtos;

// ── List / Detail DTOs ────────────────────────────────────────────────────

/// <summary>
/// One row in the log list table. OldValues/NewValues are deliberately excluded from the list
/// projection for performance — they can be large JSON blobs. The detail endpoint loads them.
/// </summary>
public sealed record AuditLogDto(
    Guid Id,
    DateTime TimestampUtc,
    string Actor,
    Guid? ActorUserId,
    string ActorRole,
    string Module,
    string Action,
    string EntityType,
    string? EntityId,
    string Description,
    bool IsSuccess);

/// <summary>Full audit log record including before/after values.</summary>
public sealed record AuditLogDetailDto(
    Guid Id,
    DateTime TimestampUtc,
    string Actor,
    Guid? ActorUserId,
    string ActorRole,
    string Module,
    string Action,
    string EntityType,
    string? EntityId,
    string Description,
    string? OldValues,
    string? NewValues,
    string? IpAddress,
    string? UserAgent,
    bool IsSuccess);

/// <summary>Paginated list response.</summary>
public sealed record AuditLogListResponse(
    IReadOnlyList<AuditLogDto> Items,
    int Page,
    int PageSize,
    int Total,
    int TotalPages);

/// <summary>Summary card counts shown at the top of the Logs page.</summary>
public sealed record AuditLogStatsDto(
    int TotalLogs,
    int TodayLogs,
    int ThisWeekLogs,
    int ActiveAdmins);
