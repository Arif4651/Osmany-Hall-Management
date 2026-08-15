using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Migrations
{
    /// <inheritdoc />
    public partial class AllowCreditBalances : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_due_adjustments_amount",
                table: "due_adjustments");

            // Overpayment now survives as a negative closing balance instead of being clamped to
            // zero, so every cached month has to be rebuilt under the new rule. Safe to clear:
            // this table holds only derived figures, and each read path rebuilds a month that has
            // no rows for it.
            migrationBuilder.Sql("DELETE FROM monthly_bill_cache;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddCheckConstraint(
                name: "ck_due_adjustments_amount",
                table: "due_adjustments",
                sql: "\"AdjustedAmount\" >= 0 AND \"PreviousAmount\" >= 0");
        }
    }
}
