namespace HallBackend.Application.Dtos;

public sealed record MealItemDto(Guid Id, string Name, decimal Cost);
public sealed record MealTypeDto(string Id, string Label, int Order, TimeOnly StartsAt, TimeOnly EndsAt);
public sealed record MealEntryDto(string MealTypeId, IReadOnlyList<MealItemDto> CommonItems, IReadOnlyList<MealItemDto> OptionalItems, string Status);
public sealed record MealDayDto(string Id, string Label, int Order, IReadOnlyList<MealEntryDto> Meals);
public sealed record MealSettingsDto(TimeOnly CutoffTime, IReadOnlyList<MealTypeDto> MealTypes, int ForecastMaxOptions);
public sealed record MealModuleDto(MealSettingsDto Settings, IReadOnlyList<MealDayDto> Days);
public sealed record UpdateCutoffRequest(TimeOnly CutoffTime);
public sealed record UpsertMealConfigurationRequest(string DayId, string MealTypeId, IReadOnlyList<MealItemInput> CommonItems, IReadOnlyList<MealItemInput> OptionalItems);
public sealed record MealItemInput(string Name, decimal Cost);
public sealed record SaveStudentMealPreferencesRequest(Dictionary<string, StudentMealPreferenceInput> Preferences);
public sealed record StudentMealPreferenceInput(bool Enabled, Guid? OptionItemId);
