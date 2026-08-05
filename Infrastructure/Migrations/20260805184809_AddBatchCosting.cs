using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Migrations
{
    /// <inheritdoc />
    public partial class AddBatchCosting : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsOpeningBatch",
                table: "stock_transactions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsPreBatchLegacy",
                table: "stock_transactions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "RemainingQuantity",
                table: "stock_transactions",
                type: "numeric(12,4)",
                precision: 12,
                scale: 4,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<Guid>(
                name: "SourceBatchId",
                table: "stock_transactions",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_stock_transactions_ItemId_TransactionType_RemainingQuantity",
                table: "stock_transactions",
                columns: new[] { "ItemId", "TransactionType", "RemainingQuantity" });

            migrationBuilder.CreateIndex(
                name: "IX_stock_transactions_SourceBatchId",
                table: "stock_transactions",
                column: "SourceBatchId");

            migrationBuilder.AddForeignKey(
                name: "FK_stock_transactions_stock_transactions_SourceBatchId",
                table: "stock_transactions",
                column: "SourceBatchId",
                principalTable: "stock_transactions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // ── Cutover to batch costing ─────────────────────────────────────────────
            // Everything recorded so far was priced by the old weighted average. Flagging it
            // legacy makes the ledger replay leave those rows untouched, so no historical bill
            // moves by a single taka.
            migrationBuilder.Sql("""
                UPDATE stock_transactions
                   SET "IsPreBatchLegacy" = TRUE,
                       "RemainingQuantity" = 0;
                """);

            // The stock those legacy rows left behind still has to exist somewhere, so each
            // stored item that currently holds stock gets one opening batch carrying that
            // quantity at the item's final weighted average. From here on, every purchase is
            // its own batch at its own rate.
            migrationBuilder.Sql("""
                INSERT INTO stock_transactions (
                    "Id", "ItemId", "TransactionType", "Date", "MealPeriod",
                    "Quantity", "Rate", "WacSnapshot", "TotalCost", "Note",
                    "CreatedById", "UpdatedById", "ParticipantCount",
                    "CreatedAtUtc", "UpdatedAtUtc",
                    "RemainingQuantity", "SourceBatchId", "IsOpeningBatch", "IsPreBatchLegacy")
                SELECT
                    gen_random_uuid(),
                    i."Id",
                    'in',
                    COALESCE(i."LastMovementDate", CURRENT_DATE),
                    NULL,
                    i."CurrentStockQuantity",
                    i."CurrentWac",
                    i."CurrentWac",
                    i."CurrentStockQuantity" * i."CurrentWac",
                    'Opening batch - stock carried over from weighted-average costing',
                    i."CreatedById",
                    NULL,
                    NULL,
                    NOW() AT TIME ZONE 'UTC',
                    NULL,
                    i."CurrentStockQuantity",
                    NULL,
                    TRUE,
                    FALSE
                FROM inventory_items i
                WHERE i."IsStored" = TRUE
                  AND i."CurrentStockQuantity" > 0;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Drop the synthetic opening batches first. Left behind, they would be replayed as
            // real stock-ins by the weighted-average rebuild and double-count the stock.
            migrationBuilder.Sql("""DELETE FROM stock_transactions WHERE "IsOpeningBatch" = TRUE;""");

            migrationBuilder.DropForeignKey(
                name: "FK_stock_transactions_stock_transactions_SourceBatchId",
                table: "stock_transactions");

            migrationBuilder.DropIndex(
                name: "IX_stock_transactions_ItemId_TransactionType_RemainingQuantity",
                table: "stock_transactions");

            migrationBuilder.DropIndex(
                name: "IX_stock_transactions_SourceBatchId",
                table: "stock_transactions");

            migrationBuilder.DropColumn(
                name: "IsOpeningBatch",
                table: "stock_transactions");

            migrationBuilder.DropColumn(
                name: "IsPreBatchLegacy",
                table: "stock_transactions");

            migrationBuilder.DropColumn(
                name: "RemainingQuantity",
                table: "stock_transactions");

            migrationBuilder.DropColumn(
                name: "SourceBatchId",
                table: "stock_transactions");
        }
    }
}
