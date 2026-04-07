const LETTER_REGEX = /\p{L}/u;
const WORD_TOKEN_REGEX = /(\s+|[\p{L}]+(?:['\u2019][\p{L}]+)?|[0-9]+|[^\s\p{L}0-9])/gu;
const VOWEL_LETTER_REGEX = /[aeiouy\u00e0\u00e2\u00e4\u00e6\u00e9\u00e8\u00ea\u00eb\u00ee\u00ef\u00f4\u00f6\u0153\u00f9\u00fb\u00fc\u00ff]/iu;

export const SYLLABLE_LEVELS = new Set(["off", "light", "strong"]);

const SILENT_ENDING_PATTERNS = ["ent", "es", "e", "s", "x", "t", "d"];
const SILENT_ENDING_EXCEPTIONS = new Set([
  "bus",
  "cactus",
  "comment",
  "est",
  "huit",
  "mais",
  "mars",
  "mes",
  "met",
  "nord",
  "ouest",
  "ours",
  "plus",
  "pres",
  "sud",
  "tas",
  "tous",
  "tres",
  "virus",
  "absent",
  "accent",
  "accident",
  "adolescent",
  "agent",
  "aliment",
  "appartement",
  "argent",
  "autant",
  "avant",
  "batiment",
  "cement",
  "cent",
  "client",
  "competent",
  "complement",
  "confident",
  "conscient",
  "content",
  "continent",
  "courant",
  "dent",
  "different",
  "document",
  "element",
  "eminent",
  "enfant",
  "enseignant",
  "equipement",
  "etudiant",
  "evenement",
  "evident",
  "fervent",
  "fondement",
  "fragment",
  "frequent",
  "gent",
  "gouvernement",
  "habitant",
  "ignorant",
  "impatient",
  "important",
  "incident",
  "independant",
  "indulgent",
  "innocent",
  "instrument",
  "intelligent",
  "lent",
  "logement",
  "moment",
  "monument",
  "mouvement",
  "orient",
  "ornement",
  "parent",
  "parlement",
  "patient",
  "permanent",
  "placement",
  "precedent",
  "present",
  "president",
  "prudent",
  "puissant",
  "recent",
  "regiment",
  "restaurant",
  "savant",
  "segment",
  "sentiment",
  "sergent",
  "serpent",
  "souvent",
  "supplement",
  "talent",
  "torrent",
  "transparent",
  "urgent",
  "vent",
  "violent",
  "vivant",
  "appartient",
  "contient",
  "convient",
  "devient",
  "entretient",
  "intervient",
  "maintient",
  "obtient",
  "parvient",
  "provient",
  "retient",
  "revient",
  "soutient",
  "survient",
  "tient",
  "vient"
]);

const EXCEPTION_SYLLABLES = new Map([
  ["arrete", ["ar", "r\u00eate"]],
  ["residence", ["r\u00e9", "si", "dence"]],
  ["famille", ["fa", "mille"]],
  ["fille", ["fille"]],
  ["ville", ["ville"]],
  ["mille", ["mille"]],
  ["bille", ["bille"]],
  ["grille", ["grille"]],
  ["vanille", ["va", "nille"]],
  ["chenille", ["che", "nille"]],
  ["cheville", ["che", "ville"]],
  ["pastille", ["pas", "tille"]],
  ["coquille", ["co", "quille"]],
  ["quille", ["quille"]],
  ["feuille", ["feuille"]],
  ["paille", ["paille"]],
  ["taille", ["taille"]],
  ["maille", ["maille"]],
  ["aille", ["aille"]],
  ["abeille", ["a", "beille"]],
  ["bouteille", ["bou", "teille"]],
  ["oreille", ["o", "reille"]],
  ["corneille", ["cor", "neille"]],
  ["groseille", ["gro", "seille"]],
  ["merveille", ["mer", "veille"]],
  ["veille", ["veille"]],
  ["vieille", ["vieille"]],
  ["soleil", ["so", "leil"]],
  ["orteil", ["or", "teil"]],
  ["appareil", ["ap", "pa", "reil"]],
  ["conseil", ["con", "seil"]],
  ["sommeil", ["som", "meil"]],
  ["reveil", ["r\u00e9", "veil"]],
  ["accueil", ["ac", "cueil"]],
  ["cercueil", ["cer", "cueil"]],
  ["ecureuil", ["\u00e9", "cu", "reuil"]],
  ["fauteuil", ["fau", "teuil"]],
  ["seuil", ["seuil"]],
  ["oeil", ["oeil"]],
  ["monsieur", ["mon", "sieur"]],
  ["femme", ["femme"]],
  ["oignon", ["oi", "gnon"]],
  ["soixante", ["soi", "xante"]],
  ["excellent", ["ex", "cel", "lent"]],
  ["extreme", ["ex", "tr\u00eame"]]
]);

const PROTECTED_VOWEL_GRAPHEMES = [
  "eille",
  "aille",
  "euil",
  "ueil",
  "eau",
  "oeu",
  "ain",
  "ein",
  "oin",
  "eil",
  "eu",
  "au",
  "ou",
  "on",
  "an",
  "en",
  "in",
  "oi",
  "ai",
  "ei",
  "un",
  "om",
  "am",
  "em",
  "im",
  "um"
];

const PROTECTED_CONSONANT_GRAPHEMES = ["ch", "gn", "ph", "th", "qu"];

const ALLOWED_ONSET_CLUSTERS = new Set([
  "pr",
  "br",
  "tr",
  "dr",
  "cr",
  "gr",
  "fr",
  "vr",
  "pl",
  "bl",
  "cl",
  "gl",
  "fl",
  "kl",
  "kr",
  "str",
  "spl",
  "spr",
  "scr"
]);

const PROTECTED_GRAPHEMES = [...PROTECTED_VOWEL_GRAPHEMES, ...PROTECTED_CONSONANT_GRAPHEMES].sort(
  (left, right) => right.length - left.length
);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeLetters(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "");
}

function countLetters(value) {
  return [...String(value)].filter((char) => LETTER_REGEX.test(char)).length;
}

function isVowelText(value) {
  return VOWEL_LETTER_REGEX.test(value);
}

function splitSilentEnding(word) {
  const normalizedWord = normalizeLetters(word);
  if (normalizedWord.length <= 2 || SILENT_ENDING_EXCEPTIONS.has(normalizedWord)) {
    return { core: word, silentEnding: "" };
  }

  for (const pattern of SILENT_ENDING_PATTERNS) {
    if (!normalizedWord.endsWith(pattern)) {
      continue;
    }
    if (pattern === "ent" && normalizedWord.endsWith("ment")) {
      continue;
    }
    if (["s", "x", "t", "d"].includes(pattern) && normalizedWord.length <= 3) {
      continue;
    }

    const letters = [...word];
    const silentLength = [...pattern].length;
    const coreLetters = letters.slice(0, letters.length - silentLength);
    if (coreLetters.length < 2) {
      continue;
    }

    if (
      ["e", "es"].includes(pattern) &&
      coreLetters.filter((letter) => isVowelText(letter)).length <= 1
    ) {
      continue;
    }

    return {
      core: coreLetters.join(""),
      silentEnding: letters.slice(letters.length - silentLength).join("")
    };
  }

  return { core: word, silentEnding: "" };
}

function matchExceptionSyllables(word) {
  const exception = EXCEPTION_SYLLABLES.get(normalizeLetters(word));
  if (!exception) {
    return null;
  }

  const letters = [...word];
  let cursor = 0;
  const mapped = [];

  for (const segment of exception) {
    const segmentLength = [...segment].length;
    const slice = letters.slice(cursor, cursor + segmentLength).join("");
    if (!slice) {
      return null;
    }
    mapped.push(slice);
    cursor += segmentLength;
  }

  if (cursor !== letters.length) {
    return null;
  }

  return mapped;
}

function buildUnits(word) {
  const letters = [...String(word)];
  const normalizedLetters = letters.map((letter) => normalizeLetters(letter));
  const units = [];
  let index = 0;

  while (index < letters.length) {
    let matched = null;

    for (const grapheme of PROTECTED_GRAPHEMES) {
      const length = [...grapheme].length;
      const slice = normalizedLetters.slice(index, index + length).join("");
      if (slice === grapheme) {
        matched = {
          text: letters.slice(index, index + length).join(""),
          normalized: grapheme,
          kind: PROTECTED_VOWEL_GRAPHEMES.includes(grapheme) ? "vowel" : "consonant"
        };
        index += length;
        break;
      }
    }

    if (matched) {
      units.push(matched);
      continue;
    }

    const letter = letters[index];
    units.push({
      text: letter,
      normalized: normalizedLetters[index],
      kind: isVowelText(letter) ? "vowel" : "consonant"
    });
    index += 1;
  }

  return mergeGlideUnits(units);
}

function mergeGlideUnits(units) {
  const merged = [];

  for (let index = 0; index < units.length; index += 1) {
    const current = units[index];
    const previous = merged.at(-1);
    const next = units[index + 1];

    if (
      current?.kind === "vowel" &&
      next?.kind === "vowel" &&
      ["i", "u", "y"].includes(current.normalized) &&
      previous?.kind === "consonant"
    ) {
      merged.push({
        text: current.text + next.text,
        normalized: current.normalized + next.normalized,
        kind: "vowel"
      });
      index += 1;
      continue;
    }

    merged.push(current);
  }

  return merged;
}

function getPreferredRightClusterLength(cluster) {
  if (cluster.length === 0) {
    return 0;
  }

  if (cluster.length === 1) {
    return 1;
  }

  if (cluster.length === 2 && cluster[0].normalized === cluster[1].normalized) {
    return 1;
  }

  const maxCandidateLength = Math.min(3, cluster.length);
  for (let length = maxCandidateLength; length >= 2; length -= 1) {
    const suffix = cluster
      .slice(cluster.length - length)
      .map((unit) => unit.normalized)
      .join("");
    if (ALLOWED_ONSET_CLUSTERS.has(suffix)) {
      return length;
    }
  }

  return 1;
}

function segmentCoreWord(word) {
  if (!word || countLetters(word) <= 1) {
    return word ? [word] : [];
  }

  const exceptionSyllables = matchExceptionSyllables(word);
  if (exceptionSyllables) {
    return exceptionSyllables;
  }

  const units = buildUnits(word);
  const vowelIndices = [];
  for (let index = 0; index < units.length; index += 1) {
    if (units[index].kind === "vowel") {
      vowelIndices.push(index);
    }
  }

  if (vowelIndices.length <= 1) {
    return [word];
  }

  const syllables = [];
  let syllableStart = 0;

  for (let pairIndex = 0; pairIndex < vowelIndices.length - 1; pairIndex += 1) {
    const leftVowelIndex = vowelIndices[pairIndex];
    const rightVowelIndex = vowelIndices[pairIndex + 1];
    const cluster = units.slice(leftVowelIndex + 1, rightVowelIndex);

    let nextSyllableStart = rightVowelIndex;
    if (cluster.length > 0) {
      const rightClusterLength = getPreferredRightClusterLength(cluster);
      nextSyllableStart = rightVowelIndex - rightClusterLength;
    }

    syllables.push(units.slice(syllableStart, nextSyllableStart).map((unit) => unit.text).join(""));
    syllableStart = nextSyllableStart;
  }

  syllables.push(units.slice(syllableStart).map((unit) => unit.text).join(""));
  return stabilizeSyllables(syllables);
}

function stabilizeSyllables(syllables) {
  const filtered = syllables.filter(Boolean);
  if (filtered.length <= 1) {
    return filtered;
  }

  const normalized = filtered.map((syllable) => [...syllable].join(""));
  const merged = [];

  for (const syllable of normalized) {
    if (merged.length > 0 && countLetters(syllable) === 1 && !isVowelText(syllable)) {
      merged[merged.length - 1] += syllable;
      continue;
    }
    merged.push(syllable);
  }

  const last = merged.at(-1);
  if (merged.length > 1 && last && countLetters(last) === 1) {
    merged[merged.length - 2] += last;
    merged.pop();
  }

  return merged;
}

export function normalizeSyllableLevel(value) {
  return SYLLABLE_LEVELS.has(value) ? value : "off";
}

export function analyzeFrenchWord(word) {
  const source = String(word || "");
  const lettersOnly = countLetters(source);
  if (!source || lettersOnly === 0) {
    return {
      original: source,
      core: source,
      silentEnding: "",
      syllables: source ? [source] : [],
      syllableCount: source ? 1 : 0
    };
  }

  const exceptionSyllables = matchExceptionSyllables(source);
  if (exceptionSyllables) {
    return {
      original: source,
      core: source,
      silentEnding: "",
      syllables: exceptionSyllables,
      syllableCount: exceptionSyllables.length
    };
  }

  const { core, silentEnding } = splitSilentEnding(source);
  const coreSyllables = segmentCoreWord(core);
  const syllables = coreSyllables.length > 0 ? coreSyllables : [source];

  return {
    original: source,
    core,
    silentEnding,
    syllables,
    syllableCount: syllables.length
  };
}

export function shouldDisplaySyllables(word, { level = "off", lightMinLength = 8, lightMinSyllables = 3 } = {}) {
  const normalizedLevel = normalizeSyllableLevel(level);
  if (normalizedLevel === "off") {
    return false;
  }

  const analysis = typeof word === "string" ? analyzeFrenchWord(word) : word;
  if (!analysis || analysis.syllableCount <= 1) {
    return false;
  }

  const letterCount = countLetters(analysis.original);
  if (normalizedLevel === "light") {
    return analysis.syllableCount >= lightMinSyllables || letterCount >= lightMinLength;
  }

  return analysis.syllableCount >= 2 && letterCount >= 4;
}

function joinSyllables(syllables, { separator = "-", separatorMode = "text", separatorClass = "syllable-separator" } = {}) {
  if (syllables.length <= 1) {
    return syllables.join("");
  }

  if (separatorMode === "html") {
    const safeSeparator = escapeHtml(separator);
    return syllables
      .map((syllable, index) => {
        const escaped = escapeHtml(syllable);
        if (index === syllables.length - 1) {
          return escaped;
        }
        return `${escaped}<span class="${separatorClass}" aria-hidden="true">${safeSeparator}</span>`;
      })
      .join("");
  }

  return syllables.join(separator);
}

export function syllabifyFrenchWord(
  word,
  { level = "strong", separator = "-", separatorMode = "text", separatorClass = "syllable-separator" } = {}
) {
  const analysis = analyzeFrenchWord(word);
  if (!shouldDisplaySyllables(analysis, { level })) {
    return String(word || "");
  }

  const syllables = [...analysis.syllables];
  if (analysis.silentEnding) {
    syllables[syllables.length - 1] += analysis.silentEnding;
  }

  return joinSyllables(syllables, { separator, separatorMode, separatorClass });
}

function syllabifyWordWithApostrophes(
  word,
  { level = "strong", separator = "-", separatorMode = "text", separatorClass = "syllable-separator" } = {}
) {
  return String(word)
    .split(/(['\u2019])/u)
    .map((part) => {
      if (!part || /^['\u2019]$/u.test(part) || !LETTER_REGEX.test(part)) {
        return part;
      }
      return syllabifyFrenchWord(part, { level, separator, separatorMode, separatorClass });
    })
    .join("");
}

export function syllabifyFrenchText(
  text,
  { level = "strong", separator = "-", separatorMode = "text", separatorClass = "syllable-separator" } = {}
) {
  if (normalizeSyllableLevel(level) === "off") {
    return String(text || "");
  }

  const source = String(text || "");
  const matcher = new RegExp(WORD_TOKEN_REGEX.source, "gu");
  return Array.from(source.matchAll(matcher), (match) => {
    const token = match[0];
    if (!LETTER_REGEX.test(token)) {
      return token;
    }
    return syllabifyWordWithApostrophes(token, { level, separator, separatorMode, separatorClass });
  }).join("");
}

export function syllabifyFrenchHtml(
  html,
  { level = "strong", separator = "-", separatorMode = "text", separatorClass = "syllable-separator" } = {}
) {
  if (normalizeSyllableLevel(level) === "off") {
    return String(html || "");
  }

  return String(html || "")
    .split(/(<[^>]+>)/gu)
    .map((segment) =>
      segment.startsWith("<")
        ? segment
        : syllabifyFrenchText(segment, { level, separator, separatorMode, separatorClass })
    )
    .join("");
}
