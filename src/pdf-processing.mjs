// The generic PDF.js build assumes newer typed-array helpers than the
// Electron runtime currently provides. The legacy build keeps those
// compatibility shims and avoids import-time crashes when opening PDFs.
import * as pdfjsLib from "../node_modules/pdfjs-dist/legacy/build/pdf.mjs";
import {
  normalizeCommonFrenchReadingArtifacts,
  repairMergedFrenchText,
  repairSplitFrenchText
} from "./core/lexicon/french-lexicon.mjs";
import { analyzeMathContent, normalizeMathNotation } from "./core/reading/math-support.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
  import.meta.url
).toString();
const STANDARD_FONT_DATA_URL = new URL("../node_modules/pdfjs-dist/standard_fonts/", import.meta.url).toString();

const INLINE_OPERATOR_REGEX = /^[=+\-−*/×÷±≈<>≤≥]$/u;
const NO_SPACE_BEFORE_REGEX = /^[),.;:%!?}\]²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]/u;
const NO_SPACE_AFTER_REGEX = /[(\[{_^]$/u;
const SUPER_OR_SUBSCRIPT_TEXT_REGEX = /^[A-Za-z0-9()+\-]+$/u;
const TABLE_CELL_SEPARATOR = " | ";

function isDecorativeHeading(text) {
  const source = String(text).trim();
  if (!source) {
    return false;
  }

  return (
    /^Cycle\s+\d+/iu.test(source) ||
    /^Jean de La Fontaine$/iu.test(source) ||
    /^Litt[ée]rature$/iu.test(source) ||
    /^FABLE$/iu.test(source) ||
    /^Litt[ée]rature(?:\s*\|\s*|\s+)FABLE\b/iu.test(source)
  );
}

function simplifyDecorativeHeadingSegments(segments) {
  const cleaned = segments.map((segment) => normalizeFragment(segment)).filter(Boolean);
  if (cleaned.length <= 1) {
    return cleaned;
  }

  const nonDecorative = cleaned.filter((segment) => !isDecorativeHeading(segment));
  if (nonDecorative.length > 0) {
    return nonDecorative;
  }

  return cleaned;
}

function normalizeFragment(text) {
  return String(text).replace(/\s+/g, " ").trim();
}

async function repairBlockMergedWords(block) {
  if (!block || !["heading", "paragraph", "list"].includes(block.type)) {
    return block;
  }

  const originalText = String(block.text || "");
  const originalReadingText = String(block.readingText || originalText);
  const repairedText = normalizeCommonFrenchReadingArtifacts(
    await repairSplitFrenchText(await repairMergedFrenchText(originalText))
  );
  const repairedReadingText = normalizeCommonFrenchReadingArtifacts(
    await repairSplitFrenchText(await repairMergedFrenchText(originalReadingText))
  );

  if (repairedText === originalText && repairedReadingText === originalReadingText) {
    return block;
  }

  return {
    ...block,
    text: repairedText,
    readingText: repairedReadingText
  };
}

function isTableOfContentsEntry(text) {
  const source = normalizeFragment(text);
  if (!source) {
    return false;
  }

  return /\bLivre\s+[IVXLCDM]+\s*-\s*Fable\s+\d+\s+page\s+\d+\b/iu.test(source);
}

function detectList(text) {
  return /^([•\-*]\s+|\d+[.)]\s+|[a-zA-Z][.)]\s+)/.test(text);
}

function classifyLine(text, fontSize, medianFontSize, analysis, structure) {
  if (analysis?.isFormulaCandidate) {
    return "formula";
  }
  if (structure?.isTableLike) {
    return "table";
  }
  if (isTableOfContentsEntry(text)) {
    return "paragraph";
  }
  if (fontSize >= medianFontSize * 1.2 && text.length <= 90) {
    return "heading";
  }
  if (detectList(text)) {
    return "list";
  }
  return "paragraph";
}

function computeMedian(values) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function createTextPart(item) {
  const fontSize = Math.abs(item.transform[3]) || item.height || 12;
  const x = item.transform[4];
  const y = item.transform[5];
  const text = normalizeFragment(item.str);
  return {
    text,
    x,
    y,
    fontSize,
    width: item.width || Math.max(text.length * fontSize * 0.42, 0),
    endX: x + (item.width || Math.max(text.length * fontSize * 0.42, 0))
  };
}

function createLine(item) {
  const part = createTextPart(item);
  return {
    y: part.y,
    height: part.fontSize,
    items: [part],
    baselineSum: part.y,
    baselineCount: 1
  };
}

function appendItemToLine(line, item) {
  const part = createTextPart(item);
  line.height = Math.max(line.height, part.fontSize);
  line.items.push(part);
  line.baselineSum += part.y;
  line.baselineCount += 1;
  line.y = line.baselineSum / line.baselineCount;
}

function getLineMetrics(line) {
  const baselines = line.items.map((item) => item.y);
  const fontSizes = line.items.map((item) => item.fontSize);
  const minBaseline = Math.min(...baselines);
  const maxBaseline = Math.max(...baselines);
  const minFont = Math.min(...fontSizes);
  const maxFont = Math.max(...fontSizes);

  return {
    lineHeight: line.height,
    itemCount: line.items.length,
    baselineSpread: maxBaseline - minBaseline,
    fontSpread: maxFont > 0 ? (maxFont - minFont) / maxFont : 0
  };
}

function shouldInsertSpace(previous, current, isMathCandidate) {
  if (!previous) {
    return false;
  }

  const gap = current.x - previous.endX;
  const previousCharWidth = previous.text.length > 0 ? previous.width / previous.text.length : 0;
  const threshold = Math.max(previousCharWidth * (isMathCandidate ? 1.2 : 0.65), isMathCandidate ? 4.5 : 3);
  if (gap <= threshold) {
    return false;
  }

  if (INLINE_OPERATOR_REGEX.test(previous.text) || INLINE_OPERATOR_REGEX.test(current.text)) {
    return true;
  }

  if (NO_SPACE_AFTER_REGEX.test(previous.text) || NO_SPACE_BEFORE_REGEX.test(current.text)) {
    return false;
  }

  return true;
}

function shouldInsertCellSeparator(previous, current, lineHeight, isMathCandidate) {
  if (!previous || isMathCandidate) {
    return false;
  }

  const gap = current.x - previous.endX;
  const previousCharWidth = previous.text.length > 0 ? previous.width / previous.text.length : 0;
  const threshold = Math.max(previousCharWidth * 4.8, lineHeight * 1.35, 18);
  if (gap < threshold) {
    return false;
  }

  if (INLINE_OPERATOR_REGEX.test(previous.text) || INLINE_OPERATOR_REGEX.test(current.text)) {
    return false;
  }

  if (NO_SPACE_AFTER_REGEX.test(previous.text) || NO_SPACE_BEFORE_REGEX.test(current.text)) {
    return false;
  }

  return true;
}

function getScriptMarker(previous, current, lineHeight, isMathCandidate) {
  if (!previous || !isMathCandidate) {
    return "";
  }

  const deltaY = current.y - previous.y;
  const smallerText = current.fontSize <= previous.fontSize * 0.94;
  const threshold = Math.max(2.4, lineHeight * 0.22);
  const scriptLikeText = SUPER_OR_SUBSCRIPT_TEXT_REGEX.test(current.text);

  if (!smallerText || !scriptLikeText || Math.abs(deltaY) < threshold) {
    return "";
  }

  if (deltaY > 0) {
    return "^";
  }

  if (deltaY < 0) {
    return "_";
  }

  return "";
}

function buildLineText(line, { mathAware = false } = {}) {
  const parts = [...line.items].sort((a, b) => {
    const xDiff = a.x - b.x;
    if (Math.abs(xDiff) > Math.max(1.2, line.height * 0.08)) {
      return xDiff;
    }
    return b.y - a.y;
  });

  let text = "";
  let previous = null;

  for (const current of parts) {
    if (!current.text) {
      continue;
    }

    const marker = mathAware ? getScriptMarker(previous, current, line.height, true) : "";

    if (!marker && shouldInsertSpace(previous, current, mathAware)) {
      text += " ";
    }

    if (marker) {
      text += marker;
    }

    text += current.text;
    previous = current;
  }

  return mathAware ? normalizeMathNotation(text) : text.replace(/\s+/g, " ").trim();
}

function buildLineSegments(line) {
  const parts = [...line.items].sort((a, b) => {
    const xDiff = a.x - b.x;
    if (Math.abs(xDiff) > Math.max(1.2, line.height * 0.08)) {
      return xDiff;
    }
    return b.y - a.y;
  });

  const segments = [];
  let currentSegment = "";
  let previous = null;

  for (const current of parts) {
    if (!current.text) {
      continue;
    }

    if (shouldInsertCellSeparator(previous, current, line.height, false)) {
      if (currentSegment.trim()) {
        segments.push(currentSegment.replace(/\s+/g, " ").trim());
      }
      currentSegment = "";
    } else if (shouldInsertSpace(previous, current, false)) {
      currentSegment += " ";
    }

    currentSegment += current.text;
    previous = current;
  }

  if (currentSegment.trim()) {
    segments.push(currentSegment.replace(/\s+/g, " ").trim());
  }

  return segments;
}

function analyzeLineStructure(text, segments, metrics, fontSize, medianFontSize, mathAnalysis) {
  if (mathAnalysis?.isFormulaCandidate) {
    return {
      isTableLike: false,
      columnCount: 1
    };
  }

  const compactSegments = segments.filter(Boolean);
  const columnCount = Math.max(1, compactSegments.length);
  const containsNumbers = compactSegments.some((segment) => /[\d%€]/u.test(segment));
  const hasRepeatedCell = new Set(compactSegments.map((segment) => segment.toLowerCase())).size < compactSegments.length;
  const mostlyShortCells = compactSegments.filter((segment) => segment.length <= 28).length >= Math.max(2, compactSegments.length - 1);
  const isHeadingLike = fontSize >= medianFontSize * 1.2 && text.length <= 90;
  const isTableLike =
    !isHeadingLike &&
    compactSegments.length >= 3 &&
    (containsNumbers || hasRepeatedCell || mostlyShortCells || metrics.itemCount >= compactSegments.length + 2);

  return {
    isTableLike,
    columnCount
  };
}

function finalizeLine(line, medianFontSize) {
  const rawSegments = buildLineSegments(line);
  const initialSegments = simplifyDecorativeHeadingSegments(rawSegments);
  const initialSpeechText = initialSegments.join(". ").trim();
  const spacedText = initialSegments.join(" ").replace(/\s+/gu, " ").trim();
  const initialText = initialSegments.length > 1 ? initialSegments.join(TABLE_CELL_SEPARATOR) : initialSegments[0] || "";
  const metrics = getLineMetrics(line);
  const firstAnalysis = analyzeMathContent(initialSpeechText || spacedText || initialText, metrics);
  const mathText = firstAnalysis.isFormulaCandidate ? buildLineText(line, { mathAware: true }) : "";
  const finalAnalysis = analyzeMathContent(firstAnalysis.isFormulaCandidate ? mathText : initialSpeechText || spacedText || initialText, metrics);
  const structure = analyzeLineStructure(
    firstAnalysis.isFormulaCandidate ? mathText : spacedText || initialText,
    firstAnalysis.isFormulaCandidate ? [mathText] : initialSegments,
    metrics,
    line.height,
    medianFontSize,
    finalAnalysis
  );
  const verificationReasons = [...finalAnalysis.verificationReasons];
  let verificationLevel = finalAnalysis.verificationLevel;

  if (structure.isTableLike) {
    verificationLevel = mergeVerificationLevel(verificationLevel, "low");
    if (!verificationReasons.includes("Tableau réorganisé pour la lecture")) {
      verificationReasons.push("Tableau réorganisé pour la lecture");
    }
  }

  return {
    ...line,
    text: finalAnalysis.isFormulaCandidate
      ? normalizeMathNotation(mathText)
      : structure.isTableLike
        ? initialText
        : spacedText || initialText,
    readingText: structure.isTableLike
      ? initialSpeechText || initialText
      : finalAnalysis.isFormulaCandidate
        ? finalAnalysis.speechText
        : spacedText || initialText,
    segments: structure.isTableLike
      ? initialSegments
      : [finalAnalysis.isFormulaCandidate ? normalizeMathNotation(mathText) : spacedText || initialText],
    structure,
    math: {
      ...finalAnalysis,
      verificationLevel,
      verificationReasons
    },
    metrics
  };
}

function mergeVerificationReasons(targetBlock, reasons = []) {
  const seen = new Set(targetBlock.verification.reasons);
  for (const reason of reasons) {
    if (!seen.has(reason)) {
      targetBlock.verification.reasons.push(reason);
      seen.add(reason);
    }
  }
}

function mergeVerificationLevel(currentLevel, nextLevel) {
  const order = {
    none: 0,
    low: 1,
    medium: 2,
    high: 3
  };
  return order[nextLevel] > order[currentLevel] ? nextLevel : currentLevel;
}

function createBlockFromLine(line, type, pageNumber) {
  const minX = Math.min(...line.items.map((item) => item.x));
  const maxX = Math.max(...line.items.map((item) => item.endX));
  return {
    type,
    text: line.text,
    readingText: line.readingText || (type === "formula" ? line.math.speechText : line.text),
    sourcePage: pageNumber,
    bbox: {
      x: minX,
      y: line.y,
      width: maxX - minX,
      height: line.height
    },
    math: {
      containsMath: line.math.containsMath,
      mathScore: line.math.mathScore
    },
    verification: {
      level: line.math.verificationLevel,
      reasons: [...line.math.verificationReasons]
    },
    rows: type === "table" ? [line.segments] : undefined
  };
}

function createSyntheticBlock(text, type, pageNumber, referenceBlock = null) {
  const referenceBox = referenceBlock?.bbox || { x: 0, y: 0, width: 640, height: 24 };
  return {
    type,
    text,
    readingText: text,
    sourcePage: pageNumber,
    bbox: {
      x: referenceBox.x,
      y: referenceBox.y,
      width: referenceBox.width,
      height: Math.max(24, referenceBox.height)
    },
    math: {
      containsMath: false,
      mathScore: 0
    },
    verification: {
      level: "none",
      reasons: []
    }
  };
}

function normalizeTableOfContentsBlocks(blocks, pageNumber) {
  const tocEntryCount = blocks.filter((block) => isTableOfContentsEntry(block.text)).length;
  if (tocEntryCount < 3) {
    return blocks;
  }

  const normalizedBlocks = blocks.map((block) => {
    const normalizedText = normalizeFragment(block.text);
    if (/^Fables\s+FABLES$/iu.test(normalizedText) || /^FABLES?\s+FABLES?$/iu.test(normalizedText)) {
      return {
        ...block,
        text: "Fables",
        readingText: "Fables"
      };
    }

    return block;
  });

  const hasSommaireHeading = normalizedBlocks.some((block) => /^Sommaire$/iu.test(normalizeFragment(block.text)));
  if (hasSommaireHeading) {
    return normalizedBlocks;
  }

  return [createSyntheticBlock("Sommaire", "heading", pageNumber, normalizedBlocks[0]), ...normalizedBlocks];
}

function removeRedundantDecorativeBlocks(blocks) {
  const tocEntryCount = blocks.filter((block) => isTableOfContentsEntry(block.text)).length;
  if (tocEntryCount >= 3) {
    return blocks;
  }

  return blocks.filter((block) => {
    const text = normalizeFragment(block.text);
    if (!text) {
      return false;
    }

    if (/^Litt[ée]rature(?:\s*\|\s*|\s+)FABLE\b/iu.test(text)) {
      return false;
    }

    if (/^FABLE$/iu.test(text)) {
      return false;
    }

    return true;
  });
}

function removeRunningHeaderAndFooterBlocks(blocks) {
  const tocEntryCount = blocks.filter((block) => isTableOfContentsEntry(block.text)).length;
  if (tocEntryCount >= 3) {
    return blocks;
  }

  return blocks.filter((block) => {
    const text = normalizeFragment(block.text);
    if (!text) {
      return false;
    }

    if (/^Cycle\s+\d+$/iu.test(text)) {
      return false;
    }

    if (/^Litt[ée]rature(?:\s+FABLE)?$/iu.test(text)) {
      return false;
    }

    if (/^Livre\s+[IVXLCDM]+\s*-\s*Fable\s+\d+$/iu.test(text)) {
      return false;
    }

    return true;
  });
}

function isRepeatedRunningTextCandidate(text) {
  const normalizedText = normalizeFragment(text);
  if (!normalizedText || normalizedText.length > 120) {
    return false;
  }

  if (isTableOfContentsEntry(normalizedText) || /^Sommaire$/iu.test(normalizedText)) {
    return false;
  }

  if (/[.:;!?]$/u.test(normalizedText)) {
    return false;
  }

  const letters = [...normalizedText].filter((char) => /\p{L}/u.test(char));
  const uppercaseLetters = letters.filter((char) => char === char.toUpperCase());
  const uppercaseRatio = letters.length > 0 ? uppercaseLetters.length / letters.length : 0;
  const hasNumberMarker = /\d/u.test(normalizedText);
  const hasRomanMarker = /\b[IVXLCDM]{1,8}\b/u.test(normalizedText);
  const hasUppercaseToken = /\b[\p{Lu}]{4,}\b/u.test(normalizedText);

  return hasNumberMarker || hasRomanMarker || hasUppercaseToken || uppercaseRatio >= 0.62;
}

function classifyRunningBand(block, pageHeight, blockIndex = -1, blockCount = 0) {
  if (!pageHeight || !block?.bbox) {
    return null;
  }

  const topDistance = Math.max(0, pageHeight - block.bbox.y);
  const bottomDistance = Math.max(0, block.bbox.y);

  if (topDistance <= pageHeight * 0.28 || (blockIndex >= 0 && blockIndex <= 2)) {
    return "top";
  }

  if (bottomDistance <= pageHeight * 0.14 || (blockCount > 0 && blockIndex >= blockCount - 2)) {
    return "bottom";
  }

  return null;
}

function removeRepeatedRunningBlocks(pageModels) {
  const repeatedCandidates = new Map();

  for (const page of pageModels) {
    for (const [index, block] of page.blocks.entries()) {
      const band = classifyRunningBand(block, page.pageHeight, index, page.blocks.length);
      if (!band) {
        continue;
      }

      const text = normalizeFragment(block.text);
      if (!isRepeatedRunningTextCandidate(text)) {
        continue;
      }

      const key = `${band}::${text.toLowerCase()}`;
      const entry = repeatedCandidates.get(key) || {
        band,
        text,
        pages: []
      };
      entry.pages.push(page.pageNumber);
      repeatedCandidates.set(key, entry);
    }
  }

  const repeatedKeys = new Map();
  for (const [key, entry] of repeatedCandidates.entries()) {
    const uniquePages = [...new Set(entry.pages)].sort((a, b) => a - b);
    if (uniquePages.length < 2) {
      continue;
    }

    repeatedKeys.set(key, uniquePages[0]);
  }

  if (repeatedKeys.size === 0) {
    return pageModels;
  }

  return pageModels.map((page) => {
    const blocks = page.blocks.filter((block, index) => {
      const band = classifyRunningBand(block, page.pageHeight, index, page.blocks.length);
      if (!band) {
        return true;
      }

      const text = normalizeFragment(block.text);
      const key = `${band}::${text.toLowerCase()}`;
      if (!repeatedKeys.has(key)) {
        return true;
      }

      const firstPageNumber = repeatedKeys.get(key);
      return page.pageNumber === firstPageNumber;
    });

    return {
      ...page,
      blocks
    };
  });
}

function isHeadingContinuation(previousText, nextText, gapFromPrevious, maxHeight) {
  const source = normalizeFragment(previousText);
  const target = normalizeFragment(nextText);
  if (!source || !target) {
    return false;
  }

  if (isDecorativeHeading(source) || isDecorativeHeading(target)) {
    return false;
  }

  if (/[:.!?]$/u.test(source)) {
    return false;
  }

  if (gapFromPrevious > maxHeight * 2.2) {
    return false;
  }

  return /^[a-zàâçéèêëîïôûùüÿæœ]/u.test(target);
}

function mergeContinuationHeadingBlocks(blocks) {
  const mergedBlocks = [];

  for (const block of blocks) {
    const previousBlock = mergedBlocks[mergedBlocks.length - 1];
    if (
      previousBlock?.type === "heading" &&
      block.type === "heading" &&
      isHeadingContinuation(
        previousBlock.text,
        block.text,
        Math.abs(previousBlock.bbox.y - block.bbox.y),
        Math.max(previousBlock.bbox.height || 0, block.bbox.height || 0, 1)
      )
    ) {
      previousBlock.text = `${previousBlock.text} ${block.text}`;
      previousBlock.readingText = `${previousBlock.readingText || previousBlock.text} ${block.readingText || block.text}`;
      previousBlock.bbox.height += Math.abs(previousBlock.bbox.y - block.bbox.y);
      previousBlock.bbox.width = Math.max(previousBlock.bbox.width, block.bbox.width);
      previousBlock.bbox.x = Math.min(previousBlock.bbox.x, block.bbox.x);
      previousBlock.math.containsMath = previousBlock.math.containsMath || block.math.containsMath;
      previousBlock.math.mathScore = Math.max(previousBlock.math.mathScore, block.math.mathScore);
      previousBlock.verification.level = mergeVerificationLevel(previousBlock.verification.level, block.verification.level);
      mergeVerificationReasons(previousBlock, block.verification.reasons);
      continue;
    }

    mergedBlocks.push(block);
  }

  return mergedBlocks;
}

function mergeLinesIntoBlocks(lines, medianFontSize, pageNumber) {
  const blocks = [];
  let currentBlock = null;
  let previousLine = null;

  for (const line of lines) {
    if (!line.text) {
      continue;
    }

    const type = classifyLine(line.text, line.height, medianFontSize, line.math, line.structure);
    const gapFromPrevious = previousLine ? Math.abs(previousLine.y - line.y) : line.height * 2;
    const maxHeight = Math.max(previousLine?.height || 0, line.height);
    const isHeadingWrap =
      type === "heading" &&
      currentBlock?.type === "heading" &&
      isHeadingContinuation(currentBlock.text, line.text, gapFromPrevious, maxHeight);
    const shouldBreakHeading =
      type === "heading" &&
      !isHeadingWrap &&
      Boolean(
        !currentBlock ||
          currentBlock.type !== "heading" ||
          gapFromPrevious > maxHeight * 1.32 ||
          /[:.!?]$/.test(currentBlock.text) ||
          isDecorativeHeading(currentBlock.text) ||
          isDecorativeHeading(line.text)
      );
    const lineStartsNewBlock =
      !currentBlock ||
      currentBlock.type !== type ||
      gapFromPrevious > maxHeight * (type === "formula" ? 2.2 : 1.7) ||
      shouldBreakHeading ||
      type === "list" ||
      isTableOfContentsEntry(line.text) ||
      (currentBlock && isTableOfContentsEntry(currentBlock.text)) ||
      (type === "paragraph" && /[:.!?]$/.test(currentBlock.text));

    const shouldStartNewBlock = isHeadingWrap ? false : lineStartsNewBlock;

    if (shouldStartNewBlock) {
      currentBlock = createBlockFromLine(line, type, pageNumber);
      blocks.push(currentBlock);
      previousLine = line;
      continue;
    }

    const joiner = type === "formula" || type === "table" ? "\n" : " ";
    currentBlock.text += `${joiner}${line.text}`;
    currentBlock.readingText +=
      type === "formula" || type === "table"
        ? currentBlock.readingText
          ? `. ${line.readingText || line.text}`
          : line.readingText || line.text
        : `${currentBlock.readingText ? " " : ""}${line.readingText || line.text}`;
    currentBlock.bbox.height += gapFromPrevious;
    currentBlock.bbox.width = Math.max(
      currentBlock.bbox.width,
      Math.max(...line.items.map((item) => item.endX)) - currentBlock.bbox.x
    );
    currentBlock.math.containsMath = currentBlock.math.containsMath || line.math.containsMath;
    currentBlock.math.mathScore = Math.max(currentBlock.math.mathScore, line.math.mathScore);
    currentBlock.verification.level = mergeVerificationLevel(currentBlock.verification.level, line.math.verificationLevel);
    mergeVerificationReasons(currentBlock, line.math.verificationReasons);
    if (type === "table") {
      currentBlock.rows = [...(currentBlock.rows || []), line.segments];
    }
    previousLine = line;
  }

  return blocks;
}

function buildPageModel(pageNumber, textContent, pageHeight = 0) {
  const textItems = textContent.items
    .filter((item) => typeof item.str === "string")
    .map((item) => ({
      ...item,
      str: item.str.replace(/\u0000/g, "")
    }))
    .filter((item) => normalizeFragment(item.str).length > 0);

  const fontSizes = textItems.map((item) => Math.abs(item.transform[3]) || item.height || 12);
  const medianFontSize = computeMedian(fontSizes) || 12;
  const yTolerance = Math.max(medianFontSize * 0.45, 2.5);
  const sorted = [...textItems].sort((a, b) => {
    const yDiff = b.transform[5] - a.transform[5];
    if (Math.abs(yDiff) > yTolerance) {
      return yDiff;
    }
    return a.transform[4] - b.transform[4];
  });

  const rawLines = [];
  for (const item of sorted) {
    const y = item.transform[5];
    const existingLine = rawLines.reduce((closestLine, line) => {
      const distance = Math.abs(line.y - y);
      if (distance > yTolerance) {
        return closestLine;
      }
      if (!closestLine) {
        return line;
      }
      return Math.abs(closestLine.y - y) <= distance ? closestLine : line;
    }, null);
    if (existingLine) {
      appendItemToLine(existingLine, item);
    } else {
      rawLines.push(createLine(item));
    }
  }

  const lines = rawLines
    .sort((a, b) => b.y - a.y)
    .map((line) => finalizeLine(line, medianFontSize));
  const mergedBlocks = mergeLinesIntoBlocks(lines, medianFontSize, pageNumber);
  const normalizedBlocks = normalizeTableOfContentsBlocks(mergedBlocks, pageNumber);
  const blocks = mergeContinuationHeadingBlocks(
    removeRunningHeaderAndFooterBlocks(removeRedundantDecorativeBlocks(normalizedBlocks))
  );
  const charCount = blocks.reduce((sum, block) => sum + block.text.length, 0);
  const formulaBlockCount = blocks.filter((block) => block.type === "formula").length;
  const verificationBlockCount = blocks.filter((block) => block?.verification?.level !== "none").length;

  return {
    pageNumber,
    pageHeight,
    blocks,
    charCount,
    itemCount: textItems.length,
    formulaBlockCount,
    verificationBlockCount
  };
}

export async function importPdfFromBytes(bytes, fileName) {
  const data = bytes instanceof Uint8Array ? new Uint8Array(bytes) : new Uint8Array(bytes);
  const loadingTask = pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
    standardFontDataUrl: STANDARD_FONT_DATA_URL
  });

  const pdfDocument = await loadingTask.promise;
  const warnings = [];
  const pageModels = [];

  for (let pageIndex = 1; pageIndex <= pdfDocument.numPages; pageIndex += 1) {
    const page = await pdfDocument.getPage(pageIndex);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent({
      normalizeWhitespace: true,
      disableCombineTextItems: false
    });
    const pageModel = buildPageModel(pageIndex, textContent, viewport.height);
    pageModels.push(pageModel);
  }

  const cleanedPageModels = removeRepeatedRunningBlocks(pageModels);
  const pages = [];
  let poorPages = 0;
  let totalChars = 0;
  let formulaBlockCount = 0;
  let verificationBlockCount = 0;

  for (const pageModel of cleanedPageModels) {
    const repairedBlocks = [];
    for (const block of pageModel.blocks) {
      repairedBlocks.push(await repairBlockMergedWords(block));
    }

    const charCount = repairedBlocks.reduce((sum, block) => sum + block.text.length, 0);
    const pageFormulaBlockCount = repairedBlocks.filter((block) => block.type === "formula").length;
    const pageVerificationBlockCount = repairedBlocks.filter((block) => block?.verification?.level !== "none").length;

    totalChars += charCount;
    formulaBlockCount += pageFormulaBlockCount;
    verificationBlockCount += pageVerificationBlockCount;

    if (charCount < 35 || pageModel.itemCount < 8) {
      poorPages += 1;
    }

      pages.push({
        pageNumber: pageModel.pageNumber,
        blocks: repairedBlocks
      });
  }

  let extractionQuality = "good";
  const poorRatio = pdfDocument.numPages === 0 ? 1 : poorPages / pdfDocument.numPages;

  if (totalChars < 180 || poorRatio >= 0.8) {
    extractionQuality = "poor";
    warnings.push("PDF scanné non pris en charge dans cette v1.");
  } else if (poorRatio >= 0.25) {
    extractionQuality = "partial";
    warnings.push("Certaines pages ont été extraites partiellement. La mise en page peut être simplifiée.");
  }

  if (pages.every((page) => page.blocks.length === 0)) {
    extractionQuality = "poor";
    warnings.push("Aucun texte exploitable n'a été trouvé dans ce PDF.");
  }

  if (formulaBlockCount > 0) {
    warnings.push("Des formules mathématiques ont été reconstruites. Le mode vérification aide à contrôler les zones complexes.");
  }

  if (verificationBlockCount > 0) {
    warnings.push("Certaines expressions mathématiques demandent une vérification visuelle.");
  }

  return {
    fileName,
    pageCount: pdfDocument.numPages,
    pages,
    extractionQuality,
    warnings
  };
}
