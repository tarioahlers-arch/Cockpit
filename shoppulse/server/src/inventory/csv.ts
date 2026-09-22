import type { LevelInput } from './types.js';

/**
 * Parst Bestandslisten aus ERP/WMS-Exporten. Erwartet eine Kopfzeile; erkannt werden gaengige
 * Spaltennamen (deutsch/englisch). Trennzeichen ; , oder Tab werden automatisch erkannt.
 */
const ALIASES: Record<'sku' | 'quantity' | 'location' | 'ean', string[]> = {
  sku: ['sku', 'artikelnummer', 'artnr', 'art.-nr.', 'artikel-nr', 'productnumber', 'item', 'itemnumber'],
  quantity: ['quantity', 'qty', 'bestand', 'menge', 'lagerbestand', 'stock', 'available', 'verfuegbar', 'verfügbar'],
  location: ['location', 'lager', 'lagerort', 'warehouse', 'filiale', 'store'],
  ean: ['ean', 'gtin', 'barcode'],
};

function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === sep && !quoted) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export interface CsvParseResult {
  levels: LevelInput[];
  errors: string[];
}

export function parseInventoryCsv(text: string): CsvParseResult {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { levels: [], errors: ['Datei braucht eine Kopfzeile und mindestens eine Datenzeile.'] };

  const first = lines[0];
  const sep = first.includes('\t') ? '\t' : first.split(';').length >= first.split(',').length ? ';' : ',';
  const head = splitLine(first, sep).map((h) => h.toLowerCase());
  const col = (k: keyof typeof ALIASES) => head.findIndex((h) => ALIASES[k].includes(h));
  const iSku = col('sku');
  const iQty = col('quantity');
  const iLoc = col('location');
  const iEan = col('ean');
  if (iSku < 0 || iQty < 0) {
    return { levels: [], errors: [`Spalten für SKU und Bestand nicht gefunden (Kopfzeile: ${head.join(', ')}).`] };
  }

  const levels: LevelInput[] = [];
  const errors: string[] = [];
  lines.slice(1).forEach((line, idx) => {
    const cells = splitLine(line, sep);
    const sku = cells[iSku];
    const qty = Number(String(cells[iQty] ?? '').replace(/\./g, '').replace(',', '.'));
    if (!sku) return errors.push(`Zeile ${idx + 2}: SKU fehlt.`);
    if (!Number.isFinite(qty)) return errors.push(`Zeile ${idx + 2}: Bestand "${cells[iQty]}" ist keine Zahl.`);
    levels.push({
      sku,
      quantity: Math.round(qty),
      location: iLoc >= 0 && cells[iLoc] ? cells[iLoc] : null,
      ean: iEan >= 0 && cells[iEan] ? cells[iEan] : null,
    });
  });
  return { levels, errors };
}
