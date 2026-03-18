using Microsoft.AspNetCore.Http;

namespace Mikesbar.PluginSdk.LiveGames;

public interface ILiveGamePlugin
{
    string Key { get; }
    Task HandleRequestAsync(HttpContext httpContext, CancellationToken cancellationToken = default);
}
