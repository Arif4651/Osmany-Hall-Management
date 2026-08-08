namespace HallBackend.Application.Dtos;

// ── Item catalogue ───────────────────────────────────────────────────────────

public sealed record AdditionalMealItemDto(
    Guid Id, string Code, string Name, string EligibleWing,
    int DefaultQuantity, bool IsActive, int SortOrder);

public sealed record SaveAdditionalMealItemRequest(
    string Code, string Name, string EligibleWing, int DefaultQuantity, bool IsActive);

// ── Student selections ───────────────────────────────────────────────────────

public sealed record AdditionalMealSelectionDto(
    Guid ItemId, string ItemCode, string ItemName, DateOnly Date, string MealPeriod, int Quantity);

/// <summary>
/// Marks or clears one slot. <see cref="Selected"/> false removes the row, which is why the
/// student role needs delete on the additional-preferences menu.
/// </summary>
public sealed record SaveAdditionalMealSelectionRequest(
    Guid ItemId, DateOnly Date, string MealPeriod, bool Selected);

/// <summary>Everything the student's Additional Preferences panel needs for one date.</summary>
public sealed record AdditionalMealDayDto(
    DateOnly Date,
    bool IsEditable,
    string? LockedReason,
    IReadOnlyList<AdditionalMealDaySlotDto> Slots);

public sealed record AdditionalMealDaySlotDto(
    string MealPeriod,
    string MealLabel,
    IReadOnlyList<AdditionalMealDayItemDto> Items);

public sealed record AdditionalMealDayItemDto(
    Guid ItemId, string Name, bool IsSelected);

// ── Month view ───────────────────────────────────────────────────────────────

public sealed record AdditionalMealItemSummaryDto(Guid ItemId, string Name);

public sealed record AdditionalMealPeriodDto(string Code, string Label);

/// <summary>One marked slot, flattened so the client can key a lookup off it.</summary>
public sealed record AdditionalMealMarkDto(DateOnly Date, string MealPeriod, Guid ItemId);

public sealed record AdditionalMealMonthDayDto(DateOnly Date, bool IsEditable);

/// <summary>
/// A whole month of a student's additional preferences in one payload: the meal slots, the items
/// they may take, every day with its editability, and the marks already made. Lets the client
/// render a month grid without a request per date.
/// </summary>
public sealed record AdditionalMealMonthDto(
    int Month,
    int Year,
    DateOnly EarliestEditableDate,
    IReadOnlyList<AdditionalMealPeriodDto> MealPeriods,
    IReadOnlyList<AdditionalMealItemSummaryDto> Items,
    IReadOnlyList<AdditionalMealMonthDayDto> Days,
    IReadOnlyList<AdditionalMealMarkDto> Marks);

// ── Admin sheet (per-date roster, alongside the Meal Sheet) ──────────────────

/// <summary>One item a student took in one meal slot on the sheet's date.</summary>
public sealed record AdditionalMealSheetMarkDto(string MealPeriod, string ItemName);

/// <summary>
/// One student's row. Only students with at least one mark that date appear — this is a roster
/// of who took what, not a full student list with mostly-empty rows.
/// </summary>
public sealed record AdditionalMealSheetRowDto(
    Guid StudentId,
    string HallId,
    string StudentCode,
    string Name,
    string Room,
    string Gender,
    IReadOnlyList<AdditionalMealSheetMarkDto> Marks);

/// <summary>
/// The Additional Items roster for one date, shaped to sit beside the regular Meal Sheet:
/// the meal-slot columns to render, and one row per student who marked anything that day.
/// </summary>
public sealed record AdditionalMealSheetDto(
    DateOnly Date,
    string Wing,
    int TotalMarks,
    IReadOnlyList<AdditionalMealPeriodDto> MealPeriods,
    IReadOnlyList<AdditionalMealSheetRowDto> Rows);

// ── Others Bill ──────────────────────────────────────────────────────────────

public sealed record OthersBillAllocationDto(
    Guid StudentId, string StudentName, string RollNumber, int ConsumptionCount, decimal AllocatedAmount);

/// <summary>
/// A distribution the admin can inspect before committing. <see cref="IsGenerated"/> false means
/// this is a live preview; true means it is the stored snapshot.
/// </summary>
public sealed record OthersBillDto(
    Guid? Id,
    int Month,
    int Year,
    Guid ItemId,
    string ItemName,
    string Wing,
    decimal TotalAmount,
    int TotalConsumptionCount,
    decimal UnitRate,
    string? Notes,
    bool IsGenerated,
    DateTime? GeneratedAtUtc,
    /// <summary>Live count now, so the UI can flag a snapshot that has drifted.</summary>
    int CurrentConsumptionCount,
    bool HasDrifted,
    IReadOnlyList<OthersBillAllocationDto> Allocations);

public sealed record SaveOthersBillRequest(
    int Month, int Year, Guid ItemId, string? Wing, decimal TotalAmount, string? Notes);

/// <summary>One line of the student's Others Bill breakdown on their monthly bill.</summary>
public sealed record StudentOthersBillLineDto(
    Guid ItemId, string ItemName, int ConsumptionCount, decimal UnitRate, decimal Amount);
