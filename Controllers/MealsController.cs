using HallBackend.Application.Dtos;
using HallBackend.Application.Services;
using HallBackend.Domain.Constants;
using HallBackend.Domain.Entities;
using HallBackend.Infrastructure.Data;
using HallBackend.Infrastructure.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Controllers;

[ApiController]
[Authorize]
[Route("api/meals")]
public sealed class MealsController(
    HallDbContext db,
    CurrentUserService currentUser,
    MealHistoryService history,
    BillingCalculationService billing) : ControllerBase
{
    [HttpGet("module")]
    public async Task<ActionResult<MealModuleDto>> GetModule([FromQuery] string? wing, CancellationToken cancellationToken)
    {
        var selectedWing = await currentUser.GetMealWingAsync(wing, cancellationToken);
        // Prefer the wing-specific row; fall back to any available row if one hasn't been seeded yet.
        var setting = await db.MealSettings.AsNoTracking()
            .Where(x => x.Wing == selectedWing)
            .OrderBy(x => x.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken)
            ?? await db.MealSettings.AsNoTracking().OrderBy(x => x.CreatedAtUtc).FirstOrDefaultAsync(cancellationToken)
            ?? new MealSetting { Wing = selectedWing };
        var mealTypes = await db.MealTypes.AsNoTracking().OrderBy(x => x.SortOrder).ToListAsync(cancellationToken);
        var days = await db.MealDays.AsNoTracking()
            .OrderBy(x => x.SortOrder)
            .Select(day => new MealDayDto(
                day.Code,
                day.Label,
                day.SortOrder,
                day.Configurations
                    .Where(config => config.Wing == selectedWing)
                    .OrderBy(config => config.MealType!.SortOrder)
                    .Select(config => new MealEntryDto(
                        config.MealType!.Code,
                        config.Items
                            .Where(item => !item.IsOptional)
                            .Select(item => new MealItemDto(item.InventoryItemId ?? item.Id, item.Name, item.Cost, item.InventoryItemId))
                            .ToList(),
                        config.Items
                            .Where(item => item.IsOptional
                                && item.InventoryItem != null
                                && item.InventoryItem.Category == "Options"
                                && !item.InventoryItem.IsDeleted)
                            .Select(item => new MealItemDto(item.InventoryItemId!.Value, item.Name, item.Cost, item.InventoryItemId, item.IsDefault))
                            .ToList(),
                        config.Status))
                    .ToList()))
            .ToListAsync(cancellationToken);

        return new MealModuleDto(
            new MealSettingsDto(setting.CutoffTime, mealTypes.Select(x => new MealTypeDto(x.Code, x.Label, x.SortOrder, x.StartsAt, x.EndsAt)).ToList(), setting.ForecastMaxOptions),
            days);
    }

    [HttpPut("settings/cutoff")]
    [RequirePermission(MenuKeys.AdminMeals, PermissionActions.Edit)]
    public async Task<ActionResult<MealModuleDto>> UpdateCutoff(UpdateCutoffRequest request, CancellationToken cancellationToken)
    {
        var selectedWing = await currentUser.GetMealWingAsync(request.Wing, cancellationToken);
        var setting = await db.MealSettings
            .Where(x => x.Wing == selectedWing)
            .OrderBy(x => x.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
        if (setting is null)
        {
            setting = new MealSetting { Wing = selectedWing };
            db.MealSettings.Add(setting);
        }
        setting.CutoffTime = request.CutoffTime;
        await db.SaveChangesAsync(cancellationToken);
        return await GetModule(selectedWing, cancellationToken);
    }

    [HttpPut("configuration")]
    [RequirePermission(MenuKeys.AdminMeals, PermissionActions.Edit)]
    public async Task<ActionResult<MealModuleDto>> UpsertConfiguration(UpsertMealConfigurationRequest request, CancellationToken cancellationToken)
    {
        var day = await db.MealDays.FirstOrDefaultAsync(x => x.Code == request.DayId, cancellationToken);
        var type = await db.MealTypes.FirstOrDefaultAsync(x => x.Code == request.MealTypeId, cancellationToken);
        if (day is null || type is null) return NotFound(new { message = "Meal day or type was not found." });
        var selectedWing = await currentUser.GetMealWingAsync(request.Wing, cancellationToken);

        var config = await db.MealConfigurations.Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.MealDayId == day.Id && x.MealTypeId == type.Id && x.Wing == selectedWing, cancellationToken);

        if (config is null)
        {
            config = new MealConfiguration { MealDayId = day.Id, MealTypeId = type.Id, Wing = selectedWing };
            db.MealConfigurations.Add(config);
        }

        if (config.Items.Count > 0)
        {
            db.MealItems.RemoveRange(config.Items);
        }

        var inputs = request.CommonItems
            .Where(x => x.InventoryItemId.HasValue || !string.IsNullOrWhiteSpace(x.Name))
            .Select(x => (Input: x, Category: "Common", IsOptional: false))
            .Concat(request.OptionalItems
                .Where(x => x.InventoryItemId.HasValue || !string.IsNullOrWhiteSpace(x.Name))
                .Select(x => (Input: x, Category: "Options", IsOptional: true)))
            .ToList();
        // At most one optional item may be the admin-defined default for this configuration.
        var defaultCount = inputs.Count(x => x.IsOptional && x.Input.IsDefault);
        if (defaultCount > 1)
            return BadRequest(new { message = "Only one optional item can be marked as the default fallback." });
        var duplicate = inputs
            .GroupBy(x => x.Input.InventoryItemId.HasValue
                ? $"id:{x.Input.InventoryItemId.Value}"
                : $"name:{ItemCatalogService.NormalizeName(x.Input.Name)}")
            .FirstOrDefault(x => x.Count() > 1);
        if (duplicate is not null)
        {
            var duplicateName = duplicate.First().Input.Name?.Trim();
            return BadRequest(new { message = $"{(string.IsNullOrWhiteSpace(duplicateName) ? "This item" : duplicateName)} is listed more than once." });
        }

        var inventoryItems = await db.InventoryItems.AsNoTracking()
            .Where(x => !x.IsDeleted
                && x.Wing == selectedWing
                && (x.Category == "Common" || x.Category == "Options"))
            .ToListAsync(cancellationToken);
        var inventoryById = inventoryItems.ToDictionary(x => x.Id);
        var inventoryByCategoryAndName = inventoryItems
            .GroupBy(x => (x.Category, Name: ItemCatalogService.NormalizeName(x.Item)))
            .ToDictionary(x => x.Key, x => x.First());

        var resolvedInputs = new List<(MealItemInput Input, bool IsOptional, InventoryItem? InventoryItem)>();
        foreach (var entry in inputs)
        {
            InventoryItem? inventoryItem = null;
            if (entry.Input.InventoryItemId.HasValue)
            {
                if (!inventoryById.TryGetValue(entry.Input.InventoryItemId.Value, out inventoryItem))
                {
                    return BadRequest(new { message = "Selected inventory item was not found in this wing." });
                }
                if (inventoryItem.Category != entry.Category)
                {
                    return BadRequest(new
                    {
                        message = $"{inventoryItem.Item} belongs to {inventoryItem.Category}, not {entry.Category}.",
                    });
                }
            }
            else
            {
                inventoryByCategoryAndName.TryGetValue(
                    (entry.Category, ItemCatalogService.NormalizeName(entry.Input.Name)),
                    out inventoryItem);
            }
            if (entry.IsOptional && inventoryItem is null)
            {
                return BadRequest(new
                {
                    message = $"{entry.Input.Name.Trim()} must be an active inventory item in the Options category before it can be used as an optional meal choice.",
                });
            }
            resolvedInputs.Add((entry.Input, entry.IsOptional, inventoryItem));
        }

        var nextItems = new List<MealItem>();
        foreach (var entry in resolvedInputs)
        {
            nextItems.Add(new MealItem
            {
                MealConfigurationId = config.Id,
                InventoryItemId = entry.InventoryItem?.Id,
                Name = entry.InventoryItem?.Item ?? entry.Input.Name.Trim(),
                Cost = Math.Max(0m, entry.Input.Cost),
                IsOptional = entry.IsOptional,
                IsDefault = entry.IsOptional && entry.Input.IsDefault,
            });
        }

        db.MealItems.AddRange(nextItems);
        await db.SaveChangesAsync(cancellationToken);
        return await GetModule(selectedWing, cancellationToken);
    }

    [HttpGet("counts")]
    [RequirePermission(MenuKeys.AdminMeals, PermissionActions.View)]
    public async Task<ActionResult<MealCountsForDateDto>> GetMealCounts(
        [FromQuery] DateOnly? date, [FromQuery] string? wing, CancellationToken cancellationToken)
    {
        var target = date ?? HallClock.Today.AddDays(1);
        var selectedWing = await currentUser.GetMealWingAsync(wing, cancellationToken);
        var mealTypes = await db.MealTypes.AsNoTracking()
            .OrderBy(x => x.SortOrder)
            .ToListAsync(cancellationToken);

        var isFuture = target > HallClock.Today.AddDays(1);
        var dayCode = target.DayOfWeek.ToString()[..3].ToLowerInvariant();

        if (isFuture)
        {
            var emptyCounts = mealTypes.Select(type => new MealCountDto(
                type.Code,
                type.Label,
                0, // TotalStudents
                0, // EnabledStudents
                0, // DisabledStudents
                new List<MealCountOptionDto>()
            )).ToList();
            return new MealCountsForDateDto(target, dayCode, emptyCounts, IsAvailable: false);
        }

        var activeStudents = await db.Students.AsNoTracking()
            .Where(x => x.Status == MealResolutionContext.BillableStatus && x.Gender == selectedWing)
            .ToListAsync(cancellationToken);
        var activeStudentIds = activeStudents.Select(x => x.Id).ToList();
        var statuses = await db.MealStatusHistory.AsNoTracking()
            .Where(x => activeStudentIds.Contains(x.StudentId)
                && x.EffectiveFrom <= target
                && (x.EffectiveTo == null || x.EffectiveTo >= target))
            .ToListAsync(cancellationToken);
        var overrides = await db.GlobalMealOverrides.AsNoTracking()
            .Where(x => x.Wing == selectedWing
                && x.EffectiveFrom <= target
                && x.EffectiveTo >= target)
            .ToListAsync(cancellationToken);
        var preferences = await db.MealPreferenceHistory.AsNoTracking()
            .Where(x => activeStudentIds.Contains(x.StudentId)
                && x.DayOfWeek == target.DayOfWeek
                && x.EffectiveFrom <= target
                && (x.EffectiveTo == null || x.EffectiveTo >= target))
            .ToListAsync(cancellationToken);
        var guestMeals = await db.GuestMealRequests.AsNoTracking()
            .Where(x => activeStudentIds.Contains(x.StudentId) && x.Date == target)
            .ToListAsync(cancellationToken);
        var optionItems = await db.InventoryItems.AsNoTracking()
            .Where(x => x.Category == "Options" && !x.IsDeleted && x.Wing == selectedWing)
            .ToDictionaryAsync(x => x.Id, cancellationToken);
        var menuConfigurations = await db.MealConfigurations.AsNoTracking()
            .Include(x => x.MealDay)
            .Include(x => x.MealType)
            .Include(x => x.Items)
            .Where(x => x.MealDay!.Code == dayCode && x.Wing == selectedWing)
            .ToListAsync(cancellationToken);

        var earliest = await GetEarliestStudentChangeDateAsync(selectedWing, cancellationToken);
        var isCutoffPassed = target < earliest;

        var counts = mealTypes.Select(type =>
        {
            var enabledStudents = activeStudents
                .Where(student => MealHistoryService.GetEffectiveStatus(
                    student.Id,
                    student.Gender,
                    type.Code,
                    target,
                    statuses,
                    overrides))
                .Select(student => student.Id)
                .ToList();

            var periodGuestMeals = guestMeals
                .Where(x => string.Equals(x.MealPeriod, type.Code, StringComparison.OrdinalIgnoreCase))
                .ToList();
            var totalGuests = periodGuestMeals.Sum(x => x.GuestCount);

            var menuConfig = menuConfigurations.FirstOrDefault(x => x.MealType!.Code == type.Code);
            var optionalItems = menuConfig?.Items
                .Where(x => x.IsOptional && x.InventoryItemId.HasValue && optionItems.ContainsKey(x.InventoryItemId.Value))
                .ToList() ?? [];

            var availableOptionIds = optionalItems.Select(x => x.InventoryItemId!.Value).ToHashSet();
            var defaultOptionId = optionalItems.FirstOrDefault(x => x.IsDefault)?.InventoryItemId;

            var studentPreferences = preferences
                .Where(x => x.MealPeriod == type.Code)
                .GroupBy(x => x.StudentId)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.EffectiveFrom).First().OptionItemId);

            Guid? ResolveOptionForStudent(Guid studentId)
            {
                var prefId = studentPreferences.GetValueOrDefault(studentId);
                if (prefId.HasValue && availableOptionIds.Contains(prefId.Value))
                {
                    return prefId.Value;
                }
                if (isCutoffPassed && defaultOptionId.HasValue)
                {
                    return defaultOptionId.Value;
                }
                return null;
            }

            var resolvedOptionCounts = new Dictionary<Guid, int>();
            var resolvedOptionGuestCounts = new Dictionary<Guid, int>();
            foreach (var studentId in enabledStudents)
            {
                var resolvedId = ResolveOptionForStudent(studentId);
                if (resolvedId.HasValue)
                {
                    resolvedOptionCounts[resolvedId.Value] = resolvedOptionCounts.GetValueOrDefault(resolvedId.Value) + 1;
                }
            }

            foreach (var guest in periodGuestMeals)
            {
                var resolvedId = ResolveOptionForStudent(guest.StudentId);
                if (resolvedId.HasValue)
                {
                    resolvedOptionCounts[resolvedId.Value] = resolvedOptionCounts.GetValueOrDefault(resolvedId.Value) + guest.GuestCount;
                    resolvedOptionGuestCounts[resolvedId.Value] = resolvedOptionGuestCounts.GetValueOrDefault(resolvedId.Value) + guest.GuestCount;
                }
            }

            var configuredOptionIds = optionalItems
                .Select(x => x.InventoryItemId!.Value)
                .Concat(resolvedOptionCounts.Keys)
                .Distinct()
                .ToList();
            var configuredOptionCosts = optionalItems
                .GroupBy(x => x.InventoryItemId!.Value)
                .ToDictionary(x => x.Key, x => x.First().Cost);

            var choices = configuredOptionIds
                .Select(optionId =>
                {
                    var option = optionItems[optionId];
                    var isDef = defaultOptionId.HasValue && defaultOptionId.Value == optionId;
                    return new MealCountOptionDto(
                        option.Id,
                        option.Item,
                        configuredOptionCosts.GetValueOrDefault(optionId),
                        resolvedOptionCounts.GetValueOrDefault(optionId),
                        isDef,
                        resolvedOptionGuestCounts.GetValueOrDefault(optionId));
                })
                .OrderByDescending(x => x.StudentCount)
                .ThenBy(x => x.Name)
                .ToList();

            var totalMeals = enabledStudents.Count + totalGuests;

            return new MealCountDto(
                type.Code,
                type.Label,
                activeStudents.Count,
                enabledStudents.Count,
                activeStudents.Count - enabledStudents.Count,
                choices,
                totalGuests,
                totalMeals);
        }).ToList();

        return new MealCountsForDateDto(target, dayCode, counts);
    }

    [HttpGet("student-controls/{studentRecordId:guid}")]
    [RequirePermission(MenuKeys.AdminMeals, PermissionActions.View)]
    public async Task<ActionResult<AdminStudentMealControlDto>> GetStudentMealControl(
        Guid studentRecordId,
        [FromQuery] DateOnly? date,
        [FromQuery] string? wing,
        CancellationToken cancellationToken)
    {
        var target = date ?? HallClock.Today.AddDays(1);
        var selectedWing = await currentUser.GetManagedWingAsync(wing, cancellationToken);
        var student = await db.Students.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == studentRecordId && x.Gender == selectedWing, cancellationToken);

        if (student is null)
            return NotFound(new { message = "Student was not found in the selected wing." });
        if (!string.Equals(student.Status, MealResolutionContext.BillableStatus, StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Only active students can be managed from meal controls." });

        return await BuildStudentMealControlAsync(student, selectedWing, target, cancellationToken);
    }

    [HttpPut("student-controls/status")]
    [RequirePermission(MenuKeys.AdminMeals, PermissionActions.Edit)]
    public async Task<ActionResult<AdminStudentMealControlDto>> SaveStudentMealControlStatus(
        SaveAdminStudentMealStatusRequest request,
        CancellationToken cancellationToken)
    {
        if (!MealHistoryService.MealPeriods.Contains(request.MealPeriod))
            return BadRequest(new { message = "Invalid meal period." });

        var today = HallClock.Today;
        if (request.EffectiveFrom < today)
            return BadRequest(new { message = "Meal changes can only be applied for today or future dates." });

        var selectedWing = await currentUser.GetManagedWingAsync(request.Wing, cancellationToken);
        var student = await db.Students
            .FirstOrDefaultAsync(x => x.Id == request.StudentRecordId && x.Gender == selectedWing, cancellationToken);

        if (student is null)
            return NotFound(new { message = "Student was not found in the selected wing." });
        if (!string.Equals(student.Status, MealResolutionContext.BillableStatus, StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Only active students can be managed from meal controls." });

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            // Use AdminForceStatusAsync so today's meal can be changed even when a future status exists.
            await history.AdminForceStatusAsync(student.Id, request.MealPeriod, request.IsOn, request.EffectiveFrom, cancellationToken);
            await AdminForceOptionPreferenceAsync(student.Id, selectedWing, request.MealPeriod, request.OptionItemId, request.EffectiveFrom, cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            // This changes who is billed for the meal, same as a student's own preference change —
            // without this the admin's change never reaches any bill.
            await billing.RecalculateForwardAsync(request.EffectiveFrom.Month, request.EffectiveFrom.Year, cancellationToken);
            return await BuildStudentMealControlAsync(student, selectedWing, request.EffectiveFrom, cancellationToken);
        }
        catch (InvalidOperationException ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("options")]
    [RequirePermission(MenuKeys.StudentMeals, PermissionActions.View, AltMenuKey = MenuKeys.AdminMeals)]
    public async Task<IReadOnlyList<MenuOptionDto>> GetOptions(CancellationToken cancellationToken)
    {
        // Wing-scoped: an unfiltered list let a student read the other wing's option item ids,
        // which SaveMyPreferences would (before H6) accept without checking they belonged to the
        // caller's own wing.
        var wing = await currentUser.GetMealWingAsync(null, cancellationToken);
        var items = await db.MealItems.AsNoTracking()
            .Where(x => x.IsOptional && x.InventoryItemId.HasValue
                && x.InventoryItem != null && !x.InventoryItem.IsDeleted
                && x.InventoryItem.Wing == wing)
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);
        return items
            .GroupBy(x => x.InventoryItemId!.Value)
            .Select(x => x.OrderByDescending(y => y.UpdatedAtUtc ?? y.CreatedAtUtc).First())
            .Select(x => new MenuOptionDto(x.InventoryItemId!.Value, x.Name, x.Cost))
            .OrderBy(x => x.Name)
            .ToList();
    }

    // Removed "debug-preferences": an unmaintained diagnostic endpoint with no frontend caller
    // that dumped a named student's full preference history and internal ids.

    [HttpGet("preferences/me")]
    [RequirePermission(MenuKeys.StudentMeals, PermissionActions.View)]
    public async Task<ActionResult<IReadOnlyList<MealPreferenceStateDto>>> GetMyPreferences(
        [FromQuery] DateOnly? date, CancellationToken cancellationToken)
    {
        var studentId = await currentUser.GetStudentIdAsync(cancellationToken);
        var target = date ?? HallClock.Today;
        var wing = await db.Students.AsNoTracking()
            .Where(x => x.Id == studentId)
            .Select(x => x.Gender)
            .FirstOrDefaultAsync(cancellationToken) ?? string.Empty;
        var statuses = await db.MealStatusHistory.AsNoTracking()
            .Where(x => x.StudentId == studentId && x.EffectiveFrom <= target && (x.EffectiveTo == null || x.EffectiveTo >= target))
            .ToListAsync(cancellationToken);
        var overrides = await db.GlobalMealOverrides.AsNoTracking()
            .Where(x => x.Wing == wing && x.EffectiveFrom <= target && x.EffectiveTo >= target)
            .ToListAsync(cancellationToken);
        var preferences = await db.MealPreferenceHistory.AsNoTracking()
            .Where(x => x.StudentId == studentId && x.DayOfWeek == target.DayOfWeek && x.EffectiveFrom <= target && (x.EffectiveTo == null || x.EffectiveTo >= target))
            .ToListAsync(cancellationToken);
        var optionNames = await db.InventoryItems.AsNoTracking()
            .Where(x => x.Category == "Options" && !x.IsDeleted)
            .ToDictionaryAsync(x => x.Id, x => x.Item, cancellationToken);

        // Load current day's menu to know which optional items are available and which is the default.
        var dayCode = target.DayOfWeek.ToString()[..3].ToLowerInvariant();
        var menuConfigs = await db.MealConfigurations.AsNoTracking()
            .Include(x => x.MealDay)
            .Include(x => x.MealType)
            .Include(x => x.Items)
            .ThenInclude(x => x.InventoryItem)
            .Where(x => x.Wing == wing && x.MealDay!.Code == dayCode)
            .ToListAsync(cancellationToken);

        // Determine whether cutoff has already passed for the effective date.
        var earliest = await GetEarliestStudentChangeDateAsync(wing, cancellationToken);
        var isCutoffPassed = target < earliest;

        // Eagerly track whether we need to write any defaults so we can save once.
        var wroteDefault = false;
        var resolvedResults = new List<(string Period, bool IsOn, Guid? OptionItemId, string? OptionName, string State)>();

        foreach (var period in MealHistoryService.MealPeriods)
        {
            var isOn = MealHistoryService.GetEffectiveStatus(studentId, wing, period, target, statuses, overrides);

            // Optional items available in today's configured menu for this period.
            var menuOptional = menuConfigs
                .Where(x => x.MealType!.Code == period)
                .SelectMany(x => x.Items)
                .Where(x => x.IsOptional && x.InventoryItemId.HasValue
                    && x.InventoryItem != null && !x.InventoryItem.IsDeleted)
                .ToList();

            if (!isOn || menuOptional.Count == 0)
            {
                // No selection needed — either meal is off or there are no optional items.
                resolvedResults.Add((period, isOn, null, null, OptionSelectionState.NotRequired));
                continue;
            }

            var savedPref = preferences.Where(x => x.MealPeriod == period)
                .OrderByDescending(x => x.EffectiveFrom)
                .FirstOrDefault();
            var savedOptionId = savedPref?.OptionItemId;
            var savedOptionIsValid = savedOptionId.HasValue
                && menuOptional.Any(x => x.InventoryItemId == savedOptionId);

            if (savedOptionIsValid)
            {
                // Student has a valid saved selection that is still on the current menu.
                resolvedResults.Add((period, isOn, savedOptionId, optionNames.GetValueOrDefault(savedOptionId!.Value), OptionSelectionState.Selected));
                continue;
            }

            if (!isCutoffPassed)
            {
                // Cutoff has not passed — show the selection-required state; student can still choose.
                resolvedResults.Add((period, isOn, null, null, OptionSelectionState.SelectionRequired));
                continue;
            }

            // Cutoff has passed with no valid selection — apply the admin-defined default.
            var defaultItem = menuOptional.FirstOrDefault(x => x.IsDefault);
            if (defaultItem is not null)
            {
                await history.SetPreferenceAsync(studentId, period, defaultItem.InventoryItemId, target, cancellationToken);
                wroteDefault = true;
                resolvedResults.Add((period, isOn, defaultItem.InventoryItemId, optionNames.GetValueOrDefault(defaultItem.InventoryItemId!.Value), OptionSelectionState.DefaultAssigned));
            }
            else
            {
                // No admin default configured — remain in selection-required so admin is alerted.
                resolvedResults.Add((period, isOn, null, null, OptionSelectionState.SelectionRequired));
            }
        }

        if (wroteDefault)
        {
            await db.SaveChangesAsync(cancellationToken);
            // Recalculate bills forward so the newly assigned default is reflected in billing.
            await billing.RecalculateForwardAsync(target.Month, target.Year, cancellationToken);
        }

        return resolvedResults.Select(r => new MealPreferenceStateDto(
            r.Period, r.IsOn, r.OptionItemId, r.OptionName,
            GuestCount: 0, OptionSelectionState: r.State)).ToList();
    }

    [HttpPut("preferences/me")]
    [RequirePermission(MenuKeys.StudentMeals, PermissionActions.Edit)]
    public async Task<ActionResult<IReadOnlyList<MealPreferenceStateDto>>> SaveMyPreferences(
        SaveMealPreferenceStateRequest request, CancellationToken cancellationToken)
    {
        var studentId = await currentUser.GetStudentIdAsync(cancellationToken);
        var wing = await db.Students.AsNoTracking()
            .Where(x => x.Id == studentId)
            .Select(x => x.Gender)
            .FirstOrDefaultAsync(cancellationToken) ?? string.Empty;
        var earliest = await GetEarliestStudentChangeDateAsync(wing, cancellationToken);
        if (request.EffectiveFrom < earliest)
            return BadRequest(new { message = $"Meal changes can be applied from {earliest:yyyy-MM-dd}." });
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            foreach (var meal in request.Meals)
            {
                await history.SetStatusAsync(studentId, meal.MealPeriod, meal.IsOn, request.EffectiveFrom, cancellationToken);
                // Validates the choice is an active Options item of the student's own wing and
                // present on that day's configured menu — calling history.SetPreferenceAsync
                // directly (as this used to) skipped that check entirely, so a student could pick
                // any active Options item including the other wing's, and be charged for none of
                // it since Participants only ever considers students in the item's own wing.
                await SaveStudentOptionPreferenceAsync(studentId, wing, meal.MealPeriod, meal.OptionItemId, request.EffectiveFrom, cancellationToken);
            }
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            await billing.RecalculateForwardAsync(request.EffectiveFrom.Month, request.EffectiveFrom.Year, cancellationToken);
            return await GetMyPreferences(request.EffectiveFrom, cancellationToken);
        }
        catch (InvalidOperationException ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("preferences/me/off-range")]
    [RequirePermission(MenuKeys.StudentMeals, PermissionActions.Edit)]
    public async Task<ActionResult> SaveMyMealOffRange(
        SaveMealOffRangeRequest request, CancellationToken cancellationToken)
    {
        var studentId = await currentUser.GetStudentIdAsync(cancellationToken);
        var wing = await db.Students.AsNoTracking()
            .Where(x => x.Id == studentId)
            .Select(x => x.Gender)
            .FirstOrDefaultAsync(cancellationToken) ?? string.Empty;
        var earliest = await GetEarliestStudentChangeDateAsync(wing, cancellationToken);
        if (request.From < earliest)
            return BadRequest(new { message = $"Meal-off ranges can start from {earliest:yyyy-MM-dd}." });
        if (request.To < request.From)
            return BadRequest(new { message = "The end date must be on or after the start date." });
        if (request.To.DayNumber - request.From.DayNumber > 366)
            return BadRequest(new { message = "A meal-off range cannot exceed one year." });
        var periods = request.MealPeriods.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        if (periods.Count == 0 || periods.Any(x => !MealHistoryService.MealPeriods.Contains(x)))
            return BadRequest(new { message = "Select at least one valid meal period." });

        var restoreDate = request.To.AddDays(1);
        var previousDate = request.From.AddDays(-1);
        var previous = await db.MealStatusHistory.AsNoTracking()
            .Where(x => x.StudentId == studentId
                && periods.Contains(x.MealPeriod)
                && x.EffectiveFrom <= previousDate
                && (x.EffectiveTo == null || x.EffectiveTo >= previousDate))
            .ToListAsync(cancellationToken);

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            foreach (var period in periods)
            {
                await history.SetStatusAsync(studentId, period, false, request.From, cancellationToken);
            }
            await db.SaveChangesAsync(cancellationToken);

            foreach (var period in periods)
            {
                var wasOn = previous
                    .Where(x => x.MealPeriod == period)
                    .OrderByDescending(x => x.EffectiveFrom)
                    .FirstOrDefault()?.IsOn ?? false;
                await history.SetStatusAsync(studentId, period, wasOn, restoreDate, cancellationToken);
            }
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            await billing.RecalculateForwardAsync(request.From.Month, request.From.Year, cancellationToken);
            return Ok(new { message = "Meal-off range saved successfully." });
        }
        catch (InvalidOperationException ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("snapshot/me")]
    [RequirePermission(MenuKeys.StudentMealSnapshot, PermissionActions.View)]
    public async Task<ActionResult<IReadOnlyList<MealSnapshotRowDto>>> GetMySnapshot(
        [FromQuery] DateOnly from, [FromQuery] DateOnly to, CancellationToken cancellationToken)
    {
        if (from > to || to.DayNumber - from.DayNumber > 366)
            return BadRequest(new { message = "Select a valid date range of up to one year." });
        var studentId = await currentUser.GetStudentIdAsync(cancellationToken);
        var wing = await db.Students.AsNoTracking()
            .Where(x => x.Id == studentId)
            .Select(x => x.Gender)
            .FirstOrDefaultAsync(cancellationToken) ?? string.Empty;
        var statuses = await db.MealStatusHistory.AsNoTracking()
            .Where(x => x.StudentId == studentId && x.EffectiveFrom <= to && (x.EffectiveTo == null || x.EffectiveTo >= from))
            .ToListAsync(cancellationToken);
        var overrides = await db.GlobalMealOverrides.AsNoTracking()
            .Where(x => x.Wing == wing && x.EffectiveFrom <= to && x.EffectiveTo >= from)
            .ToListAsync(cancellationToken);
        var preferences = await db.MealPreferenceHistory.AsNoTracking()
            .Where(x => x.StudentId == studentId && x.EffectiveFrom <= to && (x.EffectiveTo == null || x.EffectiveTo >= from))
            .ToListAsync(cancellationToken);
        var optionNames = await db.InventoryItems.AsNoTracking()
            .Where(x => x.Category == "Options" && !x.IsDeleted)
            .ToDictionaryAsync(x => x.Id, x => x.Item, cancellationToken);

        var guestMeals = await db.GuestMealRequests.AsNoTracking()
            .Where(x => x.StudentId == studentId && x.Date >= from && x.Date <= to)
            .ToListAsync(cancellationToken);

        // Pre-group/index status, preference, and guest meals lists to avoid O(N) linear scans inside loop
        var statusesGrouped = statuses
            .GroupBy(x => x.MealPeriod)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.EffectiveFrom).ToList());

        var preferencesGrouped = preferences
            .GroupBy(x => new { x.MealPeriod, x.DayOfWeek })
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.EffectiveFrom).ToList());

        var guestMealsLookup = guestMeals
            .ToDictionary(x => new { x.Date, x.MealPeriod }, x => x.GuestCount);

        var rows = new List<MealSnapshotRowDto>();
        for (var date = from; date <= to; date = date.AddDays(1))
        {
            var dateVal = date;
            rows.Add(new MealSnapshotRowDto(dateVal, MealHistoryService.MealPeriods.Select(period =>
            {
                MealPreferenceHistory? preference = null;
                if (preferencesGrouped.TryGetValue(new { MealPeriod = period, DayOfWeek = dateVal.DayOfWeek }, out var prefsList))
                {
                    preference = prefsList.FirstOrDefault(x => x.EffectiveFrom <= dateVal && (x.EffectiveTo == null || x.EffectiveTo >= dateVal));
                }

                var guestCount = guestMealsLookup.GetValueOrDefault(new { Date = dateVal, MealPeriod = period });

                var statusList = statusesGrouped.GetValueOrDefault(period) ?? [];
                var isOn = MealHistoryService.GetEffectiveStatus(studentId, wing, period, dateVal, statusList, overrides);

                return new MealPreferenceStateDto(
                    period,
                    isOn,
                    preference?.OptionItemId,
                    optionNames.GetValueOrDefault(preference?.OptionItemId ?? Guid.Empty),
                    guestCount,
                    // Snapshot is historical — we don't recompute state here, just report Selected
                    // if an option was saved, NotRequired otherwise.
                    OptionSelectionState: preference?.OptionItemId.HasValue == true
                        ? OptionSelectionState.Selected
                        : OptionSelectionState.NotRequired);
            }).ToList()));
        }
        return rows;
    }

    // Removed: GET/PUT "menu" once flattened every day and both wings' configurations into one
    // (a PUT here overwrote all fourteen day/wing combinations with the same items, zeroing
    // their display costs in the process). The frontend never called it — it already uses
    // GET /api/meals/module and PUT /api/meals/configuration, which are day- and wing-scoped.

    // ── Global Meal Overrides (Admin) ─────────────────────────────────────────

    [HttpGet("overrides")]
    [RequirePermission(MenuKeys.AdminMeals, PermissionActions.View)]
    public async Task<IReadOnlyList<GlobalMealOverrideDto>> GetOverrides(
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] string? wing, CancellationToken cancellationToken)
    {
        var queryFrom = from ?? HallClock.Today;
        var queryTo = to ?? queryFrom.AddMonths(3);
        var selectedWing = await currentUser.GetMealWingAsync(wing, cancellationToken);
        return await db.GlobalMealOverrides.AsNoTracking()
            .Where(x => x.Wing == selectedWing && x.EffectiveTo >= queryFrom && x.EffectiveFrom <= queryTo)
            .OrderBy(x => x.EffectiveFrom).ThenBy(x => x.MealPeriod)
            .Select(x => new GlobalMealOverrideDto(x.Id, x.Wing, x.MealPeriod, x.EffectiveFrom, x.EffectiveTo, x.IsOn, x.Note, x.CreatedAtUtc))
            .ToListAsync(cancellationToken);
    }

    [HttpPost("overrides")]
    [RequirePermission(MenuKeys.AdminMeals, PermissionActions.Create)]
    public async Task<ActionResult<GlobalMealOverrideDto>> CreateOverride(
        SetGlobalMealOverrideRequest request, CancellationToken cancellationToken)
    {
        if (!MealHistoryService.MealPeriods.Contains(request.MealPeriod))
            return BadRequest(new { message = "Invalid meal period." });
        if (request.EffectiveTo < request.EffectiveFrom)
            return BadRequest(new { message = "End date must be on or after start date." });
        if (request.EffectiveTo.DayNumber - request.EffectiveFrom.DayNumber > 366)
            return BadRequest(new { message = "Override cannot span more than one year." });
        var today = HallClock.Today;
        if (request.EffectiveFrom < today)
            return BadRequest(new { message = "Overrides can only start today or in the future — a past date has already been billed." });
        var selectedWing = await currentUser.GetMealWingAsync(request.Wing, cancellationToken);

        var overlapping = await db.GlobalMealOverrides
            .Where(x => x.Wing == selectedWing
                && x.MealPeriod == request.MealPeriod
                && x.EffectiveTo >= request.EffectiveFrom
                && x.EffectiveFrom <= request.EffectiveTo)
            .ToListAsync(cancellationToken);

        // Truncate overlapping rows to the boundary rather than deleting them outright — a row
        // is only ever removed here when the new range fully contains it, and since the new
        // range cannot start before today (checked above), a fully-contained row cannot reach
        // into the past either. A row that starts before the new range keeps its earlier days; a
        // row surrounding the new range is split so both its outer edges survive.
        foreach (var row in overlapping)
        {
            var startsBefore = row.EffectiveFrom < request.EffectiveFrom;
            var endsAfter = row.EffectiveTo > request.EffectiveTo;

            if (startsBefore && endsAfter)
            {
                // The new range sits entirely inside this one: keep the left remainder on the
                // existing row and add a new row for the right remainder.
                var rightRemainderTo = row.EffectiveTo;
                row.EffectiveTo = request.EffectiveFrom.AddDays(-1);
                db.GlobalMealOverrides.Add(new GlobalMealOverride
                {
                    Wing = row.Wing,
                    MealPeriod = row.MealPeriod,
                    EffectiveFrom = request.EffectiveTo.AddDays(1),
                    EffectiveTo = rightRemainderTo,
                    IsOn = row.IsOn,
                    Note = row.Note,
                    CreatedById = row.CreatedById,
                });
            }
            else if (startsBefore)
            {
                row.EffectiveTo = request.EffectiveFrom.AddDays(-1);
            }
            else if (endsAfter)
            {
                row.EffectiveFrom = request.EffectiveTo.AddDays(1);
            }
            else
            {
                // Fully contained in the new range — nothing of it survives outside it.
                db.GlobalMealOverrides.Remove(row);
            }
        }

        var entity = new GlobalMealOverride
        {
            Wing = selectedWing,
            MealPeriod = request.MealPeriod,
            EffectiveFrom = request.EffectiveFrom,
            EffectiveTo = request.EffectiveTo,
            IsOn = request.IsOn,
            Note = request.Note?.Trim(),
            CreatedById = currentUser.UserId,
        };
        db.GlobalMealOverrides.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        // Changes who is billed for this wing/period across the whole range — without this the
        // override took effect on the meal sheet but never reached a bill.
        await billing.RecalculateForwardAsync(request.EffectiveFrom.Month, request.EffectiveFrom.Year, cancellationToken);
        return new GlobalMealOverrideDto(entity.Id, entity.Wing, entity.MealPeriod, entity.EffectiveFrom, entity.EffectiveTo, entity.IsOn, entity.Note, entity.CreatedAtUtc);
    }

    [HttpDelete("overrides/{id:guid}")]
    [RequirePermission(MenuKeys.AdminMeals, PermissionActions.Delete)]
    public async Task<IActionResult> DeleteOverride(Guid id, CancellationToken cancellationToken)
    {
        var entity = await db.GlobalMealOverrides.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null) return NotFound();
        var adminWing = await currentUser.GetAdminWingAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(adminWing) && entity.Wing != adminWing) return Forbid();
        var effectiveFrom = entity.EffectiveFrom;
        db.GlobalMealOverrides.Remove(entity);
        await db.SaveChangesAsync(cancellationToken);
        // Removing an override changes who was billed for that range just as creating one does.
        await billing.RecalculateForwardAsync(effectiveFrom.Month, effectiveFrom.Year, cancellationToken);
        return NoContent();
    }

    // ── Guest Meal Requests (Student) ─────────────────────────────────────────

    [HttpGet("guest-meals/me")]
    [RequirePermission(MenuKeys.StudentMeals, PermissionActions.View)]
    public async Task<ActionResult<IReadOnlyList<GuestMealRequestDto>>> GetMyGuestMeals(
        [FromQuery] int? month, [FromQuery] int? year, CancellationToken cancellationToken)
    {
        var studentId = await currentUser.GetStudentIdAsync(cancellationToken);
        var targetMonth = month ?? HallClock.Today.Month;
        var targetYear = year ?? HallClock.Today.Year;
        var from = new DateOnly(targetYear, targetMonth, 1);
        var to = from.AddMonths(1).AddDays(-1);
        var rows = await db.GuestMealRequests.AsNoTracking()
            .Where(x => x.StudentId == studentId && x.Date >= from && x.Date <= to)
            .OrderBy(x => x.Date).ThenBy(x => x.MealPeriod)
            .ToListAsync(cancellationToken);
        return rows.Select(x => new GuestMealRequestDto(x.Id, x.MealPeriod, x.Date, x.GuestCount, x.CreatedAtUtc)).ToList();
    }

    [HttpPost("guest-meals/me")]
    [RequirePermission(MenuKeys.StudentMeals, PermissionActions.Edit)]
    public async Task<ActionResult<GuestMealRequestDto>> SaveMyGuestMeal(
        SaveGuestMealRequest request, CancellationToken cancellationToken)
    {
        if (!MealHistoryService.MealPeriods.Contains(request.MealPeriod))
            return BadRequest(new { message = "Invalid meal period." });
        if (request.GuestCount < 1 || request.GuestCount > 20)
            return BadRequest(new { message = "Guest count must be between 1 and 20." });

        var studentId = await currentUser.GetStudentIdAsync(cancellationToken);
        var wing = await db.Students.AsNoTracking()
            .Where(x => x.Id == studentId)
            .Select(x => x.Gender)
            .FirstOrDefaultAsync(cancellationToken) ?? string.Empty;
        var earliest = await GetEarliestStudentChangeDateAsync(wing, cancellationToken);
        if (request.Date < earliest)
            return BadRequest(new { message = $"Guest meals can be submitted from {earliest:yyyy-MM-dd}." });

        // Upsert: one record per student/period/date
        var existing = await db.GuestMealRequests
            .FirstOrDefaultAsync(x => x.StudentId == studentId && x.MealPeriod == request.MealPeriod && x.Date == request.Date, cancellationToken);

        if (existing is not null)
        {
            existing.GuestCount = request.GuestCount;
        }
        else
        {
            existing = new GuestMealRequest
            {
                StudentId = studentId,
                MealPeriod = request.MealPeriod,
                Date = request.Date,
                GuestCount = request.GuestCount,
            };
            db.GuestMealRequests.Add(existing);
        }

        await db.SaveChangesAsync(cancellationToken);
        await billing.RecalculateForwardAsync(request.Date.Month, request.Date.Year, cancellationToken);
        return new GuestMealRequestDto(existing.Id, existing.MealPeriod, existing.Date, existing.GuestCount, existing.CreatedAtUtc);
    }

    [HttpDelete("guest-meals/me/{id:guid}")]
    [RequirePermission(MenuKeys.StudentMeals, PermissionActions.Delete)]
    public async Task<IActionResult> DeleteMyGuestMeal(Guid id, CancellationToken cancellationToken)
    {
        var studentId = await currentUser.GetStudentIdAsync(cancellationToken);
        var entity = await db.GuestMealRequests
            .FirstOrDefaultAsync(x => x.Id == id && x.StudentId == studentId, cancellationToken);
        if (entity is null) return NotFound();

        // Once the booking cutoff for a date has passed, the mess may already be counting on it —
        // a student pulling the request out from under that would silently zero a bill the hall
        // has already acted on. Past this point only an admin (DeleteGuestMealAsAdmin) can remove it.
        var wing = await db.Students.AsNoTracking()
            .Where(x => x.Id == studentId)
            .Select(x => x.Gender)
            .FirstOrDefaultAsync(cancellationToken) ?? string.Empty;
        var earliest = await GetEarliestStudentChangeDateAsync(wing, cancellationToken);
        if (entity.Date < earliest)
        {
            return BadRequest(new
            {
                message = $"This guest meal request is past the {earliest:yyyy-MM-dd} cutoff and can no longer be removed. Contact the hall admin to update it.",
            });
        }

        db.GuestMealRequests.Remove(entity);
        await db.SaveChangesAsync(cancellationToken);
        await billing.RecalculateForwardAsync(entity.Date.Month, entity.Date.Year, cancellationToken);
        return NoContent();
    }

    [HttpDelete("admin/guest-meals/{id:guid}")]
    [RequirePermission(MenuKeys.AdminMeals, PermissionActions.Delete)]
    public async Task<IActionResult> DeleteGuestMealAsAdmin(Guid id, CancellationToken cancellationToken)
    {
        // Admin override of DeleteMyGuestMeal: intentionally skips the cutoff check above, since
        // this is exactly the escape hatch students are pointed to once that cutoff has passed.
        var entity = await db.GuestMealRequests.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null) return NotFound();
        db.GuestMealRequests.Remove(entity);
        await db.SaveChangesAsync(cancellationToken);
        await billing.RecalculateForwardAsync(entity.Date.Month, entity.Date.Year, cancellationToken);
        return NoContent();
    }

    [HttpGet("sheet")]
    [RequirePermission(MenuKeys.AdminMealSheet, PermissionActions.View)]
    public async Task<ActionResult<MealSheetDto>> GetMealSheet(
        [FromQuery] DateOnly? date, [FromQuery] string? wing, CancellationToken cancellationToken)
    {
        var target = date ?? HallClock.Today;
        var selectedWing = await currentUser.GetMealWingAsync(wing, cancellationToken);

        // Fetch all active students
        var students = await db.Students.AsNoTracking()
            .Where(x => x.Status == MealResolutionContext.BillableStatus && x.Gender == selectedWing)
            .OrderBy(x => x.RoomNo).ThenBy(x => x.StudentId)
            .ToListAsync(cancellationToken);

        var isFuture = target > HallClock.Today.AddDays(1);
        var rows = new List<MealSheetRowDto>();

        if (isFuture)
        {
            foreach (var student in students)
            {
                rows.Add(new MealSheetRowDto(
                    student.HallId,
                    student.StudentId,
                    student.StudentName,
                    student.RoomNo,
                    student.Gender,
                    student.HallName,
                    false, // BreakfastOn
                    false, // LunchOn
                    false, // DinnerOn
                    null,  // BreakfastOptionName
                    null,  // LunchOptionName
                    null,  // DinnerOptionName
                    0,     // BreakfastGuestCount
                    0,     // LunchGuestCount
                    0      // DinnerGuestCount
                ));
            }
        }
        else
        {
            var studentIds = students.Select(x => x.Id).ToList();

            // Fetch MealStatusHistory active on target date
            var statuses = await db.MealStatusHistory.AsNoTracking()
                .Where(x => studentIds.Contains(x.StudentId)
                    && x.EffectiveFrom <= target
                    && (x.EffectiveTo == null || x.EffectiveTo >= target))
                .ToListAsync(cancellationToken);

            var preferences = await db.MealPreferenceHistory.AsNoTracking()
                .Where(x => studentIds.Contains(x.StudentId)
                    && x.DayOfWeek == target.DayOfWeek
                    && x.EffectiveFrom <= target
                    && (x.EffectiveTo == null || x.EffectiveTo >= target))
                .ToListAsync(cancellationToken);

            var optionNames = await db.InventoryItems.AsNoTracking()
                .Where(x => x.Category == "Options" && !x.IsDeleted && x.Wing == selectedWing)
                .ToDictionaryAsync(x => x.Id, x => x.Item, cancellationToken);

            // Fetch GuestMealRequests active on target date
            var guestMeals = await db.GuestMealRequests.AsNoTracking()
                .Where(x => studentIds.Contains(x.StudentId) && x.Date == target)
                .ToListAsync(cancellationToken);

            // Fetch GlobalMealOverrides active on target date
            var overrides = await db.GlobalMealOverrides.AsNoTracking()
                .Where(x => x.Wing == selectedWing && x.EffectiveFrom <= target && x.EffectiveTo >= target)
                .ToListAsync(cancellationToken);
            var dayCode = target.DayOfWeek.ToString()[..3].ToLowerInvariant();
            var menuConfigurations = await db.MealConfigurations.AsNoTracking()
                .Include(x => x.MealDay)
                .Include(x => x.MealType)
                .Include(x => x.Items)
                .Where(x => x.MealDay!.Code == dayCode && x.Wing == selectedWing)
                .ToListAsync(cancellationToken);

            var earliest = await GetEarliestStudentChangeDateAsync(selectedWing, cancellationToken);
            var isCutoffPassed = target < earliest;

            var periodConfigs = MealHistoryService.MealPeriods.ToDictionary(
                period => period,
                period =>
                {
                    var config = menuConfigurations.FirstOrDefault(x => x.MealType!.Code == period);
                    var optItems = config?.Items
                        .Where(x => x.IsOptional && x.InventoryItemId.HasValue && optionNames.ContainsKey(x.InventoryItemId.Value))
                        .ToList() ?? [];
                    var availableIds = optItems.Select(x => x.InventoryItemId!.Value).ToHashSet();
                    var defaultId = optItems.FirstOrDefault(x => x.IsDefault)?.InventoryItemId;
                    return (AvailableIds: availableIds, DefaultId: defaultId);
                });

            var guestMealsByStudentAndPeriod = guestMeals.ToDictionary(x => (x.StudentId, x.MealPeriod), x => x.GuestCount);
            var guestMealIdsByStudentAndPeriod = guestMeals.ToDictionary(x => (x.StudentId, x.MealPeriod), x => x.Id);
            var preferencesByStudentAndPeriod = preferences
                .GroupBy(x => (x.StudentId, x.MealPeriod))
                .ToDictionary(x => x.Key, x => x.OrderByDescending(y => y.EffectiveFrom).First());

            string? ResolveOptionName(string period, bool isOn, MealPreferenceHistory? pref)
            {
                if (!isOn) return null;
                var pConf = periodConfigs[period];
                if (pConf.AvailableIds.Count == 0) return null;

                var prefId = pref?.OptionItemId;
                if (prefId.HasValue && pConf.AvailableIds.Contains(prefId.Value))
                {
                    return optionNames.GetValueOrDefault(prefId.Value);
                }
                if (isCutoffPassed && pConf.DefaultId.HasValue)
                {
                    return optionNames.GetValueOrDefault(pConf.DefaultId.Value);
                }
                return null;
            }

            foreach (var student in students)
            {
                var bOn = MealHistoryService.GetEffectiveStatus(student.Id, student.Gender, "breakfast", target, statuses, overrides);
                var lOn = MealHistoryService.GetEffectiveStatus(student.Id, student.Gender, "lunch", target, statuses, overrides);
                var dOn = MealHistoryService.GetEffectiveStatus(student.Id, student.Gender, "dinner", target, statuses, overrides);

                var bGuest = guestMealsByStudentAndPeriod.GetValueOrDefault((student.Id, "breakfast"));
                var lGuest = guestMealsByStudentAndPeriod.GetValueOrDefault((student.Id, "lunch"));
                var dGuest = guestMealsByStudentAndPeriod.GetValueOrDefault((student.Id, "dinner"));

                var bGuestId = guestMealIdsByStudentAndPeriod.TryGetValue((student.Id, "breakfast"), out var bId) ? bId : (Guid?)null;
                var lGuestId = guestMealIdsByStudentAndPeriod.TryGetValue((student.Id, "lunch"), out var lId) ? lId : (Guid?)null;
                var dGuestId = guestMealIdsByStudentAndPeriod.TryGetValue((student.Id, "dinner"), out var dId) ? dId : (Guid?)null;

                var bPreference = preferencesByStudentAndPeriod.GetValueOrDefault((student.Id, "breakfast"));
                var lPreference = preferencesByStudentAndPeriod.GetValueOrDefault((student.Id, "lunch"));
                var dPreference = preferencesByStudentAndPeriod.GetValueOrDefault((student.Id, "dinner"));

                rows.Add(new MealSheetRowDto(
                    student.HallId,
                    student.StudentId,
                    student.StudentName,
                    student.RoomNo,
                    student.Gender,
                    student.HallName,
                    bOn,
                    lOn,
                    dOn,
                    ResolveOptionName("breakfast", bOn, bPreference),
                    ResolveOptionName("lunch", lOn, lPreference),
                    ResolveOptionName("dinner", dOn, dPreference),
                    bGuest,
                    lGuest,
                    dGuest,
                    bGuestId,
                    lGuestId,
                    dGuestId
                ));
            }
        }

        var bCount = rows.Count(x => x.BreakfastOn) + rows.Sum(x => x.BreakfastGuestCount);
        var lCount = rows.Count(x => x.LunchOn) + rows.Sum(x => x.LunchGuestCount);
        var dCount = rows.Count(x => x.DinnerOn) + rows.Sum(x => x.DinnerGuestCount);

        return new MealSheetDto(
            target,
            students.Count,
            bCount,
            lCount,
            dCount,
            rows,
            IsAvailable: !isFuture
        );
    }

    private async Task<DateOnly> GetEarliestStudentChangeDateAsync(string wing, CancellationToken cancellationToken)
    {
        // Use the wing-specific cutoff; fall back to any row if the wing's row hasn't been seeded yet.
        var cutoff = await db.MealSettings.AsNoTracking()
            .Where(x => x.Wing == wing)
            .OrderBy(x => x.CreatedAtUtc)
            .Select(x => (TimeOnly?)x.CutoffTime)
            .FirstOrDefaultAsync(cancellationToken)
            ?? await db.MealSettings.AsNoTracking()
                .OrderBy(x => x.CreatedAtUtc)
                .Select(x => (TimeOnly?)x.CutoffTime)
                .FirstOrDefaultAsync(cancellationToken)
            ?? new TimeOnly(17, 0);
        var daysAhead = HallClock.TimeOfDay >= cutoff ? 2 : 1;
        return HallClock.Today.AddDays(daysAhead);
    }

    /// <summary>
    /// Admin version of SaveStudentOptionPreferenceAsync: uses AdminForcePreferenceAsync to
    /// allow setting preferences for today even when a future preference record exists.
    /// </summary>
    private async Task AdminForceOptionPreferenceAsync(
        Guid studentId,
        string wing,
        string mealPeriod,
        Guid? optionItemId,
        DateOnly effectiveFrom,
        CancellationToken cancellationToken)
    {
        if (!optionItemId.HasValue)
        {
            await history.AdminForcePreferenceAsync(studentId, mealPeriod, null, effectiveFrom, cancellationToken);
            return;
        }

        var dayCode = effectiveFrom.DayOfWeek.ToString()[..3].ToLowerInvariant();
        var allowedOption = await db.MealConfigurations.AsNoTracking()
            .Include(x => x.MealDay)
            .Include(x => x.MealType)
            .Include(x => x.Items)
            .Where(x => x.Wing == wing && x.MealDay!.Code == dayCode && x.MealType!.Code == mealPeriod)
            .SelectMany(x => x.Items)
            .AnyAsync(x => x.IsOptional && x.InventoryItemId == optionItemId, cancellationToken);

        if (!allowedOption)
            throw new InvalidOperationException("This optional choice is not configured for the selected meal on that date.");

        await history.AdminForcePreferenceAsync(studentId, mealPeriod, optionItemId, effectiveFrom, cancellationToken);
    }

    private async Task SaveStudentOptionPreferenceAsync(
        Guid studentId,
        string wing,
        string mealPeriod,
        Guid? optionItemId,
        DateOnly effectiveFrom,
        CancellationToken cancellationToken)
    {
        if (!optionItemId.HasValue)
        {
            await history.SetPreferenceAsync(studentId, mealPeriod, null, effectiveFrom, cancellationToken);
            return;
        }

        var dayCode = effectiveFrom.DayOfWeek.ToString()[..3].ToLowerInvariant();
        var allowedOption = await db.MealConfigurations.AsNoTracking()
            .Include(x => x.MealDay)
            .Include(x => x.MealType)
            .Include(x => x.Items)
            .Where(x => x.Wing == wing && x.MealDay!.Code == dayCode && x.MealType!.Code == mealPeriod)
            .SelectMany(x => x.Items)
            .AnyAsync(x => x.IsOptional && x.InventoryItemId == optionItemId, cancellationToken);

        if (!allowedOption)
            throw new InvalidOperationException("This optional choice is not configured for the selected meal on that date.");

        await history.SetPreferenceAsync(studentId, mealPeriod, optionItemId, effectiveFrom, cancellationToken);
    }

    private async Task<AdminStudentMealControlDto> BuildStudentMealControlAsync(
        Student student,
        string wing,
        DateOnly target,
        CancellationToken cancellationToken)
    {
        var statuses = await db.MealStatusHistory.AsNoTracking()
            .Where(x => x.StudentId == student.Id
                && x.EffectiveFrom <= target
                && (x.EffectiveTo == null || x.EffectiveTo >= target))
            .ToListAsync(cancellationToken);
        var overrides = await db.GlobalMealOverrides.AsNoTracking()
            .Where(x => x.Wing == wing
                && x.EffectiveFrom <= target
                && x.EffectiveTo >= target)
            .ToListAsync(cancellationToken);

        var preferences = await db.MealPreferenceHistory.AsNoTracking()
            .Where(x => x.StudentId == student.Id
                && x.DayOfWeek == target.DayOfWeek
                && x.EffectiveFrom <= target
                && (x.EffectiveTo == null || x.EffectiveTo >= target))
            .ToListAsync(cancellationToken);

        var dayCode = target.DayOfWeek.ToString()[..3].ToLowerInvariant();
        var menuConfigurations = await db.MealConfigurations.AsNoTracking()
            .Include(x => x.MealDay)
            .Include(x => x.MealType)
            .Include(x => x.Items)
            .Where(x => x.Wing == wing && x.MealDay!.Code == dayCode)
            .ToListAsync(cancellationToken);

        return new AdminStudentMealControlDto(
            student.Id,
            student.StudentId,
            student.StudentName,
            student.HallId,
            student.RoomNo,
            student.Gender,
            target,
            MealHistoryService.MealPeriods.Select(period =>
            {
                var preference = preferences.Where(x => x.MealPeriod == period)
                    .OrderByDescending(x => x.EffectiveFrom)
                    .FirstOrDefault();
                var availableOptions = menuConfigurations
                    .Where(x => x.MealType!.Code == period)
                    .SelectMany(x => x.Items)
                    .Where(x => x.IsOptional && x.InventoryItemId.HasValue)
                    .GroupBy(x => x.InventoryItemId!.Value)
                    .Select(x => new AdminMealOptionChoiceDto(x.Key, x.First().Name, x.First().IsDefault))
                    .OrderBy(x => x.Name)
                    .ToList();

                var isOn = MealHistoryService.GetEffectiveStatus(student.Id, student.Gender, period, target, statuses, overrides);
                var savedPrefId = preference?.OptionItemId;
                var savedIsValid = savedPrefId.HasValue && availableOptions.Any(x => x.Id == savedPrefId.Value);
                var defaultOption = availableOptions.FirstOrDefault(x => x.IsDefault);

                Guid? effectiveOptionId = null;
                string? effectiveOptionName = null;
                string adminState;

                if (!isOn || availableOptions.Count == 0)
                {
                    adminState = OptionSelectionState.NotRequired;
                }
                else if (savedIsValid)
                {
                    effectiveOptionId = savedPrefId;
                    effectiveOptionName = availableOptions.FirstOrDefault(x => x.Id == savedPrefId)?.Name;
                    adminState = OptionSelectionState.Selected;
                }
                else if (defaultOption != null)
                {
                    effectiveOptionId = defaultOption.Id;
                    effectiveOptionName = defaultOption.Name;
                    adminState = OptionSelectionState.DefaultAssigned;
                }
                else
                {
                    adminState = OptionSelectionState.SelectionRequired;
                }

                return new AdminStudentMealStatusDto(
                    period,
                    isOn,
                    effectiveOptionId,
                    effectiveOptionName,
                    availableOptions,
                    adminState);
            })
                .ToList());
    }
    /// <summary>
    /// Admin bulk endpoint: applies the admin-configured default option for every active student
    /// in the wing whose meal is ON for the target date but who has not yet selected an option.
    /// Should be called at or after cutoff. Returns the number of students assigned.
    /// </summary>
    [HttpPost("apply-defaults")]
    [RequirePermission(MenuKeys.AdminMeals, PermissionActions.Edit)]
    public async Task<ActionResult<ApplyDefaultsResultDto>> ApplyDefaults(
        [FromQuery] DateOnly? date, [FromQuery] string? wing, CancellationToken cancellationToken)
    {
        var target = date ?? HallClock.Today.AddDays(1);
        var selectedWing = await currentUser.GetMealWingAsync(wing, cancellationToken);

        var dayCode = target.DayOfWeek.ToString()[..3].ToLowerInvariant();
        var menuConfigs = await db.MealConfigurations.AsNoTracking()
            .Include(x => x.MealDay)
            .Include(x => x.MealType)
            .Include(x => x.Items)
            .ThenInclude(x => x.InventoryItem)
            .Where(x => x.Wing == selectedWing && x.MealDay!.Code == dayCode)
            .ToListAsync(cancellationToken);

        // For each period, find the admin-defined default item (if any).
        var defaultByPeriod = MealHistoryService.MealPeriods
            .Select(period =>
            {
                var defaultItem = menuConfigs
                    .Where(x => x.MealType!.Code == period)
                    .SelectMany(x => x.Items)
                    .FirstOrDefault(x => x.IsOptional && x.IsDefault && x.InventoryItemId.HasValue
                        && x.InventoryItem != null && !x.InventoryItem.IsDeleted);
                return (Period: period, DefaultItem: defaultItem);
            })
            .Where(x => x.DefaultItem is not null)
            .ToDictionary(x => x.Period, x => x.DefaultItem!);

        if (defaultByPeriod.Count == 0)
            return Ok(new ApplyDefaultsResultDto(0, 0, target));

        var activeStudents = await db.Students.AsNoTracking()
            .Where(x => x.Status == MealResolutionContext.BillableStatus && x.Gender == selectedWing)
            .ToListAsync(cancellationToken);
        var studentIds = activeStudents.Select(x => x.Id).ToList();

        var statuses = await db.MealStatusHistory.AsNoTracking()
            .Where(x => studentIds.Contains(x.StudentId)
                && x.EffectiveFrom <= target
                && (x.EffectiveTo == null || x.EffectiveTo >= target))
            .ToListAsync(cancellationToken);
        var overrides = await db.GlobalMealOverrides.AsNoTracking()
            .Where(x => x.Wing == selectedWing && x.EffectiveFrom <= target && x.EffectiveTo >= target)
            .ToListAsync(cancellationToken);
        var existingPrefs = await db.MealPreferenceHistory.AsNoTracking()
            .Where(x => studentIds.Contains(x.StudentId)
                && x.DayOfWeek == target.DayOfWeek
                && x.EffectiveFrom <= target
                && (x.EffectiveTo == null || x.EffectiveTo >= target))
            .ToListAsync(cancellationToken);

        // Build a set of (studentId, period) pairs that already have a valid saved option.
        var validPrefSet = existingPrefs
            .Where(p => p.OptionItemId.HasValue && defaultByPeriod.TryGetValue(p.MealPeriod, out var di)
                && menuConfigs
                    .Where(x => x.MealType!.Code == p.MealPeriod)
                    .SelectMany(x => x.Items)
                    .Any(x => x.IsOptional && x.InventoryItemId == p.OptionItemId && x.InventoryItem != null && !x.InventoryItem.IsDeleted))
            .Select(p => (p.StudentId, p.MealPeriod))
            .ToHashSet();

        int assigned = 0;
        int skipped = 0;
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            foreach (var student in activeStudents)
            {
                if (!MealResolutionContext.HasJoinedBy(student, target)) { skipped++; continue; }
                foreach (var (period, defaultItem) in defaultByPeriod)
                {
                    var isOn = MealHistoryService.GetEffectiveStatus(student.Id, student.Gender, period, target, statuses, overrides);
                    if (!isOn) { skipped++; continue; }
                    if (validPrefSet.Contains((student.Id, period))) { skipped++; continue; }

                    await history.SetPreferenceAsync(student.Id, period, defaultItem.InventoryItemId, target, cancellationToken);
                    assigned++;
                }
            }
            await db.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }

        if (assigned > 0)
            await billing.RecalculateForwardAsync(target.Month, target.Year, cancellationToken);

        return Ok(new ApplyDefaultsResultDto(assigned, skipped, target));
    }

}
