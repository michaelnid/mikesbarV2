using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models;

[Table("dealers")]
public class Dealer
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [Column("name")]
    [StringLength(50)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [Column("pin_hash")]
    public string PinHash { get; set; } = string.Empty;

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("current_game")]
    [StringLength(50)]
    public string? CurrentGame { get; set; }

    [Column("last_activity_at")]
    public DateTime? LastActivityAt { get; set; }

    [Column("session_token")]
    [StringLength(50)]
    public string? SessionToken { get; set; }
    
    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
