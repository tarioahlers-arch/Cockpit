# Changelog

Alle relevanten Änderungen an JobCockpit. Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

### Added
- Repo-Struktur (`apps/mobile`, `supabase`, `docs`, `scripts`)
- Expo-App (SDK 57, TypeScript strict, Expo Router) mit Tamagui-Theme (Navy/Gold, Light/Dark)
- i18n (DE/EN), Zustand-Settings-Store mit MMKV, Supabase-Client mit SecureStore-Session
- Initiale Supabase-Migration inkl. RLS auf allen Tabellen, CV-Storage-Bucket, Tier-Limits
- Unit-Tests für Pricing-Logik, SecureStore-Chunking, i18n und Settings-Store
- App-Icon, Android Adaptive/Themed Icon, Splash und Favicon aus dem JobCockpit-Logo
- Karriereseiten-Verzeichnis mit 154 DACH-Firmen (Daten-Migration, Generator, Link-Check)
- GitHub Actions: CI (Lint, Typecheck, Prettier, Tests mit Coverage) und wöchentlicher Link-Check
