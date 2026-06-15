using HallBackend.Application.Dtos;
using HallBackend.Application.Services;
using HallBackend.Domain.Constants;
using HallBackend.Domain.Entities;
using HallBackend.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Controllers;

[ApiController]
[Authorize(Roles = Roles.HallAdministrators)]
[Route("api/inventory")]
public sealed class InventoryController(
    HallDbContext db,
    CurrentUserService currentUser,
    BillingPeriodService periods,
    InventoryTransactionService inventory,
    ItemCatalogService catalog,
    BillingCalculationService billing) : ControllerBase
{
    private static readonly string[] Categories = ["Common", "Options", "Others"];
    private static readonly string[] MealPeriods = ["breakfast", "lunch", "dinner"];

    [HttpGet("items")]
    [HttpGet]
    public async Task<IReadOnlyList<InventoryItemFinancialDto>> GetItems([FromQuery] bool includeDeleted = false, [FromQuery] string? wing = null, CancellationToken cancellationToken = default)
    {
        var selectedWing = await currentUser.GetManagedWingAsync(wing, cancellationToken);
        return await db.InventoryItems.AsNoTracking()
            .Where(x => x.Wing == selectedWing && (includeDeleted || !x.IsDeleted))
            .OrderBy(x => x.Item)
            .Select(x => new InventoryItemFinancialDto(
                x.Id, x.Item, x.Wing, x.Category, x.Unit, x.LinkedOptionId,
                x.CurrentStockQuantity, x.CurrentWac, x.CurrentStockQuantity * x.CurrentWac, x.IsDeleted, x.IsStored))
            .ToListAsync(cancellationToken);
    }

    [HttpPost("items")]
    public async Task<ActionResult<InventoryItemFinancialDto>> CreateItem(SaveInventoryItemRequest request, CancellationToken cancellationToken)
    {
        var selectedWing = await currentUser.GetManagedWingAsync(request.Wing, cancellationToken);
        var error = await ValidateItemAsync(request, selectedWing, null, cancellationToken);
        if (error is not null) return BadRequest(new { message = error });
        var normalizedName = ItemCatalogService.NormalizeName(request.Name);
        var archivedItems = await db.InventoryItems
            .Where(x => x.IsDeleted && x.Wing == selectedWing)
            .ToListAsync(cancellationToken);
        var item = archivedItems.FirstOrDefault(x =>
            ItemCatalogService.NormalizeName(x.Item) == normalizedName);
        if (item is not null)
        {
            if (item.Category != request.Category)
                return Conflict(new { message = $"This archived item belongs to the {item.Category} category." });
            item.IsDeleted = false;
            item.DeletedAtUtc = null;
            item.Item = request.Name.Trim();
            item.Wing = selectedWing;
            item.Unit = request.Unit.Trim();
            item.LinkedOptionId = request.Category == "Others" ? request.LinkedOptionId : null;
            item.IsStored = request.IsStored;
            item.Status = item.CurrentStockQuantity <= item.Threshold ? "low-stock" : "active";
        }
        else
        {
            item = new InventoryItem
            {
                Item = request.Name.Trim(),
                Wing = selectedWing,
                Category = request.Category,
                Unit = request.Unit.Trim(),
                LinkedOptionId = request.Category == "Others" ? request.LinkedOptionId : null,
                IsStored = request.IsStored,
                CreatedById = currentUser.UserId,
                Status = "active",
            };
            db.InventoryItems.Add(item);
        }
        await catalog.RelinkMealItemsAsync(item, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetItems), ToDto(item));
    }

    [HttpPut("items/{id:guid}")]
    public async Task<ActionResult<InventoryItemFinancialDto>> UpdateItem(Guid id, SaveInventoryItemRequest request, CancellationToken cancellationToken)
    {
        var item = await db.InventoryItems.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null) return NotFound();
        var selectedWing = await currentUser.GetManagedWingAsync(request.Wing, cancellationToken);
        if (item.Wing != selectedWing) return Forbid();
        var error = await ValidateItemAsync(request, selectedWing, id, cancellationToken);
        if (error is not null) return BadRequest(new { message = error });
        item.Item = request.Name.Trim();
        item.Category = request.Category;
        item.Unit = request.Unit.Trim();
        item.LinkedOptionId = request.Category == "Others" ? request.LinkedOptionId : null;
        item.IsStored = request.IsStored;
        await db.SaveChangesAsync(cancellationToken);
        return ToDto(item);
    }

    [HttpDelete("items/{id:guid}")]
    public async Task<IActionResult> DeleteItem(Guid id, CancellationToken cancellationToken)
    {
        var item = await db.InventoryItems.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null) return NotFound();
        var adminWing = await currentUser.GetAdminWingAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(adminWing) && item.Wing != adminWing) return Forbid();
        if (item.CurrentStockQuantity > 0m)
        {
            return Conflict(new
            {
                message = "This item still has stock. Use force delete to permanently remove the item and its complete ledger.",
            });
        }
        var hasHistory = await db.StockTransactions.AnyAsync(x => x.ItemId == id, cancellationToken);
        if (hasHistory)
        {
            item.IsDeleted = true;
            item.DeletedAtUtc = DateTime.UtcNow;
            item.Status = "archived";
        }
        else
        {
            db.InventoryItems.Remove(item);
        }
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { archived = hasHistory });
    }

    [HttpDelete("items/{id:guid}/force")]
    public async Task<IActionResult> ForceDeleteItem(Guid id, CancellationToken cancellationToken)
    {
        var item = await db.InventoryItems.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null) return NotFound();
        var adminWing = await currentUser.GetAdminWingAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(adminWing) && item.Wing != adminWing) return Forbid();

        var linkedItems = await db.InventoryItems.AsNoTracking()
            .Where(x => x.LinkedOptionId == id)
            .OrderBy(x => x.Item)
            .Select(x => x.Item)
            .ToListAsync(cancellationToken);
        if (linkedItems.Count > 0)
        {
            return Conflict(new
            {
                message = $"Delete or relink these dependent inventory items first: {string.Join(", ", linkedItems)}.",
            });
        }

        var stockTransactions = await db.StockTransactions
            .Where(x => x.ItemId == id)
            .ToListAsync(cancellationToken);
        var earliestBilledDate = stockTransactions
            .Where(x => x.TransactionType == "out")
            .Select(x => (DateOnly?)x.Date)
            .Min();

        if (earliestBilledDate.HasValue)
        {
            var startKey = earliestBilledDate.Value.Year * 100 + earliestBilledDate.Value.Month;
            var billingEnd = DateOnly.FromDateTime(DateTime.Today).AddMonths(1);
            var endKey = billingEnd.Year * 100 + billingEnd.Month;
            var firstLockedPeriod = await db.BillingPeriods.AsNoTracking()
                .Where(x => x.IsLocked
                    && x.Year * 100 + x.Month >= startKey
                    && x.Year * 100 + x.Month <= endKey)
                .OrderBy(x => x.Year)
                .ThenBy(x => x.Month)
                .Select(x => new { x.Month, x.Year })
                .FirstOrDefaultAsync(cancellationToken);
            if (firstLockedPeriod is not null)
            {
                return StatusCode(403, new
                {
                    message = $"Billing period {firstLockedPeriod.Month:00}/{firstLockedPeriod.Year} is closed. Unlock it before force deleting this item.",
                });
            }
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var preferenceRows = await db.MealPreferenceHistory
                .Where(x => x.OptionItemId == id)
                .ToListAsync(cancellationToken);
            foreach (var preference in preferenceRows)
            {
                preference.OptionItemId = null;
            }

            db.StockTransactions.RemoveRange(stockTransactions);
            db.InventoryItems.Remove(item);
            await db.SaveChangesAsync(cancellationToken);

            if (earliestBilledDate.HasValue)
            {
                await billing.RecalculateForwardAsync(
                    earliestBilledDate.Value.Month,
                    earliestBilledDate.Value.Year,
                    cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
            return Ok(new
            {
                deletedTransactions = stockTransactions.Count,
                billsRecalculatedFrom = earliestBilledDate,
            });
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    [HttpGet("participant-count")]
    public async Task<ActionResult<int>> GetParticipantCount(
        [FromQuery] DateOnly date,
        [FromQuery] string mealPeriod,
        [FromQuery] Guid itemId,
        [FromQuery] string? wing = null,
        CancellationToken cancellationToken = default)
    {
        var selectedWing = await currentUser.GetManagedWingAsync(wing, cancellationToken);
        var item = await db.InventoryItems.AsNoTracking().FirstOrDefaultAsync(x => x.Id == itemId, cancellationToken);
        if (item is null) return NotFound("Item not found");
        if (item.Wing != selectedWing) return Forbid();

        var students = await db.Students.AsNoTracking().Where(x => x.Gender == selectedWing).ToListAsync(cancellationToken);
        var overrides = await db.GlobalMealOverrides.AsNoTracking()
            .Where(x => x.Wing == selectedWing && x.EffectiveFrom <= date && x.EffectiveTo >= date)
            .ToListAsync(cancellationToken);
        var statuses = await db.MealStatusHistory.AsNoTracking()
            .Where(x => x.EffectiveFrom <= date && (x.EffectiveTo == null || x.EffectiveTo >= date))
            .ToListAsync(cancellationToken);
        var preferences = await db.MealPreferenceHistory.AsNoTracking()
            .Where(x => x.EffectiveFrom <= date && (x.EffectiveTo == null || x.EffectiveTo >= date))
            .ToListAsync(cancellationToken);

        var count = students.Count(student =>
        {
            var globalOverride = overrides
                .Where(x => x.Wing == student.Gender
                    && x.MealPeriod == mealPeriod
                    && x.EffectiveFrom <= date
                    && x.EffectiveTo >= date)
                .OrderByDescending(x => x.EffectiveFrom)
                .FirstOrDefault();

            bool on;
            if (globalOverride is not null)
            {
                on = globalOverride.IsOn;
            }
            else
            {
                on = statuses
                    .Where(x => x.StudentId == student.Id && x.MealPeriod == mealPeriod && x.EffectiveFrom <= date && (x.EffectiveTo == null || x.EffectiveTo >= date))
                    .OrderByDescending(x => x.EffectiveFrom)
                    .FirstOrDefault()?.IsOn ?? false;
            }

            var selected = preferences
                .Where(x => x.StudentId == student.Id && x.MealPeriod == mealPeriod && x.EffectiveFrom <= date && (x.EffectiveTo == null || x.EffectiveTo >= date))
                .OrderByDescending(x => x.EffectiveFrom)
                .FirstOrDefault()?.OptionItemId;

            return FinancialMath.IsChargeParticipant(
                item.Category,
                item.Id,
                item.LinkedOptionId,
                on,
                selected);
        });

        return Ok(count);
    }

    [HttpGet("transactions")]
    [HttpGet("ledger")]
    public async Task<IReadOnlyList<StockTransactionDto>> GetTransactions(
        [FromQuery] Guid? itemId, [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] string? wing,
        CancellationToken cancellationToken)
    {
        var selectedWing = await currentUser.GetManagedWingAsync(wing, cancellationToken);
        var query = db.StockTransactions.AsNoTracking()
            .Include(x => x.Item)
            .Where(x => x.Item != null && x.Item.Wing == selectedWing)
            .AsQueryable();
        if (itemId.HasValue) query = query.Where(x => x.ItemId == itemId);
        if (from.HasValue) query = query.Where(x => x.Date >= from);
        if (to.HasValue) query = query.Where(x => x.Date <= to);
        var locked = await db.BillingPeriods.AsNoTracking().Where(x => x.IsLocked)
            .Select(x => new { x.Month, x.Year }).ToListAsync(cancellationToken);
        var lockedKeys = locked.Select(x => x.Year * 100 + x.Month).ToHashSet();
        var rows = await query.OrderByDescending(x => x.Date).ThenByDescending(x => x.CreatedAtUtc).ToListAsync(cancellationToken);
        return rows.Select(x => ToDto(x, lockedKeys.Contains(x.Date.Year * 100 + x.Date.Month))).ToList();
    }

    [HttpPost("transactions")]
    [HttpPost("movements")]
    public async Task<ActionResult<StockTransactionDto>> CreateTransaction(SaveStockTransactionRequest request, CancellationToken cancellationToken)
    {
        var selectedWing = await currentUser.GetManagedWingAsync(request.Wing, cancellationToken);
        var item = await db.InventoryItems.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.ItemId && !x.IsDeleted, cancellationToken);
        if (item is null) return BadRequest(new { message = "Inventory item was not found." });

        bool isStockInOrNonStock = (item.IsStored && request.TransactionType == "in") || (!item.IsStored && request.TransactionType == "out");
        decimal? computedRate = request.Rate;

        if (isStockInOrNonStock)
        {
            if (request.Quantity <= 0m)
            {
                return BadRequest(new { message = "Quantity must be greater than zero." });
            }
            if (!request.TotalPrice.HasValue)
            {
                return BadRequest(new { message = "Total Price is required." });
            }
            if (request.TotalPrice.Value <= 0m)
            {
                return BadRequest(new { message = "Total Price must be greater than zero." });
            }
            computedRate = request.TotalPrice.Value / request.Quantity;
        }

        var updatedRequest = request with { Rate = computedRate };
        var validation = await ValidateTransactionAsync(updatedRequest, selectedWing, cancellationToken);
        if (validation is not null) return BadRequest(new { message = validation });
        try
        {
            await periods.EnsureOpenAsync(updatedRequest.Date, cancellationToken);
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            var row = new StockTransaction
            {
                ItemId = updatedRequest.ItemId,
                TransactionType = updatedRequest.TransactionType,
                Date = updatedRequest.Date,
                MealPeriod = updatedRequest.TransactionType == "out" ? updatedRequest.MealPeriod : null,
                Quantity = updatedRequest.Quantity,
                Rate = updatedRequest.Rate ?? 0m,
                TotalCost = isStockInOrNonStock ? (updatedRequest.TotalPrice ?? 0m) : 0m,
                Note = updatedRequest.Note?.Trim(),
                CreatedById = currentUser.UserId,
            };
            db.StockTransactions.Add(row);
            await db.SaveChangesAsync(cancellationToken);
            await inventory.RebuildItemAsync(updatedRequest.ItemId, cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            await billing.RecalculateForwardAsync(updatedRequest.Date.Month, updatedRequest.Date.Year, cancellationToken);
            await db.Entry(row).Reference(x => x.Item).LoadAsync(cancellationToken);
            return CreatedAtAction(nameof(GetTransactions), ToDto(row, false));
        }
        catch (BillingPeriodClosedException ex) { return StatusCode(403, new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPut("transactions/{id:guid}")]
    [HttpPut("movements/{id:guid}")]
    public async Task<ActionResult<StockTransactionDto>> UpdateTransaction(Guid id, SaveStockTransactionRequest request, CancellationToken cancellationToken)
    {
        var row = await db.StockTransactions.Include(x => x.Item).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null) return NotFound();
        var selectedWing = await currentUser.GetManagedWingAsync(request.Wing, cancellationToken);
        if (row.Item?.Wing != selectedWing) return Forbid();

        var item = await db.InventoryItems.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.ItemId && !x.IsDeleted, cancellationToken);
        if (item is null) return BadRequest(new { message = "Inventory item was not found." });

        bool isStockInOrNonStock = (item.IsStored && request.TransactionType == "in") || (!item.IsStored && request.TransactionType == "out");
        decimal? computedRate = request.Rate;

        if (isStockInOrNonStock)
        {
            if (request.Quantity <= 0m)
            {
                return BadRequest(new { message = "Quantity must be greater than zero." });
            }
            if (!request.TotalPrice.HasValue)
            {
                return BadRequest(new { message = "Total Price is required." });
            }
            if (request.TotalPrice.Value <= 0m)
            {
                return BadRequest(new { message = "Total Price must be greater than zero." });
            }
            computedRate = request.TotalPrice.Value / request.Quantity;
        }

        var updatedRequest = request with { Rate = computedRate };
        var validation = await ValidateTransactionAsync(updatedRequest, selectedWing, cancellationToken);
        if (validation is not null) return BadRequest(new { message = validation });
        try
        {
            await periods.EnsureOpenAsync(row.Date, cancellationToken);
            await periods.EnsureOpenAsync(updatedRequest.Date, cancellationToken);
            var oldItemId = row.ItemId;
            var oldDate = row.Date;
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            row.ItemId = updatedRequest.ItemId;
            row.TransactionType = updatedRequest.TransactionType;
            row.Date = updatedRequest.Date;
            row.MealPeriod = updatedRequest.TransactionType == "out" ? updatedRequest.MealPeriod : null;
            row.Quantity = updatedRequest.Quantity;
            row.Rate = updatedRequest.Rate ?? 0m;
            row.TotalCost = isStockInOrNonStock ? (updatedRequest.TotalPrice ?? 0m) : 0m;
            row.Note = updatedRequest.Note?.Trim();
            row.UpdatedById = currentUser.UserId;
            await db.SaveChangesAsync(cancellationToken);
            await inventory.RebuildItemAsync(oldItemId, cancellationToken);
            if (oldItemId != updatedRequest.ItemId) await inventory.RebuildItemAsync(updatedRequest.ItemId, cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            var first = oldDate.Year * 12 + oldDate.Month <= updatedRequest.Date.Year * 12 + updatedRequest.Date.Month ? oldDate : updatedRequest.Date;
            await billing.RecalculateForwardAsync(first.Month, first.Year, cancellationToken);
            return ToDto(row, false);
        }
        catch (BillingPeriodClosedException ex) { return StatusCode(403, new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpDelete("transactions/{id:guid}")]
    [HttpDelete("movements/{id:guid}")]
    public async Task<IActionResult> DeleteTransaction(Guid id, CancellationToken cancellationToken)
    {
        var row = await db.StockTransactions.Include(x => x.Item).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null) return NotFound();
        var adminWing = await currentUser.GetAdminWingAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(adminWing) && row.Item?.Wing != adminWing) return Forbid();
        try
        {
            await periods.EnsureOpenAsync(row.Date, cancellationToken);
            var itemId = row.ItemId;
            var date = row.Date;
            db.StockTransactions.Remove(row);
            await db.SaveChangesAsync(cancellationToken);
            await inventory.RebuildItemAsync(itemId, cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            await billing.RecalculateForwardAsync(date.Month, date.Year, cancellationToken);
            return NoContent();
        }
        catch (BillingPeriodClosedException ex) { return StatusCode(403, new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    private async Task<string?> ValidateItemAsync(SaveInventoryItemRequest request, string selectedWing, Guid? id, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return "Item name is required.";
        if (!Categories.Contains(request.Category)) return "Category must be Common, Options, or Others.";
        if (string.IsNullOrWhiteSpace(request.Unit)) return "Unit is required.";
        var normalizedName = ItemCatalogService.NormalizeName(request.Name);
        var otherItems = await db.InventoryItems
            .Where(x => x.Id != id && !x.IsDeleted && x.Wing == selectedWing)
            .Select(x => x.Item)
            .ToListAsync(cancellationToken);
        if (otherItems.Any(x => ItemCatalogService.NormalizeName(x) == normalizedName))
            return $"An inventory item with this name already exists in the {selectedWing} wing.";
        if (request.Category == "Others" && (!request.LinkedOptionId.HasValue ||
            !await db.InventoryItems.AnyAsync(x => x.Id == request.LinkedOptionId && x.Category == "Options" && !x.IsDeleted && x.Wing == selectedWing, cancellationToken)))
            return "Others items must link to an active Options item.";
        return null;
    }

    private async Task<string?> ValidateTransactionAsync(SaveStockTransactionRequest request, string selectedWing, CancellationToken cancellationToken)
    {
        if (request.TransactionType is not ("in" or "out")) return "Transaction type must be in or out.";
        if (request.Quantity <= 0m) return "Quantity must be greater than zero.";
        
        var item = await db.InventoryItems.FirstOrDefaultAsync(x => x.Id == request.ItemId && !x.IsDeleted, cancellationToken);
        if (item is null) return "Inventory item was not found.";
        if (item.Wing != selectedWing) return $"This inventory item belongs to the {item.Wing} wing.";

        if (!item.IsStored)
        {
            if (request.TransactionType != "out") return "Non-Stored items can only have Stock Out (Non-Stock) transactions.";
            if (!request.Rate.HasValue || request.Rate < 0m) return "Rate is required for non-stored item transactions.";
            if (string.IsNullOrWhiteSpace(request.MealPeriod) || !MealPeriods.Contains(request.MealPeriod))
                return "Valid Meal period is required for non-stored item transactions.";
        }
        else
        {
            if (request.TransactionType == "in" && (!request.Rate.HasValue || request.Rate < 0m)) return "Rate is required for stock-in.";
            if (request.TransactionType == "out" && (string.IsNullOrWhiteSpace(request.MealPeriod) || !MealPeriods.Contains(request.MealPeriod)))
                return "Meal period is required for stock-out.";
        }
        return null;
    }

    private static InventoryItemFinancialDto ToDto(InventoryItem x)
        => new(x.Id, x.Item, x.Wing, x.Category, x.Unit, x.LinkedOptionId, x.CurrentStockQuantity, x.CurrentWac, x.CurrentStockQuantity * x.CurrentWac, x.IsDeleted, x.IsStored);

    private static StockTransactionDto ToDto(StockTransaction x, bool locked)
        => new(x.Id, x.ItemId, x.Item?.Item ?? string.Empty, x.Item?.Wing ?? "Male", x.Item?.Category ?? string.Empty,
            x.TransactionType, x.Date, x.MealPeriod, x.Quantity, x.Rate, x.WacSnapshot,
            x.TotalCost, x.Note, locked, x.ParticipantCount);
}
