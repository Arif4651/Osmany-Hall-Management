using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class EnforceStudentRollAndGender : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_students_RollNumber",
                table: "students");

            migrationBuilder.CreateIndex(
                name: "IX_students_RollNumber",
                table: "students",
                column: "RollNumber",
                unique: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_students_gender",
                table: "students",
                sql: "\"Gender\" IN ('Male','Female')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_students_RollNumber",
                table: "students");

            migrationBuilder.DropCheckConstraint(
                name: "ck_students_gender",
                table: "students");

            migrationBuilder.CreateIndex(
                name: "IX_students_RollNumber",
                table: "students",
                column: "RollNumber");
        }
    }
}
