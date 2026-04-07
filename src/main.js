const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs/promises");

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

let mainWindow = null;

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
