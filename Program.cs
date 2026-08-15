using System.Net;
using System.Text;
using System.Threading.RateLimiting;
using HallBackend.Application.Services;
using HallBackend.Application.Serialization;
using HallBackend.Domain.Entities;
using HallBackend.Infrastructure.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
if (string.Equals(env, "Development", StringComparison.OrdinalIgnoreCase))
{
    HallBackend.PortHelper.FreePortsFromEnvironment();
}

var builder = WebApplication.CreateBuilder(args);


var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is required.");
var jwtSecret = builder.Configuration["Jwt:Secret"]
    ?? throw new InvalidOperationException("Jwt:Secret is required.");
if (jwtSecret.StartsWith("CHANGE_", StringComparison.OrdinalIgnoreCase))
{
    throw new InvalidOperationException("Replace the placeholder Jwt:Secret with a secure secret.");
}

builder.Services.AddDbContext<HallDbContext>(options => options.UseNpgsql(connectionString));
builder.Services.AddScoped<PasswordService>();
builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddSingleton<LoginAttemptLimiter>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<CurrentUserService>();
builder.Services.AddScoped<InventoryTransactionService>();
builder.Services.AddScoped<ItemCatalogService>();
builder.Services.AddScoped<MealHistoryService>();
builder.Services.AddScoped<BillingCalculationService>();
builder.Services.AddScoped<AdditionalMealService>();
builder.Services.AddScoped<OthersBillService>();
builder.Services.AddScoped<PermissionService>();
builder.Services.AddScoped<DataSeeder>();
builder.Services.AddScoped<AccessControlSeeder>();

// ── Response Compression (Brotli preferred, Gzip fallback) ──────────────────
// Reduces API payload sizes by ~60-80% for JSON responses.
builder.Services.AddResponseCompression(opts =>
{
    opts.EnableForHttps = true;
    opts.Providers.Add<BrotliCompressionProvider>();
    opts.Providers.Add<GzipCompressionProvider>();
    opts.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(
    [
        "application/json",
        "text/json",
    ]);
});
builder.Services.Configure<BrotliCompressionProviderOptions>(opts =>
    opts.Level = System.IO.Compression.CompressionLevel.Fastest);
builder.Services.Configure<GzipCompressionProviderOptions>(opts =>
    opts.Level = System.IO.Compression.CompressionLevel.Fastest);

// ── Output Caching ────────────────────────────────────────────────────────────
// Server-side cache for read-heavy, rarely-mutated endpoints.
// IMPORTANT: policies are "NoStore" by default for authenticated routes —
// only apply policies explicitly on endpoints that are safe to cache.
//
// Auth is a cookie ("hall-auth-token"), not an Authorization header — the frontend never sends
// one — so SetVaryByHeader("Authorization") always sees the same (empty) value for every caller
// and every user was served the same cached response. Vary by the authenticated user's id
// instead, read from the claim the JWT bearer handler has already populated by the time output
// caching runs (it sits after UseAuthentication/UseAuthorization in the pipeline below).
static string CurrentUserCacheKey(HttpContext context)
    => context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "anonymous";

builder.Services.AddOutputCache(opts =>
{
    // Notices: refresh every 5 minutes; invalidated on notice write operations.
    opts.AddPolicy("notices-cache", b =>
        b.Expire(TimeSpan.FromMinutes(5))
         .VaryByValue(context => new KeyValuePair<string, string>("uid", CurrentUserCacheKey(context))));

    // Student filter options (departments / levels / halls): 10-minute cache.
    opts.AddPolicy("filter-options-cache", b =>
        b.Expire(TimeSpan.FromMinutes(10))
         .VaryByValue(context => new KeyValuePair<string, string>("uid", CurrentUserCacheKey(context))));
});

// ── Rate Limiting ─────────────────────────────────────────────────────────────
// Prevent brute-force attacks on the login endpoint.
builder.Services.AddRateLimiter(opts =>
{
    opts.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Max 10 login attempts per minute per client address. Correct only once ForwardedHeaders
    // (below) has resolved RemoteIpAddress to the real client — behind the reverse proxy this
    // app is deployed behind, that address used to be the proxy's for every request, so every
    // caller shared one 10-per-minute budget: a busy morning locked everyone out at once, and an
    // actual attacker was throttled no harder than anyone else.
    opts.AddPolicy("auth-login", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
            }));
});

// ── Forwarded Headers ─────────────────────────────────────────────────────────
// This app sits behind a reverse proxy (Render's edge, in front of a Vercel-hosted frontend —
// see the CORS comment below), so HttpContext.Connection.RemoteIpAddress is otherwise always the
// proxy's own address, never the caller's. That silently broke the login rate limiter: every
// caller shared one partition keyed on the proxy's IP, so it protected nobody and could lock out
// every user at once under normal traffic. KnownNetworks/KnownProxies are cleared because the
// proxy's address is not fixed and not enumerable in advance; this is safe specifically because
// the platform's edge is the only path to this app — nothing reaches it by connecting directly
// and forging the header.
builder.Services.Configure<ForwardedHeadersOptions>(opts =>
{
    opts.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    opts.KnownNetworks.Clear();
    opts.KnownProxies.Clear();
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
    {
        // AllowCredentials() is required for HttpOnly cookies on cross-origin requests.
        // AllowAnyOrigin() cannot be combined with AllowCredentials(), so we always use
        // explicit origins.
        var devOrigins = new[] { "http://localhost:5173", "https://localhost:5173" };
        var origins = builder.Environment.IsDevelopment()
            ? devOrigins
            : builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];

        policy.WithOrigins(origins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ClockSkew = TimeSpan.FromMinutes(1),
        };

        // Read the JWT from the HttpOnly cookie instead of the Authorization header.
        options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                if (context.Request.Cookies.TryGetValue("hall-auth-token", out var cookieToken)
                    && !string.IsNullOrEmpty(cookieToken))
                {
                    context.Token = cookieToken;
                }
                return Task.CompletedTask;
            },
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.Converters.Add(new DecimalJsonConverter());
    options.JsonSerializerOptions.Converters.Add(new NullableDecimalJsonConverter());
});
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks();

//added new for render..
var port = Environment.GetEnvironmentVariable("PORT");

if (!string.IsNullOrEmpty(port))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

//until

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// Migrating and seeding on every startup — not just in Development — so a freshly provisioned
// production database gets its schema and its role/menu/permission tree without a manual step.
// Both seeders are idempotent: DataSeeder short-circuits once users exist, and AccessControlSeeder
// only backfills menus/grants that are missing, so re-running this on every deploy is safe.
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<HallDbContext>();
    await db.Database.MigrateAsync();
    await scope.ServiceProvider.GetRequiredService<DataSeeder>().SeedAsync();
    await scope.ServiceProvider.GetRequiredService<AccessControlSeeder>().SeedAsync();
}

// Resolve the real client address/scheme from the proxy's headers before anything downstream
// (rate limiting, HTTPS redirection, logging) reads them.
app.UseForwardedHeaders();

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// Outermost middleware, so it catches exceptions thrown anywhere further down the pipeline.
app.UseMiddleware<HallBackend.Infrastructure.ExceptionHandlingMiddleware>();

// Middleware order matters: compression before responses are written.
app.UseResponseCompression();
app.UseCors("frontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<HallBackend.Infrastructure.CsrfProtectionMiddleware>();
app.UseMiddleware<HallBackend.Infrastructure.RequirePasswordChangeMiddleware>();
app.UseOutputCache();

app.MapHealthChecks("/health");
app.MapControllers();

app.Run();


