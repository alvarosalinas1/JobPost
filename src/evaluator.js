import Groq from "groq-sdk";

let groq = null;

function getGroq() {
  if (!groq) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("Falta GROQ_API_KEY en .env.local");
    }
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groq;
}

const DEFAULT_MODEL = "llama-3.3-70b-versatile";

// Áreas prioritarias del perfil del candidato.
const PRIORITY_AREAS =
  "logística, coordinación, supervisión de equipos, operaciones, aerolíneas/aviación, bienestar y liderazgo";

const BONUS_LEADERSHIP = /desarrollo personal|liderazgo/i;
const BONUS_REMOTE =
  /home\s*office|teletrabajo|remoto|h[íi]brido|semi\s*-?\s*presencial/i;

// Bonificaciones sobre el texto disponible de la oferta:
// +2 si menciona desarrollo personal o liderazgo, +1 si es remota/híbrida.
function applyProfileBonuses(job, evaluation) {
  const text = `${job.role ?? ""} ${job.company ?? ""} ${job.notes ?? ""}`;
  let score = evaluation.score;
  const bonuses = [];

  if (BONUS_LEADERSHIP.test(text)) {
    score += 2;
    bonuses.push("+2 liderazgo/desarrollo personal");
  }
  if (BONUS_REMOTE.test(text)) {
    score += 1;
    bonuses.push("+1 modalidad remota/híbrida");
  }
  score = Math.min(10, score);

  return {
    score,
    apply: evaluation.apply || score >= 7,
    reasoning: bonuses.length
      ? `${evaluation.reasoning} [${bonuses.join(", ")}]`
      : evaluation.reasoning,
  };
}

// Si Groq falla, decide solo por rango salarial para no detener el ciclo.
function fallbackEvaluation(job, reason) {
  const min = Number(process.env.MIN_SALARY || 0);
  const max = Number(process.env.MAX_SALARY || Number.MAX_SAFE_INTEGER);
  const salaryOk =
    job.salary == null || (job.salary >= min && job.salary <= max);
  return applyProfileBonuses(job, {
    score: salaryOk ? 6 : 3,
    apply: salaryOk,
    reasoning: `Evaluación heurística por salario (Groq falló: ${reason})`,
  });
}

export async function evaluateJobFit(job) {
  const min = process.env.MIN_SALARY || "840000";
  const max = process.env.MAX_SALARY || "1200000";
  const location = process.env.LOCATION || "Santiago";
  const profile =
    process.env.CANDIDATE_PROFILE ||
    "Candidato en Santiago de Chile que busca empleo estable de jornada completa.";

  const prompt = `Eres un evaluador de ofertas de trabajo en Chile.

Perfil del candidato: ${profile}
Rango salarial objetivo: $${min} a $${max} CLP, ubicación: ${location}.
Áreas prioritarias (dan más puntaje): ${PRIORITY_AREAS}.

Oferta a evaluar:
- Cargo: ${job.role ?? "Desconocido"}
- Empresa: ${job.company ?? "Desconocida"}
- Salario publicado: ${job.salary ? `$${job.salary} CLP` : "No especificado"}
- Plataforma: ${job.platform ?? "?"}
- URL: ${job.job_url}

Evalúa del 1 al 10 qué tan conveniente es postular considerando afinidad con las
áreas prioritarias, cargo, salario y ubicación. Un cargo de logística,
coordinación, supervisión, operaciones o bienestar debe puntuar alto si calza
con el perfil. Si el salario no está especificado, no lo penalices.
Responde SOLO con JSON válido, sin texto adicional:
{"score": <1-10>, "apply": <true|false>, "reasoning": "<una frase breve en español>"}`;

  try {
    const completion = await getGroq().chat.completions.create({
      model: process.env.GROQ_MODEL || DEFAULT_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 300,
    });

    const text = completion.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("respuesta sin JSON");

    const parsed = JSON.parse(match[0]);
    return applyProfileBonuses(job, {
      score: Math.min(10, Math.max(0, Number(parsed.score) || 0)),
      apply: Boolean(parsed.apply),
      reasoning: String(parsed.reasoning || "").slice(0, 500),
    });
  } catch (error) {
    console.error(`  [evaluator] Groq falló: ${error.message}`);
    return fallbackEvaluation(job, error.message);
  }
}
