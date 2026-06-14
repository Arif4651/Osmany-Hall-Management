using HallBackend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Infrastructure.Data.Migrations
{
    [DbContext(typeof(HallDbContext))]
    [Migration("20260614140219_TempCheckDsw")]
    public partial class TempCheckDsw : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }

        protected override void BuildTargetModel(ModelBuilder modelBuilder)
        {
        }
    }
}
