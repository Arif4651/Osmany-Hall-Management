using HallBackend.Application.Dtos;
using HallBackend.Domain.Constants;
using HallBackend.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Controllers;

// Roles.Admin ("admin") matches no account that can actually exist: DataSeeder migrates every
// legacy "admin" user to male_wing_admin on startup, and new admins are only ever created as
// male_wing_admin/female_wing_admin (AdminSettingsController) or super_admin (seeded). The audit
// trail spans both wings, so — like role management — it is a super-admin-only view rather than
// something scoped per wing.
[ApiController]
[Authorize(Roles = Roles.SuperAdmin)]
[Route("api/audit-logs")]
public sealed class AuditLogsController(HallDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<AuditLogListResponse>> Get([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.AuditLogs.AsNoTracking().OrderByDescending(x => x.Date);
        var total = await query.CountAsync(cancellationToken);
        var totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize));
        page = Math.Min(page, totalPages);

        var items = await query.Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new AuditLogDto(x.Id, x.Actor, x.Action, x.Module, x.Date))
            .ToListAsync(cancellationToken);

        return new AuditLogListResponse(items, page, pageSize, total, totalPages);
    }
}
