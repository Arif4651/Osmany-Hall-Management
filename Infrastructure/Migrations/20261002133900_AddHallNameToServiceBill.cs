using HallBackend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Migrations
{
    [DbContext(typeof(HallDbContext))]
    [Migration("20261002133900_AddHallNameToServiceBill")]
    /// <inheritdoc />
    public partial class AddHallNameToServiceBill : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_service_bills_Month_Year_Wing_Version",
                table: "service_bills");

            migrationBuilder.AddColumn<string>(
                name: "HallName",
                table: "service_bills",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_service_bills_Month_Year_Wing_HallName_Version",
                table: "service_bills",
                columns: new[] { "Month", "Year", "Wing", "HallName", "Version" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_service_bills_Month_Year_Wing_HallName_Version",
                table: "service_bills");

            migrationBuilder.DropColumn(
                name: "HallName",
                table: "service_bills");

            migrationBuilder.CreateIndex(
                name: "IX_service_bills_Month_Year_Wing_Version",
                table: "service_bills",
                columns: new[] { "Month", "Year", "Wing", "Version" },
                unique: true);
        }
    }
}
