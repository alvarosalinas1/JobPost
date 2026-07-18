import { chromium } from "playwright";
import {
  BaseScraper,
  normalizeJob,
  parseSalaryCLP,
  sleep,
} from "./base.js";
import { randomUserAgent } from "../../utils/anti-bot.js";

// Indeed bloquea peticiones HTTP simples, por eso usa Playwright.
export class IndeedScraper extends BaseScraper {
  constructor() {
    super("Indeed");
  }

  buildSearchUrl(term) {
    const params = new URLSearchParams({
      q: term,
      l: this.location(),
      fromage: String(this.daysBack()),
      sort: "date",
    });
    return `https://cl.indeed.com/jobs?${params.toString()}`;
  }

  async scrape() {
    const jobs = [];
    let browser = null;

    try {
      browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      });
      const context = await browser.newContext({
        userAgent: randomUserAgent(),
        locale: "es-CL",
        viewport: { width: 1366, height: 768 },
      });
      const page = await context.newPage();

      for (const term of this.searchTerms()) {
        try {
          await page.goto(this.buildSearchUrl(term), {
            waitUntil: "domcontentloaded",
            timeout: 45000,
          });
          await page
            .waitForSelector(".job_seen_beacon", { timeout: 15000 })
            .catch(() => {});

          const cards = await page.$$eval(".job_seen_beacon", (nodes) =>
            nodes.map((node) => {
              const link = node.querySelector("h2.jobTitle a, a.jcs-JobTitle");
              const company = node.querySelector(
                '[data-testid="company-name"], .companyName'
              );
              const salary = node.querySelector(
                '[data-testid="attribute_snippet_testid"], .salary-snippet-container, .metadata.salary-snippet-container'
              );
              return {
                href: link ? link.getAttribute("href") : null,
                title: link ? link.textContent.trim() : null,
                company: company ? company.textContent.trim() : null,
                salaryText: salary ? salary.textContent.trim() : "",
              };
            })
          );

          if (cards.length === 0) {
            this.log(`"${term}": 0 resultados (posible bloqueo anti-bot)`);
          }

          for (const card of cards.slice(0, 15)) {
            if (!card.href || !card.title) continue;
            const absolute = new URL(card.href, "https://cl.indeed.com");
            // URL canónica por id de oferta para que el dedupe funcione
            const jk = absolute.searchParams.get("jk");
            const jobUrl = jk
              ? `https://cl.indeed.com/viewjob?jk=${jk}`
              : absolute.toString();

            jobs.push(
              normalizeJob({
                url: jobUrl,
                role: card.title,
                company: card.company,
                salary: parseSalaryCLP(card.salaryText),
                platform: "Indeed",
              })
            );
          }

          this.log(`"${term}": ${cards.length} ofertas encontradas`);
          await sleep(2000 + Math.random() * 2000);
        } catch (error) {
          this.log(`Error con término "${term}": ${error.message}`);
        }
      }
    } catch (error) {
      this.log(`Error general: ${error.message}`);
    } finally {
      if (browser) await browser.close().catch(() => {});
    }

    return jobs;
  }
}
