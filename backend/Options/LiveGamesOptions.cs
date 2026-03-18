namespace Backend.Options;

public class LiveGamesOptions
{
    public List<LiveGamePluginOptions> Plugins { get; set; } = [];
}

public class LiveGamePluginOptions
{
    public string Key { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ClientRoute { get; set; } = "/dealer/players";
    public string LaunchMode { get; set; } = "table";
    public bool DealerSelectable { get; set; } = true;
    public bool RequiresPlayerSession { get; set; } = true;
    public bool DefaultEnabled { get; set; } = true;
    public int SortOrder { get; set; }
    public string AccentColor { get; set; } = "neutral";
}
