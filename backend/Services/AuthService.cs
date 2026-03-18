using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Backend.Models;
using Microsoft.IdentityModel.Tokens;

namespace Backend.Services;

public class AuthService
{
    private readonly IConfiguration _configuration;

    public AuthService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public string GenerateToken(User user)
    {
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim("Avatar", user.AvatarUrl),
            new Claim("actor_type", "user"),
            new Claim("session_token", user.SessionToken ?? "")
        };

        foreach (var permission in user.GetPermissions())
        {
            claims.Add(new Claim(ClaimTypes.Role, permission));
        }

        return GenerateToken(claims);
    }

    public string GenerateToken(Dealer dealer)
    {
         var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, dealer.Id.ToString()),
            new Claim(ClaimTypes.Name, dealer.Name),
            new Claim(ClaimTypes.Role, "DEALER"),
            new Claim("actor_type", "dealer_profile"),
            new Claim("session_token", dealer.SessionToken ?? "")
        };
        return GenerateToken(claims);
    }

    private string GenerateToken(IEnumerable<Claim> claims)
    {
        // SECURITY: JWT key must be configured via environment variable
        var jwtKey = Environment.GetEnvironmentVariable("JWT_SECRET_KEY");
        if (string.IsNullOrEmpty(jwtKey) || jwtKey.StartsWith("${") || jwtKey.Length < 32)
        {
            throw new InvalidOperationException("JWT_SECRET_KEY environment variable is not configured correctly.");
        }
        
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.Now.AddHours(8),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public bool VerifyPin(string hash, string pin)
    {
        return BCrypt.Net.BCrypt.Verify(pin, hash);
    }

    public string HashPin(string pin)
    {
        return BCrypt.Net.BCrypt.HashPassword(pin);
    }
}
