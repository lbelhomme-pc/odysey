import { countDocumentBlocks, pickDocumentPages, summarizeDocumentDiagnostics } from "../document/document-model.mjs";
import { normalizeColorationMode } from "../reading/decoding-engine.mjs";

function sanitizeFileNameSegment(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildPrintManifest({
  importedDocument,
  preferences,
  profileLabel = "Profil personnalisé",
  scope = "document",
  renderMode = "adapted",
  inkMode = "standard"
}) {
  const diagnostics = summarizeDocumentDiagnostics(importedDocument);
  const pages = pickDocumentPages(importedDocument, scope).map((page) => ({
    pageNumber: page.pageNumber,
    blockCount: page.blocks.length,
    blocks: page.blocks.map((block) => ({
      type: block.type,
      text: block.text,
      readingText: block.readingText || block.text,
      verificationLevel: block?.verification?.level || "none"
    }))
  }));

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    title: importedDocument?.fileName || "Document adapté",
    pageCount: importedDocument?.pageCount || 0,
    blockCount: countDocumentBlocks(importedDocument),
    mathBlockCount: diagnostics.mathBlockCount,
    formulaBlockCount: diagnostics.formulaBlockCount,
    verificationBlockCount: diagnostics.verificationBlockCount,
    extractionQuality: importedDocument?.extractionQuality || "good",
    warnings: importedDocument?.warnings || [],
    profileLabel,
    scope,
    renderMode,
    inkMode,
    preferences: {
      fontFamily: preferences.fontFamily,
      fontSize: preferences.fontSize,
      lineHeight: preferences.lineHeight,
      letterSpacing: preferences.letterSpacing,
      wordSpacing: preferences.wordSpacing,
      maxLineLength: preferences.maxLineLength,
      pagePadding: preferences.pagePadding,
      theme: preferences.theme,
      highlightMode: preferences.highlightMode,
      focusMode: preferences.focusMode,
      colorationMode: normalizeColorationMode(preferences.colorationMode),
      soundColorMode: preferences.soundColorMode || "soft",
      syllableBreakMode: preferences.syllableBreakMode || "none",
      verificationMode: preferences.verificationMode || "off"
    },
    pages
  };
}

export function formatPrintSettingsSummary(manifest) {
  return [
    `Profil : ${manifest.profileLabel}`,
    `Police : ${manifest.preferences.fontSize}px`,
    `Interligne : ${Number(manifest.preferences.lineHeight).toFixed(2)}`,
    `Coloration : ${manifest.preferences.colorationMode === "none" ? "désactivée" : manifest.preferences.colorationMode}`,
    `Couleurs des sons : ${manifest.preferences.soundColorMode === "strong" ? "nettes" : "douces"}`,
    `Coupure syllabique : ${manifest.preferences.syllableBreakMode === "hyphen" ? "tiret discret" : manifest.preferences.syllableBreakMode === "dot" ? "point médian" : "aucune"}`,
    `Vérification : ${manifest.preferences.verificationMode === "off" ? "désactivée" : "active"}`,
    `Formules détectées : ${manifest.formulaBlockCount}`,
    `Portée : ${manifest.scope}`
  ];
}

export function getPrintExportFilename(manifest) {
  const baseName = sanitizeFileNameSegment(manifest.title.replace(/\.pdf$/i, "")) || "document-adapte";
  return `${baseName}-adapte.pdf`;
}
