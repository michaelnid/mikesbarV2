using System.Security.Claims;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

[ApiController]
public class PluginRuntimeController : ControllerBase
{
    private readonly ILiveGamePluginRuntimeService _runtimeService;

    public PluginRuntimeController(ILiveGamePluginRuntimeService runtimeService)
    {
        _runtimeService = runtimeService;
    }

    [AllowAnonymous]
    [HttpGet("api/plugin-runtime/dashboard/{surface}")]
    public IActionResult GetDashboardTiles(string surface)
    {
        var normalizedSurface = surface?.Trim().ToLowerInvariant();
        if (normalizedSurface is not ("player" or "management" or "home"))
        {
            return BadRequest(new { message = "Ungültige Dashboard-Fläche." });
        }

        var tiles = _runtimeService.GetLoadedPlugins()
            .SelectMany(plugin => plugin.Package.DashboardTiles.Select(tile => new { plugin, tile }))
            .Where(item => item.tile.Surface.Equals(normalizedSurface, StringComparison.OrdinalIgnoreCase))
            .Where(item => IsTileVisible(item.tile.RequiredPermission))
            .Select(item => new
            {
                key = item.plugin.Package.Key,
                title = item.tile.Title,
                description = item.tile.Description,
                route = string.IsNullOrWhiteSpace(item.tile.Route) ? $"/plugins/{item.plugin.Package.Key}" : item.tile.Route,
                accentColor = item.tile.AccentColor,
                iconUrl = string.IsNullOrWhiteSpace(item.tile.IconPath) ? null : $"/plugin-runtime/{item.plugin.Package.Key}/{item.tile.IconPath}",
                requiredPermission = item.tile.RequiredPermission
            })
            .ToList();

        return Ok(tiles);
    }

    [AllowAnonymous]
    [Route("api/plugin-runtime/{pluginKey}/{**path}")]
    public async Task<IActionResult> DispatchPluginApi(string pluginKey, string? path, CancellationToken cancellationToken)
    {
        var plugin = _runtimeService.GetPlugin(pluginKey);
        if (plugin is null)
        {
            return NotFound(new { message = "Plugin nicht gefunden." });
        }

        if (!plugin.Package.AllowAnonymousApi && User.Identity?.IsAuthenticated != true)
        {
            return Unauthorized(new { message = "Authentifizierung erforderlich." });
        }

        if (!plugin.Package.AllowAnonymousApi && !HasPermission(plugin.Package.ApiRequiredPermission))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Keine Berechtigung für dieses Plugin." });
        }

        HttpContext.Items["LiveGamePlugin"] = plugin;
        HttpContext.Items["LiveGamePluginPath"] = path ?? string.Empty;
        await plugin.Instance.HandleRequestAsync(HttpContext, cancellationToken);

        return new EmptyResult();
    }

    [AllowAnonymous]
    [HttpGet("plugin-runtime/{pluginKey}/{**assetPath}")]
    public IActionResult GetPluginFrontendAsset(string pluginKey, string? assetPath)
    {
        var plugin = _runtimeService.GetPlugin(pluginKey);
        if (plugin is null)
        {
            return NotFound();
        }

        var relativePath = string.IsNullOrWhiteSpace(assetPath) ? "index.html" : assetPath.TrimStart('/');
        var targetPath = Path.GetFullPath(Path.Combine(plugin.FrontendBaseDirectory, relativePath));
        if (!targetPath.StartsWith(Path.GetFullPath(plugin.FrontendBaseDirectory), StringComparison.Ordinal) || !System.IO.File.Exists(targetPath))
        {
            return NotFound();
        }

        var contentType = GetContentType(targetPath);
        return PhysicalFile(targetPath, contentType);
    }

    private bool IsTileVisible(string requiredPermission)
    {
        if (string.IsNullOrWhiteSpace(requiredPermission) || requiredPermission.Equals("ANONYMOUS", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return HasPermission(requiredPermission);
    }

    private bool HasPermission(string requiredPermission)
    {
        if (string.IsNullOrWhiteSpace(requiredPermission))
        {
            return true;
        }

        var normalizedPermission = requiredPermission.Trim().ToUpperInvariant();
        if (normalizedPermission == "PLAYER")
        {
            return User.Identity?.IsAuthenticated == true;
        }

        return User.Claims.Any(claim =>
            claim.Type == ClaimTypes.Role &&
            claim.Value.Equals(normalizedPermission, StringComparison.OrdinalIgnoreCase));
    }

    private static string GetContentType(string path)
    {
        return Path.GetExtension(path).ToLowerInvariant() switch
        {
            ".html" => "text/html; charset=utf-8",
            ".js" => "text/javascript; charset=utf-8",
            ".css" => "text/css; charset=utf-8",
            ".json" => "application/json; charset=utf-8",
            ".svg" => "image/svg+xml",
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".webp" => "image/webp",
            ".gif" => "image/gif",
            ".woff" => "font/woff",
            ".woff2" => "font/woff2",
            _ => "application/octet-stream"
        };
    }
}
