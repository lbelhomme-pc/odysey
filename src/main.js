const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const { spawn } = require("child_process");

const SETTINGS_FILE = "settings.json";
const PROJECT_CONTACT_EMAIL = "ludovic.belhomme@outlook.com";
const PROJECT_SUPPORT_URL = "https://fr.tipeee.com/odysey/";
const APP_ICON_PATH = process.platform === "win32"
  ? path.join(__dirname, "assets", "odysey-icon.ico")
  : path.join(__dirname, "assets", "odysey-icon.png");
const OCR_LANGUAGE_FILES = {
  fra: ["node_modules", "@tesseract.js-data", "fra", "4.0.0_best_int", "fra.traineddata.gz"],
  eng: ["node_modules", "@tesseract.js-data", "eng", "4.0.0_best_int", "eng.traineddata.gz"]
};
const LOCAL_AI_BASE_URL = "http://127.0.0.1:11434";
const LOCAL_AI_DEFAULT_MODEL = "gemma3:4b";
const NATIVE_SPEECH_PROGRESS_CHANNEL = "speech:native-progress";

let mainWindow = null;
let nativeSpeechProcess = null;
let nativeSpeechSequence = 0;

function normalizeNativeSpeechRate(rate) {
  const normalized = Number(rate);
  if (!Number.isFinite(normalized)) {
    return 0;
  }
  return Math.min(Math.max(Math.round((normalized - 1) * 10), -10), 10);
}

function stopNativeSpeech({ markStopped = true } = {}) {
  if (markStopped) {
    nativeSpeechSequence += 1;
  }

  if (nativeSpeechProcess && !nativeSpeechProcess.killed) {
    nativeSpeechProcess.kill();
  }
  nativeSpeechProcess = null;
  return { ok: true };
}

function buildWindowsSpeechCommand(text, rate, requestId, voiceURI = "") {
  const encodedText = Buffer.from(String(text || ""), "utf16le").toString("base64");
  const encodedVoice = Buffer.from(String(voiceURI || ""), "utf16le").toString("base64");
  const speechRate = normalizeNativeSpeechRate(rate);
  const safeRequestId = Math.max(0, Number(requestId) || 0);
  return [
    "Add-Type -AssemblyName System.Speech;",
    `$requestId = ${safeRequestId};`,
    "function Send-NativeProgress([string]$eventName, [int]$charIndex, [int]$charLength) {",
    "  [Console]::Out.WriteLine(('{\"requestId\":' + $requestId + ',\"event\":\"' + $eventName + '\",\"charIndex\":' + $charIndex + ',\"charLength\":' + $charLength + '}'));",
    "  [Console]::Out.Flush();",
    "}",
    `$text = [Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encodedText}'));`,
    `$voiceName = [Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encodedVoice}'));`,
    "$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer;",
    `$speaker.Rate = ${speechRate};`,
    "if ($voiceName) { try { $speaker.SelectVoice($voiceName) } catch { } }",
    "$speaker.SetOutputToDefaultAudioDevice();",
    "$speaker.add_SpeakStarted({ Send-NativeProgress 'start' 0 0 });",
    "$speaker.add_SpeakProgress({ param($sender, $eventArgs) Send-NativeProgress 'word' $eventArgs.CharacterPosition $eventArgs.CharacterCount });",
    "$speaker.add_SpeakCompleted({ Send-NativeProgress 'end' 0 0 });",
    "$speaker.Speak($text);",
    "$speaker.Dispose();"
  ].join(" ");
}

function buildWindowsVoiceCatalogCommand() {
  return [
    "Add-Type -AssemblyName System.Speech;",
    "$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer;",
    "$voices = $speaker.GetInstalledVoices() | ForEach-Object {",
    "  $info = $_.VoiceInfo;",
    "  [pscustomobject]@{",
    "    id = [string]$info.Name;",
    "    name = [string]$info.Name;",
    "    lang = [string]$info.Culture.Name;",
    "    gender = [string]$info.Gender;",
    "    description = [string]$info.Description",
    "  }",
    "};",
    "$speaker.Dispose();",
    "$voices | ConvertTo-Json -Compress"
  ].join(" ");
}

function forwardNativeSpeechProgress(webContents, line) {
  const trimmed = String(line || "").trim();
  if (!trimmed || !webContents || webContents.isDestroyed()) {
    return;
  }

  try {
    const payload = JSON.parse(trimmed);
    webContents.send(NATIVE_SPEECH_PROGRESS_CHANNEL, payload);
  } catch {
    // PowerShell can emit non-JSON informational lines on some systems. Ignore them.
  }
}

async function speakWithNativeVoice(payload = {}, webContents = null) {
  const text = String(payload.text || "").replace(/\s+/g, " ").trim();
  if (!text) {
    return { ok: false, reason: "NATIVE_SPEECH_EMPTY_TEXT" };
  }

  if (process.platform !== "win32") {
    return { ok: false, reason: "NATIVE_SPEECH_UNSUPPORTED_PLATFORM" };
  }

  stopNativeSpeech({ markStopped: false });
  const requestId = ++nativeSpeechSequence;
  const clientRequestId = Math.max(0, Number(payload.requestId) || requestId);
  const command = buildWindowsSpeechCommand(text, payload.rate, clientRequestId, payload.voiceURI);
  const child = spawn(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
    {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
  nativeSpeechProcess = child;

  return new Promise((resolve) => {
    let stderr = "";
    let stdoutBuffer = "";

    child.stdout?.on("data", (chunk) => {
      stdoutBuffer += chunk.toString("utf8");
      const lines = stdoutBuffer.split(/\r?\n/u);
      stdoutBuffer = lines.pop() || "";
      lines.forEach((line) => forwardNativeSpeechProgress(webContents, line));
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (nativeSpeechProcess === child) {
        nativeSpeechProcess = null;
      }
      resolve({
        ok: false,
        reason: error?.message || "NATIVE_SPEECH_SPAWN_FAILED"
      });
    });

    child.on("close", (code, signal) => {
      if (nativeSpeechProcess === child) {
        nativeSpeechProcess = null;
      }

      if (stdoutBuffer.trim()) {
        forwardNativeSpeechProgress(webContents, stdoutBuffer);
      }

      if (requestId !== nativeSpeechSequence) {
        resolve({ ok: false, stopped: true, reason: "NATIVE_SPEECH_INTERRUPTED" });
        return;
      }

      resolve({
        ok: code === 0,
        stopped: Boolean(signal),
        reason: code === 0 ? "" : stderr.trim() || `NATIVE_SPEECH_EXIT_${code}`
      });
    });
  });
}

async function listNativeVoices() {
  if (process.platform !== "win32") {
    return {
      ok: false,
      voices: [],
      reason: "NATIVE_VOICES_UNSUPPORTED_PLATFORM"
    };
  }

  const command = buildWindowsVoiceCatalogCommand();
  const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      resolve({
        ok: false,
        voices: [],
        reason: error?.message || "NATIVE_VOICES_SPAWN_FAILED"
      });
    });

    child.on("close", (code) => {
      if (code !== 0) {
        resolve({
          ok: false,
          voices: [],
          reason: stderr.trim() || `NATIVE_VOICES_EXIT_${code}`
        });
        return;
      }

      try {
        const parsed = stdout.trim() ? JSON.parse(stdout.trim()) : [];
        const voices = (Array.isArray(parsed) ? parsed : parsed ? [parsed] : []).map((voice) => ({
          id: String(voice?.id || voice?.name || ""),
          name: String(voice?.name || voice?.id || ""),
          lang: String(voice?.lang || "fr-FR"),
          gender: String(voice?.gender || ""),
          description: String(voice?.description || "")
        }));
        resolve({
          ok: true,
          voices
        });
      } catch (error) {
        resolve({
          ok: false,
          voices: [],
          reason: error?.message || "NATIVE_VOICES_PARSE_FAILED"
        });
      }
    });
  });
}

function normalizeLocalAiModel(model) {
  const normalized = String(model || "").trim().toLowerCase();
  return normalized || LOCAL_AI_DEFAULT_MODEL;
}

async function requestLocalAiJson(endpoint, options = {}) {
  const controller = new AbortController();
  const timeoutMs = Math.max(1500, Number(options.timeoutMs || 12000));
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${LOCAL_AI_BASE_URL}${endpoint}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(raw || `HTTP_${response.status}`);
    }

    return raw ? JSON.parse(raw) : {};
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getLocalAiStatus(selectedModel) {
  const model = normalizeLocalAiModel(selectedModel);

  try {
    const payload = await requestLocalAiJson("/api/tags", {
      timeoutMs: 2500
    });

    const installedModels = Array.isArray(payload?.models)
      ? payload.models
          .map((entry) => String(entry?.name || "").trim())
          .filter(Boolean)
      : [];

    const selectedBaseName = model.split(":")[0];
    const modelAvailable =
      installedModels.includes(model) || installedModels.some((entry) => entry.split(":")[0] === selectedBaseName);

    return {
      ok: true,
      provider: "ollama",
      available: true,
      endpoint: LOCAL_AI_BASE_URL,
      selectedModel: model,
      suggestedModel: LOCAL_AI_DEFAULT_MODEL,
      modelAvailable,
      installedModels
    };
  } catch (error) {
    return {
      ok: false,
      provider: "ollama",
      available: false,
      endpoint: LOCAL_AI_BASE_URL,
      selectedModel: model,
      suggestedModel: LOCAL_AI_DEFAULT_MODEL,
      modelAvailable: false,
      installedModels: [],
      reason: error?.name === "AbortError" ? "LOCAL_AI_TIMEOUT" : String(error?.message || "LOCAL_AI_UNAVAILABLE")
    };
  }
}

async function generateLocalAiText(payload = {}) {
  const model = normalizeLocalAiModel(payload.model);
  const prompt = String(payload.prompt || "").trim();
  const system = String(payload.system || "").trim();
  const temperature = Number.isFinite(Number(payload.temperature)) ? Number(payload.temperature) : 0.2;
  const maxTokens = Math.max(80, Number(payload.maxTokens || 280));

  if (!prompt) {
    return {
      ok: false,
      provider: "ollama",
      model,
      text: "",
      reason: "LOCAL_AI_EMPTY_PROMPT"
    };
  }

  try {
    const response = await requestLocalAiJson("/api/generate", {
      method: "POST",
      timeoutMs: 45000,
      body: {
        model,
        system,
        prompt,
        stream: false,
        options: {
          temperature,
          num_predict: maxTokens
        }
      }
    });

    return {
      ok: true,
      provider: "ollama",
      model,
      text: String(response?.response || "").trim()
    };
  } catch (error) {
    return {
      ok: false,
      provider: "ollama",
      model,
      text: "",
      reason: error?.name === "AbortError" ? "LOCAL_AI_TIMEOUT" : String(error?.message || "LOCAL_AI_GENERATION_FAILED")
    };
  }
}

function getSettingsPath() {
  return path.join(app.getPath("userData"), SETTINGS_FILE);
}

async function ensureSettingsDir() {
  await fs.mkdir(app.getPath("userData"), { recursive: true });
}

async function loadSettings() {
  try {
    const raw = await fs.readFile(getSettingsPath(), "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        savedProfiles: [],
        lastUsedPreferences: null,
        recentFilesMeta: []
      };
    }
    throw error;
  }
}

async function saveSettings(payload) {
  await ensureSettingsDir();
  await fs.writeFile(getSettingsPath(), JSON.stringify(payload, null, 2), "utf8");
  return { ok: true };
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveBundledFilePath(pathSegments) {
  const appPath = app.getAppPath();
  const unpackedAppPath = appPath.endsWith(".asar") ? `${appPath}.unpacked` : appPath;
  const candidates = [
    path.join(process.cwd(), ...pathSegments),
    path.join(appPath, ...pathSegments),
    path.join(unpackedAppPath, ...pathSegments),
    path.join(process.resourcesPath, "app.asar.unpacked", ...pathSegments)
  ];

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(`OCR_FILE_NOT_FOUND:${pathSegments.join("/")}`);
}

async function readBundledOcrLanguage(language) {
  const pathSegments = OCR_LANGUAGE_FILES[language];
  if (!pathSegments) {
    return {
      ok: false,
      reason: "OCR_LANGUAGE_UNSUPPORTED"
    };
  }

  try {
    const filePath = await resolveBundledFilePath(pathSegments);
    const bytes = await fs.readFile(filePath);
    return {
      ok: true,
      language,
      filePath,
      bytes
    };
  } catch (error) {
    return {
      ok: false,
      reason: error?.message || "OCR_LANGUAGE_FILE_READ_FAILED"
    };
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 980,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: "#f5eddc",
    icon: APP_ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    title: "Odysey"
  });

  win.loadFile(path.join(__dirname, "index.html"));
  win.on("closed", () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });
  return win;
}

function sendRendererEvent(channel) {
  const targetWindow = BrowserWindow.getFocusedWindow() || mainWindow || BrowserWindow.getAllWindows()[0];
  if (!targetWindow || targetWindow.isDestroyed()) {
    return;
  }

  targetWindow.webContents.send(channel);
}

function buildApplicationMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    {
      label: "Fichier",
      submenu: [
        {
          label: "Ouvrir un PDF...",
          accelerator: "CmdOrCtrl+O",
          click: () => sendRendererEvent("app:open-pdf")
        },
        { type: "separator" },
        isMac ? { role: "close", label: "Fermer la fenêtre" } : { role: "quit", label: "Quitter" }
      ]
    },
    {
      label: "Édition",
      submenu: [
        { role: "undo", label: "Annuler" },
        { role: "redo", label: "Rétablir" },
        { type: "separator" },
        { role: "cut", label: "Couper" },
        { role: "copy", label: "Copier" },
        { role: "paste", label: "Coller" },
        { role: "selectAll", label: "Tout sélectionner" }
      ]
    },
    {
      label: "Affichage",
      submenu: [
        {
          label: "Mode immersion",
          accelerator: "CmdOrCtrl+Shift+I",
          click: () => sendRendererEvent("app:toggle-immersion")
        },
        { type: "separator" },
        { role: "reload", label: "Recharger" },
        { role: "forceReload", label: "Forcer le rechargement" },
        { role: "toggleDevTools", label: "Outils de développement" },
        { type: "separator" },
        { role: "resetZoom", label: "Zoom par défaut" },
        { role: "zoomIn", label: "Zoom avant" },
        { role: "zoomOut", label: "Zoom arrière" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Plein écran" }
      ]
    },
    {
      label: "Fenêtre",
      submenu: isMac
        ? [{ role: "minimize", label: "Réduire" }, { role: "zoom", label: "Zoom" }, { role: "front", label: "Tout ramener au premier plan" }]
        : [{ role: "minimize", label: "Réduire" }, { role: "close", label: "Fermer" }]
    },
    {
      label: "Aide",
      submenu: [
        {
          label: "Raccourcis clavier",
          accelerator: "F1",
          click: () => sendRendererEvent("app:toggle-shortcuts-help")
        },
        {
          label: "Soutenir Odysey sur Tipeee",
          click: () => shell.openExternal(PROJECT_SUPPORT_URL)
        },
        {
          label: "Contacter le projet",
          click: () =>
            shell.openExternal(
              `mailto:${PROJECT_CONTACT_EMAIL}?subject=${encodeURIComponent("Odysey - Contact")}`
            )
        },
        {
          label: "Signaler un problème",
          click: () =>
            shell.openExternal(
              `mailto:${PROJECT_CONTACT_EMAIL}?subject=${encodeURIComponent("Odysey - Signaler un problème")}`
            )
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  mainWindow = createWindow();
  buildApplicationMenu();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
      buildApplicationMenu();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("dialog:open-pdf", async () => {
  const result = await dialog.showOpenDialog({
    title: "Choisir un PDF",
    properties: ["openFile"],
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return {
    filePath: result.filePaths[0],
    fileName: path.basename(result.filePaths[0])
  };
});

ipcMain.handle("file:read-pdf", async (_event, filePath) => {
  const bytes = await fs.readFile(filePath);
  return {
    bytes,
    fileName: path.basename(filePath),
    filePath
  };
});

ipcMain.handle("ocr:read-language-data", async (_event, language) => readBundledOcrLanguage(language));
ipcMain.handle("local-ai:status", async (_event, model) => getLocalAiStatus(model));
ipcMain.handle("local-ai:generate", async (_event, payload) => generateLocalAiText(payload));
ipcMain.handle("speech:native-speak", async (event, payload) => speakWithNativeVoice(payload, event.sender));
ipcMain.handle("speech:native-stop", async () => stopNativeSpeech());
ipcMain.handle("speech:native-voices", async () => listNativeVoices());

ipcMain.handle("storage:load-settings", async () => loadSettings());

ipcMain.handle("storage:save-settings", async (_event, payload) => saveSettings(payload));

ipcMain.handle("shell:open-path", async (_event, targetPath) => shell.openPath(targetPath));

ipcMain.handle("shell:open-external", async (_event, targetUrl) => {
  if (!targetUrl) {
    return { ok: false };
  }

  await shell.openExternal(targetUrl);
  return { ok: true };
});

ipcMain.handle("export:text-file", async (event, { defaultFileName, content, title } = {}) => {
  const ownerWindow = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(ownerWindow, {
    title: title || "Exporter le fichier texte",
    defaultPath: defaultFileName || "notes.txt",
    filters: [{ name: "Texte", extensions: ["txt"] }]
  });

  if (result.canceled || !result.filePath) {
    return { ok: false, canceled: true };
  }

  await fs.writeFile(result.filePath, String(content || ""), "utf8");
  return {
    ok: true,
    filePath: result.filePath
  };
});

ipcMain.handle("print:current-view", async (event) => {
  return new Promise((resolve) => {
    event.sender.print(
      {
        printBackground: true
      },
      (success, failureReason) => {
        resolve({
          ok: success,
          failureReason: failureReason || ""
        });
      }
    );
  });
});

ipcMain.handle("export:adapted-pdf", async (event, defaultFileName) => {
  const ownerWindow = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(ownerWindow, {
    title: "Exporter le document adapté",
    defaultPath: defaultFileName || "document-adapte.pdf",
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });

  if (result.canceled || !result.filePath) {
    return { ok: false, canceled: true };
  }

  const pdfBuffer = await event.sender.printToPDF({
    printBackground: true,
    preferCSSPageSize: true,
    landscape: false
  });

  await fs.writeFile(result.filePath, pdfBuffer);
  return {
    ok: true,
    filePath: result.filePath
  };
});
