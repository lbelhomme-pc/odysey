import {
  analyzeFrenchWord,
  normalizeSyllabificationMode,
  normalizeSyllableLevel,
  normalizeSyllableWordScope,
  shouldDisplaySyllables
} from "./syllabify-french.mjs";
import {
  classifyPhoneme,
  getKnownGraphemes,
  getPhonemeCssToken,
  isInconsistentGrapheme,
  resolveGraphemePhoneme
} from "./phoneme-reference.mjs";

const WORD_TOKEN_REGEX = /(\s+|[\p{L}]+(?:['\u2019][\p{L}]+)?|[0-9]+|[^\s\p{L}0-9])/gu;
const LETTER_REGEX = /\p{L}/u;
const UPPERCASE_WORD_REGEX = /^[\p{Lu}\u00c0-\u00de-]{2,}$/u;
const TABLE_OF_CONTENTS_ENTRY_REGEX = /\bLivre\s+[IVXLCDM]+\s*-\s*Fable\s+\d+\s+page\s+\d+\b/iu;
const ADMIN_KEYWORD_REGEX =
  /\b(?:acad[eé]mie|adresse|adolphe|affectation|arr[eê]t[eé]|avenue|cap|cert(?:ificat)?|collectif|croix|extrait|individuel|isnard|nice|recteur|rectoral|serrat|zone)\b/iu;
const ADDRESS_OR_CODE_REGEX = /\b(?:\d{5}|\d{7}[A-Z]|\d{1,4}[A-Z]{1,3})\b/u;

export const PEDAGOGIC_COLORATION_MODES = new Set([
  "pedagogique",
  "pedagogiqueAlt",
  "pedagogiqueContrast",
  "sonsFrancais"
]);
const SUPPORTED_COLORATION_MODES = new Set([
  "none",
  "pedagogique",
  "pedagogiqueAlt",
  "pedagogiqueContrast",
  "sonsFrancais",
  "alternanceLignes",
  "alternanceMots",
  "noirEtBlanc"
]);
const BACKGROUND_PATTERN_MODES = new Set(["alternanceLignes", "alternanceMots", "noirEtBlanc"]);
const KNOWN_GRAPHEME_PATTERNS = getKnownGraphemes(5);

const STOPWORDS = new Set([
  "a",
  "afin",
  "ainsi",
  "alors",
  "au",
  "aucun",
  "aussi",
  "autre",
  "avec",
  "bien",
  "car",
  "ce",
  "cela",
  "ces",
  "cet",
  "cette",
  "chez",
  "comme",
  "comment",
  "dans",
  "de",
  "des",
  "du",
  "elle",
  "elles",
  "en",
  "entre",
  "est",
  "et",
  "etre",
  "eux",
  "ici",
  "il",
  "ils",
  "je",
  "la",
  "le",
  "les",
  "leur",
  "leurs",
  "lui",
  "mais",
  "me",
  "mes",
  "moi",
  "mon",
  "ne",
  "nos",
  "notre",
  "nous",
  "on",
  "ou",
  "par",
  "pas",
  "pour",
  "qu",
  "que",
  "qui",
  "sa",
  "se",
  "ses",
  "son",
  "sous",
  "sur",
  "ta",
  "te",
  "tes",
  "toi",
  "ton",
  "tu",
  "un",
  "une",
  "vers",
  "vos",
  "votre",
  "vous",
  "y"
]);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeWord(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeGraphemeKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFC");
}

export function normalizeColorationMode(value) {
  if (value === "grammar") {
    return "pedagogique";
  }
  if (value === "alternanceMotsNB") {
    return "noirEtBlanc";
  }
  return SUPPORTED_COLORATION_MODES.has(value) ? value : "none";
}

function tokenizeForColoring(text) {
  const source = String(text);
  const tokens = [];
  const matcher = new RegExp(WORD_TOKEN_REGEX.source, "gu");
  let match;

  while ((match = matcher.exec(source)) !== null) {
    const value = match[0];
    const type = /^\s+$/u.test(value) ? "space" : LETTER_REGEX.test(value) ? "word" : "punct";
    tokens.push({
      value,
      type,
      start: match.index,
      end: match.index + value.length
    });
  }

  return tokens;
}

function containsVowel(text) {
  return /[aeiouy\u00e0\u00e2\u00e4\u00e9\u00e8\u00ea\u00eb\u00ee\u00ef\u00f4\u00f6\u00f9\u00fb\u00fc\u00ff\u0153\u00e6]/iu.test(text);
}

function getPhonemeColorClass(unit) {
  const checksum = [...unit.normalized].reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
  return checksum % 2 === 0 ? "syllabe1" : "syllabe2";
}

function getFrenchSoundClass(phonemeCode, unit) {
  switch (classifyPhoneme(phonemeCode)) {
    case "nasal":
      return "sound-nasal";
    case "semivowel":
      return "sound-semivowel";
    case "vowel":
      return "sound-vowel";
    case "silent":
      return "sound-silent";
    case "consonant":
      return "sound-consonant";
    default:
      if (containsVowel(unit.text) || containsVowel(unit.normalized)) {
        return "sound-vowel";
      }
      return "sound-complex";
  }
}

function splitIntoPhonemeUnits(word) {
  const units = [];
  const source = String(word);
  const lower = normalizeGraphemeKey(source);
  let index = 0;

  while (index < source.length) {
    let matched = "";
    for (const pattern of KNOWN_GRAPHEME_PATTERNS) {
      if (lower.startsWith(pattern, index)) {
        matched = source.slice(index, index + pattern.length);
        break;
      }
    }

    if (!matched) {
      matched = source[index];
    }

    units.push({
      text: matched,
      key: normalizeGraphemeKey(matched),
      normalized: normalizeWord(matched),
      start: index,
      end: index + matched.length
    });
    index += matched.length;
  }

  return units;
}

function isImportantWord(word, blockType) {
  if (shouldKeepWordPlain(word)) {
    return false;
  }

  const normalizedWord = normalizeWord(word).replaceAll(/['\u2019]/gu, "");
  if (!normalizedWord || STOPWORDS.has(normalizedWord)) {
    return false;
  }

  if (blockType === "heading" && normalizedWord.length >= 4) {
    return true;
  }

  return /^\p{Lu}{3,}$/u.test(word) || normalizedWord.length >= 8;
}

function countUppercaseWords(text) {
  const words = String(text).match(/\b[\p{L}-]{2,}\b/gu) || [];
  if (words.length === 0) {
    return 0;
  }

  return words.filter((word) => UPPERCASE_WORD_REGEX.test(word)).length;
}

function looksLikeAdministrativeBlock(text, blockType) {
  if (blockType === "formula" || blockType === "table") {
    return false;
  }

  const source = String(text || "").trim();
  if (!source) {
    return false;
  }

  const wordMatches = source.match(/\b[\p{L}-]{2,}\b/gu) || [];
  const uppercaseWordCount = countUppercaseWords(source);
  const uppercaseRatio = wordMatches.length > 0 ? uppercaseWordCount / wordMatches.length : 0;
  const hasAdminKeyword = ADMIN_KEYWORD_REGEX.test(source);
  const hasAddressOrCode = ADDRESS_OR_CODE_REGEX.test(source);
  const hasPipeSeparator = source.includes("|");
  const hasDenseUppercaseRun = /(?:\b[\p{Lu}\u00c0-\u00de-]{4,}\b(?:\s+|$)){3,}/u.test(source);

  return (
    (hasAdminKeyword && (hasAddressOrCode || hasPipeSeparator || uppercaseRatio >= 0.4)) ||
    (hasAddressOrCode && uppercaseRatio >= 0.5) ||
    hasDenseUppercaseRun
  );
}

function looksLikeStructuralBlock(text, blockType) {
  if (blockType === "formula" || blockType === "table") {
    return false;
  }

  const source = String(text || "").trim();
  if (!source) {
    return false;
  }

  if (blockType === "heading") {
    return true;
  }

  if (TABLE_OF_CONTENTS_ENTRY_REGEX.test(source)) {
    return true;
  }

  if (/^(?:Sommaire|Cycle\s+\d+|Fables?|Livre\s+[IVXLCDM]+)$/iu.test(source)) {
    return true;
  }

  const words = source.match(/\b[\p{L}'’.-]+\b/gu) || [];
  if (words.length === 0 || words.length > 5 || /[,:;!?]/u.test(source)) {
    return false;
  }

  return words.every((word) => {
    const normalized = normalizeWord(word).replaceAll(/['\u2019]/gu, "");
    if (!normalized) {
      return true;
    }

    if (["de", "du", "des", "la", "le", "les", "et", "d", "l"].includes(normalized)) {
      return true;
    }

    return /^[\p{Lu}\u00c0-\u00de]/u.test(word);
  });
}

function shouldKeepWordPlain(word, blockAssistDisabled = false) {
  const source = String(word || "");
  if (!source) {
    return true;
  }

  if (blockAssistDisabled) {
    return true;
  }

  if (/\d/u.test(source)) {
    return true;
  }

  if (UPPERCASE_WORD_REGEX.test(source)) {
    return true;
  }

  if (/^[\p{Lu}][\p{Ll}]{0,2}$/u.test(source)) {
    return true;
  }

  return false;
}

function renderSyllableSeparator(syllableBreakMode, isLast) {
  if (isLast || syllableBreakMode === "none") {
    return "";
  }

  const separator = syllableBreakMode === "hyphen" ? "-" : "\u00b7";
  return `<span class="syllable-separator syllable-separator--${syllableBreakMode}" aria-hidden="true">${separator}</span>`;
}

function getWordPatternValue(colorationMode, wordIndex) {
  if (!BACKGROUND_PATTERN_MODES.has(colorationMode)) {
    return "";
  }
  return wordIndex % 2 === 0 ? "a" : "b";
}

function renderPhonemeUnits(text, { colorationMode = "pedagogique", soundColorMode = "soft", fallbackClass = "syllabe1" } = {}) {
  return splitIntoPhonemeUnits(text)
    .map((unit) => {
      if (colorationMode === "sonsFrancais") {
        const association = resolveGraphemePhoneme(unit.key, text, unit.start);
        const phonemeCode = association?.phoneme || unit.key;
        const soundClass = association?.classification
          ? getFrenchSoundClass(phonemeCode, unit)
          : containsVowel(unit.text) || containsVowel(unit.normalized)
            ? "sound-vowel"
            : "sound-complex";
        const toneClass =
          soundColorMode === "monoStrong"
            ? "sound-mono-strong"
            : soundColorMode === "mono"
            ? "sound-mono"
            : soundColorMode === "vivid"
              ? "sound-vivid"
              : soundColorMode === "strong"
                ? "sound-strong"
                : "sound-soft";
        const phonemeToken = getPhonemeCssToken(phonemeCode);
        const inconsistentClass = association?.inconsistent || isInconsistentGrapheme(unit.key) ? " phoneme-inconsistent" : "";
        const tooltip = association?.phonemeMeta
          ? `${association.phonemeMeta.label} écrit « ${unit.text} »${association.example ? ` comme dans ${association.example}` : ""}`
          : "";
        return `<span class="phoneme sound ${soundClass} ${toneClass} sound-phoneme-${phonemeToken}${inconsistentClass}" data-phoneme="${escapeHtml(phonemeCode)}" data-grapheme="${escapeHtml(unit.text)}"${tooltip ? ` title="${escapeHtml(tooltip)}"` : ""}>${escapeHtml(unit.text)}</span>`;
      }
      const phonemeClass = fallbackClass || getPhonemeColorClass(unit);
      return `<span class="phoneme ${phonemeClass}">${escapeHtml(unit.text)}</span>`;
    })
    .join("");
}

function renderPlainSyllables(syllables, syllableBreakMode) {
  return syllables
    .map((syllable, syllableIndex) => {
      const separator = renderSyllableSeparator(syllableBreakMode, syllableIndex === syllables.length - 1);
      return `<span class="syllable-chunk">${escapeHtml(syllable)}</span>${separator}`;
    })
    .join("");
}

function renderPedagogicSyllables(syllables, { colorationMode = "pedagogique", soundColorMode = "soft", syllableBreakMode = "none" } = {}) {
  return syllables
    .map((syllable, syllableIndex) => {
      const syllableClass = syllableIndex % 2 === 0 ? "syllabe1" : "syllabe2";
      const content = renderPhonemeUnits(syllable, {
        colorationMode,
        soundColorMode,
        fallbackClass: syllableClass
      });
      const separator = renderSyllableSeparator(syllableBreakMode, syllableIndex === syllables.length - 1);
      return `<span class="syllabe ${syllableClass}">${content}</span>${separator}`;
    })
    .join("");
}

function renderWordCore(
  source,
  blockType,
  {
    colorationMode = "none",
    soundColorMode = "soft",
    syllableBreakMode = "none",
    syllableLevel = "off",
    syllabificationMode = "pedagogique",
    syllableWordScope = "auto",
    blockAssistDisabled = false
  } = {}
) {
  if (shouldKeepWordPlain(source, blockAssistDisabled)) {
    return escapeHtml(source);
  }

  const normalizedMode = normalizeColorationMode(colorationMode);
  if (BACKGROUND_PATTERN_MODES.has(normalizedMode)) {
    return escapeHtml(source);
  }
  const normalizedLevel = normalizeSyllableLevel(syllableLevel);
  if (normalizedMode === "none" && normalizedLevel === "off") {
    return escapeHtml(source);
  }

  const analysis = analyzeFrenchWord(source, { mode: syllabificationMode });
  const pedagogicColorationActive =
    normalizedMode === "pedagogique" ||
    normalizedMode === "pedagogiqueAlt" ||
    normalizedMode === "pedagogiqueContrast";
  const showSyllables =
    shouldDisplaySyllables(analysis, {
      level: syllableLevel,
      wordScope: syllableWordScope
    }) ||
    (pedagogicColorationActive && analysis.syllables.length > 1);
  const silentMarkup = analysis.silentEnding ? `<span class="muet">${escapeHtml(analysis.silentEnding)}</span>` : "";

  if (!showSyllables) {
    if (normalizedMode === "sonsFrancais") {
      return `${renderPhonemeUnits(analysis.core || source, {
        colorationMode: normalizedMode,
        soundColorMode,
        fallbackClass: "syllabe1"
      })}${silentMarkup}`;
    }

    return `${escapeHtml(analysis.core || source)}${silentMarkup}`;
  }

  const visibleSyllables = [...analysis.syllables];
  if (analysis.silentEnding) {
    visibleSyllables[visibleSyllables.length - 1] += analysis.silentEnding;
  }

  if (!PEDAGOGIC_COLORATION_MODES.has(normalizedMode)) {
    return renderPlainSyllables(visibleSyllables, syllableBreakMode);
  }

  return renderPedagogicSyllables(visibleSyllables, {
    colorationMode: normalizedMode,
    soundColorMode,
    syllableBreakMode
  });
}

function renderAdaptedWord(
  token,
  blockType,
  {
    colorationMode = "pedagogique",
    soundColorMode = "soft",
    syllableBreakMode = "none",
    syllableLevel = "off",
    syllabificationMode = "pedagogique",
    syllableWordScope = "auto",
    audioTracking = false,
    audioState = null,
    visualPatternState = null,
    annotationRanges = [],
    blockAssistDisabled = false,
    sourceOffset = 0
  } = {}
) {
  const word = token.value;
  const wordIndex = audioTracking && audioState ? audioState.index++ : null;
  const visualIndex = visualPatternState ? visualPatternState.index++ : 0;
  const sourceStart = token.start + sourceOffset;
  const sourceEnd = token.end + sourceOffset;
  const lookupAttributes = `data-lookup-word="${escapeHtml(word)}" data-source-start="${sourceStart}" data-source-end="${sourceEnd}"`;
  const parts = String(word).split(/(['\u2019])/u);
  const activeAnnotation = annotationRanges.find((range) => sourceStart < range.end && sourceEnd > range.start);
  const annotationClass = activeAnnotation ? ` is-annotated text-annotation--${activeAnnotation.color}` : "";
  const importantClass = isImportantWord(word, blockType) && !blockAssistDisabled ? " important" : "";
  const wordPatternValue = getWordPatternValue(normalizeColorationMode(colorationMode), visualIndex);
  const content = parts
    .map((part) => {
      if (!part) {
        return "";
      }
      if (/^['\u2019]$/u.test(part)) {
        return escapeHtml(part);
      }
      if (!LETTER_REGEX.test(part)) {
        return escapeHtml(part);
      }

      if (shouldKeepWordPlain(part, blockAssistDisabled)) {
        return `<span class="word-adapted${annotationClass}">${escapeHtml(part)}</span>`;
      }

      const inner = renderWordCore(part, blockType, {
        colorationMode,
        soundColorMode,
        syllableBreakMode,
        syllableLevel,
        syllabificationMode,
        syllableWordScope,
        blockAssistDisabled
      });
      return `<span class="word-adapted${importantClass}${annotationClass}">${inner}</span>`;
    })
    .join("");

  if (!audioTracking) {
    return `<span class="word-select-target"${wordPatternValue ? ` data-word-pattern="${wordPatternValue}"` : ""} ${lookupAttributes}>${content}</span>`;
  }

  return `<span class="word-audio-track word-select-target${annotationClass}"${wordPatternValue ? ` data-word-pattern="${wordPatternValue}"` : ""} data-audio-word-index="${wordIndex}" ${lookupAttributes}>${content}</span>`;
}

export function renderAdaptedText(
  text,
  {
    colorationMode = "none",
    soundColorMode = "soft",
    syllableBreakMode = "none",
    syllableLevel = "off",
    syllabificationMode = "pedagogique",
    syllableWordScope = "auto",
    blockType = "paragraph",
    audioTracking = false,
    wordIndexOffset = 0,
    sourceOffset = 0,
    visualPatternState = null,
    annotationRanges = []
  } = {}
) {
  const normalizedMode = normalizeColorationMode(colorationMode);
  const normalizedLevel = normalizeSyllableLevel(syllableLevel);
  const normalizedSyllabificationMode = normalizeSyllabificationMode(syllabificationMode);
  const normalizedSyllableWordScope = normalizeSyllableWordScope(syllableWordScope);
  const blockAssistDisabled = looksLikeAdministrativeBlock(text, blockType) || looksLikeStructuralBlock(text, blockType);
  const audioState = {
    index: wordIndexOffset
  };
  const sharedVisualPatternState = visualPatternState || { index: 0 };

  return tokenizeForColoring(text)
    .map((token) => {
      if (token.type !== "word") {
        return escapeHtml(token.value);
      }

      return renderAdaptedWord(token, blockType, {
        colorationMode: normalizedMode,
        soundColorMode,
        syllableBreakMode,
        syllableLevel: normalizedLevel,
        syllabificationMode: normalizedSyllabificationMode,
        syllableWordScope: normalizedSyllableWordScope,
        audioTracking,
        audioState,
        visualPatternState: sharedVisualPatternState,
        annotationRanges,
        blockAssistDisabled,
        sourceOffset
      });
    })
    .join("");
}
