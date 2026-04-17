import assert from "node:assert/strict";

import { APP_THEME_TOKENS, BUILTIN_PROFILES, DEFAULT_PREFERENCES, FONT_OPTIONS, THEME_TOKENS } from "../src/profiles.mjs";
import { normalizeColorationMode } from "../src/core/reading/decoding-engine.mjs";
import {
  normalizeSyllabificationMode,
  normalizeSyllableLevel,
  normalizeSyllableWordScope
} from "../src/core/reading/syllabify-french.mjs";

const VALID_OVERLAY_PRESETS = new Set(["none", "creme", "blue", "green", "rose", "yellow", "grey", "custom"]);
const VALID_HIGHLIGHT_MODES = new Set(["none", "soft", "strong"]);
const VALID_FOCUS_MODES = new Set(["none", "paragraph"]);
const VALID_READING_GUIDE_MODES = new Set(["off", "ruler", "window"]);
const VALID_VERIFICATION_MODES = new Set(["off", "markers", "review"]);
const VALID_COLORATION_MODES = new Set([
  "none",
  "pedagogique",
  "pedagogiqueAlt",
  "pedagogiqueContrast",
  "sonsFrancais",
  "alternanceLignes",
  "alternanceMots",
  "noirEtBlanc"
]);
const VALID_SYLLABLE_LEVELS = new Set(["off", "light", "strong"]);
const VALID_SYLLABIFICATION_MODES = new Set(["pedagogique", "typographique"]);
const VALID_SYLLABLE_WORD_SCOPES = new Set(["auto", "all"]);
const FONT_VALUES = new Set(FONT_OPTIONS.map((option) => option.value));

const seenIds = new Set();

for (const profile of BUILTIN_PROFILES) {
  assert.ok(profile?.id, "Chaque profil intégré doit avoir un id.");
  assert.ok(!seenIds.has(profile.id), `Le profil ${profile.id} est dupliqué.`);
  seenIds.add(profile.id);

  const defaults = {
    ...DEFAULT_PREFERENCES,
    ...profile.defaults
  };

  assert.ok(FONT_VALUES.has(defaults.fontFamily), `Police inconnue pour ${profile.id}.`);
  assert.ok(defaults.appTheme in APP_THEME_TOKENS, `Thème d'application invalide pour ${profile.id}.`);
  assert.ok(defaults.theme in THEME_TOKENS, `Thème PDF invalide pour ${profile.id}.`);
  assert.ok(VALID_OVERLAY_PRESETS.has(defaults.overlayPreset), `Filtre visuel invalide pour ${profile.id}.`);
  assert.ok(VALID_HIGHLIGHT_MODES.has(defaults.highlightMode), `Surbrillance invalide pour ${profile.id}.`);
  assert.ok(VALID_FOCUS_MODES.has(defaults.focusMode), `Focus invalide pour ${profile.id}.`);
  assert.ok(
    VALID_READING_GUIDE_MODES.has(defaults.readingGuideMode),
    `Mode de réglette invalide pour ${profile.id}.`
  );
  assert.ok(
    VALID_VERIFICATION_MODES.has(defaults.verificationMode),
    `Mode de vérification invalide pour ${profile.id}.`
  );
  assert.ok(
    VALID_COLORATION_MODES.has(normalizeColorationMode(defaults.colorationMode)),
    `Mode de coloration invalide pour ${profile.id}.`
  );
  assert.ok(
    VALID_SYLLABLE_LEVELS.has(normalizeSyllableLevel(defaults.syllableLevel)),
    `Niveau syllabique invalide pour ${profile.id}.`
  );
  assert.ok(
    VALID_SYLLABIFICATION_MODES.has(normalizeSyllabificationMode(defaults.syllabificationMode)),
    `Mode de syllabation invalide pour ${profile.id}.`
  );
  assert.ok(
    VALID_SYLLABLE_WORD_SCOPES.has(normalizeSyllableWordScope(defaults.syllableWordScope)),
    `Étendue syllabique invalide pour ${profile.id}.`
  );
  assert.ok(defaults.fontSize >= 12 && defaults.fontSize <= 34, `Taille invalide pour ${profile.id}.`);
  assert.ok(defaults.lineHeight >= 1.5 && defaults.lineHeight <= 3, `Interligne invalide pour ${profile.id}.`);
  assert.ok(defaults.letterSpacing >= 0 && defaults.letterSpacing <= 0.3, `Espacement lettres invalide pour ${profile.id}.`);
  assert.ok(defaults.wordSpacing >= 0 && defaults.wordSpacing <= 0.5, `Espacement mots invalide pour ${profile.id}.`);
  assert.ok(defaults.maxLineLength >= 40 && defaults.maxLineLength <= 80, `Largeur de lecture invalide pour ${profile.id}.`);
  assert.ok(defaults.overlayOpacity >= 0 && defaults.overlayOpacity <= 0.3, `Opacité filtre invalide pour ${profile.id}.`);
  assert.ok(defaults.readingGuideLines >= 1 && defaults.readingGuideLines <= 6, `Nombre de lignes guide invalide pour ${profile.id}.`);
  assert.ok(defaults.readingGuideOpacity >= 0 && defaults.readingGuideOpacity <= 0.5, `Opacité guide invalide pour ${profile.id}.`);
  assert.ok(defaults.speechRate >= 0.8 && defaults.speechRate <= 1.5, `Vitesse audio invalide pour ${profile.id}.`);
  assert.ok(
    defaults.pauseBetweenSentences >= 0 && defaults.pauseBetweenSentences <= 1200,
    `Pause audio invalide pour ${profile.id}.`
  );
}

const byId = Object.fromEntries(BUILTIN_PROFILES.map((profile) => [profile.id, { ...DEFAULT_PREFERENCES, ...profile.defaults }]));

assert.deepEqual(
  BUILTIN_PROFILES.map((profile) => profile.id),
  ["normal", "lecture-visuelle-allegee", "audio", "decodage-renforce", "mode-examen", "dyspraxie", "dyscalculie"],
  "La liste des profils intégrés doit rester simplifiée."
);
assert.equal(byId["decodage-renforce"].readingGuideMode, "ruler", "Dyslexie renforcée doit activer la réglette.");
assert.equal(
  normalizeColorationMode(byId["decodage-renforce"].colorationMode),
  "alternanceLignes",
  "Dyslexie renforcée doit activer l'alternance par ligne."
);
assert.equal(byId["mode-examen"].verificationMode, "off", "Mode examen doit garder les aides réduites.");
assert.equal(byId.dyscalculie.verificationMode, "markers", "Dyscalculie doit activer les repères de vérification.");
assert.equal(byId.dyspraxie.readingGuideMode, "ruler", "Dyspraxie doit garder une réglette simple.");

console.log("profiles: ok");
