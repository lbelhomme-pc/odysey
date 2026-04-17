export const DEFAULT_LOCAL_AI_MODEL = "gemma3:4b";
export const LOCAL_AI_INSTALL_URL = "https://ollama.com/download";

const LOCAL_AI_MODES = new Set(["off", "on-demand", "prefer-local"]);
const LOCAL_AI_MODELS = new Set(["gemma3:1b", "gemma3:4b"]);
const SCHOOL_LEVELS = new Set(["college", "lycee"]);

/**
 * Normalise le mode d'IA locale pour garder un comportement stable.
 * @param {string} value
 * @returns {"off"|"on-demand"|"prefer-local"}
 */
export function normalizeLocalAiMode(value) {
  const normalized = String(value || "").trim();
  return LOCAL_AI_MODES.has(normalized) ? normalized : "off";
}

/**
 * Normalise le nom du modèle local recommandé.
 * @param {string} value
 * @returns {string}
 */
export function normalizeLocalAiModel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return DEFAULT_LOCAL_AI_MODEL;
  }

  return LOCAL_AI_MODELS.has(normalized) ? normalized : normalized;
}

/**
 * Normalise le niveau scolaire utilisé par les aides de compréhension.
 * @param {string} value
 * @returns {"college"|"lycee"}
 */
export function normalizeAiSchoolLevel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return SCHOOL_LEVELS.has(normalized) ? normalized : "college";
}

/**
 * Retourne un libellé lisible pour le niveau scolaire.
 * @param {string} value
 * @returns {"collège"|"lycée"}
 */
function getAiSchoolLevelLabel(value) {
  return normalizeAiSchoolLevel(value) === "lycee" ? "lycée" : "collège";
}

/**
 * Nettoie une sortie texte du modèle pour l'afficher dans l'interface.
 * @param {string} value
 * @param {{ maxLength?: number, preserveLineBreaks?: boolean }} [options]
 * @returns {string}
 */
export function cleanLocalAiText(value, options = {}) {
  const maxLength = Math.max(80, Number(options.maxLength || 340));
  const preserveLineBreaks = Boolean(options.preserveLineBreaks);
  const text = String(value || "")
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/^[\s>*-]+/gmu, "")
    .replace(preserveLineBreaks ? /[ \t]+/gu : /\s+/gu, " ")
    .trim()
    .replace(/^résumé\s*:\s*/iu, "")
    .replace(/^reformulation\s*:\s*/iu, "")
    .replace(/^en clair\s*:\s*/iu, "")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();

  if (!text) {
    return "";
  }

  if (text.length <= maxLength) {
    return text;
  }

  const clipped = text.slice(0, maxLength).replace(/\s+\S*$/u, "").trim();
  return clipped ? `${clipped}…` : `${text.slice(0, maxLength).trim()}…`;
}

/**
 * Construit la requête de définition simple pour un mot.
 * @param {{ word: string, syllableDisplay?: string, fallbackDefinition?: string, contextText?: string }} payload
 * @returns {{ system: string, prompt: string, maxLength: number, cacheKey: string }}
 */
export function buildLocalAiDefinitionRequest(payload) {
  const word = String(payload?.word || "").trim();
  const syllableDisplay = String(payload?.syllableDisplay || "").trim();
  const fallbackDefinition = String(payload?.fallbackDefinition || "").trim();
  const contextText = String(payload?.contextText || "").replace(/\s+/g, " ").trim();

  return {
    system:
      "Tu es un assistant de lecture local pour Odysey. Tu réponds en français très clair, très court, sans jargon, sans markdown, sans puces, sans inventer d'information.",
    prompt: [
      `Mot à expliquer : ${word}`,
      syllableDisplay ? `Découpe syllabique utile : ${syllableDisplay}` : "",
      fallbackDefinition ? `Définition locale déjà disponible : ${fallbackDefinition}` : "",
      contextText ? `Contexte de lecture : ${contextText.slice(0, 260)}` : "",
      "Donne une définition très simple, en 1 ou 2 phrases courtes maximum, pour un élève ou un adulte dys. Si c'est un nom propre, dis brièvement qui ou quoi c'est. Si tu hésites, reste prudent."
    ]
      .filter(Boolean)
      .join("\n"),
    maxLength: 220,
    cacheKey: `definition:${word.toLowerCase()}:${contextText.slice(0, 120).toLowerCase()}`
  };
}

/**
 * Construit la requête de résumé court d'un paragraphe.
 * @param {string} text
 * @returns {{ system: string, prompt: string, maxLength: number, cacheKey: string }}
 */
export function buildLocalAiSummaryRequest(text) {
  return buildLocalAiSchoolSummaryRequest(text, { level: "college" });
}

/**
 * Construit la requête de résumé adaptée au niveau collège ou lycée.
 * @param {string} text
 * @param {{ level?: string }} [options]
 * @returns {{ system: string, prompt: string, maxLength: number, cacheKey: string }}
 */
export function buildLocalAiSchoolSummaryRequest(text, options = {}) {
  const normalizedText = String(text || "").replace(/\s+/g, " ").trim();
  const level = normalizeAiSchoolLevel(options.level);
  const levelLabel = getAiSchoolLevelLabel(level);

  return {
    system:
      "Tu aides à la compréhension de lecture dans Odysey. Tu réponds en français clair, concret et fidèle, sans ajouter d'idée nouvelle.",
    prompt: [
      `Résume ce passage pour un niveau ${levelLabel}.`,
      level === "college"
        ? "Fais 2 phrases très courtes avec des mots simples."
        : "Fais 2 ou 3 phrases synthétiques avec le vocabulaire important.",
      "Garde uniquement les informations utiles pour comprendre l'idée principale.",
      "N'ajoute pas de titre, pas de liste, pas de formule d'introduction.",
      "",
      normalizedText
    ].join("\n"),
    maxLength: level === "college" ? 280 : 340,
    cacheKey: `summary:${level}:${normalizedText.slice(0, 240).toLowerCase()}`
  };
}

/**
 * Construit la requête de reformulation simple d'un paragraphe.
 * @param {string} text
 * @returns {{ system: string, prompt: string, maxLength: number, cacheKey: string }}
 */
export function buildLocalAiReformulationRequest(text) {
  return buildLocalAiSchoolReformulationRequest(text, { level: "college" });
}

/**
 * Construit la requête de reformulation adaptée au niveau collège ou lycée.
 * @param {string} text
 * @param {{ level?: string }} [options]
 * @returns {{ system: string, prompt: string, maxLength: number, cacheKey: string }}
 */
export function buildLocalAiSchoolReformulationRequest(text, options = {}) {
  const normalizedText = String(text || "").replace(/\s+/g, " ").trim();
  const level = normalizeAiSchoolLevel(options.level);
  const levelLabel = getAiSchoolLevelLabel(level);

  return {
    system:
      "Tu reformules pour un lecteur dys. Tu écris en français simple, direct et fidèle au sens, avec des phrases courtes.",
    prompt: [
      `Réécris ce passage pour un niveau ${levelLabel}.`,
      "Garde le sens exact, n'ajoute rien, ne retire pas l'idée principale.",
      level === "college"
        ? "Utilise des mots courants et 2 à 4 phrases courtes."
        : "Garde les mots importants, mais clarifie les phrases difficiles en 3 ou 4 phrases.",
      "N'utilise pas de liste, sauf si le passage est une consigne.",
      "",
      normalizedText
    ].join("\n"),
    maxLength: level === "college" ? 440 : 520,
    cacheKey: `reformulation:${level}:${normalizedText.slice(0, 240).toLowerCase()}`
  };
}

/**
 * Construit la requête de reformulation d'une consigne en étapes.
 * @param {{ text: string, level?: string, detectedTasks?: string[] }} payload
 * @returns {{ system: string, prompt: string, maxLength: number, cacheKey: string, preserveLineBreaks: boolean }}
 */
export function buildLocalAiInstructionRequest(payload = {}) {
  const normalizedText = String(payload.text || "").replace(/\s+/g, " ").trim();
  const level = normalizeAiSchoolLevel(payload.level);
  const levelLabel = getAiSchoolLevelLabel(level);
  const detectedTasks = Array.isArray(payload.detectedTasks)
    ? payload.detectedTasks.map((task) => String(task || "").trim()).filter(Boolean).slice(0, 8)
    : [];

  return {
    system:
      "Tu aides un élève dys à comprendre une consigne. Tu ne fais pas l'exercice. Tu reformules seulement ce qu'il faut faire.",
    prompt: [
      `Reformule cette consigne pour un niveau ${levelLabel}.`,
      "Si plusieurs actions sont demandées, découpe en étapes numérotées très courtes.",
      "Ne donne pas la réponse à l'exercice. Dis seulement quoi faire et dans quel ordre.",
      detectedTasks.length ? `Tâches déjà détectées : ${detectedTasks.map((task, index) => `${index + 1}. ${task}`).join(" | ")}` : "",
      "",
      normalizedText
    ]
      .filter(Boolean)
      .join("\n"),
    maxLength: 560,
    cacheKey: `instruction:${level}:${normalizedText.slice(0, 240).toLowerCase()}`,
    preserveLineBreaks: true
  };
}

/**
 * Construit la requête pour poser une question sur le PDF en cours.
 * @param {{ question: string, selectedText?: string, documentContext?: string, documentTitle?: string, level?: string }} payload
 * @returns {{ system: string, prompt: string, maxLength: number, cacheKey: string, preserveLineBreaks: boolean }}
 */
export function buildLocalAiDocumentQuestionRequest(payload = {}) {
  const question = String(payload.question || "").replace(/\s+/g, " ").trim();
  const selectedText = String(payload.selectedText || "").replace(/\s+/g, " ").trim();
  const documentContext = String(payload.documentContext || "").replace(/\s+/g, " ").trim();
  const documentTitle = String(payload.documentTitle || "Document PDF").replace(/\s+/g, " ").trim();
  const level = normalizeAiSchoolLevel(payload.level);
  const levelLabel = getAiSchoolLevelLabel(level);

  return {
    system:
      "Tu es l'assistant de lecture local d'Odysey. Tu réponds seulement avec les informations présentes dans le contexte fourni. Si le contexte ne suffit pas, tu le dis clairement.",
    prompt: [
      `Document : ${documentTitle}`,
      `Niveau souhaité : ${levelLabel}`,
      selectedText ? `Passage sélectionné : ${selectedText.slice(0, 1200)}` : "",
      `Contexte du PDF : ${documentContext.slice(0, 5200)}`,
      "",
      `Question de l'utilisateur : ${question}`,
      "",
      "Réponds en 2 à 5 phrases courtes. Si utile, termine par une mini-liste de 2 ou 3 points. Ne cherche pas ailleurs que dans le PDF."
    ]
      .filter(Boolean)
      .join("\n"),
    maxLength: 620,
    cacheKey: `pdf-question:${level}:${question.toLowerCase()}:${documentContext.slice(0, 180).toLowerCase()}`,
    preserveLineBreaks: true
  };
}
