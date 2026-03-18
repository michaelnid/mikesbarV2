using System.Reflection;
using System.Runtime.Loader;
using Backend.Models;
using Mikesbar.PluginSdk.LiveGames;

namespace Backend.Services;

public interface ILiveGamePluginRuntimeService
{
    IReadOnlyList<RuntimeLiveGamePlugin> GetLoadedPlugins();
    RuntimeLiveGamePlugin? GetPlugin(string key);
}

public sealed record RuntimeLiveGamePlugin(
    InstalledLiveGamePluginPackage Package,
    ILiveGamePlugin Instance,
    string InstallDirectory,
    string FrontendBaseDirectory,
    string FrontendEntryAbsolutePath,
    string? DefaultTileRoute);

public sealed class LiveGamePluginRuntimeService : ILiveGamePluginRuntimeService
{
    private readonly ILiveGamePluginPackageService _packageService;
    private readonly object _sync = new();
    private readonly Dictionary<string, RuntimePluginHolder> _loadedPlugins = new(StringComparer.OrdinalIgnoreCase);

    public LiveGamePluginRuntimeService(ILiveGamePluginPackageService packageService)
    {
        _packageService = packageService;
    }

    public IReadOnlyList<RuntimeLiveGamePlugin> GetLoadedPlugins()
    {
        lock (_sync)
        {
            RefreshLoadedPlugins();
            return _loadedPlugins.Values
                .Select(holder => holder.Runtime)
                .OrderBy(plugin => plugin.Package.SortOrder)
                .ThenBy(plugin => plugin.Package.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();
        }
    }

    public RuntimeLiveGamePlugin? GetPlugin(string key)
    {
        lock (_sync)
        {
            RefreshLoadedPlugins();
            return _loadedPlugins.TryGetValue(key, out var holder) ? holder.Runtime : null;
        }
    }

    private void RefreshLoadedPlugins()
    {
        var installedPackages = _packageService.GetInstalledPackages();
        var installedKeys = installedPackages.Select(package => package.Key).ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var removedKey in _loadedPlugins.Keys.Where(key => !installedKeys.Contains(key)).ToList())
        {
            _loadedPlugins.Remove(removedKey);
        }

        foreach (var package in installedPackages)
        {
            if (_loadedPlugins.TryGetValue(package.Key, out var existing))
            {
                if (existing.Runtime.Package.Sha256 == package.Sha256)
                {
                    continue;
                }

                _loadedPlugins.Remove(package.Key);
            }

            var runtime = LoadRuntimePlugin(package);
            _loadedPlugins[package.Key] = runtime;
        }
    }

    private RuntimePluginHolder LoadRuntimePlugin(InstalledLiveGamePluginPackage package)
    {
        var installDirectory = _packageService.GetInstallDirectory(package.Key)
            ?? throw new InvalidOperationException($"Installationsverzeichnis für Plugin '{package.Key}' wurde nicht gefunden.");

        var assemblyPath = Path.Combine(installDirectory, package.BackendAssemblyPath);
        var frontendBaseDirectory = Path.Combine(installDirectory, package.FrontendBasePath);
        var frontendEntryAbsolutePath = Path.Combine(installDirectory, package.FrontendEntryPoint);

        if (!File.Exists(assemblyPath))
        {
            throw new InvalidOperationException($"Plugin-Assembly fehlt: {package.BackendAssemblyPath}");
        }

        if (!File.Exists(frontendEntryAbsolutePath))
        {
            throw new InvalidOperationException($"Plugin-Frontend-Einstiegspunkt fehlt: {package.FrontendEntryPoint}");
        }

        var loadContext = new PluginLoadContext(assemblyPath);
        var assembly = loadContext.LoadFromAssemblyPath(assemblyPath);
        var pluginType = assembly.GetType(package.BackendTypeName, throwOnError: false, ignoreCase: false)
            ?? throw new InvalidOperationException($"Plugin-Typ '{package.BackendTypeName}' wurde nicht gefunden.");

        if (!typeof(ILiveGamePlugin).IsAssignableFrom(pluginType))
        {
            throw new InvalidOperationException($"Plugin-Typ '{package.BackendTypeName}' implementiert ILiveGamePlugin nicht.");
        }

        if (Activator.CreateInstance(pluginType) is not ILiveGamePlugin pluginInstance)
        {
            throw new InvalidOperationException($"Plugin-Typ '{package.BackendTypeName}' konnte nicht instanziiert werden.");
        }

        if (!string.Equals(pluginInstance.Key, package.Key, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"Plugin-Key '{pluginInstance.Key}' passt nicht zum Manifest-Key '{package.Key}'.");
        }

        var defaultTileRoute = package.DashboardTiles.FirstOrDefault(tile =>
            tile.Surface.Equals("player", StringComparison.OrdinalIgnoreCase))?.Route;

        return new RuntimePluginHolder(
            loadContext,
            assembly,
            new RuntimeLiveGamePlugin(
                package,
                pluginInstance,
                installDirectory,
                frontendBaseDirectory,
                frontendEntryAbsolutePath,
                defaultTileRoute));
    }

    private sealed class RuntimePluginHolder
    {
        public RuntimePluginHolder(AssemblyLoadContext loadContext, Assembly assembly, RuntimeLiveGamePlugin runtime)
        {
            LoadContext = loadContext;
            Assembly = assembly;
            Runtime = runtime;
        }

        public AssemblyLoadContext LoadContext { get; }
        public Assembly Assembly { get; }
        public RuntimeLiveGamePlugin Runtime { get; }
    }

    private sealed class PluginLoadContext : AssemblyLoadContext
    {
        private readonly AssemblyDependencyResolver _resolver;

        public PluginLoadContext(string pluginAssemblyPath) : base(isCollectible: false)
        {
            _resolver = new AssemblyDependencyResolver(pluginAssemblyPath);
        }

        protected override Assembly? Load(AssemblyName assemblyName)
        {
            var sharedAssembly = AssemblyLoadContext.Default.Assemblies
                .FirstOrDefault(assembly => string.Equals(assembly.GetName().Name, assemblyName.Name, StringComparison.OrdinalIgnoreCase));
            if (sharedAssembly is not null)
            {
                return sharedAssembly;
            }

            var assemblyPath = _resolver.ResolveAssemblyToPath(assemblyName);
            if (!string.IsNullOrWhiteSpace(assemblyPath))
            {
                return LoadFromAssemblyPath(assemblyPath);
            }

            return null;
        }

        protected override IntPtr LoadUnmanagedDll(string unmanagedDllName)
        {
            var libraryPath = _resolver.ResolveUnmanagedDllToPath(unmanagedDllName);
            return !string.IsNullOrWhiteSpace(libraryPath)
                ? LoadUnmanagedDllFromPath(libraryPath)
                : IntPtr.Zero;
        }
    }
}
