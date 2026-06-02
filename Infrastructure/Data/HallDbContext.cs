using HallBackend.Domain.Common;
using HallBackend.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Infrastructure.Data;

public sealed class HallDbContext(DbContextOptions<HallDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Student> Students => Set<Student>();
    public DbSet<MealType> MealTypes => Set<MealType>();
    public DbSet<MealDay> MealDays => Set<MealDay>();
    public DbSet<MealConfiguration> MealConfigurations => Set<MealConfiguration>();
    public DbSet<MealItem> MealItems => Set<MealItem>();
    public DbSet<MealSetting> MealSettings => Set<MealSetting>();
    public DbSet<StudentMealPreference> StudentMealPreferences => Set<StudentMealPreference>();
    public DbSet<Bill> Bills => Set<Bill>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.ToTable("users");
            entity.HasIndex(x => x.NormalizedUserName).IsUnique();
            entity.HasIndex(x => x.NormalizedEmail);
            entity.Property(x => x.FullName).HasMaxLength(160).IsRequired();
            entity.Property(x => x.UserName).HasMaxLength(180).IsRequired();
            entity.Property(x => x.NormalizedUserName).HasMaxLength(180).IsRequired();
            entity.Property(x => x.Email).HasMaxLength(180).IsRequired();
            entity.Property(x => x.NormalizedEmail).HasMaxLength(180);
            entity.Property(x => x.Role).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Designation).HasMaxLength(120);
            entity.HasOne(x => x.Student).WithOne(x => x.User).HasForeignKey<AppUser>(x => x.StudentId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Student>(entity =>
        {
            entity.ToTable("students");
            entity.HasIndex(x => x.StudentId).IsUnique();
            entity.Property(x => x.StudentName).HasMaxLength(160).IsRequired();
            entity.Property(x => x.StudentId).HasMaxLength(30).IsRequired();
            entity.Property(x => x.Department).HasMaxLength(80).IsRequired();
            entity.Property(x => x.HallId).HasMaxLength(40).IsRequired();
            entity.Property(x => x.MobileNumber).HasMaxLength(30).IsRequired();
            entity.Property(x => x.Level).HasMaxLength(40).IsRequired();
            entity.Property(x => x.HallName).HasMaxLength(120).IsRequired();
            entity.Property(x => x.RoomNo).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(40).IsRequired();
            entity.Property(x => x.DueAmount).HasPrecision(12, 2);
        });

        modelBuilder.Entity<MealType>(entity =>
        {
            entity.ToTable("meal_types");
            entity.HasIndex(x => x.Code).IsUnique();
            entity.Property(x => x.Code).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Label).HasMaxLength(80).IsRequired();
        });

        modelBuilder.Entity<MealDay>(entity =>
        {
            entity.ToTable("meal_days");
            entity.HasIndex(x => x.Code).IsUnique();
            entity.Property(x => x.Code).HasMaxLength(20).IsRequired();
            entity.Property(x => x.Label).HasMaxLength(40).IsRequired();
        });

        modelBuilder.Entity<MealConfiguration>(entity =>
        {
            entity.ToTable("meal_configurations");
            entity.HasIndex(x => new { x.MealDayId, x.MealTypeId }).IsUnique();
            entity.Property(x => x.Status).HasMaxLength(40).IsRequired();
        });

        modelBuilder.Entity<MealItem>(entity =>
        {
            entity.ToTable("meal_items");
            entity.Property(x => x.Name).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Cost).HasPrecision(10, 2);
        });

        modelBuilder.Entity<MealSetting>(entity =>
        {
            entity.ToTable("meal_settings");
        });

        modelBuilder.Entity<StudentMealPreference>(entity =>
        {
            entity.ToTable("student_meal_preferences");
            entity.HasIndex(x => new { x.StudentId, x.MealTypeId }).IsUnique();
        });

        modelBuilder.Entity<Bill>(entity =>
        {
            entity.ToTable("bills");
            entity.HasIndex(x => x.BillNo).IsUnique();
            entity.Property(x => x.BillNo).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Period).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(40).IsRequired();
            entity.Property(x => x.MealCost).HasPrecision(12, 2);
            entity.Property(x => x.Utility).HasPrecision(12, 2);
            entity.Property(x => x.Service).HasPrecision(12, 2);
            entity.Property(x => x.Total).HasPrecision(12, 2);
        });

        modelBuilder.Entity<Payment>(entity =>
        {
            entity.ToTable("payments");
            entity.HasIndex(x => x.PaymentNo).IsUnique();
            entity.Property(x => x.PaymentNo).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Method).HasMaxLength(80).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Reference).HasMaxLength(80);
            entity.Property(x => x.Amount).HasPrecision(12, 2);
        });

        modelBuilder.Entity<InventoryItem>(entity =>
        {
            entity.ToTable("inventory_items");
            entity.Property(x => x.Item).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Category).HasMaxLength(80).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Stock).HasPrecision(12, 2);
            entity.Property(x => x.Threshold).HasPrecision(12, 2);
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.ToTable("notifications");
            entity.Property(x => x.Title).HasMaxLength(160).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(500).IsRequired();
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("audit_logs");
            entity.Property(x => x.Actor).HasMaxLength(160).IsRequired();
            entity.Property(x => x.Action).HasMaxLength(240).IsRequired();
            entity.Property(x => x.Module).HasMaxLength(80).IsRequired();
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries<Entity>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAtUtc = now;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAtUtc = now;
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }
}
