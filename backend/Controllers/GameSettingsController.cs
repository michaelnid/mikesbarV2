using Backend.Data;
using Backend.Models;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Backend.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class GameSettingsController : ControllerBase
{
    private readonly CasinoContext _context;
    private readonly ILiveGameCatalogService _liveGameCatalog;

    public GameSettingsController(CasinoContext context, ILiveGameCatalogService liveGameCatalog)
    {
        _context = context;
        _liveGameCatalog = liveGameCatalog;
    }

    /// <summary>
    /// Get all game settings (public - needed for frontend to show available games)
    /// </summary>
    [AllowAnonymous]
    [HttpGet]
    public async Task<ActionResult<IEnumerable<GameSetting>>> GetAllSettings()
    {
        var settings = await _context.GameSettings.ToListAsync();
        var knownGames = _liveGameCatalog.GetAll().Select(plugin => new GameSetting
        {
            GameKey = plugin.Key,
            GameName = plugin.Name,
            IsEnabled = plugin.DefaultEnabled
        });

        bool changeMade = false;
        foreach (var game in knownGames)
        {
            if (!settings.Any(s => s.GameKey == game.GameKey))
            {
                _context.GameSettings.Add(game);
                settings.Add(game);
                changeMade = true;
            }
        }

        if (changeMade)
        {
            await _context.SaveChangesAsync();
        }

        return settings
            .OrderBy(setting => setting.GameName, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    /// <summary>
    /// Check if a specific game is enabled (public)
    /// </summary>
    [AllowAnonymous]
    [HttpGet("{gameKey}")]
    public async Task<ActionResult<object>> IsGameEnabled(string gameKey)
    {
        var normalizedKey = gameKey.Trim().ToLowerInvariant();
        var setting = await _context.GameSettings
            .FirstOrDefaultAsync(g => g.GameKey == normalizedKey);

        return Ok(new
        {
            gameKey = normalizedKey,
            isEnabled = setting?.IsEnabled ?? false
        });
    }

    /// <summary>
    /// Toggle a game's enabled status (Admin only)
    /// </summary>
    [Authorize(Roles = "ADMIN")]
    [HttpPut("{gameKey}")]
    public async Task<ActionResult<GameSetting>> ToggleGame(string gameKey, [FromBody] GameToggleRequest request)
    {
        var setting = await _context.GameSettings
            .FirstOrDefaultAsync(g => g.GameKey == gameKey.ToLower());
        
        if (setting == null)
        {
            // Create new setting
            setting = new GameSetting
            {
                GameKey = gameKey.ToLower(),
                GameName = request.GameName ?? gameKey,
                IsEnabled = request.IsEnabled
            };
            _context.GameSettings.Add(setting);
        }
        else
        {
            setting.IsEnabled = request.IsEnabled;
            if (!string.IsNullOrWhiteSpace(request.GameName))
            {
                setting.GameName = request.GameName;
            }
            setting.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return setting;
    }
}

public class GameToggleRequest
{
    public bool IsEnabled { get; set; }
    public string? GameName { get; set; }
}
