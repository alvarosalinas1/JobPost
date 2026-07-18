import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Carga .env.local (con respaldo en .env). Los demás módulos leen process.env
// de forma diferida (dentro de funciones), por lo que el hoisting de imports
// no rompe la carga de variables.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

import { runAllScrapers } from "./scrapers/index.js";
import { evaluateJobFit } from "./evaluator.js";
import {
  getJobsByStatus,
  updateApplicationStatus,
  recordFailure,
} from "./db.js";
import {
  launchBrowser,
  applyIndeed,
  applyComputrabajo,
  applyGeneric,
} from "./applier.js";
import { isRestCycle, sleepRandom } from "../utils/anti-bot.js";

const PLATFORM_APPLIERS = {
  Indeed: applyIndeed,
  Computrabajo: applyComputrabajo,
};

const EVALUATIONS_PER_CYCLE = 10;
// Anti-bot: máximo 1 postulación por ciclo (~1 por hora con el cron actual).
const APPLICATIONS_PER_CYCLE = 1;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runJobSearchCycle() {
  // Modo setup: valida que cada componente carga, sin ejecutar búsquedas
  // ni postulaciones. Se activa con SETUP_MODE=1 en .env.local.
  if (process.env.SETUP_MODE === "1") {
    const components = [
      ["Scraper listo", "./scrapers/index.js"],
      ["Evaluador listo", "./evaluator.js"],
      ["Mailer (stub)", "./mailer.js"],
      ["Profiler (stub)", "./profiler.js"],
    ];
    let allOk = true;
    for (const [label, modulePath] of components) {
      try {
        await import(modulePath);
        console.log(`[✓] ${label}`);
      } catch (error) {
        allOk = false;
        console.log(`[✗] ${label}: ${error.message}`);
      }
    }
    console.log(
      allOk
        ? "Sistema listo. NO se ejecutaron búsquedas (modo setup)"
        : "Hay componentes con errores (ver arriba)"
    );
    return;
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`[${new Date().toISOString()}] Iniciando ciclo de búsqueda`);
  console.log(`${"=".repeat(60)}\n`);

  // FASE 1: SCRAPING
  console.log("FASE 1: Scrapeando portales de empleo...");
  try {
    const newJobs = await runAllScrapers();
    console.log(`${newJobs.length} ofertas nuevas guardadas\n`);
  } catch (error) {
    console.error(`Error en fase de scraping: ${error.message}\n`);
  }

  // FASE 2: EVALUACIÓN
  console.log("FASE 2: Evaluando ofertas pendientes...");
  const pendingJobs = await getJobsByStatus("pending");

  for (const job of pendingJobs.slice(0, EVALUATIONS_PER_CYCLE)) {
    try {
      const evaluation = await evaluateJobFit(job);
      console.log(
        `  ${job.role} @ ${job.company ?? "?"} | Score: ${evaluation.score}/10 | Postular: ${evaluation.apply}`
      );
      await updateApplicationStatus(
        job.id,
        evaluation.apply ? "approved" : "skipped",
        evaluation.reasoning
      );
    } catch (error) {
      console.error(`  Error evaluando #${job.id}: ${error.message}`);
    }
    await sleep(500); // rate limit hacia Groq
  }

  // FASE 3: POSTULACIÓN
  console.log("\nFASE 3: Postulando a ofertas aprobadas...");

  // Anti-bot: ~30% de los ciclos no postulan, simulando inactividad humana.
  if (isRestCycle()) {
    console.log("Ciclo de reposo — revisando ofertas sin postular\n");
    console.log(`[${new Date().toISOString()}] Ciclo completo\n`);
    return;
  }

  const approvedJobs = await getJobsByStatus("approved");

  if (approvedJobs.length === 0) {
    console.log("No hay ofertas aprobadas.\n");
    console.log(`[${new Date().toISOString()}] Ciclo completo\n`);
    return;
  }

  let browser = null;
  try {
    browser = await launchBrowser();
  } catch (error) {
    console.error(`No se pudo lanzar el navegador: ${error.message}\n`);
    return;
  }

  try {
    for (const job of approvedJobs.slice(0, APPLICATIONS_PER_CYCLE)) {
      console.log(`  Postulando a ${job.role} @ ${job.company ?? "?"}...`);
      const applier = PLATFORM_APPLIERS[job.platform] || applyGeneric;

      try {
        const result = await applier(browser, job);
        if (result.success) {
          await updateApplicationStatus(job.id, "applied", result.note);
          console.log(`    ✓ Postulado`);
        } else {
          await updateApplicationStatus(job.id, "apply_failed", result.note);
          console.log(`    ✗ Falló: ${result.note}`);
        }
      } catch (error) {
        await recordFailure(job.id, error.message);
        console.log(`    ✗ Error: ${error.message}`);
      }

      // Pausa tipo humano entre postulaciones
      await sleepRandom(3000, 8000, "entre postulaciones");
    }
  } finally {
    await browser.close().catch(() => {});
  }

  console.log(`\n[${new Date().toISOString()}] Ciclo completo\n`);
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  runJobSearchCycle()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Error fatal:", error);
      process.exit(1);
    });
}
