using HallBackend.Application.Dtos;
using HallBackend.Application.Services;
using HallBackend.Domain.Constants;
using HallBackend.Infrastructure.Authorization;
using HallBackend.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HallBackend.Controllers;

[ApiController]
[Authorize]
[Route("api/attendance")]
public sealed class AttendanceController(
    HallDbContext db,
    AttendanceService attendance,
    AuditLogService audit,
    IHttpContextAccessor httpContextAccessor) : ControllerBase
{
    private Task<AuditLogContext> BuildCtxAsync(CancellationToken ct)
        => AuditLogContextFactory.BuildAsync(httpContextAccessor, db, AuditModules.Attendance, ct);

    [HttpGet("me/current")]
    [RequirePermission(MenuKeys.StudentAttendance, PermissionActions.View)]
    public Task<StudentAttendanceCurrentDto> GetCurrent(CancellationToken cancellationToken)
        => attendance.GetCurrentForStudentAsync(cancellationToken);

    [HttpPost("me/mark")]
    [RequirePermission(MenuKeys.StudentAttendance, PermissionActions.Create)]
    public Task<MarkAttendanceResponse> Mark(MarkAttendanceRequest request, CancellationToken cancellationToken)
        => attendance.MarkAttendanceAsync(request, cancellationToken);

    [HttpGet("me/history")]
    [RequirePermission(MenuKeys.StudentAttendance, PermissionActions.View)]
    public Task<IReadOnlyList<StudentAttendanceHistoryRowDto>> GetHistory(CancellationToken cancellationToken)
        => attendance.GetStudentHistoryAsync(cancellationToken);

    [HttpGet("me/month")]
    [RequirePermission(MenuKeys.StudentAttendance, PermissionActions.View)]
    public Task<StudentAttendanceMonthDto> GetMonth([FromQuery] int? year, [FromQuery] int? month, CancellationToken cancellationToken)
        => attendance.GetStudentMonthAsync(year, month, cancellationToken);

    [HttpGet("hall-options")]
    [RequirePermission(MenuKeys.AdminAttendanceSheet, PermissionActions.View)]
    public Task<IReadOnlyList<AttendanceHallOptionDto>> GetHallOptions(CancellationToken cancellationToken)
        => attendance.GetHallOptionsAsync(cancellationToken);

    [HttpGet("hall-locations")]
    [RequirePermission(MenuKeys.AdminAttendanceSheet, PermissionActions.View)]
    public Task<IReadOnlyList<AttendanceHallLocationDto>> GetHallLocations(CancellationToken cancellationToken)
        => attendance.GetHallLocationsAsync(cancellationToken);

    [HttpPost("hall-locations")]
    [RequirePermission(MenuKeys.AdminAttendanceSheet, PermissionActions.Create)]
    public async Task<AttendanceHallLocationDto> CreateHallLocation(SaveAttendanceHallLocationRequest request, CancellationToken cancellationToken)
    {
        var result = await attendance.SaveHallLocationAsync(null, request, cancellationToken);
        var ctx = await BuildCtxAsync(cancellationToken);
        _ = audit.LogAsync(ctx, AuditActions.Create, "AttendanceHallLocation", result.Id.ToString(),
            $"Created attendance location '{result.HallName}' ({result.HallId})",
            newValues: new { result.HallName, result.HallId, result.Latitude, result.Longitude, result.RadiusMeters },
            cancellationToken: CancellationToken.None);
        return result;
    }

    [HttpPut("hall-locations/{id:guid}")]
    [RequirePermission(MenuKeys.AdminAttendanceSheet, PermissionActions.Edit)]
    public async Task<AttendanceHallLocationDto> UpdateHallLocation(Guid id, SaveAttendanceHallLocationRequest request, CancellationToken cancellationToken)
    {
        var result = await attendance.SaveHallLocationAsync(id, request, cancellationToken);
        var ctx = await BuildCtxAsync(cancellationToken);
        _ = audit.LogAsync(ctx, AuditActions.Update, "AttendanceHallLocation", id.ToString(),
            $"Updated attendance location '{result.HallName}'",
            newValues: new { result.HallName, result.HallId, result.Latitude, result.Longitude, result.RadiusMeters },
            cancellationToken: CancellationToken.None);
        return result;
    }

    [HttpPatch("hall-locations/{id:guid}/active")]
    [RequirePermission(MenuKeys.AdminAttendanceSheet, PermissionActions.Edit)]
    public async Task<AttendanceHallLocationDto> SetHallLocationActive(Guid id, [FromQuery] bool isActive, CancellationToken cancellationToken)
    {
        var result = await attendance.SetHallLocationActiveAsync(id, isActive, cancellationToken);
        var ctx = await BuildCtxAsync(cancellationToken);
        _ = audit.LogAsync(ctx, isActive ? AuditActions.Activate : AuditActions.Deactivate, "AttendanceHallLocation", id.ToString(),
            $"{(isActive ? "Activated" : "Deactivated")} attendance location '{result.HallName}'",
            cancellationToken: CancellationToken.None);
        return result;
    }

    [HttpGet("sessions")]
    [RequirePermission(MenuKeys.AdminAttendanceSheet, PermissionActions.View)]
    public Task<IReadOnlyList<AttendanceSessionDto>> GetSessions([FromQuery] string? hallId, CancellationToken cancellationToken)
        => attendance.GetSessionsAsync(hallId, cancellationToken);

    [HttpPost("sessions")]
    [RequirePermission(MenuKeys.AdminAttendanceSheet, PermissionActions.Create)]
    public async Task<AttendanceSessionDto> CreateSession(SaveAttendanceSessionRequest request, CancellationToken cancellationToken)
    {
        var result = await attendance.CreateSessionAsync(request, cancellationToken);
        var ctx = await BuildCtxAsync(cancellationToken);
        _ = audit.LogAsync(ctx, AuditActions.Create, "AttendanceSession", result.Id.ToString(),
            $"Created attendance session '{result.HallName}' ({result.HallId})",
            newValues: new { result.HallName, result.HallId, result.StartTime, result.EndTime },
            cancellationToken: CancellationToken.None);
        return result;
    }

    [HttpPut("sessions/{id:guid}")]
    [RequirePermission(MenuKeys.AdminAttendanceSheet, PermissionActions.Edit)]
    public async Task<AttendanceSessionDto> UpdateSession(Guid id, SaveAttendanceSessionRequest request, CancellationToken cancellationToken)
    {
        var result = await attendance.UpdateSessionAsync(id, request, cancellationToken);
        var ctx = await BuildCtxAsync(cancellationToken);
        _ = audit.LogAsync(ctx, AuditActions.Update, "AttendanceSession", id.ToString(),
            $"Updated attendance session '{result.HallName}'",
            newValues: new { result.HallName, result.HallId, result.StartTime, result.EndTime },
            cancellationToken: CancellationToken.None);
        return result;
    }

    [HttpPatch("sessions/{id:guid}/active")]
    [RequirePermission(MenuKeys.AdminAttendanceSheet, PermissionActions.Edit)]
    public async Task<AttendanceSessionDto> SetSessionActive(Guid id, [FromQuery] bool isActive, CancellationToken cancellationToken)
    {
        var result = await attendance.SetSessionActiveAsync(id, isActive, cancellationToken);
        var ctx = await BuildCtxAsync(cancellationToken);
        _ = audit.LogAsync(ctx, isActive ? AuditActions.Activate : AuditActions.Deactivate, "AttendanceSession", id.ToString(),
            $"{(isActive ? "Activated" : "Deactivated")} attendance session '{result.HallName}'",
            cancellationToken: CancellationToken.None);
        return result;
    }

    [HttpGet("sheet")]
    [RequirePermission(MenuKeys.AdminAttendanceSheet, PermissionActions.View)]
    public Task<AttendanceSheetResponse> GetSheet(
        [FromQuery] Guid? sessionId,
        [FromQuery] DateOnly? date,
        [FromQuery] string? gender,
        [FromQuery] string? hallName,
        [FromQuery] string? department,
        [FromQuery] string? level,
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
        => attendance.GetSheetAsync(sessionId, date, gender, hallName, department, level, status, search, page, pageSize, cancellationToken);
}
