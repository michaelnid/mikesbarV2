using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Backend.Models;

[Table("users")]
public class User
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [Column("username")]
    [StringLength(50)]
    public string Username { get; set; } = string.Empty;

    [Required]
    [Column("pin_hash")]
    [JsonIgnore]
    public string PinHash { get; set; } = string.Empty;

    [Column("balance")]
    public decimal Balance { get; set; } = 0.00m;

    [Column("avatar_url")]
    public string AvatarUrl { get; set; } = "/avatars/default.svg";

    [Required]
    [Column("qr_code_uuid")]
    public Guid QrCodeUuid { get; set; }

    [Column("role")]
    public string Role { get; set; } = "USER";

    [Column("is_active")]
    public bool IsActive { get; set; } = true;
    
    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [Column("bankruptcy_count")]
    public int BankruptcyCount { get; set; } = 0;

    [Column("session_token")]
    [StringLength(100)]
    public string? SessionToken { get; set; }

    [Column("has_fotobox_access")]
    public bool HasFotoboxAccess { get; set; } = false;
}
