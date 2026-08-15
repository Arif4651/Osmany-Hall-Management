using HallBackend.Application.Dtos;
using HallBackend.Application.Services;
using HallBackend.Domain.Constants;
using HallBackend.Infrastructure.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HallBackend.Controllers;

/// <summary>
/// Pooled monthly bills for optional items, distributed by consumption.
/// Sits under the billing route so it reads as a sibling of the DSW subsidy endpoints.
/// </summary>
[ApiController]
[Authorize]
[Route("api/billing/others-bills")]
public sealed class OthersBillsController(
    OthersBillService othersBills,
    CurrentUserService currentUser) : ControllerBase
{
    [HttpGet]
    [RequirePermission(MenuKeys.AdminOthersBill, PermissionActions.View)]
    public async Task<ActionResult<IReadOnlyList<OthersBillDto>>> Get(
        [FromQuery] int month, [FromQuery] int year, [FromQuery] string? wing,
        CancellationToken cancellationToken)
    {
        if (month is < 1 or > 12) return BadRequest(new { message = "Invalid month." });
        var scopedWing = await currentUser.GetOwnWingFilterAsync(wing, cancellationToken);
        return Ok(await othersBills.GetForMonthAsync(month, year, scopedWing, cancellationToken));
    }

    /// <summary>
    /// Computes the distribution without saving, so the admin can check the unit rate and the
    /// per-student split before committing to it.
    /// </summary>
    [HttpPost("preview")]
    [RequirePermission(MenuKeys.AdminOthersBill, PermissionActions.View)]
    public async Task<ActionResult<OthersBillDto>> Preview(
        SaveOthersBillRequest request, CancellationToken cancellationToken)
    {
        if (request.Month is < 1 or > 12) return BadRequest(new { message = "Invalid month." });
        if (request.TotalAmount < 0m) return BadRequest(new { message = "Total bill cannot be negative." });

        var wing = await currentUser.GetManagedWingAsync(request.Wing, cancellationToken);
        return await othersBills.PreviewAsync(
            request.Month, request.Year, request.ItemId, wing, request.TotalAmount, cancellationToken);
    }

    [HttpPost]
    [RequirePermission(MenuKeys.AdminOthersBill, PermissionActions.Create)]
    public async Task<ActionResult<OthersBillDto>> Generate(
        SaveOthersBillRequest request, CancellationToken cancellationToken)
    {
        var wing = await currentUser.GetManagedWingAsync(request.Wing, cancellationToken);
        return await othersBills.GenerateAsync(request, wing, currentUser.UserId, cancellationToken);
    }

    [HttpGet("{id:guid}")]
    [RequirePermission(MenuKeys.AdminOthersBill, PermissionActions.View)]
    public async Task<ActionResult<OthersBillDto>> GetOne(Guid id, CancellationToken cancellationToken)
    {
        var bill = await othersBills.GetAsync(id, cancellationToken);
        if (bill is null) return NotFound();
        var adminWing = await currentUser.GetAdminWingAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(adminWing) && bill.Wing != adminWing) return Forbid();
        return bill;
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission(MenuKeys.AdminOthersBill, PermissionActions.Delete)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        // The collection route (Get, above) is already wing-scoped via GetOwnWingFilterAsync;
        // this single-item route was not, so one wing's admin could delete the other wing's
        // generated bill by id. Load it first so the wing can actually be checked.
        var bill = await othersBills.GetAsync(id, cancellationToken);
        if (bill is null) return NotFound();
        var adminWing = await currentUser.GetAdminWingAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(adminWing) && bill.Wing != adminWing) return Forbid();
        return await othersBills.DeleteAsync(id, cancellationToken) ? NoContent() : NotFound();
    }

    /// <summary>
    /// The student's own breakdown — count, unit rate and amount per item — for their bill page.
    /// Scoped to the caller, so it needs no admin permission.
    /// </summary>
    [HttpGet("/api/billing/me/others-bills")]
    public async Task<ActionResult<IReadOnlyList<StudentOthersBillLineDto>>> GetMine(
        [FromQuery] int month, [FromQuery] int year, CancellationToken cancellationToken)
    {
        if (month is < 1 or > 12) return BadRequest(new { message = "Invalid month." });
        var studentId = await currentUser.GetStudentIdAsync(cancellationToken);
        return Ok(await othersBills.GetForStudentAsync(studentId, month, year, cancellationToken));
    }
}
