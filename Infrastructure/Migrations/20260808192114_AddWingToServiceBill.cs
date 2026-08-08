using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Migrations
{
    /// <inheritdoc />
    public partial class AddWingToServiceBill : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_service_bills_Month_Year_Version",
                table: "service_bills");

            // Service Bill was hall-wide before this migration. Backfill existing rows to Male so
            // they keep applying rather than becoming orphaned by an unmatched wing value — an
            // admin can re-enter the Female-wing amount for any month that needs it going forward.
            migrationBuilder.AddColumn<string>(
                name: "Wing",
                table: "service_bills",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "Male");

            migrationBuilder.CreateIndex(
                name: "IX_service_bills_Month_Year_Wing_Version",
                table: "service_bills",
                columns: new[] { "Month", "Year", "Wing", "Version" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_service_bills_Month_Year_Wing_Version",
                table: "service_bills");

            migrationBuilder.DropColumn(
                name: "Wing",
                table: "service_bills");

            migrationBuilder.CreateIndex(
                name: "IX_service_bills_Month_Year_Version",
                table: "service_bills",
                columns: new[] { "Month", "Year", "Version" },
                unique: true);
        }
    }
}
