using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models;

[Table("game_settings")]
public class GameSetting
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [Column("game_key")]
    [StringLength(50)]
    public string GameKey { get; set; } = string.Empty;

    [Column("game_name")]
    [StringLength(100)]
    public string GameName { get; set; } = string.Empty;

    [Column("is_enabled")]
    public bool IsEnabled { get; set; } = true;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
