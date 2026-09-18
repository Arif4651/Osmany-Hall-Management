using HallBackend.Application.Dtos;
using HallBackend.Application.Services;
using HallBackend.Domain.Constants;
using HallBackend.Infrastructure.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HallBackend.Controllers;

[ApiController]
[Authorize]
[Route("api/attendance")]
public sealed class AttendanceController(AttendanceService attendance) : ControllerBase
{
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
    public Task<AttendanceHallLocationDto> CreateHallLocation(SaveAttendanceHallLocationRequest request, CancellationToken cancellationToken)
        => attendance.SaveHallLocationAsync(null, request, cancellationToken);

    [HttpPut("hall-locations/{id:guid}")]
    [RequirePermission(MenuKeys.AdminAttendanceSheet, PermissionActions.Edit)]
    public Task<AttendanceHallLocationDto> UpdateHallLocation(Guid id, SaveAttendanceHallLocationRequest request, CancellationToken cancellationToken)
        => attendance.SaveHallLocationAsync(id, request, cancellationToken);

    [HttpPatch("hall-locations/{id:guid}/active")]
    [RequirePermission(MenuKeys.AdminAttendanceSheet, PermissionActions.Edit)]
    public Task<AttendanceHallLocationDto> SetHallLocationActive(Guid id, [FromQuery] bool isActive, CancellationToken cancellationToken)
        => attendance.SetHallLocationActiveAsync(id, isActive, cancellationToken);

    [HttpGet("sessions")]
    [RequirePermission(MenuKeys.AdminAttendanceSheet, PermissionActions.View)]
    public Task<IReadOnlyList<AttendanceSessionDto>> GetSessions([FromQuery] string? hallId, CancellationToken cancellationToken)
        => attendance.GetSessionsAsync(hallId, cancellationToken);

    [HttpPost("sessions")]
    [RequirePermission(MenuKeys.AdminAttendanceSheet, PermissionActions.Create)]
    public Task<AttendanceSessionDto> CreateSession(SaveAttendanceSessionRequest request, CancellationToken cancellationToken)
        => attendance.CreateSessionAsync(request, cancellationToken);

    [HttpPut("sessions/{id:guid}")]
    [RequirePermission(MenuKeys.AdminAttendanceSheet, PermissionActions.Edit)]
    public Task<AttendanceSessionDto> UpdateSession(Guid id, SaveAttendanceSessionRequest request, CancellationToken cancellationToken)
        => attendance.UpdateSessionAsync(id, request, cancellationToken);

    [HttpPatch("sessions/{id:guid}/active")]
    [RequirePermission(MenuKeys.AdminAttendanceSheet, PermissionActions.Edit)]
    public Task<AttendanceSessionDto> SetSessionActive(Guid id, [FromQuery] bool isActive, CancellationToken cancellationToken)
        => attendance.SetSessionActiveAsync(id, isActive, cancellationToken);

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
