using HallBackend.Domain.Common;

namespace HallBackend.Domain.Entities;

/// <summary>
/// Immutable audit record capturing WHO did WHAT, WHEN, WHERE and WHAT CHANGED.
/// Rows are append-only; no update path exists in the application.
/// </summary>
public sealed class AuditLog : Entity
{
    // ── Actor ────────────────────────────────────────────────────────────────
    /// <summary>Display name of the user who performed the action, snapshotted at write time.</summary>
    public string Actor { get; set; } = string.Empty;

    /// <summary>FK to users. Nullable so logs survive account deletion.</summary>
    public Guid? ActorUserId { get; set; }
    public AppUser? ActorUser { get; set; }

    /// <summary>Role key at the time of the action (e.g. "super_admin", "male_wing_admin").</summary>
    public string ActorRole { get; set; } = string.Empty;

    // ── What ────────────────────────────────────────────────────────────────
    /// <summary>Module category (e.g. "Student Management", "Inventory").</summary>
    public string Module { get; set; } = string.Empty;

    /// <summary>Action type (e.g. "CREATE", "UPDATE", "DELETE", "LOGIN", "ROLE_CHANGE").</summary>
    public string Action { get; set; } = string.Empty;

    /// <summary>Domain entity type affected (e.g. "Student", "InventoryItem", "AppUser").</summary>
    public string EntityType { get; set; } = string.Empty;

    /// <summary>String representation of the affected entity's primary key.</summary>
    public string? EntityId { get; set; }

    /// <summary>Human-readable summary of the action.</summary>
    public string Description { get; set; } = string.Empty;

    // ── Before / After ────────────────────────────────────────────────────
    /// <summary>JSON snapshot of relevant fields before the change. Null for create/delete-only logs.</summary>
    public string? OldValues { get; set; }

    /// <summary>JSON snapshot of relevant fields after the change. Null for delete-only logs.</summary>
    public string? NewValues { get; set; }

    // ── Context ──────────────────────────────────────────────────────────
    /// <summary>Client IP address at the time of the request, if available.</summary>
    public string? IpAddress { get; set; }

    /// <summary>User-Agent header at the time of the request, truncated to 300 characters.</summary>
    public string? UserAgent { get; set; }

    /// <summary>Whether the operation completed successfully.</summary>
    public bool IsSuccess { get; set; } = true;

    // ── Legacy ────────────────────────────────────────────────────────────
    /// <summary>
    /// Retained for backwards compatibility with the initial sparse schema.
    /// New code should read <see cref="Entity.CreatedAtUtc"/> as the authoritative timestamp.
    /// </summary>
    public DateOnly Date { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
}
