using Backend.Data;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Backend.Controllers;

[Route("api/[controller]")]
[ApiController]
public class LiveGamesController : ControllerBase
{
    private readonly ILiveGameCatalogService _liveGameCatalog;
    private readonly CasinoContext _context;

    public LiveGamesController(ILiveGameCatalogService liveGameCatalog, CasinoContext context)
    {
        _liveGameCatalog = liveGameCatalog;
        _context = context;
    }

    [AllowAnonymous]
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetAll()
    {
        var plugins = _liveGameCatalog.GetAll();
        var settings = await GetSettingsMapAsync(plugins.Select(plugin => plugin.Key));
        return Ok(plugins.Select(plugin => ToResponse(plugin, settings)));
    }

    [AllowAnonymous]
    [HttpGet("dealer")]
    public async Task<ActionResult<IEnumerable<object>>> GetDealerGames()
    {
        var plugins = _liveGameCatalog.GetDealerSelectable();
        var settings = await GetSettingsMapAsync(plugins.Select(plugin => plugin.Key));

        return Ok(plugins
            .Select(plugin => ToResponse(plugin, settings))
            .Where(plugin => plugin.isEnabled));
    }

    [AllowAnonymous]
    [HttpGet("{gameKey}")]
    public async Task<ActionResult<object>> GetByKey(string gameKey)
    {
        var normalizedKey = gameKey.Trim().ToLowerInvariant();
        var plugin = _liveGameCatalog.GetAll()
            .FirstOrDefault(item => item.Key == normalizedKey);

        if (plugin is null)
        {
            return NotFound(new { message = "Live-Game-Plugin nicht gefunden." });
        }

        var settings = await GetSettingsMapAsync([plugin.Key]);
        return Ok(ToResponse(plugin, settings));
    }

    private async Task<Dictionary<string, bool>> GetSettingsMapAsync(IEnumerable<string> gameKeys)
    {
        var keys = gameKeys.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        return await _context.GameSettings
            .Where(setting => keys.Contains(setting.GameKey))
            .ToDictionaryAsync(setting => setting.GameKey, setting => setting.IsEnabled, StringComparer.OrdinalIgnoreCase);
    }

    private static LiveGamePluginResponse ToResponse(LiveGamePluginDescriptor plugin, IReadOnlyDictionary<string, bool> settings)
    {
        var isEnabled = settings.TryGetValue(plugin.Key, out var configuredState)
            ? configuredState
            : plugin.DefaultEnabled;

        return new LiveGamePluginResponse(
            plugin.Key,
            plugin.Name,
            plugin.Description,
            plugin.ClientRoute,
            plugin.LaunchMode,
            plugin.DealerSelectable,
            plugin.RequiresPlayerSession,
            plugin.DefaultEnabled,
            isEnabled,
            plugin.SortOrder,
            plugin.AccentColor,
            plugin.Source,
            plugin.Version,
            plugin.Developer,
            plugin.ExternalLaunchUrl,
            plugin.InstalledAtUtc);
    }
}

public sealed record LiveGamePluginResponse(
    string key,
    string name,
    string description,
    string clientRoute,
    string launchMode,
    bool dealerSelectable,
    bool requiresPlayerSession,
    bool defaultEnabled,
    bool isEnabled,
    int sortOrder,
    string accentColor,
    string source,
    string version,
    string developer,
    string? externalLaunchUrl,
    DateTimeOffset? installedAtUtc);
