using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddGlobalOverrideAndGuestMeals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "GuestMealBill",
                table: "monthly_bill_cache",
                type: "numeric(12,4)",
                precision: 12,
                scale: 4,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "global_meal_overrides",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
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

            migrationBuilder.CreateIndex(
                name: "IX_global_meal_overrides_CreatedById",
                table: "global_meal_overrides",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_global_meal_overrides_MealPeriod_EffectiveFrom_EffectiveTo",
                table: "global_meal_overrides",
                columns: new[] { "MealPeriod", "EffectiveFrom", "EffectiveTo" });

            migrationBuilder.CreateIndex(
                name: "IX_guest_meal_requests_StudentId_Date",
                table: "guest_meal_requests",
                columns: new[] { "StudentId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_guest_meal_requests_StudentId_MealPeriod_Date",
                table: "guest_meal_requests",
                columns: new[] { "StudentId", "MealPeriod", "Date" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "global_meal_overrides");

            migrationBuilder.DropTable(
                name: "guest_meal_requests");

            migrationBuilder.DropColumn(
                name: "GuestMealBill",
                table: "monthly_bill_cache");
        }
    }
}
