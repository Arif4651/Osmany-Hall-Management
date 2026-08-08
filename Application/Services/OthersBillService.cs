using HallBackend.Application.Dtos;
using HallBackend.Domain.Entities;
using HallBackend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Application.Services;

/// <summary>
/// Distributes a pooled monthly amount (the Tea bill, say) across students in proportion to what
/// each actually consumed.
///
/// Generation writes a <em>snapshot</em>: the total, the consumption it was divided by, the unit
/// rate, and every student's share. Bill recalculation reads those rows and never recomputes
/// them, so a student marking another tea after generation cannot silently move anybody's
/// finalized amount. The admin is shown the drift and regenerates deliberately.
/// </summary>
public sealed class OthersBillService(
    HallDbContext db,
    AdditionalMealService additionalMeals,
    BillingCalculationService billing)
{
    /// <summary>
    /// Computes a distribution without persisting anything — the admin's preview.
    /// </summary>
    public async Task<OthersBillDto> PreviewAsync(
        int month, int year, Guid itemId, string wing, decimal totalAmount, CancellationToken cancellationToken)
    {
        var item = await db.AdditionalMealItems.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == itemId, cancellationToken)
            ?? throw new DomainValidationException("Unknown item.");

        var consumption = await additionalMeals.GetMonthlyConsumptionAsync(month, year, itemId, wing, cancellationToken);
        var allocations = FinancialMath.AllocateByConsumption(totalAmount, consumption);
        var totalCount = consumption.Sum(x => x.Count);

        var names = await StudentNamesAsync(consumption.Select(x => x.StudentId), cancellationToken);

        return new OthersBillDto(
            null, month, year, itemId, item.Name, wing,
            totalAmount,
            totalCount,
            totalCount == 0 ? 0m : totalAmount / totalCount,
            null,
            IsGenerated: false,
            GeneratedAtUtc: null,
            CurrentConsumptionCount: totalCount,
            HasDrifted: false,
            Allocations: ToAllocationDtos(allocations, names));
    }

    /// <summary>
    /// Writes (or rewrites) the snapshot for one month/item/wing, then recalculates bills forward
    /// so the new amounts land on student bills.
    /// </summary>
    public async Task<OthersBillDto> GenerateAsync(
        SaveOthersBillRequest request, string wing, Guid generatedById, CancellationToken cancellationToken)
    {
        if (request.Month is < 1 or > 12) throw new DomainValidationException("Invalid month.");
        if (request.TotalAmount < 0m) throw new DomainValidationException("Total bill cannot be negative.");

        var item = await db.AdditionalMealItems.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.ItemId, cancellationToken)
            ?? throw new DomainValidationException("Unknown item.");

        var consumption = await additionalMeals.GetMonthlyConsumptionAsync(
            request.Month, request.Year, request.ItemId, wing, cancellationToken);
        var totalCount = consumption.Sum(x => x.Count);

        // Refuse rather than divide by zero or silently store an unallocatable bill.
        if (totalCount == 0)
        {
            throw new DomainValidationException(
                $"No {item.Name} consumption has been recorded for {request.Month:00}/{request.Year} in the {wing} wing, so there is nothing to distribute.");
        }

        var allocations = FinancialMath.AllocateByConsumption(request.TotalAmount, consumption);

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        var bill = await db.OthersBills
            .Include(x => x.Allocations)
            .FirstOrDefaultAsync(
                x => x.Month == request.Month && x.Year == request.Year
                    && x.ItemId == request.ItemId && x.Wing == wing,
                cancellationToken);

        if (bill is null)
        {
            bill = new OthersBill
            {
                Month = request.Month, Year = request.Year, ItemId = request.ItemId, Wing = wing,
            };
            db.OthersBills.Add(bill);
        }
        else
        {
            // Regenerating replaces the previous snapshot wholesale.
            db.OthersBillAllocations.RemoveRange(bill.Allocations);
        }

        bill.TotalAmount = request.TotalAmount;
        bill.TotalConsumptionCount = totalCount;
        bill.UnitRate = request.TotalAmount / totalCount;
        bill.Notes = request.Notes?.Trim();
        bill.GeneratedById = generatedById;
        bill.GeneratedAtUtc = DateTime.UtcNow;
        bill.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        // Students with no consumption owe nothing; storing zero rows would bloat the snapshot
        // without adding information the breakdown cannot derive.
        foreach (var allocation in allocations.Where(x => x.Count > 0))
        {
            db.OthersBillAllocations.Add(new OthersBillAllocation
            {
                OthersBillId = bill.Id,
                StudentId = allocation.StudentId,
                ConsumptionCount = allocation.Count,
                AllocatedAmount = allocation.Amount,
            });
        }

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        await billing.RecalculateForwardAsync(request.Month, request.Year, cancellationToken);

        return await GetAsync(bill.Id, cancellationToken)
            ?? throw new InvalidOperationException("Others bill vanished immediately after generation.");
    }

    public async Task<OthersBillDto?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var bill = await db.OthersBills.AsNoTracking()
            .Include(x => x.Item)
            .Include(x => x.Allocations).ThenInclude(x => x.Student)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return bill is null ? null : await ToDtoAsync(bill, cancellationToken);
    }

    public async Task<IReadOnlyList<OthersBillDto>> GetForMonthAsync(
        int month, int year, string? wing, CancellationToken cancellationToken)
    {
        var query = db.OthersBills.AsNoTracking()
            .Include(x => x.Item)
            .Include(x => x.Allocations).ThenInclude(x => x.Student)
            .Where(x => x.Month == month && x.Year == year);
        if (wing is "Male" or "Female") query = query.Where(x => x.Wing == wing);

        var bills = await query.OrderBy(x => x.Wing).ThenBy(x => x.Item!.Name).ToListAsync(cancellationToken);

        var result = new List<OthersBillDto>();
        foreach (var bill in bills) result.Add(await ToDtoAsync(bill, cancellationToken));
        return result;
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var bill = await db.OthersBills.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (bill is null) return false;

        var (month, year) = (bill.Month, bill.Year);
        db.OthersBills.Remove(bill);
        await db.SaveChangesAsync(cancellationToken);
        await billing.RecalculateForwardAsync(month, year, cancellationToken);
        return true;
    }

    /// <summary>The student's own breakdown lines for a month — one per generated item bill.</summary>
    public async Task<IReadOnlyList<StudentOthersBillLineDto>> GetForStudentAsync(
        Guid studentId, int month, int year, CancellationToken cancellationToken)
        => await db.OthersBillAllocations.AsNoTracking()
            .Include(x => x.OthersBill).ThenInclude(x => x!.Item)
            .Where(x => x.StudentId == studentId
                && x.OthersBill != null
                && x.OthersBill.Month == month
                && x.OthersBill.Year == year)
            .OrderBy(x => x.OthersBill!.Item!.Name)
            .Select(x => new StudentOthersBillLineDto(
                x.OthersBill!.ItemId,
                x.OthersBill.Item!.Name,
                x.ConsumptionCount,
                x.OthersBill.UnitRate,
                x.AllocatedAmount))
            .ToListAsync(cancellationToken);

    private async Task<OthersBillDto> ToDtoAsync(OthersBill bill, CancellationToken cancellationToken)
    {
        // Compare the frozen count against reality so the admin can see when regeneration is due.
        var current = await additionalMeals.GetMonthlyConsumptionAsync(
            bill.Month, bill.Year, bill.ItemId, bill.Wing, cancellationToken);
        var currentCount = current.Sum(x => x.Count);

        var allocations = bill.Allocations
            .OrderByDescending(x => x.ConsumptionCount)
            .ThenBy(x => x.Student?.StudentName)
            .Select(x => new OthersBillAllocationDto(
                x.StudentId,
                x.Student?.StudentName ?? string.Empty,
                x.Student?.RollNumber ?? string.Empty,
                x.ConsumptionCount,
                x.AllocatedAmount))
            .ToList();

        return new OthersBillDto(
            bill.Id, bill.Month, bill.Year, bill.ItemId, bill.Item?.Name ?? string.Empty, bill.Wing,
            bill.TotalAmount, bill.TotalConsumptionCount, bill.UnitRate, bill.Notes,
            IsGenerated: true,
            GeneratedAtUtc: bill.GeneratedAtUtc,
            CurrentConsumptionCount: currentCount,
            HasDrifted: currentCount != bill.TotalConsumptionCount,
            Allocations: allocations);
    }

    private async Task<Dictionary<Guid, (string Name, string Roll)>> StudentNamesAsync(
        IEnumerable<Guid> ids, CancellationToken cancellationToken)
    {
        var idList = ids.ToList();
        return await db.Students.AsNoTracking()
            .Where(x => idList.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => (x.StudentName, x.RollNumber), cancellationToken);
    }

    private static IReadOnlyList<OthersBillAllocationDto> ToAllocationDtos(
        IReadOnlyList<FinancialMath.ConsumptionAllocation> allocations,
        Dictionary<Guid, (string Name, string Roll)> names)
        => allocations
            .OrderByDescending(x => x.Count)
            .ThenBy(x => names.GetValueOrDefault(x.StudentId).Name)
            .Select(x => new OthersBillAllocationDto(
                x.StudentId,
                names.GetValueOrDefault(x.StudentId).Name ?? string.Empty,
                names.GetValueOrDefault(x.StudentId).Roll ?? string.Empty,
                x.Count,
                x.Amount))
            .ToList();
}
