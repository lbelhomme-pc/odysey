const STORAGE_KEY = "dyslecteur-checklist-recette-v2";

const STATUS_OPTIONS = [
  { value: "todo", label: "Non testé" },
  { value: "ok", label: "OK" },
  { value: "review", label: "À revoir" },
  { value: "fail", label: "KO" },
  { value: "na", label: "N/A" }
];

const PROFILE_STATUSES = [
  { value: "todo", label: "Non testé" },
  { value: "ok", label: "OK" },
  { value: "mixed", label: "Mitigé" },
  { value: "fail", label: "KO" },
  { value: "na", label: "N/A" }
];

const COMMON_CHECKS = [
  {
    id: "import",
    title: "Import et structure",
    checks: [
      "Le PDF s'importe sans erreur ni écran vide.",
      "Le nombre de pages paraît correct.",
      "L'ordre de lecture des blocs reste logique.",
      "Les titres, listes et paragraphes restent bien séparés.",
      "Les tableaux ne sont pas écrasés ou fusionnés n'importe comment."
    ]
  },
  {
    id: "normal",
    title: "Mode normal",
    checks: [
      "Le texte s'affiche sans coloration ni syllabes non demandées.",
      "Les lettres muettes ne sont pas grisées.",
      "Le rendu reste fidèle au texte source reconstitué.",
      "Le mode actif affiché est compréhensible pour l'utilisateur."
    ]
  },
  {
    id: "audio",
    title: "Audio, réglette et focus",
    checks: [
      "La vitesse x1 est confortable.",
      "Les boutons audio sont lisibles et ne débordent pas.",
      "La réglette ou la fenêtre de lecture reste exploitable.",
      "La reprise audio revient au bon endroit."
    ]
  },
  {
    id: "verification",
    title: "Vérification et alertes",
    checks: [
      "Les alertes sont utiles et non anxiogènes.",
      "Les faux positifs restent limités.",
      "La relecture ciblée ne masque pas abusivement le contenu.",
      "Les messages expliquent clairement pourquoi un bloc est signalé."
    ]
  },
  {
    id: "print",
    title: "Impression et export",
    checks: [
      "L'aperçu imprimé reste lisible.",
      "La mise en page A4 reste propre.",
      "Les éléments interactifs ne s'impriment pas.",
      "Le PDF adapté exporté reste cohérent."
    ]
  }
];

const PDF_TYPES = [
  {
    id: "texte-simple",
    title: "PDF texte simple",
    goal: "Roman, article ou cours linéaire sans mise en page complexe.",
    examples: "Roman, fiche de lecture, article",
    watchouts: [
      "Vérifier que le mode normal est vraiment neutre.",
      "Contrôler surtout l'aération, l'audio et l'impression."
    ]
  },
  {
    id: "fiche-scolaire",
    title: "PDF scolaire avec titres et listes",
    goal: "Document avec titres, consignes, listes et blocs courts.",
    examples: "Français, histoire, SVT",
    watchouts: [
      "Surveiller la hiérarchie des titres.",
      "Vérifier que les listes restent lisibles."
    ]
  },
  {
    id: "litterature",
    title: "PDF littérature / théâtre / dialogue",
    goal: "Tester les dialogues, noms de personnages et extraits.",
    examples: "Théâtre, poésie, texte dialogué",
    watchouts: [
      "Les noms de personnages ne doivent pas être pris pour des codes.",
      "Les répliques doivent garder une lecture naturelle."
    ]
  },
  {
    id: "maths-physique",
    title: "PDF maths / physique / chimie",
    goal: "Valider formules, unités, exposants et verbalisation.",
    examples: "Cours, exercices, formules",
    watchouts: [
      "Les vraies formules doivent être détectées.",
      "La verbalisation doit rester compréhensible."
    ]
  },
  {
    id: "tableaux-admin",
    title: "PDF tableaux / garanties / administratif",
    goal: "Éviter les faux positifs maths et garder les tableaux lisibles.",
    examples: "Garanties santé, tableaux de remboursement, administratif",
    watchouts: [
      "Les pourcentages et montants ne doivent pas tous devenir des formules.",
      "Les lignes administratives doivent rester sobres."
    ]
  },
  {
    id: "multi-colonnes",
    title: "PDF en plusieurs colonnes",
    goal: "Tester l'ordre de lecture dans une mise en page complexe.",
    examples: "Magazine, revue, brochure",
    watchouts: [
      "Les colonnes ne doivent pas se mélanger.",
      "L'audio doit suivre le bon ordre."
    ]
  },
  {
    id: "ocr-propre",
    title: "PDF scanné propre",
    goal: "Valider l'OCR sur un scan net.",
    examples: "Scan bien cadré, bonne qualité",
    watchouts: [
      "Le texte OCR doit rester propre et ordonné.",
      "Le rapport OCR doit être compréhensible."
    ]
  },
  {
    id: "ocr-degrade",
    title: "PDF scanné dégradé",
    goal: "Tester la robustesse OCR sur des scans bruités ou flous.",
    examples: "Photocopie, scan jaunissant, document penché",
    watchouts: [
      "L'application doit rester stable.",
      "Les zones douteuses doivent être clairement signalées."
    ]
  },
  {
    id: "pdf-long",
    title: "PDF long",
    goal: "Mesurer la stabilité sur un document de plusieurs dizaines de pages.",
    examples: "Cours complet, manuel, dossier",
    watchouts: [
      "Contrôler la performance et la navigation.",
      "Tester aussi bookmarks, annotations et audio."
    ]
  },
  {
    id: "pdf-mixte",
    title: "PDF mixte",
    goal: "Cas réel avec texte, tableaux, images et blocs hétérogènes.",
    examples: "Dossier pédagogique complet",
    watchouts: [
      "Vérifier que les profils restent cohérents selon les blocs.",
      "Contrôler le rendu imprimé final."
    ]
  }
];

const PROFILES = [
  "Normal",
  "Lecture visuelle allégée",
  "Audio",
  "Décodage renforcé",
  "Compréhension simplifiée",
  "Dyslexie légère",
  "Dyslexie sévère",
  "Dyscalculie",
  "TDAH - Attention",
  "Dyspraxie - Motricité",
  "Enseignant / Ortho"
];

const state = loadState();

const elements = {
  testerName: document.querySelector("#testerName"),
  testDate: document.querySelector("#testDate"),
  appVersion: document.querySelector("#appVersion"),
  testDevice: document.querySelector("#testDevice"),
  globalNotes: document.querySelector("#globalNotes"),
  pdfTypesOverview: document.querySelector("#pdfTypesOverview"),
  commonChecksPanel: document.querySelector("#commonChecksPanel"),
  pdfProtocolChecklist: document.querySelector("#pdfProtocolChecklist"),
  completionCount: document.querySelector("#completionCount"),
  completionText: document.querySelector("#completionText"),
  statusOkCount: document.querySelector("#statusOkCount"),
  statusReviewCount: document.querySelector("#statusReviewCount"),
  statusFailCount: document.querySelector("#statusFailCount"),
  printChecklistButton: document.querySelector("#printChecklistButton"),
  exportChecklistButton: document.querySelector("#exportChecklistButton"),
  importChecklistButton: document.querySelector("#importChecklistButton"),
  importChecklistFile: document.querySelector("#importChecklistFile"),
  resetChecklistButton: document.querySelector("#resetChecklistButton"),
  toggleAllSectionsButton: document.querySelector("#toggleAllSectionsButton")
};

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      meta: parsed.meta || {},
      statuses: parsed.statuses || {},
      checks: parsed.checks || {},
      notes: parsed.notes || {}
    };
  } catch {
    return { meta: {}, statuses: {}, checks: {}, notes: {} };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createStatusGroup(name, options, currentValue, onChange, legendText = "Statut") {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "status-group";

  const legend = document.createElement("legend");
  legend.textContent = legendText;
  fieldset.append(legend);

  const wrap = document.createElement("div");
  wrap.className = "status-options";

  options.forEach((option) => {
    const label = document.createElement("label");
    label.className = "status-option";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.value = option.value;
    input.checked = currentValue === option.value;
    input.addEventListener("change", () => onChange(option.value));

    const visual = document.createElement("span");
    visual.dataset.status = option.value;
    visual.textContent = option.label;

    label.append(input, visual);
    wrap.append(label);
  });

  fieldset.append(wrap);
  return fieldset;
}

function createChecklist(groupKey, items) {
  const list = document.createElement("ul");
  list.className = "check-list";

  items.forEach((item, index) => {
    const checkKey = `${groupKey}::${index}`;
    const li = document.createElement("li");
    li.className = "check-item";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = checkKey;
    input.checked = Boolean(state.checks[checkKey]);
    input.addEventListener("change", () => {
      state.checks[checkKey] = input.checked;
      saveState();
      refreshSummary();
    });

    const label = document.createElement("label");
    label.setAttribute("for", checkKey);
    const text = document.createElement("span");
    text.textContent = item;
    label.append(text);

    li.append(input, label);
    list.append(li);
  });

  return list;
}

function createNotesBox(groupKey, placeholder) {
  const wrapper = document.createElement("div");
  wrapper.className = "notes-box";

  const textarea = document.createElement("textarea");
  textarea.rows = 4;
  textarea.placeholder = placeholder;
  textarea.value = state.notes[groupKey] || "";
  textarea.addEventListener("input", () => {
    state.notes[groupKey] = textarea.value;
    saveState();
  });

  wrapper.append(textarea);
  return wrapper;
}

function renderOverview() {
  elements.pdfTypesOverview.innerHTML = "";
  PDF_TYPES.forEach((item) => {
    const card = document.createElement("article");
    card.className = "overview-card";
    card.innerHTML = `
      <div class="badge-row">
        <span class="badge info">${item.title}</span>
        <span class="badge soft">${item.examples}</span>
      </div>
      <p>${item.goal}</p>
    `;
    elements.pdfTypesOverview.append(card);
  });
}

function renderCommonChecks() {
  elements.commonChecksPanel.innerHTML = "";
  COMMON_CHECKS.forEach((group) => {
    const card = document.createElement("article");
    card.className = "feature-card";
    card.append(
      (() => {
        const head = document.createElement("div");
        head.className = "card-head";
        head.innerHTML = `<h3>${group.title}</h3><p>À tester sur tous les types de PDF.</p>`;
        return head;
      })(),
      createChecklist(`common:${group.id}`, group.checks)
    );
    elements.commonChecksPanel.append(card);
  });
}

function renderPdfProtocol() {
  elements.pdfProtocolChecklist.innerHTML = "";

  PDF_TYPES.forEach((pdfType) => {
    const pdfKey = `pdf:${pdfType.id}`;
    const article = document.createElement("article");
    article.className = "pdf-protocol-card";

    const head = document.createElement("div");
    head.className = "card-head";
    head.innerHTML = `
      <div class="badge-row">
        <span class="badge info">${pdfType.title}</span>
        <span class="badge soft">${pdfType.examples}</span>
      </div>
      <h3>${pdfType.goal}</h3>
      <p>Utilise cette fiche pour ce type précis de document, puis passe tous les profils ci-dessous.</p>
    `;

    const summaryRow = document.createElement("div");
    summaryRow.className = "pdf-section-grid";

    summaryRow.append(
      createStatusGroup(
        `${pdfKey}-status`,
        STATUS_OPTIONS,
        state.statuses[pdfKey] || "todo",
        (value) => {
          state.statuses[pdfKey] = value;
          saveState();
          refreshSummary();
        },
        "Statut global du type de PDF"
      ),
      (() => {
        const box = document.createElement("div");
        box.className = "support-note";
        box.innerHTML = `<strong>Points de vigilance</strong><br />${pdfType.watchouts.join("<br />")}`;
        return box;
      })()
    );

    const commonCard = document.createElement("section");
    commonCard.className = "protocol-block";
    commonCard.innerHTML = `<h4>Points à vérifier sur ce type de PDF</h4>`;
    const commonChecks = COMMON_CHECKS.flatMap((group) =>
      group.checks.map((check) => `${group.title} : ${check}`)
    );
    commonCard.append(createChecklist(`${pdfKey}:checks`, commonChecks));

    const profileCard = document.createElement("section");
    profileCard.className = "protocol-block";
    profileCard.innerHTML = `<h4>Test de tous les profils sur ce type de PDF</h4>`;

    const profileList = document.createElement("div");
    profileList.className = "profile-matrix";

    PROFILES.forEach((profile) => {
      const profileKey = `${pdfKey}:profile:${profile}`;
      const row = document.createElement("div");
      row.className = "profile-row";

      const label = document.createElement("div");
      label.className = "profile-row-label";
      label.textContent = profile;

      const controls = createStatusGroup(
        `${profileKey}-status`,
        PROFILE_STATUSES,
        state.statuses[profileKey] || "todo",
        (value) => {
          state.statuses[profileKey] = value;
          saveState();
          refreshSummary();
        },
        "Statut du profil"
      );
      controls.classList.add("status-group--compact");

      row.append(label, controls);
      profileList.append(row);
    });

    profileCard.append(profileList);

    const notes = createNotesBox(
      `${pdfKey}:notes`,
      "PDF utilisé, bug observé, profils problématiques, capture à reprendre, correction prioritaire…"
    );

    article.append(head, summaryRow, commonCard, profileCard, notes);
    elements.pdfProtocolChecklist.append(article);
  });
}

function refreshSummary() {
  const statusValues = Object.values(state.statuses);
  const completedChecks = Object.values(state.checks).filter(Boolean).length;
  const totalChecks =
    COMMON_CHECKS.flatMap((group) => group.checks).length +
    PDF_TYPES.length * COMMON_CHECKS.flatMap((group) => group.checks).length;

  const okCount = statusValues.filter((value) => value === "ok").length;
  const reviewCount = statusValues.filter((value) => value === "review" || value === "mixed").length;
  const failCount = statusValues.filter((value) => value === "fail").length;

  elements.completionCount.textContent = `${completedChecks} / ${totalChecks}`;
  elements.completionText.textContent =
    completedChecks === 0
      ? "Aucun point validé pour l'instant."
      : `${Math.round((completedChecks / totalChecks) * 100)} % des points détaillés sont cochés.`;
  elements.statusOkCount.textContent = String(okCount);
  elements.statusReviewCount.textContent = String(reviewCount);
  elements.statusFailCount.textContent = String(failCount);
}

function bindMetaFields() {
  const mapping = [
    ["testerName", elements.testerName],
    ["testDate", elements.testDate],
    ["appVersion", elements.appVersion],
    ["testDevice", elements.testDevice],
    ["globalNotes", elements.globalNotes]
  ];

  mapping.forEach(([key, element]) => {
    if (!element) {
      return;
    }
    element.value = state.meta[key] || "";
    element.oninput = () => {
      state.meta[key] = element.value;
      saveState();
    };
  });

  if (!state.meta.testDate) {
    const today = new Date().toISOString().slice(0, 10);
    elements.testDate.value = today;
    state.meta.testDate = today;
    saveState();
  }
}

function exportState() {
  const payload = { exportedAt: new Date().toISOString(), ...state };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `checklist-dyslecteur-${(state.meta.testDate || "session").replaceAll("/", "-")}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importState(file) {
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      state.meta = parsed.meta || {};
      state.statuses = parsed.statuses || {};
      state.checks = parsed.checks || {};
      state.notes = parsed.notes || {};
      saveState();
      boot();
    } catch (error) {
      window.alert(`Import impossible : ${error.message}`);
    }
  };
  reader.readAsText(file, "utf-8");
}

function resetState() {
  if (!window.confirm("Réinitialiser toute la checklist locale ?")) {
    return;
  }

  state.meta = {};
  state.statuses = {};
  state.checks = {};
  state.notes = {};
  saveState();
  boot();
}

function toggleSections() {
  const sections = [...document.querySelectorAll(".checklist-section")];
  const hasClosedSection = sections.some((section) => !section.open);
  sections.forEach((section) => {
    section.open = hasClosedSection;
  });
  elements.toggleAllSectionsButton.textContent = hasClosedSection ? "Tout replier" : "Tout déplier";
}

function bindActions() {
  elements.printChecklistButton.addEventListener("click", () => window.print());
  elements.exportChecklistButton.addEventListener("click", exportState);
  elements.importChecklistButton.addEventListener("click", () => elements.importChecklistFile.click());
  elements.importChecklistFile.addEventListener("change", (event) => importState(event.target.files?.[0]));
  elements.resetChecklistButton.addEventListener("click", resetState);
  elements.toggleAllSectionsButton.addEventListener("click", toggleSections);
}

function boot() {
  bindMetaFields();
  renderOverview();
  renderCommonChecks();
  renderPdfProtocol();
  refreshSummary();
  elements.toggleAllSectionsButton.textContent = "Tout replier";
}

bindActions();
boot();
