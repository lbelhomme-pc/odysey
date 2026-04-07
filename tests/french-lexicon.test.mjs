import assert from "node:assert/strict";

import {
  analyzeFrenchLexiconText,
  normalizeCommonFrenchReadingArtifacts,
  normalizeFrenchLexiconWord,
  repairMergedFrenchText,
  repairSplitFrenchText
} from "../src/core/lexicon/french-lexicon.mjs";

assert.equal(normalizeFrenchLexiconWord("Element"), "element");
assert.equal(normalizeFrenchLexiconWord("oeuvre"), "oeuvre");

const scienceText = await analyzeFrenchLexiconText("Les enzymes catalysent des reactions chimiques.");
assert.equal(scienceText.reviewLevel, "none");
assert.equal(scienceText.mergedCandidates.length, 0);
assert.ok(scienceText.knownRatio > 0.7, "Le ratio lexical doit rester bon sur une phrase scientifique courante.");

const mergedText = await analyzeFrenchLexiconText("colonne possedent colonnepossedent");
assert.ok(
  mergedText.mergedCandidates.some((candidate) => candidate.suggestion === "colonne possedent"),
  "Le lexique doit proposer une decoupe pour un mot OCR colle."
);

assert.equal(await repairMergedFrenchText("desFemmes Savantesde Moliere"), "des Femmes Savantes de Moliere");
assert.equal(await repairMergedFrenchText("Reconnaitre unacide et unereaction."), "Reconnaitre un acide et une reaction.");
assert.equal(await repairMergedFrenchText("Relier lepH et unebaseet uncouple."), "Relier le pH et une base et un couple.");
assert.equal(await repairSplitFrenchText("De finition et de mander."), "Definition et demander.");
assert.equal(await repairSplitFrenchText("Sa la ires et au tres."), "Salaires et autres.");
assert.equal(await repairSplitFrenchText("OPTIONNEL LES et Cyc le."), "OPTIONNELLES et Cycle.");
assert.equal(
  normalizeCommonFrenchReadingArtifacts("Relier acide-baseavec un tampon pHet ci-des sous."),
  "Relier acide-base avec un tampon pH et ci-dessous."
);
assert.equal(normalizeCommonFrenchReadingArtifacts("Il vient às'en vouloir."), "Il vient à s'en vouloir.");

console.log("french-lexicon: ok");
