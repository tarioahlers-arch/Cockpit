# JobCockpit

Deutsche, DSGVO-konforme, KI-gestützte Bewerbungsassistenz-App für iOS und Android.
Maßgeschneiderte Anschreiben in 30 Sekunden plus strukturiertes Tracking aller Bewerbungen –
Quality-First statt Mass-Apply, gebaut für Jobsuchende im DACH-Raum.

> Status: **Phase 1 – Setup** (siehe [Roadmap](#roadmap)).

## Tech-Stack

| Bereich | Technologie |
| --- | --- |
| App | React Native + Expo SDK 57, TypeScript (strict), Expo Router |
| UI | Tamagui (eigenes Navy/Gold-Theme, Light & Dark), Lucide Icons, Playfair Display + DM Sans |
| State | Zustand (Client), TanStack Query (Server), react-hook-form + zod (Forms) |
| Storage | expo-secure-store (Session/Tokens), MMKV (Einstellungen) |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions in Deno) – Region Frankfurt |
| KI | Anthropic Claude (primär), OpenAI (Fallback) – ausschließlich über Edge Functions |
| Payments | RevenueCat (In-App), Stripe (Web) |
| Monitoring | Sentry, PostHog (EU-Hosting) |
| i18n | i18next + react-i18next, date-fns |
| Tests/CI | Jest (jest-expo), Testing Library, Maestro (E2E), GitHub Actions, EAS Build/Submit |

## Projektstruktur

```
jobcockpit/
├── .github/workflows/    # CI (Lint, Typecheck, Tests) + wöchentlicher Link-Check
├── apps/mobile/          # Expo App
│   ├── app/              # Expo-Router-Routen: (auth)/, (tabs)/, _layout.tsx
│   ├── components/       # Geteilte UI-Komponenten
│   ├── features/         # Feature-Module: auth, profile, generator, tracker, settings
│   ├── lib/              # Supabase-Client, i18n, Storage, Pricing-Logik, Design-Tokens
│   ├── stores/           # Zustand-Stores
│   ├── types/            # Globale Typen (u. a. Datenbank)
│   ├── locales/          # de.json, en.json
│   └── assets/           # App-Icons (aus assets/brand/logo-source.png generiert)
├── supabase/
│   ├── migrations/       # DB-Schema inkl. RLS
│   ├── data/             # Kuratierte Daten (Karriereseiten-Verzeichnis als JSON)
│   ├── functions/        # Edge Functions (ab Phase 3)
│   └── seed.sql          # Lokale Testdaten
├── docs/                 # Architektur & Entscheidungen
└── scripts/              # Icon-Generator, Daten-Migration, Link-Check (siehe scripts/README.md)
```

## Schnellstart

Voraussetzungen: Node ≥ 20, für Supabase lokal zusätzlich Docker.

```bash
cd jobcockpit/apps/mobile
npm install
cp ../../.env.example .env        # nur Abschnitt 1 (EXPO_PUBLIC_*) ausfüllen
npx expo start                    # Expo Go reicht nicht (MMKV, RevenueCat) → Development Build:
npx expo run:ios                  # bzw. run:android, oder: npx eas-cli build --profile development
```

Qualitätschecks (laufen auch in CI):

```bash
npm run lint && npm run typecheck && npm test
```

### Supabase lokal

```bash
cd jobcockpit
npx supabase init                 # einmalig: erzeugt supabase/config.toml (Migrationen bleiben erhalten)
npx supabase start                # lokale Instanz in Docker
npx supabase db reset             # wendet migrations/ + seed.sql an
npm run db:types                  # generierte DB-Typen für die App
```

Gegen das Cloud-Projekt (Frankfurt): `npx supabase link --project-ref <ref>` und `npx supabase db push`.
Ohne CLI: Inhalt der Dateien in `supabase/migrations/` der Reihe nach im Supabase-Dashboard unter
**SQL Editor** ausführen.

## Datenbank

Siehe `supabase/migrations/20261002000000_initial_schema.sql`. Kernpunkte:

- `users` erweitert `auth.users`; ein Trigger legt bei Registrierung `users` + `profiles` an.
- RLS auf **allen** Tabellen: Nutzer sehen und ändern nur eigene Daten.
- Abo-Status (`subscription_tier`) ist für Nutzer schreibgeschützt – nur der Server (RevenueCat-Webhook) setzt ihn.
- `cover_letters` und `usage_tracking` werden nur serverseitig angelegt, damit das Rate-Limit nicht umgangen werden kann.
- Tier-Limits (1 bzw. 5 CVs, 20 Bewerbungen im Free-Tier) werden zusätzlich per Trigger erzwungen.
- Privater Storage-Bucket `cvs`, Ordner pro Nutzer-ID.
- Karriereseiten-Verzeichnis (154 DACH-Firmen) kommt per Migration aus `supabase/data/career-companies.json`.
- DSGVO: `audit_log`, `request_account_deletion()` (30 Tage Grace-Period), `last_active_at` für die Retention-Policy.

## Roadmap

| Phase | Inhalt | Status |
| --- | --- | --- |
| 1 – Setup | Repo-Struktur, Expo + TS strict, DB-Schema/RLS, Tamagui, i18n, Navigation | in Arbeit |
| 2 – Auth & Profil | Supabase Auth (E-Mail, Apple, Google), Onboarding, Profil, CV-Upload | offen |
| 3 – Generator | Edge Function (Claude), Generator-UI, Rate-Limiting, PDF-Export | offen |
| 4 – Tracker | Liste/Detail/Statistik, CRUD, Push-Reminder | offen |
| 5 – Monetarisierung | RevenueCat, Paywall, Abo-Verwaltung | offen |
| 6 – Polishing & Legal | Rechtstexte, Account-Löschung, Datenexport, Barrierefreiheit | offen |
| 7 – Testing & Release | Tests, TestFlight, Play Internal Testing, Store-Submission | offen |

Architektur-Entscheidungen, Annahmen und offene Fragen: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
