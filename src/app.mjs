import { APP_THEME_TOKENS, BUILTIN_PROFILES, DEFAULT_PREFERENCES, FONT_OPTIONS, THEME_TOKENS } from "./profiles.mjs";
import { importPdfFromBytes } from "./pdf-processing.mjs";
import { buildDocumentStorageKey } from "./core/document/document-storage-key.mjs";
import {
  getBlockAnnotations,
  normalizeAnnotations,
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
import { analyzeMathContent, renderMathText, verbalizeMathText } from "./core/reading/math-support.mjs";
import {
  DEFAULT_LOCAL_AI_MODEL,
  LOCAL_AI_INSTALL_URL,
  buildLocalAiDefinitionRequest,
  buildLocalAiDocumentQuestionRequest,
  buildLocalAiInstructionRequest,
  buildLocalAiSchoolReformulationRequest,
  buildLocalAiSchoolSummaryRequest,
  cleanLocalAiText,
  normalizeLocalAiMode,
  normalizeLocalAiModel
} from "./core/ai/local-llm.mjs";
import {
  buildInstructionBreakdown,
  buildLocalWordInsight,
  buildSchoolReformulation,
  buildSchoolSummary,
  buildShortSummary,
  buildSimpleReformulation,
  detectInstructionStructure,
  getSchoolLevelLabel,
  lookupWordInsight,
  normalizeSchoolLevel,
  sanitizeLookupWord
} from "./core/reading/reading-assist.mjs";
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
  annotationsByDocument: {},
  teacherNotesByDocument: {},
  voices: [],
  voiceRefreshTimerId: 0,
  voiceRefreshAttempts: 0,
  nativeVoices: [],
  speechAvailable: false,
  speechUtterance: null,
  speechQueue: [],
  speaking: false,
  audioPaused: false,
  pendingAudioRestartTimerId: 0,
  audioResumeOverride: null,
  preferredAudioStartContext: null,
  currentAudioBlockKey: "",
  currentSentenceIndex: -1,
  currentWordIndex: -1,
  ocrState: {
    running: false,
    progress: 0,
    currentPage: 0,
    totalPages: 0,
    status: "OCR prêt."
  },
  overviewZoom: 100,
  rulerContentTop: null,
  rulerPointerClientX: null,
  rulerPointerClientY: null,
  rulerUpdateFrameId: 0,
  persistTimer: null,
  annotations: [],
  teacherNotes: "",
  selectionDraft: null,
  currentWordInsight: null,
  currentWordSelection: null,
  currentWordLookupId: 0,
  selectionChangeFrameId: 0,
  readerPointerState: {
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    drag: false,
    suppressNextClick: false
  },
  localAiStatus: {
    available: false,
    modelAvailable: false,
    provider: "ollama",
    selectedModel: DEFAULT_LOCAL_AI_MODEL,
    installedModels: [],
    checkedAt: "",
    busy: false,
    message: "IA locale non vérifiée pour le moment."
  },
  localAiCache: new Map(),
  examBaseMinutes: 60,
  examTimeRemainingSeconds: 0,
  examTimerId: 0,
  examTimerRunning: false,
  activeRibbonTab: ""
};

const TEMP_CUSTOM_PROFILE_ID = "custom-live";

const elements = {
  ribbonShell: document.querySelector(".app-ribbon-shell"),
  ribbonTabs: Array.from(document.querySelectorAll("[data-ribbon-tab]")),
  ribbonPanels: Array.from(document.querySelectorAll("[data-ribbon-panel]")),
  openButton: document.querySelector("#openPdfButton"),
  emptyOpenButton: document.querySelector("#emptyOpenButton"),
  openHeaderButton: document.querySelector("#openHeaderButton"),
  toggleSidebarButton: document.querySelector("#toggleSidebarButton"),
  floatingSidebarButton: document.querySelector("#floatingSidebarButton"),
  quickActionDock: document.querySelector("#quickActionDock"),
  quickActionHint: document.querySelector("#quickActionHint"),
  quickOverviewButton: document.querySelector("#quickOverviewButton"),
  quickReadButton: document.querySelector("#quickReadButton"),
  quickStopButton: document.querySelector("#quickStopButton"),
  quickAidButton: document.querySelector("#quickAidButton"),
  quickSettingsButton: document.querySelector("#quickSettingsButton"),
  printButton: document.querySelector("#printButton"),
  exportPdfButton: document.querySelector("#exportPdfButton"),
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
  customProfilesList: document.querySelector("#customProfilesList"),
  profileSummaryButton: document.querySelector("#profileSummaryButton"),
  profileSummaryDialog: document.querySelector("#profileSummaryDialog"),
  closeProfileSummaryDialogButton: document.querySelector("#closeProfileSummaryDialogButton"),
  profileSummaryTable: document.querySelector("#profileSummaryTable"),
  teacherModeSummary: document.querySelector("#teacherModeSummary"),
  teacherCompareButton: document.querySelector("#teacherCompareButton"),
  teacherExportButton: document.querySelector("#teacherExportButton"),
  teacherNotesInput: document.querySelector("#teacherNotesInput"),
  teacherCompareDialog: document.querySelector("#teacherCompareDialog"),
  closeTeacherCompareDialogButton: document.querySelector("#closeTeacherCompareDialogButton"),
  teacherCompareMeta: document.querySelector("#teacherCompareMeta"),
  teacherCompareRaw: document.querySelector("#teacherCompareRaw"),
  teacherCompareAdapted: document.querySelector("#teacherCompareAdapted"),
  profileNameInput: document.querySelector("#customProfileName"),
  saveProfileButton: document.querySelector("#saveProfileButton"),
  deleteProfileButton: document.querySelector("#deleteProfileButton"),
  profileFeedback: document.querySelector("#profileFeedback"),
  settingsProfileHint: document.querySelector("#settingsProfileHint"),
  immersionButton: document.querySelector("#immersionButton"),
  resetSettingsButton: document.querySelector("#resetSettingsButton"),
  settingsFeedback: document.querySelector("#settingsFeedback"),
  dysEssentialsSummary: document.querySelector("#dysEssentialsSummary"),
  speechToggleButton: document.querySelector("#speechToggleButton"),
  speechStopButton: document.querySelector("#speechStopButton"),
  speechPrevButton: document.querySelector("#speechPrevButton"),
  speechNextButton: document.querySelector("#speechNextButton"),
  refreshVoicesButton: document.querySelector("#refreshVoicesButton"),
  wordInsightWord: document.querySelector("#wordInsightWord"),
  wordInsightSyllables: document.querySelector("#wordInsightSyllables"),
  wordInsightDefinition: document.querySelector("#wordInsightDefinition"),
  wordInsightSource: document.querySelector("#wordInsightSource"),
  wordInsightDomain: document.querySelector("#wordInsightDomain"),
  wordSpeakButton: document.querySelector("#wordSpeakButton"),
  refreshWordDefinitionButton: document.querySelector("#refreshWordDefinitionButton"),
  blockSummaryButton: document.querySelector("#blockSummaryButton"),
  blockReformulateButton: document.querySelector("#blockReformulateButton"),
  blockInstructionButton: document.querySelector("#blockInstructionButton"),
  blockAssistOutput: document.querySelector("#blockAssistOutput"),
  documentQuestionInput: document.querySelector("#documentQuestionInput"),
  documentQuestionButton: document.querySelector("#documentQuestionButton"),
  documentQuestionOutput: document.querySelector("#documentQuestionOutput"),
  localAiStatusText: document.querySelector("#localAiStatusText"),
  localAiCheckButton: document.querySelector("#localAiCheckButton"),
  localAiInstallButton: document.querySelector("#localAiInstallButton"),
  openExternalButton: document.querySelector("#openExternalButton"),
  examModeButton: document.querySelector("#examModeButton"),
  examPrintButton: document.querySelector("#examPrintButton"),
  examBaseMinutes: document.querySelector("#examBaseMinutes"),
  examThirdTimeOutput: document.querySelector("#examThirdTimeOutput"),
  examTimerDisplay: document.querySelector("#examTimerDisplay"),
  examToggleTimerButton: document.querySelector("#examToggleTimerButton"),
  examResetTimerButton: document.querySelector("#examResetTimerButton"),
  startOcrButton: document.querySelector("#startOcrButton"),
  cancelOcrButton: document.querySelector("#cancelOcrButton"),
  ocrProgress: document.querySelector("#ocrProgress"),
  ocrStatusText: document.querySelector("#ocrStatusText"),
  ocrProgressValue: document.querySelector("#ocrProgressValue"),
  ocrProgressBar: document.querySelector("#ocrProgressBar"),
  ocrHint: document.querySelector("#ocrHint"),
  supportDialogButton: document.querySelector("#supportDialogButton"),
  installPwaButton: document.querySelector("#installPwaButton"),
  voiceSelect: document.querySelector("#speechVoiceId"),
  verificationSummary: document.querySelector("#verificationSummary"),
  startupSplash: document.querySelector("#startupSplash"),
  statusLine: document.querySelector("#statusLine"),
  keyboardHint: document.querySelector("#keyboardHint"),
  recentList: document.querySelector("#recentList"),
  selectionAssist: document.querySelector("#selectionAssist"),
  selectionPreview: document.querySelector("#selectionPreview"),
  selectionSpeechButton: document.querySelector("#selectionSpeechButton"),
  clearSelectionAssistButton: document.querySelector("#clearSelectionAssistButton"),
  documentOverviewDialog: document.querySelector("#documentOverviewDialog"),
  closeDocumentOverviewButton: document.querySelector("#closeDocumentOverviewButton"),
  documentOverviewMeta: document.querySelector("#documentOverviewMeta"),
  documentOverviewContent: document.querySelector("#documentOverviewContent"),
  overviewZoomOutButton: document.querySelector("#overviewZoomOutButton"),
  overviewZoomInButton: document.querySelector("#overviewZoomInButton"),
  overviewZoomRange: document.querySelector("#overviewZoomRange"),
  overviewZoomLabel: document.querySelector("#overviewZoomLabel")
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
  "assistSchoolLevel",
  "localAiMode",
  "localAiModel",
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
const audioEngine = new AudioEngine({
  nativeSpeech:
    typeof runtimeApi.speakNative === "function"
      ? {
          speak: runtimeApi.speakNative,
          stop: runtimeApi.stopNativeSpeech,
          onProgress: runtimeApi.onNativeSpeechProgress
        }
      : null,
  preferNativeSpeech: runtimeApi.kind === "electron"
});
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
    async getLocalAiStatus(model = DEFAULT_LOCAL_AI_MODEL) {
      return {
        ok: false,
        provider: "ollama",
        available: false,
        endpoint: "",
        selectedModel: normalizeLocalAiModel(model),
        suggestedModel: DEFAULT_LOCAL_AI_MODEL,
        modelAvailable: false,
        installedModels: [],
        reason: "LOCAL_AI_DESKTOP_ONLY"
      };
    },
    async generateLocalAiText() {
      return {
        ok: false,
        provider: "ollama",
        text: "",
        reason: "LOCAL_AI_DESKTOP_ONLY"
      };
    },
    async speakNative() {
      return {
        ok: false,
        reason: "NATIVE_SPEECH_DESKTOP_ONLY"
      };
    },
    async stopNativeSpeech() {
      return { ok: true };
    },
    async getNativeVoices() {
      return {
        ok: false,
        voices: [],
        reason: "NATIVE_VOICES_DESKTOP_ONLY"
      };
    },
    onNativeSpeechProgress() {
      return () => {};
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

const SIMPLIFIED_SYLLABLE_MODE = "pedagogique";
const SIMPLIFIED_SYLLABLE_SCOPE = "auto";

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
  overlayCustomColor: "Choisir une couleur ici bascule automatiquement le filtre en mode personnalisé.",
  highlightMode: "Définit la force du repère sur le bloc en cours de lecture.",
  focusMode: "Assombrit légèrement le reste du texte pour aider à rester sur le paragraphe actif.",
  readingGuideMode: "Affiche une réglette ou une fenêtre de lecture qui suit le texte pour garder la ligne.",
  readingGuideLines: "Définit le nombre de lignes visibles dans la réglette ou la fenêtre.",
  readingGuideOpacity: "Règle la force visuelle de la réglette pour qu'elle reste utile sans gêner.",
  readingGuideColor: "Choisit la couleur du contour de la réglette.",
  colorationMode:
    "Choisis une seule aide principale pour le texte : dys, sons français, lignes, mots ou noir et blanc.",
  syllableLevel:
    "Ajoute ou retire la séparation syllabique normale. Garde-la désactivée si le texte devient trop chargé.",
  soundColorMode:
    "Change le style uniquement quand l'aide principale est Sons français.",
  syllableBreakMode:
    "Choisis le signe visible entre les syllabes : rien, point ou tiret.",
  verificationMode: "Aide à relire les passages potentiellement fragiles : maths, OCR incertain, tableaux ou blocs complexes.",
  speechVoiceId: "Choisit la voix système utilisée pour la lecture audio.",
  speechRate: "Règle la vitesse réelle de lecture audio. La valeur de base a été ralentie pour être plus confortable.",
  pauseBetweenSentences: "Ajoute une petite pause entre les phrases pour laisser le temps de suivre.",
  assistSchoolLevel:
    "Choisit le niveau utilisé pour les résumés, reformulations, consignes et réponses de l'IA.",
  localAiMode:
    "Choisit si l'IA locale Gemma est désactivée, utilisée seulement à la demande, ou privilégiée automatiquement quand elle est disponible.",
  localAiModel:
    "Choisit le modèle local à utiliser avec Ollama. Gemma 3 4B est le meilleur compromis pour un usage quotidien.",
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

function isTemporaryCustomProfile(profile) {
  return Boolean(profile?.temporary) && profile.id === TEMP_CUSTOM_PROFILE_ID;
}

function getCustomizationSourceProfile(profile) {
  if (!profile) {
    return appState.builtinProfiles[0];
  }

  if (profile.sourceProfileId) {
    return findProfile(profile.sourceProfileId) || appState.builtinProfiles[0];
  }

  return profile;
}

function buildTemporaryCustomProfile(sourceProfile) {
  const safeSourceProfile = sourceProfile || appState.builtinProfiles[0];
  const sourceLabel = repairUiText(safeSourceProfile.label || "profil actuel");
  return {
    id: TEMP_CUSTOM_PROFILE_ID,
    label: "Réglages personnalisés",
    description: `Version ajustable librement à partir de ${sourceLabel}.`,
    editable: true,
    temporary: true,
    sourceProfileId: safeSourceProfile.id,
    researchNotes: `Tu es sur une version personnalisée du profil ${sourceLabel}. Continue à ajuster les réglages librement, puis enregistre ce profil si tu veux le garder.`,
    defaults: { ...appState.preferences }
  };
}

function upsertCustomProfile(profile) {
  appState.customProfiles = [profile, ...appState.customProfiles.filter((item) => item.id !== profile.id)];
}

function syncActiveEditableProfile({ announce = false } = {}) {
  const activeProfile = findProfile(appState.activeProfileId);
  if (!activeProfile) {
    return false;
  }

  if (isCustomProfile(activeProfile.id)) {
    const nextProfile = isTemporaryCustomProfile(activeProfile)
      ? buildTemporaryCustomProfile(getCustomizationSourceProfile(activeProfile))
      : {
          ...activeProfile,
          defaults: { ...appState.preferences }
        };
    upsertCustomProfile(nextProfile);
    return false;
  }

  const draftProfile = buildTemporaryCustomProfile(activeProfile);
  upsertCustomProfile(draftProfile);
  appState.activeProfileId = draftProfile.id;
  renderProfiles();

  if (announce) {
    setPanelFeedback(
      elements.profileFeedback,
      `Réglages personnalisés actifs à partir de ${repairUiText(activeProfile.label)}.`
    );
    elements.statusLine.textContent =
      "Tu ajustes maintenant un profil personnalisé. Enregistre-le si tu veux le garder.";
  }

  return true;
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

function enforceSimplifiedSyllablePreferences(preferences) {
  if (!preferences || typeof preferences !== "object") {
    return preferences;
  }

  preferences.syllabificationMode = SIMPLIFIED_SYLLABLE_MODE;
  preferences.syllableWordScope = SIMPLIFIED_SYLLABLE_SCOPE;
  return preferences;
}

function getLocalAiModeLabel(mode) {
  switch (normalizeLocalAiMode(mode)) {
    case "prefer-local":
      return "Gemma prioritaire";
    case "on-demand":
      return "Gemma à la demande";
    default:
      return "IA locale désactivée";
  }
}

function describeProfileDecoding(preferences) {
  const parts = [];
  const colorationMode = normalizeColorationPreference(preferences.colorationMode);
  const syllableLevel = normalizeSyllableLevel(preferences.syllableLevel);
  const usesSyllableStructure = isPedagogicColorationMode(colorationMode) || syllableLevel !== "off";

  if (colorationMode === "sonsFrancais") {
    const toneLabel =
      preferences.soundColorMode === "strong"
        ? "nets"
        : preferences.soundColorMode === "vivid"
          ? "très contrastés"
          : preferences.soundColorMode === "monoStrong"
            ? "noir et blanc fort"
            : preferences.soundColorMode === "mono"
              ? "noir et blanc doux"
              : "doux";
    parts.push(`sons français (${toneLabel})`);
  } else if (colorationMode === "pedagogique") {
    parts.push("coloration douce");
  } else if (colorationMode === "pedagogiqueAlt") {
    parts.push("coloration alternative");
  } else if (colorationMode === "pedagogiqueContrast") {
    parts.push("coloration dys accentuée");
  } else if (colorationMode === "alternanceLignes") {
    parts.push("alternance par ligne");
  } else if (colorationMode === "alternanceMots") {
    parts.push("alternance par mot");
  } else if (colorationMode === "noirEtBlanc") {
    parts.push("noir et blanc");
  }

  if (syllableLevel === "light") {
    parts.push("séparation syllabique légère");
  } else if (syllableLevel === "strong") {
    parts.push("séparation syllabique renforcée");
  }

  if (usesSyllableStructure && isPedagogicColorationMode(colorationMode) && syllableLevel === "off") {
    parts.push("séparation syllabique intégrée");
  }

  if (usesSyllableStructure && preferences.syllableBreakMode === "dot") {
    parts.push("point médian");
  } else if (usesSyllableStructure && preferences.syllableBreakMode === "hyphen") {
    parts.push("tiret discret");
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
    case "decodage-renforce":
      return "Pour une base dys avec alternance par ligne, colonne resserrée et repères stables.";
    case "audio":
      return "Pour suivre le texte avec la voix et mieux rester concentré pendant la lecture.";
    case "dyscalculie":
      return "Pour des documents avec nombres, calculs ou expressions mathématiques à surveiller.";
    case "dyspraxie":
      return "Pour une lecture stable et des repères simples quand la fatigue motrice est importante.";
    case "mode-examen":
      return "Pour une passation très sobre, avec confort de lecture, tiers-temps et impression propre.";
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
      const label = repairUiText(profile.label);
      const description = repairUiText(profile.description || "");
      return `
        <tr>
          <td><span class="profile-summary-kind">Standard</span></td>
          <td>
            <strong>${escapeHtml(label)}</strong>
            ${escapeHtml(description)}
          </td>
          <td>${escapeHtml(getFontLabel(defaults.fontFamily))}</td>
          <td>${escapeHtml(`${defaults.fontSize}px`)}</td>
          <td>${escapeHtml(`interligne ${formatPercentUnit(defaults.lineHeight)} • lettres ${formatPercentUnit(defaults.letterSpacing)} • mots ${formatPercentUnit(defaults.wordSpacing)}`)}</td>
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
    speechRate: Number(appState.preferences.speechRate) || DEFAULT_PREFERENCES.speechRate,
    pauseBetweenSentences:
      Number(appState.preferences.pauseBetweenSentences) || DEFAULT_PREFERENCES.pauseBetweenSentences,
    localAiMode: normalizeLocalAiMode(appState.preferences.localAiMode),
    localAiModel: normalizeLocalAiModel(appState.preferences.localAiModel),
    assistSchoolLevel: normalizeSchoolLevel(appState.preferences.assistSchoolLevel)
  };

  const nextPreferences = {
    ...profile.defaults,
    colorationMode: normalizeColorationPreference(profile.defaults?.colorationMode),
    syllableLevel: normalizeSyllableLevel(profile.defaults?.syllableLevel),
    verificationMode: normalizeVerificationMode(profile.defaults?.verificationMode),
    readingGuideMode: normalizeReadingGuideMode(profile.defaults?.readingGuideMode, profile.defaults?.focusMode),
    ...preserved
  };
  enforceSimplifiedSyllablePreferences(nextPreferences);
  if (nextPreferences.focusMode === "ruler") {
    nextPreferences.focusMode = "none";
  }
  return nextPreferences;
}

function syncAudioPreferences() {
  audioEngine.setVoice(appState.preferences.speechVoiceId);
  audioEngine.setRate(appState.preferences.speechRate);
  audioEngine.setPauseBetweenSentences(appState.preferences.pauseBetweenSentences || 0);
}

function getAudioRecoveryContext() {
  return (
    normalizeAudioStartContext(appState.audioResumeOverride) ||
    getCurrentAudioContext() ||
    normalizeAudioStartContext(appState.preferredAudioStartContext) ||
    normalizeAudioStartContext(getAudioStartContext({ preferSelection: false }))
  );
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

  const wasPlaying = appState.speaking && !appState.audioPaused;
  const wasPaused = appState.audioPaused;
  const audioRecoveryContext = wasPlaying || wasPaused ? getAudioRecoveryContext() : null;

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

  if (wasPlaying && audioRecoveryContext?.startKey) {
    startAudioPlayback(audioRecoveryContext);
  } else if (wasPaused && audioRecoveryContext?.startKey) {
    setAudioResumeOverride(audioRecoveryContext);
    updateDocumentMeta();
    syncQuickActionButtons();
    if (statusMessage) {
      elements.statusLine.textContent = `${statusMessage} La lecture audio reprendra ici.`;
    }
    return true;
  } else if (statusMessage) {
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

function openTeacherCompareDialog() {
  if (!elements.teacherCompareDialog) {
    return;
  }

  renderTeacherCompareDialog();
  if (elements.teacherCompareDialog.open) {
    scheduleRenderedLinePatterns(elements.teacherCompareAdapted);
    return;
  }

  elements.teacherCompareDialog.showModal();
  scheduleRenderedLinePatterns(elements.teacherCompareAdapted);
  elements.closeTeacherCompareDialogButton?.focus();
}

function closeTeacherCompareDialog() {
  if (!elements.teacherCompareDialog?.open) {
    return;
  }

  elements.teacherCompareDialog.close();
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
        scienceBlockCount: 0,
        formulaBlockCount: 0,
        verificationBlockCount: 0,
        pagesWithMath: 0,
        pagesWithScience: 0,
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

function syncAnnotationsStorage() {
  if (!appState.currentPdfBlobUrl && !appState.importedDocument) {
    return;
  }

  const documentKey = buildDocumentStorageKey(appState.importedDocument);
  if (!documentKey) {
    return;
  }

  appState.annotationsByDocument[documentKey] = normalizeAnnotations(appState.annotations);
}

function syncTeacherNotesStorage() {
  if (!appState.currentPdfBlobUrl && !appState.importedDocument) {
    return;
  }

  const documentKey = buildDocumentStorageKey(appState.importedDocument);
  if (!documentKey) {
    return;
  }

  appState.teacherNotesByDocument[documentKey] = String(appState.teacherNotes || "").trim();
}

async function persistState() {
  syncAnnotationsStorage();
  syncTeacherNotesStorage();
  const payload = {
    savedProfiles: appState.customProfiles,
    lastUsedPreferences: getPersistablePreferences(),
      activeProfileId: appState.activeProfileId,
      recentFilesMeta: appState.recentFilesMeta.slice(0, 6),
      annotationsByDocument: appState.annotationsByDocument,
      teacherNotesByDocument: appState.teacherNotesByDocument,
      examBaseMinutes: appState.examBaseMinutes
  };
  await runtimeApi.saveSettings(payload);
}

async function loadPersistedState() {
  try {
    const payload = await runtimeApi.loadSettings();
    if (payload?.savedProfiles && Array.isArray(payload.savedProfiles)) {
      appState.customProfiles = payload.savedProfiles.map((profile) => ({
        ...profile,
        defaults: enforceSimplifiedSyllablePreferences({
          ...DEFAULT_PREFERENCES,
          ...profile.defaults,
          appTheme: normalizeAppTheme(profile.defaults?.appTheme),
          localAiMode: normalizeLocalAiMode(profile.defaults?.localAiMode),
          localAiModel: normalizeLocalAiModel(profile.defaults?.localAiModel),
          assistSchoolLevel: normalizeSchoolLevel(profile.defaults?.assistSchoolLevel),
          colorationMode: normalizeColorationPreference(profile.defaults?.colorationMode),
          syllableLevel: normalizeSyllableLevel(profile.defaults?.syllableLevel),
          verificationMode: normalizeVerificationMode(profile.defaults?.verificationMode),
          readingGuideMode: normalizeReadingGuideMode(profile.defaults?.readingGuideMode, profile.defaults?.focusMode)
        })
      }));
    }
    if (payload?.lastUsedPreferences) {
      appState.preferences = {
        ...DEFAULT_PREFERENCES,
        ...payload.lastUsedPreferences
      };
      enforceSimplifiedSyllablePreferences(appState.preferences);
      appState.preferences.appTheme = normalizeAppTheme(appState.preferences.appTheme);
      appState.preferences.localAiMode = normalizeLocalAiMode(appState.preferences.localAiMode);
      appState.preferences.localAiModel = normalizeLocalAiModel(appState.preferences.localAiModel);
      appState.preferences.assistSchoolLevel = normalizeSchoolLevel(appState.preferences.assistSchoolLevel);
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
    if (payload?.annotationsByDocument && typeof payload.annotationsByDocument === "object") {
      appState.annotationsByDocument = Object.fromEntries(
        Object.entries(payload.annotationsByDocument).map(([documentKey, entries]) => [
          documentKey,
          normalizeAnnotations(Array.isArray(entries) ? entries : [])
        ])
      );
    }
    if (payload?.teacherNotesByDocument && typeof payload.teacherNotesByDocument === "object") {
      appState.teacherNotesByDocument = Object.fromEntries(
        Object.entries(payload.teacherNotesByDocument).map(([documentKey, value]) => [documentKey, String(value || "")])
      );
    }
    if (payload?.examBaseMinutes) {
      appState.examBaseMinutes = Math.max(10, Number(payload.examBaseMinutes || 60));
    }
    if (payload?.activeProfileId) {
      const storedProfile = findProfile(payload.activeProfileId);
      if (storedProfile) {
        appState.activeProfileId = storedProfile.id;
      } else {
        const normalProfile = findProfile("normal") || appState.builtinProfiles[0];
        appState.activeProfileId = normalProfile.id;
        appState.preferences = buildProfilePreferences(normalProfile);
      }
    }
    if (shouldMigrateLegacyVisualProfile(appState.activeProfileId, appState.preferences)) {
      appState.preferences = migrateLegacyVisualProfilePreferences(appState.preferences);
    }
  } catch (error) {
    console.error("Impossible de charger les réglages locaux", error);
  }
}

function closeRibbonMenus({ focusTarget = null } = {}) {
  appState.activeRibbonTab = "";

  elements.ribbonTabs.forEach((button) => {
    button.classList.remove("is-active");
    button.setAttribute("aria-selected", "false");
    button.setAttribute("aria-expanded", "false");
    button.tabIndex = 0;
  });

  elements.ribbonPanels.forEach((panel) => {
    panel.classList.remove("is-active");
    panel.hidden = true;
    panel.style.removeProperty("left");
  });

  focusTarget?.focus?.();
}

function positionActiveRibbonPanel(tabId) {
  const panel = elements.ribbonPanels.find((candidate) => candidate.dataset.ribbonPanel === tabId);
  const button = elements.ribbonTabs.find((candidate) => candidate.dataset.ribbonTab === tabId);
  const shell = elements.ribbonShell;
  if (!panel || !button || !shell) {
    return;
  }

  const shellRect = shell.getBoundingClientRect();
  const buttonRect = button.getBoundingClientRect();
  const estimatedWidth = Math.min(500, window.innerWidth - 56);
  const maxLeft = Math.max(10, shell.clientWidth - estimatedWidth - 10);
  const nextLeft = Math.min(Math.max(10, buttonRect.left - shellRect.left - 8), maxLeft);
  panel.style.left = `${Math.round(nextLeft)}px`;
}

function setActiveRibbonTab(tabId, { focus = false, toggle = false } = {}) {
  const availableTabs = new Set(elements.ribbonTabs.map((button) => button.dataset.ribbonTab));
  if (!availableTabs.has(tabId)) {
    closeRibbonMenus();
    return;
  }

  if (toggle && appState.activeRibbonTab === tabId) {
    const button = elements.ribbonTabs.find((candidate) => candidate.dataset.ribbonTab === tabId) || null;
    closeRibbonMenus({ focusTarget: focus ? button : null });
    return;
  }

  appState.activeRibbonTab = tabId;

  elements.ribbonTabs.forEach((button) => {
    const isActive = button.dataset.ribbonTab === tabId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
    button.setAttribute("aria-expanded", isActive ? "true" : "false");
    button.tabIndex = 0;
    if (isActive && focus) {
      button.focus();
    }
  });

  elements.ribbonPanels.forEach((panel) => {
    const isActive = panel.dataset.ribbonPanel === tabId;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });

  positionActiveRibbonPanel(tabId);
}

function updateRibbonToggleUi() {
  const ribbonHidden = appState.preferences.distractionFree;
  if (elements.immersionButton) {
    elements.immersionButton.textContent = ribbonHidden ? "Quitter l'immersion" : "Mode immersion";
    elements.immersionButton.setAttribute("aria-pressed", ribbonHidden ? "true" : "false");
  }
  if (elements.toggleSidebarButton) {
    elements.toggleSidebarButton.textContent = ribbonHidden ? "Afficher le ruban" : "Réduire le ruban";
    elements.toggleSidebarButton.setAttribute("aria-pressed", ribbonHidden ? "true" : "false");
  }
  if (elements.floatingSidebarButton) {
    elements.floatingSidebarButton.hidden = !ribbonHidden;
    elements.floatingSidebarButton.setAttribute("aria-pressed", ribbonHidden ? "true" : "false");
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

  if (controls.localAiMode) {
    controls.localAiMode.innerHTML = [
      { value: "off", label: "Désactivée" },
      { value: "on-demand", label: "À la demande" },
      { value: "prefer-local", label: "Prioritaire" }
    ]
      .map((mode) => `<option value="${mode.value}">${mode.label}</option>`)
      .join("");
  }

  if (controls.localAiModel) {
    controls.localAiModel.innerHTML = [
      { value: "gemma3:1b", label: "Gemma 3 1B" },
      { value: "gemma3:4b", label: "Gemma 3 4B (recommandé)" }
    ]
      .map((model) => `<option value="${model.value}">${model.label}</option>`)
      .join("");
  }

  if (controls.assistSchoolLevel) {
    controls.assistSchoolLevel.innerHTML = [
      { value: "college", label: "Collège" },
      { value: "lycee", label: "Lycée" }
    ]
      .map((level) => `<option value="${level.value}">${level.label}</option>`)
      .join("");
  }
}

function formatFrenchNumber(value, digits = 0) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number(value) || 0);
}

function formatPercentUnit(value, digits = 0) {
  return `${formatFrenchNumber(Number(value) * 100, digits)} %`;
}

function formatOutputValue(key, value) {
  switch (key) {
    case "fontSize":
      return `${value} px`;
    case "lineHeight":
      return formatPercentUnit(value);
    case "letterSpacing":
    case "wordSpacing":
      return formatPercentUnit(value);
    case "maxLineLength":
      return `${value} caractères`;
    case "pagePadding":
      return `${value} px`;
    case "readingGuideMode":
      return value === "window" ? "Fenêtre" : value === "ruler" ? "Réglette" : "Désactivée";
    case "readingGuideLines":
      return `${value} ligne${Number(value) > 1 ? "s" : ""}`;
    case "readingGuideOpacity":
      return `${Math.round(Number(value) * 100)}%`;
    case "overlayOpacity":
      return `${Math.round(Number(value) * 100)}%`;
    case "soundColorMode":
      if (value === "strong") {
        return "Nettes";
      }
      if (value === "vivid") {
        return "Très contrastées";
      }
      if (value === "monoStrong") {
        return "Noir et blanc fort";
      }
      if (value === "mono") {
        return "Noir et blanc doux";
      }
      return "Douces";
    case "syllableLevel":
      return value === "strong" ? "Renforcé" : value === "light" ? "Léger" : "Désactivé";
    case "syllableBreakMode":
      return value === "hyphen" ? "Tiret discret" : value === "dot" ? "Point médian" : "Aucune";
    case "speechRate":
      return `${formatFrenchNumber(mapUiSpeechRate(value), 2)}×`;
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

function isPedagogicColorationMode(mode) {
  return ["pedagogique", "pedagogiqueAlt", "pedagogiqueContrast"].includes(normalizeColorationPreference(mode));
}

function getDysDependencyState(preferences = appState.preferences) {
  const colorationMode = normalizeColorationPreference(preferences.colorationMode);
  const syllableLevel = normalizeSyllableLevel(preferences.syllableLevel);
  const guideMode = normalizeReadingGuideMode(preferences.readingGuideMode, preferences.focusMode);
  const usesPedagogicColoration = isPedagogicColorationMode(colorationMode);
  const usesSyllableStructure = usesPedagogicColoration || syllableLevel !== "off";

  return {
    colorationMode,
    syllableLevel,
    usesPedagogicColoration,
    usesSoundColors: colorationMode === "sonsFrancais",
    usesSyllableStructure,
    usesExtendedSyllables: syllableLevel !== "off",
    usesOverlayOpacity: preferences.overlayPreset !== "none",
    usesGuideSettings: guideMode !== "off",
    guideMode
  };
}

function setControlInteractivity(key, enabled, inactiveReason = "") {
  const control = controls[key];
  if (!control) {
    return;
  }

  if (key !== "overlayCustomColor") {
    control.disabled = !enabled;
  }

  const wrapper = control.closest(".control");
  if (!wrapper) {
    return;
  }

  wrapper.classList.toggle("is-inactive", !enabled);
  wrapper.dataset.inactiveReason = !enabled ? inactiveReason : "";
}

function renderDysEssentialsSummary() {
  if (!elements.dysEssentialsSummary) {
    return;
  }

  const state = getDysDependencyState();
  const colorationLabels = {
    none: "aucune aide",
    pedagogique: "dys doux",
    pedagogiqueAlt: "dys alterné",
    pedagogiqueContrast: "dys accentué",
    sonsFrancais: "sons français",
    alternanceLignes: "lignes alternées",
    alternanceMots: "mots alternés",
    noirEtBlanc: "noir et blanc"
  };
  const syllableLabels = {
    off: "non",
    light: "oui, discret",
    strong: "oui, visible"
  };
  const currentSyllableLabel =
    state.usesPedagogicColoration && state.syllableLevel === "off"
      ? "déjà intégrées"
      : syllableLabels[state.syllableLevel] || state.syllableLevel;
  const syllableBreakLabels = {
    none: "sans signe",
    dot: "point",
    hyphen: "tiret"
  };
  const separatorLabel = state.usesSyllableStructure
    ? syllableBreakLabels[appState.preferences.syllableBreakMode] || "sans signe"
    : "inactif";
  const soundCopy = state.usesSoundColors
    ? `sons : ${formatControlValue("soundColorMode", appState.preferences.soundColorMode).toLowerCase()}`
    : "sons : seulement si tu choisis Sons français";

  elements.dysEssentialsSummary.innerHTML = `
    <strong>Actuel : ${escapeHtml(colorationLabels[state.colorationMode] || state.colorationMode)}</strong>
    <p>Syllabes : ${escapeHtml(currentSyllableLabel)} · Séparation : ${escapeHtml(separatorLabel)} · ${escapeHtml(soundCopy)}.</p>
  `;
}

function syncDependentControls() {
  const state = getDysDependencyState();

  setControlInteractivity(
    "soundColorMode",
    state.usesSoundColors,
    "Disponible seulement avec le mode dys « Sons français »."
  );
  setControlInteractivity(
    "syllableBreakMode",
    state.usesSyllableStructure,
    "Le séparateur n'apparaît que si la lecture découpe le mot en syllabes."
  );
  setControlInteractivity(
    "overlayOpacity",
    state.usesOverlayOpacity,
    "L'opacité du filtre n'agit que si un filtre visuel est choisi."
  );
  setControlInteractivity(
    "readingGuideLines",
    state.usesGuideSettings,
    "Le nombre de lignes visibles agit quand une réglette ou une fenêtre est activée."
  );
  setControlInteractivity(
    "readingGuideOpacity",
    state.usesGuideSettings,
    "L'opacité agit quand une réglette ou une fenêtre est activée."
  );
  setControlInteractivity(
    "readingGuideColor",
    state.usesGuideSettings,
    "La couleur agit quand une réglette ou une fenêtre est activée."
  );

  renderDysEssentialsSummary();
}

function getActiveModeLabel() {
  if (!appState.importedDocument) {
    return "Normal";
  }

  if (appState.importedDocument.extractionQuality === "poor") {
    return "PDF original";
  }

  if (appState.speaking || appState.audioPaused) {
    return "Audio";
  }

  if (appState.activeProfileId === "mode-examen") {
    return "Examen";
  }

  return "Normal";
}

function getSpeechSynthesisRuntime() {
  const windowSynthesis = typeof window !== "undefined" ? window.speechSynthesis : null;
  return windowSynthesis || globalThis.speechSynthesis || null;
}

function getSpeechUtteranceConstructor() {
  const windowCtor = typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null;
  const globalCtor = globalThis.SpeechSynthesisUtterance;
  const Utterance = windowCtor || globalCtor;
  return typeof Utterance === "function" ? Utterance : null;
}

function isNativeSpeechRuntimeAvailable() {
  return runtimeApi.kind === "electron" && typeof runtimeApi.speakNative === "function";
}

function isSpeechRuntimeAvailable() {
  return Boolean((getSpeechSynthesisRuntime() && getSpeechUtteranceConstructor()) || isNativeSpeechRuntimeAvailable());
}

function createSpeechUtterance(text) {
  const Utterance = getSpeechUtteranceConstructor();
  return Utterance ? new Utterance(text) : null;
}

function hasActiveSpeechRuntimeQueue() {
  const synthesis = getSpeechSynthesisRuntime();
  return Boolean(
    synthesis?.speaking ||
      synthesis?.pending ||
      synthesis?.paused ||
      audioEngine.currentUtterance ||
      appState.speechUtterance
  );
}

function syncQuickActionButtons() {
  const audioState = appState.audioPaused ? "paused" : appState.speaking ? "playing" : "idle";
  const speechRuntimeAvailable = isSpeechRuntimeAvailable();
  const navigableBlocks = getNavigableBlocks();
  const hasReadableDocument = navigableBlocks.length > 0;
  const hasSpeechDocument = speechRuntimeAvailable && hasReadableDocument;
  const canUseOverview = Boolean(appState.importedDocument && appState.importedDocument.extractionQuality !== "poor");
  const canRestartAudioFromSelection = audioState === "paused" && Boolean(appState.audioResumeOverride?.startKey);
  const showReadingDock = Boolean(appState.importedDocument && hasReadableDocument);
  document.documentElement.dataset.audioState = audioState;
  document.body.classList.toggle("has-reader-command-bar", showReadingDock);

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
    elements.speechStopButton.disabled = !speechRuntimeAvailable || audioState === "idle";
    elements.speechStopButton.textContent = "Arrêter";
  }

  if (elements.speechPrevButton) {
    elements.speechPrevButton.disabled = !hasSpeechDocument;
  }

  if (elements.speechNextButton) {
    elements.speechNextButton.disabled = !hasSpeechDocument;
  }

  if (elements.quickActionDock) {
    elements.quickActionDock.hidden = !showReadingDock;
  }
  if (elements.quickActionHint) {
    elements.quickActionHint.textContent =
      !speechRuntimeAvailable
        ? "Audio indisponible sur cet appareil"
        : audioState === "playing"
          ? "Lecture en cours"
          : audioState === "paused"
            ? canRestartAudioFromSelection
              ? "Point de départ choisi"
              : "Lecture en pause"
            : appState.audioResumeOverride?.startKey
              ? "Clique Lire pour repartir ici"
              : "Clique un mot, puis Lire";
  }
  if (elements.quickOverviewButton) {
    elements.quickOverviewButton.disabled = !canUseOverview;
    elements.quickOverviewButton.setAttribute("aria-label", "Ouvrir la vue d'ensemble du document");
  }
  if (elements.quickReadButton) {
    elements.quickReadButton.disabled = !hasSpeechDocument;
    elements.quickReadButton.classList.toggle("is-active", audioState === "playing");
    elements.quickReadButton.textContent =
      audioState === "paused"
        ? canRestartAudioFromSelection
          ? "Lire ici"
          : "Reprendre"
        : audioState === "playing"
          ? "Pause"
          : "Lire";
    elements.quickReadButton.setAttribute(
      "aria-label",
      audioState === "paused"
        ? canRestartAudioFromSelection
          ? "Lire à partir du mot sélectionné"
          : "Reprendre la lecture audio"
        : audioState === "playing"
          ? "Mettre la lecture audio en pause"
          : "Lancer la lecture audio"
    );
  }
  if (elements.quickStopButton) {
    const showStop = audioState !== "idle";
    elements.quickStopButton.hidden = !showStop;
    elements.quickStopButton.disabled = !showStop;
  }
  if (elements.quickAidButton) {
    elements.quickAidButton.disabled = !hasReadableDocument;
    elements.quickAidButton.setAttribute("aria-label", "Ouvrir les aides de compréhension");
  }
  if (elements.quickSettingsButton) {
    elements.quickSettingsButton.disabled = !hasReadableDocument;
    elements.quickSettingsButton.setAttribute("aria-label", "Ouvrir les réglages de lecture");
  }

  if (elements.selectionSpeechButton) {
    elements.selectionSpeechButton.disabled = !appState.selectionDraft || !speechRuntimeAvailable;
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
  syncAudioPreferences();
  syncDependentControls();
  ariaManager.refreshSliderValues();
}

function renderProfiles() {
  const profileDisplayOrder = ["decodage-renforce", "lecture-visuelle-allegee", "audio", "normal", "dyspraxie", "dyscalculie", "mode-examen"];
  const orderedBuiltinProfiles = [...appState.builtinProfiles].sort((left, right) => {
    const leftRank = profileDisplayOrder.indexOf(left.id);
    const rightRank = profileDisplayOrder.indexOf(right.id);
    return (leftRank === -1 ? 999 : leftRank) - (rightRank === -1 ? 999 : rightRank);
  });

  const renderCard = (profile, isCustom = false) => {
    const activeClass = appState.activeProfileId === profile.id ? "is-active" : "";
    const featuredClass = !isCustom && profile.id === "decodage-renforce" ? " is-featured" : "";
    const badge = isCustom
      ? `<span class="profile-badge">${isTemporaryCustomProfile(profile) ? "En cours" : "Perso"}</span>`
      : profile.id === "decodage-renforce"
        ? `<span class="profile-badge profile-badge--featured">Base dys</span>`
        : "";
    const label = repairUiText(profile.label);
    const description = repairUiText(profile.description);
    return `
      <button class="profile-card ${activeClass}${featuredClass}" data-profile-id="${profile.id}" type="button">
        <div class="profile-card-head">
          <strong>${escapeHtml(label)}</strong>
          ${badge}
        </div>
        <span>${escapeHtml(description)}</span>
      </button>
    `;
  };

  elements.profilesList.innerHTML = orderedBuiltinProfiles.map((profile) => renderCard(profile)).join("");
  if (elements.customProfilesList) {
    elements.customProfilesList.innerHTML = appState.customProfiles.length
      ? appState.customProfiles.map((profile) => renderCard(profile, true)).join("")
      : "<p class=\"muted-inline\">Aucun profil personnalisé pour l'instant.</p>";
  }

  const activeProfile = findProfile(appState.activeProfileId) || appState.builtinProfiles[0];
  renderProfileSummaryDialog();
  renderTeacherTools();
  if (elements.profileNameInput) {
    elements.profileNameInput.value =
      isCustomProfile(appState.activeProfileId) && !isTemporaryCustomProfile(activeProfile) ? activeProfile.label : "";
  }

  const activeSavedCustomProfile =
    isCustomProfile(appState.activeProfileId) && !isTemporaryCustomProfile(activeProfile)
      ? appState.customProfiles.find((profile) => profile.id === appState.activeProfileId) || null
      : null;
  const isTemporaryProfile = isTemporaryCustomProfile(activeProfile);
  const customizationSource = getCustomizationSourceProfile(activeProfile);

  if (elements.profileNameInput) {
    elements.profileNameInput.placeholder = activeSavedCustomProfile
      ? `Nom actuel : ${repairUiText(activeProfile.label)}`
      : `Exemple : Mon profil ${repairUiText(customizationSource?.label || "personnel").toLowerCase()}`;
  }

  if (elements.settingsProfileHint) {
    if (activeSavedCustomProfile) {
      elements.settingsProfileHint.textContent = `Tu ajustes actuellement le profil personnalisé ${repairUiText(activeProfile.label)}. Clique sur Mettre à jour pour enregistrer les changements.`;
    } else if (isTemporaryProfile) {
      elements.settingsProfileHint.textContent = `Tu ajustes une version personnelle du profil ${repairUiText(customizationSource?.label || "actuel")}. Donne-lui un nom pour la conserver dans Profils personnalisés.`;
    } else {
      elements.settingsProfileHint.textContent =
        "Quand cette combinaison te convient, donne-lui un nom pour la retrouver dans Profils personnalisés.";
    }
  }

  if (elements.saveProfileButton) {
    elements.saveProfileButton.textContent = activeSavedCustomProfile
      ? "Mettre à jour ce profil"
      : "Enregistrer dans mes profils";
  }

  if (elements.deleteProfileButton) {
    const showDelete = Boolean(activeSavedCustomProfile || isTemporaryProfile);
    elements.deleteProfileButton.hidden = !showDelete;
    elements.deleteProfileButton.disabled = !showDelete;
    elements.deleteProfileButton.textContent = isTemporaryProfile ? "Annuler ces réglages" : "Supprimer ce profil";
  }
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

function loadAnnotationsForCurrentDocument() {
  const documentKey = buildDocumentStorageKey(appState.importedDocument);
  appState.annotations = documentKey
    ? normalizeAnnotations(appState.annotationsByDocument[documentKey] || [])
    : [];
}

function loadTeacherNotesForCurrentDocument() {
  const documentKey = buildDocumentStorageKey(appState.importedDocument);
  appState.teacherNotes = documentKey ? String(appState.teacherNotesByDocument[documentKey] || "") : "";
  if (elements.teacherNotesInput) {
    elements.teacherNotesInput.value = appState.teacherNotes;
  }
}

function resetWordInsight() {
  appState.currentWordInsight = null;
  appState.currentWordSelection = null;
  clearSelectedWordHighlight();
  if (elements.wordInsightWord) {
    elements.wordInsightWord.textContent = "Aucun mot sélectionné";
  }
  if (elements.wordInsightSyllables) {
    elements.wordInsightSyllables.textContent = "Clique un mot dans le document pour afficher sa découpe syllabique.";
  }
    if (elements.wordInsightDefinition) {
      elements.wordInsightDefinition.textContent =
        "Une définition issue du dictionnaire local, puis si besoin du dictionnaire en ligne, s’affichera ici.";
    }
    if (elements.wordInsightSource) {
      elements.wordInsightSource.textContent = "Source : aucune";
    }
    if (elements.wordInsightDomain) {
      elements.wordInsightDomain.textContent = "Domaine : non déterminé";
    }
    elements.wordSpeakButton?.setAttribute("disabled", "disabled");
  elements.refreshWordDefinitionButton?.setAttribute("disabled", "disabled");
}

function clearSelectedWordHighlight() {
  elements.pageList
    ?.querySelectorAll(".is-word-selected")
    ?.forEach((node) => node.classList.remove("is-word-selected"));
}

function resolveWordTargetFromPoint(clientX, clientY, block = null) {
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY) || !elements.pageList) {
    return null;
  }

  const root = block instanceof Element ? block : elements.pageList;
  const isValidWord = (node) =>
    node instanceof Element &&
    root.contains(node) &&
    node.matches("[data-lookup-word][data-source-start][data-source-end]");

  const pointElements =
    typeof document.elementsFromPoint === "function"
      ? document.elementsFromPoint(clientX, clientY)
      : [document.elementFromPoint(clientX, clientY)].filter(Boolean);
  for (const element of pointElements) {
    const word = element instanceof Element ? element.closest("[data-lookup-word][data-source-start][data-source-end]") : null;
    if (isValidWord(word)) {
      return word;
    }
  }

  const caret =
    typeof document.caretRangeFromPoint === "function"
      ? document.caretRangeFromPoint(clientX, clientY)
      : null;
  const caretAnchor = caret?.startContainer instanceof Element ? caret.startContainer : caret?.startContainer?.parentElement;
  const caretWord = caretAnchor?.closest?.("[data-lookup-word][data-source-start][data-source-end]");
  if (isValidWord(caretWord)) {
    return caretWord;
  }

  if (!caret && typeof document.caretPositionFromPoint === "function") {
    const position = document.caretPositionFromPoint(clientX, clientY);
    const anchor = position?.offsetNode instanceof Element ? position.offsetNode : position?.offsetNode?.parentElement;
    const word = anchor?.closest?.("[data-lookup-word][data-source-start][data-source-end]");
    if (isValidWord(word)) {
      return word;
    }
  }

  const lineTolerance = Math.max(getCurrentReaderLineHeightPx() * 0.55, 18);
  const horizontalTolerance = Math.max(getCurrentReaderLineHeightPx() * 1.2, 28);
  let bestWord = null;
  let bestScore = Number.POSITIVE_INFINITY;

  root.querySelectorAll("[data-lookup-word][data-source-start][data-source-end]").forEach((word) => {
    for (const rect of word.getClientRects()) {
      const verticalDistance = clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
      const horizontalDistance = clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
      if (verticalDistance > lineTolerance || horizontalDistance > horizontalTolerance) {
        continue;
      }

      const score = verticalDistance * 100000 + horizontalDistance;
      if (score < bestScore) {
        bestScore = score;
        bestWord = word;
      }
    }
  });

  return bestWord;
}

function buildWordSelectionSnapshot(target) {
  const block = target?.closest?.(".reader-block");
  if (!target || !block?.dataset?.blockKey) {
    return null;
  }

  const start = Number(target.dataset.sourceStart);
  const end = Number(target.dataset.sourceEnd);
  const sentence = target.closest?.("[data-audio-sentence-index]");
  const startSentenceIndex = Number(sentence?.dataset?.audioSentenceIndex);
  const startWordIndex = Number(target.dataset.audioWordIndex);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }

  return {
    blockKey: block.dataset.blockKey,
    word: target.dataset.lookupWord || "",
    start,
    end,
    startSentenceIndex: Number.isFinite(startSentenceIndex) ? startSentenceIndex : 0,
    startWordIndex: Number.isFinite(startWordIndex) ? startWordIndex : 0
  };
}

function findSelectedWordNode(selection = appState.currentWordSelection) {
  if (!selection?.blockKey || !Number.isFinite(selection.start) || !Number.isFinite(selection.end)) {
    return null;
  }

  const blockKey = window.CSS?.escape ? window.CSS.escape(selection.blockKey) : selection.blockKey;
  return elements.pageList?.querySelector(
    `[data-block-key="${blockKey}"] [data-lookup-word][data-source-start="${selection.start}"][data-source-end="${selection.end}"]`
  );
}

function applySelectedWordHighlight(selection = appState.currentWordSelection) {
  clearSelectedWordHighlight();
  const target = findSelectedWordNode(selection);
  target?.classList?.add("is-word-selected");
  return target;
}

function buildAudioStartContextFromWordSelection(selection = appState.currentWordSelection) {
  if (!selection?.blockKey) {
    return null;
  }

  const selectedWordNode = findSelectedWordNode(selection);
  const sentenceNode = selectedWordNode?.closest?.("[data-audio-sentence-index]");
  const startSentenceIndex = Number.isFinite(Number(selection.startSentenceIndex))
    ? Number(selection.startSentenceIndex)
    : Number(sentenceNode?.dataset?.audioSentenceIndex) || 0;
  const startWordIndex = Number.isFinite(Number(selection.startWordIndex))
    ? Number(selection.startWordIndex)
    : Number(selectedWordNode?.dataset?.audioWordIndex) || 0;

  return normalizeAudioStartContext({
    startKey: selection.blockKey,
    startSentenceIndex,
    startWordIndex,
    source: "word"
  });
}

function isSameWordSelection(selection, word) {
  if (!selection || !appState.currentWordSelection || !appState.currentWordInsight?.word) {
    return false;
  }

  return (
    selection.blockKey === appState.currentWordSelection.blockKey &&
    selection.start === appState.currentWordSelection.start &&
    selection.end === appState.currentWordSelection.end &&
    sanitizeLookupWord(word) === appState.currentWordInsight.word
  );
}

function buildLocalAiStatusMessage(status = appState.localAiStatus) {
  const mode = normalizeLocalAiMode(appState.preferences.localAiMode);
  if (runtimeApi.kind !== "electron") {
    return "IA locale disponible uniquement dans l'application desktop. La version web garde les aides locales sans Gemma.";
  }

  if (mode === "off") {
    return "IA locale désactivée. Odysey continue avec les définitions et reformulations locales déjà intégrées.";
  }

  if (status.busy) {
    return "Vérification de l'IA locale en cours…";
  }

  if (!status.available) {
    return "Ollama n'est pas détecté sur cet ordinateur. Installe Ollama puis le modèle Gemma 3 pour activer l'IA locale.";
  }

  if (!status.modelAvailable) {
    return `Ollama est bien actif, mais le modèle ${normalizeLocalAiModel(appState.preferences.localAiModel)} n'est pas encore disponible. Lance par exemple : ollama pull ${normalizeLocalAiModel(appState.preferences.localAiModel)}.`;
  }

  const modelLabel = normalizeLocalAiModel(status.selectedModel || appState.preferences.localAiModel);
  return `IA locale prête avec ${modelLabel}. Mode actuel : ${getLocalAiModeLabel(mode).toLowerCase()}. Les réponses restent sur cet ordinateur.`;
}

function renderLocalAiStatus() {
  appState.localAiStatus.message = buildLocalAiStatusMessage(appState.localAiStatus);

  if (elements.localAiStatusText) {
    elements.localAiStatusText.textContent = appState.localAiStatus.message;
  }

  const canUseLocalAi =
    runtimeApi.kind === "electron" &&
    normalizeLocalAiMode(appState.preferences.localAiMode) !== "off" &&
    appState.localAiStatus.available &&
    appState.localAiStatus.modelAvailable;

  if (elements.localAiCheckButton) {
    elements.localAiCheckButton.disabled = appState.localAiStatus.busy;
    elements.localAiCheckButton.textContent = appState.localAiStatus.busy ? "Vérification…" : "Vérifier Gemma locale";
  }

  if (elements.refreshWordDefinitionButton) {
    const wantsLocalAi = normalizeLocalAiMode(appState.preferences.localAiMode) !== "off";
    elements.refreshWordDefinitionButton.textContent = wantsLocalAi ? "Définition avancée" : "Actualiser la définition";
    elements.refreshWordDefinitionButton.title = wantsLocalAi
      ? "Utilise Gemma locale si elle est disponible, sinon garde la définition locale."
      : "Relance l'analyse locale et le dictionnaire en ligne si disponible.";
  }

  if (elements.blockSummaryButton) {
    elements.blockSummaryButton.title = canUseLocalAi
      ? "Génère un résumé court avec Gemma locale, puis utilise le fallback local si besoin."
      : "Génère un résumé court local, sans dépendre d'une IA installée.";
  }

  if (elements.blockReformulateButton) {
    elements.blockReformulateButton.title = canUseLocalAi
      ? "Explique le passage avec Gemma locale au niveau choisi, puis utilise le secours local si besoin."
      : "Explique le passage localement au niveau choisi, sans dépendre d'une IA installée.";
  }

  if (elements.blockInstructionButton) {
    elements.blockInstructionButton.title = canUseLocalAi
      ? "Détecte les tâches d'une consigne avec Gemma locale, puis les découpe en étapes."
      : "Détecte localement les tâches d'une consigne et les découpe en étapes.";
  }

  if (elements.documentQuestionButton) {
    elements.documentQuestionButton.title = canUseLocalAi
      ? "Pose une question à Gemma locale avec le passage sélectionné et le contexte du PDF."
      : "La réponse complète nécessite Gemma locale. Sans IA, Odysey propose seulement des passages utiles.";
  }
}

async function refreshLocalAiStatus({ silent = false } = {}) {
  if (runtimeApi.kind !== "electron") {
    renderLocalAiStatus();
    return appState.localAiStatus;
  }

  appState.localAiStatus = {
    ...appState.localAiStatus,
    busy: true,
    selectedModel: normalizeLocalAiModel(appState.preferences.localAiModel)
  };
  renderLocalAiStatus();

  const status = await runtimeApi.getLocalAiStatus(normalizeLocalAiModel(appState.preferences.localAiModel));
  appState.localAiStatus = {
    available: Boolean(status?.available),
    modelAvailable: Boolean(status?.modelAvailable),
    provider: String(status?.provider || "ollama"),
    selectedModel: normalizeLocalAiModel(status?.selectedModel || appState.preferences.localAiModel),
    installedModels: Array.isArray(status?.installedModels) ? status.installedModels : [],
    checkedAt: new Date().toISOString(),
    busy: false,
    message: ""
  };
  renderLocalAiStatus();

  if (!silent) {
    elements.statusLine.textContent = appState.localAiStatus.available
      ? appState.localAiStatus.modelAvailable
        ? `IA locale prête : ${appState.localAiStatus.selectedModel}.`
        : `Ollama est actif, mais ${appState.localAiStatus.selectedModel} n'est pas encore installé.`
      : "IA locale indisponible pour le moment.";
  }

  return appState.localAiStatus;
}

function canTryLocalAi({ force = false } = {}) {
  const mode = normalizeLocalAiMode(appState.preferences.localAiMode);
  if (runtimeApi.kind !== "electron" || mode === "off") {
    return false;
  }

  if (!appState.localAiStatus.available || !appState.localAiStatus.modelAvailable) {
    return false;
  }

  return force || mode === "prefer-local";
}

async function runLocalAiTask(taskType, request, { force = false } = {}) {
  if (!request) {
    return "";
  }

  if (
    runtimeApi.kind === "electron" &&
    normalizeLocalAiMode(appState.preferences.localAiMode) !== "off" &&
    (!appState.localAiStatus.available || !appState.localAiStatus.modelAvailable)
  ) {
    await refreshLocalAiStatus({ silent: true });
  }

  if (!canTryLocalAi({ force })) {
    return "";
  }

  const cacheKey = `${taskType}:${normalizeLocalAiModel(appState.preferences.localAiModel)}:${request.cacheKey}`;
  if (!force && appState.localAiCache.has(cacheKey)) {
    return appState.localAiCache.get(cacheKey) || "";
  }

  const response = await runtimeApi.generateLocalAiText({
    model: normalizeLocalAiModel(appState.preferences.localAiModel),
    system: request.system,
    prompt: request.prompt,
    maxTokens: request.maxLength,
    temperature: taskType === "definition" ? 0.15 : 0.25
  });

  const cleaned = cleanLocalAiText(response?.text || "", {
    maxLength: request.maxLength,
    preserveLineBreaks: request.preserveLineBreaks
  });
  if (cleaned) {
    appState.localAiCache.set(cacheKey, cleaned);
  }
  return cleaned;
}

function renderWordInsight() {
  const insight = appState.currentWordInsight;
  if (!insight) {
    resetWordInsight();
    return;
  }

  if (elements.wordInsightWord) {
    elements.wordInsightWord.textContent = insight.word;
  }
  if (elements.wordInsightSyllables) {
    if (insight.syllablesVisible && insight.syllableCount > 1) {
      elements.wordInsightSyllables.textContent = `Découpe syllabique : ${insight.syllableDisplay}`;
    } else if (insight.syllableLevel === "off") {
      elements.wordInsightSyllables.textContent = "Aucune séparation syllabique supplémentaire n'est demandée ici.";
    } else if (insight.syllableCount <= 1) {
      elements.wordInsightSyllables.textContent = "Mot court : pas de découpe utile à afficher.";
    } else {
      elements.wordInsightSyllables.textContent = "Découpe syllabique non affichée pour ce mot.";
    }
  }
  if (elements.wordInsightDefinition) {
    elements.wordInsightDefinition.textContent = insight.definition;
  }
    if (elements.wordInsightSource) {
      const sourceLabel =
        insight.definitionSource === "dictionnaire"
          ? "dictionnaire en ligne"
          : insight.definitionSource === "dictionnaire-local"
            ? "dictionnaire local"
          : insight.definitionSource === "ia-locale"
            ? "Gemma locale"
          : insight.definitionSource === "local"
            ? "lexique local"
            : insight.definitionSource === "heuristique"
              ? "explication locale"
              : "aide locale";
      elements.wordInsightSource.textContent = `Source : ${sourceLabel}`;
    }
    if (elements.wordInsightDomain) {
      const domainLabel =
        insight.category === "literature"
          ? "littérature"
          : insight.category === "school"
            ? "lecture et école"
            : insight.category === "science"
              ? "maths et sciences"
              : insight.category === "admin"
                ? "administratif et santé"
                : "non déterminé";
      elements.wordInsightDomain.textContent = `Domaine : ${domainLabel}`;
    }
    elements.wordSpeakButton?.removeAttribute("disabled");
  elements.refreshWordDefinitionButton?.removeAttribute("disabled");
}

async function inspectWord(word, options = {}) {
  const sanitizedWord = sanitizeLookupWord(word);
  if (!sanitizedWord) {
    return;
  }

  if (options.selection && isSameWordSelection(options.selection, sanitizedWord) && !options.forceAi) {
    applySelectedWordHighlight(options.selection);
    return;
  }

  if (options.selection) {
    appState.currentWordSelection = options.selection;
  }
  applySelectedWordHighlight();

  const syllableInsightOptions = {
    mode: SIMPLIFIED_SYLLABLE_MODE,
    level: appState.preferences.syllableLevel,
    wordScope: SIMPLIFIED_SYLLABLE_SCOPE
  };

  const localInsight = buildLocalWordInsight(sanitizedWord, syllableInsightOptions);
  if (!localInsight) {
    return;
  }

  const requestId = ++appState.currentWordLookupId;
  appState.currentWordInsight = {
    ...localInsight,
    selection: appState.currentWordSelection
  };
  renderWordInsight();
  elements.statusLine.textContent = `Mot sélectionné : ${localInsight.word}.`;

  const forceAi = Boolean(options.forceAi);
  const contextText = String(options.contextText || "").replace(/\s+/g, " ").trim();
  const wantsLocalAi = forceAi || normalizeLocalAiMode(appState.preferences.localAiMode) === "prefer-local";
  const wantsRemoteDefinition = options.allowRemote !== false;

  if (!wantsLocalAi && !wantsRemoteDefinition) {
    return;
  }

  const insight = await lookupWordInsight(sanitizedWord, {
    allowRemote: wantsRemoteDefinition,
    ...syllableInsightOptions
  });
  if (requestId !== appState.currentWordLookupId || !insight) {
    return;
  }

  let aiDefinition = "";
  if (wantsLocalAi) {
    const aiRequest = buildLocalAiDefinitionRequest({
      word: sanitizedWord,
      syllableDisplay: insight.syllableDisplay,
      fallbackDefinition: insight.definition,
      contextText
    });
    aiDefinition = await runLocalAiTask("definition", aiRequest, { force: forceAi });
    if (requestId !== appState.currentWordLookupId) {
      return;
    }
  }

  appState.currentWordInsight = {
    ...insight,
    definition: aiDefinition || insight.definition,
    definitionSource: aiDefinition ? "ia-locale" : insight.definitionSource,
    selection: appState.currentWordSelection
  };
  renderWordInsight();
  elements.statusLine.textContent = aiDefinition
    ? `Mot analysé avec Gemma locale : ${insight.word}.`
    : forceAi && normalizeLocalAiMode(appState.preferences.localAiMode) !== "off"
      ? `Gemma locale indisponible pour ce mot. Définition locale affichée : ${insight.word}.`
      : `Mot analysé : ${insight.word}.`;
}

async function pronounceIsolatedWord() {
  const word = appState.currentWordInsight?.word;
  if (!word) {
    elements.statusLine.textContent = "Choisis d’abord un mot dans le texte.";
    return;
  }

  if (isNativeSpeechRuntimeAvailable() && runtimeApi.kind === "electron") {
    stopSpeech();
    const result = await runtimeApi.speakNative({
      text: word,
      rate: mapUiSpeechRate(appState.preferences.speechRate),
      voiceURI: appState.preferences.speechVoiceId
    });
    elements.statusLine.textContent = result?.ok
      ? `Prononciation du mot : ${word}.`
      : "Impossible de lancer la voix Windows pour ce mot.";
    return;
  }

  const synthesis = getSpeechSynthesisRuntime();
  const utterance = createSpeechUtterance(word);
  if (!synthesis || !utterance) {
    if (!isNativeSpeechRuntimeAvailable()) {
      elements.statusLine.textContent = "Aucune voix système disponible pour prononcer ce mot.";
      return;
    }

    stopSpeech();
    const result = await runtimeApi.speakNative({
      text: word,
      rate: mapUiSpeechRate(appState.preferences.speechRate),
      voiceURI: appState.preferences.speechVoiceId
    });
    elements.statusLine.textContent = result?.ok
      ? `Prononciation du mot : ${word}.`
      : "Impossible de lancer la voix Windows pour ce mot.";
    return;
  }

  stopSpeech();
  const selectedVoice = appState.voices.find((voice) => voice.voiceURI === appState.preferences.speechVoiceId);
  if (selectedVoice) {
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang || "fr-FR";
  } else {
    utterance.lang = "fr-FR";
  }
  utterance.rate = mapUiSpeechRate(appState.preferences.speechRate);
  synthesis.cancel?.();
  synthesis.speak?.(utterance);
  elements.statusLine.textContent = `Prononciation du mot : ${word}.`;
}

function renderBlockAssistMessage(message) {
  if (elements.blockAssistOutput) {
    elements.blockAssistOutput.textContent = message;
  }
}

function renderDocumentQuestionMessage(message) {
  if (elements.documentQuestionOutput) {
    elements.documentQuestionOutput.textContent = message;
  }
}

function getAssistSchoolLevel() {
  return normalizeSchoolLevel(appState.preferences.assistSchoolLevel);
}

function getAssistSchoolLevelLabel() {
  return getSchoolLevelLabel(getAssistSchoolLevel());
}

function getBlockPlainText(block) {
  const text = String(block?.text || "").trim();
  if (!text) {
    return "";
  }

  if (block?.type === "formula" || block?.math?.containsMath) {
    return verbalizeMathText(text) || text;
  }

  return text;
}

function getSelectedBlockAssistText(minLength = 20) {
  const context = getSelectedReadableBlockContext();
  const text = getBlockPlainText(context?.block);
  return text.length >= minLength ? text : "";
}

function getReadableDocumentContextBlocks() {
  if (!appState.importedDocument?.pages?.length) {
    return [];
  }

  const blocks = [];
  for (const page of appState.importedDocument.pages) {
    for (const [blockIndex, block] of (page.blocks || []).entries()) {
      const text = getBlockPlainText(block).replace(/\s+/gu, " ").trim();
      if (text.length < 8) {
        continue;
      }

      blocks.push({
        pageNumber: page.pageNumber,
        blockIndex,
        blockKey: buildBlockKey(page.pageNumber, blockIndex),
        type: block?.type || "paragraph",
        text
      });
    }
  }

  return blocks;
}

const QUESTION_CONTEXT_STOPWORDS = new Set([
  "avec",
  "dans",
  "des",
  "donc",
  "elle",
  "elles",
  "est",
  "ils",
  "les",
  "leur",
  "mais",
  "nous",
  "pas",
  "pour",
  "que",
  "quel",
  "quelle",
  "quels",
  "quelles",
  "qui",
  "quoi",
  "sur",
  "une",
  "vous"
]);

function normalizeContextSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "");
}

function getQuestionKeywords(question) {
  const words = normalizeContextSearchText(question).match(/\b[\p{L}\d]{3,}\b/gu) || [];
  return [...new Set(words.filter((word) => !QUESTION_CONTEXT_STOPWORDS.has(word)))].slice(0, 12);
}

function scoreQuestionContextBlock(block, keywords) {
  if (!keywords.length) {
    return 0;
  }

  const searchable = normalizeContextSearchText(block.text);
  return keywords.reduce((score, keyword) => score + (searchable.includes(keyword) ? 1 : 0), 0);
}

function buildDocumentQuestionContext(question, { maxChars = 5200 } = {}) {
  const blocks = getReadableDocumentContextBlocks();
  if (!blocks.length) {
    return "";
  }

  const keywords = getQuestionKeywords(question);
  const selectedKey = appState.selectedBlockKey || getFirstReadableBlockKey(appState.importedDocument);
  const selectedIndex = blocks.findIndex((block) => block.blockKey === selectedKey);
  const chosen = [];
  const seen = new Set();
  const addBlock = (block) => {
    if (!block || seen.has(block.blockKey)) {
      return;
    }
    seen.add(block.blockKey);
    chosen.push(block);
  };

  if (selectedIndex >= 0) {
    for (let index = Math.max(0, selectedIndex - 4); index <= Math.min(blocks.length - 1, selectedIndex + 6); index += 1) {
      addBlock(blocks[index]);
    }
  }

  blocks
    .map((block) => ({
      block,
      score: scoreQuestionContextBlock(block, keywords)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.block.pageNumber - right.block.pageNumber)
    .slice(0, 10)
    .forEach((entry) => addBlock(entry.block));

  blocks.slice(0, 8).forEach(addBlock);

  let output = "";
  for (const block of chosen) {
    const chunk = `[p.${block.pageNumber}] ${block.text}`;
    const separator = output ? "\n\n" : "";
    if (output.length + separator.length + chunk.length > maxChars) {
      const remaining = maxChars - output.length - separator.length;
      if (remaining > 180) {
        output += `${separator}${chunk.slice(0, remaining).replace(/\s+\S*$/u, "").trim()}...`;
      }
      break;
    }
    output += `${separator}${chunk}`;
  }

  return output.trim();
}

function buildQuestionFallbackMessage(question) {
  const blocks = getReadableDocumentContextBlocks();
  const keywords = getQuestionKeywords(question);
  const relevantBlocks = blocks
    .map((block) => ({
      block,
      score: scoreQuestionContextBlock(block, keywords)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.block.pageNumber - right.block.pageNumber)
    .slice(0, 3)
    .map(({ block }) => `- p.${block.pageNumber} : ${truncateForAssist(block.text, 180)}`);

  if (!relevantBlocks.length) {
    return "IA locale indisponible. Je ne vais pas inventer une réponse : active Gemma locale dans Outils, puis repose ta question.";
  }

  return [
    "IA locale indisponible. Je ne vais pas inventer une réponse.",
    "Passages du PDF qui semblent utiles à relire :",
    ...relevantBlocks
  ].join("\n");
}

function truncateForAssist(value, maxLength = 220) {
  const text = String(value || "").replace(/\s+/gu, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }
  const clipped = text.slice(0, maxLength).replace(/\s+\S*$/u, "").trim();
  return clipped ? `${clipped}...` : `${text.slice(0, maxLength).trim()}...`;
}

function renderSelectedBlockAssistHint() {
  const text = getSelectedBlockAssistText(12);
  if (!text) {
    renderBlockAssistMessage("Sélectionne un bloc lisible pour obtenir un résumé, une reformulation ou une consigne découpée.");
    return;
  }

  const analysis = detectInstructionStructure(text);
  const levelLabel = getAssistSchoolLevelLabel();
  renderBlockAssistMessage(
    `${analysis.label}. Aide réglée au niveau ${levelLabel}. Tu peux résumer, expliquer plus simplement ou découper la consigne.`
  );
}

async function summarizeSelectedBlock() {
  const text = getSelectedBlockAssistText();
  if (!text) {
    renderBlockAssistMessage("Choisis un paragraphe ou une consigne assez longue pour obtenir un résumé utile.");
    return;
  }

  const level = getAssistSchoolLevel();
  const levelLabel = getAssistSchoolLevelLabel();
  renderBlockAssistMessage(`Génération du résumé niveau ${levelLabel} en cours…`);
  const aiSummary = await runLocalAiTask("summary", buildLocalAiSchoolSummaryRequest(text, { level }), { force: true });
  const summary = aiSummary || buildSchoolSummary(text, { level }) || buildShortSummary(text);
  renderBlockAssistMessage(summary || "Résumé indisponible pour ce bloc.");
  elements.statusLine.textContent = aiSummary
    ? `Résumé niveau ${levelLabel} généré avec Gemma locale.`
    : normalizeLocalAiMode(appState.preferences.localAiMode) !== "off"
      ? `Gemma locale indisponible : résumé local niveau ${levelLabel} affiché.`
      : `Résumé local niveau ${levelLabel} généré pour le bloc sélectionné.`;
}

async function reformulateSelectedBlock() {
  const text = getSelectedBlockAssistText();
  if (!text) {
    renderBlockAssistMessage("Choisis un paragraphe ou une consigne assez longue pour obtenir une reformulation utile.");
    return;
  }

  const level = getAssistSchoolLevel();
  const levelLabel = getAssistSchoolLevelLabel();
  renderBlockAssistMessage(`Reformulation niveau ${levelLabel} en cours…`);
  const aiReformulation = await runLocalAiTask(
    "reformulation",
    buildLocalAiSchoolReformulationRequest(text, { level }),
    { force: true }
  );
  const reformulation = aiReformulation || buildSchoolReformulation(text, { level }) || buildSimpleReformulation(text);
  renderBlockAssistMessage(reformulation || "Reformulation indisponible pour ce bloc.");
  elements.statusLine.textContent = aiReformulation
    ? `Reformulation niveau ${levelLabel} générée avec Gemma locale.`
    : normalizeLocalAiMode(appState.preferences.localAiMode) !== "off"
      ? `Gemma locale indisponible : reformulation locale niveau ${levelLabel} affichée.`
      : `Reformulation locale niveau ${levelLabel} générée pour le bloc sélectionné.`;
}

async function explainSelectedInstruction() {
  const text = getSelectedBlockAssistText();
  if (!text) {
    renderBlockAssistMessage("Choisis une consigne ou une question assez longue pour la découper en étapes.");
    return;
  }

  const level = getAssistSchoolLevel();
  const levelLabel = getAssistSchoolLevelLabel();
  const analysis = detectInstructionStructure(text);
  if (!analysis.isInstruction && !analysis.isQuestion) {
    renderBlockAssistMessage(buildInstructionBreakdown(text, { level, analysis }));
    elements.statusLine.textContent = "Ce bloc ne ressemble pas à une consigne : résumé ou reformulation recommandés.";
    return;
  }

  renderBlockAssistMessage(`Analyse de la consigne niveau ${levelLabel} en cours…`);
  const aiBreakdown = await runLocalAiTask(
    "instruction",
    buildLocalAiInstructionRequest({
      text,
      level,
      detectedTasks: analysis.tasks
    }),
    { force: true }
  );
  const breakdown = aiBreakdown || buildInstructionBreakdown(text, { level, analysis });
  renderBlockAssistMessage(breakdown || "Découpage de consigne indisponible pour ce bloc.");
  elements.statusLine.textContent = aiBreakdown
    ? `Consigne découpée avec Gemma locale au niveau ${levelLabel}.`
    : normalizeLocalAiMode(appState.preferences.localAiMode) !== "off"
      ? `Gemma locale indisponible : découpage local niveau ${levelLabel} affiché.`
      : `Consigne découpée localement au niveau ${levelLabel}.`;
}

async function answerDocumentQuestion() {
  const question = String(elements.documentQuestionInput?.value || "").replace(/\s+/gu, " ").trim();
  if (!question) {
    renderDocumentQuestionMessage("Écris une question sur le PDF, puis appuie sur Poser la question.");
    return;
  }

  if (!appState.importedDocument || appState.importedDocument.extractionQuality === "poor") {
    renderDocumentQuestionMessage("Importe un PDF lisible ou lance l’OCR avant de poser une question au document.");
    return;
  }

  const level = getAssistSchoolLevel();
  const levelLabel = getAssistSchoolLevelLabel();
  const selectedText = getSelectedBlockAssistText(8);
  const documentContext = buildDocumentQuestionContext(question);
  if (!documentContext) {
    renderDocumentQuestionMessage("Je n’ai pas assez de texte exploitable dans ce PDF pour construire un contexte fiable.");
    return;
  }

  renderDocumentQuestionMessage(`Recherche dans le PDF et préparation d’une réponse niveau ${levelLabel}…`);
  const aiAnswer = await runLocalAiTask(
    "pdf-question",
    buildLocalAiDocumentQuestionRequest({
      question,
      selectedText,
      documentContext,
      documentTitle: appState.importedDocument.fileName,
      level
    }),
    { force: true }
  );

  const answer = aiAnswer || buildQuestionFallbackMessage(question);
  renderDocumentQuestionMessage(answer);
  elements.statusLine.textContent = aiAnswer
    ? `Réponse IA générée avec le contexte du PDF au niveau ${levelLabel}.`
    : "IA locale indisponible : passages utiles proposés sans inventer de réponse.";
}

function getExamProfileLabel() {
  return findProfile("mode-examen")?.label || "Mode examen";
}

function syncExamDurationOutput() {
  const baseMinutes = Math.max(10, Number(appState.examBaseMinutes || 60));
  if (elements.examBaseMinutes && Number(elements.examBaseMinutes.value || 0) !== baseMinutes) {
    elements.examBaseMinutes.value = String(baseMinutes);
  }
  const thirdTimeMinutes = Math.round(baseMinutes * 4 / 3);
  if (elements.examThirdTimeOutput) {
    elements.examThirdTimeOutput.textContent = `Avec tiers-temps : ${thirdTimeMinutes} minutes.`;
  }
}

function formatExamTimer(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function updateExamTimerUi() {
  if (elements.examTimerDisplay) {
    elements.examTimerDisplay.textContent = `Timer : ${formatExamTimer(appState.examTimeRemainingSeconds)}`;
  }
  if (elements.examToggleTimerButton) {
    elements.examToggleTimerButton.textContent = appState.examTimerRunning ? "Mettre en pause" : "Démarrer le timer";
  }
  if (elements.examModeButton) {
    const isExamActive = appState.activeProfileId === "mode-examen";
    elements.examModeButton.textContent = isExamActive ? "Mode examen actif" : "Activer le mode examen";
    elements.examModeButton.classList.toggle("is-active", isExamActive);
  }
}

function resetExamTimer() {
  if (appState.examTimerId) {
    window.clearInterval(appState.examTimerId);
    appState.examTimerId = 0;
  }
  appState.examTimerRunning = false;
  appState.examTimeRemainingSeconds = Math.round(Math.max(10, Number(appState.examBaseMinutes || 60)) * 4 / 3 * 60);
  updateExamTimerUi();
}

function toggleExamTimer() {
  if (!appState.examTimerRunning) {
    if (!appState.examTimeRemainingSeconds) {
      resetExamTimer();
    }
    appState.examTimerRunning = true;
    appState.examTimerId = window.setInterval(() => {
      appState.examTimeRemainingSeconds = Math.max(0, appState.examTimeRemainingSeconds - 1);
      updateExamTimerUi();
      if (appState.examTimeRemainingSeconds <= 0) {
        window.clearInterval(appState.examTimerId);
        appState.examTimerId = 0;
        appState.examTimerRunning = false;
        elements.statusLine.textContent = "Temps d’examen écoulé.";
      }
    }, 1000);
    updateExamTimerUi();
    return;
  }

  if (appState.examTimerId) {
    window.clearInterval(appState.examTimerId);
    appState.examTimerId = 0;
  }
  appState.examTimerRunning = false;
  updateExamTimerUi();
}

function getSelectedReadableBlockContext() {
  if (!appState.importedDocument?.pages?.length) {
    return null;
  }

  const fallbackKey = appState.selectedBlockKey || getFirstReadableBlockKey(appState.importedDocument);
  if (!fallbackKey) {
    return null;
  }

  for (const page of appState.importedDocument.pages) {
    for (const [blockIndex, block] of page.blocks.entries()) {
      const blockKey = buildBlockKey(page.pageNumber, blockIndex);
      if (blockKey === fallbackKey) {
        return {
          page,
          pageNumber: page.pageNumber,
          block,
          blockIndex,
          blockKey
        };
      }
    }
  }

  return null;
}

function getBlockTypeLabel(block) {
  switch (block?.type) {
    case "heading":
      return "Titre";
    case "list":
      return "Liste";
    case "formula":
      return "Formule";
    case "table":
      return "Tableau";
    default:
      return "Paragraphe";
  }
}

function getScienceLegendRows(text) {
  const lines = String(text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const parsedRows = lines
    .map((line) => {
      const separator = line.includes(":") ? ":" : line.includes("->") ? "->" : line.includes("=>") ? "=>" : "";
      if (!separator) {
        return null;
      }

      const [label, ...rest] = line.split(separator);
      const value = rest.join(separator).trim();
      const cleanLabel = String(label || "").trim();
      if (!cleanLabel || !value || cleanLabel.length > 40 || value.length < 2) {
        return null;
      }

      return {
        label: cleanLabel,
        value
      };
    })
    .filter(Boolean);

  return parsedRows.length >= 2 && parsedRows.length >= Math.ceil(lines.length / 2) ? parsedRows : [];
}

function formatTeacherDiagnostics(diagnostics) {
  const parts = [
    `${diagnostics.formulaBlockCount} formule(s)`,
    `${diagnostics.mathBlockCount} bloc(s) maths/sciences`,
    `${diagnostics.verificationBlockCount} bloc(s) a verifier`
  ];

  if (Number(diagnostics.scienceBlockCount || 0) > 0) {
    parts.splice(1, 0, `${diagnostics.scienceBlockCount} bloc(s) sciences`);
  }

  return parts.join(" • ");
}

function renderTeacherTools() {
  if (!elements.teacherModeSummary) {
    return;
  }

  const diagnostics = getDocumentDiagnostics();
  const selectedContext = getSelectedReadableBlockContext();
  const activeProfile = findProfile(appState.activeProfileId);
  const hasDocument = Boolean(appState.importedDocument);

  if (!hasDocument) {
    elements.teacherModeSummary.innerHTML = `
      <strong>Aucune fiche active</strong>
      <p>Importe un PDF pour comparer le document brut avec la lecture adaptee et conserver des remarques.</p>
    `;
    if (elements.teacherCompareButton) {
      elements.teacherCompareButton.disabled = true;
    }
    if (elements.teacherExportButton) {
      elements.teacherExportButton.disabled = true;
    }
    if (elements.teacherNotesInput) {
      elements.teacherNotesInput.disabled = true;
      elements.teacherNotesInput.value = "";
    }
    return;
  }

  const selectedLabel = selectedContext
    ? `Bloc selectionne : page ${selectedContext.pageNumber}, ${getBlockTypeLabel(selectedContext.block).toLowerCase()}.`
    : "Selectionne un bloc dans le texte pour comparer brut et adapte.";
  const extractionLabel = getExtractionQualityLabel(appState.importedDocument.extractionQuality);
  const reasonsLabel = diagnostics.verificationReasons.length
    ? diagnostics.verificationReasons.slice(0, 2).join(" • ")
    : "Aucun point critique majeur detecte pour l'instant.";

  elements.teacherModeSummary.innerHTML = `
    <strong>${escapeHtml(appState.importedDocument.fileName)}</strong>
    <p>Profil actif : ${escapeHtml(repairUiText(activeProfile?.label || "Normal"))}.</p>
    <p>${escapeHtml(`Extraction ${extractionLabel}. ${formatTeacherDiagnostics(diagnostics)}.`)}</p>
    <p>${escapeHtml(selectedLabel)}</p>
    <p>${escapeHtml(reasonsLabel)}</p>
  `;

  if (elements.teacherCompareButton) {
    elements.teacherCompareButton.disabled = !selectedContext;
  }
  if (elements.teacherExportButton) {
    elements.teacherExportButton.disabled = false;
  }
  if (elements.teacherNotesInput) {
    elements.teacherNotesInput.disabled = false;
    if (elements.teacherNotesInput.value !== appState.teacherNotes) {
      elements.teacherNotesInput.value = appState.teacherNotes;
    }
  }
}

function renderTeacherCompareDialog() {
  if (!elements.teacherCompareRaw || !elements.teacherCompareAdapted || !elements.teacherCompareMeta) {
    return;
  }

  const selectedContext = getSelectedReadableBlockContext();
  if (!selectedContext) {
    elements.teacherCompareMeta.textContent =
      "Choisis un bloc dans la lecture adaptee pour comparer la version brute et la version retravaillee.";
    elements.teacherCompareRaw.innerHTML = "<p class=\"support-copy\">Aucun bloc selectionne.</p>";
    elements.teacherCompareAdapted.innerHTML = "<p class=\"support-copy\">Aucun bloc selectionne.</p>";
    return;
  }

  const { block, blockKey, pageNumber } = selectedContext;
  const verificationText =
    block?.verification?.level && block.verification.level !== "none"
      ? `Verification : ${block.verification.reasons.join(" • ")}.`
      : "Aucun signal de verification sur ce bloc.";
  const rawText = String(block.text || "").trim() || "Bloc vide.";

  elements.teacherCompareMeta.textContent =
    `Page ${pageNumber} • ${getBlockTypeLabel(block)} • ${verificationText}`;
  elements.teacherCompareRaw.innerHTML = `<pre class="teacher-compare-raw">${escapeHtml(rawText)}</pre>`;
  elements.teacherCompareAdapted.innerHTML = `
    <article class="teacher-compare-preview reader-block reader-block--${escapeAttribute(block.type || "paragraph")}" data-line-pattern="a">
      ${renderBlockBody(block, blockKey)}
      ${renderVerificationNote(block)}
    </article>
  `;
  scheduleRenderedLinePatterns(elements.teacherCompareAdapted);
}

function buildTeacherSheetText() {
  const diagnostics = getDocumentDiagnostics();
  const activeProfile = findProfile(appState.activeProfileId);
  const selectedContext = getSelectedReadableBlockContext();
  const lines = [
    "Odysey - fiche enseignant / parent / ortho",
    "",
    `Document : ${appState.importedDocument?.fileName || "Sans titre"}`,
    `Pages : ${appState.importedDocument?.pageCount || 0}`,
    `Extraction : ${getExtractionQualityLabel(appState.importedDocument?.extractionQuality || "unknown")}`,
    `Profil actif : ${repairUiText(activeProfile?.label || "Normal")}`,
    `Diagnostics : ${formatTeacherDiagnostics(diagnostics)}`,
    ""
  ];

  if (selectedContext) {
    const adaptedText =
      selectedContext.block.readingText ||
      (selectedContext.block.type === "formula"
        ? verbalizeMathText(selectedContext.block.text)
        : String(selectedContext.block.text || ""));
    lines.push(
      `Bloc compare : page ${selectedContext.pageNumber} - ${getBlockTypeLabel(selectedContext.block)}`,
      "",
      "Document brut :",
      String(selectedContext.block.text || "").trim() || "Bloc vide.",
      "",
      "Lecture adaptee :",
      adaptedText.trim() || "Bloc vide.",
      ""
    );
  }

  lines.push(
    "Remarques :",
    appState.teacherNotes.trim() || "Aucune remarque pour l'instant."
  );

  if (diagnostics.verificationReasons.length) {
    lines.push("", "Points de vigilance :", diagnostics.verificationReasons.join(" • "));
  }

  return lines.join("\n");
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

function isSameSelectionDraft(nextDraft, currentDraft = appState.selectionDraft) {
  if (!nextDraft && !currentDraft) {
    return true;
  }

  if (!nextDraft || !currentDraft) {
    return false;
  }

  return (
    String(nextDraft.blockKey || "") === String(currentDraft.blockKey || "") &&
    Number(nextDraft.start || 0) === Number(currentDraft.start || 0) &&
    Number(nextDraft.end || 0) === Number(currentDraft.end || 0) &&
    String(nextDraft.excerpt || "") === String(currentDraft.excerpt || "")
  );
}

function updateSelectionAssist(draft) {
  if (isSameSelectionDraft(draft)) {
    return;
  }

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
    setSelectedBlock(draft.blockKey, { scroll: false, persistProgress: false });
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
      loadAnnotationsForCurrentDocument();
      loadTeacherNotesForCurrentDocument();
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

  const wordNodes = [...block.querySelectorAll("[data-lookup-word][data-source-start][data-source-end]")]
    .filter((node) => {
      try {
        return range.intersectsNode(node);
      } catch {
        return false;
      }
    })
    .sort((first, second) => Number(first.dataset.sourceStart) - Number(second.dataset.sourceStart));

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

  const firstWord = wordNodes[0];
  const sentence = firstWord?.closest?.("[data-audio-sentence-index]");

  return {
    blockKey: block.dataset.blockKey,
    pageNumber: block.dataset.pageNumber || "",
    start,
    end,
    excerpt,
    startSentenceIndex: Number(sentence?.dataset?.audioSentenceIndex) || 0,
    startWordIndex: Number(firstWord?.dataset?.audioWordIndex) || 0
  };
}

function handleSelectionChange() {
  if (appState.selectionChangeFrameId) {
    window.cancelAnimationFrame?.(appState.selectionChangeFrameId);
    window.clearTimeout?.(appState.selectionChangeFrameId);
  }

  const schedule =
    window.requestAnimationFrame?.bind(window) ||
    ((callback) => window.setTimeout(callback, 16));

  appState.selectionChangeFrameId = schedule(() => {
    appState.selectionChangeFrameId = 0;
    const draft = buildSelectionDraft();
    updateSelectionAssist(draft);
  });
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
      return normalizeAudioStartContext({
        startKey: appState.selectionDraft.blockKey,
        startSentenceIndex:
          Number(appState.selectionDraft.startSentenceIndex) ||
          findSentenceIndexForRange(selectionBlock, appState.selectionDraft.start, appState.selectionDraft.end),
        startWordIndex: Number(appState.selectionDraft.startWordIndex) || 0,
        source: "selection"
      });
    }
  }

  if (requireSelection) {
    return null;
  }

  const selectedWordContext = buildAudioStartContextFromWordSelection();
  if (selectedWordContext) {
    return selectedWordContext;
  }

  if (
    appState.preferredAudioStartContext?.startKey &&
    blocks.some((block) => block.dataset.blockKey === appState.preferredAudioStartContext.startKey)
  ) {
    return normalizeAudioStartContext(appState.preferredAudioStartContext);
  }

  const selectedBlock =
    blocks.find((block) => block.dataset.blockKey === appState.selectedBlockKey) ||
    blocks[0];

  return normalizeAudioStartContext({
    startKey: selectedBlock?.dataset.blockKey || "",
    startSentenceIndex: 0,
    startWordIndex: 0,
    source: "block"
  });
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
  renderDocument();
  debouncePersist();
  window.getSelection?.()?.removeAllRanges?.();
  clearSelectionAssist();
  elements.statusLine.textContent = "Passage surligné et enregistré pour ce document.";
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
  ariaManager.setRibbonExpanded(!appState.preferences.distractionFree);
  updateRibbonToggleUi();
  if (appState.activeRibbonTab) {
    positionActiveRibbonPanel(appState.activeRibbonTab);
  }
  syncQuickActionButtons();
}

function setWarning(message, visible) {
  elements.warningBanner.hidden = !visible;
  elements.warningText.textContent = message;
}

function updateDocumentMeta() {
  if (!appState.importedDocument) {
    elements.documentPagesInfo.textContent = "0";
    elements.documentModeInfo.textContent = "Normal";
    elements.documentProfileInfo.textContent = getActiveProfileLabel();
    return;
  }

  const { pageCount } = appState.importedDocument;
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

const SCIENCE_UNIT_HINT_REGEX =
  /\b(?:kg|g|mg|ug|µg|ng|km|cm|mm|m|s|min|h|L|mL|cL|dL|mol|mmol|A|V|W|J|N|Pa|Hz|kHz|MHz|ohm|Ω|°C|°F|mol\/L|g\/L|mg\/L|m\/s(?:2|²)?|m²|m3|m³|cm²|cm3|cm³)\b/iu;

function isScienceHeavyValue(value) {
  const source = String(value || "").trim();
  if (!source) {
    return false;
  }

  const analysis = analyzeMathContent(source);
  return Boolean(
    analysis.isFormulaCandidate ||
      Number(analysis.stats?.unitCount || 0) > 0 ||
      (SCIENCE_UNIT_HINT_REGEX.test(source) && /\d/u.test(source))
  );
}

function getScienceLegendMarkup(text) {
  const rows = getScienceLegendRows(text);
  if (rows.length === 0) {
    return "";
  }

  return `
    <div class="legend-block">
      ${rows
        .map(
          (row) => `
            <div class="legend-row">
              <span class="legend-label">${escapeHtml(row.label)}</span>
              <span class="legend-value">${renderAudioReadyText(row.value, {
                colorationMode: "none",
                soundColorMode: appState.preferences.soundColorMode,
                syllableLevel: "off",
                syllableBreakMode: "none",
                blockType: "legend",
                annotationRanges: []
              })}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderTableCell(cell, cellIndex) {
  const value = String(cell || "").trim();
  if (!value) {
    return "";
  }

  const isUnitCell = cellIndex > 0 && isScienceHeavyValue(value);
  const content = isUnitCell
    ? renderMathText(value)
    : renderAdaptedText(value, {
        colorationMode: appState.preferences.colorationMode,
        soundColorMode: appState.preferences.soundColorMode,
        syllableLevel: "off",
        syllabificationMode: appState.preferences.syllabificationMode,
        syllableWordScope: appState.preferences.syllableWordScope,
        syllableBreakMode: "none",
        blockType: "table",
        annotationRanges: []
      });

  return `
    <span class="table-cell ${cellIndex === 0 ? "table-cell--label" : "table-cell--value"} ${isUnitCell ? "table-cell--unit" : ""}">
      ${content}
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

  const scienceTableClass = isScienceHeavyValue(block.text || "") ? "table-block--science" : "";
  return `
    <div class="table-block ${scienceTableClass}">
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
  {
    colorationMode,
    soundColorMode,
    syllableLevel,
    syllabificationMode,
    syllableWordScope,
    syllableBreakMode,
    blockType,
    annotationRanges = []
  } = {}
) {
  const segments = segmentTextIntoSentences(text);
  if (segments.length === 0) {
    return renderAdaptedText(text, {
      colorationMode,
      soundColorMode,
      syllableLevel,
      syllabificationMode,
      syllableWordScope,
      syllableBreakMode,
      blockType,
      audioTracking: true,
      wordIndexOffset: 0,
      annotationRanges
    });
  }

  let sourceOffset = 0;
  const visualPatternState = { index: 0 };
  return segments
    .map((segment, sentenceIndex) => {
      const sentenceStart = Number.isFinite(Number(segment.start)) ? Number(segment.start) : sourceOffset;
      const sentenceEnd = Number.isFinite(Number(segment.end)) ? Number(segment.end) : sentenceStart + segment.rawText.length;
      sourceOffset = sentenceEnd;
      const markup = renderAdaptedText(segment.rawText, {
        colorationMode,
        soundColorMode,
        syllableLevel,
        syllabificationMode,
        syllableWordScope,
        syllableBreakMode,
        blockType,
        audioTracking: true,
        wordIndexOffset: 0,
        sourceOffset: sentenceStart,
        visualPatternState,
        annotationRanges
      });
      return `<span class="audio-sentence" data-audio-sentence-index="${sentenceIndex}" data-source-start="${sentenceStart}" data-source-end="${sentenceEnd}">${markup}</span>`;
    })
    .join("");
}

function applyRenderedLinePatterns(root = elements.pageList) {
  if (!root) {
    return;
  }

  const colorationMode = normalizeColorationPreference(appState.preferences.colorationMode);
  const wordTargets = [...root.querySelectorAll(".word-select-target")];
  wordTargets.forEach((target) => {
    target.removeAttribute("data-line-pattern");
  });

  if (colorationMode !== "alternanceLignes" || wordTargets.length === 0) {
    return;
  }

  let currentTop = null;
  let lineIndex = -1;

  wordTargets.forEach((target) => {
    const sample = target.querySelector(".word-adapted") || target;
    const rect = sample.getBoundingClientRect();
    const top = Math.round(rect.top);
    if (!Number.isFinite(top)) {
      return;
    }

    if (currentTop === null || Math.abs(top - currentTop) > 6 || top < currentTop - 2) {
      lineIndex += 1;
      currentTop = top;
    }

    target.dataset.linePattern = lineIndex % 2 === 0 ? "a" : "b";
  });
}

function scheduleRenderedLinePatterns(root = elements.pageList) {
  if (!root) {
    return;
  }

  window.requestAnimationFrame(() => {
    applyRenderedLinePatterns(root);
  });
}

function renderBlockBody(block, blockKey) {
  const annotationRanges = getBlockAnnotations(appState.annotations, blockKey);
  if (block.type === "formula") {
    return `<pre class="formula-content">${renderMathText(block.text)}</pre>`;
  }

  if (block.type === "table") {
    return renderTableBlock(block);
  }

  const legendMarkup = getScienceLegendMarkup(block.text);
  if (legendMarkup) {
    return legendMarkup;
  }

  return `<p>${renderAudioReadyText(block.text, {
    colorationMode: block.math?.containsMath ? "none" : appState.preferences.colorationMode,
    soundColorMode: appState.preferences.soundColorMode,
    syllableLevel: block.math?.containsMath ? "off" : appState.preferences.syllableLevel,
    syllabificationMode: appState.preferences.syllabificationMode,
    syllableWordScope: appState.preferences.syllableWordScope,
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
    "La vérification sert à repérer les zones plus fragiles : formules, unites, OCR incertain, tableaux reorganises ou schemas scientifiques.";
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
    <span>${diagnostics.scienceBlockCount} bloc(s) sciences repéré(s)</span>
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

function normalizeAudioStartContext(startContext) {
  if (!startContext?.startKey) {
    return null;
  }

  return {
    startKey: String(startContext.startKey),
    startSentenceIndex: Math.max(0, Number(startContext.startSentenceIndex) || 0),
    startWordIndex: Math.max(0, Number(startContext.startWordIndex) || 0),
    source: ["block", "sentence", "word", "selection"].includes(startContext.source) ? startContext.source : "block"
  };
}

function setCurrentAudioPosition({ startKey = "", startSentenceIndex = -1, startWordIndex = -1 } = {}) {
  appState.currentAudioBlockKey = String(startKey || "");
  appState.currentSentenceIndex = Number.isFinite(Number(startSentenceIndex)) ? Number(startSentenceIndex) : -1;
  appState.currentWordIndex = Number.isFinite(Number(startWordIndex)) ? Number(startWordIndex) : -1;
}

function getCurrentAudioBlockKey() {
  return appState.currentAudioBlockKey || elements.pageList.querySelector(".reader-block.is-audio-block")?.dataset?.blockKey || "";
}

function getCurrentAudioContext() {
  if (!getCurrentAudioBlockKey()) {
    return null;
  }

  if (appState.currentSentenceIndex >= 0 && appState.currentWordIndex >= 0) {
    return normalizeAudioStartContext({
      startKey: getCurrentAudioBlockKey(),
      startSentenceIndex: appState.currentSentenceIndex,
      startWordIndex: appState.currentWordIndex,
      source: "word"
    });
  }

  if (appState.currentSentenceIndex >= 0) {
    return normalizeAudioStartContext({
      startKey: getCurrentAudioBlockKey(),
      startSentenceIndex: appState.currentSentenceIndex,
      source: "sentence"
    });
  }

  return normalizeAudioStartContext({
    startKey: getCurrentAudioBlockKey(),
    source: "block"
  });
}

function isSameAudioStartContext(firstContext, secondContext) {
  const first = normalizeAudioStartContext(firstContext);
  const second = normalizeAudioStartContext(secondContext);
  if (!first || !second) {
    return false;
  }

  if (
    first.startKey !== second.startKey ||
    first.startSentenceIndex !== second.startSentenceIndex ||
    first.source !== second.source
  ) {
    return false;
  }

  if (first.source === "word" || second.source === "word" || first.source === "selection" || second.source === "selection") {
    return first.startWordIndex === second.startWordIndex;
  }

  return true;
}

function getAudioContextSelectionMessage(startContext, { paused = false } = {}) {
  const context = normalizeAudioStartContext(startContext);
  if (!context) {
    return paused ? "Lecture en pause. Utilise Lire pour reprendre au même endroit." : "";
  }

  if (paused) {
    switch (context.source) {
      case "word":
        return "Mot choisi. Utilise Lire ici pour repartir exactement à partir de ce mot.";
      case "sentence":
        return "Phrase choisie. Utilise Lire ici pour repartir exactement depuis cette phrase.";
      default:
        return "Paragraphe choisi. Utilise Lire ici pour repartir depuis ce passage.";
    }
  }

  switch (context.source) {
    case "word":
      return "Mot choisi. Utilise Lire pour commencer exactement à partir de ce mot, ou sélectionne un extrait pour lire seulement ce passage.";
    case "sentence":
      return "Phrase choisie. Utilise Lire pour commencer exactement ici, ou sélectionne un extrait pour lire seulement ce passage.";
    default:
      return "Bloc sélectionné. Utilise Lire pour commencer ici, ou sélectionne un passage pour lire seulement cet extrait.";
  }
}

function setAudioResumeOverride(startContext) {
  const normalizedContext = normalizeAudioStartContext(startContext);
  if (!normalizedContext) {
    appState.audioResumeOverride = null;
    syncQuickActionButtons();
    return;
  }

  appState.audioResumeOverride = normalizedContext;
  syncQuickActionButtons();
}

function setPreferredAudioStartContext(startContext) {
  const normalizedContext = normalizeAudioStartContext(startContext);
  if (!normalizedContext) {
    appState.preferredAudioStartContext = null;
    return;
  }

  appState.preferredAudioStartContext = normalizedContext;
}

function buildAudioStartContextFromNode(node) {
  const block = node?.closest?.(".reader-block");
  if (!block?.dataset?.blockKey) {
    return null;
  }

  const word = node?.closest?.("[data-lookup-word][data-source-start][data-source-end]");
  const sentence = node?.closest?.("[data-audio-sentence-index]");
  return normalizeAudioStartContext({
    startKey: block.dataset.blockKey,
    startSentenceIndex: Number(sentence?.dataset?.audioSentenceIndex) || 0,
    startWordIndex: Number(word?.dataset?.audioWordIndex) || 0,
    source: word ? "word" : sentence ? "sentence" : "block"
  });
}

function highlightAudioSentence(blockKey, sentenceIndex, { align = true, showSentence = true } = {}) {
  clearAudioHighlights();
  const block = elements.pageList.querySelector(`[data-block-key="${blockKey}"]`);
  if (!block) {
    return;
  }

  setCurrentAudioPosition({
    startKey: blockKey,
    startSentenceIndex: sentenceIndex,
    startWordIndex: -1
  });
  block.classList.add("is-audio-block");
  const sentence = block.querySelector(`[data-audio-sentence-index="${sentenceIndex}"]`);
  if (sentence && showSentence) {
    sentence.classList.add("is-audio-sentence");
  }
  if (sentence && align) {
    readingGuide.moveToElement(sentence);
    keepAudioElementInView(sentence);
  }
}

function keepAudioElementInView(element, { force = false } = {}) {
  if (!element || !elements.readArea) {
    return;
  }

  const containerRect = elements.readArea.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const comfortTop = containerRect.top + containerRect.height * 0.22;
  const comfortBottom = containerRect.bottom - containerRect.height * 0.25;
  const shouldScroll = force || elementRect.top < comfortTop || elementRect.bottom > comfortBottom;
  if (!shouldScroll) {
    return;
  }

  const nextTop =
    elements.readArea.scrollTop + (elementRect.top - containerRect.top) - elements.readArea.clientHeight * 0.42;
  elements.readArea.scrollTo({
    top: Math.max(0, nextTop),
    behavior: document.documentElement.dataset.motionPreference === "reduce" ? "auto" : "smooth"
  });
}

function highlightAudioWord(blockKey, sentenceIndex, wordIndex) {
  highlightAudioSentence(blockKey, sentenceIndex, {
    align: false,
    showSentence: !audioEngine.preferNativeSpeech
  });
  const block = elements.pageList.querySelector(`[data-block-key="${blockKey}"]`);
  const sentence = block?.querySelector(`[data-audio-sentence-index="${sentenceIndex}"]`);
  const word = sentence?.querySelector(`[data-audio-word-index="${wordIndex}"]`);
  setCurrentAudioPosition({
    startKey: blockKey,
    startSentenceIndex: sentenceIndex,
    startWordIndex: wordIndex
  });
  if (word) {
    word.classList.add("is-audio-word");
    readingGuide.moveToElement(word);
    keepAudioElementInView(word);
  } else if (sentence) {
    readingGuide.moveToElement(sentence);
    keepAudioElementInView(sentence);
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

function getGuideAnchorTopFromContentTop(contentTop) {
  const lineHeight = Math.max(getCurrentReaderLineHeightPx(), 1);
  const visibleLines = Math.max(Number(appState.preferences.readingGuideLines) || 1, 1);
  const guideHeight = lineHeight * visibleLines;
  const centeringOffset = Math.max(0, (guideHeight - lineHeight) / 2);
  return Math.max(0, contentTop - centeringOffset);
}

function getRangeRect(range) {
  if (!(range instanceof Range)) {
    return null;
  }

  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 || rect.height > 0);
  if (rects.length > 0) {
    return rects[0];
  }

  const rect = range.getBoundingClientRect();
  if (rect.width > 0 || rect.height > 0) {
    return rect;
  }

  return null;
}

function isPointInsideReadArea(clientX, clientY) {
  if (!elements.readArea || !Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return false;
  }

  const rect = elements.readArea.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

function getClosestRectForPoint(rectList, clientX, clientY) {
  const rects = Array.from(rectList || []).filter((rect) => rect.width > 0 || rect.height > 0);
  if (rects.length === 0) {
    return null;
  }

  const exactMatch = rects.find(
    (rect) =>
      clientY >= rect.top - 0.5 &&
      clientY <= rect.bottom + 0.5 &&
      clientX >= rect.left - 6 &&
      clientX <= rect.right + 6
  );
  if (exactMatch) {
    return exactMatch;
  }

  let bestRect = null;
  let bestScore = Number.POSITIVE_INFINITY;
  rects.forEach((rect) => {
    const verticalDistance = clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
    const horizontalDistance = clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
    const score = verticalDistance * 100000 + horizontalDistance;
    if (score < bestScore) {
      bestScore = score;
      bestRect = rect;
    }
  });

  return bestRect;
}

function getGuideTargetRectFromElement(element, clientX, clientY) {
  if (!(element instanceof Element)) {
    return null;
  }

  const preciseRect = getClosestRectForPoint(element.getClientRects(), clientX, clientY);
  if (preciseRect) {
    return preciseRect;
  }

  const fallbackRect = element.getBoundingClientRect();
  return fallbackRect.width > 0 || fallbackRect.height > 0 ? fallbackRect : null;
}

function getGuideRectFromBlockWords(block, clientX, clientY) {
  if (!(block instanceof Element)) {
    return null;
  }

  const lineTolerance = Math.max(getCurrentReaderLineHeightPx() * 0.8, 18);
  const candidates = Array.from(block.querySelectorAll("[data-lookup-word], .word-audio-track, .audio-sentence"));
  let bestRect = null;
  let bestScore = Number.POSITIVE_INFINITY;

  candidates.forEach((candidate) => {
    const rect = getGuideTargetRectFromElement(candidate, clientX, clientY);
    if (!rect) {
      return;
    }

    const verticalDistance = clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
    if (verticalDistance > lineTolerance) {
      return;
    }

    const horizontalDistance = clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
    const score = verticalDistance * 100000 + horizontalDistance;
    if (score < bestScore) {
      bestScore = score;
      bestRect = rect;
    }
  });

  return bestRect;
}

function resolveGuideTargetRectFromPoint(clientX, clientY) {
  if (!elements.readArea || !elements.pageList || !isPointInsideReadArea(clientX, clientY)) {
    return null;
  }

  if (typeof document.caretRangeFromPoint === "function") {
    const range = document.caretRangeFromPoint(clientX, clientY);
    const anchor = range?.startContainer instanceof Element ? range.startContainer : range?.startContainer?.parentElement;
    if (anchor && elements.pageList.contains(anchor)) {
      const rangeRect = getRangeRect(range);
      if (rangeRect) {
        return rangeRect;
      }
    }
  } else if (typeof document.caretPositionFromPoint === "function") {
    const caret = document.caretPositionFromPoint(clientX, clientY);
    const anchor = caret?.offsetNode instanceof Element ? caret.offsetNode : caret?.offsetNode?.parentElement;
    if (caret?.offsetNode && anchor && elements.pageList.contains(anchor)) {
      const range = document.createRange();
      const maxOffset =
        caret.offsetNode.nodeType === Node.TEXT_NODE
          ? caret.offsetNode.textContent?.length || 0
          : caret.offsetNode.childNodes?.length || 0;
      const safeOffset = Math.max(0, Math.min(caret.offset, maxOffset));
      range.setStart(caret.offsetNode, safeOffset);
      range.setEnd(caret.offsetNode, safeOffset);
      const rangeRect = getRangeRect(range);
      if (rangeRect) {
        return rangeRect;
      }
    }
  }

  const pointElements =
    typeof document.elementsFromPoint === "function"
      ? document.elementsFromPoint(clientX, clientY)
      : [document.elementFromPoint(clientX, clientY)].filter(Boolean);
  const uniqueTargets = [];
  const seen = new Set();

  pointElements.forEach((element) => {
    if (!(element instanceof Element)) {
      return;
    }
    const target = element.closest?.("[data-lookup-word], .word-audio-track, .audio-sentence, .reader-block");
    if (!target || !elements.pageList.contains(target) || seen.has(target)) {
      return;
    }
    seen.add(target);
    uniqueTargets.push(target);
  });

  for (const target of uniqueTargets) {
    if (target.classList.contains("reader-block")) {
      continue;
    }
    const rect = getGuideTargetRectFromElement(target, clientX, clientY);
    if (rect) {
      return rect;
    }
  }

  const block = uniqueTargets.find((target) => target.classList.contains("reader-block"));
  if (block) {
    const lineRect = getGuideRectFromBlockWords(block, clientX, clientY);
    if (lineRect) {
      return lineRect;
    }
    return getGuideTargetRectFromElement(block, clientX, clientY);
  }

  return null;
}

function resolveGuideContentTopFromPoint(clientX, clientY) {
  if (!elements.readArea || !elements.pageList) {
    return null;
  }

  const containerRect = elements.readArea.getBoundingClientRect();
  const targetRect = resolveGuideTargetRectFromPoint(clientX, clientY);

  if (!targetRect) {
    return Math.max(0, clientY - containerRect.top + elements.readArea.scrollTop);
  }

  return Math.max(0, targetRect.top - containerRect.top + elements.readArea.scrollTop);
}

function alignGuideToNode(node) {
  const guideMode = normalizeReadingGuideMode(appState.preferences.readingGuideMode, appState.preferences.focusMode);
  if (guideMode === "off" || !(node instanceof Element)) {
    return;
  }

  readingGuide.moveToElement(node);
}

function updateGuideFromTrackedPointer() {
  const guideMode = normalizeReadingGuideMode(appState.preferences.readingGuideMode, appState.preferences.focusMode);
  if (guideMode === "off") {
    return false;
  }

  if (!Number.isFinite(appState.rulerPointerClientX) || !Number.isFinite(appState.rulerPointerClientY)) {
    return false;
  }

  if (!isPointInsideReadArea(appState.rulerPointerClientX, appState.rulerPointerClientY)) {
    return false;
  }

  const contentTop = resolveGuideContentTopFromPoint(appState.rulerPointerClientX, appState.rulerPointerClientY);
  if (!Number.isFinite(contentTop)) {
    return false;
  }

  appState.rulerContentTop = contentTop;
  readingGuide.moveToContentTop(getGuideAnchorTopFromContentTop(contentTop));
  return true;
}

function cancelTrackedGuideUpdate() {
  if (!appState.rulerUpdateFrameId) {
    return;
  }
  window.cancelAnimationFrame(appState.rulerUpdateFrameId);
  appState.rulerUpdateFrameId = 0;
}

function scheduleTrackedGuideUpdate({ clientX = appState.rulerPointerClientX, clientY = appState.rulerPointerClientY } = {}) {
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return;
  }

  appState.rulerPointerClientX = clientX;
  appState.rulerPointerClientY = clientY;
  cancelTrackedGuideUpdate();
  appState.rulerUpdateFrameId = window.requestAnimationFrame(() => {
    appState.rulerUpdateFrameId = 0;
    updateGuideFromTrackedPointer();
  });
}

function syncReadingGuide({ alignToSelection = true } = {}) {
  readingGuide.attach(elements.readArea);
  readingGuide.setMode(normalizeReadingGuideMode(appState.preferences.readingGuideMode, appState.preferences.focusMode));
  readingGuide.setVisibleLines(appState.preferences.readingGuideLines);
  readingGuide.setOpacity(appState.preferences.readingGuideOpacity);
  readingGuide.setColor(appState.preferences.readingGuideColor);
  readingGuide.setLineHeight(getCurrentReaderLineHeightPx());

  if (updateGuideFromTrackedPointer()) {
    return;
  }

  if (!alignToSelection) {
    return;
  }

  const activeSentence = elements.pageList.querySelector(".audio-sentence.is-audio-sentence");
  if (activeSentence) {
    readingGuide.moveToElement(activeSentence);
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
  syncActiveEditableProfile();
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
  if (appState.preferences.distractionFree) {
    closeRibbonMenus();
  }
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

function renderDocument() {
  updateLayoutVariables();
  updateDocumentMeta();
  renderVerificationSummary();
  renderTeacherTools();
  renderWordInsight();
  renderLocalAiStatus();
  syncExamDurationOutput();
  updateExamTimerUi();

  const documentLoaded = Boolean(appState.importedDocument);
  const canUseAdaptedView = documentLoaded && appState.importedDocument.extractionQuality !== "poor";
  elements.emptyState.hidden = documentLoaded;
  elements.docState.hidden = !documentLoaded;
  elements.openExternalButton.disabled = !documentLoaded;
  elements.printButton.disabled = !canUseAdaptedView;
  elements.exportPdfButton.disabled = !canUseAdaptedView;
  elements.examModeButton?.toggleAttribute("disabled", !canUseAdaptedView);
  elements.examPrintButton?.toggleAttribute("disabled", !canUseAdaptedView);
  elements.examBaseMinutes?.toggleAttribute("disabled", !documentLoaded);
  elements.examToggleTimerButton?.toggleAttribute("disabled", !documentLoaded);
  elements.examResetTimerButton?.toggleAttribute("disabled", !documentLoaded);
  updateOcrUi();

  if (!documentLoaded) {
    setWarning("", false);
    elements.printSummary.innerHTML = "";
    elements.pageList.innerHTML = "";
    if (elements.documentOverviewDialog?.open) {
      elements.documentOverviewDialog.close();
    }
    readingGuide.setMode("off");
    clearSelectionAssist();
    appState.ocrState.status = "OCR prêt.";
    appState.ocrState.status = getIdleOcrStatus();
    appState.ocrState.progress = 0;
    appState.ocrState.currentPage = 0;
    appState.ocrState.totalPages = 0;
    updateOcrUi();
    resetWordInsight();
    renderBlockAssistMessage("Sélectionne un bloc pour obtenir un résumé, une reformulation ou une consigne découpée.");
    renderDocumentQuestionMessage("Importe un PDF lisible pour poser une question au document.");
    renderTeacherCompareDialog();
    syncQuickActionButtons();
    return;
  }

  if (appState.importedDocument.extractionQuality === "poor") {
    setWarning("PDF scanné détecté. Lance l'OCR local pour reconstruire une version lisible.", true);
    elements.pageList.innerHTML = `
      <article class="reader-empty-message">
        <h3>Lecture adaptée indisponible</h3>
        <p>Ce document ressemble à un scan ou ne contient pas assez de texte exploitable.</p>
        <p>Utilise l’onglet Document du ruban pour lancer l’OCR local et tenter une reconstruction automatique.</p>
      </article>
    `;
    elements.keyboardHint.textContent = "Ctrl+O permet aussi d'ouvrir rapidement un autre document.";
    elements.printSummary.innerHTML = "";
    readingGuide.setMode("off");
    renderBlockAssistMessage("L’assistance détaillée sera disponible après reconstruction OCR.");
    renderDocumentQuestionMessage("L’IA pourra utiliser le contexte du PDF après reconstruction OCR.");
    renderTeacherCompareDialog();
    syncQuickActionButtons();
    return;
  }

  const warningMessage = appState.importedDocument.warnings[0] || "";
  const diagnostics = getDocumentDiagnostics();
  const verificationWarning =
    getEffectiveVerificationMode() !== "off" && diagnostics.verificationBlockCount > 0
      ? `${diagnostics.verificationBlockCount} bloc(s) demandent une vérification maths / sciences.`
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
              data-line-pattern="${blockIndex % 2 === 0 ? "a" : "b"}"
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
  scheduleRenderedLinePatterns(elements.pageList);
  clearAudioHighlights();
  if (!elements.pageList.querySelector(`[data-block-key="${appState.selectedBlockKey}"]`)) {
    appState.selectedBlockKey = elements.pageList.querySelector(".reader-block")?.dataset.blockKey || "";
  }
  applySelectedWordHighlight();
  renderPrintSummary(buildCurrentPrintManifest());
  highlightSelectedBlock();
  syncReadingGuide();
  if (elements.teacherCompareDialog?.open) {
    renderTeacherCompareDialog();
  }
  if (elements.documentOverviewDialog?.open) {
    renderDocumentOverview();
  }
  syncQuickActionButtons();
}

function clampOverviewZoom(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 100;
  }
  return Math.min(400, Math.max(20, Math.round(numeric / 5) * 5));
}

function getOverviewBlockCount(documentModel = appState.importedDocument) {
  return (documentModel?.pages || []).reduce((sum, page) => sum + (page.blocks?.length || 0), 0);
}

function updateDocumentOverviewZoomUi() {
  const zoom = clampOverviewZoom(appState.overviewZoom);
  appState.overviewZoom = zoom;
  if (elements.overviewZoomRange) {
    elements.overviewZoomRange.value = String(zoom);
  }
  if (elements.overviewZoomLabel) {
    elements.overviewZoomLabel.textContent = `${zoom}%`;
  }
  if (elements.overviewZoomOutButton) {
    elements.overviewZoomOutButton.disabled = zoom <= 20;
  }
  if (elements.overviewZoomInButton) {
    elements.overviewZoomInButton.disabled = zoom >= 400;
  }
}

function applyDocumentOverviewZoom() {
  if (!elements.documentOverviewContent) {
    return;
  }

  const zoom = clampOverviewZoom(appState.overviewZoom);
  const ratio = zoom / 100;
  const baseFontSize = Math.max(16, Number(appState.preferences.fontSize) || DEFAULT_PREFERENCES.fontSize);
  const basePadding = Math.max(18, Number(appState.preferences.pagePadding) || DEFAULT_PREFERENCES.pagePadding);
  elements.documentOverviewContent.style.setProperty("--overview-font-size", `${Math.max(4, baseFontSize * ratio).toFixed(2)}px`);
  elements.documentOverviewContent.style.setProperty("--overview-page-width", `${Math.max(180, Math.round(980 * ratio))}px`);
  elements.documentOverviewContent.style.setProperty("--overview-page-padding", `${Math.max(6, Math.round(basePadding * ratio))}px`);
  elements.documentOverviewContent.style.setProperty("--overview-block-padding", `${Math.max(4, Math.round(12 * ratio))}px`);
}

function renderDocumentOverview() {
  if (!elements.documentOverviewContent || !elements.documentOverviewMeta) {
    return;
  }

  updateDocumentOverviewZoomUi();
  applyDocumentOverviewZoom();

  const documentModel = appState.importedDocument;
  if (!documentModel || documentModel.extractionQuality === "poor") {
    elements.documentOverviewMeta.textContent = "Aucun document lisible à parcourir.";
    elements.documentOverviewContent.innerHTML = `
      <article class="document-overview-empty">
        <h3>Vue d'ensemble indisponible</h3>
        <p>Importe un PDF lisible ou lance l'OCR local avant d'afficher l'ensemble du document.</p>
      </article>
    `;
    return;
  }

  const blockCount = getOverviewBlockCount(documentModel);
  elements.documentOverviewMeta.textContent = `${documentModel.fileName || "Document"} - ${documentModel.pageCount || documentModel.pages.length} page(s), ${blockCount} bloc(s).`;

  const pagesMarkup = documentModel.pages
    .map((page) => {
      const blocksMarkup = (page.blocks || [])
        .map((block, blockIndex) => {
          const blockKey = buildBlockKey(page.pageNumber, blockIndex);
          const typeLabel = getBlockTypeLabel(block);
          return `
            <article
              class="document-overview-block document-overview-block--${escapeAttribute(block.type || "paragraph")} ${blockKey === appState.selectedBlockKey ? "is-current" : ""}"
              data-overview-block-key="${escapeAttribute(blockKey)}"
              data-line-pattern="${blockIndex % 2 === 0 ? "a" : "b"}"
              tabindex="0"
              role="button"
              aria-label="Aller au ${escapeAttribute(typeLabel.toLowerCase())} page ${page.pageNumber}"
            >
              <span class="document-overview-block__meta">p.${page.pageNumber} · ${escapeHtml(typeLabel)}</span>
              ${renderBlockBody(block, blockKey)}
            </article>
          `;
        })
        .join("");

      return `
        <section class="document-overview-page" aria-label="Page ${page.pageNumber}">
          <header class="document-overview-page__header">Page ${page.pageNumber}</header>
          <div class="document-overview-page__body">
            ${blocksMarkup || `<p class="muted-inline">Page sans texte exploitable.</p>`}
          </div>
        </section>
      `;
    })
    .join("");

  elements.documentOverviewContent.innerHTML = `<div class="document-overview-pages">${pagesMarkup}</div>`;
  scheduleRenderedLinePatterns(elements.documentOverviewContent);
}

function openDocumentOverview() {
  if (!appState.importedDocument || appState.importedDocument.extractionQuality === "poor") {
    elements.statusLine.textContent = "La vue d'ensemble sera disponible après import d'un PDF lisible ou reconstruction OCR.";
    return;
  }

  renderDocumentOverview();
  if (!elements.documentOverviewDialog?.open) {
    elements.documentOverviewDialog?.showModal();
  }
  scheduleRenderedLinePatterns(elements.documentOverviewContent);
  elements.statusLine.textContent = "Vue d'ensemble du document ouverte.";
}

function selectOverviewBlock(blockKey) {
  if (!blockKey) {
    return;
  }

  elements.documentOverviewDialog?.close();
  setSelectedBlock(blockKey, { scroll: true });
  const escapedKey = window.CSS?.escape ? window.CSS.escape(blockKey) : blockKey;
  const target = elements.pageList.querySelector(`[data-block-key="${escapedKey}"]`);
  target?.focus?.({ preventScroll: true });
}

function setDocumentOverviewZoom(value) {
  appState.overviewZoom = clampOverviewZoom(value);
  updateDocumentOverviewZoomUi();
  applyDocumentOverviewZoom();
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

  closeRibbonMenus();
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
    loadAnnotationsForCurrentDocument();
    loadTeacherNotesForCurrentDocument();
    resetWordInsight();
    renderBlockAssistMessage("Sélectionne un bloc pour obtenir un résumé, une reformulation ou une consigne découpée.");
    renderDocumentQuestionMessage("Pose une question : l’IA locale utilisera le passage sélectionné et le contexte du PDF.");
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

async function handleExportTeacherSheet() {
  if (!appState.importedDocument) {
    elements.statusLine.textContent = "Importe un document avant d'exporter une fiche.";
    return;
  }

  const baseName = String(appState.importedDocument.fileName || "document")
    .replace(/\.pdf$/iu, "")
    .replace(/[^\p{L}\d-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  try {
    const result = await runtimeApi.saveTextFile({
      defaultFileName: `${baseName || "document"}-fiche-enseignant.txt`,
      content: buildTeacherSheetText(),
      title: "Exporter une fiche enseignant / parent / ortho"
    });

    if (result?.canceled) {
      elements.statusLine.textContent = "Export de la fiche annulé.";
      return;
    }

    if (result?.ok === false) {
      elements.statusLine.textContent = "L'export de la fiche a échoué.";
      return;
    }

    elements.statusLine.textContent = result?.filePath
      ? `Fiche exportee : ${result.filePath}`
      : "Fiche enseignant exportee au format texte.";
  } catch (error) {
    console.error("Erreur pendant l'export de la fiche enseignant", error);
    elements.statusLine.textContent = "Impossible d'exporter la fiche pour le moment.";
  }
}

function setSelectedBlock(blockKey, { scroll = true, audioStartContext = null, persistProgress = true } = {}) {
  const previousBlockKey = appState.selectedBlockKey;
  const blockChanged = String(blockKey || "") !== String(previousBlockKey || "");
  appState.selectedBlockKey = blockKey;
  if (blockKey) {
    setPreferredAudioStartContext(
      audioStartContext || {
        startKey: blockKey,
        startSentenceIndex: 0,
        source: "block"
      }
    );
  }

  if (blockChanged || scroll) {
    highlightSelectedBlock(scroll);
    syncReadingGuide();
    renderTeacherTools();
    if (blockChanged) {
      renderSelectedBlockAssistHint();
    }
  }

  if (elements.teacherCompareDialog?.open && blockChanged) {
    renderTeacherCompareDialog();
  }
}

function handleReaderTargetInteraction(
  target,
  {
    allowWordInspect = true,
    updateAudioStatusLine = true,
    persistProgress = true,
    autoRestartWhenPaused = false,
    clientX = Number.NaN,
    clientY = Number.NaN
  } = {}
) {
  if (!(target instanceof Element)) {
    return false;
  }

  const block = target.closest(".reader-block");
  if (!block?.dataset?.blockKey) {
    return false;
  }

  const clickedWord = allowWordInspect
    ? target.closest("[data-lookup-word][data-source-start][data-source-end]") ||
      resolveWordTargetFromPoint(clientX, clientY, block)
    : null;
  const wordSelection = clickedWord ? buildWordSelectionSnapshot(clickedWord) : null;
  if (clickedWord?.dataset?.lookupWord && wordSelection) {
    clearSelectionAssist();
    const parentBlock = clickedWord.closest(".reader-block");
    const contextText = parentBlock?.dataset?.sourceText || parentBlock?.textContent || "";
    void inspectWord(clickedWord.dataset.lookupWord, {
      contextText,
      selection: wordSelection
    });
  }

  const startContext =
    buildAudioStartContextFromWordSelection(wordSelection) ||
    buildAudioStartContextFromNode(clickedWord || target);
  const shouldPersistProgress = Boolean(
    persistProgress &&
      block.dataset.blockKey &&
      String(block.dataset.blockKey) !== String(appState.selectedBlockKey || "")
  );
  setSelectedBlock(block.dataset.blockKey, {
    scroll: false,
    audioStartContext: startContext,
    persistProgress: shouldPersistProgress
  });
  alignGuideToNode(clickedWord || target.closest(".audio-sentence") || block);

  if (appState.speechAvailable && appState.speaking && !appState.audioPaused && clickedWord) {
    startAudioPlayback(startContext);
    return true;
  }

  if (appState.speechAvailable && appState.audioPaused) {
    if (autoRestartWhenPaused) {
      startAudioPlayback(startContext);
      return true;
    }

    const isCurrentTarget = isSameAudioStartContext(getCurrentAudioContext(), startContext);
    if (!isCurrentTarget) {
      setAudioResumeOverride(startContext);
      if (updateAudioStatusLine) {
        elements.statusLine.textContent = getAudioContextSelectionMessage(startContext, { paused: true });
      }
    } else {
      setAudioResumeOverride(null);
      if (updateAudioStatusLine) {
        elements.statusLine.textContent = "Lecture en pause. Utilise Lire pour reprendre au même endroit.";
      }
    }
  } else if (appState.speechAvailable) {
    setAudioResumeOverride(null);
    if (updateAudioStatusLine) {
      elements.statusLine.textContent = getAudioContextSelectionMessage(startContext, { paused: false });
    }
  }

  return true;
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

  const activeProfile = findProfile(appState.activeProfileId);
  if (isTemporaryCustomProfile(activeProfile)) {
    const sourceProfile = getCustomizationSourceProfile(activeProfile);
    return `Copie de ${repairUiText(sourceProfile?.label || "profil actuel")}`;
  }

  const activeLabel = getActiveProfileLabel();
  return isCustomProfile(appState.activeProfileId) ? activeLabel : `Copie de ${activeLabel}`;
}

function saveCurrentProfile() {
  const label = getProfileLabelInput();
  const activeCustomProfile = isCustomProfile(appState.activeProfileId)
    ? appState.customProfiles.find((profile) => profile.id === appState.activeProfileId)
    : null;
  const existingCustomProfile =
    activeCustomProfile && !isTemporaryCustomProfile(activeCustomProfile) ? activeCustomProfile : null;
  const sourceProfile = getCustomizationSourceProfile(activeCustomProfile);

  const profile = {
    id: existingCustomProfile?.id || createCustomProfileId(label),
    label,
    description: "Profil personnalisé enregistré à partir des réglages actuels.",
    editable: true,
    researchNotes: "Profil personnalisé. Tu peux le recharger puis continuer à l'ajuster.",
    sourceProfileId: sourceProfile?.id || null,
    defaults: { ...appState.preferences }
  };

  appState.customProfiles = [
    profile,
    ...appState.customProfiles.filter(
      (item) => item.id !== profile.id && item.id !== TEMP_CUSTOM_PROFILE_ID && item.label !== profile.label
    )
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

  const fallbackProfile = isTemporaryCustomProfile(profile)
    ? getCustomizationSourceProfile(profile)
    : findProfile(profile.sourceProfileId) || appState.builtinProfiles[0];

  appState.customProfiles = appState.customProfiles.filter((item) => item.id !== profile.id);
  appState.activeProfileId = fallbackProfile.id;
  appState.preferences = buildProfilePreferences(fallbackProfile);
  syncControlsWithState();
  renderProfiles();
  renderDocument();
  debouncePersist();
  setPanelFeedback(elements.settingsFeedback, "");
  if (isTemporaryCustomProfile(profile)) {
    setPanelFeedback(
      elements.profileFeedback,
      `Réglages personnalisés annulés. Retour au profil ${repairUiText(fallbackProfile.label)}.`
    );
    elements.statusLine.textContent = `Retour au profil ${repairUiText(fallbackProfile.label)}.`;
    return;
  }
  setPanelFeedback(elements.profileFeedback, `Profil supprimé : ${profile.label}.`);
  elements.statusLine.textContent = `Profil personnalisé supprimé : ${profile.label}.`;
}

function resetCurrentSettings() {
  const activeProfile = findProfile(appState.activeProfileId);
  if (!activeProfile) {
    return;
  }

  if (isTemporaryCustomProfile(activeProfile)) {
    const sourceProfile = getCustomizationSourceProfile(activeProfile);
    appState.customProfiles = appState.customProfiles.filter((profile) => profile.id !== TEMP_CUSTOM_PROFILE_ID);
    appState.activeProfileId = sourceProfile.id;
    appState.preferences = buildProfilePreferences(sourceProfile);
    syncControlsWithState();
    renderProfiles();
    renderDocument();
    debouncePersist();
    setPanelFeedback(elements.profileFeedback, "");
    setPanelFeedback(elements.settingsFeedback, `Réglages restaurés depuis ${repairUiText(sourceProfile.label)}.`);
    elements.statusLine.textContent = `Retour au profil ${repairUiText(sourceProfile.label)}.`;
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

function clearVoiceRefreshTimer() {
  if (appState.voiceRefreshTimerId) {
    window.clearTimeout(appState.voiceRefreshTimerId);
    appState.voiceRefreshTimerId = 0;
  }
}

function mapNativeVoiceToWebVoice(voice = {}) {
  const name = String(voice.name || voice.id || "").trim();
  return {
    voiceURI: String(voice.id || name),
    name: name || "Voix Windows",
    lang: String(voice.lang || "fr-FR"),
    default: false,
    localService: true
  };
}

async function refreshNativeVoices({ silent = false } = {}) {
  if (runtimeApi.kind !== "electron" || typeof runtimeApi.getNativeVoices !== "function") {
    appState.nativeVoices = [];
    return [];
  }

  const result = await runtimeApi.getNativeVoices();
  if (!result?.ok) {
    appState.nativeVoices = [];
    if (!silent) {
      elements.statusLine.textContent = "Impossible de lire les voix Windows installées pour le moment.";
    }
    return [];
  }

  appState.nativeVoices = (Array.isArray(result.voices) ? result.voices : []).map(mapNativeVoiceToWebVoice);
  return appState.nativeVoices;
}

function scheduleVoiceRefresh() {
  clearVoiceRefreshTimer();

  if (appState.voiceRefreshAttempts >= 4) {
    return;
  }

  const delays = [250, 750, 1500, 3000];
  const delay = delays[appState.voiceRefreshAttempts] || delays.at(-1) || 1500;
  appState.voiceRefreshAttempts += 1;
  appState.voiceRefreshTimerId = window.setTimeout(() => {
    appState.voiceRefreshTimerId = 0;
    setVoices();
  }, delay);
}

function formatSpeechRuntimeError(error) {
  const reason = String(error?.error || error?.message || "").toLowerCase();

  if (reason.includes("not-allowed") || reason.includes("permission")) {
    return "Le navigateur a bloqué la lecture audio. Clique encore une fois sur Lire ou autorise l'audio du navigateur.";
  }

  if (reason.includes("interrupted") || reason.includes("canceled") || reason.includes("cancelled")) {
    return "La lecture audio a été interrompue. Relance Lire pour reprendre.";
  }

  if (reason.includes("network")) {
    return "La voix du navigateur n'a pas pu demarrer correctement. Essaie une autre voix ou recharge la page.";
  }

  return "La synthese vocale du navigateur a rencontre un probleme.";
}

function setVoices() {
  const synthesis = getSpeechSynthesisRuntime();
  const webSpeechAvailable = Boolean(synthesis && getSpeechUtteranceConstructor());
  const nativeSpeechAvailable = isNativeSpeechRuntimeAvailable();
  const speechRuntimeAvailable = webSpeechAvailable || nativeSpeechAvailable;
  const voices = webSpeechAvailable ? synthesis.getVoices?.() || [] : [];
  if (voices.length > 0 || !webSpeechAvailable) {
    clearVoiceRefreshTimer();
    appState.voiceRefreshAttempts = 0;
  }
  appState.voices = voices;
  appState.speechAvailable = speechRuntimeAvailable;
  if (webSpeechAvailable) {
    audioEngine.synthesis = synthesis;
  }
  audioEngine.setNativeSpeech(
    nativeSpeechAvailable
      ? {
          speak: runtimeApi.speakNative,
          stop: runtimeApi.stopNativeSpeech,
          onProgress: runtimeApi.onNativeSpeechProgress
        }
      : null
  );
  audioEngine.setPreferNativeSpeech(nativeSpeechAvailable && runtimeApi.kind === "electron");

  if (!speechRuntimeAvailable) {
    clearVoiceRefreshTimer();
    elements.voiceSelect.disabled = true;
    syncQuickActionButtons();
    elements.statusLine.textContent = "Aucune voix système détectée. La lecture audio reste désactivée.";
    return;
  }

  if (nativeSpeechAvailable && runtimeApi.kind === "electron") {
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Voix Windows par défaut";
    const nativeOptions = appState.nativeVoices.map((voice) => {
      const option = document.createElement("option");
      option.value = voice.voiceURI;
      option.textContent = `${voice.name} - ${voice.lang}`;
      return option;
    });
    elements.voiceSelect.replaceChildren(defaultOption, ...nativeOptions);
    elements.voiceSelect.disabled = false;
    if (appState.nativeVoices.some((voice) => voice.voiceURI === appState.preferences.speechVoiceId)) {
      elements.voiceSelect.value = appState.preferences.speechVoiceId;
    } else {
      elements.voiceSelect.value = "";
      appState.preferences.speechVoiceId = "";
    }
    audioEngine.setVoice("");
    audioEngine.setVoice(appState.preferences.speechVoiceId);
    audioEngine.setRate(appState.preferences.speechRate);
    audioEngine.setPauseBetweenSentences(appState.preferences.pauseBetweenSentences || 0);
    syncQuickActionButtons();
    return;
  }

  elements.voiceSelect.disabled = voices.length === 0 || audioEngine.preferNativeSpeech;
  const currentValue = appState.preferences.speechVoiceId;
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = audioEngine.preferNativeSpeech ? "Voix Windows par défaut" : "Voix système par défaut";
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

  if (webSpeechAvailable && voices.length === 0) {
    scheduleVoiceRefresh();
  }
}

async function refreshVoiceCatalog({ manual = false } = {}) {
  clearVoiceRefreshTimer();
  appState.voiceRefreshAttempts = 0;

  const synthesis = getSpeechSynthesisRuntime();
  if (typeof synthesis?.cancel === "function") {
    try {
      synthesis.cancel();
    } catch {
      // Ignore best-effort browser refresh failures.
    }
  }
  if (typeof synthesis?.getVoices === "function") {
    try {
      synthesis.getVoices();
    } catch {
      // Ignore best-effort browser refresh failures.
    }
  }

  if (runtimeApi.kind === "electron") {
    await refreshNativeVoices({ silent: !manual });
  }

  setVoices();

  if (!manual) {
    return;
  }

  if (audioEngine.preferNativeSpeech) {
    elements.statusLine.textContent = appState.nativeVoices.length
      ? `${appState.nativeVoices.length} voix Windows disponibles. Choisis-en une dans la liste audio.`
      : "Voix Windows par défaut disponible. Ajoute d'autres voix dans les paramètres Windows pour élargir la liste.";
    return;
  }

  if (appState.voices.length > 1) {
    elements.statusLine.textContent = `${appState.voices.length} voix système chargées.`;
    return;
  }

  elements.statusLine.textContent = "Voix rechargées. Pour en ajouter, installe des voix dans les paramètres du système.";
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
  if (appState.pendingAudioRestartTimerId) {
    window.clearTimeout(appState.pendingAudioRestartTimerId);
    appState.pendingAudioRestartTimerId = 0;
  }
  audioEngine.stop();
  appState.speaking = false;
  appState.audioPaused = false;
  appState.audioResumeOverride = null;
  appState.speechQueue = [];
  appState.speechUtterance = null;
  setCurrentAudioPosition();
  updateDocumentMeta();
  syncQuickActionButtons();
  clearAudioHighlights();
  if (silent) {
    return;
  }
  elements.statusLine.textContent = "Lecture audio arrêtée.";
}

function playNextUtterance() {
  const synthesis = getSpeechSynthesisRuntime();
  if (!synthesis || appState.speechQueue.length === 0) {
    appState.speaking = false;
    elements.speechToggleButton.textContent = "Lire";
    updateDocumentMeta();
    syncQuickActionButtons();
    elements.statusLine.textContent = "Lecture audio terminée.";
    return;
  }

  const next = appState.speechQueue.shift();
  setSelectedBlock(next.key, { scroll: true });
  const utterance = createSpeechUtterance(next.text);
  if (!utterance) {
    elements.statusLine.textContent = "Aucune voix système disponible pour la lecture audio.";
    stopSpeech({ silent: true });
    return;
  }
  utterance.rate = mapUiSpeechRate(appState.preferences.speechRate);
  const selectedVoice = appState.voices.find((voice) => voice.voiceURI === appState.preferences.speechVoiceId);
  if (selectedVoice) {
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang || "fr-FR";
  } else {
    utterance.lang = "fr-FR";
  }
  utterance.onend = () => playNextUtterance();
  utterance.onerror = (error) => {
    elements.statusLine.textContent = formatSpeechRuntimeError(error);
    stopSpeech();
  };
  appState.speechUtterance = utterance;
  synthesis.speak(utterance);
}

function legacyToggleSpeech() {
  if (!ensureSpeechRuntimeReady()) {
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

  const resumeContext = getCurrentAudioContext();
  audioEngine.pause();
  appState.audioPaused = true;
  if (resumeContext?.startKey) {
    setAudioResumeOverride(resumeContext);
  }
  updateDocumentMeta();
  syncQuickActionButtons();
  elements.statusLine.textContent = "Lecture audio en pause.";
}

function launchAudioPlayback(startContext) {
  if (!ensureSpeechRuntimeReady()) {
    elements.statusLine.textContent = "Aucune voix système disponible pour la lecture audio.";
    return false;
  }

  const blocks = getNavigableBlocks();
  if (blocks.length === 0) {
    elements.statusLine.textContent = "Aucun bloc lisible n'est disponible dans ce document.";
    return false;
  }

  const context = normalizeAudioStartContext(startContext || getAudioStartContext());
  if (!context?.startKey) {
    elements.statusLine.textContent = "Sélectionne un bloc ou un passage lisible pour démarrer la lecture audio.";
    return false;
  }

  appState.audioResumeOverride = null;

  audioEngine.setVoice(appState.preferences.speechVoiceId);
  audioEngine.setRate(appState.preferences.speechRate);
  audioEngine.setPauseBetweenSentences(appState.preferences.pauseBetweenSentences || 0);
  setSelectedBlock(context.startKey, { scroll: true });

  audioEngine.loadFromBlocks(blocks, {
    startKey: context.startKey,
    startSentenceIndex: context.startSentenceIndex || 0,
    startWordIndex: context.startWordIndex || 0,
    onBlockStart: ({ blockKey }) => {
      setCurrentAudioPosition({
        startKey: blockKey,
        startSentenceIndex: -1,
        startWordIndex: -1
      });
      setSelectedBlock(blockKey, { scroll: false });
    },
    onSentenceStart: ({ blockKey, sentenceIndex }) => {
      highlightAudioSentence(blockKey, sentenceIndex, {
        align: !audioEngine.preferNativeSpeech,
        showSentence: !audioEngine.preferNativeSpeech
      });
    },
    onWordBoundary: ({ blockKey, sentenceIndex, wordIndex }) => {
      highlightAudioWord(blockKey, sentenceIndex, wordIndex);
    },
      onEnd: () => {
        appState.speaking = false;
        appState.audioPaused = false;
        setCurrentAudioPosition();
        updateDocumentMeta();
        syncQuickActionButtons();
        clearAudioHighlights();
        elements.statusLine.textContent = "Lecture audio terminée.";
    },
    onError: (error) => {
      elements.statusLine.textContent = formatSpeechRuntimeError(error);
      stopSpeech({ silent: true });
    }
  });

  if (!audioEngine.play()) {
    elements.statusLine.textContent = "Impossible de lancer la lecture audio pour ce document.";
    return false;
  }

  appState.speaking = true;
  appState.audioPaused = false;
  setPreferredAudioStartContext(context);
  updateDocumentMeta();
  syncQuickActionButtons();
  elements.statusLine.textContent =
    context.source === "selection"
      ? "Lecture audio démarrée à partir de la sélection."
      : context.source === "word"
        ? "Lecture audio démarrée à partir du mot choisi."
      : context.source === "sentence"
        ? "Lecture audio démarrée à partir de la phrase choisie."
        : "Lecture audio démarrée à partir du bloc sélectionné.";
  return true;
}

function startAudioPlayback(startContext) {
  const context = normalizeAudioStartContext(startContext || getAudioStartContext());
  if (!context?.startKey) {
    elements.statusLine.textContent = "Sélectionne un bloc ou un passage lisible pour démarrer la lecture audio.";
    return false;
  }

  if (appState.pendingAudioRestartTimerId) {
    window.clearTimeout(appState.pendingAudioRestartTimerId);
    appState.pendingAudioRestartTimerId = 0;
  }

  const needsRestartDelay = appState.speaking || appState.audioPaused || hasActiveSpeechRuntimeQueue();
  if (needsRestartDelay) {
    stopSpeech({ silent: true });
    appState.pendingAudioRestartTimerId = window.setTimeout(() => {
      appState.pendingAudioRestartTimerId = 0;
      launchAudioPlayback(context);
    }, 20);
    return true;
  }

  return launchAudioPlayback(context);
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
  if (!ensureSpeechRuntimeReady()) {
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

function ensureSpeechRuntimeReady() {
  const synthesis = getSpeechSynthesisRuntime();
  const webSpeechAvailable = Boolean(synthesis && getSpeechUtteranceConstructor());
  const nativeSpeechAvailable = isNativeSpeechRuntimeAvailable();
  if (!webSpeechAvailable && !nativeSpeechAvailable) {
    appState.speechAvailable = false;
    syncQuickActionButtons();
    return false;
  }

  if (!appState.speechAvailable) {
    appState.speechAvailable = true;
  }
  if (webSpeechAvailable) {
    audioEngine.synthesis = synthesis;
  }
  audioEngine.setNativeSpeech(
    nativeSpeechAvailable
      ? {
          speak: runtimeApi.speakNative,
          stop: runtimeApi.stopNativeSpeech,
          onProgress: runtimeApi.onNativeSpeechProgress
        }
      : null
  );
  audioEngine.setPreferNativeSpeech(nativeSpeechAvailable && runtimeApi.kind === "electron");

  const voices = webSpeechAvailable ? synthesis.getVoices?.() || [] : [];
  if (webSpeechAvailable && voices.length > 0 && voices.length !== appState.voices.length) {
    setVoices();
  } else {
    if (webSpeechAvailable && voices.length === 0) {
      scheduleVoiceRefresh();
    }
    syncQuickActionButtons();
  }
  return true;
}

function getQuickReadStartContext() {
  return (
    normalizeAudioStartContext(appState.audioResumeOverride) ||
    getCurrentAudioContext() ||
    normalizeAudioStartContext(appState.preferredAudioStartContext) ||
    getAudioStartContext({ preferSelection: false })
  );
}

function handleQuickReadButton() {
  if (appState.speaking && !appState.audioPaused) {
    pauseSpeech();
    return;
  }

  if (!ensureSpeechRuntimeReady()) {
    elements.statusLine.textContent = "Aucune voix système disponible pour la lecture audio.";
    return;
  }

  const context = getQuickReadStartContext();
  if (!context?.startKey) {
    elements.statusLine.textContent = "Aucun passage lisible n'est disponible pour lancer la lecture.";
    return;
  }

  startAudioPlayback(context);
}

function openRibbonPanelFromQuickAction(tabId, statusMessage) {
  if (appState.preferences.distractionFree) {
    appState.preferences.distractionFree = false;
    updateLayoutVariables();
    debouncePersist();
  }
  setActiveRibbonTab(tabId, { focus: true });
  if (statusMessage) {
    elements.statusLine.textContent = statusMessage;
  }
}

function handleQuickAidButton() {
  openRibbonPanelFromQuickAction("aides", "Aides ouvertes : sélectionne un passage pour le reformuler, le résumer ou poser une question.");
}

function handleQuickSettingsButton() {
  openRibbonPanelFromQuickAction("lecture", "Réglages de lecture ouverts.");
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
          "assistSchoolLevel",
          "localAiMode",
          "localAiModel",
          "speechVoiceId",
          "ocrLanguage"
        ].includes(key)
          ? rawValue
          : Number(rawValue);

      if (key === "focusMode" && value === "ruler") {
        appState.preferences.focusMode = "none";
        appState.preferences.readingGuideMode = "ruler";
      } else if (key === "overlayCustomColor") {
        appState.preferences.overlayCustomColor = value;
        appState.preferences.overlayPreset = "custom";
        if (controls.overlayPreset) {
          controls.overlayPreset.value = "custom";
        }
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
      if (key === "localAiMode" || key === "localAiModel") {
        appState.preferences.localAiMode = normalizeLocalAiMode(appState.preferences.localAiMode);
        appState.preferences.localAiModel = normalizeLocalAiModel(appState.preferences.localAiModel);
        appState.localAiCache.clear();
        void refreshLocalAiStatus({ silent: true });
      }
      if (key === "assistSchoolLevel") {
        appState.preferences.assistSchoolLevel = normalizeSchoolLevel(appState.preferences.assistSchoolLevel);
        appState.localAiCache.clear();
      }
      enforceSimplifiedSyllablePreferences(appState.preferences);
      syncActiveEditableProfile({ announce: true });
      updateLayoutVariables();
      renderDocument();
      syncDependentControls();
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
  const updateGuideFromPointer = (event) => {
    const guideMode = normalizeReadingGuideMode(appState.preferences.readingGuideMode, appState.preferences.focusMode);
    if (guideMode === "off") {
      return;
    }

    appState.rulerPointerClientX = event.clientX;
    appState.rulerPointerClientY = event.clientY;
    updateGuideFromTrackedPointer();
  };

  const updateGuideFromWheel = (event) => {
    const guideMode = normalizeReadingGuideMode(appState.preferences.readingGuideMode, appState.preferences.focusMode);
    if (guideMode === "off") {
      return;
    }

    appState.rulerPointerClientX = event.clientX;
    appState.rulerPointerClientY = event.clientY;
    scheduleTrackedGuideUpdate({ clientX: event.clientX, clientY: event.clientY });
  };

  const resetReaderPointerState = ({ keepSuppression = false } = {}) => {
    appState.readerPointerState.active = false;
    appState.readerPointerState.pointerId = -1;
    appState.readerPointerState.startX = 0;
    appState.readerPointerState.startY = 0;
    appState.readerPointerState.drag = false;
    if (!keepSuppression) {
      appState.readerPointerState.suppressNextClick = false;
    }
  };

  const hasExtendedSelection = () => {
    const selection = window.getSelection?.();
    const selectedText = selection?.toString?.().trim?.() || "";
    return Boolean(selection && !selection.isCollapsed && selectedText.length > 1);
  };

  elements.pageList.addEventListener("pointerdown", (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (!target?.closest?.(".reader-block")) {
      resetReaderPointerState();
      return;
    }

    appState.readerPointerState.active = true;
    appState.readerPointerState.pointerId = event.pointerId;
    appState.readerPointerState.startX = event.clientX;
    appState.readerPointerState.startY = event.clientY;
    appState.readerPointerState.drag = false;
    appState.readerPointerState.suppressNextClick = false;
  });

  elements.pageList.addEventListener("pointermove", (event) => {
    if (!appState.readerPointerState.active || appState.readerPointerState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - appState.readerPointerState.startX;
    const deltaY = event.clientY - appState.readerPointerState.startY;
    if (Math.hypot(deltaX, deltaY) >= 6) {
      appState.readerPointerState.drag = true;
    }
  });

  elements.pageList.addEventListener("pointerup", (event) => {
    if (!appState.readerPointerState.active || appState.readerPointerState.pointerId !== event.pointerId) {
      return;
    }

    const shouldSuppressClick = appState.readerPointerState.drag;
    resetReaderPointerState({ keepSuppression: true });

    if (shouldSuppressClick || hasExtendedSelection()) {
      appState.readerPointerState.suppressNextClick = shouldSuppressClick;
      return;
    }

    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const handled = handleReaderTargetInteraction(target, {
      allowWordInspect: true,
      updateAudioStatusLine: true,
      persistProgress: true,
      autoRestartWhenPaused: true,
      clientX: event.clientX,
      clientY: event.clientY
    });
    appState.readerPointerState.suppressNextClick = handled;
  });

  elements.pageList.addEventListener("pointercancel", () => {
    resetReaderPointerState();
  });

  elements.pageList.addEventListener("click", (event) => {
    if (appState.readerPointerState.suppressNextClick || hasExtendedSelection()) {
      appState.readerPointerState.suppressNextClick = false;
      return;
    }

    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    handleReaderTargetInteraction(target, {
      allowWordInspect: true,
      updateAudioStatusLine: true,
      persistProgress: true,
      autoRestartWhenPaused: true,
      clientX: event.clientX,
      clientY: event.clientY
    });
  });

  elements.pageList.addEventListener("focusin", (event) => {
    handleReaderTargetInteraction(event.target, {
      allowWordInspect: false,
      updateAudioStatusLine: false,
      persistProgress: false
    });
  });

  elements.pageList.addEventListener("keydown", (event) => {
    const block = event.target.closest(".reader-block");
    if (!block || !isSpeechRuntimeAvailable()) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    const startContext = buildAudioStartContextFromNode(event.target) || getAudioStartContext({ preferSelection: false });
    setSelectedBlock(block.dataset.blockKey, { scroll: false, audioStartContext: startContext });
    startAudioPlayback(startContext);
  });

  elements.readArea.addEventListener("pointerenter", (event) => updateGuideFromPointer(event));
  elements.readArea.addEventListener("pointermove", (event) => updateGuideFromPointer(event));
  elements.readArea.addEventListener("wheel", (event) => updateGuideFromWheel(event), { passive: true });

  elements.readArea.addEventListener(
    "scroll",
    () => {
      const guideMode = normalizeReadingGuideMode(appState.preferences.readingGuideMode, appState.preferences.focusMode);
      if (guideMode === "off") {
        return;
      }

      updateGuideFromTrackedPointer();
    },
    { passive: true, capture: true }
  );

  elements.readArea.addEventListener("pointerleave", () => {
    cancelTrackedGuideUpdate();
    appState.rulerContentTop = null;
    appState.rulerPointerClientX = null;
    appState.rulerPointerClientY = null;
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
  elements.quickOverviewButton?.addEventListener("click", openDocumentOverview);
  elements.quickReadButton?.addEventListener("click", handleQuickReadButton);
  elements.quickStopButton?.addEventListener("click", () => stopSpeech());
  elements.quickAidButton?.addEventListener("click", handleQuickAidButton);
  elements.quickSettingsButton?.addEventListener("click", handleQuickSettingsButton);
  elements.printButton.addEventListener("click", handlePrint);
  elements.exportPdfButton.addEventListener("click", handleExportAdaptedPdf);
  elements.saveProfileButton.addEventListener("click", saveCurrentProfile);
  elements.deleteProfileButton.addEventListener("click", deleteCurrentProfile);
  elements.resetSettingsButton.addEventListener("click", resetCurrentSettings);
  elements.profileSummaryButton?.addEventListener("click", openProfileSummaryDialog);
  elements.profileNameInput.addEventListener("input", () => {
    setPanelFeedback(elements.profileFeedback, "");
  });
  elements.profileNameInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    saveCurrentProfile();
  });
  elements.immersionButton.addEventListener("click", toggleImmersion);
  elements.speechToggleButton.addEventListener("click", toggleSpeech);
  elements.speechStopButton.addEventListener("click", () => stopSpeech());
  elements.speechPrevButton?.addEventListener("click", playPreviousSentence);
  elements.speechNextButton?.addEventListener("click", playNextSentence);
  elements.refreshVoicesButton?.addEventListener("click", () => {
    void refreshVoiceCatalog({ manual: true });
  });
  elements.openExternalButton.addEventListener("click", async () => {
    await runtimeApi.openPath(appState.importedDocument?.filePath || "");
  });
  elements.wordSpeakButton?.addEventListener("click", pronounceIsolatedWord);
  elements.refreshWordDefinitionButton?.addEventListener("click", () => {
    if (appState.currentWordInsight?.word) {
      void inspectWord(appState.currentWordInsight.word, { forceAi: true });
    }
  });
  elements.blockSummaryButton?.addEventListener("click", summarizeSelectedBlock);
  elements.blockReformulateButton?.addEventListener("click", reformulateSelectedBlock);
  elements.blockInstructionButton?.addEventListener("click", explainSelectedInstruction);
  elements.documentQuestionButton?.addEventListener("click", answerDocumentQuestion);
  elements.documentQuestionInput?.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void answerDocumentQuestion();
    }
  });
  elements.localAiCheckButton?.addEventListener("click", () => {
    void refreshLocalAiStatus();
  });
  elements.localAiInstallButton?.addEventListener("click", async () => {
    await runtimeApi.openExternalUrl(LOCAL_AI_INSTALL_URL);
    elements.statusLine.textContent = "La page d'installation d'Ollama a été ouverte dans votre navigateur.";
  });
  elements.teacherCompareButton?.addEventListener("click", openTeacherCompareDialog);
  elements.teacherExportButton?.addEventListener("click", handleExportTeacherSheet);
  elements.teacherNotesInput?.addEventListener("input", () => {
    appState.teacherNotes = String(elements.teacherNotesInput.value || "");
    syncTeacherNotesStorage();
    renderTeacherTools();
    debouncePersist();
  });
  elements.examModeButton?.addEventListener("click", () => {
    activateProfile("mode-examen", {
      statusMessage: "Mode examen activé : lecture sobre, aides réduites et rendu d’impression propre."
    });
  });
  elements.examPrintButton?.addEventListener("click", () => {
    if (appState.activeProfileId !== "mode-examen") {
      activateProfile("mode-examen", {
        statusMessage: "Mode examen activé avant impression."
      });
    }
    void handlePrint();
  });
  elements.examBaseMinutes?.addEventListener("input", () => {
    appState.examBaseMinutes = Math.max(10, Number(elements.examBaseMinutes.value || 60));
    syncExamDurationOutput();
    resetExamTimer();
    debouncePersist();
  });
  elements.examToggleTimerButton?.addEventListener("click", toggleExamTimer);
  elements.examResetTimerButton?.addEventListener("click", () => {
    resetExamTimer();
    elements.statusLine.textContent = "Timer d’examen réinitialisé avec tiers-temps.";
  });
  elements.startOcrButton?.addEventListener("click", handleStartOcr);
  elements.cancelOcrButton?.addEventListener("click", handleCancelOcr);
  elements.overviewZoomRange?.addEventListener("input", (event) => {
    setDocumentOverviewZoom(event.target.value);
  });
  elements.overviewZoomOutButton?.addEventListener("click", () => {
    setDocumentOverviewZoom(appState.overviewZoom - 20);
  });
  elements.overviewZoomInButton?.addEventListener("click", () => {
    setDocumentOverviewZoom(appState.overviewZoom + 20);
  });
  elements.documentOverviewContent?.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-overview-block-key]") : null;
    if (!target?.dataset?.overviewBlockKey) {
      return;
    }
    selectOverviewBlock(target.dataset.overviewBlockKey);
  });
  elements.documentOverviewContent?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    const target = event.target instanceof Element ? event.target.closest("[data-overview-block-key]") : null;
    if (!target?.dataset?.overviewBlockKey) {
      return;
    }
    event.preventDefault();
    selectOverviewBlock(target.dataset.overviewBlockKey);
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
  elements.teacherCompareDialog?.addEventListener("click", (event) => {
    if (event.target === elements.teacherCompareDialog) {
      closeTeacherCompareDialog();
    }
  });
  elements.teacherCompareDialog?.addEventListener("close", () => {
    elements.teacherCompareButton?.focus({ preventScroll: true });
  });
}

function moveRibbonFocus(step) {
  if (!elements.ribbonTabs.length) {
    return;
  }

  const currentIndex = Math.max(
    0,
    elements.ribbonTabs.findIndex((button) => button.dataset.ribbonTab === appState.activeRibbonTab)
  );
  const nextIndex = (currentIndex + step + elements.ribbonTabs.length) % elements.ribbonTabs.length;
  const nextButton = elements.ribbonTabs[nextIndex];
  if (!nextButton) {
    return;
  }

  setActiveRibbonTab(nextButton.dataset.ribbonTab, { focus: true });
}

function bindRibbonTabs() {
  elements.ribbonTabs.forEach((button) => {
    button.setAttribute("aria-haspopup", "dialog");
    button.addEventListener("click", () => {
      setActiveRibbonTab(button.dataset.ribbonTab, { toggle: true });
    });

    button.addEventListener("mouseenter", () => {
      if (appState.activeRibbonTab) {
        setActiveRibbonTab(button.dataset.ribbonTab);
      }
    });

    button.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        moveRibbonFocus(1);
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveRibbonFocus(-1);
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        setActiveRibbonTab(elements.ribbonTabs[0]?.dataset.ribbonTab || "document", { focus: true });
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        setActiveRibbonTab(elements.ribbonTabs[elements.ribbonTabs.length - 1]?.dataset.ribbonTab || "document", {
          focus: true
        });
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeRibbonMenus({ focusTarget: button });
      }
    });
  });

  document.addEventListener("pointerdown", (event) => {
    if (!appState.activeRibbonTab) {
      return;
    }

    if (event.target?.closest?.(".app-ribbon-shell")) {
      return;
    }

    closeRibbonMenus();
  });

  window.addEventListener("resize", () => {
    if (appState.activeRibbonTab) {
      positionActiveRibbonPanel(appState.activeRibbonTab);
    }
    scheduleRenderedLinePatterns(elements.pageList);
    if (elements.documentOverviewDialog?.open) {
      scheduleRenderedLinePatterns(elements.documentOverviewContent);
    }
    if (elements.teacherCompareDialog?.open) {
      scheduleRenderedLinePatterns(elements.teacherCompareAdapted);
    }
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
      bindRibbonTabs();
      setActiveRibbonTab(appState.activeRibbonTab);
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
        void refreshVoiceCatalog({ manual: false });
        renderLocalAiStatus();
        void refreshLocalAiStatus({ silent: true });
        syncExamDurationOutput();
        resetExamTimer();
        if (window.speechSynthesis) {
          const handleVoicesChanged = () => {
            clearVoiceRefreshTimer();
            appState.voiceRefreshAttempts = 0;
            void refreshVoiceCatalog({ manual: false });
          };
          window.speechSynthesis.addEventListener?.("voiceschanged", handleVoicesChanged);
          if ("onvoiceschanged" in window.speechSynthesis) {
            window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
          }
          runtimeSubscriptions.push(() => {
            window.speechSynthesis?.removeEventListener?.("voiceschanged", handleVoicesChanged);
            if (window.speechSynthesis?.onvoiceschanged === handleVoicesChanged) {
              window.speechSynthesis.onvoiceschanged = null;
            }
          });
        }
        window.addEventListener("beforeunload", () => {
          document.removeEventListener("selectionchange", handleSelectionChange);
          if (appState.examTimerId) {
            window.clearInterval(appState.examTimerId);
          }
          cancelTrackedGuideUpdate();
          audioEngine.stop();
          clearVoiceRefreshTimer();
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

