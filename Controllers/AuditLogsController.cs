using HallBackend.Application.Dtos;
using HallBackend.Domain.Constants;
using HallBackend.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Controllers;

[ApiController]
[Authorize(Roles = Roles.Admin)]
[Route("api/audit-logs")]
public sealed class AuditLogsController(HallDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IReadOnlyList<AuditLogDto>> Get(CancellationToken cancellationToken)
    {
        return await db.AuditLogs.AsNoTracking().OrderByDescending(x => x.Date).Select(x => new AuditLogDto(x.Id, x.Actor, x.Action, x.Module, x.Date)).ToListAsync(cancellationToken);
    }
}
