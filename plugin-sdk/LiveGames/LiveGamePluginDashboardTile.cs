namespace Mikesbar.PluginSdk.LiveGames;

public sealed class LiveGamePluginDashboardTile
{
    public string Surface { get; set; } = "player";
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Route { get; set; } = string.Empty;
    public string IconPath { get; set; } = string.Empty;
    public string AccentColor { get; set; } = "neutral";
    public string RequiredPermission { get; set; } = "PLAYER";
    public bool VisibleByDefault { get; set; } = true;
}
