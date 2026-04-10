const { contextBridge, ipcRenderer } = require("electron");

function subscribe(channel, callback) {
  if (typeof callback !== "function") {
    return () => {};
  }

  const listener = () => callback();
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("dysReaderApi", {
  openPdfDialog: () => ipcRenderer.invoke("dialog:open-pdf"),
  readPdfFile: (filePath) => ipcRenderer.invoke("file:read-pdf", filePath),
  readOcrLanguageData: (language) => ipcRenderer.invoke("ocr:read-language-data", language),
  getLocalAiStatus: (model) => ipcRenderer.invoke("local-ai:status", model),
  generateLocalAiText: (payload) => ipcRenderer.invoke("local-ai:generate", payload),
  loadSettings: () => ipcRenderer.invoke("storage:load-settings"),
  saveSettings: (payload) => ipcRenderer.invoke("storage:save-settings", payload),
  openPath: (targetPath) => ipcRenderer.invoke("shell:open-path", targetPath),
  openExternalUrl: (targetUrl) => ipcRenderer.invoke("shell:open-external", targetUrl),
  saveTextFile: (payload) => ipcRenderer.invoke("export:text-file", payload),
  printCurrentView: () => ipcRenderer.invoke("print:current-view"),
  exportAdaptedPdf: (defaultFileName) => ipcRenderer.invoke("export:adapted-pdf", defaultFileName),
  onOpenPdfRequest: (callback) => subscribe("app:open-pdf", callback),
  onToggleImmersionRequest: (callback) => subscribe("app:toggle-immersion", callback),
  onToggleShortcutsHelpRequest: (callback) => subscribe("app:toggle-shortcuts-help", callback)
});
