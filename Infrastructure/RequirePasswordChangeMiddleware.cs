using System.Text.Json;
using HallBackend.Application.Services;

namespace HallBackend.Infrastructure;

/// <summary>
/// Backend enforcement of "must change password before doing anything else". The React router
/// already redirects to the change-password screen on this flag, but that is advisory only — a
/// direct API call bypassed it entirely. This blocks every authenticated route except the small
/// set needed to actually change the password (or sign out), so a temporary/reset password is
/// unusable for anything but that one action.
/// </summary>
public sealed class RequirePasswordChangeMiddleware(RequestDelegate next)
{
    private static readonly string[] AllowedPaths =
    [
        "/api/auth/login",
        "/api/auth/logout",
        "/api/auth/change-password",
        "/api/auth/me",
        // Read-only grant metadata, not an action — the frontend fetches this immediately on
        // every login, before it has any reason to know the account is flagged for a forced
        // change. Blocking it doesn't add any protection (the grants are just role metadata,
        // not sensitive), but it did leave the UI stuck believing the role has zero permissions
        // for the rest of the session, since nothing else re-fetches this after the password is
        // actually changed.
        "/api/permissions/me",
        "/health",
    ];

    public async Task InvokeAsync(HttpContext context)
    {
        var user = context.User;
        if (user.Identity?.IsAuthenticated == true)
        {
            var mustChange = user.FindFirst(JwtTokenService.MustChangePasswordClaimType)?.Value;
            if (string.Equals(mustChange, "true", StringComparison.OrdinalIgnoreCase))
            {
                var path = context.Request.Path.Value ?? string.Empty;
                var isAllowed = AllowedPaths.Any(allowed => path.Equals(allowed, StringComparison.OrdinalIgnoreCase));
                if (!isAllowed)
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    context.Response.ContentType = "application/json";
                    await context.Response.WriteAsync(JsonSerializer.Serialize(new
                    {
                        message = "Change your password before continuing.",
                        mustChangePassword = true,
                    }));
                    return;
                }
            }
        }

        await next(context);
    }
}
