# HelferHand

Ein Aufgaben-Marktplatz nach dem Vorbild von **TaskRabbit**, von Grund auf für den
deutschen Markt gebaut (deutsche Sprache, EUR, deutsche Städte, DSGVO-Hinweise).
Kund:innen posten Aufgaben (Umzug, Möbelmontage, Reinigung, Gartenarbeit, ...),
Helfer:innen bewerben sich oder werden eingeladen, alles inklusive Chat,
Bewertungen und Bezahlung wird direkt in der App abgewickelt.

Basiert auf dem Proposal "Halping Hand Application" (Zenkoders, Okt. 2024).

## Projektstruktur

```
backend/   Node.js/Express + Prisma (SQLite) + Socket.io + Stripe (Test-Modus) — die API
web/       Next.js Web-App (Kund:innen, Helfer:innen, Admin-Panel)
mobile/    React Native (Expo) App — dieselbe API, iOS/Android
docs/      API_CONTRACT.md — vollständige REST/WebSocket-Referenz
```

## Features

- **Registrierung & Profile**: E-Mail-Verifizierung, Profil-Onboarding, "Werde Helfer"-Flow mit Kategorien, Stundensatz und Umkreis.
- **Aufgaben**: Erstellen, durchsuchen (Kategorie/Stadt/Budget/Volltext), bewerben, einladen, annehmen, Status-Workflow (Gepostet → Zugewiesen → In Bearbeitung → Abgeschlossen).
- **Chat**: Echtzeit-Nachrichten per Socket.io pro Aufgabe, inkl. Anhänge und Tipp-Indikator.
- **Bewertungen**: 5-Sterne-Bewertungen nach Abschluss, optional anonym.
- **Zahlungen**: Stripe-Integration im Test-Modus (Plattformgebühr, Auszahlung an Helfer:innen) — läuft auch ohne echte Stripe-Keys.
- **Benachrichtigungen**: In-App, live per WebSocket.
- **Admin-Panel**: Nutzerverwaltung (sperren), Support-Tickets, gemeldete Nutzer, alle Aufgaben, Statistik-Dashboard.
- **Lokalisiert für Deutschland**: Deutsche Kategorien & Städte, EUR-Formatierung, Impressum/Datenschutz-Platzhalter.

## Schnellstart

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init   # legt dev.db an
npx tsx prisma/seed.ts               # deutsche Kategorien, Städte, Demo-Accounts
npm run dev                          # http://localhost:4000
```

### 2. Web-App

```bash
cd web
cp .env.local.example .env.local
npm install
npm run dev                          # http://localhost:3000
```

### 3. Mobile-App (Expo)

```bash
cd mobile
npm install
npx expo start
```

`mobile/.env` enthält `EXPO_PUBLIC_API_URL` — für den Android-Emulator auf
`http://10.0.2.2:4000/api`, für ein physisches Gerät auf die LAN-IP des Rechners anpassen.

### Demo-Zugänge (Passwort für alle: `Passwort123!`)

| Rolle  | E-Mail                     |
|--------|-----------------------------|
| Admin  | admin@helferhand.de         |
| Kunde  | kunde@helferhand.de         |
| Helfer | helfer1@helferhand.de (Berlin) |
| Helfer | helfer2@helferhand.de (München) |

## Tech-Stack

- **Backend**: Node.js, Express, TypeScript, Prisma/SQLite, Socket.io, Stripe SDK (Test-Modus), Zod, JWT.
- **Web**: Next.js (App Router), TypeScript, Tailwind CSS, @tanstack/react-query, socket.io-client.
- **Mobile**: React Native (Expo, TypeScript), React Navigation, @tanstack/react-query, socket.io-client, AsyncStorage.

Vollständige API-Referenz: [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

## Bekannte Einschränkungen (MVP)

- **Zahlungen** laufen im Stripe-**Test-Modus**: Es werden keine echten Zahlungen verarbeitet, solange kein echter `STRIPE_SECRET_KEY` hinterlegt ist. Der Zahlungs-Flow (Intent erstellen → bestätigen → auszahlen) funktioniert end-to-end simuliert.
- **E-Mail-Verifizierung**: Da kein echter Mailversand angebunden ist, wird der Verifizierungslink direkt nach der Registrierung in der UI angezeigt (Server-Log + Response), statt per E-Mail versendet.
- **Helfer einladen**: Ohne dedizierten "Helfer suchen"-Endpunkt erfolgt die Einladung aktuell per Helfer-ID (sichtbar im öffentlichen Profil).
- **Mobile-App** wurde in dieser Umgebung ohne Emulator gebaut (kein Gerät verfügbar) — abgesichert über strikte TypeScript-Prüfung und erfolgreiches Bundling für iOS/Android, aber nicht manuell durchgeklickt.
- Admin-Funktionen sind bewusst nur in der Web-App verfügbar.

## Nächste Schritte für einen echten Launch

1. Von SQLite auf PostgreSQL wechseln (Prisma-Datasource anpassen) für Produktionsbetrieb.
2. Echten Stripe-Account + Webhooks einrichten, echten E-Mail-Versand (z.B. SES/Postmark) anbinden.
3. Mobile-App auf einem echten Gerät/Emulator durchtesten.
4. Impressum/Datenschutz mit echten rechtlichen Inhalten befüllen (DSGVO-Pflichtangaben).
