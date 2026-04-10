import assert from "node:assert/strict";

import { renderAdaptedText } from "../src/core/reading/decoding-engine.mjs";

const administrativeBlock =
  "EXTRAIT INDIVIDUEL DE L'ARRETE COLLECTIF RECTORAL n° 254 du 09-07-2025";

const administrativeMarkup = renderAdaptedText(administrativeBlock, {
  colorationMode: "sonsFrancais",
  syllableLevel: "strong",
  syllableBreakMode: "middleDot",
  blockType: "paragraph"
});

assert.ok(
  !administrativeMarkup.includes("syllabe1") &&
    !administrativeMarkup.includes("syllabe2") &&
    !administrativeMarkup.includes("sound-"),
  "Les blocs administratifs ne doivent pas recevoir de coloration syllabique ou phonémique."
);

const readingMarkup = renderAdaptedText("Le moteur fonctionne bien.", {
  colorationMode: "pedagogique",
  syllableLevel: "strong",
  syllableBreakMode: "middleDot",
  blockType: "paragraph"
});

assert.ok(
  readingMarkup.includes("syllabe1") || readingMarkup.includes("syllabe2"),
  "Le texte de lecture courant doit conserver la découpe syllabique."
);

const forcedAllWordsMarkup = renderAdaptedText("table", {
  colorationMode: "none",
  syllableLevel: "light",
  syllabificationMode: "pedagogique",
  syllableWordScope: "all",
  syllableBreakMode: "dot",
  blockType: "paragraph"
});

assert.ok(
  forcedAllWordsMarkup.includes("syllable-chunk") && forcedAllWordsMarkup.includes("syllable-separator"),
  "Le mode tous les mots doit forcer la découpe syllabique sur les mots courts multisyllabiques."
);

const typographicModeMarkup = renderAdaptedText("numéro", {
  colorationMode: "none",
  syllableLevel: "strong",
  syllabificationMode: "typographique",
  syllableWordScope: "all",
  syllableBreakMode: "hyphen",
  blockType: "paragraph"
});

assert.match(
  typographicModeMarkup,
  /numé[\s\S]*syllable-separator[\s\S]*ro/u,
  "Le mode typographique doit utiliser la syllabation conservatrice dans le rendu adapté."
);

const normalMarkup = renderAdaptedText("différentes formes de comique", {
  colorationMode: "none",
  syllableLevel: "off",
  syllableBreakMode: "none",
  blockType: "paragraph"
});

assert.ok(
  !normalMarkup.includes('class="muet"'),
  "Le mode normal ne doit pas atténuer les lettres muettes."
);

const headingMarkup = renderAdaptedText("Les dieux voulant instruire un fils de Jupiter", {
  colorationMode: "pedagogique",
  syllableLevel: "strong",
  syllableBreakMode: "middleDot",
  blockType: "heading"
});

assert.ok(
  !headingMarkup.includes("syllabe1") &&
    !headingMarkup.includes("syllabe2") &&
    !headingMarkup.includes("sound-"),
  "Les titres doivent rester sobres même en décodage renforcé."
);

const tocMarkup = renderAdaptedText("Le lion Livre XI - Fable 1 page 2", {
  colorationMode: "pedagogique",
  syllableLevel: "strong",
  syllableBreakMode: "middleDot",
  blockType: "paragraph"
});

assert.ok(
  !tocMarkup.includes("syllabe1") &&
    !tocMarkup.includes("syllabe2") &&
    !tocMarkup.includes("sound-"),
  "Les entrées de sommaire ne doivent pas être décodées visuellement."
);

const authorMarkup = renderAdaptedText("Jean de La Fontaine", {
  colorationMode: "pedagogique",
  syllableLevel: "strong",
  syllableBreakMode: "middleDot",
  blockType: "paragraph"
});

assert.ok(
  !authorMarkup.includes("syllabe1") &&
    !authorMarkup.includes("syllabe2") &&
    !authorMarkup.includes("sound-"),
  "Les noms d’auteur courts doivent rester lisibles sans découpage forcé."
);

console.log("decoding-engine: ok");
