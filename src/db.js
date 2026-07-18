import { createClient } from "@supabase/supabase-js";

let client = null;

export function getSupabase() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
    if (!url || !key) {
      throw new Error("Faltan SUPABASE_URL / SUPABASE_KEY en .env.local");
    }
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

// Inserta ofertas nuevas; las repetidas (mismo job_url) se ignoran.
// Devuelve solo las filas realmente insertadas.
export async function saveJobs(jobs) {
  if (!jobs || jobs.length === 0) return [];
  try {
    const { data, error } = await getSupabase()
      .from("applications")
      .upsert(jobs, { onConflict: "job_url", ignoreDuplicates: true })
      .select();
    if (error) throw error;
    return data ?? [];
  } catch (error) {
    console.error(`[db] Error guardando ofertas: ${error.message}`);
    return [];
  }
}

export async function getJobsByStatus(status, limit = 50) {
  try {
    const { data, error } = await getSupabase()
      .from("applications")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  } catch (error) {
    console.error(`[db] Error leyendo ofertas '${status}': ${error.message}`);
    return [];
  }
}

export async function updateApplicationStatus(id, status, notes = null) {
  try {
    const patch = { status };
    if (notes) patch.notes = String(notes).slice(0, 1000);
    if (status === "applied") patch.applied_at = new Date().toISOString();
    const { error } = await getSupabase()
      .from("applications")
      .update(patch)
      .eq("id", id);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error(
      `[db] Error actualizando #${id} → ${status}: ${error.message}`
    );
    return false;
  }
}

export async function recordFailure(id, message) {
  return updateApplicationStatus(id, "apply_failed", message);
}

// ── Ofertas recientes (para el email diario) ─────────────────────────────

export async function getRecentJobs(hours = 24) {
  try {
    const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    const { data, error } = await getSupabase()
      .from("applications")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  } catch (error) {
    console.error(`[db] Error leyendo ofertas recientes: ${error.message}`);
    return [];
  }
}

// ── Sugerencias de perfil (tablas profile_suggestions / active_profiles,
//    creadas con supabase/schema.sql) ─────────────────────────────────────

export async function getPendingSuggestions() {
  try {
    const { data, error } = await getSupabase()
      .from("profile_suggestions")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  } catch (error) {
    console.error(`[db] Error leyendo profile_suggestions: ${error.message}`);
    return [];
  }
}

export async function saveSuggestions(suggestions) {
  if (!suggestions || suggestions.length === 0) return [];
  try {
    const { data, error } = await getSupabase()
      .from("profile_suggestions")
      .insert(suggestions)
      .select();
    if (error) throw error;
    return data ?? [];
  } catch (error) {
    console.error(`[db] Error guardando sugerencias: ${error.message}`);
    return [];
  }
}

// Keywords aceptadas vía webhook; se suman a SEARCH_TERMS en cada ciclo.
export async function getActiveProfileKeywords() {
  try {
    const { data, error } = await getSupabase()
      .from("active_profiles")
      .select("keyword");
    if (error) throw error;
    return (data ?? []).map((row) => row.keyword).filter(Boolean);
  } catch {
    // La tabla puede no existir todavía; no es un error del ciclo.
    return [];
  }
}
