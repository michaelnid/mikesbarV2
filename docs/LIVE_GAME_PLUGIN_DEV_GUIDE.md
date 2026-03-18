# Live-Game Plugin Dev Guide

Dieser Guide beschreibt echte Code-Plugins für `mikesBAR`.

Ein Live-Game-Plugin besteht aus:
- eigenem Backend-Code als kompilierte .NET-Assembly
- eigenem Frontend-Bundle
- einem Manifest
- optionalen Assets und Doku

Das Core-Backend lädt den Plugin-Code zur Laufzeit und stellt das Plugin anschließend als Spielmodul und Dashboard-Kachel bereit.

## Architektur

Ein Plugin liefert:
- Backend-Assembly unter `backend/`
- Frontend-Build unter `frontend/dist/`
- Manifest in `manifest.json`
- optionale Dashboard-Kacheln

Der Core übernimmt:
- ZIP-Upload im Admin-Menü
- Validierung
- sichere Extraktion
- Assembly-Laden
- API-Dispatch an das Plugin
- Hosting der Plugin-Frontend-Dateien
- Deinstallation

## ZIP-Struktur

Pflichtstruktur:

```text
manifest.json
README.md
backend/
  MyPlugin.dll
  MyPlugin.deps.json
  MyPlugin.runtimeconfig.json
frontend/
  dist/
    index.html
    assets/
assets/
  icon.svg
docs/
  integration.md
```

Ein einzelner äußerer Wrapper-Ordner wird toleriert, empfohlen ist aber die Struktur direkt auf ZIP-Ebene.

## Erlaubte Inhalte

Erlaubte Root-Dateien:
- `manifest.json`
- `README.md`

Erlaubte Ordner:
- `backend/`
- `frontend/`
- `assets/`
- `docs/`

Typische erlaubte Dateiendungen:
- Backend: `.dll`, `.deps.json`, `.runtimeconfig.json`, `.pdb`
- Frontend: `.html`, `.js`, `.css`, `.map`, `.json`, Bilder, Fonts
- Assets/Doku: `.md`, `.txt`, `.json`, `.svg`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`

Nicht erlaubt:
- Shell-Skripte
- EXE-Dateien
- private Schlüssel
- Secrets
- beliebige Binärdaten außerhalb der erlaubten Ordner

## Manifest

Beispiel:

```json
{
  "packageType": "mikesbar-livegame",
  "schemaVersion": 1,
  "key": "roulette_pro",
  "name": "Roulette Pro",
  "version": "1.0.0",
  "description": "Live-Roulette als installierbares Code-Plugin.",
  "clientRoute": "/plugins/roulette_pro",
  "launchMode": "direct",
  "dealerSelectable": true,
  "requiresPlayerSession": true,
  "defaultEnabled": true,
  "sortOrder": 100,
  "accentColor": "red",
  "developer": "Your Studio",
  "externalLaunchUrl": null,
  "apiRequiredPermission": "PLAYER",
  "allowAnonymousApi": false,
  "backend": {
    "assemblyPath": "backend/RoulettePro.Plugin.dll",
    "typeName": "RoulettePro.Plugin.RouletteProPlugin"
  },
  "frontend": {
    "entryPoint": "frontend/dist/index.html",
    "basePath": "frontend/dist"
  },
  "dashboardTiles": [
    {
      "surface": "player",
      "title": "Roulette Pro",
      "description": "Installiertes Live-Roulette",
      "route": "/plugins/roulette_pro",
      "iconPath": "assets/icon.svg",
      "accentColor": "red",
      "requiredPermission": "PLAYER",
      "visibleByDefault": true
    }
  ]
}
```

## Manifest-Felder

Pflicht:
- `packageType`
  Muss `mikesbar-livegame` sein.
- `schemaVersion`
  Aktuell `1`.
- `key`
  Kleinbuchstaben, Zahlen, `_` und `-`, 2 bis 64 Zeichen.
- `name`
- `version`
- `backend.assemblyPath`
- `backend.typeName`
- `frontend.entryPoint`

Wichtige optionale Felder:
- `description`
- `clientRoute`
- `launchMode`
  Erlaubt: `table`, `direct`, `external`
- `externalLaunchUrl`
  Nur für `external`
- `dealerSelectable`
- `requiresPlayerSession`
- `defaultEnabled`
- `sortOrder`
- `accentColor`
- `developer`
- `apiRequiredPermission`
  Typisch: `PLAYER`, `DEALER`, `ADMIN`
- `allowAnonymousApi`
- `dashboardTiles`

## Backend-Plugin-Interface

Ein Backend-Plugin muss `ILiveGamePlugin` aus dem SDK implementieren:

```csharp
using Microsoft.AspNetCore.Http;
using Mikesbar.PluginSdk.LiveGames;

namespace RoulettePro.Plugin;

public sealed class RouletteProPlugin : ILiveGamePlugin
{
    public string Key => "roulette_pro";

    public async Task HandleRequestAsync(HttpContext httpContext, CancellationToken cancellationToken = default)
    {
        var path = (httpContext.Items["LiveGamePluginPath"] as string ?? string.Empty).Trim('/');

        if (httpContext.Request.Method == "GET" && path == "health")
        {
            httpContext.Response.ContentType = "application/json";
            await httpContext.Response.WriteAsJsonAsync(new { status = "ok", plugin = Key }, cancellationToken);
            return;
        }

        httpContext.Response.StatusCode = StatusCodes.Status404NotFound;
        await httpContext.Response.WriteAsJsonAsync(new { message = "Plugin route not found" }, cancellationToken);
    }
}
```

Das Plugin bekommt den normalen `HttpContext` und kann über `httpContext.RequestServices` auf Core-Dienste zugreifen.

Zusätzliche Laufzeitwerte:
- `HttpContext.Items["LiveGamePlugin"]`
- `HttpContext.Items["LiveGamePluginPath"]`

## Frontend

Das Plugin-Frontend wird vom Core unter `/plugin-runtime/{pluginKey}/...` ausgeliefert.

Der Core öffnet Plugin-Frontends unter:

```text
/plugins/{pluginKey}
```

Das Frontend wird dabei in einem Host-Container geladen. Es bekommt Query-Parameter wie:
- `token`
- `userId`
- `pluginKey`
- `apiBaseUrl`

Beispiel:

```text
https://example.com/plugin-runtime/roulette_pro/index.html?token=...&userId=12&pluginKey=roulette_pro&apiBaseUrl=https://example.com/api/plugin-runtime/roulette_pro
```

## API-Aufruf aus dem Plugin-Frontend

Plugin-Frontend ruft das eigene Backend über:

```text
/api/plugin-runtime/{pluginKey}/...
```

Beispiel:

```text
GET /api/plugin-runtime/roulette_pro/health
POST /api/plugin-runtime/roulette_pro/place-bet
```

Diese Requests werden an `HandleRequestAsync(...)` des Plugins weitergereicht.

## Dashboard-Kacheln

Plugins können Kacheln für diese Bereiche registrieren:
- `player`
- `management`
- `home`

`player`
- erscheint im Spieler-Dashboard

`management`
- erscheint in der Verwaltungsansicht

`home`
- reserviert für spätere Erweiterungen

## ZIP bauen

Empfohlener Weg:

```bash
bash scripts/package-live-plugin.sh /pfad/zum/plugin-ordner
```

Das Skript erwartet im Plugin-Ordner bereits:
- `manifest.json`
- `backend/`
- `frontend/dist/`

Optional:
- `README.md`
- `assets/`
- `docs/`

## Beispiel für Build + Packaging

Backend publizieren:

```bash
dotnet publish ./src/RoulettePro.Plugin/RoulettePro.Plugin.csproj -c Release -o ./plugin-output/backend
```

Frontend bauen:

```bash
cd ./frontend
npm ci
npm run build
mkdir -p ../plugin-output/frontend
cp -R dist ../plugin-output/frontend/
```

Danach Manifest und Assets in `plugin-output/` ablegen und ZIP bauen:

```bash
bash scripts/package-live-plugin.sh ./plugin-output ./roulette-pro-1.0.0.zip
```

## Installation im Admin-Menü

Im Admin-Dashboard unter `Plugins & Features`:
- ZIP auswählen
- hochladen
- Plugin wird validiert
- Backend-Code wird beim nächsten Zugriff geladen
- Frontend und Dashboard-Kacheln stehen danach bereit

## Deinstallation

Im Admin-Dashboard:
- Paket auswählen
- entfernen

Dabei werden:
- Installationsdateien gelöscht
- Katalogeintrag entfernt
- aktive Dealer-Zuordnungen für dieses Plugin beendet
- offene Tischsessions für dieses Plugin geschlossen

## Beispiel-Dateien

Beispiel-Manifest:
- `docs/examples/live-game-plugin/manifest.json`

Beispiel-Backend:
- `docs/examples/live-game-plugin/backend/SamplePlugin.cs`
