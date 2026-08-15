using HallBackend.Domain.Common;

namespace HallBackend.Domain.Entities;

public sealed class StockTransaction : Entity
{
    public Guid ItemId { get; set; }
    public InventoryItem? Item { get; set; }
    public string TransactionType { get; set; } = "in";
    public DateOnly Date { get; set; }
    public string? MealPeriod { get; set; }
    public decimal Quantity { get; set; }
    public decimal Rate { get; set; }
    public decimal WacSnapshot { get; set; }
    public decimal TotalCost { get; set; }
    public string? Note { get; set; }
    public Guid CreatedById { get; set; }
    public AppUser? CreatedBy { get; set; }
    public Guid? UpdatedById { get; set; }
    public AppUser? UpdatedBy { get; set; }
    public int? ParticipantCount { get; set; }

    // ── Batch (lot) costing ──────────────────────────────────────────────────
    // Every stock-in is a batch that keeps its own unit rate; stock-outs draw from one
    // named batch rather than from a blended weighted average across the whole item.

    /// <summary>
    /// On a stock-in: how much of this batch is still available. Always zero on a stock-out.
    /// Recomputed from scratch by the ledger replay, never edited directly.
    /// </summary>
    public decimal RemainingQuantity { get; set; }

    /// <summary>
    /// On a stock-out of a stored item: the stock-in row this quantity was drawn from, which
    /// fixes the rate it is costed at. Null for stock-ins, non-stored items and legacy rows.
    /// </summary>
    public Guid? SourceBatchId { get; set; }
    public StockTransaction? SourceBatch { get; set; }

    /// <summary>
    /// The synthetic batch created at the batch-costing cutover, carrying the stock an item
    /// held at that moment valued at its final weighted average.
    /// </summary>
    public bool IsOpeningBatch { get; set; }

    /// <summary>
    /// Recorded before batch costing existed and priced by the old weighted average. The
    /// replay leaves these rows exactly as they are so historical bills never move; the
    /// opening batch accounts for whatever stock they left behind.
    /// </summary>
    public bool IsPreBatchLegacy { get; set; }
}

public sealed class MealPreferenceHistory : Entity
{
    public Guid StudentId { get; set; }
    public Student? Student { get; set; }
    public string MealPeriod { get; set; } = string.Empty;
    public Guid? OptionItemId { get; set; }
    public InventoryItem? OptionItem { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public DayOfWeek DayOfWeek { get; set; }
}

public sealed class MealStatusHistory : Entity
{
    public Guid StudentId { get; set; }
    public Student? Student { get; set; }
    public string MealPeriod { get; set; } = string.Empty;
    public bool IsOn { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
}

public sealed class ServiceBill : Entity
{
    public int Month { get; set; }
    public int Year { get; set; }
    public string Wing { get; set; } = string.Empty;
    public decimal AmountPerStudent { get; set; }
    public bool IsLocked { get; set; }
    public int Version { get; set; } = 1;
    public Guid AddedById { get; set; }
    public AppUser? AddedBy { get; set; }
}

public sealed class DueAdjustment : Entity
{
    public Guid StudentId { get; set; }
    public Student? Student { get; set; }
    public int BillingMonth { get; set; }
    public int BillingYear { get; set; }
    public decimal AdjustedAmount { get; set; }
    public decimal PreviousAmount { get; set; }
    public string? Note { get; set; }
    public Guid AdjustedById { get; set; }
    public AppUser? AdjustedBy { get; set; }
}

public sealed class PaymentCategory : Entity
{
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public ICollection<PaymentSubmission> Submissions { get; set; } = [];
}

public sealed class PaymentSubmission : Entity
{
    public Guid StudentId { get; set; }
    public Student? Student { get; set; }
    public Guid CategoryId { get; set; }
    public PaymentCategory? Category { get; set; }
    public int BillingMonth { get; set; }
    public int BillingYear { get; set; }
    public decimal SubmittedAmount { get; set; }
    public decimal SubmittedCharge { get; set; }
    public decimal? ApprovedAmount { get; set; }
    public string TransactionId { get; set; } = string.Empty;
    public string Status { get; set; } = "under_review";
    public DateTime SubmittedAtUtc { get; set; } = DateTime.UtcNow;
    public Guid? ReviewedById { get; set; }
    public AppUser? ReviewedBy { get; set; }
    public DateTime? ReviewedAtUtc { get; set; }
}

public sealed class MonthlyBillCache : Entity
{
    public Guid StudentId { get; set; }
    public Student? Student { get; set; }
    public int Month { get; set; }
    public int Year { get; set; }
    public decimal MonthlyBill { get; set; }
    public decimal DswSubsidy { get; set; }
    public decimal GuestMealBill { get; set; }
    /// <summary>Sum of this student's OthersBillAllocation rows for the month (tea, milk, …).</summary>
    public decimal OthersBill { get; set; }
    public decimal ServiceBill { get; set; }
    public decimal CarriedDue { get; set; }
    /// <summary>
    /// Net manual correction applied by an admin from the Due screen, signed: positive charges
    /// more, negative charges less. It is part of <see cref="TotalBill"/> rather than a
    /// replacement for <see cref="DueBill"/>, so payments still reduce it and the components of
    /// the bill always add back up to the total the student is shown.
    /// </summary>
    public decimal Adjustment { get; set; }
    public decimal TotalApprovedPaid { get; set; }
    public decimal DueBill { get; set; }
    public decimal TotalBill { get; set; }
    public bool IsFinal { get; set; }
    public DateTime LastCalculatedAtUtc { get; set; }
}

public sealed class DswSubsidy : Entity
{
    public string Wing { get; set; } = "Male";
    public decimal SubsidyAmount { get; set; }
    public DateOnly Date { get; set; }
    public string MealPeriod { get; set; } = string.Empty;
    public int EligibleStudentCount { get; set; }
    public decimal PerStudentSubsidy { get; set; }
    public string? Notes { get; set; }
    public Guid CreatedById { get; set; }
    public AppUser? CreatedBy { get; set; }
    public bool IsReversed { get; set; }
    public Guid? ReversedById { get; set; }
    public AppUser? ReversedBy { get; set; }
    public DateTime? ReversedAtUtc { get; set; }
    public string? ReversalNote { get; set; }
    public ICollection<DswSubsidyDistribution> Distributions { get; set; } = [];
}

public sealed class DswSubsidyDistribution : Entity
{
    public Guid SubsidyId { get; set; }
    public DswSubsidy? Subsidy { get; set; }
    public Guid StudentId { get; set; }
    public Student? Student { get; set; }
    public DateOnly Date { get; set; }
    public string MealPeriod { get; set; } = string.Empty;
    public decimal SubsidyAmount { get; set; }
}

public sealed class BillingPeriod : Entity
{
    public int Month { get; set; }
    public int Year { get; set; }
    public bool IsLocked { get; set; }
    public DateTime? LockedAtUtc { get; set; }
    public Guid? LockedById { get; set; }
    public AppUser? LockedBy { get; set; }
    public string? UnlockNote { get; set; }
}

public sealed class BillingPeriodUnlockAudit : Entity
{
    public int Month { get; set; }
    public int Year { get; set; }
    public string Note { get; set; } = string.Empty;
    public Guid UnlockedById { get; set; }
    public AppUser? UnlockedBy { get; set; }
    public DateTime UnlockedAtUtc { get; set; } = DateTime.UtcNow;
}
