using System.Text;
using HallBackend.Application.Dtos;
using HallBackend.Application.Services;
using HallBackend.Domain.Constants;
using HallBackend.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Controllers;

/// <summary>
/// Super-admin-only audit log viewer.
///
/// Access is gated by [Authorize(Roles = Roles.SuperAdmin)] on every endpoint — the Logs page
/// is intrinsic to the Super Administrator role and is never grantable to other roles via the
/// permission matrix.
/// </summary>
[ApiController]
[Authorize(Roles = Roles.SuperAdmin)]
[Route("api/audit-logs")]
public sealed class AuditLogsController(HallDbContext db) : ControllerBase
{
    // ── GET /api/audit-logs — paginated, filtered list ────────────────────

    [HttpGet]
    public async Task<ActionResult<AuditLogListResponse>> Get(
        [FromQuery] string? module,
        [FromQuery] string? action,
        [FromQuery] Guid? actorUserId,
        [FromQuery] string? role,
        [FromQuery] string? entityType,
        [FromQuery] string? search,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] bool? isSuccess,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = db.AuditLogs.AsNoTracking().AsQueryable();

        // Student actions are excluded from the admin log viewer.
        // They are never written any more (AuthController guards them by role),
        // but this clause also hides any older rows that may exist in the DB.
        query = query.Where(x => x.ActorRole != Roles.Student);

        // ── Filters ──────────────────────────────────────────────────────
        if (!string.IsNullOrWhiteSpace(module) && module != "All")
            query = query.Where(x => x.Module == module);

        if (!string.IsNullOrWhiteSpace(action))
            query = query.Where(x => x.Action == action);

        if (actorUserId.HasValue)
            query = query.Where(x => x.ActorUserId == actorUserId);

        if (!string.IsNullOrWhiteSpace(role))
            query = query.Where(x => x.ActorRole == role);

        if (!string.IsNullOrWhiteSpace(entityType))
            query = query.Where(x => x.EntityType == entityType);

        if (isSuccess.HasValue)
            query = query.Where(x => x.IsSuccess == isSuccess.Value);

        if (fromDate.HasValue)
            query = query.Where(x => x.CreatedAtUtc >= fromDate.Value.ToUniversalTime());

        if (toDate.HasValue)
        {
            // Include the full end day
            var end = toDate.Value.Date.AddDays(1).ToUniversalTime();
            query = query.Where(x => x.CreatedAtUtc < end);
        }

        // ── Full-text search (actor name, role, entity id, description) ──
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(x =>
                x.Actor.ToLower().Contains(s) ||
                x.ActorRole.ToLower().Contains(s) ||
                x.Description.ToLower().Contains(s) ||
                (x.EntityId != null && x.EntityId.ToLower().Contains(s)) ||
                x.EntityType.ToLower().Contains(s) ||
                x.Module.ToLower().Contains(s) ||
                x.Action.ToLower().Contains(s));
        }

        // ── Sort and paginate ─────────────────────────────────────────────
        var ordered = query.OrderByDescending(x => x.CreatedAtUtc);
        var total = await ordered.CountAsync(cancellationToken);
        var totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize));
        page = Math.Min(page, totalPages);

        var items = await ordered
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new AuditLogDto(
                x.Id,
                x.CreatedAtUtc,
                x.Actor,
                x.ActorUserId,
                x.ActorRole,
                x.Module,
                x.Action,
                x.EntityType,
                x.EntityId,
                x.Description,
                x.IsSuccess))
            .ToListAsync(cancellationToken);

        return new AuditLogListResponse(items, page, pageSize, total, totalPages);
    }

    // ── GET /api/audit-logs/stats — summary card counts ──────────────────

    [HttpGet("stats")]
    public async Task<ActionResult<AuditLogStatsDto>> Stats(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var todayStart = now.Date.ToUniversalTime();
        var weekStart = now.Date.AddDays(-(int)now.DayOfWeek).ToUniversalTime();
        var recentWindow = now.AddDays(-30);

        // Exclude student-role rows, consistent with the list endpoint.
        var baseQuery = db.AuditLogs.Where(x => x.ActorRole != Roles.Student);

        var total = await baseQuery.CountAsync(cancellationToken);
        var today = await baseQuery.CountAsync(x => x.CreatedAtUtc >= todayStart, cancellationToken);
        var week  = await baseQuery.CountAsync(x => x.CreatedAtUtc >= weekStart,  cancellationToken);
        var activeAdmins = await baseQuery
            .Where(x => x.CreatedAtUtc >= recentWindow && x.ActorUserId.HasValue)
            .Select(x => x.ActorUserId)
            .Distinct()
            .CountAsync(cancellationToken);

        return new AuditLogStatsDto(total, today, week, activeAdmins);
    }

    // ── GET /api/audit-logs/{id} — single log detail ─────────────────────

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AuditLogDetailDto>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var log = await db.AuditLogs
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new AuditLogDetailDto(
                x.Id,
                x.CreatedAtUtc,
                x.Actor,
                x.ActorUserId,
                x.ActorRole,
                x.Module,
                x.Action,
                x.EntityType,
                x.EntityId,
                x.Description,
                x.OldValues,
                x.NewValues,
                x.IpAddress,
                x.UserAgent,
                x.IsSuccess))
            .FirstOrDefaultAsync(cancellationToken);

        if (log is null) return NotFound();
        return log;
    }

    // ── GET /api/audit-logs/export — CSV export (honours filters) ────────

    [HttpGet("export")]
    public async Task<IActionResult> Export(
        [FromQuery] string? module,
        [FromQuery] string? action,
        [FromQuery] Guid? actorUserId,
        [FromQuery] string? role,
        [FromQuery] string? entityType,
        [FromQuery] string? search,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] bool? isSuccess,
        CancellationToken cancellationToken)
    {
        var query = db.AuditLogs.AsNoTracking().AsQueryable();

        // Exclude student-role rows — same policy as the paginated endpoint.
        query = query.Where(x => x.ActorRole != Roles.Student);

        if (!string.IsNullOrWhiteSpace(module) && module != "All")
            query = query.Where(x => x.Module == module);
        if (!string.IsNullOrWhiteSpace(action))
            query = query.Where(x => x.Action == action);
        if (actorUserId.HasValue)
            query = query.Where(x => x.ActorUserId == actorUserId);
        if (!string.IsNullOrWhiteSpace(role))
            query = query.Where(x => x.ActorRole == role);
        if (!string.IsNullOrWhiteSpace(entityType))
            query = query.Where(x => x.EntityType == entityType);
        if (isSuccess.HasValue)
            query = query.Where(x => x.IsSuccess == isSuccess.Value);
        if (fromDate.HasValue)
            query = query.Where(x => x.CreatedAtUtc >= fromDate.Value.ToUniversalTime());
        if (toDate.HasValue)
        {
            var end = toDate.Value.Date.AddDays(1).ToUniversalTime();
            query = query.Where(x => x.CreatedAtUtc < end);
        }
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(x =>
                x.Actor.ToLower().Contains(s) ||
                x.ActorRole.ToLower().Contains(s) ||
                x.Description.ToLower().Contains(s) ||
                (x.EntityId != null && x.EntityId.ToLower().Contains(s)));
        }

        var rows = await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(10_000) // safety cap for export
            .Select(x => new
            {
                x.Id,
                x.CreatedAtUtc,
                x.Actor,
                x.ActorRole,
                x.Module,
                x.Action,
                x.EntityType,
                x.EntityId,
                x.Description,
                x.IsSuccess,
            })
            .ToListAsync(cancellationToken);

        var sb = new StringBuilder();
        sb.AppendLine("Id,Timestamp (UTC),Admin,Role,Module,Action,Entity Type,Entity Id,Description,Success");
        foreach (var r in rows)
        {
            sb.AppendLine(string.Join(',',
                CsvEscape(r.Id.ToString()),
                CsvEscape(r.CreatedAtUtc.ToString("yyyy-MM-dd HH:mm:ss")),
                CsvEscape(r.Actor),
                CsvEscape(r.ActorRole),
                CsvEscape(r.Module),
                CsvEscape(r.Action),
                CsvEscape(r.EntityType),
                CsvEscape(r.EntityId ?? ""),
                CsvEscape(r.Description),
                r.IsSuccess ? "Yes" : "No"));
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        var filename = $"audit-logs-{DateTime.UtcNow:yyyyMMdd-HHmm}.csv";
        return File(bytes, "text/csv", filename);
    }

    private static string CsvEscape(string value)
    {
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n'))
            return $"\"{value.Replace("\"", "\"\"")}\"";
        return value;
    }
}
