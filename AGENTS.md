# AGENTS.md — DysLecteur PDF Adapté

> Lecteur PDF adapté pour les troubles dys (dyslexie, dysorthographie, dyscalculie, dyspraxie, dysgraphie, TDA/H).
> Stack : Electron + Vanilla JS (ESM modules) + PDF.js + Web Speech API.

---

## 1. IDENTITÉ DU PROJET

**Nom** : DysLecteur
**Mission** : Rendre n'importe quel document PDF lisible, compréhensible et navigable pour toute personne présentant un trouble dys ou un trouble de l'attention.
**Public cible** :
- Élèves dys du primaire au supérieur (6-25 ans)
- Adultes dys en milieu professionnel
- Enseignants, orthophonistes, ergothérapeutes, AESH
- Parents accompagnant leurs enfants

**Philosophie** : L'outil ne guérit rien. Il réduit la charge cognitive liée au décodage pour libérer les ressources mentales de l'utilisateur vers la compréhension.

---

## 2. EXPERTISE TROUBLES DYS — CE QUE LE CODE DOIT SAVOIR

### 2.1 Dyslexie (trouble de la lecture)

**Mécanismes impactés** : décodage graphème-phonème, empan visuel, mémoire de travail phonologique.

**Règles de conception** :
- Police : proposer OpenDyslexic, Lexie Readable, Atkinson Hyperlegible, Luciole, et les sans-serif classiques (Verdana, Tahoma, Arial). Ne jamais imposer une seule police « miracle » — chaque dyslexique est différent.
- Taille minimale : 14pt par défaut, ajustable de 12 à 32pt.
- Interligne : 1.8 minimum par défaut (ajustable 1.5 à 3.0).
- Espacement lettres : +0.12em par défaut (WCAG SC 1.4.12), ajustable 0 à 0.3em.
- Espacement mots : +0.16em par défaut, ajustable 0 à 0.5em.
- Largeur de lecture : 60-80 caractères max par ligne (zone de lecture contrainte).
- Alignement : toujours à gauche, JAMAIS justifié (l'espacement irrégulier aggrave la lecture).
- Pas d'italique, pas de soulignement, pas de MAJUSCULES ÉTENDUES dans le contenu adapté.
- Coloration syllabique : alternance de 2 couleurs douces sur les syllabes pour guider le décodage.
- Coloration phonémique : option séparée avec code couleur par groupe de sons.
- Lettres muettes : atténuées (opacité réduite ou couleur grisée).
- Surlignage de la ligne active (« réglette ») : surligner la ligne en cours de lecture pour éviter les sauts de ligne.
- Fond : JAMAIS blanc pur (#FFFFFF). Privilégier des fonds crème (#FDF6E3), beige (#FAF3E0), bleu pâle (#E8F4FD), vert pâle (#E8F5E9), ou rose pâle (#FCE4EC). Le choix doit rester à l'utilisateur.
- Contraste : ratio minimum 7:1 entre texte et fond (WCAG AAA), mais éviter le noir pur (#000000) sur blanc pur — préférer #333333 sur #FDF6E3.

### 2.2 Dysorthographie (trouble de l'expression écrite)

**Impact sur la lecture** : confusion de lettres visuellement proches (b/d, p/q, m/n), omission de lettres, inversion de syllabes.

**Règles de conception** :
- Polices avec distinction maximale entre lettres miroirs (b/d, p/q) — OpenDyslexic et Lexie Readable ont été conçues pour ça.
- Option de mise en évidence des lettres fréquemment confondues (b, d, p, q en couleurs distinctes).
- Coupure syllabique visuelle pour clarifier la structure des mots longs.

### 2.3 Dyscalculie (trouble du calcul et du sens des nombres)

**Impact sur la lecture de documents mathématiques** : difficulté à lire les nombres, les formules, à comprendre la notation positionnelle.

**Règles de conception** :
- Verbalisation systématique des expressions mathématiques (ex : `3x² + 2x - 5` → « trois x au carré plus deux x moins cinq »).
- Espacement élargi dans les formules — ne pas compresser les expressions.
- Séparateurs visuels entre les termes d'une expression.
- Code couleur par rôle dans une expression : opérateurs, variables, constantes, exposants.
- Notation normalisée et cohérente (le module `math-support.mjs` gère ça).
- Option de lecture audio des formules avec pause entre chaque terme.

### 2.4 Dyspraxie / TDC (trouble de la coordination)

**Impact** : difficulté avec les gestes fins (clic précis, scroll, drag), fatigue motrice rapide.

**Règles de conception** :
- Zones cliquables larges (min 44×44px, idéalement 48×48px — WCAG 2.5.8).
- Navigation clavier complète : toutes les fonctions accessibles sans souris.
- Raccourcis clavier pour les actions fréquentes (page suivante/précédente, zoom, lecture audio, changement de profil).
- Scroll fluide et progressif (pas de scroll par page brutal).
- Mode « défilement automatique » à vitesse réglable.
- Pas de drag & drop obligatoire — toujours une alternative clavier ou bouton.
- Boutons d'action suffisamment espacés (min 8px entre deux cibles tactiles).

### 2.5 TDA/H (trouble de l'attention avec ou sans hyperactivité)

**Impact** : difficulté à maintenir l'attention, distraction par les éléments périphériques, surcharge cognitive par l'interface.

**Règles de conception** :
- Mode immersion (focus) : masquer TOUT sauf le texte en cours — pas de menu, pas de boutons, pas de panneaux latéraux.
- Réglette de lecture / ligne active surlignée : guider l'œil sur une seule ligne.
- Option de masquage du texte au-dessus et en-dessous de la zone de lecture active (« fenêtre de lecture »).
- Timer/Pomodoro intégré : aide à structurer les sessions de lecture.
- Indicateur de progression visuel (barre de progression, numéro de page).
- Pas d'animations superflues — respecter `prefers-reduced-motion`.
- Audio : lecture à voix haute avec suivi mot par mot pour maintenir l'attention.
- Marque-pages rapides : un clic pour marquer où on s'est arrêté.

### 2.6 Troubles visuels associés (syndrome d'Irlen / stress visuel)

**Impact** : sensibilité aux contrastes, aux motifs, à la luminosité. Lettres qui « bougent » sur fond blanc.

**Règles de conception** :
- Overlays colorés (filtres de couleur sur le fond) : proposer au minimum crème, bleu, vert, rose, jaune, gris.
- Possibilité d'ajuster la teinte exacte du fond et du texte avec un color picker.
- Mode sombre avec contraste atténué (pas de blanc sur noir pur).
- Réduction du « rivers effect » (pas de texte justifié).

---

## 3. FONCTIONNALITÉS — PRIORITÉS DE DÉVELOPPEMENT

### 3.1 EXISTANT (déjà implémenté) ✅

- Import PDF + reconstruction de la structure (lignes, blocs, pages)
- Lecture reflow en une colonne
- Réglages : police, taille, interligne, espacement lettres/mots, largeur, marges, thèmes
- Coloration syllabique et phonémique
- Mode sons français, lettres muettes atténuées
- Profils intégrés et personnalisés
- Mode vérification (repères discrets / relecture ciblée)
- Module mathématiques (normalisation, verbalisation, densité, rendu)
- Impression / export PDF adapté
- Modularisation partielle (document-model, decoding-engine, math-support, print-manifest)
- Fallback navigateur (`createBrowserApi()`)
- Audio (Web Speech API)

### 3.2 PRIORITÉ HAUTE — Prochaines itérations 🔴

#### A. Réglette de lecture / guide visuel
- Surlignage de la ligne active en lecture (bande horizontale semi-transparente).
- Mode « fenêtre de lecture » : n'afficher que N lignes autour de la position courante, le reste estompé.
- Suivi automatique lors de la lecture audio (la réglette suit le mot lu).
- Raccourcis : Flèche haut/bas pour déplacer la réglette manuellement.

#### B. Navigation clavier complète
- Tab / Shift+Tab pour naviguer entre les panneaux.
- Espace / Entrée pour activer les boutons.
- Échap pour quitter le mode immersion.
- Raccourcis affichés dans un panneau d'aide (Ctrl+?).
- Focus visible et contrasté sur tous les éléments interactifs.

#### C. Lecture audio améliorée
- Suivi mot par mot avec surlignage synchronisé (karaoké).
- Choix de voix (françaises : homme/femme, vitesse, pitch).
- Pause automatique en fin de paragraphe (durée réglable).
- Lecture des formules mathématiques verbalisées.
- Boutons prev/next pour sauter au paragraphe précédent/suivant.
- Possibilité de sélectionner un passage à lire.

#### D. Accessibilité WCAG 2.2 AA minimum
- Rôles ARIA sur tous les composants interactifs.
- Labels ARIA sur les sliders, boutons, menus.
- Annonces `aria-live` pour les changements d'état (profil changé, page chargée, etc.).
- Gestion du focus lors des transitions de panneaux.
- `prefers-reduced-motion` respecté.
- `prefers-color-scheme` respecté (si le système est en mode sombre).

#### E. OCR pour PDF scannés
- Intégration de Tesseract.js (ou Tesseract via addon natif pour les performances).
- Détection automatique : si le PDF n'a pas de couche texte → proposer l'OCR.
- Langues : français par défaut, anglais en option.
- Barre de progression pendant le traitement OCR.
- Possibilité de corriger manuellement le texte OCR.

### 3.3 PRIORITÉ MOYENNE — Court terme 🟡

#### F. Dictionnaire intégré
- Clic ou double-clic sur un mot → afficher une définition simple (Wiktionary API ou dictionnaire local).
- Prononciation audio du mot isolé.
- Découpage syllabique du mot sélectionné.

#### G. Mode résumé / simplification
- Intégration d'une IA locale ou API pour proposer une version simplifiée d'un paragraphe.
- Reformulation en « français facile » (FALC — Facile à Lire et à Comprendre).
- Remplacement automatique des mots complexes par des synonymes plus simples.

#### H. Annotations et marque-pages
- Système de marque-pages avec titre personnalisé.
- Surlignage persistant de passages importants.
- Notes vocales attachées à un passage.
- Export des annotations.

#### I. Profils par trouble
- Profil « Dyslexie légère » : réglages modérés.
- Profil « Dyslexie sévère » : réglages maximaux + réglette + audio.
- Profil « Dyscalculie » : focus sur le rendu mathématique + verbalisation.
- Profil « TDA/H » : mode immersion + timer + réglette.
- Profil « Dyspraxie » : cibles larges + navigation clavier + défilement auto.
- Profil « Enseignant/Orthophoniste » : vue côte à côte original/adapté + rapport de complexité.

### 3.4 PRIORITÉ BASSE — Moyen terme 🟢

#### J. Mode multi-colonnes → une colonne
- Détection automatique des mises en page multi-colonnes dans les PDF.
- Reconstruction de l'ordre de lecture naturel.

#### K. Gestion des images et schémas
- Extraction et repositionnement des images dans le flux de lecture.
- Description alternative IA des images (texte alt généré automatiquement).

#### L. Support EPUB / DOCX
- Import de fichiers EPUB en plus du PDF.
- Import de fichiers DOCX.
- Conversion interne vers le modèle de document unifié.

#### M. Mode examen / évaluation
- Timer avec compte à rebours.
- Tiers-temps intégré (calcul automatique : durée × 1.33).
- Masquage des aides de décodage si demandé par l'enseignant.
- Export du document « propre » pour impression en contexte d'examen.

#### N. Statistiques de lecture
- Temps passé par page/document.
- Vitesse de lecture estimée (mots par minute).
- Historique des documents lus.
- Rapport exportable pour suivi orthophoniste.

---

## 4. RÈGLES DE CODE

### 4.1 Architecture

```
src/
├── main.js                          # Processus principal Electron
├── preload.js                       # Bridge sécurisé (contextBridge)
├── index.html                       # Point d'entrée renderer
├── app.mjs                          # Orchestrateur principal
├── profiles.mjs                     # Gestion des profils
├── pdf-processing.mjs               # Import et parsing PDF
├── styles.css                       # Styles principaux
├── print.css                        # Styles impression
├── core/
│   ├── document/
│   │   ├── document-model.mjs       # Modèle de données du document
│   │   └── document-report.mjs      # Rapports de structure
│   ├── reading/
│   │   ├── decoding-engine.mjs      # Moteur de décodage (syllabes, phonèmes)
│   │   ├── math-support.mjs         # Support mathématiques
│   │   ├── reading-guide.mjs        # [À CRÉER] Réglette / guide visuel
│   │   └── audio-engine.mjs         # [À CRÉER] Moteur audio avancé
│   ├── export/
│   │   └── print-manifest.mjs       # Manifest d'impression
│   ├── accessibility/
│   │   ├── keyboard-nav.mjs         # [À CRÉER] Navigation clavier
│   │   └── aria-manager.mjs         # [À CRÉER] Gestion ARIA
│   └── ocr/
│       └── ocr-engine.mjs           # [À CRÉER] Intégration Tesseract
```

### 4.2 Conventions de code

- **Modules ESM** : tout fichier `.mjs`, imports/exports explicites.
- **Pas de dépendance lourde** : garder le bundle léger (PDF.js en legacy build, pas de framework UI).
- **Nommage** :
  - Fichiers : `kebab-case.mjs`
  - Fonctions : `camelCase`
  - Constantes : `UPPER_SNAKE_CASE`
  - Classes : `PascalCase`
  - Variables CSS : `--dl-prefixe-propriete` (ex : `--dl-font-size`, `--dl-line-height`)
- **Commentaires** : en français pour la documentation fonctionnelle, en anglais pour les commentaires techniques si besoin.
- **Gestion d'erreurs** : try/catch systématique sur les opérations PDF, OCR, audio. Messages d'erreur utilisateur en français, clairs et non techniques.

### 4.3 Règles CSS spécifiques dys

```css
/* JAMAIS faire ça */
.reading-zone {
    text-align: justify;        /* ❌ Crée des "rivières" blanches */
    font-family: serif;         /* ❌ Les empattements gênent */
    line-height: 1.2;           /* ❌ Trop serré */
    letter-spacing: normal;     /* ❌ Lettres trop proches */
    background: #ffffff;        /* ❌ Blanc pur = stress visuel */
    color: #000000;             /* ❌ Noir pur = contraste agressif */
}

/* TOUJOURS faire ça */
.reading-zone {
    text-align: left;           /* ✅ Alignement à gauche uniquement */
    font-family: var(--dl-font-family);  /* ✅ Configurable */
    line-height: var(--dl-line-height);  /* ✅ Min 1.8 */
    letter-spacing: var(--dl-letter-spacing); /* ✅ Min 0.12em */
    word-spacing: var(--dl-word-spacing);     /* ✅ Min 0.16em */
    background: var(--dl-bg-color);          /* ✅ Jamais blanc pur */
    color: var(--dl-text-color);             /* ✅ Jamais noir pur */
    max-width: var(--dl-reading-width);      /* ✅ 60-80 caractères */
    margin: 0 auto;                          /* ✅ Centré dans la fenêtre */
    padding: var(--dl-padding);              /* ✅ Marges généreuses */
}
```

### 4.4 Règles de performance

- Le rendu du texte adapté doit être instantané (< 100ms) après changement de réglage.
- L'import PDF : barre de progression obligatoire au-delà de 2 secondes.
- L'OCR : traitement en Web Worker pour ne pas bloquer l'UI.
- L'audio : pré-charger les 2-3 phrases suivantes pour éviter les blancs.
- Les profils : application des réglages en une seule opération CSS (modifier les variables CSS custom, pas les styles inline un par un).

### 4.5 Règles de test

- Tester chaque fonctionnalité avec au minimum 3 PDF différents :
  1. Un document texte simple (roman, article).
  2. Un document mathématique (cours, exercice).
  3. Un PDF scanné ou dégradé.
- Vérifier le rendu avec chaque profil intégré.
- Vérifier la navigation clavier sur chaque écran.
- Vérifier que `npm run check` passe sans erreur.

---

## 5. DESIGN SYSTEM

### 5.1 Palette de base (chrome UI — hors zone de lecture)

| Rôle | Variable | Valeur |
|------|----------|--------|
| Fond principal UI | `--dl-ui-bg` | `#F5F0EB` |
| Fond secondaire | `--dl-ui-bg-alt` | `#EDE8E3` |
| Texte UI | `--dl-ui-text` | `#2D2A26` |
| Texte secondaire | `--dl-ui-text-muted` | `#6B6560` |
| Accent principal | `--dl-ui-accent` | `#a0344a` |
| Accent hover | `--dl-ui-accent-hover` | `#8A2D40` |
| Bordure fine | `--dl-ui-border` | `#D5CFC8` |
| Ombre légère | `--dl-ui-shadow` | `0 1px 3px rgba(0,0,0,0.08)` |

### 5.2 Typographie UI

- Titres / Labels : **DM Sans** (600/700)
- Texte courant UI : **DM Sans** (400)
- Zone de lecture : configurable par l'utilisateur (défaut : **Verdana** ou **Atkinson Hyperlegible**)

### 5.3 Thèmes de lecture (zone de contenu uniquement)

| Thème | Fond | Texte | Usage |
|-------|------|-------|-------|
| Crème | `#FDF6E3` | `#3B3530` | Défaut, confort général |
| Bleu nuit | `#1A2332` | `#D4D8DE` | Mode sombre doux |
| Vert forêt | `#E8F5E9` | `#2E3B2E` | Stress visuel |
| Rose doux | `#FCE4EC` | `#3B2E33` | Certaines dyslexies |
| Sable | `#F5E6D3` | `#3B3025` | Alternative chaud |
| Gris neutre | `#E8E8E8` | `#333333` | Sans couleur |

---

## 6. ARBORESCENCE DES RACCOURCIS CLAVIER

| Action | Raccourci | Contexte |
|--------|-----------|----------|
| Ouvrir un fichier | `Ctrl+O` | Global |
| Mode immersion | `F11` ou `Ctrl+Shift+I` | Global |
| Lecture audio play/pause | `Espace` | Zone de lecture |
| Phrase suivante | `→` | Lecture audio active |
| Phrase précédente | `←` | Lecture audio active |
| Réglette haut | `↑` | Mode réglette actif |
| Réglette bas | `↓` | Mode réglette actif |
| Page suivante | `PageDown` | Zone de lecture |
| Page précédente | `PageUp` | Zone de lecture |
| Zoom + | `Ctrl+=` | Global |
| Zoom - | `Ctrl+-` | Global |
| Changer de profil | `Ctrl+1..9` | Global |
| Aide raccourcis | `Ctrl+?` ou `F1` | Global |
| Marque-page rapide | `Ctrl+B` | Zone de lecture |
| Panneau réglages | `Ctrl+,` | Global |
| Imprimer / Exporter | `Ctrl+P` | Global |

---

## 7. PRINCIPES UX NON NÉGOCIABLES

1. **Zéro configuration pour commencer** : l'utilisateur ouvre un PDF, les réglages par défaut sont déjà adaptés. Pas de wizard de 10 étapes.
2. **Chaque réglage a un effet visible immédiat** : pas de bouton « Appliquer ». Chaque slider/toggle modifie le rendu en temps réel.
3. **L'interface ne doit jamais être plus compliquée que le contenu** : le chrome UI doit s'effacer derrière le texte.
4. **Tolérance à l'erreur** : un mauvais réglage ne doit jamais casser l'affichage. Le bouton « Réinitialiser » est toujours accessible.
5. **Pas de jargon technique** dans l'interface : « Espacement des lettres » et non « letter-spacing ». « Vitesse de lecture audio » et non « speech rate ».
6. **Retour visuel systématique** : chaque action de l'utilisateur produit un feedback visible ou sonore.
7. **Progressive disclosure** : les réglages avancés sont cachés derrière un « Plus d'options ». L'écran par défaut montre : police, taille, thème, audio on/off.

---

## 8. PROMPT SYSTÈME POUR LE DÉVELOPPEMENT

Quand tu travailles sur ce projet, adopte le rôle suivant :

> Tu es un développeur senior spécialisé en accessibilité numérique et en troubles des apprentissages (dys). Tu connais les recommandations WCAG 2.2, les bonnes pratiques UDL (Universal Design for Learning), et les besoins spécifiques des utilisateurs dyslexiques, dysorthographiques, dyscalculiques, dyspraxiques et TDA/H.
>
> Tu travailles sur une application Electron (Node.js + Chromium) qui transforme des PDF en documents lisibles pour les personnes dys.
>
> Tes priorités absolues :
> 1. L'accessibilité et la lisibilité du résultat pour l'utilisateur final.
> 2. La stabilité et la robustesse du code (gestion d'erreurs, cas limites).
> 3. La performance perçue (réactivité de l'interface).
> 4. La maintenabilité du code (modularité, nommage clair).
>
> Tu ne proposes JAMAIS de texte justifié, de fond blanc pur, de police serif, ou de contraste noir pur sur blanc pur dans la zone de lecture.
>
> Tu testes mentalement chaque modification avec le profil « dyslexie sévère + dyspraxie » : est-ce que ça reste utilisable avec le clavier seul, en taille 24pt, avec interligne 2.5 ?
>
> Tu documentes chaque fonction publique avec un commentaire JSDoc en français.

---

## 9. CHECKLIST AVANT CHAQUE COMMIT

- [ ] `npm run check` passe sans erreur
- [ ] Navigation clavier : toutes les fonctions du changement sont accessibles au clavier
- [ ] Aucun `text-align: justify` dans le CSS
- [ ] Aucun `#FFFFFF` ou `#000000` dans la zone de lecture
- [ ] Les zones cliquables font au minimum 44×44px
- [ ] Les variables CSS `--dl-*` sont utilisées (pas de valeurs en dur dans la zone de lecture)
- [ ] Les messages d'erreur sont en français et compréhensibles
- [ ] Le mode immersion masque bien tous les éléments non essentiels
- [ ] L'impression produit un résultat lisible et adapté

---

## 10. RESSOURCES DE RÉFÉRENCE

- WCAG 2.2 : https://www.w3.org/TR/WCAG22/
- WCAG SC 1.4.12 (Text Spacing) : https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html
- British Dyslexia Association Style Guide : https://www.bdadyslexia.org.uk/advice/employers/creating-a-dyslexia-friendly-workplace/dyslexia-friendly-style-guide
- OpenDyslexic : https://opendyslexic.org/
- Atkinson Hyperlegible : https://brailleinstitute.org/freefont
- Luciole (police française pour malvoyants) : https://luciole-vision.com/
- FALC (Facile à Lire et à Comprendre) : https://www.unapei.org/article/le-facile-a-lire-et-a-comprendre-falc/
- Electron Builder : https://www.electron.build/
- PDF.js : https://mozilla.github.io/pdf.js/
- Tesseract.js : https://tesseract.projectnaptha.com/
