using System.Text.RegularExpressions;
using HallBackend.Application.Dtos;
using HallBackend.Application.Mapping;
using HallBackend.Application.Services;
using HallBackend.Domain.Constants;
using HallBackend.Domain.Entities;
using HallBackend.Infrastructure.Data;
using HallBackend.Infrastructure.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Controllers;

[ApiController]
[Authorize]
[Route("api/students")]
public sealed class StudentsController(
    HallDbContext db,
    PasswordService passwords,
    CurrentUserService currentUser,
    BillingCalculationService billing) : ControllerBase
{
    private static readonly string[] ValidStatuses = ["active", "pending_clearance", "inactive", "graduated", "archived"];
    private static readonly string[] ValidLevels = ["Level-01", "Level-02", "Level-03", "Level-04", "Master's"];
    private static readonly Regex StudentCodeRegex = new("^[A-Za-z0-9-]{4,20}$", RegexOptions.Compiled);
    private static readonly Regex PhoneRegex = new("^\\+?\\d{10,15}$", RegexOptions.Compiled);
    private static readonly Regex EmailRegex = new("^\\S+@\\S+\\.\\S+$", RegexOptions.Compiled);

    [HttpGet]
    [RequirePermission(MenuKeys.AdminStudents, PermissionActions.View)]
    public async Task<ActionResult<StudentListResponse>> GetStudents(
        [FromQuery] string? search, [FromQuery] string? department, [FromQuery] string? level, [FromQuery] string? hallName, [FromQuery] string? status, [FromQuery] string? gender,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 10,
        // The bulk-selection UI needs to know which of the ids it already holds still match the
        // current filter (a selection made under a broader filter can be pruned when the admin
        // narrows it). That used to be answered by shipping every matching id on every page turn —
        // at 1,000+ students, that meant scanning and serialising the whole filtered set just to
        // render one page of ten. Scoping the check to the caller's own selection keeps the cost
        // proportional to how many rows are actually selected, not how many rows exist.
        [FromQuery] List<Guid>? selectedIds = null,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        // 2000 comfortably covers "show every student on one page" for any hall's real
        // population while still bounding a single response.
        pageSize = Math.Clamp(pageSize, 1, 2000);
        var query = ApplyFilters(await ScopedStudentsAsync(db.Students.AsNoTracking(), cancellationToken), search, department, level, hallName, status, gender).OrderBy(x => x.StudentName);
        var total = await query.CountAsync(cancellationToken);
        var totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize));
        page = Math.Min(page, totalPages);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).Select(x => x.ToDto()).ToListAsync(cancellationToken);

        var validSelectedIds = selectedIds is { Count: > 0 }
            ? await query.Where(x => selectedIds.Contains(x.Id)).Select(x => x.Id).ToListAsync(cancellationToken)
            : [];

        return new StudentListResponse(items, page, pageSize, total, totalPages, validSelectedIds);
    }

    /// <summary>
    /// Every id matching the current filter, with no pagination — the full-cost query the paged
    /// list above used to run on every page turn. Reserved for "select all matching", which the
    /// admin only asks for explicitly.
    /// </summary>
    [HttpGet("filtered-ids")]
    [RequirePermission(MenuKeys.AdminStudents, PermissionActions.View)]
    public async Task<ActionResult<IReadOnlyList<Guid>>> GetFilteredIds(
        [FromQuery] string? search, [FromQuery] string? department, [FromQuery] string? level, [FromQuery] string? hallName, [FromQuery] string? status, [FromQuery] string? gender,
        CancellationToken cancellationToken)
    {
        var query = ApplyFilters(await ScopedStudentsAsync(db.Students.AsNoTracking(), cancellationToken), search, department, level, hallName, status, gender);
        return await query.Select(x => x.Id).ToListAsync(cancellationToken);
    }

    [HttpGet("export")]
    [RequirePermission(MenuKeys.AdminStudents, PermissionActions.View)]
    public async Task<ActionResult<IReadOnlyList<StudentDto>>> Export([FromQuery] string? search, [FromQuery] string? department, [FromQuery] string? level, [FromQuery] string? hallName, [FromQuery] string? status, [FromQuery] string? gender, CancellationToken cancellationToken)
    {
        return await ApplyFilters(await ScopedStudentsAsync(db.Students.AsNoTracking(), cancellationToken), search, department, level, hallName, status, gender)
            .OrderBy(x => x.StudentName)
            .Select(x => x.ToDto())
            .ToListAsync(cancellationToken);
    }

    [HttpGet("{id:guid}")]
    [RequirePermission(MenuKeys.AdminStudents, PermissionActions.View)]
    public async Task<ActionResult<StudentDto>> GetStudent(Guid id, CancellationToken cancellationToken)
    {
        var student = await (await ScopedStudentsAsync(db.Students.AsNoTracking(), cancellationToken)).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return student is null ? NotFound() : student.ToDto();
    }

    [HttpGet("filter-options")]
    [Microsoft.AspNetCore.OutputCaching.OutputCache(PolicyName = "filter-options-cache")]
    [RequirePermission(MenuKeys.AdminStudents, PermissionActions.View)]
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
    [RequirePermission(MenuKeys.AdminStudents, PermissionActions.Create)]
    public async Task<ActionResult<StudentCredentialDto>> CreateStudent(StudentUpsertRequest request, CancellationToken cancellationToken)
    {
        var wing = await currentUser.GetAdminWingAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(wing) && request.Gender != wing)
            return Forbid();
        var validation = await ValidateAsync(request, null, cancellationToken);
        if (validation.Count > 0) return BadRequest(new ValidationProblemDetails(validation));

        var student = new Student();
        ApplyRequest(student, request);
        // Safe without the account sync: the account does not exist yet and is built from
        // LoginAccessEnabled a few lines below.
        ApplyStatusFlags(student, student.Status);
        db.Students.Add(student);

        // By product decision, the initial password is the student's own ID (as before) rather
        // than a random value — MustChangePassword still forces it to be replaced before the
        // account can be used for anything else (RequirePasswordChangeMiddleware), which is what
        // actually limits exposure from the ID being guessable.
        var temporaryPassword = student.StudentId;
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
            MustChangePassword = true,
            IsActive = student.LoginAccessEnabled,
            PasswordHash = passwords.Hash(temporaryPassword),
        };
        db.Users.Add(user);

        await db.SaveChangesAsync(cancellationToken);

        // The current month's bill cache, if it already exists, has no row for this student —
        // EnsureMonthCalculatedAsync short-circuits once any row is present for the month, so
        // without this the new student's bill page 404s until an unrelated write happens to
        // trigger a rebuild. The current month is never a future period, so this always runs.
        var today = HallClock.Today;
        await billing.RecalculateMonthAsync(today.Month, today.Year, cancellationToken);

        return CreatedAtAction(nameof(GetStudent), new { id = student.Id }, new StudentCredentialDto(student.ToDto(), temporaryPassword));
    }

    [HttpPut("{id:guid}")]
    [RequirePermission(MenuKeys.AdminStudents, PermissionActions.Edit)]
    public async Task<ActionResult<StudentDto>> UpdateStudent(Guid id, StudentUpsertRequest request, CancellationToken cancellationToken)
    {
        var student = await (await ScopedStudentsAsync(db.Students, cancellationToken)).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (student is null) return NotFound();
        var wing = await currentUser.GetAdminWingAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(wing) && request.Gender != wing) return Forbid();

        var validation = await ValidateAsync(request, id, cancellationToken);
        if (validation.Count > 0) return BadRequest(new ValidationProblemDetails(validation));

        ApplyRequest(student, request);
        await ApplyStatusAsync(student, student.Status, cancellationToken);
        var user = await db.Users.FirstOrDefaultAsync(x => x.StudentId == student.Id, cancellationToken);
        if (user is not null)
        {
            // IsActive is handled by ApplyStatusAsync above; only the identity fields are left.
            user.FullName = student.StudentName;
            user.UserName = student.StudentId;
            user.NormalizedUserName = student.StudentId.ToUpperInvariant();
        }
        await db.SaveChangesAsync(cancellationToken);
        return student.ToDto();
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission(MenuKeys.AdminStudents, PermissionActions.Delete)]
    public async Task<ActionResult<StudentDto>> MarkInactive(Guid id, CancellationToken cancellationToken)
    {
        var student = await (await ScopedStudentsAsync(db.Students, cancellationToken)).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (student is null) return NotFound();
        await ApplyStatusAsync(student, "inactive", cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return student.ToDto();
    }

    [HttpDelete("{id:guid}/permanent")]
    [RequirePermission(MenuKeys.AdminStudents, PermissionActions.Delete)]
    public async Task<ActionResult<BulkStudentResponse>> PermanentDelete(Guid id, [FromQuery] bool force = false, CancellationToken cancellationToken = default)
    {
        var student = await (await ScopedStudentsAsync(db.Students, cancellationToken)).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (student is null) return NotFound();
        if (!force && !student.PermanentDeleteEligible) return BadRequest(new { message = "Student is not eligible for permanent deletion." });

        await DetachStudentNotificationsAsync([student.Id], cancellationToken);
        await RemoveLoginAccountsAsync([student.Id], cancellationToken);
        db.Students.Remove(student);
        await db.SaveChangesAsync(cancellationToken);
        await CleanUpOrphanedDswSubsidiesAsync(cancellationToken);
        return new BulkStudentResponse(0, [], 1, [id], []);
    }

    [HttpPost("bulk")]
    [RequirePermission(MenuKeys.AdminStudents, PermissionActions.Edit)]
    public async Task<ActionResult<BulkStudentResponse>> BulkUpdate(BulkStudentRequest request, CancellationToken cancellationToken)
    {
        if (request.SelectedStudentIds.Count == 0) return BadRequest(new { message = "Select at least one student first." });

        // Reject the whole batch on a bad value rather than silently skipping it — unlike the
        // single-student path (ValidateAsync), this wrote whatever string was sent straight onto
        // Status/Level with no check, so a typo (or a crafted request) could put students into a
        // status no query matches, dropping them from every active list while the billing engine
        // still counted them.
        if (request.UpdateFields.TryGetValue("status", out var statusValue)
            && !string.IsNullOrWhiteSpace(statusValue) && !ValidStatuses.Contains(statusValue))
            return BadRequest(new { message = $"'{statusValue}' is not a valid status." });
        if (request.UpdateFields.TryGetValue("level", out var levelValue)
            && !string.IsNullOrWhiteSpace(levelValue) && !ValidLevels.Contains(levelValue))
            return BadRequest(new { message = $"'{levelValue}' is not a valid level." });

        var students = await (await ScopedStudentsAsync(db.Students, cancellationToken)).Where(x => request.SelectedStudentIds.Contains(x.Id)).ToListAsync(cancellationToken);

        foreach (var student in students)
        {
            foreach (var field in request.UpdateFields)
            {
                ApplyBulkField(student, field.Key, field.Value);
            }
        }
        // One pass over the whole selection, so archiving or reactivating in bulk moves the login
        // accounts with it rather than leaving them on their previous setting.
        await ApplyStatusAsync(students, cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        return new BulkStudentResponse(students.Count, students.Select(x => x.Id).ToList());
    }

    [HttpPost("bulk/archive")]
    [RequirePermission(MenuKeys.AdminStudents, PermissionActions.Edit)]
    public Task<ActionResult<BulkStudentResponse>> BulkArchive(BulkStudentRequest request, CancellationToken cancellationToken)
    {
        request.UpdateFields["status"] = "archived";
        return BulkUpdate(request, cancellationToken);
    }

    [HttpPost("bulk/reactivate")]
    [RequirePermission(MenuKeys.AdminStudents, PermissionActions.Edit)]
    public Task<ActionResult<BulkStudentResponse>> BulkReactivate(BulkStudentRequest request, CancellationToken cancellationToken)
    {
        request.UpdateFields["status"] = "active";
        return BulkUpdate(request, cancellationToken);
    }

    [HttpPost("bulk/permanent-delete")]
    [RequirePermission(MenuKeys.AdminStudents, PermissionActions.Delete)]
    public async Task<ActionResult<BulkStudentResponse>> BulkPermanentDelete(BulkStudentRequest request, CancellationToken cancellationToken)
    {
        if (request.SelectedStudentIds.Count == 0) return BadRequest(new { message = "Select at least one student first." });
        var students = await (await ScopedStudentsAsync(db.Students, cancellationToken)).Where(x => request.SelectedStudentIds.Contains(x.Id)).ToListAsync(cancellationToken);
        var eligible = students.Where(x => request.Force || x.PermanentDeleteEligible).ToList();
        var skipped = students.Where(x => !eligible.Contains(x)).Select(x => x.Id).ToList();

        if (eligible.Count > 0)
        {
            await DetachStudentNotificationsAsync(eligible.Select(x => x.Id), cancellationToken);
            await RemoveLoginAccountsAsync(eligible.Select(x => x.Id), cancellationToken);
        }

        db.Students.RemoveRange(eligible);
        await db.SaveChangesAsync(cancellationToken);
        if (eligible.Count > 0) await CleanUpOrphanedDswSubsidiesAsync(cancellationToken);

        return new BulkStudentResponse(0, [], eligible.Count, eligible.Select(x => x.Id).ToList(), skipped);
    }

    [HttpPost("{id:guid}/reset-password")]
    [RequirePermission(MenuKeys.AdminStudents, PermissionActions.Edit)]
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

        // Same product decision as account creation: reset restores the password to the
        // student's own ID rather than issuing a random one. MustChangePassword still forces it
        // to be replaced before the account can be used for anything else.
        var temporaryPassword = student.StudentId;
        user.PasswordHash = passwords.Hash(temporaryPassword);
        user.MustChangePassword = true;
        await db.SaveChangesAsync(cancellationToken);

        return Ok(new { studentId = student.StudentId, temporaryPassword });
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
            // ILIKE (not ToLower().Contains) so the gin_trgm_ops indexes can be used.
            var pattern = SearchPattern.Contains(search);
            query = query.Where(x =>
                EF.Functions.ILike(x.StudentName, pattern, SearchPattern.EscapeCharacter)
                || EF.Functions.ILike(x.StudentId, pattern, SearchPattern.EscapeCharacter)
                || EF.Functions.ILike(x.RollNumber, pattern, SearchPattern.EscapeCharacter)
                || EF.Functions.ILike(x.HallId, pattern, SearchPattern.EscapeCharacter)
                || EF.Functions.ILike(x.MobileNumber, pattern, SearchPattern.EscapeCharacter));
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
        // AppUser.StudentId is nullable — an account whose student was permanently deleted keeps
        // its login row with StudentId set to null (see PermanentDelete's SetNull behavior). The
        // old "x.StudentId != id" comparison treated a null-vs-null match (id is also null on
        // create) as "not a conflict", so it let a duplicate username slip past validation and
        // straight into an unhandled unique-constraint crash on save. On create (id is null) any
        // existing row with this username is a genuine conflict, orphaned or not; on update, only
        // exclude the student's own linked account.
        if (await db.Users.AnyAsync(x => x.NormalizedUserName == studentId.ToUpperInvariant() && (id == null || x.StudentId != id), cancellationToken)) Add(nameof(request.StudentId), "This student ID is already being used for login.");
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
        // An explicit value (create or edit) always wins. Otherwise: a brand-new student
        // (JoinDate still at its uninitialized default) gets today; an existing student keeps
        // whatever join date it already has rather than being silently reset.
        student.JoinDate = request.JoinDate
            ?? (student.JoinDate == default ? HallClock.Today : student.JoinDate);
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

    /// <summary>
    /// Derives the student-side status flags. Touches only the student row, so it is safe on its
    /// own <b>only</b> when the caller creates the login account itself in the same unit of work.
    /// Every other caller must go through <see cref="ApplyStatusAsync(Student, string, CancellationToken)"/>
    /// or its bulk overload, which also mirrors the result onto the account.
    /// </summary>
    private static void ApplyStatusFlags(Student student, string status)
    {
        student.Status = status;
        student.LoginAccessEnabled = status is "active" or "pending_clearance";
        student.ReactivationEligible = status is "inactive" or "archived" or "graduated" or "pending_clearance";
        student.PermanentDeleteEligible = status is "inactive" or "archived" or "graduated";
    }

    /// <summary>Applies a status change to one student and mirrors it onto their login account.</summary>
    private async Task ApplyStatusAsync(Student student, string status, CancellationToken cancellationToken)
    {
        ApplyStatusFlags(student, status);
        await SyncLoginAccessAsync([student], cancellationToken);
    }

    /// <summary>
    /// Re-derives each student's flags from the status already set on them — a bulk edit can give
    /// every student a different one — and mirrors the result onto their accounts.
    /// </summary>
    private async Task ApplyStatusAsync(IReadOnlyCollection<Student> students, CancellationToken cancellationToken)
    {
        foreach (var student in students) ApplyStatusFlags(student, student.Status);
        await SyncLoginAccessAsync(students, cancellationToken);
    }

    /// <summary>
    /// Copies <see cref="Student.LoginAccessEnabled"/> onto the matching <c>AppUser.IsActive</c>.
    ///
    /// Login access is stored twice: on the student for the admin screens, and on the account for
    /// the login endpoint, which rejects on <c>!IsActive</c> before it ever checks a password.
    /// When only the student was updated the two drifted apart in both directions — a reactivated
    /// student whose account stayed disabled could not sign in despite reading as active
    /// everywhere, and a deactivated student whose account stayed enabled could still sign in.
    /// </summary>
    private async Task SyncLoginAccessAsync(IReadOnlyCollection<Student> students, CancellationToken cancellationToken)
    {
        if (students.Count == 0) return;

        var accessByStudentId = students.ToDictionary(x => x.Id, x => x.LoginAccessEnabled);
        var ids = accessByStudentId.Keys.ToList();
        var users = await db.Users
            .Where(x => x.StudentId != null && ids.Contains(x.StudentId.Value))
            .ToListAsync(cancellationToken);

        foreach (var user in users)
        {
            if (user.StudentId is Guid studentId && accessByStudentId.TryGetValue(studentId, out var isEnabled))
            {
                user.IsActive = isEnabled;
            }
        }
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

    /// <summary>
    /// Removes the login account tied to each permanently-deleted student. The FK is
    /// <c>SetNull</c>, not cascade, so without this the account survives with its Student link
    /// cleared — a harmless-looking orphan that nonetheless keeps the old student ID's username
    /// permanently reserved. Re-registering the same ID as a new student then failed validation's
    /// duplicate-username check (it treated the orphan's null StudentId as "not a conflict") and
    /// crashed on the database's own unique constraint instead. Deleting the account here is safe:
    /// a student's own account is never the actor referenced by any admin-side financial row
    /// (inventory, bills, subsidies) — only admin accounts are, and those are never deleted here.
    /// </summary>
    private async Task RemoveLoginAccountsAsync(IEnumerable<Guid> studentIds, CancellationToken cancellationToken)
    {
        var ids = studentIds.Distinct().ToList();
        if (ids.Count == 0) return;

        var accounts = await db.Users
            .Where(x => x.StudentId.HasValue && ids.Contains(x.StudentId.Value))
            .ToListAsync(cancellationToken);

        db.Users.RemoveRange(accounts);
    }

    /// <summary>
    /// Removes DswSubsidy summary rows left behind once every student in their distribution has
    /// been permanently deleted. Distributions cascade-delete with the student, but the parent
    /// row's EligibleStudentCount/PerStudentSubsidy/SubsidyAmount is a frozen snapshot with no FK
    /// back to Student — without this it sits forever showing a headcount that no longer exists,
    /// which is exactly the stale "12 eligible students" an admin would otherwise keep seeing
    /// after every one of those students was deleted.
    /// </summary>
    private async Task CleanUpOrphanedDswSubsidiesAsync(CancellationToken cancellationToken)
    {
        var orphaned = await db.DswSubsidies.Where(x => !x.Distributions.Any()).ToListAsync(cancellationToken);
        if (orphaned.Count == 0) return;
        db.DswSubsidies.RemoveRange(orphaned);
        await db.SaveChangesAsync(cancellationToken);
    }

    private static bool IsAll(string? value) => string.IsNullOrWhiteSpace(value) || value == "all";
}
