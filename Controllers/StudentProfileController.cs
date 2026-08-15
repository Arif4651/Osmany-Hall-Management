using System.Security.Claims;
using System.Text.RegularExpressions;
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
    // Same rule StudentsController applies on the admin side — a phone number typed here must
    // meet the same bar as one an admin enters.
    private static readonly Regex PhoneRegex = new("^\\+?\\d{10,15}$", RegexOptions.Compiled);

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

        // Room allocation is hall administration, not self-declared: it feeds the meal sheet's
        // physical ordering and where the kitchen expects to find a student, so only an admin
        // (StudentsController) may change it. RoomNo was previously accepted here unchecked.
        if (!string.IsNullOrWhiteSpace(request.MobileNumber))
        {
            var normalized = Regex.Replace(request.MobileNumber, "\\s+", "");
            if (!PhoneRegex.IsMatch(normalized))
            {
                return BadRequest(new { message = "Enter a valid mobile number with 10-15 digits." });
            }
            student.MobileNumber = request.MobileNumber.Trim();
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
