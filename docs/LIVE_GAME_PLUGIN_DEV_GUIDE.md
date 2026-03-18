# Live-Game Plugin Dev Guide

Dieser Guide beschreibt das ZIP-Format für Live-Game-Plugins in `mikesBAR`.

Wichtig:
- Plugin-Pakete registrieren und beschreiben ein Live-Game.
- Sie laden keinen beliebigen Servercode nach.
- Die eigentliche Multiplayer-Game-Logik läuft entweder über die vorhandenen Core-APIs oder in einer externen Game-App, die per API angebunden ist.

## Zweck eines Plugin-Pakets

Ein Plugin-Paket liefert:
- Metadaten für den Live-Game-Katalog
- Dealer-Auswahl und Sortierung
- optional eine externe Start-URL
- optionale Doku- und Asset-Dateien

Ein Plugin-Paket liefert nicht:
- DLLs
- Shell-Skripte
- ausführbaren Backend-Code
- Datenbankmigrationen

## Erlaubte ZIP-Inhalte

Erlaubt sind nur diese Dateien und Ordner:
- `manifest.json`
- `README.md`
- `assets/...`
- `docs/...`

Erlaubte Dateiendungen in `assets/` und `docs/`:
- `.json`
- `.md`
- `.txt`
- `.svg`
- `.png`
- `.jpg`
- `.jpeg`
- `.webp`
- `.gif`

Alles andere wird beim Upload abgelehnt.

## Empfohlene ZIP-Struktur

Empfohlen ist diese Struktur direkt auf ZIP-Ebene:

```text
my-plugin/
├── manifest.json
├── README.md
├── assets/
│   └── icon.svg
└── docs/
    └── integration.md
```

Im ZIP soll idealerweise **kein zusätzlicher äußerer Sammelordner** enthalten sein.

Empfohlenes ZIP-Ergebnis:

```text
manifest.json
README.md
assets/icon.svg
docs/integration.md
```

Der Installer toleriert zusätzlich auch einen einzelnen äußeren Ordner, aber das empfohlene Format ist ohne Wrapper-Ordner.

## Manifest

`manifest.json` ist Pflicht.

Beispiel:

```json
{
  "packageType": "mikesbar-livegame",
  "schemaVersion": 1,
  "key": "roulette_pro",
  "name": "Roulette Pro",
  "version": "1.0.0",
  "description": "Externes Live-Roulette mit eigener Multiplayer-Logik.",
  "clientRoute": "/dealer/players",
  "launchMode": "external",
  "dealerSelectable": true,
  "requiresPlayerSession": true,
  "defaultEnabled": true,
  "sortOrder": 100,
  "accentColor": "red",
  "developer": "Your Studio",
  "externalLaunchUrl": "https://games.example.com/roulette-pro"
}
```

## Manifest-Felder

Pflicht:
- `packageType`
  Wert muss `mikesbar-livegame` sein.
- `schemaVersion`
  Aktuell nur `1`.
- `key`
  Kleinbuchstaben, Zahlen, `_` und `-`, 2 bis 64 Zeichen.
- `name`
- `version`

Optional:
- `description`
- `clientRoute`
  Für interne Starts. Standard ist `/dealer/players`.
- `launchMode`
  Erlaubt: `table`, `direct`, `external`
- `dealerSelectable`
- `requiresPlayerSession`
- `defaultEnabled`
- `sortOrder`
- `accentColor`
- `developer`
- `externalLaunchUrl`
  Pflicht, wenn `launchMode` auf `external` steht.

## Launch-Modi

`table`
- Nutzung über den normalen Dealer-/Tisch-Flow
- Standardroute meist `/dealer/players`

`direct`
- Direkter Einstieg ohne aktive Tischsession
- geeignet für Kasse oder Sondermodule

`external`
- Startet eine externe URL
- geeignet für separat entwickelte Live-Multiplayer-Apps
- `externalLaunchUrl` muss eine vollständige `http`- oder `https`-URL sein

## ZIP bauen

Empfohlener Weg mit dem Repo-Helfer:

```bash
bash scripts/package-live-plugin.sh /pfad/zum/plugin-ordner
```

Manuell mit `zip`:

```bash
cd /pfad/zum/plugin-ordner
zip -r ../roulette-pro-1.0.0.zip manifest.json README.md assets docs -x "*.DS_Store" "__MACOSX/*"
```

Wichtig:
- `manifest.json` muss im ZIP enthalten sein
- keine Build-Artefakte mitschicken
- keine Secrets, Tokens, Zertifikate oder Zugangsdaten mitschicken

## Installation im Admin-Menü

Im Admin-Dashboard unter `System Features`:
- ZIP auswählen
- hochladen
- Paket wird validiert und installiert
- danach erscheint das Spiel im Live-Game-Katalog

## Deinstallation

Im Admin-Dashboard:
- installiertes Plugin-Paket auswählen
- entfernen

Dabei werden:
- das Paket aus dem Plugin-Speicher gelöscht
- der Katalogeintrag entfernt
- aktive Dealer-Zuordnungen für dieses Plugin beendet

## Beispiel-Datei

Eine Beispiel-`manifest.json` liegt unter:

`docs/examples/live-game-plugin/manifest.json`
