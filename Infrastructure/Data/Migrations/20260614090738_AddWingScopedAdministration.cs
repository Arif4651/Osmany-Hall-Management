using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddWingScopedAdministration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_meal_configurations_MealDayId_MealTypeId",
                table: "meal_configurations");

            migrationBuilder.AddColumn<string>(
                name: "Wing",
                table: "users",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Wing",
                table: "meal_configurations",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Male");

            migrationBuilder.CreateIndex(
                name: "IX_meal_configurations_MealDayId_MealTypeId_Wing",
                table: "meal_configurations",
                columns: new[] { "MealDayId", "MealTypeId", "Wing" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_meal_configurations_MealDayId_MealTypeId_Wing",
                table: "meal_configurations");

            migrationBuilder.DropColumn(
                name: "Wing",
                table: "users");

            migrationBuilder.DropColumn(
                name: "Wing",
                table: "meal_configurations");

            migrationBuilder.CreateIndex(
                name: "IX_meal_configurations_MealDayId_MealTypeId",
                table: "meal_configurations",
                columns: new[] { "MealDayId", "MealTypeId" },
                unique: true);
        }
    }
}
