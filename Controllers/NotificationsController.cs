using HallBackend.Application.Dtos;
using HallBackend.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Controllers;

[ApiController]
[Authorize]
[Route("api/notifications")]
public sealed class NotificationsController(HallDbContext db) : ControllerBase
{
    [HttpGet("student/{studentId:guid}")]
    public async Task<IReadOnlyList<NotificationDto>> GetForStudent(Guid studentId, CancellationToken cancellationToken)
    {
        return await db.Notifications.AsNoTracking()
            .Where(x => x.StudentId == studentId || x.StudentId == null)
            .OrderByDescending(x => x.Date)
            .Select(x => new NotificationDto(x.Id, x.Title, x.Description, x.Date, x.IsRead))
            .ToListAsync(cancellationToken);
    }
}
