using HallBackend.Application.Mapping;
using HallBackend.Domain.Constants;
using HallBackend.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Controllers;

[ApiController]
[Authorize]
[Route("api/billing")]
public sealed class BillingController(HallDbContext db) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        var bills = await db.Bills.AsNoTracking().Include(x => x.Student).OrderByDescending(x => x.DueDate).Select(x => x.ToDto()).ToListAsync(cancellationToken);
        return Ok(bills);
    }

    [HttpGet("student/{studentId:guid}")]
    public async Task<IActionResult> GetForStudent(Guid studentId, CancellationToken cancellationToken)
    {
        var bills = await db.Bills.AsNoTracking().Where(x => x.StudentId == studentId).OrderByDescending(x => x.DueDate).Select(x => x.ToDto()).ToListAsync(cancellationToken);
        return Ok(bills);
    }
}
