using HallBackend.Application.Dtos;
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
public sealed class MealsController(HallDbContext db) : ControllerBase
{
    [HttpGet("module")]
    public async Task<ActionResult<MealModuleDto>> GetModule(CancellationToken cancellationToken)
    {
        var setting = await db.MealSettings.AsNoTracking().FirstOrDefaultAsync(cancellationToken) ?? new MealSetting();
        var mealTypes = await db.MealTypes.AsNoTracking().OrderBy(x => x.SortOrder).ToListAsync(cancellationToken);
        var days = await db.MealDays.AsNoTracking()
            .Include(x => x.Configurations).ThenInclude(x => x.MealType)
            .Include(x => x.Configurations).ThenInclude(x => x.Items)
            .OrderBy(x => x.SortOrder)
            .ToListAsync(cancellationToken);

        return new MealModuleDto(
            new MealSettingsDto(setting.CutoffTime, mealTypes.Select(x => new MealTypeDto(x.Code, x.Label, x.SortOrder, x.StartsAt, x.EndsAt)).ToList(), setting.ForecastMaxOptions),
            days.Select(day => new MealDayDto(
                day.Code,
                day.Label,
                day.SortOrder,
                day.Configurations.OrderBy(x => x.MealType!.SortOrder).Select(ToMealEntry).ToList())).ToList());
    }

    [HttpPut("settings/cutoff")]
    [Authorize(Roles = Roles.Admin)]
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
        return await GetModule(cancellationToken);
    }

    [HttpPut("configuration")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<MealModuleDto>> UpsertConfiguration(UpsertMealConfigurationRequest request, CancellationToken cancellationToken)
    {
        var day = await db.MealDays.FirstOrDefaultAsync(x => x.Code == request.DayId, cancellationToken);
        var type = await db.MealTypes.FirstOrDefaultAsync(x => x.Code == request.MealTypeId, cancellationToken);
        if (day is null || type is null) return NotFound(new { message = "Meal day or type was not found." });

        var config = await db.MealConfigurations.Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.MealDayId == day.Id && x.MealTypeId == type.Id, cancellationToken);

        if (config is null)
        {
            config = new MealConfiguration { MealDayId = day.Id, MealTypeId = type.Id };
            db.MealConfigurations.Add(config);
        }

        db.MealItems.RemoveRange(config.Items);
        config.Items = request.CommonItems.Select(x => new MealItem { Name = x.Name.Trim(), Cost = x.Cost, IsOptional = false })
            .Concat(request.OptionalItems.Select(x => new MealItem { Name = x.Name.Trim(), Cost = x.Cost, IsOptional = true }))
            .ToList();

        await db.SaveChangesAsync(cancellationToken);
        return await GetModule(cancellationToken);
    }

    [HttpGet("preferences/{studentId:guid}")]
    public async Task<ActionResult<Dictionary<string, StudentMealPreferenceInput>>> GetPreferences(Guid studentId, CancellationToken cancellationToken)
    {
        var mealTypes = await db.MealTypes.AsNoTracking().OrderBy(x => x.SortOrder).ToListAsync(cancellationToken);
        var preferences = await db.StudentMealPreferences.AsNoTracking()
            .Include(x => x.MealType)
            .Where(x => x.StudentId == studentId)
            .ToListAsync(cancellationToken);

        return mealTypes.ToDictionary(
            x => x.Code,
            x =>
            {
                var pref = preferences.FirstOrDefault(p => p.MealTypeId == x.Id);
                return new StudentMealPreferenceInput(pref?.Enabled ?? true, pref?.OptionItemId);
            });
    }

    [HttpPut("preferences/{studentId:guid}")]
    public async Task<ActionResult<Dictionary<string, StudentMealPreferenceInput>>> SavePreferences(Guid studentId, SaveStudentMealPreferencesRequest request, CancellationToken cancellationToken)
    {
        var mealTypes = await db.MealTypes.ToListAsync(cancellationToken);
        var existing = await db.StudentMealPreferences.Where(x => x.StudentId == studentId).ToListAsync(cancellationToken);

        foreach (var entry in request.Preferences)
        {
            var mealType = mealTypes.FirstOrDefault(x => x.Code == entry.Key);
            if (mealType is null) continue;
            var pref = existing.FirstOrDefault(x => x.MealTypeId == mealType.Id);
            if (pref is null)
            {
                pref = new StudentMealPreference { StudentId = studentId, MealTypeId = mealType.Id };
                db.StudentMealPreferences.Add(pref);
            }
            pref.Enabled = entry.Value.Enabled;
            pref.OptionItemId = entry.Value.OptionItemId;
        }

        await db.SaveChangesAsync(cancellationToken);
        return await GetPreferences(studentId, cancellationToken);
    }

    private static MealEntryDto ToMealEntry(MealConfiguration config)
    {
        return new MealEntryDto(
            config.MealType!.Code,
            config.Items.Where(x => !x.IsOptional).Select(x => new MealItemDto(x.Id, x.Name, x.Cost)).ToList(),
            config.Items.Where(x => x.IsOptional).Select(x => new MealItemDto(x.Id, x.Name, x.Cost)).ToList(),
            config.Status);
    }
}
