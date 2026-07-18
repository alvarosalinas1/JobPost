// Utilidades anti-detección: el objetivo es que el tráfico parezca de una
// persona navegando, no de un script. Se usan desde scrapers y appliers.

const USER_AGENTS = [
  // Chrome Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  // Chrome macOS
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  // Edge Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
  // Firefox Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
];

export function randomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Entero aleatorio uniforme en [minMs, maxMs].
export function randomDelay(minMs, maxMs) {
  return Math.floor(minMs + Math.random() * (maxMs - minMs));
}

// Jitter: variación de ±pct sobre un valor base.
export function jitter(baseMs, pct = 0.3) {
  const delta = baseMs * pct;
  return Math.floor(baseMs - delta + Math.random() * delta * 2);
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Espera un tiempo aleatorio y lo deja en el log para poder auditarlo.
export async function sleepRandom(minMs, maxMs, label = "") {
  const ms = randomDelay(minMs, maxMs);
  if (label) {
    console.log(`    [anti-bot] Esperando ${(ms / 1000).toFixed(1)}s ${label}`);
  }
  await sleep(ms);
  return ms;
}

// true si este ciclo debe ser "de reposo": scrapea y evalúa pero no postula.
// Probabilidad configurable con REST_CYCLE_PROB (default 0.3 = 30%).
export function isRestCycle() {
  const prob = Number(process.env.REST_CYCLE_PROB ?? 0.3);
  return Math.random() < prob;
}
