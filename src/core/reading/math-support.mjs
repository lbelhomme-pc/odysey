const INLINE_OPERATOR_REGEX = /[=+\-−*/×÷±≈<>≤≥]/u;
const OPERATOR_CLUSTER_REGEX = /[=+\-−*/×÷±≈<>≤≥]\s*[=+\-−*/×÷±≈<>≤≥]/u;
const MATH_SYMBOL_GLOBAL_REGEX = /[=+\-−*/×÷±≈<>≤≥∑∫√∞π∂∆^_()[\]{}%]/g;
const DIGIT_GLOBAL_REGEX = /\d/g;
const STRONG_MATH_SYMBOL_REGEX = /[=+\-−*×÷±≈<>≤≥∑∫√∞π∂∆^_%]/g;
const WEAK_SEPARATOR_REGEX = /[-/()[\]{}]/g;
const SINGLE_LETTER_VARIABLE_REGEX = /\b[abcdefghijklmnopqrstuvwxyz]\b/giu;
const SUPERSCRIPT_OR_SUBSCRIPT_REGEX = /[\^_²³¹⁰⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]/u;
const FRACTION_HINT_REGEX = /(?:\d\s*\/\s*\d)|(?:[a-z0-9)\]]\s*\/\s*[a-z0-9(\[])/iu;
const DOCUMENT_LABEL_REGEX = /\b(?:livre|fable|page|chapitre|cycle|litt[eé]rature|po[eè]me|sc[eè]ne|acte|partie|tome|section|volume)\b/iu;
const ROMAN_NUMERAL_REGEX = /\b[IVXLCDM]+\b/gu;
const ADMIN_REFERENCE_REGEX =
  /\b(?:article|arr[eê]t[eé]|rectoral|acad[eé]mie|recours|commission|d[eé]cision|affectation|extrait|certifi[eé]|conforme|code|adresse|avenue|recteur|secr[eé]taire|voie|d[eé]lai|conditions?)\b/iu;
const DATE_REFERENCE_REGEX = /\b\d{1,2}\s*[-/.]\s*\d{1,2}\s*[-/.]\s*\d{2,4}\b/u;
const FINANCIAL_TABLE_REGEX =
  /\b(?:base\s+de\s+remboursement|brss|br\b|garantie(?:s)?|forfait(?:s)?|euro(?:s)?|€|remboursement(?:s)?|s[ée]curit[ée]\s+sociale|mutualiste(?:s)?|mutuelle|sant[ée]|panier\s+de\s+soins|optionnelle(?:s)?|honoraires|cotisation|prise\s+en\s+charge|tarif(?:s)?|montant(?:s)?)\b/iu;
const PERCENT_VALUE_REGEX = /\d+\s*%/g;

const SPEECH_REPLACEMENTS = [
  [/≤/g, " inférieur ou égal à "],
  [/≥/g, " supérieur ou égal à "],
  [/≠/g, " différent de "],
  [/≈/g, " environ égal à "],
  [/=/g, " égal à "],
  [/\+/g, " plus "],
  [/−/g, " moins "],
  [/-/g, " moins "],
  [/×/g, " fois "],
  [/\*/g, " fois "],
  [/÷/g, " divisé par "],
  [/\//g, " sur "],
  [/√/g, " racine de "],
  [/∑/g, " somme "],
  [/∫/g, " intégrale "],
  [/∞/g, " infini "],
  [/π/g, " pi "],
  [/%/g, " pour cent "],
  [/\^/g, " puissance "],
  [/_/g, " indice "]
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function countMatches(regex, text) {
  const matches = String(text).match(regex);
  return matches ? matches.length : 0;
}

function isLikelyDocumentLabel(text, stats) {
  const source = String(text).trim();
  if (!source || !DOCUMENT_LABEL_REGEX.test(source)) {
    return false;
  }

  const wordCount = countMatches(/\b[\p{L}]{3,}\b/gu, source);
  const romanCount = countMatches(ROMAN_NUMERAL_REGEX, source);
  const pageLikeCount = countMatches(/\b(?:page|fable|chapitre|cycle|tome|partie)\s+\d+\b/giu, source);
  const containsEquationHint = /[=≈≤≥<>×÷*/^_]/u.test(source);

  return !containsEquationHint && stats.symbolCount <= 1 && wordCount >= 2 && (romanCount >= 1 || pageLikeCount >= 1);
}

function isLikelyAdministrativeReference(text, stats) {
  const source = String(text).trim();
  if (!source) {
    return false;
  }

  const wordCount = countMatches(/\b[\p{L}]{4,}\b/gu, source);
  const hasAdminKeyword = ADMIN_REFERENCE_REGEX.test(source);
  const hasDateReference = DATE_REFERENCE_REGEX.test(source);
  const hasStrongMathSignal =
    stats.equationCount > 0 ||
    stats.hasSuperscriptNotation ||
    stats.fractionHint ||
    stats.strongSymbolCount >= 2;

  return !hasStrongMathSignal && wordCount >= 2 && (hasAdminKeyword || hasDateReference);
}

function isLikelyFinancialTableReference(text, stats) {
  const source = String(text).trim();
  if (!source) {
    return false;
  }

  const wordCount = countMatches(/\b[\p{L}]{2,}\b/gu, source);
  const percentCount = countMatches(PERCENT_VALUE_REGEX, source);
  const hasPercent = /%/u.test(source);
  const hasCurrency = /(?:€|\beuro(?:s)?\b)/iu.test(source);
  const hasFinancialKeyword = FINANCIAL_TABLE_REGEX.test(source);
  const hasRealEquationSignal =
    stats.equationCount > 0 || stats.hasSuperscriptNotation || stats.fractionHint || stats.variableCount > 0;
  const hasOnlyPercentLikeMathSignals = stats.strongSymbolCount <= Math.max(1, percentCount);

  if (hasRealEquationSignal) {
    return false;
  }

  if (hasFinancialKeyword && (hasPercent || hasCurrency)) {
    return true;
  }

  if (percentCount >= 2 && hasOnlyPercentLikeMathSignals) {
    return true;
  }

  return wordCount >= 2 && hasCurrency && stats.digitCount >= 1 && hasOnlyPercentLikeMathSignals;
}

function hasBalancedDelimiters(text) {
  const pairs = {
    "(": ")",
    "[": "]",
    "{": "}"
  };
  const stack = [];

  for (const character of String(text)) {
    if (pairs[character]) {
      stack.push(character);
      continue;
    }

    const previous = stack.at(-1);
    if (character === ")" || character === "]" || character === "}") {
      if (!previous || pairs[previous] !== character) {
        return false;
      }
      stack.pop();
    }
  }

  return stack.length === 0;
}

function getVerificationLevel(reasons, mathScore) {
  if (reasons.length === 0) {
    return "none";
  }
  if (reasons.length >= 3 || mathScore >= 4.6) {
    return "high";
  }
  if (reasons.length >= 2 || mathScore >= 3.2) {
    return "medium";
  }
  if (reasons.length >= 1) {
    return "low";
  }
  return "none";
}

function readScriptValue(text, startIndex) {
  const source = String(text);
  if (startIndex >= source.length) {
    return { value: "", endIndex: startIndex };
  }

  const opening = source[startIndex];
  if (opening === "(" || opening === "{") {
    const closing = opening === "(" ? ")" : "}";
    let depth = 1;
    let cursor = startIndex + 1;

    while (cursor < source.length && depth > 0) {
      if (source[cursor] === opening) {
        depth += 1;
      } else if (source[cursor] === closing) {
        depth -= 1;
      }
      cursor += 1;
    }

    const endIndex = depth === 0 ? cursor : source.length;
    return {
      value: source.slice(startIndex + 1, Math.max(startIndex + 1, endIndex - 1)),
      endIndex
    };
  }

  let cursor = startIndex;
  while (cursor < source.length && /[\p{L}\d.+\-]/u.test(source[cursor])) {
    cursor += 1;
  }

  return {
    value: source.slice(startIndex, cursor),
    endIndex: cursor
  };
}

export function normalizeMathNotation(value) {
  return String(value)
    .replace(/[\u2000-\u200A\u202F\u205F]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*([=+\-−*/×÷±≈<>≤≥])\s*/g, " $1 ")
    .replace(/\s*([_^])\s*/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\[\s+/g, "[")
    .replace(/\{\s+/g, "{")
    .replace(/\s+\)/g, ")")
    .replace(/\s+\]/g, "]")
    .replace(/\s+\}/g, "}")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

export function verbalizeMathText(value) {
  let output = normalizeMathNotation(value);
  for (const [pattern, replacement] of SPEECH_REPLACEMENTS) {
    output = output.replace(pattern, replacement);
  }

  return output.replace(/\s+/g, " ").trim();
}

export function analyzeMathContent(value, metrics = {}) {
  const normalizedText = normalizeMathNotation(value);
  const compactText = normalizedText.replace(/\s+/g, "");
  const symbolCount = countMatches(MATH_SYMBOL_GLOBAL_REGEX, compactText);
  const strongSymbolCount = countMatches(STRONG_MATH_SYMBOL_REGEX, compactText);
  const weakSeparatorCount = countMatches(WEAK_SEPARATOR_REGEX, compactText);
  const digitCount = countMatches(DIGIT_GLOBAL_REGEX, compactText);
  const variableCount = countMatches(SINGLE_LETTER_VARIABLE_REGEX, normalizedText);
  const equationCount = countMatches(/[=≈<>≤≥]/g, compactText);
  const denseSymbolRatio = compactText.length > 0 ? symbolCount / compactText.length : 0;
  const hasSuperscriptNotation = SUPERSCRIPT_OR_SUBSCRIPT_REGEX.test(normalizedText);
  const fractionHint = FRACTION_HINT_REGEX.test(normalizedText);
  const baselineSpread = Number(metrics.baselineSpread || 0);
  const lineHeight = Number(metrics.lineHeight || metrics.height || 0);
  const fontSpread = Number(metrics.fontSpread || 0);

  let mathScore = 0;
  if (strongSymbolCount > 0) {
    mathScore += Math.min(2.2, strongSymbolCount * 0.35);
  }
  if (weakSeparatorCount > 0 && (fractionHint || equationCount > 0 || variableCount > 0)) {
    mathScore += Math.min(0.75, weakSeparatorCount * 0.12);
  }
  if (digitCount > 0 && variableCount > 0) {
    mathScore += 0.8;
  }
  if (equationCount > 0) {
    mathScore += 1.8;
  }
  if (hasSuperscriptNotation) {
    mathScore += 1.1;
  }
  if (fractionHint) {
    mathScore += 0.8;
  }
  if (denseSymbolRatio >= 0.16) {
    mathScore += 0.9;
  }
  if (baselineSpread > Math.max(2.8, lineHeight * 0.36)) {
    mathScore += 1.1;
  }
  if (fontSpread >= 0.28) {
    mathScore += 0.55;
  }

  const looksLikeDocumentLabel = isLikelyDocumentLabel(normalizedText, {
    symbolCount,
    digitCount,
    variableCount,
    equationCount
  });
  const looksLikeAdministrativeReference = isLikelyAdministrativeReference(normalizedText, {
    equationCount,
    fractionHint,
    hasSuperscriptNotation,
    strongSymbolCount
  });
  const looksLikeFinancialTableReference = isLikelyFinancialTableReference(normalizedText, {
    equationCount,
    fractionHint,
    hasSuperscriptNotation,
    strongSymbolCount,
    digitCount,
    variableCount
  });

  const containsMath =
    !looksLikeDocumentLabel &&
    !looksLikeAdministrativeReference &&
    !looksLikeFinancialTableReference &&
    (mathScore >= 1.45 || equationCount > 0 || hasSuperscriptNotation || (digitCount > 0 && strongSymbolCount >= 2));
  const isFormulaCandidate =
    !looksLikeDocumentLabel &&
    !looksLikeAdministrativeReference &&
    !looksLikeFinancialTableReference &&
    (
      mathScore >= 2.7 ||
      equationCount > 0 ||
      (containsMath && normalizedText.length <= 96 && denseSymbolRatio >= 0.1) ||
      (digitCount > 0 && variableCount > 0 && strongSymbolCount >= 2)
    );

  const verificationReasons = [];
  if (!hasBalancedDelimiters(normalizedText)) {
    verificationReasons.push("Parenthèses ou crochets à vérifier");
  }
  if (OPERATOR_CLUSTER_REGEX.test(normalizedText)) {
    verificationReasons.push("Suite d'opérateurs inhabituelle");
  }
  if (baselineSpread > Math.max(3.2, lineHeight * 0.5) && !hasSuperscriptNotation) {
    verificationReasons.push("Exposant ou indice potentiellement séparé");
  }
  if (fractionHint && baselineSpread > Math.max(3.4, lineHeight * 0.56)) {
    verificationReasons.push("Fraction ou empilement possiblement aplati");
  }
  if (isFormulaCandidate && denseSymbolRatio >= 0.24 && normalizedText.length >= 18) {
    verificationReasons.push("Expression mathématique dense à relire");
  }

  const verificationLevel = getVerificationLevel(verificationReasons, mathScore);

  return {
    normalizedText,
    speechText: verbalizeMathText(normalizedText),
    containsMath,
    isFormulaCandidate,
    mathScore,
    verificationLevel,
    verificationReasons,
    stats: {
      symbolCount,
      strongSymbolCount,
      weakSeparatorCount,
      digitCount,
      variableCount,
      equationCount,
      denseSymbolRatio,
      baselineSpread,
      fontSpread
    },
    looksLikeFinancialTableReference
  };
}

function renderMathLine(line) {
  const source = normalizeMathNotation(line);
  let html = "";

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if ((character === "^" || character === "_") && index + 1 < source.length) {
      const script = readScriptValue(source, index + 1);
      if (script.value) {
        const className = character === "^" ? "math-super" : "math-sub";
        const tagName = character === "^" ? "sup" : "sub";
        html += `<${tagName} class="${className}">${escapeHtml(script.value)}</${tagName}>`;
        index = script.endIndex - 1;
        continue;
      }
    }

    if (INLINE_OPERATOR_REGEX.test(character)) {
      html += `<span class="math-operator">${escapeHtml(character)}</span>`;
      continue;
    }

    if (/[(){}\[\]]/u.test(character)) {
      html += `<span class="math-group">${escapeHtml(character)}</span>`;
      continue;
    }

    if (/\d/u.test(character)) {
      html += `<span class="math-number">${character}</span>`;
      continue;
    }

    html += escapeHtml(character);
  }

  return html;
}

export function renderMathText(value) {
  return String(value)
    .split(/\n+/)
    .map((line) => renderMathLine(line))
    .join("<br />");
}
