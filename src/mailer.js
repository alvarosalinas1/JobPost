import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

import { getRecentJobs, getPendingSuggestions } from "./db.js";

const STATUS_LABELS = {
  pending: "Pendiente",
  approved: "Aprobada",
  applied: "Postulada",
  skipped: "Descartada",
  apply_failed: "Falló postulación",
};

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderJobRow(job) {
  const salary = job.salary
    ? `$${Number(job.salary).toLocaleString("es-CL")}`
    : "—";
  return `<tr>
    <td style="padding:8px;border-bottom:1px solid #eee;">
      <a href="${escapeHtml(job.job_url)}" style="color:#1a56db;text-decoration:none;">
        ${escapeHtml(job.role ?? "Sin título")}
      </a><br>
      <span style="color:#666;font-size:13px;">${escapeHtml(job.company ?? "Empresa no indicada")}</span>
    </td>
    <td style="padding:8px;border-bottom:1px solid #eee;white-space:nowrap;">${salary}</td>
    <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(job.platform ?? "?")}</td>
    <td style="padding:8px;border-bottom:1px solid #eee;">${STATUS_LABELS[job.status] ?? escapeHtml(job.status)}</td>
  </tr>`;
}

// Tarjetas HTML con las sugerencias de nuevos perfiles (tabla profile_suggestions).
// Cada tarjeta incluye un link de aceptación que apunta al webhook.
export async function buildProfileSuggestions() {
  const suggestions = await getPendingSuggestions();
  if (suggestions.length === 0) return "";

  const baseUrl =
    process.env.WEBHOOK_BASE_URL || "https://TU-PROYECTO.vercel.app";

  const cards = suggestions
    .map((s) => {
      const slug = String(s.title ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const acceptUrl = `${baseUrl}/api/accept-profile?profile=${encodeURIComponent(slug)}&id=${s.id}`;
      const confidence = s.confidence != null ? `${Math.round(s.confidence * 100)}%` : "—";
      return `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin:10px 0;">
        <strong>${escapeHtml(s.title)}</strong>
        <span style="color:#666;font-size:12px;"> · confianza ${confidence}</span>
        <p style="margin:6px 0;color:#444;font-size:14px;">${escapeHtml(s.description ?? "")}</p>
        <p style="margin:6px 0;color:#666;font-size:13px;">Keywords: ${escapeHtml((s.keywords ?? []).join(", "))}</p>
        <a href="${escapeHtml(acceptUrl)}"
           style="display:inline-block;background:#1a56db;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none;font-size:14px;">
          Aceptar este perfil
        </a>
      </div>`;
    })
    .join("\n");

  return `<h2 style="font-size:18px;margin-top:28px;">Nuevos perfiles sugeridos</h2>
  <p style="color:#666;font-size:14px;">Al aceptar un perfil, sus keywords se suman automáticamente a la búsqueda.</p>
  ${cards}`;
}

// Genera el HTML del resumen diario con las ofertas de las últimas 24 horas.
export async function buildDailyEmail() {
  const jobs = await getRecentJobs(24);
  const counts = {};
  for (const job of jobs) counts[job.status] = (counts[job.status] ?? 0) + 1;

  const summary = Object.entries(counts)
    .map(([status, n]) => `${STATUS_LABELS[status] ?? status}: ${n}`)
    .join(" · ");

  const rows = jobs.map(renderJobRow).join("\n");
  const suggestionsHtml = await buildProfileSuggestions();
  const today = new Date().toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#111;">
    <h1 style="font-size:20px;">Resumen de empleos — ${escapeHtml(today)}</h1>
    <p style="color:#444;">${jobs.length} ofertas en las últimas 24 horas${summary ? ` (${summary})` : ""}.</p>
    ${
      jobs.length > 0
        ? `<table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead><tr style="text-align:left;color:#666;">
              <th style="padding:8px;">Cargo / Empresa</th>
              <th style="padding:8px;">Sueldo</th>
              <th style="padding:8px;">Portal</th>
              <th style="padding:8px;">Estado</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>`
        : `<p style="color:#666;">Sin ofertas nuevas hoy.</p>`
    }
    ${suggestionsHtml}
    <p style="color:#999;font-size:12px;margin-top:28px;">Auto Job Aplicador Chile — email generado automáticamente.</p>
  </div>`;

  return {
    subject: `Empleos: ${jobs.length} ofertas nuevas — ${today}`,
    html,
    jobCount: jobs.length,
  };
}

// STUB: el envío real está desactivado a propósito mientras se revisa el setup.
// Para activarlo: descomenta el bloque marcado abajo. Requiere SENDGRID_API_KEY
// válida y un remitente verificado en SendGrid (Settings → Sender Authentication).
export async function sendEmail({ subject, html }) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const to = process.env.RECIPIENT_EMAIL || "alvarosalinass@hotmail.com";

  console.log(
    `[mailer] Email generado (no enviado aún) → destinatario: ${to}, asunto: "${subject}"`
  );
  if (!apiKey) {
    console.log("[mailer] Nota: falta SENDGRID_API_KEY para el envío real");
  }
  return { sent: false, reason: "stub — envío desactivado" };

  /* ── ACTIVAR ENVÍO REAL: descomentar desde aquí ──
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: "REMITENTE_VERIFICADO@tudominio.cl", name: "Auto Job Aplicador" },
      subject,
      content: [{ type: "text/html", value: html }],
    }),
  });
  if (!response.ok) {
    throw new Error(`SendGrid HTTP ${response.status}: ${await response.text()}`);
  }
  return { sent: true };
  ── hasta aquí ── */
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  try {
    const email = await buildDailyEmail();
    await sendEmail(email);
    const previewPath = path.resolve(__dirname, "..", "email-preview.html");
    fs.writeFileSync(previewPath, email.html, "utf8");
    console.log(`[mailer] Vista previa guardada en ${previewPath}`);
    process.exit(0);
  } catch (error) {
    console.error(`[mailer] Error: ${error.message}`);
    process.exit(1);
  }
}
