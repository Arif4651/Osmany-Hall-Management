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
    LoginAttemptLimiter loginAttempts,
    IWebHostEnvironment env,
    ILogger<AuthController> logger) : ControllerBase
{
    private void WriteAuthCookie(string tokenString, DateTime expiresAtUtc)
    {
        Response.Cookies.Append(AuthCookieName, tokenString, new CookieOptions
        {
            HttpOnly = true,
            Secure = ShouldUseSecureCookie(),
            SameSite = GetAuthCookieSameSiteMode(),
            Expires = expiresAtUtc,
            Path = "/",
        });

        // Deliberately NOT HttpOnly: the frontend must be able to read this and echo it back as
        // the X-CSRF-Token header (CsrfProtectionMiddleware). Its secrecy from JavaScript is not
        // the point — the point is that a cross-site request can send the auth cookie
        // automatically but cannot read this one to construct a matching header.
        Response.Cookies.Append(HallBackend.Infrastructure.CsrfProtectionMiddleware.CookieName, Guid.NewGuid().ToString("N"), new CookieOptions
        {
            HttpOnly = false,
            Secure = ShouldUseSecureCookie(),
            SameSite = GetAuthCookieSameSiteMode(),
            Expires = expiresAtUtc,
            Path = "/",
        });
    }

    private const string AuthCookieName = "hall-auth-token";

    [HttpPost("login")]
    [EnableRateLimiting("auth-login")]
    public async Task<ActionResult<LoginSuccess>> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var totalTimer = Stopwatch.StartNew();
        var identifier = request.Email.Trim().ToUpperInvariant();
        var isEmailIdentifier = identifier.Contains('@');

        // Independent of the per-IP limiter above: this blocks repeated attempts against one
        // account regardless of how many addresses they come from.
        if (loginAttempts.IsLockedOut(identifier))
        {
            LogLoginTiming("account_locked", 0, 0, 0, 0, totalTimer.Elapsed.TotalMilliseconds);
            return StatusCode(StatusCodes.Status429TooManyRequests, new
            {
                message = "Too many failed attempts for this account. Try again later.",
            });
        }

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
            loginAttempts.RecordFailure(identifier);
            LogLoginTiming("invalid_or_inactive", userQueryMs, 0, 0, 0, totalTimer.Elapsed.TotalMilliseconds);
            return Unauthorized(new { message = "Invalid credentials. Please try again." });
        }

        stageTimer.Restart();
        if (!passwords.Verify(request.Password, user.PasswordHash))
        {
            loginAttempts.RecordFailure(identifier);
            var passwordVerifyMs = stageTimer.Elapsed.TotalMilliseconds;
            LogLoginTiming("invalid_password", userQueryMs, passwordVerifyMs, 0, 0, totalTimer.Elapsed.TotalMilliseconds);
            return Unauthorized(new { message = "Invalid credentials. Please try again." });
        }
        loginAttempts.RecordSuccess(identifier);
        var successfulPasswordVerifyMs = stageTimer.Elapsed.TotalMilliseconds;

        stageTimer.Restart();
        await db.Users
            .Where(x => x.Id == user.Id)
            .ExecuteUpdateAsync(
                updates => updates.SetProperty(x => x.LastLoginAtUtc, DateTime.UtcNow),
                cancellationToken);
        var lastLoginUpdateMs = stageTimer.Elapsed.TotalMilliseconds;

        stageTimer.Restart();
        var (tokenString, loginSuccess) = tokens.CreateToken(user.ToAuthUser());
        var tokenCreateMs = stageTimer.Elapsed.TotalMilliseconds;

        // Write the JWT into an HttpOnly cookie so JavaScript cannot read it.
        WriteAuthCookie(tokenString, loginSuccess.ExpiresAtUtc);

        LogLoginTiming(
            "success",
            userQueryMs,
            successfulPasswordVerifyMs,
            lastLoginUpdateMs,
            tokenCreateMs,
            totalTimer.Elapsed.TotalMilliseconds);

        return Ok(loginSuccess);
    }

    [HttpPost("logout")]
    [Authorize]
    public IActionResult Logout()
    {
        // Clear the auth cookie on the client.
        Response.Cookies.Delete(AuthCookieName, new CookieOptions
        {
            HttpOnly = true,
            Secure = ShouldUseSecureCookie(),
            SameSite = GetAuthCookieSameSiteMode(),
            Path = "/",
        });
        Response.Cookies.Delete(HallBackend.Infrastructure.CsrfProtectionMiddleware.CookieName, new CookieOptions
        {
            HttpOnly = false,
            Secure = ShouldUseSecureCookie(),
            SameSite = GetAuthCookieSameSiteMode(),
            Path = "/",
        });
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

        // Reissue the cookie with a fresh token carrying MustChangePassword=false. Without this,
        // RequirePasswordChangeMiddleware would keep reading the old token's claim and lock the
        // user out of every other endpoint for the rest of the token's lifetime, immediately
        // after they did exactly what was asked of them.
        var gender = user.Role == HallBackend.Domain.Constants.Roles.Student
            ? await db.Students.AsNoTracking().Where(x => x.Id == user.StudentId).Select(x => (string?)x.Gender).FirstOrDefaultAsync(cancellationToken)
            : user.Wing;
        var refreshedUser = new AuthUserDto(user.Id, user.FullName, user.Email, user.UserName, user.Role, user.Designation, gender, user.StudentId, false);
        var (tokenString, loginSuccess) = tokens.CreateToken(refreshedUser);
        WriteAuthCookie(tokenString, loginSuccess.ExpiresAtUtc);

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

    private bool ShouldUseSecureCookie()
        => !env.IsDevelopment();

    private SameSiteMode GetAuthCookieSameSiteMode()
        // Production frontend and backend run on different sites
        // (Vercel app -> Render API), so browsers require SameSite=None; Secure.
        // Localhost development can keep Lax because both apps are same-site.
        => env.IsDevelopment() ? SameSiteMode.Lax : SameSiteMode.None;

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
