using HallBackend.Application.Dtos;
using HallBackend.Application.Services;
using HallBackend.Domain.Constants;
using HallBackend.Infrastructure.Data;
using HallBackend.Infrastructure.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Controllers;

[ApiController]
[Authorize]
[RequirePermission(MenuKeys.AdminStudents, PermissionActions.View)]
[Route("api/admin/students")]
public sealed class AdminStudentSearchController(HallDbContext db, CurrentUserService currentUser) : ControllerBase
{
    [HttpGet("search")]
    public async Task<IReadOnlyList<StudentSearchResultDto>> Search(
        [FromQuery] string? q,
        [FromQuery] string? wing,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(q)) return [];
        var term = q.Trim().ToLower();
        var query = db.Students.AsNoTracking();
        var adminWing = await currentUser.GetAdminWingAsync(cancellationToken);
        var selectedWing = !string.IsNullOrWhiteSpace(adminWing)
            ? adminWing
            : (wing is "Female" ? "Female" : wing is "Male" ? "Male" : null);
        if (!string.IsNullOrWhiteSpace(selectedWing)) query = query.Where(x => x.Gender == selectedWing);
        return await query
            .Where(x => x.StudentName.ToLower().Contains(term)
                || x.RollNumber.ToLower().Contains(term)
                || x.HallId.ToLower().Contains(term)
                || x.StudentId.ToLower().Contains(term))
            .OrderBy(x => x.StudentName)
            .Take(10)
            .Select(x => new StudentSearchResultDto(x.Id, x.StudentName, x.RollNumber, x.HallId, x.StudentId))
            .ToListAsync(cancellationToken);
    }
}
