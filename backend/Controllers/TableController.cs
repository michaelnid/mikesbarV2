using Backend.Data;
using Backend.Hubs;
using Backend.Models;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Backend.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(Roles = "DEALER,ADMIN")]
public class TableController : ControllerBase
{
    private readonly CasinoContext _context;
    private readonly StatsNotificationService _statsNotification;
    private readonly ILiveGameCatalogService _liveGameCatalog;

    public TableController(
        CasinoContext context,
        StatsNotificationService statsNotification,
        ILiveGameCatalogService liveGameCatalog)
    {
        _context = context;
        _statsNotification = statsNotification;
        _liveGameCatalog = liveGameCatalog;
    }

    /// <summary>
    /// POST /api/table/join
    /// Dealer scans a player to join the table
    /// </summary>
    [HttpPost("join")]
    public async Task<IActionResult> JoinTable([FromBody] JoinTableDto dto)
    {
        var dealerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value!);
        var dealer = await _context.Dealers.FindAsync(dealerId);
        
        if (dealer == null) return NotFound("Dealer not found");

        var user = await _context.Users.FindAsync(dto.UserId);
        if (user == null) return NotFound("User not found");

        // Check if player is already at ANY active table (not just this one)
        var existingSession = await _context.TableSessions
            .Include(s => s.Dealer)
            .FirstOrDefaultAsync(s => s.UserId == dto.UserId && s.LeftAt == null);

        if (existingSession != null)
        {
            if (existingSession.DealerId == dealerId)
                return BadRequest(new { message = "Spieler ist bereits an deinem Tisch" });
            else
                return BadRequest(new { message = $"Spieler ist bereits am Tisch von {existingSession.Dealer?.Name ?? "anderem Dealer"}" });
        }

        // Create new session
        var session = new TableSession
        {
            DealerId = dealerId,
            UserId = dto.UserId,
            Game = dealer.CurrentGame ?? "bank",
            JoinedAt = DateTime.UtcNow
        };

        _context.TableSessions.Add(session);

        // Update dealer activity
        dealer.LastActivityAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        // Notify admin dashboard
        await _statsNotification.NotifyTableUpdate(dealerId, "join", new { user.Id, user.Username });

        return Ok(new { 
            message = $"{user.Username} ist dem Tisch beigetreten",
            session = new {
                id = session.Id,
                userId = user.Id,
                username = user.Username,
                avatarUrl = user.AvatarUrl,
                joinedAt = session.JoinedAt
            }
        });
    }

    /// <summary>
    /// POST /api/table/leave
    /// Remove a player from the table
    /// </summary>
    [HttpPost("leave")]
    public async Task<IActionResult> LeaveTable([FromBody] LeaveTableDto dto)
    {
        var dealerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value!);

        var session = await _context.TableSessions
            .FirstOrDefaultAsync(s => s.DealerId == dealerId && s.UserId == dto.UserId && s.LeftAt == null);

        if (session == null)
            return NotFound("Spieler ist nicht am Tisch");

        session.LeftAt = DateTime.UtcNow;

        var dealer = await _context.Dealers.FindAsync(dealerId);
        if (dealer != null) dealer.LastActivityAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        // Notify admin dashboard
        await _statsNotification.NotifyTableUpdate(dealerId, "leave", new { userId = dto.UserId });

        return Ok(new { message = "Spieler hat den Tisch verlassen" });
    }

    /// <summary>
    /// GET /api/table/players
    /// Get all players currently at this dealer's table
    /// </summary>
    [HttpGet("players")]
    public async Task<ActionResult<IEnumerable<object>>> GetTablePlayers()
    {
        var dealerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value!);

        var players = await _context.TableSessions
            .Where(s => s.DealerId == dealerId && s.LeftAt == null)
            .Include(s => s.User)
            .Select(s => new {
                sessionId = s.Id,
                userId = s.User!.Id,
                username = s.User.Username,
                avatarUrl = s.User.AvatarUrl,
                balance = s.User.Balance,
                joinedAt = s.JoinedAt
            })
            .ToListAsync();

        return Ok(players);
    }

    /// <summary>
    /// POST /api/table/set-game
    /// Set the dealer's current game (called when selecting a game)
    /// </summary>
    [HttpPost("set-game")]
    public async Task<IActionResult> SetGame([FromBody] SetGameDto dto)
    {
        var dealerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value!);
        var dealer = await _context.Dealers.FindAsync(dealerId);
        var liveGame = _liveGameCatalog.FindDealerGame(dto.Game);

        if (dealer == null) return NotFound("Dealer not found");
        if (liveGame == null)
            return BadRequest(new { message = "Unbekanntes oder nicht freigeschaltetes Live-Spiel." });

        var gameSetting = await _context.GameSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(setting => setting.GameKey == liveGame.Key);

        if (gameSetting is not null && !gameSetting.IsEnabled)
            return BadRequest(new { message = $"{liveGame.Name} ist aktuell deaktiviert." });

        dealer.CurrentGame = liveGame.Key;
        dealer.LastActivityAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        // Notify admin dashboard
        await _statsNotification.NotifyTableUpdate(dealerId, "game", new { game = liveGame.Key, gameName = liveGame.Name });

        return Ok(new
        {
            message = $"Spiel auf {liveGame.Name} gesetzt",
            game = new
            {
                key = liveGame.Key,
                name = liveGame.Name
            }
        });
    }

    /// <summary>
    /// POST /api/table/end-session
    /// End the current table session (all players leave, game cleared)
    /// </summary>
    [HttpPost("end-session")]
    public async Task<IActionResult> EndSession()
    {
        var dealerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value!);
        var dealer = await _context.Dealers.FindAsync(dealerId);

        if (dealer == null) return NotFound("Dealer not found");

        // Close all active sessions for this dealer
        var activeSessions = await _context.TableSessions
            .Where(s => s.DealerId == dealerId && s.LeftAt == null)
            .ToListAsync();

        foreach (var session in activeSessions)
        {
            session.LeftAt = DateTime.UtcNow;
        }

        dealer.CurrentGame = null;
        dealer.LastActivityAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        // Notify admin dashboard
        await _statsNotification.NotifyTableUpdate(dealerId, "end", new { closedSessions = activeSessions.Count });

        return Ok(new { message = "Tisch-Session beendet", closedSessions = activeSessions.Count });
    }
}

public class JoinTableDto
{
    public int UserId { get; set; }
}

public class LeaveTableDto
{
    public int UserId { get; set; }
}

public class SetGameDto
{
    public string Game { get; set; } = string.Empty;
}
