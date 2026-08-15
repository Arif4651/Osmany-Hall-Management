using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Migrations
{
    /// <inheritdoc />
    public partial class AddBillAdjustmentColumn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Adjustment",
                table: "monthly_bill_cache",
                type: "numeric(12,4)",
                precision: 12,
                scale: 4,
                nullable: false,
                defaultValue: 0m);

            // Manual due corrections moved from replacing DueBill to being a signed line inside
            // TotalBill, so every stored row was computed under the old rule. This table is a
            // cache of derived figures — every read path calls EnsureMonthCalculatedAsync, which
            // rebuilds a month from source data whenever it has no rows for it — so clearing it is
            // how the new rule gets applied. Nothing is lost: charges, payments and the adjustment
            // history all live in their own tables.
            migrationBuilder.Sql("DELETE FROM monthly_bill_cache;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Adjustment",
                table: "monthly_bill_cache");
        }
    }
}
