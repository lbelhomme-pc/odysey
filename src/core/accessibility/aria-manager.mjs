/**
 * Module de gestion ARIA et préférences système.
 */

const BUTTON_LABELS = {
  openPdfButton: "Importer un PDF",
  printButton: "Imprimer la version adaptée",
  immersionButton: "Afficher ou masquer les réglages",
  saveProfileButton: "Enregistrer le profil personnalisé",
  deleteProfileButton: "Supprimer le profil personnalisé",
  openHeaderButton: "Importer un autre PDF",
  resetSettingsButton: "Réinitialiser les réglages",
  speechToggleButton: "Lancer ou arrêter la lecture audio",
  speechStopButton: "Mettre en pause la lecture audio",
  exportPdfButton: "Exporter le PDF adapté",
  openExternalButton: "Ouvrir le PDF original",
  bookmarkQuickButton: "Ajouter un marque-page rapide",
  exportNotesButton: "Exporter les notes et marque-pages",
  startOcrButton: "Lancer l'OCR local sur le document courant",
  cancelOcrButton: "Annuler l'OCR local en cours",
  floatingSidebarButton: "Afficher les réglages",
  supportDialogButton: "Ouvrir le panneau de soutien du projet",
  closeSupportDialogButton: "Fermer le panneau de soutien"
};

Object.assign(BUTTON_LABELS, {
  immersionButton: "Activer ou quitter le mode immersion",
  floatingSidebarButton: "Afficher le ruban principal",
  toggleSidebarButton: "Reduire ou afficher le ruban principal",
  refreshVoicesButton: "Recharger les voix audio disponibles"
});

function getLabelText(control) {
  const wrapper = control.closest("label");
  const label = wrapper?.querySelector("span");
  return label ? label.textContent.replace(/\s+/g, " ").trim() : control.id;
}

export class AriaManager {
  constructor() {
    this.controls = {};
    this.ribbon = null;
    this.readArea = null;
    this.statusLine = null;
    this.motionQuery = null;
    this.schemeQuery = null;
    this.onMotionChange = () => this.applySystemPreferences();
    this.onSchemeChange = () => this.applySystemPreferences();
  }

  /**
   * Initialise les attributs ARIA et les préférences système.
   * @param {object} options
   */
  init({ controls = {}, elements = {} } = {}) {
    this.controls = controls;
    this.ribbon = document.querySelector(".app-ribbon-shell");
    this.readArea = elements.readArea || document.querySelector("#readingArea");
    this.statusLine = elements.statusLine || document.querySelector("#statusLine");

    this.applyStaticRoles(elements);
    this.applyLabels();
    this.refreshSliderValues();
    this.applySystemPreferences();
    this.bindSystemPreferences();
  }

  /**
   * Met à jour l'état expansé du panneau latéral.
   * @param {boolean} isVisible
   */
  setRibbonExpanded(isVisible) {
    const expanded = isVisible ? "true" : "false";
    document.querySelector("#toggleSidebarButton")?.setAttribute("aria-expanded", expanded);
    document.querySelector("#floatingSidebarButton")?.setAttribute("aria-expanded", expanded);
    document.querySelector("#immersionButton")?.setAttribute("aria-expanded", expanded);
    this.ribbon?.setAttribute("aria-hidden", isVisible ? "false" : "true");
  }

  /**
   * Met à jour les valeurs ARIA de tous les sliders.
   */
  refreshSliderValues() {
    Object.values(this.controls).forEach((control) => {
      if (!control || control.tagName !== "INPUT" || control.type !== "range") {
        return;
      }

      control.setAttribute("role", "slider");
      control.setAttribute("aria-label", getLabelText(control));
      control.setAttribute("aria-valuemin", control.min || "0");
      control.setAttribute("aria-valuemax", control.max || "100");
      control.setAttribute("aria-valuenow", control.value || "0");
      const output = document.querySelector(`[data-output-for="${control.id}"]`);
      if (output?.textContent?.trim()) {
        control.setAttribute("aria-valuetext", output.textContent.trim());
      }
    });
  }

  /**
   * Nettoie les listeners du module.
   */
  destroy() {
    this.motionQuery?.removeEventListener?.("change", this.onMotionChange);
    this.schemeQuery?.removeEventListener?.("change", this.onSchemeChange);
  }

  applyStaticRoles(elements) {
    document.querySelector(".main-stage")?.setAttribute("role", "main");
    this.ribbon?.setAttribute("role", "region");
    this.ribbon?.setAttribute("aria-label", "Ruban principal");
    document.querySelector("#profilesList")?.setAttribute("role", "navigation");
    document.querySelector("#profilesList")?.setAttribute("aria-label", "Profils intégrés");
    document.querySelector("#customProfilesList")?.setAttribute("role", "navigation");
    document.querySelector("#customProfilesList")?.setAttribute("aria-label", "Profils personnalisés");
    this.readArea?.setAttribute("aria-label", "Zone de lecture adaptée");
    this.readArea?.setAttribute("role", "region");
    this.readArea?.setAttribute("aria-describedby", "keyboardHint");
    this.readArea?.setAttribute("tabindex", "0");
    this.statusLine?.setAttribute("aria-live", "polite");
    this.statusLine?.setAttribute("aria-atomic", "true");
    document.querySelector("#warningBanner")?.setAttribute("role", "status");
    document.querySelector("#verificationSummary")?.setAttribute("role", "status");
    document.querySelector("#supportDialogButton")?.setAttribute("aria-haspopup", "dialog");
    elements.profileFeedback?.setAttribute("role", "status");
    elements.settingsFeedback?.setAttribute("role", "status");
  }

  applyLabels() {
    Object.entries(BUTTON_LABELS).forEach(([id, label]) => {
      document.querySelector(`#${id}`)?.setAttribute("aria-label", label);
    });

    Object.values(this.controls).forEach((control) => {
      if (!control) {
        return;
      }

      const tagName = control.tagName;
      const ariaLabel = getLabelText(control);
      control.setAttribute("aria-label", ariaLabel);
      if (tagName === "SELECT") {
        control.removeAttribute("role");
      }
    });
  }

  bindSystemPreferences() {
    this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.schemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    this.motionQuery.addEventListener?.("change", this.onMotionChange);
    this.schemeQuery.addEventListener?.("change", this.onSchemeChange);
  }

  applySystemPreferences() {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const darkScheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.motionPreference = reducedMotion ? "reduce" : "normal";
    document.documentElement.dataset.systemColorScheme = darkScheme ? "dark" : "light";
  }
}
