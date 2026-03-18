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
            var actorTypeClaim = context.User.FindFirst("actor_type")?.Value;

            if (!string.IsNullOrEmpty(userIdClaim) && !string.Equals(actorTypeClaim, "dealer_profile", StringComparison.OrdinalIgnoreCase))
            {
                using (var scope = serviceProvider.CreateScope())
                {
                    var dbContext = scope.ServiceProvider.GetRequiredService<CasinoContext>();

                    if (int.TryParse(userIdClaim, out int userId))
                    {
                        var user = await dbContext.Users
                            .Select(u => new { u.Id, u.SessionToken })
                            .FirstOrDefaultAsync(u => u.Id == userId);

                        if (user != null)
                        {
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
