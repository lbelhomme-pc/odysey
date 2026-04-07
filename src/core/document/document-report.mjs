import { summarizeDocumentDiagnostics } from "./document-model.mjs";

export function getExtractionQualityLabel(extractionQuality) {
  if (extractionQuality === "good") {
    return "Extraction stable";
  }
  if (extractionQuality === "partial") {
    return "Extraction partielle";
  }
  if (extractionQuality === "ocr") {
    return "OCR local";
  }
  return "PDF scann\u00e9 d\u00e9tect\u00e9";
}

export function buildRecentFileEntry(importedDocument) {
  const diagnostics = summarizeDocumentDiagnostics(importedDocument);
  return {
    fileName: importedDocument.fileName,
    pageCount: importedDocument.pageCount,
    extractionQuality: importedDocument.extractionQuality,
    formulaBlockCount: diagnostics.formulaBlockCount,
    verificationBlockCount: diagnostics.verificationBlockCount,
    lastOpenedAt: new Date().toISOString()
  };
}

export function formatRecentDocumentLabel(item) {
  const status =
    item.extractionQuality === "partial"
      ? "partiel"
      : item.extractionQuality === "poor"
        ? "scann\u00e9"
        : item.extractionQuality === "ocr"
          ? "ocr"
          : "ok";
  const maths =
    item.formulaBlockCount > 0
      ? ` - maths ${item.formulaBlockCount}`
      : item.verificationBlockCount > 0
        ? " - \u00e0 v\u00e9rifier"
        : "";
  return `${item.pageCount} page(s) - ${status}${maths}`;
}

export function getImportStatusMessage(importedDocument) {
  const diagnostics = summarizeDocumentDiagnostics(importedDocument);

  if (importedDocument.extractionQuality === "ocr") {
    const confidence = importedDocument.ocr?.averageConfidence;
    const confidenceLabel = Number.isFinite(confidence)
      ? ` Confiance moyenne OCR : ${Math.round(confidence)}%.`
      : "";
    return `Version OCR locale g\u00e9n\u00e9r\u00e9e.${confidenceLabel}`;
  }

  return importedDocument.extractionQuality === "poor"
    ? "PDF scann\u00e9 d\u00e9tect\u00e9. Lance l'OCR local si tu veux reconstruire une version lisible."
    : diagnostics.formulaBlockCount > 0
      ? `PDF import\u00e9 avec ${diagnostics.formulaBlockCount} bloc(s) math\u00e9matiques. Le mode v\u00e9rification peut contr\u00f4ler les formules.`
      : "PDF import\u00e9 localement avec succ\u00e8s.";
}
