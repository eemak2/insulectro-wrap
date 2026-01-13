const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");
const OUTPUT_FILE = path.join(KNOWLEDGE_DIR, "docs.json");

function pdfToText(filePath) {
  // "-" means output to stdout
  const out = execFileSync("pdftotext", ["-layout", "-nopgbrk", filePath, "-"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return out;
}

function clean(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/Page \d+/gi, "")
    .trim();
}

function ingest() {
  const files = fs
    .readdirSync(KNOWLEDGE_DIR)
    .filter((f) => f.toLowerCase().endsWith(".pdf"));

  const docs = [];

  for (const file of files) {
    const filePath = path.join(KNOWLEDGE_DIR, file);
    console.log("Reading:", file);

    const text = clean(pdfToText(filePath));

    docs.push({
      source: file,
      text,
    });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(docs, null, 2));
  console.log(`✅ Wrote ${docs.length} docs to ${OUTPUT_FILE}`);
}

try {
  ingest();
} catch (err) {
  console.error("❌ Ingest failed:", err.message);
  process.exit(1);
}

