using System.Text;
using System.Threading.RateLimiting;
using HallBackend.Application.Services;
using HallBackend.Application.Serialization;
using HallBackend.Domain.Entities;
using HallBackend.Infrastructure.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
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
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<CurrentUserService>();
builder.Services.AddScoped<BillingPeriodService>();
builder.Services.AddScoped<InventoryTransactionService>();
builder.Services.AddScoped<ItemCatalogService>();
builder.Services.AddScoped<MealHistoryService>();
builder.Services.AddScoped<BillingCalculationService>();
builder.Services.AddScoped<DataSeeder>();

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
builder.Services.AddOutputCache(opts =>
{
    // Notices: refresh every 5 minutes; invalidated on notice write operations.
    opts.AddPolicy("notices-cache", b =>
        b.Expire(TimeSpan.FromMinutes(5))
         .SetVaryByHeader("Authorization"));

    // Student filter options (departments / levels / halls): 10-minute cache.
    opts.AddPolicy("filter-options-cache", b =>
        b.Expire(TimeSpan.FromMinutes(10))
         .SetVaryByHeader("Authorization"));

    // Daily Cost Report: 2 minutes TTL
    opts.AddPolicy("daily-cost-cache", b =>
        b.Expire(TimeSpan.FromMinutes(2))
         .SetVaryByQuery("month", "year", "gender")
         .SetVaryByHeader("Authorization"));
});

// ── Rate Limiting ─────────────────────────────────────────────────────────────
// Prevent brute-force attacks on the login endpoint.
builder.Services.AddRateLimiter(opts =>
{
    opts.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Max 10 login attempts per minute per IP address.
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

    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<HallDbContext>();
    await db.Database.MigrateAsync();
    await scope.ServiceProvider.GetRequiredService<DataSeeder>().SeedAsync();
}

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// Middleware order matters: compression before responses are written.
app.UseResponseCompression();
app.UseCors("frontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.UseOutputCache();

app.MapHealthChecks("/health");
app.MapControllers();

app.Run();


