import { chromium } from "playwright";
import {
  randomUserAgent,
  randomDelay,
  sleepRandom,
} from "../utils/anti-bot.js";

export async function launchBrowser() {
  return chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
}

async function openPage(browser, url) {
  const context = await browser.newContext({
    userAgent: randomUserAgent(),
    locale: "es-CL",
    viewport: { width: 1366, height: 768 },
  });
  const page = await context.newPage();
  // Pausa entre pestañas: una persona no abre páginas en ráfaga
  await sleepRandom(3000, 8000, "antes de abrir pestaña");
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  return { context, page };
}

async function clickFirst(page, selectors) {
  for (const selector of selectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 1500 })) {
        // Delay humano largo antes de cada click (lee la oferta primero)
        await sleepRandom(2000, 15000, "antes del click");
        await el.click();
        return true;
      }
    } catch {
      // selector no presente, probar el siguiente
    }
  }
  return false;
}

async function requiresLogin(page, urlPattern) {
  if (urlPattern.test(page.url())) return true;
  return page
    .locator('input[type="password"]')
    .first()
    .isVisible({ timeout: 1000 })
    .catch(() => false);
}

async function hasConfirmation(page, pattern) {
  return page
    .locator(`text=${pattern}`)
    .first()
    .isVisible({ timeout: 5000 })
    .catch(() => false);
}

export async function applyIndeed(browser, job) {
  let context = null;
  try {
    const opened = await openPage(browser, job.job_url);
    context = opened.context;
    const page = opened.page;

    const clicked = await clickFirst(page, [
      "#indeedApplyButton",
      ".jobsearch-IndeedApplyButton",
      'button:has-text("Postular")',
      'button:has-text("Aplicar")',
    ]);
    if (!clicked) {
      return { success: false, note: "Botón de postulación no encontrado" };
    }

    await page.waitForTimeout(randomDelay(2000, 5000));
    if (await requiresLogin(page, /secure\.indeed\.com|account\/login/i)) {
      return { success: false, note: "Indeed requiere iniciar sesión" };
    }

    const confirmed = await hasConfirmation(
      page,
      "/postulaci[oó]n enviada|solicitud enviada|application submitted/i"
    );
    return confirmed
      ? { success: true, note: "Postulación confirmada" }
      : { success: false, note: "Sin confirmación de postulación" };
  } catch (error) {
    return { success: false, note: error.message };
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

export async function applyComputrabajo(browser, job) {
  let context = null;
  try {
    const opened = await openPage(browser, job.job_url);
    context = opened.context;
    const page = opened.page;

    const clicked = await clickFirst(page, [
      ".js-b-offer-apply",
      'button:has-text("Postular")',
      'a:has-text("Postular")',
    ]);
    if (!clicked) {
      return { success: false, note: "Botón 'Postular' no encontrado" };
    }

    await page.waitForTimeout(randomDelay(2000, 5000));
    if (await requiresLogin(page, /login|registr|candidate\/signin/i)) {
      return { success: false, note: "Computrabajo requiere iniciar sesión" };
    }

    const confirmed = await hasConfirmation(
      page,
      "/postulaci[oó]n (enviada|realizada)|ya has postulado|has postulado/i"
    );
    return confirmed
      ? { success: true, note: "Postulación confirmada" }
      : { success: false, note: "Sin confirmación de postulación" };
  } catch (error) {
    return { success: false, note: error.message };
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

// Fallback para plataformas sin applier específico: intenta el patrón común
// y solo marca éxito si aparece una confirmación explícita.
export async function applyGeneric(browser, job) {
  let context = null;
  try {
    const opened = await openPage(browser, job.job_url);
    context = opened.context;
    const page = opened.page;

    const clicked = await clickFirst(page, [
      'button:has-text("Postular")',
      'a:has-text("Postular")',
      'button:has-text("Aplicar")',
      'button:has-text("Enviar CV")',
    ]);
    if (!clicked) {
      return { success: false, note: "Botón de postulación no encontrado" };
    }

    await page.waitForTimeout(randomDelay(2000, 5000));
    const confirmed = await hasConfirmation(
      page,
      "/postulaci[oó]n (enviada|realizada|exitosa)|cv enviado/i"
    );
    return confirmed
      ? { success: true, note: "Postulación confirmada" }
      : { success: false, note: "Sin confirmación de postulación" };
  } catch (error) {
    return { success: false, note: error.message };
  } finally {
    if (context) await context.close().catch(() => {});
  }
}
