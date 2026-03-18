namespace Mikesbar.PluginSdk.LiveGames;

public sealed class LiveGamePluginManifest
{
    public string PackageType { get; set; } = "mikesbar-livegame";
    public int SchemaVersion { get; set; } = 1;
    public string Key { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Version { get; set; } = "1.0.0";
    public string Description { get; set; } = string.Empty;
    public string ClientRoute { get; set; } = "/dealer/players";
    public string LaunchMode { get; set; } = "table";
    public bool DealerSelectable { get; set; } = true;
    public bool RequiresPlayerSession { get; set; } = true;
    public bool DefaultEnabled { get; set; } = true;
    public int SortOrder { get; set; }
    public string AccentColor { get; set; } = "neutral";
    public string Developer { get; set; } = string.Empty;
    public string? ExternalLaunchUrl { get; set; }
    public string ApiRequiredPermission { get; set; } = "PLAYER";
    public bool AllowAnonymousApi { get; set; }
    public LiveGamePluginBackendDefinition Backend { get; set; } = new();
    public LiveGamePluginFrontendDefinition Frontend { get; set; } = new();
    public List<LiveGamePluginDashboardTile> DashboardTiles { get; set; } = [];
}
