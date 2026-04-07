/**
 * Outils de normalisation et de persistance des passages surlignés.
 */

const MAX_ANNOTATIONS = 120;
const ANNOTATION_COLORS = new Set(["amber", "blue", "rose"]);

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * Normalise une annotation simple ancrée sur un bloc.
 * @param {object} entry
 * @returns {{id: string, blockKey: string, pageNumber: string, start: number, end: number, color: string, excerpt: string, createdAt: number} | null}
 */
export function normalizeAnnotationEntry(entry) {
  if (!entry) {
    return null;
  }

  const blockKey = String(entry.blockKey || "").trim();
  const start = Number(entry.start);
  const end = Number(entry.end);
  if (!blockKey || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }

  const color = ANNOTATION_COLORS.has(entry.color) ? entry.color : "amber";
  return {
    id: String(entry.id || `${blockKey}:${start}-${end}:${color}`).trim(),
    blockKey,
    pageNumber: String(entry.pageNumber || "").trim(),
    start,
    end,
    color,
    excerpt: normalizeText(entry.excerpt) || "Passage surligné",
    createdAt: Number(entry.createdAt) || Date.now()
  };
}

/**
 * Normalise et dédoublonne une collection d'annotations.
 * @param {Array<object>} entries
 * @param {number} limit
 * @returns {Array<object>}
 */
export function normalizeAnnotations(entries = [], limit = MAX_ANNOTATIONS) {
  const seen = new Set();
  const output = [];

  for (const entry of entries) {
    const normalized = normalizeAnnotationEntry(entry);
    if (!normalized || seen.has(normalized.id)) {
      continue;
    }

    seen.add(normalized.id);
    output.push(normalized);
    if (output.length >= limit) {
      break;
    }
  }

  return output;
}

/**
 * Ajoute une annotation en tête de liste.
 * @param {Array<object>} entries
 * @param {object} nextEntry
 * @param {number} limit
 * @returns {Array<object>}
 */
export function upsertAnnotation(entries = [], nextEntry, limit = MAX_ANNOTATIONS) {
  const normalizedNext = normalizeAnnotationEntry(nextEntry);
  if (!normalizedNext) {
    return normalizeAnnotations(entries, limit);
  }

  return normalizeAnnotations(
    [normalizedNext, ...entries.filter((entry) => String(entry?.id || "") !== normalizedNext.id)],
    limit
  );
}

/**
 * Supprime une annotation par identifiant.
 * @param {Array<object>} entries
 * @param {string} annotationId
 * @returns {Array<object>}
 */
export function removeAnnotation(entries = [], annotationId = "") {
  return normalizeAnnotations(entries.filter((entry) => String(entry?.id || "") !== String(annotationId || "").trim()));
}

/**
 * Retourne les annotations d'un bloc triées par début puis fin.
 * @param {Array<object>} entries
 * @param {string} blockKey
 * @returns {Array<object>}
 */
export function getBlockAnnotations(entries = [], blockKey = "") {
  return normalizeAnnotations(entries)
    .filter((entry) => entry.blockKey === blockKey)
    .sort((left, right) => left.start - right.start || left.end - right.end);
}

/**
 * Exporte les annotations au format texte.
 * @param {string} documentTitle
 * @param {Array<object>} annotations
 * @returns {string}
 */
export function exportAnnotationsAsText(documentTitle, annotations = []) {
  const lines = [
    "DysLecteur - Passages surlignés",
    `Document : ${normalizeText(documentTitle) || "Sans titre"}`,
    `Nombre de passages : ${annotations.length}`,
    ""
  ];

  if (annotations.length === 0) {
    lines.push("Aucun passage surligné.");
    return lines.join("\n");
  }

  annotations.forEach((annotation, index) => {
    const createdAt = new Date(annotation.createdAt);
    const formattedDate = Number.isNaN(createdAt.getTime()) ? "" : createdAt.toLocaleString("fr-FR");
    lines.push(`${index + 1}. ${annotation.excerpt}`);
    if (annotation.pageNumber) {
      lines.push(`   Page : ${annotation.pageNumber}`);
    }
    lines.push(`   Couleur : ${annotation.color}`);
    if (formattedDate) {
      lines.push(`   Ajouté le : ${formattedDate}`);
    }
    lines.push("");
  });

  return lines.join("\n");
}
