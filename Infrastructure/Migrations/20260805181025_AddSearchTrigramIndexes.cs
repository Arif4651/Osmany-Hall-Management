using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HallBackend.Migrations
{
    /// <summary>
    /// Trigram indexes for the admin search boxes.
    /// <para>
    /// Student and payment search match with a leading wildcard ("contains"), which no btree
    /// index can serve — every search was a sequential scan over the whole table. A GIN index
    /// with <c>gin_trgm_ops</c> supports LIKE and ILIKE with leading wildcards, so the queries
    /// in StudentsController and PaymentsController can use an index instead.
    /// </para>
    /// </summary>
    public partial class AddSearchTrigramIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS pg_trgm;");

            // Columns searched by StudentsController.ApplyFilters.
            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "ix_students_studentname_trgm"
                    ON students USING gin ("StudentName" gin_trgm_ops);
                """);
            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "ix_students_studentid_trgm"
                    ON students USING gin ("StudentId" gin_trgm_ops);
                """);
            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "ix_students_rollnumber_trgm"
                    ON students USING gin ("RollNumber" gin_trgm_ops);
                """);
            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "ix_students_hallid_trgm"
                    ON students USING gin ("HallId" gin_trgm_ops);
                """);
            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "ix_students_mobilenumber_trgm"
                    ON students USING gin ("MobileNumber" gin_trgm_ops);
                """);

            // Column searched by PaymentsController.GetAll; the student-side columns in that
            // same search are covered by the student indexes above.
            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "ix_payment_submissions_transactionid_trgm"
                    ON payment_submissions USING gin ("TransactionId" gin_trgm_ops);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""DROP INDEX IF EXISTS "ix_payment_submissions_transactionid_trgm";""");
            migrationBuilder.Sql("""DROP INDEX IF EXISTS "ix_students_mobilenumber_trgm";""");
            migrationBuilder.Sql("""DROP INDEX IF EXISTS "ix_students_hallid_trgm";""");
            migrationBuilder.Sql("""DROP INDEX IF EXISTS "ix_students_rollnumber_trgm";""");
            migrationBuilder.Sql("""DROP INDEX IF EXISTS "ix_students_studentid_trgm";""");
            migrationBuilder.Sql("""DROP INDEX IF EXISTS "ix_students_studentname_trgm";""");

            // pg_trgm is intentionally left installed; dropping it would break anything else
            // that came to depend on it.
        }
    }
}
