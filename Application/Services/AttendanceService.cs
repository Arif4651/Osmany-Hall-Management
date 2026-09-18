using HallBackend.Application.Dtos;
using HallBackend.Domain.Entities;
using HallBackend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using System.Globalization;

namespace HallBackend.Application.Services;

public sealed class AttendanceService(HallDbContext db, CurrentUserService currentUser)
{
    private const int MinRadiusMeters = 20;
    private const int MaxRadiusMeters = 500;
    private const int DefaultMaxAccuracyMeters = 150;
    private const int MinAccuracyMeters = 5;
    private const int MaxAccuracyMeters = 250;

    public async Task<IReadOnlyList<AttendanceHallOptionDto>> GetHallOptionsAsync(CancellationToken cancellationToken)
    {
        var scoped = await currentUser.ScopeStudentsAsync(
            db.Students.AsNoTracking().Where(x => x.Status == MealResolutionContext.BillableStatus),
            cancellationToken);
        var configuredHallKeys = await db.AttendanceHallLocations.AsNoTracking()
            .Select(x => x.HallId)
            .ToHashSetAsync(cancellationToken);

        var halls = await scoped
            .Where(x => x.HallName != "")
            .GroupBy(x => x.HallName)
            .Select(x => new
            {
                HallKey = x.Key,
                HallName = x.Key,
                Gender = x.Min(student => student.Gender) ?? string.Empty,
                StudentCount = x.Count(),
            })
            .OrderBy(x => x.HallName)
            .ToListAsync(cancellationToken);

        return halls
            .Select(x => new AttendanceHallOptionDto(
                x.HallKey,
                x.HallName,
                x.Gender,
                x.StudentCount,
                configuredHallKeys.Contains(x.HallKey)))
            .ToList();
    }

    public async Task<IReadOnlyList<AttendanceHallLocationDto>> GetHallLocationsAsync(CancellationToken cancellationToken)
    {
        var scopedStudents = await currentUser.ScopeStudentsAsync(db.Students.AsNoTracking(), cancellationToken);
        var hallNames = scopedStudents.Select(x => x.HallName).Distinct();

        return await db.AttendanceHallLocations.AsNoTracking()
            .Where(x => hallNames.Contains(x.HallName))
            .OrderBy(x => x.HallName)
            .Select(x => new AttendanceHallLocationDto(
                x.Id,
                x.HallId,
                x.HallName,
                x.Latitude,
                x.Longitude,
                x.RadiusMeters,
                x.MaxAccuracyMeters,
                x.IsActive,
                x.CreatedAtUtc,
                x.UpdatedAtUtc))
            .ToListAsync(cancellationToken);
    }

    public async Task<AttendanceHallLocationDto> SaveHallLocationAsync(
        Guid? id,
        SaveAttendanceHallLocationRequest request,
        CancellationToken cancellationToken)
    {
        ValidateCoordinates(request.Latitude, request.Longitude);
        if (request.RadiusMeters is < MinRadiusMeters or > MaxRadiusMeters)
            throw new DomainValidationException($"Allowed radius must be between {MinRadiusMeters} and {MaxRadiusMeters} meters.");

        var maxAccuracy = request.MaxAccuracyMeters ?? DefaultMaxAccuracyMeters;
        if (maxAccuracy is < MinAccuracyMeters or > MaxAccuracyMeters)
            throw new DomainValidationException($"Maximum GPS accuracy must be between {MinAccuracyMeters} and {MaxAccuracyMeters} meters.");

        var hall = await ResolveManagedHallAsync(request.HallId, cancellationToken);
        var location = id.HasValue
            ? await db.AttendanceHallLocations.FirstOrDefaultAsync(x => x.Id == id.Value, cancellationToken)
            : await db.AttendanceHallLocations.FirstOrDefaultAsync(x => x.HallId == hall.HallId, cancellationToken);

        if (location is null)
        {
            location = new AttendanceHallLocation();
            db.AttendanceHallLocations.Add(location);
        }
        else if (location.HallId != hall.HallId)
        {
            var existingHall = await ResolveManagedHallAsync(location.HallId, cancellationToken);
            if (existingHall.HallId != location.HallId)
                throw new DomainValidationException("This hall location is outside your permitted scope.");
        }

        var duplicateExists = await db.AttendanceHallLocations.AsNoTracking()
            .AnyAsync(x => x.HallId == hall.HallId && x.Id != location.Id, cancellationToken);
        if (duplicateExists)
            throw new DomainValidationException("Attendance location is already configured for this hall.");

        location.HallId = hall.HallId;
        location.HallName = string.IsNullOrWhiteSpace(request.HallName) ? hall.HallName : request.HallName.Trim();
        location.Latitude = request.Latitude;
        location.Longitude = request.Longitude;
        location.RadiusMeters = request.RadiusMeters;
        location.MaxAccuracyMeters = maxAccuracy;
        location.IsActive = request.IsActive;

        await db.SaveChangesAsync(cancellationToken);
        return ToDto(location);
    }

    public async Task<AttendanceHallLocationDto> SetHallLocationActiveAsync(Guid id, bool isActive, CancellationToken cancellationToken)
    {
        var location = await db.AttendanceHallLocations.FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new DomainValidationException("Hall location was not found.");
        await ResolveManagedHallAsync(location.HallId, cancellationToken);
        location.IsActive = isActive;
        await db.SaveChangesAsync(cancellationToken);
        return ToDto(location);
    }

    public async Task<IReadOnlyList<AttendanceSessionDto>> GetSessionsAsync(string? hallId, CancellationToken cancellationToken)
    {
        var scopedStudents = await currentUser.ScopeStudentsAsync(db.Students.AsNoTracking(), cancellationToken);
        var hallNames = scopedStudents.Select(x => x.HallName).Distinct();
        var query = db.AttendanceSessions.AsNoTracking()
            .Where(x => hallNames.Contains(x.HallName));
        if (!string.IsNullOrWhiteSpace(hallId))
        {
            var normalizedHall = hallId.Trim();
            query = query.Where(x => x.HallId == normalizedHall || x.HallName == normalizedHall);
        }

        return await query
            .OrderBy(x => x.HallName)
            .ThenByDescending(x => x.IsActive)
            .ThenBy(x => x.StartTime)
            .Take(string.IsNullOrWhiteSpace(hallId) ? 100 : 20)
            .Select(x => new AttendanceSessionDto(
                x.Id,
                x.HallId,
                x.HallName,
                x.StartTime,
                x.EndTime,
                x.IsActive,
                x.CreatedAtUtc,
                x.UpdatedAtUtc))
            .ToListAsync(cancellationToken);
    }

    public async Task<AttendanceSessionDto> CreateSessionAsync(SaveAttendanceSessionRequest request, CancellationToken cancellationToken)
    {
        ValidateSessionRequest(request);
        var hall = await ResolveManagedHallAsync(request.HallId, cancellationToken);
        var duplicateActive = await db.AttendanceSessions.AsNoTracking()
            .AnyAsync(x => x.HallId == hall.HallId && x.IsActive && request.IsActive, cancellationToken);
        if (duplicateActive)
            throw new DomainValidationException("This hall already has an active attendance session. Edit or deactivate it before creating another.");

        var session = new AttendanceSession
        {
            HallId = hall.HallId,
            HallName = string.IsNullOrWhiteSpace(request.HallName) ? hall.HallName : request.HallName.Trim(),
            StartTime = request.StartTime,
            EndTime = request.EndTime,
            IsActive = request.IsActive,
            CreatedById = currentUser.UserId,
        };
        db.AttendanceSessions.Add(session);
        await db.SaveChangesAsync(cancellationToken);
        return ToDto(session);
    }

    public async Task<AttendanceSessionDto> UpdateSessionAsync(Guid id, SaveAttendanceSessionRequest request, CancellationToken cancellationToken)
    {
        ValidateSessionRequest(request);
        var session = await db.AttendanceSessions.FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new DomainValidationException("Attendance session was not found.");
        var hall = await ResolveManagedHallAsync(request.HallId, cancellationToken);
        var duplicateActive = await db.AttendanceSessions.AsNoTracking()
            .AnyAsync(x => x.Id != id && x.HallId == hall.HallId && x.IsActive && request.IsActive, cancellationToken);
        if (duplicateActive)
            throw new DomainValidationException("This hall already has another active attendance session.");

        session.HallId = hall.HallId;
        session.HallName = string.IsNullOrWhiteSpace(request.HallName) ? hall.HallName : request.HallName.Trim();
        session.StartTime = request.StartTime;
        session.EndTime = request.EndTime;
        session.IsActive = request.IsActive;
        await db.SaveChangesAsync(cancellationToken);
        return ToDto(session);
    }

    public async Task<AttendanceSessionDto> SetSessionActiveAsync(Guid id, bool isActive, CancellationToken cancellationToken)
    {
        var session = await db.AttendanceSessions.FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new DomainValidationException("Attendance session was not found.");
        await ResolveManagedHallAsync(session.HallId, cancellationToken);
        if (isActive)
        {
            var duplicateActive = await db.AttendanceSessions.AsNoTracking()
                .AnyAsync(x => x.Id != id && x.HallId == session.HallId && x.IsActive, cancellationToken);
            if (duplicateActive)
                throw new DomainValidationException("This hall already has another active attendance session.");
        }

        session.IsActive = isActive;
        await db.SaveChangesAsync(cancellationToken);
        return ToDto(session);
    }

    public async Task<StudentAttendanceCurrentDto> GetCurrentForStudentAsync(CancellationToken cancellationToken)
    {
        var student = await GetAuthenticatedStudentAsync(cancellationToken);
        var today = HallClock.Today;
        if (!IsEligibleStudent(student))
        {
            return new StudentAttendanceCurrentDto(null, today, student.HallId, student.HallName, "inactive", null,
                "Only active students can mark attendance.");
        }

        var session = await GetDisplaySessionAsync(student.HallName, cancellationToken);
        if (session is null)
        {
            return new StudentAttendanceCurrentDto(null, today, student.HallId, student.HallName, "no_session", null,
                "No attendance session is configured for your assigned hall.");
        }

        var record = await db.AttendanceRecords.AsNoTracking()
            .FirstOrDefaultAsync(x => x.SessionId == session.Id && x.StudentId == student.Id && x.AttendanceDate == today, cancellationToken);
        if (record is not null)
        {
            return new StudentAttendanceCurrentDto(session is null ? null : ToDto(session), today, student.HallId, student.HallName, "present",
                record.MarkedAtUtc, "Attendance already marked.");
        }

        var now = HallClock.TimeOfDay;
        if (now < session.StartTime)
        {
            return new StudentAttendanceCurrentDto(session is null ? null : ToDto(session), today, student.HallId, student.HallName, "not_started", null,
                "The attendance window has not started yet.");
        }

        if (now > session.EndTime)
        {
            return new StudentAttendanceCurrentDto(session is null ? null : ToDto(session), today, student.HallId, student.HallName, "closed", null,
                "The attendance window has closed.");
        }

        return new StudentAttendanceCurrentDto(session is null ? null : ToDto(session), today, student.HallId, student.HallName, "not_marked", null,
            "Attendance is open.");
    }

    public async Task<MarkAttendanceResponse> MarkAttendanceAsync(MarkAttendanceRequest request, CancellationToken cancellationToken)
    {
        ValidateCoordinates(request.Latitude, request.Longitude);
        if (request.AccuracyMeters <= 0)
            throw new DomainValidationException("Location accuracy was not provided by the browser.");

        var student = await GetAuthenticatedStudentAsync(cancellationToken);
        if (!IsEligibleStudent(student))
            throw new DomainValidationException("Only active students can mark attendance.");
        if (string.IsNullOrWhiteSpace(student.HallId))
            throw new DomainValidationException("Your assigned hall is missing from your student profile. Please contact the hall office.");

        var today = HallClock.Today;
        var session = await GetActiveSessionOrThrowAsync(student.HallName, cancellationToken);
        var existing = await db.AttendanceRecords.AsNoTracking()
            .FirstOrDefaultAsync(x => x.SessionId == session.Id && x.StudentId == student.Id && x.AttendanceDate == today, cancellationToken);
        if (existing is not null)
        {
            return new MarkAttendanceResponse(
                existing.Status,
                existing.MarkedAtUtc,
                existing.DistanceFromHallMeters,
                student.HallName,
                "Attendance already marked.");
        }

        var location = await db.AttendanceHallLocations.AsNoTracking()
            .FirstOrDefaultAsync(x => x.HallName == student.HallName && x.IsActive, cancellationToken)
            ?? throw new DomainValidationException($"Attendance location is not configured for {student.HallName}. Please contact the hall office.");

        var distance = CalculateDistanceMeters(request.Latitude, request.Longitude, location.Latitude, location.Longitude);
        if (distance > location.RadiusMeters)
        {
            throw new DomainValidationException($"You are outside {student.HallName}. Attendance can only be marked from inside the hall area.");
        }

        if (request.AccuracyMeters > location.MaxAccuracyMeters)
        {
            throw new DomainValidationException("Your current location is not accurate enough. Please wait a few seconds and try again.");
        }

        var record = new AttendanceRecord
        {
            SessionId = session.Id,
            StudentId = student.Id,
            AttendanceDate = today,
            MarkedAtUtc = DateTime.UtcNow,
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            AccuracyMeters = request.AccuracyMeters,
            DistanceFromHallMeters = distance,
            Status = AttendanceStatus.Present,
        };
        db.AttendanceRecords.Add(record);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            var duplicate = await db.AttendanceRecords.AsNoTracking()
                .FirstAsync(x => x.SessionId == session.Id && x.StudentId == student.Id && x.AttendanceDate == today, cancellationToken);
            return new MarkAttendanceResponse(
                duplicate.Status,
                duplicate.MarkedAtUtc,
                duplicate.DistanceFromHallMeters,
                student.HallName,
                "Attendance already marked.");
        }

        return new MarkAttendanceResponse(
            record.Status,
            record.MarkedAtUtc,
            Math.Round(record.DistanceFromHallMeters, 1),
            student.HallName,
            "Attendance marked successfully.");
    }

    public async Task<IReadOnlyList<StudentAttendanceHistoryRowDto>> GetStudentHistoryAsync(CancellationToken cancellationToken)
    {
        var studentId = await currentUser.GetStudentIdAsync(cancellationToken);
        return await db.AttendanceRecords.AsNoTracking()
            .Where(x => x.StudentId == studentId)
            .OrderByDescending(x => x.MarkedAtUtc)
            .Take(30)
            .Select(x => new StudentAttendanceHistoryRowDto(
                x.Id,
                x.AttendanceDate,
                x.Session!.StartTime,
                x.Session!.EndTime,
                x.MarkedAtUtc,
                x.Status))
            .ToListAsync(cancellationToken);
    }

    public async Task<StudentAttendanceMonthDto> GetStudentMonthAsync(int? year, int? month, CancellationToken cancellationToken)
    {
        var student = await GetAuthenticatedStudentAsync(cancellationToken);
        var today = HallClock.Today;
        var targetYear = year ?? today.Year;
        var targetMonth = month ?? today.Month;

        if (targetYear is < 2000 or > 2100 || targetMonth is < 1 or > 12)
            throw new DomainValidationException("Please select a valid attendance month.");

        var firstDay = new DateOnly(targetYear, targetMonth, 1);
        var lastDay = new DateOnly(targetYear, targetMonth, DateTime.DaysInMonth(targetYear, targetMonth));
        var lastVisibleDay = lastDay > today ? today : lastDay;
        if (firstDay > today)
        {
            lastVisibleDay = firstDay.AddDays(-1);
        }

        var presentLookup = new Dictionary<DateOnly, DateTime>();
        if (firstDay <= lastVisibleDay)
        {
            var records = await db.AttendanceRecords.AsNoTracking()
                .Where(x => x.StudentId == student.Id && x.AttendanceDate >= firstDay && x.AttendanceDate <= lastVisibleDay)
                .GroupBy(x => x.AttendanceDate)
                .Select(x => new
                {
                    Date = x.Key,
                    MarkedAtUtc = x.Min(row => row.MarkedAtUtc),
                })
                .ToListAsync(cancellationToken);

            presentLookup = records.ToDictionary(x => x.Date, x => x.MarkedAtUtc);
        }

        var days = new List<StudentAttendanceMonthDayDto>();
        for (var date = firstDay; date <= lastVisibleDay; date = date.AddDays(1))
        {
            var isPresent = presentLookup.TryGetValue(date, out var markedAtUtc);
            days.Add(new StudentAttendanceMonthDayDto(
                date,
                date.ToString("dddd", CultureInfo.InvariantCulture),
                isPresent ? AttendanceStatus.Present : "Absent",
                isPresent ? markedAtUtc : null));
        }

        var presentDays = days.Count(x => x.Status == AttendanceStatus.Present);
        return new StudentAttendanceMonthDto(
            targetYear,
            targetMonth,
            new DateTime(targetYear, targetMonth, 1).ToString("MMMM yyyy", CultureInfo.InvariantCulture),
            days.Count,
            presentDays,
            days.Count - presentDays,
            days);
    }

    public async Task<AttendanceSheetResponse> GetSheetAsync(
        Guid? sessionId,
        DateOnly? date,
        string? gender,
        string? hallName,
        string? department,
        string? level,
        string? status,
        string? search,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var targetDate = date ?? HallClock.Today;
        var session = await ResolveSheetSessionAsync(sessionId, cancellationToken);

        var studentQuery = await currentUser.ScopeStudentsAsync(
            db.Students.AsNoTracking().Where(x => x.Status == MealResolutionContext.BillableStatus),
            cancellationToken);
if (gender is "Male" or "Female") studentQuery = studentQuery.Where(x => x.Gender == gender);
        if (!IsAll(hallName)) studentQuery = studentQuery.Where(x => x.HallName == hallName);
        if (!IsAll(department)) studentQuery = studentQuery.Where(x => x.Department == department);
        if (!IsAll(level)) studentQuery = studentQuery.Where(x => x.Level == level);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = SearchPattern.Contains(search);
            studentQuery = studentQuery.Where(x =>
                EF.Functions.ILike(x.StudentName, pattern, SearchPattern.EscapeCharacter)
                || EF.Functions.ILike(x.StudentId, pattern, SearchPattern.EscapeCharacter)
                || EF.Functions.ILike(x.HallId, pattern, SearchPattern.EscapeCharacter)
                || EF.Functions.ILike(x.RoomNo, pattern, SearchPattern.EscapeCharacter));
        }

        var presentIds = db.AttendanceRecords.AsNoTracking()
            .Where(x => x.AttendanceDate == targetDate)
            .Select(x => x.StudentId);

        var totalStudents = await studentQuery.CountAsync(cancellationToken);
        var present = await studentQuery.CountAsync(x => presentIds.Contains(x.Id), cancellationToken);
        var absent = totalStudents - present;
        var percentage = totalStudents == 0 ? 0 : Math.Round(present * 100m / totalStudents, 1);

        if (string.Equals(status, "Present", StringComparison.OrdinalIgnoreCase))
            studentQuery = studentQuery.Where(x => presentIds.Contains(x.Id));
        else if (string.Equals(status, "Absent", StringComparison.OrdinalIgnoreCase))
            studentQuery = studentQuery.Where(x => !presentIds.Contains(x.Id));

        var totalRows = await studentQuery.CountAsync(cancellationToken);

        var records = db.AttendanceRecords.AsNoTracking()
            .Where(x => x.AttendanceDate == targetDate);
        var rows = await studentQuery
            .OrderBy(x => x.HallName)
            .ThenBy(x => x.RoomNo)
            .ThenBy(x => x.StudentName)
            .GroupJoin(records, student => student.Id, record => record.StudentId, (student, recordGroup) => new { student, recordGroup })
            .SelectMany(x => x.recordGroup.DefaultIfEmpty(), (x, record) => new AttendanceSheetRowDto(
                x.student.Id,
                x.student.StudentId,
                x.student.StudentName,
                x.student.HallId,
                x.student.HallName,
                x.student.RoomNo,
                x.student.Gender,
                x.student.Department,
                x.student.Level,
                record == null ? "Absent" : record.Status,
                record == null ? null : record.MarkedAtUtc,
                record == null ? null : record.AccuracyMeters,
                record == null ? null : Math.Round(record.DistanceFromHallMeters, 1)))
            .ToListAsync(cancellationToken);

        return new AttendanceSheetResponse(
            session is null ? null : ToDto(session),
            targetDate,
            new AttendanceSheetSummaryDto(totalStudents, present, absent, percentage),
            rows,
            1,
            totalRows,
            totalRows,
            1);
    }

    public static double CalculateDistanceMeters(double latitude1, double longitude1, double latitude2, double longitude2)
    {
        const double earthRadiusMeters = 6371000;
        var dLat = DegreesToRadians(latitude2 - latitude1);
        var dLon = DegreesToRadians(longitude2 - longitude1);
        var lat1 = DegreesToRadians(latitude1);
        var lat2 = DegreesToRadians(latitude2);

        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
            + Math.Cos(lat1) * Math.Cos(lat2) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return earthRadiusMeters * c;
    }

    private async Task<Student> GetAuthenticatedStudentAsync(CancellationToken cancellationToken)
    {
        var studentId = await currentUser.GetStudentIdAsync(cancellationToken);
        return await db.Students.AsNoTracking().FirstOrDefaultAsync(x => x.Id == studentId, cancellationToken)
            ?? throw new UnauthorizedAccessException("A student account is required.");
    }

    private async Task<AttendanceSession?> GetDisplaySessionAsync(string hallKey, CancellationToken cancellationToken)
    {
        var now = HallClock.TimeOfDay;
        return await db.AttendanceSessions.AsNoTracking()
            .Where(x => x.HallId == hallKey && x.IsActive)
            .Where(x => x.EndTime >= now)
            .OrderBy(x => x.StartTime)
            .FirstOrDefaultAsync(cancellationToken)
            ?? await db.AttendanceSessions.AsNoTracking()
                .Where(x => x.HallId == hallKey && x.IsActive)
                .OrderByDescending(x => x.EndTime)
                .FirstOrDefaultAsync(cancellationToken);
    }

    private async Task<AttendanceSession> GetActiveSessionOrThrowAsync(string hallKey, CancellationToken cancellationToken)
    {
        var now = HallClock.TimeOfDay;
        var sessions = await db.AttendanceSessions.AsNoTracking()
            .Where(x => x.HallId == hallKey && x.IsActive)
            .OrderBy(x => x.StartTime)
            .ToListAsync(cancellationToken);
        if (sessions.Count == 0) throw new DomainValidationException("No attendance session is configured for your assigned hall.");

        var current = sessions.FirstOrDefault(x => x.StartTime <= now && x.EndTime >= now);
        if (current is not null) return current;
        if (sessions.Any(x => now < x.StartTime)) throw new DomainValidationException("The attendance window has not started yet.");
        throw new DomainValidationException("The attendance window has closed.");
    }

    private async Task<AttendanceSession?> ResolveSheetSessionAsync(Guid? sessionId, CancellationToken cancellationToken)
    {
        if (sessionId.HasValue)
            return await db.AttendanceSessions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == sessionId.Value, cancellationToken);

        return await db.AttendanceSessions.AsNoTracking()
            .OrderByDescending(x => x.IsActive)
            .ThenBy(x => x.HallName)
            .ThenBy(x => x.StartTime)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private async Task<(string HallId, string HallName)> ResolveManagedHallAsync(string hallId, CancellationToken cancellationToken)
    {
        var normalized = hallId.Trim();
        if (string.IsNullOrWhiteSpace(normalized)) throw new DomainValidationException("Hall is required.");
        var scoped = await currentUser.ScopeStudentsAsync(db.Students.AsNoTracking(), cancellationToken);
        var hall = await scoped
            .Where(x => x.HallName == normalized || x.HallId == normalized)
            .GroupBy(x => x.HallName)
            .Select(x => new { HallId = x.Key, HallName = x.Key, Count = x.Count() })
            .OrderByDescending(x => x.Count)
            .FirstOrDefaultAsync(cancellationToken);
        return hall is null
            ? throw new DomainValidationException("Hall was not found in your permitted student scope.")
            : (hall.HallId, hall.HallName);
    }

    private static bool IsEligibleStudent(Student student)
        => student.Status == MealResolutionContext.BillableStatus && student.LoginAccessEnabled;

    private static void ValidateSessionRequest(SaveAttendanceSessionRequest request)
    {
        if (request.EndTime <= request.StartTime)
            throw new DomainValidationException("Attendance session end time must be after the start time.");
    }

    private static void ValidateCoordinates(double latitude, double longitude)
    {
        if (!double.IsFinite(latitude) || latitude is < -90 or > 90)
            throw new DomainValidationException("Latitude is invalid.");
        if (!double.IsFinite(longitude) || longitude is < -180 or > 180)
            throw new DomainValidationException("Longitude is invalid.");
    }

    private static bool IsAll(string? value) => string.IsNullOrWhiteSpace(value) || value == "All" || value == "all";
    private static double DegreesToRadians(double degrees) => degrees * Math.PI / 180d;

    private static AttendanceHallLocationDto ToDto(AttendanceHallLocation location)
        => new(
            location.Id,
            location.HallId,
            location.HallName,
            location.Latitude,
            location.Longitude,
            location.RadiusMeters,
            location.MaxAccuracyMeters,
            location.IsActive,
            location.CreatedAtUtc,
            location.UpdatedAtUtc);

    private static AttendanceSessionDto ToDto(AttendanceSession session)
        => new(
            session.Id,
            session.HallId,
            session.HallName,
            session.StartTime,
            session.EndTime,
            session.IsActive,
            session.CreatedAtUtc,
            session.UpdatedAtUtc);
}
