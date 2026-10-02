-- Seed-Daten für lokale Entwicklung (`supabase db reset`).
-- Karriereseiten-Verzeichnis: Startauswahl. Ziel laut Spezifikation: 50+ DACH-Firmen.
-- ANNAHME: URLs vor dem Launch einmal manuell auf Erreichbarkeit prüfen (scripts/ folgt).
insert into public.career_companies (name, category, careers_url, headquarters) values
  ('Henkel',           'FMCG',       'https://www.henkel.de/karriere',            'Düsseldorf'),
  ('Beiersdorf',       'FMCG',       'https://www.beiersdorf.de/karriere',        'Hamburg'),
  ('Nestlé Deutschland','FMCG',      'https://www.nestle.de/jobs',                'Frankfurt am Main'),
  ('dm-drogerie markt','Retail',     'https://www.dm.de/karriere',                'Karlsruhe'),
  ('SAP',              'Tech',       'https://jobs.sap.com',                      'Walldorf'),
  ('Zalando',          'Tech',       'https://jobs.zalando.com',                  'Berlin'),
  ('Siemens',          'Industrie',  'https://www.siemens.com/karriere',          'München'),
  ('BMW Group',        'Automotive', 'https://www.bmwgroup.jobs',                 'München'),
  ('McKinsey & Company','Consulting','https://www.mckinsey.com/de/careers',       'Düsseldorf'),
  ('Roland Berger',    'Consulting', 'https://www.rolandberger.com/de/Join',      'München'),
  ('Allianz',          'Finance',    'https://careers.allianz.com',               'München'),
  ('Deutsche Bank',    'Finance',    'https://careers.db.com',                    'Frankfurt am Main')
on conflict (name) do nothing;
