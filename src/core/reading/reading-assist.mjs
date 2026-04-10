import {
  analyzeFrenchWord,
  normalizeSyllabificationMode,
  normalizeSyllableLevel,
  normalizeSyllableWordScope,
  shouldDisplaySyllables
} from "./syllabify-french.mjs";
import { lookupLocalDictionaryEntry } from "../lexicon/local-dictionary.mjs";

const COMMON_REPLACEMENTS = [
  [/\bcependant\b/giu, "mais"],
  [/\bnéanmoins\b/giu, "mais"],
  [/\btoutefois\b/giu, "mais"],
  [/\bafin de\b/giu, "pour"],
  [/\bau cours de\b/giu, "pendant"],
  [/\best constitué de\b/giu, "contient"],
  [/\bse caractérise par\b/giu, "se reconnaît par"],
  [/\bpermet de\b/giu, "sert à"],
  [/\best nécessaire pour\b/giu, "aide à"],
  [/\best utilisé pour\b/giu, "sert à"],
  [/\bcorrespond à\b/giu, "vaut"],
  [/\bde manière à\b/giu, "pour"],
  [/\bnotamment\b/giu, "surtout"],
  [/\ben effet\b/giu, "car"],
  [/\bpar conséquent\b/giu, "donc"]
];

const STOPWORDS = new Set([
  "a",
  "afin",
  "alors",
  "au",
  "aucun",
  "aussi",
  "autre",
  "avec",
  "car",
  "ce",
  "cela",
  "ces",
  "cet",
  "cette",
  "dans",
  "de",
  "des",
  "du",
  "elle",
  "elles",
  "en",
  "et",
  "est",
  "il",
  "ils",
  "je",
  "la",
  "le",
  "les",
  "leur",
  "leurs",
  "mais",
  "ne",
  "nous",
  "on",
  "ou",
  "par",
  "pas",
  "pour",
  "que",
  "qui",
  "se",
  "ses",
  "son",
  "sur",
  "tu",
  "un",
  "une",
  "vers",
  "vos",
  "votre",
  "vous"
]);

/**
 * Normalise une clé de mot pour les comparaisons locales.
 *
 * @param {string} value
 * @returns {string}
 */
function normalizeWordKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "");
}

/**
 * Nettoie un mot avant recherche ou affichage dans le panneau vocabulaire.
 *
 * @param {string} value
 * @returns {string}
 */
export function sanitizeLookupWord(value) {
  return String(value || "")
    .trim()
    .replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, "")
    .replace(/[’]/gu, "'");
}

/**
 * Tronque une phrase longue sans couper brutalement le dernier mot.
 *
 * @param {string} value
 * @param {number} [maxLength=170]
 * @returns {string}
 */
function truncateSentence(value, maxLength = 170) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) {
    return text;
  }

  const clipped = text.slice(0, maxLength).replace(/\s+\S*$/u, "").trim();
  return clipped ? `${clipped}…` : `${text.slice(0, maxLength).trim()}…`;
}

/**
 * Construit une définition locale rapide à partir du dictionnaire local
 * puis, si besoin, d'une heuristique simple.
 *
 * @param {string} word
 * @returns {{ definition: string, source: string, lemma?: string }}
 */
function getHeuristicDefinition(word) {
  const normalized = normalizeWordKey(word);
  const localDictionaryEntry = lookupLocalDictionaryEntry(word);
  if (localDictionaryEntry) {
    return {
      definition: localDictionaryEntry.definition,
      source: "dictionnaire-local",
      lemma: localDictionaryEntry.lemma,
      category: localDictionaryEntry.category
    };
  }

  if (normalized.endsWith("tion") || normalized.endsWith("sion")) {
    return {
      definition: "Ce mot désigne souvent une action, un processus ou le résultat d’une action.",
      source: "heuristique",
      category: null
    };
  }

  if (normalized.endsWith("ment")) {
    return {
      definition: "Ce mot renvoie souvent à une manière d’agir, à un état ou à un résultat.",
      source: "heuristique",
      category: null
    };
  }

  if (normalized.endsWith("teur") || normalized.endsWith("trice") || normalized.endsWith("euse")) {
    return {
      definition: "Ce mot désigne souvent une personne, un rôle ou un outil lié à une action.",
      source: "heuristique",
      category: null
    };
  }

  if (normalized.endsWith("ique")) {
    return {
      definition: "Ce mot décrit souvent une propriété, une discipline ou quelque chose en lien avec une science.",
      source: "heuristique",
      category: "science"
    };
  }

  if (normalized.endsWith("able") || normalized.endsWith("ible")) {
    return {
      definition: "Ce mot décrit souvent quelque chose que l’on peut faire, utiliser ou observer.",
      source: "heuristique",
      category: null
    };
  }

  return {
    definition: "Définition courte non disponible hors ligne pour ce mot. La prononciation et la découpe syllabique restent disponibles.",
    source: "fallback",
    category: null
  };
}

/**
 * Prépare l’affichage syllabique d’un mot selon les réglages actifs.
 *
 * @param {string} word
 * @param {{ mode?: string, level?: string, wordScope?: string }} [options]
 * @returns {{
 *   analysis: ReturnType<typeof analyzeFrenchWord>,
 *   syllables: string[],
 *   display: string,
 *   visible: boolean,
 *   syllabificationMode: string,
 *   syllableLevel: string,
 *   syllableWordScope: string
 * }}
 */
function getSyllableDisplay(word, options = {}) {
  const syllabificationMode = normalizeSyllabificationMode(options.mode);
  const syllableLevel = normalizeSyllableLevel(options.level);
  const syllableWordScope = normalizeSyllableWordScope(options.wordScope);
  const analysis = analyzeFrenchWord(word, { mode: syllabificationMode });
  const syllables = [...analysis.syllables];
  if (analysis.silentEnding && syllables.length > 0) {
    syllables[syllables.length - 1] += analysis.silentEnding;
  }

  const visible = shouldDisplaySyllables(analysis, {
    level: syllableLevel,
    wordScope: syllableWordScope
  });

  return {
    analysis,
    syllables,
    display: visible ? syllables.join(" • ") : "",
    visible,
    syllabificationMode,
    syllableLevel,
    syllableWordScope
  };
}

/**
 * Extrait la première définition exploitable de l’API dictionnaire externe.
 *
 * @param {unknown} payload
 * @returns {string[]}
 */
function extractDefinitionsFromDictionaryApi(payload) {
  if (!Array.isArray(payload)) {
    return [];
  }

  const results = [];
  for (const entry of payload) {
    for (const meaning of entry?.meanings || []) {
      for (const definition of meaning?.definitions || []) {
        const cleanDefinition = truncateSentence(definition?.definition || "", 180);
        if (cleanDefinition) {
          results.push(cleanDefinition);
        }
      }
    }
  }

  return [...new Set(results)];
}

/**
 * Tente de récupérer une définition distante si le réseau est autorisé.
 *
 * @param {string} word
 * @param {{ fetchImpl?: typeof globalThis.fetch }} [options]
 * @returns {Promise<string | null>}
 */
async function fetchRemoteDefinition(word, { fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== "function" || String(word || "").length < 3) {
    return null;
  }

  try {
    const response = await fetchImpl(`https://api.dictionaryapi.dev/api/v2/entries/fr/${encodeURIComponent(word)}`);
    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const definitions = extractDefinitionsFromDictionaryApi(payload);
    return definitions[0] || null;
  } catch {
    return null;
  }
}

/**
 * Retourne l’aide complète sur un mot : syllabes + définition locale ou distante.
 *
 * @param {string} word
 * @param {{ allowRemote?: boolean, mode?: string, level?: string, wordScope?: string, fetchImpl?: typeof globalThis.fetch }} [options]
 * @returns {Promise<{
 *   word: string,
 *   normalizedWord: string,
 *   lemma: string,
 *   syllableCount: number,
 *   syllables: string[],
 *   syllableDisplay: string,
 *   syllablesVisible: boolean,
 *   syllabificationMode: string,
 *   syllableLevel: string,
 *   syllableWordScope: string,
 *   definition: string,
 *   definitionSource: string
 * } | null>}
 */
export async function lookupWordInsight(word, options = {}) {
  const cleanWord = sanitizeLookupWord(word);
  if (!cleanWord) {
    return null;
  }

  const syllableInfo = getSyllableDisplay(cleanWord, options);
  const fallback = getHeuristicDefinition(cleanWord);
  const shouldTryRemote = options.allowRemote !== false && fallback.source !== "dictionnaire-local";
  const remoteDefinition = shouldTryRemote ? await fetchRemoteDefinition(cleanWord, options) : null;

  return {
    word: cleanWord,
    normalizedWord: normalizeWordKey(cleanWord),
    lemma: fallback.lemma || cleanWord,
    category: fallback.category || null,
    syllableCount: syllableInfo.analysis.syllableCount,
    syllables: syllableInfo.syllables,
    syllableDisplay: syllableInfo.display,
    syllablesVisible: syllableInfo.visible,
    syllabificationMode: syllableInfo.syllabificationMode,
    syllableLevel: syllableInfo.syllableLevel,
    syllableWordScope: syllableInfo.syllableWordScope,
    definition: remoteDefinition || fallback.definition,
    definitionSource: remoteDefinition ? "dictionnaire" : fallback.source
  };
}

/**
 * Retourne l’aide locale immédiate sans dépendre du réseau.
 *
 * @param {string} word
 * @param {{ mode?: string, level?: string, wordScope?: string }} [options]
 * @returns {{
 *   word: string,
 *   normalizedWord: string,
 *   lemma: string,
 *   syllableCount: number,
 *   syllables: string[],
 *   syllableDisplay: string,
 *   syllablesVisible: boolean,
 *   syllabificationMode: string,
 *   syllableLevel: string,
 *   syllableWordScope: string,
 *   definition: string,
 *   definitionSource: string
 * } | null}
 */
export function buildLocalWordInsight(word, options = {}) {
  const cleanWord = sanitizeLookupWord(word);
  if (!cleanWord) {
    return null;
  }

  const syllableInfo = getSyllableDisplay(cleanWord, options);
  const fallback = getHeuristicDefinition(cleanWord);

  return {
    word: cleanWord,
    normalizedWord: normalizeWordKey(cleanWord),
    lemma: fallback.lemma || cleanWord,
    category: fallback.category || null,
    syllableCount: syllableInfo.analysis.syllableCount,
    syllables: syllableInfo.syllables,
    syllableDisplay: syllableInfo.display,
    syllablesVisible: syllableInfo.visible,
    syllabificationMode: syllableInfo.syllabificationMode,
    syllableLevel: syllableInfo.syllableLevel,
    syllableWordScope: syllableInfo.syllableWordScope,
    definition: fallback.definition,
    definitionSource: fallback.source
  };
}

/**
 * Découpe un texte en phrases simples.
 *
 * @param {string} text
 * @returns {string[]}
 */
function splitSentences(text) {
  return String(text || "")
    .replace(/\s+/gu, " ")
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/**
 * Simplifie une phrase en remplaçant certains tournures par des variantes plus directes.
 *
 * @param {string} text
 * @returns {string}
 */
function simplifySentence(text) {
  let output = String(text || "").trim();
  for (const [pattern, replacement] of COMMON_REPLACEMENTS) {
    output = output.replace(pattern, replacement);
  }

  output = output
    .replace(/\s*;\s*/gu, ". ")
    .replace(/\s*:\s*/gu, " : ")
    .replace(/\s+/gu, " ")
    .trim();

  return truncateSentence(output, 220);
}

/**
 * Donne un score simple à une phrase pour produire un résumé court.
 *
 * @param {string} sentence
 * @returns {number}
 */
function scoreSentence(sentence) {
  const words = String(sentence || "").match(/\b[\p{L}'’-]{3,}\b/gu) || [];
  const meaningfulCount = words.filter((word) => !STOPWORDS.has(normalizeWordKey(word))).length;
  const lengthBonus = Math.min(8, Math.round(sentence.length / 28));
  return meaningfulCount + lengthBonus;
}

/**
 * Produit un résumé court local à partir d’un paragraphe.
 *
 * @param {string} text
 * @returns {string}
 */
export function buildShortSummary(text) {
  const sentences = splitSentences(text);
  if (sentences.length === 0) {
    return "";
  }

  const ranked = sentences
    .map((sentence, index) => ({
      sentence,
      index,
      score: scoreSentence(sentence)
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 2)
    .sort((left, right) => left.index - right.index)
    .map(({ sentence }) => truncateSentence(sentence, 160));

  return ranked.join(" ");
}

/**
 * Produit une reformulation locale simple d’un paragraphe.
 *
 * @param {string} text
 * @returns {string}
 */
export function buildSimpleReformulation(text) {
  const sentences = splitSentences(text);
  if (sentences.length === 0) {
    return "";
  }

  const selectedSentences = sentences.slice(0, 3).map((sentence) => simplifySentence(sentence));
  const reformulated = selectedSentences.join(" ");

  if (!reformulated) {
    return "";
  }

  return `En clair : ${reformulated}`;
}
