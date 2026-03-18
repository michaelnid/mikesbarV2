using Backend.Data;
using Backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Backend.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class TransactionsController : ControllerBase
{
    private readonly CasinoContext _context;

    public TransactionsController(CasinoContext context)
    {
        _context = context;
    }

    [HttpGet("my-history")]
    public async Task<ActionResult<IEnumerable<Transaction>>> GetMyHistory()
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value!);
        
        return await _context.Transactions
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.Timestamp)
            .Include(t => t.Dealer) // Include Dealer name if applicable
            .ToListAsync();
    }
    
    // For Leaderboard onClick detail view
    // SECURITY: Requires authentication - user can view any player's history
    // Consider adding privacy controls in the future
    [HttpGet("user/{userId}")]
    public async Task<ActionResult<IEnumerable<Transaction>>> GetUserHistory(int userId)
    {
         // Returns public transaction history (limited to 50 most recent)
         // Note: This may expose financial behavior patterns
         
         return await _context.Transactions
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.Timestamp)
            .Include(t => t.Dealer)
            .Take(50)
            .ToListAsync();
    }

    [HttpPost]
    [Authorize(Roles = "DEALER,ADMIN")]
    public async Task<IActionResult> CreateTransaction([FromBody] CreateTransactionDto dto)
    {
        var dealerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value!);
        var user = await _context.Users.FindAsync(dto.UserId);

        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        // Logic:
        // Amount > 0 = Deposit (User gets money)
        // Amount < 0 = Withdraw (User loses money)
        
        // For withdrawals, check balance? 
        // "Casino" usually allows debt? Or strictly prepaid?
        // Let's assume strictly prepaid for now to be safe, unless it's a "Game" loss which might tap into credit?
        // For simplicity: Allow negative balance? Or block?
        // Let's block if balance < amount for now, or just allow it and show negative.
        // User didn't specify. Let's allow negative for flexibility in a home game.
        
        user.Balance += dto.Amount;
        
        var transaction = new Transaction
        {
            UserId = user.Id,
            DealerId = dealerId,
            Game = dto.Game, // e.g. "Blackjack", "Bank"
            Amount = dto.Amount,
            Timestamp = DateTime.UtcNow
        };

        _context.Transactions.Add(transaction);
        await _context.SaveChangesAsync();

        return Ok(new { newBalance = user.Balance, transactionId = transaction.Id });
    }

    [HttpPost("transfer")]
    public async Task<IActionResult> Transfer([FromBody] TransferDto dto)
    {
        var senderId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value!);
        
        if (dto.Amount <= 0) return BadRequest("Amount must be positive");
        
        var sender = await _context.Users.FindAsync(senderId);
        var recipient = await _context.Users.FindAsync(dto.RecipientId);

        if (sender == null || recipient == null) return NotFound("User not found");
        if (sender.Id == recipient.Id) return BadRequest("Cannot transfer to self");
        if (sender.Balance < dto.Amount) return BadRequest("Insufficient funds");

        // Execute Transfer
        sender.Balance -= dto.Amount;
        recipient.Balance += dto.Amount;

        var timestamp = DateTime.UtcNow;

        // Record Sender Transaction (Negative)
        _context.Transactions.Add(new Transaction
        {
            UserId = sender.Id,
            Game = "Transfer Out",
            Amount = -dto.Amount,
            Description = $"To {recipient.Username}",
            Timestamp = timestamp
        });

        // Record Recipient Transaction (Positive)
        _context.Transactions.Add(new Transaction
        {
            UserId = recipient.Id,
            Game = "Transfer In",
            Amount = dto.Amount,
            Description = $"From {sender.Username}",
            Timestamp = timestamp
        });

        await _context.SaveChangesAsync();

        return Ok(new { newBalance = sender.Balance });
    }
}

public class TransferDto
{
    public int RecipientId { get; set; }
    public decimal Amount { get; set; }
}

public class CreateTransactionDto
{
    public int UserId { get; set; }
    public decimal Amount { get; set; }
    public string Game { get; set; } = "Bank";
}
