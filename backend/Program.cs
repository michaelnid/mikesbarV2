using Backend.Data;
using Backend.Hubs;
using Backend.Options;
using Backend.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// === SECURITY: Load secrets from environment variables ===
var jwtKey = Environment.GetEnvironmentVariable("JWT_SECRET_KEY");
if (string.IsNullOrEmpty(jwtKey) || jwtKey.StartsWith("${") || jwtKey.Length < 32)
{
    throw new InvalidOperationException(
        "SECURITY ERROR: JWT_SECRET_KEY environment variable is not configured or too short (min 32 chars). " +
        "Set it before starting the application.");
}

var dbConnectionString = Environment.GetEnvironmentVariable("DB_CONNECTION_STRING") 
    ?? builder.Configuration.GetConnectionString("DefaultConnection");
var configuredOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
var allowedOrigins = Environment.GetEnvironmentVariable("ALLOWED_ORIGINS")?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    ?? configuredOrigins;

if (allowedOrigins.Length == 0)
{
    allowedOrigins =
    [
        "http://localhost:5173",
        "http://localhost:3000"
    ];
}

bool IsOriginAllowed(string origin)
{
    if (string.IsNullOrWhiteSpace(origin))
    {
        return false;
    }

    if (origin.StartsWith("http://localhost", StringComparison.OrdinalIgnoreCase) ||
        origin.StartsWith("https://localhost", StringComparison.OrdinalIgnoreCase))
    {
        return true;
    }

    var isAllowed = allowedOrigins.Any(allowedOrigin =>
        origin.Equals(allowedOrigin, StringComparison.OrdinalIgnoreCase));

    if (!isAllowed)
    {
        Console.WriteLine($"[CORS] Blocked origin: {origin}");
    }

    return isAllowed;
}

if (string.IsNullOrEmpty(dbConnectionString) || dbConnectionString.StartsWith("${"))
{
    throw new InvalidOperationException("DB_CONNECTION_STRING environment variable is not configured. Set it before starting the application.");
}

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSignalR();
builder.Services.Configure<LiveGamesOptions>(builder.Configuration.GetSection("LiveGames"));
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders =
        ForwardedHeaders.XForwardedFor |
        ForwardedHeaders.XForwardedProto |
        ForwardedHeaders.XForwardedHost;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// Log allowed origins for debugging
Console.WriteLine("=== CORS Configuration ===");
Console.WriteLine($"Allowed Origins ({allowedOrigins.Length}):");
foreach (var origin in allowedOrigins)
{
    Console.WriteLine($"  - '{origin}'");
}
Console.WriteLine("==========================");

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        policy =>
        {
            policy.SetIsOriginAllowed(IsOriginAllowed)
                  .AllowAnyMethod()
                  .AllowAnyHeader()
                  .AllowCredentials();
        });
    options.AddPolicy("SignalR",
        policy =>
        {
            policy.SetIsOriginAllowed(IsOriginAllowed)
                  .AllowAnyMethod()
                  .AllowAnyHeader()
                  .AllowCredentials();
        });
});

builder.Services.AddScoped<AuthService>();
builder.Services.AddSingleton<ILiveGameCatalogService, LiveGameCatalogService>();
builder.Services.AddSingleton<StatsNotificationService>();

builder.Services.AddDbContext<CasinoContext>(options =>
    options.UseMySql(dbConnectionString, ServerVersion.AutoDetect(dbConnectionString)));

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
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
        
        // === SECURITY: Allow JWT in SignalR query string ===
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });


var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<CasinoContext>();

    try
    {
        var sessionSql = @"
            SET @dbname = DATABASE();
            SET @tablename = 'users';
            SET @columnname = 'session_token';
            SET @preparedStatement = (SELECT IF(
                (
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE
                        (table_name = @tablename)
                        AND (table_schema = @dbname)
                        AND (column_name = @columnname)
                ) > 0,
                'SELECT 1',
                'ALTER TABLE users ADD COLUMN session_token VARCHAR(100) NULL;'
            ));
            PREPARE alterIfNotExists FROM @preparedStatement;
            EXECUTE alterIfNotExists;
            DEALLOCATE PREPARE alterIfNotExists;
        ";
        context.Database.ExecuteSqlRaw(sessionSql);
        Console.WriteLine("[Startup] User session_token column ensured.");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Startup] Warning: Could not ensure session_token column: {ex.Message}");
    }
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// app.UseHttpsRedirection();
app.UseForwardedHeaders();
app.UseCors("AllowAll");
app.UseStaticFiles();

app.UseAuthentication();
app.UseMiddleware<Backend.Middleware.UserSessionMiddleware>();
app.UseAuthorization();

app.MapControllers();
app.MapHub<StatsHub>("/hubs/stats").RequireCors("SignalR");

app.Run();
