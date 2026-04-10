import assert from "node:assert/strict";
import {
  buildLocalAiDefinitionRequest,
  buildLocalAiReformulationRequest,
  buildLocalAiSummaryRequest,
  cleanLocalAiText,
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
assert.match(summaryRequest.prompt, /Résume ce paragraphe/u);

const reformulationRequest = buildLocalAiReformulationRequest("Le paragraphe original est complexe.");
assert.match(reformulationRequest.prompt, /français plus simple/u);

assert.equal(cleanLocalAiText("Résumé :  Bonjour   le monde  "), "Bonjour le monde");
assert.equal(cleanLocalAiText("```txt\nBonjour\n```"), "");

console.log("local-llm: ok");
