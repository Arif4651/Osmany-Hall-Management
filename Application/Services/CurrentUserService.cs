using System.Security.Claims;
using HallBackend.Domain.Constants;
using HallBackend.Domain.Entities;
using HallBackend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Application.Services;

public sealed class CurrentUserService(IHttpContextAccessor accessor, HallDbContext db)
{
    public Guid UserId
    {
        get
        {
            var value = accessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier);
            return Guid.TryParse(value, out var id) ? id : throw new UnauthorizedAccessException();
        }
    }

    public async Task<Guid> GetStudentIdAsync(CancellationToken cancellationToken)
    {
        var studentId = await db.Users.AsNoTracking()
            .Where(x => x.Id == UserId && x.StudentId.HasValue)
            .Select(x => x.StudentId)
            .FirstOrDefaultAsync(cancellationToken);
        return studentId ?? throw new UnauthorizedAccessException("A student account is required.");
    }

    public async Task<string?> GetAdminWingAsync(CancellationToken cancellationToken)
        => await db.Users.AsNoTracking()
            .Where(x => x.Id == UserId)
            .Select(x => x.Wing)
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<string> GetManagedWingAsync(string? requestedWing, CancellationToken cancellationToken)
    {
        var userWing = await GetAdminWingAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(userWing)) return userWing;
        return requestedWing is "Female" ? "Female" : "Male";
    }

    // ── Finance wing scoping ──────────────────────────────────────────────────
    // Payment Verification used to be the one hall-wide financial screen a listed role
    // (male_wing_admin) could switch wings on — every other financial screen (Bill Management,
    // Due Bill) was already wing-locked. That exception let a wing admin see and act on the
    // other wing's payment submissions, so it has been removed: every financial screen now
    // behaves like Students, Meals and Inventory — wing-locked via GetAdminWingAsync for a wing
    // admin, open to every wing only for a genuinely wing-less role (admin/super_admin).

    /// <summary>
    /// Always false now that no role may cross wings on a financial screen. Kept (rather than
    /// removed) because it is part of the <c>/permissions/me</c> response contract the frontend
    /// already reads to decide whether to show a wing switcher or a "Restricted to X Wing" badge.
    /// </summary>
    public bool CanChooseFinanceWing => false;

    /// <summary>
    /// The gender to filter Bill Management / Due Bill / Payment Verification by, or <c>null</c>
    /// for every wing. Always wing-locked for a wing admin; only a genuinely wing-less role
    /// (admin/super_admin) can pick.
    /// </summary>
    public async Task<string?> GetOwnWingFilterAsync(string? requestedWing, CancellationToken cancellationToken)
    {
        var userWing = await GetAdminWingAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(userWing)) return userWing;

        return requestedWing is "Male" or "Female" ? requestedWing : null;
    }

    /// <summary>
    /// Whether the caller may act on a financial record (a payment, a due adjustment) belonging
    /// to a student in <paramref name="studentWing"/>. Always wing-locked for a wing admin.
    /// </summary>
    public async Task<bool> CanManageOwnWingFinanceAsync(string? studentWing, CancellationToken cancellationToken)
    {
        var userWing = await GetAdminWingAsync(cancellationToken);
        return string.IsNullOrWhiteSpace(userWing) || studentWing == userWing;
    }

    public async Task<string> GetMealWingAsync(string? requestedWing, CancellationToken cancellationToken)
    {
        var user = await db.Users.AsNoTracking()
            .Include(x => x.Student)
            .FirstAsync(x => x.Id == UserId, cancellationToken);
        if (user.Role == HallBackend.Domain.Constants.Roles.Student)
            return user.Student?.Gender ?? throw new UnauthorizedAccessException("Student gender is required.");
        return await GetManagedWingAsync(requestedWing, cancellationToken);
    }

    /// <summary>
    /// Like <see cref="GetMealWingAsync"/>, but for read-only reports that can genuinely span
    /// both wings: returns the student's own wing, the wing-locked admin's wing, or — only for a
    /// wingless admin/super_admin who explicitly asked for it — <c>null</c> to mean "every wing".
    /// <see cref="GetManagedWingAsync"/> cannot express that: it treats anything other than
    /// exactly "Female" as "Male", so a wingless caller selecting "All Wings" on the Daily Cost
    /// report was silently shown Male-wing-only figures. Every other <c>GetMealWingAsync</c>
    /// caller needs one concrete wing to build a page around and must keep using that method.
    /// </summary>
    public async Task<string?> GetMealWingFilterAsync(string? requestedWing, CancellationToken cancellationToken)
    {
        var user = await db.Users.AsNoTracking()
            .Include(x => x.Student)
            .FirstAsync(x => x.Id == UserId, cancellationToken);
        if (user.Role == HallBackend.Domain.Constants.Roles.Student)
            return user.Student?.Gender ?? throw new UnauthorizedAccessException("Student gender is required.");

        var userWing = await GetAdminWingAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(userWing)) return userWing;

        return requestedWing is "Male" or "Female" ? requestedWing : null;
    }

    public async Task<IQueryable<Student>> ScopeStudentsAsync(IQueryable<Student> query, CancellationToken cancellationToken)
    {
        var wing = await GetAdminWingAsync(cancellationToken);
        return string.IsNullOrWhiteSpace(wing) ? query : query.Where(x => x.Gender == wing);
    }
}
