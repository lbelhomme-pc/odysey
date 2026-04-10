const INLINE_OPERATOR_REGEX = /[=+\-−*/×÷·⋅±≈<>≤≥→↔∝]/u;
const OPERATOR_CLUSTER_REGEX = /[=+\-−*/×÷·⋅±≈<>≤≥→↔∝]\s*[=+\-−*/×÷·⋅±≈<>≤≥→↔∝]/u;
const MATH_SYMBOL_GLOBAL_REGEX = /[=+\-−*/×÷·⋅±≈<>≤≥→↔∝∑∫√∞π∂∆^_()[\]{}%°]/g;
const DIGIT_GLOBAL_REGEX = /\d/g;
const STRONG_MATH_SYMBOL_REGEX = /[=+\-−*×÷·⋅±≈<>≤≥→↔∝∑∫√∞π∂∆^_%°]/g;
const WEAK_SEPARATOR_REGEX = /[-/()[\]{}]/g;
const SINGLE_LETTER_VARIABLE_REGEX =
  /\b(?:[abcdefghijklmnopqrstuvwxyz]|\u00b5|[\u0391-\u03A9\u03B1-\u03C9\u03D1\u03D5\u03D6\u03F1\u03F5])\b/giu;
const SUPERSCRIPT_OR_SUBSCRIPT_REGEX = /[\^_²³¹⁰⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]/u;
const FRACTION_HINT_REGEX = /(?:\d\s*\/\s*\d)|(?:[a-z0-9)\]]\s*\/\s*[a-z0-9(\[])/iu;
const GREEK_MATH_LETTER_GLOBAL_REGEX = /[\u00b5\u0391-\u03A9\u03B1-\u03C9\u03D1\u03D5\u03D6\u03F1\u03F5]/gu;
const GREEK_MATH_LETTER_REGEX = /[\u00b5\u0391-\u03A9\u03B1-\u03C9\u03D1\u03D5\u03D6\u03F1\u03F5]/u;
const LATIN_IDENTIFIER_START_REGEX = /[A-Za-z]/u;
const NUMBER_TOKEN_START_REGEX = /\d/u;
const SCIENTIFIC_FUNCTION_REGEX = /\b(?:sin|cos|tan|cot|sec|csc|ln|log|exp|max|min|mod|lim)\b/giu;
const SCIENTIFIC_FUNCTION_NAMES = new Set(["sin", "cos", "tan", "cot", "sec", "csc", "ln", "log", "exp", "max", "min", "mod", "lim"]);
const SCIENTIFIC_UNIT_GLOBAL_REGEX =
  /(?:°C|°F|mmol\/L|mol\/L|mg\/L|g\/L|kg\/m(?:3|³)|m\/s(?:2|²)?|cm(?:2|²)|cm(?:3|³)|m(?:2|²)|m(?:3|³)|kHz|MHz|GHz|mL|cL|dL|kg|mg|µg|ug|ng|km|cm|mm|mol|mmol|min|Hz|Pa|ohm|Ω|\b(?:m|s|h|L|A|V|W|J|N)\b)/gu;
const SCIENTIFIC_UNIT_NAMES = new Set([
  "mmol/l",
  "mol/l",
  "mg/l",
  "g/l",
  "kg/m3",
  "kg/m³",
  "m/s2",
  "m/s²",
  "cm2",
  "cm²",
  "cm3",
  "cm³",
  "m2",
  "m²",
  "m3",
  "m³",
  "khz",
  "mhz",
  "ghz",
  "ml",
  "cl",
  "dl",
  "kg",
  "mg",
  "µg",
  "ug",
  "ng",
  "km",
  "cm",
  "mm",
  "mol",
  "mmol",
  "min",
  "hz",
  "pa",
  "ohm",
  "ω",
  "°c",
  "°f",
  "m",
  "s",
  "h",
  "l",
  "a",
  "v",
  "w",
  "j",
  "n"
]);
const DOCUMENT_LABEL_REGEX = /\b(?:livre|fable|page|chapitre|cycle|litt[eé]rature|po[eè]me|sc[eè]ne|acte|partie|tome|section|volume)\b/iu;
const ROMAN_NUMERAL_REGEX = /\b[IVXLCDM]+\b/gu;
const ADMIN_REFERENCE_REGEX =
  /\b(?:article|arr[eê]t[eé]|rectoral|acad[eé]mie|recours|commission|d[eé]cision|affectation|extrait|certifi[eé]|conforme|code|adresse|avenue|recteur|secr[eé]taire|voie|d[eé]lai|conditions?)\b/iu;
const DATE_REFERENCE_REGEX = /\b\d{1,2}\s*[-/.]\s*\d{1,2}\s*[-/.]\s*\d{2,4}\b/u;
const FINANCIAL_TABLE_REGEX =
  /\b(?:base\s+de\s+remboursement|brss|br\b|garantie(?:s)?|forfait(?:s)?|euro(?:s)?|€|remboursement(?:s)?|s[ée]curit[ée]\s+sociale|mutualiste(?:s)?|mutuelle|sant[ée]|panier\s+de\s+soins|optionnelle(?:s)?|honoraires|cotisation|prise\s+en\s+charge|tarif(?:s)?|montant(?:s)?)\b/iu;
const PERCENT_VALUE_REGEX = /\d+\s*%/g;
const SCIENTIFIC_SINGLE_LETTER_UNITS = new Set(["m", "s", "h", "l", "a", "v", "w", "j", "n"]);
const EXTENDED_FINANCIAL_TABLE_REGEX =
  /\b(?:frais\s+r[ée]els|frais\s+de\s+s[ée]jour|optam(?:-aco)?|praticien|hospitalisation|soins\s+courants|convention\s+nationale)\b/iu;
const PEDAGOGICAL_SYLLABLE_SEPARATOR_REGEX = /[·⋅•]/gu;
const PEDAGOGICAL_SYLLABLE_PATTERN_REGEX = /\p{L}\s*[·⋅•]\s*\p{L}/u;
const REFERENCE_CODE_REGEX = /^(?:[A-Z]{2,}(?:\s+[A-Z]{1,4})?|\b[A-Z]{2,}\b)(?:\s*-\s*[A-Z]?\d[\w./-]*){1,4}$/u;

const GREEK_LETTER_SPEECH = new Map([
  ["\u0391", "alpha"],
  ["\u03B1", "alpha"],
  ["\u0392", "beta"],
  ["\u03B2", "beta"],
  ["\u0393", "gamma"],
  ["\u03B3", "gamma"],
  ["\u0394", "delta"],
  ["\u03B4", "delta"],
  ["\u0395", "epsilon"],
  ["\u03B5", "epsilon"],
  ["\u03F5", "epsilon"],
  ["\u0396", "zeta"],
  ["\u03B6", "zeta"],
  ["\u0397", "eta"],
  ["\u03B7", "eta"],
  ["\u0398", "theta"],
  ["\u03B8", "theta"],
  ["\u0399", "iota"],
  ["\u03B9", "iota"],
  ["\u039A", "kappa"],
  ["\u03BA", "kappa"],
  ["\u039B", "lambda"],
  ["\u03BB", "lambda"],
  ["\u039C", "mu"],
  ["\u03BC", "mu"],
  ["\u00B5", "mu"],
  ["\u039D", "nu"],
  ["\u03BD", "nu"],
  ["\u039E", "xi"],
  ["\u03BE", "xi"],
  ["\u039F", "omicron"],
  ["\u03BF", "omicron"],
  ["\u03A0", "pi"],
  ["\u03C0", "pi"],
  ["\u03A1", "rho"],
  ["\u03C1", "rho"],
  ["\u03F1", "rho"],
  ["\u03A3", "sigma"],
  ["\u03C3", "sigma"],
  ["\u03C2", "sigma"],
  ["\u03A4", "tau"],
  ["\u03C4", "tau"],
  ["\u03A5", "upsilon"],
  ["\u03C5", "upsilon"],
  ["\u03A6", "phi"],
  ["\u03C6", "phi"],
  ["\u03D5", "phi"],
  ["\u03A7", "chi"],
  ["\u03C7", "chi"],
  ["\u03A8", "psi"],
  ["\u03C8", "psi"],
  ["\u03A9", "omega"],
  ["\u03C9", "omega"]
]);

const SCIENTIFIC_FUNCTION_SPEECH = [
  [/\bsin\b/giu, " sinus "],
  [/\bcos\b/giu, " cosinus "],
  [/\btan\b/giu, " tangente "],
  [/\bcot\b/giu, " cotangente "],
  [/\bsec\b/giu, " secante "],
  [/\bcsc\b/giu, " cosecante "],
  [/\bln\b/giu, " logarithme neperien "],
  [/\blog\b/giu, " logarithme "],
  [/\bexp\b/giu, " exponentielle "],
  [/\blim\b/giu, " limite "],
  [/\bmod\b/giu, " modulo "],
  [/\bmax\b/giu, " maximum "],
  [/\bmin\b/giu, " minimum "]
];

const SCIENTIFIC_UNIT_SPEECH = [
  [/mmol\/L/giu, " millimoles par litre "],
  [/mol\/L/giu, " moles par litre "],
  [/mg\/L/giu, " milligrammes par litre "],
  [/g\/L/giu, " grammes par litre "],
  [/kg\/m(?:3|³)/giu, " kilogrammes par metre cube "],
  [/m\/s(?:2|²)/giu, " metres par seconde carree "],
  [/m\/s/giu, " metres par seconde "],
  [/cm(?:2|²)/giu, " centimetres carres "],
  [/cm(?:3|³)/giu, " centimetres cubes "],
  [/m(?:2|²)/giu, " metres carres "],
  [/m(?:3|³)/giu, " metres cubes "],
  [/kHz/giu, " kilohertz "],
  [/MHz/giu, " megahertz "],
  [/GHz/giu, " gigahertz "],
  [/mL/giu, " millilitres "],
  [/cL/giu, " centilitres "],
  [/dL/giu, " decilitres "],
  [/°C/giu, " degres Celsius "],
  [/°F/giu, " degres Fahrenheit "],
  [/\bkg\b/giu, " kilogrammes "],
  [/\bmg\b/giu, " milligrammes "],
  [/\bµg\b/gu, " microgrammes "],
  [/\bug\b/giu, " microgrammes "],
  [/\bng\b/giu, " nanogrammes "],
  [/\bkm\b/giu, " kilometres "],
  [/\bcm\b/giu, " centimetres "],
  [/\bmm\b/giu, " millimetres "],
  [/\bmol\b/giu, " moles "],
  [/\bmmol\b/giu, " millimoles "],
  [/\bmin\b/giu, " minutes "],
  [/\bHz\b/giu, " hertz "],
  [/\bPa\b/giu, " pascals "],
  [/\bohm\b/giu, " ohms "],
  [/Ω/gu, " ohms "]
];

const SPEECH_REPLACEMENTS = [
  [/\u00b0\s*C/gi, " degres Celsius "],
  [/\u00b0/g, " degre "],
  [/≤/g, " inférieur ou égal à "],
  [/≥/g, " supérieur ou égal à "],
  [/≠/g, " différent de "],
  [/≈/g, " environ égal à "],
  [/→/g, " tend vers "],
  [/↔/g, " equivalent a "],
  [/∝/g, " proportionnel a "],
  [/=/g, " égal à "],
  [/\+/g, " plus "],
  [/−/g, " moins "],
  [/-/g, " moins "],
  [/×/g, " fois "],
  [/·/g, " fois "],
  [/⋅/g, " fois "],
  [/\*/g, " fois "],
  [/÷/g, " divisé par "],
  [/\//g, " sur "],
  [/√/g, " racine de "],
  [/∑/g, " somme "],
  [/∫/g, " intégrale "],
  [/∞/g, " infini "],
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

function normalizeScientificGlyphs(value) {
  return String(value)
    .normalize("NFC")
    .replace(/\u00b5/g, "\u03bc")
    .replace(/\u03f5/g, "\u03b5")
    .replace(/\u03f1/g, "\u03c1")
    .replace(/\u03d5/g, "\u03c6")
    .replace(/\u2206/g, "\u0394");
}

function verbalizeGreekLetters(value) {
  return [...String(value)].map((character) => GREEK_LETTER_SPEECH.get(character) || character).join("");
}

function verbalizeScientificWords(value) {
  let output = String(value);
  for (const [pattern, replacement] of SCIENTIFIC_FUNCTION_SPEECH) {
    output = output.replace(pattern, replacement);
  }
  return output;
}

function normalizeUnitToken(token) {
  return normalizeScientificGlyphs(String(token))
    .replace(/\u00b2/g, "2")
    .replace(/\u00b3/g, "3")
    .toLowerCase();
}

function isScientificUnitName(normalizedToken) {
  return (
    SCIENTIFIC_UNIT_NAMES.has(normalizedToken) ||
    [
      "kg/m3",
      "m/s2",
      "m/s",
      "cm2",
      "cm3",
      "m2",
      "m3",
      "\u03bcg",
      "\u03c9",
      "\u00b0c",
      "\u00b0f"
    ].includes(normalizedToken)
  );
}

function getScientificUnitSpeech(token) {
  const normalized = normalizeUnitToken(token);
  const normalizedLookup = {
    "mmol/l": " millimoles par litre ",
    "mol/l": " moles par litre ",
    "mg/l": " milligrammes par litre ",
    "g/l": " grammes par litre ",
    "kg/m3": " kilogrammes par metre cube ",
    "m/s2": " metres par seconde carree ",
    "m/s": " metres par seconde ",
    cm2: " centimetres carres ",
    cm3: " centimetres cubes ",
    m2: " metres carres ",
    m3: " metres cubes ",
    khz: " kilohertz ",
    mhz: " megahertz ",
    ghz: " gigahertz ",
    ml: " millilitres ",
    cl: " centilitres ",
    dl: " decilitres ",
    "\u00b0c": " degres Celsius ",
    "\u00b0f": " degres Fahrenheit ",
    kg: " kilogrammes ",
    mg: " milligrammes ",
    "\u03bcg": " microgrammes ",
    ug: " microgrammes ",
    ng: " nanogrammes ",
    km: " kilometres ",
    cm: " centimetres ",
    mm: " millimetres ",
    mol: " moles ",
    mmol: " millimoles ",
    min: " minutes ",
    hz: " hertz ",
    pa: " pascals ",
    ohm: " ohms ",
    "\u03c9": " ohms ",
    m: " metres ",
    s: " secondes ",
    h: " heures ",
    l: " litres ",
    a: " amperes ",
    v: " volts ",
    w: " watts ",
    j: " joules ",
    n: " newtons "
  };

  if (normalizedLookup[normalized]) {
    return normalizedLookup[normalized];
  }

  for (const [pattern, replacement] of SCIENTIFIC_UNIT_SPEECH) {
    if (pattern.test(token)) {
      pattern.lastIndex = 0;
      return replacement;
    }
    pattern.lastIndex = 0;
  }

  return (
    {
      m: " metres ",
      s: " secondes ",
      h: " heures ",
      l: " litres ",
      a: " amperes ",
      v: " volts ",
      w: " watts ",
      j: " joules ",
      n: " newtons "
    }[normalized] || token
  );
}

function getAdjacentSignificantCharacter(source, startIndex, direction) {
  let cursor = direction < 0 ? startIndex - 1 : startIndex;
  while (cursor >= 0 && cursor < source.length) {
    const character = source[cursor];
    if (!/\s/u.test(character)) {
      return character;
    }
    cursor += direction;
  }
  return "";
}

function isLetterLikeCharacter(character) {
  return /[\p{L}\p{M}]/u.test(character || "");
}

function isLikelyUnitContext(source, startIndex, endIndex) {
  const previousCharacter = getAdjacentSignificantCharacter(source, startIndex, -1);
  const nextCharacter = getAdjacentSignificantCharacter(source, endIndex, 1);
  const previousRawCharacter = source[startIndex - 1] || "";
  const nextRawCharacter = source[endIndex] || "";
  const token = source.slice(startIndex, endIndex);
  const normalizedToken = normalizeUnitToken(token);

  if (isLetterLikeCharacter(previousRawCharacter) || isLetterLikeCharacter(nextRawCharacter)) {
    return false;
  }

  if (/[’']/u.test(previousCharacter) || /[’']/u.test(nextCharacter) || /[’']/u.test(previousRawCharacter) || /[’']/u.test(nextRawCharacter)) {
    return false;
  }

  if (!SCIENTIFIC_SINGLE_LETTER_UNITS.has(normalizedToken)) {
    if (/[\/\u00b2\u00b3]/u.test(token) || /^\u00b0/u.test(token)) {
      return true;
    }

    if (/[\d)\]\u00b0/%=<>]/u.test(previousCharacter)) {
      return true;
    }

    if (/[\d(]/u.test(nextCharacter)) {
      return true;
    }

    return /[:;,([{\-+*/]/u.test(previousCharacter) && (!nextCharacter || /[.,;:)\]}]/u.test(nextCharacter));
  }

  if (/[\d)\]\u00b0/%]/u.test(previousCharacter)) {
    return true;
  }

  if (/[\/\u00b2\u00b3]/u.test(token)) {
    return true;
  }

  if (/[\d(]/u.test(nextCharacter)) {
    return true;
  }

  return false;
}

function readScientificUnitToken(source, startIndex) {
  if (!/[A-Za-z\u00b5\u03bc\u03a9\u03c9\u00b0]/u.test(source[startIndex])) {
    return null;
  }

  let cursor = startIndex;
  while (cursor < source.length && /[A-Za-z0-9\u00b5\u03bc\u03a9\u03c9\u00b0/\u00b2\u00b3]/u.test(source[cursor])) {
    cursor += 1;
  }

  const value = source.slice(startIndex, cursor);
  if (!value) {
    return null;
  }

  const normalized = normalizeUnitToken(value);
  if (!isScientificUnitName(normalized)) {
    return null;
  }

  return {
    value,
    endIndex: cursor
  };
}

function countScientificUnits(text) {
  const source = normalizeMathNotation(text);
  let count = 0;

  for (let index = 0; index < source.length; index += 1) {
    const unitToken = readScientificUnitToken(source, index);
    if (!unitToken || !isLikelyUnitContext(source, index, unitToken.endIndex)) {
      continue;
    }

    count += 1;
    index = unitToken.endIndex - 1;
  }

  return count;
}

function verbalizeScientificUnits(value) {
  const source = String(value);
  let output = "";

  for (let index = 0; index < source.length; index += 1) {
    const unitToken = readScientificUnitToken(source, index);
    if (unitToken && isLikelyUnitContext(source, index, unitToken.endIndex)) {
      output += getScientificUnitSpeech(unitToken.value);
      index = unitToken.endIndex - 1;
      continue;
    }

    output += source[index];
  }

  return output;
}

function isLikelyDocumentLabel(text, stats) {
  const source = String(text).trim();
  if (!source || !DOCUMENT_LABEL_REGEX.test(source)) {
    return false;
  }

  const wordCount = countMatches(/\b[\p{L}]{3,}\b/gu, source);
  const romanCount = countMatches(ROMAN_NUMERAL_REGEX, source);
  const pageLikeCount = countMatches(/\b(?:page|fable|chapitre|cycle|tome|partie)\s+\d+\b/giu, source);
  const containsEquationHint = /[=≈≤≥<>×÷*/^_→↔∝]/u.test(source);

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
    stats.strongSymbolCount >= 2 ||
    stats.greekLetterCount > 0;

  return !hasStrongMathSignal && wordCount >= 2 && (hasAdminKeyword || hasDateReference);
}

function isLikelyReferenceCode(text, stats) {
  const source = String(text).trim();
  if (!source || !REFERENCE_CODE_REGEX.test(source)) {
    return false;
  }

  const hasStrongMathSignal =
    stats.equationCount > 0 ||
    stats.hasSuperscriptNotation ||
    stats.greekLetterCount > 0 ||
    (stats.variableCount >= 2 && stats.strongSymbolCount >= 2);

  return !hasStrongMathSignal;
}

function isLikelyLegendDefinition(text, stats) {
  const source = String(text).trim();
  if (!source) {
    return false;
  }

  const match = source.match(/^([A-Z]{1,6})\s*=\s*(.+)$/u);
  if (!match) {
    return false;
  }

  const definition = match[2].trim();
  const definitionWordCount = countMatches(/\b[\p{L}]{2,}\b/gu, definition);
  const hasStrongMathSignal =
    stats.hasSuperscriptNotation ||
    stats.greekLetterCount > 0 ||
    stats.fractionHint ||
    /\d/u.test(definition);

  return definitionWordCount >= 2 && !hasStrongMathSignal;
}

function isLikelyPedagogicalSyllableText(text, stats) {
  const source = String(text).trim();
  if (!source) {
    return false;
  }

  const middotCount = countMatches(PEDAGOGICAL_SYLLABLE_SEPARATOR_REGEX, source);
  const singleLetterCount = countMatches(/\b[\p{L}\p{M}]\b/gu, source);
  const lexicalWordCount = countMatches(/\b[\p{L}\p{M}]{2,}\b/gu, source);
  const hasMathScaffold =
    stats.equationCount > 0 ||
    stats.hasSuperscriptNotation ||
    stats.greekLetterCount > 0 ||
    /[=<>()[\]{}]/u.test(source);
  const hasRichReadingContext = source.length >= 12 || singleLetterCount >= 4 || lexicalWordCount >= 2;
  const isCompactMultiplicationLike = /^\s*[\p{L}\p{M}\d]\s*[·⋅•]\s*[\p{L}\p{M}\d]\s*$/u.test(source);

  if (isCompactMultiplicationLike) {
    return false;
  }

  return !hasMathScaffold && (
    (middotCount >= 1 && hasRichReadingContext) ||
    singleLetterCount >= 6
  );
}

function isLikelyLiteraryDialogue(text, stats) {
  const source = String(text).trim();
  if (!source) {
    return false;
  }

  const hasDialogueHyphenation =
    /\b[\p{L}\p{M}]+\s*-\s*(?:je|tu|il|elle|on|nous|vous|ils|elles|moi|toi|lui|leur|y|en)\b/iu.test(source) ||
    /\b(?:t|m|l|s)\s*-\s*(?:il|elle|on|en|y)\b/iu.test(source);
  const hasStrongMathSignal =
    /\d/u.test(source) ||
    stats.equationCount > 0 ||
    stats.hasSuperscriptNotation ||
    stats.greekLetterCount > 0;

  return hasDialogueHyphenation && !hasStrongMathSignal;
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
  const hasFinancialKeyword = FINANCIAL_TABLE_REGEX.test(source) || EXTENDED_FINANCIAL_TABLE_REGEX.test(source);
  const hasRealEquationSignal =
    stats.equationCount > 0 ||
    stats.hasSuperscriptNotation ||
    (stats.fractionHint && stats.digitCount > 0 && (stats.variableCount > 0 || stats.greekLetterCount > 0)) ||
    stats.greekLetterCount > 0;
  const hasOnlyPercentLikeMathSignals = stats.strongSymbolCount <= Math.max(1, percentCount);

  if (hasRealEquationSignal) {
    return false;
  }

  if (hasFinancialKeyword && (hasPercent || hasCurrency)) {
    return true;
  }

  if (hasFinancialKeyword && !hasRealEquationSignal && wordCount >= 4) {
    return true;
  }

  if (
    percentCount >= 2 &&
    wordCount >= 1 &&
    !hasRealEquationSignal &&
    !hasCurrency &&
    stats.strongSymbolCount <= Math.max(1, percentCount + 1)
  ) {
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

function isGreekCharacter(character) {
  return GREEK_MATH_LETTER_REGEX.test(character);
}

function readNumberToken(source, startIndex) {
  let cursor = startIndex;
  while (cursor < source.length && /[\d.,]/u.test(source[cursor])) {
    cursor += 1;
  }
  return {
    value: source.slice(startIndex, cursor),
    endIndex: cursor
  };
}

function readLatinIdentifier(source, startIndex) {
  let cursor = startIndex;
  while (cursor < source.length && /[A-Za-z]/u.test(source[cursor])) {
    cursor += 1;
  }
  return {
    value: source.slice(startIndex, cursor),
    endIndex: cursor
  };
}

function renderMathInline(value) {
  const source = normalizeMathNotation(value);
  let html = "";

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const unitToken = readScientificUnitToken(source, index);

    if (unitToken && isLikelyUnitContext(source, index, unitToken.endIndex)) {
      html += `<span class="math-unit">${escapeHtml(unitToken.value)}</span>`;
      index = unitToken.endIndex - 1;
      continue;
    }

    if ((character === "^" || character === "_") && index + 1 < source.length) {
      const script = readScriptValue(source, index + 1);
      if (script.value) {
        const className = character === "^" ? "math-super" : "math-sub";
        const tagName = character === "^" ? "sup" : "sub";
        html += `<${tagName} class="${className}">${renderMathInline(script.value)}</${tagName}>`;
        index = script.endIndex - 1;
        continue;
      }
    }

    if (/\s/u.test(character)) {
      html += escapeHtml(character);
      continue;
    }

    if (INLINE_OPERATOR_REGEX.test(character)) {
      html += `<span class="math-operator">${escapeHtml(character)}</span>`;
      continue;
    }

    if (/[(){}\[\]]/u.test(character)) {
      html += `<span class="math-group">${escapeHtml(character)}</span>`;
      continue;
    }

    if (NUMBER_TOKEN_START_REGEX.test(character)) {
      const token = readNumberToken(source, index);
      html += `<span class="math-number">${escapeHtml(token.value)}</span>`;
      index = token.endIndex - 1;
      continue;
    }

    if (isGreekCharacter(character)) {
      html += `<span class="math-greek">${escapeHtml(character)}</span>`;
      continue;
    }

    if (LATIN_IDENTIFIER_START_REGEX.test(character)) {
      const token = readLatinIdentifier(source, index);
      const normalized = token.value.toLowerCase();
      const className = SCIENTIFIC_FUNCTION_NAMES.has(normalized)
        ? "math-function"
        : token.value.length === 1
          ? "math-variable"
          : "math-identifier";
      html += `<span class="${className}">${escapeHtml(token.value)}</span>`;
      index = token.endIndex - 1;
      continue;
    }

    html += escapeHtml(character);
  }

  return html;
}

export function normalizeMathNotation(value) {
  return normalizeScientificGlyphs(value)
    .replace(/[\u2000-\u200A\u202F\u205F]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*([=+\-−*/×÷·⋅±≈<>≤≥→↔∝])\s*/g, " $1 ")
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
  output = verbalizeScientificUnits(verbalizeScientificWords(verbalizeGreekLetters(output)));
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
  const greekLetterCount = countMatches(GREEK_MATH_LETTER_GLOBAL_REGEX, compactText);
  const functionCount = countMatches(SCIENTIFIC_FUNCTION_REGEX, normalizedText);
  const unitCount = countScientificUnits(normalizedText);
  const equationCount = countMatches(/[=≈<>≤≥]/g, compactText);
  const denseSymbolRatio = compactText.length > 0 ? symbolCount / compactText.length : 0;
  const hasSuperscriptNotation = SUPERSCRIPT_OR_SUBSCRIPT_REGEX.test(normalizedText);
  const fractionHint = FRACTION_HINT_REGEX.test(normalizedText);
  const baselineSpread = Number(metrics.baselineSpread || 0);
  const lineHeight = Number(metrics.lineHeight || metrics.height || 0);
  const fontSpread = Number(metrics.fontSpread || 0);
  const compactMultiplicationHint = /^\s*[\p{L}\p{M}\d]\s*[·⋅•]\s*[\p{L}\p{M}\d]\s*$/u.test(normalizedText);
  const scientificLetterSignal =
    greekLetterCount > 0 &&
    (equationCount > 0 || strongSymbolCount > 0 || digitCount > 0 || fractionHint || functionCount > 0 || variableCount > 0);
  const scientificUnitSignal =
    unitCount > 0 &&
    (digitCount > 0 || strongSymbolCount > 0 || equationCount > 0 || fractionHint || hasSuperscriptNotation);

  let mathScore = 0;
  if (strongSymbolCount > 0) {
    mathScore += Math.min(2.2, strongSymbolCount * 0.35);
  }
  if (weakSeparatorCount > 0 && (fractionHint || equationCount > 0 || variableCount > 0 || scientificLetterSignal)) {
    mathScore += Math.min(0.75, weakSeparatorCount * 0.12);
  }
  if (digitCount > 0 && (variableCount > 0 || greekLetterCount > 0)) {
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
  if (scientificLetterSignal) {
    mathScore += Math.min(1.2, 0.4 + greekLetterCount * 0.22);
  }
  if (scientificUnitSignal) {
    mathScore += Math.min(1.1, 0.28 * unitCount + 0.22);
  }
  if (functionCount > 0 && /[()]/u.test(normalizedText)) {
    mathScore += Math.min(0.9, functionCount * 0.35);
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
    strongSymbolCount,
    greekLetterCount
  });
  const looksLikeReferenceCode = isLikelyReferenceCode(normalizedText, {
    equationCount,
    hasSuperscriptNotation,
    greekLetterCount,
    variableCount,
    strongSymbolCount
  });
  const looksLikeLegendDefinition = isLikelyLegendDefinition(normalizedText, {
    hasSuperscriptNotation,
    greekLetterCount,
    fractionHint
  });
  const looksLikeFinancialTableReference = isLikelyFinancialTableReference(normalizedText, {
    equationCount,
    fractionHint,
    hasSuperscriptNotation,
    strongSymbolCount,
    digitCount,
    variableCount,
    greekLetterCount
  });
  const looksLikePedagogicalSyllableText = isLikelyPedagogicalSyllableText(normalizedText, {
    equationCount,
    hasSuperscriptNotation,
    greekLetterCount
  });
  const looksLikeLiteraryDialogue = isLikelyLiteraryDialogue(normalizedText, {
    equationCount,
    hasSuperscriptNotation,
    greekLetterCount
  });

  const containsMath =
    !looksLikeDocumentLabel &&
    !looksLikeAdministrativeReference &&
    !looksLikeReferenceCode &&
    !looksLikeLegendDefinition &&
    !looksLikePedagogicalSyllableText &&
    !looksLikeLiteraryDialogue &&
    !looksLikeFinancialTableReference &&
    (
      mathScore >= 1.45 ||
      equationCount > 0 ||
      hasSuperscriptNotation ||
      scientificLetterSignal ||
      scientificUnitSignal ||
      compactMultiplicationHint ||
      (functionCount > 0 && /[()]/u.test(normalizedText)) ||
      (digitCount > 0 && strongSymbolCount >= 2)
    );
  const isFormulaCandidate =
    !looksLikeDocumentLabel &&
    !looksLikeAdministrativeReference &&
    !looksLikeReferenceCode &&
    !looksLikeLegendDefinition &&
    !looksLikePedagogicalSyllableText &&
    !looksLikeLiteraryDialogue &&
    !looksLikeFinancialTableReference &&
    (
      mathScore >= 2.7 ||
      equationCount > 0 ||
      scientificLetterSignal ||
      scientificUnitSignal ||
      compactMultiplicationHint ||
      (functionCount > 0 && /[()]/u.test(normalizedText)) ||
      (containsMath && normalizedText.length <= 120 && denseSymbolRatio >= 0.1) ||
      (digitCount > 0 && (variableCount > 0 || greekLetterCount > 0) && strongSymbolCount >= 2)
    );

  const verificationReasons = [];
  const shouldApplyMathVerification =
    containsMath ||
    isFormulaCandidate ||
    scientificLetterSignal ||
    scientificUnitSignal ||
    equationCount > 0 ||
    hasSuperscriptNotation ||
    fractionHint ||
    compactMultiplicationHint;

  if (shouldApplyMathVerification && !hasBalancedDelimiters(normalizedText)) {
    verificationReasons.push("Parentheses ou crochets a verifier");
  }
  if (shouldApplyMathVerification && OPERATOR_CLUSTER_REGEX.test(normalizedText)) {
    verificationReasons.push("Suite d'operateurs inhabituelle");
  }
  if (shouldApplyMathVerification && baselineSpread > Math.max(3.2, lineHeight * 0.5) && !hasSuperscriptNotation) {
    verificationReasons.push("Exposant ou indice potentiellement separe");
  }
  if (shouldApplyMathVerification && fractionHint && baselineSpread > Math.max(3.4, lineHeight * 0.56)) {
    verificationReasons.push("Fraction ou empilement possiblement aplati");
  }
  if (scientificLetterSignal && normalizedText.length >= 4) {
    verificationReasons.push("Lettres grecques ou symboles scientifiques a relire");
  }
  if (scientificUnitSignal && normalizedText.length >= 4) {
    verificationReasons.push("Unites ou notations scientifiques a relire");
  }
  if (isFormulaCandidate && denseSymbolRatio >= 0.24 && normalizedText.length >= 18) {
    verificationReasons.push("Expression mathematique dense a relire");
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
      greekLetterCount,
      functionCount,
      unitCount,
      equationCount,
      denseSymbolRatio,
      baselineSpread,
      fontSpread
    },
    looksLikeFinancialTableReference
  };
}

function renderMathLine(line) {
  return renderMathInline(line);
}

export function renderMathText(value) {
  return String(value)
    .split(/\n+/)
    .map((line) => renderMathLine(line))
    .join("<br />");
}
