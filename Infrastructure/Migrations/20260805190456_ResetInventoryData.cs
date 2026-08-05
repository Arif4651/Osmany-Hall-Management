using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Migrations
{
    /// <summary>
    /// DESTRUCTIVE, ONE-WAY: empties the inventory so batch costing starts from a clean slate.
    /// <para>
    /// Removes every inventory item and stock movement, and the cached bills derived from them.
    /// Meal option preferences and menu entries that pointed at those items are detached rather
    /// than deleted, so students and menus survive — but every student's selected meal option
    /// is cleared and must be chosen again, and menu rows lose their inventory link.
    /// </para>
    /// <para>
    /// There is no <c>Down</c>. Deleted rows cannot be reconstructed. Take a database backup
    /// before applying this to any environment whose data you care about.
    /// </para>
    /// </summary>
    public partial class ResetInventoryData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Detach everything that references an inventory item. All of these foreign keys
            // are Restrict, so the deletes below would fail while any of them still point here.
            migrationBuilder.Sql("""UPDATE meal_preference_history SET "OptionItemId" = NULL WHERE "OptionItemId" IS NOT NULL;""");
            migrationBuilder.Sql("""UPDATE meal_items SET "InventoryItemId" = NULL WHERE "InventoryItemId" IS NOT NULL;""");
            migrationBuilder.Sql("""UPDATE inventory_items SET "LinkedOptionId" = NULL WHERE "LinkedOptionId" IS NOT NULL;""");

            // Stock-outs point at the stock-in batch they drew from; break that self-reference
            // before clearing the table.
            migrationBuilder.Sql("""UPDATE stock_transactions SET "SourceBatchId" = NULL WHERE "SourceBatchId" IS NOT NULL;""");

            migrationBuilder.Sql("DELETE FROM stock_transactions;");
            migrationBuilder.Sql("DELETE FROM inventory_items;");

            // Cached bills were computed from the stock-outs just deleted. Left in place they
            // would report costs for movements that no longer exist; billing recomputes them
            // on next view.
            migrationBuilder.Sql("DELETE FROM monthly_bill_cache;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Intentionally empty: the deleted inventory and bill history cannot be restored
            // from within a migration. Recover from a database backup instead.
        }
    }
}
