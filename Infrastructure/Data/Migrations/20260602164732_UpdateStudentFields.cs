using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class UpdateStudentFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_students_Email",
                table: "students");

            migrationBuilder.DropColumn(
                name: "AdmissionDate",
                table: "students");

            migrationBuilder.DropColumn(
                name: "Email",
                table: "students");

            migrationBuilder.DropColumn(
                name: "ExpectedGraduationDate",
                table: "students");

            migrationBuilder.DropColumn(
                name: "HallValidityEndDate",
                table: "students");

            migrationBuilder.DropColumn(
                name: "SessionYear",
                table: "students");

            migrationBuilder.RenameColumn(
                name: "StudentCode",
                table: "students",
                newName: "StudentId");

            migrationBuilder.RenameColumn(
                name: "HallSeatId",
                table: "students",
                newName: "HallId");

            migrationBuilder.RenameIndex(
                name: "IX_students_StudentCode",
                table: "students",
                newName: "IX_students_StudentId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "StudentId",
                table: "students",
                newName: "StudentCode");

            migrationBuilder.RenameColumn(
                name: "HallId",
                table: "students",
                newName: "HallSeatId");

            migrationBuilder.RenameIndex(
                name: "IX_students_StudentId",
                table: "students",
                newName: "IX_students_StudentCode");

            migrationBuilder.AddColumn<DateOnly>(
                name: "AdmissionDate",
                table: "students",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));

            migrationBuilder.AddColumn<string>(
                name: "Email",
                table: "students",
                type: "character varying(180)",
                maxLength: 180,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateOnly>(
                name: "ExpectedGraduationDate",
                table: "students",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));

            migrationBuilder.AddColumn<DateOnly>(
                name: "HallValidityEndDate",
                table: "students",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));

            migrationBuilder.AddColumn<string>(
                name: "SessionYear",
                table: "students",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_students_Email",
                table: "students",
                column: "Email");
        }
    }
}
