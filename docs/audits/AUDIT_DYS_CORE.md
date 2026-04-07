# AUDIT_DYS_CORE.md — Audit du cœur de traitement dys

> Analyse détaillée de `profiles.mjs`, `decoding-engine.mjs`, `syllabify-french.mjs` et `math-support.mjs`.
> Objectif : vérifier que le traitement du texte est linguistiquement correct, que les profils sont cohérents, et qu'il n'y a pas de bug silencieux qui dégraderait l'expérience d'un utilisateur dys.

---

## 1. profiles.mjs — Profils et préférences

### 1.1 Problème critique : DEFAULT_PREFERENCES non conformes 🔴

```javascript
// Ligne 142-143
lineHeight: 1.7,        // ❌ Minimum dys = 1.8 (AGENTS.md §2.1)
letterSpacing: 0.03,    // ❌ Minimum dys = 0.12em (WCAG SC 1.4.12)
```

Ces valeurs sont les réglages par défaut appliqués à TOUT nouvel utilisateur et à TOUT profil via le spread `...DEFAULT_PREFERENCES`. Même si `app.mjs` applique `Math.max(1.8, ...)` et `Math.max(0.12, ...)` dynamiquement, les `DEFAULT_PREFERENCES` sont la source de vérité pour :
- Les profils personnalisés sauvegardés (qui héritent de ces valeurs)
- Le fallback navigateur quand le JS ne corrige pas à temps
- Le rendu initial avant que `updateLayoutVariables()` ne s'exécute

**Correction obligatoire** :
```javascript
lineHeight: 1.8,
letterSpacing: 0.12,
```

### 1.2 Problème important : profils qui héritent les mauvaises valeurs 🟡

Chaque profil fait `...DEFAULT_PREFERENCES` puis override certaines clés. Les profils qui n'overrident PAS `lineHeight` et `letterSpacing` héritent les valeurs non conformes (1.7 / 0.03). Profils impactés :

| Profil | lineHeight | letterSpacing | Conforme ? |
|--------|-----------|--------------|------------|
| `lecture-visuelle-allegee` | 1.8 ✅ | **0.035** ❌ | Non |
| `audio` | 1.9 ✅ | **0.035** ❌ | Non |
| `decodage-renforce` | 1.85 ✅ | **0.04** ❌ | Non |
| `comprehension-simplifiee` | 1.95 ✅ | **0.035** ❌ | Non |
| `dyslexie-legere` | 1.8 ✅ | **0.08** ❌ | Non |
| `dyslexie-severe` | 2.2 ✅ | 0.15 ✅ | Oui |
| `dyscalculie` | 2.0 ✅ | **0.1** ❌ | Non |
| `tdah` | 2.0 ✅ | **0.1** ❌ | Non |
| `dyspraxie` | 2.0 ✅ | 0.12 ✅ | Oui |
| `enseignant` | 1.8 ✅ | **0.08** ❌ | Non |

**Résultat** : 8 profils sur 10 ont un `letterSpacing` en dessous du minimum WCAG de 0.12em.

Le JS dans `app.mjs` applique `Math.max(0.12, ...)` sur la variable CSS, donc visuellement le résultat est corrigé à 0.12em. Mais la valeur stockée dans le profil reste fausse (0.035, 0.04, 0.08, etc.), ce qui signifie :
- L'output du contrôle affiche `0.04em` au lieu de `0.12em` → l'utilisateur croit que son espacement est à 0.04 alors qu'il est clampé à 0.12
- Si le clamp JS est retiré ou modifié, les profils redeviennent non conformes

**Correction recommandée** : mettre au minimum 0.12 dans chaque profil, sauf si le profil est explicitement conçu pour un enseignant/ortho qui veut voir le rendu « normal ».

### 1.3 Le thème « blanc » a un canvas blanc pur 🟡

```javascript
// Ligne 81
blanc: { canvas: "#ffffff", ... }
```

Le thème « Blanc doux » utilise `#ffffff` pour la zone de lecture. C'est contraire à la règle dys « jamais blanc pur dans la zone de lecture ». Le `app.mjs` ne clampe pas la couleur de fond.

**Correction** : remplacer par `#fafbfc` ou `#f8f9fa` — visuellement quasi identique, mais techniquement pas blanc pur.

### 1.4 Les polices sont bien choisies ✅

L'ordre est excellent : Atkinson Hyperlegible et Luciole en premier (conçues pour la lisibilité), puis Lexie Readable et OpenDyslexic (conçues pour la dyslexie), puis les classiques système (Verdana, Arial, Tahoma). Chaque police a un fallback sans-serif. Aucune police serif. Conforme.

### 1.5 Les profils par trouble sont bien pensés ✅

- **Dyslexie sévère** : OpenDyslexic, fontSize 24, lineHeight 2.2, réglette, coloration sons français, pause 700ms → cohérent
- **TDAH** : fenêtre de lecture 3 lignes, overlay gris, mode immersion automatique, pause 600ms → cohérent
- **Dyspraxie** : overlay bleu, réglette, grands espacements → cohérent
- **Dyscalculie** : verificationMode markers, mathVerbalize → cohérent

Seul manque : les propriétés `mathVerbalize` et `mathColorCode` du profil dyscalculie ne sont pas dans `DEFAULT_PREFERENCES`, donc elles ne sont pas reconnues par le système de contrôles. Elles sont probablement ignorées silencieusement. À vérifier dans `app.mjs`.

### 1.6 Le wordSpacing de « dyslexie légère » est trop bas 🟡

```javascript
// Profil dyslexie-legere, ligne 283
wordSpacing: 0.12,  // ❌ En dessous du minimum 0.16em (WCAG SC 1.4.12)
```

Le profil « enseignant » a le même problème (0.12). Le clamp JS dans `app.mjs` est `Math.max(0.16, ...)`, donc visuellement c'est corrigé, mais la valeur affichée dans le contrôle est fausse.

---

## 2. syllabify-french.mjs — Découpage syllabique

### 2.1 Architecture : solide ✅

Le module suit une approche linguistique correcte :
1. Identification des graphèmes protégés (digrammes voyelles : `eau`, `ou`, `ai`, `on`, `an`... et consonnes : `ch`, `gn`, `ph`, `th`, `qu`)
2. Classification voyelle/consonne de chaque unité
3. Fusion des glides (semi-voyelles : `i`, `u`, `y` + voyelle après consonne → noyau unique)
4. Segmentation inter-voyellique avec gestion des clusters d'attaque (`pr`, `br`, `tr`, `str`, `spl`...)
5. Stabilisation : fusion des syllabes trop courtes (consonne isolée)

### 2.2 Les graphèmes protégés sont complets ✅

Voyelles : `eau`, `oeu`, `ain`, `ein`, `oin`, `eu`, `au`, `ou`, `on`, `an`, `en`, `in`, `oi`, `ai`, `ei`, `un`, `om`, `am`, `em`, `im`, `um` → tous les digrammes/trigrammes vocaliques du français sont présents.

Consonnes : `ch`, `gn`, `ph`, `th`, `qu` → complet.

### 2.3 Les clusters d'attaque sont complets ✅

`pr`, `br`, `tr`, `dr`, `cr`, `gr`, `fr`, `vr`, `pl`, `bl`, `cl`, `gl`, `fl`, `kl`, `kr`, `str`, `spl`, `spr`, `scr` → tous les groupes consonantiques initiaux du français sont couverts.

### 2.4 Problème potentiel : lettres muettes — règle « -ent » trop permissive ⚠️

```javascript
// Ligne 130
if (pattern === "ent" && normalizedWord.endsWith("ment")) {
  continue;  // protège les mots en -ment (correctement, normalement, etc.)
}
```

La règle dit : si le mot finit par `ent` ET que ce n'est pas un `-ment`, alors le `ent` est considéré muet. C'est correct pour les verbes conjugués à la 3e personne du pluriel (« ils mangent », « elles parlent »), mais faux pour :
- **« souvent »** → le « ent » n'est PAS muet (on prononce /suvɑ̃/)
- **« lent »** → le « ent » n'est PAS muet (on prononce /lɑ̃/)
- **« dent »** → le « ent » n'est PAS muet (on prononce /dɑ̃/)
- **« vent »** → le « ent » n'est PAS muet (on prononce /vɑ̃/)
- **« agent »** → le « ent » n'est PAS muet (on prononce /aʒɑ̃/)
- **« parent »** → le « ent » n'est PAS muet (on prononce /paʁɑ̃/)
- **« content »** → le « ent » n'est PAS muet comme adjectif (on prononce /kɔ̃tɑ̃/), muet seulement comme verbe (« ils content »)

La protection `normalizedWord.length <= 3` (ligne 133 pour les terminaisons courtes comme `s`, `x`, `t`, `d`) ne s'applique pas à `ent` (pattern de 3 lettres, mais la condition est pour les patterns d'1 lettre).

**Impact** : un mot comme « souvent » serait rendu avec « ent » grisé (classe `.muet`), ce qui est linguistiquement faux et confusant pour un enfant dys qui apprend justement à décoder les sons.

**Correction recommandée** : ajouter les mots en `-ent` prononcé nasal dans `SILENT_ENDING_EXCEPTIONS` :
```javascript
const SILENT_ENDING_EXCEPTIONS = new Set([
  // ... existants ...
  "agent", "argent", "content", "dent", "gent",
  "lent", "parent", "patient", "present", "prudent",
  "recent", "sergent", "souvent", "talent", "vent",
  "accent", "accident", "adolescent", "aliment",
  "appartement", "bâtiment", "cement", "client",
  "comment", "complement", "continent", "courant",
  "department", "document", "element", "enfant",
  "equipement", "etudiant", "evenement", "fervent",
  "fondement", "fragment", "garnement", "habitant",
  "ignorant", "impatient", "important", "incident",
  "instrument", "intelligent", "justement",
  "logement", "moment", "monument", "mouvement",
  "nourissant", "orient", "ornement", "parlement",
  "permanent", "placement", "president", "regiment",
  "restaurant", "segment", "sentiment", "serpent",
  "supplement", "torrent", "tournament", "urgent",
  "violent",
  // Nota : les mots en -ment sont déjà protégés par la règle ligne 130
]);
```

Attention : cette liste n'est pas exhaustive. Une approche plus robuste serait de vérifier si la syllabe finale « ent » forme un son nasal /ɑ̃/ — c'est le cas quand le « e » est précédé d'une consonne et que le mot n'est pas un verbe à la 3e personne du pluriel. Mais c'est un problème de NLP complexe. La liste d'exceptions est un compromis pragmatique acceptable.

### 2.5 Problème potentiel : lettres muettes — « -es » sur les noms ⚠️

```javascript
// Ligne 146-149
if (
  ["e", "es"].includes(pattern) &&
  coreLetters.filter((letter) => isVowelText(letter)).length <= 1
) {
  continue;  // ne pas marquer comme muet si le core n'a qu'une voyelle
}
```

Cette protection est bonne (évite de griser le « e » de « le », « me », « se »), mais elle laisse passer des cas problématiques :
- **« grandes »** → « es » marqué muet ✅ correct (on prononce /gʁɑ̃d/)
- **« tables »** → « es » marqué muet ✅ correct (on prononce /tabl/)
- **« lunettes »** → « es » marqué muet ✅ correct

Ça semble fonctionner. Pas de bug identifié ici.

### 2.6 Les exceptions sont bien choisies ✅

```javascript
const EXCEPTION_SYLLABLES = new Map([
  ["famille", ["fa", "mille"]],    // ✅ pas "fa-mi-lle"
  ["fille", ["fille"]],            // ✅ monosyllabe
  ["ville", ["ville"]],            // ✅ monosyllabe
  ["monsieur", ["mon", "sieur"]],  // ✅ pas "mon-si-eur"
  ["femme", ["femme"]],            // ✅ monosyllabe
  ["oignon", ["oi", "gnon"]],      // ✅ pas "oi-gn-on"
]);
```

Ces exceptions couvrent les cas les plus problématiques du français. Il en manque quelques-unes courantes :
- « feuille » → devrait être ["feuille"] (monosyllabe)
- « abeille » → devrait être ["a", "beille"]
- « oreille » → devrait être ["o", "reille"]
- « soleil » → devrait être ["so", "leil"]
- « paille » → devrait être ["paille"] (monosyllabe)
- « taille » → devrait être ["taille"] (monosyllabe)
- « bouteille » → devrait être ["bou", "teille"]
- « oeil » → devrait être ["oeil"] (monosyllabe)
- « accueil » → devrait être ["ac", "cueil"]

Mais vérifier : le moteur les traite-t-il déjà bien grâce aux graphèmes protégés `eille`, `aille`, `eil`, `euil`, `ueil` dans le `decoding-engine.mjs` ? Ces graphèmes sont dans `PHONEME_PATTERNS` mais PAS dans `PROTECTED_VOWEL_GRAPHEMES` de `syllabify-french.mjs`. Donc le découpage syllabique ne les protège pas — seule la coloration phonémique les reconnaît.

**Impact** : « bouteille » risque d'être découpé en « bou-tei-lle » ou « bou-teil-le » au lieu de « bou-teille ». À tester concrètement.

**Correction recommandée** : ajouter `eille`, `aille`, `euil`, `ueil`, `eil`, `eil` dans `PROTECTED_VOWEL_GRAPHEMES` du `syllabify-french.mjs`, ou ajouter des exceptions pour les mots courants en « -ille/-eille/-aille ».

### 2.7 Le mode « light » vs « strong » est bien calibré ✅

```javascript
// light : affiche les syllabes seulement si ≥ 3 syllabes OU ≥ 8 lettres
// strong : affiche les syllabes si ≥ 2 syllabes ET ≥ 4 lettres
```

C'est un bon compromis : en mode léger, les petits mots courants (« dans », « avec », « pour ») ne sont pas découpés (ce qui serait contre-productif), tandis qu'en mode renforcé, tous les mots polysyllabiques sont aidés.

---

## 3. decoding-engine.mjs — Moteur de rendu adapté

### 3.1 Architecture : très propre ✅

Le pipeline est clair :
1. `tokenizeForColoring()` → découpe le texte en tokens (mot, espace, ponctuation)
2. `renderAdaptedWord()` → pour chaque mot, applique la coloration selon le mode
3. `renderWordCore()` → gère syllabes + phonèmes + lettres muettes
4. `renderPhonemeUnits()` / `renderPedagogicSyllables()` → rendu HTML avec classes CSS

### 3.2 La coloration phonémique est correcte ✅

Les catégories de sons sont bien classifiées :
- **Nasales** : an, am, en, em, on, om, in, im, ain, ein, oin, un, um → ✅ complet
- **Voyelles complexes** : eau, eaux, au, eu, oeu, ai, ei, oi, ou → ✅ complet
- **Complexes** : ion, ien, ill, eille, eill, aille, ail, eil, gn, ph, ch, qu → ✅ complet

Les patterns sont triés du plus long au plus court (ligne 93-129), ce qui est essentiel pour le matching glouton (« eaux » avant « eau », « ain » avant « ai »). ✅ correct.

### 3.3 L'alternance syllabique est bien implémentée ✅

```javascript
const syllableClass = syllableIndex % 2 === 0 ? "syllabe1" : "syllabe2";
```

Alternance simple pair/impair → deux couleurs qui alternent. C'est le standard en aide au décodage dys. Les couleurs sont définies par thème dans `profiles.mjs` (ex : crème → `syllabe1: #426389`, `syllabe2: #4d7e76`). Les teintes sont proches mais distinctes, pas agressives. ✅

### 3.4 Les mots outils (stopwords) sont bien gérés ✅

La liste de 89 stopwords est complète pour le français courant. Ces mots ne reçoivent pas la classe `.important` → ils ne sont pas surlignés en mode compréhension. C'est correct : les mots grammaticaux sont déjà connus des lecteurs dys, c'est les mots lexicaux longs qu'il faut aider.

### 3.5 L'apostrophe est correctement gérée ✅

```javascript
const parts = String(word).split(/(['\u2019])/u);
```

Le split sur l'apostrophe typographique (U+2019) ET l'apostrophe droite (') est correct. Les mots comme « l'arbre » sont traités comme deux parties : « l » + « arbre », chacune décodée séparément. ✅

### 3.6 Le tracking audio est bien intégré ✅

Chaque mot reçoit un `data-audio-word-index`, `data-source-start`, `data-source-end` quand `audioTracking` est activé. Cela permet au karaoké de surligner le bon mot. La classe `.word-audio-track` encapsule le mot pour le ciblage CSS. ✅

### 3.7 Problème mineur : pas de protection contre le « euil/ueil » 🟢

Le pattern « euil » et « ueil » sont dans `PHONEME_PATTERNS` du `decoding-engine.mjs` mais pas dans `PROTECTED_VOWEL_GRAPHEMES` du `syllabify-french.mjs`. Le risque est que la coloration phonémique fonctionne (le « euil » de « fauteuil » est coloré comme un seul son), mais le découpage syllabique le coupe mal (« fau-te-uil » au lieu de « fau-teuil »).

Pas un bug du decoding-engine lui-même, mais une incohérence entre les deux modules.

---

## 4. math-support.mjs — Support mathématiques

### 4.1 La verbalisation est correcte ✅

Les remplacements de symboles sont linguistiquement corrects en français :
- `≤` → « inférieur ou égal à » ✅
- `≥` → « supérieur ou égal à » ✅
- `≠` → « différent de » ✅
- `≈` → « environ égal à » ✅
- `×` → « fois » ✅
- `÷` → « divisé par » ✅
- `/` → « sur » ✅
- `√` → « racine de » ✅
- `^` → « puissance » ✅
- `_` → « indice » ✅
- `π` → « pi » ✅
- `%` → « pour cent » ✅

L'ordre est important : `≤` et `≥` sont avant `=` et `<`/`>`, ce qui évite un double remplacement. ✅

### 4.2 La détection des faux positifs est excellente ✅

Le module a une logique sophistiquée pour éviter de traiter comme du « math » ce qui n'en est pas :
- `isLikelyDocumentLabel()` → détecte « Livre I - Fable 2 » comme un label, pas une formule ✅
- `isLikelyAdministrativeReference()` → détecte les références administratives (articles, dates) ✅
- `ROMAN_NUMERAL_REGEX` → protège les chiffres romains ✅

C'est exactement le problème que tu avais résolu (faux positifs sur `fontaine01.pdf`). Le code est robuste.

### 4.3 Le rendu HTML des expressions est correct ✅

```javascript
// x² → x<sup class="math-super">2</sup>
// a_1 → a<sub class="math-sub">1</sub>
// 3 + 5 → 3 <span class="math-operator">+</span> 5
```

Les exposants et indices sont rendus avec `<sup>` et `<sub>` sémantiques, pas juste du CSS. Les opérateurs et nombres ont des classes CSS distinctes pour le code couleur. ✅

### 4.4 Le système de vérification est bien calibré ✅

La détection de parenthèses non équilibrées, de clusters d'opérateurs suspects, et de fractions aplaties fournit des `verificationReasons` en français clair. Le `verificationLevel` (none/low/medium/high) est gradué correctement. ✅

### 4.5 Problème mineur : la verbalisation de « - » (tiret) 🟢

```javascript
[/-/g, " moins "],
```

Le tiret simple `-` est toujours verbalisé comme « moins ». Mais dans un texte mixte, un tiret peut être un trait d'union (« peut-être ») ou un tiret cadratin. Le module `analyzeMathContent()` filtre correctement les textes non-math, mais si un bloc est marqué comme contenant des maths et qu'il contient aussi du texte avec des traits d'union, la verbalisation sera incorrecte (« peut moins être »).

**Impact** : faible, car la verbalisation n'est utilisée que sur les blocs identifiés comme mathématiques, et le seuil de détection est assez élevé.

---

## 5. RÉSUMÉ DES CORRECTIONS

### Corrections obligatoires 🔴

| # | Fichier | Ligne | Problème | Correction |
|---|---------|-------|----------|------------|
| 1 | `profiles.mjs` | 142 | `lineHeight: 1.7` | → `1.8` |
| 2 | `profiles.mjs` | 143 | `letterSpacing: 0.03` | → `0.12` |
| 3 | `profiles.mjs` | 81 | Thème blanc `canvas: "#ffffff"` | → `"#fafbfc"` |

### Corrections recommandées 🟡

| # | Fichier | Problème | Correction |
|---|---------|----------|------------|
| 4 | `profiles.mjs` | 8 profils avec letterSpacing < 0.12 | Mettre chaque profil à ≥ 0.12 |
| 5 | `profiles.mjs` | 2 profils avec wordSpacing < 0.16 | Mettre dyslexie-legere et enseignant à ≥ 0.16 |
| 6 | `syllabify-french.mjs` | « -ent » muet sur des noms/adjectifs (souvent, vent, parent, etc.) | Ajouter ~30 mots dans SILENT_ENDING_EXCEPTIONS |
| 7 | `syllabify-french.mjs` | Graphèmes `eille`/`aille`/`euil`/`ueil` non protégés pour le découpage | Ajouter dans PROTECTED_VOWEL_GRAPHEMES |
| 8 | `syllabify-french.mjs` | Exceptions manquantes pour feuille, paille, taille, bouteille, etc. | Ajouter dans EXCEPTION_SYLLABLES |

### Points validés ✅

| Module | Élément | Verdict |
|--------|---------|---------|
| `profiles.mjs` | Choix de polices | ✅ Excellent |
| `profiles.mjs` | Profils par trouble (intentions) | ✅ Bien pensés |
| `profiles.mjs` | Thèmes (hors blanc) | ✅ Corrects |
| `syllabify-french.mjs` | Architecture du découpage | ✅ Solide |
| `syllabify-french.mjs` | Graphèmes protégés (voyelles/consonnes) | ✅ Complets |
| `syllabify-french.mjs` | Clusters d'attaque | ✅ Complets |
| `syllabify-french.mjs` | Mode light vs strong | ✅ Bien calibré |
| `syllabify-french.mjs` | Stabilisation des syllabes | ✅ Correct |
| `decoding-engine.mjs` | Pipeline de rendu | ✅ Propre |
| `decoding-engine.mjs` | Coloration phonémique | ✅ Correcte |
| `decoding-engine.mjs` | Alternance syllabique | ✅ Standard |
| `decoding-engine.mjs` | Gestion apostrophes | ✅ Correcte |
| `decoding-engine.mjs` | Tracking audio | ✅ Bien intégré |
| `decoding-engine.mjs` | Stopwords | ✅ Liste complète |
| `math-support.mjs` | Verbalisation français | ✅ Correcte |
| `math-support.mjs` | Détection faux positifs | ✅ Excellente |
| `math-support.mjs` | Rendu HTML (sup/sub/opérateurs) | ✅ Sémantique |
| `math-support.mjs` | Système de vérification | ✅ Bien gradué |

---

## 6. TESTS À AJOUTER

Pour valider les corrections ci-dessus, ajouter ces cas dans `tests/syllabify-french.test.mjs` :

```javascript
// Lettres muettes — mots en -ent prononcé nasal (NE PAS griser)
assert(analyzeFrenchWord("souvent").silentEnding === "", "souvent: ent n'est pas muet");
assert(analyzeFrenchWord("vent").silentEnding === "", "vent: ent n'est pas muet");
assert(analyzeFrenchWord("parent").silentEnding === "", "parent: ent n'est pas muet");
assert(analyzeFrenchWord("dent").silentEnding === "", "dent: ent n'est pas muet");
assert(analyzeFrenchWord("lent").silentEnding === "", "lent: ent n'est pas muet");
assert(analyzeFrenchWord("argent").silentEnding === "", "argent: ent n'est pas muet");
assert(analyzeFrenchWord("serpent").silentEnding === "", "serpent: ent n'est pas muet");
assert(analyzeFrenchWord("content").silentEnding === "", "content (adj): ent n'est pas muet");

// Lettres muettes — verbes en -ent (DOIT être grisé)
assert(analyzeFrenchWord("mangent").silentEnding === "ent", "mangent: ent est muet");
assert(analyzeFrenchWord("parlent").silentEnding === "ent", "parlent: ent est muet");
assert(analyzeFrenchWord("chantent").silentEnding === "ent", "chantent: ent est muet");

// Découpage syllabique — mots en -ille/-eille/-aille
assert.deepStrictEqual(
  analyzeFrenchWord("bouteille").syllables, ["bou", "teille"],
  "bouteille: pas bou-tei-lle"
);
assert.deepStrictEqual(
  analyzeFrenchWord("feuille").syllables, ["feuille"],
  "feuille: monosyllabe"
);
assert.deepStrictEqual(
  analyzeFrenchWord("abeille").syllables, ["a", "beille"],
  "abeille: a-beille"
);

// Découpage syllabique — mots courants
assert.deepStrictEqual(
  analyzeFrenchWord("chocolat").syllables, ["cho", "co", "lat"],
  "chocolat: cho-co-lat"
);
assert.deepStrictEqual(
  analyzeFrenchWord("ordinateur").syllables, ["or", "di", "na", "teur"],
  "ordinateur: or-di-na-teur"
);
assert.deepStrictEqual(
  analyzeFrenchWord("papillon").syllables, ["pa", "pil", "lon"],
  "papillon: pa-pil-lon"
);
```

---

*Audit réalisé le 5 avril 2026.*
*Verdict : le cœur dys est linguistiquement solide avec quelques lacunes corrigeables. Les problèmes les plus urgents sont les DEFAULT_PREFERENCES (2 valeurs à changer) et la liste d'exceptions pour les mots en « -ent » nasal.*
