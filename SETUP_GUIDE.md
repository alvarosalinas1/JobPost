# Auto Job Aplicador Chile - Setup Completo Desde Cero

Sistema que busca, evalúa y postula a ofertas de empleo en Chile de forma
automática y desatendida. Corre en la nube (GitHub Actions) en ciclos
programados: scrapea portales de empleo, evalúa cada oferta con un modelo de IA
(Groq) contra tu perfil profesional, y postula automáticamente a las mejores
usando tus propias cuentas de los portales — todo con un comportamiento diseñado
para parecer humano (delays largos, 1 postulación por ciclo, ciclos de reposo).
Opcionalmente envía un email diario con el resumen de ofertas. Una vez
configurado, funciona 24/7 sin tu computador encendido.

> **Nota de alcance.** Hoy el sistema scrapea **Computrabajo** e **Indeed**.
> Para **Trabajando.cl** y **Laborum** ya está implementado el login y la
> postulación, pero su scraper de listados está pendiente (ver
> [Arquitectura](#8-arquitectura-del-sistema)). El envío de email por SendGrid
> está en modo stub (genera el HTML pero no envía hasta que lo actives a mano).
> **LinkedIn no está incluido y no se recomienda automatizar** (ver
> [Seguridad](#12-seguridad-y-mejores-practicas)).

---

## Tabla de contenidos

- [1. Ingredientes](#1-ingredientes)
- [2. Paso 0: Setup local base](#2-paso-0-setup-local-base)
- [3. Paso 1: Crear servicios en la nube](#3-paso-1-crear-servicios-en-la-nube)
- [4. Paso 2: Cuentas de portales de empleo](#4-paso-2-cuentas-de-portales-de-empleo)
- [5. Paso 3: GitHub Secrets](#5-paso-3-github-secrets)
- [6. Paso 4: Clonar y configurar local](#6-paso-4-clonar-y-configurar-local)
- [7. Paso 5: Activar los workflows](#7-paso-5-activar-los-workflows)
- [8. Arquitectura del sistema](#8-arquitectura-del-sistema)
- [9. Archivos clave](#9-archivos-clave)
- [10. Monitoreo y logs](#10-monitoreo-y-logs)
- [11. Ajustes y personalizacion](#11-ajustes-y-personalizacion)
- [12. Seguridad y mejores practicas](#12-seguridad-y-mejores-practicas)
- [13. Troubleshooting](#13-troubleshooting)
- [14. Resultados esperados](#14-resultados-esperados)
- [15. FAQ](#15-faq)
- [16. Soporte y contacto](#16-soporte-y-contacto)

---

## 1. Ingredientes

Qué necesitas tener listo **antes** de empezar.

**Herramientas locales:**

| Herramienta | Versión | Para qué |
|-------------|---------|----------|
| Node.js | 18 o superior (recomendado 20 LTS) | Ejecutar el sistema |
| npm | Viene con Node.js | Instalar dependencias |
| Git | Cualquier versión reciente | Clonar y subir código |
| Playwright (Chromium) | Se instala con npm | Navegador automatizado |

**Cuentas en la nube (todas tienen plan gratuito):**

| Servicio | URL | Para qué |
|----------|-----|----------|
| GitHub | https://github.com | Alojar el código y correr la automatización |
| Supabase | https://supabase.com | Base de datos de ofertas |
| Groq | https://console.groq.com | Evaluar ofertas con IA |
| SendGrid | https://sendgrid.com | Email diario (opcional) |

**Cuentas de portales de empleo** (para que las postulaciones se completen):

- Computrabajo (`www.computrabajo.com`)
- Trabajando.cl (`www.trabajando.cl`)
- Laborum (`www.laborum.cl`)

**Credenciales que terminarás guardando como Secrets** (hasta 11):

- `COMPUTRABAJO_EMAIL`, `COMPUTRABAJO_PASSWORD`
- `TRABAJANDO_EMAIL`, `TRABAJANDO_PASSWORD`
- `LABORUM_EMAIL`, `LABORUM_PASSWORD`
- `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY`
- `SENDGRID_API_KEY` (opcional)

> **Tiempo total realista:** entre **4 y 6 horas**, una sola vez. La mayor parte
> es crear cuentas y verificar emails. El código en sí ya está listo.

---

## 2. Paso 0: Setup local base

**Tiempo estimado: 30 minutos.**

### Instalar Node.js

1. Ve a https://nodejs.org
2. Descarga la versión **LTS** (el botón de la izquierda).
3. Ejecuta el instalador y acepta las opciones por defecto.
4. Verifica en tu terminal:

```bash
node --version   # debe mostrar v18.x.x o superior
npm --version    # debe mostrar un número de versión
```

> **Pantalla esperada:** al escribir `node --version` verás algo como `v20.11.0`.
> Si dice "comando no encontrado", reinicia la terminal o el computador.

### Instalar Git

1. Ve a https://git-scm.com/downloads
2. Descarga el instalador para tu sistema operativo (Windows/macOS/Linux).
3. En Windows, acepta las opciones por defecto (incluye "Git Bash").
4. Verifica:

```bash
git --version   # debe mostrar git version 2.x.x
```

### Crear una carpeta de trabajo

```bash
mkdir JobPost
cd JobPost
```

> Más adelante reemplazarás esta carpeta vacía clonando el repositorio real
> (ver [Paso 4](#6-paso-4-clonar-y-configurar-local)). Por ahora solo confirma
> que sabes navegar a ella.

---

## 3. Paso 1: Crear servicios en la nube

**Tiempo estimado: 2 horas.**

### 1A. GitHub: repositorio y token

1. Crea una cuenta en https://github.com/signup (email, usuario, contraseña).
2. Verifica tu email.
3. Crea el repositorio: botón **+** arriba a la derecha → **New repository**.
   - Nombre: `JobPost`
   - Visibilidad: **Public** (los repos públicos tienen minutos de GitHub
     Actions gratis e ilimitados).
   - No agregues README ni .gitignore (el código ya los trae).
   - Click **Create repository**.
4. Genera un **Personal Access Token** (para subir código sin escribir tu
   contraseña cada vez):
   - Ve a https://github.com/settings/tokens
   - **Generate new token** → **Generate new token (classic)**.
   - Nota: "JobPost push".
   - Expiración: 90 días (o lo que prefieras).
   - Marca el scope **repo** (acceso completo a repositorios).
   - Click **Generate token** y **copia el token ahora** (no lo vuelves a ver).

> **Pantalla esperada:** el token empieza con `ghp_` seguido de ~36 caracteres.
> Guárdalo en un lugar seguro temporalmente; lo usarás al hacer `git push`.

> **Seguridad:** este token es una credencial. No lo pegues en el código ni en
> ningún archivo que subas al repo.

### 1B. Supabase: base de datos

1. Crea una cuenta en https://supabase.com (puedes usar tu cuenta de GitHub).
2. **New project**:
   - Nombre: `JobPost`
   - Contraseña de base de datos: genera una fuerte y guárdala.
   - Región: la más cercana (por ejemplo, `South America (São Paulo)`).
   - Espera 1-2 minutos a que se aprovisione.
3. Crea la tabla principal. Ve a **SQL Editor** → **New query**, pega esto y
   click **Run**:

```sql
CREATE TABLE applications (
  id BIGSERIAL PRIMARY KEY,
  job_url TEXT UNIQUE NOT NULL,
  company TEXT,
  role TEXT,
  salary INTEGER,
  posted_date TIMESTAMP,
  platform TEXT,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  applied_at TIMESTAMP
);

CREATE INDEX idx_status ON applications(status);
CREATE INDEX idx_platform ON applications(platform);
CREATE INDEX idx_created ON applications(created_at DESC);

-- Permisos para la llave service_role (la que usa el sistema).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.applications_id_seq TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
```

4. Ejecuta también `supabase/schema.sql` del repo (crea las tablas
   `profile_suggestions` y `active_profiles` para las sugerencias de perfil).

> **Importante:** sin las líneas `GRANT ...` el sistema falla con
> `permission denied for table applications`. Los proyectos nuevos de Supabase
> ya no otorgan estos permisos automáticamente.

5. Copia tus credenciales desde **Settings → API**:
   - **Project URL** → `SUPABASE_URL` (formato `https://xxxx.supabase.co`)
   - **anon public** → `SUPABASE_KEY`
   - **service_role** (secreta, en la sección "Project API keys") →
     `SUPABASE_SERVICE_ROLE_KEY`

> **Pantalla esperada:** verás dos llaves largas tipo JWT (empiezan con `eyJ...`).
> La `service_role` está marcada como secreta; trátala como una contraseña.

### 1C. Groq: evaluación con IA

1. Crea una cuenta en https://console.groq.com
2. Ve a **API Keys** → **Create API Key**.
3. Dale un nombre ("JobPost") y **copia la llave** (empieza con `gsk_...`).
4. Guárdala como `GROQ_API_KEY`.

> El plan gratuito de Groq es suficiente: el sistema evalúa máximo 10 ofertas
> por ciclo con pausas entre llamadas.

### 1D. SendGrid: email diario (opcional)

Solo si quieres recibir el resumen diario por correo. Puedes saltarte esto y
activarlo después.

1. Crea una cuenta en https://signup.sendgrid.com (plan free: 100 emails/día).
2. Verifica tu email y completa el onboarding.
3. **Settings → Sender Authentication → Verify a Single Sender**: verifica la
   dirección de correo desde la que se enviarán los emails.
4. **Settings → API Keys → Create API Key** (permiso "Mail Send").
5. Copia la llave (empieza con `SG.`) y guárdala como `SENDGRID_API_KEY`.

> **Nota:** el envío real viene **desactivado** en el código (`src/mailer.js`).
> Para activarlo hay que descomentar el bloque marcado en la función
> `sendEmail()` y poner tu remitente verificado. Mientras tanto, el sistema solo
> genera el HTML del email y registra "Email generado (no enviado aún)".

---

## 4. Paso 2: Cuentas de portales de empleo

**Tiempo estimado: 1 hora.**

Para que las postulaciones se completen, el sistema inicia sesión en **tus
propias cuentas** de cada portal. Crea o verifica una cuenta en cada uno:

| Portal | URL de registro | Datos mínimos |
|--------|-----------------|---------------|
| Computrabajo | https://cl.computrabajo.com/candidates/signup | Nombre, email, contraseña, CV |
| Trabajando.cl | https://www.trabajando.cl (registro candidato) | Nombre, email, contraseña, CV |
| Laborum | https://www.laborum.cl (crear cuenta) | Nombre, email, contraseña, CV |

Para cada portal:

1. Regístrate con tu email.
2. **Verifica el email** (revisa tu bandeja de entrada y spam).
3. Completa tu **CV/perfil** lo mejor posible: el sistema usa tu perfil existente
   al postular, no rellena formularios extensos por ti.
4. Usa una **contraseña única y segura por portal** (no reutilices la de tu
   email principal).

> **Recomendación:** usa un gestor de contraseñas para generarlas y guardarlas.
> Vas a copiar cada email y contraseña a GitHub Secrets en el siguiente paso.

> **Nota realista:** algunos portales piden pasos adicionales al postular
> (preguntas del reclutador, tests). Cuando eso ocurre, el sistema registra la
> postulación como `apply_failed` con la razón en `notes` y sigue con la
> siguiente. No inventa respuestas.

---

## 5. Paso 3: GitHub Secrets

**Tiempo estimado: 30 minutos.**

Los Secrets guardan tus credenciales **encriptadas** en GitHub. El sistema las
lee en la nube sin que aparezcan nunca en el código ni en los logs.

**Ruta:** tu repo → **Settings** → **Secrets and variables** → **Actions** →
pestaña **Secrets** → botón **New repository secret**.

Agrega estos secrets (uno por uno; para cada uno: nombre, valor, **Add secret**):

| # | Nombre del Secret | Valor (de dónde viene) |
|---|-------------------|------------------------|
| 1 | `COMPUTRABAJO_EMAIL` | Tu email de Computrabajo |
| 2 | `COMPUTRABAJO_PASSWORD` | Tu contraseña de Computrabajo |
| 3 | `TRABAJANDO_EMAIL` | Tu email de Trabajando.cl |
| 4 | `TRABAJANDO_PASSWORD` | Tu contraseña de Trabajando.cl |
| 5 | `LABORUM_EMAIL` | Tu email de Laborum |
| 6 | `LABORUM_PASSWORD` | Tu contraseña de Laborum |
| 7 | `SUPABASE_URL` | Paso 1B |
| 8 | `SUPABASE_KEY` | Paso 1B (anon) |
| 9 | `SUPABASE_SERVICE_ROLE_KEY` | Paso 1B (service_role) |
| 10 | `GROQ_API_KEY` | Paso 1C |
| 11 | `SENDGRID_API_KEY` | Paso 1D (opcional) |

> **Pantalla esperada:** tras agregar cada secret, aparece en la lista con su
> nombre pero **sin mostrar el valor** (dice "Updated X ago"). Eso es correcto:
> los secrets no se pueden volver a leer, solo sobrescribir.

**Variables no sensibles (opcional):** en la pestaña **Variables** (al lado de
Secrets) puedes definir `SEARCH_TERMS`, `CANDIDATE_PROFILE`, `MIN_SALARY`,
`MAX_SALARY`, `LOCATION`, etc. Si no las defines, el workflow usa valores por
defecto razonables.

---

## 6. Paso 4: Clonar y configurar local

**Tiempo estimado: 1 hora.**

Esto sirve para probar el sistema en tu computador antes de dejarlo en la nube.

```bash
git clone https://github.com/TU_USUARIO/JobPost.git
cd JobPost
npm install
npx playwright install chromium
cp .env.local.example .env.local
```

Abre `.env.local` en un editor y rellena los valores (los mismos de los pasos
anteriores). Formato:

```bash
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GROQ_API_KEY=gsk_...
SENDGRID_API_KEY=SG....
RECIPIENT_EMAIL=tu@email.com
SEARCH_TERMS=coordinador operaciones,supervisor logistica,mejora procesos,aerolíneas,bienestar
CANDIDATE_PROFILE=Describe tu experiencia en una frase para que la IA evalúe mejor.
MIN_SALARY=840000
MAX_SALARY=1200000
LOCATION=Santiago
DAYS_BACK=14
COMPUTRABAJO_EMAIL=tu@email.com
COMPUTRABAJO_PASSWORD=TU_PASSWORD
TRABAJANDO_EMAIL=tu@email.com
TRABAJANDO_PASSWORD=TU_PASSWORD
LABORUM_EMAIL=tu@email.com
LABORUM_PASSWORD=TU_PASSWORD
```

Primero valida la configuración **sin ejecutar búsquedas** (modo setup):

```bash
# Con SETUP_MODE=1 en .env.local, npm start solo valida componentes:
npm start
```

Salida esperada:

```
[✓] Scraper listo
[✓] Evaluador listo
[✓] Mailer (stub)
[✓] Profiler (stub)
[✓] Profile scraper (stub, sin login)
[✓] Applier con login (stub, sin credenciales)
Sistema listo. NO se ejecutaron búsquedas (modo setup)
```

Cuando quieras correr un ciclo real en local, **comenta la línea `SETUP_MODE=1`**
en `.env.local` y vuelve a ejecutar `npm start`. Verás las tres fases (scraping,
evaluación, postulación).

> **Nota:** GitHub Actions **no** lee tu `.env.local` (usa los Secrets/Variables).
> El archivo `.env.local` es solo para tus pruebas locales y nunca se sube al
> repo (está en `.gitignore`).

---

## 7. Paso 5: Activar los workflows

**Tiempo estimado: 5 minutos.**

Los dos workflows vienen **desactivados** por seguridad. Actívalos cuando tengas
los Secrets cargados.

1. Ve a `https://github.com/TU_USUARIO/JobPost/actions`
2. En la barra lateral verás **Job Search Cycle** y **Daily Email**.
3. Si aparece un aviso "This workflow has been disabled", haz click en el
   workflow y luego en **Enable workflow**.
4. Para probar de inmediato sin esperar el horario: entra al workflow →
   **Run workflow** → **Run workflow** (usa el disparador manual
   `workflow_dispatch`).

> **Pantalla esperada:** tras unos segundos aparece una ejecución en curso
> (círculo amarillo girando). Al terminar bien, muestra un ✓ verde. Si sale una
> ✗ roja, abre la ejecución y revisa los logs (ver
> [Monitoreo](#10-monitoreo-y-logs)).

**Horarios configurados** (hora de Santiago, definidos en los cron de los
workflows):

- **Job Search Cycle:** Lunes a viernes 9:00, 13:00, 16:00, 20:00 y 23:00, más
  una corrida aleatoria de fin de semana. Incluye un jitter de 0-15 minutos para
  no ser predecible.
- **Daily Email:** Lunes a viernes 10:00.

---

## 8. Arquitectura del sistema

```
        GitHub Actions (cron, 24/7)
                  |
                  v
 [Fase 1] SCRAPING
   Computrabajo (fetch + cheerio)
   Indeed (Playwright)
   Trabajando / Laborum ... (scraper pendiente; login+postular ya implementado)
                  |
                  v
 [Fase 2] EVALUACION
   Groq IA puntua cada oferta 1-10 contra tu perfil
   Bonus: +2 liderazgo/desarrollo personal, +1 remoto/hibrido
                  |
                  v
 [Fase 3] POSTULACION
   Playwright inicia sesion en tu cuenta del portal
   Postula (maximo 1 por ciclo, delays humanos 2-15s)
   ~30% de ciclos son "de reposo": no postulan
                  |
                  v
 [Fase 4] PERSISTENCIA
   Supabase tabla applications (dedup por URL, estados)
                  |
                  v
 [Fase 5] EMAIL DIARIO (stub, no envia aun)
   SendGrid: resumen HTML de ofertas + sugerencias de perfil
```

**Fase 1 — Scraping:** busca ofertas según `SEARCH_TERMS` y las guarda
deduplicadas por URL.

**Fase 2 — Evaluación:** cada oferta pendiente recibe un score 1-10 de Groq
según afinidad con tu `CANDIDATE_PROFILE`. Score alto → aprobada.

**Fase 3 — Postulación:** abre la mejor oferta aprobada, inicia sesión y postula.
Máximo 1 por ciclo; ~30% de ciclos no postulan (anti-detección).

**Fase 4 — Persistencia:** todo queda en la tabla `applications` con su estado
(`pending`, `approved`, `applied`, `apply_failed`, `login_failed`, `skipped`).

**Fase 5 — Email diario:** genera el resumen (envío desactivado hasta activarlo).

---

## 9. Archivos clave

```
src/
  index.js              Orquestador principal (las 3 fases del ciclo)
  db.js                 Cliente Supabase (applications, sugerencias, perfiles)
  evaluator.js          Scoring con Groq + bonificaciones por perfil
  applier.js            Login y postulacion con Playwright (Computrabajo,
                        Trabajando, Laborum) + fallback generico
  mailer.js             Email diario (SendGrid en stub)
  profiler.js           Sugerencias de nuevos perfiles con Groq
  scrapers/
    index.js            Ejecuta todos los scrapers y deduplica
    base.js             Clase base + parseo de sueldos y fechas
    indeed.js           Scraper de Indeed Chile
    computrabajo.js     Scraper de Computrabajo Chile
    profile-scraper.js  Scrapea tus perfiles publicos propios (sin login)
api/
  accept-profile.js     Webhook (Vercel) para aceptar perfiles sugeridos
supabase/
  schema.sql            Tablas profile_suggestions y active_profiles
utils/
  anti-bot.js           User-Agents, delays aleatorios, ciclos de reposo
cron/
  run-cycle.js          Entry point del cron (timeout de 20 min)
.github/workflows/
  job-search.yml        Ciclo de busqueda (cron)
  daily-email.yml       Email diario (cron)
.env.local              Tus credenciales locales (NO se sube al repo)
.env.local.example      Plantilla documentada de variables
```

---

## 10. Monitoreo y logs

**GitHub Actions (qué está corriendo):**

- Ve a `https://github.com/TU_USUARIO/JobPost/actions`
- Click en una ejecución → click en el job → despliega cada paso para ver los
  logs línea por línea.

Qué buscar en los logs de un ciclo sano:

```
FASE 1: Scrapeando portales de empleo...
  [Computrabajo] "coordinador operaciones": 20 ofertas encontradas
  Total: 60 scrapeadas, 60 unicas, 12 nuevas
FASE 2: Evaluando ofertas pendientes...
  Supervisor de Operaciones RM | Score: 8/10 | Postular: true
FASE 3: Postulando a ofertas aprobadas...
  [Computrabajo] Login exitoso
    v Postulado
```

**Supabase (qué se guardó):**

- Ve a tu proyecto → **Table Editor** → tabla `applications`.
- Filtra por la columna `status` para ver `applied`, `apply_failed`, etc.

**Email diario:** cuando lo actives, la llegada del correo confirma que el
workflow corrió. Mientras esté en stub, revisa el log del workflow "Daily Email":
verás "Email generado (no enviado aún)".

> **Nota:** los logs **nunca** muestran tus contraseñas. En caso de fallo de
> login verás `[Computrabajo] Login falló — revisar credenciales en Secrets`,
> sin datos sensibles.

---

## 11. Ajustes y personalizacion

| Qué cambiar | Dónde | Cómo |
|-------------|-------|------|
| Horarios de ejecución | `.github/workflows/job-search.yml` | Edita las líneas `cron:` (en UTC) |
| Términos de búsqueda | Secret/Variable `SEARCH_TERMS` | Lista separada por comas |
| Perfil del candidato | Variable `CANDIDATE_PROFILE` | Frase que describe tu experiencia |
| Rango salarial | `MIN_SALARY` / `MAX_SALARY` | Montos en CLP |
| Postulaciones por ciclo | `src/index.js` → `APPLICATIONS_PER_CYCLE` | Número (default 1) |
| % de ciclos de reposo | Variable `REST_CYCLE_PROB` | 0 a 1 (default 0.3) |
| Antigüedad de ofertas | `DAYS_BACK` | Días (default 14) |

> **Los cron usan hora UTC.** Chile es UTC-3 (verano) o UTC-4 (invierno). Por
> ejemplo, `0 13 * * 1-5` = 13:00 UTC = 09:00 en Santiago en invierno chileno.

> **Recomendación:** no subas `APPLICATIONS_PER_CYCLE` por encima de 1-2. El
> valor bajo es intencional para no parecer un bot (ver
> [Seguridad](#12-seguridad-y-mejores-practicas)).

---

## 12. Seguridad y mejores practicas

- ✓ **Nunca** subas `.env.local` al repo (ya está en `.gitignore`).
- ✓ Usa **GitHub Secrets** para todas las credenciales (van encriptadas).
- ✓ Usa una **contraseña única por portal**, distinta de tu email principal.
- ✓ Renueva tus contraseñas periódicamente (por ejemplo cada 3 meses) y
  actualízalas en los Secrets.
- ✓ Mantén el ritmo bajo: **máximo 1 postulación por ciclo** y delays de 2-15s
  entre acciones. Esto imita el comportamiento humano.
- ✗ **No automatices LinkedIn.** LinkedIn detecta la automatización de navegador
  por fingerprint (no solo por velocidad) y banea cuentas por ello; además suele
  exigir 2FA que bloquea el login automatizado. El costo de perder tu red
  profesional es alto e irreversible. Actualiza tu perfil de LinkedIn a mano.
- ✗ No hagas ráfagas de 10+ postulaciones por hora en ningún portal.

> **Ten presente:** automatizar el inicio de sesión en los portales de empleo va
> contra los Términos de Servicio de la mayoría de ellos, aunque el riesgo a
> ritmo humano (1/ciclo) es mucho menor que en LinkedIn. Úsalo con criterio y
> bajo tu responsabilidad, sobre tus propias cuentas.

---

## 13. Troubleshooting

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| `Cannot find module 'X'` | Faltan dependencias | Corre `npm install` en la carpeta del repo |
| `permission denied for table applications` | Falta el GRANT en Supabase | Re-ejecuta los `GRANT ...` del [Paso 1B](#1b-supabase-base-de-datos) |
| `Supabase connection failed` | URL o llave incorrecta | Verifica `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (revisa que no falte una letra) |
| `Falta GROQ_API_KEY` | Variable no cargada | Confírmala en `.env.local` (local) o en Secrets (nube) |
| Playwright: `Timeout ... exceeded` | Portal lento o cambió su HTML | El timeout de navegación está en `src/scrapers/*.js` y `src/applier.js` (`timeout: 45000`); súbelo si tu red es lenta |
| `browserType.launch: Executable doesn't exist` | Falta el navegador | Corre `npx playwright install chromium` |
| `Login falló — revisar credenciales en Secrets` | Email/contraseña incorrectos o portal pide 2FA/captcha | Verifica los Secrets del portal; prueba entrar a mano |
| El workflow no se ejecuta | Está deshabilitado o sin cron activo | En **Actions**, abre el workflow y click **Enable workflow** |
| `0 ofertas scrapeadas` | `SEARCH_TERMS` vacío o portal bloqueando | Revisa la variable; Indeed a veces bloquea (verás "posible bloqueo anti-bot") |

> **Regla general:** casi todo problema deja un mensaje claro en los logs del
> workflow. Empieza siempre por ahí antes de tocar el código.

---

## 14. Resultados esperados

Estimaciones **aproximadas** para un mes de operación continua. Son metas de
referencia, no garantías: los números reales dependen de cuántas ofertas
relevantes existan, de si los logins funcionan y de las políticas de cada portal.

| Métrica | Rango estimado (30 días) |
|---------|--------------------------|
| Ofertas scrapeadas | 1.500 - 2.000 |
| Postulaciones intentadas | 100 - 150 (máx ~1/hora) |
| Postulaciones completadas | Variable, depende del login y del flujo de cada portal |
| Emails de resumen | ~22 (uno por día hábil, si activas el envío) |
| Sugerencias de nuevos perfiles | ~5 - 10 |

> **Sé realista:** la "tasa de éxito" de postulación depende mucho de que el
> login y el formulario de cada portal funcionen sin pasos manuales. Es normal
> que una parte quede como `apply_failed` cuando el portal pide información
> adicional. El valor del sistema está en el volumen de detección + evaluación,
> más que en automatizar el 100% de las postulaciones.

---

## 15. FAQ

**¿Necesito mi computador encendido?**
No. Una vez en la nube, GitHub Actions ejecuta los ciclos 24/7 por su cuenta.

**¿Me van a banear?**
El riesgo se reduce fuerte al postular máximo 1 vez por ciclo con delays
humanos, pero **no es cero**: automatizar el login va contra los Términos de
Servicio de los portales. Úsalo con criterio. En LinkedIn el riesgo es alto y
por eso **no** está incluido.

**¿Cuánto cuesta?**
En su configuración base, gratis: GitHub Actions es gratis en repos públicos,
y Groq, Supabase y SendGrid tienen planes gratuitos suficientes para este uso.
Vigila los límites de los planes free si aumentas mucho la frecuencia.

**¿Qué pasa si cambio mi contraseña en un portal?**
Actualiza el Secret correspondiente (por ejemplo `COMPUTRABAJO_PASSWORD`) en
GitHub. No hace falta tocar el código.

**¿Puedo agregar LinkedIn?**
No se recomienda: alto riesgo de baneo de tu cuenta profesional. Mejor actualiza
tu perfil manualmente.

**¿Puedo agregar más portales o términos?**
Sí. Los términos se cambian en `SEARCH_TERMS`. Agregar un portal nuevo requiere
crear su scraper en `src/scrapers/` (usa `computrabajo.js` como modelo).

**¿Por qué a veces un ciclo no postula nada?**
Por diseño: ~30% de los ciclos son "de reposo" (solo scrapean y evalúan) para
simular inactividad humana. Se controla con `REST_CYCLE_PROB`.

---

## 16. Soporte y contacto

- **Logs primero:** la mayoría de los problemas se diagnostican en
  **GitHub Actions → la ejecución con ✗ → logs del paso que falló**.
- **Base de datos:** revisa la tabla `applications` en Supabase para ver qué se
  scrapeó y en qué estado quedó cada oferta.
- **Issues:** si el sistema tiene un bug reproducible, abre un issue en
  `https://github.com/TU_USUARIO/JobPost/issues` con el log del error (sin pegar
  credenciales).

---

Cuando termines, tu sistema estará postulando 24/7 automáticamente.
