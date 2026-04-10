let lexiconPromise = null;
const MERGED_WORD_CONNECTORS = new Set([
  "a",
  "au",
  "aux",
  "ce",
  "dans",
  "ces",
  "de",
  "des",
  "du",
  "en",
  "est",
  "et",
  "la",
  "le",
  "les",
  "ou",
  "pour",
  "que",
  "qui",
  "sa",
  "se",
  "son",
  "sur",
  "si",
  "un",
  "une"
]);
const MORPHOLOGICAL_JOIN_PREFIXES = new Set(["au", "co", "de", "et", "pre", "re", "sa"]);
const APOSTROPHE_CLITICS = ["qu", "l", "s", "t", "m", "n", "d", "j", "c"];
const EXPLODED_WORD_EXCEPTIONS = new Set(["autrefois"]);

function normalizeFrenchWord(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("œ", "oe")
    .replaceAll("æ", "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[’']/gu, "'")
    .replace(/[‐‑–—]/gu, "-");
}

function splitWordParts(word) {
  return normalizeFrenchWord(word)
    .split(/['-]/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

async function loadFrenchLexicon() {
  if (!lexiconPromise) {
    lexiconPromise = import("./french-lexicon.generated.mjs").then(({ FRENCH_LEXICON_WORDS }) => new Set(FRENCH_LEXICON_WORDS));
  }
  return lexiconPromise;
}

function getVariantCandidates(word) {
  const variants = new Set([word]);
  if (word.endsWith("s") && word.length >= 5) {
    variants.add(word.slice(0, -1));
  }
  if (word.endsWith("es") && word.length >= 6) {
    variants.add(word.slice(0, -2));
  }
  return [...variants];
}

function isUppercaseLike(token) {
  return token === token.toUpperCase();
}

function hasFrenchWordInLexicon(word, lexicon) {
  const normalized = normalizeFrenchWord(word);
  if (!normalized) {
    return false;
  }

  for (const candidate of getVariantCandidates(normalized)) {
    if (lexicon.has(candidate)) {
      return true;
    }
  }

  if (normalized.includes("'") || normalized.includes("-")) {
    const parts = splitWordParts(normalized);
    if (parts.length > 1) {
      return parts.every((part) => part.length <= 1 || lexicon.has(part));
    }
  }

  return false;
}

async function hasFrenchWord(word, lexicon) {
  return hasFrenchWordInLexicon(word, lexicon);
}

function detectMergedWordCandidate(word, lexicon) {
  const normalized = normalizeFrenchWord(word);
  if (
    !normalized ||
    normalized.length < 8 ||
    normalized.length > 28 ||
    normalized.includes("'") ||
    normalized.includes("-") ||
    hasFrenchWordInLexicon(normalized, lexicon)
  ) {
    return null;
  }

  let bestCandidate = null;

  for (let index = 3; index <= normalized.length - 3; index += 1) {
    const left = normalized.slice(0, index);
    const right = normalized.slice(index);
    if (!lexicon.has(left) || !lexicon.has(right)) {
      continue;
    }

    const balanceScore = Math.abs(left.length - right.length);
    const candidate = {
      original: word,
      left,
      right,
      suggestion: `${left} ${right}`,
      score: balanceScore
    };

    if (!bestCandidate || candidate.score < bestCandidate.score) {
      bestCandidate = candidate;
    }
  }

  return bestCandidate;
}

function isTitleCaseWord(token) {
  return /^[\p{Lu}][\p{L}\p{M}]+$/u.test(String(token || ""));
}

function splitCamelCaseToken(token) {
  const source = String(token || "");
  const parts = source.split(/(?<=[\p{Ll}\p{M}])(?=[\p{Lu}])/u).filter(Boolean);
  return parts.length > 1 ? parts : null;
}

function isCompactSymbol(part) {
  return /^(?=.*[\p{Lu}])[A-Za-z]{1,4}\d*$/u.test(String(part || ""));
}

function shouldKeepMergedPart(part, lexicon) {
  const normalized = normalizeFrenchWord(part);
  return (
    normalized.length >= 2 &&
    (MERGED_WORD_CONNECTORS.has(normalized) || hasFrenchWordInLexicon(normalized, lexicon))
  );
}

function splitAroundConnector(token, lexicon) {
  const source = String(token || "");
  const normalized = normalizeFrenchWord(source);
  if (normalized.length < 4) {
    return null;
  }

  const connectors = [...MERGED_WORD_CONNECTORS].sort((left, right) => right.length - left.length);

  for (const connector of connectors) {
    if (normalized.startsWith(connector) && normalized.length >= connector.length + 2) {
      const right = source.slice(connector.length);
        if (shouldKeepMergedPart(right, lexicon) || isCompactSymbol(right)) {
          return [source.slice(0, connector.length), right];
        }
    }

    if (normalized.endsWith(connector) && normalized.length >= connector.length + 2) {
      const splitIndex = source.length - connector.length;
      const left = source.slice(0, splitIndex);
      if (shouldKeepMergedPart(left, lexicon)) {
        return [left, source.slice(splitIndex)];
      }
    }
  }

  return null;
}

function repairConnectorToken(token, lexicon, { allowSuffix = false, depth = 0 } = {}) {
  const source = String(token || "");
  const normalized = normalizeFrenchWord(source);
  if (!source || depth > 2 || normalized.length < 4) {
    return null;
  }

  const connectors = [...MERGED_WORD_CONNECTORS]
    .filter((connector) => connector.length >= 2 && connector !== "se")
    .sort((left, right) => right.length - left.length);

  for (const connector of connectors) {
    if (normalized.startsWith(connector)) {
      const left = source.slice(0, connector.length);
      const right = source.slice(connector.length);
      const minimumRightLength = isCompactSymbol(right) ? 2 : 4;
      if (normalized.length < connector.length + minimumRightLength) {
        continue;
      }
      if (shouldKeepMergedPart(right, lexicon) || isCompactSymbol(right)) {
        return `${left} ${right}`;
      }

      const repairedRight = repairConnectorToken(right, lexicon, { allowSuffix: true, depth: depth + 1 });
      if (repairedRight) {
        return `${left} ${repairedRight}`;
      }
    }

    if (allowSuffix && normalized.endsWith(connector) && normalized.length >= connector.length + 4) {
      const splitIndex = source.length - connector.length;
      const left = source.slice(0, splitIndex);
      const right = source.slice(splitIndex);
      if (shouldKeepMergedPart(left, lexicon)) {
        return `${left} ${right}`;
      }
    }
  }

  return null;
}

function scoreMergedParts(parts) {
  return parts.reduce((score, part) => {
    const normalized = normalizeFrenchWord(part);
    return score + Math.abs(normalized.length - 4);
  }, 0);
}

function findMergedWordParts(token, lexicon, depth = 0) {
  const source = String(token || "");
  if (!source || depth > 2) {
    return null;
  }

  if (shouldKeepMergedPart(source, lexicon)) {
    return [source];
  }

  if (source.length < 6) {
    return null;
  }

  let bestCandidate = null;
  for (let index = 2; index <= source.length - 2; index += 1) {
    const left = source.slice(0, index);
    const right = source.slice(index);
    if (!shouldKeepMergedPart(left, lexicon)) {
      continue;
    }

    const rightParts = findMergedWordParts(right, lexicon, depth + 1);
    if (!rightParts) {
      continue;
    }

    const candidate = [left, ...rightParts];
    const score = scoreMergedParts(candidate);
    if (!bestCandidate || score < bestCandidate.score) {
      bestCandidate = { parts: candidate, score };
    }
  }

  return bestCandidate?.parts || null;
}

function repairMergedToken(token, lexicon) {
  const source = String(token || "");
  if (!source || source.length < 4 || source.includes("'") || source.includes("-")) {
    return source;
  }

  const camelCaseParts = splitCamelCaseToken(source);
  if (camelCaseParts && camelCaseParts.every((part) => shouldKeepMergedPart(part, lexicon) || isCompactSymbol(part))) {
    return camelCaseParts.join(" ");
  }

  const connectorRepair = repairConnectorToken(source, lexicon, {
    allowSuffix: isTitleCaseWord(source) || Boolean(camelCaseParts)
  });
  if (connectorRepair) {
    return connectorRepair;
  }

  const normalized = normalizeFrenchWord(source);
  const mergedCandidate =
    !isTitleCaseWord(source) && normalized.length >= 10 ? detectMergedWordCandidate(source, lexicon) : null;
  if (mergedCandidate && mergedCandidate.left.length >= 4 && mergedCandidate.right.length >= 4) {
    return `${source.slice(0, mergedCandidate.left.length)} ${source.slice(mergedCandidate.left.length)}`;
  }

  const recursiveParts = findMergedWordParts(source, lexicon);
  if (
    recursiveParts &&
    recursiveParts.length > 1 &&
    recursiveParts.some((part) => {
      const normalizedPart = normalizeFrenchWord(part);
      return MERGED_WORD_CONNECTORS.has(normalizedPart) || normalizedPart.length <= 3 || isCompactSymbol(part);
    })
  ) {
    return recursiveParts.join(" ");
  }

  return source;
}

function isWordToken(token) {
  return /^[\p{L}\p{M}]+$/u.test(String(token || ""));
}

function isWhitespaceToken(token) {
  return /^\s+$/u.test(String(token || ""));
}

function isExplodedFragmentWord(token) {
  return /^[\p{L}\p{M}]{1,2}$/u.test(String(token || ""));
}

function isExplodedJoinSeparator(token) {
  return /^\s+$|^[·⋅•]+$/u.test(String(token || ""));
}

function isRomanNumeralWord(token) {
  return /^[IVXLCDM]{2,8}$/u.test(String(token || ""));
}

function isSingleRomanNumeralFragment(token) {
  return /^[IVXLCDM]$/u.test(String(token || ""));
}

function scoreExplodedWordCandidate(word, lexicon) {
  const normalized = normalizeFrenchWord(word);
  if (!normalized) {
    return Number.NEGATIVE_INFINITY;
  }

  if (hasFrenchWordInLexicon(word, lexicon)) {
    return normalized.length * normalized.length;
  }

  if (EXPLODED_WORD_EXCEPTIONS.has(normalized)) {
    return 70 + normalized.length * normalized.length;
  }

  if (isRomanNumeralWord(word)) {
    return 40 + word.length * word.length;
  }

  return Number.NEGATIVE_INFINITY;
}

function segmentExplodedFragments(fragments, lexicon) {
  const safeFragments = Array.isArray(fragments) ? fragments : [];
  if (safeFragments.length < 2) {
    return null;
  }

  const scores = new Array(safeFragments.length + 1).fill(Number.NEGATIVE_INFINITY);
  const paths = new Array(safeFragments.length + 1).fill(null);
  scores[safeFragments.length] = 0;
  paths[safeFragments.length] = [];

  for (let index = safeFragments.length - 1; index >= 0; index -= 1) {
    for (let endIndex = index + 1; endIndex <= Math.min(safeFragments.length, index + 12); endIndex += 1) {
      const candidate = safeFragments.slice(index, endIndex).join("");
      const candidateScore = scoreExplodedWordCandidate(candidate, lexicon);
      if (!Number.isFinite(candidateScore) || !Number.isFinite(scores[endIndex])) {
        continue;
      }

      const totalScore = candidateScore + scores[endIndex];
      if (totalScore > scores[index]) {
        scores[index] = totalScore;
        paths[index] = [candidate, ...paths[endIndex]];
      }
    }
  }

  return Number.isFinite(scores[0]) ? paths[0] : null;
}

function tryJoinWordSequence(words, lexicon) {
  const compact = words.join("");
  if (hasFrenchWordInLexicon(compact, lexicon)) {
    return compact;
  }

  if (normalizeFrenchWord(compact) === "cidessous") {
    return `${words[0]}-${words[1]}${words[2] || ""}`;
  }

  return null;
}

function repairApostropheToken(token, lexicon) {
  const source = String(token || "");
  if (!source || !/['’]/u.test(source)) {
    return source;
  }

  const match = source.match(/^([\p{L}\p{M}]+)(['’])([\p{L}\p{M}]+)$/u);
  if (!match) {
    return source;
  }

  const [, left, apostrophe, right] = match;
  for (const clitic of APOSTROPHE_CLITICS) {
    if (!normalizeFrenchWord(left).endsWith(clitic)) {
      continue;
    }

    const stem = left.slice(0, left.length - clitic.length);
    if (normalizeFrenchWord(stem).length < 2) {
      continue;
    }

    const cliticExpression = `${clitic}${apostrophe}${right}`;
    if (!hasFrenchWordInLexicon(stem, lexicon) || !hasFrenchWordInLexicon(cliticExpression, lexicon)) {
      continue;
    }

    return `${stem} ${cliticExpression}`;
  }

  if (hasFrenchWordInLexicon(source, lexicon)) {
    return source;
  }

  return source;
}

export function normalizeFrenchLexiconWord(value) {
  return normalizeFrenchWord(value);
}

export async function repairMergedFrenchText(text) {
  const lexicon = await loadFrenchLexicon();
  return String(text || "").replace(/\p{L}[\p{L}\p{M}]*/gu, (token) => repairMergedToken(token, lexicon));
}

export async function repairSplitFrenchText(text) {
  const lexicon = await loadFrenchLexicon();
  const tokens = String(text || "").match(/[\p{L}\p{M}]+|[^\p{L}\p{M}]+/gu) || [];
  const output = [];

  for (let index = 0; index < tokens.length; ) {
    const current = tokens[index];
    if (!isWordToken(current)) {
      output.push(current);
      index += 1;
      continue;
    }

    let replaced = false;

    if (
      index + 4 < tokens.length &&
      isWhitespaceToken(tokens[index + 1]) &&
      isWordToken(tokens[index + 2]) &&
      isWhitespaceToken(tokens[index + 3]) &&
      isWordToken(tokens[index + 4])
    ) {
      const words = [tokens[index], tokens[index + 2], tokens[index + 4]];
      const shortWordCount = words.filter((word) => normalizeFrenchWord(word).length <= 3).length;
      if (shortWordCount >= 2) {
        const joined = tryJoinWordSequence(words, lexicon);
        if (joined) {
          output.push(joined);
          index += 5;
          replaced = true;
        }
      }
    }

    if (replaced) {
      continue;
    }

    if (
      index + 2 < tokens.length &&
      isWhitespaceToken(tokens[index + 1]) &&
      isWordToken(tokens[index + 2])
    ) {
      const words = [tokens[index], tokens[index + 2]];
      const normalizedWords = words.map((word) => normalizeFrenchWord(word));
      const shortWordCount = words.filter((word) => normalizeFrenchWord(word).length <= 3).length;
      const joinedCandidate = tryJoinWordSequence(words, lexicon);
      const shouldPreferJoined = Boolean(joinedCandidate) && words.every((word) => isUppercaseLike(word));

      if (shouldPreferJoined) {
        output.push(joinedCandidate);
        index += 3;
        continue;
      }

      if (normalizedWords.every((word) => MERGED_WORD_CONNECTORS.has(word))) {
        output.push(current);
        index += 1;
        continue;
      }
      if (
        words.every((word) => hasFrenchWordInLexicon(word, lexicon)) &&
        !(MORPHOLOGICAL_JOIN_PREFIXES.has(normalizedWords[0]) && normalizedWords[1].length >= 4)
      ) {
        output.push(current);
        index += 1;
        continue;
      }
      if (shortWordCount >= 1) {
        if (joinedCandidate) {
          output.push(joinedCandidate);
          index += 3;
          continue;
        }
      }
    }

    output.push(current);
    index += 1;
  }

  return output.join("");
}

export async function repairExplodedFrenchText(text) {
  const lexicon = await loadFrenchLexicon();
  const tokens = String(text || "").match(/[\p{L}\p{M}]+|[·⋅•]+|\s+|[^\p{L}\p{M}\s·⋅•]+/gu) || [];
  const output = [];

  for (let index = 0; index < tokens.length; ) {
    const current = tokens[index];
    if (!isExplodedFragmentWord(current)) {
      output.push(current);
      index += 1;
      continue;
    }

    const fragments = [current];
    let cursor = index + 1;
    let consumedIndex = index + 1;

    while (cursor < tokens.length) {
      if (!isExplodedJoinSeparator(tokens[cursor])) {
        break;
      }

      let separatorCursor = cursor;
      while (separatorCursor < tokens.length && isExplodedJoinSeparator(tokens[separatorCursor])) {
        separatorCursor += 1;
      }

      if (separatorCursor >= tokens.length || !isExplodedFragmentWord(tokens[separatorCursor])) {
        break;
      }

      if (fragments.length >= 2 && isSingleRomanNumeralFragment(tokens[separatorCursor])) {
        break;
      }

      fragments.push(tokens[separatorCursor]);
      consumedIndex = separatorCursor + 1;
      cursor = separatorCursor + 1;
    }

    const shouldAttemptRepair =
      fragments.length >= 2 && fragments.some((fragment) => normalizeFrenchWord(fragment).length === 1);

    if (!shouldAttemptRepair) {
      output.push(current);
      index += 1;
      continue;
    }

    const reconstructedParts = segmentExplodedFragments(fragments, lexicon);
    if (reconstructedParts && reconstructedParts.join(" ") !== fragments.join(" ")) {
      output.push(reconstructedParts.join(" "));
      index = consumedIndex;
      continue;
    }

    output.push(current);
    index += 1;
  }

  return output.join("");
}

export async function repairFrenchApostropheText(text) {
  const lexicon = await loadFrenchLexicon();
  return String(text || "").replace(/[\p{L}\p{M}]+['’][\p{L}\p{M}]+/gu, (token) => repairApostropheToken(token, lexicon));
}

export function normalizeCommonFrenchReadingArtifacts(text) {
  return String(text || "")
    .replace(
      /\b([\p{L}\p{M}]+-[\p{L}\p{M}]+)(avec|et|ou|de|du|des|la|le|les|un|une)\b/giu,
      "$1 $2"
    )
    .replace(/\b([\p{L}\p{M}\d]{2,8})(et|ou|de|du|des|la|le|les|est)\b/gu, (match, left, connector) => {
      const hasInternalUppercase = /[A-Z]/u.test(String(left).slice(1));
      const hasDigit = /\d/u.test(left);
      return hasInternalUppercase || hasDigit ? `${left} ${connector}` : match;
    })
    .replace(/\bci-\s*des\s+sous\b/giu, "ci-dessous")
    .replace(/\bci\s+des\s+sous\b/giu, "ci-dessous")
    .replace(/(^|[\s([{«])às['’](?=\p{L})/gu, "$1à s'")
    .replace(/(^|[\s([{«])Às['’](?=\p{L})/gu, "$1À s'")
    .replace(/\b(page|fable|chapitre|cycle|tome|partie)\s+((?:\d\s+){1,4}\d)\b/giu, (match, label, digits) => {
      const compactDigits = String(digits).replace(/\s+/gu, "");
      return `${label} ${compactDigits}`;
    })
    .replace(/\s{2,}/gu, " ")
    .trim();
}

export async function analyzeFrenchLexiconText(
  text,
  { minWordLength = 4, maxUnknownWords = 4, maxMergedCandidates = 3 } = {}
) {
  const lexicon = await loadFrenchLexicon();
  const tokens = String(text || "").match(/[\p{L}]+(?:['’\-][\p{L}]+)*/gu) || [];

  let consideredWordCount = 0;
  let knownWordCount = 0;
  const unknownWords = [];
  const mergedCandidates = [];

  for (const token of tokens) {
    const normalized = normalizeFrenchWord(token);
    if (!normalized || normalized.length < minWordLength) {
      continue;
    }
    if (isUppercaseLike(token) && normalized.length <= 5) {
      continue;
    }

    consideredWordCount += 1;
    if (await hasFrenchWord(normalized, lexicon)) {
      knownWordCount += 1;
      continue;
    }

    if (unknownWords.length < maxUnknownWords) {
      unknownWords.push(token);
    }

    const mergedCandidate = detectMergedWordCandidate(normalized, lexicon);
    if (mergedCandidate && mergedCandidates.length < maxMergedCandidates) {
      mergedCandidates.push(mergedCandidate);
    }
  }

  const unknownWordCount = Math.max(0, consideredWordCount - knownWordCount);
  const knownRatio = consideredWordCount > 0 ? knownWordCount / consideredWordCount : 1;
  const verificationReasons = [];

  if (mergedCandidates.length > 0) {
    verificationReasons.push(
      `Mots possiblement collés : ${mergedCandidates.map((candidate) => `${candidate.original} → ${candidate.suggestion}`).join(" ; ")}`
    );
  }
  if (consideredWordCount >= 4 && unknownWordCount >= 2 && knownRatio < 0.72) {
    verificationReasons.push("Plusieurs mots OCR restent incertains dans ce bloc.");
  }
  if (consideredWordCount >= 6 && knownRatio < 0.5) {
    verificationReasons.push("Reconnaissance lexicale faible : une relecture OCR est conseillée.");
  }

  let reviewLevel = "none";
  if (verificationReasons.length > 0) {
    reviewLevel = knownRatio < 0.5 || mergedCandidates.length >= 2 ? "medium" : "low";
  }

  return {
    consideredWordCount,
    knownWordCount,
    unknownWordCount,
    knownRatio,
    unknownWords,
    mergedCandidates,
    reviewLevel,
    verificationReasons
  };
}
