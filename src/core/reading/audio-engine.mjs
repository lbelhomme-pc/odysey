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
  const normalized = clamp(rate, 0.45, 2);
  return clamp(normalized, 0.35, 2);
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

function getSpeechUtteranceConstructor() {
  const windowCtor = globalThis.window?.SpeechSynthesisUtterance;
  const globalCtor = globalThis.SpeechSynthesisUtterance;
  const Utterance = windowCtor || globalCtor;
  return typeof Utterance === "function" ? Utterance : null;
}

function createSpeechUtterance(text) {
  const Utterance = getSpeechUtteranceConstructor();
  return Utterance ? new Utterance(text) : null;
}

function buildQueueTokens(tokens, startWordIndex = 0) {
  const safeTokens = Array.isArray(tokens) ? tokens : [];
  if (safeTokens.length === 0) {
    return [];
  }

  const normalizedStart = Math.min(Math.max(Number(startWordIndex) || 0, 0), safeTokens.length - 1);
  const firstToken = safeTokens[normalizedStart];

  return safeTokens.slice(normalizedStart).map((token, offset) => ({
    text: token.text,
    index: token.index - firstToken.index,
    originalWordIndex: normalizedStart + offset
  }));
}

function buildQueueItem(blockKey, sentenceIndex, text, startWordIndex = 0) {
  const sourceText = String(text || "");
  const tokens = tokenizeAudioWords(sourceText);
  if (tokens.length === 0) {
    return {
      blockKey,
      sentenceIndex,
      text: sourceText,
      tokens: []
    };
  }

  const normalizedStart = Math.min(Math.max(Number(startWordIndex) || 0, 0), tokens.length - 1);
  const firstToken = tokens[normalizedStart];

  return {
    blockKey,
    sentenceIndex,
    text: sourceText.slice(firstToken.index),
    tokens: buildQueueTokens(tokens, normalizedStart)
  };
}

export class AudioEngine {
  constructor({ synthesis = globalThis.speechSynthesis, nativeSpeech = null, preferNativeSpeech = false } = {}) {
    this.synthesis = synthesis || null;
    this.nativeSpeech = nativeSpeech || null;
    this.preferNativeSpeech = Boolean(preferNativeSpeech && nativeSpeech);
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
    this.nativeTrackingTimer = null;
    this.nativeProgressUnsubscribe = null;
    this.nativeTrackedWordIndex = -1;
    this.nativeSpeechRequestId = 0;
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
   * Configure la voix native fournie par l'application desktop.
   * @param {{ speak?: Function, stop?: Function } | null} nativeSpeech
   */
  setNativeSpeech(nativeSpeech) {
    this.nativeSpeech = nativeSpeech || null;
    this.preferNativeSpeech = Boolean(this.preferNativeSpeech && this.nativeSpeech);
  }

  /**
   * Force ou non l'utilisation de la voix native desktop.
   * @param {boolean} value
   */
  setPreferNativeSpeech(value) {
    this.preferNativeSpeech = Boolean(value && this.nativeSpeech);
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
    const startWordIndex = Math.max(0, Number(options.startWordIndex) || 0);
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
        const items = segmentTextIntoSentences(speechText).map((segment, sentenceIndex) =>
          buildQueueItem(
            blockKey,
            sentenceIndex,
            segment.speechText,
            relativeBlockIndex === 0 && sentenceIndex === startSentenceIndex ? startWordIndex : 0
          )
        );
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
    if (!this.synthesis && !this.nativeSpeech) {
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

    if (this.synthesis?.paused && this.currentUtterance) {
      this.isPaused = false;
      this.isStopped = false;
      this.synthesis.resume();
      return true;
    }

    if (this.synthesis?.paused) {
      this.synthesis.resume?.();
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

    if (this.preferNativeSpeech && this.currentUtterance) {
      this.isPaused = true;
      this.nativeSpeech?.stop?.();
      this.currentUtterance = null;
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
    this.clearNativeWordTracking();
    if (this.synthesis?.paused) {
      this.synthesis.resume?.();
    }
    this.synthesis?.cancel();
    this.nativeSpeech?.stop?.();
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

  clearNativeWordTracking() {
    if (this.nativeTrackingTimer) {
      globalThis.clearInterval(this.nativeTrackingTimer);
      this.nativeTrackingTimer = null;
    }
    if (this.nativeProgressUnsubscribe) {
      this.nativeProgressUnsubscribe();
      this.nativeProgressUnsubscribe = null;
    }
    this.nativeTrackedWordIndex = -1;
  }

  getEstimatedNativeWordDurationMs(token) {
    const lengthWeight = clamp(String(token?.text || "").length / 7, 0.95, 1.55);
    return clamp((470 * lengthWeight) / Math.max(this.rate, 0.35), 220, 1350);
  }

  resolveNativeProgressWordIndex(tokens, charIndex) {
    const safeCharIndex = Math.max(0, Number(charIndex) || 0);
    const wordIndex = tokens.findIndex((token, index) => {
      const next = tokens[index + 1];
      const start = Number(token.index) || 0;
      const end = next ? Number(next.index) || start : Number.MAX_SAFE_INTEGER;
      return safeCharIndex >= start && safeCharIndex < end;
    });
    return wordIndex >= 0 ? wordIndex : Math.max(0, tokens.length - 1);
  }

  emitNativeTrackedWord(playbackToken, item, wordIndex) {
    const tokens = Array.isArray(item.tokens) ? item.tokens : [];
    const token = tokens[wordIndex];
    if (!token || wordIndex === this.nativeTrackedWordIndex || this.currentUtterance !== playbackToken) {
      return;
    }

    this.nativeTrackedWordIndex = wordIndex;
    this.callbacks.onWordBoundary?.({
      ...item,
      charIndex: token.index,
      wordIndex: token.originalWordIndex ?? wordIndex
    });
  }

  startEstimatedNativeWordTracking(playbackToken, item, { initialDelay = 900 } = {}) {
    const tokens = Array.isArray(item.tokens) ? item.tokens : [];
    if (tokens.length === 0) {
      return;
    }

    const durations = tokens.map((token) => this.getEstimatedNativeWordDurationMs(token));
    const totalDuration = Math.max(350, durations.reduce((sum, duration) => sum + duration, 0));
    let startedAt = 0;

    const tick = () => {
      if (this.currentUtterance !== playbackToken || this.isStopped || this.isPaused) {
        this.clearNativeWordTracking();
        return;
      }

      const now = globalThis.performance?.now?.() || Date.now();
      const elapsed = now - startedAt;
      let cumulative = 0;
      let nextIndex = tokens.length - 1;

      for (let index = 0; index < durations.length; index += 1) {
        cumulative += durations[index];
        if (elapsed <= cumulative) {
          nextIndex = index;
          break;
        }
      }

      this.emitNativeTrackedWord(playbackToken, item, nextIndex);
      if (elapsed >= totalDuration) {
        this.emitNativeTrackedWord(playbackToken, item, tokens.length - 1);
      }
    };

    this.nativeTrackingTimer = globalThis.setTimeout(() => {
      if (this.currentUtterance !== playbackToken || this.isStopped || this.isPaused) {
        this.clearNativeWordTracking();
        return;
      }

      startedAt = globalThis.performance?.now?.() || Date.now();
      this.emitNativeTrackedWord(playbackToken, item, 0);
      this.nativeTrackingTimer = globalThis.setInterval(tick, 140);
    }, initialDelay);
  }

  startNativeWordTracking(playbackToken, item, requestId) {
    this.clearNativeWordTracking();
    const tokens = Array.isArray(item.tokens) ? item.tokens : [];
    if (tokens.length === 0) {
      return;
    }

    if (typeof this.nativeSpeech?.onProgress === "function") {
      this.nativeProgressUnsubscribe = this.nativeSpeech.onProgress((payload) => {
        if (
          this.currentUtterance !== playbackToken ||
          Number(payload?.requestId) !== Number(requestId)
        ) {
          return;
        }

        if (payload.event === "start") {
          this.emitNativeTrackedWord(playbackToken, item, 0);
          return;
        }

        if (payload.event === "word") {
          const wordIndex = this.resolveNativeProgressWordIndex(tokens, payload.charIndex);
          this.emitNativeTrackedWord(playbackToken, item, wordIndex);
        }
      });
      return;
    }

    this.startEstimatedNativeWordTracking(playbackToken, item);
  }

  speakCurrent() {
    if ((!this.synthesis && !this.nativeSpeech) || this.currentIndex < 0 || this.currentIndex >= this.queue.length) {
      this.currentUtterance = null;
      this.callbacks.onEnd?.();
      return;
    }

    const item = this.queue[this.currentIndex];
    if (this.preferNativeSpeech && this.nativeSpeech?.speak) {
      this.speakCurrentWithNativeVoice(item);
      return;
    }

    const utterance = createSpeechUtterance(item.text);
    if (!utterance) {
      this.currentUtterance = null;
      this.callbacks.onError?.(new Error("SpeechSynthesisUtterance indisponible."));
      return;
    }
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
      const resolvedToken = item.tokens[Math.max(wordIndex, 0)];

      this.callbacks.onWordBoundary?.({
        ...item,
        charIndex: event.charIndex,
        wordIndex: resolvedToken?.originalWordIndex ?? Math.max(wordIndex, 0)
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

  speakCurrentWithNativeVoice(item) {
    const playbackToken = { native: true, item };
    const requestId = ++this.nativeSpeechRequestId;
    this.currentUtterance = playbackToken;
    this.isStopped = false;

    this.callbacks.onBlockStart?.(item);
    this.callbacks.onSentenceStart?.(item);
    this.startNativeWordTracking(playbackToken, item, requestId);

    Promise.resolve(
      this.nativeSpeech.speak({
        text: item.text,
        rate: this.rate,
        voiceURI: this.voiceURI,
        requestId
      })
    )
      .then((result) => {
        if (this.currentUtterance !== playbackToken) {
          return;
        }

        this.currentUtterance = null;
        this.clearNativeWordTracking();
        if (this.isStopped || result?.stopped) {
          return;
        }

        if (result?.ok === false) {
          this.callbacks.onError?.(new Error(result.reason || "Lecture native indisponible."));
          return;
        }

        this.history.push(item);
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
      })
      .catch((error) => {
        if (this.currentUtterance !== playbackToken) {
          return;
        }
        this.currentUtterance = null;
        this.clearNativeWordTracking();
        this.clearPauseTimer();
        this.callbacks.onError?.(error);
      });
  }
}
