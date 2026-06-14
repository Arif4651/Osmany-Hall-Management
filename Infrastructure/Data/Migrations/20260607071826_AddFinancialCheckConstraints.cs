using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFinancialCheckConstraints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddCheckConstraint(
                name: "ck_service_bills_amount",
                table: "service_bills",
                sql: "\"AmountPerStudent\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "ck_payment_submissions_amount",
                table: "payment_submissions",
                sql: "\"SubmittedAmount\" > 0 AND (\"ActualPaid\" IS NULL OR \"ActualPaid\" >= 0)");

            migrationBuilder.AddCheckConstraint(
                name: "ck_payment_submissions_status",
                table: "payment_submissions",
                sql: "\"Status\" IN ('under_review','approved','rejected')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_payment_categories_charge",
                table: "payment_categories",
                sql: "\"ChargePer1000\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "ck_meal_status_dates",
                table: "meal_status_history",
                sql: "\"EffectiveTo\" IS NULL OR \"EffectiveTo\" >= \"EffectiveFrom\"");

            migrationBuilder.AddCheckConstraint(
                name: "ck_meal_status_period",
                table: "meal_status_history",
                sql: "\"MealPeriod\" IN ('breakfast','lunch','dinner')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_meal_preference_dates",
                table: "meal_preference_history",
                sql: "\"EffectiveTo\" IS NULL OR \"EffectiveTo\" >= \"EffectiveFrom\"");

            migrationBuilder.AddCheckConstraint(
                name: "ck_meal_preference_period",
                table: "meal_preference_history",
                sql: "\"MealPeriod\" IN ('breakfast','lunch','dinner')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_inventory_items_category",
                table: "inventory_items",
                sql: "\"Category\" IN ('Common','Options','Others')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_inventory_items_link",
                table: "inventory_items",
                sql: "(\"Category\" = 'Others' AND \"LinkedOptionId\" IS NOT NULL) OR (\"Category\" <> 'Others' AND \"LinkedOptionId\" IS NULL)");

            migrationBuilder.AddCheckConstraint(
                name: "ck_inventory_items_stock",
                table: "inventory_items",
                sql: "\"CurrentStockQuantity\" >= 0 AND \"CurrentWac\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "ck_due_adjustments_amount",
                table: "due_adjustments",
                sql: "\"AdjustedAmount\" >= 0 AND \"PreviousAmount\" >= 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_service_bills_amount",
                table: "service_bills");

            migrationBuilder.DropCheckConstraint(
                name: "ck_payment_submissions_amount",
                table: "payment_submissions");

            migrationBuilder.DropCheckConstraint(
                name: "ck_payment_submissions_status",
                table: "payment_submissions");

            migrationBuilder.DropCheckConstraint(
                name: "ck_payment_categories_charge",
                table: "payment_categories");

            migrationBuilder.DropCheckConstraint(
                name: "ck_meal_status_dates",
                table: "meal_status_history");

            migrationBuilder.DropCheckConstraint(
                name: "ck_meal_status_period",
                table: "meal_status_history");

            migrationBuilder.DropCheckConstraint(
                name: "ck_meal_preference_dates",
                table: "meal_preference_history");

            migrationBuilder.DropCheckConstraint(
                name: "ck_meal_preference_period",
                table: "meal_preference_history");

            migrationBuilder.DropCheckConstraint(
                name: "ck_inventory_items_category",
                table: "inventory_items");

            migrationBuilder.DropCheckConstraint(
                name: "ck_inventory_items_link",
                table: "inventory_items");

            migrationBuilder.DropCheckConstraint(
                name: "ck_inventory_items_stock",
                table: "inventory_items");

            migrationBuilder.DropCheckConstraint(
                name: "ck_due_adjustments_amount",
                table: "due_adjustments");
        }
    }
}
