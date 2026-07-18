import * as cheerio from "cheerio";
import {
  BaseScraper,
  fetchHtml,
  normalizeJob,
  parseSalaryCLP,
  parseRelativeDateEs,
  sleep,
} from "./base.js";

const BASE_URL = "https://cl.computrabajo.com";

export class ComputrabajoScraper extends BaseScraper {
  constructor() {
    super("Computrabajo");
  }

  buildSearchUrl(term) {
    const params = new URLSearchParams({ q: term, p: this.location() });
    return `${BASE_URL}/ofertas-de-trabajo/?${params.toString()}`;
  }

  async scrape() {
    const jobs = [];

    for (const term of this.searchTerms()) {
      try {
        const html = await fetchHtml(this.buildSearchUrl(term));
        const $ = cheerio.load(html);
        const cards = $("article.box_offer");

        if (cards.length === 0) {
          this.log(`"${term}": 0 resultados (¿cambió el HTML del sitio?)`);
        }

        cards.slice(0, 15).each((_, element) => {
          const card = $(element);
          const link = card.find("a.js-o-link, h2 a").first();
          const href = link.attr("href");
          const title = link.text().trim();
          if (!href || !title) return;

          const company = card
            .find("p a.fc_base, a.t_ellipsis, p a")
            .first()
            .text()
            .trim();

          const cardText = card.text();
          const dateText = (cardText.match(/(hoy|ayer|hace\s+\d+\s+\S+)/i) ||
            [])[0];

          jobs.push(
            normalizeJob({
              url: new URL(href, BASE_URL).toString(),
              role: title,
              company,
              salary: parseSalaryCLP(cardText),
              postedDate: parseRelativeDateEs(dateText),
              platform: "Computrabajo",
            })
          );
        });

        this.log(`"${term}": ${cards.length} ofertas encontradas`);
        await sleep(1500 + Math.random() * 1500);
      } catch (error) {
        this.log(`Error con término "${term}": ${error.message}`);
      }
    }

    return jobs;
  }
}
