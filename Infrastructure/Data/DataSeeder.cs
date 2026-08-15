using HallBackend.Domain.Constants;
using HallBackend.Domain.Entities;
using HallBackend.Application.Services;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Infrastructure.Data;

public sealed class DataSeeder(
    HallDbContext db,
    PasswordService passwords,
    IConfiguration configuration,
    IHostEnvironment environment)
{
    /// <summary>
    /// The seeded admin's password: from <c>Seed:&lt;Key&gt;Password</c> configuration (an
    /// environment variable in production) when set, otherwise a fixed development-only default.
    /// Outside Development, a missing value fails the seed loudly rather than falling back to a
    /// value anyone can read in this source file.
    /// </summary>
    private string SeedPassword(string key, string developmentDefault)
    {
        var configured = configuration[$"Seed:{key}Password"];
        if (!string.IsNullOrWhiteSpace(configured)) return configured;

        if (!environment.IsDevelopment())
        {
            throw new InvalidOperationException(
                $"Seed:{key}Password must be configured before the first run outside Development.");
        }

        return developmentDefault;
    }

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        if (await db.Users.AnyAsync(cancellationToken))
        {
            var legacyAdmins = await db.Users.Where(x => x.Role == Roles.Admin).ToListAsync(cancellationToken);
            foreach (var legacyAdmin in legacyAdmins)
            {
                legacyAdmin.Role = Roles.MaleWingAdmin;
                legacyAdmin.Wing = "Male";
                legacyAdmin.Designation = "Male Wing Administrator";
            }
            if (!await db.PaymentCategories.AnyAsync(cancellationToken))
            {
                db.PaymentCategories.AddRange(
                    new PaymentCategory { Name = "bKash" },
                    new PaymentCategory { Name = "Bank Transfer" });
            }
            await db.SaveChangesAsync(cancellationToken);

            // Repairs accounts left behind by status changes that updated only the student row:
            // a reactivated student whose account is still disabled cannot sign in at all, and a
            // deactivated one whose account is still enabled can sign in when they should not.
            // The student row is the authority — it is what the admin screens actually edit.
            var desyncedAccounts = await db.Users
                .Where(x => x.Role == Roles.Student
                    && x.Student != null
                    && x.IsActive != x.Student.LoginAccessEnabled)
                .Include(x => x.Student)
                .ToListAsync(cancellationToken);
            if (desyncedAccounts.Count > 0)
            {
                foreach (var user in desyncedAccounts)
                {
                    user.IsActive = user.Student!.LoginAccessEnabled;
                }
                await db.SaveChangesAsync(cancellationToken);
            }
            var inventoryItems = await db.InventoryItems.ToListAsync(cancellationToken);
            if (inventoryItems.Count > 0)
            {
                var preferredFemaleCreatorId = await db.Users.AsNoTracking()
                    .Where(x => x.Role == Roles.FemaleWingAdmin)
                    .Select(x => (Guid?)x.Id)
                    .FirstOrDefaultAsync(cancellationToken)
                    ?? await db.Users.AsNoTracking()
                        .Where(x => x.Role == Roles.MaleWingAdmin || x.Role == Roles.SuperAdmin)
                        .Select(x => (Guid?)x.Id)
                        .FirstOrDefaultAsync(cancellationToken)
                    ?? Guid.Empty;
                foreach (var item in inventoryItems)
                {
                    if (string.IsNullOrWhiteSpace(item.Wing))
                    {
                        item.Wing = "Male";
                    }
                    if (string.IsNullOrWhiteSpace(item.Unit))
                    {
                        item.Unit = item.Item.Contains("Oil", StringComparison.OrdinalIgnoreCase) ? "L" : "kg";
                    }

                    if (item.AveragePrice == 0 && item.Stock > 0)
                    {
                        item.AveragePrice = item.Item switch
                        {
                            var name when name.Contains("Rice", StringComparison.OrdinalIgnoreCase) => 62,
                            var name when name.Contains("Oil", StringComparison.OrdinalIgnoreCase) => 180,
                            var name when name.Contains("Lentils", StringComparison.OrdinalIgnoreCase) => 110,
                            _ => item.AveragePrice,
                        };
                    }

                    item.TotalStockValue = item.Stock * item.AveragePrice;
                    item.CurrentStockQuantity = item.Stock;
                    item.CurrentWac = item.AveragePrice;
                    if (item.Category is not ("Common" or "Options" or "Others")) item.Category = "Common";
                    item.Status = item.Stock <= item.Threshold ? "low-stock" : "active";
                }
                await db.SaveChangesAsync(cancellationToken);

                if (!inventoryItems.Any(x => x.Wing == "Female"))
                {
                    var maleItems = inventoryItems
                        .Where(x => x.Wing == "Male" && !x.IsDeleted)
                        .OrderBy(x => x.Category)
                        .ThenBy(x => x.Item)
                        .ToList();
                    var clonedBySourceId = new Dictionary<Guid, InventoryItem>();

                    foreach (var source in maleItems.Where(x => x.Category != "Others"))
                    {
                        var clone = new InventoryItem
                        {
                            Item = source.Item,
                            Wing = "Female",
                            Category = source.Category,
                            Unit = source.Unit,
                            IsStored = source.IsStored,
                            Threshold = source.Threshold,
                            AveragePrice = source.AveragePrice,
                            CurrentWac = source.CurrentWac,
                            CurrentStockQuantity = 0m,
                            Stock = 0m,
                            TotalStockValue = 0m,
                            Status = "active",
                            CreatedById = preferredFemaleCreatorId,
                        };
                        db.InventoryItems.Add(clone);
                        clonedBySourceId[source.Id] = clone;
                    }

                    await db.SaveChangesAsync(cancellationToken);

                    foreach (var source in maleItems.Where(x => x.Category == "Others"))
                    {
                        var clone = new InventoryItem
                        {
                            Item = source.Item,
                            Wing = "Female",
                            Category = source.Category,
                            Unit = source.Unit,
                            IsStored = source.IsStored,
                            Threshold = source.Threshold,
                            AveragePrice = source.AveragePrice,
                            CurrentWac = source.CurrentWac,
                            CurrentStockQuantity = 0m,
                            Stock = 0m,
                            TotalStockValue = 0m,
                            LinkedOptionId = source.LinkedOptionId.HasValue && clonedBySourceId.ContainsKey(source.LinkedOptionId.Value)
                                ? clonedBySourceId[source.LinkedOptionId.Value].Id
                                : null,
                            Status = "active",
                            CreatedById = preferredFemaleCreatorId,
                        };
                        db.InventoryItems.Add(clone);
                        clonedBySourceId[source.Id] = clone;
                    }

                    await db.SaveChangesAsync(cancellationToken);
                    inventoryItems = await db.InventoryItems.ToListAsync(cancellationToken);
                }

                var inventoryLookup = inventoryItems
                    .Where(x => !x.IsDeleted)
                    .GroupBy(x => $"{x.Wing}|{x.Category}|{ItemCatalogService.NormalizeName(x.Item)}")
                    .ToDictionary(x => x.Key, x => x.First());
                var mealItems = await db.MealItems
                    .Include(x => x.MealConfiguration)
                    .ToListAsync(cancellationToken);
                foreach (var mealItem in mealItems)
                {
                    if (mealItem.MealConfiguration is null) continue;
                    var category = mealItem.IsOptional ? "Options" : "Common";
                    var key = $"{mealItem.MealConfiguration.Wing}|{category}|{ItemCatalogService.NormalizeName(mealItem.Name)}";
                    if (inventoryLookup.TryGetValue(key, out var linkedItem))
                    {
                        mealItem.InventoryItemId = linkedItem.Id;
                    }
                }
                await db.SaveChangesAsync(cancellationToken);
            }
            if (!await db.MealConfigurations.AnyAsync(x => x.Wing == "Female", cancellationToken))
            {
                var maleConfigurations = await db.MealConfigurations
                    .Include(x => x.Items)
                    .Where(x => x.Wing == "Male")
                    .ToListAsync(cancellationToken);
                foreach (var configuration in maleConfigurations)
                {
                    db.MealConfigurations.Add(new MealConfiguration
                    {
                        MealDayId = configuration.MealDayId,
                        MealTypeId = configuration.MealTypeId,
                        Wing = "Female",
                        Status = configuration.Status,
                        Items = configuration.Items.Select(item => new MealItem
                        {
                            InventoryItemId = item.InventoryItemId,
                            Name = item.Name,
                            Cost = item.Cost,
                            IsOptional = item.IsOptional,
                        }).ToList(),
                    });
                }
                await db.SaveChangesAsync(cancellationToken);
            }
            return;
        }

        // Admin user only - students will be added dynamically through the admin panel
        //
        // Passwords come from Seed:*Password configuration outside Development (see
        // SeedPassword above) — never a value fixed in source, since that value would sit in the
        // repository forever. Every seeded account is forced to change its password at first
        // login regardless of where the password came from.
        var admin = User("Male Wing Administrator", "admin.male", "admin.male@mist.ac.bd", Roles.MaleWingAdmin, "Male Wing Administrator", "Male");
        admin.PasswordHash = passwords.Hash(SeedPassword("MaleWingAdmin", "male1234"));
        admin.MustChangePassword = true;
        var superAdmin = User("Super Administrator", "superadmin", "superadmin@mist.ac.bd", Roles.SuperAdmin, "Super Administrator");
        superAdmin.PasswordHash = passwords.Hash(SeedPassword("SuperAdmin", "super1234"));
        superAdmin.MustChangePassword = true;
        var femaleAdmin = User("Female Wing Administrator", "admin.female", "admin.female@mist.ac.bd", Roles.FemaleWingAdmin, "Female Wing Administrator", "Female");
        femaleAdmin.PasswordHash = passwords.Hash(SeedPassword("FemaleWingAdmin", "female1234"));
        femaleAdmin.MustChangePassword = true;

        db.Users.AddRange(admin, femaleAdmin, superAdmin);
        db.PaymentCategories.AddRange(
            new PaymentCategory { Name = "bKash" },
            new PaymentCategory { Name = "Bank Transfer" });
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
                Wing = "Male",
                Items =
                [
                    new MealItem { Name = type.Code == "breakfast" ? "Ruti" : "Rice", Cost = type.Code == "breakfast" ? 14 : 22, IsOptional = false },
                    new MealItem { Name = "Dal", Cost = 10, IsOptional = false },
                    new MealItem { Name = type.Code == "dinner" ? "Chicken" : "Egg", Cost = type.Code == "dinner" ? 85 : 15, IsOptional = true },
                ],
            });
            db.MealConfigurations.Add(new MealConfiguration
            {
                MealDay = day,
                MealType = type,
                Wing = "Female",
                Items =
                [
                    new MealItem { Name = type.Code == "breakfast" ? "Ruti" : "Rice", Cost = type.Code == "breakfast" ? 14 : 22, IsOptional = false },
                    new MealItem { Name = "Dal", Cost = 10, IsOptional = false },
                ],
            });
        }

        var rice = new InventoryItem { Item = "Rice", Wing = "Male", Category = "Common", Unit = "kg", Stock = 120, CurrentStockQuantity = 120, Threshold = 150, AveragePrice = 62, CurrentWac = 62, TotalStockValue = 7440, Status = "low-stock", CreatedBy = admin };
        var oil = new InventoryItem { Item = "Soybean Oil", Wing = "Male", Category = "Common", Unit = "L", Stock = 35, CurrentStockQuantity = 35, Threshold = 40, AveragePrice = 180, CurrentWac = 180, TotalStockValue = 6300, Status = "low-stock", CreatedBy = admin };
        var lentils = new InventoryItem { Item = "Lentils", Wing = "Male", Category = "Common", Unit = "kg", Stock = 90, CurrentStockQuantity = 90, Threshold = 60, AveragePrice = 110, CurrentWac = 110, TotalStockValue = 9900, Status = "active", CreatedBy = admin };
        var femaleRice = new InventoryItem { Item = "Rice", Wing = "Female", Category = "Common", Unit = "kg", Stock = 120, CurrentStockQuantity = 120, Threshold = 150, AveragePrice = 62, CurrentWac = 62, TotalStockValue = 7440, Status = "low-stock", CreatedBy = femaleAdmin };
        var femaleOil = new InventoryItem { Item = "Soybean Oil", Wing = "Female", Category = "Common", Unit = "L", Stock = 35, CurrentStockQuantity = 35, Threshold = 40, AveragePrice = 180, CurrentWac = 180, TotalStockValue = 6300, Status = "low-stock", CreatedBy = femaleAdmin };
        var femaleLentils = new InventoryItem { Item = "Lentils", Wing = "Female", Category = "Common", Unit = "kg", Stock = 90, CurrentStockQuantity = 90, Threshold = 60, AveragePrice = 110, CurrentWac = 110, TotalStockValue = 9900, Status = "active", CreatedBy = femaleAdmin };
        db.InventoryItems.AddRange(rice, oil, lentils, femaleRice, femaleOil, femaleLentils);
        db.StockTransactions.AddRange(
            OpeningStock(rice, 120m, 62m, admin),
            OpeningStock(oil, 35m, 180m, admin),
            OpeningStock(lentils, 90m, 110m, admin),
            OpeningStock(femaleRice, 120m, 62m, femaleAdmin),
            OpeningStock(femaleOil, 35m, 180m, femaleAdmin),
            OpeningStock(femaleLentils, 90m, 110m, femaleAdmin));

        db.AuditLogs.AddRange(
            new AuditLog { Actor = "Admin User", Action = "System initialized", Module = "System", Date = DateOnly.FromDateTime(DateTime.Today) });

        await db.SaveChangesAsync(cancellationToken);
    }

    private static AppUser User(string fullName, string userName, string email, string role, string designation, string? wing = null)
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
            Wing = wing,
        };
    }

    private static StockTransaction OpeningStock(InventoryItem item, decimal quantity, decimal rate, AppUser admin)
        => new()
        {
            Item = item,
            TransactionType = "in",
            Date = DateOnly.FromDateTime(DateTime.Today),
            Quantity = quantity,
            Rate = rate,
            WacSnapshot = rate,
            TotalCost = quantity * rate,
            Note = "Opening stock",
            CreatedBy = admin,
        };
}
