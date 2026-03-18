namespace Backend.Models;

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
}

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
    string UploadedFileName,
    DateTimeOffset InstalledAtUtc,
    string Sha256);
