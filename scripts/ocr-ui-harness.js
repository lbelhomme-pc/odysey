const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs/promises");

const TEST_PDF = path.join(process.cwd(), "Test_pdf", "20251210113659656.pdf");
const SETTINGS_PAYLOAD = {
  savedProfiles: [],
  lastUsedPreferences: {
    fontFamily: "\"Aptos\", \"Segoe UI\", sans-serif",
    fontSize: 20,
    lineHeight: 1.8,
    letterSpacing: 0.12,
    wordSpacing: 0.16,
    maxLineLength: 72,
    pagePadding: 30,
    theme: "blanc",
    overlayPreset: "none",
    overlayOpacity: 0,
    overlayCustomColor: "#dbeafe",
    highlightMode: "none",
    focusMode: "none",
    colorationMode: "none",
    syllableLevel: "off",
    soundColorMode: "soft",
    syllableBreakMode: "none",
    readingGuideMode: "off",
    readingGuideLines: 1,
    readingGuideOpacity: 0.16,
    readingGuideColor: "#a0344a",
    verificationMode: "off",
    speechRate: 1,
    pauseBetweenSentences: 0,
    speechVoiceId: "",
    ocrLanguage: "fra",
    distractionFree: false
  },
  activeProfileId: "normal",
  recentFilesMeta: [],
  bookmarksByDocument: {},
  annotationsByDocument: {}
};

const OCR_LANGUAGE_FILES = {
  fra: ["node_modules", "@tesseract.js-data", "fra", "4.0.0_best_int", "fra.traineddata.gz"],
  eng: ["node_modules", "@tesseract.js-data", "eng", "4.0.0_best_int", "eng.traineddata.gz"]
};

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveBundledFilePath(pathSegments) {
  const root = process.cwd();
  const candidates = [
    path.join(root, ...pathSegments),
    path.join(app.getAppPath(), ...pathSegments)
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
    return { ok: false, reason: "OCR_LANGUAGE_UNSUPPORTED" };
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

ipcMain.handle("dialog:open-pdf", async () => ({
  filePath: TEST_PDF,
  fileName: path.basename(TEST_PDF)
}));

ipcMain.handle("file:read-pdf", async (_event, filePath) => {
  const bytes = await fs.readFile(filePath);
  return {
    bytes,
    fileName: path.basename(filePath),
    filePath
  };
});

ipcMain.handle("storage:load-settings", async () => SETTINGS_PAYLOAD);
ipcMain.handle("storage:save-settings", async () => ({ ok: true }));
ipcMain.handle("shell:open-path", async () => ({ ok: true }));
ipcMain.handle("shell:open-external", async () => ({ ok: true }));
ipcMain.handle("export:text-file", async () => ({ ok: true }));
ipcMain.handle("print:current-view", async () => ({ ok: true }));
ipcMain.handle("export:adapted-pdf", async () => ({ ok: true }));
ipcMain.handle("ocr:read-language-data", async (_event, language) => readBundledOcrLanguage(language));

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(process.cwd(), "src", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.webContents.on("console-message", (_event, level, message) => {
    console.log(`[renderer:${level}] ${message}`);
  });

  await win.loadFile(path.join(process.cwd(), "src", "index.html"));

  await win.webContents.executeJavaScript(`
    document.querySelector("#openPdfButton")?.click();
  `, true);

  await delay(2500);

  const beforeOcr = await win.webContents.executeJavaScript(`
    ({
      title: document.querySelector("#documentTitle")?.textContent || "",
      meta: document.querySelector("#documentMeta")?.textContent || "",
      ocrStatus: document.querySelector("#ocrStatusText")?.textContent || "",
      ocrHint: document.querySelector("#ocrHint")?.textContent || "",
      startDisabled: document.querySelector("#startOcrButton")?.disabled ?? null
    })
  `, true);

  console.log("BEFORE_OCR", JSON.stringify(beforeOcr, null, 2));

  await win.webContents.executeJavaScript(`
    document.querySelector("#startOcrButton")?.click();
  `, true);

  await delay(12000);

  const afterOcr = await win.webContents.executeJavaScript(`
    ({
      ocrStatus: document.querySelector("#ocrStatusText")?.textContent || "",
      ocrHint: document.querySelector("#ocrHint")?.textContent || "",
      statusLine: document.querySelector("#statusLine")?.textContent || "",
      progress: document.querySelector("#ocrProgressBar")?.value ?? null,
      progressValue: document.querySelector("#ocrProgressValue")?.textContent || "",
      startDisabled: document.querySelector("#startOcrButton")?.disabled ?? null,
      currentTitle: document.querySelector("#documentTitle")?.textContent || "",
      currentMeta: document.querySelector("#documentMeta")?.textContent || "",
      capturedError: window.__dysReaderLastOcrError || null
    })
  `, true);

  console.log("AFTER_OCR", JSON.stringify(afterOcr, null, 2));

  await win.destroy();
}

app.whenReady()
  .then(run)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    app.quit();
  });
