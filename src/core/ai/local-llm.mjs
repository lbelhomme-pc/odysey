export const DEFAULT_LOCAL_AI_MODEL = "gemma3:4b";
export const LOCAL_AI_INSTALL_URL = "https://ollama.com/download";

const LOCAL_AI_MODES = new Set(["off", "on-demand", "prefer-local"]);
const LOCAL_AI_MODELS = new Set(["gemma3:1b", "gemma3:4b"]);

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
 * Nettoie une sortie texte du modèle pour l'afficher dans l'interface.
 * @param {string} value
 * @param {{ maxLength?: number }} [options]
 * @returns {string}
 */
export function cleanLocalAiText(value, options = {}) {
  const maxLength = Math.max(80, Number(options.maxLength || 340));
  const text = String(value || "")
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/^[\s>*-]+/gmu, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^résumé\s*:\s*/iu, "")
    .replace(/^reformulation\s*:\s*/iu, "")
    .replace(/^en clair\s*:\s*/iu, "")
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
  const normalizedText = String(text || "").replace(/\s+/g, " ").trim();

  return {
    system:
      "Tu aides à la compréhension de lecture dans Odysey. Tu résumes en français clair, concret et fidèle, sans ajouter d'idée nouvelle, avec des phrases courtes.",
    prompt: [
      "Résume ce paragraphe en 2 phrases courtes maximum.",
      "Garde uniquement les informations utiles pour comprendre l'idée principale.",
      "N'ajoute pas de titre, pas de liste, pas de formule d'introduction.",
      "",
      normalizedText
    ].join("\n"),
    maxLength: 260,
    cacheKey: `summary:${normalizedText.slice(0, 240).toLowerCase()}`
  };
}

/**
 * Construit la requête de reformulation simple d'un paragraphe.
 * @param {string} text
 * @returns {{ system: string, prompt: string, maxLength: number, cacheKey: string }}
 */
export function buildLocalAiReformulationRequest(text) {
  const normalizedText = String(text || "").replace(/\s+/g, " ").trim();

  return {
    system:
      "Tu reformules pour un lecteur dys. Tu écris en français simple, direct et fidèle au sens, avec des phrases courtes et un vocabulaire courant.",
    prompt: [
      "Réécris ce paragraphe en français plus simple.",
      "Garde le sens exact, n'ajoute rien, ne retire pas l'idée principale.",
      "Fais 2 à 4 phrases courtes maximum, sans liste et sans ton scolaire artificiel.",
      "",
      normalizedText
    ].join("\n"),
    maxLength: 420,
    cacheKey: `reformulation:${normalizedText.slice(0, 240).toLowerCase()}`
  };
}
