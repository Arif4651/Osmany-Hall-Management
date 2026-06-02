namespace HallBackend.Application.Dtos;

public sealed record StatDto(string Title, decimal Value, string? Unit, string Trend, string Tone, bool IsCurrency = false);
public sealed record DashboardDto(IReadOnlyList<StatDto> Stats);
public sealed record BillDto(Guid Id, string BillId, string Period, decimal MealCost, decimal Utility, decimal Service, decimal Total, string Status, DateOnly DueDate);
public sealed record PaymentDto(Guid Id, string PaymentId, string StudentName, string BillId, decimal Amount, string Method, DateOnly SubmittedAt, string Status, string Reference);
public sealed record InventoryItemDto(Guid Id, string Item, string Category, decimal Stock, decimal Threshold, string Status);
public sealed record AuditLogDto(Guid Id, string Actor, string Action, string Module, DateOnly Date);
public sealed record NotificationDto(Guid Id, string Title, string Description, DateOnly Date, bool IsRead);
