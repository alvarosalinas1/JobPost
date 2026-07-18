import { runJobSearchCycle } from "../src/index.js";

// Corta el proceso si el ciclo se cuelga (Playwright puede dejar handles vivos).
const TIMEOUT_MS = 20 * 60 * 1000;
const timeout = setTimeout(() => {
  console.error("[cron] Timeout de 20 min alcanzado, forzando salida");
  process.exit(1);
}, TIMEOUT_MS);

try {
  await runJobSearchCycle();
  clearTimeout(timeout);
  process.exit(0);
} catch (error) {
  console.error(`[cron] Error fatal: ${error.message}`);
  process.exit(1);
}
