using System.Security.Claims;
using Backend.Data;
using Microsoft.EntityFrameworkCore;

namespace Backend.Middleware;

public class UserSessionMiddleware
{
    private readonly RequestDelegate _next;

    public UserSessionMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, IServiceProvider serviceProvider)
    {
        // Skip if not authenticated or not a User (e.g. if it's a Dealer or Admin endpoint that doesn't use standard user session logic, OR if we want to enforce it for everyone)
        // For now, let's target users with the "USER" role or just anyone with a NameIdentifier and session_token claim.
        
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var sessionTokenClaim = context.User.FindFirst("session_token")?.Value;
            var roleClaim = context.User.FindFirst(ClaimTypes.Role)?.Value;

            // Only check if we have both ID and session token (Dealers might have different logic, but if they use the same claim, it works too)
            // Skip check for Dealers as they have their own table/logic and IDs might collide with Users
            if (!string.IsNullOrEmpty(userIdClaim) && roleClaim != "DEALER")
            {
                // Create a minimal scope to access DB
                // Middleware is singleton or transient, DB context is scoped
                using (var scope = serviceProvider.CreateScope())
                {
                    var dbContext = scope.ServiceProvider.GetRequiredService<CasinoContext>();
                    
                    // Check if request is for a Dealer (handled separately in AuthController/VerifyDealer) OR if it's a normal user
                    // Actually, if we want to enforce this for USERS, we should check the USER table.
                    // Dealers are in separate table.
                    
                    if (int.TryParse(userIdClaim, out int userId))
                    {
                        var user = await dbContext.Users
                            .Select(u => new { u.Id, u.SessionToken, u.Role }) // Select only needed fields for performance
                            .FirstOrDefaultAsync(u => u.Id == userId);

                        if (user != null)
                        {
                            // If user has a session token in DB, but claim is missing or mismatch
                            // If DB token is null, we might allow it (legacy) or force logout? 
                            // Strategy: If DB has token, Claim MUST match.
                            if (!string.IsNullOrEmpty(user.SessionToken) && user.SessionToken != sessionTokenClaim)
                            {
                                context.Response.StatusCode = 401; // Unauthorized
                                await context.Response.WriteAsJsonAsync(new { message = "Session expired. You have logged in on another device." });
                                return; // Stop pipeline
                            }
                        }
                    }
                }
            }
        }

        await _next(context);
    }
}
