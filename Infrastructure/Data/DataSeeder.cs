using HallBackend.Domain.Constants;
using HallBackend.Domain.Entities;
using HallBackend.Application.Services;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Infrastructure.Data;

public sealed class DataSeeder(HallDbContext db, PasswordService passwords)
{
    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        if (await db.Users.AnyAsync(cancellationToken))
        {
            // Update existing student users to not require password change
            var studentUsers = await db.Users.Where(x => x.Role == Roles.Student).ToListAsync(cancellationToken);
            if (studentUsers.Count > 0)
            {
                foreach (var user in studentUsers)
                {
                    user.MustChangePassword = false;
                }
                await db.SaveChangesAsync(cancellationToken);
            }
            return;
        }

        // Admin user only - students will be added dynamically through the admin panel
        var admin = User("Admin Officer", "admin", "admin@mist.ac.bd", Roles.Admin, "Hall Administrator");
        admin.PasswordHash = passwords.Hash("Admin@123");

        db.Users.Add(admin);

        var mealTypes = new[]
        {
            new MealType { Code = "breakfast", Label = "Breakfast", SortOrder = 1, StartsAt = new TimeOnly(7, 30), EndsAt = new TimeOnly(9, 0) },
            new MealType { Code = "lunch", Label = "Lunch", SortOrder = 2, StartsAt = new TimeOnly(12, 30), EndsAt = new TimeOnly(14, 0) },
            new MealType { Code = "dinner", Label = "Dinner", SortOrder = 3, StartsAt = new TimeOnly(19, 30), EndsAt = new TimeOnly(21, 0) },
        };
        var days = new[]
        {
            new MealDay { Code = "sun", Label = "Sunday", SortOrder = 0 },
            new MealDay { Code = "mon", Label = "Monday", SortOrder = 1 },
            new MealDay { Code = "tue", Label = "Tuesday", SortOrder = 2 },
            new MealDay { Code = "wed", Label = "Wednesday", SortOrder = 3 },
            new MealDay { Code = "thu", Label = "Thursday", SortOrder = 4 },
            new MealDay { Code = "fri", Label = "Friday", SortOrder = 5 },
            new MealDay { Code = "sat", Label = "Saturday", SortOrder = 6 },
        };

        db.MealTypes.AddRange(mealTypes);
        db.MealDays.AddRange(days);
        db.MealSettings.Add(new MealSetting { CutoffTime = new TimeOnly(17, 0), ForecastMaxOptions = 6 });

        foreach (var day in days)
        foreach (var type in mealTypes)
        {
            db.MealConfigurations.Add(new MealConfiguration
            {
                MealDay = day,
                MealType = type,
                Items =
                [
                    new MealItem { Name = type.Code == "breakfast" ? "Ruti" : "Rice", Cost = type.Code == "breakfast" ? 14 : 22, IsOptional = false },
                    new MealItem { Name = "Dal", Cost = 10, IsOptional = false },
                    new MealItem { Name = type.Code == "dinner" ? "Chicken" : "Egg", Cost = type.Code == "dinner" ? 85 : 15, IsOptional = true },
                ],
            });
        }

        db.InventoryItems.AddRange(
            new InventoryItem { Item = "Rice", Category = "Food", Stock = 120, Threshold = 150, Status = "overdue" },
            new InventoryItem { Item = "Soybean Oil", Category = "Food", Stock = 35, Threshold = 40, Status = "pending" },
            new InventoryItem { Item = "Lentils", Category = "Food", Stock = 90, Threshold = 60, Status = "active" });

        db.AuditLogs.AddRange(
            new AuditLog { Actor = "Admin User", Action = "System initialized", Module = "System", Date = DateOnly.FromDateTime(DateTime.Today) });

        await db.SaveChangesAsync(cancellationToken);
    }

    private static AppUser User(string fullName, string userName, string email, string role, string designation)
    {
        return new AppUser
        {
            FullName = fullName,
            UserName = userName,
            NormalizedUserName = userName.Trim().ToUpperInvariant(),
            Email = email,
            NormalizedEmail = email.Trim().ToUpperInvariant(),
            Role = role,
            Designation = designation,
        };
    }
}
