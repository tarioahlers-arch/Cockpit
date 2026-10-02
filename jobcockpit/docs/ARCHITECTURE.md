# Architektur & Entscheidungen

Dieses Dokument hält Architektur-Entscheidungen, getroffene Annahmen und Vorschläge fest,
damit sie nachvollziehbar und überprüfbar bleiben.

## Entscheidungen

### Expo SDK 57 statt "SDK 51+"
Das Briefing nennt SDK 51+ als Untergrenze; aktuell ist SDK 57. Neue Projekte starten auf dem
aktuellen SDK, um nicht direkt mehrere Upgrade-Schritte vor dem Store-Release zu haben
(Play Store verlangt aktuelle Target-API-Level).

### UI-Library: Tamagui (statt NativeBase)
NativeBase wird nicht mehr aktiv weiterentwickelt (Nachfolger gluestack). Tamagui bietet
Theme-Tokens, Light/Dark-Themes und gute Performance durch statische Style-Extraktion.
Die Marken-Tokens liegen framework-unabhängig in `lib/theme.ts` und werden in
`tamagui.config.ts` als eigene Theme-Keys (`$primary`, `$accent`, …) eingebunden.

### Kein npm-Workspace-Monorepo (vorerst)
`apps/mobile` ist ein eigenständiges npm-Projekt; das Root-`package.json` delegiert nur Skripte.
Das vermeidet Metro-/Hoisting-Probleme. Sobald `marketing/` (Landing Page) dazukommt, kann auf
npm Workspaces umgestellt werden, falls Code geteilt werden soll.

### Session-Storage in SecureStore mit Chunking
Supabase-Sessions überschreiten oft das 2-KB-Limit von SecureStore-Einträgen. `lib/secureStorage.ts`
teilt Werte in Chunks auf. MMKV wird nur für nicht-sensible Daten (Einstellungen) genutzt.

### KI-Aufrufe ausschließlich serverseitig
API-Keys für Anthropic/OpenAI liegen nur als Supabase-Secrets vor. Die App ruft eine Edge Function
auf, die Rate-Limit prüft, generiert, cached (`request_hash`) und in `cover_letters` +
`usage_tracking` schreibt. Clients dürfen diese Tabellen deshalb nicht selbst beschreiben.

### Limits doppelt abgesichert
UI-Logik in `lib/pricing.ts` (für Anzeige/Paywall), maßgeblich aber serverseitig: Trigger für
CV- und Tracker-Limits, Edge Function für das Anschreiben-Limit.

## Annahmen (bitte prüfen)

- **ANNAHME:** Zusätzliche Tabellen über das Briefing hinaus, weil MVP-Features sie benötigen:
  `career_companies` + `favorite_companies` (5.5), `application_events` (Timeline, 5.4),
  `push_tokens` (Reminder, 5.4), `audit_log` (DSGVO, Abschnitt 9).
- **ANNAHME:** Zusätzliche Spalten: `users.last_active_at` (Retention), `users.deletion_requested_at`
  (30-Tage-Grace-Period), `applications.contact_person` / `reference_number` (Generator-Flow Schritt 4),
  `cover_letters.cv_version_id`, `request_hash`, `updated_at` (Editor, Caching).
- **ANNAHME:** `applications.source` als Freitext (mit empfohlenen Werten im Client) statt Enum,
  damit neue Jobbörsen ohne Migration möglich sind.
- **ANNAHME:** Anschreiben-Limit zählt pro Kalendermonat (nicht rollierende 30 Tage).
- **ANNAHME:** Ein abgelaufenes Abo (`subscription_expires_at` in der Vergangenheit) zählt als Free.
- **ANNAHME:** Die Karriereseiten-Links (154 Firmen) sind nach bestem Wissen zusammengestellt, aber noch
  nicht automatisiert geprüft – der Workflow `career-links.yml` prüft sie wöchentlich bzw. bei Änderungen.

## Vorschläge

- **VORSCHLAG:** Modell `claude-sonnet-5-5` statt `claude-sonnet-4` (veraltet). Über
  `ANTHROPIC_MODEL` konfigurierbar; `cover_letters.model_used` protokolliert das tatsächlich genutzte Modell.
- **VORSCHLAG:** DB-Typen nach Projekt-Anlage mit `supabase gen types` generieren statt handgeschrieben.

## Entschieden mit Produkt-Owner

- Eigenes Repository `jobcockpit` (statt Unterordner im Sammel-Repo).
- Social Login in Phase 2: E-Mail/Passwort, Sign in with Apple **und** Google.
- Karriereseiten-Verzeichnis: so viele DACH-Firmen wie möglich. Pflege über
  `supabase/data/career-companies.json` + `scripts/build-career-companies.mjs`; Daten werden per
  Migration ausgeliefert (nicht nur `seed.sql`), damit sie auch in Produktion vorhanden sind.
- App-Icon: vom Produkt-Owner geliefertes Logo (Navy + Gold), Varianten via `scripts/generate-icons.py`.
