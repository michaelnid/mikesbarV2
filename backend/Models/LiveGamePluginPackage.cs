using Mikesbar.PluginSdk.LiveGames;

namespace Backend.Models;

public sealed class LiveGamePluginInstallMetadata
{
    public string UploadedFileName { get; set; } = string.Empty;
    public DateTimeOffset InstalledAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public string Sha256 { get; set; } = string.Empty;
}

public sealed record InstalledLiveGamePluginPackage(
    string Key,
    string Name,
    string Version,
    string Description,
    string Developer,
    string ClientRoute,
    string LaunchMode,
    bool DealerSelectable,
    bool RequiresPlayerSession,
    bool DefaultEnabled,
    int SortOrder,
    string AccentColor,
    string? ExternalLaunchUrl,
    string ApiRequiredPermission,
    bool AllowAnonymousApi,
    string BackendAssemblyPath,
    string BackendTypeName,
    string FrontendEntryPoint,
    string FrontendBasePath,
    IReadOnlyList<LiveGamePluginDashboardTile> DashboardTiles,
    string UploadedFileName,
    DateTimeOffset InstalledAtUtc,
    string Sha256);
