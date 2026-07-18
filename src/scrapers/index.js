import { IndeedScraper } from "./indeed.js";
import { ComputrabajoScraper } from "./computrabajo.js";
import { saveJobs } from "../db.js";

// Para agregar una plataforma: crear el scraper y sumarlo aquí.
// (LinkedIn queda fuera por ahora.)
const SCRAPERS = [new ComputrabajoScraper(), new IndeedScraper()];

// Ejecuta todos los scrapers, deduplica por URL y guarda en Supabase.
// Devuelve solo las ofertas nuevas (no vistas antes).
export async function runAllScrapers() {
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
