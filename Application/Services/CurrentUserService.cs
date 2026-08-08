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

    // ── Cross-wing finance access ────────────────────────────────────────────
    // Payment Verification is the one hall-wide financial screen left — a listed role may switch
    // wings there. Bill Management and Due Bill were the same at one point, but were deliberately
    // reverted to wing-locked (see GetOwnWingFilterAsync/CanManageOwnWingFinanceAsync below), so
    // they now behave like Students, Meals and Inventory: GetAdminWingAsync/GetManagedWingAsync,
    // always wing-locked for a wing admin.

    /// <summary>Roles that may choose a wing on the financial screens.</summary>
    private static readonly string[] CrossWingFinanceRoles = [Roles.MaleWingAdmin];

    private string? Role => accessor.HttpContext?.User.FindFirstValue(ClaimTypes.Role);

    /// <summary>
    /// Whether this user may pick a wing on Payment Verification. Surfaced to the client through
    /// /permissions/me so the UI never has to hardcode a role name.
    /// </summary>
    public bool CanChooseFinanceWing => Role is not null && CrossWingFinanceRoles.Contains(Role);

    /// <summary>
    /// The gender to filter Payment Verification by, or <c>null</c> for every wing. Wing-locked
    /// roles ignore <paramref name="requestedWing"/> and always get their own wing.
    /// </summary>
    public async Task<string?> GetFinanceWingFilterAsync(string? requestedWing, CancellationToken cancellationToken)
    {
        if (!CanChooseFinanceWing)
        {
            var userWing = await GetAdminWingAsync(cancellationToken);
            if (!string.IsNullOrWhiteSpace(userWing)) return userWing;
        }

        // Anything other than a specific wing ("All", empty, junk) means no filter.
        return requestedWing is "Male" or "Female" ? requestedWing : null;
    }

    /// <summary>
    /// Whether the caller may approve/reject a payment for a student in <paramref name="studentWing"/>.
    /// </summary>
    public async Task<bool> CanManageFinanceForWingAsync(string? studentWing, CancellationToken cancellationToken)
    {
        if (CanChooseFinanceWing) return true;
        var userWing = await GetAdminWingAsync(cancellationToken);
        return string.IsNullOrWhiteSpace(userWing) || studentWing == userWing;
    }

    /// <summary>
    /// The gender to filter Bill Management / Due Bill by, or <c>null</c> for every wing. Always
    /// wing-locked for a wing admin regardless of <see cref="CanChooseFinanceWing"/> — only a
    /// genuinely wing-less role (admin/super_admin) can pick.
    /// </summary>
    public async Task<string?> GetOwnWingFilterAsync(string? requestedWing, CancellationToken cancellationToken)
    {
        var userWing = await GetAdminWingAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(userWing)) return userWing;

        return requestedWing is "Male" or "Female" ? requestedWing : null;
    }

    /// <summary>
    /// Whether the caller may write a due adjustment for a student in <paramref name="studentWing"/>.
    /// Always wing-locked for a wing admin, regardless of <see cref="CanChooseFinanceWing"/>.
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

    public async Task<IQueryable<Student>> ScopeStudentsAsync(IQueryable<Student> query, CancellationToken cancellationToken)
    {
        var wing = await GetAdminWingAsync(cancellationToken);
        return string.IsNullOrWhiteSpace(wing) ? query : query.Where(x => x.Gender == wing);
    }
}
