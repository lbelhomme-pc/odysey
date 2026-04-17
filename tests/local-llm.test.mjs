import assert from "node:assert/strict";
import {
  buildLocalAiDefinitionRequest,
  buildLocalAiDocumentQuestionRequest,
  buildLocalAiInstructionRequest,
  buildLocalAiReformulationRequest,
  buildLocalAiSchoolReformulationRequest,
  buildLocalAiSchoolSummaryRequest,
  buildLocalAiSummaryRequest,
  cleanLocalAiText,
  normalizeAiSchoolLevel,
  normalizeLocalAiMode,
  normalizeLocalAiModel
} from "../src/core/ai/local-llm.mjs";

assert.equal(normalizeLocalAiMode("off"), "off");
assert.equal(normalizeLocalAiMode("on-demand"), "on-demand");
assert.equal(normalizeLocalAiMode("prefer-local"), "prefer-local");
assert.equal(normalizeLocalAiMode("autre"), "off");

assert.equal(normalizeLocalAiModel("gemma3:4b"), "gemma3:4b");
assert.equal(normalizeLocalAiModel("GEMMA3:1B"), "gemma3:1b");
assert.equal(normalizeLocalAiModel(""), "gemma3:4b");

assert.equal(normalizeAiSchoolLevel("lycee"), "lycee");
assert.equal(normalizeAiSchoolLevel("autre"), "college");

const definitionRequest = buildLocalAiDefinitionRequest({
  word: "fable",
  syllableDisplay: "fa • ble",
  fallbackDefinition: "Petit récit avec une morale.",
  contextText: "Le texte présente une fable de La Fontaine."
});
assert.match(definitionRequest.prompt, /Mot à expliquer : fable/u);
assert.match(definitionRequest.prompt, /fa • ble/u);
assert.match(definitionRequest.prompt, /La Fontaine/u);

const summaryRequest = buildLocalAiSummaryRequest("La nutrition du sportif dépend de son entraînement.");
assert.match(summaryRequest.prompt, /Résume ce passage/u);

const schoolSummaryRequest = buildLocalAiSchoolSummaryRequest("La nutrition du sportif dépend de son entraînement.", {
  level: "lycee"
});
assert.match(schoolSummaryRequest.prompt, /niveau lycée/u);

const reformulationRequest = buildLocalAiReformulationRequest("Le paragraphe original est complexe.");
assert.match(reformulationRequest.prompt, /Réécris ce passage/u);

const schoolReformulationRequest = buildLocalAiSchoolReformulationRequest("Le paragraphe original est complexe.", {
  level: "college"
});
assert.match(schoolReformulationRequest.prompt, /niveau collège/u);

const instructionRequest = buildLocalAiInstructionRequest({
  text: "Lis le texte puis justifie ta réponse.",
  level: "college",
  detectedTasks: ["Lis le texte", "justifie ta réponse"]
});
assert.equal(instructionRequest.preserveLineBreaks, true);
assert.match(instructionRequest.prompt, /étapes numérotées/u);

const questionRequest = buildLocalAiDocumentQuestionRequest({
  question: "Pourquoi le personnage est-il inquiet ?",
  selectedText: "Mon esprit est troublé.",
  documentContext: "[p.1] Mon esprit est troublé.",
  documentTitle: "L'Avare.pdf",
  level: "lycee"
});
assert.equal(questionRequest.preserveLineBreaks, true);
assert.match(questionRequest.prompt, /Question de l'utilisateur/u);
assert.match(questionRequest.prompt, /L'Avare/u);

assert.equal(cleanLocalAiText("Résumé :  Bonjour   le monde  "), "Bonjour le monde");
assert.equal(cleanLocalAiText("```txt\nBonjour\n```"), "");
assert.equal(cleanLocalAiText("1. Lire\n2. Répondre", { preserveLineBreaks: true }), "1. Lire\n2. Répondre");

console.log("local-llm: ok");
