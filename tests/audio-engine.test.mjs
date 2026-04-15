import assert from "node:assert/strict";

import { AudioEngine } from "../src/core/reading/audio-engine.mjs";

globalThis.SpeechSynthesisUtterance = class FakeSpeechSynthesisUtterance {
  constructor(text) {
    this.text = text;
    this.rate = 1;
    this.voice = null;
    this.onboundary = null;
    this.onerror = null;
    this.onend = null;
  }
};

function createBlock(blockKey, speechText) {
  return {
    dataset: {
      blockKey,
      speechText
    },
    classList: {
      contains() {
        return false;
      }
    }
  };
}

const engine = new AudioEngine({ synthesis: {} });
const blocks = [
  createBlock("page-1-block-1", "Un deux trois. Quatre cinq six."),
  createBlock("page-1-block-2", "Sept huit neuf.")
];

engine.loadFromBlocks(blocks, {
  startKey: "page-1-block-1",
  startSentenceIndex: 0,
  startWordIndex: 1
});

assert.equal(engine.queue[0].text, "deux trois.", "La lecture doit pouvoir repartir au mot choisi dans la premiere phrase.");
assert.deepEqual(
  engine.queue[0].tokens.map((token) => token.originalWordIndex),
  [1, 2],
  "Les index de mots originaux doivent etre conserves pour le surlignage karaoke."
);
assert.equal(engine.queue[0].tokens[0].index, 0, "Le premier mot parle doit demarrer a l'index 0 dans la phrase tronquee.");
assert.equal(engine.queue[1].text, "Quatre cinq six.", "Les phrases suivantes du meme bloc doivent rester intactes.");
assert.equal(engine.queue[2].text, "Sept huit neuf.", "Les blocs suivants doivent rester lisibles.");

engine.loadFromBlocks(blocks, {
  startKey: "page-1-block-1",
  startSentenceIndex: 1,
  startWordIndex: 2
});

assert.equal(engine.queue[0].text, "six.", "Un depart a l'interieur de la deuxieme phrase doit rester possible.");
assert.deepEqual(
  engine.queue[0].tokens.map((token) => token.originalWordIndex),
  [2],
  "La file audio doit garder l'index de mot d'origine meme apres un depart tardif."
);

const synthesis = {
  paused: true,
  speaking: false,
  resumeCalls: 0,
  cancelCalls: 0,
  speakCalls: 0,
  getVoices() {
    return [];
  },
  resume() {
    this.resumeCalls += 1;
    this.paused = false;
  },
  cancel() {
    this.cancelCalls += 1;
    this.paused = false;
    this.speaking = false;
  },
  speak(utterance) {
    this.speakCalls += 1;
    this.speaking = true;
    this.lastUtteranceText = utterance.text;
    utterance.onstart?.();
  }
};

const resumedEngine = new AudioEngine({ synthesis });
resumedEngine.loadFromBlocks(blocks, {
  startKey: "page-1-block-1",
  startSentenceIndex: 0,
  startWordIndex: 2
});

assert.equal(
  resumedEngine.play(),
  true,
  "Une reprise sur un nouveau mot doit rester possible meme si speechSynthesis est encore marque en pause."
);
assert.equal(
  synthesis.resumeCalls,
  2,
  "Le moteur doit nettoyer l'etat paused global puis reveiller la synthese web juste apres le demarrage."
);
assert.equal(synthesis.speakCalls, 1, "Le moteur doit ensuite lancer la nouvelle phrase au lieu de reprendre un flux vide.");
assert.equal(synthesis.lastUtteranceText, "trois.", "Le nouveau point de depart doit etre respecte.");

const voicedSynthesis = {
  paused: false,
  speaking: false,
  resumeCalls: 0,
  speakCalls: 0,
  voices: [{ voiceURI: "fr-system", lang: "fr-FR", default: true }],
  getVoices() {
    return this.voices;
  },
  resume() {
    this.resumeCalls += 1;
    this.paused = false;
  },
  cancel() {
    this.paused = false;
    this.speaking = false;
  },
  speak(utterance) {
    this.speakCalls += 1;
    this.speaking = true;
    this.lastUtterance = utterance;
    utterance.onstart?.();
  }
};

const voicedEngine = new AudioEngine({ synthesis: voicedSynthesis });
voicedEngine.loadFromBlocks(blocks, {
  startKey: "page-1-block-1",
  startSentenceIndex: 0,
  startWordIndex: 0
});

assert.equal(
  voicedEngine.play(),
  true,
  "La lecture web doit rester possible meme sans voix explicitement choisie par l'utilisateur."
);
assert.equal(voicedSynthesis.speakCalls, 1, "Le moteur doit bien appeler la synthese vocale du navigateur.");
assert.equal(voicedSynthesis.lastUtterance.lang, "fr-FR", "Une langue francaise doit etre appliquee par defaut.");
assert.equal(
  voicedSynthesis.lastUtterance.voice?.voiceURI,
  "fr-system",
  "La premiere voix francaise disponible doit etre choisie automatiquement."
);

console.log("audio-engine: ok");
