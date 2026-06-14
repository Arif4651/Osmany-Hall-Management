using HallBackend.Domain.Entities;
using HallBackend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Application.Services;

public sealed class ItemCatalogService(HallDbContext db)
{
    public static string NormalizeName(string name)
        => string.Join(' ', name.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries))
            .ToUpperInvariant();

    public async Task<InventoryItem?> FindActiveItemAsync(
        string name,
        string category,
        string wing,
        CancellationToken cancellationToken)
    {
        var normalizedName = NormalizeName(name);
        var items = await db.InventoryItems.AsNoTracking()
            .Where(x => !x.IsDeleted && x.Category == category && x.Wing == wing)
            .ToListAsync(cancellationToken);
        return items.FirstOrDefault(x => NormalizeName(x.Item) == normalizedName);
    }

    public async Task RelinkMealItemsAsync(InventoryItem item, CancellationToken cancellationToken)
    {
        var normalizedName = NormalizeName(item.Item);
        var shouldBeOptional = item.Category == "Options";
        var unlinked = await db.MealItems
            .Include(x => x.MealConfiguration)
            .Where(x => x.InventoryItemId == null
                && x.IsOptional == shouldBeOptional
                && x.MealConfiguration != null
                && x.MealConfiguration.Wing == item.Wing)
            .ToListAsync(cancellationToken);

        foreach (var mealItem in unlinked.Where(x => NormalizeName(x.Name) == normalizedName))
        {
            mealItem.InventoryItemId = item.Id;
        }
    }
}
