using System.Text.Json;
using HallBackend.Application.Services;

namespace HallBackend.Infrastructure;

/// <summary>
/// Translates unhandled exceptions into JSON responses shaped like the rest of the API
/// (<c>{ "message": "..." }</c>), so clients get a usable error instead of an empty 500.
/// <para>
/// Without this, an <see cref="UnauthorizedAccessException"/> — thrown by
/// <see cref="CurrentUserService"/> whenever a non-student account calls a student-only
/// route — surfaced as a 500 rather than a 401.
/// </para>
/// </summary>
public sealed class ExceptionHandlingMiddleware(
    RequestDelegate next,
    ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            // The client disconnected mid-request; nothing to report and nowhere to write.
            if (ex is OperationCanceledException && context.RequestAborted.IsCancellationRequested)
            {
                return;
            }

            var (status, message) = Translate(ex);

            if (status >= StatusCodes.Status500InternalServerError)
            {
                logger.LogError(ex, "Unhandled exception for {Method} {Path}", context.Request.Method, context.Request.Path);
            }
            else
            {
                logger.LogInformation("Request rejected ({Status}) for {Method} {Path}: {Message}",
                    status, context.Request.Method, context.Request.Path, ex.Message);
            }

            if (context.Response.HasStarted)
            {
                // Headers are already on the wire — the response cannot be rewritten.
                logger.LogWarning("Response already started; unable to write error body.");
                return;
            }

            context.Response.Clear();
            context.Response.StatusCode = status;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(JsonSerializer.Serialize(new { message }));
        }
    }

    /// <summary>
    /// Maps an exception to a status code and a client-safe message. Only messages we author
    /// are echoed back; anything unrecognised is reported generically so internal details
    /// (SQL, stack traces, connection strings) never reach the client.
    /// </summary>
    private static (int Status, string Message) Translate(Exception exception) => exception switch
    {
        UnauthorizedAccessException => (
            StatusCodes.Status401Unauthorized,
            "You are not signed in with an account that can access this resource."),

        // Only exceptions whose messages we author are echoed back. A bare
        // InvalidOperationException may come from the framework ("Sequence contains no
        // elements"), so it falls through to the generic 500 below.
        DomainValidationException ex => (StatusCodes.Status400BadRequest, ex.Message),

        _ => (
            StatusCodes.Status500InternalServerError,
            "Something went wrong while processing the request."),
    };
}
