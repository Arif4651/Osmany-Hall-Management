using System.Security.Claims;
using HallBackend.Application.Services;
using HallBackend.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Infrastructure.Authorization;

/// <summary>
/// Gates an endpoint on a menu/action grant from the permission matrix rather than on a hardcoded
/// role list. Authentication is still <c>[Authorize]</c>'s job — this only answers "may this role
/// do this?", and answers no whenever a grant is missing.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
public sealed class RequirePermissionAttribute(string menuKey, string action)
    : Attribute, IAsyncAuthorizationFilter
{
    public string MenuKey { get; } = menuKey;
    public string Action { get; } = action;

    /// <summary>
    /// A second menu that also unlocks this endpoint. Set it where one route backs both portals —
    /// the daily cost report, for instance, which admins and students each reach from their own
    /// nav entry. Access is granted if either menu carries the action.
    /// </summary>
    public string? AltMenuKey { get; set; }

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;
        if (user?.Identity?.IsAuthenticated != true)
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        var idClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(idClaim, out var userId))
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        // Read the role from the database rather than the token's Role claim: a token is valid
        // for up to Jwt:ExpiresMinutes (120) after issue, so a role demotion, an account
        // deactivation, or a wing reassignment made mid-session would otherwise not take effect
        // on any permission-guarded endpoint until the old token expired. This runs on every
        // guarded request, matching the rest of the app's already-heavy per-request DB usage
        // (CurrentUserService does the same for wing scoping).
        var account = await context.HttpContext.RequestServices.GetRequiredService<HallDbContext>()
            .Users.AsNoTracking()
            .Where(x => x.Id == userId)
            .Select(x => new { x.Role, x.IsActive })
            .FirstOrDefaultAsync(context.HttpContext.RequestAborted);

        if (account is null || !account.IsActive)
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        var role = account.Role;
        var permissions = context.HttpContext.RequestServices.GetRequiredService<PermissionService>();

        var allowed = await permissions.HasPermissionAsync(
            role, MenuKey, Action, context.HttpContext.RequestAborted);

        if (!allowed && AltMenuKey is not null)
        {
            allowed = await permissions.HasPermissionAsync(
                role, AltMenuKey, Action, context.HttpContext.RequestAborted);
        }

        if (!allowed)
        {
            context.Result = new ObjectResult(new
            {
                message = "Your role does not have permission to perform this action.",
            })
            {
                StatusCode = StatusCodes.Status403Forbidden,
            };
        }
    }
}
