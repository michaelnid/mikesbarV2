namespace Mikesbar.PluginSdk.LiveGames;

public sealed class LiveGamePluginFrontendDefinition
{
    public string EntryPoint { get; set; } = "frontend/dist/index.html";
    public string BasePath { get; set; } = "frontend/dist";
}
