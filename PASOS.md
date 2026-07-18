# PASOS PARA ACTIVAR SISTEMA (Sin explicaciones)

## PASO 1: Crea cuenta Groq (2 min)
1. Ve a https://console.groq.com
2. Sign up
3. Copia API key
4. Guárdala en un lugar seguro

## PASO 2: Crea proyecto Supabase (5 min)
1. Ve a https://supabase.com
2. Create new project
3. Espera deployment (30-60 seg)
4. Copia connection string de Settings → Database
5. Guarda URL y anon key

## PASO 3: Crea tabla en Supabase (3 min)
1. En Supabase, ve a SQL Editor
2. Pega esto:
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
```
3. Click Run

## PASO 4: Fork repo GitHub (2 min)
1. Ve a: https://github.com/tu_usuario/auto-job-aplicador-chile
   (o crea nuevo repo vacío)
2. Clona localmente:
```bash
git clone https://github.com/tu_usuario/auto-job-aplicador-chile
cd auto-job-aplicador-chile
```

## PASO 5: Copia archivos (2 min)
1. Copia todos los archivos que creé aquí
2. Estructura debe ser:
```
auto-job-aplicador-chile/
├── src/
│   ├── index.js
│   ├── db.js
│   ├── evaluator.js
│   ├── applier.js
│   └── scrapers/
│       ├── index.js
│       ├── base.js
│       ├── indeed.js
│       ├── computrabajo.js
│       └── linkedin.js
├── cron/
│   └── run-cycle.js
├── package.json
├── .env.example
├── Procfile
└── README.md
```

## PASO 6: Llena .env (5 min)
1. Copia .env.example a .env
```bash
cp .env.example .env
```
2. Abre .env y rellena:
   - SUPABASE_URL = (de paso 2)
   - SUPABASE_KEY = (de paso 2)
   - GROQ_API_KEY = (de paso 1)
   - LINKEDIN_EMAIL = tu email de LinkedIn
   - LINKEDIN_PASSWORD = tu contraseña de LinkedIn
   - MIN_SALARY = 840000
   - MAX_SALARY = 1200000

## PASO 7: Test local (3 min)
```bash
npm install
npm run dev
```
Debe ejecutarse sin errores. Verás logs de scraping.

## PASO 8: Push a GitHub (2 min)
```bash
git add .
git commit -m "Initial setup"
git push origin main
```

## PASO 9: Deploy a Railway (5 min)
1. Ve a https://railway.app
2. Dashboard → Create New Project
3. GitHub Repo → Conecta tu repo
4. Espera build automático

## PASO 10: Agrega variables de entorno en Railway (5 min)
1. En Railway project
2. Variables tab
3. Agrega todas las de .env:
   - SUPABASE_URL
   - SUPABASE_KEY
   - GROQ_API_KEY
   - LINKEDIN_EMAIL
   - LINKEDIN_PASSWORD
   - (resto de settings)

## PASO 11: Setup Cron automático (2 min)
1. Railway project → Deployments
2. Click en tu deploy
3. Variables → Add new
4. Agrega esto para que corra cada 3 horas:
   - Name: `CRON_SCHEDULE`
   - Value: `0 */3 * * *`

O ve a Settings → Cron Job y configura:
- Command: `node cron/run-cycle.js`
- Schedule: `0 9,12,15,18 * * 1-5` (9am, 12pm, 3pm, 6pm)

## PASO 12: Verifica que está corriendo (1 min)
```bash
railway logs -f
```
Deberías ver logs cada 3 horas automáticamente.

## LISTO

Sistema está automatizado. Postulará mientras duermes/trabajas.

**Monitoreo:**
- Revisa logs en Railway cada día
- Checa Supabase → applications para ver status de postulaciones
- Si falla una plataforma, logs te dirán por qué

**Parar:**
- Railway project → Settings → Delete project

**Ajustar:**
- Cambia CRON_SCHEDULE en Railway vars para cambiar frequency
- Modifica MIN_SALARY / MAX_SALARY en .env si quieres otro rango
- Edita src/scrapers/index.js para agregar más plataformas
