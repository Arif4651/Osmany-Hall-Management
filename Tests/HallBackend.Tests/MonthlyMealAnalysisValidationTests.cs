using System.Text.Json;
using Npgsql;

namespace HallBackend.Tests;

public sealed class MonthlyMealAnalysisValidationTests
{
    [Fact]
    public async Task OperationalRange_CalculatesValidBoundaries()
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
        command.CommandText = "SELECT MIN(\"EffectiveFrom\") FROM \"meal_status_history\";";
        var result = await command.ExecuteScalarAsync();

        Assert.NotNull(result);
        var minDate = (DateOnly)result;
        Assert.True(minDate.Year >= 2020);
        Assert.True(minDate.Month >= 1 && minDate.Month <= 12);
    }
}
