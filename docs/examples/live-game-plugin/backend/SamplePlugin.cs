using Microsoft.AspNetCore.Http;
using Mikesbar.PluginSdk.LiveGames;

namespace RoulettePro.Plugin;

public sealed class RouletteProPlugin : ILiveGamePlugin
{
    public string Key => "roulette_pro";

    public async Task HandleRequestAsync(HttpContext httpContext, CancellationToken cancellationToken = default)
    {
        var path = (httpContext.Items["LiveGamePluginPath"] as string ?? string.Empty).Trim('/');

        if (httpContext.Request.Method == "GET" && path == "health")
        {
            httpContext.Response.ContentType = "application/json";
            await httpContext.Response.WriteAsJsonAsync(new
            {
                status = "ok",
                plugin = Key,
                timestamp = DateTimeOffset.UtcNow
            }, cancellationToken);
            return;
        }

        httpContext.Response.StatusCode = StatusCodes.Status404NotFound;
        await httpContext.Response.WriteAsJsonAsync(new { message = "Plugin route not found" }, cancellationToken);
    }
}
