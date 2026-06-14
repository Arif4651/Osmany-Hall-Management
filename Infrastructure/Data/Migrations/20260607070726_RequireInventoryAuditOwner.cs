using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class RequireInventoryAuditOwner : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE inventory_items
                SET "CreatedById" = (
                    SELECT u."Id"
                    FROM users u
                    WHERE u."Role" IN ('admin', 'super_admin')
                    ORDER BY u."CreatedAtUtc"
                    LIMIT 1
                )
                WHERE "CreatedById" IS NULL;
                """);

            migrationBuilder.AlterColumn<Guid>(
                name: "CreatedById",
                table: "inventory_items",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "CreatedById",
                table: "inventory_items",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");
        }
    }
}
