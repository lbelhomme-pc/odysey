# AUDIT_ACCESSIBILITE.md — Audit accessibilité (lot 2)

> Analyse de `keyboard-nav.mjs`, `aria-manager.mjs` et `index.html`.
> Objectif : vérifier la conformité WCAG 2.2 AA, la navigation clavier, et la structure sémantique.

---

## 1. keyboard-nav.mjs — Navigation clavier

### 1.1 Tous les raccourcis prévus sont implémentés ✅

| Raccourci (AGENTS.md) | Implémenté ? | Ligne |
|------------------------|-------------|-------|
| `Ctrl+O` → Ouvrir fichier | ✅ | 119 |
| `F11` → Mode immersion | ✅ | 131 |
| `Ctrl+Shift+I` → Mode immersion | ✅ | 125 |
| `Espace` → Play/Pause audio | ✅ | 177 |
| `→` → Phrase suivante | ✅ | 207 |
| `←` → Phrase précédente | ✅ | 213 |
| `↑` / `↓` → Réglette haut/bas | ✅ | 183/189 |
| `PageDown` / `PageUp` → Page | ✅ | 195/201 |
| `Ctrl+=` / `Ctrl+-` → Zoom | ✅ | 161/167 |
| `Ctrl+1..9` → Profils | ✅ | 155 |
| `F1` → Aide raccourcis | ✅ | 109 |
| `Ctrl+,` → Réglages | ✅ | 137 |
| `Ctrl+P` → Imprimer | ✅ | 143 |
| `Ctrl+B` → Marque-page | ✅ | 149 |

**Résultat : 14/14 raccourcis implémentés.** Conforme à l'AGENTS.md.

### 1.2 Protection des champs éditables ✅

```javascript
// Ligne 115
if (editable && !(event.ctrlKey && [",", "o", "p", "b"].includes(event.key.toLowerCase()))) {
  return;
}
```

Quand le focus est dans un `<input>`, `<textarea>`, ou `<select>`, les raccourcis simples sont désactivés — seuls les raccourcis avec `Ctrl` passent. L'`Espace` dans un champ texte tape bien un espace et ne déclenche pas la lecture audio. ✅ Correct.

### 1.3 La zone de lecture est correctement isolée ✅

```javascript
// Ligne 173
if (!inReadingArea) { return; }
```

Les raccourcis `Espace`, `↑`, `↓`, `PageUp`, `PageDown`, `→`, `←` ne fonctionnent que quand le focus est dans la zone de lecture (`isReadingTarget`). Pas de conflit avec le reste de l'interface. ✅

### 1.4 Le dialogue d'aide est accessible ✅

- `role="dialog"` + `aria-labelledby` + `aria-modal="true"` → ✅
- `showModal()` pour le focus trap natif → ✅
- Focus automatique sur le bouton Fermer → ✅
- Fermeture par `Escape` → ✅
- Fermeture par clic sur le backdrop → ✅
- Labels en français → ✅

### 1.5 Activation clavier des boutons role="button" ✅

```javascript
// Ligne 219
if (isActivationKey(event) && event.target?.matches?.("[role='button']")) {
  event.preventDefault();
  event.target.click();
}
```

Les éléments avec `role="button"` sont activables avec Entrée et Espace. ✅

### 1.6 Aucun problème identifié ✅

Le module `keyboard-nav.mjs` est complet, propre, et bien sécurisé. Rien à corriger.

---

## 2. aria-manager.mjs — Gestion ARIA

### 2.1 Rôles landmarks ✅

```javascript
document.querySelector(".main-stage")?.setAttribute("role", "main");
this.sidebar?.setAttribute("role", "complementary");
document.querySelector("#recentList")?.setAttribute("role", "navigation");
```

Les trois landmarks principaux sont définis. Un lecteur d'écran peut naviguer entre la zone principale, la barre latérale, et la navigation. ✅

### 2.2 Zone de lecture accessible ✅

```javascript
this.readArea?.setAttribute("aria-label", "Zone de lecture adaptee");
this.readArea?.setAttribute("tabindex", "0");
```

La zone de lecture est focusable (tabindex 0) et a un label descriptif. ✅

### 2.3 Status line en aria-live ✅

```javascript
this.statusLine?.setAttribute("aria-live", "polite");
this.statusLine?.setAttribute("aria-atomic", "true");
```

Chaque changement de statut (profil changé, PDF importé, OCR terminé) est annoncé aux lecteurs d'écran. `polite` = n'interrompt pas la lecture en cours. `atomic` = relit tout le contenu du status, pas juste le diff. ✅

### 2.4 Labels de boutons complets ✅

Les 17 boutons de l'interface ont un `aria-label` en français clair. Pas de bouton-icône sans label. ✅

### 2.5 Sliders avec ARIA complet ✅

```javascript
control.setAttribute("role", "slider");
control.setAttribute("aria-label", getLabelText(control));
control.setAttribute("aria-valuemin", control.min);
control.setAttribute("aria-valuemax", control.max);
control.setAttribute("aria-valuenow", control.value);
control.setAttribute("aria-valuetext", output.textContent.trim());
```

Chaque slider a un label, des valeurs min/max/now, et un texte de valeur lisible (ex : « 1.80 » au lieu de « 1.8 »). ✅

### 2.6 Préférences système respectées ✅

```javascript
document.documentElement.dataset.motionPreference = reducedMotion ? "reduce" : "normal";
document.documentElement.dataset.systemColorScheme = darkScheme ? "dark" : "light";
```

Les media queries `prefers-reduced-motion` et `prefers-color-scheme` sont détectées et appliquées dynamiquement via `data-*` attributes. Le CSS les lit correctement (vérifié dans `styles.css` lignes 1638-1662). ✅

### 2.7 Problème mineur : `refreshSliderValues()` n'est appelé qu'au init 🟡

La méthode met à jour les `aria-valuenow` et `aria-valuetext` de tous les sliders, mais elle n'est appelée que lors du `init()`. Quand l'utilisateur déplace un slider, la valeur visuelle change (via `formatOutputValue()` dans `app.mjs`) mais l'`aria-valuenow` n'est pas mis à jour.

Les navigateurs mettent à jour automatiquement la propriété `value` d'un `<input type="range">`, donc `aria-valuenow` n'est techniquement pas nécessaire (le navigateur expose la valeur native). Mais `aria-valuetext` (le texte lisible « 22px ») n'est PAS mis à jour automatiquement.

**Impact** : un utilisateur de lecteur d'écran entend « 22 » au lieu de « 22px » ou « 1.80 » quand il déplace un slider. Ce n'est pas bloquant mais c'est une perte de contexte.

**Correction** : appeler `ariaManager.refreshSliderValues()` dans `syncControlsWithState()` de `app.mjs` (qui est déjà appelé à chaque changement de réglage).

---

## 3. index.html — Structure sémantique

### 3.1 Langue déclarée ✅

```html
<html lang="fr">
```

Correct. Les lecteurs d'écran utiliseront la synthèse française. ✅

### 3.2 Titre de page ✅

```html
<title>Dys Reader Desktop</title>
```

Présent et descriptif. ✅

### 3.3 Structure des landmarks ✅

| Landmark | Élément | Présent |
|----------|---------|---------|
| Navigation latérale | `<aside class="sidebar" aria-label="Réglages de lecture">` | ✅ |
| Contenu principal | `<main class="main-stage">` | ✅ |
| Footer copyright | `<footer class="app-copyright" aria-label="Copyright et contact">` | ✅ |
| Footer status | `<footer class="stage-footer">` | ✅ |

L'utilisation de `<aside>`, `<main>`, `<section>`, `<header>`, `<footer>` est sémantiquement correcte. ✅

### 3.4 Hiérarchie des headings ✅

```
h1: "Dys Reader"
  h2: "Profils"
    h3: "Personnalisés"
  h2: "Lecture visuelle"
  h2: "Assistances de lecture"
  h2: "Lecture audio"
  h2: "Documents et export"
    h3: "Marque-pages"
    h3: "Passages surlignés"
  h2: "OCR local"
```

La hiérarchie est correcte : un seul h1, les h2 pour les sections principales, les h3 pour les sous-sections. Pas de saut de niveau. ✅

### 3.5 Labels de formulaires ✅

Tous les contrôles sont dans des `<label class="control">` qui contiennent un `<span>` avec le texte du label. La structure `<label>` englobe l'input, ce qui crée une association implicite. ✅

### 3.6 PROBLÈME CRITIQUE : slider letterSpacing max trop bas 🔴

```html
<!-- Ligne 122 -->
<input id="letterSpacing" type="range" min="0" max="0.12" step="0.005" />
```

Le slider `letterSpacing` a un **max de 0.12em**. L'AGENTS.md définit 0.12em comme le **minimum** dys, pas le maximum. Un utilisateur qui a besoin de plus d'espacement (0.15, 0.20, 0.25em) ne peut pas le régler.

Le profil « dyslexie sévère » définit `letterSpacing: 0.15`, mais le slider est bloqué à 0.12. La valeur 0.15 sera clampée à 0.12 par le contrôle HTML.

**Correction obligatoire** :
```html
<input id="letterSpacing" type="range" min="0.05" max="0.25" step="0.005" />
```

Le min devrait être 0.05 (pas 0) pour éviter un espacement nul, et le max devrait être 0.25 pour couvrir les besoins des dyslexies sévères.

### 3.7 PROBLÈME IMPORTANT : slider lineHeight min trop bas 🟡

```html
<!-- Ligne 117 -->
<input id="lineHeight" type="range" min="1.5" max="2.3" step="0.05" />
```

Le min est 1.5, mais le minimum dys recommandé est 1.8. Un utilisateur peut régler son interligne à 1.5 via le slider, ce qui est en dessous de la recommandation. Le JS clampe à 1.8 pour la variable CSS, mais le slider affiche quand même une valeur basse, ce qui est incohérent.

**Correction recommandée** :
```html
<input id="lineHeight" type="range" min="1.6" max="2.8" step="0.05" />
```

Min à 1.6 (pour laisser un peu de marge aux utilisateurs avancés qui veulent un interligne plus serré), max à 2.8 (le profil dyslexie sévère utilise 2.2, laisser de la marge au-delà).

### 3.8 PROBLÈME IMPORTANT : wordSpacing min = 0 🟡

```html
<!-- Ligne 127 -->
<input id="wordSpacing" type="range" min="0" max="0.4" step="0.01" />
```

Même logique : le min du slider est 0, mais le minimum dys est 0.16em. Le JS clampe, mais le contrôle permet des valeurs non conformes.

**Correction recommandée** :
```html
<input id="wordSpacing" type="range" min="0.1" max="0.5" step="0.01" />
```

### 3.9 Les dialogues sont bien structurés ✅

Le `<dialog id="supportDialog">` a :
- `aria-labelledby="supportDialogTitle"` → ✅
- `aria-modal="true"` → ✅
- `method="dialog"` sur le form → ✅
- Bouton Fermer avec `aria-label` → ✅

### 3.10 La zone de lecture est focusable ✅

```html
<div id="readingArea" class="reading-area" tabindex="0">
```

La zone de lecture peut recevoir le focus clavier, ce qui active les raccourcis de lecture (Espace, flèches, PageUp/Down). ✅

### 3.11 Les éléments décoratifs sont masqués ✅

```html
<div class="document-preview-lines" aria-hidden="true">
```

Les lignes décoratives de l'aperçu sont masquées pour les lecteurs d'écran. ✅

### 3.12 Progress OCR accessible ✅

```html
<progress id="ocrProgressBar" max="1" value="0"></progress>
```

L'élément `<progress>` natif est utilisé pour l'OCR. Il est nativement accessible. Le texte de statut est à côté. ✅

### 3.13 Tags `<output>` mal fermés 🟢

```html
<span>Taille du texte <output data-output-for="fontSize"></o></span>
```

Le tag de fermeture est `</o>` au lieu de `</output>`. Les navigateurs corrigent automatiquement cette erreur (le HTML parser est tolérant), mais c'est techniquement invalide.

**Correction** : remplacer toutes les `</o>` par `</output>` (9 occurrences).

---

## 4. RÉSUMÉ GLOBAL DE TOUS LES AUDITS

### Corrections obligatoires 🔴 (à faire avant distribution)

| # | Fichier | Problème | Correction |
|---|---------|----------|------------|
| 1 | `profiles.mjs` L142 | `lineHeight: 1.7` | → `1.8` |
| 2 | `profiles.mjs` L143 | `letterSpacing: 0.03` | → `0.12` |
| 3 | `profiles.mjs` L81 | Thème blanc `canvas: "#ffffff"` | → `"#fafbfc"` |
| 4 | `index.html` L122 | Slider letterSpacing `max="0.12"` | → `min="0.05" max="0.25"` |
| 5 | `styles.css` L1211-1216 | Variables `--reader-*` au lieu de `--dl-*` | Unifier vers `--dl-*` |
| 6 | `styles.css` L1213 | Plancher line-height CSS à 1.5 | → `max(1.8, var(--dl-line-height))` |

### Corrections recommandées 🟡 (à faire rapidement)

| # | Fichier | Problème |
|---|---------|----------|
| 7 | `profiles.mjs` | 8 profils avec letterSpacing < 0.12 |
| 8 | `profiles.mjs` | 2 profils avec wordSpacing < 0.16 |
| 9 | `index.html` L117 | Slider lineHeight min="1.5" → min="1.6" max="2.8" |
| 10 | `index.html` L127 | Slider wordSpacing min="0" → min="0.1" max="0.5" |
| 11 | `index.html` | 9 balises `</o>` au lieu de `</output>` |
| 12 | `syllabify-french.mjs` | Mots en « -ent » nasal traités comme muets |
| 13 | `syllabify-french.mjs` | Graphèmes eille/aille non protégés pour le découpage |
| 14 | `aria-manager.mjs` | `refreshSliderValues()` non rappelé après changement |
| 15 | Racine projet | Créer .gitignore, supprimer dossier `dyslecteur/` doublon |

### Ce qui est validé ✅

- Navigation clavier : 14/14 raccourcis, protections correctes
- ARIA : landmarks, labels, aria-live, sliders, dialogues
- Préférences système : reduced-motion + dark mode
- Sémantique HTML : headings, landmarks, formulaires
- Moteur syllabique : architecture solide, graphèmes complets
- Coloration phonémique : catégories correctes
- Verbalisation maths : remplacements corrects en français
- Détection faux positifs maths : robuste
- Lecture audio : karaoké, pause, navigation, verbalisation
- Réglette de lecture : positionnement, modes, cleanup
- OCR : intégration Tesseract, gestion d'erreurs
- Marque-pages et annotations : persistance, export
- Profils par trouble : intentions correctes (valeurs à ajuster)

---

**Verdict final** : l'application est à 6 corrections de pouvoir être distribuée sereinement. Les 3 plus urgentes prennent 5 minutes chacune (DEFAULT_PREFERENCES + slider letterSpacing max + unification variables CSS). Les problèmes linguistiques (mots en « -ent ») sont importants mais n'empêchent pas le lancement — ils touchent un sous-ensemble de mots et le résultat est visuellement acceptable même si linguistiquement imparfait.

*Audit complet terminé le 5 avril 2026.*
