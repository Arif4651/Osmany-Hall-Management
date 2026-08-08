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
[Route("api/notices")]
public sealed class NoticeController(HallDbContext db, CurrentUserService currentUser, Microsoft.AspNetCore.OutputCaching.IOutputCacheStore cacheStore) : ControllerBase
{
    [HttpGet]
    [Microsoft.AspNetCore.OutputCaching.OutputCache(PolicyName = "notices-cache", Tags = ["notices"])]
    public async Task<ActionResult<IReadOnlyList<NoticeDto>>> Get(CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId;
        var user = await db.Users.AsNoTracking()
            .Include(x => x.Student)
            .FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);

        if (user is null) return Unauthorized();

        IQueryable<Notice> query = db.Notices.AsNoTracking().Include(x => x.CreatedBy);

        if (user.Role == Roles.Student)
        {
            var studentGender = user.Student?.Gender;
            if (string.IsNullOrWhiteSpace(studentGender))
            {
                return BadRequest(new { message = "Student gender context is missing." });
            }
            query = query.Where(x => x.TargetWing == studentGender || x.TargetWing == "All");
        }
        else if (user.Role == Roles.MaleWingAdmin)
        {
            query = query.Where(x => x.TargetWing == "Male" || x.TargetWing == "All");
        }
        else if (user.Role == Roles.FemaleWingAdmin)
        {
            query = query.Where(x => x.TargetWing == "Female" || x.TargetWing == "All");
        }
        // SuperAdmin / Admin can see all notices

        var notices = await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .Select(x => new NoticeDto(
                x.Id,
                x.Title,
                x.Content,
                x.TargetWing,
                x.CreatedById,
                x.CreatedBy != null ? x.CreatedBy.FullName : "System",
                x.CreatedAtUtc,
                x.UpdatedAtUtc))
            .ToListAsync(cancellationToken);

        return Ok(notices);
    }

    [HttpPost]
    [RequirePermission(MenuKeys.AdminNoticeBoard, PermissionActions.Create)]
    public async Task<ActionResult<NoticeDto>> Create(CreateNoticeRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 200)
            return BadRequest(new { message = "Title is required and must be under 200 characters." });

        if (string.IsNullOrWhiteSpace(request.Content) || request.Content.Length > 4000)
            return BadRequest(new { message = "Content is required and must be under 4000 characters." });

        if (request.TargetWing is not ("All" or "Male" or "Female"))
            return BadRequest(new { message = "Target wing must be All, Male, or Female." });

        var userId = currentUser.UserId;
        var user = await db.Users.FindAsync([userId], cancellationToken);
        if (user is null) return Unauthorized();

        // Scoped Validation for Wing Admins
        if (user.Role == Roles.MaleWingAdmin && request.TargetWing != "Male")
        {
            return Forbid();
        }
        if (user.Role == Roles.FemaleWingAdmin && request.TargetWing != "Female")
        {
            return Forbid();
        }

        var notice = new Notice
        {
            Title = request.Title.Trim(),
            Content = request.Content.Trim(),
            TargetWing = request.TargetWing,
            CreatedById = userId
        };

        db.Notices.Add(notice);
        await db.SaveChangesAsync(cancellationToken);
        await cacheStore.EvictByTagAsync("notices", cancellationToken);

        var creatorName = user.FullName;

        return CreatedAtAction(nameof(Get), new { id = notice.Id }, new NoticeDto(
            notice.Id,
            notice.Title,
            notice.Content,
            notice.TargetWing,
            notice.CreatedById,
            creatorName,
            notice.CreatedAtUtc,
            notice.UpdatedAtUtc));
    }

    [HttpPut("{id:guid}")]
    [RequirePermission(MenuKeys.AdminNoticeBoard, PermissionActions.Edit)]
    public async Task<IActionResult> Update(Guid id, UpdateNoticeRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 200)
            return BadRequest(new { message = "Title is required and must be under 200 characters." });

        if (string.IsNullOrWhiteSpace(request.Content) || request.Content.Length > 4000)
            return BadRequest(new { message = "Content is required and must be under 4000 characters." });

        if (request.TargetWing is not ("All" or "Male" or "Female"))
            return BadRequest(new { message = "Target wing must be All, Male, or Female." });

        var notice = await db.Notices.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (notice is null) return NotFound();

        var userId = currentUser.UserId;
        var user = await db.Users.FindAsync([userId], cancellationToken);
        if (user is null) return Unauthorized();

        // Scoped Validation for Wing Admins
        if (user.Role == Roles.MaleWingAdmin)
        {
            if (notice.TargetWing != "Male" || request.TargetWing != "Male")
            {
                return Forbid();
            }
        }
        if (user.Role == Roles.FemaleWingAdmin)
        {
            if (notice.TargetWing != "Female" || request.TargetWing != "Female")
            {
                return Forbid();
            }
        }

        notice.Title = request.Title.Trim();
        notice.Content = request.Content.Trim();
        notice.TargetWing = request.TargetWing;

        await db.SaveChangesAsync(cancellationToken);
        await cacheStore.EvictByTagAsync("notices", cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission(MenuKeys.AdminNoticeBoard, PermissionActions.Delete)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var notice = await db.Notices.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (notice is null) return NotFound();

        var userId = currentUser.UserId;
        var user = await db.Users.FindAsync([userId], cancellationToken);
        if (user is null) return Unauthorized();

        // Scoped Validation for Wing Admins
        if (user.Role == Roles.MaleWingAdmin && notice.TargetWing != "Male")
        {
            return Forbid();
        }
        if (user.Role == Roles.FemaleWingAdmin && notice.TargetWing != "Female")
        {
            return Forbid();
        }

        db.Notices.Remove(notice);
        await db.SaveChangesAsync(cancellationToken);
        await cacheStore.EvictByTagAsync("notices", cancellationToken);
        return NoContent();
    }
}
