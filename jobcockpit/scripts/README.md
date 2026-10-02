# Skripte

| Skript | Zweck |
| --- | --- |
| `generate-icons.py` | Erzeugt alle App-Icons (iOS, Android Adaptive/Monochrom, Splash, Favicon) aus `apps/mobile/assets/brand/logo-source.png`. Benötigt Pillow. |
| `build-career-companies.mjs` | Validiert `supabase/data/career-companies.json` und erzeugt daraus die Daten-Migration. `--new` legt eine neue, datierte Migration an (nach dem ersten Deployment verwenden). |
| `check-career-urls.mjs` | Prüft alle Karriereseiten-Links auf Erreichbarkeit (läuft wöchentlich in CI). |
