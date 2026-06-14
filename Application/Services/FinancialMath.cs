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

    public static decimal CalculateDue(
        decimal totalBill,
        decimal approvedPaid,
        decimal? adjustedDue = null)
    {
        var calculatedDue = NonNegativeDue(totalBill, approvedPaid);
        if (calculatedDue == 0m)
        {
            return 0m;
        }

        return adjustedDue ?? calculatedDue;
    }

    public static decimal ProportionalCost(decimal totalCost, int filteredCount, int totalCount)
        => totalCount == 0 ? 0m : totalCost * filteredCount / totalCount;

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
