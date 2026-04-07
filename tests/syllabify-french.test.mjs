import assert from "node:assert/strict";

import {
  analyzeFrenchWord,
  syllabifyFrenchHtml,
  syllabifyFrenchText,
  syllabifyFrenchWord
} from "../src/core/reading/syllabify-french.mjs";

const EXPECTED_WORDS = new Map([
  ["arr\u00eate", "ar-r\u00eate"],
  ["r\u00e9sidence", "r\u00e9-si-dence"],
  ["table", "ta-ble"],
  ["abricot", "a-bri-cot"],
  ["commentaire", "com-men-taire"],
  ["excellent", "ex-cel-lent"],
  ["famille", "fa-mille"],
  ["fille", "fille"],
  ["bonjour", "bon-jour"],
  ["moteur", "mo-teur"],
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
  ["d\u00e9finition", "d\u00e9-fin-i-tion"],
  ["communication", "com-mun-i-ca-tion"],
  ["document", "do-cum-ent"],
  ["\u00e9l\u00e9ment", "\u00e9-l\u00e9m-ent"],
  ["similaire", "sim-i-laire"],
  ["contient", "con-tient"],
  ["intervient", "in-ter-vient"]
]);

for (const [word, expected] of EXPECTED_WORDS) {
  assert.equal(
    syllabifyFrenchWord(word, { level: "strong", separator: "-" }),
    expected,
    `Decoupage inattendu pour ${word}`
  );
}

// ---------- MODE LIGHT vs STRONG ----------

assert.equal(syllabifyFrenchWord("table", { level: "light", separator: "-" }), "table");
assert.equal(syllabifyFrenchWord("abricot", { level: "light", separator: "-" }), "a-bri-cot");
assert.equal(syllabifyFrenchWord("bonjour", { level: "light", separator: "-" }), "bonjour",
  "bonjour (2 syllabes, 7 lettres) ne doit pas etre decoupe en mode light");
assert.equal(syllabifyFrenchWord("communication", { level: "light", separator: "-" }), "com-mun-i-ca-tion",
  "communication (5 syllabes) doit etre decoupe meme en mode light");

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
  syllabifyFrenchText("Bonjour\nmoteur", { level: "strong", separator: "-" }),
  "Bon-jour\nmo-teur"
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
  separator: "\u00b7",
  separatorMode: "html",
  separatorClass: "syllable-separator"
});
assert.match(htmlSeparator, /syllable-separator/u);

// ---------- ANALYSE DIRECTE ----------

assert.deepEqual(analyzeFrenchWord("famille").syllables, ["fa", "mille"]);
assert.deepEqual(analyzeFrenchWord("chocolat").syllables, ["cho", "co", "la"]);
assert.deepEqual(analyzeFrenchWord("ordinateur").syllables, ["or", "din", "a", "teur"]);
assert.deepEqual(analyzeFrenchWord("papillon").syllables, ["pa", "pil", "lon"]);

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
    analyzeFrenchWord(word).silentEnding, "",
    `${word}: la finale -ent/-ant ne doit pas etre marquee muette (son nasal)`
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
    `${word}: la terminaison verbale doit etre marquee muette (got silentEnding="${analysis.silentEnding}")`
  );
}

// ---------- LETTRES MUETTES — VERBES -ENT AVEC CONTIENT/INTERVIENT ----------

assert.equal(analyzeFrenchWord("contient").silentEnding, "",
  "contient: -ent n'est pas muet ici (verbe tenir)");
assert.equal(analyzeFrenchWord("intervient").silentEnding, "",
  "intervient: -ent n'est pas muet ici (verbe venir)");

// ---------- MOTS EN -ILLE/-EILLE/-AILLE (graphemes proteges) ----------

assert.deepEqual(analyzeFrenchWord("bouteille").syllables, ["bou", "teille"],
  "bouteille: pas bou-tei-lle");
assert.deepEqual(analyzeFrenchWord("feuille").syllables, ["feuille"],
  "feuille: monosyllabe");
assert.deepEqual(analyzeFrenchWord("abeille").syllables, ["a", "beille"],
  "abeille: a-beille");
assert.deepEqual(analyzeFrenchWord("oreille").syllables, ["o", "reille"],
  "oreille: o-reille");
assert.deepEqual(analyzeFrenchWord("soleil").syllables, ["so", "leil"],
  "soleil: so-leil");
assert.deepEqual(analyzeFrenchWord("accueil").syllables, ["ac", "cueil"],
  "accueil: ac-cueil");
assert.deepEqual(analyzeFrenchWord("fauteuil").syllables, ["fau", "teuil"],
  "fauteuil: fau-teuil");
assert.deepEqual(analyzeFrenchWord("seuil").syllables, ["seuil"],
  "seuil: monosyllabe");
assert.deepEqual(analyzeFrenchWord("paille").syllables, ["paille"],
  "paille: monosyllabe");
assert.deepEqual(analyzeFrenchWord("taille").syllables, ["taille"],
  "taille: monosyllabe");
assert.deepEqual(analyzeFrenchWord("conseil").syllables, ["con", "seil"],
  "conseil: con-seil");
assert.deepEqual(analyzeFrenchWord("sommeil").syllables, ["som", "meil"],
  "sommeil: som-meil");
assert.deepEqual(analyzeFrenchWord("appareil").syllables, ["ap", "pa", "reil"],
  "appareil: ap-pa-reil");

// ---------- MOTS EN -ILLE CLASSIQUES ----------

assert.deepEqual(analyzeFrenchWord("fille").syllables, ["fille"],
  "fille: monosyllabe");
assert.deepEqual(analyzeFrenchWord("ville").syllables, ["ville"],
  "ville: monosyllabe");
assert.deepEqual(analyzeFrenchWord("mille").syllables, ["mille"],
  "mille: monosyllabe");
assert.deepEqual(analyzeFrenchWord("vanille").syllables, ["va", "nille"],
  "vanille: va-nille");
assert.deepEqual(analyzeFrenchWord("chenille").syllables, ["che", "nille"],
  "chenille: che-nille");
assert.deepEqual(analyzeFrenchWord("coquille").syllables, ["co", "quille"],
  "coquille: co-quille");

// ---------- MOTS COURANTS DIVERS ----------

assert.equal(
  syllabifyFrenchWord("extraordinaire", { level: "strong", separator: "-" }),
  "ex-tra-or-din-aire",
  "extraordinaire: decoupe complexe"
);

assert.equal(
  syllabifyFrenchWord("construction", { level: "strong", separator: "-" }),
  "con-struc-tion",
  "construction: cluster str"
);

// ---------- MODE OFF ----------

assert.equal(
  syllabifyFrenchWord("communication", { level: "off", separator: "-" }),
  "communication",
  "En mode off, aucun mot ne doit etre decoupe"
);

assert.equal(
  syllabifyFrenchText("Bonjour le monde.", { level: "off", separator: "-" }),
  "Bonjour le monde.",
  "En mode off, le texte reste intact"
);

console.log("syllabify-french: ok");
