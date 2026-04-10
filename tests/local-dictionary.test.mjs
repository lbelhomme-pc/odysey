import assert from "node:assert/strict";

import {
  getLocalDictionaryDomainStats,
  getLocalDictionarySize,
  hasLocalDictionaryEntry,
  lookupLocalDictionaryEntry
} from "../src/core/lexicon/local-dictionary.mjs";

assert.ok(getLocalDictionarySize() >= 150, "Le dictionnaire local doit embarquer une base solide de définitions.");

const stats = getLocalDictionaryDomainStats();
assert.ok(stats.general >= 20, "Le bloc general doit couvrir les aides de lecture de base.");
assert.ok(stats.literature >= 30, "Le bloc litterature doit couvrir les textes scolaires courants.");
assert.ok(stats.school >= 30, "Le bloc scolaire doit couvrir les consignes et verbes frequents.");
assert.ok(stats.science >= 30, "Le bloc sciences doit couvrir les notions les plus courantes.");
assert.ok(stats.admin >= 25, "Le bloc administratif doit couvrir les documents usuels.");

const fable = lookupLocalDictionaryEntry("fable");
assert.equal(fable?.lemma, "fable", "Le lemme direct doit être retrouvé.");
assert.match(fable?.definition || "", /morale|récit/i, "La définition locale d'un mot littéraire doit être disponible.");

const molecules = lookupLocalDictionaryEntry("molécules");
assert.equal(molecules?.lemma, "molécule", "Les variantes plurielles simples doivent retrouver le bon lemme.");

const rencontre = lookupLocalDictionaryEntry("rencontrée");
assert.equal(rencontre?.lemma, "rencontrer", "Les formes verbales fréquentes doivent pointer vers le verbe de base.");

const schema = lookupLocalDictionaryEntry("schémas");
assert.equal(schema?.lemma, "schéma", "Les variantes nominales de sciences doivent être couvertes.");

const justificatif = lookupLocalDictionaryEntry("justificatif");
assert.match(justificatif?.definition || "", /dépense|droit|situation/i, "Le vocabulaire administratif doit être expliqué localement.");

const alexandrins = lookupLocalDictionaryEntry("alexandrins");
assert.equal(alexandrins?.lemma, "alexandrin", "Le vocabulaire litteraire classique doit etre couvert.");

const relever = lookupLocalDictionaryEntry("relevé");
assert.equal(relever?.lemma, "relever", "Les verbes de consigne doivent rester retrouvables via leurs formes frequentes.");

const hospitalisation = lookupLocalDictionaryEntry("hospitalisation");
assert.match(hospitalisation?.definition || "", /santé|soins|séjour/i, "Le vocabulaire sante/assurance doit etre couvert localement.");

assert.equal(hasLocalDictionaryEntry("justificatif"), true, "Le vocabulaire administratif courant doit être couvert.");
assert.equal(hasLocalDictionaryEntry("motinventéinconnu"), false, "Un mot absent ne doit pas être annoncé comme couvert.");

console.log("local-dictionary: ok");
