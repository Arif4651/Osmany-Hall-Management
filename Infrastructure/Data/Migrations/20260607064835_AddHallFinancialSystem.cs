using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddHallFinancialSystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Gender",
                table: "students",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "RollNumber",
                table: "students",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.Sql("""
                UPDATE students
                SET "RollNumber" = "StudentId",
                    "Gender" = 'Male'
                WHERE "RollNumber" = '' OR "Gender" = '';
                """);

            migrationBuilder.AddColumn<Guid>(
                name: "InventoryItemId",
                table: "meal_items",
                type: "uuid",
                nullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "TotalStockValue",
                table: "inventory_items",
                type: "numeric(12,4)",
                precision: 12,
                scale: 4,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(12,2)",
                oldPrecision: 12,
                oldScale: 2);

            migrationBuilder.AlterColumn<decimal>(
                name: "Threshold",
                table: "inventory_items",
                type: "numeric(12,4)",
                precision: 12,
                scale: 4,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(12,2)",
                oldPrecision: 12,
                oldScale: 2);

            migrationBuilder.AlterColumn<decimal>(
                name: "Stock",
                table: "inventory_items",
                type: "numeric(12,4)",
                precision: 12,
                scale: 4,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(12,2)",
                oldPrecision: 12,
                oldScale: 2);

            migrationBuilder.AlterColumn<decimal>(
                name: "AveragePrice",
                table: "inventory_items",
                type: "numeric(12,4)",
                precision: 12,
                scale: 4,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(12,2)",
                oldPrecision: 12,
                oldScale: 2);

            migrationBuilder.AddColumn<Guid>(
                name: "CreatedById",
                table: "inventory_items",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CurrentStockQuantity",
                table: "inventory_items",
                type: "numeric(12,4)",
                precision: 12,
                scale: 4,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "CurrentWac",
                table: "inventory_items",
                type: "numeric(12,4)",
                precision: 12,
                scale: 4,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAtUtc",
                table: "inventory_items",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "inventory_items",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "LinkedOptionId",
                table: "inventory_items",
                type: "uuid",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE inventory_items
                SET "Category" = CASE
                        WHEN "Category" IN ('Common', 'Options', 'Others') THEN "Category"
                        ELSE 'Common'
                    END,
                    "CurrentStockQuantity" = "Stock",
                    "CurrentWac" = "AveragePrice";
                """);

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
                name: "meal_preference_history",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    MealPeriod = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    OptionItemId = table.Column<Guid>(type: "uuid", nullable: true),
                    EffectiveFrom = table.Column<DateOnly>(type: "date", nullable: false),
                    EffectiveTo = table.Column<DateOnly>(type: "date", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_meal_preference_history", x => x.Id);
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
                name: "payment_categories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ChargePer1000 = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payment_categories", x => x.Id);
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
                    table.CheckConstraint("ck_service_bills_month", "\"Month\" BETWEEN 1 AND 12");
                    table.ForeignKey(
                        name: "FK_service_bills_users_AddedById",
                        column: x => x.AddedById,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
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
                    ActualPaid = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: true),
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
                    table.CheckConstraint("ck_payment_submissions_month", "\"BillingMonth\" BETWEEN 1 AND 12");
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

            migrationBuilder.Sql("""
                INSERT INTO stock_transactions
                    ("Id", "ItemId", "TransactionType", "Date", "MealPeriod", "Quantity",
                     "Rate", "WacSnapshot", "TotalCost", "Note", "CreatedById",
                     "CreatedAtUtc", "UpdatedAtUtc")
                SELECT
                    m."Id",
                    m."InventoryItemId",
                    m."MovementType",
                    m."MovementDate",
                    CASE WHEN m."MovementType" = 'out'
                         THEN COALESCE(NULLIF(m."MealTypeCode", ''), 'dinner')
                         ELSE NULL END,
                    m."Quantity",
                    CASE WHEN m."MovementType" = 'in'
                         THEN CASE WHEN m."Quantity" = 0 THEN 0 ELSE COALESCE(m."PurchaseTotalPrice", 0) / m."Quantity" END
                         ELSE m."AveragePriceAfter" END,
                    m."AveragePriceAfter",
                    CASE WHEN m."MovementType" = 'in'
                         THEN COALESCE(m."PurchaseTotalPrice", 0)
                         ELSE m."Quantity" * m."AveragePriceAfter" END,
                    m."Note",
                    (SELECT u."Id" FROM users u WHERE u."Role" IN ('admin', 'super_admin') ORDER BY u."CreatedAtUtc" LIMIT 1),
                    m."CreatedAtUtc",
                    m."UpdatedAtUtc"
                FROM inventory_movements m
                WHERE EXISTS (
                    SELECT 1 FROM users u WHERE u."Role" IN ('admin', 'super_admin')
                );

                INSERT INTO stock_transactions
                    ("Id", "ItemId", "TransactionType", "Date", "MealPeriod", "Quantity",
                     "Rate", "WacSnapshot", "TotalCost", "Note", "CreatedById",
                     "CreatedAtUtc")
                SELECT
                    gen_random_uuid(),
                    i."Id",
                    'in',
                    CURRENT_DATE,
                    NULL,
                    i."Stock",
                    i."AveragePrice",
                    i."AveragePrice",
                    i."Stock" * i."AveragePrice",
                    'Opening stock migrated from inventory balance',
                    (SELECT u."Id" FROM users u WHERE u."Role" IN ('admin', 'super_admin') ORDER BY u."CreatedAtUtc" LIMIT 1),
                    NOW()
                FROM inventory_items i
                WHERE i."Stock" > 0
                  AND NOT EXISTS (SELECT 1 FROM stock_transactions t WHERE t."ItemId" = i."Id")
                  AND EXISTS (SELECT 1 FROM users u WHERE u."Role" IN ('admin', 'super_admin'));

                INSERT INTO meal_status_history
                    ("Id", "StudentId", "MealPeriod", "IsOn", "EffectiveFrom",
                     "CreatedAtUtc")
                SELECT
                    gen_random_uuid(),
                    p."StudentId",
                    mt."Code",
                    p."Enabled",
                    COALESCE((SELECT MIN(m."MovementDate") FROM inventory_movements m), CURRENT_DATE),
                    NOW()
                FROM student_meal_preferences p
                JOIN meal_types mt ON mt."Id" = p."MealTypeId";

                INSERT INTO meal_preference_history
                    ("Id", "StudentId", "MealPeriod", "OptionItemId", "EffectiveFrom",
                     "CreatedAtUtc")
                SELECT
                    gen_random_uuid(),
                    p."StudentId",
                    mt."Code",
                    NULL,
                    COALESCE((SELECT MIN(m."MovementDate") FROM inventory_movements m), CURRENT_DATE),
                    NOW()
                FROM student_meal_preferences p
                JOIN meal_types mt ON mt."Id" = p."MealTypeId";
                """);

            migrationBuilder.CreateIndex(
                name: "IX_students_Gender",
                table: "students",
                column: "Gender");

            migrationBuilder.CreateIndex(
                name: "IX_students_RollNumber",
                table: "students",
                column: "RollNumber");

            migrationBuilder.CreateIndex(
                name: "IX_meal_items_InventoryItemId",
                table: "meal_items",
                column: "InventoryItemId");

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
                name: "IX_due_adjustments_AdjustedById",
                table: "due_adjustments",
                column: "AdjustedById");

            migrationBuilder.CreateIndex(
                name: "IX_due_adjustments_StudentId_BillingMonth_BillingYear",
                table: "due_adjustments",
                columns: new[] { "StudentId", "BillingMonth", "BillingYear" });

            migrationBuilder.CreateIndex(
                name: "IX_meal_preference_history_OptionItemId",
                table: "meal_preference_history",
                column: "OptionItemId");

            migrationBuilder.CreateIndex(
                name: "IX_meal_preference_history_StudentId_MealPeriod_EffectiveFrom",
                table: "meal_preference_history",
                columns: new[] { "StudentId", "MealPeriod", "EffectiveFrom" });

            migrationBuilder.CreateIndex(
                name: "IX_meal_preference_history_StudentId_MealPeriod_EffectiveTo",
                table: "meal_preference_history",
                columns: new[] { "StudentId", "MealPeriod", "EffectiveTo" });

            migrationBuilder.CreateIndex(
                name: "IX_meal_status_history_StudentId_MealPeriod_EffectiveFrom",
                table: "meal_status_history",
                columns: new[] { "StudentId", "MealPeriod", "EffectiveFrom" });

            migrationBuilder.CreateIndex(
                name: "IX_meal_status_history_StudentId_MealPeriod_EffectiveTo",
                table: "meal_status_history",
                columns: new[] { "StudentId", "MealPeriod", "EffectiveTo" });

            migrationBuilder.CreateIndex(
                name: "IX_monthly_bill_cache_StudentId_Month_Year",
                table: "monthly_bill_cache",
                columns: new[] { "StudentId", "Month", "Year" },
                unique: true);

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

            migrationBuilder.AddForeignKey(
                name: "FK_inventory_items_inventory_items_LinkedOptionId",
                table: "inventory_items",
                column: "LinkedOptionId",
                principalTable: "inventory_items",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_inventory_items_users_CreatedById",
                table: "inventory_items",
                column: "CreatedById",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_meal_items_inventory_items_InventoryItemId",
                table: "meal_items",
                column: "InventoryItemId",
                principalTable: "inventory_items",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_inventory_items_inventory_items_LinkedOptionId",
                table: "inventory_items");

            migrationBuilder.DropForeignKey(
                name: "FK_inventory_items_users_CreatedById",
                table: "inventory_items");

            migrationBuilder.DropForeignKey(
                name: "FK_meal_items_inventory_items_InventoryItemId",
                table: "meal_items");

            migrationBuilder.DropTable(
                name: "billing_period_unlock_audits");

            migrationBuilder.DropTable(
                name: "billing_periods");

            migrationBuilder.DropTable(
                name: "due_adjustments");

            migrationBuilder.DropTable(
                name: "meal_preference_history");

            migrationBuilder.DropTable(
                name: "meal_status_history");

            migrationBuilder.DropTable(
                name: "monthly_bill_cache");

            migrationBuilder.DropTable(
                name: "payment_submissions");

            migrationBuilder.DropTable(
                name: "service_bills");

            migrationBuilder.DropTable(
                name: "stock_transactions");

            migrationBuilder.DropTable(
                name: "payment_categories");

            migrationBuilder.DropIndex(
                name: "IX_students_Gender",
                table: "students");

            migrationBuilder.DropIndex(
                name: "IX_students_RollNumber",
                table: "students");

            migrationBuilder.DropIndex(
                name: "IX_meal_items_InventoryItemId",
                table: "meal_items");

            migrationBuilder.DropIndex(
                name: "IX_inventory_items_Category",
                table: "inventory_items");

            migrationBuilder.DropIndex(
                name: "IX_inventory_items_CreatedById",
                table: "inventory_items");

            migrationBuilder.DropIndex(
                name: "IX_inventory_items_IsDeleted",
                table: "inventory_items");

            migrationBuilder.DropIndex(
                name: "IX_inventory_items_LinkedOptionId",
                table: "inventory_items");

            migrationBuilder.DropColumn(
                name: "Gender",
                table: "students");

            migrationBuilder.DropColumn(
                name: "RollNumber",
                table: "students");

            migrationBuilder.DropColumn(
                name: "InventoryItemId",
                table: "meal_items");

            migrationBuilder.DropColumn(
                name: "CreatedById",
                table: "inventory_items");

            migrationBuilder.DropColumn(
                name: "CurrentStockQuantity",
                table: "inventory_items");

            migrationBuilder.DropColumn(
                name: "CurrentWac",
                table: "inventory_items");

            migrationBuilder.DropColumn(
                name: "DeletedAtUtc",
                table: "inventory_items");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "inventory_items");

            migrationBuilder.DropColumn(
                name: "LinkedOptionId",
                table: "inventory_items");

            migrationBuilder.AlterColumn<decimal>(
                name: "TotalStockValue",
                table: "inventory_items",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(12,4)",
                oldPrecision: 12,
                oldScale: 4);

            migrationBuilder.AlterColumn<decimal>(
                name: "Threshold",
                table: "inventory_items",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(12,4)",
                oldPrecision: 12,
                oldScale: 4);

            migrationBuilder.AlterColumn<decimal>(
                name: "Stock",
                table: "inventory_items",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(12,4)",
                oldPrecision: 12,
                oldScale: 4);

            migrationBuilder.AlterColumn<decimal>(
                name: "AveragePrice",
                table: "inventory_items",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(12,4)",
                oldPrecision: 12,
                oldScale: 4);
        }
    }
}
