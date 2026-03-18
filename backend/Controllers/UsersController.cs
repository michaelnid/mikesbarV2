using Backend.Data;
using Backend.Models;
using Backend.Models.DTO;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Backend.Controllers;

[Route("api/[controller]")]
[ApiController]
public class UsersController : ControllerBase
{
    private readonly CasinoContext _context;
    private readonly AuthService _authService;

    public UsersController(CasinoContext context, AuthService authService)
    {
        _context = context;
        _authService = authService;
    }

    [HttpGet("leaderboard")]
    public async Task<ActionResult<IEnumerable<User>>> GetLeaderboard()
    {
        return await _context.Users
            .Where(u => u.IsActive)
            .OrderByDescending(u => u.Balance)
            .Select(u => new User 
            { 
                Id = u.Id, 
                Username = u.Username, 
                Balance = u.Balance, 
                AvatarUrl = u.AvatarUrl,
                Role = u.Role,
                Permissions = u.Permissions
                // Don't return sensitive info like PinHash or QrCodeUuid for public leaderboard
            })
            .ToListAsync();
    }

    [HttpGet("qr/{uuid}")]
    public async Task<ActionResult<User>> GetUserByQr(string uuid)
    {
        if (!Guid.TryParse(uuid, out Guid guid))
        {
             return BadRequest(new { message = "Ungültiges QR-Code Format" });
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.QrCodeUuid == guid);
        
        if (user == null) 
        {
            return NotFound(new { message = "QR Code unbekannt" });
        }

        // Return user info similarly to Leaderboard (hide secrets)
        return new User 
        { 
            Id = user.Id, 
            Username = user.Username, 
            Balance = user.Balance, 
            AvatarUrl = user.AvatarUrl,
            Role = user.Role,
            Permissions = user.Permissions
        };
    }

    [Authorize]
    [HttpPost("change-pin")]
    public async Task<IActionResult> ChangePin([FromBody] ChangePinRequest request)
    {
        // Get User ID from Token
        var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(new { message = "Invalid Token" });
        }

        var user = await _context.Users.FindAsync(userId);
        if (user == null) return NotFound(new { message = "User not found" });

        // Verify Old PIN
        if (!_authService.VerifyPin(user.PinHash, request.OldPin))
        {
            return BadRequest(new { message = "Falscher alter PIN" });
        }

        // Set New PIN
        user.PinHash = _authService.HashPin(request.NewPin);
        await _context.SaveChangesAsync();

        return Ok(new { message = "PIN erfolgreich geändert" });
    }
    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<User>> GetMe()
    {
        var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized();
        }

        var user = await _context.Users.FindAsync(userId);
        if (user == null) return NotFound();

        return user;
    }
}
