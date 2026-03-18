using Backend.Data;
using Backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Backend.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class PlayerProfileController : ControllerBase
{
    private readonly CasinoContext _context;

    public PlayerProfileController(CasinoContext context)
    {
        _context = context;
    }

    /// <summary>
    /// GET /api/player-profile/{userId}
    /// Returns complete player profile with statistics (requires authentication)
    /// </summary>
    [HttpGet("{userId}")]
    public async Task<ActionResult<PlayerProfileData>> GetPlayerProfile(int userId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            return NotFound(new { message = "Player not found" });
        }

        var transactions = await _context.Transactions
            .Where(t => t.UserId == userId)
            .Include(t => t.Dealer)
            .OrderByDescending(t => t.Timestamp)
            .ToListAsync();

        // Calculate statistics
        var totalDeposits = transactions
            .Where(t => t.Amount > 0 && t.Game == "Bank")
            .Sum(t => t.Amount);

        var totalWithdrawals = transactions
            .Where(t => t.Amount < 0 && t.Game == "Bank")
            .Sum(t => Math.Abs(t.Amount));

        var totalWins = transactions
            .Where(t => t.Amount > 0 && t.Game != "Bank" && t.Game != "Transfer In")
            .Sum(t => t.Amount);

        var totalLosses = transactions
            .Where(t => t.Amount < 0 && t.Game != "Bank" && t.Game != "Transfer Out")
            .Sum(t => Math.Abs(t.Amount));

        var transfersIn = transactions
            .Where(t => t.Game == "Transfer In")
            .Sum(t => t.Amount);

        var transfersOut = transactions
            .Where(t => t.Game == "Transfer Out")
            .Sum(t => Math.Abs(t.Amount));

        // Game breakdown
        var gameBreakdown = transactions
            .GroupBy(t => t.Game)
            .Select(g => new GameStatistic
            {
                Game = g.Key,
                TransactionCount = g.Count(),
                TotalAmount = g.Sum(t => t.Amount)
            })
            .OrderByDescending(g => g.TransactionCount)
            .ToList();

        // Recent transactions (last 50)
        var recentTransactions = transactions
            .Take(50)
            .Select(t => new TransactionDetail
            {
                Id = t.Id,
                Game = t.Game,
                Amount = t.Amount,
                Description = t.Description,
                DealerName = t.Dealer?.Name,
                Timestamp = t.Timestamp
            })
            .ToList();

        return new PlayerProfileData
        {
            Id = user.Id,
            Username = user.Username,
            AvatarUrl = user.AvatarUrl,
            Balance = user.Balance,
            CreatedAt = user.CreatedAt,
            BankruptcyCount = user.BankruptcyCount,
            Statistics = new PlayerStatistics
            {
                TotalDeposits = totalDeposits,
                TotalWithdrawals = totalWithdrawals,
                TotalWins = totalWins,
                TotalLosses = totalLosses,
                TransfersIn = transfersIn,
                TransfersOut = transfersOut,
                TransactionCount = transactions.Count,
                NetProfit = totalWins - totalLosses
            },
            GameBreakdown = gameBreakdown,
            RecentTransactions = recentTransactions
        };
    }

    /// <summary>
    /// GET /api/player-profile/{userId}/chart?days=7
    /// Returns daily balance changes for chart (requires authentication)
    /// </summary>
    [HttpGet("{userId}/chart")]
    public async Task<ActionResult<IEnumerable<PlayerChartDataPoint>>> GetPlayerChartData(int userId, [FromQuery] int days = 7)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            return NotFound(new { message = "Player not found" });
        }

        var startDate = DateTime.UtcNow.Date.AddDays(-days + 1);

        var transactions = await _context.Transactions
            .Where(t => t.UserId == userId && t.Timestamp >= startDate)
            .ToListAsync();

        var result = Enumerable.Range(0, days)
            .Select(i => startDate.AddDays(i))
            .Select(date => new PlayerChartDataPoint
            {
                Date = date.ToString("dd.MM"),
                Income = transactions
                    .Where(t => t.Timestamp.Date == date && t.Amount > 0)
                    .Sum(t => t.Amount),
                Expenses = transactions
                    .Where(t => t.Timestamp.Date == date && t.Amount < 0)
                    .Sum(t => Math.Abs(t.Amount)),
                NetChange = transactions
                    .Where(t => t.Timestamp.Date == date)
                    .Sum(t => t.Amount)
            })
            .ToList();

        return result;
    }
}

// DTOs
public class PlayerProfileData
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public decimal Balance { get; set; }
    public DateTime CreatedAt { get; set; }
    public int BankruptcyCount { get; set; }
    public PlayerStatistics Statistics { get; set; } = new();
    public List<GameStatistic> GameBreakdown { get; set; } = new();
    public List<TransactionDetail> RecentTransactions { get; set; } = new();
}

public class PlayerStatistics
{
    public decimal TotalDeposits { get; set; }
    public decimal TotalWithdrawals { get; set; }
    public decimal TotalWins { get; set; }
    public decimal TotalLosses { get; set; }
    public decimal TransfersIn { get; set; }
    public decimal TransfersOut { get; set; }
    public int TransactionCount { get; set; }
    public decimal NetProfit { get; set; }
}

public class GameStatistic
{
    public string Game { get; set; } = string.Empty;
    public int TransactionCount { get; set; }
    public decimal TotalAmount { get; set; }
}

public class TransactionDetail
{
    public long Id { get; set; }
    public string Game { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string? Description { get; set; }
    public string? DealerName { get; set; }
    public DateTime Timestamp { get; set; }
}

public class PlayerChartDataPoint
{
    public string Date { get; set; } = string.Empty;
    public decimal Income { get; set; }
    public decimal Expenses { get; set; }
    public decimal NetChange { get; set; }
}
