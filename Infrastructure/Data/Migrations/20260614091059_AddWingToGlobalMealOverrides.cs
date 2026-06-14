using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddWingToGlobalMealOverrides : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_global_meal_overrides_MealPeriod_EffectiveFrom_EffectiveTo",
                table: "global_meal_overrides");

            migrationBuilder.AddColumn<string>(
                name: "Wing",
                table: "global_meal_overrides",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Male");

            migrationBuilder.CreateIndex(
                name: "IX_global_meal_overrides_Wing_MealPeriod_EffectiveFrom_Effecti~",
                table: "global_meal_overrides",
                columns: new[] { "Wing", "MealPeriod", "EffectiveFrom", "EffectiveTo" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_global_meal_overrides_Wing_MealPeriod_EffectiveFrom_Effecti~",
                table: "global_meal_overrides");

            migrationBuilder.DropColumn(
                name: "Wing",
                table: "global_meal_overrides");

            migrationBuilder.CreateIndex(
                name: "IX_global_meal_overrides_MealPeriod_EffectiveFrom_EffectiveTo",
                table: "global_meal_overrides",
                columns: new[] { "MealPeriod", "EffectiveFrom", "EffectiveTo" });
        }
    }
}
