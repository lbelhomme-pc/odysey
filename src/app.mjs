import { APP_THEME_TOKENS, BUILTIN_PROFILES, DEFAULT_PREFERENCES, FONT_OPTIONS, THEME_TOKENS } from "./profiles.mjs";
import { importPdfFromBytes } from "./pdf-processing.mjs";
import {
  buildBookmarkDocumentKey,
  exportBookmarksAsText,
  getBookmarkExportFileName,
  normalizeBookmarks,
  upsertBookmark
} from "./core/document/bookmark-store.mjs";
import {
  exportAnnotationsAsText,
  getBlockAnnotations,
  normalizeAnnotations,
  removeAnnotation,
  upsertAnnotation
} from "./core/document/annotation-store.mjs";
import {
  buildRecentFileEntry,
  formatRecentDocumentLabel,
  getExtractionQualityLabel,
  getImportStatusMessage
} from "./core/document/document-report.mjs";
import {
  createBlockKey as buildBlockKey,
  getFirstReadableBlockKey,
  summarizeDocumentDiagnostics
} from "./core/document/document-model.mjs";
import {
  buildPrintManifest,
  formatPrintSettingsSummary,
  getPrintExportFilename
} from "./core/export/print-manifest.mjs";
import {
  normalizeColorationMode as normalizeColorationPreference,
  renderAdaptedText
} from "./core/reading/decoding-engine.mjs";
import { normalizeSyllableLevel } from "./core/reading/syllabify-french.mjs";
import { renderMathText, verbalizeMathText } from "./core/reading/math-support.mjs";
import { ReadingGuide } from "./core/reading/reading-guide.mjs";
import { AudioEngine, mapUiSpeechRate, segmentTextIntoSentences } from "./core/reading/audio-engine.mjs";
import { OcrEngine } from "./core/ocr/ocr-engine.mjs";
import { KeyboardNav } from "./core/accessibility/keyboard-nav.mjs";
import { AriaManager } from "./core/accessibility/aria-manager.mjs";
import { PwaManager } from "./core/pwa/pwa-manager.mjs";
import { PROJECT_SUPPORT_URL } from "./core/support/support-links.mjs";

const appState = {
  importedDocument: null,
  currentPdfBlobUrl: "",
  currentPdfBytes: null,
  preferences: { ...DEFAULT_PREFERENCES },
  builtinProfiles: BUILTIN_PROFILES,
  customProfiles: [],
  activeProfileId: BUILTIN_PROFILES[0].id,
  selectedBlockKey: "",
  recentFilesMeta: [],
  bookmarksByDocument: {},
  annotationsByDocument: {},
  voices: [],
  speechAvailable: false,
  speechUtterance: null,
  speechQueue: [],
  speaking: false,
  audioPaused: false,
  audioResumeOverride: null,
  ocrState: {
    running: false,
    progress: 0,
    currentPage: 0,
    totalPages: 0,
    status: "OCR prêt."
  },
  rulerY: null,
  persistTimer: null,
  bookmarks: [],
  annotations: [],
  selectionDraft: null
};

const IMPORTANT_PROFILE_IDS = new Set([
  "normal",
  "lecture-visuelle-allegee",
  "dyslexie-legere",
  "decodage-renforce",
  "audio"
]);

const elements = {
  openButton: document.querySelector("#openPdfButton"),
  emptyOpenButton: document.querySelector("#emptyOpenButton"),
  openHeaderButton: document.querySelector("#openHeaderButton"),
  toggleSidebarButton: document.querySelector("#toggleSidebarButton"),
  floatingSidebarButton: document.querySelector("#floatingSidebarButton"),
  printButton: document.querySelector("#printButton"),
  exportPdfButton: document.querySelector("#exportPdfButton"),
  documentTitle: document.querySelector("#documentTitle"),
  documentMeta: document.querySelector("#documentMeta"),
  documentPagesInfo: document.querySelector("#documentPagesInfo"),
  documentModeInfo: document.querySelector("#documentModeInfo"),
  documentProfileInfo: document.querySelector("#documentProfileInfo"),
  warningBanner: document.querySelector("#warningBanner"),
  warningText: document.querySelector("#warningText"),
  printSummary: document.querySelector("#printSummary"),
  readArea: document.querySelector("#readingArea"),
  emptyState: document.querySelector("#emptyState"),
  docState: document.querySelector("#docState"),
  pageList: document.querySelector("#pageList"),
  profilesList: document.querySelector("#profilesList"),
  advancedProfilesList: document.querySelector("#advancedProfilesList"),
  customProfilesList: document.querySelector("#customProfilesList"),
  profileSummaryButton: document.querySelector("#profileSummaryButton"),
  profileSummaryDialog: document.querySelector("#profileSummaryDialog"),
  closeProfileSummaryDialogButton: document.querySelector("#closeProfileSummaryDialogButton"),
  profileSummaryTable: document.querySelector("#profileSummaryTable"),
  profileNameInput: document.querySelector("#customProfileName"),
  saveProfileButton: document.querySelector("#saveProfileButton"),
  deleteProfileButton: document.querySelector("#deleteProfileButton"),
  profileFeedback: document.querySelector("#profileFeedback"),
  immersionButton: document.querySelector("#immersionButton"),
  resetSettingsButton: document.querySelector("#resetSettingsButton"),
  settingsFeedback: document.querySelector("#settingsFeedback"),
  speechToggleButton: document.querySelector("#speechToggleButton"),
  speechStopButton: document.querySelector("#speechStopButton"),
  speechPrevButton: document.querySelector("#speechPrevButton"),
  speechNextButton: document.querySelector("#speechNextButton"),
  openExternalButton: document.querySelector("#openExternalButton"),
  bookmarkQuickButton: document.querySelector("#bookmarkQuickButton"),
  exportNotesButton: document.querySelector("#exportNotesButton"),
  startOcrButton: document.querySelector("#startOcrButton"),
  cancelOcrButton: document.querySelector("#cancelOcrButton"),
  ocrProgress: document.querySelector("#ocrProgress"),
  ocrStatusText: document.querySelector("#ocrStatusText"),
  ocrProgressValue: document.querySelector("#ocrProgressValue"),
  ocrProgressBar: document.querySelector("#ocrProgressBar"),
  ocrHint: document.querySelector("#ocrHint"),
  bookmarksList: document.querySelector("#bookmarksList"),
  bookmarksEmpty: document.querySelector("#bookmarksEmpty"),
  annotationsList: document.querySelector("#annotationsList"),
  annotationsEmpty: document.querySelector("#annotationsEmpty"),
  supportDialogButton: document.querySelector("#supportDialogButton"),
  installPwaButton: document.querySelector("#installPwaButton"),
  voiceSelect: document.querySelector("#speechVoiceId"),
  verificationSummary: document.querySelector("#verificationSummary"),
  startupSplash: document.querySelector("#startupSplash"),
  statusLine: document.querySelector("#statusLine"),
  keyboardHint: document.querySelector("#keyboardHint"),
  rulerOverlay: document.querySelector("#rulerOverlay"),
  recentList: document.querySelector("#recentList"),
  researchNotes: document.querySelector("#researchNotes"),
  selectionAssist: document.querySelector("#selectionAssist"),
  selectionPreview: document.querySelector("#selectionPreview"),
  selectionSpeechButton: document.querySelector("#selectionSpeechButton"),
  clearSelectionAssistButton: document.querySelector("#clearSelectionAssistButton")
};

const controlIds = [
  "fontFamily",
  "fontSize",
  "lineHeight",
  "letterSpacing",
  "wordSpacing",
  "maxLineLength",
  "pagePadding",
  "appTheme",
  "theme",
  "overlayPreset",
  "overlayOpacity",
  "overlayCustomColor",
  "highlightMode",
  "focusMode",
  "readingGuideMode",
  "readingGuideLines",
  "readingGuideOpacity",
  "readingGuideColor",
  "colorationMode",
  "syllableLevel",
  "soundColorMode",
  "syllableBreakMode",
  "verificationMode",
  "speechRate",
  "pauseBetweenSentences",
  "ocrLanguage"
];

const controls = Object.fromEntries(
  controlIds.map((id) => [id, document.querySelector(`#${id}`)])
);

controls.speechVoiceId = elements.voiceSelect;
const STORAGE_KEY = "dys-reader-settings-v1";
const runtimeApi = window.dysReaderApi
  ? { kind: "electron", ...window.dysReaderApi }
  : createBrowserApi();
const runtimeSubscriptions = [];
const readingGuide = new ReadingGuide();
const audioEngine = new AudioEngine();
const ocrEngine = new OcrEngine({
  runtime: runtimeApi.kind,
  readLanguageData: runtimeApi.readOcrLanguageData
});
const keyboardNav = new KeyboardNav();
const ariaManager = new AriaManager();
const pwaManager = runtimeApi.kind === "browser" ? new PwaManager() : null;
let startupSplashTimer = null;

function createBrowserApi() {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".pdf,application/pdf";
  fileInput.hidden = true;
  document.body.appendChild(fileInput);

  return {
    kind: "browser",
    async openPdfDialog() {
      return new Promise((resolve) => {
        fileInput.value = "";
        fileInput.onchange = () => {
          const [file] = Array.from(fileInput.files || []);
          resolve(
            file
              ? {
                  file,
                  fileName: file.name
                }
              : null
          );
        };
        fileInput.click();
      });
    },
    async readPdfFile(file) {
      const arrayBuffer = await file.arrayBuffer();
      return {
        bytes: new Uint8Array(arrayBuffer),
        fileName: file.name,
        filePath: ""
      };
    },
    async readOcrLanguageData() {
      const language = arguments[0] || "fra";
      const fileUrl = new URL(
        `../node_modules/@tesseract.js-data/${language}/4.0.0_best_int/${language}.traineddata.gz`,
        import.meta.url
      );

      try {
        const response = await fetch(fileUrl);
        if (!response.ok) {
          return {
            ok: false,
            reason: `OCR_LANGUAGE_FETCH_FAILED:${response.status}`
          };
        }

        const bytes = new Uint8Array(await response.arrayBuffer());
        return {
          ok: true,
          language,
          filePath: fileUrl.toString(),
          bytes
        };
      } catch (error) {
        return {
          ok: false,
          reason: error?.message || "OCR_BUNDLED_LANGUAGE_UNAVAILABLE"
        };
      }
    },
    async loadSettings() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch (error) {
        console.error("Impossible de lire les réglages locaux du navigateur", error);
        return {};
      }
    },
    async saveSettings(payload) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return { ok: true };
    },
    async openPath(targetPath) {
      if (targetPath) {
        window.open(targetPath, "_blank", "noopener,noreferrer");
      } else if (appState.currentPdfBlobUrl) {
        window.open(appState.currentPdfBlobUrl, "_blank", "noopener,noreferrer");
      }
    },
    async openExternalUrl(targetUrl) {
      if (!targetUrl) {
        return { ok: false };
      }
      window.open(targetUrl, "_blank", "noopener,noreferrer");
      return { ok: true };
    },
    async saveTextFile({ defaultFileName, content } = {}) {
      const blob = new Blob([String(content || "")], { type: "text/plain;charset=utf-8" });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = defaultFileName || "notes.txt";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 500);
      return { ok: true, browserFallback: true };
    },
    async printCurrentView() {
      window.print();
      return { ok: true, browserFallback: true };
    },
    async exportAdaptedPdf() {
      window.print();
      return { ok: true, browserFallback: true };
    },
    onOpenPdfRequest() {
      return () => {};
    },
    onToggleImmersionRequest() {
      return () => {};
    },
    onToggleShortcutsHelpRequest() {
      return () => {};
    }
  };
}

function hideStartupSplash() {
  if (!elements.startupSplash) {
    return;
  }

  if (startupSplashTimer) {
    clearTimeout(startupSplashTimer);
  }

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const visibleDelay = reduceMotion ? 120 : 3200;
  const fadeDuration = reduceMotion ? 60 : 1800;

  startupSplashTimer = window.setTimeout(() => {
    elements.startupSplash.classList.add("is-hidden");
    window.setTimeout(() => {
      elements.startupSplash.hidden = true;
    }, fadeDuration);
  }, visibleDelay);
}

const OVERLAY_PRESETS = {
  none: "transparent",
  creme: "#f1e8c9",
  blue: "#dbeafe",
  green: "#dff3e7",
  rose: "#f7dce5",
  yellow: "#f5e7a9",
  grey: "#e4e7eb"
};

const CONTROL_HELP_TEXTS = {
  fontFamily: "Choisit la police utilisée dans la zone de lecture. Privilégie une police simple et stable.",
  fontSize: "Agrandit ou réduit le texte du PDF adapté pour le rendre plus confortable à lire.",
  lineHeight: "Augmente l'espace entre les lignes pour limiter les sauts visuels.",
  letterSpacing: "Ajoute de l'espace entre les lettres quand les mots paraissent trop serrés.",
  wordSpacing: "Ajoute de l'espace entre les mots pour mieux repérer chaque groupe.",
  maxLineLength: "Réduit ou élargit la colonne de lecture. Une colonne plus étroite aide souvent à garder la ligne.",
  pagePadding: "Ajuste la marge intérieure autour du texte pour aérer la page.",
  appTheme: "Change la couleur de l'application entière : clair, doux ou sombre. Cela ne change pas le fond du PDF.",
  theme: "Change uniquement l'apparence du PDF adapté. Ce réglage ne modifie pas la couleur de l'application.",
  overlayPreset: "Ajoute un voile léger sur la zone de lecture pour adoucir l'écran si besoin.",
  overlayOpacity: "Règle la force du filtre visuel. Garde une valeur légère pour ne pas masquer le texte.",
  overlayCustomColor: "Permet de choisir toi-même la couleur du filtre visuel.",
  highlightMode: "Définit la force du repère sur le bloc en cours de lecture.",
  focusMode: "Assombrit légèrement le reste du texte pour aider à rester sur le paragraphe actif.",
  readingGuideMode: "Affiche une réglette ou une fenêtre de lecture qui suit le texte pour garder la ligne.",
  readingGuideLines: "Définit le nombre de lignes visibles dans la réglette ou la fenêtre.",
  readingGuideOpacity: "Règle la force visuelle de la réglette pour qu'elle reste utile sans gêner.",
  readingGuideColor: "Choisit la couleur du contour de la réglette.",
  colorationMode: "Active une aide visuelle pour les sons ou une coloration douce. À utiliser seulement si elle aide vraiment.",
  syllableLevel: "Découpe les mots en syllabes de lecture. Léger reste discret, Renforcé aide davantage au décodage.",
  soundColorMode: "Choisit des couleurs plus douces ou plus nettes pour les sons français.",
  syllableBreakMode: "Affiche un séparateur discret entre les syllabes quand le mode syllabes est actif.",
  verificationMode: "Aide à relire les passages potentiellement fragiles : maths, OCR incertain, tableaux ou blocs complexes.",
  speechVoiceId: "Choisit la voix système utilisée pour la lecture audio.",
  speechRate: "Règle la vitesse réelle de lecture audio. La valeur de base a été ralentie pour être plus confortable.",
  pauseBetweenSentences: "Ajoute une petite pause entre les phrases pour laisser le temps de suivre.",
  ocrLanguage: "Choisit la langue utilisée par l'OCR pour reconstruire un PDF scanné."
};

function getAllProfiles() {
  return [...appState.builtinProfiles, ...appState.customProfiles];
}

function findProfile(profileId) {
  return getAllProfiles().find((profile) => profile.id === profileId);
}

function isCustomProfile(profileId) {
  return appState.customProfiles.some((profile) => profile.id === profileId);
}

function getFontLabel(fontFamily) {
  return FONT_OPTIONS.find((option) => option.value === fontFamily)?.label || String(fontFamily || "");
}

function getThemeLabel(themeId) {
  const labels = {
    blanc: "Blanc doux",
    neutre: "Neutre",
    brume: "Bleu calme",
    contraste: "Bleu contraste",
    creme: "Ivoire clair",
    nuitDouce: "Gris doux"
  };
  return labels[themeId] || String(themeId || "");
}

function normalizeAppTheme(value) {
  const nextValue = String(value || "").trim();
  if (nextValue === "clair" || nextValue === "intermediaire" || nextValue === "sombre") {
    return nextValue;
  }
  if (nextValue === "blanc") {
    return "clair";
  }
  if (["neutre", "brume", "creme", "contraste"].includes(nextValue)) {
    return "intermediaire";
  }
  if (nextValue === "nuitDouce") {
    return "sombre";
  }
  return DEFAULT_PREFERENCES.appTheme;
}

function describeProfileDecoding(preferences) {
  const parts = [];
  const colorationMode = normalizeColorationPreference(preferences.colorationMode);
  const syllableLevel = normalizeSyllableLevel(preferences.syllableLevel);

  if (colorationMode === "sonsFrancais") {
    parts.push(`sons français (${preferences.soundColorMode === "strong" ? "nets" : "doux"})`);
  } else if (colorationMode === "pedagogique") {
    parts.push("coloration douce");
  } else if (colorationMode === "pedagogiqueAlt") {
    parts.push("coloration alternative");
  }

  if (syllableLevel === "light") {
    parts.push("syllabes légères");
  } else if (syllableLevel === "strong") {
    parts.push("syllabes renforcées");
  }

  if (syllableLevel !== "off" && preferences.syllableBreakMode === "dot") {
    parts.push("coupure point médian");
  } else if (syllableLevel !== "off" && preferences.syllableBreakMode === "hyphen") {
    parts.push("coupure tiret");
  }

  return parts.length ? parts.join(" • ") : "Aucune";
}

function describeProfileGuidance(preferences) {
  const parts = [];
  const guideMode = normalizeReadingGuideMode(preferences.readingGuideMode, preferences.focusMode);

  if (preferences.highlightMode === "soft") {
    parts.push("surbrillance douce");
  } else if (preferences.highlightMode === "strong") {
    parts.push("surbrillance forte");
  }

  if (preferences.focusMode === "paragraph") {
    parts.push("focus paragraphe");
  }

  if (guideMode === "ruler") {
    parts.push(`réglette (${preferences.readingGuideLines || 1} ligne)`);
  } else if (guideMode === "window") {
    parts.push(`fenêtre (${preferences.readingGuideLines || 1} ligne${Number(preferences.readingGuideLines || 1) > 1 ? "s" : ""})`);
  }

  if (normalizeVerificationMode(preferences.verificationMode) === "markers") {
    parts.push("vérification repères");
  } else if (normalizeVerificationMode(preferences.verificationMode) === "review") {
    parts.push("relecture ciblée");
  }

  if (preferences.distractionFree) {
    parts.push("immersion active");
  }

  return parts.length ? parts.join(" • ") : "Aucun";
}

function describeProfileAudio(preferences) {
  return `vitesse ${Number(preferences.speechRate || 1).toFixed(2)} • pause ${Math.round(Number(preferences.pauseBetweenSentences || 0))} ms`;
}

function describeProfileAudience(profile) {
  switch (profile.id) {
    case "normal":
      return "Pour lire le PDF tel quel, sans aide visuelle supplémentaire.";
    case "lecture-visuelle-allegee":
      return "Pour une lecture plus confortable, aérée et stable, sans décodage marqué.";
    case "dyslexie-legere":
      return "Pour une dyslexie légère à modérée avec un appui discret sur le décodage.";
    case "decodage-renforce":
      return "Pour les lecteurs qui ont besoin d’un guidage fort sur les sons, syllabes et la ligne.";
    case "audio":
      return "Pour suivre le texte avec la voix et mieux rester concentré pendant la lecture.";
    case "comprehension-simplifiee":
      return "Pour réduire l’effort cognitif avec une colonne plus étroite et un repérage fort.";
    case "dyslexie-severe":
      return "Pour une dyslexie marquée avec grands espacements, réglette et audio ralenti.";
    case "dyscalculie":
      return "Pour des documents avec nombres, calculs ou expressions mathématiques à surveiller.";
    case "tdah":
      return "Pour limiter les distractions avec une fenêtre de lecture et un cadre plus focalisé.";
    case "dyspraxie":
      return "Pour une lecture stable et des repères simples quand la fatigue motrice est importante.";
    case "enseignant":
      return "Pour analyser un document, repérer les zones fragiles et observer les aides activées.";
    default:
      return "Pour un besoin spécifique ou un réglage personnalisé.";
  }
}

function renderProfileSummaryDialog() {
  if (!elements.profileSummaryTable) {
    return;
  }

  const rows = appState.builtinProfiles
    .map((profile) => {
      const defaults = profile.defaults || {};
      const kind = IMPORTANT_PROFILE_IDS.has(profile.id) ? "Important" : "Avancé";
      const label = repairUiText(profile.label);
      const description = repairUiText(profile.description || "");
      return `
        <tr>
          <td><span class="profile-summary-kind">${kind}</span></td>
          <td>
            <strong>${escapeHtml(label)}</strong>
            ${escapeHtml(description)}
          </td>
          <td>${escapeHtml(getFontLabel(defaults.fontFamily))}</td>
          <td>${escapeHtml(`${defaults.fontSize}px`)}</td>
          <td>${escapeHtml(`interligne ${Number(defaults.lineHeight).toFixed(2)} • lettres ${Number(defaults.letterSpacing).toFixed(2)}em • mots ${Number(defaults.wordSpacing).toFixed(2)}em`)}</td>
          <td>${escapeHtml(`${defaults.maxLineLength}ch`)}</td>
          <td>${escapeHtml(getThemeLabel(defaults.theme))}</td>
          <td>${escapeHtml(describeProfileDecoding(defaults))}</td>
          <td>${escapeHtml(describeProfileGuidance(defaults))}</td>
          <td>${escapeHtml(describeProfileAudio(defaults))}</td>
          <td>${escapeHtml(describeProfileAudience(profile))}</td>
        </tr>
      `;
    })
    .join("");

  elements.profileSummaryTable.innerHTML = `
    <table class="profile-summary-table">
      <thead>
        <tr>
          <th>Type</th>
          <th>Profil</th>
          <th>Police</th>
          <th>Taille</th>
          <th>Espacements</th>
          <th>Largeur</th>
          <th>Thème</th>
          <th>Décodage</th>
          <th>Repères</th>
          <th>Audio</th>
          <th>Pour qui ?</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildProfilePreferences(profile) {
  const preserved = {
    appTheme: normalizeAppTheme(appState.preferences.appTheme),
    speechVoiceId: appState.preferences.speechVoiceId,
    distractionFree: appState.preferences.distractionFree
  };

  if (!isCustomProfile(profile.id)) {
    preserved.theme = appState.preferences.theme;
  }

  const nextPreferences = {
    ...profile.defaults,
    colorationMode: normalizeColorationPreference(profile.defaults?.colorationMode),
    syllableLevel: normalizeSyllableLevel(profile.defaults?.syllableLevel),
    verificationMode: normalizeVerificationMode(profile.defaults?.verificationMode),
    readingGuideMode: normalizeReadingGuideMode(profile.defaults?.readingGuideMode, profile.defaults?.focusMode),
    ...preserved
  };
  if (nextPreferences.focusMode === "ruler") {
    nextPreferences.focusMode = "none";
  }
  return nextPreferences;
}

function shouldMigrateLegacyVisualProfile(profileId, preferences) {
  if (profileId !== "lecture-visuelle-allegee" || !preferences) {
    return false;
  }

  return (
    normalizeColorationPreference(preferences.colorationMode) === "pedagogique" &&
    normalizeSyllableLevel(preferences.syllableLevel) === "light" &&
    String(preferences.soundColorMode || "soft") === "soft" &&
    String(preferences.syllableBreakMode || "none") === "none" &&
    String(preferences.focusMode || "none") === "none" &&
    normalizeReadingGuideMode(preferences.readingGuideMode, preferences.focusMode) === "off"
  );
}

function migrateLegacyVisualProfilePreferences(preferences) {
  return {
    ...preferences,
    colorationMode: "none",
    syllableLevel: "off",
    soundColorMode: "soft",
    syllableBreakMode: "none"
  };
}

function activateProfile(profileId, { statusMessage } = {}) {
  const profile = findProfile(profileId);
  if (!profile) {
    return false;
  }

  appState.activeProfileId = profile.id;
  appState.preferences = buildProfilePreferences(profile);
  syncControlsWithState();
  applyAppTheme();
  applyTheme();
  setPanelFeedback(elements.profileFeedback, "");
  setPanelFeedback(elements.settingsFeedback, "");
  renderProfiles();
  renderDocument();
  debouncePersist();

  if (statusMessage) {
    elements.statusLine.textContent = statusMessage;
  }

  return true;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

function repairUiText(value) {
  const text = String(value ?? "");
  if (!/[ÃÂâ€™â€¢ï¿½]/u.test(text)) {
    return text;
  }

  try {
    const bytes = Uint8Array.from(Array.from(text, (char) => char.charCodeAt(0) & 255));
    const decoded = new TextDecoder("utf-8").decode(bytes);
    return decoded.includes("�") ? text : decoded;
  } catch {
    return text;
  }
}

function setPanelFeedback(element, message = "") {
  if (!element) {
    return;
  }

  element.hidden = !message;
  element.textContent = message;
}

function openProfileSummaryDialog() {
  if (!elements.profileSummaryDialog) {
    return;
  }

  renderProfileSummaryDialog();
  if (elements.profileSummaryDialog.open) {
    return;
  }

  elements.profileSummaryDialog.showModal();
  elements.closeProfileSummaryDialogButton?.focus();
}

function closeProfileSummaryDialog() {
  if (!elements.profileSummaryDialog?.open) {
    return;
  }

  elements.profileSummaryDialog.close();
}

async function openProjectSupportPage() {
  try {
    await runtimeApi.openExternalUrl(PROJECT_SUPPORT_URL);
    elements.statusLine.textContent = "La page Tipeee d'Odysey a été ouverte dans votre navigateur par défaut.";
  } catch (error) {
    console.error("Impossible d'ouvrir la page Tipeee", error);
    elements.statusLine.textContent = "Impossible d'ouvrir la page Tipeee pour le moment.";
  }
}

function bindRuntimeApiEvents() {
  runtimeSubscriptions.push(runtimeApi.onOpenPdfRequest?.(() => handlePdfOpen()));
  runtimeSubscriptions.push(runtimeApi.onToggleImmersionRequest?.(() => toggleImmersion()));
  runtimeSubscriptions.push(runtimeApi.onToggleShortcutsHelpRequest?.(() => keyboardNav.toggleHelp()));
}

function normalizeVerificationMode(value) {
  if (value === "on") {
    return "markers";
  }
  return value || "off";
}

function normalizeReadingGuideMode(value, fallbackFocusMode = "none") {
  if (value === "ruler" || value === "window" || value === "off") {
    return value;
  }
  if (fallbackFocusMode === "ruler") {
    return "ruler";
  }
  return "off";
}

function getOverlayColor() {
  if (appState.preferences.overlayPreset === "custom") {
    return appState.preferences.overlayCustomColor || "#dbeafe";
  }
  return OVERLAY_PRESETS[appState.preferences.overlayPreset] || OVERLAY_PRESETS.none;
}

function getOverlayOpacity() {
  if (appState.preferences.overlayPreset === "none") {
    return 0;
  }
  return Math.min(Math.max(Number(appState.preferences.overlayOpacity) || 0, 0), 0.3);
}

function getDocumentDiagnostics() {
  return appState.importedDocument
    ? summarizeDocumentDiagnostics(appState.importedDocument)
    : {
        mathBlockCount: 0,
        formulaBlockCount: 0,
        verificationBlockCount: 0,
        pagesWithMath: 0,
        pagesWithVerification: 0,
        verificationReasons: []
      };
}

function getDocumentCharacterCount(documentModel) {
  return (documentModel?.pages || []).reduce(
    (sum, page) => sum + (page.blocks || []).reduce((pageSum, block) => pageSum + String(block?.text || "").length, 0),
    0
  );
}

function shouldAdoptOcrResult(previousDocument, nextOcrDocument) {
  if (!nextOcrDocument || nextOcrDocument.extractionQuality === "poor") {
    return false;
  }

  if (!previousDocument || previousDocument.ocr?.applied) {
    return true;
  }

  if (previousDocument.extractionQuality !== "good") {
    return true;
  }

  const previousChars = getDocumentCharacterCount(previousDocument);
  const nextChars = getDocumentCharacterCount(nextOcrDocument);
  const averageConfidence = Number(nextOcrDocument.ocr?.averageConfidence || 0);

  return averageConfidence >= 78 && nextChars >= Math.max(previousChars * 0.92, previousChars - 80);
}

function getEffectiveVerificationMode() {
  const requestedMode = normalizeVerificationMode(appState.preferences.verificationMode);
  if (requestedMode !== "review") {
    return requestedMode;
  }

  return getDocumentDiagnostics().verificationBlockCount > 0 ? "review" : "off";
}

function debouncePersist() {
  window.clearTimeout(appState.persistTimer);
  appState.persistTimer = window.setTimeout(() => {
    persistState().catch((error) => {
      console.error("Impossible de sauvegarder les préférences", error);
      elements.statusLine.textContent = "Sauvegarde locale indisponible pour le moment.";
    });
  }, 180);
}

function getPersistablePreferences() {
  return {
    ...appState.preferences,
    distractionFree: false
  };
}

function syncBookmarksStorage() {
  if (!appState.currentPdfBlobUrl && !appState.importedDocument) {
    return;
  }

  const bookmarkDocumentKey = buildBookmarkDocumentKey(appState.importedDocument);
  if (!bookmarkDocumentKey) {
    return;
  }

  appState.bookmarksByDocument[bookmarkDocumentKey] = normalizeBookmarks(appState.bookmarks);
}

function syncAnnotationsStorage() {
  if (!appState.currentPdfBlobUrl && !appState.importedDocument) {
    return;
  }

  const bookmarkDocumentKey = buildBookmarkDocumentKey(appState.importedDocument);
  if (!bookmarkDocumentKey) {
    return;
  }

  appState.annotationsByDocument[bookmarkDocumentKey] = normalizeAnnotations(appState.annotations);
}

async function persistState() {
  syncBookmarksStorage();
  syncAnnotationsStorage();
  const payload = {
    savedProfiles: appState.customProfiles,
    lastUsedPreferences: getPersistablePreferences(),
    activeProfileId: appState.activeProfileId,
    recentFilesMeta: appState.recentFilesMeta.slice(0, 6),
    bookmarksByDocument: appState.bookmarksByDocument,
    annotationsByDocument: appState.annotationsByDocument
  };
  await runtimeApi.saveSettings(payload);
}

async function loadPersistedState() {
  try {
    const payload = await runtimeApi.loadSettings();
    if (payload?.savedProfiles && Array.isArray(payload.savedProfiles)) {
      appState.customProfiles = payload.savedProfiles.map((profile) => ({
        ...profile,
        defaults: {
          ...DEFAULT_PREFERENCES,
          ...profile.defaults,
          appTheme: normalizeAppTheme(profile.defaults?.appTheme),
          colorationMode: normalizeColorationPreference(profile.defaults?.colorationMode),
          syllableLevel: normalizeSyllableLevel(profile.defaults?.syllableLevel),
          verificationMode: normalizeVerificationMode(profile.defaults?.verificationMode),
          readingGuideMode: normalizeReadingGuideMode(profile.defaults?.readingGuideMode, profile.defaults?.focusMode)
        }
      }));
    }
    if (payload?.lastUsedPreferences) {
      appState.preferences = {
        ...DEFAULT_PREFERENCES,
        ...payload.lastUsedPreferences
      };
      appState.preferences.appTheme = normalizeAppTheme(appState.preferences.appTheme);
      appState.preferences.colorationMode = normalizeColorationPreference(appState.preferences.colorationMode);
      appState.preferences.syllableLevel = normalizeSyllableLevel(appState.preferences.syllableLevel);
      appState.preferences.verificationMode = normalizeVerificationMode(appState.preferences.verificationMode);
      appState.preferences.readingGuideMode = normalizeReadingGuideMode(
        appState.preferences.readingGuideMode,
        appState.preferences.focusMode
      );
      if (appState.preferences.focusMode === "ruler") {
        appState.preferences.focusMode = "none";
      }
      appState.preferences.distractionFree = false;
    }
    if (Array.isArray(payload?.recentFilesMeta)) {
      appState.recentFilesMeta = payload.recentFilesMeta;
    }
    if (payload?.bookmarksByDocument && typeof payload.bookmarksByDocument === "object") {
      appState.bookmarksByDocument = Object.fromEntries(
        Object.entries(payload.bookmarksByDocument).map(([documentKey, entries]) => [
          documentKey,
          normalizeBookmarks(Array.isArray(entries) ? entries : [])
        ])
      );
    }
    if (payload?.annotationsByDocument && typeof payload.annotationsByDocument === "object") {
      appState.annotationsByDocument = Object.fromEntries(
        Object.entries(payload.annotationsByDocument).map(([documentKey, entries]) => [
          documentKey,
          normalizeAnnotations(Array.isArray(entries) ? entries : [])
        ])
      );
    }
    if (payload?.activeProfileId && findProfile(payload.activeProfileId)) {
      appState.activeProfileId = payload.activeProfileId;
    }
    if (shouldMigrateLegacyVisualProfile(appState.activeProfileId, appState.preferences)) {
      appState.preferences = migrateLegacyVisualProfilePreferences(appState.preferences);
    }
  } catch (error) {
    console.error("Impossible de charger les réglages locaux", error);
  }
}

function updateSidebarToggleUi() {
  const sidebarHidden = appState.preferences.distractionFree;
  if (elements.immersionButton) {
    elements.immersionButton.textContent = sidebarHidden ? "Afficher les réglages" : "Mode immersion";
  }
  if (elements.toggleSidebarButton) {
    elements.toggleSidebarButton.textContent = sidebarHidden ? "Afficher les réglages" : "Masquer les réglages";
    elements.toggleSidebarButton.setAttribute("aria-pressed", sidebarHidden ? "true" : "false");
  }
  if (elements.floatingSidebarButton) {
    elements.floatingSidebarButton.hidden = !sidebarHidden;
    elements.floatingSidebarButton.setAttribute("aria-pressed", sidebarHidden ? "true" : "false");
  }
}

function applyTheme() {
  const theme = THEME_TOKENS[appState.preferences.theme] || THEME_TOKENS.creme;
  for (const [token, value] of Object.entries(theme)) {
    document.documentElement.style.setProperty(`--${token}`, value);
  }
}

function applyAppTheme() {
  const appThemeId = normalizeAppTheme(appState.preferences.appTheme);
  const theme = APP_THEME_TOKENS[appThemeId] || APP_THEME_TOKENS.intermediaire;
  document.documentElement.dataset.appTheme = appThemeId;
  document.documentElement.style.colorScheme = theme.colorScheme;

  const tokenMap = {
    uiPage: "--ui-page",
    uiShell: "--ui-shell",
    uiPanel: "--ui-panel",
    uiPanelStrong: "--ui-panelStrong",
    uiText: "--ui-text",
    uiTextSoft: "--ui-textSoft",
    uiAccent: "--ui-accent",
    uiAccentStrong: "--ui-accentStrong",
    uiAccentSoft: "--ui-accentSoft",
    uiBorder: "--ui-border",
    uiWarningBg: "--ui-warningBg",
    uiWarningText: "--ui-warningText",
    uiShellShadow: "--ui-shell-shadow",
    shadowSoft: "--shadow-soft",
    shadowPress: "--shadow-press"
  };

  for (const [token, cssVar] of Object.entries(tokenMap)) {
    document.documentElement.style.setProperty(cssVar, theme[token]);
  }
}

function fillStaticControls() {
  controls.fontFamily.replaceChildren(
    ...FONT_OPTIONS.map((option) => {
      const element = document.createElement("option");
      element.value = option.value;
      element.textContent = option.label;
      return element;
    })
  );

  controls.appTheme.innerHTML = [
    { value: "clair", label: "Clair" },
    { value: "intermediaire", label: "Doux" },
    { value: "sombre", label: "Sombre" }
  ]
    .map((theme) => `<option value="${theme.value}">${theme.label}</option>`)
    .join("");

  controls.theme.innerHTML = [
    { value: "blanc", label: "Blanc doux" },
    { value: "neutre", label: "Neutre" },
    { value: "brume", label: "Bleu calme" },
    { value: "contraste", label: "Bleu contraste" },
    { value: "creme", label: "Ivoire clair" },
    { value: "nuitDouce", label: "Gris doux" }
  ]
    .map((theme) => `<option value="${theme.value}">${theme.label}</option>`)
    .join("");
}

function formatOutputValue(key, value) {
  switch (key) {
    case "fontSize":
      return `${value}px`;
    case "lineHeight":
      return `${Number(value).toFixed(2)}`;
    case "letterSpacing":
    case "wordSpacing":
      return `${Number(value).toFixed(2)}em`;
    case "maxLineLength":
      return `${value}ch`;
    case "pagePadding":
      return `${value}px`;
    case "readingGuideMode":
      return value === "window" ? "Fenêtre" : value === "ruler" ? "Réglette" : "Désactivée";
    case "readingGuideLines":
      return `${value} ligne${Number(value) > 1 ? "s" : ""}`;
    case "readingGuideOpacity":
      return `${Math.round(Number(value) * 100)}%`;
    case "overlayOpacity":
      return `${Math.round(Number(value) * 100)}%`;
    case "soundColorMode":
      return value === "strong" ? "Nettes" : "Douces";
    case "syllableLevel":
      return value === "strong" ? "Renforcé" : value === "light" ? "Léger" : "Désactivé";
    case "syllableBreakMode":
      return value === "hyphen" ? "Tiret discret" : value === "dot" ? "Point médian" : "Aucune";
    case "speechRate":
      return `${mapUiSpeechRate(value).toFixed(2)}x`;
    default:
      return String(value);
  }
}

function applyControlHelp() {
  Object.entries(CONTROL_HELP_TEXTS).forEach(([key, helpText]) => {
    const control = controls[key];
    if (!control) {
      return;
    }

    const wrapper = control.closest(".control");
    if (wrapper) {
      wrapper.title = helpText;
      wrapper.dataset.hasHelp = "true";
    }

    control.title = helpText;
    control.setAttribute("aria-description", helpText);
  });
}

function getActiveModeLabel() {
  if (!appState.importedDocument) {
    return "En attente";
  }

  if (appState.importedDocument.extractionQuality === "poor") {
    return "PDF original";
  }

  const modes = [];
  if (normalizeColorationPreference(appState.preferences.colorationMode) !== "none") {
    modes.push("Aide au décodage");
  }
  if (normalizeSyllableLevel(appState.preferences.syllableLevel) !== "off") {
    modes.push("Syllabes");
  }
  if (appState.preferences.focusMode !== "none") {
    modes.push("Focus");
  }
  if (normalizeReadingGuideMode(appState.preferences.readingGuideMode, appState.preferences.focusMode) !== "off") {
    modes.push("Réglette");
  }
  if (getEffectiveVerificationMode() !== "off") {
    modes.push("Vérification");
  }
  if (appState.speaking || appState.audioPaused) {
    modes.push("Audio");
  }

  if (modes.length === 0) {
    return appState.activeProfileId === "normal" ? "Mode normal" : "Lecture simple";
  }

  return modes.join(" + ");
}

function syncQuickActionButtons() {
  const audioState = appState.audioPaused ? "paused" : appState.speaking ? "playing" : "idle";
  const hasSpeechDocument = appState.speechAvailable && getNavigableBlocks().length > 0;
  const canRestartAudioFromSelection = audioState === "paused" && Boolean(appState.audioResumeOverride?.startKey);
  document.documentElement.dataset.audioState = audioState;

  if (elements.speechToggleButton) {
    elements.speechToggleButton.classList.toggle("is-active", audioState === "playing");
    elements.speechToggleButton.disabled = !hasSpeechDocument;
    elements.speechToggleButton.textContent =
      audioState === "paused"
        ? canRestartAudioFromSelection
          ? "Lire ici"
          : "Reprendre"
        : audioState === "playing"
          ? "Mettre en pause"
          : "Lire";
  }

  if (elements.speechStopButton) {
    elements.speechStopButton.classList.toggle("is-active", audioState !== "idle");
    elements.speechStopButton.disabled = !appState.speechAvailable || audioState === "idle";
    elements.speechStopButton.textContent = "Arrêter";
  }

  if (elements.speechPrevButton) {
    elements.speechPrevButton.disabled = !hasSpeechDocument;
  }

  if (elements.speechNextButton) {
    elements.speechNextButton.disabled = !hasSpeechDocument;
  }

  if (elements.selectionSpeechButton) {
    elements.selectionSpeechButton.disabled = !appState.selectionDraft || !appState.speechAvailable;
  }
}

function applyPreferencePatch(patch, statusMessage = "") {
  appState.preferences = {
    ...appState.preferences,
    ...patch
  };
  syncControlsWithState();
  renderDocument();
  debouncePersist();
  if (statusMessage) {
    elements.statusLine.textContent = statusMessage;
  }
}

function syncControlsWithState() {
  Object.entries(controls).forEach(([key, control]) => {
    if (!control) {
      return;
    }
    control.value = String(appState.preferences[key]);
    const output = document.querySelector(`[data-output-for="${key}"]`);
    if (output) {
      output.textContent = formatOutputValue(key, appState.preferences[key]);
    }
  });
  if (controls.overlayCustomColor) {
    controls.overlayCustomColor.disabled = appState.preferences.overlayPreset !== "custom";
  }
  ariaManager.refreshSliderValues();
}

function renderProfiles() {
  const renderCard = (profile, isCustom = false) => {
    const activeClass = appState.activeProfileId === profile.id ? "is-active" : "";
    const customBadge = isCustom ? "<span class=\"profile-badge\">Perso</span>" : "";
    const label = repairUiText(profile.label);
    const description = repairUiText(profile.description);
    return `
      <button class="profile-card ${activeClass}" data-profile-id="${profile.id}" type="button">
        <div class="profile-card-head">
          <strong>${escapeHtml(label)}</strong>
          ${customBadge}
        </div>
        <span>${escapeHtml(description)}</span>
      </button>
    `;
  };

  const importantProfiles = appState.builtinProfiles.filter((profile) => IMPORTANT_PROFILE_IDS.has(profile.id));
  const advancedProfiles = appState.builtinProfiles.filter((profile) => !IMPORTANT_PROFILE_IDS.has(profile.id));
  elements.profilesList.innerHTML = importantProfiles.map((profile) => renderCard(profile)).join("");
  if (elements.advancedProfilesList) {
    elements.advancedProfilesList.innerHTML = advancedProfiles.map((profile) => renderCard(profile)).join("");
  }
  elements.customProfilesList.innerHTML = appState.customProfiles.length
    ? appState.customProfiles.map((profile) => renderCard(profile, true)).join("")
    : "<p class=\"muted-inline\">Aucun profil personnalisé pour l'instant.</p>";

  const activeProfile = findProfile(appState.activeProfileId) || appState.builtinProfiles[0];
  elements.researchNotes.textContent = repairUiText(activeProfile?.researchNotes || "");
  renderProfileSummaryDialog();
  if (elements.profileNameInput) {
    elements.profileNameInput.value = isCustomProfile(appState.activeProfileId) ? activeProfile.label : "";
  }
  elements.deleteProfileButton.disabled = !appState.customProfiles.some(
    (profile) => profile.id === appState.activeProfileId
  );
}

function renderRecentFiles() {
  if (!elements.recentList) {
    return;
  }

  if (appState.recentFilesMeta.length === 0) {
    elements.recentList.innerHTML = "<li>Aucun document récent.</li>";
    return;
  }

  const normalizeRecentTitle = (fileName) =>
    String(fileName || "")
      .replace(/\.pdf$/iu, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  elements.recentList.innerHTML = appState.recentFilesMeta
    .map((item) => {
      const title = normalizeRecentTitle(item.fileName) || item.fileName;
      return `
        <li>
          <div class="recent-file">
            <div class="recent-file-title">${escapeHtml(title)}</div>
            <div class="recent-file-meta">${escapeHtml(formatRecentDocumentLabel(item))}</div>
          </div>
        </li>
      `;
    })
    .join("");
}

function loadBookmarksForCurrentDocument() {
  const bookmarkDocumentKey = buildBookmarkDocumentKey(appState.importedDocument);
  appState.bookmarks = bookmarkDocumentKey
    ? normalizeBookmarks(appState.bookmarksByDocument[bookmarkDocumentKey] || [])
    : [];
}

function loadAnnotationsForCurrentDocument() {
  const bookmarkDocumentKey = buildBookmarkDocumentKey(appState.importedDocument);
  appState.annotations = bookmarkDocumentKey
    ? normalizeAnnotations(appState.annotationsByDocument[bookmarkDocumentKey] || [])
    : [];
}

function renderBookmarks() {
  if (!elements.bookmarksList || !elements.bookmarksEmpty) {
    return;
  }

  const hasDocument = Boolean(appState.importedDocument);
  const bookmarks = normalizeBookmarks(appState.bookmarks);
  appState.bookmarks = bookmarks;

  if (!hasDocument) {
    elements.bookmarksList.innerHTML = "";
    elements.bookmarksEmpty.hidden = false;
    elements.bookmarksEmpty.textContent = "Importe un PDF pour commencer à poser des repères.";
    return;
  }

  if (bookmarks.length === 0) {
    elements.bookmarksList.innerHTML = "";
    elements.bookmarksEmpty.hidden = false;
    elements.bookmarksEmpty.textContent = "Aucun repère enregistré pour ce document.";
    return;
  }

  elements.bookmarksEmpty.hidden = true;
  elements.bookmarksList.innerHTML = bookmarks
    .map((bookmark) => {
      const createdAt = new Date(bookmark.createdAt);
      const createdLabel = Number.isNaN(createdAt.getTime()) ? "" : createdAt.toLocaleDateString("fr-FR");
      const metaParts = [];
      if (bookmark.pageNumber) {
        metaParts.push(`Page ${bookmark.pageNumber}`);
      }
      if (createdLabel) {
        metaParts.push(createdLabel);
      }

      return `
        <li class="bookmark-item">
          <button class="bookmark-button" type="button" data-bookmark-key="${escapeAttribute(bookmark.key)}">
            <strong>${escapeHtml(bookmark.label)}</strong>
            <span class="bookmark-meta">${escapeHtml(metaParts.join(" • ") || "Repère de lecture")}</span>
          </button>
        </li>
      `;
    })
    .join("");
}

function renderAnnotations() {
  if (!elements.annotationsList || !elements.annotationsEmpty) {
    return;
  }

  const hasDocument = Boolean(appState.importedDocument);
  const annotations = normalizeAnnotations(appState.annotations);
  appState.annotations = annotations;

  if (!hasDocument) {
    elements.annotationsList.innerHTML = "";
    elements.annotationsEmpty.hidden = false;
    elements.annotationsEmpty.textContent = "Importe un PDF pour commencer à surligner des passages.";
    return;
  }

  if (annotations.length === 0) {
    elements.annotationsList.innerHTML = "";
    elements.annotationsEmpty.hidden = false;
    elements.annotationsEmpty.textContent = "Aucun passage surligné pour ce document.";
    return;
  }

  elements.annotationsEmpty.hidden = true;
  elements.annotationsList.innerHTML = annotations
    .map((annotation) => {
      const createdAt = new Date(annotation.createdAt);
      const createdLabel = Number.isNaN(createdAt.getTime()) ? "" : createdAt.toLocaleDateString("fr-FR");
      const metaParts = [];
      if (annotation.pageNumber) {
        metaParts.push(`Page ${annotation.pageNumber}`);
      }
      if (createdLabel) {
        metaParts.push(createdLabel);
      }

      return `
        <li class="annotation-item">
          <button class="annotation-button" type="button" data-annotation-id="${escapeAttribute(annotation.id)}" data-block-key="${escapeAttribute(annotation.blockKey)}">
            <strong>${escapeHtml(annotation.excerpt)}</strong>
            <span class="annotation-meta">${escapeHtml(metaParts.join(" • ") || "Passage surligné")}</span>
          </button>
          <button class="ghost-action subtle annotation-remove" type="button" data-remove-annotation-id="${escapeAttribute(annotation.id)}" aria-label="Supprimer ce surlignage">×</button>
        </li>
      `;
    })
    .join("");
}

function clearSelectionAssist() {
  appState.selectionDraft = null;
  if (elements.selectionAssist) {
    elements.selectionAssist.hidden = true;
  }
  if (elements.selectionPreview) {
    elements.selectionPreview.textContent = "Choisis un passage dans le texte pour le surligner.";
  }
  if (elements.selectionSpeechButton) {
    elements.selectionSpeechButton.disabled = true;
  }
}

function updateSelectionAssist(draft) {
  appState.selectionDraft = draft;
  if (!elements.selectionAssist || !elements.selectionPreview) {
    return;
  }

  if (!draft) {
    clearSelectionAssist();
    return;
  }

  elements.selectionPreview.textContent = draft.excerpt;
  elements.selectionAssist.hidden = false;
  elements.selectionSpeechButton?.removeAttribute("disabled");
  if (draft.blockKey) {
    setSelectedBlock(draft.blockKey, { scroll: false });
  }
}

function getOcrLanguageLabel(language = "fra") {
  return language === "eng" ? "anglais" : "francais";
}

function getOcrAvailability(language = appState.preferences.ocrLanguage) {
  return ocrEngine.getAvailability(language);
}

function getIdleOcrStatus(language = appState.preferences.ocrLanguage) {
  const availability = getOcrAvailability(language);
  return availability.bundled
    ? `OCR local pret (${getOcrLanguageLabel(language)} integre).`
    : `OCR pret (${getOcrLanguageLabel(language)}). Un premier telechargement peut etre necessaire.`;
}

function getOcrFailureCopy(error, language = appState.preferences.ocrLanguage) {
  const availability = getOcrAvailability(language);
  const languageLabel = getOcrLanguageLabel(language);
  const code = error?.code || error?.message || "";

  if (code === "OCR_CANCELLED") {
    return {
      panelStatus: "OCR annule.",
      statusLine: "OCR annule."
    };
  }

  if (code === "OCR_LANGUAGE_DATA_UNAVAILABLE") {
    return availability.bundled
      ? {
          panelStatus: `Modele OCR ${languageLabel} introuvable dans l'application.`,
          statusLine: `Impossible de charger le modele OCR ${languageLabel} integre.`
        }
      : {
          panelStatus: `Modele OCR ${languageLabel} indisponible.`,
          statusLine: `Impossible de charger le modele OCR ${languageLabel}.`
        };
  }

  if (code === "OCR_NETWORK_ERROR") {
    return {
      panelStatus: `Modele OCR ${languageLabel} non telecharge. Une connexion est necessaire pour ce premier chargement.`,
      statusLine: `Impossible de telecharger le modele OCR ${languageLabel} pour le moment.`
    };
  }

  if (code === "OCR_LIBRARY_LOAD_FAILED") {
    return {
      panelStatus: "Moteur OCR local introuvable dans l'application.",
      statusLine: "Impossible de charger le moteur OCR local."
    };
  }

  if (code === "OCR_CORE_LOAD_FAILED") {
    return {
      panelStatus: "Le coeur OCR local n'a pas pu demarrer.",
      statusLine: "Impossible de demarrer le moteur OCR local."
    };
  }

  if (code === "OCR_RUNTIME_UNAVAILABLE") {
    return {
      panelStatus: "OCR indisponible dans ce mode.",
      statusLine: "L'OCR local n'est pas disponible dans ce contexte."
    };
  }

  return {
    panelStatus: availability.bundled
      ? "OCR local indisponible. Le moteur ou le modele integre n'a pas pu demarrer."
      : "OCR indisponible. Verifie la connexion necessaire au premier telechargement du modele.",
    statusLine: "Impossible de terminer l'OCR pour le moment."
  };
}

function captureOcrDebugError(error) {
  globalThis.__dysReaderLastOcrError = {
    name: error?.name || "",
    message: error?.message || "",
    code: error?.code || "",
    details: error?.details || "",
    stack: error?.stack || "",
    string: String(error)
  };
}

appState.ocrState.status = getIdleOcrStatus();

function updateOcrUi() {
  const canAttemptOcr = Boolean(appState.currentPdfBytes && appState.importedDocument);
  const ocrRecommended =
    appState.importedDocument?.extractionQuality === "poor" || appState.importedDocument?.extractionQuality === "partial";
  const ocrAvailability = getOcrAvailability();

  if (elements.startOcrButton) {
    elements.startOcrButton.disabled = !canAttemptOcr || appState.ocrState.running;
  }
  if (elements.cancelOcrButton) {
    elements.cancelOcrButton.disabled = !appState.ocrState.running;
  }
  if (elements.ocrProgress) {
    elements.ocrProgress.hidden = !appState.ocrState.running && !ocrRecommended && appState.importedDocument?.extractionQuality !== "ocr";
  }
  if (elements.ocrStatusText) {
    elements.ocrStatusText.textContent = appState.ocrState.status;
  }
  if (elements.ocrProgressValue) {
    elements.ocrProgressValue.textContent = `${Math.round(appState.ocrState.progress * 100)}%`;
  }
  if (elements.ocrProgressBar) {
    elements.ocrProgressBar.value = Math.max(0, Math.min(1, appState.ocrState.progress || 0));
  }
  if (elements.ocrHint) {
    elements.ocrHint.textContent =
      appState.importedDocument?.extractionQuality === "ocr"
        ? "Cette version provient d'un OCR local : l'application a reconstruit du texte à partir d'un scan ou d'une image. Vérifie surtout les zones complexes avant impression."
        : appState.importedDocument?.extractionQuality === "good"
          ? "Ce PDF contient déjà du texte exploitable. Lance l'OCR seulement si un passage manque, est illisible ou reste mal ordonné."
        : ocrRecommended
          ? "Ce document semble partiellement ou totalement scanné. L'OCR sert à transformer l'image du texte en une version lisible, adaptable et imprimable."
          : "L'OCR reste disponible si le texte importé paraît incomplet, désordonné ou non sélectionnable.";
  }
  if (elements.ocrHint) {
    let hintText = "";
    if (appState.importedDocument?.extractionQuality === "ocr") {
      hintText = "Cette version provient d'un OCR local : l'application a reconstruit du texte a partir d'un scan ou d'une image. Verifie surtout les zones complexes avant impression.";
    } else if (appState.importedDocument?.extractionQuality === "good") {
      hintText = "Ce PDF contient deja du texte exploitable. Lance l'OCR seulement si un passage manque, est illisible ou reste mal ordonne.";
    } else if (ocrRecommended) {
      hintText = ocrAvailability.bundled
        ? "Ce document semble partiellement ou totalement scanne. Le modele OCR choisi est deja integre localement : aucun telechargement n'est necessaire."
        : "Ce document semble partiellement ou totalement scanne. L'OCR sert a transformer l'image du texte en une version lisible, adaptable et imprimable.";
    } else {
      hintText = ocrAvailability.bundled
        ? "Le modele OCR choisi est deja integre localement. Lance l'OCR si le texte importe reste incomplet ou non selectionnable."
        : "L'OCR reste disponible si le texte importe parait incomplet, desordonne ou non selectionnable.";
    }
    elements.ocrHint.textContent = hintText;
  }
}

async function handleStartOcr() {
  if (!appState.currentPdfBytes || !appState.importedDocument) {
    elements.statusLine.textContent = "Importe d'abord un PDF avant de lancer l'OCR.";
    return;
  }

  globalThis.__dysReaderLastOcrError = null;
  const previousDocument = appState.importedDocument;
  appState.ocrState = {
    running: true,
    progress: 0,
    currentPage: 0,
    totalPages: previousDocument.pageCount || 0,
    status: "Préparation de l'OCR local..."
  };
  updateOcrUi();
  elements.statusLine.textContent = "OCR local en cours...";

  try {
    const ocrDocument = await ocrEngine.process(appState.currentPdfBytes, {
      fileName: previousDocument.fileName,
      language: appState.preferences.ocrLanguage,
      onProgress: (progress) => {
        appState.ocrState = {
          running: true,
          progress: Number(progress.progress) || 0,
          currentPage: progress.currentPage || 0,
          totalPages: progress.totalPages || previousDocument.pageCount || 0,
          status: progress.status || "OCR en cours..."
        };
        updateOcrUi();
      },
      onError: (error) => {
        captureOcrDebugError(error);
        console.error("Erreur OCR worker", error);
      }
    });

    const canAdoptOcr = shouldAdoptOcrResult(previousDocument, ocrDocument);
    if (canAdoptOcr) {
      ocrDocument.filePath = previousDocument.filePath;
      appState.importedDocument = ocrDocument;
      loadBookmarksForCurrentDocument();
      loadAnnotationsForCurrentDocument();
      appState.selectedBlockKey = getFirstReadableBlockKey(appState.importedDocument);
      rememberFileMeta(appState.importedDocument);
      renderDocument();
      debouncePersist();
    } else {
      renderDocument();
    }

    appState.ocrState = {
      running: false,
      progress: canAdoptOcr ? 1 : 0,
      currentPage: ocrDocument.pageCount || previousDocument.pageCount || 0,
      totalPages: ocrDocument.pageCount || previousDocument.pageCount || 0,
      status:
        canAdoptOcr
          ? `OCR terminé. Confiance moyenne : ${Math.round(ocrDocument.ocr?.averageConfidence || 0)}%.`
          : previousDocument.extractionQuality === "good"
            ? "OCR terminé, mais la version texte native reste plus fiable."
            : "OCR terminé, mais le texte reste insuffisant."
    };
    updateOcrUi();
    elements.statusLine.textContent = canAdoptOcr
      ? getImportStatusMessage(appState.importedDocument)
      : previousDocument.extractionQuality === "good"
        ? "L'OCR a terminé, mais l'application a conservé la version texte native, plus fiable pour ce PDF."
        : "L'OCR a terminé, mais le document reste trop pauvre pour une lecture adaptée fiable.";
  } catch (error) {
    captureOcrDebugError(error);
    const ocrFailure = getOcrFailureCopy(error, appState.preferences.ocrLanguage);
    const cancelled = error?.code === "OCR_CANCELLED" || error?.message === "OCR_CANCELLED";
    if (!cancelled) {
      console.error("Erreur pendant l'OCR", error);
    }
    appState.ocrState = {
      running: false,
      progress: 0,
      currentPage: 0,
      totalPages: previousDocument.pageCount || 0,
      status: cancelled
        ? "OCR annulé."
        : "OCR indisponible. Vérifie la connexion nécessaire au premier téléchargement des modèles."
    };
    updateOcrUi();
    elements.statusLine.textContent = cancelled
      ? "OCR annulé."
      : "Impossible de terminer l'OCR pour le moment.";
    appState.ocrState.status = ocrFailure.panelStatus;
    updateOcrUi();
    elements.statusLine.textContent = ocrFailure.statusLine;
  }
}

async function handleCancelOcr() {
  if (!appState.ocrState.running) {
    return;
  }

  await ocrEngine.cancel();
  appState.ocrState = {
    running: false,
    progress: 0,
    currentPage: 0,
    totalPages: appState.importedDocument?.pageCount || 0,
    status: "OCR annulé."
  };
  updateOcrUi();
  elements.statusLine.textContent = "OCR annulé.";
}

function buildSelectionDraft() {
  const selection = window.getSelection?.();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const commonNode =
    range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
  const block = commonNode?.closest?.(".reader-block");
  if (!block || !elements.readArea.contains(block)) {
    return null;
  }

  const wordNodes = [...block.querySelectorAll(".word-audio-track[data-source-start][data-source-end]")].filter((node) => {
    try {
      return range.intersectsNode(node);
    } catch {
      return false;
    }
  });

  if (wordNodes.length === 0) {
    return null;
  }

  const start = Math.min(...wordNodes.map((node) => Number(node.dataset.sourceStart)));
  const end = Math.max(...wordNodes.map((node) => Number(node.dataset.sourceEnd)));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }

  const blockText = block.dataset.sourceText || block.textContent || "";
  const excerpt = String(blockText).slice(start, end).replace(/\s+/gu, " ").trim();
  if (!excerpt) {
    return null;
  }

  return {
    blockKey: block.dataset.blockKey,
    pageNumber: block.dataset.pageNumber || "",
    start,
    end,
    excerpt
  };
}

function handleSelectionChange() {
  const draft = buildSelectionDraft();
  updateSelectionAssist(draft);
}

function findSentenceIndexForRange(block, start, end) {
  if (!block) {
    return 0;
  }

  const sentenceNodes = [...block.querySelectorAll("[data-audio-sentence-index]")];
  if (sentenceNodes.length === 0) {
    return 0;
  }

  const midpoint = start + Math.max(0, end - start) / 2;
  const exactMatch = sentenceNodes.find((node) => {
    const sentenceStart = Number(node.dataset.sourceStart);
    const sentenceEnd = Number(node.dataset.sourceEnd);
    return Number.isFinite(sentenceStart) && Number.isFinite(sentenceEnd) && midpoint >= sentenceStart && midpoint < sentenceEnd;
  });

  if (exactMatch) {
    return Number(exactMatch.dataset.audioSentenceIndex) || 0;
  }

  const overlapMatch = sentenceNodes.find((node) => {
    const sentenceStart = Number(node.dataset.sourceStart);
    const sentenceEnd = Number(node.dataset.sourceEnd);
    return Number.isFinite(sentenceStart) && Number.isFinite(sentenceEnd) && start < sentenceEnd && end > sentenceStart;
  });

  return Number(overlapMatch?.dataset.audioSentenceIndex) || 0;
}

function getAudioStartContext({ preferSelection = true, requireSelection = false } = {}) {
  const blocks = getNavigableBlocks();
  if (blocks.length === 0) {
    return null;
  }

  if (preferSelection && appState.selectionDraft?.blockKey) {
    const selectionBlock = elements.pageList.querySelector(`[data-block-key="${appState.selectionDraft.blockKey}"]`);
    if (selectionBlock) {
      return {
        startKey: appState.selectionDraft.blockKey,
        startSentenceIndex: findSentenceIndexForRange(selectionBlock, appState.selectionDraft.start, appState.selectionDraft.end),
        source: "selection"
      };
    }
  }

  if (requireSelection) {
    return null;
  }

  const selectedBlock =
    blocks.find((block) => block.dataset.blockKey === appState.selectedBlockKey) ||
    blocks[0];

  return {
    startKey: selectedBlock?.dataset.blockKey || "",
    startSentenceIndex: 0,
    source: "block"
  };
}

function addAnnotation(color) {
  if (!appState.selectionDraft || !appState.importedDocument) {
    elements.statusLine.textContent = "Sélectionne d'abord un passage dans la zone de lecture.";
    return;
  }

  appState.annotations = upsertAnnotation(appState.annotations, {
    ...appState.selectionDraft,
    color,
    createdAt: Date.now()
  });
  syncAnnotationsStorage();
  renderAnnotations();
  renderDocument();
  debouncePersist();
  window.getSelection?.()?.removeAllRanges?.();
  clearSelectionAssist();
  elements.statusLine.textContent = "Passage surligné et enregistré pour ce document.";
}

function deleteAnnotation(annotationId) {
  appState.annotations = removeAnnotation(appState.annotations, annotationId);
  syncAnnotationsStorage();
  renderAnnotations();
  renderDocument();
  debouncePersist();
  elements.statusLine.textContent = "Surlignage supprimé.";
}

function updateLayoutVariables() {
  applyAppTheme();
  applyTheme();
  document.documentElement.style.setProperty("--dl-ui-bg", getComputedStyle(document.documentElement).getPropertyValue("--ui-page").trim());
  document.documentElement.style.setProperty(
    "--dl-ui-accent",
    getComputedStyle(document.documentElement).getPropertyValue("--ui-accent").trim()
  );
  document.documentElement.style.setProperty(
    "--dl-ui-text",
    getComputedStyle(document.documentElement).getPropertyValue("--ui-text").trim()
  );
  document.documentElement.style.setProperty("--dl-ui-border", getComputedStyle(document.documentElement).getPropertyValue("--ui-border").trim());
  document.documentElement.style.setProperty("--dl-bg-color", getComputedStyle(document.documentElement).getPropertyValue("--canvas").trim());
  document.documentElement.style.setProperty("--dl-text-color", "#3b3530");
  document.documentElement.style.setProperty("--dl-font-family", appState.preferences.fontFamily);
  document.documentElement.style.setProperty("--dl-font-size", `${appState.preferences.fontSize}px`);
  document.documentElement.style.setProperty("--dl-line-height", `${Math.max(1.8, appState.preferences.lineHeight)}`);
  document.documentElement.style.setProperty(
    "--dl-letter-spacing",
    `${Math.max(0.12, appState.preferences.letterSpacing).toFixed(3).replace(/0+$/u, "").replace(/\.$/u, "")}em`
  );
  document.documentElement.style.setProperty("--dl-word-spacing", `${Math.max(0.16, appState.preferences.wordSpacing)}em`);
  document.documentElement.style.setProperty("--dl-reading-width", `${appState.preferences.maxLineLength}ch`);
  document.documentElement.style.setProperty("--dl-padding", `${appState.preferences.pagePadding}px`);
  document.documentElement.style.setProperty("--dl-overlay-color", getOverlayColor());
  document.documentElement.style.setProperty("--dl-overlay-opacity", `${getOverlayOpacity()}`);
  document.documentElement.dataset.highlightMode = appState.preferences.highlightMode;
  document.documentElement.dataset.focusMode = appState.preferences.focusMode;
  document.documentElement.dataset.readingGuideMode = normalizeReadingGuideMode(
    appState.preferences.readingGuideMode,
    appState.preferences.focusMode
  );
  document.documentElement.dataset.profileId = appState.activeProfileId;
  document.documentElement.dataset.colorationMode = normalizeColorationPreference(appState.preferences.colorationMode);
  document.documentElement.dataset.verificationMode = getEffectiveVerificationMode();
  document.documentElement.dataset.audioState = appState.audioPaused ? "paused" : appState.speaking ? "playing" : "idle";
  document.body.classList.toggle("is-distraction-free", appState.preferences.distractionFree);
  ariaManager.setSidebarExpanded(!appState.preferences.distractionFree);
  updateSidebarToggleUi();
  syncQuickActionButtons();
}

function setWarning(message, visible) {
  elements.warningBanner.hidden = !visible;
  elements.warningText.textContent = message;
}

function updateDocumentMeta() {
  if (!appState.importedDocument) {
    elements.documentTitle.textContent = "Aucun PDF chargé";
    elements.documentMeta.textContent = "Importe un PDF texte pour activer la lecture adaptée.";
    elements.documentPagesInfo.textContent = "0";
    elements.documentModeInfo.textContent = "En attente";
    elements.documentProfileInfo.textContent = getActiveProfileLabel();
    return;
  }

  const { fileName, pageCount, extractionQuality } = appState.importedDocument;
  const qualityLabel = getExtractionQualityLabel(extractionQuality);
  const diagnostics = getDocumentDiagnostics();
  const ocrLabel =
    extractionQuality === "ocr" && Number.isFinite(appState.importedDocument.ocr?.averageConfidence)
      ? ` - OCR ${Math.round(appState.importedDocument.ocr.averageConfidence)}%`
      : "";
  const formulaLabel =
    diagnostics.formulaBlockCount > 0
      ? ` - ${diagnostics.formulaBlockCount} formule(s)`
      : diagnostics.verificationBlockCount > 0
        ? ` - ${diagnostics.verificationBlockCount} bloc(s) à vérifier`
        : "";

  elements.documentTitle.textContent = fileName;
  elements.documentMeta.textContent = `${pageCount} page(s) - ${qualityLabel}${ocrLabel}${formulaLabel}`;
  elements.documentPagesInfo.textContent = String(pageCount);
  elements.documentModeInfo.textContent = getActiveModeLabel();
  elements.documentProfileInfo.textContent = getActiveProfileLabel();
}

function getActiveProfileLabel() {
  return repairUiText(findProfile(appState.activeProfileId)?.label || "Profil personnalisé");
}

function buildCurrentPrintManifest(scope = "document") {
  if (!appState.importedDocument || appState.importedDocument.extractionQuality === "poor") {
    return null;
  }

  return buildPrintManifest({
    importedDocument: appState.importedDocument,
    preferences: appState.preferences,
    profileLabel: getActiveProfileLabel(),
    scope
  });
}

function getBlockSpeechText(block) {
  if (block?.readingText) {
    return block.readingText;
  }
  if (block?.type === "formula" || block?.math?.containsMath) {
    return verbalizeMathText(block.text || "");
  }
  return block?.text || "";
}

function renderTableCell(cell, cellIndex) {
  const value = String(cell || "").trim();
  if (!value) {
    return "";
  }

  return `
    <span class="table-cell ${cellIndex === 0 ? "table-cell--label" : "table-cell--value"}">
      ${renderAdaptedText(value, {
        colorationMode: appState.preferences.colorationMode,
        soundColorMode: appState.preferences.soundColorMode,
        syllableLevel: "off",
        syllableBreakMode: "none",
        blockType: "table",
        annotationRanges: []
      })}
    </span>
  `;
}

function renderTableBlock(block) {
  const rows =
    block.rows?.filter((row) => Array.isArray(row) && row.some((cell) => String(cell || "").trim().length > 0)) ||
    String(block.text || "")
      .split("\n")
      .map((row) => row.split(/\s+\|\s+/u).filter((cell) => cell.trim().length > 0))
      .filter((row) => row.length > 0);

  return `
    <div class="table-block">
      ${rows
        .map((row) => {
          const template =
            row.length <= 1 ? "minmax(0, 1fr)" : `minmax(22ch, 2.3fr) repeat(${row.length - 1}, minmax(10ch, 1fr))`;
          return `
            <div class="table-row" style="grid-template-columns: ${template}">
              ${row.map((cell, cellIndex) => renderTableCell(cell, cellIndex)).join("")}
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderAudioReadyText(
  text,
  { colorationMode, soundColorMode, syllableLevel, syllableBreakMode, blockType, annotationRanges = [] } = {}
) {
  const segments = segmentTextIntoSentences(text);
  if (segments.length === 0) {
    return renderAdaptedText(text, {
      colorationMode,
      soundColorMode,
      syllableLevel,
      syllableBreakMode,
      blockType,
      audioTracking: true,
      wordIndexOffset: 0,
      annotationRanges
    });
  }

  let sourceOffset = 0;
  return segments
    .map((segment, sentenceIndex) => {
      const sentenceStart = sourceOffset;
      const sentenceEnd = sentenceStart + segment.rawText.length;
      sourceOffset = sentenceEnd;
      const markup = renderAdaptedText(segment.rawText, {
        colorationMode,
        soundColorMode,
        syllableLevel,
        syllableBreakMode,
        blockType,
        audioTracking: true,
        wordIndexOffset: 0,
        annotationRanges
      });
      return `<span class="audio-sentence" data-audio-sentence-index="${sentenceIndex}" data-source-start="${sentenceStart}" data-source-end="${sentenceEnd}">${markup}</span>`;
    })
    .join("");
}

function renderBlockBody(block, blockKey) {
  const annotationRanges = getBlockAnnotations(appState.annotations, blockKey);
  if (block.type === "formula") {
    return `<pre class="formula-content">${renderMathText(block.text)}</pre>`;
  }

  if (block.type === "table") {
    return renderTableBlock(block);
  }

  return `<p>${renderAudioReadyText(block.text, {
    colorationMode: block.math?.containsMath ? "none" : appState.preferences.colorationMode,
    soundColorMode: appState.preferences.soundColorMode,
    syllableLevel: block.math?.containsMath ? "off" : appState.preferences.syllableLevel,
    syllableBreakMode: appState.preferences.syllableBreakMode,
    blockType: block.type,
    annotationRanges
  })}</p>`;
}

function renderVerificationNote(block) {
  const verificationMode = getEffectiveVerificationMode();
  if (verificationMode === "off") {
    return "";
  }

  const reasons = block?.verification?.reasons || [];
  const hasVerification = block?.verification?.level && block.verification.level !== "none";
  if (!hasVerification) {
    return "";
  }

  const severityLabel =
    block.verification.level === "high" ? "Priorité haute" : block.verification.level === "medium" ? "À relire" : "Contrôle léger";
  const details = reasons.join(" · ");
  return `
    <div class="verification-note">
      <strong>${escapeHtml(severityLabel)}</strong>
      <span>${escapeHtml(details)}</span>
    </div>
  `;
}

function renderVerificationSummary() {
  if (!elements.verificationSummary) {
    return;
  }

  if (!appState.importedDocument || appState.importedDocument.extractionQuality === "poor") {
    elements.verificationSummary.hidden = true;
    elements.verificationSummary.innerHTML = "";
    return;
  }

  const diagnostics = getDocumentDiagnostics();
  const requestedMode = normalizeVerificationMode(appState.preferences.verificationMode);
  const effectiveMode = getEffectiveVerificationMode();
  if (requestedMode === "off") {
    elements.verificationSummary.hidden = true;
    elements.verificationSummary.innerHTML = "";
    return;
  }

  const modeLabel =
    requestedMode === "review"
      ? diagnostics.verificationBlockCount > 0
        ? "Relecture ciblée : seuls les blocs signalés restent visibles pour une relecture plus rapide."
        : "Relecture ciblée demandée, mais aucune zone fragile n'a été détectée : l'affichage complet est conservé."
      : "Repères discrets : les blocs à contrôler restent visibles avec un signal léger dans la lecture.";

  const purposeLabel =
    "La vérification sert à repérer les zones plus fragiles : formules, OCR incertain, tableaux réorganisés ou blocs complexes.";
  const reasonsLabel = diagnostics.verificationReasons.length
    ? `Types détectés : ${diagnostics.verificationReasons.slice(0, 3).join(" · ")}.`
    : "Aucune zone particulièrement fragile n'a été détectée sur ce document.";
  const visibilityLabel =
    effectiveMode === "off" && requestedMode === "review"
      ? "Le texte complet reste affiché pour éviter une page vide."
      : "";

  elements.verificationSummary.hidden = false;
  elements.verificationSummary.innerHTML = `
    <strong>Vérification maths / OCR</strong>
    <span>${diagnostics.formulaBlockCount} formule(s) détectée(s)</span>
    <span>${diagnostics.verificationBlockCount} bloc(s) à contrôler</span>
    <p>${escapeHtml(purposeLabel)}</p>
    <p>${escapeHtml(modeLabel)}</p>
    <p>${escapeHtml(reasonsLabel)}</p>
    ${visibilityLabel ? `<p>${escapeHtml(visibilityLabel)}</p>` : ""}
  `;
}

function getVisibleBlocksForPage(page) {
  const verificationMode = getEffectiveVerificationMode();
  if (verificationMode !== "review") {
    return page.blocks;
  }

  return page.blocks.filter((block) => block?.verification?.level && block.verification.level !== "none");
}

function renderPrintSummary(manifest) {
  if (!manifest) {
    elements.printSummary.innerHTML = "";
    return;
  }

  const settings = formatPrintSettingsSummary(manifest)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  const warningItems = manifest.warnings.length
    ? `
      <p><strong>Points de vigilance :</strong></p>
      <ul>${manifest.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>
    `
    : "";

  elements.printSummary.innerHTML = `
    <h3>Version adaptée imprimable</h3>
    <p>
      Document : <strong>${escapeHtml(manifest.title)}</strong><br />
      Pages : ${manifest.pageCount} | Blocs lisibles : ${manifest.blockCount} | Formules : ${manifest.formulaBlockCount}
    </p>
    <ul>${settings}</ul>
    ${warningItems}
  `;
}

function clearAudioHighlights() {
  elements.pageList.querySelectorAll(".is-audio-sentence").forEach((node) => node.classList.remove("is-audio-sentence"));
  elements.pageList.querySelectorAll(".is-audio-word").forEach((node) => node.classList.remove("is-audio-word"));
  elements.pageList.querySelectorAll(".is-audio-block").forEach((node) => node.classList.remove("is-audio-block"));
}

function getCurrentAudioBlockKey() {
  return elements.pageList.querySelector(".reader-block.is-audio-block")?.dataset?.blockKey || "";
}

function setAudioResumeOverride(startContext) {
  if (!startContext?.startKey) {
    appState.audioResumeOverride = null;
    syncQuickActionButtons();
    return;
  }

  appState.audioResumeOverride = {
    startKey: startContext.startKey,
    startSentenceIndex: Number(startContext.startSentenceIndex) || 0,
    source: startContext.source || "block"
  };
  syncQuickActionButtons();
}

function highlightAudioSentence(blockKey, sentenceIndex) {
  clearAudioHighlights();
  const block = elements.pageList.querySelector(`[data-block-key="${blockKey}"]`);
  if (!block) {
    return;
  }

  block.classList.add("is-audio-block");
  const sentence = block.querySelector(`[data-audio-sentence-index="${sentenceIndex}"]`);
  if (sentence) {
    sentence.classList.add("is-audio-sentence");
  }
}

function highlightAudioWord(blockKey, sentenceIndex, wordIndex) {
  highlightAudioSentence(blockKey, sentenceIndex);
  const block = elements.pageList.querySelector(`[data-block-key="${blockKey}"]`);
  const sentence = block?.querySelector(`[data-audio-sentence-index="${sentenceIndex}"]`);
  const word = sentence?.querySelector(`[data-audio-word-index="${wordIndex}"]`);
  if (word) {
    word.classList.add("is-audio-word");
  }
}

function highlightSelectedBlock(scroll = false) {
  const allBlocks = elements.pageList.querySelectorAll(".reader-block");
  allBlocks.forEach((block) => {
    block.classList.toggle("is-current", block.dataset.blockKey === appState.selectedBlockKey);
  });

  const current = elements.pageList.querySelector(`[data-block-key="${appState.selectedBlockKey}"]`);
  if (current && scroll) {
    current.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

function getCurrentReaderLineHeightPx() {
  const sample =
    elements.pageList.querySelector(".reader-page-body") ||
    elements.pageList.querySelector(".reader-block") ||
    elements.pageList;
  const styles = getComputedStyle(sample);
  const computedLineHeight = Number.parseFloat(styles.lineHeight);
  if (Number.isFinite(computedLineHeight)) {
    return computedLineHeight;
  }

  const computedFontSize = Number.parseFloat(styles.fontSize) || appState.preferences.fontSize;
  return computedFontSize * Math.max(1.5, appState.preferences.lineHeight);
}

function syncReadingGuide({ alignToSelection = true } = {}) {
  readingGuide.attach(elements.readArea);
  readingGuide.setMode(normalizeReadingGuideMode(appState.preferences.readingGuideMode, appState.preferences.focusMode));
  readingGuide.setVisibleLines(appState.preferences.readingGuideLines);
  readingGuide.setOpacity(appState.preferences.readingGuideOpacity);
  readingGuide.setColor(appState.preferences.readingGuideColor);
  readingGuide.setLineHeight(getCurrentReaderLineHeightPx());

  if (!alignToSelection) {
    return;
  }

  const current = elements.pageList.querySelector(`[data-block-key="${appState.selectedBlockKey}"]`);
  if (current) {
    readingGuide.moveToBlock(current);
  }
}

function moveGuideOrSelection(step) {
  const guideMode = normalizeReadingGuideMode(appState.preferences.readingGuideMode, appState.preferences.focusMode);
  if (guideMode !== "off") {
    if (step < 0) {
      readingGuide.moveUp();
    } else {
      readingGuide.moveDown();
    }
    elements.readArea.scrollBy({
      top: step * getCurrentReaderLineHeightPx(),
      behavior: document.documentElement.dataset.motionPreference === "reduce" ? "auto" : "smooth"
    });
    return;
  }

  moveSelection(step);
}

function movePage(step) {
  const pages = [...elements.pageList.querySelectorAll(".reader-page")];
  if (pages.length === 0) {
    return;
  }

  const currentBlock = elements.pageList.querySelector(`[data-block-key="${appState.selectedBlockKey}"]`);
  const currentPage = currentBlock?.closest(".reader-page");
  const currentIndex = Math.max(0, pages.indexOf(currentPage));
  const nextIndex = Math.min(Math.max(currentIndex + step, 0), pages.length - 1);
  const targetPage = pages[nextIndex];
  if (!targetPage) {
    return;
  }

  targetPage.scrollIntoView({ block: "start", behavior: "smooth" });
  const firstBlock = targetPage.querySelector(".reader-block");
  if (firstBlock) {
    setSelectedBlock(firstBlock.dataset.blockKey, { scroll: false });
    firstBlock.focus({ preventScroll: true });
  }
}

function moveAudioCursor(step) {
  if (!appState.speaking && !window.speechSynthesis?.paused) {
    moveSelection(step);
    return;
  }

  if (step < 0) {
    playPreviousSentence();
  } else {
    playNextSentence();
  }
}

function adjustZoom(step) {
  const nextSize = Math.min(Math.max(appState.preferences.fontSize + step, 12), 34);
  if (nextSize === appState.preferences.fontSize) {
    return;
  }

  appState.preferences.fontSize = nextSize;
  syncControlsWithState();
  renderDocument();
  debouncePersist();
  elements.statusLine.textContent = `Taille de lecture : ${nextSize}px.`;
}

function activateProfileByShortcut(index) {
  const profile = appState.builtinProfiles[index - 1];
  if (!profile) {
    return;
  }

  activateProfile(profile.id, {
    statusMessage: `Profil actif : ${profile.label}.`
  });
}

function toggleImmersion() {
  appState.preferences.distractionFree = !appState.preferences.distractionFree;
  updateLayoutVariables();
  debouncePersist();
}

function exitImmersion() {
  if (!appState.preferences.distractionFree) {
    return;
  }

  appState.preferences.distractionFree = false;
  updateLayoutVariables();
  debouncePersist();
  elements.statusLine.textContent = "Réglages réaffichés.";
}

function toggleSettings() {
  toggleImmersion();
}

function isReadingTarget(target) {
  return elements.readArea.contains(target) || target === elements.readArea;
}

function quickBookmark() {
  if (!appState.importedDocument || !appState.selectedBlockKey) {
    elements.statusLine.textContent = "Aucun passage lisible n'est sélectionné pour ajouter un marque-page.";
    return;
  }

  const current = elements.pageList.querySelector(`[data-block-key="${appState.selectedBlockKey}"]`);
  const label = current?.querySelector(".reader-block--heading, p, .table-cell")?.textContent?.trim() || "Position courante";
  appState.bookmarks = upsertBookmark(appState.bookmarks, {
    key: appState.selectedBlockKey,
    pageNumber: current?.dataset.pageNumber || "",
    label,
    createdAt: Date.now()
  });
  syncBookmarksStorage();
  renderBookmarks();
  debouncePersist();
  elements.statusLine.textContent = "Marque-page rapide ajouté pour la position courante.";
}

function renderDocument() {
  updateLayoutVariables();
  updateDocumentMeta();
  renderVerificationSummary();

  const documentLoaded = Boolean(appState.importedDocument);
  const canUseAdaptedView = documentLoaded && appState.importedDocument.extractionQuality !== "poor";
  elements.emptyState.hidden = documentLoaded;
  elements.docState.hidden = !documentLoaded;
  elements.openExternalButton.disabled = !documentLoaded;
  elements.printButton.disabled = !canUseAdaptedView;
  elements.exportPdfButton.disabled = !canUseAdaptedView;
  elements.bookmarkQuickButton.disabled = !documentLoaded;
  elements.exportNotesButton.disabled = !documentLoaded;
  renderBookmarks();
  renderAnnotations();
  updateOcrUi();

  if (!documentLoaded) {
    setWarning("", false);
    elements.printSummary.innerHTML = "";
    elements.pageList.innerHTML = "";
    readingGuide.setMode("off");
    clearSelectionAssist();
    appState.ocrState.status = "OCR prêt.";
    appState.ocrState.status = getIdleOcrStatus();
    appState.ocrState.progress = 0;
    appState.ocrState.currentPage = 0;
    appState.ocrState.totalPages = 0;
    updateOcrUi();
    return;
  }

  if (appState.importedDocument.extractionQuality === "poor") {
    setWarning("PDF scanné détecté. Lance l'OCR local pour reconstruire une version lisible.", true);
    elements.pageList.innerHTML = `
      <article class="reader-empty-message">
        <h3>Lecture adaptée indisponible</h3>
        <p>Ce document ressemble à un scan ou ne contient pas assez de texte exploitable.</p>
        <p>Utilise le panneau OCR local dans la colonne de gauche pour tenter une reconstruction automatique.</p>
      </article>
    `;
    elements.keyboardHint.textContent = "Ctrl+O permet aussi d'ouvrir rapidement un autre document.";
    elements.printSummary.innerHTML = "";
    readingGuide.setMode("off");
    return;
  }

  const warningMessage = appState.importedDocument.warnings[0] || "";
  const diagnostics = getDocumentDiagnostics();
  const verificationWarning =
    getEffectiveVerificationMode() !== "off" && diagnostics.verificationBlockCount > 0
      ? `${diagnostics.verificationBlockCount} bloc(s) demandent une vérification mathématique.`
      : "";
  setWarning(verificationWarning || warningMessage, Boolean(verificationWarning || warningMessage));
  elements.keyboardHint.textContent =
    "Raccourcis : Ctrl+O pour ouvrir un PDF, flèches haut/bas dans la zone de lecture pour changer de bloc.";

  const pagesMarkup = appState.importedDocument.pages
    .map((page) => {
      const verificationMode = getEffectiveVerificationMode();
      const visibleBlocks = getVisibleBlocksForPage(page);
      const blocks = visibleBlocks
        .map((block, blockIndex) => {
          const originalIndex = page.blocks.indexOf(block);
          const key = buildBlockKey(page.pageNumber, originalIndex);
          const isActive = key === appState.selectedBlockKey;
          return `
            <article
              class="reader-block reader-block--${block.type} ${block.math?.containsMath ? "has-math" : ""} ${block?.verification?.level && block.verification.level !== "none" ? "is-flagged" : ""} ${isActive ? "is-current" : ""}"
              data-block-key="${key}"
              tabindex="0"
              data-page-number="${page.pageNumber}"
              data-speech-text="${escapeAttribute(getBlockSpeechText(block))}"
              data-source-text="${escapeAttribute(block.text || "")}"
              data-verification-level="${escapeAttribute(block?.verification?.level || "none")}"
            >
              <span class="block-anchor">p.${page.pageNumber}</span>
              ${renderBlockBody(block, key)}
              ${renderVerificationNote(block)}
            </article>
          `;
        })
        .join("");

      return `
        <section class="reader-page" aria-label="Page ${page.pageNumber}">
          <header class="reader-page-header">Page ${page.pageNumber}</header>
          <div class="reader-page-body">${blocks || `<p class="muted-inline">${verificationMode === "review" ? "Aucun bloc à contrôler sur cette page." : "Page sans texte exploitable."}</p>`}</div>
        </section>
      `;
    })
    .join("");

  elements.pageList.innerHTML = pagesMarkup;
  clearAudioHighlights();
  if (!elements.pageList.querySelector(`[data-block-key="${appState.selectedBlockKey}"]`)) {
    appState.selectedBlockKey = elements.pageList.querySelector(".reader-block")?.dataset.blockKey || "";
  }
  renderPrintSummary(buildCurrentPrintManifest());
  highlightSelectedBlock();
  syncReadingGuide();
}

function rememberFileMeta(importedDocument) {
  const entry = buildRecentFileEntry(importedDocument);

  appState.recentFilesMeta = [entry, ...appState.recentFilesMeta.filter((item) => item.fileName !== entry.fileName)]
    .slice(0, 6);

  renderRecentFiles();
  debouncePersist();
}

async function handlePdfOpen() {
  const picked = await runtimeApi.openPdfDialog();
  if (!picked) {
    return;
  }

  elements.statusLine.textContent = "Lecture du PDF en cours...";
  let nextPdfBlobUrl = "";
  try {
    appState.currentPdfBytes = null;
    const fileRef = picked.file ?? picked.filePath;
    const { bytes, fileName, filePath } = await runtimeApi.readPdfFile(fileRef);
    const typedBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const blob = new Blob([typedBytes], { type: "application/pdf" });
    nextPdfBlobUrl = URL.createObjectURL(blob);
    const importedDocument = await importPdfFromBytes(typedBytes, fileName);
    importedDocument.filePath = filePath;

    if (appState.currentPdfBlobUrl) {
      URL.revokeObjectURL(appState.currentPdfBlobUrl);
    }
    appState.currentPdfBlobUrl = nextPdfBlobUrl;
    appState.currentPdfBytes = typedBytes;
    appState.importedDocument = importedDocument;
    loadBookmarksForCurrentDocument();
    loadAnnotationsForCurrentDocument();
    clearSelectionAssist();
    appState.ocrState = {
      running: false,
      progress: 0,
      currentPage: 0,
      totalPages: importedDocument.pageCount || 0,
      status:
        importedDocument.extractionQuality === "poor"
          ? "OCR recommandé pour ce document scanné."
          : "OCR prêt."
    };

    appState.ocrState.status =
      importedDocument.extractionQuality === "poor"
        ? "OCR recommande pour ce document scanne."
        : getIdleOcrStatus();
    appState.selectedBlockKey = getFirstReadableBlockKey(appState.importedDocument);
    renderDocument();
    rememberFileMeta(appState.importedDocument);
    elements.statusLine.textContent = getImportStatusMessage(appState.importedDocument);
  } catch (error) {
    if (nextPdfBlobUrl) {
      URL.revokeObjectURL(nextPdfBlobUrl);
    }
    appState.currentPdfBytes = null;
    console.error("Erreur lors de l'import PDF", error);
    setWarning("Impossible de lire ce PDF. Vérifie qu'il n'est pas corrompu.", true);
    elements.statusLine.textContent = "Import impossible pour ce fichier.";
  }
}

async function handlePrint() {
  const manifest = buildCurrentPrintManifest();
  if (!manifest) {
    elements.statusLine.textContent = "L'impression adaptée n'est disponible que pour un document lisible.";
    return;
  }

  renderPrintSummary(manifest);
  elements.statusLine.textContent = "Préparation de l'impression...";
  try {
    const result = await runtimeApi.printCurrentView();
    if (result?.ok === false) {
      elements.statusLine.textContent = result.failureReason
        ? `Impression interrompue : ${result.failureReason}.`
        : "Impression interrompue.";
      return;
    }

    elements.statusLine.textContent =
      runtimeApi.kind === "electron"
        ? "Fenêtre d'impression ouverte avec la version adaptée."
        : "Impression du navigateur ouverte avec la version adaptée.";
  } catch (error) {
    console.error("Erreur pendant l'impression", error);
    elements.statusLine.textContent = "Impossible de lancer l'impression pour le moment.";
  }
}

async function handleExportAdaptedPdf() {
  const manifest = buildCurrentPrintManifest();
  if (!manifest) {
    elements.statusLine.textContent = "L'export PDF adapté n'est disponible que pour un document lisible.";
    return;
  }

  renderPrintSummary(manifest);
  elements.statusLine.textContent = "Préparation de l'export PDF adapté...";
  try {
    const result = await runtimeApi.exportAdaptedPdf(getPrintExportFilename(manifest));
    if (result?.canceled) {
      elements.statusLine.textContent = "Export PDF annulé.";
      return;
    }
    if (result?.ok === false) {
      elements.statusLine.textContent = "L'export PDF a échoué.";
      return;
    }

    elements.statusLine.textContent = result?.filePath
      ? `PDF adapté exporté : ${result.filePath}`
      : "PDF adapté exporté.";
  } catch (error) {
    console.error("Erreur pendant l'export PDF", error);
    elements.statusLine.textContent = "Impossible d'exporter le PDF adapté pour le moment.";
  }
}

async function handleExportNotes() {
  if (!appState.importedDocument) {
    elements.statusLine.textContent = "Importe un document avant d'exporter des notes.";
    return;
  }

  const bookmarkText = exportBookmarksAsText(appState.importedDocument.fileName, appState.bookmarks);
  const annotationText = exportAnnotationsAsText(appState.importedDocument.fileName, appState.annotations);
  const content = `${bookmarkText}\n\n${annotationText}`;
  try {
    const result = await runtimeApi.saveTextFile({
      defaultFileName: getBookmarkExportFileName(appState.importedDocument.fileName),
      content,
      title: "Exporter les marque-pages"
    });

    if (result?.canceled) {
      elements.statusLine.textContent = "Export des notes annulé.";
      return;
    }

    if (result?.ok === false) {
      elements.statusLine.textContent = "L'export des notes a échoué.";
      return;
    }

    elements.statusLine.textContent = result?.filePath
      ? `Notes exportées : ${result.filePath}`
      : "Notes exportées au format texte.";
  } catch (error) {
    console.error("Erreur pendant l'export des notes", error);
    elements.statusLine.textContent = "Impossible d'exporter les notes pour le moment.";
  }
}

function setSelectedBlock(blockKey, { scroll = true } = {}) {
  appState.selectedBlockKey = blockKey;
  highlightSelectedBlock(scroll);
  syncReadingGuide();
}

function getNavigableBlocks() {
  return [...elements.pageList.querySelectorAll(".reader-block")];
}

function moveSelection(step) {
  const blocks = getNavigableBlocks();
  if (blocks.length === 0) {
    return;
  }

  let currentIndex = blocks.findIndex((block) => block.dataset.blockKey === appState.selectedBlockKey);
  if (currentIndex === -1) {
    currentIndex = 0;
  } else {
    currentIndex = Math.min(Math.max(currentIndex + step, 0), blocks.length - 1);
  }

  const target = blocks[currentIndex];
  if (target) {
    setSelectedBlock(target.dataset.blockKey, { scroll: true });
    target.focus({ preventScroll: true });
  }
}

function createCustomProfileId(label) {
  const slug = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `custom-${slug || Date.now()}`;
}

function getProfileLabelInput() {
  const typedLabel = elements.profileNameInput?.value.trim() || "";
  if (typedLabel) {
    return typedLabel;
  }

  const activeLabel = getActiveProfileLabel();
  return isCustomProfile(appState.activeProfileId) ? activeLabel : `Copie de ${activeLabel}`;
}

function saveCurrentProfile() {
  const label = getProfileLabelInput();
  const existingCustomProfile = isCustomProfile(appState.activeProfileId)
    ? appState.customProfiles.find((profile) => profile.id === appState.activeProfileId)
    : null;

  const profile = {
    id: existingCustomProfile?.id || createCustomProfileId(label),
    label,
    description: "Profil personnalisé enregistré à partir des réglages actuels.",
    editable: true,
    researchNotes: "Profil personnalisé. Tu peux le recharger puis continuer à l'ajuster.",
    defaults: { ...appState.preferences }
  };

  appState.customProfiles = [
    profile,
    ...appState.customProfiles.filter((item) => item.id !== profile.id && item.label !== profile.label)
  ];
  appState.activeProfileId = profile.id;
  renderProfiles();
  renderDocument();
  debouncePersist();
  setPanelFeedback(elements.settingsFeedback, "");
  setPanelFeedback(elements.profileFeedback, `Profil enregistré : ${profile.label}.`);
  elements.statusLine.textContent = `Profil personnalisé enregistré : ${profile.label}.`;
}

function deleteCurrentProfile() {
  const profile = appState.customProfiles.find((item) => item.id === appState.activeProfileId);
  if (!profile) {
    return;
  }

  appState.customProfiles = appState.customProfiles.filter((item) => item.id !== profile.id);
  appState.activeProfileId = appState.builtinProfiles[0].id;
  appState.preferences = buildProfilePreferences(appState.builtinProfiles[0]);
  syncControlsWithState();
  renderProfiles();
  renderDocument();
  debouncePersist();
  setPanelFeedback(elements.settingsFeedback, "");
  setPanelFeedback(elements.profileFeedback, `Profil supprimé : ${profile.label}.`);
  elements.statusLine.textContent = `Profil personnalisé supprimé : ${profile.label}.`;
}

function resetCurrentSettings() {
  const activeProfile = findProfile(appState.activeProfileId);
  if (!activeProfile) {
    return;
  }

  appState.preferences = buildProfilePreferences(activeProfile);
  syncControlsWithState();
  renderDocument();
  debouncePersist();
  setPanelFeedback(elements.profileFeedback, "");
  setPanelFeedback(elements.settingsFeedback, `Réglages restaurés depuis ${activeProfile.label}.`);
  elements.statusLine.textContent = "Réglages réinitialisés à partir du profil actif.";
}

function setVoices() {
  const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  appState.voices = voices;
  appState.speechAvailable = voices.length > 0;

  if (!appState.speechAvailable) {
    elements.voiceSelect.disabled = true;
    syncQuickActionButtons();
    elements.statusLine.textContent = "Aucune voix système détectée. La lecture audio reste désactivée.";
    return;
  }

  elements.voiceSelect.disabled = false;
  const currentValue = appState.preferences.speechVoiceId;
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Voix système par défaut";
  const voiceOptions = voices.map((voice) => {
    const option = document.createElement("option");
    option.value = voice.voiceURI;
    option.textContent = `${voice.name} - ${voice.lang}${voice.default ? " - par défaut" : ""}`;
    return option;
  });
  elements.voiceSelect.replaceChildren(defaultOption, ...voiceOptions);
  if (voices.some((voice) => voice.voiceURI === currentValue)) {
    elements.voiceSelect.value = currentValue;
  } else {
    elements.voiceSelect.value = "";
    appState.preferences.speechVoiceId = "";
  }
  audioEngine.setVoice(appState.preferences.speechVoiceId);
  audioEngine.setRate(appState.preferences.speechRate);
  audioEngine.setPauseBetweenSentences(appState.preferences.pauseBetweenSentences || 0);
  syncQuickActionButtons();
}

function buildSpeechQueue() {
  const queue = [];
  if (!appState.importedDocument || appState.importedDocument.extractionQuality === "poor") {
    return queue;
  }

  const blocks = getNavigableBlocks();
  const startIndex = Math.max(
    0,
    blocks.findIndex((block) => block.dataset.blockKey === appState.selectedBlockKey)
  );

  for (let index = startIndex; index < blocks.length; index += 1) {
    queue.push({
      key: blocks[index].dataset.blockKey,
      text: blocks[index].dataset.speechText || blocks[index].textContent || ""
    });
  }

  return queue.filter((item) => item.text.trim().length > 0);
}

function stopSpeech({ silent = false } = {}) {
  if (!window.speechSynthesis) {
    return;
  }
  audioEngine.stop();
  appState.speaking = false;
  appState.audioPaused = false;
  appState.audioResumeOverride = null;
  appState.speechQueue = [];
  appState.speechUtterance = null;
  updateDocumentMeta();
  syncQuickActionButtons();
  clearAudioHighlights();
  if (silent) {
    return;
  }
  elements.statusLine.textContent = "Lecture audio arrêtée.";
}

function playNextUtterance() {
  if (!window.speechSynthesis || appState.speechQueue.length === 0) {
    appState.speaking = false;
    elements.speechToggleButton.textContent = "Lire";
    updateDocumentMeta();
    syncQuickActionButtons();
    elements.statusLine.textContent = "Lecture audio terminée.";
    return;
  }

  const next = appState.speechQueue.shift();
  setSelectedBlock(next.key, { scroll: true });
  const utterance = new SpeechSynthesisUtterance(next.text);
  utterance.rate = mapUiSpeechRate(appState.preferences.speechRate);
  const selectedVoice = appState.voices.find((voice) => voice.voiceURI === appState.preferences.speechVoiceId);
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }
  utterance.onend = () => playNextUtterance();
  utterance.onerror = () => {
    elements.statusLine.textContent = "La synthèse vocale a rencontré un problème.";
    stopSpeech();
  };
  appState.speechUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

function legacyToggleSpeech() {
  if (!appState.speechAvailable) {
    elements.statusLine.textContent = "Aucune voix système disponible pour la lecture audio.";
    return;
  }

  if (appState.speaking) {
    stopSpeech();
    return;
  }

  appState.speechQueue = buildSpeechQueue();
  if (appState.speechQueue.length === 0) {
    elements.statusLine.textContent = "Aucun bloc lisible n'est disponible dans ce document.";
    return;
  }

  appState.speaking = true;
  elements.speechToggleButton.textContent = "Lecture en cours";
  updateDocumentMeta();
  syncQuickActionButtons();
  elements.statusLine.textContent = "Lecture audio en cours...";
  playNextUtterance();
}

function pauseSpeech() {
  if (!appState.speaking) {
    return;
  }

  audioEngine.pause();
  appState.audioPaused = true;
  updateDocumentMeta();
  syncQuickActionButtons();
  elements.statusLine.textContent = "Lecture audio en pause.";
}

function startAudioPlayback(startContext) {
  if (!appState.speechAvailable) {
    elements.statusLine.textContent = "Aucune voix système disponible pour la lecture audio.";
    return false;
  }

  const blocks = getNavigableBlocks();
  if (blocks.length === 0) {
    elements.statusLine.textContent = "Aucun bloc lisible n'est disponible dans ce document.";
    return false;
  }

  const context = startContext || getAudioStartContext();
  if (!context?.startKey) {
    elements.statusLine.textContent = "Sélectionne un bloc ou un passage lisible pour démarrer la lecture audio.";
    return false;
  }

  if (appState.speaking || appState.audioPaused) {
    stopSpeech({ silent: true });
  }

  appState.audioResumeOverride = null;

  audioEngine.setVoice(appState.preferences.speechVoiceId);
  audioEngine.setRate(appState.preferences.speechRate);
  audioEngine.setPauseBetweenSentences(appState.preferences.pauseBetweenSentences || 0);
  setSelectedBlock(context.startKey, { scroll: true });

  audioEngine.loadFromBlocks(blocks, {
    startKey: context.startKey,
    startSentenceIndex: context.startSentenceIndex || 0,
    onBlockStart: ({ blockKey }) => {
      setSelectedBlock(blockKey, { scroll: true });
      syncReadingGuide({ alignToSelection: true });
    },
    onSentenceStart: ({ blockKey, sentenceIndex }) => {
      highlightAudioSentence(blockKey, sentenceIndex);
    },
    onWordBoundary: ({ blockKey, sentenceIndex, wordIndex }) => {
      highlightAudioWord(blockKey, sentenceIndex, wordIndex);
    },
    onEnd: () => {
      appState.speaking = false;
      appState.audioPaused = false;
      updateDocumentMeta();
      syncQuickActionButtons();
      clearAudioHighlights();
      elements.statusLine.textContent = "Lecture audio terminée.";
    },
    onError: () => {
      elements.statusLine.textContent = "La synthèse vocale a rencontré un problème.";
      stopSpeech({ silent: true });
    }
  });

  if (!audioEngine.play()) {
    elements.statusLine.textContent = "Impossible de lancer la lecture audio pour ce document.";
    return false;
  }

  appState.speaking = true;
  appState.audioPaused = false;
  updateDocumentMeta();
  syncQuickActionButtons();
  elements.statusLine.textContent =
    context.source === "selection"
      ? "Lecture audio démarrée à partir de la sélection."
      : "Lecture audio démarrée à partir du bloc sélectionné.";
  return true;
}

function startSelectionSpeech() {
  const startContext = getAudioStartContext({ preferSelection: true, requireSelection: true });
  if (!startContext) {
    elements.statusLine.textContent = "Sélectionne d'abord un passage dans la zone de lecture.";
    return;
  }

  startAudioPlayback(startContext);
}

function toggleSpeech() {
  if (!appState.speechAvailable) {
    elements.statusLine.textContent = "Aucune voix système disponible pour la lecture audio.";
    return;
  }

  if (appState.speaking && !appState.audioPaused) {
    pauseSpeech();
    return;
  }

  if (appState.audioPaused) {
    if (appState.audioResumeOverride?.startKey) {
      startAudioPlayback(appState.audioResumeOverride);
      return;
    }

    if (!audioEngine.play()) {
      elements.statusLine.textContent = "Impossible de reprendre la lecture audio.";
      return;
    }
    appState.speaking = true;
    appState.audioPaused = false;
    updateDocumentMeta();
    syncQuickActionButtons();
    elements.statusLine.textContent = "Lecture audio reprise.";
    return;
  }

  startAudioPlayback(getAudioStartContext({ preferSelection: false }));
}

function playPreviousSentence() {
  if (!appState.speaking && !appState.audioPaused) {
    startAudioPlayback(getAudioStartContext({ preferSelection: false }));
    return;
  }

  appState.speaking = true;
  appState.audioPaused = false;
  audioEngine.prevSentence();
  updateDocumentMeta();
  syncQuickActionButtons();
  elements.statusLine.textContent = "Phrase précédente.";
}

function playNextSentence() {
  if (!appState.speaking && !appState.audioPaused) {
    startAudioPlayback(getAudioStartContext({ preferSelection: false }));
    return;
  }

  appState.speaking = true;
  appState.audioPaused = false;
  audioEngine.nextSentence();
  updateDocumentMeta();
  syncQuickActionButtons();
  elements.statusLine.textContent = "Phrase suivante.";
}

function bindControls() {
  Object.entries(controls).forEach(([key, control]) => {
    if (!control) {
      return;
    }
    control.addEventListener("input", () => {
      const rawValue = control.value;
      const value =
        [
          "fontFamily",
          "appTheme",
          "theme",
          "highlightMode",
          "focusMode",
          "readingGuideMode",
          "readingGuideColor",
          "overlayPreset",
          "overlayCustomColor",
          "colorationMode",
          "syllableLevel",
          "soundColorMode",
          "syllableBreakMode",
          "verificationMode",
          "pauseBetweenSentences",
          "speechVoiceId",
          "ocrLanguage"
        ].includes(key)
          ? rawValue
          : Number(rawValue);

      if (key === "focusMode" && value === "ruler") {
        appState.preferences.focusMode = "none";
        appState.preferences.readingGuideMode = "ruler";
      } else {
        appState.preferences[key] = value;
      }
      const output = document.querySelector(`[data-output-for="${key}"]`);
      if (output) {
        output.textContent = formatOutputValue(key, value);
      }
      setPanelFeedback(elements.settingsFeedback, "");
      if (key === "speechVoiceId") {
        audioEngine.setVoice(appState.preferences.speechVoiceId);
      }
      if (key === "speechRate") {
        audioEngine.setRate(appState.preferences.speechRate);
      }
      if (key === "pauseBetweenSentences") {
        audioEngine.setPauseBetweenSentences(appState.preferences.pauseBetweenSentences);
      }
      updateLayoutVariables();
      renderDocument();
      ariaManager.refreshSliderValues();
      debouncePersist();
    });
  });
}

function registerProfileEvents() {
  document.addEventListener("click", (event) => {
    const profileButton = event.target.closest("[data-profile-id]");
    if (!profileButton) {
      return;
    }
    const profile = findProfile(profileButton.dataset.profileId);
    if (!profile) {
      return;
    }
    activateProfile(profile.id, {
      statusMessage: `Profil actif : ${profile.label}.`
    });
  });
}

function bindReadingInteractions() {
  const updateGuideFromPointer = (clientY) => {
    const guideMode = normalizeReadingGuideMode(appState.preferences.readingGuideMode, appState.preferences.focusMode);
    if (guideMode === "off") {
      return;
    }

    const bounds = elements.readArea.getBoundingClientRect();
    const lineHeight = Math.max(getCurrentReaderLineHeightPx(), 1);
    const guideHeight = lineHeight * Math.max(Number(appState.preferences.readingGuideLines) || 1, 1);
    appState.rulerY = clientY - bounds.top;
    const relativeY = appState.rulerY + elements.readArea.scrollTop;
    readingGuide.moveToContentTop(relativeY - guideHeight / 2);
  };

  elements.pageList.addEventListener("click", (event) => {
    const block = event.target.closest(".reader-block");
    if (!block) {
      return;
    }
    setSelectedBlock(block.dataset.blockKey, { scroll: false });
    if (appState.speechAvailable && appState.audioPaused && block.dataset.blockKey !== getCurrentAudioBlockKey()) {
      setAudioResumeOverride({
        startKey: block.dataset.blockKey,
        startSentenceIndex: 0,
        source: "block"
      });
      elements.statusLine.textContent =
        "Paragraphe choisi. Utilise Lire ici pour repartir depuis ce passage.";
    } else if (appState.speechAvailable) {
      if (!appState.audioPaused || block.dataset.blockKey === getCurrentAudioBlockKey()) {
        setAudioResumeOverride(null);
      }
      elements.statusLine.textContent =
        "Bloc sélectionné. Utilise Lire pour commencer ici, ou sélectionne un passage pour lire seulement cet extrait.";
    }
  });

  elements.pageList.addEventListener("focusin", (event) => {
    const block = event.target.closest(".reader-block");
    if (!block) {
      return;
    }
    setSelectedBlock(block.dataset.blockKey, { scroll: false });
    if (appState.speechAvailable && appState.audioPaused && block.dataset.blockKey !== getCurrentAudioBlockKey()) {
      setAudioResumeOverride({
        startKey: block.dataset.blockKey,
        startSentenceIndex: 0,
        source: "block"
      });
    } else if (!appState.audioPaused || block.dataset.blockKey === getCurrentAudioBlockKey()) {
      setAudioResumeOverride(null);
    }
  });

  elements.pageList.addEventListener("keydown", (event) => {
    const block = event.target.closest(".reader-block");
    if (!block || !appState.speechAvailable) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    setSelectedBlock(block.dataset.blockKey, { scroll: false });
    startAudioPlayback(getAudioStartContext({ preferSelection: false }));
  });

  elements.readArea.addEventListener("pointerenter", (event) => updateGuideFromPointer(event.clientY));
  elements.readArea.addEventListener("pointermove", (event) => updateGuideFromPointer(event.clientY));

  elements.readArea.addEventListener("scroll", () => {
    const guideMode = normalizeReadingGuideMode(appState.preferences.readingGuideMode, appState.preferences.focusMode);
    if (guideMode === "off" || appState.rulerY == null) {
      return;
    }

    const lineHeight = Math.max(getCurrentReaderLineHeightPx(), 1);
    const guideHeight = lineHeight * Math.max(Number(appState.preferences.readingGuideLines) || 1, 1);
    const relativeY = appState.rulerY + elements.readArea.scrollTop;
    readingGuide.moveToContentTop(relativeY - guideHeight / 2);
  });

  elements.readArea.addEventListener("mouseleave", () => {
    appState.rulerY = null;
    syncReadingGuide();
  });

  document.addEventListener("selectionchange", handleSelectionChange);
}

function bindTopLevelActions() {
  elements.openButton.addEventListener("click", handlePdfOpen);
  elements.emptyOpenButton.addEventListener("click", handlePdfOpen);
  elements.openHeaderButton.addEventListener("click", handlePdfOpen);
  elements.toggleSidebarButton.addEventListener("click", toggleSettings);
  elements.floatingSidebarButton.addEventListener("click", toggleSettings);
  elements.printButton.addEventListener("click", handlePrint);
  elements.exportPdfButton.addEventListener("click", handleExportAdaptedPdf);
  elements.saveProfileButton.addEventListener("click", saveCurrentProfile);
  elements.deleteProfileButton.addEventListener("click", deleteCurrentProfile);
  elements.resetSettingsButton.addEventListener("click", resetCurrentSettings);
  elements.profileSummaryButton?.addEventListener("click", openProfileSummaryDialog);
  elements.profileNameInput.addEventListener("input", () => {
    setPanelFeedback(elements.profileFeedback, "");
  });
  elements.immersionButton.addEventListener("click", toggleImmersion);
  elements.speechToggleButton.addEventListener("click", toggleSpeech);
  elements.speechStopButton.addEventListener("click", () => stopSpeech());
  elements.speechPrevButton.addEventListener("click", playPreviousSentence);
  elements.speechNextButton.addEventListener("click", playNextSentence);
  elements.openExternalButton.addEventListener("click", async () => {
    await runtimeApi.openPath(appState.importedDocument?.filePath || "");
  });
  elements.bookmarkQuickButton?.addEventListener("click", quickBookmark);
  elements.exportNotesButton?.addEventListener("click", handleExportNotes);
  elements.startOcrButton?.addEventListener("click", handleStartOcr);
  elements.cancelOcrButton?.addEventListener("click", handleCancelOcr);
  elements.bookmarksList?.addEventListener("click", (event) => {
    const bookmarkButton = event.target.closest("[data-bookmark-key]");
    if (!bookmarkButton) {
      return;
    }

    setSelectedBlock(bookmarkButton.dataset.bookmarkKey, { scroll: true });
    elements.pageList.querySelector(`[data-block-key="${bookmarkButton.dataset.bookmarkKey}"]`)?.focus({
      preventScroll: true
    });
    elements.statusLine.textContent = "Marque-page ouvert dans la zone de lecture.";
  });
  elements.annotationsList?.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-annotation-id]");
    if (removeButton) {
      deleteAnnotation(removeButton.dataset.removeAnnotationId);
      return;
    }

    const annotationButton = event.target.closest("[data-annotation-id]");
    if (!annotationButton) {
      return;
    }

    setSelectedBlock(annotationButton.dataset.blockKey, { scroll: true });
    elements.pageList.querySelector(`[data-block-key="${annotationButton.dataset.blockKey}"]`)?.focus({
      preventScroll: true
    });
    elements.statusLine.textContent = "Passage surligné ouvert dans la zone de lecture.";
  });
  elements.selectionAssist?.addEventListener("click", (event) => {
    const colorButton = event.target.closest("[data-annotation-color]");
    if (colorButton) {
      addAnnotation(colorButton.dataset.annotationColor);
      return;
    }

    if (event.target === elements.selectionSpeechButton) {
      startSelectionSpeech();
      return;
    }

    if (event.target === elements.clearSelectionAssistButton) {
      window.getSelection?.()?.removeAllRanges?.();
      clearSelectionAssist();
    }
  });
  elements.supportDialogButton?.addEventListener("click", () => {
    void openProjectSupportPage();
  });
  elements.profileSummaryDialog?.addEventListener("click", (event) => {
    if (event.target === elements.profileSummaryDialog) {
      closeProfileSummaryDialog();
    }
  });
  elements.profileSummaryDialog?.addEventListener("close", () => {
    elements.profileSummaryButton?.focus({ preventScroll: true });
  });
}

function init() {
  fillStaticControls();
  applyControlHelp();
  loadPersistedState()
    .then(() => {
      syncControlsWithState();
      applyAppTheme();
      applyTheme();
      renderProfiles();
      renderRecentFiles();
      renderDocument();
      renderProfileSummaryDialog();
      audioEngine.init(elements.pageList);
      bindControls();
      bindTopLevelActions();
      bindRuntimeApiEvents();
      bindReadingInteractions();
      registerProfileEvents();
      ariaManager.init({ controls, elements });
      keyboardNav.init({
        openPdf: handlePdfOpen,
        toggleImmersion,
        exitImmersion,
        toggleSettings,
        printAdapted: handlePrint,
        quickBookmark,
        activateProfileByShortcut,
        adjustZoom,
        toggleSpeech,
        moveGuideOrSelection,
        movePage,
        moveAudioCursor,
        isReadingTarget
      });
      pwaManager?.init({
        installButton: elements.installPwaButton,
        statusLine: elements.statusLine
      });
      setVoices();
      window.speechSynthesis?.addEventListener?.("voiceschanged", setVoices);
      window.addEventListener("beforeunload", () => {
        document.removeEventListener("selectionchange", handleSelectionChange);
        audioEngine.stop();
        ocrEngine.terminate();
        readingGuide.destroy();
        keyboardNav.destroy();
        ariaManager.destroy();
        runtimeSubscriptions.splice(0).forEach((unsubscribe) => unsubscribe?.());
      });
      elements.statusLine.textContent =
        runtimeApi.kind === "electron"
          ? "Application prête. Importe un PDF texte pour commencer."
          : "Application prête dans le navigateur. Ouvre un PDF texte pour commencer.";
    })
    .catch((error) => {
      console.error(error);
      elements.statusLine.textContent = "L'application a démarré avec une configuration partielle.";
    });
}

window.addEventListener("load", hideStartupSplash, { once: true });

init();

