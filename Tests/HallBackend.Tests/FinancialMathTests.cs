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

    [Fact]
    public void PerHead_DividesCostByHeadcountAndHandlesZero()
    {
        Assert.Equal(256.25m, FinancialMath.PerHead(2050m, 8));
        Assert.Equal(0m, FinancialMath.PerHead(2050m, 0));
    }

    // ── Others Bill allocation ───────────────────────────────────────────────

    private static IReadOnlyList<(Guid, int)> Counts(params int[] counts)
        => counts.Select((c, i) => (GuidFor(i), c)).ToList();

    /// <summary>Deterministic ids so remainder tie-breaking is reproducible in assertions.</summary>
    private static Guid GuidFor(int index) => new($"00000000-0000-0000-0000-{index:D12}");

    [Fact]
    public void AllocateByConsumption_MatchesTheWorkedExample()
    {
        // 3000 over a total count of 120 => 25.00 per unit; a student with 10 owes 250.
        var counts = Counts(10, 15, 8, 87);
        var result = FinancialMath.AllocateByConsumption(3000m, counts);

        Assert.Equal(250m, result[0].Amount);
        Assert.Equal(375m, result[1].Amount);
        Assert.Equal(200m, result[2].Amount);
        Assert.Equal(3000m, result.Sum(x => x.Amount));
    }

    [Fact]
    public void AllocateByConsumption_ReconcilesToTheTotalWhenTheRateDoesNotDivideEvenly()
    {
        // 1000 / 3 = 333.333...; flooring alone loses a paisa, so the remainder pass must add it.
        var result = FinancialMath.AllocateByConsumption(1000m, Counts(1, 1, 1));

        Assert.Equal(1000m, result.Sum(x => x.Amount));
        Assert.Equal([333.34m, 333.33m, 333.33m], result.Select(x => x.Amount).ToArray());
    }

    [Fact]
    public void AllocateByConsumption_NeverDividesByZeroWhenNobodyConsumed()
    {
        var result = FinancialMath.AllocateByConsumption(3000m, Counts(0, 0, 0));

        Assert.All(result, x => Assert.Equal(0m, x.Amount));
        Assert.Equal(0m, result.Sum(x => x.Amount));
    }

    [Fact]
    public void AllocateByConsumption_ChargesNothingToStudentsWithNoConsumption()
    {
        var result = FinancialMath.AllocateByConsumption(500m, Counts(5, 0, 5));

        Assert.Equal(250m, result[0].Amount);
        Assert.Equal(0m, result[1].Amount);
        Assert.Equal(250m, result[2].Amount);
        Assert.Equal(500m, result.Sum(x => x.Amount));
    }

    [Fact]
    public void AllocateByConsumption_GivesTheWholeBillToASingleConsumer()
    {
        var result = FinancialMath.AllocateByConsumption(3000m, Counts(7));
        Assert.Equal(3000m, result[0].Amount);
    }

    [Fact]
    public void AllocateByConsumption_HandlesEmptyRosterAndZeroAmount()
    {
        Assert.Empty(FinancialMath.AllocateByConsumption(3000m, []));
        Assert.All(FinancialMath.AllocateByConsumption(0m, Counts(3, 4)), x => Assert.Equal(0m, x.Amount));
    }

    [Theory]
    [InlineData(100, 3)]
    [InlineData(3000, 120)]
    [InlineData(1, 7)]
    [InlineData(999.99, 13)]
    [InlineData(1234.56, 97)]
    public void AllocateByConsumption_AlwaysSumsBackToTheAdminEnteredTotal(decimal total, int students)
    {
        // Uneven counts so remainders are spread unpredictably across the roster.
        var counts = Counts(Enumerable.Range(1, students).Select(i => i % 7 + 1).ToArray());
        var result = FinancialMath.AllocateByConsumption(total, counts);

        Assert.Equal(total, result.Sum(x => x.Amount));
        Assert.All(result, x => Assert.True(x.Amount >= 0m));
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
