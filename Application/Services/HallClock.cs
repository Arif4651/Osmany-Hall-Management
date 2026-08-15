namespace HallBackend.Application.Services;

/// <summary>
/// The single source of "what time is it at the hall", independent of what timezone the host
/// happens to run in.
///
/// Meal cutoffs, "today", and every earliest-editable-date rule used <c>DateTime.Now</c> /
/// <c>DateTime.Today</c> — server-local time — while billing period validation used
/// <c>DateTime.UtcNow</c>. On a UTC-hosted deployment (Render, most container defaults) serving a
/// hall in Bangladesh (UTC+6), that meant a 17:00 cutoff actually fired at 23:00 local time, and
/// "today" flipped to tomorrow six hours early. Every date-facing rule should read through this
/// instead of the BCL clock directly.
/// </summary>
public static class HallClock
{
    /// <summary>
    /// Falls back through the IANA id, the Windows id, and finally a fixed UTC+6 offset with no
    /// DST — Bangladesh observes none — so a host missing tzdata still gets the right wall time
    /// rather than silently running in UTC.
    /// </summary>
    private static readonly TimeZoneInfo HallTimeZone = ResolveHallTimeZone();

    private static TimeZoneInfo ResolveHallTimeZone()
    {
        foreach (var id in new[] { "Asia/Dhaka", "Bangladesh Standard Time" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(id);
            }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }

        return TimeZoneInfo.CreateCustomTimeZone("Hall-Fixed-UTC+6", TimeSpan.FromHours(6), "Hall Standard Time", "Hall Standard Time");
    }

    /// <summary>The current wall-clock instant at the hall.</summary>
    public static DateTime Now => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, HallTimeZone);

    /// <summary>Today's calendar date at the hall.</summary>
    public static DateOnly Today => DateOnly.FromDateTime(Now);

    /// <summary>The current time of day at the hall, for comparing against a cutoff.</summary>
    public static TimeOnly TimeOfDay => TimeOnly.FromDateTime(Now);
}
