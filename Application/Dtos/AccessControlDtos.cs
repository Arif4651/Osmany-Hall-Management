namespace HallBackend.Application.Dtos;

public sealed record AppRoleDto(string Key, string Label, string Area, bool IsSystem);

public sealed record SaveAppRoleRequest(string Key, string Label, string Area);

/// <summary>One node of the tree, with the selected role's grants already folded in.</summary>
public sealed record MenuPermissionNodeDto(
    string Key,
    string Label,
    string? RoutePath,
    string Area,
    bool CanView,
    bool CanCreate,
    bool CanEdit,
    bool CanDelete,
    IReadOnlyList<MenuPermissionNodeDto> Children);

public sealed record RolePermissionMatrixDto(
    string Role,
    string RoleLabel,
    bool IsImmutable,
    IReadOnlyList<MenuPermissionNodeDto> Menus);

/// <summary>One row of a save request. Menus omitted from the payload are revoked outright.</summary>
public sealed record SaveRolePermissionRow(
    string MenuKey,
    bool CanView,
    bool CanCreate,
    bool CanEdit,
    bool CanDelete);

public sealed record SaveRolePermissionsRequest(IReadOnlyList<SaveRolePermissionRow> Permissions);

/// <summary>
/// The signed-in user's own effective grants, keyed by menu key. Drives nav visibility and
/// button-level gating on the client; never the sole line of defence — the API re-checks.
/// </summary>
public sealed record EffectivePermissionDto(
    string MenuKey,
    string? RoutePath,
    bool CanView,
    bool CanCreate,
    bool CanEdit,
    bool CanDelete);

public sealed record MyPermissionsDto(
    string Role,
    bool IsSuperAdmin,
    IReadOnlyList<EffectivePermissionDto> Permissions,
    /// <summary>
    /// True when the financial screens (Bill Management, Due Bill, Payment Verification) should
    /// offer a wing selector instead of pinning the user to their own wing.
    /// </summary>
    bool CanChooseFinanceWing = false);
