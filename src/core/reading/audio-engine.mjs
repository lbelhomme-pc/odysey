/**
 * Moteur audio pour la lecture assistee.
 * Cette version encapsule la synthese vocale, la segmentation en phrases
 * et les callbacks de suivi fin pour preparer un mode karaoke robuste.
 */

import { verbalizeMathText } from "./math-support.mjs";

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || min, min), max);
}

export function mapUiSpeechRate(rate) {
  const normalized = clamp(rate, 0.7, 1.4);
  return clamp(normalized - 0.25, 0.5, 1.15);
}

export function segmentTextIntoSentences(text) {
  const source = String(text || "");
  const segments = [];
  const boundaryRegex = /[.!?;:]+(?:\s+|$)|\n+/gu;
  let start = 0;
  let match;

  while ((match = boundaryRegex.exec(source)) !== null) {
    const end = match.index + match[0].length;
    const rawText = source.slice(start, end);
    const speechText = rawText.replace(/\s+/gu, " ").trim();
    if (speechText) {
      segments.push({ rawText, speechText });
    }
    start = end;
  }

  if (start < source.length) {
    const rawText = source.slice(start);
    const speechText = rawText.replace(/\s+/gu, " ").trim();
    if (speechText) {
      segments.push({ rawText, speechText });
    }
  }

  return segments;
}

export function tokenizeAudioWords(text) {
  const source = String(text || "");
  const matcher = /\p{L}[\p{L}\p{M}'’-]*|\d+(?:[.,]\d+)?/gu;
  return Array.from(source.matchAll(matcher)).map((match) => ({
    text: match[0],
    index: match.index ?? 0
  }));
}

function normaliseSpeechText(text, isMath = false) {
  return isMath ? verbalizeMathText(text) : String(text || "");
}

export class AudioEngine {
  constructor({ synthesis = globalThis.speechSynthesis } = {}) {
    this.synthesis = synthesis || null;
    this.container = null;
    this.queue = [];
    this.history = [];
    this.currentIndex = -1;
    this.currentUtterance = null;
    this.rate = 1;
    this.voiceURI = "";
    this.pauseBetweenSentences = 0;
    this.callbacks = {};
    this.pauseTimer = null;
    this.isPaused = false;
    this.isStopped = false;
  }

  /**
   * Attache le moteur a la zone de lecture.
   * @param {HTMLElement | null} container
   */
  init(container) {
    this.container = container || null;
  }

  /**
   * Regle la vitesse de lecture.
   * @param {number} rate
   */
  setRate(rate) {
    this.rate = mapUiSpeechRate(rate);
  }

  /**
   * Memorise la voix a utiliser.
   * @param {string} voiceName
   */
  setVoice(voiceName) {
    this.voiceURI = String(voiceName || "");
  }

  /**
   * Regle la pause entre chaque phrase.
   * @param {number} delayMs
   */
  setPauseBetweenSentences(delayMs) {
    this.pauseBetweenSentences = Math.max(0, Number(delayMs) || 0);
  }

  /**
   * Charge une file de phrases depuis des blocs du lecteur.
   * @param {HTMLElement[]} blocks
   * @param {object} options
   */
  loadFromBlocks(blocks, options = {}) {
    const startKey = options.startKey || "";
    const startSentenceIndex = Math.max(0, Number(options.startSentenceIndex) || 0);
    const safeBlocks = Array.isArray(blocks) ? blocks : [];
    const startIndex = Math.max(
      0,
      safeBlocks.findIndex((block) => block?.dataset?.blockKey === startKey)
    );

    this.callbacks = {
      onBlockStart: options.onBlockStart,
      onSentenceStart: options.onSentenceStart,
      onWordBoundary: options.onWordBoundary,
      onEnd: options.onEnd,
      onError: options.onError
    };

    this.clearPauseTimer();
    this.queue = safeBlocks
      .slice(startIndex)
      .flatMap((block, relativeBlockIndex) => {
        const blockKey = block?.dataset?.blockKey || "";
        const sourceText = block?.dataset?.speechText || block?.textContent || "";
        const isMath = block?.classList?.contains("has-math") || block?.dataset?.math === "true";
        const speechText = normaliseSpeechText(sourceText, isMath);
        const items = segmentTextIntoSentences(speechText).map((segment, sentenceIndex) => ({
          blockKey,
          sentenceIndex,
          text: segment.speechText,
          tokens: tokenizeAudioWords(segment.speechText)
        }));
        return relativeBlockIndex === 0 ? items.slice(startSentenceIndex) : items;
      })
      .filter((item) => item.text.trim().length > 0);

    this.history = [];
    this.currentIndex = -1;
    this.currentUtterance = null;
    this.isPaused = false;
    this.isStopped = false;
  }

  /**
   * Lance ou reprend la lecture.
   */
  play() {
    if (!this.synthesis) {
      return false;
    }

     if (this.pauseTimer) {
      this.clearPauseTimer();
      this.isPaused = false;
      this.isStopped = false;
      this.currentIndex = Math.max(this.currentIndex, 0);
      this.speakCurrent();
      return true;
    }

    if (this.synthesis.paused) {
      this.isPaused = false;
      this.isStopped = false;
      this.synthesis.resume();
      return true;
    }

    if (this.currentUtterance) {
      return true;
    }

    if (this.queue.length === 0) {
      return false;
    }

    this.isPaused = false;
    this.isStopped = false;
    this.currentIndex = Math.max(this.currentIndex, 0);
    this.speakCurrent();
    return true;
  }

  /**
   * Met la lecture en pause.
   */
  pause() {
    if (this.pauseTimer) {
      this.clearPauseTimer();
      this.isPaused = true;
      return;
    }

    if (!this.synthesis?.speaking) {
      return;
    }
    this.isPaused = true;
    this.synthesis.pause();
  }

  /**
   * Arrete completement la lecture en cours.
   */
  stop() {
    this.isStopped = true;
    this.isPaused = false;
    this.clearPauseTimer();
    this.synthesis?.cancel();
    this.currentUtterance = null;
  }

  /**
   * Passe a la phrase suivante.
   */
  nextSentence() {
    if (this.queue.length === 0) {
      return;
    }
    const nextIndex = Math.min(Math.max(this.currentIndex + 1, 0), Math.max(this.queue.length - 1, 0));
    this.isPaused = false;
    this.isStopped = false;
    this.stop();
    this.currentIndex = nextIndex;
    this.speakCurrent();
  }

  /**
   * Revient a la phrase precedente.
   */
  prevSentence() {
    if (this.queue.length === 0) {
      return;
    }
    const previousIndex = Math.max(this.currentIndex - 1, 0);
    this.isPaused = false;
    this.isStopped = false;
    this.stop();
    this.currentIndex = previousIndex;
    this.speakCurrent();
  }

  clearPauseTimer() {
    if (this.pauseTimer) {
      globalThis.clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
  }

  speakCurrent() {
    if (!this.synthesis || this.currentIndex < 0 || this.currentIndex >= this.queue.length) {
      this.currentUtterance = null;
      this.callbacks.onEnd?.();
      return;
    }

    const item = this.queue[this.currentIndex];
    const utterance = new SpeechSynthesisUtterance(item.text);
    utterance.rate = this.rate;
    this.isStopped = false;

    const selectedVoice = this.synthesis.getVoices().find((voice) => voice.voiceURI === this.voiceURI);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    this.callbacks.onBlockStart?.(item);
    this.callbacks.onSentenceStart?.(item);

    utterance.onboundary = (event) => {
      if (event.name && event.name !== "word") {
        return;
      }

      const wordIndex = item.tokens.findIndex((token, index) => {
        const next = item.tokens[index + 1];
        const start = token.index;
        const end = next ? next.index : Number.MAX_SAFE_INTEGER;
        return event.charIndex >= start && event.charIndex < end;
      });

      this.callbacks.onWordBoundary?.({
        ...item,
        charIndex: event.charIndex,
        wordIndex: Math.max(wordIndex, 0)
      });
    };

    utterance.onerror = (error) => {
      this.currentUtterance = null;
      this.clearPauseTimer();
      this.callbacks.onError?.(error);
    };

    utterance.onend = () => {
      if (this.isStopped) {
        this.currentUtterance = null;
        return;
      }
      this.history.push(item);
      this.currentUtterance = null;
      this.currentIndex += 1;
      if (this.pauseBetweenSentences > 0) {
        this.pauseTimer = globalThis.setTimeout(() => {
          this.pauseTimer = null;
          if (this.isStopped || this.isPaused) {
            return;
          }
          this.speakCurrent();
        }, this.pauseBetweenSentences);
      } else {
        this.speakCurrent();
      }
    };

    this.currentUtterance = utterance;
    this.synthesis.speak(utterance);
  }
}
