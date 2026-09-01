using HallBackend.Application.Dtos;
using HallBackend.Application.Services;
using HallBackend.Domain.Constants;
using HallBackend.Domain.Entities;
using HallBackend.Infrastructure.Data;
using HallBackend.Infrastructure.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Controllers;

[ApiController]
[Authorize]
[Route("api/inventory")]
public sealed class InventoryController(
    HallDbContext db,
    CurrentUserService currentUser,
    InventoryTransactionService inventory,
    ItemCatalogService catalog,
    BillingCalculationService billing) : ControllerBase
{
    private static readonly string[] Categories = ["Common", "Options", "Others"];
    private static readonly string[] MealPeriods = ["breakfast", "lunch", "dinner"];

    [HttpGet("items")]
    [HttpGet]
    [RequirePermission(MenuKeys.AdminInventory, PermissionActions.View)]
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
    [RequirePermission(MenuKeys.AdminInventory, PermissionActions.Create)]
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
    [RequirePermission(MenuKeys.AdminInventory, PermissionActions.Edit)]
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
    [RequirePermission(MenuKeys.AdminInventory, PermissionActions.Delete)]
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
    [RequirePermission(MenuKeys.AdminInventory, PermissionActions.Delete)]
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

            await transaction.CommitAsync(cancellationToken);

            if (earliestBilledDate.HasValue)
            {
                await billing.RecalculateForwardAsync(
                    earliestBilledDate.Value.Month,
                    earliestBilledDate.Value.Year,
                    cancellationToken);
            }

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
    [RequirePermission(MenuKeys.AdminInventory, PermissionActions.View)]
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

        // Same context the billing pass uses, so this preview cannot drift from the headcount
        // the bill is actually divided by.
        var meals = await MealResolutionContext.LoadAsync(db, date, date, cancellationToken);
        return Ok(meals.CountParticipants(item, mealPeriod, date));
    }

    [HttpGet("transactions")]
    [HttpGet("ledger")]
    [RequirePermission(MenuKeys.AdminInventory, PermissionActions.View)]
    public async Task<IReadOnlyList<StockTransactionDto>> GetTransactions(
        [FromQuery] Guid? itemId, [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] string? wing,
        CancellationToken cancellationToken)
    {
        var selectedWing = await currentUser.GetManagedWingAsync(wing, cancellationToken);
        var query = db.StockTransactions.AsNoTracking()
            .Include(x => x.Item)
            .Include(x => x.SourceBatch)
            .Where(x => x.Item != null && x.Item.Wing == selectedWing)
            .AsQueryable();
        if (itemId.HasValue) query = query.Where(x => x.ItemId == itemId);
        if (from.HasValue) query = query.Where(x => x.Date >= from);
        if (to.HasValue) query = query.Where(x => x.Date <= to);
        var rows = await query.OrderByDescending(x => x.Date).ThenByDescending(x => x.CreatedAtUtc).ToListAsync(cancellationToken);
        return rows.Select(x => ToDto(x, false)).ToList();
    }

    [HttpPost("transactions")]
    [HttpPost("movements")]
    [RequirePermission(MenuKeys.AdminInventory, PermissionActions.Create)]
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
                // Stored stock-outs draw from one named batch; the replay prices them from it.
                SourceBatchId = item.IsStored && updatedRequest.TransactionType == "out"
                    ? updatedRequest.SourceBatchId
                    : null,
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
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    /// <summary>
    /// Atomic bulk submission for Stock Out and Non-Stock sessions.
    /// All items are validated first (no writes); if any fail, returns 400 with per-item errors.
    /// If all pass, inserts everything in one DB transaction, then rebuilds stock and billing.
    /// </summary>
    [HttpPost("transactions/bulk")]
    [RequirePermission(MenuKeys.AdminInventory, PermissionActions.Create)]
    public async Task<ActionResult<BulkTransactionResult>> CreateBulkTransactions(
        BulkStockTransactionRequest bulkRequest, CancellationToken cancellationToken)
    {
        if (bulkRequest.Items is null || bulkRequest.Items.Count == 0)
            return BadRequest(new { message = "No items supplied." });

        var selectedWing = await currentUser.GetManagedWingAsync(bulkRequest.Wing, cancellationToken);

        // ── Validation pass (no DB writes) ────────────────────────────────────
        var errors = new List<BulkTransactionItemError>();
        var computed = new List<SaveStockTransactionRequest>(bulkRequest.Items.Count);

        for (int i = 0; i < bulkRequest.Items.Count; i++)
        {
            var req = bulkRequest.Items[i];
            var item = await db.InventoryItems.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == req.ItemId && !x.IsDeleted, cancellationToken);

            if (item is null)
            {
                errors.Add(new BulkTransactionItemError(i, "Inventory item was not found."));
                computed.Add(req);
                continue;
            }

            bool isStockInOrNonStock = (item.IsStored && req.TransactionType == "in") ||
                                       (!item.IsStored && req.TransactionType == "out");
            decimal? computedRate = req.Rate;

            if (isStockInOrNonStock)
            {
                if (req.Quantity <= 0m) { errors.Add(new BulkTransactionItemError(i, $"{item.Item}: Quantity must be greater than zero.")); computed.Add(req); continue; }
                if (!req.TotalPrice.HasValue || req.TotalPrice.Value <= 0m) { errors.Add(new BulkTransactionItemError(i, $"{item.Item}: Total Price must be greater than zero.")); computed.Add(req); continue; }
                computedRate = req.TotalPrice.Value / req.Quantity;
            }

            var updatedReq = req with { Rate = computedRate };
            var validationError = await ValidateTransactionAsync(updatedReq, selectedWing, cancellationToken);
            if (validationError is not null)
                errors.Add(new BulkTransactionItemError(i, $"{item.Item}: {validationError}"));

            computed.Add(updatedReq);
        }

        if (errors.Count > 0)
            return BadRequest(new BulkTransactionResult(0, errors));

        // ── Write pass (all-or-nothing) ────────────────────────────────────────
        try
        {
            await using var dbTx = await db.Database.BeginTransactionAsync(cancellationToken);

            var insertedItemIds = new HashSet<Guid>();
            var affectedDates = new HashSet<DateOnly>();

            for (int i = 0; i < computed.Count; i++)
            {
                var req = computed[i];
                var item = await db.InventoryItems.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == req.ItemId, cancellationToken);
                bool isStockInOrNonStock = (item!.IsStored && req.TransactionType == "in") ||
                                           (!item.IsStored && req.TransactionType == "out");
                var row = new StockTransaction
                {
                    ItemId = req.ItemId,
                    TransactionType = req.TransactionType,
                    Date = req.Date,
                    MealPeriod = req.TransactionType == "out" ? req.MealPeriod : null,
                    Quantity = req.Quantity,
                    Rate = req.Rate ?? 0m,
                    TotalCost = isStockInOrNonStock ? (req.TotalPrice ?? 0m) : 0m,
                    Note = req.Note?.Trim(),
                    CreatedById = currentUser.UserId,
                    SourceBatchId = item.IsStored && req.TransactionType == "out" ? req.SourceBatchId : null,
                };
                db.StockTransactions.Add(row);
                insertedItemIds.Add(req.ItemId);
                affectedDates.Add(req.Date);
            }

            await db.SaveChangesAsync(cancellationToken);

            foreach (var itemId in insertedItemIds)
                await inventory.RebuildItemAsync(itemId, cancellationToken);

            await db.SaveChangesAsync(cancellationToken);
            await dbTx.CommitAsync(cancellationToken);

            // Recalculate billing for every distinct month that was touched.
            var months = affectedDates
                .Select(d => (d.Month, d.Year))
                .Distinct()
                .OrderBy(x => x.Year).ThenBy(x => x.Month);
            foreach (var (month, year) in months)
                await billing.RecalculateForwardAsync(month, year, cancellationToken);

            return Ok(new BulkTransactionResult(computed.Count, []));
        }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPut("transactions/{id:guid}")]
    [HttpPut("movements/{id:guid}")]
    [RequirePermission(MenuKeys.AdminInventory, PermissionActions.Edit)]
    public async Task<ActionResult<StockTransactionDto>> UpdateTransaction(Guid id, SaveStockTransactionRequest request, CancellationToken cancellationToken)
    {
        var row = await db.StockTransactions.Include(x => x.Item).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null) return NotFound();
        var selectedWing = await currentUser.GetManagedWingAsync(request.Wing, cancellationToken);
        if (row.Item?.Wing != selectedWing) return Forbid();
        if (row.IsPreBatchLegacy)
        {
            return Conflict(new
            {
                message = "This movement predates batch tracking and is locked so historical bills stay unchanged.",
            });
        }

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
            row.SourceBatchId = item.IsStored && updatedRequest.TransactionType == "out"
                ? updatedRequest.SourceBatchId
                : null;
            await db.SaveChangesAsync(cancellationToken);
            await inventory.RebuildItemAsync(oldItemId, cancellationToken);
            if (oldItemId != updatedRequest.ItemId) await inventory.RebuildItemAsync(updatedRequest.ItemId, cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            var first = oldDate.Year * 12 + oldDate.Month <= updatedRequest.Date.Year * 12 + updatedRequest.Date.Month ? oldDate : updatedRequest.Date;
            await billing.RecalculateForwardAsync(first.Month, first.Year, cancellationToken);
            return ToDto(row, false);
        }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpDelete("transactions/{id:guid}")]
    [HttpDelete("movements/{id:guid}")]
    [RequirePermission(MenuKeys.AdminInventory, PermissionActions.Delete)]
    public async Task<IActionResult> DeleteTransaction(Guid id, CancellationToken cancellationToken)
    {
        var row = await db.StockTransactions.Include(x => x.Item).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null) return NotFound();
        var adminWing = await currentUser.GetAdminWingAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(adminWing) && row.Item?.Wing != adminWing) return Forbid();
        if (row.IsPreBatchLegacy)
        {
            return Conflict(new
            {
                message = "This movement predates batch tracking and is locked so historical bills stay unchanged.",
            });
        }
        if (row.TransactionType == "in")
        {
            var consumers = await db.StockTransactions.AsNoTracking()
                .CountAsync(x => x.SourceBatchId == id, cancellationToken);
            if (consumers > 0)
            {
                return Conflict(new
                {
                    message = $"This batch has {consumers} stock-out(s) drawn from it. Delete those first.",
                });
            }
        }
        try
        {
            var itemId = row.ItemId;
            var date = row.Date;
            db.StockTransactions.Remove(row);
            await db.SaveChangesAsync(cancellationToken);
            await inventory.RebuildItemAsync(itemId, cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            await billing.RecalculateForwardAsync(date.Month, date.Year, cancellationToken);
            return NoContent();
        }
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
            if (request.TransactionType == "out")
            {
                if (string.IsNullOrWhiteSpace(request.MealPeriod) || !MealPeriods.Contains(request.MealPeriod))
                    return "Meal period is required for stock-out.";

                // A stored stock-out is costed at one batch's rate, so the batch must be named
                // and must actually hold the quantity. Nothing is averaged across batches.
                if (!request.SourceBatchId.HasValue)
                    return "Select which batch this stock-out is taken from.";

                var batch = await db.StockTransactions.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == request.SourceBatchId, cancellationToken);
                if (batch is null || batch.TransactionType != "in" || batch.ItemId != request.ItemId)
                    return "The selected batch does not belong to this item.";
                if (batch.IsPreBatchLegacy)
                    return "The selected batch predates batch tracking and cannot be drawn from.";
                if (request.Date < batch.Date)
                    return $"This batch was only received on {batch.Date:yyyy-MM-dd}; the stock-out cannot be dated earlier.";
            }
        }
        return null;
    }

    /// <summary>
    /// Open batches for every stored item in the wing, so the inventory list can show each
    /// item's lots without a request per item. Labels are positional within their own item.
    /// </summary>
    [HttpGet("batches")]
    [RequirePermission(MenuKeys.AdminInventory, PermissionActions.View)]
    public async Task<IReadOnlyList<InventoryBatchDto>> GetAllBatches(
        [FromQuery] string? wing = null,
        CancellationToken cancellationToken = default)
    {
        var selectedWing = await currentUser.GetManagedWingAsync(wing, cancellationToken);
        var rows = await db.StockTransactions.AsNoTracking()
            .Include(x => x.Item)
            .Where(x => x.Item != null
                && x.Item.Wing == selectedWing
                && x.Item.IsStored
                && !x.Item.IsDeleted
                && x.TransactionType == "in"
                && !x.IsPreBatchLegacy
                && x.RemainingQuantity > 0m)
            .OrderBy(x => x.Date)
            .ThenBy(x => x.CreatedAtUtc)
            .ThenBy(x => x.Id)
            .ToListAsync(cancellationToken);

        return rows
            .GroupBy(x => x.ItemId)
            .SelectMany(group => group.Select((batch, index) => new InventoryBatchDto(
                batch.Id,
                batch.ItemId,
                batch.Item!.Item,
                batch.Item.Unit,
                $"{batch.Item.Item}-{index + 1}",
                index + 1,
                batch.Date,
                batch.Quantity,
                batch.RemainingQuantity,
                batch.Rate,
                batch.RemainingQuantity * batch.Rate,
                batch.IsOpeningBatch,
                batch.Note)))
            .ToList();
    }

    /// <summary>
    /// Open batches for an item, oldest first — the source list for the stock-out picker.
    /// Labels are positional and renumber as batches are used up, so the caller must send back
    /// the batch id, never the label.
    /// </summary>
    [HttpGet("items/{id:guid}/batches")]
    [RequirePermission(MenuKeys.AdminInventory, PermissionActions.View)]
    public async Task<ActionResult<IReadOnlyList<InventoryBatchDto>>> GetBatches(
        Guid id,
        [FromQuery] bool includeEmpty = false,
        [FromQuery] string? wing = null,
        CancellationToken cancellationToken = default)
    {
        var selectedWing = await currentUser.GetManagedWingAsync(wing, cancellationToken);
        var item = await db.InventoryItems.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null) return NotFound(new { message = "Inventory item was not found." });
        if (item.Wing != selectedWing) return Forbid();
        if (!item.IsStored) return Ok(Array.Empty<InventoryBatchDto>());

        var batches = await db.StockTransactions.AsNoTracking()
            .Where(x => x.ItemId == id
                && x.TransactionType == "in"
                && !x.IsPreBatchLegacy
                && (includeEmpty || x.RemainingQuantity > 0m))
            .OrderBy(x => x.Date)
            .ThenBy(x => x.CreatedAtUtc)
            .ThenBy(x => x.Id)
            .ToListAsync(cancellationToken);

        return batches.Select((batch, index) => new InventoryBatchDto(
            batch.Id,
            item.Id,
            item.Item,
            item.Unit,
            $"{item.Item}-{index + 1}",
            index + 1,
            batch.Date,
            batch.Quantity,
            batch.RemainingQuantity,
            batch.Rate,
            batch.RemainingQuantity * batch.Rate,
            batch.IsOpeningBatch,
            batch.Note)).ToList();
    }

    private static InventoryItemFinancialDto ToDto(InventoryItem x)
        => new(x.Id, x.Item, x.Wing, x.Category, x.Unit, x.LinkedOptionId, x.CurrentStockQuantity, x.CurrentWac, x.CurrentStockQuantity * x.CurrentWac, x.IsDeleted, x.IsStored);

    private static StockTransactionDto ToDto(StockTransaction x, bool locked)
        => new(x.Id, x.ItemId, x.Item?.Item ?? string.Empty, x.Item?.Wing ?? "Male", x.Item?.Category ?? string.Empty,
            x.TransactionType, x.Date, x.MealPeriod, x.Quantity, x.Rate, x.WacSnapshot,
            x.TotalCost, x.Note, locked, x.ParticipantCount,
            x.SourceBatchId,
            // Dated rather than positional: a ledger row is historical, and batch positions
            // renumber as batches are used up, so "Rice-2" would drift over time.
            x.SourceBatch is null ? null : $"Batch of {x.SourceBatch.Date:dd MMM yyyy}",
            x.IsPreBatchLegacy);
}
