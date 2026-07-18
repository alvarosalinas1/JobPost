# Auto Job Aplicador Chile

Scraper y postulador automático de empleos para Chile, optimizado para cargos de
**logística, coordinación, supervisión, operaciones y bienestar**. Corre en ciclos
programados: scrapea portales, evalúa cada oferta con IA (Groq) contra el perfil
del candidato y postula a las mejores — con comportamiento diseñado para parecer
humano.

## Cómo funciona (3 fases por ciclo)

1. **Scrape** — busca ofertas nuevas en Computrabajo e Indeed según `SEARCH_TERMS`
   y las guarda en Supabase (tabla `applications`, deduplicadas por URL).
2. **Evalúa** — Groq puntúa cada oferta pendiente (1-10) contra `CANDIDATE_PROFILE`.
   Bonificaciones: +2 si menciona liderazgo/desarrollo personal, +1 si es
   remota/híbrida. Score ≥ 7 → aprobada.
3. **Postula** — abre la mejor oferta aprobada con Playwright e intenta postular.
   Máximo **1 postulación por ciclo**.

## Anti-Bot Strategy

Los portales de empleo bloquean cuentas y IPs que se comportan como scripts.
Este proyecto asume que **postular poco y lento es mejor que postular mucho y
ser bloqueado**:

- **1 postulación por ciclo (~1 por hora máximo).** Una ráfaga de 5 postulaciones
  en 2 minutos es la firma clásica de un bot; una persona real lee la oferta,
  duda, y postula de a una.
- **Delays humanos largos**: 2-15 segundos antes de cada click (simula leer la
  oferta), 3-8 segundos entre pestañas y entre postulaciones.
- **Ciclos de reposo**: ~30% de los ciclos (`REST_CYCLE_PROB`) solo scrapean y
  evalúan, sin postular — la gente no postula cada vez que abre el sitio.
- **Rotación de User-Agent** en cada petición y cada pestaña del navegador.
- **Horarios humanos con jitter**: el cron corre L-V a las 9:00, 13:00, 16:00,
  20:00 y 23:00 de Santiago, con un retraso aleatorio de 0-15 minutos para no
  ejecutar nunca a la hora exacta. Los fines de semana hay una sola corrida
  posible que se salta aleatoriamente el ~50% de las veces.
- **Tolerancia a errores**: si un portal bloquea o cambia su HTML, se loguea y
  se continúa con el resto; el ciclo nunca muere por una plataforma.

## Estructura

```
src/
├── index.js          # Orquesta el ciclo (scrape → evalúa → postula)
├── db.js             # Cliente Supabase (tabla applications)
├── evaluator.js      # Scoring con Groq + bonificaciones por perfil
├── applier.js        # Postulación con Playwright
└── scrapers/
    ├── index.js      # Ejecuta todos los scrapers y deduplica
    ├── base.js       # Clase base + parseo de sueldos/fechas
    ├── indeed.js     # Indeed Chile (Playwright)
    └── computrabajo.js # Computrabajo Chile (fetch + cheerio)
utils/
└── anti-bot.js       # User-Agents, delays aleatorios, ciclos de reposo
cron/
└── run-cycle.js      # Entry point para el cron (timeout de 20 min)
```

## Setup local

```bash
npm install
npx playwright install chromium
cp .env.local.example .env.local   # y rellena los valores
npm start                          # corre un ciclo completo
```

Requiere la tabla `applications` en Supabase (ver `PASOS.md`) con permisos para
`service_role` (ver `fix-permissions.sql` si aparece "permission denied").

## Deploy

El runner principal es **GitHub Actions** (`.github/workflows/job-search.yml`):
agrega los secrets `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y
`GROQ_API_KEY` en el repo (Settings → Secrets and variables → Actions). Las
variables no sensibles (`SEARCH_TERMS`, `CANDIDATE_PROFILE`, etc.) van en la
pestaña Variables.

> Nota: Playwright no corre en funciones serverless de Vercel; `vercel.json`
> queda como referencia, pero el cron real es el de GitHub Actions.

## Limitaciones conocidas

- Indeed bloquea búsquedas con frecuencia (anti-bot agresivo); cuando pasa, el
  log muestra "0 resultados (posible bloqueo anti-bot)" y el ciclo continúa.
- Postular en Computrabajo/Indeed requiere sesión iniciada; sin credenciales,
  el intento queda registrado como `apply_failed` con la razón en `notes`.
- LinkedIn no está incluido por ahora.
