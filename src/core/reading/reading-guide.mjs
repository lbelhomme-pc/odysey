/**
 * Module de reglette de lecture pour la zone de lecture.
 * Le guide visuel se superpose au texte sans modifier le DOM du document.
 */

const GUIDE_MODES = new Set(["off", "ruler", "window"]);

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export class ReadingGuide {
  constructor({
    mode = "off",
    lineHeight = 36,
    visibleLines = 1,
    color = "rgba(160, 52, 74, 0.16)",
    opacity = 0.16
  } = {}) {
    this.container = null;
    this.host = null;
    this.root = null;
    this.ruler = null;
    this.windowFrame = null;
    this.topShade = null;
    this.bottomShade = null;
    this.mode = GUIDE_MODES.has(mode) ? mode : "off";
    this.lineIndex = 0;
    this.contentTop = null;
    this.lineHeight = Math.max(18, Number(lineHeight) || 36);
    this.visibleLines = clamp(Number(visibleLines) || 1, 1, 3);
    this.color = color;
    this.opacity = clamp(Number(opacity) || 0.16, 0.05, 0.3);
    this.onScroll = () => this.render();
    this.onResize = () => this.render();
  }

  /**
   * Attache la reglette a un conteneur scrollable.
   * @param {HTMLElement} container
   */
  attach(container) {
    if (!container || this.container === container) {
      return;
    }

    this.destroy();
    this.container = container;
    this.host = this.container.parentElement || this.container;
    if (getComputedStyle(this.host).position === "static") {
      this.host.style.position = "relative";
    }

    this.root = document.createElement("div");
    this.root.className = "dl-reading-guide";
    this.root.setAttribute("aria-hidden", "true");

    this.topShade = document.createElement("div");
    this.topShade.className = "dl-reading-guide__shade dl-reading-guide__shade--top";

    this.ruler = document.createElement("div");
    this.ruler.className = "dl-reading-guide__ruler";

    this.windowFrame = document.createElement("div");
    this.windowFrame.className = "dl-reading-guide__window";

    this.bottomShade = document.createElement("div");
    this.bottomShade.className = "dl-reading-guide__shade dl-reading-guide__shade--bottom";

    this.root.append(this.topShade, this.ruler, this.windowFrame, this.bottomShade);
    this.host.appendChild(this.root);

    this.container.addEventListener("scroll", this.onScroll, { passive: true });
    window.addEventListener("resize", this.onResize);
    this.render();
  }

  /**
   * Deplace la reglette vers une ligne logique.
   * @param {number} lineIndex
   */
  moveTo(lineIndex) {
    this.contentTop = null;
    this.lineIndex = Math.max(0, Math.round(Number(lineIndex) || 0));
    this.render();
  }

  /**
   * Place la reglette a une position verticale precise dans le contenu.
   * @param {number} contentTop
   */
  moveToContentTop(contentTop) {
    const safeTop = Math.max(0, Number(contentTop) || 0);
    this.contentTop = safeTop;
    this.lineIndex = safeTop / this.lineHeight;
    this.render();
  }

  /**
   * Deplace la reglette d'une ligne vers le haut.
   */
  moveUp() {
    this.moveTo(this.lineIndex - 1);
  }

  /**
   * Deplace la reglette d'une ligne vers le bas.
   */
  moveDown() {
    this.moveTo(this.lineIndex + 1);
  }

  /**
   * Change le mode d'affichage de la reglette.
   * @param {"off"|"ruler"|"window"} mode
   */
  setMode(mode) {
    this.mode = GUIDE_MODES.has(mode) ? mode : "off";
    this.render();
  }

  /**
   * Met a jour la hauteur de ligne utilisee pour positionner le guide.
   * @param {number} lineHeight
   */
  setLineHeight(lineHeight) {
    this.lineHeight = Math.max(18, Number(lineHeight) || this.lineHeight);
    this.render();
  }

  /**
   * Met a jour le nombre de lignes visibles.
   * @param {number} visibleLines
   */
  setVisibleLines(visibleLines) {
    this.visibleLines = clamp(Number(visibleLines) || this.visibleLines, 1, 3);
    this.render();
  }

  /**
   * Met a jour la couleur du guide.
   * @param {string} color
   */
  setColor(color) {
    this.color = color || this.color;
    this.render();
  }

  /**
   * Met a jour l'opacite du guide.
   * @param {number} opacity
   */
  setOpacity(opacity) {
    this.opacity = clamp(Number(opacity) || this.opacity, 0.05, 0.3);
    this.render();
  }

  /**
   * Place le guide sur le bloc fourni.
   * @param {HTMLElement | null} block
   */
  moveToBlock(block) {
    if (!this.container || !block) {
      return;
    }

    const containerRect = this.container.getBoundingClientRect();
    const blockRect = block.getBoundingClientRect();
    const topInContent = blockRect.top - containerRect.top + this.container.scrollTop;
    this.moveToContentTop(topInContent);
  }

  /**
   * Nettoie les listeners et l'overlay.
   */
  destroy() {
    if (this.container) {
      this.container.removeEventListener("scroll", this.onScroll);
    }
    window.removeEventListener("resize", this.onResize);
    this.root?.remove();
    this.container = null;
    this.host = null;
    this.root = null;
    this.ruler = null;
    this.windowFrame = null;
    this.topShade = null;
    this.bottomShade = null;
  }

  render() {
    if (!this.container || !this.root || !this.ruler || !this.windowFrame || !this.topShade || !this.bottomShade) {
      return;
    }

    const visibleHeight = this.container.clientHeight;
    const guideHeight = this.lineHeight * this.visibleLines;
    const visibleTop =
      (this.contentTop == null ? this.lineIndex * this.lineHeight : this.contentTop) - this.container.scrollTop;
    const boundedTop = clamp(visibleTop, 0, Math.max(0, visibleHeight - guideHeight));
    const boundedBottom = clamp(visibleHeight - boundedTop - guideHeight, 0, visibleHeight);

    this.root.hidden = this.mode === "off";
    this.root.style.top = `${this.container.offsetTop}px`;
    this.root.style.left = `${this.container.offsetLeft}px`;
    this.root.style.width = `${this.container.clientWidth}px`;
    this.root.style.height = `${this.container.clientHeight}px`;
    this.root.style.setProperty("--dl-guide-color", this.color);
    this.root.style.setProperty("--dl-guide-opacity", String(this.opacity));
    this.root.style.setProperty("--dl-guide-top", `${boundedTop}px`);
    this.root.style.setProperty("--dl-guide-height", `${guideHeight}px`);
    this.root.style.setProperty("--dl-guide-bottom", `${boundedBottom}px`);
    this.root.dataset.mode = this.mode;
  }
}
