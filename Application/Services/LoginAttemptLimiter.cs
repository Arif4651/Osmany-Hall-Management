using System.Collections.Concurrent;

namespace HallBackend.Application.Services;

/// <summary>
/// A per-account brute-force guard, independent of the per-IP rate limiter on the login route.
///
/// The IP-based limiter (Program.cs, policy "auth-login") stops one address from hammering the
/// endpoint, but an attacker spread across many addresses — or many addresses behind the same
/// proxy, which is what every caller looked like before the ForwardedHeaders fix — is throttled
/// no harder than a legitimate user. This tracks failures per account identifier instead, so a
/// single targeted account cannot be brute-forced regardless of how the traffic is spread.
/// </summary>
public sealed class LoginAttemptLimiter
{
    private const int MaxFailuresBeforeLockout = 10;
    private static readonly TimeSpan LockoutWindow = TimeSpan.FromMinutes(15);

    private sealed class Entry
    {
        public int FailureCount;
        public DateTime WindowStartUtc;
    }

    private readonly ConcurrentDictionary<string, Entry> attempts = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>True when this identifier has failed too many times within the current window.</summary>
    public bool IsLockedOut(string identifier)
    {
        if (!attempts.TryGetValue(identifier, out var entry)) return false;
        if (DateTime.UtcNow - entry.WindowStartUtc > LockoutWindow)
        {
            attempts.TryRemove(identifier, out _);
            return false;
        }
        return entry.FailureCount >= MaxFailuresBeforeLockout;
    }

    public void RecordFailure(string identifier)
    {
        attempts.AddOrUpdate(
            identifier,
            _ => new Entry { FailureCount = 1, WindowStartUtc = DateTime.UtcNow },
            (_, entry) =>
            {
                if (DateTime.UtcNow - entry.WindowStartUtc > LockoutWindow)
                {
                    entry.FailureCount = 1;
                    entry.WindowStartUtc = DateTime.UtcNow;
                }
                else
                {
                    entry.FailureCount++;
                }
                return entry;
            });
    }

    public void RecordSuccess(string identifier) => attempts.TryRemove(identifier, out _);
}
