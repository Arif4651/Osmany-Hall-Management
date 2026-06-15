using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddParticipantCount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ParticipantCount",
                table: "stock_transactions",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ParticipantCount",
                table: "stock_transactions");
        }
    }
}
