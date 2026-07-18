import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env.local") });
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

import { chromium } from "playwright";
import { randomUserAgent, sleepRandom } from "../../utils/anti-bot.js";

// Scrapea los perfiles PÚBLICOS del propio candidato (sin login) para tener
// una fuente única de verdad de su experiencia/competencias. Solo lectura de
// datos propios y públicos. Se guarda en memoria (no en Supabase por ahora).
//
// Las URLs de los perfiles se leen de variables de entorno para no hardcodear
// datos personales en el repo:
//   PROFILE_URL_COMPUTRABAJO, PROFILE_URL_TRABAJANDO, PROFILE_URL_LABORUM
export const profileData = {
  computrabajo: null,
  trabajando: null,
  laborum: null,
};

async function withPage(fn) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const context = await browser.newContext({
      userAgent: randomUserAgent(),
      locale: "es-CL",
      viewport: { width: 1366, height: 768 },
    });
    const page = await context.newPage();
    return await fn(page);
  } finally {
    await browser.close().catch(() => {});
  }
}

// Extrae texto de una lista de selectores; devuelve el primero con contenido.
async function textOf(page, selectors) {
  for (const selector of selectors) {
    const value = await page
      .locator(selector)
      .first()
      .textContent({ timeout: 1500 })
      .catch(() => null);
    if (value && value.trim()) return value.trim();
  }
  return null;
}

async function listOf(page, selector) {
  return page
    .locator(selector)
    .allTextContents()
    .then((arr) => arr.map((t) => t.trim()).filter(Boolean))
    .catch(() => []);
}

export async function scrapComputrabajoProfile() {
  const url = process.env.PROFILE_URL_COMPUTRABAJO;
  if (!url) {
    console.log("  [Computrabajo] Sin PROFILE_URL_COMPUTRABAJO — omitido");
    return null;
  }
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await sleepRandom(3000, 5000, "leyendo perfil");
    const data = {
      nombre: await textOf(page, ["h1", ".cv-name", '[itemprop="name"]']),
      ubicacion: await textOf(page, ['[itemprop="addressLocality"]', ".location"]),
      experiencia: await listOf(page, ".cv-experience li, .experience-item"),
      competencias: await listOf(page, ".cv-skills li, .skill-item, .tag"),
      fotoUrl: await page
        .locator('img.cv-photo, img[alt*="foto" i]')
        .first()
        .getAttribute("src")
        .catch(() => null),
    };
    profileData.computrabajo = data;
    console.log("[Computrabajo] Perfil scrapeado ✓");
    return data;
  }).catch((error) => {
    console.log(`[Computrabajo] Error scrapeando perfil: ${error.message}`);
    return null;
  });
}

export async function scrapTrabajandoProfile() {
  const url = process.env.PROFILE_URL_TRABAJANDO;
  if (!url) {
    console.log("  [Trabajando] Sin PROFILE_URL_TRABAJANDO — omitido");
    return null;
  }
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await sleepRandom(3000, 5000, "leyendo perfil");
    const data = {
      nombre: await textOf(page, ["h1", ".profile-name"]),
      experiencia: await listOf(page, ".experience li, .timeline-item"),
      competencias: await listOf(page, ".skills li, .competency"),
      certificaciones: await listOf(page, ".certifications li, .cert-item"),
    };
    profileData.trabajando = data;
    console.log("[Trabajando] Perfil scrapeado ✓");
    return data;
  }).catch((error) => {
    console.log(`[Trabajando] Error scrapeando perfil: ${error.message}`);
    return null;
  });
}

export async function scrapLaborumProfile() {
  const url = process.env.PROFILE_URL_LABORUM;
  if (!url) {
    console.log("  [Laborum] Sin PROFILE_URL_LABORUM — omitido");
    return null;
  }
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await sleepRandom(3000, 5000, "leyendo perfil");
    const data = {
      nombre: await textOf(page, ["h1", ".profile-name"]),
      experiencia: await listOf(page, ".experience li, .job-item"),
      competencias: await listOf(page, ".skills li, .skill"),
    };
    profileData.laborum = data;
    console.log("[Laborum] Perfil scrapeado ✓");
    return data;
  }).catch((error) => {
    console.log(`[Laborum] Error scrapeando perfil: ${error.message}`);
    return null;
  });
}

// Corre los 3 scrapers de perfil; tolerante a error (uno falla, sigue el resto).
export async function scrapeAllProfiles() {
  console.log("Scrapeando perfiles públicos propios...");
  await scrapComputrabajoProfile();
  await scrapTrabajandoProfile();
  await scrapLaborumProfile();
  return profileData;
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  scrapeAllProfiles()
    .then((data) => {
      console.log(JSON.stringify(data, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error(`[profile-scraper] Error: ${error.message}`);
      process.exit(1);
    });
}
