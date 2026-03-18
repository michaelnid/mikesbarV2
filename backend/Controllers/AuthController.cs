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
public class AuthController : ControllerBase
{
    private readonly CasinoContext _context;
    private readonly AuthService _authService;

    public AuthController(CasinoContext context, AuthService authService)
    {
        _context = context;
        _authService = authService;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        // Try to find user by ID or Username
        User? user = null;
        if (int.TryParse(request.Credentials, out int userId))
        {
            user = await _context.Users.FindAsync(userId);
        }
        
        if (user == null)
        {
             user = await _context.Users.FirstOrDefaultAsync(u => u.Username == request.Credentials);
        }

        if (user == null || !_authService.VerifyPin(user!.PinHash, request.Pin))
        {
            return Unauthorized(new { message = "Invalid credentials" });
        }

        if (!user.IsActive)
        {
             return Unauthorized(new { message = "User is inactive" });
        }

        // Generate new session token (invalidates all other sessions)
        user.SessionToken = Guid.NewGuid().ToString("N");
        await _context.SaveChangesAsync();

        var token = _authService.GenerateToken(user);
        return Ok(new { token, user });
    }

    [HttpPost("dealer-login")]
    public async Task<IActionResult> DealerLogin([FromBody] LoginRequest request)
    {
        // Dealer login by PIN only
        // effectively, we need to find a dealer with this PIN.
        // Since we store hashes, we might need to iterate? 
        // OR: enforce username for dealers too?
        // User requirement: "Anhand der PIN wird abgefragt welcher Dealer sich hier anmeldet."
        // This implies we need to match the PIN against all dealers.
        // This is inefficient if we have many dealers and bcrypt.
        // BUT for a home party with < 10 dealers, it's fine to load all active dealers and check.
        
        var dealers = await _context.Dealers.Where(d => d.IsActive).ToListAsync();
        foreach (var dealer in dealers)
        {
            if (_authService.VerifyPin(dealer.PinHash, request.Pin))
            {
                // Generate new session token to invalidate old sessions
                dealer.SessionToken = Guid.NewGuid().ToString("N").Substring(0, 20);
                dealer.LastActivityAt = DateTime.UtcNow;

                // End any active table sessions from previous login
                var activeSessions = await _context.TableSessions
                    .Where(s => s.DealerId == dealer.Id && s.LeftAt == null)
                    .ToListAsync();
                
                foreach (var session in activeSessions)
                {
                    session.LeftAt = DateTime.UtcNow;
                }

                // Clear current game
                dealer.CurrentGame = null;

                await _context.SaveChangesAsync();

                var token = _authService.GenerateToken(dealer);
                return Ok(new { token, dealer });
            }
        }

        return Unauthorized(new { message = "Invalid Dealer PIN" });
    }

    /// <summary>
    /// Setup endpoint - DISABLED for security
    /// Manual database seeding required for initial setup
    /// </summary>
    [HttpGet("setup")]
    [Authorize(Roles = "ADMIN")]
    public IActionResult Setup()
    {
        // SECURITY: Hardcoded credentials removed
        // To create initial admin user, use direct database access or a secure setup script
        return BadRequest(new { 
            message = "Setup endpoint disabled for security. Use direct database access or environment-based seeding for initial setup.",
            instructions = new[] {
                "1. Connect to your MySQL database directly",
                "2. Insert an admin user with a BCrypt-hashed PIN",
                "3. Use online BCrypt generators or dotnet CLI to hash your PIN",
                "Example: INSERT INTO Users (Username, PinHash, QrCodeUuid, Role, Balance) VALUES ('admin', '<bcrypt_hash>', UUID(), 'ADMIN', 0)"
            }
        });
    }

    /// <summary>
    /// Verify dealer session is still valid (not logged in on another device)
    /// </summary>
    [HttpGet("verify-dealer-session")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "DEALER")]
    public async Task<IActionResult> VerifyDealerSession()
    {
        var dealerIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var sessionTokenClaim = User.FindFirst("session_token")?.Value;

        if (string.IsNullOrEmpty(dealerIdClaim) || !int.TryParse(dealerIdClaim, out int dealerId))
        {
            return Unauthorized(new { valid = false, message = "Invalid token" });
        }

        var dealer = await _context.Dealers.FindAsync(dealerId);
        if (dealer == null)
        {
            return Unauthorized(new { valid = false, message = "Dealer not found" });
        }

        // Check if session token matches
        if (dealer.SessionToken != sessionTokenClaim)
        {
            return Unauthorized(new { valid = false, message = "Session abgelaufen - Du wurdest auf einem anderen Gerät angemeldet" });
        }

        return Ok(new { valid = true });
    }
}
