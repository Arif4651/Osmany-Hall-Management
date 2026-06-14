using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class EnforceSingleActiveMealHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_meal_status_history_StudentId_MealPeriod",
                table: "meal_status_history",
                columns: new[] { "StudentId", "MealPeriod" },
                unique: true,
                filter: "\"EffectiveTo\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_meal_preference_history_StudentId_MealPeriod",
                table: "meal_preference_history",
                columns: new[] { "StudentId", "MealPeriod" },
                unique: true,
                filter: "\"EffectiveTo\" IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_meal_status_history_StudentId_MealPeriod",
                table: "meal_status_history");

            migrationBuilder.DropIndex(
                name: "IX_meal_preference_history_StudentId_MealPeriod",
                table: "meal_preference_history");
        }
    }
}
