namespace Backend.Options;

public class PluginPackagesOptions
{
    public string StoragePath { get; set; } = string.Empty;
    public long MaxUploadBytes { get; set; } = 10 * 1024 * 1024;
}
