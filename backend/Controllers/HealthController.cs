using Backend.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Backend.Controllers;

[Route("api/[controller]")]
[ApiController]
public class HealthController : ControllerBase
{
    private readonly CasinoContext _context;

    public HealthController(CasinoContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetStatus()
    {
        try
        {
            bool dbConnected = await _context.Database.CanConnectAsync();
            return Ok(new { 
                server = "Online", 
                database = dbConnected ? "Online" : "Offline",
                timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            return Ok(new { 
                server = "Online", 
                database = "Error: " + ex.Message 
            });
        }
    }
}
