using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models;

[Table("table_sessions")]
public class TableSession
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("dealer_id")]
    public int DealerId { get; set; }

    [ForeignKey("DealerId")]
    public Dealer? Dealer { get; set; }

    [Column("user_id")]
    public int UserId { get; set; }

    [ForeignKey("UserId")]
    public User? User { get; set; }

    [Column("game")]
    [StringLength(50)]
    public string Game { get; set; } = string.Empty;

    [Column("joined_at")]
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

    [Column("left_at")]
    public DateTime? LeftAt { get; set; }
}
