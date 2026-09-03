namespace HallBackend.Application.Dtos;

/// <summary>
/// Describes the resolved state of the optional-item requirement for a student's meal on a date.
/// These are string constants (not an enum) so the JSON shape is stable and human-readable.
/// </summary>
public static class OptionSelectionState
{
    /// <summary>The meal has no optional items — nothing to select.</summary>
    public const string NotRequired = "not_required";
    /// <summary>The student has a valid saved selection that is still on the current menu.</summary>
    public const string Selected = "selected";
    /// <summary>Meal is ON and options exist, but the student has not selected one yet and cutoff has not passed.</summary>
    public const string SelectionRequired = "selection_required";
    /// <summary>Cutoff passed with no valid selection — admin-defined default was automatically assigned.</summary>
    public const string DefaultAssigned = "default_assigned";
}

public sealed record MealItemDto(Guid Id, string Name, decimal Cost, Guid? InventoryItemId = null, bool IsDefault = false);
public sealed record MealTypeDto(string Id, string Label, int Order, TimeOnly StartsAt, TimeOnly EndsAt);
public sealed record MealEntryDto(string MealTypeId, IReadOnlyList<MealItemDto> CommonItems, IReadOnlyList<MealItemDto> OptionalItems, string Status);
public sealed record MealDayDto(string Id, string Label, int Order, IReadOnlyList<MealEntryDto> Meals);
public sealed record MealSettingsDto(TimeOnly CutoffTime, IReadOnlyList<MealTypeDto> MealTypes, int ForecastMaxOptions);
public sealed record MealModuleDto(MealSettingsDto Settings, IReadOnlyList<MealDayDto> Days);
public sealed record MealCountOptionDto(Guid OptionItemId, string Name, decimal Cost, int StudentCount, bool IsDefault = false, int GuestCount = 0);
public sealed record MealCountDto(
    string MealTypeId,
    string MealTypeLabel,
    int TotalStudents,
    int EnabledStudents,
    int DisabledStudents,
    IReadOnlyList<MealCountOptionDto> OptionalChoices,
    int GuestCount = 0,
    int TotalMeals = 0);
/// <summary>
/// <paramref name="IsAvailable"/> is false only for a date the meal-decision window hasn't
/// reached yet — the zero counts on that response are not real counts, just placeholders, and
/// the client should say so rather than showing "0 students" as if that were known.
/// </summary>
public sealed record MealCountsForDateDto(DateOnly Date, string DayId, IReadOnlyList<MealCountDto> Meals, bool IsAvailable = true);
public sealed record UpdateCutoffRequest(TimeOnly CutoffTime, string? Wing = null);
public sealed record UpsertMealConfigurationRequest(
    string DayId,
    string MealTypeId,
    string? Wing,
    IReadOnlyList<MealItemInput> CommonItems,
    IReadOnlyList<MealItemInput> OptionalItems);
public sealed record MealItemInput(string Name, decimal Cost, Guid? InventoryItemId = null, bool IsDefault = false);
public sealed record AdminMealOptionChoiceDto(Guid Id, string Name, bool IsDefault = false);
/// <summary>Result DTO for the admin bulk apply-defaults endpoint.</summary>
public sealed record ApplyDefaultsResultDto(int AssignedCount, int SkippedCount, DateOnly TargetDate);
public sealed record AdminStudentMealStatusDto(
    string MealPeriod,
    bool IsOn,
    Guid? OptionItemId,
    string? OptionName,
    IReadOnlyList<AdminMealOptionChoiceDto> AvailableOptions,
    /// <summary>See <see cref="OptionSelectionState"/> — used by the admin UI to highlight pending selections.</summary>
    string OptionSelectionState = Dtos.OptionSelectionState.NotRequired);

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
    string HallName,
    bool BreakfastOn,
    bool LunchOn,
    bool DinnerOn,
    string? BreakfastOptionName,
    string? LunchOptionName,
    string? DinnerOptionName,
    int BreakfastGuestCount,
    int LunchGuestCount,
    int DinnerGuestCount,
    // Lets the admin Meal Sheet remove an individual guest meal request (e.g. once a student can
    // no longer remove it themselves past the booking cutoff) without a separate lookup call.
    Guid? BreakfastGuestMealId = null,
    Guid? LunchGuestMealId = null,
    Guid? DinnerGuestMealId = null);

/// <summary>See <see cref="MealCountsForDateDto.IsAvailable"/> — same meaning here.</summary>
public sealed record MealSheetDto(
    DateOnly Date,
    int TotalStudents,
    int BreakfastCount,
    int LunchCount,
    int DinnerCount,
    IReadOnlyList<MealSheetRowDto> Rows,
    bool IsAvailable = true);
