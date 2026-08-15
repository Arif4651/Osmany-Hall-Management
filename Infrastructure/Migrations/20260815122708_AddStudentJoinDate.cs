using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Migrations
{
    /// <inheritdoc />
    public partial class AddStudentJoinDate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "JoinDate",
                table: "students",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));

            // Every existing student predates this column, so there is no real join date to
            // recover for them — CreatedAtUtc is the closest available signal. Backfilling from
            // it (rather than leaving the 0001-01-01 placeholder, or defaulting to today) is what
            // keeps this migration from silently excluding every current student from all of
            // their already-billed history the moment the new JoinDate check goes live.
            migrationBuilder.Sql("""UPDATE students SET "JoinDate" = "CreatedAtUtc"::date;""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "JoinDate",
                table: "students");
        }
    }
}
