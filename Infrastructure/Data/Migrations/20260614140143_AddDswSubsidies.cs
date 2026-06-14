using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddDswSubsidies : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "DswSubsidy",
                table: "monthly_bill_cache",
                type: "numeric(12,4)",
                precision: 12,
                scale: 4,
                nullable: false,
                defaultValue: 0m);

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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "dsw_subsidy_distributions");

            migrationBuilder.DropTable(
                name: "dsw_subsidies");

            migrationBuilder.DropColumn(
                name: "DswSubsidy",
                table: "monthly_bill_cache");
        }
    }
}
