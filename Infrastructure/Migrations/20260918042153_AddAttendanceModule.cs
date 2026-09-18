using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAttendanceModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "attendance_hall_locations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    HallId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    HallName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Latitude = table.Column<double>(type: "double precision", nullable: false),
                    Longitude = table.Column<double>(type: "double precision", nullable: false),
                    RadiusMeters = table.Column<int>(type: "integer", nullable: false),
                    MaxAccuracyMeters = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_attendance_hall_locations", x => x.Id);
                    table.CheckConstraint("ck_attendance_hall_locations_accuracy", "\"MaxAccuracyMeters\" BETWEEN 5 AND 250");
                    table.CheckConstraint("ck_attendance_hall_locations_latitude", "\"Latitude\" BETWEEN -90 AND 90");
                    table.CheckConstraint("ck_attendance_hall_locations_longitude", "\"Longitude\" BETWEEN -180 AND 180");
                    table.CheckConstraint("ck_attendance_hall_locations_radius", "\"RadiusMeters\" BETWEEN 20 AND 500");
                });

            migrationBuilder.CreateTable(
                name: "attendance_sessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    HallId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    HallName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    StartTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    EndTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_attendance_sessions", x => x.Id);
                    table.CheckConstraint("ck_attendance_sessions_time_window", "\"EndTime\" > \"StartTime\"");
                    table.ForeignKey(
                        name: "FK_attendance_sessions_users_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "attendance_records",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    AttendanceDate = table.Column<DateOnly>(type: "date", nullable: false),
                    MarkedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Latitude = table.Column<double>(type: "double precision", nullable: false),
                    Longitude = table.Column<double>(type: "double precision", nullable: false),
                    AccuracyMeters = table.Column<double>(type: "double precision", nullable: false),
                    DistanceFromHallMeters = table.Column<double>(type: "double precision", nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_attendance_records", x => x.Id);
                    table.CheckConstraint("ck_attendance_records_accuracy", "\"AccuracyMeters\" > 0");
                    table.CheckConstraint("ck_attendance_records_distance", "\"DistanceFromHallMeters\" >= 0");
                    table.CheckConstraint("ck_attendance_records_latitude", "\"Latitude\" BETWEEN -90 AND 90");
                    table.CheckConstraint("ck_attendance_records_longitude", "\"Longitude\" BETWEEN -180 AND 180");
                    table.CheckConstraint("ck_attendance_records_status", "\"Status\" IN ('Present')");
                    table.ForeignKey(
                        name: "FK_attendance_records_attendance_sessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "attendance_sessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_attendance_records_students_StudentId",
                        column: x => x.StudentId,
                        principalTable: "students",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_attendance_hall_locations_HallId",
                table: "attendance_hall_locations",
                column: "HallId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_attendance_records_AttendanceDate_SessionId",
                table: "attendance_records",
                columns: new[] { "AttendanceDate", "SessionId" });

            migrationBuilder.CreateIndex(
                name: "IX_attendance_records_SessionId_StudentId_AttendanceDate",
                table: "attendance_records",
                columns: new[] { "SessionId", "StudentId", "AttendanceDate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_attendance_records_StudentId",
                table: "attendance_records",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_sessions_CreatedById",
                table: "attendance_sessions",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_sessions_HallId_IsActive",
                table: "attendance_sessions",
                columns: new[] { "HallId", "IsActive" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "attendance_hall_locations");

            migrationBuilder.DropTable(
                name: "attendance_records");

            migrationBuilder.DropTable(
                name: "attendance_sessions");
        }
    }
}
