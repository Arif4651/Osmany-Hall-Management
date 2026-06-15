using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMealPreferenceDayOfWeek : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_meal_preference_history_StudentId_MealPeriod",
                table: "meal_preference_history");

            migrationBuilder.DropIndex(
                name: "IX_meal_preference_history_StudentId_MealPeriod_EffectiveFrom",
                table: "meal_preference_history");

            migrationBuilder.DropIndex(
                name: "IX_meal_preference_history_StudentId_MealPeriod_EffectiveTo",
                table: "meal_preference_history");

            migrationBuilder.AddColumn<int>(
                name: "DayOfWeek",
                table: "meal_preference_history",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql("UPDATE \"meal_preference_history\" SET \"DayOfWeek\" = CAST(EXTRACT(DOW FROM \"EffectiveFrom\") AS integer);");

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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_meal_preference_history_StudentId_MealPeriod_DayOfWeek",
                table: "meal_preference_history");

            migrationBuilder.DropIndex(
                name: "IX_meal_preference_history_StudentId_MealPeriod_DayOfWeek_Eff~1",
                table: "meal_preference_history");

            migrationBuilder.DropIndex(
                name: "IX_meal_preference_history_StudentId_MealPeriod_DayOfWeek_Effe~",
                table: "meal_preference_history");

            migrationBuilder.DropColumn(
                name: "DayOfWeek",
                table: "meal_preference_history");

            migrationBuilder.CreateIndex(
                name: "IX_meal_preference_history_StudentId_MealPeriod",
                table: "meal_preference_history",
                columns: new[] { "StudentId", "MealPeriod" },
                unique: true,
                filter: "\"EffectiveTo\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_meal_preference_history_StudentId_MealPeriod_EffectiveFrom",
                table: "meal_preference_history",
                columns: new[] { "StudentId", "MealPeriod", "EffectiveFrom" });

            migrationBuilder.CreateIndex(
                name: "IX_meal_preference_history_StudentId_MealPeriod_EffectiveTo",
                table: "meal_preference_history",
                columns: new[] { "StudentId", "MealPeriod", "EffectiveTo" });
        }
    }
}
