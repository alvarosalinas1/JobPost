import { createClient } from "@supabase/supabase-js";

// Vercel Function (stub, aún no desplegada):
//   GET /api/accept-profile?profile=jefe-logistica&id=123
//
// Acepta una sugerencia de perfil desde el email diario: agrega la keyword a
// la tabla active_profiles (el scraper la suma a SEARCH_TERMS al inicio de
// cada ciclo) y marca la sugerencia como aceptada.
//
// Requiere en Vercel las env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// y opcionalmente WEBHOOK_SECRET (si está definida, exige &token=<secreto>).
export default async function handler(req, res) {
  try {
    const slug = String(req.query?.profile ?? "").trim();
    if (!slug) {
      return res.status(400).json({ error: "Falta el parámetro ?profile=" });
    }

    if (
      process.env.WEBHOOK_SECRET &&
      req.query?.token !== process.env.WEBHOOK_SECRET
    ) {
      return res.status(401).json({ error: "Token inválido" });
    }

    // "jefe-logistica" → "jefe logistica" (término de búsqueda)
    const keyword = slug.replace(/-/g, " ").toLowerCase();

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY,
      { auth: { persistSession: false } }
    );

    const { error: insertError } = await supabase
      .from("active_profiles")
      .upsert(
        { keyword, added_by: "webhook" },
        { onConflict: "keyword", ignoreDuplicates: true }
      );
    if (insertError) throw insertError;

    const suggestionId = Number(req.query?.id);
    if (suggestionId) {
      await supabase
        .from("profile_suggestions")
        .update({ status: "accepted" })
        .eq("id", suggestionId);
    }

    return res.status(200).json({
      ok: true,
      keyword,
      message: `"${keyword}" agregado a las búsquedas. Se usará desde el próximo ciclo.`,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
