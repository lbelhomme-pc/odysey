import {
  PEDAGOGICAL_EXACT_SYLLABLE_EXCEPTIONS,
  PEDAGOGICAL_NORMALIZED_SYLLABLE_EXCEPTIONS,
  TYPOGRAPHIC_EXACT_SYLLABLE_EXCEPTIONS,
  TYPOGRAPHIC_NORMALIZED_SYLLABLE_EXCEPTIONS
} from "./syllabify-french.exceptions.mjs";

const LETTER_REGEX = /\p{L}/u;
const WORD_TOKEN_REGEX = /(\s+|[\p{L}]+(?:['\u2019-][\p{L}]+)*|[0-9]+|[^\s\p{L}0-9])/gu;
const VOWEL_LETTER_REGEX = /[aeiouyàâäæéèêëîïôöœùûüÿ]/iu;
const DIAERESIS_REGEX = /[ïëüöÿÏËÜÖŸ]/u;
const APOSTROPHE_REGEX = /['\u2019]/u;

export const SYLLABLE_LEVELS = new Set(["off", "light", "strong"]);
export const SYLLABLE_WORD_SCOPES = new Set(["auto", "all"]);
export const SYLLABIFICATION_MODES = new Set([
  "pedagogique",
  "typographique",
  "modePedagogique",
  "modeTypographique"
]);

const SILENT_ENDING_PATTERNS = ["ent", "s", "x", "t", "d"];
const SILENT_ENDING_EXCEPTIONS = new Set([
  "absent",
  "accent",
  "accident",
  "adolescent",
  "agent",
  "aliment",
  "appartient",
  "appartement",
  "argent",
  "autant",
  "avant",
  "batiment",
  "bus",
  "cactus",
  "cement",
  "cent",
  "client",
  "comment",
  "competent",
  "complement",
  "confident",
  "conscient",
  "content",
  "continent",
  "contient",
  "convient",
  "courant",
  "dent",
  "devient",
  "different",
  "document",
  "element",
  "eminent",
  "enfant",
  "enseignant",
  "entretient",
  "equipement",
  "est",
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
  "huit",
  "ignorant",
  "important",
  "incident",
  "independant",
  "indulgent",
  "innocent",
  "instrument",
  "intelligent",
  "intervient",
  "lent",
  "logement",
  "maintient",
  "mais",
  "mars",
  "mes",
  "met",
  "moment",
  "monument",
  "mouvement",
  "nord",
  "obtient",
  "orient",
  "ornement",
  "ouest",
  "ours",
  "parent",
  "parlement",
  "parvient",
  "patient",
  "permanent",
  "placement",
  "plus",
  "precedent",
  "present",
  "president",
  "pres",
  "prudent",
  "provient",
  "puissant",
  "recent",
  "regiment",
  "restaurant",
  "retient",
  "revient",
  "savant",
  "segment",
  "sentiment",
  "sergent",
  "serpent",
  "soixante",
  "souvent",
  "soutient",
  "sud",
  "supplement",
  "survient",
  "talent",
  "tas",
  "temps",
  "tient",
  "torrent",
  "tous",
  "transparent",
  "tres",
  "urgent",
  "vent",
  "vient",
  "violent",
  "virus",
  "vivant"
]);

const PEDAGOGICAL_VOWEL_GRAPHEMES = [
  "eaux",
  "eau",
  "oeu",
  "euil",
  "ueil",
  "eille",
  "aille",
  "oin",
  "ain",
  "ein",
  "ion",
  "ien",
  "ieu",
  "oin",
  "oui",
  "ui",
  "oi",
  "ou",
  "au",
  "eu",
  "ai",
  "ei",
  "ay",
  "on",
  "an",
  "en",
  "in",
  "un",
  "om",
  "am",
  "em",
  "im",
  "um"
].sort((left, right) => right.length - left.length);

const CONSONANT_GRAPHEMES = ["ch", "ph", "th", "gn", "qu"];
const LR_ONSET_CLUSTERS = new Set([
  "bl",
  "br",
  "cl",
  "cr",
  "dr",
  "fl",
  "fr",
  "gl",
  "gr",
  "pl",
  "pr",
  "tr",
  "vr"
]);
const THREE_CONSONANT_ONSETS = new Set(["scr", "spl", "spr", "str"]);
const APOSTROPHE_PREFIXES = new Set([
  "c",
  "d",
  "j",
  "jusqu",
  "l",
  "lorsqu",
  "m",
  "n",
  "puisqu",
  "qu",
  "quoiqu",
  "s",
  "t"
]);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeLetters(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replaceAll("œ", "oe")
    .replaceAll("æ", "ae")
    .replace(/[\u0300-\u036f]/gu, "");
}

function countLetters(value) {
  return [...String(value || "")].filter((character) => LETTER_REGEX.test(character)).length;
}

function isVowelText(value) {
  return VOWEL_LETTER_REGEX.test(value);
}

function hasExplicitDiaeresis(text) {
  return DIAERESIS_REGEX.test(text);
}

function getCanonicalMode(value) {
  if (value === "typographique" || value === "modeTypographique") {
    return "typographique";
  }
  return "pedagogique";
}

function getExceptionMaps(mode) {
  if (mode === "typographique") {
    return {
      exact: TYPOGRAPHIC_EXACT_SYLLABLE_EXCEPTIONS,
      normalized: TYPOGRAPHIC_NORMALIZED_SYLLABLE_EXCEPTIONS
    };
  }

  return {
    exact: PEDAGOGICAL_EXACT_SYLLABLE_EXCEPTIONS,
    normalized: PEDAGOGICAL_NORMALIZED_SYLLABLE_EXCEPTIONS
  };
}

function getExceptionSyllables(word, mode) {
  const source = String(word || "").normalize("NFC");
  const maps = getExceptionMaps(mode);
  const exact = maps.exact.get(source.toLowerCase());
  const normalized = exact || maps.normalized.get(normalizeLetters(source));
  if (!normalized) {
    return null;
  }

  const letters = [...source];
  let cursor = 0;
  const mapped = [];

  for (const segment of normalized) {
    const length = [...segment].length;
    const slice = letters.slice(cursor, cursor + length).join("");
    if (!slice) {
      return null;
    }
    mapped.push(slice);
    cursor += length;
  }

  return cursor === letters.length ? mapped : null;
}

function splitSilentEnding(word) {
  const source = String(word || "");
  const normalized = normalizeLetters(source);
  if (!source || normalized.length <= 2 || SILENT_ENDING_EXCEPTIONS.has(normalized)) {
    return { core: source, silentEnding: "" };
  }

  for (const pattern of SILENT_ENDING_PATTERNS) {
    if (!normalized.endsWith(pattern)) {
      continue;
    }
    if (pattern === "ent" && normalized.endsWith("ment")) {
      continue;
    }
    if (["s", "x", "t", "d"].includes(pattern) && normalized.length <= 3) {
      continue;
    }

    const letters = [...source];
    const silentLength = [...pattern].length;
    const coreLetters = letters.slice(0, letters.length - silentLength);
    if (coreLetters.length < 2) {
      continue;
    }

    return {
      core: coreLetters.join(""),
      silentEnding: letters.slice(letters.length - silentLength).join("")
    };
  }

  return { core: source, silentEnding: "" };
}

function buildUnits(word) {
  const letters = [...String(word || "")];
  const normalizedLetters = letters.map((letter) => normalizeLetters(letter));
  const units = [];
  let index = 0;

  while (index < letters.length) {
    let matched = null;

    for (const grapheme of PEDAGOGICAL_VOWEL_GRAPHEMES) {
      const length = [...grapheme].length;
      const sliceNormalized = normalizedLetters.slice(index, index + length).join("");
      const sliceText = letters.slice(index, index + length).join("");

      if (sliceNormalized === grapheme && !hasExplicitDiaeresis(sliceText)) {
        matched = {
          text: sliceText,
          normalized: grapheme,
          kind: "vowel"
        };
        index += length;
        break;
      }
    }

    if (matched) {
      units.push(matched);
      continue;
    }

    for (const grapheme of CONSONANT_GRAPHEMES) {
      const length = [...grapheme].length;
      const sliceNormalized = normalizedLetters.slice(index, index + length).join("");
      const sliceText = letters.slice(index, index + length).join("");

      if (sliceNormalized === grapheme) {
        matched = {
          text: sliceText,
          normalized: grapheme,
          kind: "consonant"
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

  return units;
}

function getRightClusterLength(cluster) {
  if (cluster.length === 0) {
    return 0;
  }

  if (cluster.length === 1) {
    return 1;
  }

  const normalizedCluster = cluster.map((unit) => unit.normalized);
  if (cluster.length === 2) {
    if (normalizedCluster[0] === normalizedCluster[1]) {
      return 1;
    }

    if (LR_ONSET_CLUSTERS.has(normalizedCluster.join(""))) {
      return 2;
    }

    return 1;
  }

  for (let suffixLength = Math.min(3, cluster.length); suffixLength >= 2; suffixLength -= 1) {
    const suffix = normalizedCluster.slice(cluster.length - suffixLength).join("");
    if (suffixLength === 3 && THREE_CONSONANT_ONSETS.has(suffix)) {
      return 3;
    }
    if (suffixLength === 2 && LR_ONSET_CLUSTERS.has(suffix)) {
      return 2;
    }
  }

  return 1;
}

function stabilizePedagogicalSyllables(syllables) {
  const filtered = syllables.filter(Boolean);
  if (filtered.length <= 1) {
    return filtered;
  }

  const merged = [];
  for (const syllable of filtered) {
    if (merged.length > 0 && countLetters(syllable) === 1 && !isVowelText(syllable)) {
      merged[merged.length - 1] += syllable;
      continue;
    }
    merged.push(syllable);
  }

  if (merged.length > 1 && countLetters(merged.at(-1)) === 1) {
    merged[merged.length - 2] += merged.at(-1);
    merged.pop();
  }

  return merged;
}

function getBoundaryOffsets(syllables) {
  const offsets = [];
  let cursor = 0;
  for (const syllable of syllables) {
    cursor += [...syllable].length;
    offsets.push(cursor);
  }
  return offsets;
}

function mergeAt(syllables, index) {
  syllables[index] += syllables[index + 1];
  syllables.splice(index + 1, 1);
}

function applyTypographicConstraints(syllables, word) {
  const result = [...syllables];
  const letters = [...String(word || "")];

  let changed = true;
  while (changed) {
    changed = false;

    if (result.length <= 1) {
      return result;
    }

    if (countLetters(result[0]) < 2) {
      mergeAt(result, 0);
      changed = true;
      continue;
    }

    if (countLetters(result.at(-1)) < 2) {
      result[result.length - 2] += result.at(-1);
      result.pop();
      changed = true;
      continue;
    }

    for (let index = 1; index < result.length - 1; index += 1) {
      if (countLetters(result[index]) < 2) {
        mergeAt(result, index - 1);
        changed = true;
        break;
      }
    }

    if (changed) {
      continue;
    }

    const boundaries = getBoundaryOffsets(result);
    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const boundary = boundaries[index];
      const previous = letters[boundary - 1] || "";
      const next = letters[boundary] || "";
      const previousPrevious = letters[boundary - 2] || "";
      const nextNext = letters[boundary + 1] || "";
      const previousNormalized = normalizeLetters(previous);
      const nextNormalized = normalizeLetters(next);

      if (APOSTROPHE_REGEX.test(previous) || APOSTROPHE_REGEX.test(next) || previous === "-" || next === "-") {
        mergeAt(result, index);
        changed = true;
        break;
      }

      if (
        (previousNormalized === "x" || previousNormalized === "y") &&
        isVowelText(previousPrevious) &&
        isVowelText(next)
      ) {
        mergeAt(result, index);
        changed = true;
        break;
      }

      if (
        (nextNormalized === "x" || nextNormalized === "y") &&
        isVowelText(previous) &&
        isVowelText(nextNext)
      ) {
        mergeAt(result, index);
        changed = true;
        break;
      }
    }
  }

  return result;
}

function segmentCoreWord(word, mode) {
  const exceptionSyllables = getExceptionSyllables(word, mode);
  if (exceptionSyllables) {
    return exceptionSyllables;
  }

  if (!word || countLetters(word) <= 1) {
    return word ? [word] : [];
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
      const rightClusterLength = getRightClusterLength(cluster);
      nextSyllableStart = rightVowelIndex - rightClusterLength;
    }

    syllables.push(units.slice(syllableStart, nextSyllableStart).map((unit) => unit.text).join(""));
    syllableStart = nextSyllableStart;
  }

  syllables.push(units.slice(syllableStart).map((unit) => unit.text).join(""));

  if (mode === "typographique") {
    return applyTypographicConstraints(stabilizePedagogicalSyllables(syllables), word);
  }

  return stabilizePedagogicalSyllables(syllables);
}

function getVisibleSyllables(analysis) {
  const syllables = [...analysis.syllables];
  if (analysis.silentEnding && syllables.length > 0) {
    syllables[syllables.length - 1] += analysis.silentEnding;
  }
  return syllables;
}

function joinSyllables(syllables, { separator = "-", separatorMode = "text", separatorClass = "syllable-separator" } = {}) {
  if (separator === null || separator === "array") {
    return [...syllables];
  }

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

function syllabifyApostropheWord(word, options) {
  const source = String(word || "");
  const mode = getCanonicalMode(options.mode);
  const wholeException = getExceptionSyllables(source, mode);
  if (wholeException) {
    return joinSyllables(wholeException, options);
  }

  if (!source.includes("'") && !source.includes("’")) {
    const analysis = analyzeFrenchWord(source, { mode });
    return joinSyllables(getVisibleSyllables(analysis), options);
  }

  const parts = source.split(/(['\u2019])/u);
  return parts
    .map((part, index) => {
      if (!part || APOSTROPHE_REGEX.test(part) || !LETTER_REGEX.test(part)) {
        return part;
      }

      const nextPart = parts[index + 1];
      if (APOSTROPHE_REGEX.test(nextPart || "") && APOSTROPHE_PREFIXES.has(normalizeLetters(part))) {
        return part;
      }

      const analysis = analyzeFrenchWord(part, { mode });
      return joinSyllables(getVisibleSyllables(analysis), options);
    })
    .join("");
}

/**
 * Tokenise un texte en conservant espaces, ponctuation, apostrophes et traits d’union.
 * @param {string} text
 * @returns {{ value: string, type: string, start: number, end: number }[]}
 */
export function tokenize(text) {
  const source = String(text || "");
  const tokens = [];

  for (const match of source.matchAll(WORD_TOKEN_REGEX)) {
    const value = match[0];
    const type = /^\s+$/u.test(value)
      ? "space"
      : LETTER_REGEX.test(value)
        ? "word"
        : /^\d+$/u.test(value)
          ? "number"
          : "punct";
    tokens.push({
      value,
      type,
      start: match.index,
      end: match.index + value.length
    });
  }

  return tokens;
}

/**
 * Normalise le niveau d’affichage syllabique utilisé par l’application.
 * @param {string} value
 * @returns {"off"|"light"|"strong"}
 */
export function normalizeSyllableLevel(value) {
  return SYLLABLE_LEVELS.has(value) ? value : "off";
}

/**
 * Normalise l'étendue d'affichage syllabique.
 * @param {string} value
 * @returns {"auto"|"all"}
 */
export function normalizeSyllableWordScope(value) {
  return SYLLABLE_WORD_SCOPES.has(value) ? value : "auto";
}

/**
 * Normalise le mode de syllabation.
 * @param {string} value
 * @returns {"pedagogique"|"typographique"}
 */
export function normalizeSyllabificationMode(value) {
  return getCanonicalMode(value);
}

/**
 * Analyse un mot français et retourne une structure exploitable par le rendu.
 * @param {string} word
 * @param {{ mode?: string }} [options]
 * @returns {{ original: string, core: string, silentEnding: string, syllables: string[], syllableCount: number, mode: string }}
 */
export function analyzeFrenchWord(word, options = {}) {
  const source = String(word || "");
  const mode = getCanonicalMode(options.mode);
  const lettersOnly = countLetters(source);

  if (!source || lettersOnly === 0) {
    return {
      original: source,
      core: source,
      silentEnding: "",
      syllables: source ? [source] : [],
      syllableCount: source ? 1 : 0,
      mode
    };
  }

  const exceptionSyllables = getExceptionSyllables(source, mode);
  if (exceptionSyllables) {
    return {
      original: source,
      core: source,
      silentEnding: "",
      syllables: exceptionSyllables,
      syllableCount: exceptionSyllables.length,
      mode
    };
  }

  const { core, silentEnding } = splitSilentEnding(source);
  const syllables = segmentCoreWord(core, mode);

  return {
    original: source,
    core,
    silentEnding,
    syllables,
    syllableCount: syllables.length,
    mode
  };
}

/**
 * Détermine si un mot doit afficher ses syllabes dans l’interface.
 * @param {string|ReturnType<typeof analyzeFrenchWord>} word
 * @param {{ level?: string, lightMinLength?: number, lightMinSyllables?: number, wordScope?: string, forceAllWords?: boolean }} [options]
 * @returns {boolean}
 */
export function shouldDisplaySyllables(
  word,
  { level = "off", lightMinLength = 8, lightMinSyllables = 3, wordScope = "auto", forceAllWords = false } = {}
) {
  const normalizedLevel = normalizeSyllableLevel(level);
  if (normalizedLevel === "off") {
    return false;
  }

  const analysis = typeof word === "string" ? analyzeFrenchWord(word) : word;
  if (!analysis || analysis.syllableCount <= 1) {
    return false;
  }

  const normalizedScope = normalizeSyllableWordScope(forceAllWords ? "all" : wordScope);
  if (normalizedScope === "all") {
    return true;
  }

  const letterCount = countLetters(analysis.original);
  if (normalizedLevel === "light") {
    return analysis.syllableCount >= lightMinSyllables || letterCount >= lightMinLength;
  }

  return analysis.syllableCount >= 2 && letterCount >= 4;
}

/**
 * Syllabifie un token individuel sans perdre sa ponctuation.
 * @param {{ value: string, type?: string }|string} token
 * @param {{ mode?: string, separator?: string|null, separatorMode?: string, separatorClass?: string }} [options]
 * @returns {string|string[]}
 */
export function syllabifyToken(token, options = {}) {
  const value = typeof token === "string" ? token : token?.value;
  const type = typeof token === "string" ? (LETTER_REGEX.test(token) ? "word" : "punct") : token?.type;

  if (!value || type !== "word") {
    return String(value || "");
  }

  if (String(value).includes("-")) {
    return String(value)
      .split(/(-)/u)
      .map((segment) => (segment === "-" ? segment : syllabifyApostropheWord(segment, options)))
      .join("");
  }

  return syllabifyApostropheWord(value, options);
}

/**
 * Syllabifie un mot ou un groupe lexical.
 * @param {string} word
 * @param {{ mode?: string, separator?: string|null, separatorMode?: string, separatorClass?: string }} [options]
 * @returns {string|string[]}
 */
export function syllabifyWord(word, options = {}) {
  return syllabifyToken({ value: String(word || ""), type: "word" }, options);
}

/**
 * Syllabifie un texte complet en conservant la casse, la ponctuation et les espaces.
 * @param {string} text
 * @param {{ mode?: string, separator?: string|null, separatorMode?: string, separatorClass?: string }} [options]
 * @returns {string}
 */
export function syllabifyText(text, options = {}) {
  return tokenize(text)
    .map((token) => (token.type === "word" ? syllabifyToken(token, options) : token.value))
    .join("");
}

/**
 * Interface historique utilisée par le reste de l’application pour syllabifier un mot.
 * @param {string} word
 * @param {{ level?: string, separator?: string, separatorMode?: string, separatorClass?: string }} [options]
 * @returns {string}
 */
export function syllabifyFrenchWord(
  word,
  { level = "strong", separator = "-", separatorMode = "text", separatorClass = "syllable-separator" } = {}
) {
  const analysis = analyzeFrenchWord(word, { mode: "pedagogique" });
  if (!shouldDisplaySyllables(analysis, { level })) {
    return String(word || "");
  }

  return /** @type {string} */ (
    joinSyllables(getVisibleSyllables(analysis), {
      separator,
      separatorMode,
      separatorClass
    })
  );
}

/**
 * Interface historique utilisée par le reste de l’application pour syllabifier un texte.
 * @param {string} text
 * @param {{ level?: string, separator?: string, separatorMode?: string, separatorClass?: string }} [options]
 * @returns {string}
 */
export function syllabifyFrenchText(
  text,
  { level = "strong", separator = "-", separatorMode = "text", separatorClass = "syllable-separator" } = {}
) {
  if (normalizeSyllableLevel(level) === "off") {
    return String(text || "");
  }

  return syllabifyText(text, {
    mode: "pedagogique",
    separator,
    separatorMode,
    separatorClass
  });
}

/**
 * Syllabifie uniquement les nœuds texte d’un fragment HTML.
 * @param {string} html
 * @param {{ level?: string, separator?: string, separatorMode?: string, separatorClass?: string }} [options]
 * @returns {string}
 */
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
        : syllabifyFrenchText(segment, {
            level,
            separator,
            separatorMode,
            separatorClass
          })
    )
    .join("");
}
