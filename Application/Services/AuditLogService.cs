using System.Security.Claims;
using System.Text.Json;
using HallBackend.Domain.Entities;
using HallBackend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Application.Services;

/// <summary>
/// Centralized audit logging service. All controllers inject this to emit structured logs.
/// The service is deliberately fire-and-forget-safe: it catches its own exceptions so a
/// logging failure never rolls back a legitimate business operation.
/// </summary>
public sealed class AuditLogService(
    HallDbContext db,
    IHttpContextAccessor httpContextAccessor,
    ILogger<AuditLogService> logger)
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        WriteIndented = false,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    /// <summary>
    /// Emit one audit log entry. All parameters after <paramref name="description"/> are optional.
    /// </summary>
    public async Task LogAsync(
        string actorName,
        Guid? actorUserId,
        string actorRole,
        string module,
        string action,
        string entityType,
        string? entityId,
        string description,
        object? oldValues = null,
        object? newValues = null,
        bool isSuccess = true,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var http = httpContextAccessor.HttpContext;
            var ip = http?.Connection.RemoteIpAddress?.ToString();
            var ua = http?.Request.Headers.UserAgent.ToString();
            if (ua is { Length: > 300 }) ua = ua[..300];

            db.AuditLogs.Add(new AuditLog
            {
                Actor = actorName,
                ActorUserId = actorUserId,
                ActorRole = actorRole,
                Module = module,
                Action = action,
                EntityType = entityType,
                EntityId = entityId,
                Description = description,
                OldValues = oldValues is null ? null : JsonSerializer.Serialize(oldValues, JsonOpts),
                NewValues = newValues is null ? null : JsonSerializer.Serialize(newValues, JsonOpts),
                IpAddress = ip,
                UserAgent = ua,
                IsSuccess = isSuccess,
                Date = DateOnly.FromDateTime(DateTime.UtcNow),
            });

            await db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            // Logging must never crash a business operation.
            logger.LogWarning(ex, "AuditLogService: failed to persist audit log. Actor={Actor} Action={Action} Module={Module}",
                actorName, action, module);
        }
    }

    // ── Convenience overloads ───────────────────────────────────────────────

    public Task LogAsync(
        AuditLogContext ctx,
        string action,
        string entityType,
        string? entityId,
        string description,
        object? oldValues = null,
        object? newValues = null,
        bool isSuccess = true,
        CancellationToken cancellationToken = default)
        => LogAsync(ctx.ActorName, ctx.ActorUserId, ctx.ActorRole,
            ctx.Module, action, entityType, entityId, description,
            oldValues, newValues, isSuccess, cancellationToken);
}

/// <summary>
/// Captures the ambient who/where context so controllers don't repeat themselves.
/// Populated once per controller action from the token claims + a DB lookup.
/// </summary>
public sealed record AuditLogContext(
    string ActorName,
    Guid? ActorUserId,
    string ActorRole,
    string Module);

/// <summary>
/// Builds an <see cref="AuditLogContext"/> by resolving the current HTTP user's identity
/// from the JWT claims and the database. Returns an "Unknown" context on any failure so that
/// a missing/expired token never crashes a controller action.
/// </summary>
public static class AuditLogContextFactory
{
    public static async Task<AuditLogContext> BuildAsync(
        IHttpContextAccessor httpContextAccessor,
        HallDbContext db,
        string module,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var claim = httpContextAccessor.HttpContext?.User
                .FindFirstValue(ClaimTypes.NameIdentifier);
            if (claim is null || !Guid.TryParse(claim, out var userId))
                return new AuditLogContext("Unknown", null, string.Empty, module);

            var user = await db.Users.AsNoTracking()
                .Where(x => x.Id == userId)
                .Select(x => new { x.Id, x.FullName, x.Role })
                .FirstOrDefaultAsync(cancellationToken);

            return user is null
                ? new AuditLogContext("Unknown", null, string.Empty, module)
                : new AuditLogContext(user.FullName, user.Id, user.Role, module);
        }
        catch
        {
            return new AuditLogContext("Unknown", null, string.Empty, module);
        }
    }
}

/// <summary>Well-known module labels, matching the frontend tab names.</summary>
public static class AuditModules
{
    public const string StudentManagement = "Student Management";
    public const string MealManagement = "Meal Management";
    public const string MealSheet = "Meal Sheet";
    public const string Attendance = "Attendance";
    public const string Inventory = "Inventory";
    public const string BillManagement = "Bill Management";
    public const string DueBill = "Due Bill";
    public const string PaymentVerification = "Payment Verification";
    public const string DailyCost = "Daily Cost";
    public const string NoticeBoard = "Notice Board";
    public const string UserRoleManagement = "User & Role Management";
    public const string Authentication = "Authentication";
    public const string System = "System";
}

/// <summary>Well-known action type constants.</summary>
public static class AuditActions
{
    public const string Create = "CREATE";
    public const string Update = "UPDATE";
    public const string Delete = "DELETE";
    public const string Activate = "ACTIVATE";
    public const string Deactivate = "DEACTIVATE";
    public const string Approve = "APPROVE";
    public const string Reject = "REJECT";
    public const string Verify = "VERIFY";
    public const string Payment = "PAYMENT";
    public const string Import = "IMPORT";
    public const string Export = "EXPORT";
    public const string Login = "LOGIN";
    public const string Logout = "LOGOUT";
    public const string LoginFailed = "LOGIN_FAILED";
    public const string RoleChange = "ROLE_CHANGE";
    public const string PermissionChange = "PERMISSION_CHANGE";
    public const string PasswordChange = "PASSWORD_CHANGE";
    public const string StatusChange = "STATUS_CHANGE";
    public const string ConfigurationChange = "CONFIGURATION_CHANGE";
    public const string AttendanceAction = "ATTENDANCE_ACTION";
    public const string StockIn = "STOCK_IN";
    public const string StockOut = "STOCK_OUT";
    public const string DueAdjustment = "DUE_ADJUSTMENT";
    public const string BillGeneration = "BILL_GENERATION";
    public const string Other = "OTHER";
}
