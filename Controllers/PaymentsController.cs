using HallBackend.Application.Dtos;
using HallBackend.Application.Services;
using HallBackend.Domain.Constants;
using HallBackend.Domain.Entities;
using HallBackend.Infrastructure.Data;
using HallBackend.Infrastructure.Authorization;
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
    ILogger<PaymentsController> logger,
    AuditLogService audit,
    IHttpContextAccessor httpContextAccessor) : ControllerBase
{
    private Task<AuditLogContext> BuildCtxAsync(CancellationToken ct)
        => AuditLogContextFactory.BuildAsync(httpContextAccessor, db, AuditModules.PaymentVerification, ct);
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
        return await db.PaymentSubmissions.AsNoTracking()
            .Where(x => x.StudentId == studentId)
            .OrderByDescending(x => x.SubmittedAtUtc)
            .Select(x => new PaymentSubmissionDto(
                x.Id,
                x.StudentId,
                x.Student != null ? x.Student.StudentName : string.Empty,
                x.Student != null ? x.Student.RollNumber : string.Empty,
                x.Student != null ? x.Student.HallId : string.Empty,
                x.Student != null ? x.Student.Gender : string.Empty,
                x.CategoryId,
                x.Category != null ? x.Category.Name : string.Empty,
                x.BillingMonth,
                x.BillingYear,
                x.SubmittedAmount,
                x.SubmittedCharge,
                x.ApprovedAmount,
                x.TransactionId,
                x.Status,
                x.SubmittedAtUtc,
                x.ReviewedAtUtc
            ))
            .ToListAsync(cancellationToken);
    }

    [HttpPost]
    public async Task<ActionResult<PaymentSubmissionDto>> Submit(SubmitPaymentRequest request, CancellationToken cancellationToken)
    {
        var studentId = await currentUser.GetStudentIdAsync(cancellationToken);
        // Students no longer choose a billing period — they kept forgetting to. Payments are
        // allocated oldest-first when bills are calculated, so the period stored here is only the
        // month the payment was filed in, kept for the record.
        var today = HallClock.Today;
        if (request.Amount <= 0m || request.Charges < 0m || string.IsNullOrWhiteSpace(request.TransactionId))
            return BadRequest(new { message = "Enter valid payment details." });
        if (!await db.PaymentCategories.AnyAsync(x => x.Id == request.CategoryId && x.IsActive, cancellationToken))
            return BadRequest(new { message = "Payment category is not active." });
        var row = new PaymentSubmission
        {
            StudentId = studentId,
            CategoryId = request.CategoryId,
            BillingMonth = today.Month,
            BillingYear = today.Year,
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
    [RequirePermission(MenuKeys.AdminPayments, PermissionActions.View)]
    public async Task<ActionResult<PaymentListResponse>> GetAll(
        [FromQuery] string? gender,
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] int? month,
        [FromQuery] int? year,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.PaymentSubmissions.AsNoTracking();
        // Wing-locked for a wing admin, same as Bill Management and Due Bill — a wing admin no
        // longer has a "switch to the other wing" option on Payment Verification.
        var wingFilter = await currentUser.GetOwnWingFilterAsync(gender, cancellationToken);
        if (wingFilter is not null) query = query.Where(x => x.Student!.Gender == wingFilter);

        if (!string.IsNullOrWhiteSpace(status) && status.Trim().ToLowerInvariant() != "all")
        {
            var statusNorm = status.Trim().ToLowerInvariant().Replace(" ", "_");
            if (statusNorm == "pending" || statusNorm == "under_review" || statusNorm == "under review")
            {
                query = query.Where(x => x.Status == "under_review");
            }
            else
            {
                query = query.Where(x => x.Status == statusNorm);
            }
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            // ILIKE (not ToLower().Contains) so the gin_trgm_ops indexes can be used.
            var pattern = SearchPattern.Contains(search);
            query = query.Where(x =>
                EF.Functions.ILike(x.Student!.RollNumber, pattern, SearchPattern.EscapeCharacter)
                || EF.Functions.ILike(x.Student!.HallId, pattern, SearchPattern.EscapeCharacter)
                || EF.Functions.ILike(x.Student!.StudentName, pattern, SearchPattern.EscapeCharacter)
                || EF.Functions.ILike(x.TransactionId, pattern, SearchPattern.EscapeCharacter)
            );
        }

        if (month is not null)
        {
            if (month.Value is < 1 or > 12) return BadRequest(new { message = "Month must be between 1 and 12." });
            query = query.Where(x => x.BillingMonth == month.Value);
        }

        if (year is not null)
        {
            var currentYear = HallClock.Today.Year;
            if (year.Value < 2000 || year.Value > currentYear) return BadRequest(new { message = "Enter a valid billing year." });
            query = query.Where(x => x.BillingYear == year.Value);
        }

        if (month is not null && year is not null)
        {
            var today = HallClock.Today;
            if (year.Value == today.Year && month.Value > today.Month)
                return BadRequest(new { message = "Billing period cannot be in the future." });
        }

        var total = await query.CountAsync(cancellationToken);
        var totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize));
        page = Math.Min(page, totalPages);

        var items = await query
            .OrderByDescending(x => x.SubmittedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new PaymentSubmissionDto(
                x.Id,
                x.StudentId,
                x.Student != null ? x.Student.StudentName : string.Empty,
                x.Student != null ? x.Student.RollNumber : string.Empty,
                x.Student != null ? x.Student.HallId : string.Empty,
                x.Student != null ? x.Student.Gender : string.Empty,
                x.CategoryId,
                x.Category != null ? x.Category.Name : string.Empty,
                x.BillingMonth,
                x.BillingYear,
                x.SubmittedAmount,
                x.SubmittedCharge,
                x.ApprovedAmount,
                x.TransactionId,
                x.Status,
                x.SubmittedAtUtc,
                x.ReviewedAtUtc
            ))
            .ToListAsync(cancellationToken);

        return new PaymentListResponse(items, page, pageSize, total, totalPages);
    }

    [HttpPost("{id:guid}/review")]
    [RequirePermission(MenuKeys.AdminPayments, PermissionActions.Edit)]
    public async Task<ActionResult<PaymentSubmissionDto>> Review(Guid id, ReviewPaymentRequest request, CancellationToken cancellationToken)
    {
        var action = request.Action.Trim().ToLowerInvariant();
        if (action is not ("approve" or "reject")) return BadRequest(new { message = "Action must be approve or reject." });
        if (request.ApprovedAmount < 0m) return BadRequest(new { message = "Approved amount cannot be negative." });
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var row = await db.PaymentSubmissions.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null) return NotFound();
        var studentWing = await db.Students.AsNoTracking()
            .Where(x => x.Id == row.StudentId)
            .Select(x => x.Gender)
            .FirstOrDefaultAsync(cancellationToken);
        if (!await currentUser.CanManageOwnWingFinanceAsync(studentWing, cancellationToken)) return Forbid();
        if (row.Status != "under_review") return Conflict(new { message = "This payment has already been reviewed." });

        row.Status = action == "approve" ? "approved" : "rejected";
        row.ReviewedById = currentUser.UserId;
        row.ReviewedAtUtc = DateTime.UtcNow;
        row.ApprovedAmount = action == "approve"
            ? request.ApprovedAmount ?? row.SubmittedAmount
            : null;
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var billsRecalculated = true;
        if (action == "approve")
        {
            billsRecalculated = await RebuildBillsAsync(row);
        }

        var saved = await Query().FirstAsync(x => x.Id == id, cancellationToken);

        var ctx = await BuildCtxAsync(cancellationToken);
        var auditAction = action == "approve" ? AuditActions.Approve : AuditActions.Reject;
        await audit.LogAsync(ctx, auditAction, "PaymentSubmission", row.Id.ToString(),
            $"{auditAction} payment of {(row.ApprovedAmount ?? row.SubmittedAmount):F2} BDT (TxID: {row.TransactionId}) for {saved.Student?.StudentName} ({saved.Student?.RollNumber})",
            newValues: new { Status = row.Status, ApprovedAmount = row.ApprovedAmount, TransactionId = row.TransactionId },
            cancellationToken: CancellationToken.None);

        return ToDto(saved) with { BillsRecalculated = billsRecalculated };
    }

    /// <summary>
    /// Corrects the approved amount of an already-approved payment (e.g. the admin typed the
    /// wrong figure at approval). Bills are rebuilt from the payment's month forward so the due
    /// balance reflects the corrected amount.
    /// </summary>
    [HttpPut("{id:guid}/approved-amount")]
    [RequirePermission(MenuKeys.AdminPayments, PermissionActions.Edit)]
    public async Task<ActionResult<PaymentSubmissionDto>> UpdateApprovedAmount(Guid id, UpdateApprovedAmountRequest request, CancellationToken cancellationToken)
    {
        if (request.ApprovedAmount < 0m) return BadRequest(new { message = "Approved amount cannot be negative." });
        var newAmount = decimal.Round(request.ApprovedAmount, 2);

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var row = await db.PaymentSubmissions.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null) return NotFound();
        var studentWing = await db.Students.AsNoTracking()
            .Where(x => x.Id == row.StudentId)
            .Select(x => x.Gender)
            .FirstOrDefaultAsync(cancellationToken);
        if (!await currentUser.CanManageOwnWingFinanceAsync(studentWing, cancellationToken)) return Forbid();
        if (row.Status != "approved") return Conflict(new { message = "Only approved payments can have their amount edited." });

        var oldAmount = row.ApprovedAmount;
        if (oldAmount == newAmount) return ToDto(await Query().FirstAsync(x => x.Id == id, cancellationToken));

        row.ApprovedAmount = newAmount;
        row.ReviewedById = currentUser.UserId;
        row.ReviewedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var billsRecalculated = await RebuildBillsAsync(row);

        var saved = await Query().FirstAsync(x => x.Id == id, cancellationToken);

        var ctx = await BuildCtxAsync(cancellationToken);
        await audit.LogAsync(ctx, AuditActions.Update, "PaymentSubmission", row.Id.ToString(),
            $"Corrected approved amount from {(oldAmount ?? 0m):F2} to {newAmount:F2} BDT (TxID: {row.TransactionId}) for {saved.Student?.StudentName} ({saved.Student?.RollNumber})",
            oldValues: new { ApprovedAmount = oldAmount },
            newValues: new { ApprovedAmount = newAmount, TransactionId = row.TransactionId },
            cancellationToken: CancellationToken.None);

        return ToDto(saved) with { BillsRecalculated = billsRecalculated };
    }

    /// <summary>
    /// Rebuilds every month's FIFO allocation after a payment change. The approval is already
    /// committed, so a failure here must not surface as a failed approval (that invited a second
    /// approval of the same payment); it is reported through <c>BillsRecalculated</c> instead.
    ///
    /// Deliberately not tied to the request's cancellation token: closing the tab or refreshing
    /// used to abort the rebuild halfway through the month chain, leaving the later months stale.
    /// </summary>
    private async Task<bool> RebuildBillsAsync(PaymentSubmission row)
    {
        for (var attempt = 1; attempt <= 2; attempt++)
        {
            try
            {
                // A failed attempt can leave half-written cache rows tracked; start clean.
                db.ChangeTracker.Clear();
                await billing.RecalculateFromEarliestAsync(row.BillingMonth, row.BillingYear, CancellationToken.None);
                return true;
            }
            catch (Exception error)
            {
                logger.LogError(
                    error,
                    "Payment {PaymentId} was saved, but rebuilding the bills for {Month}/{Year} failed (attempt {Attempt}).",
                    row.Id, row.BillingMonth, row.BillingYear, attempt);
            }
        }
        return false;
    }

    private IQueryable<PaymentSubmission> Query()
        => db.PaymentSubmissions.AsNoTracking().Include(x => x.Student).Include(x => x.Category);

    private static PaymentSubmissionDto ToDto(PaymentSubmission x)
        => new(x.Id, x.StudentId, x.Student?.StudentName ?? string.Empty, x.Student?.RollNumber ?? string.Empty,
            x.Student?.HallId ?? string.Empty, x.Student?.Gender ?? string.Empty, x.CategoryId, x.Category?.Name ?? string.Empty,
            x.BillingMonth, x.BillingYear, x.SubmittedAmount, x.SubmittedCharge, x.ApprovedAmount, x.TransactionId,
            x.Status, x.SubmittedAtUtc, x.ReviewedAtUtc);
}
