using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class SimplifyPaymentCharges : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_payment_submissions_amount",
                table: "payment_submissions");

            migrationBuilder.DropCheckConstraint(
                name: "ck_payment_categories_charge",
                table: "payment_categories");

            migrationBuilder.DropColumn(
                name: "ChargePer1000",
                table: "payment_categories");

            migrationBuilder.RenameColumn(
                name: "ActualPaid",
                table: "payment_submissions",
                newName: "ApprovedAmount");

            migrationBuilder.AddColumn<decimal>(
                name: "SubmittedCharge",
                table: "payment_submissions",
                type: "numeric(12,4)",
                precision: 12,
                scale: 4,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.Sql(
                """UPDATE payment_submissions SET "ApprovedAmount" = "SubmittedAmount" WHERE "Status" = 'approved';""");

            migrationBuilder.AddCheckConstraint(
                name: "ck_payment_submissions_amount",
                table: "payment_submissions",
                sql: "\"SubmittedAmount\" > 0 AND \"SubmittedCharge\" >= 0 AND (\"ApprovedAmount\" IS NULL OR \"ApprovedAmount\" >= 0)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_payment_submissions_amount",
                table: "payment_submissions");

            migrationBuilder.DropColumn(
                name: "SubmittedCharge",
                table: "payment_submissions");

            migrationBuilder.RenameColumn(
                name: "ApprovedAmount",
                table: "payment_submissions",
                newName: "ActualPaid");

            migrationBuilder.AddColumn<decimal>(
                name: "ChargePer1000",
                table: "payment_categories",
                type: "numeric(12,4)",
                precision: 12,
                scale: 4,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddCheckConstraint(
                name: "ck_payment_submissions_amount",
                table: "payment_submissions",
                sql: "\"SubmittedAmount\" > 0 AND (\"ActualPaid\" IS NULL OR \"ActualPaid\" >= 0)");

            migrationBuilder.AddCheckConstraint(
                name: "ck_payment_categories_charge",
                table: "payment_categories",
                sql: "\"ChargePer1000\" >= 0");
        }
    }
}
