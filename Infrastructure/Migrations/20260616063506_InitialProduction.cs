using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Migrations
{
    /// <inheritdoc />
    public partial class InitialProduction : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "audit_logs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Actor = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Action = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    Module = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_audit_logs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "meal_days",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Label = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_meal_days", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "meal_settings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CutoffTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    ForecastMaxOptions = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_meal_settings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "meal_types",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Label = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    StartsAt = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    EndsAt = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_meal_types", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "payment_categories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payment_categories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "students",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentName = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    StudentId = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    RollNumber = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Gender = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Department = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    HallId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    MobileNumber = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Level = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    HallName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    RoomNo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    LoginAccessEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    ReactivationEligible = table.Column<bool>(type: "boolean", nullable: false),
                    PermanentDeleteEligible = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_students", x => x.Id);
                    table.CheckConstraint("ck_students_gender", "\"Gender\" IN ('Male','Female')");
                });

            migrationBuilder.CreateTable(
                name: "meal_configurations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MealDayId = table.Column<Guid>(type: "uuid", nullable: false),
                    MealTypeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Wing = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Male"),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_meal_configurations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_meal_configurations_meal_days_MealDayId",
                        column: x => x.MealDayId,
                        principalTable: "meal_days",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_meal_configurations_meal_types_MealTypeId",
                        column: x => x.MealTypeId,
                        principalTable: "meal_types",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "guest_meal_requests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    MealPeriod = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    GuestCount = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_guest_meal_requests", x => x.Id);
                    table.CheckConstraint("ck_guest_meal_count", "\"GuestCount\" BETWEEN 1 AND 20");
                    table.CheckConstraint("ck_guest_meal_period", "\"MealPeriod\" IN ('breakfast','lunch','dinner')");
                    table.ForeignKey(
                        name: "FK_guest_meal_requests_students_StudentId",
                        column: x => x.StudentId,
                        principalTable: "students",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "meal_status_history",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    MealPeriod = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    IsOn = table.Column<bool>(type: "boolean", nullable: false),
                    EffectiveFrom = table.Column<DateOnly>(type: "date", nullable: false),
                    EffectiveTo = table.Column<DateOnly>(type: "date", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_meal_status_history", x => x.Id);
                    table.CheckConstraint("ck_meal_status_dates", "\"EffectiveTo\" IS NULL OR \"EffectiveTo\" >= \"EffectiveFrom\"");
                    table.CheckConstraint("ck_meal_status_period", "\"MealPeriod\" IN ('breakfast','lunch','dinner')");
                    table.ForeignKey(
                        name: "FK_meal_status_history_students_StudentId",
                        column: x => x.StudentId,
                        principalTable: "students",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "monthly_bill_cache",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    Month = table.Column<int>(type: "integer", nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    MonthlyBill = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    DswSubsidy = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    GuestMealBill = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    ServiceBill = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    CarriedDue = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    TotalApprovedPaid = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    DueBill = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    TotalBill = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    IsFinal = table.Column<bool>(type: "boolean", nullable: false),
                    LastCalculatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_monthly_bill_cache", x => x.Id);
                    table.CheckConstraint("ck_monthly_bill_cache_month", "\"Month\" BETWEEN 1 AND 12");
                    table.ForeignKey(
                        name: "FK_monthly_bill_cache_students_StudentId",
                        column: x => x.StudentId,
                        principalTable: "students",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "notifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: true),
                    Title = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    IsRead = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_notifications_students_StudentId",
                        column: x => x.StudentId,
                        principalTable: "students",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FullName = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    UserName = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    NormalizedUserName = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Email = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    NormalizedEmail = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: false),
                    Role = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Designation = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Wing = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    MustChangePassword = table.Column<bool>(type: "boolean", nullable: false),
                    LastLoginAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.Id);
                    table.ForeignKey(
                        name: "FK_users_students_StudentId",
                        column: x => x.StudentId,
                        principalTable: "students",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "billing_period_unlock_audits",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Month = table.Column<int>(type: "integer", nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    UnlockedById = table.Column<Guid>(type: "uuid", nullable: false),
                    UnlockedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_billing_period_unlock_audits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_billing_period_unlock_audits_users_UnlockedById",
                        column: x => x.UnlockedById,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "billing_periods",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Month = table.Column<int>(type: "integer", nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    IsLocked = table.Column<bool>(type: "boolean", nullable: false),
                    LockedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LockedById = table.Column<Guid>(type: "uuid", nullable: true),
                    UnlockNote = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_billing_periods", x => x.Id);
                    table.CheckConstraint("ck_billing_periods_month", "\"Month\" BETWEEN 1 AND 12");
                    table.ForeignKey(
                        name: "FK_billing_periods_users_LockedById",
                        column: x => x.LockedById,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "dsw_subsidies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Wing = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Male"),
                    SubsidyAmount = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    MealPeriod = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    EligibleStudentCount = table.Column<int>(type: "integer", nullable: false),
                    PerStudentSubsidy = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: false),
                    IsReversed = table.Column<bool>(type: "boolean", nullable: false),
                    ReversedById = table.Column<Guid>(type: "uuid", nullable: true),
                    ReversedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReversalNote = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_dsw_subsidies", x => x.Id);
                    table.CheckConstraint("ck_dsw_subsidies_amount", "\"SubsidyAmount\" > 0 AND \"PerStudentSubsidy\" >= 0");
                    table.CheckConstraint("ck_dsw_subsidies_eligible_count", "\"EligibleStudentCount\" > 0");
                    table.CheckConstraint("ck_dsw_subsidies_meal_period", "\"MealPeriod\" IN ('breakfast','lunch','dinner')");
                    table.CheckConstraint("ck_dsw_subsidies_wing", "\"Wing\" IN ('Male','Female')");
                    table.ForeignKey(
                        name: "FK_dsw_subsidies_users_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_dsw_subsidies_users_ReversedById",
                        column: x => x.ReversedById,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "due_adjustments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    BillingMonth = table.Column<int>(type: "integer", nullable: false),
                    BillingYear = table.Column<int>(type: "integer", nullable: false),
                    AdjustedAmount = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    PreviousAmount = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    Note = table.Column<string>(type: "text", nullable: true),
                    AdjustedById = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_due_adjustments", x => x.Id);
                    table.CheckConstraint("ck_due_adjustments_amount", "\"AdjustedAmount\" >= 0 AND \"PreviousAmount\" >= 0");
                    table.CheckConstraint("ck_due_adjustments_month", "\"BillingMonth\" BETWEEN 1 AND 12");
                    table.ForeignKey(
                        name: "FK_due_adjustments_students_StudentId",
                        column: x => x.StudentId,
                        principalTable: "students",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_due_adjustments_users_AdjustedById",
                        column: x => x.AdjustedById,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "global_meal_overrides",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Wing = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Male"),
                    MealPeriod = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    EffectiveFrom = table.Column<DateOnly>(type: "date", nullable: false),
                    EffectiveTo = table.Column<DateOnly>(type: "date", nullable: false),
                    IsOn = table.Column<bool>(type: "boolean", nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_global_meal_overrides", x => x.Id);
                    table.CheckConstraint("ck_global_override_dates", "\"EffectiveTo\" >= \"EffectiveFrom\"");
                    table.CheckConstraint("ck_global_override_period", "\"MealPeriod\" IN ('breakfast','lunch','dinner')");
                    table.ForeignKey(
                        name: "FK_global_meal_overrides_users_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "inventory_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Item = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Wing = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Male"),
                    Category = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Unit = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    LinkedOptionId = table.Column<Guid>(type: "uuid", nullable: true),
                    CurrentStockQuantity = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    CurrentWac = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    IsStored = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: false),
                    Stock = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    Threshold = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    AveragePrice = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    TotalStockValue = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    LastMovementDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inventory_items", x => x.Id);
                    table.CheckConstraint("ck_inventory_items_category", "\"Category\" IN ('Common','Options','Others')");
                    table.CheckConstraint("ck_inventory_items_link", "(\"Category\" = 'Others' AND \"LinkedOptionId\" IS NOT NULL) OR (\"Category\" <> 'Others' AND \"LinkedOptionId\" IS NULL)");
                    table.CheckConstraint("ck_inventory_items_stock", "\"CurrentStockQuantity\" >= 0 AND \"CurrentWac\" >= 0");
                    table.CheckConstraint("ck_inventory_items_wing", "\"Wing\" IN ('Male','Female')");
                    table.ForeignKey(
                        name: "FK_inventory_items_inventory_items_LinkedOptionId",
                        column: x => x.LinkedOptionId,
                        principalTable: "inventory_items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_inventory_items_users_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "notices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Content = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    TargetWing = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notices", x => x.Id);
                    table.CheckConstraint("ck_notices_wing", "\"TargetWing\" IN ('All','Male','Female')");
                    table.ForeignKey(
                        name: "FK_notices_users_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "payment_submissions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    CategoryId = table.Column<Guid>(type: "uuid", nullable: false),
                    BillingMonth = table.Column<int>(type: "integer", nullable: false),
                    BillingYear = table.Column<int>(type: "integer", nullable: false),
                    SubmittedAmount = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    SubmittedCharge = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    ApprovedAmount = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: true),
                    TransactionId = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    SubmittedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReviewedById = table.Column<Guid>(type: "uuid", nullable: true),
                    ReviewedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payment_submissions", x => x.Id);
                    table.CheckConstraint("ck_payment_submissions_amount", "\"SubmittedAmount\" > 0 AND \"SubmittedCharge\" >= 0 AND (\"ApprovedAmount\" IS NULL OR \"ApprovedAmount\" >= 0)");
                    table.CheckConstraint("ck_payment_submissions_month", "\"BillingMonth\" BETWEEN 1 AND 12");
                    table.CheckConstraint("ck_payment_submissions_status", "\"Status\" IN ('under_review','approved','rejected')");
                    table.ForeignKey(
                        name: "FK_payment_submissions_payment_categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "payment_categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_payment_submissions_students_StudentId",
                        column: x => x.StudentId,
                        principalTable: "students",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_payment_submissions_users_ReviewedById",
                        column: x => x.ReviewedById,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "service_bills",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Month = table.Column<int>(type: "integer", nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    AmountPerStudent = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    IsLocked = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    AddedById = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_service_bills", x => x.Id);
                    table.CheckConstraint("ck_service_bills_amount", "\"AmountPerStudent\" >= 0");
                    table.CheckConstraint("ck_service_bills_month", "\"Month\" BETWEEN 1 AND 12");
                    table.ForeignKey(
                        name: "FK_service_bills_users_AddedById",
                        column: x => x.AddedById,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "dsw_subsidy_distributions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SubsidyId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    MealPeriod = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SubsidyAmount = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_dsw_subsidy_distributions", x => x.Id);
                    table.CheckConstraint("ck_dsw_subsidy_distributions_amount", "\"SubsidyAmount\" >= 0");
                    table.CheckConstraint("ck_dsw_subsidy_distributions_meal_period", "\"MealPeriod\" IN ('breakfast','lunch','dinner')");
                    table.ForeignKey(
                        name: "FK_dsw_subsidy_distributions_dsw_subsidies_SubsidyId",
                        column: x => x.SubsidyId,
                        principalTable: "dsw_subsidies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_dsw_subsidy_distributions_students_StudentId",
                        column: x => x.StudentId,
                        principalTable: "students",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "meal_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MealConfigurationId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Cost = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    IsOptional = table.Column<bool>(type: "boolean", nullable: false),
                    InventoryItemId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_meal_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_meal_items_inventory_items_InventoryItemId",
                        column: x => x.InventoryItemId,
                        principalTable: "inventory_items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_meal_items_meal_configurations_MealConfigurationId",
                        column: x => x.MealConfigurationId,
                        principalTable: "meal_configurations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "meal_preference_history",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    MealPeriod = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    OptionItemId = table.Column<Guid>(type: "uuid", nullable: true),
                    EffectiveFrom = table.Column<DateOnly>(type: "date", nullable: false),
                    EffectiveTo = table.Column<DateOnly>(type: "date", nullable: true),
                    DayOfWeek = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_meal_preference_history", x => x.Id);
                    table.CheckConstraint("ck_meal_preference_dates", "\"EffectiveTo\" IS NULL OR \"EffectiveTo\" >= \"EffectiveFrom\"");
                    table.CheckConstraint("ck_meal_preference_period", "\"MealPeriod\" IN ('breakfast','lunch','dinner')");
                    table.ForeignKey(
                        name: "FK_meal_preference_history_inventory_items_OptionItemId",
                        column: x => x.OptionItemId,
                        principalTable: "inventory_items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_meal_preference_history_students_StudentId",
                        column: x => x.StudentId,
                        principalTable: "students",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "stock_transactions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    TransactionType = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    MealPeriod = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Quantity = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    Rate = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    WacSnapshot = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    TotalCost = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    ParticipantCount = table.Column<int>(type: "integer", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stock_transactions", x => x.Id);
                    table.CheckConstraint("ck_stock_transactions_meal", "(\"TransactionType\" = 'in' AND \"MealPeriod\" IS NULL) OR (\"TransactionType\" = 'out' AND \"MealPeriod\" IN ('breakfast','lunch','dinner'))");
                    table.CheckConstraint("ck_stock_transactions_quantity", "\"Quantity\" > 0");
                    table.CheckConstraint("ck_stock_transactions_type", "\"TransactionType\" IN ('in','out')");
                    table.ForeignKey(
                        name: "FK_stock_transactions_inventory_items_ItemId",
                        column: x => x.ItemId,
                        principalTable: "inventory_items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_stock_transactions_users_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_stock_transactions_users_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_billing_period_unlock_audits_Month_Year",
                table: "billing_period_unlock_audits",
                columns: new[] { "Month", "Year" });

            migrationBuilder.CreateIndex(
                name: "IX_billing_period_unlock_audits_UnlockedById",
                table: "billing_period_unlock_audits",
                column: "UnlockedById");

            migrationBuilder.CreateIndex(
                name: "IX_billing_periods_LockedById",
                table: "billing_periods",
                column: "LockedById");

            migrationBuilder.CreateIndex(
                name: "IX_billing_periods_Month_Year",
                table: "billing_periods",
                columns: new[] { "Month", "Year" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_dsw_subsidies_CreatedById",
                table: "dsw_subsidies",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_dsw_subsidies_Date_Wing",
                table: "dsw_subsidies",
                columns: new[] { "Date", "Wing" });

            migrationBuilder.CreateIndex(
                name: "IX_dsw_subsidies_ReversedById",
                table: "dsw_subsidies",
                column: "ReversedById");

            migrationBuilder.CreateIndex(
                name: "IX_dsw_subsidies_Wing_Date_MealPeriod",
                table: "dsw_subsidies",
                columns: new[] { "Wing", "Date", "MealPeriod" },
                unique: true,
                filter: "\"IsReversed\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_dsw_subsidy_distributions_StudentId_Date",
                table: "dsw_subsidy_distributions",
                columns: new[] { "StudentId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_dsw_subsidy_distributions_SubsidyId_StudentId",
                table: "dsw_subsidy_distributions",
                columns: new[] { "SubsidyId", "StudentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_due_adjustments_AdjustedById",
                table: "due_adjustments",
                column: "AdjustedById");

            migrationBuilder.CreateIndex(
                name: "IX_due_adjustments_StudentId_BillingMonth_BillingYear",
                table: "due_adjustments",
                columns: new[] { "StudentId", "BillingMonth", "BillingYear" });

            migrationBuilder.CreateIndex(
                name: "IX_global_meal_overrides_CreatedById",
                table: "global_meal_overrides",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_global_meal_overrides_Wing_MealPeriod_EffectiveFrom_Effecti~",
                table: "global_meal_overrides",
                columns: new[] { "Wing", "MealPeriod", "EffectiveFrom", "EffectiveTo" });

            migrationBuilder.CreateIndex(
                name: "IX_guest_meal_requests_StudentId_Date",
                table: "guest_meal_requests",
                columns: new[] { "StudentId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_guest_meal_requests_StudentId_MealPeriod_Date",
                table: "guest_meal_requests",
                columns: new[] { "StudentId", "MealPeriod", "Date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_inventory_items_Category",
                table: "inventory_items",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_items_CreatedById",
                table: "inventory_items",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_items_IsDeleted",
                table: "inventory_items",
                column: "IsDeleted");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_items_LinkedOptionId",
                table: "inventory_items",
                column: "LinkedOptionId");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_items_Wing",
                table: "inventory_items",
                column: "Wing");

            migrationBuilder.CreateIndex(
                name: "IX_meal_configurations_MealDayId_MealTypeId_Wing",
                table: "meal_configurations",
                columns: new[] { "MealDayId", "MealTypeId", "Wing" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_meal_configurations_MealTypeId",
                table: "meal_configurations",
                column: "MealTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_meal_days_Code",
                table: "meal_days",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_meal_items_InventoryItemId",
                table: "meal_items",
                column: "InventoryItemId");

            migrationBuilder.CreateIndex(
                name: "IX_meal_items_MealConfigurationId",
                table: "meal_items",
                column: "MealConfigurationId");

            migrationBuilder.CreateIndex(
                name: "IX_meal_preference_history_OptionItemId",
                table: "meal_preference_history",
                column: "OptionItemId");

            migrationBuilder.CreateIndex(
                name: "IX_meal_preference_history_StudentId_MealPeriod_DayOfWeek",
                table: "meal_preference_history",
                columns: new[] { "StudentId", "MealPeriod", "DayOfWeek" },
                unique: true,
                filter: "\"EffectiveTo\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_meal_preference_history_StudentId_MealPeriod_DayOfWeek_Eff~1",
                table: "meal_preference_history",
                columns: new[] { "StudentId", "MealPeriod", "DayOfWeek", "EffectiveTo" });

            migrationBuilder.CreateIndex(
                name: "IX_meal_preference_history_StudentId_MealPeriod_DayOfWeek_Effe~",
                table: "meal_preference_history",
                columns: new[] { "StudentId", "MealPeriod", "DayOfWeek", "EffectiveFrom" });

            migrationBuilder.CreateIndex(
                name: "IX_meal_status_history_StudentId_MealPeriod",
                table: "meal_status_history",
                columns: new[] { "StudentId", "MealPeriod" },
                unique: true,
                filter: "\"EffectiveTo\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_meal_status_history_StudentId_MealPeriod_EffectiveFrom",
                table: "meal_status_history",
                columns: new[] { "StudentId", "MealPeriod", "EffectiveFrom" });

            migrationBuilder.CreateIndex(
                name: "IX_meal_status_history_StudentId_MealPeriod_EffectiveTo",
                table: "meal_status_history",
                columns: new[] { "StudentId", "MealPeriod", "EffectiveTo" });

            migrationBuilder.CreateIndex(
                name: "IX_meal_types_Code",
                table: "meal_types",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_monthly_bill_cache_StudentId_Month_Year",
                table: "monthly_bill_cache",
                columns: new[] { "StudentId", "Month", "Year" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_notices_CreatedById",
                table: "notices",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_notifications_StudentId",
                table: "notifications",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_payment_categories_Name",
                table: "payment_categories",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_payment_submissions_CategoryId_TransactionId",
                table: "payment_submissions",
                columns: new[] { "CategoryId", "TransactionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_payment_submissions_ReviewedById",
                table: "payment_submissions",
                column: "ReviewedById");

            migrationBuilder.CreateIndex(
                name: "IX_payment_submissions_StudentId_BillingMonth_BillingYear_Stat~",
                table: "payment_submissions",
                columns: new[] { "StudentId", "BillingMonth", "BillingYear", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_service_bills_AddedById",
                table: "service_bills",
                column: "AddedById");

            migrationBuilder.CreateIndex(
                name: "IX_service_bills_Month_Year_Version",
                table: "service_bills",
                columns: new[] { "Month", "Year", "Version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_stock_transactions_CreatedById",
                table: "stock_transactions",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_stock_transactions_Date",
                table: "stock_transactions",
                column: "Date");

            migrationBuilder.CreateIndex(
                name: "IX_stock_transactions_ItemId_Date",
                table: "stock_transactions",
                columns: new[] { "ItemId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_stock_transactions_UpdatedById",
                table: "stock_transactions",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_students_Gender",
                table: "students",
                column: "Gender");

            migrationBuilder.CreateIndex(
                name: "IX_students_RollNumber",
                table: "students",
                column: "RollNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_students_StudentId",
                table: "students",
                column: "StudentId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_NormalizedEmail",
                table: "users",
                column: "NormalizedEmail");

            migrationBuilder.CreateIndex(
                name: "IX_users_NormalizedUserName",
                table: "users",
                column: "NormalizedUserName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_StudentId",
                table: "users",
                column: "StudentId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "audit_logs");

            migrationBuilder.DropTable(
                name: "billing_period_unlock_audits");

            migrationBuilder.DropTable(
                name: "billing_periods");

            migrationBuilder.DropTable(
                name: "dsw_subsidy_distributions");

            migrationBuilder.DropTable(
                name: "due_adjustments");

            migrationBuilder.DropTable(
                name: "global_meal_overrides");

            migrationBuilder.DropTable(
                name: "guest_meal_requests");

            migrationBuilder.DropTable(
                name: "meal_items");

            migrationBuilder.DropTable(
                name: "meal_preference_history");

            migrationBuilder.DropTable(
                name: "meal_settings");

            migrationBuilder.DropTable(
                name: "meal_status_history");

            migrationBuilder.DropTable(
                name: "monthly_bill_cache");

            migrationBuilder.DropTable(
                name: "notices");

            migrationBuilder.DropTable(
                name: "notifications");

            migrationBuilder.DropTable(
                name: "payment_submissions");

            migrationBuilder.DropTable(
                name: "service_bills");

            migrationBuilder.DropTable(
                name: "stock_transactions");

            migrationBuilder.DropTable(
                name: "dsw_subsidies");

            migrationBuilder.DropTable(
                name: "meal_configurations");

            migrationBuilder.DropTable(
                name: "payment_categories");

            migrationBuilder.DropTable(
                name: "inventory_items");

            migrationBuilder.DropTable(
                name: "meal_days");

            migrationBuilder.DropTable(
                name: "meal_types");

            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.DropTable(
                name: "students");
        }
    }
}
