namespace HallBackend.Application.Dtos;

public sealed record NoticeDto(
    Guid Id,
    string Title,
    string Content,
    string TargetWing,
    Guid CreatedById,
    string CreatorName,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc);

public sealed record CreateNoticeRequest(
    string Title,
    string Content,
    string TargetWing);

public sealed record UpdateNoticeRequest(
    string Title,
    string Content,
    string TargetWing);
