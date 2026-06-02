using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "audit_logs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Actor = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Action = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    Module = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_audit_logs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "inventory_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Item = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Category = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Stock = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    Threshold = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inventory_items", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "meal_days",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Label = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_meal_days", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "meal_settings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CutoffTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    ForecastMaxOptions = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_meal_settings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "meal_types",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Label = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    StartsAt = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    EndsAt = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_meal_types", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "students",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentName = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    StudentId = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Department = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    HallSeatId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    MobileNumber = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Level = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                 //   SessionYear = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    HallName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    RoomNo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                 //   Email = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                 //   AdmissionDate = table.Column<DateOnly>(type: "date", nullable: false),
                  // ExpectedGraduationDate = table.Column<DateOnly>(type: "date", nullable: false),
                //    HallValidityEndDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    HasDue = table.Column<bool>(type: "boolean", nullable: false),
                    DueAmount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    LoginAccessEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    ReactivationEligible = table.Column<bool>(type: "boolean", nullable: false),
                    PermanentDeleteEligible = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_students", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "meal_configurations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MealDayId = table.Column<Guid>(type: "uuid", nullable: false),
                    MealTypeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_meal_configurations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_meal_configurations_meal_days_MealDayId",
                        column: x => x.MealDayId,
                        principalTable: "meal_days",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_meal_configurations_meal_types_MealTypeId",
                        column: x => x.MealTypeId,
                        principalTable: "meal_types",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "bills",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    BillNo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Period = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    MealCost = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    Utility = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    Service = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    Total = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    DueDate = table.Column<DateOnly>(type: "date", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bills", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bills_students_StudentId",
                        column: x => x.StudentId,
                        principalTable: "students",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "notifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: true),
                    Title = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    IsRead = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_notifications_students_StudentId",
                        column: x => x.StudentId,
                        principalTable: "students",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "student_meal_preferences",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    MealTypeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    OptionItemId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_student_meal_preferences", x => x.Id);
                    table.ForeignKey(
                        name: "FK_student_meal_preferences_meal_types_MealTypeId",
                        column: x => x.MealTypeId,
                        principalTable: "meal_types",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_student_meal_preferences_students_StudentId",
                        column: x => x.StudentId,
                        principalTable: "students",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FullName = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    UserName = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    NormalizedUserName = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Email = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    NormalizedEmail = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: false),
                    Role = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Designation = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    MustChangePassword = table.Column<bool>(type: "boolean", nullable: false),
                    LastLoginAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.Id);
                    table.ForeignKey(
                        name: "FK_users_students_StudentId",
                        column: x => x.StudentId,
                        principalTable: "students",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "meal_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MealConfigurationId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Cost = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    IsOptional = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_meal_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_meal_items_meal_configurations_MealConfigurationId",
                        column: x => x.MealConfigurationId,
                        principalTable: "meal_configurations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "payments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    BillId = table.Column<Guid>(type: "uuid", nullable: false),
                    PaymentNo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Method = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    SubmittedAt = table.Column<DateOnly>(type: "date", nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Reference = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_payments_bills_BillId",
                        column: x => x.BillId,
                        principalTable: "bills",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_payments_students_StudentId",
                        column: x => x.StudentId,
                        principalTable: "students",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bills_BillNo",
                table: "bills",
                column: "BillNo",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bills_StudentId",
                table: "bills",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_meal_configurations_MealDayId_MealTypeId",
                table: "meal_configurations",
                columns: new[] { "MealDayId", "MealTypeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_meal_configurations_MealTypeId",
                table: "meal_configurations",
                column: "MealTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_meal_days_Code",
                table: "meal_days",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_meal_items_MealConfigurationId",
                table: "meal_items",
                column: "MealConfigurationId");

            migrationBuilder.CreateIndex(
                name: "IX_meal_types_Code",
                table: "meal_types",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_notifications_StudentId",
                table: "notifications",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_payments_BillId",
                table: "payments",
                column: "BillId");

            migrationBuilder.CreateIndex(
                name: "IX_payments_PaymentNo",
                table: "payments",
                column: "PaymentNo",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_payments_StudentId",
                table: "payments",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_student_meal_preferences_MealTypeId",
                table: "student_meal_preferences",
                column: "MealTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_student_meal_preferences_StudentId_MealTypeId",
                table: "student_meal_preferences",
                columns: new[] { "StudentId", "MealTypeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_students_Email",
                table: "students",
                column: "Email");

            migrationBuilder.CreateIndex(
                name: "IX_students_StudentCode",
                table: "students",
                column: "StudentCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_NormalizedEmail",
                table: "users",
                column: "NormalizedEmail");

            migrationBuilder.CreateIndex(
                name: "IX_users_NormalizedUserName",
                table: "users",
                column: "NormalizedUserName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_StudentId",
                table: "users",
                column: "StudentId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "audit_logs");

            migrationBuilder.DropTable(
                name: "inventory_items");

            migrationBuilder.DropTable(
                name: "meal_items");

            migrationBuilder.DropTable(
                name: "meal_settings");

            migrationBuilder.DropTable(
                name: "notifications");

            migrationBuilder.DropTable(
                name: "payments");

            migrationBuilder.DropTable(
                name: "student_meal_preferences");

            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.DropTable(
                name: "meal_configurations");

            migrationBuilder.DropTable(
                name: "bills");

            migrationBuilder.DropTable(
                name: "meal_days");

            migrationBuilder.DropTable(
                name: "meal_types");

            migrationBuilder.DropTable(
                name: "students");
        }
    }
}
