namespace HallBackend.Application.Services;

public static class FinancialMath
{
    public static decimal WeightedAverageCost(
        decimal previousQuantity,
        decimal previousWac,
        decimal incomingQuantity,
        decimal incomingRate)
    {
        var quantity = previousQuantity + incomingQuantity;
        return quantity == 0m
            ? 0m
            : ((previousQuantity * previousWac) + (incomingQuantity * incomingRate)) / quantity;
    }

    public static decimal NonNegativeDue(decimal totalBill, decimal approvedPaid)
        => totalBill - approvedPaid < 0m ? 0m : totalBill - approvedPaid;

    /// <param name="adjustedDue">
    /// A manual due override entered by an admin. It states outright what the student owes, so it
    /// wins over the calculated figure — including when that figure is already 0, which is exactly
    /// the case an override exists to correct. Only the calculated path clamps an overpayment.
    /// </param>
    public static decimal CalculateDue(
        decimal totalBill,
        decimal approvedPaid,
        decimal? adjustedDue = null)
    {
        if (adjustedDue.HasValue)
        {
            return adjustedDue.Value < 0m ? 0m : adjustedDue.Value;
        }

        return NonNegativeDue(totalBill, approvedPaid);
    }

    public static decimal ProportionalCost(decimal totalCost, int filteredCount, int totalCount)
        => totalCount == 0 ? 0m : totalCost * filteredCount / totalCount;

    public static decimal PerHead(decimal totalCost, int headcount)
        => headcount == 0 ? 0m : totalCost / headcount;

    /// <summary>One student's frozen share of a pooled bill.</summary>
    public readonly record struct ConsumptionAllocation(Guid StudentId, int Count, decimal Amount);

    /// <summary>
    /// Splits <paramref name="totalAmount"/> across students in proportion to how much each
    /// consumed, so the sum of the parts equals the whole exactly.
    ///
    /// Plain <c>count × rate</c> does not reconcile: ৳100 over three equal shares rounds to
    /// ৳33.33 each and loses a paisa. So each student first takes the floor of their exact share
    /// at 2dp, and the leftover paisa are handed out one each by largest fractional remainder —
    /// the students the rounding shortchanged most are made whole first. Ties break on StudentId
    /// so the same inputs always produce the same allocation.
    ///
    /// Returns every student passed in, including those with a zero count, so callers can show a
    /// complete breakdown. Never divides by zero: a total count of zero yields all-zero amounts.
    /// </summary>
    public static IReadOnlyList<ConsumptionAllocation> AllocateByConsumption(
        decimal totalAmount,
        IReadOnlyList<(Guid StudentId, int Count)> consumption)
    {
        if (consumption.Count == 0) return [];

        var totalCount = consumption.Sum(x => (long)x.Count);

        // No consumption, or nothing to distribute: everyone gets zero and we never divide.
        if (totalCount <= 0 || totalAmount == 0m)
        {
            return consumption.Select(x => new ConsumptionAllocation(x.StudentId, x.Count, 0m)).ToList();
        }

        var exactRate = totalAmount / totalCount;

        var working = consumption.Select(x =>
        {
            var exact = x.Count * exactRate;
            var floored = Math.Floor(exact * 100m) / 100m;
            return (x.StudentId, x.Count, Floored: floored, Remainder: exact - floored);
        }).ToList();

        // Whole paisa still unallocated after flooring everyone.
        var distributed = working.Sum(x => x.Floored);
        var leftoverPaisa = (int)Math.Round((totalAmount - distributed) * 100m, MidpointRounding.AwayFromZero);

        var order = working
            .Select((row, index) => (row, index))
            .OrderByDescending(x => x.row.Remainder)
            .ThenBy(x => x.row.StudentId)
            .Select(x => x.index)
            .ToList();

        var bonus = new decimal[working.Count];
        for (var i = 0; i < leftoverPaisa && i < order.Count; i++)
        {
            bonus[order[i]] = 0.01m;
        }

        return working
            .Select((row, index) => new ConsumptionAllocation(row.StudentId, row.Count, row.Floored + bonus[index]))
            .ToList();
    }

    public static bool IsChargeParticipant(
        string category,
        Guid itemId,
        Guid? linkedOptionId,
        bool isMealOn,
        Guid? selectedOptionId)
    {
        if (!isMealOn) return false;
        if (category == "Common") return true;
        var requiredOption = category == "Options" ? itemId : linkedOptionId;
        return requiredOption.HasValue && selectedOptionId == requiredOption;
    }
}
