using HallBackend.Application.Dtos;
using HallBackend.Application.Services;
using HallBackend.Domain.Constants;
using HallBackend.Domain.Entities;
using HallBackend.Infrastructure.Data;
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
        var setting = await db.MealSettings.AsNoTracking().FirstOrDefaultAsync(cancellationToken) ?? new MealSetting();
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
                            .Select(item => new MealItemDto(item.InventoryItemId ?? item.Id, item.Name, item.Cost))
                            .ToList(),
                        config.Items
                            .Where(item => item.IsOptional
                                && item.InventoryItem != null
                                && item.InventoryItem.Category == "Options"
                                && !item.InventoryItem.IsDeleted)
                            .Select(item => new MealItemDto(item.InventoryItemId!.Value, item.Name, item.Cost))
                            .ToList(),
                        config.Status))
                    .ToList()))
            .ToListAsync(cancellationToken);

        return new MealModuleDto(
            new MealSettingsDto(setting.CutoffTime, mealTypes.Select(x => new MealTypeDto(x.Code, x.Label, x.SortOrder, x.StartsAt, x.EndsAt)).ToList(), setting.ForecastMaxOptions),
            days);
    }

    [HttpPut("settings/cutoff")]
    [Authorize(Roles = Roles.HallAdministrators)]
    public async Task<ActionResult<MealModuleDto>> UpdateCutoff(UpdateCutoffRequest request, CancellationToken cancellationToken)
    {
        var setting = await db.MealSettings.FirstOrDefaultAsync(cancellationToken);
        if (setting is null)
        {
            setting = new MealSetting();
            db.MealSettings.Add(setting);
        }
        setting.CutoffTime = request.CutoffTime;
        await db.SaveChangesAsync(cancellationToken);
        return await GetModule(null, cancellationToken);
    }

    [HttpPut("configuration")]
    [Authorize(Roles = Roles.HallAdministrators)]
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
            .Where(x => !string.IsNullOrWhiteSpace(x.Name))
            .Select(x => (Input: x, Category: "Common", IsOptional: false))
            .Concat(request.OptionalItems
                .Where(x => !string.IsNullOrWhiteSpace(x.Name))
                .Select(x => (Input: x, Category: "Options", IsOptional: true)))
            .ToList();
        var duplicate = inputs
            .GroupBy(x => ItemCatalogService.NormalizeName(x.Input.Name))
            .FirstOrDefault(x => x.Count() > 1);
        if (duplicate is not null)
        {
            return BadRequest(new { message = $"{duplicate.First().Input.Name.Trim()} is listed more than once." });
        }

        var inventoryItems = await db.InventoryItems.AsNoTracking()
            .Where(x => !x.IsDeleted
                && x.Wing == selectedWing
                && (x.Category == "Common" || x.Category == "Options"))
            .ToListAsync(cancellationToken);
        var inventoryByCategoryAndName = inventoryItems
            .GroupBy(x => (x.Category, Name: ItemCatalogService.NormalizeName(x.Item)))
            .ToDictionary(x => x.Key, x => x.First());

        var resolvedInputs = new List<(MealItemInput Input, bool IsOptional, InventoryItem? InventoryItem)>();
        foreach (var entry in inputs)
        {
            inventoryByCategoryAndName.TryGetValue(
                (entry.Category, ItemCatalogService.NormalizeName(entry.Input.Name)),
                out var inventoryItem);
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
                Name = entry.Input.Name.Trim(),
                Cost = Math.Max(0m, entry.Input.Cost),
                IsOptional = entry.IsOptional,
            });
        }

        db.MealItems.AddRange(nextItems);
        await db.SaveChangesAsync(cancellationToken);
        return await GetModule(selectedWing, cancellationToken);
    }

    [HttpGet("counts")]
    [Authorize(Roles = Roles.HallAdministrators)]
    public async Task<ActionResult<MealCountsForDateDto>> GetMealCounts(
        [FromQuery] DateOnly? date, [FromQuery] string? wing, CancellationToken cancellationToken)
    {
        var target = date ?? DateOnly.FromDateTime(DateTime.Today.AddDays(1));
        var selectedWing = await currentUser.GetMealWingAsync(wing, cancellationToken);
        var mealTypes = await db.MealTypes.AsNoTracking()
            .OrderBy(x => x.SortOrder)
            .ToListAsync(cancellationToken);

        var isFuture = target > DateOnly.FromDateTime(DateTime.Today.AddDays(1));
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
            return new MealCountsForDateDto(target, dayCode, emptyCounts);
        }

        var activeStudents = await db.Students.AsNoTracking()
            .Where(x => x.Status == "active" && x.Gender == selectedWing)
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
        var optionItems = await db.InventoryItems.AsNoTracking()
            .Where(x => x.Category == "Options" && !x.IsDeleted && x.Wing == selectedWing)
            .ToDictionaryAsync(x => x.Id, cancellationToken);
        var menuConfigurations = await db.MealConfigurations.AsNoTracking()
            .Include(x => x.MealDay)
            .Include(x => x.MealType)
            .Include(x => x.Items)
            .Where(x => x.MealDay!.Code == dayCode && x.Wing == selectedWing)
            .ToListAsync(cancellationToken);

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
            var selectedOptionCounts = enabledStudents
                .Select(studentId => preferences
                    .Where(x => x.StudentId == studentId && x.MealPeriod == type.Code)
                    .OrderByDescending(x => x.EffectiveFrom)
                    .FirstOrDefault()?.OptionItemId)
                .Where(x => x.HasValue && optionItems.ContainsKey(x.Value))
                .Select(x => x!.Value)
                .GroupBy(x => x)
                .ToDictionary(group => group.Key, group => group.Count());
            var configuredOptionIds = menuConfigurations
                .Where(x => x.MealType!.Code == type.Code)
                .SelectMany(x => x.Items)
                .Where(x => x.IsOptional && x.InventoryItemId.HasValue)
                .Select(x => x.InventoryItemId!.Value)
                .Where(optionItems.ContainsKey)
                .Concat(selectedOptionCounts.Keys)
                .Distinct()
                .ToList();
            var configuredOptionCosts = menuConfigurations
                .Where(x => x.MealType!.Code == type.Code)
                .SelectMany(x => x.Items)
                .Where(x => x.IsOptional && x.InventoryItemId.HasValue)
                .GroupBy(x => x.InventoryItemId!.Value)
                .ToDictionary(x => x.Key, x => x.First().Cost);
            var choices = configuredOptionIds
                .Select(optionId =>
                {
                    var option = optionItems[optionId];
                    return new MealCountOptionDto(
                        option.Id,
                        option.Item,
                        configuredOptionCosts.GetValueOrDefault(optionId),
                        selectedOptionCounts.GetValueOrDefault(optionId));
                })
                .OrderByDescending(x => x.StudentCount)
                .ThenBy(x => x.Name)
                .ToList();
            return new MealCountDto(
                type.Code,
                type.Label,
                activeStudents.Count,
                enabledStudents.Count,
                activeStudents.Count - enabledStudents.Count,
                choices);
        }).ToList();

        return new MealCountsForDateDto(target, dayCode, counts);
    }

    [HttpGet("student-controls/{studentRecordId:guid}")]
    [Authorize(Roles = Roles.HallAdministrators)]
    public async Task<ActionResult<AdminStudentMealControlDto>> GetStudentMealControl(
        Guid studentRecordId,
        [FromQuery] DateOnly? date,
        [FromQuery] string? wing,
        CancellationToken cancellationToken)
    {
        var target = date ?? DateOnly.FromDateTime(DateTime.Today.AddDays(1));
        var selectedWing = await currentUser.GetManagedWingAsync(wing, cancellationToken);
        var student = await db.Students.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == studentRecordId && x.Gender == selectedWing, cancellationToken);

        if (student is null)
            return NotFound(new { message = "Student was not found in the selected wing." });
        if (!string.Equals(student.Status, "active", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Only active students can be managed from meal controls." });

        return await BuildStudentMealControlAsync(student, selectedWing, target, cancellationToken);
    }

    [HttpPut("student-controls/status")]
    [Authorize(Roles = Roles.HallAdministrators)]
    public async Task<ActionResult<AdminStudentMealControlDto>> SaveStudentMealControlStatus(
        SaveAdminStudentMealStatusRequest request,
        CancellationToken cancellationToken)
    {
        if (!MealHistoryService.MealPeriods.Contains(request.MealPeriod))
            return BadRequest(new { message = "Invalid meal period." });

        var today = DateOnly.FromDateTime(DateTime.Today);
        if (request.EffectiveFrom < today)
            return BadRequest(new { message = "Meal changes can only be applied for today or future dates." });

        var selectedWing = await currentUser.GetManagedWingAsync(request.Wing, cancellationToken);
        var student = await db.Students
            .FirstOrDefaultAsync(x => x.Id == request.StudentRecordId && x.Gender == selectedWing, cancellationToken);

        if (student is null)
            return NotFound(new { message = "Student was not found in the selected wing." });
        if (!string.Equals(student.Status, "active", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Only active students can be managed from meal controls." });

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            // Use AdminForceStatusAsync so today's meal can be changed even when a future status exists.
            await history.AdminForceStatusAsync(student.Id, request.MealPeriod, request.IsOn, request.EffectiveFrom, cancellationToken);
            await AdminForceOptionPreferenceAsync(student.Id, selectedWing, request.MealPeriod, request.OptionItemId, request.EffectiveFrom, cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return await BuildStudentMealControlAsync(student, selectedWing, request.EffectiveFrom, cancellationToken);
        }
        catch (InvalidOperationException ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("options")]
    public async Task<IReadOnlyList<MenuOptionDto>> GetOptions(CancellationToken cancellationToken)
    {
        var items = await db.MealItems.AsNoTracking()
            .Where(x => x.IsOptional && x.InventoryItemId.HasValue
                && x.InventoryItem != null && !x.InventoryItem.IsDeleted)
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);
        return items
            .GroupBy(x => x.InventoryItemId!.Value)
            .Select(x => x.OrderByDescending(y => y.UpdatedAtUtc ?? y.CreatedAtUtc).First())
            .Select(x => new MenuOptionDto(x.InventoryItemId!.Value, x.Name, x.Cost))
            .OrderBy(x => x.Name)
            .ToList();
    }

    [Authorize(Roles = Roles.HallAdministrators)]
    [HttpGet("debug-preferences")]
    public async Task<IActionResult> DebugPreferences([FromQuery] string studentId, CancellationToken cancellationToken)
    {
        var student = await db.Students.FirstOrDefaultAsync(x => x.StudentId == studentId, cancellationToken);
        if (student == null) return NotFound("Student not found");
        var prefs = await db.MealPreferenceHistory
            .Where(x => x.StudentId == student.Id)
            .OrderBy(x => x.EffectiveFrom)
            .Select(x => new {
                x.Id,
                x.MealPeriod,
                x.OptionItemId,
                OptionName = x.OptionItem != null ? x.OptionItem.Item : "None",
                x.EffectiveFrom,
                x.EffectiveTo,
                x.DayOfWeek
            })
            .ToListAsync(cancellationToken);
        return Ok(new { student = student.StudentName, studentGuid = student.Id, preferences = prefs });
    }

    [HttpGet("preferences/me")]
    public async Task<ActionResult<IReadOnlyList<MealPreferenceStateDto>>> GetMyPreferences(
        [FromQuery] DateOnly? date, CancellationToken cancellationToken)
    {
        var studentId = await currentUser.GetStudentIdAsync(cancellationToken);
        var target = date ?? DateOnly.FromDateTime(DateTime.Today);
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
        return MealHistoryService.MealPeriods.Select(period => new MealPreferenceStateDto(
            period,
            MealHistoryService.GetEffectiveStatus(studentId, wing, period, target, statuses, overrides),
            preferences.Where(x => x.MealPeriod == period).OrderByDescending(x => x.EffectiveFrom).FirstOrDefault()?.OptionItemId,
            optionNames.GetValueOrDefault(preferences.Where(x => x.MealPeriod == period).OrderByDescending(x => x.EffectiveFrom).FirstOrDefault()?.OptionItemId ?? Guid.Empty))).ToList();
    }

    [HttpPut("preferences/me")]
    public async Task<ActionResult<IReadOnlyList<MealPreferenceStateDto>>> SaveMyPreferences(
        SaveMealPreferenceStateRequest request, CancellationToken cancellationToken)
    {
        var earliest = await GetEarliestStudentChangeDateAsync(cancellationToken);
        if (request.EffectiveFrom < earliest)
            return BadRequest(new { message = $"Meal changes can be applied from {earliest:yyyy-MM-dd}." });
        var studentId = await currentUser.GetStudentIdAsync(cancellationToken);
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            foreach (var meal in request.Meals)
            {
                await history.SetStatusAsync(studentId, meal.MealPeriod, meal.IsOn, request.EffectiveFrom, cancellationToken);
                await history.SetPreferenceAsync(studentId, meal.MealPeriod, meal.OptionItemId, request.EffectiveFrom, cancellationToken);
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
    public async Task<ActionResult> SaveMyMealOffRange(
        SaveMealOffRangeRequest request, CancellationToken cancellationToken)
    {
        var earliest = await GetEarliestStudentChangeDateAsync(cancellationToken);
        if (request.From < earliest)
            return BadRequest(new { message = $"Meal-off ranges can start from {earliest:yyyy-MM-dd}." });
        if (request.To < request.From)
            return BadRequest(new { message = "The end date must be on or after the start date." });
        if (request.To.DayNumber - request.From.DayNumber > 366)
            return BadRequest(new { message = "A meal-off range cannot exceed one year." });
        var periods = request.MealPeriods.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        if (periods.Count == 0 || periods.Any(x => !MealHistoryService.MealPeriods.Contains(x)))
            return BadRequest(new { message = "Select at least one valid meal period." });

        var studentId = await currentUser.GetStudentIdAsync(cancellationToken);
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
                    guestCount);
            }).ToList()));
        }
        return rows;
    }

    [HttpGet("menu")]
    public async Task<IReadOnlyList<MenuMealDto>> GetMenu(CancellationToken cancellationToken)
    {
        var configurations = await db.MealConfigurations.AsNoTracking()
            .Include(x => x.MealType)
            .Include(x => x.Items)
            .OrderBy(x => x.MealDayId)
            .ToListAsync(cancellationToken);
        return MealHistoryService.MealPeriods.Select(period =>
        {
            var items = configurations.FirstOrDefault(x => x.MealType!.Code == period)?.Items
                .ToList() ?? [];
            return new MenuMealDto(
                period,
                items.Where(x => !x.IsOptional)
                    .Select(x => new MenuOptionDto(x.InventoryItemId ?? x.Id, x.Name, x.Cost)).ToList(),
                items.Where(x => x.IsOptional)
                    .Select(x => new MenuOptionDto(x.InventoryItemId ?? x.Id, x.Name, x.Cost)).ToList());
        }).ToList();
    }

    [HttpPut("menu")]
    [Authorize(Roles = Roles.HallAdministrators)]
    public async Task<ActionResult<IReadOnlyList<MenuMealDto>>> SaveMenu(SaveMenuMealRequest request, CancellationToken cancellationToken)
    {
        if (!MealHistoryService.MealPeriods.Contains(request.MealPeriod)) return BadRequest(new { message = "Invalid meal period." });
        var selectedIds = request.CommonItemIds.Concat(request.OptionItemIds).Distinct().ToList();
        var selected = await db.InventoryItems.Where(x => selectedIds.Contains(x.Id) && !x.IsDeleted).ToListAsync(cancellationToken);
        if (request.CommonItemIds.Any(id => selected.All(x => x.Id != id || x.Category != "Common"))
            || request.OptionItemIds.Any(id => selected.All(x => x.Id != id || x.Category != "Options")))
            return BadRequest(new { message = "Menu items must match their inventory category." });
        var mealType = await db.MealTypes.FirstOrDefaultAsync(x => x.Code == request.MealPeriod, cancellationToken);
        if (mealType is null) return NotFound();
        var configs = await db.MealConfigurations.Include(x => x.Items)
            .Where(x => x.MealTypeId == mealType.Id).ToListAsync(cancellationToken);
        foreach (var config in configs)
        {
            var previousCosts = config.Items
                .Where(x => x.InventoryItemId.HasValue)
                .GroupBy(x => x.InventoryItemId!.Value)
                .ToDictionary(x => x.Key, x => x.First().Cost);
            db.MealItems.RemoveRange(config.Items);
            foreach (var item in selected)
            {
                db.MealItems.Add(new MealItem
                {
                    MealConfigurationId = config.Id,
                    InventoryItemId = item.Id,
                    Name = item.Item,
                    Cost = previousCosts.GetValueOrDefault(item.Id),
                    IsOptional = item.Category == "Options",
                });
            }
        }
        await db.SaveChangesAsync(cancellationToken);
        return Ok(await GetMenu(cancellationToken));
    }

    // ── Global Meal Overrides (Admin) ─────────────────────────────────────────

    [HttpGet("overrides")]
    [Authorize(Roles = Roles.HallAdministrators)]
    public async Task<IReadOnlyList<GlobalMealOverrideDto>> GetOverrides(
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] string? wing, CancellationToken cancellationToken)
    {
        var queryFrom = from ?? DateOnly.FromDateTime(DateTime.Today);
        var queryTo = to ?? queryFrom.AddMonths(3);
        var selectedWing = await currentUser.GetMealWingAsync(wing, cancellationToken);
        return await db.GlobalMealOverrides.AsNoTracking()
            .Where(x => x.Wing == selectedWing && x.EffectiveTo >= queryFrom && x.EffectiveFrom <= queryTo)
            .OrderBy(x => x.EffectiveFrom).ThenBy(x => x.MealPeriod)
            .Select(x => new GlobalMealOverrideDto(x.Id, x.Wing, x.MealPeriod, x.EffectiveFrom, x.EffectiveTo, x.IsOn, x.Note, x.CreatedAtUtc))
            .ToListAsync(cancellationToken);
    }

    [HttpPost("overrides")]
    [Authorize(Roles = Roles.HallAdministrators)]
    public async Task<ActionResult<GlobalMealOverrideDto>> CreateOverride(
        SetGlobalMealOverrideRequest request, CancellationToken cancellationToken)
    {
        if (!MealHistoryService.MealPeriods.Contains(request.MealPeriod))
            return BadRequest(new { message = "Invalid meal period." });
        if (request.EffectiveTo < request.EffectiveFrom)
            return BadRequest(new { message = "End date must be on or after start date." });
        if (request.EffectiveTo.DayNumber - request.EffectiveFrom.DayNumber > 366)
            return BadRequest(new { message = "Override cannot span more than one year." });
        var selectedWing = await currentUser.GetMealWingAsync(request.Wing, cancellationToken);

        var overlapping = await db.GlobalMealOverrides
            .Where(x => x.Wing == selectedWing
                && x.MealPeriod == request.MealPeriod
                && x.EffectiveTo >= request.EffectiveFrom
                && x.EffectiveFrom <= request.EffectiveTo)
            .ToListAsync(cancellationToken);

        if (overlapping.Count > 0)
        {
            db.GlobalMealOverrides.RemoveRange(overlapping);
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
        return new GlobalMealOverrideDto(entity.Id, entity.Wing, entity.MealPeriod, entity.EffectiveFrom, entity.EffectiveTo, entity.IsOn, entity.Note, entity.CreatedAtUtc);
    }

    [HttpDelete("overrides/{id:guid}")]
    [Authorize(Roles = Roles.HallAdministrators)]
    public async Task<IActionResult> DeleteOverride(Guid id, CancellationToken cancellationToken)
    {
        var entity = await db.GlobalMealOverrides.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null) return NotFound();
        var adminWing = await currentUser.GetAdminWingAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(adminWing) && entity.Wing != adminWing) return Forbid();
        db.GlobalMealOverrides.Remove(entity);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    // ── Guest Meal Requests (Student) ─────────────────────────────────────────

    [HttpGet("guest-meals/me")]
    public async Task<ActionResult<IReadOnlyList<GuestMealRequestDto>>> GetMyGuestMeals(
        [FromQuery] int? month, [FromQuery] int? year, CancellationToken cancellationToken)
    {
        var studentId = await currentUser.GetStudentIdAsync(cancellationToken);
        var targetMonth = month ?? DateTime.Today.Month;
        var targetYear = year ?? DateTime.Today.Year;
        var from = new DateOnly(targetYear, targetMonth, 1);
        var to = from.AddMonths(1).AddDays(-1);
        var rows = await db.GuestMealRequests.AsNoTracking()
            .Where(x => x.StudentId == studentId && x.Date >= from && x.Date <= to)
            .OrderBy(x => x.Date).ThenBy(x => x.MealPeriod)
            .ToListAsync(cancellationToken);
        return rows.Select(x => new GuestMealRequestDto(x.Id, x.MealPeriod, x.Date, x.GuestCount, x.CreatedAtUtc)).ToList();
    }

    [HttpPost("guest-meals/me")]
    public async Task<ActionResult<GuestMealRequestDto>> SaveMyGuestMeal(
        SaveGuestMealRequest request, CancellationToken cancellationToken)
    {
        if (!MealHistoryService.MealPeriods.Contains(request.MealPeriod))
            return BadRequest(new { message = "Invalid meal period." });
        if (request.GuestCount < 1 || request.GuestCount > 20)
            return BadRequest(new { message = "Guest count must be between 1 and 20." });

        var earliest = await GetEarliestStudentChangeDateAsync(cancellationToken);
        if (request.Date < earliest)
            return BadRequest(new { message = $"Guest meals can be submitted from {earliest:yyyy-MM-dd}." });

        var studentId = await currentUser.GetStudentIdAsync(cancellationToken);

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
    public async Task<IActionResult> DeleteMyGuestMeal(Guid id, CancellationToken cancellationToken)
    {
        var studentId = await currentUser.GetStudentIdAsync(cancellationToken);
        var entity = await db.GuestMealRequests
            .FirstOrDefaultAsync(x => x.Id == id && x.StudentId == studentId, cancellationToken);
        if (entity is null) return NotFound();
        db.GuestMealRequests.Remove(entity);
        await db.SaveChangesAsync(cancellationToken);
        await billing.RecalculateForwardAsync(entity.Date.Month, entity.Date.Year, cancellationToken);
        return NoContent();
    }

    [HttpGet("sheet")]
    [Authorize(Roles = Roles.HallAdministrators)]
    public async Task<ActionResult<MealSheetDto>> GetMealSheet(
        [FromQuery] DateOnly? date, [FromQuery] string? wing, CancellationToken cancellationToken)
    {
        var target = date ?? DateOnly.FromDateTime(DateTime.Today);
        var selectedWing = await currentUser.GetMealWingAsync(wing, cancellationToken);
        
        // Fetch all active students
        var students = await db.Students.AsNoTracking()
            .Where(x => x.Status == "active" && x.Gender == selectedWing)
            .OrderBy(x => x.RoomNo).ThenBy(x => x.StudentId)
            .ToListAsync(cancellationToken);

        var isFuture = target > DateOnly.FromDateTime(DateTime.Today.AddDays(1));
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
            var guestMealsByStudentAndPeriod = guestMeals.ToDictionary(x => (x.StudentId, x.MealPeriod), x => x.GuestCount);
            var preferencesByStudentAndPeriod = preferences
                .GroupBy(x => (x.StudentId, x.MealPeriod))
                .ToDictionary(x => x.Key, x => x.OrderByDescending(y => y.EffectiveFrom).First());

            foreach (var student in students)
            {
                var bOn = MealHistoryService.GetEffectiveStatus(student.Id, student.Gender, "breakfast", target, statuses, overrides);
                var lOn = MealHistoryService.GetEffectiveStatus(student.Id, student.Gender, "lunch", target, statuses, overrides);
                var dOn = MealHistoryService.GetEffectiveStatus(student.Id, student.Gender, "dinner", target, statuses, overrides);

                var bGuest = guestMealsByStudentAndPeriod.GetValueOrDefault((student.Id, "breakfast"));
                var lGuest = guestMealsByStudentAndPeriod.GetValueOrDefault((student.Id, "lunch"));
                var dGuest = guestMealsByStudentAndPeriod.GetValueOrDefault((student.Id, "dinner"));

                var bPreference = preferencesByStudentAndPeriod.GetValueOrDefault((student.Id, "breakfast"));
                var lPreference = preferencesByStudentAndPeriod.GetValueOrDefault((student.Id, "lunch"));
                var dPreference = preferencesByStudentAndPeriod.GetValueOrDefault((student.Id, "dinner"));

                rows.Add(new MealSheetRowDto(
                    student.HallId,
                    student.StudentId,
                    student.StudentName,
                    student.RoomNo,
                    student.Gender,
                    bOn,
                    lOn,
                    dOn,
                    optionNames.GetValueOrDefault(bPreference?.OptionItemId ?? Guid.Empty),
                    optionNames.GetValueOrDefault(lPreference?.OptionItemId ?? Guid.Empty),
                    optionNames.GetValueOrDefault(dPreference?.OptionItemId ?? Guid.Empty),
                    bGuest,
                    lGuest,
                    dGuest
                ));
            }
        }

        var bCount = rows.Count(x => x.BreakfastOn);
        var lCount = rows.Count(x => x.LunchOn);
        var dCount = rows.Count(x => x.DinnerOn);

        return new MealSheetDto(
            target,
            students.Count,
            bCount,
            lCount,
            dCount,
            rows
        );
    }

    private async Task<DateOnly> GetEarliestStudentChangeDateAsync(CancellationToken cancellationToken)
    {
        var cutoff = await db.MealSettings.AsNoTracking()
            .Select(x => (TimeOnly?)x.CutoffTime)
            .FirstOrDefaultAsync(cancellationToken) ?? new TimeOnly(17, 0);
        var now = DateTime.Now;
        var daysAhead = TimeOnly.FromDateTime(now) >= cutoff ? 2 : 1;
        return DateOnly.FromDateTime(now.Date).AddDays(daysAhead);
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
                    .Select(x => new AdminMealOptionChoiceDto(x.Key, x.First().Name))
                    .OrderBy(x => x.Name)
                    .ToList();

                return new AdminStudentMealStatusDto(
                    period,
                    MealHistoryService.GetEffectiveStatus(student.Id, student.Gender, period, target, statuses, overrides),
                    preference?.OptionItemId,
                    availableOptions.FirstOrDefault(x => x.Id == preference?.OptionItemId)?.Name,
                    availableOptions);
            })
                .ToList());
    }

}
