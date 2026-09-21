# ShopFil - ein Image, das API und gebautes Frontend zusammen ausliefert.
#
# WICHTIG: Der Basis-Image-Tag (v1.63.0-jammy) muss zur exakt gepinnten
# "playwright"-Version in server/package.json passen (siehe dortiger
# Kommentar). Bei einem Versions-Bump beides zusammen aktualisieren, sonst
# sucht Playwright zur Laufzeit einen Chromium-Build, den das Image nicht
# enthaelt ("Executable doesn't exist").
FROM mcr.microsoft.com/playwright:v1.63.0-jammy

WORKDIR /app

# Erst nur die package.json-Dateien kopieren (Docker-Layer-Caching: npm ci
# muss nur bei geaenderten Abhaengigkeiten neu laufen, nicht bei jeder
# Codeaenderung).
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN npm ci

COPY . .

# Baut server (tsc -> server/dist) und web (vite build -> web/dist), siehe
# Root-package.json-Skript "build".
RUN npm run build

ENV NODE_ENV=production
ENV PORT=4000
# Zeigt direkt auf das Vite-Build-Ergebnis, statt es zusaetzlich nach
# server/public zu kopieren.
ENV STATIC_DIR=/app/web/dist

EXPOSE 4000
CMD ["node", "server/dist/index.js"]
