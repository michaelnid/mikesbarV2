using Microsoft.AspNetCore.Mvc;
using System.Net.Security;
using System.Security.Cryptography.X509Certificates;

namespace Backend.Controllers;

[Route("api/[controller]")]
[ApiController]
public class SslController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public SslController(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    [HttpGet("certificate")]
    public async Task<IActionResult> GetCertificateInfo()
    {
        try
        {
            var configuredDomain = _configuration["Ssl:Domain"];
            var domain = !string.IsNullOrWhiteSpace(configuredDomain)
                ? configuredDomain
                : HttpContext.Request.Host.Host;

            if (string.IsNullOrWhiteSpace(domain) || domain.Equals("localhost", StringComparison.OrdinalIgnoreCase))
            {
                return Ok(new
                {
                    Status = "Unavailable",
                    Message = "Keine oeffentliche Domain fuer SSL-Pruefung konfiguriert.",
                    Subject = "Unknown",
                    Issuer = "Unknown",
                    ValidFrom = (DateTime?)null,
                    ValidTo = (DateTime?)null,
                    DaysRemaining = 0
                });
            }

            var configuredPort = _configuration["Ssl:Port"];
            var port = int.TryParse(configuredPort, out var parsedPort) ? parsedPort : 443;

            var certInfo = await GetSslCertificateAsync(domain, port);
            return Ok(certInfo);
        }
        catch (Exception ex)
        {
            return Ok(new
            {
                Status = "Error",
                Message = ex.Message,
                Subject = "Unknown",
                Issuer = "Unknown",
                ValidFrom = (DateTime?)null,
                ValidTo = (DateTime?)null,
                DaysRemaining = 0
            });
        }
    }

    private async Task<object> GetSslCertificateAsync(string domain, int port)
    {
        X509Certificate2? certificate = null;

        using var client = new System.Net.Sockets.TcpClient();
        await client.ConnectAsync(domain, port);

        using var sslStream = new SslStream(
            client.GetStream(),
            false,
            (sender, cert, chain, errors) =>
            {
                if (cert != null)
                {
                    certificate = new X509Certificate2(cert);
                }
                return true; // Accept any certificate for reading purposes
            });

        await sslStream.AuthenticateAsClientAsync(domain);

        if (certificate == null)
        {
            throw new Exception("Could not retrieve SSL certificate");
        }

        var validFrom = certificate.NotBefore;
        var validTo = certificate.NotAfter;
        var daysRemaining = (validTo - DateTime.Now).Days;

        string status;
        if (daysRemaining <= 0)
            status = "Expired";
        else if (daysRemaining <= 7)
            status = "Critical";
        else if (daysRemaining <= 30)
            status = "Warning";
        else
            status = "Valid";

        // Extract Common Name from Subject
        var subject = certificate.GetNameInfo(X509NameType.SimpleName, false);
        var issuer = certificate.GetNameInfo(X509NameType.SimpleName, true);

        return new
        {
            Status = status,
            Subject = subject,
            Issuer = issuer,
            ValidFrom = validFrom,
            ValidTo = validTo,
            DaysRemaining = daysRemaining,
            Thumbprint = certificate.Thumbprint,
            SerialNumber = certificate.SerialNumber
        };
    }
}
