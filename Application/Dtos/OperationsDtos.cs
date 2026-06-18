namespace HallBackend.Application.Dtos;

public sealed record AuditLogDto(Guid Id, string Actor, string Action, string Module, DateOnly Date);
public sealed record AuditLogListResponse(IReadOnlyList<AuditLogDto> Items, int Page, int PageSize, int Total, int TotalPages);
public sealed record NotificationDto(Guid Id, string Title, string Description, DateOnly Date, bool IsRead);
