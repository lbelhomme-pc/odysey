/**
 * Moteur OCR local pour PDF scannes base sur Tesseract.js.
 */

import * as pdfjsLib from "../../../node_modules/pdfjs-dist/legacy/build/pdf.mjs";
import { set as setIdbValue } from "../../../node_modules/idb-keyval/dist/index.js";
import { analyzeFrenchLexiconText } from "../lexicon/french-lexicon.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "../../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
  import.meta.url
).toString();
const STANDARD_FONT_DATA_URL = new URL("../../../node_modules/pdfjs-dist/standard_fonts/", import.meta.url).toString();

const OCR_SCRIPT_PATH = new URL("../../../node_modules/tesseract.js/dist/tesseract.min.js", import.meta.url).toString();
const OCR_WORKER_PATH = new URL("../../../node_modules/tesseract.js/dist/worker.min.js", import.meta.url).toString();
const OCR_CORE_PATH = new URL("../../../node_modules/tesseract.js-core", import.meta.url).toString();
const OCR_REMOTE_LANG_ROOT = "https://cdn.jsdelivr.net/npm/@tesseract.js-data";
const OCR_BUNDLED_LANGUAGE_PATHS = {
  fra: new URL("../../../node_modules/@tesseract.js-data/fra/4.0.0_best_int", import.meta.url).toString(),
  eng: new URL("../../../node_modules/@tesseract.js-data/eng/4.0.0_best_int", import.meta.url).toString()
};

let tesseractApiPromise = null;

function createOcrError(code, details = "") {
  const error = new Error(code);
  error.code = code;
  error.details = String(details || "");
  return error;
}

function normalizeOcrError(error) {
  if (error?.code) {
    return error;
  }

  const message = String(error?.message || error || "");

  if (message.includes("OCR_CANCELLED")) {
    return createOcrError("OCR_CANCELLED", message);
  }
  if (message.includes("OCR_RUNTIME_UNAVAILABLE")) {
    return createOcrError("OCR_RUNTIME_UNAVAILABLE", message);
  }
  if (message.includes("OCR_LIBRARY_LOAD_FAILED")) {
    return createOcrError("OCR_LIBRARY_LOAD_FAILED", message);
  }
  if (/Network error while fetching/iu.test(message) || (/traineddata/iu.test(message) && /fetch/iu.test(message))) {
    return createOcrError("OCR_NETWORK_ERROR", message);
  }
  if (/traineddata/iu.test(message)) {
    return createOcrError("OCR_LANGUAGE_DATA_UNAVAILABLE", message);
  }
  if (/Failed to load TesseractCore/iu.test(message) || /loading tesseract core/iu.test(message)) {
    return createOcrError("OCR_CORE_LOAD_FAILED", message);
  }

  return createOcrError("OCR_UNKNOWN_ERROR", message);
}

function toUint8Array(value) {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (Array.isArray(value)) {
    return Uint8Array.from(value);
  }
  if (value?.type === "Buffer" && Array.isArray(value.data)) {
    return Uint8Array.from(value.data);
  }
  throw createOcrError("OCR_LANGUAGE_DATA_UNAVAILABLE", "OCR data payload is not a supported binary type.");
}

function buildRemoteLangPath(language) {
  return `${OCR_REMOTE_LANG_ROOT}/${language}/4.0.0_best_int`;
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\u0000/gu, "")
    .replace(/\r\n?/gu, "\n")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/([A-Za-zÀ-ÿ])-\n([A-Za-zÀ-ÿ])/gu, "$1$2")
    .replace(/\n{3,}/gu, "\n\n")
    .replace(/[ \t]{2,}/gu, " ")
    .trim();
}

function guessBlockType(text) {
  const source = normalizeText(text);
  if (!source) {
    return "paragraph";
  }

  if (/^([•\-*]\s+|\d+[.)]\s+)/u.test(source)) {
    return "list";
  }

  if (source.length <= 88 && /^[\p{Lu}\d\s:;,.!?'()/-]+$/u.test(source)) {
    return "heading";
  }

  if (source.length <= 92 && /^[\p{L}\d\s:;,.!?'"()/-]+$/u.test(source) && !/[.?!].+[.?!]/u.test(source)) {
    return "heading";
  }

  return "paragraph";
}

function getDocumentObject() {
  if (typeof document === "undefined") {
    throw new Error("OCR_RUNTIME_UNAVAILABLE");
  }
  return document;
}

async function loadTesseractApi() {
  if (globalThis.Tesseract?.createWorker) {
    return globalThis.Tesseract;
  }

  if (tesseractApiPromise) {
    return tesseractApiPromise;
  }

  const rootDocument = getDocumentObject();
  tesseractApiPromise = new Promise((resolve, reject) => {
    const existingScript = rootDocument.querySelector('script[data-dys-reader-ocr="tesseract"]');
    const finalize = () => {
      if (globalThis.Tesseract?.createWorker) {
        resolve(globalThis.Tesseract);
        return;
      }
      tesseractApiPromise = null;
      reject(new Error("OCR_LIBRARY_LOAD_FAILED"));
    };

    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        finalize();
        return;
      }
      existingScript.addEventListener("load", finalize, { once: true });
      existingScript.addEventListener(
        "error",
        () => {
          tesseractApiPromise = null;
          reject(new Error("OCR_LIBRARY_LOAD_FAILED"));
        },
        { once: true }
      );
      return;
    }

    const script = rootDocument.createElement("script");
    script.async = true;
    script.src = OCR_SCRIPT_PATH;
    script.dataset.dysReaderOcr = "tesseract";
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        finalize();
      },
      { once: true }
    );
    script.addEventListener(
      "error",
      () => {
        script.remove();
        tesseractApiPromise = null;
        reject(new Error("OCR_LIBRARY_LOAD_FAILED"));
      },
      { once: true }
    );
    rootDocument.head.append(script);
  });

  return tesseractApiPromise;
}

function getBoxRect(bbox, pageWidth, pageHeight, fallbackIndex = 0) {
  const x0 = Number(bbox?.x0);
  const y0 = Number(bbox?.y0);
  const x1 = Number(bbox?.x1);
  const y1 = Number(bbox?.y1);

  if ([x0, y0, x1, y1].every(Number.isFinite)) {
    const left = Math.max(0, Math.round(Math.min(x0, x1)));
    const top = Math.max(0, Math.round(Math.min(y0, y1)));
    const right = Math.min(pageWidth, Math.round(Math.max(x0, x1)));
    const bottom = Math.min(pageHeight, Math.round(Math.max(y0, y1)));
    return {
      x: left,
      y: top,
      width: Math.max(24, right - left),
      height: Math.max(24, bottom - top)
    };
  }

  const fallbackHeight = Math.max(32, Math.round(pageHeight / 12));
  return {
    x: 0,
    y: fallbackIndex * fallbackHeight,
    width: pageWidth,
    height: fallbackHeight
  };
}

function getParagraphText(paragraph) {
  const directText = normalizeText(paragraph?.text || "");
  if (directText) {
    return directText;
  }

  const lineText = (paragraph?.lines || [])
    .map((line) => normalizeText(line?.text || ""))
    .filter(Boolean)
    .join(" ");

  return normalizeText(lineText);
}

function buildBlocksFromOcrPage(pageData, pageNumber, pageWidth, pageHeight) {
  const renderedBlocks = [];
  const sourceBlocks = Array.isArray(pageData?.blocks) ? pageData.blocks : [];

  for (const sourceBlock of sourceBlocks) {
    const paragraphs = Array.isArray(sourceBlock?.paragraphs) && sourceBlock.paragraphs.length > 0
      ? sourceBlock.paragraphs
      : [sourceBlock];

    for (const paragraph of paragraphs) {
      const text = getParagraphText(paragraph);
      if (!text) {
        continue;
      }

      renderedBlocks.push({
        type: guessBlockType(text),
        text,
        readingText: text,
        sourcePage: pageNumber,
        bbox: getBoxRect(paragraph?.bbox || sourceBlock?.bbox, pageWidth, pageHeight, renderedBlocks.length),
        math: {
          containsMath: false,
          mathScore: 0
        },
        verification: {
          level: "none",
          reasons: []
        }
      });
    }
  }

  if (renderedBlocks.length > 0) {
    return renderedBlocks.sort((left, right) => {
      if (Math.abs(left.bbox.y - right.bbox.y) > 14) {
        return left.bbox.y - right.bbox.y;
      }
      return left.bbox.x - right.bbox.x;
    });
  }

  const fallbackText = normalizeText(pageData?.text || "");
  if (!fallbackText) {
    return [];
  }

  return fallbackText
    .split(/\n{2,}/u)
    .map((part) => normalizeText(part.replace(/\n+/gu, " ")))
    .filter(Boolean)
    .map((text, index, segments) => ({
      type: guessBlockType(text),
      text,
      readingText: text,
      sourcePage: pageNumber,
      bbox: {
        x: 0,
        y: Math.round((pageHeight / Math.max(segments.length, 1)) * index),
        width: pageWidth,
        height: Math.max(32, Math.round(pageHeight / Math.max(segments.length, 1)))
      },
      math: {
        containsMath: false,
        mathScore: 0
      },
      verification: {
        level: "none",
        reasons: []
      }
    }));
}

function mergeVerificationLevel(currentLevel = "none", nextLevel = "none") {
  const order = {
    none: 0,
    low: 1,
    medium: 2,
    high: 3
  };
  return (order[nextLevel] || 0) > (order[currentLevel] || 0) ? nextLevel : currentLevel;
}

async function annotateBlocksWithLexicon(blocks) {
  let suspiciousBlockCount = 0;
  let mergedWordCount = 0;
  let knownRatioSum = 0;
  let analyzedBlockCount = 0;

  for (const block of blocks) {
    const lexicalQuality = await analyzeFrenchLexiconText(block.text);
    block.ocr = {
      ...(block.ocr || {}),
      lexicalQuality
    };

    if (lexicalQuality.consideredWordCount > 0) {
      analyzedBlockCount += 1;
      knownRatioSum += lexicalQuality.knownRatio;
    }

    if (lexicalQuality.reviewLevel !== "none") {
      suspiciousBlockCount += 1;
      mergedWordCount += lexicalQuality.mergedCandidates.length;
      block.verification.level = mergeVerificationLevel(block.verification.level, lexicalQuality.reviewLevel);
      block.verification.reasons = [...new Set([...block.verification.reasons, ...lexicalQuality.verificationReasons])];
    }
  }

  return {
    suspiciousBlockCount,
    mergedWordCount,
    averageKnownRatio: analyzedBlockCount > 0 ? knownRatioSum / analyzedBlockCount : 1
  };
}

async function renderPageToCanvasData(page, scale = 2.15) {
  const viewport = page.getViewport({ scale });
  const rootDocument = getDocumentObject();
  const canvas = rootDocument.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  await page.render({
    canvasContext: context,
    viewport
  }).promise;

  return {
    image: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height
  };
}

export class OcrEngine {
  constructor({ runtime = "browser", readLanguageData = null } = {}) {
    this.worker = null;
    this.cancelled = false;
    this.language = "";
    this.runtime = runtime;
    this.readLanguageData = typeof readLanguageData === "function" ? readLanguageData : null;
  }

  getAvailability(language = "fra") {
    const bundled = Boolean(this.readLanguageData) && Boolean(OCR_BUNDLED_LANGUAGE_PATHS[language]);
    return {
      language,
      bundled,
      source: bundled ? "bundled" : "remote"
    };
  }

  async ensureBundledLanguageCached(language) {
    const availability = this.getAvailability(language);
    if (!availability.bundled) {
      return false;
    }

    const cacheKey = `./${language}.traineddata`;
    const response = await this.readLanguageData(language);
    if (!response?.ok || !response.bytes) {
      throw createOcrError("OCR_LANGUAGE_DATA_UNAVAILABLE", response?.reason || language);
    }

    const data = toUint8Array(response.bytes);
    if (!data.byteLength) {
      throw createOcrError("OCR_LANGUAGE_DATA_UNAVAILABLE", `Empty OCR payload for ${language}.`);
    }

    await setIdbValue(cacheKey, data);
    return true;
  }

  async resolveWorkerLanguage(language) {
    return language;
  }

  buildWorkerOptions(language, onProgress, onError) {
    const availability = this.getAvailability(language);
    return {
      workerPath: OCR_WORKER_PATH,
      corePath: OCR_CORE_PATH,
      langPath: availability.bundled ? OCR_BUNDLED_LANGUAGE_PATHS[language] : buildRemoteLangPath(language),
      logger: (message) => {
        onProgress?.({
          phase: "worker",
          status: message.status || "OCR",
          progress: Number(message.progress) || 0
        });
      },
      errorHandler: (error) => {
        onError?.(normalizeOcrError(error));
      }
    };
  }

  async ensureWorker(language, onProgress, onError) {
    let api;
    try {
      api = await loadTesseractApi();
    } catch (error) {
      throw normalizeOcrError(error);
    }

    if (this.worker && this.language === language) {
      return this.worker;
    }

    await this.terminate();
    this.cancelled = false;
    await this.ensureBundledLanguageCached(language);
    const workerLanguage = await this.resolveWorkerLanguage(language);
    const workerOptions = this.buildWorkerOptions(language, onProgress, onError);

    try {
      this.worker = await api.createWorker(workerLanguage, 1, workerOptions);
      await this.worker.setParameters({
        preserve_interword_spaces: "1",
        user_defined_dpi: "150"
      });
      this.language = language;
    } catch (error) {
      await this.terminate();
      throw normalizeOcrError(error);
    }

    return this.worker;
  }

  async process(bytes, { fileName = "document.pdf", language = "fra", onProgress, onError } = {}) {
    try {
      const typedBytes = bytes instanceof Uint8Array ? new Uint8Array(bytes) : new Uint8Array(bytes);
      const worker = await this.ensureWorker(language, onProgress, onError);
      const loadingTask = pdfjsLib.getDocument({
        data: typedBytes,
        useSystemFonts: true,
        isEvalSupported: false,
        standardFontDataUrl: STANDARD_FONT_DATA_URL
      });

      const pdfDocument = await loadingTask.promise;
      const pages = [];
      const pageConfidences = [];
      const pageLexiconStats = [];
      let totalChars = 0;
      let emptyPages = 0;
      let nonEmptyPageCount = 0;

    for (let pageIndex = 1; pageIndex <= pdfDocument.numPages; pageIndex += 1) {
      if (this.cancelled) {
        throw createOcrError("OCR_CANCELLED");
      }

      onProgress?.({
        phase: "page",
        currentPage: pageIndex,
        totalPages: pdfDocument.numPages,
        progress: (pageIndex - 1) / Math.max(pdfDocument.numPages, 1),
        status: `Preparation de la page ${pageIndex}/${pdfDocument.numPages}`
      });

      const page = await pdfDocument.getPage(pageIndex);
      const rendered = await renderPageToCanvasData(page);
      const result = await worker.recognize(rendered.image, {}, { text: true, blocks: true });
      const pageData = result?.data || {};
      const text = normalizeText(pageData.text || "");
      const confidence = Number(pageData.confidence) || 0;
      const blocks = buildBlocksFromOcrPage(pageData, pageIndex, rendered.width, rendered.height);
      const lexiconStats = await annotateBlocksWithLexicon(blocks);

      totalChars += text.length;
      if (!text || blocks.length === 0) {
        emptyPages += 1;
      } else {
        nonEmptyPageCount += 1;
      }

      pageConfidences.push({
        pageNumber: pageIndex,
        confidence
      });
      pageLexiconStats.push({
        pageNumber: pageIndex,
        ...lexiconStats
      });
      pages.push({
        pageNumber: pageIndex,
        blocks
      });

      onProgress?.({
        phase: "page-done",
        currentPage: pageIndex,
        totalPages: pdfDocument.numPages,
        progress: pageIndex / Math.max(pdfDocument.numPages, 1),
        status: `OCR termine pour la page ${pageIndex}/${pdfDocument.numPages}`,
        confidence
      });
    }

    const averageConfidence =
      pageConfidences.length > 0
        ? pageConfidences.reduce((sum, page) => sum + page.confidence, 0) / pageConfidences.length
        : 0;
    const averageKnownRatio =
      pageLexiconStats.length > 0
        ? pageLexiconStats.reduce((sum, page) => sum + page.averageKnownRatio, 0) / pageLexiconStats.length
        : 1;
    const suspiciousBlockCount = pageLexiconStats.reduce((sum, page) => sum + page.suspiciousBlockCount, 0);
    const mergedWordCount = pageLexiconStats.reduce((sum, page) => sum + page.mergedWordCount, 0);

    const warnings = [];
    const hasReadableText = nonEmptyPageCount > 0 && totalChars >= 20;
    const extractionQuality = hasReadableText ? "ocr" : "poor";

    if (!hasReadableText || emptyPages === pdfDocument.numPages) {
      warnings.push("L'OCR n'a pas trouve assez de texte exploitable dans ce document.");
    } else if (averageConfidence < 55 || totalChars < 120) {
      warnings.push("Le resultat OCR reste fragile. Verifie les passages importants avant impression.");
    } else {
      warnings.push("Version OCR locale generee. Verifie les zones complexes avant impression.");
    }
    if (suspiciousBlockCount > 0) {
      warnings.push(
        mergedWordCount > 0
          ? "Certains blocs OCR semblent contenir des mots collés ou douteux. Utilise le mode vérification pour les relire."
          : "Quelques blocs OCR restent lexicalement fragiles. Une relecture ciblée est conseillée."
      );
    }

    return {
      fileName,
      pageCount: pdfDocument.numPages,
      pages,
      extractionQuality,
      warnings,
      ocr: {
        applied: extractionQuality !== "poor",
        language,
        engine: "tesseract.js",
        averageConfidence,
        pageConfidences,
        lexicalQuality: {
          averageKnownRatio,
          suspiciousBlockCount,
          mergedWordCount,
          pageStats: pageLexiconStats
        }
      }
    };
    } catch (error) {
      throw normalizeOcrError(error);
    }
  }

  async cancel() {
    this.cancelled = true;
    await this.terminate();
  }

  async terminate() {
    if (this.worker) {
      try {
        await this.worker.terminate();
      } catch {
        // Ignore cleanup errors.
      }
    }
    this.worker = null;
    this.language = "";
  }
}
