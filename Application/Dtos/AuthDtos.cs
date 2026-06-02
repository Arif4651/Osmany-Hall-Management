namespace HallBackend.Application.Dtos;

public sealed record LoginRequest(string Email, string Password, string Role);
public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public sealed record AuthUserDto(Guid Id, string FullName, string Email, string UserName, string Role, string Designation, Guid? StudentId, bool MustChangePassword);
public sealed record LoginResponse(string AccessToken, DateTime ExpiresAtUtc, AuthUserDto User);
