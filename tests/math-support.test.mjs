import assert from "node:assert/strict";

import { analyzeMathContent, renderMathText, verbalizeMathText } from "../src/core/reading/math-support.mjs";

const financialTableLine =
  "Les montants des remboursements sont exprimes en % de la Base de Remboursement de la Securite Sociale (BRSS).";
const financialAnalysis = analyzeMathContent(financialTableLine);

assert.equal(
  financialAnalysis.isFormulaCandidate,
  false,
  "Une ligne explicative de garanties avec BRSS et pourcentages ne doit pas etre classee comme formule."
);
assert.equal(
  financialAnalysis.containsMath,
  false,
  "Une ligne de garanties/remboursements ne doit pas etre traitee comme contenu mathematique."
);

const guaranteeValueLine = "Consultation specialiste 200 % BRSS et forfait de 50 euros.";
const guaranteeValueAnalysis = analyzeMathContent(guaranteeValueLine);

assert.equal(
  guaranteeValueAnalysis.isFormulaCandidate,
  false,
  "Une ligne de tableau de garanties avec pourcentage et euros ne doit pas etre classee comme formule."
);

const guaranteePercentLine = "Praticien OPTAM / OPTAM - ACO 70% 150% 175% 200%";
const guaranteePercentAnalysis = analyzeMathContent(guaranteePercentLine);

assert.equal(
  guaranteePercentAnalysis.containsMath,
  false,
  "Une ligne de garanties avec plusieurs pourcentages et libelles de remboursement ne doit pas etre classee comme mathematique."
);
assert.equal(
  guaranteePercentAnalysis.isFormulaCandidate,
  false,
  "Une ligne de garanties avec options et pourcentages ne doit pas etre reconstruite comme formule."
);

const flatGuaranteeLine = "Frais de sejour 80% 100% 100% 100%";
const flatGuaranteeAnalysis = analyzeMathContent(flatGuaranteeLine);

assert.equal(
  flatGuaranteeAnalysis.containsMath,
  false,
  "Une ligne de garanties plate avec plusieurs pourcentages ne doit pas etre classee comme contenu mathematique."
);
assert.equal(
  flatGuaranteeAnalysis.isFormulaCandidate,
  false,
  "Une ligne de garanties plate avec plusieurs pourcentages ne doit pas etre reconstruite comme formule."
);

const formulaAnalysis = analyzeMathContent("3x^2 + 2x - 5 = 0");

assert.equal(formulaAnalysis.isFormulaCandidate, true, "Une vraie expression algebrique doit rester detectee.");
assert.equal(formulaAnalysis.containsMath, true, "Une vraie expression algebrique doit rester marquee comme mathematique.");

const greekFormula = "\u0394T = \u03bb/(\u03c1\u00b7c) + \u03b1^2";
const greekAnalysis = analyzeMathContent(greekFormula);

assert.equal(greekAnalysis.isFormulaCandidate, true, "Une formule scientifique avec lettres grecques doit etre detectee.");
assert.equal(greekAnalysis.containsMath, true, "Une formule avec lettres grecques doit etre marquee comme mathematique.");
assert.equal(greekAnalysis.stats.greekLetterCount >= 4, true, "Le comptage des lettres grecques doit etre conserve.");

const greekSpeech = verbalizeMathText(greekFormula);
assert.match(greekSpeech, /delta/i, "La verbalisation doit lire Delta.");
assert.match(greekSpeech, /lambda/i, "La verbalisation doit lire lambda.");
assert.match(greekSpeech, /rho/i, "La verbalisation doit lire rho.");
assert.match(greekSpeech, /alpha/i, "La verbalisation doit lire alpha.");

const trigFormula = "sin(\u03b8) = 0";
const trigAnalysis = analyzeMathContent(trigFormula);
assert.equal(trigAnalysis.isFormulaCandidate, true, "Une fonction scientifique usuelle doit etre reconnue comme formule.");

const trigSpeech = verbalizeMathText(trigFormula);
assert.match(trigSpeech, /sinus/i, "La verbalisation doit lire sin comme sinus.");
assert.match(trigSpeech, /theta/i, "La verbalisation doit lire theta.");

const unitFormula = "v = 3 m/s²";
const unitAnalysis = analyzeMathContent(unitFormula);
assert.equal(unitAnalysis.containsMath, true, "Une expression avec unite scientifique doit etre reconnue.");
assert.equal(unitAnalysis.stats.unitCount >= 1, true, "Le comptage des unites scientifiques doit etre conserve.");

const temperatureFormula = "T = 20 °C";
const temperatureSpeech = verbalizeMathText(temperatureFormula);
assert.match(temperatureSpeech, /degres Celsius/i, "La verbalisation doit lire les degres Celsius.");

const renderedGreek = renderMathText(greekFormula);
assert.match(renderedGreek, /class="math-greek"/, "Le rendu HTML doit styler les lettres grecques.");
assert.match(renderedGreek, /class="math-variable"/, "Le rendu HTML doit styler les variables latines.");
assert.match(renderedGreek, /class="math-operator"/, "Le rendu HTML doit styler les operateurs.");

const renderedTrig = renderMathText(trigFormula);
assert.match(renderedTrig, /class="math-function"/, "Le rendu HTML doit styler les fonctions mathematiques.");

const renderedUnit = renderMathText(unitFormula);
assert.match(renderedUnit, /class="math-unit"/, "Le rendu HTML doit styler les unites scientifiques.");

const literaryFooter = "© WEBLETTRES / LE ROBERT – Français 2 – Livre unique – Collection Passeurs de textes";
const literaryFooterAnalysis = analyzeMathContent(literaryFooter);
assert.equal(
  literaryFooterAnalysis.containsMath,
  false,
  "Une ligne éditoriale avec numéro de niveau et slash ne doit pas être classée comme contenu mathématique."
);
assert.equal(
  literaryFooterAnalysis.isFormulaCandidate,
  false,
  "Une mention d’éditeur ne doit pas être reconstruite comme formule."
);

const theatreReference = "Allons commettre un autre au soin que l'on me donne, Et prenons le secours Molière, Les Femmes savantes, Acte I, Scène IV, 1672.";
const theatreReferenceAnalysis = analyzeMathContent(theatreReference);
assert.equal(
  theatreReferenceAnalysis.verificationLevel,
  "none",
  "Une référence littéraire avec date et acte ne doit pas déclencher une vérification scientifique."
);

const literarySpeech = verbalizeMathText("Je puis fermer les yeux sur vos flammes secrètes.");
assert.doesNotMatch(
  literarySpeech,
  /millimetres|pascals/iu,
  "Un texte littéraire ne doit pas être verbalise comme des unités scientifiques."
);

const financialLegend = "FR = Frais réels.";
const financialLegendAnalysis = analyzeMathContent(financialLegend);
assert.equal(
  financialLegendAnalysis.containsMath,
  false,
  "Une légende d'assurance du type FR = Frais réels ne doit pas être traitée comme formule."
);
assert.equal(
  financialLegendAnalysis.isFormulaCandidate,
  false,
  "Une abréviation explicitée ne doit pas produire un bloc formule."
);

const financialExplanation =
  "maîtrisée (Option de Pratique Tarifaire Maîtrisée, Option de Pratique Tarifaire Maîtrisée des Anesthésie - Chirurgie - Obstétrique) prévus par la Convention nationale du 25 août 2016, applicable";
const financialExplanationAnalysis = analyzeMathContent(financialExplanation);
assert.equal(
  financialExplanationAnalysis.containsMath,
  false,
  "Une explication d'assurance longue avec date et tirets ne doit pas être classée comme mathématique."
);

const literaryDialogue = "Que vois-je ? cria-t-il : ôtez-moi cet objet.";
const literaryDialogueAnalysis = analyzeMathContent(literaryDialogue);
assert.equal(
  literaryDialogueAnalysis.isFormulaCandidate,
  false,
  "Un dialogue littéraire avec tirets pronominaux ne doit pas être pris pour une formule."
);

const middleDot = String.fromCodePoint(0xb7);
const compactMultiplication = analyzeMathContent(`a${middleDot}b`);
assert.equal(
  compactMultiplication.isFormulaCandidate,
  true,
  "Un produit compact de type a·b doit rester reconnu comme formule."
);

console.log("math-support: ok");
