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

const SCHOOL_LEVELS = new Set(["college", "lycee"]);

const INSTRUCTION_VERB_ROOTS = [
  "analyse",
  "calcule",
  "classe",
  "compare",
  "complete",
  "conclus",
  "deduis",
  "decris",
  "demontre",
  "determine",
  "developpe",
  "donne",
  "entoure",
  "explique",
  "exprime",
  "identifie",
  "indique",
  "justifie",
  "lis",
  "montre",
  "nomme",
  "observe",
  "precise",
  "range",
  "redige",
  "reformule",
  "relie",
  "releve",
  "repere",
  "represente",
  "repond",
  "resous",
  "resume",
  "souligne",
  "trace",
  "trouve",
  "verifie"
];

const TASK_CONNECTOR_PATTERN = /\b(?:puis|ensuite|apres|après|enfin|et)\b/iu;
const EXERCISE_MARKER_PATTERN = /\b(?:exercice|question|consigne|probleme|problème|travail|consignes)\b/iu;

/**
 * Supprime les accents et homogénéise un texte pour les comparaisons souples.
 *
 * @param {string} value
 * @returns {string}
 */
function normalizeLooseText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "");
}

/**
 * Vérifie si un segment contient un verbe de consigne courant.
 *
 * @param {string} value
 * @returns {boolean}
 */
function containsInstructionVerb(value) {
  const normalized = normalizeLooseText(value);
  return INSTRUCTION_VERB_ROOTS.some((root) => new RegExp(`\\b${root}\\w*\\b`, "u").test(normalized));
}

/**
 * Nettoie un segment de consigne sans changer son sens.
 *
 * @param {string} value
 * @returns {string}
 */
function cleanInstructionChunk(value) {
  return String(value || "")
    .replace(/^[\s•·\-–—\d]+[.)\]-]?\s*/u, "")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/^[,:;]+/u, "")
    .trim();
}

/**
 * Découpe localement une consigne en sous-tâches lisibles.
 *
 * @param {string} text
 * @returns {string[]}
 */
function splitInstructionTasks(text) {
  const source = String(text || "")
    .replace(/\r\n?/gu, "\n")
    .replace(/[•▪●]/gu, "-")
    .replace(/\u00a0/gu, " ")
    .trim();

  if (!source) {
    return [];
  }

  const enumerated = source
    .replace(/(?:^|\n)\s*(\d+|[a-z])[\).]\s+/giu, "\n")
    .replace(/\s*;\s*/gu, "\n")
    .replace(/\s+(?=-\s+)/gu, "\n")
    .replace(/\s+(?=(?:\d+|[a-z])[\).]\s+)/giu, "\n");

  const coarseChunks = enumerated
    .split(/\n+/u)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const fineChunks = coarseChunks.flatMap((chunk) => {
    const sentences = chunk.split(/(?<=[.!?])\s+/u).filter(Boolean);
    return sentences.flatMap((sentence) => {
      const parts = sentence.split(
        /\b(?:puis|ensuite|apres|après|enfin|et)\b(?=\s+(?:[A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜŸa-zàâäéèêëîïôöùûüÿ]))/iu
      );
      return parts.map((part) => cleanInstructionChunk(part)).filter(Boolean);
    });
  });

  const filtered = fineChunks.filter((chunk, index, array) => {
    if (!chunk) {
      return false;
    }

    const normalized = normalizeLooseText(chunk);
    return (
      containsInstructionVerb(chunk) ||
      chunk.includes("?") ||
      EXERCISE_MARKER_PATTERN.test(normalized) ||
      array.length === 1
    );
  });

  return [...new Set(filtered)].slice(0, 6);
}

/**
 * Adapte une phrase au niveau scolaire demandé sans en changer le fond.
 *
 * @param {string} sentence
 * @param {"college"|"lycee"} level
 * @returns {string}
 */
function simplifySentenceForLevel(sentence, level) {
  const safeLevel = normalizeSchoolLevel(level);
  let output = simplifySentence(sentence);

  if (safeLevel === "college") {
    output = output
      .replace(/\bidentifier\b/giu, "repérer")
      .replace(/\bjustifier\b/giu, "expliquer")
      .replace(/\bdémontrer\b/giu, "montrer")
      .replace(/\banalyser\b/giu, "observer");
  }

  return truncateSentence(output, safeLevel === "college" ? 170 : 210);
}

/**
 * Normalise le niveau scolaire attendu pour les aides de lecture.
 *
 * @param {string} value
 * @returns {"college"|"lycee"}
 */
export function normalizeSchoolLevel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return SCHOOL_LEVELS.has(normalized) ? normalized : "college";
}

/**
 * Retourne un libellé lisible pour le niveau scolaire courant.
 *
 * @param {string} value
 * @returns {"collège"|"lycée"}
 */
export function getSchoolLevelLabel(value) {
  return normalizeSchoolLevel(value) === "lycee" ? "lycée" : "collège";
}

/**
 * Repère si un texte ressemble à une consigne, une question ou un exercice
 * et, si possible, découpe les tâches implicites ou explicites.
 *
 * @param {string} text
 * @returns {{
 *   kind: "text"|"question"|"instruction",
 *   isQuestion: boolean,
 *   isInstruction: boolean,
 *   isExercise: boolean,
 *   multiTask: boolean,
 *   taskCount: number,
 *   tasks: string[],
 *   label: string
 * }}
 */
export function detectInstructionStructure(text) {
  const source = String(text || "").replace(/\s+/gu, " ").trim();
  if (!source) {
    return {
      kind: "text",
      isQuestion: false,
      isInstruction: false,
      isExercise: false,
      multiTask: false,
      taskCount: 0,
      tasks: [],
      label: "Aucun passage sélectionné"
    };
  }

  const normalized = normalizeLooseText(source);
  const tasks = splitInstructionTasks(source);
  const taskCount = tasks.length;
  const isQuestion = source.includes("?") || /\b(?:pourquoi|comment|quel|quelle|quels|quelles|que)\b/iu.test(source);
  const isExercise = EXERCISE_MARKER_PATTERN.test(normalized) || /^\d+[\).]/u.test(source);
  const isInstruction = containsInstructionVerb(source) || isExercise || (isQuestion && taskCount > 0);
  const multiTask = taskCount > 1 || (isInstruction && TASK_CONNECTOR_PATTERN.test(normalized));

  let label = "Paragraphe explicatif";
  let kind = "text";

  if (isInstruction && multiTask) {
    label = `Consigne à ${Math.max(2, taskCount)} tâches`;
    kind = "instruction";
  } else if (isInstruction) {
    label = isQuestion ? "Question / consigne" : "Consigne simple";
    kind = isQuestion ? "question" : "instruction";
  } else if (isQuestion) {
    label = "Question";
    kind = "question";
  }

  return {
    kind,
    isQuestion,
    isInstruction,
    isExercise,
    multiTask,
    taskCount,
    tasks,
    label
  };
}

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
 * Produit un résumé scolaire local, plus accessible au collège et un peu plus
 * synthétique au lycée.
 *
 * @param {string} text
 * @param {{ level?: string }} [options]
 * @returns {string}
 */
export function buildSchoolSummary(text, options = {}) {
  const level = normalizeSchoolLevel(options.level);
  const summary = buildShortSummary(text);
  if (!summary) {
    return "";
  }

  if (level === "lycee") {
    return summary;
  }

  return splitSentences(summary)
    .map((sentence) => simplifySentenceForLevel(sentence, level))
    .join(" ")
    .trim();
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

/**
 * Produit une reformulation scolaire adaptée au niveau collège ou lycée.
 *
 * @param {string} text
 * @param {{ level?: string }} [options]
 * @returns {string}
 */
export function buildSchoolReformulation(text, options = {}) {
  const level = normalizeSchoolLevel(options.level);
  const sentences = splitSentences(text);
  if (sentences.length === 0) {
    return "";
  }

  return sentences
    .slice(0, level === "college" ? 3 : 4)
    .map((sentence) => simplifySentenceForLevel(sentence, level))
    .join(" ")
    .trim();
}

/**
 * Reformule une consigne et la découpe en étapes courtes quand plusieurs
 * actions sont repérées dans le texte.
 *
 * @param {string} text
 * @param {{ level?: string, analysis?: ReturnType<typeof detectInstructionStructure> }} [options]
 * @returns {string}
 */
export function buildInstructionBreakdown(text, options = {}) {
  const level = normalizeSchoolLevel(options.level);
  const analysis = options.analysis || detectInstructionStructure(text);

  if (!analysis.isInstruction && !analysis.isQuestion) {
    return "Ce passage ressemble plutôt à une explication qu'à une consigne. Utilise plutôt le résumé ou la reformulation.";
  }

  const tasks = analysis.tasks.length > 0 ? analysis.tasks : splitSentences(text).slice(0, 2);
  const simplifiedTasks = tasks
    .map((task) => simplifySentenceForLevel(task, level))
    .filter(Boolean);

  if (simplifiedTasks.length === 0) {
    return "";
  }

  const header = analysis.multiTask
    ? `Consigne repérée : ${simplifiedTasks.length} étapes.`
    : analysis.kind === "question"
      ? "Question reformulée :"
      : "Consigne reformulée :";

  return [header, ...simplifiedTasks.map((task, index) => `${index + 1}. ${task}`)].join("\n");
}
