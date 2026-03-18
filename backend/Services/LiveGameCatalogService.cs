using Backend.Options;
using Microsoft.Extensions.Options;

namespace Backend.Services;

public interface ILiveGameCatalogService
{
    IReadOnlyList<LiveGamePluginDescriptor> GetAll();
    IReadOnlyList<LiveGamePluginDescriptor> GetDealerSelectable();
    LiveGamePluginDescriptor? FindDealerGame(string gameKey);
}

public sealed record LiveGamePluginDescriptor(
    string Key,
    string Name,
    string Description,
    string ClientRoute,
    string LaunchMode,
    bool DealerSelectable,
    bool RequiresPlayerSession,
    bool DefaultEnabled,
    int SortOrder,
    string AccentColor,
    string Source,
    string Version,
    string Developer,
    string? ExternalLaunchUrl,
    DateTimeOffset? InstalledAtUtc);

public sealed class LiveGameCatalogService : ILiveGameCatalogService
{
    private static readonly IReadOnlyList<LiveGamePluginDescriptor> FallbackPlugins =
    [
        new("bank", "Bank", "Allgemeine Kasse ohne aktiven Live-Tisch.", "/dealer/bank", "direct", true, false, true, 0, "amber", "builtin", "system", "mikesBAR", null, null),
        new("blackjack", "Blackjack", "Klassischer Live-Tisch mit gemeinsamer Spielerverwaltung.", "/dealer/players", "table", true, true, true, 10, "emerald", "builtin", "system", "mikesBAR", null, null),
        new("roulette", "Roulette", "Roulette-Tisch für Dealer und externe API-Clients.", "/dealer/players", "table", true, true, true, 20, "red", "builtin", "system", "mikesBAR", null, null),
        new("ultimate_poker", "Ultimate Poker", "Poker-Tisch für Live-Runden und angebundene Apps.", "/dealer/players", "table", true, true, true, 30, "blue", "builtin", "system", "mikesBAR", null, null),
        new("craps", "Craps", "Craps-Tisch mit zentraler Sitzungsverwaltung.", "/dealer/players", "table", true, true, true, 40, "slate", "builtin", "system", "mikesBAR", null, null)
    ];

    private readonly IReadOnlyList<LiveGamePluginDescriptor> _configuredPlugins;
    private readonly ILiveGamePluginPackageService _pluginPackageService;

    public LiveGameCatalogService(IOptions<LiveGamesOptions> options, ILiveGamePluginPackageService pluginPackageService)
    {
        _configuredPlugins = Normalize(options.Value.Plugins);
        _pluginPackageService = pluginPackageService;
    }

    public IReadOnlyList<LiveGamePluginDescriptor> GetAll()
    {
        var plugins = _configuredPlugins.Count > 0
            ? _configuredPlugins.ToList()
            : FallbackPlugins.ToList();

        foreach (var package in _pluginPackageService.GetInstalledPackages())
        {
            plugins.RemoveAll(plugin => plugin.Key.Equals(package.Key, StringComparison.OrdinalIgnoreCase));
            plugins.Add(new LiveGamePluginDescriptor(
                package.Key,
                package.Name,
                package.Description,
                package.ClientRoute,
                package.LaunchMode,
                package.DealerSelectable,
                package.RequiresPlayerSession,
                package.DefaultEnabled,
                package.SortOrder,
                package.AccentColor,
                "package",
                package.Version,
                string.IsNullOrWhiteSpace(package.Developer) ? "Unbekannt" : package.Developer,
                package.ExternalLaunchUrl,
                package.InstalledAtUtc));
        }

        return plugins
            .OrderBy(plugin => plugin.SortOrder)
            .ThenBy(plugin => plugin.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    public IReadOnlyList<LiveGamePluginDescriptor> GetDealerSelectable() =>
        GetAll()
            .Where(plugin => plugin.DealerSelectable)
            .OrderBy(plugin => plugin.SortOrder)
            .ThenBy(plugin => plugin.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();

    public LiveGamePluginDescriptor? FindDealerGame(string gameKey)
    {
        if (string.IsNullOrWhiteSpace(gameKey))
        {
            return null;
        }

        var normalizedKey = gameKey.Trim().ToLowerInvariant();
        return GetAll().FirstOrDefault(plugin => plugin.DealerSelectable && plugin.Key == normalizedKey);
    }

    private static IReadOnlyList<LiveGamePluginDescriptor> Normalize(IEnumerable<LiveGamePluginOptions>? configuredPlugins)
    {
        var normalizedPlugins = new List<LiveGamePluginDescriptor>();
        var seenKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var plugin in configuredPlugins ?? Enumerable.Empty<LiveGamePluginOptions>())
        {
            var key = plugin.Key?.Trim().ToLowerInvariant();
            var name = plugin.Name?.Trim();

            if (string.IsNullOrWhiteSpace(key) || string.IsNullOrWhiteSpace(name) || !seenKeys.Add(key))
            {
                continue;
            }

            normalizedPlugins.Add(new LiveGamePluginDescriptor(
                key,
                name,
                plugin.Description?.Trim() ?? string.Empty,
                string.IsNullOrWhiteSpace(plugin.ClientRoute) ? "/dealer/players" : plugin.ClientRoute.Trim(),
                string.IsNullOrWhiteSpace(plugin.LaunchMode) ? "table" : plugin.LaunchMode.Trim().ToLowerInvariant(),
                plugin.DealerSelectable,
                plugin.RequiresPlayerSession,
                plugin.DefaultEnabled,
                plugin.SortOrder,
                string.IsNullOrWhiteSpace(plugin.AccentColor) ? "neutral" : plugin.AccentColor.Trim().ToLowerInvariant(),
                "builtin",
                "system",
                "mikesBAR",
                string.IsNullOrWhiteSpace(plugin.ExternalLaunchUrl) ? null : plugin.ExternalLaunchUrl.Trim(),
                null));
        }

        return normalizedPlugins.Count > 0
            ? normalizedPlugins
            : FallbackPlugins;
    }
}
