const PHONEME_SAFE_TOKENS = {
  "#": "silent",
  "%": "silent-e",
  "@": "nasal-a",
  "§": "nasal-o",
  "5": "nasal-e",
  "1": "nasal-eu",
  "°": "schwa",
  "2": "eu-closed",
  "9": "eu-open",
  "8": "semi-ui",
  S: "ch",
  Z: "j",
  R: "r",
  N: "gn",
  G: "ng",
  wa: "oi",
  ks: "x-ks",
  kw: "qu-w",
  k8: "qu-ui",
  ij: "ill-double",
  On: "on-open",
  an: "a-open",
  in: "i-open"
};

export const PHONEME_FAMILIES = {
  voyelles_simples: {
    label: "Voyelles simples",
    phonemes: ["a", "e", "i", "o", "u", "y", "E", "O", "2", "9", "°"]
  },
  voyelles_nasales: {
    label: "Voyelles nasales",
    phonemes: ["@", "§", "5", "1"]
  },
  semi_voyelles: {
    label: "Semi-voyelles",
    phonemes: ["j", "w", "8", "wa"]
  },
  consonnes_occlusives: {
    label: "Consonnes occlusives",
    phonemes: ["p", "b", "t", "d", "k", "g", "kw", "k8"]
  },
  consonnes_fricatives: {
    label: "Consonnes fricatives",
    phonemes: ["f", "v", "s", "z", "S", "Z", "ks"]
  },
  consonnes_liquides: {
    label: "Consonnes liquides",
    phonemes: ["l", "R"]
  },
  consonnes_nasales: {
    label: "Consonnes nasales",
    phonemes: ["m", "n", "N", "G"]
  },
  groupes_complexes: {
    label: "Groupes complexes",
    phonemes: ["ij", "On", "an", "in"]
  },
  lettres_muettes: {
    label: "Lettres muettes",
    phonemes: ["#", "%"]
  }
};

const PHONEME_META = {
  a: { ipa: "a", familyId: "voyelles_simples", label: "son /a/" },
  e: { ipa: "e", familyId: "voyelles_simples", label: "son /e/" },
  E: { ipa: "ɛ", familyId: "voyelles_simples", label: "son /ɛ/" },
  i: { ipa: "i", familyId: "voyelles_simples", label: "son /i/" },
  o: { ipa: "o", familyId: "voyelles_simples", label: "son /o/" },
  O: { ipa: "ɔ", familyId: "voyelles_simples", label: "son /ɔ/" },
  u: { ipa: "u", familyId: "voyelles_simples", label: "son /u/" },
  y: { ipa: "y", familyId: "voyelles_simples", label: "son /y/" },
  "2": { ipa: "ø", familyId: "voyelles_simples", label: "son /ø/" },
  "9": { ipa: "œ", familyId: "voyelles_simples", label: "son /œ/" },
  "°": { ipa: "ə", familyId: "voyelles_simples", label: "e muet /ə/" },
  "@": { ipa: "ɑ̃", familyId: "voyelles_nasales", label: "son /ɑ̃/" },
  "§": { ipa: "ɔ̃", familyId: "voyelles_nasales", label: "son /ɔ̃/" },
  "5": { ipa: "ɛ̃", familyId: "voyelles_nasales", label: "son /ɛ̃/" },
  "1": { ipa: "œ̃", familyId: "voyelles_nasales", label: "son /œ̃/" },
  j: { ipa: "j", familyId: "semi_voyelles", label: "semi-voyelle /j/" },
  w: { ipa: "w", familyId: "semi_voyelles", label: "semi-voyelle /w/" },
  "8": { ipa: "ɥ", familyId: "semi_voyelles", label: "semi-voyelle /ɥ/" },
  wa: { ipa: "wa", familyId: "semi_voyelles", label: "groupe /wa/" },
  p: { ipa: "p", familyId: "consonnes_occlusives", label: "son /p/" },
  b: { ipa: "b", familyId: "consonnes_occlusives", label: "son /b/" },
  t: { ipa: "t", familyId: "consonnes_occlusives", label: "son /t/" },
  d: { ipa: "d", familyId: "consonnes_occlusives", label: "son /d/" },
  k: { ipa: "k", familyId: "consonnes_occlusives", label: "son /k/" },
  g: { ipa: "g", familyId: "consonnes_occlusives", label: "son /g/" },
  kw: { ipa: "kw", familyId: "consonnes_occlusives", label: "groupe /kw/" },
  k8: { ipa: "kɥ", familyId: "consonnes_occlusives", label: "groupe /kɥ/" },
  f: { ipa: "f", familyId: "consonnes_fricatives", label: "son /f/" },
  v: { ipa: "v", familyId: "consonnes_fricatives", label: "son /v/" },
  s: { ipa: "s", familyId: "consonnes_fricatives", label: "son /s/" },
  z: { ipa: "z", familyId: "consonnes_fricatives", label: "son /z/" },
  S: { ipa: "ʃ", familyId: "consonnes_fricatives", label: "son /ʃ/" },
  Z: { ipa: "ʒ", familyId: "consonnes_fricatives", label: "son /ʒ/" },
  ks: { ipa: "ks", familyId: "consonnes_fricatives", label: "groupe /ks/" },
  l: { ipa: "l", familyId: "consonnes_liquides", label: "son /l/" },
  R: { ipa: "ʁ", familyId: "consonnes_liquides", label: "son /ʁ/" },
  m: { ipa: "m", familyId: "consonnes_nasales", label: "son /m/" },
  n: { ipa: "n", familyId: "consonnes_nasales", label: "son /n/" },
  N: { ipa: "ɲ", familyId: "consonnes_nasales", label: "son /ɲ/" },
  G: { ipa: "ŋ", familyId: "consonnes_nasales", label: "son /ŋ/" },
  ij: { ipa: "ij", familyId: "groupes_complexes", label: "groupe /ij/" },
  On: { ipa: "ɔn", familyId: "groupes_complexes", label: "groupe /ɔn/" },
  an: { ipa: "an", familyId: "groupes_complexes", label: "groupe /an/" },
  in: { ipa: "in", familyId: "groupes_complexes", label: "groupe /in/" },
  "#": { ipa: "—", familyId: "lettres_muettes", label: "lettre muette" },
  "%": { ipa: "—", familyId: "lettres_muettes", label: "e muet final" }
};

const MANULEX_GRAPHEME_TO_PHONEMES = {
  a: [
    { phoneme: "a", frequency: 6936, example: "ami" },
    { phoneme: "#", frequency: 3, example: "août" }
  ],
  "à": [{ phoneme: "a", frequency: 8, example: "à" }],
  â: [{ phoneme: "a", frequency: 154, example: "âne" }],
  b: [{ phoneme: "b", frequency: 2220, example: "bague" }],
  c: [
    { phoneme: "k", frequency: 2891, example: "car" },
    { phoneme: "s", frequency: 1051, example: "cil" }
  ],
  ch: [
    { phoneme: "S", frequency: 885, example: "chat" },
    { phoneme: "k", frequency: 46, example: "chorale" }
  ],
  d: [
    { phoneme: "d", frequency: 2580, example: "dur" },
    { phoneme: "#", frequency: 175, example: "brouillard" }
  ],
  e: [
    { phoneme: "°", frequency: 5324, example: "gare" },
    { phoneme: "%", frequency: 1574, example: "table" },
    { phoneme: "E", frequency: 1407, example: "bel" },
    { phoneme: "#", frequency: 506, example: "lycée" }
  ],
  "é": [{ phoneme: "e", frequency: 4045, example: "été" }],
  "è": [{ phoneme: "E", frequency: 407, example: "artère" }],
  ê: [{ phoneme: "E", frequency: 132, example: "être" }],
  eau: [{ phoneme: "o", frequency: 128, example: "bureau" }],
  eaux: [{ phoneme: "o", frequency: 64, example: "eaux" }],
  eu: [
    { phoneme: "9", frequency: 617, example: "neuf" },
    { phoneme: "2", frequency: 373, example: "deux" }
  ],
  en: [
    { phoneme: "@", frequency: 1784, example: "potence" },
    { phoneme: "5", frequency: 115, example: "ancien" }
  ],
  em: [{ phoneme: "@", frequency: 164, example: "emploi" }],
  er: [{ phoneme: "e", frequency: 2235, example: "loyer" }],
  et: [{ phoneme: "E", frequency: 189, example: "jouet" }],
  f: [{ phoneme: "f", frequency: 1397, example: "feu" }],
  ff: [{ phoneme: "f", frequency: 218, example: "affaire" }],
  g: [
    { phoneme: "g", frequency: 966, example: "gare" },
    { phoneme: "Z", frequency: 942, example: "gel" }
  ],
  gn: [{ phoneme: "N", frequency: 202, example: "peigne" }],
  gu: [{ phoneme: "g", frequency: 160, example: "guide" }],
  h: [{ phoneme: "#", frequency: 461, example: "heure" }],
  i: [
    { phoneme: "i", frequency: 5761, example: "jeudi" },
    { phoneme: "j", frequency: 1858, example: "ciel" },
    { phoneme: "ij", frequency: 100, example: "tablier" }
  ],
  il: [{ phoneme: "ij", frequency: 64, example: "grésil" }],
  ill: [
    { phoneme: "j", frequency: 198, example: "paille" },
    { phoneme: "ij", frequency: 159, example: "fille" }
  ],
  im: [{ phoneme: "5", frequency: 131, example: "impossible" }],
  in: [
    { phoneme: "5", frequency: 712, example: "interdit" },
    { phoneme: "in", frequency: 3, example: "badminton" }
  ],
  j: [{ phoneme: "Z", frequency: 258, example: "jeu" }],
  k: [{ phoneme: "k", frequency: 93, example: "kilo" }],
  l: [{ phoneme: "l", frequency: 4329, example: "la" }],
  ll: [{ phoneme: "l", frequency: 317, example: "allée" }],
  m: [{ phoneme: "m", frequency: 3245, example: "main" }],
  mm: [{ phoneme: "m", frequency: 207, example: "pomme" }],
  n: [{ phoneme: "n", frequency: 2065, example: "note" }],
  nn: [{ phoneme: "n", frequency: 372, example: "année" }],
  o: [
    { phoneme: "O", frequency: 3496, example: "bord" },
    { phoneme: "o", frequency: 396, example: "stylo" }
  ],
  oi: [{ phoneme: "wa", frequency: 427, example: "roi" }],
  om: [{ phoneme: "§", frequency: 196, example: "ombre" }],
  on: [
    { phoneme: "§", frequency: 1531, example: "rond" },
    { phoneme: "On", frequency: 7, example: "bonheur" }
  ],
  ou: [
    { phoneme: "u", frequency: 1207, example: "loup" },
    { phoneme: "w", frequency: 90, example: "douane" }
  ],
  p: [{ phoneme: "p", frequency: 3041, example: "opéra" }],
  ph: [{ phoneme: "f", frequency: 177, example: "photo" }],
  pp: [{ phoneme: "p", frequency: 149, example: "nappe" }],
  qu: [
    { phoneme: "k", frequency: 811, example: "liquide" },
    { phoneme: "kw", frequency: 16, example: "aquarium" },
    { phoneme: "k8", frequency: 2, example: "équidistance" }
  ],
  r: [{ phoneme: "R", frequency: 9147, example: "rêve" }],
  rr: [{ phoneme: "R", frequency: 302, example: "marron" }],
  s: [
    { phoneme: "s", frequency: 2488, example: "salade" },
    { phoneme: "z", frequency: 1033, example: "rose" },
    { phoneme: "#", frequency: 359, example: "brebis" }
  ],
  ss: [{ phoneme: "s", frequency: 850, example: "tasse" }],
  t: [
    { phoneme: "t", frequency: 5306, example: "tête" },
    { phoneme: "#", frequency: 1858, example: "abricot" },
    { phoneme: "s", frequency: 568, example: "addition" }
  ],
  th: [{ phoneme: "t", frequency: 110, example: "thé" }],
  tt: [{ phoneme: "t", frequency: 410, example: "patte" }],
  u: [
    { phoneme: "y", frequency: 1897, example: "puce" },
    { phoneme: "8", frequency: 306, example: "bruit" }
  ],
  un: [{ phoneme: "1", frequency: 16, example: "lundi" }],
  v: [{ phoneme: "v", frequency: 1579, example: "vitre" }],
  x: [
    { phoneme: "#", frequency: 267, example: "noix" },
    { phoneme: "ks", frequency: 211, example: "axe" },
    { phoneme: "z", frequency: 7, example: "deuxième" },
    { phoneme: "s", frequency: 5, example: "soixantaine" }
  ],
  y: [{ phoneme: "i", frequency: 217, example: "analyse" }],
  z: [{ phoneme: "z", frequency: 100, example: "zéro" }],
  "ç": [{ phoneme: "s", frequency: 58, example: "façon" }],
  aim: [{ phoneme: "5", frequency: 84, example: "faim" }],
  ain: [{ phoneme: "5", frequency: 98, example: "pain" }],
  am: [{ phoneme: "@", frequency: 113, example: "tambour" }],
  an: [
    { phoneme: "@", frequency: 1321, example: "langage" },
    { phoneme: "an", frequency: 9, example: "gentleman" }
  ],
  au: [
    { phoneme: "o", frequency: 358, example: "haut" },
    { phoneme: "O", frequency: 19, example: "dinosaure" }
  ],
  "e[cc]": [
    { phoneme: "E", frequency: 645, example: "adresse" },
    { phoneme: "e", frequency: 109, example: "tennis" }
  ],
  ei: [{ phoneme: "E", frequency: 44, example: "seize" }],
  ein: [{ phoneme: "5", frequency: 55, example: "plein" }],
  oeu: [{ phoneme: "9", frequency: 42, example: "sœur" }]
};

const PHONEME_CATALOG = Object.entries(PHONEME_META).map(([phoneme, meta]) => ({
  phoneme,
  ...meta,
  cssToken: PHONEME_SAFE_TOKENS[phoneme] || phoneme.toLowerCase(),
  graphemes: Object.entries(MANULEX_GRAPHEME_TO_PHONEMES)
    .flatMap(([grapheme, entries]) =>
      entries
        .filter((entry) => entry.phoneme === phoneme)
        .map((entry) => ({ grapheme, frequency: entry.frequency, example: entry.example }))
    )
    .sort((left, right) => right.frequency - left.frequency)
}));

const PHONEME_BY_ID = new Map(PHONEME_CATALOG.map((entry) => [entry.phoneme, entry]));

function normalizeGrapheme(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFC");
}

function getPrimaryAssociation(entries = [], word = "", index = 0) {
  if (entries.length <= 1) {
    return entries[0] || null;
  }

  const source = normalizeGrapheme(word);
  const next = source[index + 1] || "";
  const previous = source[index - 1] || "";
  const prevIsVowel = /[aeiouyàâäéèêëîïôöùûüÿœæ]/u.test(previous);
  const nextIsFrontVowel = /[eéiîïyèêëy]/u.test(next);
  const nextIsVowel = /[aeiouyàâäéèêëîïôöùûüÿœæ]/u.test(next);
  const currentGrapheme = entries[0]?.grapheme || "";

  if (currentGrapheme === "c") {
    return entries.find((entry) => entry.phoneme === (nextIsFrontVowel ? "s" : "k")) || entries[0];
  }
  if (currentGrapheme === "g") {
    return entries.find((entry) => entry.phoneme === (nextIsFrontVowel ? "Z" : "g")) || entries[0];
  }
  if (currentGrapheme === "s") {
    return entries.find((entry) => entry.phoneme === (prevIsVowel && nextIsVowel ? "z" : "s")) || entries[0];
  }
  if (currentGrapheme === "x") {
    if (index === source.length - 1) {
      return entries.find((entry) => entry.phoneme === "#") || entries[0];
    }
    return entries.find((entry) => entry.phoneme === "ks") || entries[0];
  }

  return entries[0];
}

export function getPhonemeCatalog() {
  return PHONEME_CATALOG.map((entry) => ({ ...entry, graphemes: [...entry.graphemes] }));
}

export function lookupGrapheme(grapheme) {
  const key = normalizeGrapheme(grapheme);
  return (MANULEX_GRAPHEME_TO_PHONEMES[key] || []).map((entry) => ({ grapheme: key, ...entry }));
}

export function lookupPhoneme(phoneme) {
  const entry = PHONEME_BY_ID.get(String(phoneme || ""));
  return entry ? { ...entry, graphemes: [...entry.graphemes] } : null;
}

export function isInconsistentGrapheme(grapheme) {
  const entries = lookupGrapheme(grapheme);
  return new Set(entries.map((entry) => entry.phoneme)).size > 1;
}

export function classifyPhoneme(phoneme) {
  const entry = PHONEME_BY_ID.get(String(phoneme || ""));
  switch (entry?.familyId) {
    case "voyelles_simples":
      return "vowel";
    case "voyelles_nasales":
      return "nasal";
    case "semi_voyelles":
      return "semivowel";
    case "lettres_muettes":
      return "silent";
    default:
      return "consonant";
  }
}

export function getPhonemeCssToken(phoneme) {
  return PHONEME_SAFE_TOKENS[String(phoneme || "")] || String(phoneme || "").toLowerCase();
}

export function getKnownGraphemes(minFrequency = 5) {
  return Object.entries(MANULEX_GRAPHEME_TO_PHONEMES)
    .filter(([, entries]) => Math.max(...entries.map((entry) => Number(entry.frequency || 0))) >= minFrequency)
    .sort((left, right) => {
      if (right[0].length !== left[0].length) {
        return right[0].length - left[0].length;
      }
      const rightMax = Math.max(...right[1].map((entry) => Number(entry.frequency || 0)));
      const leftMax = Math.max(...left[1].map((entry) => Number(entry.frequency || 0)));
      return rightMax - leftMax;
    })
    .map(([grapheme]) => grapheme);
}

export function resolveGraphemePhoneme(grapheme, word = "", index = 0) {
  const entries = lookupGrapheme(grapheme);
  const selected = getPrimaryAssociation(
    entries.map((entry) => ({ ...entry, grapheme: normalizeGrapheme(grapheme) })),
    word,
    index
  );
  if (!selected) {
    return null;
  }
  const phonemeEntry = lookupPhoneme(selected.phoneme);
  return {
    ...selected,
    phonemeMeta: phonemeEntry,
    classification: classifyPhoneme(selected.phoneme),
    cssToken: getPhonemeCssToken(selected.phoneme),
    inconsistent: isInconsistentGrapheme(grapheme)
  };
}
