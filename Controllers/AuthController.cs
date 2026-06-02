using HallBackend.Application.Dtos;
using HallBackend.Application.Services;
using HallBackend.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(HallDbContext db, PasswordService passwords, JwtTokenService tokens) : ControllerBase
{
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var identifier = request.Email.Trim().ToUpperInvariant();
        var user = await db.Users.FirstOrDefaultAsync(
            x => (x.NormalizedEmail == identifier || x.NormalizedUserName == identifier) && x.Role == request.Role,
            cancellationToken);

        if (user is null || !user.IsActive)
        {
            return Unauthorized(new { message = "Invalid credentials. Please try again." });
        }

        if (!passwords.Verify(request.Password, user.PasswordHash))
        {
            return Unauthorized(new { message = "Invalid credentials. Please try again." });
        }

        user.LastLoginAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(tokens.CreateToken(user));
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

        var user = await db.Users.FindAsync([id], cancellationToken);
        if (user is null)
        {
            return Unauthorized();
        }

        return new AuthUserDto(user.Id, user.FullName, user.Email, user.UserName, user.Role, user.Designation, user.StudentId, user.MustChangePassword);
    }
}
