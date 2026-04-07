import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const sourcePath = path.join(rootDir, "data", "lexicon", "Dictionnaire.md");
const outputPath = path.join(rootDir, "src", "core", "lexicon", "french-lexicon.generated.mjs");

function normalizeFrenchWord(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("Å“", "oe")
    .replaceAll("Ã¦", "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[â€™']/gu, "'")
    .replace(/[â€â€‘â€“â€”]/gu, "-");
}

function isLexiconWord(value) {
  return /^[a-z'-]+$/u.test(value);
}

async function main() {
  const source = await fs.readFile(sourcePath, "utf8");
  const words = new Set();

  for (const rawLine of source.split(/\r?\n/gu)) {
    const normalized = normalizeFrenchWord(rawLine);
    if (!normalized || !isLexiconWord(normalized)) {
      continue;
    }
    words.add(normalized);
  }

  const entries = [...words].sort((left, right) => left.localeCompare(right, "fr"));
  const moduleSource = `// Fichier genere automatiquement depuis data/lexicon/Dictionnaire.md.\n// Ne pas modifier a la main : utiliser scripts/build-french-lexicon.mjs.\n\nexport const FRENCH_LEXICON_VERSION = ${JSON.stringify(
    new Date().toISOString()
  )};\nexport const FRENCH_LEXICON_WORDS = ${JSON.stringify(entries, null, 2)};\n`;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, moduleSource, "utf8");
  console.log(`Lexique francais genere : ${entries.length} formes normalisees.`);
}

main().catch((error) => {
  console.error("Impossible de generer le lexique francais.", error);
  process.exitCode = 1;
});
