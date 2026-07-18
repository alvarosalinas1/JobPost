import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

import Groq from "groq-sdk";
import { getPendingSuggestions, saveSuggestions } from "./db.js";

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

// Lee las sugerencias pendientes de la tabla profile_suggestions.
export async function analyzeNewKeywords() {
  const pending = await getPendingSuggestions();
  console.log(`[profiler] ${pending.length} sugerencias pendientes de revisión`);
  for (const s of pending) {
    console.log(`  - ${s.title} (${(s.keywords ?? []).join(", ")})`);
  }
  return pending;
}

// Pide a Groq nuevos perfiles de búsqueda basados en el perfil del candidato
// y los guarda como 'pending' en profile_suggestions (aparecen en el email
// diario con un botón para aceptarlos).
export async function suggestProfiles() {
  const profile =
    process.env.CANDIDATE_PROFILE ||
    "Profesional de operaciones y logística en Santiago de Chile.";
  const currentTerms = process.env.SEARCH_TERMS || "";

  const prompt = `Eres un asesor laboral chileno.

Perfil del candidato: ${profile}
Búsquedas actuales: ${currentTerms}

Basado en su experiencia en operaciones, LATAM Airlines, logística y su interés
en bienestar y liderazgo consciente, sugiere 3 perfiles de cargo NUEVOS que no
estén ya en las búsquedas actuales y que existan realmente en portales de empleo
chilenos.

Responde SOLO con un arreglo JSON válido, sin texto adicional:
[{"title": "<nombre del perfil>", "keywords": ["<término de búsqueda 1>", "<término 2>"], "description": "<por qué calza con el perfil, una frase>", "confidence": <0.0-1.0>}]`;

  try {
    const completion = await getGroq().chat.completions.create({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 600,
    });

    const text = completion.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("respuesta sin JSON");

    const parsed = JSON.parse(match[0]);

    // Evita duplicar sugerencias que ya están pendientes
    const existing = new Set(
      (await getPendingSuggestions()).map((s) => s.title?.toLowerCase())
    );
    const fresh = parsed
      .filter((s) => s.title && !existing.has(s.title.toLowerCase()))
      .map((s) => ({
        title: String(s.title).slice(0, 200),
        keywords: Array.isArray(s.keywords) ? s.keywords.map(String) : [],
        description: String(s.description ?? "").slice(0, 500),
        confidence: Math.min(1, Math.max(0, Number(s.confidence) || 0.5)),
        status: "pending",
      }));

    const saved = await saveSuggestions(fresh);
    console.log(`[profiler] ${saved.length} sugerencias nuevas guardadas`);
    return saved;
  } catch (error) {
    console.error(`[profiler] Error generando sugerencias: ${error.message}`);
    return [];
  }
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  try {
    await analyzeNewKeywords();
    const suggestions = await suggestProfiles();
    console.log(JSON.stringify(suggestions, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(`[profiler] Error: ${error.message}`);
    process.exit(1);
  }
}
