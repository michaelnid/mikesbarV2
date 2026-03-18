using Microsoft.AspNetCore.SignalR;

namespace Backend.Hubs;

public class StatsHub : Hub
{
    /// <summary>
    /// Client joins the stats updates channel
    /// </summary>
    public async Task JoinStatsChannel()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, "AdminStats");
    }

    /// <summary>
    /// Client leaves the stats updates channel
    /// </summary>
    public async Task LeaveStatsChannel()
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, "AdminStats");
    }
}

/// <summary>
/// Service to broadcast stats updates to connected admin clients
/// </summary>
public class StatsNotificationService
{
    private readonly IHubContext<StatsHub> _hubContext;

    public StatsNotificationService(IHubContext<StatsHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task NotifyStatsUpdate()
    {
        await _hubContext.Clients.Group("AdminStats").SendAsync("StatsUpdated");
    }

    public async Task NotifyTableUpdate(int dealerId, string action, object payload)
    {
        await _hubContext.Clients.Group("AdminStats").SendAsync("TableUpdated", new
        {
            dealerId,
            action,
            payload,
            timestamp = DateTime.UtcNow
        });
    }
}
