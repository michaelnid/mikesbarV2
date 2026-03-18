using Backend.Data;
using Backend.Models;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Backend.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(Roles = "ADMIN")]
public class AdminController : ControllerBase
{
    private readonly CasinoContext _context;
    private readonly AuthService _authService;
    private readonly IWebHostEnvironment _env;

    public AdminController(CasinoContext context, AuthService authService, IWebHostEnvironment env)
    {
        _context = context;
        _authService = authService;
        _env = env;
    }

    [HttpGet("users")]
    public async Task<ActionResult<IEnumerable<User>>> GetUsers()
    {
        return await _context.Users.ToListAsync();
    }

    [HttpPost("users")]
    public async Task<ActionResult<User>> CreateUser([FromBody] CreateUserDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Username) || string.IsNullOrWhiteSpace(dto.Pin))
            return BadRequest("Username and PIN are required");

        if (await _context.Users.AnyAsync(u => u.Username == dto.Username))
            return BadRequest("Username already exists");

        var permissions = NormalizePermissions(dto.PermissionGroups);

        // Neue Spieler starten immer mit 5000€ - ohne Transaktion
        var user = new User
        {
            Username = dto.Username,
            PinHash = _authService.HashPin(dto.Pin),
            Balance = 10000m,  // Festes Startguthaben
            Role = permissions.Contains("ADMIN") ? "ADMIN" : "USER",
            Permissions = string.Join(',', permissions),
            ShowDealerTile = permissions.Contains("DEALER") && (dto.ShowDealerTile ?? true),
            ShowAdminTile = permissions.Contains("ADMIN") && (dto.ShowAdminTile ?? true),
            QrCodeUuid = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        // Kein Transaktionseintrag für Startguthaben

        return CreatedAtAction(nameof(GetUsers), new { id = user.Id }, user);
    }

    [HttpDelete("users/{id}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();

        // Delete all related core records first (order matters due to FK constraints)

        // 1. Delete Transactions
        var transactions = await _context.Transactions.Where(t => t.UserId == id).ToListAsync();
        _context.Transactions.RemoveRange(transactions);
        
        // 2. Delete TableSessions
        var tableSessions = await _context.TableSessions.Where(s => s.UserId == id).ToListAsync();
        _context.TableSessions.RemoveRange(tableSessions);
        
        // 3. Delete NfcCards
        var nfcCards = await _context.NfcCards.Where(c => c.UserId == id).ToListAsync();
        _context.NfcCards.RemoveRange(nfcCards);
        
        // Save all deletions
        await _context.SaveChangesAsync();
        
        // Now delete the user
        _context.Users.Remove(user);
        await _context.SaveChangesAsync();
        
        Console.WriteLine($"[Admin] Deleted user {user.Username} (ID: {id}) and all related data");
        return NoContent();
    }

    [HttpPut("users/{id}")]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserDto dto)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();

        // 1. Update Username if provided and different
        if (!string.IsNullOrWhiteSpace(dto.Username) && user.Username != dto.Username)
        {
            if (await _context.Users.AnyAsync(u => u.Username == dto.Username && u.Id != id))
                return BadRequest("Username already taken");
            user.Username = dto.Username;
        }

        // 2. Update PIN if provided
        if (!string.IsNullOrWhiteSpace(dto.Pin))
        {
            user.PinHash = _authService.HashPin(dto.Pin);
        }

        // 3. Update Fotobox Access
        if (dto.HasFotoboxAccess.HasValue)
        {
            user.HasFotoboxAccess = dto.HasFotoboxAccess.Value;
        }

        if (dto.ShowDealerTile.HasValue)
        {
            user.ShowDealerTile = dto.ShowDealerTile.Value;
        }

        if (dto.ShowAdminTile.HasValue)
        {
            user.ShowAdminTile = dto.ShowAdminTile.Value;
        }

        if (dto.PermissionGroups is not null)
        {
            var permissions = NormalizePermissions(dto.PermissionGroups);
            user.Permissions = string.Join(',', permissions);
            user.Role = permissions.Contains("ADMIN") ? "ADMIN" : "USER";
            user.ShowDealerTile = permissions.Contains("DEALER") && (dto.ShowDealerTile ?? user.ShowDealerTile);
            user.ShowAdminTile = permissions.Contains("ADMIN") && (dto.ShowAdminTile ?? user.ShowAdminTile);

            var dealerProfile = await _context.Dealers.FirstOrDefaultAsync(d => d.UserId == user.Id);
            if (dealerProfile != null)
            {
                dealerProfile.IsActive = permissions.Contains("DEALER") && user.IsActive;
                dealerProfile.Name = user.Username;
                if (!string.IsNullOrWhiteSpace(dto.Pin))
                {
                    dealerProfile.PinHash = user.PinHash;
                }
            }
        }

        // 4. Update Balance (with Transaction)
        if (dto.Balance.HasValue && dto.Balance.Value != user.Balance)
        {
            var diff = dto.Balance.Value - user.Balance;
            // Create Transaction record
            var transaction = new Transaction
            {
                UserId = user.Id,
                Game = "ADMIN",
                Description = "Korrektur durch Admin",
                Amount = diff,
                Timestamp = DateTime.UtcNow
            };
            _context.Transactions.Add(transaction);
            
            // Update User Balance
            user.Balance = dto.Balance.Value;
        }

        var linkedDealerProfile = await _context.Dealers.FirstOrDefaultAsync(d => d.UserId == user.Id);
        if (linkedDealerProfile != null)
        {
            linkedDealerProfile.Name = user.Username;
            linkedDealerProfile.PinHash = user.PinHash;
            linkedDealerProfile.IsActive = user.IsActive && user.HasPermission("DEALER");
        }

        await _context.SaveChangesAsync();
        return Ok(user);
    }

    [HttpPost("users/{id}/avatar")]
    public async Task<IActionResult> UpdateAvatarUrl(int id, [FromBody] UpdateAvatarUrlDto dto)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();

        if (string.IsNullOrWhiteSpace(dto.AvatarUrl))
            return BadRequest("Avatar URL required");

        user.AvatarUrl = dto.AvatarUrl;
        await _context.SaveChangesAsync();

        return Ok(new { avatarUrl = user.AvatarUrl });
    }
    
    /// <summary>
    /// Declare user bankrupt - clears all transactions, resets balance to 5000, increments bankruptcy counter
    /// </summary>
    [HttpPost("users/{id}/bankruptcy")]
    public async Task<IActionResult> DeclareBankruptcy(int id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();

        // Delete all user transactions
        var transactions = await _context.Transactions.Where(t => t.UserId == id).ToListAsync();
        _context.Transactions.RemoveRange(transactions);
        await _context.SaveChangesAsync();
        
        // Reset balance to 10000 and increment bankruptcy counter - keine Transaktion
        user.Balance = 10000m;
        user.BankruptcyCount += 1;
        user.UpdatedAt = DateTime.UtcNow;
        
        await _context.SaveChangesAsync();
        
        Console.WriteLine($"[Admin] User {user.Username} declared bankrupt (#{user.BankruptcyCount}). Balance reset to 10000€");
        
        return Ok(new { 
            username = user.Username, 
            balance = user.Balance, 
            bankruptcyCount = user.BankruptcyCount,
            deletedTransactions = transactions.Count
        });
    }

    [HttpGet("dealers")]
    public async Task<ActionResult<IEnumerable<Dealer>>> GetDealers()
    {
        return await _context.Dealers.Where(d => d.IsActive).ToListAsync();
    }

    [HttpPost("dealers")]
    public async Task<ActionResult<Dealer>> CreateDealer([FromBody] CreateDealerDto dto)
    {
        if (await _context.Dealers.AnyAsync(d => d.Name == dto.Name))
            return BadRequest("Dealer name already exists");

        var dealer = new Dealer
        {
            Name = dto.Name,
            PinHash = _authService.HashPin(dto.Pin),
            IsActive = true
        };

        _context.Dealers.Add(dealer);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetDealers), new { id = dealer.Id }, dealer);
    }
    
    [HttpPut("dealers/{id}")]
    public async Task<IActionResult> UpdateDealer(int id, [FromBody] UpdateDealerDto dto)
    {
        var dealer = await _context.Dealers.FindAsync(id);
        if (dealer == null) return NotFound();

        if (!string.IsNullOrWhiteSpace(dto.Name)) dealer.Name = dto.Name;
        if (!string.IsNullOrWhiteSpace(dto.Pin)) dealer.PinHash = _authService.HashPin(dto.Pin);

        await _context.SaveChangesAsync();
        return Ok(dealer);
    }

    [HttpDelete("dealers/{id}")]
    public async Task<IActionResult> DeleteDealer(int id)
    {
        var dealer = await _context.Dealers.FindAsync(id);
        if (dealer == null) return NotFound();

        dealer.IsActive = false; // Soft delete
        await _context.SaveChangesAsync();
        return NoContent();
    }

    private static string[] NormalizePermissions(IEnumerable<string>? requestedPermissions)
    {
        var permissions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "PLAYER"
        };

        if (requestedPermissions is not null)
        {
            foreach (var permission in requestedPermissions)
            {
                var normalized = permission?.Trim().ToUpperInvariant();
                if (normalized is "DEALER" or "ADMIN" or "PLAYER")
                {
                    permissions.Add(normalized);
                }
            }
        }

        return permissions.OrderBy(permission => permission).ToArray();
    }
}

public class CreateUserDto
{
    public string Username { get; set; }
    public string Pin { get; set; }
    public string[]? PermissionGroups { get; set; }
    public bool? ShowDealerTile { get; set; }
    public bool? ShowAdminTile { get; set; }
}

public class UpdateUserDto
{
    public string? Username { get; set; }
    public string? Pin { get; set; }
    public decimal? Balance { get; set; }
    public bool? HasFotoboxAccess { get; set; }
    public string[]? PermissionGroups { get; set; }
    public bool? ShowDealerTile { get; set; }
    public bool? ShowAdminTile { get; set; }
}

public class CreateDealerDto
{
    public string Name { get; set; }
    public string Pin { get; set; }
}

public class UpdateDealerDto
{
    public string? Name { get; set; }
    public string? Pin { get; set; }
}

public class ResetPinDto { public string NewPin { get; set; } }
public class UpdateBalanceDto { public decimal NewBalance { get; set; } }
public class UpdateAvatarUrlDto { public string AvatarUrl { get; set; } }
