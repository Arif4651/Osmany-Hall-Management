using System.Text.Json;
using HallBackend.Application.Services;
using HallBackend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace HallBackend.Tests;

public sealed class BillingAdjustmentVerificationTests
{
    [Fact]
    public async Task RecalculateMonth_GuaranteesConsistentTotalsAndReconcilesAdjustments()
    {
        var settingsPath = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "../../../../../appsettings.Development.json"));
        using var document = JsonDocument.Parse(await File.ReadAllTextAsync(settingsPath));
        var connectionString = document.RootElement
            .GetProperty("ConnectionStrings")
            .GetProperty("DefaultConnection")
            .GetString();
        Assert.False(string.IsNullOrWhiteSpace(connectionString));

        var dataSourceBuilder = new NpgsqlDataSourceBuilder(connectionString);
        await using var dataSource = dataSourceBuilder.Build();

        var options = new DbContextOptionsBuilder<HallDbContext>()
            .UseNpgsql(dataSource)
            .Options;

        await using var db = new HallDbContext(options);
        var inventory = new InventoryTransactionService(db);
        var billing = new BillingCalculationService(db, inventory);

        // Recalculate forward from earliest to ensure all previous due and adjustments are fresh
        await billing.RecalculateFromEarliestAsync(10, 2026, CancellationToken.None);

        var cachedRows = await db.MonthlyBillCache.AsNoTracking()
            .Include(x => x.Student)
            .Where(x => x.Month == 10 && x.Year == 2026)
            .ToListAsync();

        Assert.NotEmpty(cachedRows);

        foreach (var row in cachedRows)
        {
            var calculatedTotal = Math.Round(
                row.MonthlyBill - row.DswSubsidy + row.GuestMealBill + row.OthersBill + row.ServiceBill + row.CarriedDue + row.Adjustment,
                4);

            Assert.Equal(calculatedTotal, row.TotalBill);

            var calculatedDue = Math.Round(row.TotalBill - row.TotalApprovedPaid, 4);
            Assert.Equal(calculatedDue, row.DueBill);
        }

        // Print details for credit / negative due students
        var creditStudents = cachedRows.Where(x => x.DueBill < 0).Take(10).ToList();
        Console.WriteLine("\n--- CREDIT / NEGATIVE DUE STUDENTS IN OCT 2026 ---");
        foreach (var s in creditStudents)
        {
            var adjs = await db.DueAdjustments.AsNoTracking()
                .Where(x => x.StudentId == s.StudentId && x.BillingMonth == 10 && x.BillingYear == 2026)
                .ToListAsync();
            Console.WriteLine(
                $"STUDENT: {s.Student?.StudentName} ({s.Student?.StudentId}) | " +
                $"Service: {s.ServiceBill:F2} | Monthly: {s.MonthlyBill:F2} | CarriedDue: {s.CarriedDue:F2} | " +
                $"Adjustment: {s.Adjustment:F2} | TotalBill: {s.TotalBill:F2} | Paid: {s.TotalApprovedPaid:F2} | DueBill: {s.DueBill:F2} | " +
                $"AdjCount: {adjs.Count} (First Prev: {adjs.FirstOrDefault()?.PreviousAmount}, Adj: {adjs.FirstOrDefault()?.AdjustedAmount})");
        }
    }
}
