import assert from "node:assert/strict";

import {
  classifyPhoneme,
  getKnownGraphemes,
  isInconsistentGrapheme,
  lookupGrapheme,
  resolveGraphemePhoneme
} from "../src/core/reading/phoneme-reference.mjs";

const cAssociations = lookupGrapheme("c").map((entry) => entry.phoneme);

assert.ok(cAssociations.includes("k"), "Le grapheme c doit pouvoir produire /k/.");
assert.ok(cAssociations.includes("s"), "Le grapheme c doit pouvoir produire /s/.");
assert.equal(isInconsistentGrapheme("c"), true, "Le grapheme c doit etre signale comme variable.");

assert.equal(
  resolveGraphemePhoneme("c", "cil", 0)?.phoneme,
  "s",
  "Devant i, le grapheme c doit basculer vers /s/."
);
assert.equal(
  resolveGraphemePhoneme("c", "car", 0)?.phoneme,
  "k",
  "Devant a, le grapheme c doit rester sur /k/."
);
assert.equal(classifyPhoneme("@"), "nasal", "Le phoneme @ doit etre classe en nasal.");

const graphemes = getKnownGraphemes(5);
assert.ok(graphemes.includes("eau"), "Le referentiel doit inclure eau.");
assert.ok(graphemes.includes("ch"), "Le referentiel doit inclure ch.");
assert.ok(graphemes.includes("qu"), "Le referentiel doit inclure qu.");

console.log("phoneme-reference: ok");
