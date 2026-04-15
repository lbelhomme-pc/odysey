/**
 * Module de navigation clavier globale pour DysLecteur.
 */

const SHORTCUTS = [
  { keys: "Ctrl+O", action: "Ouvrir un PDF" },
  { keys: "F11 / Ctrl+Shift+I", action: "Mode immersion" },
  { keys: "Échap", action: "Quitter le mode immersion" },
  { keys: "Espace", action: "Lecture audio play / pause" },
  { keys: "Flèche droite / gauche", action: "Bloc suivant / précédent pendant l'audio" },
  { keys: "Flèche haut / bas", action: "Réglette ou sélection de lecture" },
  { keys: "PageDown / PageUp", action: "Page suivante / précédente" },
  { keys: "Ctrl+= / Ctrl+-", action: "Zoom de lecture" },
  { keys: "Ctrl+1 à Ctrl+9", action: "Changer de profil" },
  { keys: "Ctrl+,", action: "Afficher ou masquer les réglages" },
  { keys: "Ctrl+P", action: "Imprimer la version adaptée" },
  { keys: "F1 / Ctrl+?", action: "Aide des raccourcis" }
];

function isEditableTarget(target) {
  return Boolean(
    target &&
      (target.closest("input, textarea, select, [contenteditable='true']") ||
        target.getAttribute?.("role") === "textbox")
  );
}

function isActivationKey(event) {
  return event.key === "Enter" || event.key === " ";
}

export class KeyboardNav {
  constructor() {
    this.app = null;
    this.dialog = null;
    this.onKeyDown = (event) => this.handleKeyDown(event);
    this.onDialogClick = (event) => this.handleDialogClick(event);
    this.onDialogKeyDown = (event) => this.handleDialogKeyDown(event);
  }

  /**
   * Initialise les raccourcis clavier.
   * @param {object} appInstance
   */
  init(appInstance) {
    this.destroy();
    this.app = appInstance;
    this.dialog = this.createHelpDialog();
    document.addEventListener("keydown", this.onKeyDown);
    this.dialog.addEventListener("click", this.onDialogClick);
    this.dialog.addEventListener("keydown", this.onDialogKeyDown);
  }

  /**
   * Nettoie les listeners du module.
   */
  destroy() {
    document.removeEventListener("keydown", this.onKeyDown);
    this.dialog?.removeEventListener("click", this.onDialogClick);
    this.dialog?.removeEventListener("keydown", this.onDialogKeyDown);
    this.dialog?.remove();
    this.dialog = null;
    this.app = null;
  }

  createHelpDialog() {
    const dialog = document.createElement("dialog");
    dialog.className = "dl-shortcuts-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-labelledby", "keyboardHelpTitle");
    dialog.setAttribute("aria-modal", "true");
    dialog.innerHTML = `
      <form method="dialog" class="dl-shortcuts-dialog__surface">
        <div class="dl-shortcuts-dialog__header">
          <h2 id="keyboardHelpTitle">Raccourcis clavier</h2>
          <button type="submit" class="ghost-action subtle" aria-label="Fermer l'aide des raccourcis">Fermer</button>
        </div>
        <div class="dl-shortcuts-dialog__body">
          <ul class="dl-shortcuts-list">
            ${SHORTCUTS.map((shortcut) => `<li><strong>${shortcut.keys}</strong><span>${shortcut.action}</span></li>`).join("")}
          </ul>
        </div>
      </form>
    `;
    document.body.appendChild(dialog);
    return dialog;
  }

  handleDialogClick(event) {
    if (event.target === this.dialog) {
      this.dialog.close();
    }
  }

  handleDialogKeyDown(event) {
    if (event.key === "Escape") {
      this.dialog.close();
    }
  }

  handleKeyDown(event) {
    if (!this.app) {
      return;
    }

    const editable = isEditableTarget(event.target);
    const inReadingArea = this.app.isReadingTarget?.(event.target);

    if (event.key === "F1" || (event.ctrlKey && event.key === "?")) {
      event.preventDefault();
      this.toggleHelp();
      return;
    }

    if (editable && !(event.ctrlKey && [",", "o", "p", "b"].includes(event.key.toLowerCase()))) {
      return;
    }

    if (event.ctrlKey && event.key.toLowerCase() === "o") {
      event.preventDefault();
      this.app.openPdf?.();
      return;
    }

    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "i") {
      event.preventDefault();
      this.app.toggleImmersion?.();
      return;
    }

    if (event.key === "F11") {
      event.preventDefault();
      this.app.toggleImmersion?.();
      return;
    }

    if (event.key === "Escape") {
      this.app.exitImmersion?.();
      return;
    }

    if (event.ctrlKey && event.key === ",") {
      event.preventDefault();
      this.app.toggleSettings?.();
      return;
    }

    if (event.ctrlKey && event.key.toLowerCase() === "p") {
      event.preventDefault();
      this.app.printAdapted?.();
      return;
    }

    if (event.ctrlKey && /^[1-9]$/u.test(event.key)) {
      event.preventDefault();
      this.app.activateProfileByShortcut?.(Number(event.key));
      return;
    }

    if (event.ctrlKey && (event.key === "=" || event.key === "+")) {
      event.preventDefault();
      this.app.adjustZoom?.(1);
      return;
    }

    if (event.ctrlKey && event.key === "-") {
      event.preventDefault();
      this.app.adjustZoom?.(-1);
      return;
    }

    if (!inReadingArea) {
      return;
    }

    if (event.key === " " || event.code === "Space") {
      event.preventDefault();
      this.app.toggleSpeech?.();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      this.app.moveGuideOrSelection?.(-1);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.app.moveGuideOrSelection?.(1);
      return;
    }

    if (event.key === "PageDown") {
      event.preventDefault();
      this.app.movePage?.(1);
      return;
    }

    if (event.key === "PageUp") {
      event.preventDefault();
      this.app.movePage?.(-1);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      this.app.moveAudioCursor?.(1);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      this.app.moveAudioCursor?.(-1);
      return;
    }

    if (isActivationKey(event) && event.target?.matches?.("[role='button']")) {
      event.preventDefault();
      event.target.click();
    }
  }

  /**
   * Ouvre ou ferme le panneau d'aide des raccourcis.
   */
  toggleHelp() {
    if (!this.dialog) {
      return;
    }

    if (this.dialog.open) {
      this.dialog.close();
      return;
    }

    this.dialog.showModal();
    this.dialog.querySelector("button")?.focus();
  }
}
