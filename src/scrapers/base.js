import fetch from "node-fetch";
import { randomUserAgent } from "../../utils/anti-bot.js";

export const DEFAULT_HEADERS = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-CL,es;q=0.9,en;q=0.8",
};

export class BaseScraper {
  constructor(name) {
    this.name = name;
  }

  async scrape() {
    throw new Error(`${this.name}: scrape() no implementado`);
  }

  log(message) {
    console.log(`  [${this.name}] ${message}`);
  }

  searchTerms() {
    return (process.env.SEARCH_TERMS || "asistente administrativo")
      .split(",")
      .map((term) => term.trim())
      .filter(Boolean);
  }

  location() {
    return process.env.LOCATION || "Santiago";
  }

  daysBack() {
    return Number(process.env.DAYS_BACK || 14);
  }
}

export async function fetchHtml(url, headers = {}) {
  const response = await fetch(url, {
    // User-Agent rotado en cada petición (anti-bot)
    headers: { ...DEFAULT_HEADERS, "User-Agent": randomUserAgent(), ...headers },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} en ${url}`);
  }
  return response.text();
}

// Extrae un monto en CLP desde texto tipo "$850.000" o "De $840.000 a $1.200.000".
// Devuelve el primer monto plausible (>= 100.000) o null.
export function parseSalaryCLP(text) {
  if (!text) return null;
  const candidates = [];
  for (const match of text.matchAll(/\$\s*([\d.,]+)/g)) {
    candidates.push(match[1]);
  }
  if (candidates.length === 0) {
    for (const match of text.matchAll(/\b(\d{1,3}(?:\.\d{3})+)\b/g)) {
      candidates.push(match[1]);
    }
  }
  for (const raw of candidates) {
    const value = Number(raw.replace(/[.,]/g, ""));
    if (value >= 100000 && value <= 99000000) return value;
  }
  return null;
}

// "Hoy", "Ayer", "Hace 3 días" → ISO string; null si no se reconoce.
export function parseRelativeDateEs(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  const now = Date.now();
  const DAY_MS = 86400000;
  if (/(hoy|reci[eé]n|hace\s+\d+\s+(hora|min))/.test(t)) {
    return new Date(now).toISOString();
  }
  if (/ayer/.test(t)) {
    return new Date(now - DAY_MS).toISOString();
  }
  const match = t.match(/hace\s+(\d+)\s+d[ií]as?/);
  if (match) {
    return new Date(now - Number(match[1]) * DAY_MS).toISOString();
  }
  return null;
}

// Normaliza al formato de la tabla `applications`.
export function normalizeJob({
  url,
  role,
  company,
  salary = null,
  postedDate = null,
  platform,
}) {
  return {
    job_url: url,
    role: role?.trim() || null,
    company: company?.trim() || null,
    salary,
    posted_date: postedDate,
    platform,
    status: "pending",
  };
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
