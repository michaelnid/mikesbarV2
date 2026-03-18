using Backend.Data;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Backend.Controllers;

[Route("api/admin/live-game-plugins")]
[ApiController]
[Authorize(Roles = "ADMIN")]
public class LiveGamePluginPackagesController : ControllerBase
{
    private readonly ILiveGamePluginPackageService _pluginPackageService;
    private readonly CasinoContext _context;

    public LiveGamePluginPackagesController(ILiveGamePluginPackageService pluginPackageService, CasinoContext context)
    {
        _pluginPackageService = pluginPackageService;
        _context = context;
    }

    [HttpGet]
    public ActionResult<IEnumerable<object>> GetInstalledPackages()
    {
        var packages = _pluginPackageService.GetInstalledPackages()
            .OrderBy(package => package.SortOrder)
            .ThenBy(package => package.Name, StringComparer.OrdinalIgnoreCase)
            .Select(package => new
            {
                package.Key,
                package.Name,
                package.Version,
                package.Description,
                package.Developer,
                package.ClientRoute,
                package.LaunchMode,
                package.DealerSelectable,
                package.RequiresPlayerSession,
                package.DefaultEnabled,
                package.SortOrder,
                package.AccentColor,
                package.ExternalLaunchUrl,
                package.UploadedFileName,
                package.InstalledAtUtc
            });

        return Ok(packages);
    }

    [HttpPost("upload")]
    [RequestFormLimits(MultipartBodyLengthLimit = 10 * 1024 * 1024)]
    public async Task<IActionResult> UploadPackage([FromForm] IFormFile? file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { message = "Es wurde keine Plugin-ZIP hochgeladen." });
        }

        try
        {
            await using var stream = file.OpenReadStream();
            var package = await _pluginPackageService.InstallAsync(stream, file.FileName, cancellationToken);

            var existingSetting = await _context.GameSettings
                .FirstOrDefaultAsync(setting => setting.GameKey == package.Key, cancellationToken);

            if (existingSetting == null)
            {
                _context.GameSettings.Add(new Backend.Models.GameSetting
                {
                    GameKey = package.Key,
                    GameName = package.Name,
                    IsEnabled = package.DefaultEnabled
                });
            }
            else
            {
                existingSetting.GameName = package.Name;
                existingSetting.IsEnabled = package.DefaultEnabled;
                existingSetting.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                message = "Plugin-Paket wurde installiert.",
                package
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{key}")]
    public async Task<IActionResult> DeletePackage(string key, CancellationToken cancellationToken)
    {
        var normalizedKey = key?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(normalizedKey))
        {
            return BadRequest(new { message = "Plugin-Key fehlt." });
        }

        try
        {
            await _pluginPackageService.RemoveAsync(normalizedKey, cancellationToken);

            var setting = await _context.GameSettings
                .FirstOrDefaultAsync(item => item.GameKey == normalizedKey, cancellationToken);
            if (setting != null)
            {
                _context.GameSettings.Remove(setting);
            }

            var dealers = await _context.Dealers
                .Where(dealer => dealer.CurrentGame == normalizedKey)
                .ToListAsync(cancellationToken);
            foreach (var dealer in dealers)
            {
                dealer.CurrentGame = null;
                dealer.LastActivityAt = DateTime.UtcNow;
            }

            var activeSessions = await _context.TableSessions
                .Where(session => session.Game == normalizedKey && session.LeftAt == null)
                .ToListAsync(cancellationToken);
            foreach (var session in activeSessions)
            {
                session.LeftAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync(cancellationToken);
            return Ok(new { message = "Plugin-Paket wurde deinstalliert." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
