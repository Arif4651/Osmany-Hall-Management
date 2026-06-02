using System.Security.Claims;
using HallBackend.Application.Dtos;
using HallBackend.Application.Mapping;
using HallBackend.Domain.Constants;
using HallBackend.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Controllers;

[ApiController]
[Authorize(Roles = Roles.Student)]
[Route("api/student/profile")]
public sealed class StudentProfileController(HallDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<StudentDto>> Get(CancellationToken cancellationToken)
    {
        var student = await GetCurrentStudent(cancellationToken);
        return student is null ? NotFound(new { message = "Student profile was not found." }) : student.ToDto();
    }

    [HttpPut]
    public async Task<ActionResult<StudentDto>> Update(StudentProfileUpdateRequest request, CancellationToken cancellationToken)
    {
        var student = await GetCurrentStudent(cancellationToken);
        if (student is null)
        {
            return NotFound(new { message = "Student profile was not found." });
        }

        if (!string.IsNullOrWhiteSpace(request.MobileNumber))
        {
            student.MobileNumber = request.MobileNumber.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.RoomNo))
        {
            student.RoomNo = request.RoomNo.Trim();
        }

        await db.SaveChangesAsync(cancellationToken);
        return student.ToDto();
    }

    private async Task<Domain.Entities.Student?> GetCurrentStudent(CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdClaim, out var userId))
        {
            return null;
        }

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
        if (user?.StudentId is null)
        {
            return null;
        }

        return await db.Students.FirstOrDefaultAsync(x => x.Id == user.StudentId.Value, cancellationToken);
    }
}
