using HallBackend.Application.Services;
using HallBackend.Domain.Entities;

namespace HallBackend.Tests;

public sealed class MealResolutionGuestTests
{
    [Fact]
    public void GuestParticipants_ForCommonItem_IncludesAllWingGuests()
    {
        var studentA = new Student { Id = Guid.NewGuid(), Gender = "Male", JoinDate = new DateOnly(2026, 1, 1), Status = MealResolutionContext.BillableStatus };
        var studentB = new Student { Id = Guid.NewGuid(), Gender = "Male", JoinDate = new DateOnly(2026, 1, 1), Status = MealResolutionContext.BillableStatus };

        var date = new DateOnly(2026, 9, 4);
        var guestMeals = new Dictionary<(string, string, DateOnly), List<(Guid, int)>>
        {
            [("male", "lunch", date)] = [(studentA.Id, 2), (studentB.Id, 1)]
        };

        var context = new MealResolutionContext(
            [studentA, studentB],
            [],
            [],
            [],
            null,
            null,
            guestMeals);

        var commonItem = new InventoryItem
        {
            Id = Guid.NewGuid(),
            Wing = "Male",
            Category = "Common",
            Item = "Rice"
        };

        var guests = context.GuestParticipants(commonItem, "lunch", date);
        Assert.Equal(2, guests.Count);
        Assert.Equal(3, context.CountGuestParticipants(commonItem, "lunch", date));
    }

    [Fact]
    public void GuestParticipants_ForOptionItem_OnlyIncludesGuestsOfStudentsWhoSelectedOption()
    {
        var studentChicken = new Student { Id = Guid.NewGuid(), Gender = "Male", JoinDate = new DateOnly(2026, 1, 1), Status = MealResolutionContext.BillableStatus };
        var studentBeef = new Student { Id = Guid.NewGuid(), Gender = "Male", JoinDate = new DateOnly(2026, 1, 1), Status = MealResolutionContext.BillableStatus };

        var chickenId = Guid.NewGuid();
        var beefId = Guid.NewGuid();
        var date = new DateOnly(2026, 9, 4); // Friday

        var preferences = new Dictionary<(Guid, string, DayOfWeek), List<MealPreferenceHistory>>
        {
            [(studentChicken.Id, "lunch", DayOfWeek.Friday)] = [new() { OptionItemId = chickenId, EffectiveFrom = new DateOnly(2026, 1, 1) }],
            [(studentBeef.Id, "lunch", DayOfWeek.Friday)] = [new() { OptionItemId = beefId, EffectiveFrom = new DateOnly(2026, 1, 1) }]
        };

        var menuOptions = new Dictionary<(string Wing, DayOfWeek DayOfWeek, string MealPeriod), MealResolutionContext.MenuOptionConfig>
        {
            [("Male", DayOfWeek.Friday, "lunch")] = new([chickenId, beefId], beefId)
        };

        var guestMeals = new Dictionary<(string, string, DateOnly), List<(Guid, int)>>
        {
            [("male", "lunch", date)] = [(studentChicken.Id, 2), (studentBeef.Id, 3)]
        };

        var context = new MealResolutionContext(
            [studentChicken, studentBeef],
            [],
            [],
            preferences,
            menuOptions,
            null,
            guestMeals);

        var chickenItem = new InventoryItem
        {
            Id = chickenId,
            Wing = "Male",
            Category = "Options",
            Item = "Chicken Cock"
        };

        var beefItem = new InventoryItem
        {
            Id = beefId,
            Wing = "Male",
            Category = "Options",
            Item = "Beef"
        };

        var chickenGuests = context.GuestParticipants(chickenItem, "lunch", date);
        Assert.Single(chickenGuests);
        Assert.Equal(studentChicken.Id, chickenGuests[0].StudentId);
        Assert.Equal(2, chickenGuests[0].GuestCount);

        var beefGuests = context.GuestParticipants(beefItem, "lunch", date);
        Assert.Single(beefGuests);
        Assert.Equal(studentBeef.Id, beefGuests[0].StudentId);
        Assert.Equal(3, beefGuests[0].GuestCount);
    }

    [Theory]
    [InlineData(3, 2)]
    [InlineData(2, 1)]
    [InlineData(1, 0)]
    public void GuestTransitions_CorrectlyUpdatesHeadcountAndOptions(int initialCount, int updatedCount)
    {
        var student = new Student { Id = Guid.NewGuid(), Gender = "Male", JoinDate = new DateOnly(2026, 1, 1), Status = MealResolutionContext.BillableStatus };
        var beefId = Guid.NewGuid();
        var date = new DateOnly(2026, 9, 4);

        var preferences = new Dictionary<(Guid, string, DayOfWeek), List<MealPreferenceHistory>>
        {
            [(student.Id, "lunch", DayOfWeek.Friday)] = [new() { OptionItemId = beefId, EffectiveFrom = new DateOnly(2026, 1, 1) }]
        };

        var menuOptions = new Dictionary<(string Wing, DayOfWeek DayOfWeek, string MealPeriod), MealResolutionContext.MenuOptionConfig>
        {
            [("Male", DayOfWeek.Friday, "lunch")] = new([beefId], beefId)
        };

        var commonItem = new InventoryItem { Id = Guid.NewGuid(), Wing = "Male", Category = "Common", Item = "Rice" };
        var beefItem = new InventoryItem { Id = beefId, Wing = "Male", Category = "Options", Item = "Beef" };

        // Before update: initialCount
        var initialGuestMeals = new Dictionary<(string, string, DateOnly), List<(Guid, int)>>
        {
            [("male", "lunch", date)] = [(student.Id, initialCount)]
        };

        var initialContext = new MealResolutionContext(
            [student], [], [], preferences, menuOptions, null, initialGuestMeals);

        Assert.Equal(initialCount, initialContext.CountGuestParticipants(commonItem, "lunch", date));
        Assert.Equal(initialCount, initialContext.CountGuestParticipants(beefItem, "lunch", date));

        // After update: updatedCount
        var updatedGuestMeals = new Dictionary<(string, string, DateOnly), List<(Guid, int)>>();
        if (updatedCount > 0)
        {
            updatedGuestMeals[("male", "lunch", date)] = [(student.Id, updatedCount)];
        }

        var updatedContext = new MealResolutionContext(
            [student], [], [], preferences, menuOptions, null, updatedGuestMeals);

        Assert.Equal(updatedCount, updatedContext.CountGuestParticipants(commonItem, "lunch", date));
        Assert.Equal(updatedCount, updatedContext.CountGuestParticipants(beefItem, "lunch", date));

        if (updatedCount == 0)
        {
            Assert.Empty(updatedContext.GuestParticipants(commonItem, "lunch", date));
            Assert.Empty(updatedContext.GuestParticipants(beefItem, "lunch", date));
        }
        else
        {
            var beefGuests = updatedContext.GuestParticipants(beefItem, "lunch", date);
            Assert.Single(beefGuests);
            Assert.Equal(updatedCount, beefGuests[0].GuestCount);
        }
    }
}
