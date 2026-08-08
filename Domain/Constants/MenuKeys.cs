namespace HallBackend.Domain.Constants;

/// <summary>
/// Stable identifiers for the permission tree. Endpoints reference these, never menu labels or
/// database ids, so a section can be renamed or reordered in the UI without touching the guards.
/// </summary>
public static class MenuKeys
{
    // ── Admin sections ───────────────────────────────────────────────────────
    public const string AdminStudentsSection = "admin.students.section";
    public const string AdminStudents = "admin.students";

    public const string AdminMealsSection = "admin.meals.section";
    public const string AdminMeals = "admin.meals";
    public const string AdminMealSheet = "admin.meal-sheet";

    /// <summary>Configure the optional-item catalogue (Tea, Milk…) and which wing may take each.</summary>
    public const string AdminAdditionalItems = "admin.additional-items";

    public const string AdminFinanceSection = "admin.finance.section";
    public const string AdminBilling = "admin.billing";
    public const string AdminDue = "admin.due";
    public const string AdminPayments = "admin.payments";
    public const string AdminDailyCost = "admin.daily-cost";

    /// <summary>Enter the pooled monthly amount for an optional item and generate its allocation.</summary>
    public const string AdminOthersBill = "admin.others-bill";

    public const string AdminInventorySection = "admin.inventory.section";
    public const string AdminInventory = "admin.inventory";

    public const string AdminCommsSection = "admin.comms.section";
    public const string AdminNoticeBoard = "admin.notice-board";

    public const string AdminSystemSection = "admin.system.section";
    public const string AdminSettings = "admin.settings";
    public const string AdminRolePermissions = "admin.role-permissions";

    // ── Student sections ─────────────────────────────────────────────────────
    public const string StudentMealsSection = "student.meals.section";
    public const string StudentMeals = "student.meals";
    public const string StudentMealSnapshot = "student.meal-snapshot";
    public const string StudentViewMenu = "student.view-menu";

    /// <summary>Mark per-date, per-meal opt-ins for optional items. Create/Edit/Delete gate marking.</summary>
    public const string StudentAdditionalPreferences = "student.additional-preferences";

    public const string StudentFinanceSection = "student.finance.section";
    public const string StudentBilling = "student.billing";
    public const string StudentPayments = "student.payments";
    public const string StudentDailyCost = "student.daily-cost";

    public const string StudentCommsSection = "student.comms.section";
    public const string StudentNoticeBoard = "student.notice-board";
}

/// <summary>The four grant columns of the matrix.</summary>
public static class PermissionActions
{
    public const string View = "view";
    public const string Create = "create";
    public const string Edit = "edit";
    public const string Delete = "delete";
}
