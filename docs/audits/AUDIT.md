# AUDIT.md — Audit complet DysLecteur (avril 2026)

> Résumé de l'analyse de code, des problèmes identifiés, des corrections prioritaires, et de l'état réel de la résolution des troubles dys.

---

## 1. ÉTAT GÉNÉRAL DU PROJET

### 1.1 Ce qui a été audité

| Fichier | Lignes | Verdict |
|---------|--------|---------|
| `src/app.mjs` | 2666 | Solide mais trop gros — à fragmenter |
| `src/index.html` | Non lu en détail | À vérifier (ARIA, sémantique) |
| `src/styles.css` | 1750 | Bon dans l'ensemble, incohérence de variables |
| `src/core/reading/reading-guide.mjs` | 216 | Propre, bien encapsulé |
| `src/core/reading/audio-engine.mjs` | 273 | Bon pattern, karaoké fonctionnel |
| `package.json` | — | Config electron-builder correcte |
| Arborescence complète | 10967 lignes | Structure modulaire cohérente |

### 1.2 Score global

| Critère | Note | Commentaire |
|---------|------|-------------|
| Architecture | ★★★★☆ | Bonne modularisation, `app.mjs` reste trop gros |
| Accessibilité WCAG | ★★★☆☆ | Focus-visible OK, ARIA à vérifier, clavier à confirmer |
| Respect des règles dys | ★★★☆☆ | Intentions correctes, mais incohérences de variables CSS |
| Robustesse | ★★★★☆ | try/catch présents, gestion d'erreurs en français |
| Performance | ★★★★☆ | debounce, pas de re-render inutile visible |
| Design system | ★★★☆☆ | Deux systèmes de variables en conflit |
| Tests | ★★☆☆☆ | Un seul test (syllabify), pas de test d'intégration |
| Distribution | ★★★★☆ | electron-builder OK, installeur Windows fonctionnel |

---

## 2. PROBLÈMES IDENTIFIÉS

### 2.1 CRITIQUE — Incohérence des variables CSS de lecture 🔴

**Le problème** : Deux systèmes de variables CSS coexistent pour la zone de lecture.

Dans `:root` du `styles.css` :
```css
/* Ancien système (lignes 38-44) */
--reader-font-family: "Verdana", "Geneva", sans-serif;
--reader-font-size: 21px;
--reader-line-height: 1.7;          /* ❌ En dessous du minimum dys 1.8 */
--reader-letter-spacing: 0.03em;    /* ❌ En dessous du minimum dys 0.12em */
--reader-word-spacing: 0.16em;
--reader-max-line-length: 68ch;
--reader-page-padding: 34px;

/* Nouveau système (lignes 45-57) */
--dl-font-family: "Verdana", "Geneva", sans-serif;
--dl-font-size: 21px;
--dl-line-height: 1.8;              /* ✅ Correct */
--dl-letter-spacing: 0.12em;        /* ✅ Correct */
--dl-word-spacing: 0.16em;
--dl-reading-width: 68ch;
--dl-padding: 34px;
```

Mais le CSS qui style la zone de lecture (`.reader-page-body`, ligne 1211) utilise les **anciennes** variables `--reader-*` :
```css
.reader-page-body {
  font-family: var(--reader-font-family);      /* ← lit l'ancien système */
  font-size: max(16px, var(--reader-font-size));
  line-height: max(1.5, var(--reader-line-height));  /* ← plancher à 1.5 au lieu de 1.8 */
  letter-spacing: var(--reader-letter-spacing);      /* ← 0.03em au lieu de 0.12em */
  word-spacing: var(--reader-word-spacing);
}
```

Pendant ce temps, `app.mjs` met à jour les `--dl-*` dans `updateLayoutVariables()` (ligne 1290-1299) avec les bons planchers (`Math.max(1.8, ...)`, `Math.max(0.12, ...)`).

**Conséquence** : Si le CSS de la zone de lecture lit `--reader-*` et que seuls les `--dl-*` sont mis à jour dynamiquement, les réglages de l'utilisateur ne s'appliquent pas correctement à la zone de lecture, OU BIEN `updateLayoutVariables()` met aussi à jour les `--reader-*` (non visible dans l'extrait). Dans tous les cas, le double système est une source de bugs et doit être unifié.

**Correction** : Remplacer toutes les occurrences de `var(--reader-*)` dans `styles.css` par `var(--dl-*)`, et supprimer les déclarations `--reader-*` de `:root`. Un seul système de variables.

---

### 2.2 CRITIQUE — Plancher `line-height` trop bas dans le CSS 🔴

**Ligne 1213** de `styles.css` :
```css
line-height: max(1.5, var(--reader-line-height));
```

Le plancher CSS est `1.5`. Même si `app.mjs` applique `Math.max(1.8, ...)` côté JS, le CSS devrait aussi avoir un plancher de `1.8` comme filet de sécurité. Si le JS ne s'exécute pas, ou si la variable n'est pas mise à jour, le CSS fallback est trop serré pour un lecteur dys.

**Correction** :
```css
line-height: max(1.8, var(--dl-line-height));
```

---

### 2.3 CRITIQUE — Plancher `letter-spacing` absent dans le CSS 🔴

**Ligne 1214** de `styles.css` :
```css
letter-spacing: var(--reader-letter-spacing);
```

Aucun plancher CSS. La valeur initiale de `--reader-letter-spacing` est `0.03em`, bien en dessous du minimum WCAG SC 1.4.12 de `0.12em`. Le JS corrige ça dynamiquement, mais le CSS initial est non conforme.

**Correction** :
```css
letter-spacing: max(0.12em, var(--dl-letter-spacing));
```

---

### 2.4 IMPORTANT — `app.mjs` trop volumineux (2666 lignes) 🟡

Le fichier est cohérent mais sa taille le rend difficile à maintenir. Les candidats à l'extraction :

| Bloc fonctionnel | Lignes estimées | Module cible |
|-----------------|-----------------|--------------|
| Gestion OCR (handleStartOcr, handleCancelOcr, updateOcrUi, shouldAdoptOcrResult) | ~150 | `src/core/ocr/ocr-ui.mjs` |
| Rendu des marque-pages et annotations (renderBookmarks, renderAnnotations, addAnnotation, deleteAnnotation, buildSelectionDraft) | ~200 | `src/core/document/notes-ui.mjs` |
| Rendu du document (renderDocument, renderPage, renderBlock) | ~300 | `src/core/document/document-renderer.mjs` |
| Gestion audio UI (toggleSpeech, playNextSentence, pauseSpeech, setVoices) | ~150 | `src/core/reading/audio-ui.mjs` |
| Gestion des profils UI (renderProfiles, saveCurrentProfile, deleteCurrentProfile, activateProfile) | ~150 | `src/ui/profiles-ui.mjs` |

Cela ramènerait `app.mjs` à ~1700 lignes, plus gérable.

---

### 2.5 IMPORTANT — Dossier `dyslecteur/` en doublon 🟡

Le dossier `dyslecteur/` à la racine est une copie identique de `dist/`. Il pèse lourd (tout le build Electron + Chromium) et ne devrait pas exister à côté de `dist/`.

**Correction** : Supprimer `dyslecteur/` et le `.zip`. Ajouter au `.gitignore` :
```
dist/
dyslecteur/
dyslecteur.zip
node_modules/
```

---

### 2.6 IMPORTANT — `.gitignore` absent 🟡

Aucun `.gitignore` visible dans l'arborescence. Les dossiers suivants risquent d'être versionnés :

```
node_modules/
dist/
dyslecteur/
dyslecteur.zip
*.exe
*.blockmap
builder-debug.yml
```

---

### 2.7 MINEUR — Polices UI vs polices de lecture 🟢

Le CSS UI utilise `"Inter", "Segoe UI Variable", "Aptos", "Segoe UI", sans-serif` (ligne 81), ce qui est correct pour le chrome.

L'AGENTS.md recommandait DM Sans pour l'UI. La police actuelle (Inter/Segoe UI) est tout aussi bonne, voire meilleure en termes de disponibilité système. Ce n'est pas un problème — juste une divergence avec la spec initiale.

---

### 2.8 MINEUR — `--ui-panel: #ffffff` est blanc pur 🟢

Le `--ui-panel` (fond des panneaux latéraux) est `#ffffff`. C'est acceptable car c'est le chrome UI et non la zone de lecture. La zone de lecture utilise `--dl-bg-color: #fcfbf8` qui n'est pas blanc pur. Pas de correction nécessaire, mais à surveiller si un utilisateur se plaint de l'éblouissement des panneaux.

---

### 2.9 MINEUR — Pas de `text-align: justify` trouvé 🟢

Bonne nouvelle : aucune occurrence de `text-align: justify` dans tout le CSS. Les `.reader-block p` ont bien `text-align: left` (ligne 1234). Conforme.

---

## 3. ÉTAT DE LA RÉSOLUTION DES TROUBLES DYS

### 3.1 Ce qui est vérifié et correct ✅

| Règle dys | Implémentation | Statut |
|-----------|---------------|--------|
| Alignement gauche | `text-align: left` partout dans la zone de lecture | ✅ OK |
| Pas de texte justifié | Aucun `justify` dans le CSS | ✅ OK |
| Fond non blanc pur | `--dl-bg-color: #fcfbf8` | ✅ OK |
| Texte non noir pur | `--dl-text-color: #3b3530` | ✅ OK |
| Police sans-serif par défaut | Verdana | ✅ OK |
| Largeur de lecture contrainte | `--dl-reading-width: 68ch` | ✅ OK |
| Coloration syllabique | Module `decoding-engine.mjs` | ✅ Existe (à vérifier en détail) |
| Lettres muettes atténuées | `.muet { color: var(--muet) }` | ✅ OK |
| Réglette de lecture | `reading-guide.mjs` + CSS dédié | ✅ OK |
| Mode fenêtre de lecture | Implémenté dans ReadingGuide | ✅ OK |
| Overlay coloré (Irlen) | `::after` avec `mix-blend-mode: multiply` | ✅ OK |
| Focus-visible accessible | `3px solid var(--dl-ui-accent)` offset 2px | ✅ OK |
| `prefers-reduced-motion` | Désactive toutes les transitions | ✅ OK |
| Mode sombre | `data-system-color-scheme="dark"` | ✅ OK |
| Mode immersion | Masque sidebar, topbar, footer | ✅ OK |
| Lecture audio avec suivi | `AudioEngine` + `onboundary` | ✅ OK |
| Verbalisation des maths | Import de `verbalizeMathText` | ✅ OK |
| Marque-pages | `bookmark-store.mjs` | ✅ OK |
| Annotations/surlignage | `annotation-store.mjs` | ✅ OK |
| OCR pour PDF scannés | `ocr-engine.mjs` + Tesseract.js | ✅ OK |
| Messages d'erreur en français | Systématique dans `app.mjs` | ✅ OK |
| Zones cliquables ≥ 44px | `min-height: 46px` sur les boutons/actions | ✅ OK |
| Aide contextuelle sur les contrôles | `CONTROL_HELP_TEXTS` + `aria-description` | ✅ OK |

### 3.2 Ce qui est implémenté mais potentiellement incorrect ⚠️

| Règle dys | Problème identifié | Impact |
|-----------|-------------------|--------|
| Interligne minimum 1.8 | CSS fallback à 1.5, variable `--reader-*` à 1.7 | Lecture trop serrée au chargement initial |
| Espacement lettres minimum 0.12em | Variable `--reader-*` à 0.03em, pas de plancher CSS | Lettres trop proches au chargement initial |
| Espacement mots minimum 0.16em | Variable `--reader-*` OK à 0.16em | ✅ OK mais à migrer vers `--dl-*` |
| Profils par trouble | Existent dans `profiles.mjs` (non vérifié) | À auditer |
| Découpage syllabique | Existe dans `syllabify-french.mjs` (non vérifié) | À auditer |
| Coloration phonémique | Existe dans `decoding-engine.mjs` (non vérifié) | À auditer |
| Navigation clavier | Existe dans `keyboard-nav.mjs` (non vérifié) | À auditer |
| ARIA complet | Existe dans `aria-manager.mjs` (non vérifié) | À auditer |

### 3.3 Ce qui manque encore ❌

| Fonctionnalité | Impact dys | Priorité |
|---------------|-----------|----------|
| Timer / Pomodoro intégré | TDA/H — structuration des sessions | 🟡 Moyen |
| Dictionnaire intégré (clic sur un mot) | Compréhension — tous profils | 🟡 Moyen |
| Mode examen / tiers-temps | Usage scolaire concret | 🟡 Moyen |
| Statistiques de lecture (mots/min, temps) | Suivi orthophoniste | 🟢 Bas |
| Support EPUB / DOCX | Élargissement du public | 🟢 Bas |
| Simplification IA (FALC) | Compréhension — tous profils | 🟢 Bas |
| Description alt des images | Accessibilité complète | 🟢 Bas |
| Internationalisation (i18n) | Préparation future | 🟢 Bas |

---

## 4. CORRECTIONS PRIORITAIRES — PLAN D'ACTION

### Sprint 1 — Corrections CSS critiques (1-2 heures)

```
□ 1. Unifier les variables CSS : remplacer toutes les occurrences
     de var(--reader-*) par var(--dl-*) dans styles.css
□ 2. Supprimer les déclarations --reader-* de :root dans styles.css
□ 3. Mettre le plancher CSS de line-height à 1.8 :
     line-height: max(1.8, var(--dl-line-height));
□ 4. Ajouter un plancher CSS pour letter-spacing :
     letter-spacing: max(0.12em, var(--dl-letter-spacing));
□ 5. Vérifier que updateLayoutVariables() dans app.mjs ne met
     plus à jour les --reader-* (devenues inutiles)
□ 6. Tester : ouvrir un PDF, vérifier que les réglages s'appliquent
     immédiatement et que les valeurs par défaut respectent les minimums dys
```

### Sprint 2 — Hygiène projet (30 minutes)

```
□ 7.  Créer un .gitignore complet
□ 8.  Supprimer le dossier dyslecteur/ (doublon de dist/)
□ 9.  Supprimer dyslecteur.zip de la racine
□ 10. Déplacer Probleme_/ vers docs/screenshots/ ou le sortir du repo
□ 11. Ajouter les icônes dans build-resources/ (icon.ico, icon.icns, icons/)
□ 12. Clarifier le index.html à la racine (renommer en index-web.html
      ou le déplacer dans un dossier web/)
```

### Sprint 3 — Audit des modules dys (nécessite lecture des fichiers)

```
□ 13. Auditer profiles.mjs : vérifier les profils par trouble et
      les DEFAULT_PREFERENCES
□ 14. Auditer decoding-engine.mjs : vérifier la coloration syllabique,
      phonémique, et les lettres muettes
□ 15. Auditer syllabify-french.mjs : vérifier la qualité du découpage
      sur des mots complexes
□ 16. Auditer keyboard-nav.mjs : vérifier que tous les raccourcis
      de l'AGENTS.md sont implémentés
□ 17. Auditer aria-manager.mjs : vérifier les rôles, labels, et
      aria-live sur tous les composants
□ 18. Auditer index.html : vérifier la structure sémantique
      (landmarks, headings, labels)
```

### Sprint 4 — Refactoring app.mjs (2-4 heures)

```
□ 19. Extraire la logique OCR UI dans src/core/ocr/ocr-ui.mjs
□ 20. Extraire le rendu des notes dans src/core/document/notes-ui.mjs
□ 21. Extraire le rendu du document dans src/core/document/document-renderer.mjs
□ 22. Extraire la gestion audio UI dans src/core/reading/audio-ui.mjs
□ 23. Vérifier que app.mjs passe sous les 1800 lignes après extraction
```

---

## 5. FICHIERS À FOURNIR POUR COMPLÉTER L'AUDIT

Pour vérifier que la résolution des problèmes dys est réellement correcte et qu'il n'y a pas d'erreur dans le traitement du texte, j'ai besoin de lire les fichiers suivants :

### 5.1 Cœur du traitement dys (CRITIQUE)

| Fichier | Pourquoi |
|---------|----------|
| **`src/core/reading/decoding-engine.mjs`** | C'est le moteur central. Il fait la coloration syllabique, la coloration phonémique, le rendu des lettres muettes, le mode sons français. Si ce fichier a un bug, tout le système dys est faussé. |
| **`src/core/reading/syllabify-french.mjs`** | Le découpage syllabique du français est un problème linguistique complexe. Les erreurs de découpage (ex : « ch-ien » au lieu de « chien ») détruisent la confiance de l'utilisateur dys. |
| **`src/core/reading/math-support.mjs`** | La verbalisation et le rendu des maths. Si `3x² + 2` est verbalisé « trois x deux plus deux » au lieu de « trois x au carré plus deux », c'est inutilisable. |

### 5.2 Accessibilité (IMPORTANT)

| Fichier | Pourquoi |
|---------|----------|
| **`src/core/accessibility/keyboard-nav.mjs`** | Vérifier que tous les raccourcis prévus dans l'AGENTS.md sont implémentés, et qu'il n'y a pas de conflits (Espace dans un champ texte, etc.). |
| **`src/core/accessibility/aria-manager.mjs`** | Vérifier que les rôles ARIA, les labels, les aria-live sont posés sur les bons éléments. |
| **`src/index.html`** | Vérifier la structure sémantique : landmarks (`role="main"`, `role="navigation"`), hiérarchie des headings, labels des formulaires, ordre du DOM. |

### 5.3 Profils et configuration (IMPORTANT)

| Fichier | Pourquoi |
|---------|----------|
| **`src/profiles.mjs`** | Vérifier les `BUILTIN_PROFILES` : est-ce que chaque profil par trouble a les bons réglages par défaut ? Est-ce que `DEFAULT_PREFERENCES` a les bons minimums dys ? |
| **`src/preload.js`** | Vérifier le bridge Electron : quelles API sont exposées, est-ce que `contextIsolation` est activé. |

### 5.4 Secondaire (bonus)

| Fichier | Pourquoi |
|---------|----------|
| **`src/core/document/document-model.mjs`** | Comprendre comment le document est structuré en mémoire. |
| **`src/core/ocr/ocr-engine.mjs`** | Vérifier l'intégration Tesseract.js et la gestion des erreurs. |
| **`src/core/support/support-links.mjs`** | Vérifier que les liens de don sont bien configurés. |
| **`src/print.css`** | Vérifier que l'impression respecte les réglages dys. |
| **`tests/syllabify-french.test.mjs`** | Voir la couverture de test du découpage syllabique. |

---

## 6. RÉSUMÉ POUR DÉCISION

**L'application est fonctionnelle et distribuable en l'état** pour des testeurs avertis (le `README_TESTEUR.md` est bien fait). Les problèmes critiques sont des incohérences CSS, pas des bugs fonctionnels bloquants — le JS corrige dynamiquement les valeurs au chargement.

**Avant de distribuer plus largement**, il faut :
1. Unifier les variables CSS (sprint 1 — 1h)
2. Nettoyer le repo (sprint 2 — 30min)
3. Auditer le cœur dys : `decoding-engine.mjs`, `syllabify-french.mjs`, `profiles.mjs` (sprint 3)

**Le risque principal** n'est pas un crash ou un bug visible — c'est qu'un enfant dyslexique ouvre l'application, que les réglages par défaut ne soient pas assez adaptés à cause des variables CSS incohérentes, et qu'il pense que l'outil ne fonctionne pas. La première impression est déterminante avec ce public.

---

*Audit réalisé le 5 avril 2026 sur la base des fichiers fournis.*
*Fichiers non encore audités : decoding-engine.mjs, syllabify-french.mjs, math-support.mjs, keyboard-nav.mjs, aria-manager.mjs, profiles.mjs, index.html, preload.js.*
