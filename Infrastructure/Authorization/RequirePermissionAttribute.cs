using HallBackend.Application.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

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

        var role = user.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
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
