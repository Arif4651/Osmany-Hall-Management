using HallBackend.Application.Services;

namespace HallBackend.Tests;

public sealed class FinancialMathTests
{
    [Fact]
    public void WeightedAverageCost_UsesExistingValueAndIncomingRate()
    {
        var result = FinancialMath.WeightedAverageCost(10m, 50m, 5m, 80m);
        Assert.Equal(60m, result);
    }

    [Fact]
    public void NonNegativeDue_ClampsOverpayment()
    {
        Assert.Equal(0m, FinancialMath.NonNegativeDue(1000m, 1200m));
        Assert.Equal(250m, FinancialMath.NonNegativeDue(1000m, 750m));
    }

    [Fact]
    public void CalculateDue_KeepsFullyPaidBillSettledAfterChargeReduction()
    {
        Assert.Equal(0m, FinancialMath.CalculateDue(800m, 1000m));
        Assert.Equal(0m, FinancialMath.CalculateDue(800m, 1000m, 500m));
    }

    [Fact]
    public void CalculateDue_StillAppliesAdjustmentWhenBillIsNotFullyPaid()
    {
        Assert.Equal(250m, FinancialMath.CalculateDue(1000m, 750m));
        Assert.Equal(100m, FinancialMath.CalculateDue(1000m, 750m, 100m));
    }

    [Fact]
    public void ChargeParticipants_FollowCommonOptionAndLinkedOtherRules()
    {
        var chicken = Guid.NewGuid();
        var fish = Guid.NewGuid();
        var masala = Guid.NewGuid();

        Assert.True(FinancialMath.IsChargeParticipant("Common", Guid.NewGuid(), null, true, null));
        Assert.False(FinancialMath.IsChargeParticipant("Common", Guid.NewGuid(), null, false, null));
        Assert.True(FinancialMath.IsChargeParticipant("Options", chicken, null, true, chicken));
        Assert.False(FinancialMath.IsChargeParticipant("Options", chicken, null, true, fish));
        Assert.True(FinancialMath.IsChargeParticipant("Others", masala, fish, true, fish));
    }

    [Fact]
    public void ProportionalCost_HandlesGenderAndZeroParticipants()
    {
        Assert.Equal(400m, FinancialMath.ProportionalCost(1000m, 20, 50));
        Assert.Equal(0m, FinancialMath.ProportionalCost(1000m, 0, 0));
    }

    [Theory]
    [InlineData(" Egg ", "egg")]
    [InlineData("Soybean   Oil", "soybean oil")]
    [InlineData("CHICKEN", "chicken")]
    public void CatalogName_Normalization_IgnoresCaseAndExtraWhitespace(string left, string right)
    {
        Assert.Equal(
            ItemCatalogService.NormalizeName(left),
            ItemCatalogService.NormalizeName(right));
    }
}
