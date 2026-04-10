function detectAppRootPath() {
  const { pathname } = window.location;
  const srcMarker = "/src/";
  const markerIndex = pathname.lastIndexOf(srcMarker);
  if (markerIndex >= 0) {
    return pathname.slice(0, markerIndex + 1);
  }
  return pathname.endsWith("/") ? pathname : pathname.replace(/[^/]+$/, "");
}

function canRegisterServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return false;
  }

  if (window.isSecureContext) {
    return true;
  }

  return /^(localhost|127\\.0\\.0\\.1)$/i.test(window.location.hostname);
}

export class PwaManager {
  constructor() {
    this.deferredPrompt = null;
    this.elements = null;
    this.rootPath = detectAppRootPath();
    this.hadInitialController = false;
    this.hasReloadedForUpdate = false;
  }

  init(elements = {}) {
    this.elements = elements;
    this.hadInitialController = Boolean(navigator.serviceWorker?.controller);
    this.bindInstallEvents();
    this.bindAppInstalledEvent();
    this.bindControllerChangeEvent();
    void this.registerServiceWorker();
    return this;
  }

  bindInstallEvents() {
    this.elements.installButton?.addEventListener("click", () => {
      void this.promptInstall();
    });

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      this.deferredPrompt = event;
      this.showInstallButton(true);
    });
  }

  bindAppInstalledEvent() {
    window.addEventListener("appinstalled", () => {
      this.deferredPrompt = null;
      this.showInstallButton(false);
      if (this.elements.statusLine) {
        this.elements.statusLine.textContent = "Application web installée sur cet appareil.";
      }
    });
  }

  bindControllerChangeEvent() {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!this.hadInitialController || this.hasReloadedForUpdate) {
        return;
      }

      this.hasReloadedForUpdate = true;
      window.location.reload();
    });
  }

  async registerServiceWorker() {
    if (!canRegisterServiceWorker()) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register(`${this.rootPath}service-worker.js`, {
        scope: this.rootPath
      });
      await registration.update();
    } catch (error) {
      console.warn("Impossible d'enregistrer le service worker PWA", error);
    }
  }

  async promptInstall() {
    if (!this.deferredPrompt) {
      if (this.elements.statusLine) {
        this.elements.statusLine.textContent =
          "L'installation web n'est pas disponible ici. Ouvre Odysey via HTTPS ou utilise le menu du navigateur.";
      }
      return false;
    }

    const promptEvent = this.deferredPrompt;
    this.deferredPrompt = null;
    this.showInstallButton(false);

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;

    if (choice?.outcome !== "accepted") {
      this.deferredPrompt = promptEvent;
      this.showInstallButton(true);
      if (this.elements.statusLine) {
        this.elements.statusLine.textContent = "Installation web annulée.";
      }
      return false;
    }

    if (this.elements.statusLine) {
      this.elements.statusLine.textContent = "Installation web en cours...";
    }
    return true;
  }

  showInstallButton(visible) {
    const button = this.elements.installButton;
    if (!button) {
      return;
    }
    button.hidden = !visible;
  }
}
