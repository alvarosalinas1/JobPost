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

// ── Login en portales de empleo ──────────────────────────────────────────
// Credenciales SOLO desde process.env (GitHub Secrets). Nunca se loguean sus
// valores. El candidato inicia sesión en SUS PROPIAS cuentas para que las
// postulaciones se completen.

// Devuelve {email, password} o null si falta alguna. No loguea los valores.
function credentialsFor(prefix) {
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  if (!email || !password) return null;
  return { email, password };
}

// Login genérico: navega, rellena email/password, envía y verifica que la
// sesión quedó iniciada (ya no hay campo de password visible). Devuelve
// { context, page, ok }. Nunca lanza; en fallo, ok=false.
async function loginPortal(browser, { name, prefix, loginUrl, selectors }) {
  const creds = credentialsFor(prefix);
  if (!creds) {
    console.log(`[${name}] Sin credenciales en Secrets — login omitido`);
    return { context: null, page: null, ok: false, reason: "sin credenciales" };
  }

  const context = await browser.newContext({
    userAgent: randomUserAgent(),
    locale: "es-CL",
    viewport: { width: 1366, height: 768 },
  });

  try {
    const page = await context.newPage();
    await sleepRandom(3000, 8000, "antes de abrir login");
    await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 45000 });

    await page.fill(selectors.email, creds.email, { timeout: 10000 });
    await sleepRandom(1000, 3000, "entre campos");
    await page.fill(selectors.password, creds.password, { timeout: 10000 });
    await sleepRandom(1000, 3000, "antes de enviar");
    await page.click(selectors.submit, { timeout: 10000 });

    await page.waitForTimeout(randomDelay(3000, 6000));

    const stillHasPassword = await page
      .locator('input[type="password"]')
      .first()
      .isVisible({ timeout: 1500 })
      .catch(() => false);

    if (stillHasPassword) {
      console.log(`[${name}] Login falló — revisar credenciales en Secrets`);
      await context.close().catch(() => {});
      return { context: null, page: null, ok: false, reason: "login_failed" };
    }

    console.log(`[${name}] Login exitoso`);
    return { context, page, ok: true };
  } catch {
    // No propagar el error crudo: podría contener partes de la URL/estado.
    console.log(`[${name}] Login falló — revisar credenciales en Secrets`);
    await context.close().catch(() => {});
    return { context: null, page: null, ok: false, reason: "login_error" };
  }
}

export async function loginComputrabajo(browser) {
  return loginPortal(browser, {
    name: "Computrabajo",
    prefix: "COMPUTRABAJO",
    loginUrl: "https://cl.computrabajo.com/login",
    selectors: {
      email: 'input[type="email"], #email, input[name="email"]',
      password: 'input[type="password"], #password',
      submit: 'button[type="submit"], button:has-text("Ingresar")',
    },
  });
}

export async function loginTrabajando(browser) {
  return loginPortal(browser, {
    name: "Trabajando",
    prefix: "TRABAJANDO",
    loginUrl: "https://www.trabajando.cl/login",
    selectors: {
      email: 'input[type="email"], #usuario, input[name="email"]',
      password: 'input[type="password"], #clave',
      submit: 'button[type="submit"], button:has-text("Ingresar")',
    },
  });
}

export async function loginLaborum(browser) {
  return loginPortal(browser, {
    name: "Laborum",
    prefix: "LABORUM",
    loginUrl: "https://www.laborum.cl/login",
    selectors: {
      email: 'input[type="email"], #email, input[name="email"]',
      password: 'input[type="password"], #password',
      submit: 'button[type="submit"], button:has-text("Ingresar")',
    },
  });
}

// Postula usando una sesión ya autenticada (contexto del login). Navega a la
// oferta, hace click en postular y verifica confirmación. Cierra el contexto.
async function applyWithSession(session, job, { clickSelectors, confirmPattern }) {
  if (!session.ok) {
    return { success: false, note: "login_failed", status: "login_failed" };
  }
  const { context } = session;
  try {
    const page = await context.newPage();
    await sleepRandom(3000, 8000, "antes de abrir oferta");
    await page.goto(job.job_url, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });

    const clicked = await clickFirst(page, clickSelectors);
    if (!clicked) {
      return { success: false, note: "Botón de postulación no encontrado" };
    }

    await page.waitForTimeout(randomDelay(2000, 5000));
    const confirmed = await hasConfirmation(page, confirmPattern);
    return confirmed
      ? { success: true, note: "Postulación confirmada" }
      : { success: false, note: "Sin confirmación de postulación" };
  } catch (error) {
    return { success: false, note: error.message };
  } finally {
    await context.close().catch(() => {});
  }
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
  const session = await loginComputrabajo(browser);
  return applyWithSession(session, job, {
    clickSelectors: [
      ".js-b-offer-apply",
      'button:has-text("Postular")',
      'a:has-text("Postular")',
    ],
    confirmPattern:
      "/postulaci[oó]n (enviada|realizada)|ya has postulado|has postulado/i",
  });
}

export async function applyTrabajando(browser, job) {
  const session = await loginTrabajando(browser);
  return applyWithSession(session, job, {
    clickSelectors: [
      'button:has-text("Postular")',
      'a:has-text("Postular")',
      ".btn-postular",
    ],
    confirmPattern: "/postulaci[oó]n (enviada|realizada|exitosa)|ya postulaste/i",
  });
}

export async function applyLaborum(browser, job) {
  const session = await loginLaborum(browser);
  return applyWithSession(session, job, {
    clickSelectors: [
      'button:has-text("Postularme")',
      'button:has-text("Postular")',
      'a:has-text("Postular")',
    ],
    confirmPattern: "/postulaci[oó]n (enviada|realizada|exitosa)|te postulaste/i",
  });
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
