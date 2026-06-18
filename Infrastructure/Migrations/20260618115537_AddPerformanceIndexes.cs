using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Migrations
{
    /// <inheritdoc />
    public partial class AddPerformanceIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_students_Department",
                table: "students",
                column: "Department");

            migrationBuilder.CreateIndex(
                name: "IX_students_Level",
                table: "students",
                column: "Level");

            migrationBuilder.CreateIndex(
                name: "IX_students_Status",
                table: "students",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_students_Status_Gender",
                table: "students",
                columns: new[] { "Status", "Gender" });

            migrationBuilder.CreateIndex(
                name: "IX_stock_transactions_Date_TransactionType_MealPeriod",
                table: "stock_transactions",
                columns: new[] { "Date", "TransactionType", "MealPeriod" });

            migrationBuilder.CreateIndex(
                name: "IX_notices_TargetWing_CreatedAtUtc",
                table: "notices",
                columns: new[] { "TargetWing", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_monthly_bill_cache_Month_Year_IsFinal",
                table: "monthly_bill_cache",
                columns: new[] { "Month", "Year", "IsFinal" });

            migrationBuilder.CreateIndex(
                name: "IX_billing_periods_Month_Year_IsLocked",
                table: "billing_periods",
                columns: new[] { "Month", "Year", "IsLocked" });

            migrationBuilder.CreateIndex(
                name: "IX_audit_logs_CreatedAtUtc",
                table: "audit_logs",
                column: "CreatedAtUtc");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_students_Department",
                table: "students");

            migrationBuilder.DropIndex(
                name: "IX_students_Level",
                table: "students");

            migrationBuilder.DropIndex(
                name: "IX_students_Status",
                table: "students");

            migrationBuilder.DropIndex(
                name: "IX_students_Status_Gender",
                table: "students");

            migrationBuilder.DropIndex(
                name: "IX_stock_transactions_Date_TransactionType_MealPeriod",
                table: "stock_transactions");

            migrationBuilder.DropIndex(
                name: "IX_notices_TargetWing_CreatedAtUtc",
                table: "notices");

            migrationBuilder.DropIndex(
                name: "IX_monthly_bill_cache_Month_Year_IsFinal",
                table: "monthly_bill_cache");

            migrationBuilder.DropIndex(
                name: "IX_billing_periods_Month_Year_IsLocked",
                table: "billing_periods");

            migrationBuilder.DropIndex(
                name: "IX_audit_logs_CreatedAtUtc",
                table: "audit_logs");
        }
    }
}
