using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Migrations
{
    /// <inheritdoc />
    public partial class AddAdditionalMealPreferencesAndOthersBill : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "OthersBill",
                table: "monthly_bill_cache",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "additional_meal_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    EligibleWing = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    DefaultQuantity = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_additional_meal_items", x => x.Id);
                    table.CheckConstraint("ck_additional_meal_items_wing", "\"EligibleWing\" IN ('Male','Female','All')");
                });

            migrationBuilder.CreateTable(
                name: "additional_meal_selections",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    ItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    MealPeriod = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_additional_meal_selections", x => x.Id);
                    table.CheckConstraint("ck_additional_meal_selections_quantity", "\"Quantity\" > 0");
                    table.ForeignKey(
                        name: "FK_additional_meal_selections_additional_meal_items_ItemId",
                        column: x => x.ItemId,
                        principalTable: "additional_meal_items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_additional_meal_selections_students_StudentId",
                        column: x => x.StudentId,
                        principalTable: "students",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "others_bills",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Month = table.Column<int>(type: "integer", nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    ItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    Wing = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    TotalAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    TotalConsumptionCount = table.Column<int>(type: "integer", nullable: false),
                    UnitRate = table.Column<decimal>(type: "numeric", nullable: false),
                    Notes = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    GeneratedById = table.Column<Guid>(type: "uuid", nullable: false),
                    GeneratedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_others_bills", x => x.Id);
                    table.CheckConstraint("ck_others_bills_month", "\"Month\" BETWEEN 1 AND 12");
                    table.ForeignKey(
                        name: "FK_others_bills_additional_meal_items_ItemId",
                        column: x => x.ItemId,
                        principalTable: "additional_meal_items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_others_bills_users_GeneratedById",
                        column: x => x.GeneratedById,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "others_bill_allocations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OthersBillId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    ConsumptionCount = table.Column<int>(type: "integer", nullable: false),
                    AllocatedAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_others_bill_allocations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_others_bill_allocations_others_bills_OthersBillId",
                        column: x => x.OthersBillId,
                        principalTable: "others_bills",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_others_bill_allocations_students_StudentId",
                        column: x => x.StudentId,
                        principalTable: "students",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_additional_meal_items_Code",
                table: "additional_meal_items",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_additional_meal_selections_Date_ItemId",
                table: "additional_meal_selections",
                columns: new[] { "Date", "ItemId" });

            migrationBuilder.CreateIndex(
                name: "IX_additional_meal_selections_ItemId",
                table: "additional_meal_selections",
                column: "ItemId");

            migrationBuilder.CreateIndex(
                name: "IX_additional_meal_selections_StudentId_ItemId_Date_MealPeriod",
                table: "additional_meal_selections",
                columns: new[] { "StudentId", "ItemId", "Date", "MealPeriod" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_others_bill_allocations_OthersBillId_StudentId",
                table: "others_bill_allocations",
                columns: new[] { "OthersBillId", "StudentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_others_bill_allocations_StudentId",
                table: "others_bill_allocations",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_others_bills_GeneratedById",
                table: "others_bills",
                column: "GeneratedById");

            migrationBuilder.CreateIndex(
                name: "IX_others_bills_ItemId",
                table: "others_bills",
                column: "ItemId");

            migrationBuilder.CreateIndex(
                name: "IX_others_bills_Month_Year_ItemId_Wing",
                table: "others_bills",
                columns: new[] { "Month", "Year", "ItemId", "Wing" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_others_bills_Year_Month",
                table: "others_bills",
                columns: new[] { "Year", "Month" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "additional_meal_selections");

            migrationBuilder.DropTable(
                name: "others_bill_allocations");

            migrationBuilder.DropTable(
                name: "others_bills");

            migrationBuilder.DropTable(
                name: "additional_meal_items");

            migrationBuilder.DropColumn(
                name: "OthersBill",
                table: "monthly_bill_cache");
        }
    }
}
