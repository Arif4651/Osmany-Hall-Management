namespace HallBackend.Application.Dtos;

public sealed record LoginRequest(string Email, string Password, string Role);
public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public sealed record AuthUserDto(Guid Id, string FullName, string Email, string UserName, string Role, string Designation, string? Wing, Guid? StudentId, bool MustChangePassword);

/// <summary>
/// Cookie-safe login result: only expiry + user info, no raw token.
/// </summary>
public sealed record LoginSuccess(DateTime ExpiresAtUtc, AuthUserDto User);

public sealed record AdminAccountDto(Guid Id, string FullName, string Email, string UserName, string Role, string? Wing, string Designation, bool IsActive);
public sealed record SaveAdminAccountRequest(string FullName, string Email, string UserName, string Role, string? Wing, string Designation, string? Password, bool IsActive);
