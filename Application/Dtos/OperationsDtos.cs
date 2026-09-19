namespace HallBackend.Application.Dtos;

public sealed record NotificationDto(Guid Id, string Title, string Description, DateOnly Date, bool IsRead);
