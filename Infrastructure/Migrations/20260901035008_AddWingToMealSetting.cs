using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Migrations
{
    /// <inheritdoc />
    public partial class AddWingToMealSetting : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add the Wing column with a default of 'Male' so the existing single row becomes
            // the Male wing's row without losing its current CutoffTime.
            migrationBuilder.AddColumn<string>(
                name: "Wing",
                table: "meal_settings",
                type: "text",
                nullable: false,
                defaultValue: "Male");

            // Create a Female row by copying whatever CutoffTime the Male row has, so both wings
            // start with the same value rather than leaving Female with no row at all.
            migrationBuilder.Sql("""
                INSERT INTO meal_settings ("Id", "Wing", "CutoffTime", "ForecastMaxOptions", "CreatedAtUtc")
                SELECT gen_random_uuid(), 'Female', "CutoffTime", "ForecastMaxOptions", NOW()
                FROM   meal_settings
                WHERE  "Wing" = 'Male'
                LIMIT  1;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Remove the Female row first, then drop the column (restoring the original shape).
            migrationBuilder.Sql("""DELETE FROM meal_settings WHERE "Wing" = 'Female';""");

            migrationBuilder.DropColumn(
                name: "Wing",
                table: "meal_settings");
        }
    }
}
