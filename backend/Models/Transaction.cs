using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models;

[Table("transactions")]
public class Transaction
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public int UserId { get; set; }

    [ForeignKey("UserId")]
    public User? User { get; set; }

    [Column("dealer_id")]
    public int? DealerId { get; set; } // Nullable

    [ForeignKey("DealerId")]
    public Dealer? Dealer { get; set; }

    [Required]
    [Column("game")]
    [StringLength(50)]
    public string Game { get; set; } = string.Empty;

    [Column("amount")]
    public decimal Amount { get; set; }

    [Column("description")]
    public string? Description { get; set; }

    [Column("timestamp")]
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
