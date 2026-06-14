using HallBackend.Application.Dtos;
using HallBackend.Application.Services;
using HallBackend.Domain.Constants;
using HallBackend.Domain.Entities;
using HallBackend.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace HallBackend.Controllers;

[ApiController]
[Authorize]
[Route("api/payments")]
public sealed class PaymentsController(
    HallDbContext db,
    CurrentUserService currentUser,
    BillingCalculationService billing,
    BillingPeriodService periods) : ControllerBase
{
    [HttpGet("categories")]
    public async Task<IReadOnlyList<PaymentCategoryDto>> GetCategories([FromQuery] bool includeInactive = false, CancellationToken cancellationToken = default)
        => await db.PaymentCategories.AsNoTracking()
            .Where(x => includeInactive || x.IsActive)
            .OrderBy(x => x.Name)
            .Select(x => new PaymentCategoryDto(x.Id, x.Name))
            .ToListAsync(cancellationToken);

    [HttpGet("me")]
    public async Task<IReadOnlyList<PaymentSubmissionDto>> GetMine(CancellationToken cancellationToken)
    {
        var studentId = await currentUser.GetStudentIdAsync(cancellationToken);
        var rows = await Query().Where(x => x.StudentId == studentId).OrderByDescending(x => x.SubmittedAtUtc)
            .ToListAsync(cancellationToken);
        return rows.Select(ToDto).ToList();
    }

    [HttpPost]
    public async Task<ActionResult<PaymentSubmissionDto>> Submit(SubmitPaymentRequest request, CancellationToken cancellationToken)
    {
        var studentId = await currentUser.GetStudentIdAsync(cancellationToken);
        if (request.Amount <= 0m || request.Charges < 0m || string.IsNullOrWhiteSpace(request.TransactionId)
            || request.BillingMonth is < 1 or > 12)
            return BadRequest(new { message = "Enter valid payment details." });
        if (await periods.IsLockedAsync(request.BillingMonth, request.BillingYear, cancellationToken))
            return StatusCode(403, new { message = "Billing period is closed." });
        if (!await db.PaymentCategories.AnyAsync(x => x.Id == request.CategoryId && x.IsActive, cancellationToken))
            return BadRequest(new { message = "Payment category is not active." });
        var row = new PaymentSubmission
        {
            StudentId = studentId,
            CategoryId = request.CategoryId,
            BillingMonth = request.BillingMonth,
            BillingYear = request.BillingYear,
            SubmittedAmount = request.Amount,
            SubmittedCharge = request.Charges,
            TransactionId = request.TransactionId.Trim(),
        };
        db.PaymentSubmissions.Add(row);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException postgres && postgres.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            return Conflict(new { message = "This transaction ID has already been submitted for this payment method." });
        }
        var saved = await Query().FirstAsync(x => x.Id == row.Id, cancellationToken);
        return CreatedAtAction(nameof(GetMine), ToDto(saved));
    }

    [HttpGet("admin")]
    [HttpGet]
    [Authorize(Roles = Roles.HallAdministrators)]
    public async Task<IReadOnlyList<PaymentSubmissionDto>> GetAll([FromQuery] string? gender, CancellationToken cancellationToken)
    {
        var query = Query();
        var adminWing = await currentUser.GetAdminWingAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(adminWing)) query = query.Where(x => x.Student!.Gender == adminWing);
        else if (gender is "Male" or "Female") query = query.Where(x => x.Student!.Gender == gender);
        var rows = await query.OrderByDescending(x => x.SubmittedAtUtc).ToListAsync(cancellationToken);
        return rows.Select(ToDto).ToList();
    }

    [HttpPost("{id:guid}/review")]
    [Authorize(Roles = Roles.HallAdministrators)]
    public async Task<ActionResult<PaymentSubmissionDto>> Review(Guid id, ReviewPaymentRequest request, CancellationToken cancellationToken)
    {
        var action = request.Action.Trim().ToLowerInvariant();
        if (action is not ("approve" or "reject")) return BadRequest(new { message = "Action must be approve or reject." });
        if (request.ApprovedAmount < 0m) return BadRequest(new { message = "Approved amount cannot be negative." });
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var row = await db.PaymentSubmissions.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null) return NotFound();
        var adminWing = await currentUser.GetAdminWingAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(adminWing)
            && !await db.Students.AnyAsync(x => x.Id == row.StudentId && x.Gender == adminWing, cancellationToken))
            return Forbid();
        if (row.Status != "under_review") return Conflict(new { message = "This payment has already been reviewed." });
        if (await periods.IsLockedAsync(row.BillingMonth, row.BillingYear, cancellationToken))
            return StatusCode(403, new { message = "Billing period is closed." });

        row.Status = action == "approve" ? "approved" : "rejected";
        row.ReviewedById = currentUser.UserId;
        row.ReviewedAtUtc = DateTime.UtcNow;
        row.ApprovedAmount = action == "approve"
            ? request.ApprovedAmount ?? row.SubmittedAmount
            : null;
        await db.SaveChangesAsync(cancellationToken);
        if (action == "approve") await billing.RecalculateForwardAsync(row.BillingMonth, row.BillingYear, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        var saved = await Query().FirstAsync(x => x.Id == id, cancellationToken);
        return ToDto(saved);
    }

    private IQueryable<PaymentSubmission> Query()
        => db.PaymentSubmissions.AsNoTracking().Include(x => x.Student).Include(x => x.Category);

    private static PaymentSubmissionDto ToDto(PaymentSubmission x)
        => new(x.Id, x.StudentId, x.Student?.StudentName ?? string.Empty, x.Student?.RollNumber ?? string.Empty,
            x.Student?.HallId ?? string.Empty, x.Student?.Gender ?? string.Empty, x.CategoryId, x.Category?.Name ?? string.Empty,
            x.BillingMonth, x.BillingYear, x.SubmittedAmount, x.SubmittedCharge, x.ApprovedAmount, x.TransactionId,
            x.Status, x.SubmittedAtUtc, x.ReviewedAtUtc);
}
