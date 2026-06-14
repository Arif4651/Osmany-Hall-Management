using System.Security.Claims;
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
