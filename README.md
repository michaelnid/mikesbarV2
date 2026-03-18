# mikesbar.eu Core Framework

API-first Core-Framework fuer Benutzerverwaltung, Dealer-Tische, Statistiken und pluginbasierte Live-Games. Clients und Apps werden extern entwickelt und nur per API angebunden.

## Tech-Stack

- Backend: ASP.NET Core 8, Entity Framework Core, MySQL/MariaDB, SignalR
- Frontend: React 19, Vite
- Webserver: nginx, PHP-FPM fuer Avatar-Uploads
- TLS: Let's Encrypt mit Certbot

## Mindestanforderungen

- Betriebssystem: Debian 12/13 oder Ubuntu 24.04 LTS
- RAM: mindestens 2 GB
- vCPU: mindestens 2
- Speicherplatz: mindestens 10 GB
- Ports: `22/tcp`, `80/tcp`, `443/tcp`

## Befehle

- Install One-Line:
  `curl -fsSL https://raw.githubusercontent.com/michaelnid/mikesbarV2/main/scripts/bootstrap-install.sh | sudo bash`
- Update:
  `sudo mikesbar-update`
- Deinstall:
  `sudo mikesbar-uninstall`

## Installationshinweise

- Der Installer fragt interaktiv Domain, Admin-Zugang und Datenbankwerte ab.
- Wenn eine Domain angegeben wird, richtet das Setup automatisch nginx, Reverse-Proxy und ein Let's-Encrypt-Zertifikat ohne E-Mail-Pflicht ein.
- Ohne Domain wird das System ueber HTTP auf der Server-IP bereitgestellt.
