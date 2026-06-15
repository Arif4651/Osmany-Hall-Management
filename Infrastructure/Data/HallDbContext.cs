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
    public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<StockTransaction> StockTransactions => Set<StockTransaction>();
    public DbSet<MealPreferenceHistory> MealPreferenceHistory => Set<MealPreferenceHistory>();
    public DbSet<MealStatusHistory> MealStatusHistory => Set<MealStatusHistory>();
    public DbSet<ServiceBill> ServiceBills => Set<ServiceBill>();
    public DbSet<DueAdjustment> DueAdjustments => Set<DueAdjustment>();
    public DbSet<PaymentCategory> PaymentCategories => Set<PaymentCategory>();
    public DbSet<PaymentSubmission> PaymentSubmissions => Set<PaymentSubmission>();
    public DbSet<MonthlyBillCache> MonthlyBillCache => Set<MonthlyBillCache>();
    public DbSet<DswSubsidy> DswSubsidies => Set<DswSubsidy>();
    public DbSet<DswSubsidyDistribution> DswSubsidyDistributions => Set<DswSubsidyDistribution>();
    public DbSet<BillingPeriod> BillingPeriods => Set<BillingPeriod>();
    public DbSet<BillingPeriodUnlockAudit> BillingPeriodUnlockAudits => Set<BillingPeriodUnlockAudit>();
    public DbSet<GlobalMealOverride> GlobalMealOverrides => Set<GlobalMealOverride>();
    public DbSet<GuestMealRequest> GuestMealRequests => Set<GuestMealRequest>();
    public DbSet<Notice> Notices => Set<Notice>();

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
            entity.Property(x => x.Wing).HasMaxLength(20);
            entity.Property(x => x.Designation).HasMaxLength(120);
            entity.HasOne(x => x.Student).WithOne(x => x.User).HasForeignKey<AppUser>(x => x.StudentId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Student>(entity =>
        {
            entity.ToTable("students", table => table.HasCheckConstraint("ck_students_gender", "\"Gender\" IN ('Male','Female')"));
            entity.HasIndex(x => x.StudentId).IsUnique();
            entity.HasIndex(x => x.RollNumber).IsUnique();
            entity.HasIndex(x => x.Gender);
            entity.Property(x => x.StudentName).HasMaxLength(160).IsRequired();
            entity.Property(x => x.StudentId).HasMaxLength(30).IsRequired();
            entity.Property(x => x.RollNumber).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Gender).HasMaxLength(20).IsRequired();
            entity.Property(x => x.Department).HasMaxLength(80).IsRequired();
            entity.Property(x => x.HallId).HasMaxLength(40).IsRequired();
            entity.Property(x => x.MobileNumber).HasMaxLength(30).IsRequired();
            entity.Property(x => x.Level).HasMaxLength(40).IsRequired();
            entity.Property(x => x.HallName).HasMaxLength(120).IsRequired();
            entity.Property(x => x.RoomNo).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(40).IsRequired();
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
            entity.HasIndex(x => new { x.MealDayId, x.MealTypeId, x.Wing }).IsUnique();
            entity.Property(x => x.Wing).HasMaxLength(20).HasDefaultValue("Male").IsRequired();
            entity.Property(x => x.Status).HasMaxLength(40).IsRequired();
        });

        modelBuilder.Entity<MealItem>(entity =>
        {
            entity.ToTable("meal_items");
            entity.Property(x => x.Name).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Cost).HasPrecision(12, 4);
            entity.HasOne(x => x.InventoryItem).WithMany().HasForeignKey(x => x.InventoryItemId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<MealSetting>(entity =>
        {
            entity.ToTable("meal_settings");
        });

        modelBuilder.Entity<InventoryItem>(entity =>
        {
            entity.ToTable("inventory_items", table =>
            {
                table.HasCheckConstraint("ck_inventory_items_category", "\"Category\" IN ('Common','Options','Others')");
                table.HasCheckConstraint("ck_inventory_items_stock", "\"CurrentStockQuantity\" >= 0 AND \"CurrentWac\" >= 0");
                table.HasCheckConstraint("ck_inventory_items_link", "(\"Category\" = 'Others' AND \"LinkedOptionId\" IS NOT NULL) OR (\"Category\" <> 'Others' AND \"LinkedOptionId\" IS NULL)");
                table.HasCheckConstraint("ck_inventory_items_wing", "\"Wing\" IN ('Male','Female')");
            });
            entity.Property(x => x.Item).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Wing).HasMaxLength(20).HasDefaultValue("Male").IsRequired();
            entity.Property(x => x.Category).HasMaxLength(80).IsRequired();
            entity.Property(x => x.Unit).HasMaxLength(20).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(40).IsRequired();
            entity.Property(x => x.CurrentStockQuantity).HasPrecision(12, 4);
            entity.Property(x => x.CurrentWac).HasPrecision(12, 4);
            entity.Property(x => x.Stock).HasPrecision(12, 4);
            entity.Property(x => x.Threshold).HasPrecision(12, 4);
            entity.Property(x => x.AveragePrice).HasPrecision(12, 4);
            entity.Property(x => x.TotalStockValue).HasPrecision(12, 4);
            entity.Property(x => x.IsStored).HasDefaultValue(true);
            entity.HasIndex(x => x.Category);
            entity.HasIndex(x => x.Wing);
            entity.HasIndex(x => x.IsDeleted);
            entity.HasOne(x => x.LinkedOption).WithMany(x => x.LinkedOthers).HasForeignKey(x => x.LinkedOptionId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.CreatedBy).WithMany().HasForeignKey(x => x.CreatedById).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.ToTable("notifications");
            entity.Property(x => x.Title).HasMaxLength(160).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(500).IsRequired();
        });

        modelBuilder.Entity<Notice>(entity =>
        {
            entity.ToTable("notices", table => table.HasCheckConstraint("ck_notices_wing", "\"TargetWing\" IN ('All','Male','Female')"));
            entity.Property(x => x.Title).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Content).HasMaxLength(4000).IsRequired();
            entity.Property(x => x.TargetWing).HasMaxLength(20).IsRequired();
            entity.HasOne(x => x.CreatedBy).WithMany().HasForeignKey(x => x.CreatedById).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("audit_logs");
            entity.Property(x => x.Actor).HasMaxLength(160).IsRequired();
            entity.Property(x => x.Action).HasMaxLength(240).IsRequired();
            entity.Property(x => x.Module).HasMaxLength(80).IsRequired();
        });

        ConfigureFinancialModel(modelBuilder);
    }

    private static void ConfigureFinancialModel(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<StockTransaction>(entity =>
        {
            entity.ToTable("stock_transactions", table =>
            {
                table.HasCheckConstraint("ck_stock_transactions_type", "\"TransactionType\" IN ('in','out')");
                table.HasCheckConstraint("ck_stock_transactions_meal", "(\"TransactionType\" = 'in' AND \"MealPeriod\" IS NULL) OR (\"TransactionType\" = 'out' AND \"MealPeriod\" IN ('breakfast','lunch','dinner'))");
                table.HasCheckConstraint("ck_stock_transactions_quantity", "\"Quantity\" > 0");
            });
            entity.HasIndex(x => x.Date);
            entity.HasIndex(x => new { x.ItemId, x.Date });
            entity.Property(x => x.TransactionType).HasMaxLength(8).IsRequired();
            entity.Property(x => x.MealPeriod).HasMaxLength(20);
            entity.Property(x => x.Quantity).HasPrecision(12, 4);
            entity.Property(x => x.Rate).HasPrecision(12, 4);
            entity.Property(x => x.WacSnapshot).HasPrecision(12, 4);
            entity.Property(x => x.TotalCost).HasPrecision(12, 4);
            entity.Property(x => x.Note).HasMaxLength(500);
            entity.HasOne(x => x.Item).WithMany(x => x.StockTransactions).HasForeignKey(x => x.ItemId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.CreatedBy).WithMany().HasForeignKey(x => x.CreatedById).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.UpdatedBy).WithMany().HasForeignKey(x => x.UpdatedById).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<MealPreferenceHistory>(entity =>
        {
            entity.ToTable("meal_preference_history", table =>
            {
                table.HasCheckConstraint("ck_meal_preference_period", "\"MealPeriod\" IN ('breakfast','lunch','dinner')");
                table.HasCheckConstraint("ck_meal_preference_dates", "\"EffectiveTo\" IS NULL OR \"EffectiveTo\" >= \"EffectiveFrom\"");
            });
            entity.HasIndex(x => new { x.StudentId, x.MealPeriod, x.DayOfWeek, x.EffectiveFrom });
            entity.HasIndex(x => new { x.StudentId, x.MealPeriod, x.DayOfWeek, x.EffectiveTo });
            entity.HasIndex(x => new { x.StudentId, x.MealPeriod, x.DayOfWeek }).IsUnique().HasFilter("\"EffectiveTo\" IS NULL");
            entity.Property(x => x.MealPeriod).HasMaxLength(20).IsRequired();
            entity.HasOne(x => x.Student).WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.OptionItem).WithMany().HasForeignKey(x => x.OptionItemId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<MealStatusHistory>(entity =>
        {
            entity.ToTable("meal_status_history", table =>
            {
                table.HasCheckConstraint("ck_meal_status_period", "\"MealPeriod\" IN ('breakfast','lunch','dinner')");
                table.HasCheckConstraint("ck_meal_status_dates", "\"EffectiveTo\" IS NULL OR \"EffectiveTo\" >= \"EffectiveFrom\"");
            });
            entity.HasIndex(x => new { x.StudentId, x.MealPeriod, x.EffectiveFrom });
            entity.HasIndex(x => new { x.StudentId, x.MealPeriod, x.EffectiveTo });
            entity.HasIndex(x => new { x.StudentId, x.MealPeriod }).IsUnique().HasFilter("\"EffectiveTo\" IS NULL");
            entity.Property(x => x.MealPeriod).HasMaxLength(20).IsRequired();
            entity.HasOne(x => x.Student).WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ServiceBill>(entity =>
        {
            entity.ToTable("service_bills", table =>
            {
                table.HasCheckConstraint("ck_service_bills_month", "\"Month\" BETWEEN 1 AND 12");
                table.HasCheckConstraint("ck_service_bills_amount", "\"AmountPerStudent\" >= 0");
            });
            entity.HasIndex(x => new { x.Month, x.Year, x.Version }).IsUnique();
            entity.Property(x => x.AmountPerStudent).HasPrecision(12, 4);
            entity.HasOne(x => x.AddedBy).WithMany().HasForeignKey(x => x.AddedById).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<DueAdjustment>(entity =>
        {
            entity.ToTable("due_adjustments", table =>
            {
                table.HasCheckConstraint("ck_due_adjustments_month", "\"BillingMonth\" BETWEEN 1 AND 12");
                table.HasCheckConstraint("ck_due_adjustments_amount", "\"AdjustedAmount\" >= 0 AND \"PreviousAmount\" >= 0");
            });
            entity.HasIndex(x => new { x.StudentId, x.BillingMonth, x.BillingYear });
            entity.Property(x => x.AdjustedAmount).HasPrecision(12, 4);
            entity.Property(x => x.PreviousAmount).HasPrecision(12, 4);
            entity.HasOne(x => x.Student).WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.AdjustedBy).WithMany().HasForeignKey(x => x.AdjustedById).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<PaymentCategory>(entity =>
        {
            entity.ToTable("payment_categories");
            entity.HasIndex(x => x.Name).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(100).IsRequired();
        });

        modelBuilder.Entity<PaymentSubmission>(entity =>
        {
            entity.ToTable("payment_submissions", table =>
            {
                table.HasCheckConstraint("ck_payment_submissions_month", "\"BillingMonth\" BETWEEN 1 AND 12");
                table.HasCheckConstraint("ck_payment_submissions_amount", "\"SubmittedAmount\" > 0 AND \"SubmittedCharge\" >= 0 AND (\"ApprovedAmount\" IS NULL OR \"ApprovedAmount\" >= 0)");
                table.HasCheckConstraint("ck_payment_submissions_status", "\"Status\" IN ('under_review','approved','rejected')");
            });
            entity.HasIndex(x => new { x.CategoryId, x.TransactionId }).IsUnique();
            entity.HasIndex(x => new { x.StudentId, x.BillingMonth, x.BillingYear, x.Status });
            entity.Property(x => x.SubmittedAmount).HasPrecision(12, 4);
            entity.Property(x => x.SubmittedCharge).HasPrecision(12, 4);
            entity.Property(x => x.ApprovedAmount).HasPrecision(12, 4);
            entity.Property(x => x.TransactionId).HasMaxLength(255).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(30).IsRequired();
            entity.HasOne(x => x.Student).WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Category).WithMany(x => x.Submissions).HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.ReviewedBy).WithMany().HasForeignKey(x => x.ReviewedById).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<MonthlyBillCache>(entity =>
        {
            entity.ToTable("monthly_bill_cache", table => table.HasCheckConstraint("ck_monthly_bill_cache_month", "\"Month\" BETWEEN 1 AND 12"));
            entity.HasIndex(x => new { x.StudentId, x.Month, x.Year }).IsUnique();
            entity.Property(x => x.MonthlyBill).HasPrecision(12, 4);
            entity.Property(x => x.DswSubsidy).HasPrecision(12, 4);
            entity.Property(x => x.GuestMealBill).HasPrecision(12, 4);
            entity.Property(x => x.ServiceBill).HasPrecision(12, 4);
            entity.Property(x => x.CarriedDue).HasPrecision(12, 4);
            entity.Property(x => x.TotalApprovedPaid).HasPrecision(12, 4);
            entity.Property(x => x.DueBill).HasPrecision(12, 4);
            entity.Property(x => x.TotalBill).HasPrecision(12, 4);
            entity.HasOne(x => x.Student).WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<DswSubsidy>(entity =>
        {
            entity.ToTable("dsw_subsidies", table =>
            {
                table.HasCheckConstraint("ck_dsw_subsidies_meal_period", "\"MealPeriod\" IN ('breakfast','lunch','dinner')");
                table.HasCheckConstraint("ck_dsw_subsidies_wing", "\"Wing\" IN ('Male','Female')");
                table.HasCheckConstraint("ck_dsw_subsidies_amount", "\"SubsidyAmount\" > 0 AND \"PerStudentSubsidy\" >= 0");
                table.HasCheckConstraint("ck_dsw_subsidies_eligible_count", "\"EligibleStudentCount\" > 0");
            });
            entity.HasIndex(x => new { x.Wing, x.Date, x.MealPeriod })
                .IsUnique()
                .HasFilter("\"IsReversed\" = false");
            entity.HasIndex(x => new { x.Date, x.Wing });
            entity.Property(x => x.Wing).HasMaxLength(20).HasDefaultValue("Male").IsRequired();
            entity.Property(x => x.MealPeriod).HasMaxLength(20).IsRequired();
            entity.Property(x => x.SubsidyAmount).HasPrecision(12, 4);
            entity.Property(x => x.PerStudentSubsidy).HasPrecision(12, 4);
            entity.Property(x => x.Notes).HasMaxLength(500);
            entity.Property(x => x.ReversalNote).HasMaxLength(500);
            entity.HasOne(x => x.CreatedBy).WithMany().HasForeignKey(x => x.CreatedById).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.ReversedBy).WithMany().HasForeignKey(x => x.ReversedById).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<DswSubsidyDistribution>(entity =>
        {
            entity.ToTable("dsw_subsidy_distributions", table =>
            {
                table.HasCheckConstraint("ck_dsw_subsidy_distributions_meal_period", "\"MealPeriod\" IN ('breakfast','lunch','dinner')");
                table.HasCheckConstraint("ck_dsw_subsidy_distributions_amount", "\"SubsidyAmount\" >= 0");
            });
            entity.HasIndex(x => new { x.SubsidyId, x.StudentId }).IsUnique();
            entity.HasIndex(x => new { x.StudentId, x.Date });
            entity.Property(x => x.MealPeriod).HasMaxLength(20).IsRequired();
            entity.Property(x => x.SubsidyAmount).HasPrecision(12, 4);
            entity.HasOne(x => x.Subsidy).WithMany(x => x.Distributions).HasForeignKey(x => x.SubsidyId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Student).WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<GlobalMealOverride>(entity =>
        {
            entity.ToTable("global_meal_overrides", table =>
            {
                table.HasCheckConstraint("ck_global_override_period", "\"MealPeriod\" IN ('breakfast','lunch','dinner')");
                table.HasCheckConstraint("ck_global_override_dates", "\"EffectiveTo\" >= \"EffectiveFrom\"");
            });
            entity.HasIndex(x => new { x.Wing, x.MealPeriod, x.EffectiveFrom, x.EffectiveTo });
            entity.Property(x => x.Wing).HasMaxLength(20).HasDefaultValue("Male").IsRequired();
            entity.Property(x => x.MealPeriod).HasMaxLength(20).IsRequired();
            entity.Property(x => x.Note).HasMaxLength(500);
            entity.HasOne(x => x.CreatedBy).WithMany().HasForeignKey(x => x.CreatedById).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<GuestMealRequest>(entity =>
        {
            entity.ToTable("guest_meal_requests", table =>
            {
                table.HasCheckConstraint("ck_guest_meal_period", "\"MealPeriod\" IN ('breakfast','lunch','dinner')");
                table.HasCheckConstraint("ck_guest_meal_count", "\"GuestCount\" BETWEEN 1 AND 20");
            });
            // One request per student per meal period per date
            entity.HasIndex(x => new { x.StudentId, x.MealPeriod, x.Date }).IsUnique();
            entity.HasIndex(x => new { x.StudentId, x.Date });
            entity.Property(x => x.MealPeriod).HasMaxLength(20).IsRequired();
            entity.HasOne(x => x.Student).WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<BillingPeriod>(entity =>
        {
            entity.ToTable("billing_periods", table => table.HasCheckConstraint("ck_billing_periods_month", "\"Month\" BETWEEN 1 AND 12"));
            entity.HasIndex(x => new { x.Month, x.Year }).IsUnique();
            entity.HasOne(x => x.LockedBy).WithMany().HasForeignKey(x => x.LockedById).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<BillingPeriodUnlockAudit>(entity =>
        {
            entity.ToTable("billing_period_unlock_audits");
            entity.HasIndex(x => new { x.Month, x.Year });
            entity.Property(x => x.Note).HasMaxLength(1000).IsRequired();
            entity.HasOne(x => x.UnlockedBy).WithMany().HasForeignKey(x => x.UnlockedById).OnDelete(DeleteBehavior.Restrict);
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
