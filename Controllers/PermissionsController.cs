using System.Security.Claims;
using HallBackend.Application.Dtos;
using HallBackend.Application.Services;
using HallBackend.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HallBackend.Controllers;

[ApiController]
[Authorize]
[Route("api/permissions")]
public sealed class PermissionsController(
    PermissionService permissions,
    CurrentUserService currentUser) : ControllerBase
{
    private string? CurrentRole => User.FindFirstValue(ClaimTypes.Role);

    /// <summary>
    /// The signed-in user's own grants. Every authenticated user may read this — it describes
    /// only what they already have, and the client needs it to render its nav.
    /// </summary>
    [HttpGet("me")]
    public async Task<ActionResult<MyPermissionsDto>> GetMine(CancellationToken cancellationToken)
    {
        var mine = await permissions.GetMineAsync(CurrentRole, cancellationToken);
        // Super admins already have no wing on their account, so they can always choose.
        return mine with
        {
            CanChooseFinanceWing = mine.IsSuperAdmin || currentUser.CanChooseFinanceWing,
        };
    }

    [HttpGet("roles")]
    [Authorize(Roles = Roles.SuperAdmin)]
    public async Task<IReadOnlyList<AppRoleDto>> GetRoles(CancellationToken cancellationToken)
        => await permissions.GetRolesAsync(cancellationToken);

    [HttpPost("roles")]
    [Authorize(Roles = Roles.SuperAdmin)]
    public async Task<IActionResult> CreateRole(SaveAppRoleRequest request, CancellationToken cancellationToken)
    {
        var error = await permissions.CreateRoleAsync(request, cancellationToken);
        return error is null ? NoContent() : BadRequest(new { message = error });
    }

    [HttpDelete("roles/{role}")]
    [Authorize(Roles = Roles.SuperAdmin)]
    public async Task<IActionResult> DeleteRole(string role, CancellationToken cancellationToken)
    {
        var error = await permissions.DeleteRoleAsync(role, cancellationToken);
        return error is null ? NoContent() : BadRequest(new { message = error });
    }

    /// <summary>The full menu tree with one role's grants folded in — the editor's data source.</summary>
    [HttpGet("roles/{role}")]
    [Authorize(Roles = Roles.SuperAdmin)]
    public async Task<ActionResult<RolePermissionMatrixDto>> GetMatrix(string role, CancellationToken cancellationToken)
    {
        var matrix = await permissions.GetMatrixAsync(role, cancellationToken);
        return matrix is null ? NotFound(new { message = "Unknown role." }) : matrix;
    }

    [HttpPut("roles/{role}")]
    [Authorize(Roles = Roles.SuperAdmin)]
    public async Task<IActionResult> SaveMatrix(
        string role,
        SaveRolePermissionsRequest request,
        CancellationToken cancellationToken)
    {
        var error = await permissions.SaveMatrixAsync(
            role, request.Permissions ?? [], currentUser.UserId, cancellationToken);
        return error is null ? NoContent() : BadRequest(new { message = error });
    }
}
