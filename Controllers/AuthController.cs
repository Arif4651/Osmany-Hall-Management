using System.Diagnostics;
using HallBackend.Application.Dtos;
using HallBackend.Application.Services;
using HallBackend.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(
    HallDbContext db,
    PasswordService passwords,
    JwtTokenService tokens,
    ILogger<AuthController> logger) : ControllerBase
{
    [HttpPost("login")]
    [EnableRateLimiting("auth-login")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var totalTimer = Stopwatch.StartNew();
        var identifier = request.Email.Trim().ToUpperInvariant();
        var isEmailIdentifier = identifier.Contains('@');

        var stageTimer = Stopwatch.StartNew();
        var user = await db.Users
            .AsNoTracking()
            .Where(x => isEmailIdentifier ? x.NormalizedEmail == identifier : x.NormalizedUserName == identifier)
            .Where(x => x.Role == request.Role || (request.Role == "admin"
                && (x.Role == "super_admin" || x.Role == "admin"
                    || x.Role == "male_wing_admin" || x.Role == "female_wing_admin")))
            .Select(x => new LoginUser(
                x.Id,
                x.FullName,
                x.Email,
                x.UserName,
                x.Role,
                x.Designation,
                x.Role == "student" ? x.Student!.Gender : x.Wing,
                x.StudentId,
                x.MustChangePassword,
                x.PasswordHash,
                x.IsActive))
            .FirstOrDefaultAsync(cancellationToken);
        var userQueryMs = stageTimer.Elapsed.TotalMilliseconds;

        if (user is null || !user.IsActive)
        {
            LogLoginTiming("invalid_or_inactive", userQueryMs, 0, 0, 0, totalTimer.Elapsed.TotalMilliseconds);
            return Unauthorized(new { message = "Invalid credentials. Please try again." });
        }

        stageTimer.Restart();
        if (!passwords.Verify(request.Password, user.PasswordHash))
        {
            var passwordVerifyMs = stageTimer.Elapsed.TotalMilliseconds;
            LogLoginTiming("invalid_password", userQueryMs, passwordVerifyMs, 0, 0, totalTimer.Elapsed.TotalMilliseconds);
            return Unauthorized(new { message = "Invalid credentials. Please try again." });
        }
        var successfulPasswordVerifyMs = stageTimer.Elapsed.TotalMilliseconds;

        stageTimer.Restart();
        await db.Users
            .Where(x => x.Id == user.Id)
            .ExecuteUpdateAsync(
                updates => updates.SetProperty(x => x.LastLoginAtUtc, DateTime.UtcNow),
                cancellationToken);
        var lastLoginUpdateMs = stageTimer.Elapsed.TotalMilliseconds;

        stageTimer.Restart();
        var response = tokens.CreateToken(user.ToAuthUser());
        var tokenCreateMs = stageTimer.Elapsed.TotalMilliseconds;

        LogLoginTiming(
            "success",
            userQueryMs,
            successfulPasswordVerifyMs,
            lastLoginUpdateMs,
            tokenCreateMs,
            totalTimer.Elapsed.TotalMilliseconds);

        return Ok(response);
    }

    [HttpPost("logout")]
    [Authorize]
    public IActionResult Logout()
    {
        return NoContent();
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 8)
        {
            return BadRequest(new { message = "Password must be at least 8 characters." });
        }

        var idClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(idClaim, out var id))
        {
            return Unauthorized();
        }

        var user = await db.Users.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (user is null || !user.IsActive)
        {
            return Unauthorized();
        }

        if (!passwords.Verify(request.CurrentPassword, user.PasswordHash))
        {
            return BadRequest(new { message = "Current password is incorrect." });
        }

        user.PasswordHash = passwords.Hash(request.NewPassword);
        user.MustChangePassword = false;
        await db.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<AuthUserDto>> Me(CancellationToken cancellationToken)
    {
        var idClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(idClaim, out var id))
        {
            return Unauthorized();
        }

        var user = await db.Users
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new AuthUserDto(x.Id, x.FullName, x.Email, x.UserName, x.Role, x.Designation, x.Role == "student" ? x.Student!.Gender : x.Wing, x.StudentId, x.MustChangePassword))
            .FirstOrDefaultAsync(cancellationToken);
        if (user is null)
        {
            return Unauthorized();
        }

        return user;
    }

    private void LogLoginTiming(
        string outcome,
        double userQueryMs,
        double passwordVerifyMs,
        double lastLoginUpdateMs,
        double tokenCreateMs,
        double totalMs)
    {
        logger.LogInformation(
            "Authentication login completed. Outcome={Outcome} UserQueryMs={UserQueryMs:F1} " +
            "PasswordVerifyMs={PasswordVerifyMs:F1} LastLoginUpdateMs={LastLoginUpdateMs:F1} " +
            "TokenCreateMs={TokenCreateMs:F1} TotalMs={TotalMs:F1}",
            outcome,
            userQueryMs,
            passwordVerifyMs,
            lastLoginUpdateMs,
            tokenCreateMs,
            totalMs);
    }

    private sealed record LoginUser(
        Guid Id,
        string FullName,
        string Email,
        string UserName,
        string Role,
        string Designation,
        string? Wing,
        Guid? StudentId,
        bool MustChangePassword,
        string PasswordHash,
        bool IsActive)
    {
        public AuthUserDto ToAuthUser()
            => new(Id, FullName, Email, UserName, Role, Designation, Wing, StudentId, MustChangePassword);
    }
}
