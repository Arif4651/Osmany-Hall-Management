namespace HallBackend.Application.Dtos;

public sealed record InventoryItemFinancialDto(
    Guid Id, string Name, string Wing, string Category, string Unit, Guid? LinkedOptionId,
    decimal CurrentStockQty, decimal CurrentWac, decimal TotalStockValue, bool IsDeleted, bool IsStored);
public sealed record SaveInventoryItemRequest(string Name, string Category, string Unit, Guid? LinkedOptionId, bool IsStored, string? Wing);
public sealed record StockTransactionDto(
    Guid Id, Guid ItemId, string ItemName, string Wing, string Category, string TransactionType,
    DateOnly Date, string? MealPeriod, decimal Quantity, decimal Rate, decimal WacSnapshot,
    decimal TotalCost, string? Note, bool IsLocked, int? ParticipantCount = null,
    Guid? SourceBatchId = null, string? BatchLabel = null, bool IsPreBatchLegacy = false);
public sealed record SaveStockTransactionRequest(
    Guid ItemId, string TransactionType, DateOnly Date, string? MealPeriod,
    decimal Quantity, decimal? Rate, string? Note, string? Wing, decimal? TotalPrice = null,
    Guid? SourceBatchId = null);

/// <summary>
/// One stock-in lot of an item, with its own unit rate. <paramref name="Label"/> is a display
/// position among the item's open batches ("Rice-1", "Rice-2") and renumbers as batches are
/// exhausted — never store or send it back as an identifier; use <paramref name="Id"/>.
/// </summary>
public sealed record InventoryBatchDto(
    Guid Id, Guid ItemId, string ItemName, string Unit, string Label, int Position,
    DateOnly ReceivedDate, decimal ReceivedQuantity, decimal RemainingQuantity,
    decimal Rate, decimal RemainingValue, bool IsOpeningBatch, string? Note);


public sealed record MealPreferenceStateDto(string MealPeriod, bool IsOn, Guid? OptionItemId, string? OptionName = null, int GuestCount = 0);
public sealed record SaveMealPreferenceStateRequest(
    DateOnly EffectiveFrom, IReadOnlyList<MealPreferenceStateDto> Meals);
public sealed record SaveMealOffRangeRequest(
    DateOnly From, DateOnly To, IReadOnlyList<string> MealPeriods);
public sealed record MealSnapshotRowDto(DateOnly Date, IReadOnlyList<MealPreferenceStateDto> Meals);
public sealed record MenuOptionDto(Guid Id, string Name, decimal Cost);
public sealed record MenuMealDto(string MealPeriod, IReadOnlyList<MenuOptionDto> CommonItems, IReadOnlyList<MenuOptionDto> Options);
public sealed record SaveMenuMealRequest(string MealPeriod, IReadOnlyList<Guid> CommonItemIds, IReadOnlyList<Guid> OptionItemIds);

public sealed record MonthlyBillDto(
    Guid StudentId, string StudentName, string RollNumber, string HallId, string Gender,
    int Month, int Year, decimal ServiceBill, decimal MonthlyBill, decimal DswSubsidy, decimal GuestMealBill,
    decimal CarriedDue, decimal DueBill, decimal TotalBill, string Status, bool IsOverridden, bool IsLocked);
public sealed record SaveServiceBillRequest(int Month, int Year, decimal AmountPerStudent);
public sealed record CloseBillingPeriodRequest(int Month, int Year);
public sealed record UnlockBillingPeriodRequest(int Month, int Year, string Note);
public sealed record BillingPeriodDto(int Month, int Year, bool IsLocked, DateTime? LockedAtUtc);

public sealed record PaymentCategoryDto(Guid Id, string Name);
public sealed record PaymentSubmissionDto(
    Guid Id, Guid StudentId, string StudentName, string RollNumber, string HallId, string Gender,
    Guid CategoryId, string Category, int BillingMonth, int BillingYear,
    decimal SubmittedAmount, decimal SubmittedCharge, decimal? ApprovedAmount,
    string TransactionId, string Status,
    DateTime SubmittedAtUtc, DateTime? ReviewedAtUtc);
public sealed record SubmitPaymentRequest(
    Guid CategoryId, int BillingMonth, int BillingYear, decimal Amount, decimal Charges, string TransactionId);
public sealed record ReviewPaymentRequest(string Action, decimal? ApprovedAmount);

public sealed record DueRowDto(
    Guid StudentId, string StudentName, string StudentCode, string HallId,
    string Gender, int Month, int Year, decimal DueBill, bool IsOverridden, string MobileNumber, string Department);
public sealed record SaveDueAdjustmentRequest(
    Guid StudentId, int BillingMonth, int BillingYear, decimal AdjustedAmount, string? Note);

public sealed record DailyCostOptionBreakdownDto(Guid OptionId, string Name, decimal Cost, int Students, decimal PerHead);

public sealed record DailyCostMealDto(
    decimal Cost,
    int Students,
    decimal PerHead,
    decimal MyCost,
    IReadOnlyList<DailyCostOptionBreakdownDto> Options);

public sealed record DailyCostRowDto(
    DateOnly Date,
    DailyCostMealDto Breakfast,
    DailyCostMealDto Lunch,
    DailyCostMealDto Dinner,
    decimal TotalPerHead,
    decimal TotalMyCost,
    IReadOnlyList<DailyCostOptionBreakdownDto> Options);

public sealed record DailyCostReportDto(
    int Month,
    int Year,
    string Gender,
    IReadOnlyList<DailyCostRowDto> Rows,
    DailyCostMealDto Breakfast,
    DailyCostMealDto Lunch,
    DailyCostMealDto Dinner,
    DailyCostMealDto GrandTotal);

public sealed record StudentSearchResultDto(Guid Id, string Name, string RollNumber, string HallId, string StudentId);
public sealed record CreateDswSubsidyRequest(
    string? Wing,
    decimal SubsidyAmount,
    DateOnly Date,
    string MealPeriod,
    string? Notes);
public sealed record StudentBillSubsidyAdjustmentDto(
    Guid SubsidyId,
    DateOnly Date,
    string MealPeriod,
    decimal Amount,
    string? Notes);
public sealed record DswSubsidyDto(
    Guid Id,
    string Wing,
    decimal SubsidyAmount,
    DateOnly Date,
    string MealPeriod,
    int EligibleStudentCount,
    decimal PerStudentSubsidy,
    string? Notes);
public sealed record AdminStudentMealControlDto(
    Guid StudentRecordId,
    string StudentId,
    string Name,
    string HallId,
    string RoomNo,
    string Gender,
    DateOnly EffectiveDate,
    IReadOnlyList<AdminStudentMealStatusDto> Meals);
public sealed record SaveAdminStudentMealStatusRequest(
    Guid StudentRecordId,
    string? Wing,
    DateOnly EffectiveFrom,
    string MealPeriod,
    bool IsOn,
    Guid? OptionItemId);

public sealed record PaymentListResponse(IReadOnlyList<PaymentSubmissionDto> Items, int Page, int PageSize, int Total, int TotalPages);
