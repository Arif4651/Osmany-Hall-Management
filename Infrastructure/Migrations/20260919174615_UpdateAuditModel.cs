using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateAuditModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Action",
                table: "audit_logs",
                type: "character varying(80)",
                maxLength: 80,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(240)",
                oldMaxLength: 240);

            migrationBuilder.AddColumn<string>(
                name: "ActorRole",
                table: "audit_logs",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "ActorUserId",
                table: "audit_logs",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "audit_logs",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "EntityId",
                table: "audit_logs",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EntityType",
                table: "audit_logs",
                type: "character varying(80)",
                maxLength: 80,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "IpAddress",
                table: "audit_logs",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsSuccess",
                table: "audit_logs",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "NewValues",
                table: "audit_logs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OldValues",
                table: "audit_logs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UserAgent",
                table: "audit_logs",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_audit_logs_Action",
                table: "audit_logs",
                column: "Action");

            migrationBuilder.CreateIndex(
                name: "IX_audit_logs_ActorUserId",
                table: "audit_logs",
                column: "ActorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_audit_logs_EntityType",
                table: "audit_logs",
                column: "EntityType");

            migrationBuilder.CreateIndex(
                name: "IX_audit_logs_IsSuccess",
                table: "audit_logs",
                column: "IsSuccess");

            migrationBuilder.CreateIndex(
                name: "IX_audit_logs_Module",
                table: "audit_logs",
                column: "Module");

            migrationBuilder.AddForeignKey(
                name: "FK_audit_logs_users_ActorUserId",
                table: "audit_logs",
                column: "ActorUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_audit_logs_users_ActorUserId",
                table: "audit_logs");

            migrationBuilder.DropIndex(
                name: "IX_audit_logs_Action",
                table: "audit_logs");

            migrationBuilder.DropIndex(
                name: "IX_audit_logs_ActorUserId",
                table: "audit_logs");

            migrationBuilder.DropIndex(
                name: "IX_audit_logs_EntityType",
                table: "audit_logs");

            migrationBuilder.DropIndex(
                name: "IX_audit_logs_IsSuccess",
                table: "audit_logs");

            migrationBuilder.DropIndex(
                name: "IX_audit_logs_Module",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "ActorRole",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "ActorUserId",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "EntityId",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "EntityType",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "IpAddress",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "IsSuccess",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "NewValues",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "OldValues",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "UserAgent",
                table: "audit_logs");

            migrationBuilder.AlterColumn<string>(
                name: "Action",
                table: "audit_logs",
                type: "character varying(240)",
                maxLength: 240,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(80)",
                oldMaxLength: 80);
        }
    }
}
