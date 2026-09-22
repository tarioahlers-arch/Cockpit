import { reencryptSourceConfigs } from './index.js';

/**
 * Schluesselrotation: neuen Schluessel als SHOPPULSE_SECRET_KEY, bisherigen als
 * SHOPPULSE_SECRET_KEY_PREVIOUS setzen und dieses Skript ausfuehren. Danach kann der alte
 * Schluessel entfernt werden.
 */
const n = reencryptSourceConfigs();
console.log(`${n} Zugangsdaten mit dem aktuellen Schlüssel neu verschlüsselt.`);
