import assert from "node:assert/strict";

import {
  analyzeFrenchWord,
  normalizeSyllabificationMode,
  normalizeSyllableWordScope,
  shouldDisplaySyllables,
  syllabifyFrenchHtml,
  syllabifyFrenchText,
  syllabifyFrenchWord,
  syllabifyText,
  syllabifyToken,
  syllabifyWord,
  tokenize
} from "../src/core/reading/syllabify-french.mjs";

const PEDAGOGICAL_CASES = [
  ["numéro", ["nu", "mé", "ro"]],
  ["parité", ["pa", "ri", "té"]],
  ["spéculer", ["spé", "cu", "ler"]],
  ["argent", ["ar", "gent"]],
  ["expert", ["ex", "pert"]],
  ["informer", ["in", "for", "mer"]],
  ["adjoint", ["ad", "joint"]],
  ["ballet", ["bal", "let"]],
  ["commission", ["com", "mis", "sion"]],
  ["appel", ["ap", "pel"]],
  ["table", ["ta", "ble"]],
  ["abri", ["a", "bri"]],
  ["cibler", ["ci", "bler"]],
  ["complet", ["com", "plet"]],
  ["entrer", ["en", "trer"]],
  ["débrayer", ["dé", "bray", "er"]],
  ["ouvrir", ["ou", "vrir"]],
  ["acheter", ["a", "che", "ter"]],
  ["éléphant", ["é", "lé", "phant"]],
  ["hypothèse", ["hy", "po", "thè", "se"]],
  ["ignorer", ["i", "gno", "rer"]],
  ["algorithme", ["al", "go", "rith", "me"]],
  ["compter", ["comp", "ter"]],
  ["fonctionner", ["fonc", "tion", "ner"]],
  ["applicable", ["ap", "pli", "ca", "ble"]],
  ["assemblée", ["as", "sem", "blée"]],
  ["afflux", ["af", "flux"]],
  ["maïs", ["ma", "ïs"]],
  ["naïf", ["na", "ïf"]],
  ["réunion", ["ré", "u", "nion"]],
  ["coopérative", ["co", "o", "pé", "ra", "tive"]],
  ["antiacide", ["an", "ti", "a", "ci", "de"]],
  ["parle", ["par", "le"]],
  ["lune", ["lu", "ne"]],
  ["téléphone", ["té", "lé", "pho", "ne"]]
];

for (const [word, expected] of PEDAGOGICAL_CASES) {
  assert.deepEqual(
    syllabifyWord(word, { mode: "pedagogique", separator: null }),
    expected,
    `Découpage pédagogique inattendu pour ${word}`
  );
  assert.deepEqual(
    analyzeFrenchWord(word).syllables,
    expected,
    `Analyse inattendue pour ${word}`
  );
}

const EXPECTED_WORDS = new Map([
  ["arrête", "ar-rête"],
  ["résidence", "ré-si-dence"],
  ["famille", "fa-mille"],
  ["fille", "fille"],
  ["bonjour", "bon-jour"],
  ["moteur", "mo-teur"],
  ["rencontre", "ren-contre"],
  ["rencontrer", "ren-con-trer"],
  ["rencontré", "ren-con-tré"],
  ["rencontrée", "ren-con-trée"],
  ["rencontrait", "ren-con-trait"],
  ["rencontraient", "ren-con-traient"],
  ["rencontrons", "ren-con-trons"],
  ["rencontrez", "ren-con-trez"],
  ["concentré", "con-cen-tré"],
  ["concentrés", "con-cen-trés"],
  ["bouteille", "bou-teille"],
  ["feuille", "feuille"],
  ["abeille", "a-beille"],
  ["fauteuil", "fau-teuil"],
  ["seuil", "seuil"],
  ["oreille", "o-reille"],
  ["soleil", "so-leil"],
  ["accueil", "ac-cueil"],
  ["paille", "paille"],
  ["taille", "taille"],
  ["veille", "veille"],
  ["merveille", "mer-veille"],
  ["corneille", "cor-neille"],
  ["conseil", "con-seil"],
  ["sommeil", "som-meil"],
  ["orteil", "or-teil"],
  ["ville", "ville"],
  ["mille", "mille"],
  ["vanille", "va-nille"],
  ["chenille", "che-nille"],
  ["grille", "grille"],
  ["coquille", "co-quille"],
  ["définition", "dé-fin-i-tion"],
  ["communication", "com-mun-i-ca-tion"],
  ["document", "do-cum-ent"],
  ["élément", "é-lém-ent"],
  ["similaire", "sim-i-laire"],
  ["contient", "con-tient"],
  ["intervient", "in-ter-vient"],
  ["construction", "con-struc-tion"],
  ["extraordinaire", "ex-tra-or-di-naire"]
]);

for (const [word, expected] of EXPECTED_WORDS) {
  assert.equal(
    syllabifyFrenchWord(word, { level: "strong", separator: "-" }),
    expected,
    `Découpage inattendu pour ${word}`
  );
}

// ---------- TOKENISATION ----------

assert.deepEqual(
  tokenize("l'école porte-monnaie."),
  [
    { value: "l'école", type: "word", start: 0, end: 7 },
    { value: " ", type: "space", start: 7, end: 8 },
    { value: "porte-monnaie", type: "word", start: 8, end: 21 },
    { value: ".", type: "punct", start: 21, end: 22 }
  ]
);

// ---------- MOTS AVEC APOSTROPHES / TRAITS D’UNION ----------

assert.equal(
  syllabifyToken({ value: "l'école", type: "word" }, { mode: "pedagogique", separator: "-" }),
  "l'é-co-le"
);
assert.equal(
  syllabifyToken({ value: "qu'avait", type: "word" }, { mode: "pedagogique", separator: "-" }),
  "qu'a-vait"
);
assert.equal(
  syllabifyToken({ value: "jusqu'à", type: "word" }, { mode: "pedagogique", separator: "-" }),
  "jusqu'à"
);
assert.equal(
  syllabifyToken({ value: "porte-monnaie", type: "word" }, { mode: "pedagogique", separator: "-" }),
  "por-te-mon-naie"
);

// ---------- MODE TYPOGRAPHIQUE SÉPARÉ ----------

assert.equal(
  syllabifyWord("numéro", { mode: "typographique", separator: "-" }),
  "numé-ro",
  "Le mode typographique reste distinct et plus conservateur"
);
assert.equal(
  syllabifyWord("table", { mode: "typographique", separator: "-" }),
  "ta-ble",
  "Une coupure typographique simple peut rester identique"
);
assert.equal(normalizeSyllabificationMode("modeTypographique"), "typographique");
assert.equal(normalizeSyllabificationMode("modePedagogique"), "pedagogique");
assert.equal(normalizeSyllableWordScope("all"), "all");
assert.equal(normalizeSyllableWordScope("inconnu"), "auto");

// ---------- MODE LIGHT vs STRONG ----------

assert.equal(syllabifyFrenchWord("table", { level: "light", separator: "-" }), "table");
assert.equal(syllabifyFrenchWord("abricot", { level: "light", separator: "-" }), "a-bri-cot");
assert.equal(
  syllabifyFrenchWord("bonjour", { level: "light", separator: "-" }),
  "bonjour",
  "bonjour (2 syllabes, 7 lettres) ne doit pas être découpé en mode light"
);
assert.equal(
  syllabifyFrenchWord("communication", { level: "light", separator: "-" }),
  "com-mun-i-ca-tion",
  "communication (5 syllabes) doit être découpé même en mode light"
);

assert.equal(
  shouldDisplaySyllables(analyzeFrenchWord("table"), { level: "light" }),
  false,
  "En mode auto, un mot court comme table ne doit pas etre force en mode light"
);
assert.equal(
  shouldDisplaySyllables(analyzeFrenchWord("table"), { level: "light", wordScope: "all" }),
  true,
  "Le mode tous les mots doit aussi afficher les mots courts multisyllabiques"
);
assert.equal(
  shouldDisplaySyllables(analyzeFrenchWord("table"), { level: "light", forceAllWords: true }),
  true,
  "Le mode force doit rester compatible avec un appel booleen direct"
);

// ---------- TEXTE COMPLET ----------

assert.equal(
  syllabifyFrenchText("Bonjour, moteur !", { level: "strong", separator: "-" }),
  "Bon-jour, mo-teur !"
);

assert.match(
  syllabifyFrenchText("L'homme dit bonjour.", { level: "strong", separator: "-" }),
  /^L['\u2019]hom-me dit bon-jour\.$/u
);

assert.equal(
  syllabifyText("Coopérative, antiacide et réunion.", { mode: "pedagogique", separator: "·" }),
  "Co·o·pé·ra·tive, an·ti·a·ci·de et ré·u·nion."
);

const longText = "Bonjour, commentaire et moteur.";
assert.equal(
  syllabifyFrenchText(longText, { level: "strong", separator: "-" }),
  syllabifyFrenchText(longText, { level: "strong", separator: "-" }),
  "Le rendu doit rester stable"
);

// ---------- HTML ----------

assert.equal(
  syllabifyFrenchHtml("<p>bonjour <strong>moteur</strong> !</p>", { level: "strong", separator: "-" }),
  "<p>bon-jour <strong>mo-teur</strong> !</p>"
);

const htmlSeparator = syllabifyFrenchWord("moteur", {
  level: "strong",
  separator: "·",
  separatorMode: "html",
  separatorClass: "syllable-separator"
});
assert.match(htmlSeparator, /syllable-separator/u);

// ---------- LETTRES MUETTES — MOTS EN -ENT NASAL (ne PAS griser) ----------

const nasalEntWords = [
  "souvent", "vent", "parent", "dent", "lent", "argent", "serpent",
  "content", "president", "agent", "talent", "urgent", "prudent",
  "recent", "patient", "violent", "fervent", "evident", "frequent",
  "absent", "accent", "accident", "adolescent", "aliment", "client",
  "document", "element", "fragment", "ignorant", "important",
  "independant", "instrument", "intelligent", "moment", "monument",
  "permanent", "segment", "sentiment", "supplement", "transparent"
];

for (const word of nasalEntWords) {
  assert.equal(
    analyzeFrenchWord(word).silentEnding,
    "",
    `${word}: la finale -ent/-ant ne doit pas être marquée muette (son nasal)`
  );
}

// ---------- LETTRES MUETTES — VERBES EN -ENT (DOIT griser) ----------

const verbEntWords = [
  "mangent", "parlent", "chantent", "marchent", "jouent",
  "trouvent", "arrivent", "tombent", "passent", "portent"
];

for (const word of verbEntWords) {
  const analysis = analyzeFrenchWord(word);
  assert.ok(
    analysis.silentEnding.length > 0,
    `${word}: la terminaison verbale doit être marquée muette (got silentEnding="${analysis.silentEnding}")`
  );
}

assert.equal(analyzeFrenchWord("contient").silentEnding, "");
assert.equal(analyzeFrenchWord("intervient").silentEnding, "");

// ---------- MODE OFF ----------

assert.equal(
  syllabifyFrenchWord("communication", { level: "off", separator: "-" }),
  "communication"
);
assert.equal(
  syllabifyFrenchText("Bonjour le monde.", { level: "off", separator: "-" }),
  "Bonjour le monde."
);

console.log("syllabify-french: ok");
