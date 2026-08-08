using HallBackend.Domain.Constants;
using HallBackend.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Infrastructure.Data;

/// <summary>
/// Installs the permission tree and the built-in roles, then backfills a default grant set the
/// first time a role is seen.
///
/// Runs on every startup and is idempotent: menus are upserted by key so new pages appear in the
/// matrix automatically after a deploy, while existing grants are never overwritten — once a super
/// admin has tuned a role, that decision survives restarts.
/// </summary>
public sealed class AccessControlSeeder(HallDbContext db)
{
    private sealed record MenuSeed(string Key, string Label, string? RoutePath, string Area, MenuSeed[] Children);

    private static MenuSeed Section(string key, string label, string area, params MenuSeed[] children)
        => new(key, label, null, area, children);

    private static MenuSeed Page(string key, string label, string route, string area)
        => new(key, label, route, area, []);

    private static readonly MenuSeed[] Tree =
    [
        Section(MenuKeys.AdminStudentsSection, "Student Control", "admin",
            Page(MenuKeys.AdminStudents, "Student Management", "/admin/students", "admin")),

        Section(MenuKeys.AdminMealsSection, "Meal Control", "admin",
            Page(MenuKeys.AdminMeals, "Meal Management", "/admin/meals", "admin"),
            Page(MenuKeys.AdminMealSheet, "Meal Sheet", "/admin/meal-sheet", "admin"),
            Page(MenuKeys.AdminAdditionalItems, "Additional Meal Items", "/admin/meals", "admin")),

        Section(MenuKeys.AdminInventorySection, "Inventory", "admin",
            Page(MenuKeys.AdminInventory, "Inventory", "/admin/inventory", "admin")),

        Section(MenuKeys.AdminFinanceSection, "Finance", "admin",
            Page(MenuKeys.AdminBilling, "Bill Management", "/admin/billing", "admin"),
            Page(MenuKeys.AdminDue, "Due Bill", "/admin/due", "admin"),
            Page(MenuKeys.AdminPayments, "Payment Verification", "/admin/payments", "admin"),
            Page(MenuKeys.AdminDailyCost, "Daily Cost", "/admin/daily-cost", "admin"),
            Page(MenuKeys.AdminOthersBill, "Others Bill", "/admin/billing", "admin")),

        Section(MenuKeys.AdminCommsSection, "Communication", "admin",
            Page(MenuKeys.AdminNoticeBoard, "Notice Board", "/admin/notice-board", "admin")),

        Section(MenuKeys.AdminSystemSection, "System", "admin",
            Page(MenuKeys.AdminSettings, "Settings", "/admin/settings", "admin"),
            Page(MenuKeys.AdminRolePermissions, "Role Permissions", "/admin/settings", "admin")),

        Section(MenuKeys.StudentMealsSection, "Meals", "student",
            Page(MenuKeys.StudentMeals, "Meal Preferences", "/student/meals", "student"),
            Page(MenuKeys.StudentMealSnapshot, "Meal Snapshot", "/student/meal-snapshot", "student"),
            Page(MenuKeys.StudentViewMenu, "View Menu", "/student/view-menu", "student"),
            Page(MenuKeys.StudentAdditionalPreferences, "Additional Preferences", "/student/meals", "student")),

        Section(MenuKeys.StudentFinanceSection, "Finance", "student",
            Page(MenuKeys.StudentBilling, "Billing", "/student/billing", "student"),
            Page(MenuKeys.StudentPayments, "Payments", "/student/payments", "student"),
            Page(MenuKeys.StudentDailyCost, "Daily Cost", "/student/daily-cost", "student")),

        Section(MenuKeys.StudentCommsSection, "Communication", "student",
            Page(MenuKeys.StudentNoticeBoard, "Notice Board", "/student/notice-board", "student")),
    ];

    private static readonly (string Key, string Label, string Area, int Sort)[] BuiltInRoles =
    [
        (Roles.SuperAdmin, "Super Admin", "admin", 0),
        (Roles.MaleWingAdmin, "Male Wing Admin", "admin", 1),
        (Roles.FemaleWingAdmin, "Female Wing Admin", "admin", 2),
        (Roles.Admin, "Administrator", "admin", 3),
        (Roles.Student, "Student", "student", 4),
    ];

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        await SeedRolesAsync(cancellationToken);
        var (menusByKey, newMenuKeys) = await SeedMenusAsync(cancellationToken);
        await SeedDefaultGrantsAsync(menusByKey, newMenuKeys, cancellationToken);
    }

    private async Task SeedRolesAsync(CancellationToken cancellationToken)
    {
        var existing = await db.AppRoles.ToDictionaryAsync(x => x.Key, cancellationToken);
        foreach (var (key, label, area, sort) in BuiltInRoles)
        {
            if (existing.TryGetValue(key, out var row))
            {
                // Labels and ordering are ours to correct; IsActive is the operator's.
                row.Label = label;
                row.Area = area;
                row.SortOrder = sort;
                row.IsSystem = true;
                continue;
            }
            db.AppRoles.Add(new AppRole
            {
                Key = key, Label = label, Area = area, SortOrder = sort, IsSystem = true,
            });
        }
        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Upserts the tree and reports which menus were created for the first time on this run, so
    /// callers can tell "brand new" apart from "deliberately revoked".
    /// </summary>
    private async Task<(Dictionary<string, AppMenu> ByKey, HashSet<string> NewKeys)> SeedMenusAsync(
        CancellationToken cancellationToken)
    {
        var existing = await db.AppMenus.ToDictionaryAsync(x => x.Key, cancellationToken);
        var newKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var sort = 0;

        async Task WalkAsync(MenuSeed[] nodes, Guid? parentId)
        {
            foreach (var node in nodes)
            {
                var order = sort++;
                if (existing.TryGetValue(node.Key, out var row))
                {
                    row.Label = node.Label;
                    row.RoutePath = node.RoutePath;
                    row.Area = node.Area;
                    row.ParentId = parentId;
                    row.SortOrder = order;
                    row.IsActive = true;
                }
                else
                {
                    row = new AppMenu
                    {
                        Key = node.Key,
                        Label = node.Label,
                        RoutePath = node.RoutePath,
                        Area = node.Area,
                        ParentId = parentId,
                        SortOrder = order,
                    };
                    db.AppMenus.Add(row);
                    existing[node.Key] = row;
                    newKeys.Add(node.Key);
                }

                // Parent ids must exist before children reference them.
                await db.SaveChangesAsync(cancellationToken);
                await WalkAsync(node.Children, row.Id);
            }
        }

        await WalkAsync(Tree, null);
        return (existing, newKeys);
    }

    /// <summary>
    /// Gives a role its starting grants the first time it appears.
    ///
    /// For a role that already has rows, only menus created on <em>this</em> run are defaulted.
    /// That distinction matters: a menu with no row is normally a deliberate revocation (the save
    /// path deletes all-false rows), and re-granting it on every restart would silently undo the
    /// super admin. A brand-new menu cannot have been revoked yet, so defaulting it is safe — and
    /// without it, a deploy that adds a page would leave every existing role unable to reach it.
    /// </summary>
    private async Task SeedDefaultGrantsAsync(
        Dictionary<string, AppMenu> menusByKey,
        HashSet<string> newMenuKeys,
        CancellationToken cancellationToken)
    {
        var rolesWithGrants = await db.RolePermissions
            .Select(x => x.Role)
            .Distinct()
            .ToListAsync(cancellationToken);
        var alreadySeeded = rolesWithGrants.ToHashSet(StringComparer.OrdinalIgnoreCase);

        // Mirrors the access these roles had before the matrix existed, so switching the app over
        // is a no-op on day one.
        string[] wingAdminFull =
        [
            MenuKeys.AdminStudentsSection, MenuKeys.AdminStudents,
            MenuKeys.AdminMealsSection, MenuKeys.AdminMeals, MenuKeys.AdminMealSheet,
            MenuKeys.AdminInventorySection, MenuKeys.AdminInventory,
            MenuKeys.AdminFinanceSection, MenuKeys.AdminBilling, MenuKeys.AdminDue,
            MenuKeys.AdminPayments, MenuKeys.AdminDailyCost,
            MenuKeys.AdminCommsSection, MenuKeys.AdminNoticeBoard,
        ];

        // Tea (and anything else added to this catalogue) is a female-wing feature today. The
        // male wing admin gets no default access to either the item catalogue or Others Bill —
        // a super admin switches them on later from Role Permissions, once there is a male-wing
        // item to manage. Kept separate from wingAdminFull so this one exception doesn't ride
        // along with every other "full access" grant male_wing_admin already has.
        string[] femaleWingAdditionalMeals =
        [
            MenuKeys.AdminAdditionalItems, MenuKeys.AdminOthersBill,
        ];

        string[] studentViewOnly =
        [
            MenuKeys.StudentMealsSection, MenuKeys.StudentMeals, MenuKeys.StudentMealSnapshot,
            MenuKeys.StudentViewMenu, MenuKeys.StudentFinanceSection, MenuKeys.StudentBilling,
            MenuKeys.StudentPayments, MenuKeys.StudentDailyCost,
            MenuKeys.StudentCommsSection, MenuKeys.StudentNoticeBoard,
        ];

        // Collected per role before any insert: the unique (Role, MenuId) index means a key
        // mentioned twice has to merge into one row rather than produce a second.
        void Grant(
            Dictionary<string, (bool View, bool Create, bool Edit, bool Delete)> into,
            IEnumerable<string> keys,
            bool view, bool create, bool edit, bool delete)
        {
            foreach (var key in keys)
            {
                var prior = into.GetValueOrDefault(key);
                into[key] = (prior.View || view, prior.Create || create, prior.Edit || edit, prior.Delete || delete);
            }
        }

        void Commit(string role, Dictionary<string, (bool View, bool Create, bool Edit, bool Delete)> grants)
        {
            foreach (var (key, grant) in grants)
            {
                if (!menusByKey.TryGetValue(key, out var menu)) continue;
                db.RolePermissions.Add(new RolePermission
                {
                    Role = role,
                    MenuId = menu.Id,
                    CanView = grant.View,
                    CanCreate = grant.Create,
                    CanEdit = grant.Edit,
                    CanDelete = grant.Delete,
                });
            }
        }

        // For an already-seeded role, narrow the defaults to menus introduced on this run.
        IEnumerable<string> Applicable(string role, IEnumerable<string> keys)
            => alreadySeeded.Contains(role) ? keys.Where(newMenuKeys.Contains) : keys;

        foreach (var role in new[] { Roles.MaleWingAdmin, Roles.FemaleWingAdmin, Roles.Admin })
        {
            var grants = new Dictionary<string, (bool, bool, bool, bool)>(StringComparer.OrdinalIgnoreCase);
            Grant(grants, Applicable(role, wingAdminFull), true, true, true, true);
            Commit(role, grants);
        }

        foreach (var role in new[] { Roles.FemaleWingAdmin, Roles.Admin })
        {
            var grants = new Dictionary<string, (bool, bool, bool, bool)>(StringComparer.OrdinalIgnoreCase);
            Grant(grants, Applicable(role, femaleWingAdditionalMeals), true, true, true, true);
            Commit(role, grants);
        }

        // Students read everything on their portal, and manage only their own meals, payments and
        // additional preferences. Delete is granted on additional preferences because unmarking a
        // slot removes the row outright.
        var studentGrants = new Dictionary<string, (bool, bool, bool, bool)>(StringComparer.OrdinalIgnoreCase);
        Grant(studentGrants, Applicable(Roles.Student, studentViewOnly), true, false, false, false);
        Grant(
            studentGrants,
            Applicable(Roles.Student, [MenuKeys.StudentMeals, MenuKeys.StudentPayments]),
            true, true, true, false);
        Grant(
            studentGrants,
            Applicable(Roles.Student, [MenuKeys.StudentAdditionalPreferences]),
            true, true, true, true);
        Commit(Roles.Student, studentGrants);

        await db.SaveChangesAsync(cancellationToken);
    }
}
