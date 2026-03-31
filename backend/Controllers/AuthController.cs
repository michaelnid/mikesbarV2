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
        var user = await FindUserByCredentialsAsync(request.Credentials);

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
        var user = await FindUserByCredentialsAsync(request.Credentials);

        if (user == null || !_authService.VerifyPin(user.PinHash, request.Pin))
        {
            return Unauthorized(new { message = "Invalid credentials" });
        }

        if (!user.IsActive)
        {
            return Unauthorized(new { message = "User is inactive" });
        }

        if (!user.HasPermission("DEALER"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Kein Dealer-Zugang für dieses Konto" });
        }

        var dealer = await EnsureDealerProfileAsync(user);

        dealer.SessionToken = Guid.NewGuid().ToString("N").Substring(0, 20);
        dealer.LastActivityAt = DateTime.UtcNow;

        var activeSessions = await _context.TableSessions
            .Where(s => s.DealerId == dealer.Id && s.LeftAt == null)
            .ToListAsync();

        foreach (var session in activeSessions)
        {
            session.LeftAt = DateTime.UtcNow;
        }

        dealer.CurrentGame = null;

        await _context.SaveChangesAsync();

        var token = _authService.GenerateToken(dealer);
        return Ok(new
        {
            token,
            dealer = new
            {
                dealer.Id,
                dealer.Name,
                dealer.CurrentGame,
                dealer.LastActivityAt,
                dealer.UserId
            },
            user = new
            {
                user.Id,
                user.Username,
                permissionGroups = user.PermissionGroups
            }
        });
    }

    /// <summary>
    /// Switch an existing user session to a dealer session without re-entering credentials.
    /// Requires the user to have the DEALER permission.
    /// </summary>
    [HttpPost("dealer-session")]
    [Authorize]
    public async Task<IActionResult> CreateDealerSession()
    {
        var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var actorType = User.FindFirst("actor_type")?.Value;

        if (actorType == "dealer_profile" || string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            return BadRequest(new { message = "Invalid token type" });

        var user = await _context.Users.FindAsync(userId);
        if (user == null || !user.IsActive)
            return Unauthorized(new { message = "User not found or inactive" });

        if (!user.HasPermission("DEALER"))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Kein Dealer-Zugang für dieses Konto" });

        var dealer = await EnsureDealerProfileAsync(user);

        dealer.SessionToken = Guid.NewGuid().ToString("N").Substring(0, 20);
        dealer.LastActivityAt = DateTime.UtcNow;

        var activeSessions = await _context.TableSessions
            .Where(s => s.DealerId == dealer.Id && s.LeftAt == null)
            .ToListAsync();

        foreach (var session in activeSessions)
            session.LeftAt = DateTime.UtcNow;

        dealer.CurrentGame = null;
        await _context.SaveChangesAsync();

        var token = _authService.GenerateToken(dealer);
        return Ok(new
        {
            token,
            dealer = new
            {
                dealer.Id,
                dealer.Name,
                dealer.CurrentGame,
                dealer.LastActivityAt,
                dealer.UserId
            }
        });
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

    private async Task<User?> FindUserByCredentialsAsync(string credentials)
    {
        User? user = null;
        if (int.TryParse(credentials, out int userId))
        {
            user = await _context.Users.FindAsync(userId);
        }

        if (user == null)
        {
            user = await _context.Users.FirstOrDefaultAsync(u => u.Username == credentials);
        }

        return user;
    }

    private async Task<Dealer> EnsureDealerProfileAsync(User user)
    {
        var dealer = await _context.Dealers.FirstOrDefaultAsync(d => d.UserId == user.Id);
        if (dealer == null)
        {
            dealer = new Dealer
            {
                UserId = user.Id,
                Name = user.Username,
                PinHash = user.PinHash,
                IsActive = user.IsActive,
                CreatedAt = DateTime.UtcNow
            };

            _context.Dealers.Add(dealer);
            await _context.SaveChangesAsync();
            return dealer;
        }

        dealer.Name = user.Username;
        dealer.PinHash = user.PinHash;
        dealer.IsActive = user.IsActive;
        return dealer;
    }
}
