using HallBackend.Application.Dtos;
using HallBackend.Domain.Constants;
using HallBackend.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Controllers;

[ApiController]
[Authorize]
[Route("api/dashboard")]
public sealed class DashboardController(HallDbContext db) : ControllerBase
{
    [HttpGet("admin")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<DashboardDto> Admin(CancellationToken cancellationToken)
    {
        var totalResidents = await db.Students.CountAsync(cancellationToken);
        var pendingPayments = await db.Payments.CountAsync(x => x.Status == "pending" || x.Status == "processing", cancellationToken);
        var inventoryAlerts = await db.InventoryItems.CountAsync(x => x.Stock <= x.Threshold, cancellationToken);
        var revenue = await db.Payments.Where(x => x.Status == "verified").SumAsync(x => x.Amount, cancellationToken);

        return new DashboardDto([
            new StatDto("Total Residents", totalResidents, null, "+12 this month", "info"),
            new StatDto("Pending Payments", pendingPayments, null, "Needs review", "warning"),
            new StatDto("Inventory Alerts", inventoryAlerts, null, "Low stock items", "danger"),
            new StatDto("Revenue Collected", revenue, null, "Verified payments", "success", true),
        ]);
    }

    [HttpGet("student/{studentId:guid}")]
    [Authorize(Roles = Roles.Student + "," + Roles.Admin)]
    public async Task<DashboardDto> Student(Guid studentId, CancellationToken cancellationToken)
    {
        var pendingBills = await db.Bills.Where(x => x.StudentId == studentId && x.Status != "paid").ToListAsync(cancellationToken);
        var monthlyBill = pendingBills.Sum(x => x.Total);
        var balance = Math.Max(0, 10000 - monthlyBill);

        return new DashboardDto([
            new StatDto("Monthly Bill", monthlyBill, "BDT", "Current dues", "warning"),
            new StatDto("Meals This Month", 84, "meals", "+8%", "success"),
            new StatDto("Remaining Balance", balance, "BDT", "Available", "info"),
            new StatDto("Pending Payments", pendingBills.Count, "invoice", "Action needed", "danger"),
        ]);
    }
}
