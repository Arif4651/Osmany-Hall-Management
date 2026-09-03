using HallBackend.Application.Services;
using HallBackend.Domain.Entities;

namespace HallBackend.Tests;

public sealed class BillingGuestMealTests
{
    [Fact]
    public void GuestMealCost_MatchesChosenOptionOnly_AndMatchesBreakdown()
    {
        var studentA = new Student { Id = Guid.NewGuid(), Gender = "Male", JoinDate = new DateOnly(2026, 1, 1), Status = MealResolutionContext.BillableStatus };
        var studentB = new Student { Id = Guid.NewGuid(), Gender = "Male", JoinDate = new DateOnly(2026, 1, 1), Status = MealResolutionContext.BillableStatus };

        var beefId = Guid.NewGuid();
        var chickenId = Guid.NewGuid();
        var date = new DateOnly(2026, 9, 1); // Tuesday

        var preferences = new Dictionary<(Guid, string, DayOfWeek), List<MealPreferenceHistory>>
        {
            [(studentA.Id, "lunch", DayOfWeek.Tuesday)] = [new() { OptionItemId = beefId, EffectiveFrom = new DateOnly(2026, 1, 1) }],
            [(studentB.Id, "lunch", DayOfWeek.Tuesday)] = [new() { OptionItemId = chickenId, EffectiveFrom = new DateOnly(2026, 1, 1) }]
        };

        var menuOptions = new Dictionary<(string Wing, DayOfWeek DayOfWeek, string MealPeriod), MealResolutionContext.MenuOptionConfig>
        {
            [("Male", DayOfWeek.Tuesday, "lunch")] = new([beefId, chickenId], beefId)
        };

        // Student A has 1 guest
        var guestMeals = new Dictionary<(string, string, DateOnly), List<(Guid, int)>>
        {
            [("male", "lunch", date)] = [(studentA.Id, 1)]
        };

        var statuses = new Dictionary<(Guid, string), List<MealStatusHistory>>
        {
            [(studentA.Id, "lunch")] = [new() { StudentId = studentA.Id, MealPeriod = "lunch", IsOn = true, EffectiveFrom = new DateOnly(2026, 1, 1) }],
            [(studentB.Id, "lunch")] = [new() { StudentId = studentB.Id, MealPeriod = "lunch", IsOn = true, EffectiveFrom = new DateOnly(2026, 1, 1) }]
        };

        var context = new MealResolutionContext(
            [studentA, studentB],
            [],
            statuses,
            preferences,
            menuOptions,
            null,
            guestMeals);

        var riceItem = new InventoryItem { Id = Guid.NewGuid(), Wing = "Male", Category = "Common", Item = "Rice" };
        var beefItem = new InventoryItem { Id = beefId, Wing = "Male", Category = "Options", Item = "Beef" };
        var chickenItem = new InventoryItem { Id = chickenId, Wing = "Male", Category = "Options", Item = "Chicken" };

        var transactions = new List<StockTransaction>
        {
            new() { Item = riceItem, MealPeriod = "lunch", Date = date, TotalCost = 150m }, // Common: 2 students + 1 guest = 3 -> share = 50
            new() { Item = beefItem, MealPeriod = "lunch", Date = date, TotalCost = 120m }, // Beef: 1 student (A) + 1 guest (A) = 2 -> share = 60
            new() { Item = chickenItem, MealPeriod = "lunch", Date = date, TotalCost = 80m } // Chicken: 1 student (B) + 0 guest = 1 -> share = 80
        };

        // Calculate guestBill as in RecalculateMonthAsync
        var guestBill = new Dictionary<Guid, decimal> { [studentA.Id] = 0m, [studentB.Id] = 0m };
        var monthly = new Dictionary<Guid, decimal> { [studentA.Id] = 0m, [studentB.Id] = 0m };

        foreach (var tx in transactions)
        {
            var studentParticipants = context.Participants(tx.Item, tx.MealPeriod, tx.Date, null);
            var guestParticipants = context.GuestParticipants(tx.Item, tx.MealPeriod, tx.Date);
            var totalCount = studentParticipants.Count + guestParticipants.Sum(x => x.GuestCount);

            var share = tx.TotalCost / totalCount;
            foreach (var p in studentParticipants) monthly[p.Id] += share;
            foreach (var g in guestParticipants) guestBill[g.StudentId] += share * g.GuestCount;
        }

        // Student A:
        // Own meal: Rice (50) + Beef (60) = 110
        // Guest meal: Rice (50) + Beef (60) = 110. (Chicken is NOT charged to Student A's guest!)
        Assert.Equal(110m, monthly[studentA.Id]);
        Assert.Equal(110m, guestBill[studentA.Id]);

        // Student B:
        // Own meal: Rice (50) + Chicken (80) = 130
        // Guest meal: 0
        Assert.Equal(130m, monthly[studentB.Id]);
        Assert.Equal(0m, guestBill[studentB.Id]);
    }
}
