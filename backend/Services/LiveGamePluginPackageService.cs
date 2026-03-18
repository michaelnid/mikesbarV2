using System.IO.Compression;
using System.Security.Cryptography;
using System.Text.Json;
using Backend.Models;
using Backend.Options;
using Microsoft.Extensions.Options;
using Mikesbar.PluginSdk.LiveGames;

namespace Backend.Services;

public interface ILiveGamePluginPackageService
{
    IReadOnlyList<InstalledLiveGamePluginPackage> GetInstalledPackages();
    string? GetInstallDirectory(string key);
    Task<InstalledLiveGamePluginPackage> InstallAsync(Stream packageStream, string fileName, CancellationToken cancellationToken = default);
    Task RemoveAsync(string key, CancellationToken cancellationToken = default);
}

public sealed class LiveGamePluginPackageService : ILiveGamePluginPackageService
{
    private const int MaxArchiveEntries = 256;
    private const long MaxExtractedBytes = 25 * 1024 * 1024;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true
    };

    private static readonly HashSet<string> AllowedRootFiles = new(StringComparer.OrdinalIgnoreCase)
    {
        "manifest.json",
        "README.md"
    };

    private static readonly HashSet<string> AllowedTextAssetExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".json",
        ".md",
        ".txt",
        ".svg",
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".gif"
    };

    private static readonly HashSet<string> AllowedBinaryExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".dll",
        ".deps.json",
        ".runtimeconfig.json",
        ".pdb",
        ".json",
        ".js",
        ".css",
        ".html",
        ".map",
        ".svg",
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".gif",
        ".txt",
        ".woff",
        ".woff2"
    };

    private readonly PluginPackagesOptions _options;
    private readonly string _storageRoot;
    private readonly HashSet<string> _reservedKeys;

    public LiveGamePluginPackageService(
        IOptions<PluginPackagesOptions> options,
        IOptions<LiveGamesOptions> liveGamesOptions,
        IHostEnvironment hostEnvironment)
    {
        _options = options.Value;
        var configuredStoragePath = Environment.GetEnvironmentVariable("PLUGIN_STORAGE_PATH");
        if (string.IsNullOrWhiteSpace(configuredStoragePath))
        {
            configuredStoragePath = _options.StoragePath;
        }

        _storageRoot = string.IsNullOrWhiteSpace(configuredStoragePath)
            ? Path.Combine(hostEnvironment.ContentRootPath, "plugin-data", "live-game-packages")
            : Path.IsPathRooted(configuredStoragePath)
                ? Path.GetFullPath(configuredStoragePath)
                : Path.GetFullPath(Path.Combine(hostEnvironment.ContentRootPath, configuredStoragePath));

        _reservedKeys = liveGamesOptions.Value.Plugins
            .Select(plugin => plugin.Key?.Trim().ToLowerInvariant())
            .Where(key => !string.IsNullOrWhiteSpace(key))
            .Cast<string>()
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    public IReadOnlyList<InstalledLiveGamePluginPackage> GetInstalledPackages()
    {
        EnsureStorageDirectories();

        var packages = new List<InstalledLiveGamePluginPackage>();
        foreach (var directory in Directory.GetDirectories(GetInstalledRoot()))
        {
            var package = TryReadInstalledPackage(directory);
            if (package is not null)
            {
                packages.Add(package);
            }
        }

        return packages
            .OrderBy(package => package.SortOrder)
            .ThenBy(package => package.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    public string? GetInstallDirectory(string key)
    {
        var normalizedKey = key?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(normalizedKey))
        {
            return null;
        }

        var installDirectory = Path.Combine(GetInstalledRoot(), normalizedKey);
        return Directory.Exists(installDirectory) ? installDirectory : null;
    }

    public async Task<InstalledLiveGamePluginPackage> InstallAsync(Stream packageStream, string fileName, CancellationToken cancellationToken = default)
    {
        if (packageStream is null)
        {
            throw new InvalidOperationException("Plugin-Paket fehlt.");
        }

        if (string.IsNullOrWhiteSpace(fileName) || !fileName.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Es sind nur ZIP-Dateien als Plugin-Paket erlaubt.");
        }

        EnsureStorageDirectories();

        var tempFilePath = Path.Combine(Path.GetTempPath(), $"mikesbar-plugin-{Guid.NewGuid():N}.zip");
        try
        {
            await CopyToTempFileAsync(packageStream, tempFilePath, cancellationToken);

            using var archive = ZipFile.OpenRead(tempFilePath);
            var normalizedEntries = NormalizeEntries(archive);
            var manifestEntry = normalizedEntries.FirstOrDefault(entry =>
                entry.RelativePath.Equals("manifest.json", StringComparison.OrdinalIgnoreCase));

            if (manifestEntry is null)
            {
                throw new InvalidOperationException("Im ZIP wurde keine manifest.json gefunden.");
            }

            var manifest = await ReadManifestAsync(manifestEntry.Entry, cancellationToken);
            ValidateManifest(manifest);

            EnsureDeclaredFilesExist(normalizedEntries, manifest);

            if (_reservedKeys.Contains(manifest.Key))
            {
                throw new InvalidOperationException($"Der Plugin-Key '{manifest.Key}' ist bereits vom System reserviert.");
            }

            if (GetInstalledPackages().Any(package => package.Key.Equals(manifest.Key, StringComparison.OrdinalIgnoreCase)))
            {
                throw new InvalidOperationException($"Ein Plugin mit dem Key '{manifest.Key}' ist bereits installiert.");
            }

            var installDirectory = Path.Combine(GetInstalledRoot(), manifest.Key);
            Directory.CreateDirectory(installDirectory);

            try
            {
                await ExtractEntriesAsync(normalizedEntries, installDirectory, cancellationToken);

                var normalizedManifestPath = Path.Combine(installDirectory, "manifest.json");
                await File.WriteAllTextAsync(
                    normalizedManifestPath,
                    JsonSerializer.Serialize(manifest, JsonOptions),
                    cancellationToken);

                var installMetadata = new LiveGamePluginInstallMetadata
                {
                    UploadedFileName = Path.GetFileName(fileName),
                    InstalledAtUtc = DateTimeOffset.UtcNow,
                    Sha256 = ComputeSha256(tempFilePath)
                };

                var metadataPath = Path.Combine(installDirectory, ".install.json");
                await File.WriteAllTextAsync(
                    metadataPath,
                    JsonSerializer.Serialize(installMetadata, JsonOptions),
                    cancellationToken);

                var archiveDirectory = Path.Combine(GetArchivesRoot(), manifest.Key);
                Directory.CreateDirectory(archiveDirectory);
                File.Copy(tempFilePath, Path.Combine(archiveDirectory, "package.zip"), overwrite: true);

                return CreateInstalledPackage(manifest, installMetadata);
            }
            catch
            {
                if (Directory.Exists(installDirectory))
                {
                    Directory.Delete(installDirectory, recursive: true);
                }

                var archiveDirectory = Path.Combine(GetArchivesRoot(), manifest.Key);
                if (Directory.Exists(archiveDirectory))
                {
                    Directory.Delete(archiveDirectory, recursive: true);
                }

                throw;
            }
        }
        finally
        {
            File.Delete(tempFilePath);
        }
    }

    public Task RemoveAsync(string key, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var normalizedKey = key?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(normalizedKey))
        {
            throw new InvalidOperationException("Plugin-Key fehlt.");
        }

        if (_reservedKeys.Contains(normalizedKey))
        {
            throw new InvalidOperationException("System-Plugins können nicht deinstalliert werden.");
        }

        var installDirectory = Path.Combine(GetInstalledRoot(), normalizedKey);
        if (!Directory.Exists(installDirectory))
        {
            throw new InvalidOperationException("Plugin-Paket wurde nicht gefunden.");
        }

        Directory.Delete(installDirectory, recursive: true);

        var archiveDirectory = Path.Combine(GetArchivesRoot(), normalizedKey);
        if (Directory.Exists(archiveDirectory))
        {
            Directory.Delete(archiveDirectory, recursive: true);
        }

        return Task.CompletedTask;
    }

    private async Task CopyToTempFileAsync(Stream packageStream, string tempFilePath, CancellationToken cancellationToken)
    {
        var maxBytes = _options.MaxUploadBytes <= 0 ? 10 * 1024 * 1024 : _options.MaxUploadBytes;
        long totalBytes = 0;
        var buffer = new byte[81920];

        await using var target = File.Create(tempFilePath);
        while (true)
        {
            var bytesRead = await packageStream.ReadAsync(buffer.AsMemory(0, buffer.Length), cancellationToken);
            if (bytesRead == 0)
            {
                break;
            }

            totalBytes += bytesRead;
            if (totalBytes > maxBytes)
            {
                throw new InvalidOperationException($"Das Plugin-Paket überschreitet das Upload-Limit von {maxBytes / (1024 * 1024)} MB.");
            }

            await target.WriteAsync(buffer.AsMemory(0, bytesRead), cancellationToken);
        }
    }

    private static async Task<LiveGamePluginManifest> ReadManifestAsync(ZipArchiveEntry manifestEntry, CancellationToken cancellationToken)
    {
        await using var manifestStream = manifestEntry.Open();
        var manifest = await JsonSerializer.DeserializeAsync<LiveGamePluginManifest>(manifestStream, JsonOptions, cancellationToken);
        return manifest ?? throw new InvalidOperationException("manifest.json ist leer oder ungültig.");
    }

    private static void ValidateManifest(LiveGamePluginManifest manifest)
    {
        if (!string.Equals(manifest.PackageType, "mikesbar-livegame", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("manifest.json enthält einen ungültigen packageType.");
        }

        if (manifest.SchemaVersion != 1)
        {
            throw new InvalidOperationException("Dieses Plugin-Paket verwendet eine nicht unterstützte schemaVersion.");
        }

        if (string.IsNullOrWhiteSpace(manifest.Key) || !System.Text.RegularExpressions.Regex.IsMatch(manifest.Key, "^[a-z0-9_-]{2,64}$"))
        {
            throw new InvalidOperationException("manifest.json enthält einen ungültigen key.");
        }

        if (string.IsNullOrWhiteSpace(manifest.Name))
        {
            throw new InvalidOperationException("manifest.json enthält keinen gültigen Namen.");
        }

        if (string.IsNullOrWhiteSpace(manifest.Version) || manifest.Version.Length > 50)
        {
            throw new InvalidOperationException("manifest.json enthält keine gültige Versionsangabe.");
        }

        manifest.LaunchMode = string.IsNullOrWhiteSpace(manifest.LaunchMode)
            ? "table"
            : manifest.LaunchMode.Trim().ToLowerInvariant();

        if (manifest.LaunchMode is not ("table" or "direct" or "external"))
        {
            throw new InvalidOperationException("launchMode muss 'table', 'direct' oder 'external' sein.");
        }

        manifest.ClientRoute = string.IsNullOrWhiteSpace(manifest.ClientRoute)
            ? "/dealer/players"
            : manifest.ClientRoute.Trim();

        if (manifest.LaunchMode == "external")
        {
            if (string.IsNullOrWhiteSpace(manifest.ExternalLaunchUrl) ||
                !Uri.TryCreate(manifest.ExternalLaunchUrl, UriKind.Absolute, out var uri) ||
                (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            {
                throw new InvalidOperationException("Für launchMode 'external' ist eine gültige externalLaunchUrl erforderlich.");
            }
        }
        else
        {
            manifest.ExternalLaunchUrl = null;
        }

        manifest.Key = manifest.Key.Trim().ToLowerInvariant();
        manifest.Name = manifest.Name.Trim();
        manifest.Description = manifest.Description?.Trim() ?? string.Empty;
        manifest.Version = manifest.Version.Trim();
        manifest.Developer = manifest.Developer?.Trim() ?? string.Empty;
        manifest.AccentColor = string.IsNullOrWhiteSpace(manifest.AccentColor)
            ? "neutral"
            : manifest.AccentColor.Trim().ToLowerInvariant();
        manifest.ApiRequiredPermission = string.IsNullOrWhiteSpace(manifest.ApiRequiredPermission)
            ? "PLAYER"
            : manifest.ApiRequiredPermission.Trim().ToUpperInvariant();

        if (string.IsNullOrWhiteSpace(manifest.Backend.AssemblyPath) ||
            string.IsNullOrWhiteSpace(manifest.Backend.TypeName))
        {
            throw new InvalidOperationException("manifest.json enthält keine gültige Backend-Definition.");
        }

        manifest.Backend.AssemblyPath = NormalizeRelativePath(manifest.Backend.AssemblyPath);
        manifest.Backend.TypeName = manifest.Backend.TypeName.Trim();

        if (!manifest.Backend.AssemblyPath.StartsWith("backend/", StringComparison.OrdinalIgnoreCase) ||
            !manifest.Backend.AssemblyPath.EndsWith(".dll", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("backend.assemblyPath muss auf eine DLL innerhalb von backend/ zeigen.");
        }

        if (string.IsNullOrWhiteSpace(manifest.Frontend.EntryPoint))
        {
            throw new InvalidOperationException("manifest.json enthält keinen gültigen Frontend-Einstiegspunkt.");
        }

        manifest.Frontend.EntryPoint = NormalizeRelativePath(manifest.Frontend.EntryPoint);
        manifest.Frontend.BasePath = string.IsNullOrWhiteSpace(manifest.Frontend.BasePath)
            ? "frontend/dist"
            : NormalizeRelativePath(manifest.Frontend.BasePath);

        if (!manifest.Frontend.EntryPoint.StartsWith("frontend/", StringComparison.OrdinalIgnoreCase) ||
            !manifest.Frontend.BasePath.StartsWith("frontend/", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Frontend-Dateien müssen innerhalb von frontend/ liegen.");
        }

        manifest.DashboardTiles ??= [];
        foreach (var tile in manifest.DashboardTiles)
        {
            tile.Surface = string.IsNullOrWhiteSpace(tile.Surface) ? "player" : tile.Surface.Trim().ToLowerInvariant();
            if (tile.Surface is not ("player" or "management" or "home"))
            {
                throw new InvalidOperationException("dashboardTiles.surface muss 'player', 'management' oder 'home' sein.");
            }

            tile.Title = tile.Title?.Trim() ?? string.Empty;
            tile.Description = tile.Description?.Trim() ?? string.Empty;
            tile.Route = string.IsNullOrWhiteSpace(tile.Route) ? $"/plugins/{manifest.Key}" : tile.Route.Trim();
            tile.IconPath = string.IsNullOrWhiteSpace(tile.IconPath) ? string.Empty : NormalizeRelativePath(tile.IconPath);
            tile.AccentColor = string.IsNullOrWhiteSpace(tile.AccentColor) ? manifest.AccentColor : tile.AccentColor.Trim().ToLowerInvariant();
            tile.RequiredPermission = string.IsNullOrWhiteSpace(tile.RequiredPermission) ? "PLAYER" : tile.RequiredPermission.Trim().ToUpperInvariant();

            if (string.IsNullOrWhiteSpace(tile.Title))
            {
                throw new InvalidOperationException("dashboardTiles.title darf nicht leer sein.");
            }

            if (!string.IsNullOrWhiteSpace(tile.IconPath) &&
                !tile.IconPath.StartsWith("assets/", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("dashboardTiles.iconPath muss innerhalb von assets/ liegen.");
            }
        }
    }

    private static async Task ExtractEntriesAsync(IEnumerable<NormalizedArchiveEntry> entries, string installDirectory, CancellationToken cancellationToken)
    {
        long totalExtractedBytes = 0;

        foreach (var entry in entries)
        {
            if (!IsAllowedPackagePath(entry.RelativePath))
            {
                throw new InvalidOperationException($"Die ZIP-Datei enthält einen nicht erlaubten Pfad: {entry.RelativePath}");
            }

            totalExtractedBytes += entry.Entry.Length;
            if (totalExtractedBytes > MaxExtractedBytes)
            {
                throw new InvalidOperationException("Die extrahierte Plugin-Größe überschreitet das zulässige Limit.");
            }

            var destinationPath = Path.GetFullPath(Path.Combine(installDirectory, entry.RelativePath));
            if (!destinationPath.StartsWith(Path.GetFullPath(installDirectory), StringComparison.Ordinal))
            {
                throw new InvalidOperationException("Ungültiger ZIP-Pfad erkannt.");
            }

            Directory.CreateDirectory(Path.GetDirectoryName(destinationPath)!);

            await using var sourceStream = entry.Entry.Open();
            await using var targetStream = File.Create(destinationPath);
            await sourceStream.CopyToAsync(targetStream, cancellationToken);
        }
    }

    private static bool IsAllowedPackagePath(string relativePath)
    {
        if (AllowedRootFiles.Contains(relativePath))
        {
            return true;
        }

        if (relativePath.StartsWith("assets/", StringComparison.OrdinalIgnoreCase) ||
            relativePath.StartsWith("docs/", StringComparison.OrdinalIgnoreCase))
        {
            var extension = Path.GetExtension(relativePath);
            return AllowedTextAssetExtensions.Contains(extension);
        }

        if (relativePath.StartsWith("backend/", StringComparison.OrdinalIgnoreCase) ||
            relativePath.StartsWith("frontend/", StringComparison.OrdinalIgnoreCase))
        {
            var extension = Path.GetExtension(relativePath);
            return AllowedBinaryExtensions.Contains(extension);
        }

        return false;
    }

    private static List<NormalizedArchiveEntry> NormalizeEntries(ZipArchive archive)
    {
        var rawEntries = archive.Entries
            .Where(entry => !string.IsNullOrEmpty(entry.Name))
            .Select(entry => new
            {
                Entry = entry,
                RelativePath = entry.FullName.Replace('\\', '/').Trim('/')
            })
            .ToList();

        if (rawEntries.Count == 0)
        {
            throw new InvalidOperationException("Das Plugin-Paket ist leer.");
        }

        if (rawEntries.Count > MaxArchiveEntries)
        {
            throw new InvalidOperationException("Das Plugin-Paket enthält zu viele Dateien.");
        }

        var firstSegments = rawEntries
            .Select(entry => entry.RelativePath.Split('/', StringSplitOptions.RemoveEmptyEntries))
            .Where(segments => segments.Length > 0)
            .ToList();

        string? wrapperDirectory = null;
        if (firstSegments.All(segments => segments.Length > 1))
        {
            var topLevelDirectories = firstSegments
                .Select(segments => segments[0])
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (topLevelDirectories.Count == 1)
            {
                wrapperDirectory = topLevelDirectories[0];
            }
        }

        var normalizedEntries = new List<NormalizedArchiveEntry>(rawEntries.Count);
        foreach (var entry in rawEntries)
        {
            var relativePath = entry.RelativePath;
            if (!string.IsNullOrWhiteSpace(wrapperDirectory) &&
                relativePath.StartsWith(wrapperDirectory + "/", StringComparison.OrdinalIgnoreCase))
            {
                relativePath = relativePath[(wrapperDirectory.Length + 1)..];
            }

            if (string.IsNullOrWhiteSpace(relativePath) ||
                relativePath.Contains("../", StringComparison.Ordinal) ||
                relativePath.StartsWith("../", StringComparison.Ordinal) ||
                relativePath.EndsWith("/..", StringComparison.Ordinal))
            {
                throw new InvalidOperationException("Die ZIP-Datei enthält ungültige relative Pfade.");
            }

            normalizedEntries.Add(new NormalizedArchiveEntry(entry.Entry, relativePath));
        }

        return normalizedEntries;
    }

    private InstalledLiveGamePluginPackage? TryReadInstalledPackage(string installDirectory)
    {
        var manifestPath = Path.Combine(installDirectory, "manifest.json");
        var metadataPath = Path.Combine(installDirectory, ".install.json");

        if (!File.Exists(manifestPath) || !File.Exists(metadataPath))
        {
            return null;
        }

        try
        {
            var manifest = JsonSerializer.Deserialize<LiveGamePluginManifest>(File.ReadAllText(manifestPath), JsonOptions);
            var metadata = JsonSerializer.Deserialize<LiveGamePluginInstallMetadata>(File.ReadAllText(metadataPath), JsonOptions);

            if (manifest is null || metadata is null)
            {
                return null;
            }

            ValidateManifest(manifest);
            return CreateInstalledPackage(manifest, metadata);
        }
        catch
        {
            return null;
        }
    }

    private static InstalledLiveGamePluginPackage CreateInstalledPackage(
        LiveGamePluginManifest manifest,
        LiveGamePluginInstallMetadata metadata) =>
        new(
            manifest.Key,
            manifest.Name,
            manifest.Version,
            manifest.Description,
            manifest.Developer,
            manifest.ClientRoute,
            manifest.LaunchMode,
            manifest.DealerSelectable,
            manifest.RequiresPlayerSession,
            manifest.DefaultEnabled,
            manifest.SortOrder,
            manifest.AccentColor,
            manifest.ExternalLaunchUrl,
            manifest.ApiRequiredPermission,
            manifest.AllowAnonymousApi,
            manifest.Backend.AssemblyPath,
            manifest.Backend.TypeName,
            manifest.Frontend.EntryPoint,
            manifest.Frontend.BasePath,
            manifest.DashboardTiles.AsReadOnly(),
            metadata.UploadedFileName,
            metadata.InstalledAtUtc,
            metadata.Sha256);

    private static string ComputeSha256(string filePath)
    {
        using var sha256 = SHA256.Create();
        using var stream = File.OpenRead(filePath);
        var hash = sha256.ComputeHash(stream);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private string GetInstalledRoot() => Path.Combine(_storageRoot, "installed");

    private string GetArchivesRoot() => Path.Combine(_storageRoot, "archives");

    private void EnsureStorageDirectories()
    {
        Directory.CreateDirectory(_storageRoot);
        Directory.CreateDirectory(GetInstalledRoot());
        Directory.CreateDirectory(GetArchivesRoot());
    }

    private sealed record NormalizedArchiveEntry(ZipArchiveEntry Entry, string RelativePath);

    private static string NormalizeRelativePath(string relativePath)
    {
        var normalized = relativePath.Replace('\\', '/').Trim().TrimStart('/');
        if (string.IsNullOrWhiteSpace(normalized) || normalized.Contains("../", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("manifest.json enthält einen ungültigen relativen Pfad.");
        }

        return normalized;
    }

    private static void EnsureDeclaredFilesExist(IEnumerable<NormalizedArchiveEntry> entries, LiveGamePluginManifest manifest)
    {
        var paths = entries
            .Select(entry => entry.RelativePath)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (!paths.Contains(manifest.Backend.AssemblyPath))
        {
            throw new InvalidOperationException($"Die deklarierte Backend-DLL fehlt im ZIP: {manifest.Backend.AssemblyPath}");
        }

        if (!paths.Contains(manifest.Frontend.EntryPoint))
        {
            throw new InvalidOperationException($"Der deklarierte Frontend-Einstiegspunkt fehlt im ZIP: {manifest.Frontend.EntryPoint}");
        }

        foreach (var tile in manifest.DashboardTiles)
        {
            if (!string.IsNullOrWhiteSpace(tile.IconPath) && !paths.Contains(tile.IconPath))
            {
                throw new InvalidOperationException($"Das deklarierte Dashboard-Icon fehlt im ZIP: {tile.IconPath}");
            }
        }
    }
}
