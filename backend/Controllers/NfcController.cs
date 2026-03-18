using Backend.Data;
using Backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Backend.Controllers;

[Route("api/nfc")]
[ApiController]
public class NfcController : ControllerBase
{
    private readonly CasinoContext _context;

    public NfcController(CasinoContext context)
    {
        _context = context;
    }

    [Authorize(Roles = "DEALER,ADMIN")]
    [HttpGet("{cardUid}")]
    public async Task<ActionResult<object>> GetUserByNfc(string cardUid)
    {
        var nfcCard = await _context.NfcCards
            .Include(n => n.User)
            .FirstOrDefaultAsync(n => n.CardUid == cardUid);

        if (nfcCard == null || nfcCard.User == null)
        {
            return NotFound("Card not assigned to any user");
        }

        // SECURITY: Return only essential fields, not the full User object
        return new 
        {
            Id = nfcCard.User.Id,
            Username = nfcCard.User.Username,
            Balance = nfcCard.User.Balance,
            AvatarUrl = nfcCard.User.AvatarUrl
        };
    }

    [Authorize(Roles = "ADMIN,DEALER")]
    [HttpPost("assign")]
    public async Task<IActionResult> AssignCard([FromBody] AssignCardDto dto)
    {
        var user = await _context.Users.FindAsync(dto.UserId);
        if (user == null) return NotFound("User not found");

        var existingCard = await _context.NfcCards.FindAsync(dto.CardUid);
        if (existingCard != null)
        {
            // Update existing assignment
            existingCard.UserId = dto.UserId;
            existingCard.AssignedAt = DateTime.UtcNow;
        }
        else
        {
            // Create new assignment
            _context.NfcCards.Add(new NfcCard
            {
                CardUid = dto.CardUid,
                UserId = dto.UserId,
                AssignedAt = DateTime.UtcNow
            });
        }

        await _context.SaveChangesAsync();
        return Ok(new { message = "Card assigned successfully" });
    }
}

public class AssignCardDto
{
    public string CardUid { get; set; }
    public int UserId { get; set; }
}
