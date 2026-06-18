using System.Text.RegularExpressions;
using HallBackend.Application.Dtos;
using HallBackend.Application.Mapping;
using HallBackend.Application.Services;
using HallBackend.Domain.Constants;
using HallBackend.Domain.Entities;
using HallBackend.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Controllers;

[ApiController]
[Authorize(Roles = Roles.HallAdministrators)]
[Route("api/students")]
public sealed class StudentsController(HallDbContext db, PasswordService passwords, CurrentUserService currentUser) : ControllerBase
{
    private static readonly string[] ValidStatuses = ["active", "pending_clearance", "inactive", "graduated", "archived"];
    private static readonly string[] ValidLevels = ["Level-01", "Level-02", "Level-03", "Level-04", "Master's"];
    private static readonly Regex StudentCodeRegex = new("^[A-Za-z0-9-]{4,20}$", RegexOptions.Compiled);
    private static readonly Regex PhoneRegex = new("^\\+?\\d{10,15}$", RegexOptions.Compiled);
    private static readonly Regex EmailRegex = new("^\\S+@\\S+\\.\\S+$", RegexOptions.Compiled);

    [HttpGet]
    public async Task<ActionResult<StudentListResponse>> GetStudents([FromQuery] string? search, [FromQuery] string? department, [FromQuery] string? level, [FromQuery] string? hallName, [FromQuery] string? status, [FromQuery] string? gender, [FromQuery] int page = 1, [FromQuery] int pageSize = 10, CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = ApplyFilters(await ScopedStudentsAsync(db.Students.AsNoTracking(), cancellationToken), search, department, level, hallName, status, gender).OrderBy(x => x.StudentName);
        var filteredIds = await query.Select(x => x.Id).ToListAsync(cancellationToken);
        var total = filteredIds.Count;
        var totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize));
        page = Math.Min(page, totalPages);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).Select(x => x.ToDto()).ToListAsync(cancellationToken);

        return new StudentListResponse(items, page, pageSize, total, totalPages, filteredIds);
    }

    [HttpGet("export")]
    public async Task<ActionResult<IReadOnlyList<StudentDto>>> Export([FromQuery] string? search, [FromQuery] string? department, [FromQuery] string? level, [FromQuery] string? hallName, [FromQuery] string? status, [FromQuery] string? gender, CancellationToken cancellationToken)
    {
        return await ApplyFilters(await ScopedStudentsAsync(db.Students.AsNoTracking(), cancellationToken), search, department, level, hallName, status, gender)
            .OrderBy(x => x.StudentName)
            .Select(x => x.ToDto())
            .ToListAsync(cancellationToken);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<StudentDto>> GetStudent(Guid id, CancellationToken cancellationToken)
    {
        var student = await (await ScopedStudentsAsync(db.Students.AsNoTracking(), cancellationToken)).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return student is null ? NotFound() : student.ToDto();
    }

    [HttpGet("filter-options")]
    [Microsoft.AspNetCore.OutputCaching.OutputCache(PolicyName = "filter-options-cache")]
    public async Task<StudentFilterOptionsResponse> GetFilterOptions(CancellationToken cancellationToken)
    {
        var students = await ScopedStudentsAsync(db.Students.AsNoTracking(), cancellationToken);
        var raw = await students.Select(x => new { x.Department, x.Level, x.HallName }).ToListAsync(cancellationToken);
        
        var departments = raw.Select(x => x.Department).Where(x => !string.IsNullOrEmpty(x)).Distinct().OrderBy(x => x).ToList();
        var levels = raw.Select(x => x.Level).Where(x => !string.IsNullOrEmpty(x)).Distinct().OrderBy(x => x).ToList();
        var halls = raw.Select(x => x.HallName).Where(x => !string.IsNullOrEmpty(x)).Distinct().OrderBy(x => x).ToList();
        
        return new StudentFilterOptionsResponse(departments, levels, halls);
    }

    [HttpPost]
    public async Task<ActionResult<StudentDto>> CreateStudent(StudentUpsertRequest request, CancellationToken cancellationToken)
    {
        var wing = await currentUser.GetAdminWingAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(wing) && request.Gender != wing)
            return Forbid();
        var validation = await ValidateAsync(request, null, cancellationToken);
        if (validation.Count > 0) return BadRequest(new ValidationProblemDetails(validation));

        var student = new Student();
        ApplyRequest(student, request);
        ApplyStatusSideEffects(student, student.Status);
        db.Students.Add(student);

        var user = new AppUser
        {
            Student = student,
            FullName = student.StudentName,
            UserName = student.StudentId,
            NormalizedUserName = student.StudentId.ToUpperInvariant(),
            Email = string.Empty,
            NormalizedEmail = string.Empty,
            Role = Roles.Student,
            Designation = "Resident Student",
            MustChangePassword = false,
            IsActive = student.LoginAccessEnabled,
            PasswordHash = passwords.Hash(student.StudentId),
        };
        db.Users.Add(user);

        await db.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetStudent), new { id = student.Id }, student.ToDto());
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<StudentDto>> UpdateStudent(Guid id, StudentUpsertRequest request, CancellationToken cancellationToken)
    {
        var student = await (await ScopedStudentsAsync(db.Students, cancellationToken)).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (student is null) return NotFound();
        var wing = await currentUser.GetAdminWingAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(wing) && request.Gender != wing) return Forbid();

        var validation = await ValidateAsync(request, id, cancellationToken);
        if (validation.Count > 0) return BadRequest(new ValidationProblemDetails(validation));

        ApplyRequest(student, request);
        ApplyStatusSideEffects(student, student.Status);
        var user = await db.Users.FirstOrDefaultAsync(x => x.StudentId == student.Id, cancellationToken);
        if (user is not null)
        {
            user.FullName = student.StudentName;
            user.UserName = student.StudentId;
            user.NormalizedUserName = student.StudentId.ToUpperInvariant();
            user.IsActive = student.LoginAccessEnabled;
        }
        await db.SaveChangesAsync(cancellationToken);
        return student.ToDto();
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<StudentDto>> MarkInactive(Guid id, CancellationToken cancellationToken)
    {
        var student = await (await ScopedStudentsAsync(db.Students, cancellationToken)).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (student is null) return NotFound();
        ApplyStatusSideEffects(student, "inactive");
        await db.SaveChangesAsync(cancellationToken);
        return student.ToDto();
    }

    [HttpDelete("{id:guid}/permanent")]
    public async Task<ActionResult<BulkStudentResponse>> PermanentDelete(Guid id, [FromQuery] bool force = false, CancellationToken cancellationToken = default)
    {
        var student = await (await ScopedStudentsAsync(db.Students, cancellationToken)).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (student is null) return NotFound();
        if (!force && !student.PermanentDeleteEligible) return BadRequest(new { message = "Student is not eligible for permanent deletion." });

        await DetachStudentNotificationsAsync([student.Id], cancellationToken);
        db.Students.Remove(student);
        await db.SaveChangesAsync(cancellationToken);
        return new BulkStudentResponse(0, [], 1, [id], []);
    }

    [HttpPost("bulk")]
    public async Task<ActionResult<BulkStudentResponse>> BulkUpdate(BulkStudentRequest request, CancellationToken cancellationToken)
    {
        if (request.SelectedStudentIds.Count == 0) return BadRequest(new { message = "Select at least one student first." });
        var students = await (await ScopedStudentsAsync(db.Students, cancellationToken)).Where(x => request.SelectedStudentIds.Contains(x.Id)).ToListAsync(cancellationToken);

        foreach (var student in students)
        {
            foreach (var field in request.UpdateFields)
            {
                ApplyBulkField(student, field.Key, field.Value);
            }
            ApplyStatusSideEffects(student, student.Status);
        }

        await db.SaveChangesAsync(cancellationToken);
        return new BulkStudentResponse(students.Count, students.Select(x => x.Id).ToList());
    }

    [HttpPost("bulk/archive")]
    public Task<ActionResult<BulkStudentResponse>> BulkArchive(BulkStudentRequest request, CancellationToken cancellationToken)
    {
        request.UpdateFields["status"] = "archived";
        return BulkUpdate(request, cancellationToken);
    }

    [HttpPost("bulk/reactivate")]
    public Task<ActionResult<BulkStudentResponse>> BulkReactivate(BulkStudentRequest request, CancellationToken cancellationToken)
    {
        request.UpdateFields["status"] = "active";
        return BulkUpdate(request, cancellationToken);
    }

    [HttpPost("bulk/permanent-delete")]
    public async Task<ActionResult<BulkStudentResponse>> BulkPermanentDelete(BulkStudentRequest request, CancellationToken cancellationToken)
    {
        if (request.SelectedStudentIds.Count == 0) return BadRequest(new { message = "Select at least one student first." });
        var students = await (await ScopedStudentsAsync(db.Students, cancellationToken)).Where(x => request.SelectedStudentIds.Contains(x.Id)).ToListAsync(cancellationToken);
        var eligible = students.Where(x => request.Force || x.PermanentDeleteEligible).ToList();
        var skipped = students.Where(x => !eligible.Contains(x)).Select(x => x.Id).ToList();

        if (eligible.Count > 0)
        {
            await DetachStudentNotificationsAsync(eligible.Select(x => x.Id), cancellationToken);
        }

        db.Students.RemoveRange(eligible);
        await db.SaveChangesAsync(cancellationToken);

        return new BulkStudentResponse(0, [], eligible.Count, eligible.Select(x => x.Id).ToList(), skipped);
    }

    [HttpPost("{id:guid}/reset-password")]
    public async Task<ActionResult<object>> ResetPassword(Guid id, CancellationToken cancellationToken)
    {
        var student = await (await ScopedStudentsAsync(db.Students, cancellationToken)).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (student is null) return NotFound();

        var user = await db.Users.FirstOrDefaultAsync(x => x.StudentId == student.Id, cancellationToken);
        if (user is null)
        {
            user = new AppUser
            {
                StudentId = student.Id,
                FullName = student.StudentName,
                UserName = student.StudentId,
                NormalizedUserName = student.StudentId.ToUpperInvariant(),
                Email = string.Empty,
                NormalizedEmail = string.Empty,
                Role = Roles.Student,
                Designation = "Resident Student",
                IsActive = student.LoginAccessEnabled,
            };
            db.Users.Add(user);
        }

        user.PasswordHash = passwords.Hash(student.StudentId);
        user.MustChangePassword = true;
        await db.SaveChangesAsync(cancellationToken);

        return Ok(new { studentId = student.StudentId });
    }

    private async Task<IQueryable<Student>> ScopedStudentsAsync(IQueryable<Student> query, CancellationToken cancellationToken)
    {
        var wing = await currentUser.GetAdminWingAsync(cancellationToken);
        return string.IsNullOrWhiteSpace(wing) ? query : query.Where(x => x.Gender == wing);
    }

    private static IQueryable<Student> ApplyFilters(IQueryable<Student> query, string? search, string? department, string? level, string? hallName, string? status, string? gender = null)
    {
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x => x.StudentName.ToLower().Contains(term) || x.StudentId.ToLower().Contains(term) || x.RollNumber.ToLower().Contains(term) || x.HallId.ToLower().Contains(term) || x.MobileNumber.ToLower().Contains(term));
        }
        if (!IsAll(department)) query = query.Where(x => x.Department == department);
        if (!IsAll(level)) query = query.Where(x => x.Level == level);
        if (!IsAll(hallName)) query = query.Where(x => x.HallName == hallName);
        if (!IsAll(status)) query = query.Where(x => x.Status == status);
        // gender filter — only meaningful for super_admin/admin; wing admins are already scoped by ScopedStudentsAsync
        if (gender is "Male" or "Female") query = query.Where(x => x.Gender == gender);
        return query;
    }

    private async Task<Dictionary<string, string[]>> ValidateAsync(StudentUpsertRequest request, Guid? id, CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        void Add(string key, string message) => errors[key] = [message];
        var studentId = request.StudentId?.Trim() ?? string.Empty;
        var level = string.IsNullOrWhiteSpace(request.Level) ? "Level-01" : request.Level.Trim();
        var status = string.IsNullOrWhiteSpace(request.Status) ? "active" : request.Status.Trim();

        if (string.IsNullOrWhiteSpace(request.StudentName)) Add(nameof(request.StudentName), "Student name is required.");
        if (string.IsNullOrWhiteSpace(request.StudentId)) Add(nameof(request.StudentId), "Student ID is required.");
        if (request.Gender is not ("Male" or "Female")) Add(nameof(request.Gender), "Gender must be Male or Female.");
        if (string.IsNullOrWhiteSpace(request.Department)) Add(nameof(request.Department), "Department is required.");
        if (string.IsNullOrWhiteSpace(request.HallId)) Add(nameof(request.HallId), "Hall ID is required.");
        if (string.IsNullOrWhiteSpace(request.MobileNumber)) Add(nameof(request.MobileNumber), "Mobile number is required.");
        if (!string.IsNullOrWhiteSpace(request.MobileNumber) && !PhoneRegex.IsMatch(Regex.Replace(request.MobileNumber, "\\s+", ""))) Add(nameof(request.MobileNumber), "Enter a valid mobile number with 10-15 digits.");
        if (string.IsNullOrWhiteSpace(request.HallName)) Add(nameof(request.HallName), "Hall name is required.");
        if (string.IsNullOrWhiteSpace(request.RoomNo)) Add(nameof(request.RoomNo), "Room number is required.");
        if (!ValidLevels.Contains(level)) Add(nameof(request.Level), "Select a valid level.");
        if (!ValidStatuses.Contains(status)) Add(nameof(request.Status), "Select a valid status.");
        if (!string.IsNullOrWhiteSpace(studentId) && !StudentCodeRegex.IsMatch(studentId)) Add(nameof(request.StudentId), "Student ID must be 4-20 characters using letters, numbers, or dashes.");
        if (await db.Students.AnyAsync(x => (x.StudentId == studentId || x.RollNumber == studentId) && x.Id != id, cancellationToken)) Add(nameof(request.StudentId), "This student ID already exists.");
        if (await db.Users.AnyAsync(x => x.NormalizedUserName == studentId.ToUpperInvariant() && x.StudentId != id, cancellationToken)) Add(nameof(request.StudentId), "This student ID is already being used for login.");
        return errors;
    }

    private static void ApplyRequest(Student student, StudentUpsertRequest request)
    {
        student.StudentName = request.StudentName?.Trim() ?? string.Empty;
        student.StudentId = request.StudentId?.Trim() ?? string.Empty;
        student.RollNumber = student.StudentId;
        student.Gender = request.Gender ?? string.Empty;
        student.Department = request.Department?.Trim() ?? string.Empty;
        student.HallId = request.HallId?.Trim() ?? string.Empty;
        student.MobileNumber = request.MobileNumber?.Trim() ?? string.Empty;
        student.Level = string.IsNullOrWhiteSpace(request.Level) ? "Level-01" : request.Level.Trim();
        student.HallName = request.HallName?.Trim() ?? string.Empty;
        student.RoomNo = request.RoomNo?.Trim() ?? string.Empty;
        student.Status = string.IsNullOrWhiteSpace(request.Status) ? "active" : request.Status.Trim();
    }

    private static void ApplyBulkField(Student student, string key, string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return;
        switch (key)
        {
            case "level": student.Level = value; break;
            case "hallName": student.HallName = value; break;
            case "roomNo": student.RoomNo = value; break;
            case "status": student.Status = value; break;
        }
    }

    private static void ApplyStatusSideEffects(Student student, string status)
    {
        student.Status = status;
        student.LoginAccessEnabled = status is "active" or "pending_clearance";
        student.ReactivationEligible = status is "inactive" or "archived" or "graduated" or "pending_clearance";
        student.PermanentDeleteEligible = status is "inactive" or "archived" or "graduated";
    }

    private async Task DetachStudentNotificationsAsync(IEnumerable<Guid> studentIds, CancellationToken cancellationToken)
    {
        var ids = studentIds.Distinct().ToList();
        if (ids.Count == 0) return;

        var notifications = await db.Notifications
            .Where(x => x.StudentId.HasValue && ids.Contains(x.StudentId.Value))
            .ToListAsync(cancellationToken);

        foreach (var notification in notifications)
        {
            notification.StudentId = null;
            notification.Student = null;
        }
    }

    private static bool IsAll(string? value) => string.IsNullOrWhiteSpace(value) || value == "all";
}
