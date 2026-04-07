/**
 * Outils de gestion des marque-pages de lecture par document.
 */

const MAX_BOOKMARKS = 20;

function simpleHash(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function normalizeLabel(value) {
  return String(value || "")
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * Construit une clé stable pour les marque-pages d'un document.
 * @param {object | null} importedDocument
 * @returns {string}
 */
export function buildBookmarkDocumentKey(importedDocument) {
  if (!importedDocument) {
    return "";
  }

  const seed = [
    importedDocument.filePath || "",
    importedDocument.fileName || "",
    importedDocument.pageCount || importedDocument.pages?.length || 0,
    importedDocument.pages?.[0]?.blocks?.length || 0
  ].join("|");

  return `bookmark-${simpleHash(seed)}`;
}

/**
 * Normalise une entrée de marque-page.
 * @param {object} entry
 * @returns {{key: string, pageNumber: string, label: string, createdAt: number} | null}
 */
export function normalizeBookmarkEntry(entry) {
  if (!entry) {
    return null;
  }

  const key = String(entry.key || entry.blockKey || "").trim();
  if (!key) {
    return null;
  }

  const createdAt = Number(entry.createdAt) || Date.now();
  return {
    key,
    pageNumber: String(entry.pageNumber || "").trim(),
    label: normalizeLabel(entry.label) || "Position courante",
    createdAt
  };
}

/**
 * Nettoie une liste de marque-pages en supprimant les doublons de bloc.
 * @param {Array<object>} entries
 * @param {number} limit
 * @returns {Array<{key: string, pageNumber: string, label: string, createdAt: number}>}
 */
export function normalizeBookmarks(entries = [], limit = MAX_BOOKMARKS) {
  const seen = new Set();
  const output = [];

  for (const entry of entries) {
    const normalized = normalizeBookmarkEntry(entry);
    if (!normalized || seen.has(normalized.key)) {
      continue;
    }

    seen.add(normalized.key);
    output.push(normalized);
    if (output.length >= limit) {
      break;
    }
  }

  return output;
}

/**
 * Ajoute ou met à jour un marque-page en tête de liste.
 * @param {Array<object>} entries
 * @param {object} nextEntry
 * @param {number} limit
 * @returns {Array<{key: string, pageNumber: string, label: string, createdAt: number}>}
 */
export function upsertBookmark(entries = [], nextEntry, limit = MAX_BOOKMARKS) {
  const normalizedNext = normalizeBookmarkEntry(nextEntry);
  if (!normalizedNext) {
    return normalizeBookmarks(entries, limit);
  }

  return normalizeBookmarks(
    [normalizedNext, ...entries.filter((entry) => String(entry?.key || entry?.blockKey || "").trim() !== normalizedNext.key)],
    limit
  );
}

/**
 * Retourne un nom de fichier simple pour l'export texte des repères.
 * @param {string} documentTitle
 * @returns {string}
 */
export function getBookmarkExportFileName(documentTitle = "document") {
  const safeTitle = normalizeLabel(documentTitle)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return `${safeTitle || "document"}-marque-pages.txt`;
}

/**
 * Prépare un export texte lisible des marque-pages.
 * @param {string} documentTitle
 * @param {Array<object>} bookmarks
 * @returns {string}
 */
export function exportBookmarksAsText(documentTitle, bookmarks = []) {
  const lines = [
    `DysLecteur - Marque-pages`,
    `Document : ${normalizeLabel(documentTitle) || "Sans titre"}`,
    `Nombre de repères : ${bookmarks.length}`,
    ""
  ];

  if (bookmarks.length === 0) {
    lines.push("Aucun marque-page enregistré.");
    return lines.join("\n");
  }

  bookmarks.forEach((bookmark, index) => {
    const createdAt = new Date(bookmark.createdAt);
    const formattedDate = Number.isNaN(createdAt.getTime()) ? "" : createdAt.toLocaleString("fr-FR");
    lines.push(`${index + 1}. ${bookmark.label}`);
    if (bookmark.pageNumber) {
      lines.push(`   Page : ${bookmark.pageNumber}`);
    }
    if (formattedDate) {
      lines.push(`   Ajouté le : ${formattedDate}`);
    }
    lines.push("");
  });

  return lines.join("\n");
}
