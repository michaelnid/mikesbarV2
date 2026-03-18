using Backend.Data;
using Backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Backend.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(Roles = "ADMIN")]
public class StatsController : ControllerBase
{
    private readonly CasinoContext _context;

    public StatsController(CasinoContext context)
    {
        _context = context;
    }

    /// <summary>
    /// GET /api/stats/dashboard
    /// Returns widget data: total players, active dealers, total balance, today's transactions
    /// </summary>
    [HttpGet("dashboard")]
    public async Task<ActionResult<DashboardStats>> GetDashboardStats()
    {
        var today = DateTime.UtcNow.Date;

        var totalPlayers = await _context.Users
            .CountAsync(u => u.IsActive && u.Role == "USER");

        var activeDealers = await _context.Dealers
            .CountAsync(d => d.IsActive && d.LastActivityAt != null && d.LastActivityAt > DateTime.UtcNow.AddHours(-2));

        var totalBalance = await _context.Users
            .Where(u => u.IsActive && u.Role == "USER")
            .SumAsync(u => u.Balance);

        var todayTransactions = await _context.Transactions
            .Where(t => t.Timestamp >= today)
            .ToListAsync();

        var todayDeposits = todayTransactions
            .Where(t => t.Amount > 0 && t.Game == "Bank")
            .Sum(t => t.Amount);

        var todayWithdrawals = todayTransactions
            .Where(t => t.Amount < 0 && t.Game == "Bank")
            .Sum(t => Math.Abs(t.Amount));

        return new DashboardStats
        {
            TotalPlayers = totalPlayers,
            ActiveDealers = activeDealers,
            TotalBalance = totalBalance,
            TodayTransactionCount = todayTransactions.Count,
            TodayDeposits = todayDeposits,
            TodayWithdrawals = todayWithdrawals
        };
    }

    /// <summary>
    /// GET /api/stats/charts?days=7
    /// Returns daily deposits/withdrawals for charts
    /// </summary>
    [HttpGet("charts")]
    public async Task<ActionResult<IEnumerable<ChartDataPoint>>> GetChartData([FromQuery] int days = 7)
    {
        var startDate = DateTime.UtcNow.Date.AddDays(-days + 1);

        var transactions = await _context.Transactions
            .Where(t => t.Timestamp >= startDate)
            .ToListAsync();

        var result = Enumerable.Range(0, days)
            .Select(i => startDate.AddDays(i))
            .Select(date => new ChartDataPoint
            {
                Date = date.ToString("dd.MM"),
                Deposits = transactions
                    .Where(t => t.Timestamp.Date == date && t.Amount > 0 && t.Game == "Bank")
                    .Sum(t => t.Amount),
                Withdrawals = transactions
                    .Where(t => t.Timestamp.Date == date && t.Amount < 0 && t.Game == "Bank")
                    .Sum(t => Math.Abs(t.Amount))
            })
            .ToList();

        return result;
    }

    /// <summary>
    /// GET /api/stats/top-players?type=winners|losers
    /// Returns top 5 winners or losers for today
    /// </summary>
    [HttpGet("top-players")]
    public async Task<ActionResult<IEnumerable<TopPlayer>>> GetTopPlayers([FromQuery] string type = "winners")
    {
        var today = DateTime.UtcNow.Date;

        var todayChanges = await _context.Transactions
            .Where(t => t.Timestamp >= today)
            .GroupBy(t => t.UserId)
            .Select(g => new { UserId = g.Key, TodayChange = g.Sum(t => t.Amount) })
            .ToListAsync();

        var userIds = todayChanges.Select(x => x.UserId).ToList();
        var users = await _context.Users
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id);

        var result = todayChanges
            .Where(x => users.ContainsKey(x.UserId))
            .Select(x => new TopPlayer
            {
                Id = x.UserId,
                Username = users[x.UserId].Username,
                AvatarUrl = users[x.UserId].AvatarUrl,
                TodayChange = x.TodayChange
            });

        if (type == "losers")
        {
            result = result.OrderBy(x => x.TodayChange).Take(5);
        }
        else
        {
            result = result.OrderByDescending(x => x.TodayChange).Take(5);
        }

        return result.ToList();
    }

    /// <summary>
    /// GET /api/stats/active-tables
    /// Returns all active dealer tables with player names
    /// </summary>
    [HttpGet("active-tables")]
    public async Task<ActionResult<IEnumerable<ActiveTable>>> GetActiveTables()
    {
        return await GetActiveTablesInternal();
    }

    /// <summary>
    /// GET /api/stats/active-tables-public
    /// Public endpoint for Digital Signage displays - no authentication required
    /// </summary>
    [HttpGet("active-tables-public")]
    [AllowAnonymous]
    public async Task<ActionResult<IEnumerable<ActiveTable>>> GetActiveTablesPublic()
    {
        return await GetActiveTablesInternal();
    }

    private async Task<ActionResult<IEnumerable<ActiveTable>>> GetActiveTablesInternal()
    {
        var activeDealers = await _context.Dealers
            .Where(d => d.IsActive && d.CurrentGame != null)
            .ToListAsync();

        var dealerIds = activeDealers.Select(d => d.Id).ToList();

        var activeSessions = await _context.TableSessions
            .Where(s => dealerIds.Contains(s.DealerId) && s.LeftAt == null)
            .Include(s => s.User)
            .ToListAsync();

        var result = activeDealers.Select(d => new ActiveTable
        {
            DealerId = d.Id,
            DealerName = d.Name,
            CurrentGame = d.CurrentGame ?? "Unbekannt",
            LastActivity = d.LastActivityAt,
            Players = activeSessions
                .Where(s => s.DealerId == d.Id)
                .Select(s => new TablePlayer
                {
                    Id = s.User?.Id ?? 0,
                    Username = s.User?.Username ?? "Unbekannt",
                    AvatarUrl = s.User?.AvatarUrl,
                    JoinedAt = s.JoinedAt
                })
                .ToList()
        }).ToList();

        return result;
    }
}

// DTOs
public class DashboardStats
{
    public int TotalPlayers { get; set; }
    public int ActiveDealers { get; set; }
    public decimal TotalBalance { get; set; }
    public int TodayTransactionCount { get; set; }
    public decimal TodayDeposits { get; set; }
    public decimal TodayWithdrawals { get; set; }
}

public class ChartDataPoint
{
    public string Date { get; set; } = string.Empty;
    public decimal Deposits { get; set; }
    public decimal Withdrawals { get; set; }
}

public class TopPlayer
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public decimal TodayChange { get; set; }
}

public class ActiveTable
{
    public int DealerId { get; set; }
    public string DealerName { get; set; } = string.Empty;
    public string CurrentGame { get; set; } = string.Empty;
    public DateTime? LastActivity { get; set; }
    public List<TablePlayer> Players { get; set; } = new();
}

public class TablePlayer
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public DateTime JoinedAt { get; set; }
}
