namespace Backend.Models.DTO;

public class LoginRequest
{
    public string Credentials { get; set; } = string.Empty; // Username or User ID
    public string Pin { get; set; } = string.Empty;
}
