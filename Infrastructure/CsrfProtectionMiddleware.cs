namespace HallBackend.Infrastructure;

/// <summary>
/// Double-submit-cookie CSRF protection for state-changing requests.
///
/// The auth cookie is <c>SameSite=None; Secure</c> in production (AuthController) because the
/// Vercel-hosted frontend and the Render-hosted API are different sites — that is exactly the
/// configuration a cross-site form or script can ride the browser's ambient cookie into, since
/// every mutation here only required <c>application/json</c>, which triggers a CORS preflight but
/// is not itself a CSRF defence once a future endpoint accepts a simple content type. This closes
/// that gap: a non-HttpOnly cookie carries a token the frontend must read and echo back in a
/// header, which a cross-site request has no way to do — it can send the cookie automatically,
/// but it cannot read it to construct the header.
/// </summary>
public sealed class CsrfProtectionMiddleware(RequestDelegate next)
{
    public const string CookieName = "hall-csrf-token";
    public const string HeaderName = "X-CSRF-Token";

    private static readonly HashSet<string> SafeMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        HttpMethods.Get, HttpMethods.Head, HttpMethods.Options, HttpMethods.Trace,
    };

    // Login and logout both need to work even when the request "looks" authenticated. A browser
    // that still carries an old, not-yet-expired hall-auth-token cookie from before this
    // middleware existed (or from before its own hall-csrf-token cookie was issued for any other
    // reason) will attach that cookie to *every* request for this origin, including a fresh
    // /login attempt — the JWT bearer middleware validates it and marks the request
    // authenticated regardless of which endpoint it's headed to. Gating on `isAuthenticated`
    // alone then blocks login itself (no CSRF cookie exists yet to satisfy the check) with no way
    // to recover, since the same logic also blocks the logout call that would have cleared the
    // stale cookie. Exempting both endpoints by path — not by inferring intent from auth state —
    // closes that deadlock. Login is safe to exempt because the password is the proof of intent;
    // logout is safe because a forged logout is a well-known, low-severity CSRF exception (the
    // worst a cross-site request can do is end the victim's own session).
    private static bool IsCsrfExemptPath(PathString path)
        => path.StartsWithSegments("/api/auth/login", StringComparison.OrdinalIgnoreCase)
        || path.StartsWithSegments("/api/auth/logout", StringComparison.OrdinalIgnoreCase);

    public async Task InvokeAsync(HttpContext context)
    {
        var isStateChanging = !SafeMethods.Contains(context.Request.Method);
        var isAuthenticated = context.User.Identity?.IsAuthenticated == true;

        // Only guards requests riding the ambient auth cookie. Login has no session yet — the
        // password itself is the proof of intent there — and unauthenticated requests carry
        // nothing worth forging.
        if (isStateChanging && isAuthenticated && !IsCsrfExemptPath(context.Request.Path))
        {
            var cookieToken = context.Request.Cookies[CookieName];
            var headerToken = context.Request.Headers[HeaderName].FirstOrDefault();

            if (string.IsNullOrEmpty(cookieToken)
                || string.IsNullOrEmpty(headerToken)
                || !string.Equals(cookieToken, headerToken, StringComparison.Ordinal))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync("""{"message":"Request could not be verified. Please refresh and try again."}""");
                return;
            }
        }

        await next(context);
    }
}
