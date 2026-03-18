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

    [Column("permissions")]
    public string Permissions { get; set; } = "PLAYER";

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

    [NotMapped]
    public string[] PermissionGroups => GetPermissions().ToArray();

    public IReadOnlyCollection<string> GetPermissions()
    {
        var permissions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "PLAYER"
        };

        if (!string.IsNullOrWhiteSpace(Permissions))
        {
            foreach (var permission in Permissions.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                permissions.Add(permission.ToUpperInvariant());
            }
        }

        if (!string.IsNullOrWhiteSpace(Role))
        {
            var legacyRole = Role.ToUpperInvariant();
            if (legacyRole == "ADMIN" || legacyRole == "DEALER")
            {
                permissions.Add(legacyRole);
            }
        }

        return permissions.ToArray();
    }

    public bool HasPermission(string permission) =>
        GetPermissions().Contains(permission.ToUpperInvariant(), StringComparer.OrdinalIgnoreCase);

    public string GetPrimaryRole()
    {
        if (HasPermission("ADMIN"))
        {
            return "ADMIN";
        }

        if (HasPermission("DEALER"))
        {
            return "DEALER";
        }

        return "PLAYER";
    }
}
