using Backend.Models;
namespace Backend.Data;

public class CasinoContext : DbContext
{
    public CasinoContext(DbContextOptions<CasinoContext> options) : base(options) { }

    public DbSet<User> Users { get; set; }
    public DbSet<Dealer> Dealers { get; set; }
    public DbSet<Transaction> Transactions { get; set; }
    public DbSet<NfcCard> NfcCards { get; set; }
    public DbSet<TableSession> TableSessions { get; set; }
    public DbSet<GameSetting> GameSettings { get; set; }
}
