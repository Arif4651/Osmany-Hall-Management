namespace HallBackend.Application.Services;

/// <summary>
/// Builds ILIKE patterns for the admin search boxes.
/// <para>
/// Searching with <c>EF.Functions.ILike</c> rather than <c>.ToLower().Contains()</c> matters
/// for more than style: Npgsql compiles <c>Contains</c> to <c>strpos(...) &gt; 0</c>, which no
/// index can serve, whereas ILIKE can use the <c>gin_trgm_ops</c> indexes added in the
/// AddSearchTrigramIndexes migration.
/// </para>
/// </summary>
public static class SearchPattern
{
    /// <summary>Escape character paired with the patterns produced here.</summary>
    public const string EscapeCharacter = "\\";

    /// <summary>
    /// Wraps a user-supplied term in wildcards for a "contains" match, escaping the LIKE
    /// metacharacters so that searching for "100%" or "a_b" matches those literal strings
    /// instead of every row.
    /// </summary>
    public static string Contains(string term)
    {
        var escaped = term.Trim()
            .Replace("\\", "\\\\")
            .Replace("%", "\\%")
            .Replace("_", "\\_");
        return $"%{escaped}%";
    }
}
