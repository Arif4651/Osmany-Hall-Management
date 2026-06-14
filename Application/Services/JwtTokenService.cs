using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using HallBackend.Application.Dtos;
using HallBackend.Domain.Entities;
using Microsoft.IdentityModel.Tokens;

namespace HallBackend.Application.Services;

public sealed class JwtTokenService(IConfiguration configuration)
{
    public LoginResponse CreateToken(AppUser user)
    {
        var expiresMinutes = configuration.GetValue("Jwt:ExpiresMinutes", 120);
        var expiresAt = DateTime.UtcNow.AddMinutes(expiresMinutes);
        var secret = configuration["Jwt:Secret"];

        if (string.IsNullOrWhiteSpace(secret) || secret.Length < 32)
        {
            throw new InvalidOperationException("JWT secret must be configured and at least 32 characters long.");
        }

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim(ClaimTypes.Role, user.Role),
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var token = new JwtSecurityToken(
            issuer: configuration["Jwt:Issuer"],
            audience: configuration["Jwt:Audience"],
            claims: claims,
            expires: expiresAt,
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        return new LoginResponse(
            new JwtSecurityTokenHandler().WriteToken(token),
            expiresAt,
            new AuthUserDto(user.Id, user.FullName, user.Email, user.UserName, user.Role, user.Designation, user.Wing, user.StudentId, user.MustChangePassword));
    }
}
