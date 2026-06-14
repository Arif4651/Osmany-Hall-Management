namespace HallBackend.Application.Dtos;

public sealed record MealItemDto(Guid Id, string Name, decimal Cost);
public sealed record MealTypeDto(string Id, string Label, int Order, TimeOnly StartsAt, TimeOnly EndsAt);
public sealed record MealEntryDto(string MealTypeId, IReadOnlyList<MealItemDto> CommonItems, IReadOnlyList<MealItemDto> OptionalItems, string Status);
public sealed record MealDayDto(string Id, string Label, int Order, IReadOnlyList<MealEntryDto> Meals);
public sealed record MealSettingsDto(TimeOnly CutoffTime, IReadOnlyList<MealTypeDto> MealTypes, int ForecastMaxOptions);
public sealed record MealModuleDto(MealSettingsDto Settings, IReadOnlyList<MealDayDto> Days);
public sealed record MealCountOptionDto(Guid OptionItemId, string Name, decimal Cost, int StudentCount);
public sealed record MealCountDto(
    string MealTypeId,
    string MealTypeLabel,
    int TotalStudents,
    int EnabledStudents,
    int DisabledStudents,
    IReadOnlyList<MealCountOptionDto> OptionalChoices);
public sealed record MealCountsForDateDto(DateOnly Date, string DayId, IReadOnlyList<MealCountDto> Meals);
public sealed record UpdateCutoffRequest(TimeOnly CutoffTime);
public sealed record UpsertMealConfigurationRequest(
    string DayId,
    string MealTypeId,
    string? Wing,
    IReadOnlyList<MealItemInput> CommonItems,
    IReadOnlyList<MealItemInput> OptionalItems);
public sealed record MealItemInput(string Name, decimal Cost);
public sealed record AdminMealOptionChoiceDto(Guid Id, string Name);
public sealed record AdminStudentMealStatusDto(
    string MealPeriod,
    bool IsOn,
    Guid? OptionItemId,
    string? OptionName,
    IReadOnlyList<AdminMealOptionChoiceDto> AvailableOptions);

// Global meal override DTOs
public sealed record GlobalMealOverrideDto(
    Guid Id,
    string Wing,
    string MealPeriod,
    DateOnly EffectiveFrom,
    DateOnly EffectiveTo,
    bool IsOn,
    string? Note,
    DateTime CreatedAtUtc);

public sealed record SetGlobalMealOverrideRequest(
    string? Wing,
    string MealPeriod,
    DateOnly EffectiveFrom,
    DateOnly EffectiveTo,
    bool IsOn,
    string? Note);

// Guest meal DTOs
public sealed record GuestMealRequestDto(
    Guid Id,
    string MealPeriod,
    DateOnly Date,
    int GuestCount,
    DateTime CreatedAtUtc);

public sealed record SaveGuestMealRequest(
    string MealPeriod,
    DateOnly Date,
    int GuestCount);

public sealed record MealSheetRowDto(
    string HallId,
    string StudentId,
    string Name,
    string Room,
    string Gender,
    bool BreakfastOn,
    bool LunchOn,
    bool DinnerOn,
    string? BreakfastOptionName,
    string? LunchOptionName,
    string? DinnerOptionName,
    int BreakfastGuestCount,
    int LunchGuestCount,
    int DinnerGuestCount);

public sealed record MealSheetDto(
    DateOnly Date,
    int TotalStudents,
    int BreakfastCount,
    int LunchCount,
    int DinnerCount,
    IReadOnlyList<MealSheetRowDto> Rows);
