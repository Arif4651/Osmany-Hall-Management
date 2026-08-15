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

    public async Task InvokeAsync(HttpContext context)
    {
        var isStateChanging = !SafeMethods.Contains(context.Request.Method);
        var isAuthenticated = context.User.Identity?.IsAuthenticated == true;

        // Only guards requests riding the ambient auth cookie. Login has no session yet — the
        // password itself is the proof of intent there — and unauthenticated requests carry
        // nothing worth forging.
        if (isStateChanging && isAuthenticated)
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
