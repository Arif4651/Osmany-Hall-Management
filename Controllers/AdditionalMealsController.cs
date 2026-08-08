using HallBackend.Application.Dtos;
using HallBackend.Application.Services;
using HallBackend.Domain.Constants;
using HallBackend.Domain.Entities;
using HallBackend.Infrastructure.Authorization;
using HallBackend.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Controllers;

/// <summary>
/// The optional-item catalogue (admin) and per-date opt-ins (student).
/// Eligibility and cutoff live in <see cref="AdditionalMealService"/> so both sides share them.
/// </summary>
[ApiController]
[Authorize]
[Route("api/meals/additional")]
public sealed class AdditionalMealsController(
    HallDbContext db,
    CurrentUserService currentUser,
    AdditionalMealService additionalMeals) : ControllerBase
{
    private static readonly string[] Wings = ["Male", "Female", "All"];

    // ── Admin: item catalogue ────────────────────────────────────────────────

    [HttpGet("items")]
    [RequirePermission(MenuKeys.AdminAdditionalItems, PermissionActions.View)]
    public async Task<IReadOnlyList<AdditionalMealItemDto>> GetItems(CancellationToken cancellationToken)
    {
        var query = db.AdditionalMealItems.AsNoTracking();

        // A wing admin only manages their own wing's catalogue; items marked for both wings apply
        // to their students too, so those stay visible. A super admin has no wing and sees all.
        var adminWing = await currentUser.GetAdminWingAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(adminWing))
        {
            query = query.Where(x => x.EligibleWing == adminWing || x.EligibleWing == "All");
        }

        return await query
            .OrderBy(x => x.SortOrder).ThenBy(x => x.Name)
            .Select(x => new AdditionalMealItemDto(
                x.Id, x.Code, x.Name, x.EligibleWing, x.DefaultQuantity, x.IsActive, x.SortOrder))
            .ToListAsync(cancellationToken);
    }

    /// <summary>
    /// Rejects a wing admin aiming an item at a wing that is not theirs. "All" is a super-admin
    /// decision too — a wing admin may leave an existing item on it, but never set it.
    /// </summary>
    private async Task<string?> ValidateWingAsync(
        string requestedWing, string? currentWing, CancellationToken cancellationToken)
    {
        var adminWing = await currentUser.GetAdminWingAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(adminWing)) return null;

        if (requestedWing == adminWing) return null;
        if (requestedWing == "All" && currentWing == "All") return null;

        return $"You can only manage items for the {adminWing} wing.";
    }

    [HttpPost("items")]
    [RequirePermission(MenuKeys.AdminAdditionalItems, PermissionActions.Create)]
    public async Task<ActionResult<AdditionalMealItemDto>> CreateItem(
        SaveAdditionalMealItemRequest request, CancellationToken cancellationToken)
    {
        var error = Validate(request);
        if (error is not null) return BadRequest(new { message = error });

        var wingError = await ValidateWingAsync(request.EligibleWing, null, cancellationToken);
        if (wingError is not null) return StatusCode(403, new { message = wingError });

        var code = request.Code.Trim().ToLowerInvariant();
        if (await db.AdditionalMealItems.AnyAsync(x => x.Code == code, cancellationToken))
            return Conflict(new { message = "An item with that code already exists." });

        var nextSort = await db.AdditionalMealItems.AnyAsync(cancellationToken)
            ? await db.AdditionalMealItems.MaxAsync(x => x.SortOrder, cancellationToken) + 1
            : 0;

        var item = new AdditionalMealItem
        {
            Code = code,
            Name = request.Name.Trim(),
            EligibleWing = request.EligibleWing,
            DefaultQuantity = request.DefaultQuantity <= 0 ? 1 : request.DefaultQuantity,
            IsActive = request.IsActive,
            SortOrder = nextSort,
        };
        db.AdditionalMealItems.Add(item);
        await db.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetItems), ToDto(item));
    }

    [HttpPut("items/{id:guid}")]
    [RequirePermission(MenuKeys.AdminAdditionalItems, PermissionActions.Edit)]
    public async Task<ActionResult<AdditionalMealItemDto>> UpdateItem(
        Guid id, SaveAdditionalMealItemRequest request, CancellationToken cancellationToken)
    {
        var error = Validate(request);
        if (error is not null) return BadRequest(new { message = error });

        var item = await db.AdditionalMealItems.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null) return NotFound();

        // Guard both ends: the item being edited must already belong to this admin's wing, and the
        // wing they are moving it to must too.
        var currentWingError = await ValidateWingAsync(item.EligibleWing, item.EligibleWing, cancellationToken);
        if (currentWingError is not null) return StatusCode(403, new { message = currentWingError });
        var wingError = await ValidateWingAsync(request.EligibleWing, item.EligibleWing, cancellationToken);
        if (wingError is not null) return StatusCode(403, new { message = wingError });

        // The code is the stable identifier billing history is written against, so it is fixed
        // once created; everything else, including eligibility, stays editable.
        item.Name = request.Name.Trim();
        item.EligibleWing = request.EligibleWing;
        item.DefaultQuantity = request.DefaultQuantity <= 0 ? 1 : request.DefaultQuantity;
        item.IsActive = request.IsActive;
        await db.SaveChangesAsync(cancellationToken);
        return ToDto(item);
    }

    [HttpDelete("items/{id:guid}")]
    [RequirePermission(MenuKeys.AdminAdditionalItems, PermissionActions.Delete)]
    public async Task<IActionResult> DeleteItem(Guid id, CancellationToken cancellationToken)
    {
        var item = await db.AdditionalMealItems.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null) return NotFound();

        var wingError = await ValidateWingAsync(item.EligibleWing, item.EligibleWing, cancellationToken);
        if (wingError is not null) return StatusCode(403, new { message = wingError });

        // Deleting an item that has been consumed would orphan billing history, so it is
        // deactivated instead — students stop seeing it, past bills stay explainable.
        var used = await db.AdditionalMealSelections.AnyAsync(x => x.ItemId == id, cancellationToken)
            || await db.OthersBills.AnyAsync(x => x.ItemId == id, cancellationToken);
        if (used)
        {
            item.IsActive = false;
            await db.SaveChangesAsync(cancellationToken);
            return Ok(new { deactivated = true, message = $"{item.Name} has history, so it was deactivated instead of deleted." });
        }

        db.AdditionalMealItems.Remove(item);
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { deactivated = false });
    }

    // ── Admin: roster for a date, meant to sit beside the Meal Sheet ─────────

    [HttpGet("sheet")]
    [RequirePermission(MenuKeys.AdminAdditionalItems, PermissionActions.View)]
    public async Task<ActionResult<AdditionalMealSheetDto>> GetSheet(
        [FromQuery] DateOnly? date,
        [FromQuery] string? wing,
        CancellationToken cancellationToken)
    {
        var target = date ?? DateOnly.FromDateTime(DateTime.Today);
        var scopedWing = await currentUser.GetFinanceWingFilterAsync(wing, cancellationToken);
        return await additionalMeals.GetSheetAsync(target, scopedWing, cancellationToken);
    }

    // ── Student: their own eligible items and selections ─────────────────────

    [HttpGet("me")]
    [RequirePermission(MenuKeys.StudentAdditionalPreferences, PermissionActions.View)]
    public async Task<ActionResult<AdditionalMealDayDto>> GetMyDay(
        [FromQuery] DateOnly date, CancellationToken cancellationToken)
    {
        var studentId = await currentUser.GetStudentIdAsync(cancellationToken);
        return await additionalMeals.GetDayAsync(studentId, date, cancellationToken);
    }

    /// <summary>
    /// A whole month for the month grid: meal slots, eligible items, each day's editability and
    /// every mark already made — one request instead of one per date.
    /// </summary>
    [HttpGet("me/month")]
    [RequirePermission(MenuKeys.StudentAdditionalPreferences, PermissionActions.View)]
    public async Task<ActionResult<AdditionalMealMonthDto>> GetMyMonth(
        [FromQuery] int month, [FromQuery] int year, CancellationToken cancellationToken)
    {
        if (month is < 1 or > 12) return BadRequest(new { message = "Invalid month." });
        var studentId = await currentUser.GetStudentIdAsync(cancellationToken);
        return await additionalMeals.GetMonthAsync(studentId, month, year, cancellationToken);
    }

    [HttpGet("me/range")]
    [RequirePermission(MenuKeys.StudentAdditionalPreferences, PermissionActions.View)]
    public async Task<IReadOnlyList<AdditionalMealSelectionDto>> GetMySelections(
        [FromQuery] DateOnly from, [FromQuery] DateOnly to, CancellationToken cancellationToken)
    {
        var studentId = await currentUser.GetStudentIdAsync(cancellationToken);
        return await db.AdditionalMealSelections.AsNoTracking()
            .Include(x => x.Item)
            .Where(x => x.StudentId == studentId && x.Date >= from && x.Date <= to)
            .OrderBy(x => x.Date).ThenBy(x => x.MealPeriod)
            .Select(x => new AdditionalMealSelectionDto(
                x.ItemId, x.Item!.Code, x.Item.Name, x.Date, x.MealPeriod, x.Quantity))
            .ToListAsync(cancellationToken);
    }

    /// <summary>
    /// Marks or clears one slot. Requires edit; clearing a slot deletes the row, which is why the
    /// student role is also granted delete on this menu.
    /// </summary>
    [HttpPut("me")]
    [RequirePermission(MenuKeys.StudentAdditionalPreferences, PermissionActions.Edit)]
    public async Task<ActionResult<AdditionalMealDayDto>> SaveMySelection(
        SaveAdditionalMealSelectionRequest request, CancellationToken cancellationToken)
    {
        var studentId = await currentUser.GetStudentIdAsync(cancellationToken);
        await additionalMeals.SaveSelectionAsync(studentId, request, cancellationToken);
        return await additionalMeals.GetDayAsync(studentId, request.Date, cancellationToken);
    }

    private static string? Validate(SaveAdditionalMealItemRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Code)) return "Item code is required.";
        if (string.IsNullOrWhiteSpace(request.Name)) return "Item name is required.";
        if (!Wings.Contains(request.EligibleWing)) return "Eligible wing must be Male, Female or All.";
        if (request.DefaultQuantity is < 1 or > 20) return "Default quantity must be between 1 and 20.";
        var code = request.Code.Trim();
        return code.All(c => char.IsAsciiLetterOrDigit(c) || c is '_' or '-')
            ? null
            : "Item code may only contain letters, digits, underscores and hyphens.";
    }

    private static AdditionalMealItemDto ToDto(AdditionalMealItem x)
        => new(x.Id, x.Code, x.Name, x.EligibleWing, x.DefaultQuantity, x.IsActive, x.SortOrder);
}
