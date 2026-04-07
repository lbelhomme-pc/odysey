import assert from "node:assert/strict";

import { analyzeMathContent } from "../src/core/reading/math-support.mjs";

const financialTableLine = "Les montants des remboursements sont exprimés en % de la Base de Remboursement de la Sécurité Sociale (BRSS).";
const financialAnalysis = analyzeMathContent(financialTableLine);

assert.equal(
  financialAnalysis.isFormulaCandidate,
  false,
  "Une ligne explicative de garanties avec BRSS et pourcentages ne doit pas être classée comme formule."
);
assert.equal(
  financialAnalysis.containsMath,
  false,
  "Une ligne de garanties/remboursements ne doit pas être traitée comme contenu mathématique."
);

const guaranteeValueLine = "Consultation spécialiste 200 % BRSS et forfait de 50 euros.";
const guaranteeValueAnalysis = analyzeMathContent(guaranteeValueLine);

assert.equal(
  guaranteeValueAnalysis.isFormulaCandidate,
  false,
  "Une ligne de tableau de garanties avec pourcentage et euros ne doit pas être classée comme formule."
);

const formulaAnalysis = analyzeMathContent("3x^2 + 2x - 5 = 0");

assert.equal(formulaAnalysis.isFormulaCandidate, true, "Une vraie expression algébrique doit rester détectée.");
assert.equal(formulaAnalysis.containsMath, true, "Une vraie expression algébrique doit rester marquée comme mathématique.");

console.log("math-support: ok");
