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
    public void CalculateDue_RefundsTheDifferenceWhenChargesAreReducedAfterPayment()
    {
        // Paid 1000, then the month's charges were corrected down to 800. The student is 200 up,
        // and that 200 is theirs: it becomes next month's carried credit rather than being
        // written off to the hall, which is what clamping this to zero used to do.
        Assert.Equal(-200m, FinancialMath.CalculateDue(800m, 1000m));
        Assert.True(FinancialMath.IsCredit(FinancialMath.CalculateDue(800m, 1000m)));
    }

    [Fact]
    public void CalculateDue_IsWhatIsLeftAfterPayments()
    {
        Assert.Equal(250m, FinancialMath.CalculateDue(1000m, 750m));
        Assert.Equal(0m, FinancialMath.CalculateDue(1000m, 1000m));
    }

    [Fact]
    public void CalculateDue_KeepsOverpaymentAsCreditInsteadOfAbsorbingIt()
    {
        // Rounding a bKash payment up: the extra belongs to the student, so it survives as a
        // negative balance rather than being clamped away.
        Assert.Equal(-30.83m, FinancialMath.CalculateDue(269.17m, 300m));
        Assert.True(FinancialMath.IsCredit(FinancialMath.CalculateDue(269.17m, 300m)));
        Assert.False(FinancialMath.IsCredit(FinancialMath.CalculateDue(269.17m, 269.17m)));
    }

    [Fact]
    public void Credit_DrawsDownAgainstTheFollowingMonth()
    {
        // August: 269.17 charged, 300 paid -> 30.83 credit carried into September.
        var carried = FinancialMath.CalculateDue(269.17m, 300m);
        Assert.Equal(-30.83m, carried);

        // September: 400 of charges against that credit, nothing paid yet.
        var septemberTotal = 400m + carried;
        Assert.Equal(369.17m, FinancialMath.CalculateDue(septemberTotal, 0m));
    }

    [Fact]
    public void Credit_SpanningSeveralMonthsIsConsumedNotLost()
    {
        // A term paid up front: 5000 against a 269.17 month leaves 4730.83 to spend down.
        var afterAugust = FinancialMath.CalculateDue(269.17m, 5000m);
        Assert.Equal(-4730.83m, afterAugust);

        var afterSeptember = FinancialMath.CalculateDue(400m + afterAugust, 0m);
        Assert.Equal(-4330.83m, afterSeptember);
        Assert.True(FinancialMath.IsCredit(afterSeptember));
    }

    [Fact]
    public void AdjustmentToReach_ProducesTheDeltaThatLandsOnTheAdminsFigure()
    {
        // The admin types the due they want; the delta is what gets stored, so the correction can
        // be folded into the total as one more charge line.
        Assert.Equal(10.8333m, FinancialMath.AdjustmentToReach(280m, 269.1667m));
        Assert.Equal(1200m, FinancialMath.AdjustmentToReach(1200m, 0m));
        Assert.Equal(-250m, FinancialMath.AdjustmentToReach(0m, 250m));
    }

    [Fact]
    public void Adjustment_LandsOnTheTargetDueAndStaysPayable()
    {
        // A zero-charge month adjusted up to 1200: the figure the admin asked for, and unlike the
        // old absolute override it clears once the student actually pays it.
        var adjustment = FinancialMath.AdjustmentToReach(1200m, FinancialMath.CalculateDue(0m, 0m));
        Assert.Equal(1200m, FinancialMath.CalculateDue(0m + adjustment, 0m));
        Assert.Equal(0m, FinancialMath.CalculateDue(0m + adjustment, 1200m));
        Assert.Equal(200m, FinancialMath.CalculateDue(0m + adjustment, 1000m));
    }

    [Fact]
    public void Adjustment_NeverPushesDueAboveTheTotalBill()
    {
        // The student's bill has to reconcile: an adjustment is inside the total, so what they owe
        // can never exceed what they were charged.
        var total = 269.1667m + FinancialMath.AdjustmentToReach(280m, 269.1667m);
        Assert.Equal(280m, total);
        Assert.True(FinancialMath.CalculateDue(total, 0m) <= total);
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

    [Fact]
    public void MealResolutionContext_FindSelectedOption_ResolvesExplicitAndDefaultFallback()
    {
        var student1Id = Guid.NewGuid(); // explicit choice: Egg
        var student2Id = Guid.NewGuid(); // no choice: should fallback to Fish Rui (default)
        var student3Id = Guid.NewGuid(); // obsolete choice: should fallback to Fish Rui (default)
        var date = new DateOnly(2026, 9, 3); // Thursday

        var fishRui = Guid.NewGuid();
        var egg = Guid.NewGuid();
        var obsoleteBeef = Guid.NewGuid();

        var students = new List<HallBackend.Domain.Entities.Student>
        {
            new() { Id = student1Id, Gender = "Male", Status = MealResolutionContext.BillableStatus, JoinDate = new DateOnly(2026, 1, 1), StudentId = "S1", StudentName = "Student 1", HallName = "Male", RoomNo = "101" },
            new() { Id = student2Id, Gender = "Male", Status = MealResolutionContext.BillableStatus, JoinDate = new DateOnly(2026, 1, 1), StudentId = "S2", StudentName = "Student 2", HallName = "Male", RoomNo = "102" },
            new() { Id = student3Id, Gender = "Male", Status = MealResolutionContext.BillableStatus, JoinDate = new DateOnly(2026, 1, 1), StudentId = "S3", StudentName = "Student 3", HallName = "Male", RoomNo = "103" },
        };

        var preferences = new Dictionary<(Guid, string, DayOfWeek), List<HallBackend.Domain.Entities.MealPreferenceHistory>>
        {
            [(student1Id, "lunch", DayOfWeek.Thursday)] = new()
            {
                new() { StudentId = student1Id, MealPeriod = "lunch", DayOfWeek = DayOfWeek.Thursday, OptionItemId = egg, EffectiveFrom = new DateOnly(2026, 9, 1) }
            },
            [(student3Id, "lunch", DayOfWeek.Thursday)] = new()
            {
                new() { StudentId = student3Id, MealPeriod = "lunch", DayOfWeek = DayOfWeek.Thursday, OptionItemId = obsoleteBeef, EffectiveFrom = new DateOnly(2026, 8, 1) }
            }
        };

        var menuOptions = new Dictionary<(string Wing, DayOfWeek DayOfWeek, string MealPeriod), MealResolutionContext.MenuOptionConfig>
        {
            [("Male", DayOfWeek.Thursday, "lunch")] = new(new HashSet<Guid> { fishRui, egg }, fishRui)
        };

        var context = new MealResolutionContext(
            students,
            [],
            [],
            preferences,
            menuOptions);

        // Past or current date (cutoff passed) -> resolves explicit choice or falls back to default
        Assert.Equal(egg, context.FindSelectedOption(student1Id, "lunch", date));
        Assert.Equal(fishRui, context.FindSelectedOption(student2Id, "lunch", date));
        Assert.Equal(fishRui, context.FindSelectedOption(student3Id, "lunch", date));

        // Future date (cutoff NOT passed) -> resolves explicit choice, but does NOT assign default yet
        var futureDate = HallClock.Today.AddDays(5);
        Assert.Null(context.FindSelectedOption(student2Id, "lunch", futureDate));
    }
}

