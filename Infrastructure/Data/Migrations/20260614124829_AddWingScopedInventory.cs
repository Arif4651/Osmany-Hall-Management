using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddWingScopedInventory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Wing",
                table: "inventory_items",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Male");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_items_Wing",
                table: "inventory_items",
                column: "Wing");

            migrationBuilder.AddCheckConstraint(
                name: "ck_inventory_items_wing",
                table: "inventory_items",
                sql: "\"Wing\" IN ('Male','Female')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_inventory_items_Wing",
                table: "inventory_items");

            migrationBuilder.DropCheckConstraint(
                name: "ck_inventory_items_wing",
                table: "inventory_items");

            migrationBuilder.DropColumn(
                name: "Wing",
                table: "inventory_items");
        }
    }
}
