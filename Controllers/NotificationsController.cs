using HallBackend.Application.Dtos;
using HallBackend.Application.Services;
using HallBackend.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Controllers;

[ApiController]
[Authorize]
[Route("api/notifications")]
public sealed class NotificationsController(HallDbContext db, CurrentUserService currentUser) : ControllerBase
{
    /// <summary>
    /// The caller's own notifications. Previously took an arbitrary <c>studentId</c> straight
    /// from the route with no ownership check, so any authenticated user could read any other
    /// student's notifications by guessing or harvesting an id from another response.
    /// </summary>
    [HttpGet("me")]
    public async Task<IReadOnlyList<NotificationDto>> GetMine(CancellationToken cancellationToken)
    {
        var studentId = await currentUser.GetStudentIdAsync(cancellationToken);
        return await db.Notifications.AsNoTracking()
            .Where(x => x.StudentId == studentId || x.StudentId == null)
            .OrderByDescending(x => x.Date)
            .Select(x => new NotificationDto(x.Id, x.Title, x.Description, x.Date, x.IsRead))
            .ToListAsync(cancellationToken);
    }
}
