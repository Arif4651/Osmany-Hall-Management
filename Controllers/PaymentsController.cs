using HallBackend.Application.Mapping;
using HallBackend.Domain.Constants;
using HallBackend.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Controllers;

[ApiController]
[Authorize]
[Route("api/payments")]
public sealed class PaymentsController(HallDbContext db) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        var payments = await db.Payments.AsNoTracking().Include(x => x.Student).Include(x => x.Bill).OrderByDescending(x => x.SubmittedAt).Select(x => x.ToDto()).ToListAsync(cancellationToken);
        return Ok(payments);
    }

    [HttpGet("student/{studentId:guid}")]
    public async Task<IActionResult> GetForStudent(Guid studentId, CancellationToken cancellationToken)
    {
        var payments = await db.Payments.AsNoTracking().Include(x => x.Student).Include(x => x.Bill).Where(x => x.StudentId == studentId).OrderByDescending(x => x.SubmittedAt).Select(x => x.ToDto()).ToListAsync(cancellationToken);
        return Ok(payments);
    }

    [HttpPost("{id:guid}/verify")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Verify(Guid id, CancellationToken cancellationToken)
    {
        var payment = await db.Payments.Include(x => x.Bill).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (payment is null) return NotFound();
        payment.Status = "verified";
        if (payment.Bill is not null) payment.Bill.Status = "paid";
        await db.SaveChangesAsync(cancellationToken);
        return Ok(payment.ToDto());
    }
}
