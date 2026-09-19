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
[RequirePermission(MenuKeys.AdminSettings, PermissionActions.View)]
[Route("api/admin-settings")]
public sealed class AdminSettingsController(
    HallDbContext db,
    PasswordService passwords,
    AuditLogService audit,
    IHttpContextAccessor http) : ControllerBase
{
    private static readonly string[] ManagedRoles = [Roles.MaleWingAdmin, Roles.FemaleWingAdmin];

    [HttpGet("admins")]
    public async Task<IReadOnlyList<AdminAccountDto>> GetAdmins(CancellationToken cancellationToken)
        => await db.Users.AsNoTracking()
            .Where(x => ManagedRoles.Contains(x.Role))
            .OrderBy(x => x.Wing).ThenBy(x => x.FullName)
            .Select(x => new AdminAccountDto(x.Id, x.FullName, x.Email, x.UserName, x.Role, x.Wing, x.Designation, x.IsActive))
            .ToListAsync(cancellationToken);

    // Creating or editing a wing-admin account — including setting its password — is restricted
    // to the super admin. admin.settings can be granted to any role through the permission
    // matrix, and without this a wing admin holding that grant could reset the other wing's
    // admin password or reassign its role/wing, moving privilege sideways across the wing
    // boundary every other financial screen enforces.
    [HttpPost("admins")]
    [Authorize(Roles = Roles.SuperAdmin)]
    [RequirePermission(MenuKeys.AdminSettings, PermissionActions.Create)]
    public async Task<ActionResult<AdminAccountDto>> CreateAdmin(SaveAdminAccountRequest request, CancellationToken cancellationToken)
    {
        var validation = Validate(request, true);
        if (validation is not null) return BadRequest(new { message = validation });
        var normalizedEmail = request.Email.Trim().ToUpperInvariant();
        var normalizedUserName = request.UserName.Trim().ToUpperInvariant();
        if (await db.Users.AnyAsync(x => x.NormalizedEmail == normalizedEmail || x.NormalizedUserName == normalizedUserName, cancellationToken))
            return Conflict(new { message = "An account with this email or username already exists." });

        var user = new AppUser
        {
            FullName = request.FullName.Trim(),
            Email = request.Email.Trim(),
            NormalizedEmail = normalizedEmail,
            UserName = request.UserName.Trim(),
            NormalizedUserName = normalizedUserName,
            Role = request.Role,
            Wing = WingForRole(request.Role),
            Designation = request.Designation.Trim(),
            PasswordHash = passwords.Hash(request.Password!),
            MustChangePassword = true,
            IsActive = request.IsActive,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync(cancellationToken);

        var ctx = await BuildCtxAsync(cancellationToken);
        await audit.LogAsync(ctx, AuditActions.Create, "AppUser", user.Id.ToString(),
            $"Created admin account '{user.FullName}' ({user.Role})",
            newValues: new { user.FullName, user.Email, user.Role, user.Wing, user.Designation, user.IsActive },
            cancellationToken: cancellationToken);

        return CreatedAtAction(nameof(GetAdmins), ToDto(user));
    }

    [HttpPut("admins/{id:guid}")]
    [Authorize(Roles = Roles.SuperAdmin)]
    [RequirePermission(MenuKeys.AdminSettings, PermissionActions.Edit)]
    public async Task<ActionResult<AdminAccountDto>> UpdateAdmin(Guid id, SaveAdminAccountRequest request, CancellationToken cancellationToken)
    {
        var validation = Validate(request, false);
        if (validation is not null) return BadRequest(new { message = validation });
        var user = await db.Users.FirstOrDefaultAsync(x => x.Id == id && ManagedRoles.Contains(x.Role), cancellationToken);
        if (user is null) return NotFound();
        var normalizedEmail = request.Email.Trim().ToUpperInvariant();
        var normalizedUserName = request.UserName.Trim().ToUpperInvariant();
        if (await db.Users.AnyAsync(x => x.Id != id && (x.NormalizedEmail == normalizedEmail || x.NormalizedUserName == normalizedUserName), cancellationToken))
            return Conflict(new { message = "An account with this email or username already exists." });

        var oldValues = new { user.FullName, user.Email, user.Role, user.Wing, user.Designation, user.IsActive };

        var passwordChanged = !string.IsNullOrWhiteSpace(request.Password);
        user.FullName = request.FullName.Trim();
        user.Email = request.Email.Trim();
        user.NormalizedEmail = normalizedEmail;
        user.UserName = request.UserName.Trim();
        user.NormalizedUserName = normalizedUserName;
        user.Role = request.Role;
        user.Wing = WingForRole(request.Role);
        user.Designation = request.Designation.Trim();
        user.IsActive = request.IsActive;
        if (passwordChanged)
        {
            user.PasswordHash = passwords.Hash(request.Password!);
            user.MustChangePassword = true;
        }
        await db.SaveChangesAsync(cancellationToken);

        var ctx = await BuildCtxAsync(cancellationToken);
        var action = passwordChanged ? AuditActions.PasswordChange : AuditActions.Update;
        var desc = passwordChanged
            ? $"Updated and reset password for admin '{user.FullName}'"
            : $"Updated admin account '{user.FullName}'";
        await audit.LogAsync(ctx, action, "AppUser", id.ToString(), desc,
            oldValues: oldValues,
            newValues: new { user.FullName, user.Email, user.Role, user.Wing, user.Designation, user.IsActive },
            cancellationToken: cancellationToken);

        return ToDto(user);
    }

    private Task<AuditLogContext> BuildCtxAsync(CancellationToken ct)
        => AuditLogContextFactory.BuildAsync(http, db, AuditModules.UserRoleManagement, ct);

    private static string? Validate(SaveAdminAccountRequest request, bool passwordRequired)
    {
        if (!ManagedRoles.Contains(request.Role)) return "Select Male Wing Admin or Female Wing Admin.";
        if (string.IsNullOrWhiteSpace(request.FullName) || string.IsNullOrWhiteSpace(request.Email)
            || string.IsNullOrWhiteSpace(request.UserName)) return "Name, email, and username are required.";
        if (passwordRequired && (request.Password?.Length ?? 0) < 8) return "Password must be at least 8 characters.";
        if (!string.IsNullOrWhiteSpace(request.Password) && request.Password.Length < 8) return "Password must be at least 8 characters.";
        return null;
    }

    private static string WingForRole(string role) => role == Roles.FemaleWingAdmin ? "Female" : "Male";
    private static AdminAccountDto ToDto(AppUser user)
        => new(user.Id, user.FullName, user.Email, user.UserName, user.Role, user.Wing, user.Designation, user.IsActive);
}
