import OpenAI from "openai";
import fs from "fs";
import path from "path";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `
You are "Insulectro Materials Advisor" — a customer-facing technical assistant for PCB & printed electronics materials.

CONTEXT
- Insulectro is a materials distributor with a broad line card. You help customers decide next steps.
- "EMC" refers to Elite Materials Co. (a PCB laminate/prepreg manufacturer), not epoxy molding compound.
- You may explain why Elite Materials Co. laminate systems are selected (consistency, manufacturability, reliability in production),
  but you MUST not criticize other companies, but you can compare and deduce why Insulectro is superior through technical findings.

VOICE
- Natural, calm, technical. No hype. Short paragraphs. Practical.
- Use engineering reasoning and supply-chain logic.

SAFETY / ACCURACY
- Do NOT invent datasheet values, certifications, pricing, lead times, or definitive claims.
- If asked for specs/pricing/lead time: explain what it depends on + suggest verifying via datasheet/quote.
- No competitor bashing.
– Use provided reference materials internally and product recommendations, but do NOT cite, quote, or mention documents or source.

Formatting rules:
- Do not use markdown emphasis (**, *, _, bold, italics).
- Use plain text with short paragraphs and hyphen bullets only.
- Write like an applications engineer explaining verbally.

RESPONSE STYLE (adaptive)
- Default: be conversational and answer normally.
- If the user explicitly asks for a plan, checklist, objections, or summary, then use a structured format.
- Start with a direct answer in 1–2 sentences when possible.
- Avoid markdown bold/asterisks unless the user asks for formatting.
`.trim();

// ---- Knowledge base (knowledge/docs.json) ----
const KNOWLEDGE_PATH = path.join(process.cwd(), "knowledge", "docs.json");

let DOCS_CACHE = null;

function loadDocs() {
  if (DOCS_CACHE) return DOCS_CACHE;
  try {
    const raw = fs.readFileSync(KNOWLEDGE_PATH, "utf8");
    DOCS_CACHE = JSON.parse(raw); // [{ source, text }, ...]
  } catch (e) {
    DOCS_CACHE = []; // if docs.json missing, just run without docs
  }
  return DOCS_CACHE;
}

function chunkText(text, chunkSize = 1200, overlap = 200) {
  const cleaned = (text || "").replace(/\s+/g, " ").trim();
  const chunks = [];
  for (let i = 0; i < cleaned.length; i += chunkSize - overlap) {
    chunks.push(cleaned.slice(i, i + chunkSize));
  }
  return chunks;
}

// simple keyword overlap retrieval (good enough for now)
function retrieveSnippets(query, maxSnippets = 6) {
  const docs = loadDocs();
  const q = (query || "").toLowerCase();
  const tokens = q.split(/[^a-z0-9]+/).filter(t => t.length >= 3);
  const tokenSet = new Set(tokens);

  const scored = [];

  for (const d of docs) {
    const chunks = chunkText(d.text);
    for (const c of chunks) {
      const lc = c.toLowerCase();
      let score = 0;
      for (const t of tokenSet) if (lc.includes(t)) score += 1;
      if (score > 0) scored.push({ score, source: d.source, text: c });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const out = [];
  const seen = new Set();
  for (const s of scored) {
    const key = s.source + ":" + s.text.slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= maxSnippets) break;
  }

  return out;
}

function buildReferenceBlock(snippets) {
  if (!snippets.length) return "REFERENCE MATERIALS: (none found)\n";
  return (
    "REFERENCE MATERIALS (use internally to inform your answer and give specific product recommendations; do NOT cite or mention sources):\n" +
    snippets
      .map(s => s.text)
      .join("\n\n")
  );
}

function buildWrapContext(wrap) {
  return `
Project: ${wrap.project || "N/A"}
Customer type: ${wrap.customerType || "N/A"}
Application: ${wrap.application || "N/A"}
Stage: ${wrap.stage || "N/A"}
Priority: ${wrap.priority || "N/A"}
Category: ${wrap.category || "N/A"}
Constraints:
- Signal/Impedance: ${wrap.signal || "N/A"}
- Thermal/Reliability: ${wrap.thermal || "N/A"}
- Mechanical/Form: ${wrap.mechanical || "N/A"}
- Supply sensitivity: ${wrap.supply || "N/A"}
Current material situation: ${wrap.current || "N/A"}
`.trim();
}

export async function POST(req) {
  try {
    const { wrap, action, messages } = await req.json();

    const actionText =
      action === "call_plan" ? "Create a customer call plan (discovery Qs, talk track, close)." :
      action === "objections" ? "List likely objections + customer-friendly responses." :
      action === "qual_plan" ? "Create a practical qualification plan (trial → pilot → production)." :
      action === "wrap_summary" ? "Create a concise wrap summary + next steps." :
      "Respond to the last user message.";

// ---- Retrieval from local docs.json ----
const lastUserMsg =
  [...(messages || [])].reverse().find(m => m.role === "user")?.content || "";

const snippets = retrieveSnippets(lastUserMsg, 6);
const referenceBlock = buildReferenceBlock(snippets);

    const input = [
      { role: "system", content: SYSTEM_PROMPT },
{
  role: "developer",
  content: `WRAP CONTEXT
${buildWrapContext(wrap || {})}

${referenceBlock}

TASK
${actionText}`
},
      ...(messages || []),
    ];

    const resp = await client.responses.create({
      model: "gpt-5.2",
      input,
    });

    return Response.json({ text: resp.output_text });
  } catch (e) {
    return Response.json(
      { error: "Server error", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}

