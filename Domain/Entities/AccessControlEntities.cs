using HallBackend.Domain.Common;

namespace HallBackend.Domain.Entities;

/// <summary>
/// A selectable role in the permission matrix. Roles live in the database so new ones can be
/// introduced without a deployment; <see cref="Key"/> is what lands in the JWT role claim and
/// must match the value stored on <see cref="AppUser.Role"/>.
/// </summary>
public sealed class AppRole : Entity
{
    public string Key { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;

    /// <summary>Which portal a role signs into — "admin" or "student".</summary>
    public string Area { get; set; } = "admin";

    /// <summary>
    /// Seeded roles the application itself depends on. They may be re-permissioned but not
    /// deleted, so a misclick cannot strand existing accounts on a role that no longer exists.
    /// </summary>
    public bool IsSystem { get; set; }

    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>
/// One node of the permission tree. Nodes mirror the navigable surface of the app: a parent is a
/// section ("Wksp Control" in the reference design) and children are the pages beneath it.
/// <see cref="Key"/> is the stable identifier used by both the API guard and the client's
/// <c>can()</c> helper — renaming a label is safe, renaming a key is not.
/// </summary>
public sealed class AppMenu : Entity
{
    public string Key { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;

    /// <summary>Null for a top-level section.</summary>
    public Guid? ParentId { get; set; }
    public AppMenu? Parent { get; set; }

    /// <summary>Client route this node unlocks. Null for grouping-only nodes.</summary>
    public string? RoutePath { get; set; }

    public string Area { get; set; } = "admin";
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>
/// The View/Create/Edit/Delete grant for one role against one menu node. A missing row means no
/// access at all, so absence of a grant is always a denial.
/// </summary>
public sealed class RolePermission : Entity
{
    public string Role { get; set; } = string.Empty;

    public Guid MenuId { get; set; }
    public AppMenu? Menu { get; set; }

    public bool CanView { get; set; }
    public bool CanCreate { get; set; }
    public bool CanEdit { get; set; }
    public bool CanDelete { get; set; }

    public Guid? UpdatedById { get; set; }
    public AppUser? UpdatedBy { get; set; }
}
