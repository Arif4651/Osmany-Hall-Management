using System.Text.Json;
using Npgsql;

namespace HallBackend.Tests;

public sealed class PostgresSchemaTests
{
    [Fact]
    public async Task FinancialSchema_UsesFourDecimalMoneyAndRemovesLegacyTables()
    {
        var settingsPath = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "../../../../../appsettings.Development.json"));
        using var document = JsonDocument.Parse(await File.ReadAllTextAsync(settingsPath));
        var connectionString = document.RootElement
            .GetProperty("ConnectionStrings")
            .GetProperty("DefaultConnection")
            .GetString();
        Assert.False(string.IsNullOrWhiteSpace(connectionString));

        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name IN (
                'inventory_items', 'stock_transactions', 'service_bills',
                'due_adjustments', 'payment_categories', 'payment_submissions',
                'monthly_bill_cache', 'meal_items')
              AND data_type = 'numeric'
              AND numeric_scale <> 4;

            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN (
                'bills', 'payments', 'inventory_movements',
                'student_meal_preferences', 'student_meal_pauses');
            """;
        await using var reader = await command.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync());
        Assert.Equal(0L, reader.GetInt64(0));
        Assert.True(await reader.NextResultAsync());
        Assert.True(await reader.ReadAsync());
        Assert.Equal(0L, reader.GetInt64(0));
    }

    [Fact]
    public async Task NoticesTable_IsCorrectlyConfigured()
    {
        var settingsPath = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "../../../../../appsettings.Development.json"));
        using var document = JsonDocument.Parse(await File.ReadAllTextAsync(settingsPath));
        var connectionString = document.RootElement
            .GetProperty("ConnectionStrings")
            .GetProperty("DefaultConnection")
            .GetString();
        Assert.False(string.IsNullOrWhiteSpace(connectionString));

        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'notices'
            ORDER BY column_name;
            """;
        
        var columns = new Dictionary<string, (string DataType, int? MaxLength)>();
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var name = reader.GetString(0);
            var type = reader.GetString(1);
            var maxLength = reader.IsDBNull(2) ? (int?)null : reader.GetInt32(2);
            columns[name] = (type, maxLength);
        }

        Assert.True(columns.ContainsKey("Id"));
        Assert.True(columns.ContainsKey("Title"));
        Assert.True(columns.ContainsKey("Content"));
        Assert.True(columns.ContainsKey("TargetWing"));
        Assert.True(columns.ContainsKey("CreatedById"));
        Assert.True(columns.ContainsKey("CreatedAtUtc"));

        Assert.Equal("character varying", columns["Title"].DataType);
        Assert.Equal(200, columns["Title"].MaxLength);

        Assert.Equal("character varying", columns["Content"].DataType);
        Assert.Equal(4000, columns["Content"].MaxLength);

        Assert.Equal("character varying", columns["TargetWing"].DataType);
        Assert.Equal(20, columns["TargetWing"].MaxLength);
    }
}
