import { IndeedScraper } from "./indeed.js";
import { ComputrabajoScraper } from "./computrabajo.js";
import { saveJobs, getActiveProfileKeywords } from "../db.js";

// Para agregar una plataforma: crear el scraper y sumarlo aquí.
// (LinkedIn queda fuera por ahora.)
const SCRAPERS = [new ComputrabajoScraper(), new IndeedScraper()];

// Ejecuta todos los scrapers, deduplica por URL y guarda en Supabase.
// Devuelve solo las ofertas nuevas (no vistas antes).
export async function runAllScrapers() {
  // Perfiles aceptados vía webhook (tabla active_profiles) se suman
  // dinámicamente a SEARCH_TERMS antes de scrapear.
  const extraKeywords = await getActiveProfileKeywords();
  if (extraKeywords.length > 0) {
    const merged = [
      ...new Set(
        [...(process.env.SEARCH_TERMS || "").split(","), ...extraKeywords]
          .map((term) => term.trim())
          .filter(Boolean)
      ),
    ];
    process.env.SEARCH_TERMS = merged.join(",");
    console.log(`  Perfiles activos agregados: ${extraKeywords.join(", ")}`);
  }

  const collected = [];

  for (const scraper of SCRAPERS) {
    try {
      const jobs = await scraper.scrape();
      collected.push(...jobs);
    } catch (error) {
      console.error(`  [${scraper.name}] Scraper falló: ${error.message}`);
    }
  }

  const unique = [...new Map(collected.map((job) => [job.job_url, job])).values()];
  const saved = await saveJobs(unique);

  console.log(
    `  Total: ${collected.length} scrapeadas, ${unique.length} únicas, ${saved.length} nuevas`
  );
  return saved;
}
