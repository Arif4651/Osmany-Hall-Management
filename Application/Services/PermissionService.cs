using HallBackend.Application.Dtos;
using HallBackend.Domain.Constants;
using HallBackend.Domain.Entities;
using HallBackend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Application.Services;

/// <summary>
/// Resolves what a role may do, and lets a super admin rewrite those grants at runtime.
///
/// Two invariants hold no matter what is stored in the database:
/// <list type="bullet">
///   <item>super_admin always has everything — the matrix cannot strand the only account that
///   can repair it, so its row is served synthetically and refuses to be saved.</item>
///   <item>a missing grant row is a denial, never a default-allow.</item>
/// </list>
/// </summary>
public sealed class PermissionService(HallDbContext db)
{
    /// <summary>
    /// Grants are read on every guarded request, so each role's map is cached for a short window.
    /// Saving a role evicts its entry immediately; the TTL only covers other instances of the app.
    /// </summary>
    private static readonly Dictionary<string, (DateTime ExpiresAtUtc, Dictionary<string, RoleGrant> Grants)> Cache = new();
    private static readonly SemaphoreSlim CacheGate = new(1, 1);
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(60);

    public readonly record struct RoleGrant(bool View, bool Create, bool Edit, bool Delete);

    public static bool IsSuperAdmin(string? role)
        => string.Equals(role, Roles.SuperAdmin, StringComparison.OrdinalIgnoreCase);

    public async Task<bool> HasPermissionAsync(string? role, string menuKey, string action, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(role)) return false;
        if (IsSuperAdmin(role)) return true;

        var grants = await GetGrantsAsync(role, cancellationToken);
        if (!grants.TryGetValue(menuKey, out var grant)) return false;

        return action switch
        {
            PermissionActions.View => grant.View,
            PermissionActions.Create => grant.Create,
            PermissionActions.Edit => grant.Edit,
            PermissionActions.Delete => grant.Delete,
            _ => false,
        };
    }

    private async Task<Dictionary<string, RoleGrant>> GetGrantsAsync(string role, CancellationToken cancellationToken)
    {
        await CacheGate.WaitAsync(cancellationToken);
        try
        {
            if (Cache.TryGetValue(role, out var hit) && hit.ExpiresAtUtc > DateTime.UtcNow)
            {
                return hit.Grants;
            }
        }
        finally
        {
            CacheGate.Release();
        }

        var rows = await db.RolePermissions.AsNoTracking()
            .Where(x => x.Role == role && x.Menu != null && x.Menu.IsActive)
            .Select(x => new { x.Menu!.Key, x.CanView, x.CanCreate, x.CanEdit, x.CanDelete })
            .ToListAsync(cancellationToken);

        var grants = rows.ToDictionary(
            x => x.Key,
            x => new RoleGrant(x.CanView, x.CanCreate, x.CanEdit, x.CanDelete),
            StringComparer.OrdinalIgnoreCase);

        await CacheGate.WaitAsync(cancellationToken);
        try
        {
            Cache[role] = (DateTime.UtcNow.Add(CacheTtl), grants);
        }
        finally
        {
            CacheGate.Release();
        }

        return grants;
    }

    private static void Evict(string role)
    {
        CacheGate.Wait();
        try { Cache.Remove(role); }
        finally { CacheGate.Release(); }
    }

    public async Task<IReadOnlyList<AppRoleDto>> GetRolesAsync(CancellationToken cancellationToken)
        => await db.AppRoles.AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.SortOrder).ThenBy(x => x.Label)
            .Select(x => new AppRoleDto(x.Key, x.Label, x.Area, x.IsSystem))
            .ToListAsync(cancellationToken);

    /// <summary>
    /// Builds the full tree for one role. Every node is returned — including ones the role cannot
    /// see — because this feeds the editor, where an unchecked box must still be visible.
    /// </summary>
    public async Task<RolePermissionMatrixDto?> GetMatrixAsync(string role, CancellationToken cancellationToken)
    {
        var roleRow = await db.AppRoles.AsNoTracking().FirstOrDefaultAsync(x => x.Key == role, cancellationToken);
        if (roleRow is null) return null;

        var menus = await db.AppMenus.AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.SortOrder).ThenBy(x => x.Label)
            .ToListAsync(cancellationToken);

        var superAdmin = IsSuperAdmin(role);
        var grants = superAdmin
            ? []
            : await db.RolePermissions.AsNoTracking()
                .Where(x => x.Role == role)
                .ToDictionaryAsync(x => x.MenuId, cancellationToken);

        // ToLookup, not ToDictionary: root nodes have a null ParentId and Dictionary rejects it.
        var byParent = menus.ToLookup(x => x.ParentId);

        IReadOnlyList<MenuPermissionNodeDto> Build(Guid? parentId)
        {
            return byParent[parentId].Select(menu =>
            {
                // The super admin's row is synthetic: everything on, nothing persisted.
                var granted = superAdmin ? null : grants.GetValueOrDefault(menu.Id);
                return new MenuPermissionNodeDto(
                    menu.Key,
                    menu.Label,
                    menu.RoutePath,
                    menu.Area,
                    superAdmin || (granted?.CanView ?? false),
                    superAdmin || (granted?.CanCreate ?? false),
                    superAdmin || (granted?.CanEdit ?? false),
                    superAdmin || (granted?.CanDelete ?? false),
                    Build(menu.Id));
            }).ToList();
        }

        return new RolePermissionMatrixDto(roleRow.Key, roleRow.Label, superAdmin, Build(null));
    }

    /// <summary>
    /// Replaces a role's grants wholesale. Rows absent from the request are revoked, which is what
    /// makes an unchecked box in the editor mean what it looks like it means.
    /// </summary>
    public async Task<string?> SaveMatrixAsync(
        string role,
        IReadOnlyList<SaveRolePermissionRow> rows,
        Guid? updatedById,
        CancellationToken cancellationToken)
    {
        if (IsSuperAdmin(role))
        {
            return "The super admin role always has full access and cannot be edited.";
        }

        var roleExists = await db.AppRoles.AnyAsync(x => x.Key == role && x.IsActive, cancellationToken);
        if (!roleExists) return "Unknown role.";

        var menus = await db.AppMenus.AsNoTracking()
            .Where(x => x.IsActive)
            .Select(x => new { x.Id, x.Key })
            .ToListAsync(cancellationToken);
        var menuIdByKey = menus.ToDictionary(x => x.Key, x => x.Id, StringComparer.OrdinalIgnoreCase);

        var unknown = rows.Select(x => x.MenuKey).FirstOrDefault(x => !menuIdByKey.ContainsKey(x));
        if (unknown is not null) return $"Unknown menu '{unknown}'.";

        var existing = await db.RolePermissions
            .Where(x => x.Role == role)
            .ToDictionaryAsync(x => x.MenuId, cancellationToken);

        var seen = new HashSet<Guid>();
        foreach (var row in rows)
        {
            var menuId = menuIdByKey[row.MenuKey];
            seen.Add(menuId);

            // An all-false row carries no information; drop it so absence stays the single
            // representation of "no access".
            var anyGranted = row.CanView || row.CanCreate || row.CanEdit || row.CanDelete;

            if (existing.TryGetValue(menuId, out var current))
            {
                if (!anyGranted)
                {
                    db.RolePermissions.Remove(current);
                    continue;
                }
                current.CanView = row.CanView;
                current.CanCreate = row.CanCreate;
                current.CanEdit = row.CanEdit;
                current.CanDelete = row.CanDelete;
                current.UpdatedById = updatedById;
                current.UpdatedAtUtc = DateTime.UtcNow;
                continue;
            }

            if (!anyGranted) continue;

            db.RolePermissions.Add(new RolePermission
            {
                Role = role,
                MenuId = menuId,
                CanView = row.CanView,
                CanCreate = row.CanCreate,
                CanEdit = row.CanEdit,
                CanDelete = row.CanDelete,
                UpdatedById = updatedById,
            });
        }

        // Anything the payload did not mention is revoked.
        foreach (var (menuId, row) in existing)
        {
            if (!seen.Contains(menuId)) db.RolePermissions.Remove(row);
        }

        await db.SaveChangesAsync(cancellationToken);
        Evict(role);
        return null;
    }

    /// <summary>The current user's own grants, shaped for the client's <c>can()</c> helper.</summary>
    public async Task<MyPermissionsDto> GetMineAsync(string? role, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(role))
        {
            return new MyPermissionsDto(string.Empty, false, []);
        }

        if (IsSuperAdmin(role))
        {
            var all = await db.AppMenus.AsNoTracking()
                .Where(x => x.IsActive)
                .OrderBy(x => x.SortOrder)
                .Select(x => new EffectivePermissionDto(x.Key, x.RoutePath, true, true, true, true))
                .ToListAsync(cancellationToken);
            return new MyPermissionsDto(role, true, all);
        }

        var rows = await db.RolePermissions.AsNoTracking()
            .Where(x => x.Role == role && x.Menu != null && x.Menu.IsActive)
            .OrderBy(x => x.Menu!.SortOrder)
            .Select(x => new EffectivePermissionDto(
                x.Menu!.Key, x.Menu.RoutePath, x.CanView, x.CanCreate, x.CanEdit, x.CanDelete))
            .ToListAsync(cancellationToken);

        return new MyPermissionsDto(role, false, rows);
    }

    public async Task<string?> CreateRoleAsync(SaveAppRoleRequest request, CancellationToken cancellationToken)
    {
        var key = request.Key?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(key)) return "Role key is required.";
        if (key.Length > 40) return "Role key is too long.";
        if (!key.All(c => char.IsAsciiLetterOrDigit(c) || c is '_' or '-'))
            return "Role key may only contain letters, digits, underscores and hyphens.";
        if (string.IsNullOrWhiteSpace(request.Label)) return "Role label is required.";
        if (await db.AppRoles.AnyAsync(x => x.Key == key, cancellationToken)) return "That role already exists.";

        var area = request.Area is "student" ? "student" : "admin";
        var nextSort = await db.AppRoles.AnyAsync(cancellationToken)
            ? await db.AppRoles.MaxAsync(x => x.SortOrder, cancellationToken) + 1
            : 0;

        db.AppRoles.Add(new AppRole
        {
            Key = key,
            Label = request.Label.Trim(),
            Area = area,
            IsSystem = false,
            SortOrder = nextSort,
        });
        await db.SaveChangesAsync(cancellationToken);
        return null;
    }

    public async Task<string?> DeleteRoleAsync(string key, CancellationToken cancellationToken)
    {
        var role = await db.AppRoles.FirstOrDefaultAsync(x => x.Key == key, cancellationToken);
        if (role is null) return "Unknown role.";
        if (role.IsSystem) return "Built-in roles cannot be deleted.";

        var inUse = await db.Users.AnyAsync(x => x.Role == key, cancellationToken);
        if (inUse) return "That role is still assigned to one or more accounts.";

        var grants = await db.RolePermissions.Where(x => x.Role == key).ToListAsync(cancellationToken);
        db.RolePermissions.RemoveRange(grants);
        db.AppRoles.Remove(role);
        await db.SaveChangesAsync(cancellationToken);
        Evict(key);
        return null;
    }
}
