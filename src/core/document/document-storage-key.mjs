function simpleHash(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * Construit une clé stable pour les données locales liées à un document.
 * @param {object | null} importedDocument
 * @returns {string}
 */
export function buildDocumentStorageKey(importedDocument) {
  if (!importedDocument) {
    return "";
  }

  const seed = [
    importedDocument.filePath || "",
    importedDocument.fileName || "",
    importedDocument.pageCount || importedDocument.pages?.length || 0,
    importedDocument.pages?.[0]?.blocks?.length || 0
  ].join("|");

  return `document-${simpleHash(seed)}`;
}
