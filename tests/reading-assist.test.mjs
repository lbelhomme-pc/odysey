import assert from "node:assert/strict";

import {
  buildInstructionBreakdown,
  buildLocalWordInsight,
  buildSchoolReformulation,
  buildSchoolSummary,
  buildShortSummary,
  buildSimpleReformulation,
  detectInstructionStructure,
  lookupWordInsight,
  normalizeSchoolLevel,
  sanitizeLookupWord
} from "../src/core/reading/reading-assist.mjs";

assert.equal(sanitizeLookupWord("« fable »"), "fable", "Le mot nettoye doit retirer la ponctuation externe.");

const wordInsight = await lookupWordInsight("fable", {
  allowRemote: false,
  mode: "pedagogique",
  level: "strong",
  wordScope: "all"
});
assert.equal(wordInsight.word, "fable", "Le mot conserve doit rester lisible.");
assert.match(wordInsight.syllableDisplay, /fa/i, "La decoupe syllabique doit etre exposee.");
assert.match(wordInsight.definition, /recit|morale/i, "La definition locale doit etre disponible.");
assert.equal(wordInsight.definitionSource, "dictionnaire-local", "Le panneau mot doit privilegier le dictionnaire local hors ligne.");
assert.equal(wordInsight.category, "literature", "Le domaine du mot doit etre disponible pour l'interface.");

const literaryInsight = buildLocalWordInsight("rencontrée", {
  mode: "pedagogique",
  level: "strong",
  wordScope: "all"
});
assert.equal(literaryInsight.lemma, "rencontrer", "Les formes verbales doivent retrouver leur lemme local.");
assert.equal(literaryInsight.definitionSource, "dictionnaire-local", "Les formes verbales connues doivent utiliser le dictionnaire local.");
assert.equal(literaryInsight.category, "literature", "Le domaine local doit rester disponible.");

const scienceInsight = buildLocalWordInsight("concentration", {
  mode: "pedagogique",
  level: "strong",
  wordScope: "all"
});
assert.equal(scienceInsight.category, "science", "Les mots scientifiques doivent remonter leur domaine.");

const autoWordInsight = buildLocalWordInsight("table", {
  mode: "pedagogique",
  level: "light",
  wordScope: "auto"
});
assert.equal(autoWordInsight.syllablesVisible, false, "En mode Auto, le panneau mot doit respecter les memes filtres que le lecteur.");
assert.equal(autoWordInsight.syllableDisplay, "", "Le panneau mot ne doit pas inventer une decoupe visible quand le lecteur la masque.");

const allWordInsight = buildLocalWordInsight("table", {
  mode: "pedagogique",
  level: "light",
  wordScope: "all"
});
assert.equal(allWordInsight.syllablesVisible, true, "Le mode Tous les mots doit forcer l'affichage syllabique dans le panneau mot.");
assert.match(allWordInsight.syllableDisplay, /ta/i, "La decoupe forcee doit etre disponible.");

const typographicWordInsight = buildLocalWordInsight("numéro", {
  mode: "typographique",
  level: "strong",
  wordScope: "all"
});
assert.equal(typographicWordInsight.syllabificationMode, "typographique", "Le panneau mot doit memoriser le mode de syllabation actif.");

const text =
  "La concentration indique combien de matière est présente dans un volume donné. Elle permet de comparer deux solutions. Elle aide aussi à préparer un mélange plus précis.";
const summary = buildShortSummary(text);
assert.match(summary, /concentration/i, "Le resume court doit conserver l'idee principale.");

const reformulation = buildSimpleReformulation(text);
assert.match(reformulation, /En clair/i, "La reformulation doit annoncer sa version simplifiee.");
assert.match(reformulation, /sert|permet|aide/i, "La reformulation doit rester concrete.");

assert.equal(normalizeSchoolLevel("lycee"), "lycee", "Le niveau lycee doit etre reconnu.");
assert.equal(normalizeSchoolLevel("primaire"), "college", "Le niveau inconnu doit revenir au college.");

const schoolSummary = buildSchoolSummary(text, { level: "college" });
assert.match(schoolSummary, /concentration/i, "Le resume scolaire doit conserver l'idee principale.");

const schoolReformulation = buildSchoolReformulation(text, { level: "college" });
assert.ok(schoolReformulation.length > 20, "La reformulation scolaire doit produire un texte lisible.");

const instructionAnalysis = detectInstructionStructure("Lis le texte puis reponds a la question et justifie ta reponse.");
assert.equal(instructionAnalysis.isInstruction, true, "Une consigne doit etre detectee.");
assert.equal(instructionAnalysis.multiTask, true, "Une consigne composee doit etre reconnue comme multitache.");
assert.ok(instructionAnalysis.taskCount >= 2, "La consigne composee doit etre decoupee en plusieurs taches.");

const instructionBreakdown = buildInstructionBreakdown("Lis le texte puis reponds a la question et justifie ta reponse.", {
  level: "college",
  analysis: instructionAnalysis
});
assert.match(instructionBreakdown, /1\./u, "Le decoupage de consigne doit numeroter les etapes.");

console.log("reading-assist: ok");
