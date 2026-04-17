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
  "Les blocs administratifs ne doivent pas recevoir de coloration syllabique ou phonemique."
);

const readingMarkup = renderAdaptedText("Le moteur fonctionne bien.", {
  colorationMode: "pedagogique",
  syllableLevel: "strong",
  syllableBreakMode: "middleDot",
  blockType: "paragraph"
});

assert.ok(
  readingMarkup.includes("syllabe1") || readingMarkup.includes("syllabe2"),
  "Le texte de lecture courant doit conserver la decoupe syllabique."
);

const offsetMarkup = renderAdaptedText("Je vis ici", {
  colorationMode: "none",
  syllableLevel: "off",
  syllableBreakMode: "none",
  blockType: "paragraph",
  audioTracking: true,
  sourceOffset: 42
});

assert.ok(
  offsetMarkup.includes('data-source-start="42"') &&
    offsetMarkup.includes('data-source-start="45"') &&
    offsetMarkup.includes('data-source-start="49"'),
  "Les mots rendus depuis une phrase doivent conserver leur position absolue dans le bloc."
);

const pedagogicContrastWithoutExplicitSyllables = renderAdaptedText("Le moteur fonctionne bien.", {
  colorationMode: "pedagogiqueContrast",
  syllableLevel: "off",
  syllableBreakMode: "none",
  blockType: "paragraph"
});

assert.ok(
  pedagogicContrastWithoutExplicitSyllables.includes("syllabe1") ||
    pedagogicContrastWithoutExplicitSyllables.includes("syllabe2"),
  "Les colorations pedagogiques doivent rester visibles meme si le mode syllabes est desactive."
);

const vividSoundMarkup = renderAdaptedText("ciel car", {
  colorationMode: "sonsFrancais",
  soundColorMode: "vivid",
  syllableLevel: "off",
  syllableBreakMode: "none",
  blockType: "paragraph"
});

assert.ok(
  vividSoundMarkup.includes('data-phoneme="s"') &&
    vividSoundMarkup.includes('data-phoneme="k"') &&
    vividSoundMarkup.includes("sound-vivid") &&
    vividSoundMarkup.includes("phoneme-inconsistent"),
  "Le mode sons francais doit refleter les variations contextuelles du grapheme c avec un contraste fort."
);

const alternatingWordsMarkup = renderAdaptedText("Maitre corbeau sur un arbre", {
  colorationMode: "alternanceMots",
  syllableLevel: "off",
  syllableBreakMode: "none",
  blockType: "paragraph"
});

assert.ok(
  alternatingWordsMarkup.includes('data-word-pattern="a"') &&
    alternatingWordsMarkup.includes('data-word-pattern="b"'),
  "Le mode d'alternance par mot doit poser un motif visuel sur des mots successifs."
);

const monochromeMarkup = renderAdaptedText("Maitre corbeau sur un arbre", {
  colorationMode: "noirEtBlanc",
  syllableLevel: "off",
  syllableBreakMode: "none",
  blockType: "paragraph"
});

assert.ok(
  monochromeMarkup.includes('data-word-pattern="a"') &&
    monochromeMarkup.includes('data-word-pattern="b"') &&
    !monochromeMarkup.includes("syllabe1"),
  "Le mode noir et blanc doit garder un reperage visuel simple sans reactiver la coloration syllabique."
);

const monochromeStrongMarkup = renderAdaptedText("an on oi", {
  colorationMode: "sonsFrancais",
  soundColorMode: "monoStrong",
  syllableLevel: "off",
  syllableBreakMode: "none",
  blockType: "paragraph"
});

assert.ok(
  monochromeStrongMarkup.includes("sound-mono-strong") &&
    monochromeStrongMarkup.includes("sound-nasal") &&
    monochromeStrongMarkup.includes("sound-semivowel"),
  "Le mode noir et blanc fort doit exposer une variante plus marquee des sons francais."
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
  "Le mode tous les mots doit forcer la decoupe syllabique sur les mots courts multisyllabiques."
);

const typographicModeMarkup = renderAdaptedText("numero", {
  colorationMode: "none",
  syllableLevel: "strong",
  syllabificationMode: "typographique",
  syllableWordScope: "all",
  syllableBreakMode: "hyphen",
  blockType: "paragraph"
});

assert.match(
  typographicModeMarkup,
  /num[\s\S]*syllable-separator[\s\S]*ro/u,
  "Le mode typographique doit utiliser la syllabation conservatrice dans le rendu adapte."
);

const normalMarkup = renderAdaptedText("differentes formes de comique", {
  colorationMode: "none",
  syllableLevel: "off",
  syllableBreakMode: "none",
  blockType: "paragraph"
});

assert.ok(
  !normalMarkup.includes('class="muet"'),
  "Le mode normal ne doit pas attenuer les lettres muettes."
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
  "Les titres doivent rester sobres meme en decodage renforce."
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
  "Les entrees de sommaire ne doivent pas etre decodees visuellement."
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
  "Les noms d'auteur courts doivent rester lisibles sans decoupage force."
);

console.log("decoding-engine: ok");
