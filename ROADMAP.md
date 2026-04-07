# ROADMAP.md — Stratégie Projet DysLecteur

> Plan de déploiement cross-platform, monétisation par dons, et feuille de route produit.

---

## 1. STRATÉGIE DE DISTRIBUTION CROSS-PLATFORM

### 1.1 Vue d'ensemble

L'objectif est de proposer DysLecteur sous **4 formes** complémentaires :

| Canal | Technologie | Cible | Priorité |
|-------|-------------|-------|----------|
| **Desktop Windows** | Electron + NSIS installer | Familles, écoles, orthophonistes | 🔴 P0 |
| **Desktop macOS** | Electron + DMG | Familles Mac, établissements Apple | 🔴 P0 |
| **Desktop Linux** | Electron + AppImage + .deb | Écoles sous Linux (Primtux, Ubuntu) | 🟡 P1 |
| **Web (navigateur)** | Même codebase, sans Electron | Accès immédiat, démonstration, mobile | 🟡 P1 |

### 1.2 Outil de build : electron-builder

**Pourquoi electron-builder** : c'est la solution la plus mature pour packager Electron sur les 3 OS, avec auto-update intégré, code signing, et support des stores.

**Configuration recommandée** (à ajouter dans `package.json`) :

```json
{
  "build": {
    "appId": "fr.dyslecteur.app",
    "productName": "DysLecteur",
    "copyright": "Copyright © 2026 DysLecteur",
    "directories": {
      "output": "dist",
      "buildResources": "build-resources"
    },
    "files": [
      "src/**/*",
      "node_modules/**/*",
      "package.json"
    ],
    "mac": {
      "category": "public.app-category.education",
      "icon": "build-resources/icon.icns",
      "target": [
        { "target": "dmg", "arch": ["x64", "arm64"] }
      ],
      "darkModeSupport": true,
      "hardenedRuntime": true,
      "gatekeeperAssess": false
    },
    "win": {
      "icon": "build-resources/icon.ico",
      "target": [
        { "target": "nsis", "arch": ["x64"] }
      ]
    },
    "nsis": {
      "oneClick": false,
      "perMachine": true,
      "allowToChangeInstallationDirectory": true,
      "installerLanguages": ["fr"],
      "language": "1036",
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    },
    "linux": {
      "icon": "build-resources/icons",
      "target": [
        "AppImage",
        "deb"
      ],
      "category": "Education",
      "desktop": {
        "Name": "DysLecteur",
        "Comment": "Lecteur PDF adapté pour les troubles dys",
        "Categories": "Education;Accessibility"
      }
    },
    "publish": {
      "provider": "github",
      "owner": "ton-username",
      "repo": "dyslecteur"
    }
  }
}
```

### 1.3 Scripts npm recommandés

```json
{
  "scripts": {
    "start": "electron src/main.js",
    "dev": "electron src/main.js --dev",
    "check": "node scripts/check.js",
    "build:win": "electron-builder --win",
    "build:mac": "electron-builder --mac",
    "build:linux": "electron-builder --linux",
    "build:all": "electron-builder --mac --win --linux",
    "release": "electron-builder --publish always"
  }
}
```

### 1.4 Code signing (signature du code)

#### Windows
- **Gratuit** : pas de signature → Windows SmartScreen affiche un avertissement « Application non reconnue ». Les utilisateurs doivent cliquer « Plus d'infos → Exécuter quand même ». C'est acceptable pour une v1 open-source.
- **Payant (~200-400€/an)** : certificat de signature de code (Sectigo, DigiCert, GlobalSign). Supprime l'avertissement SmartScreen.
- **Recommandation** : commencer sans signature, acheter un certificat quand le nombre d'utilisateurs le justifie.

#### macOS
- **Gratuit** : distribution hors Mac App Store sans signature. Les utilisateurs doivent faire Clic droit → Ouvrir → Confirmer (une seule fois).
- **Payant (99€/an)** : Apple Developer Program. Permet la signature + notarization. Supprime l'avertissement Gatekeeper. Ouvre l'accès au Mac App Store.
- **Recommandation** : compte Apple Developer dès que possible — l'expérience utilisateur macOS non signé est vraiment mauvaise.

#### Linux
- Pas de signature nécessaire pour AppImage / .deb.

### 1.5 Auto-update

Electron-builder intègre `electron-updater` qui fonctionne avec GitHub Releases :

1. L'app vérifie les nouvelles versions au démarrage.
2. Si une mise à jour existe → notification non intrusive à l'utilisateur.
3. Téléchargement en arrière-plan → installation au prochain redémarrage.

Configuration minimale : le champ `"publish"` dans le build config (déjà inclus ci-dessus).

### 1.6 Version web

Le codebase a déjà un `createBrowserApi()` dans `app.mjs`. Pour aller au bout :

1. Créer un `index-web.html` sans les imports Electron.
2. Remplacer les appels `electronApi.*` par le fallback navigateur.
3. L'import PDF fonctionne déjà côté navigateur (PDF.js est une lib web).
4. L'export PDF ne fonctionnera pas sans Electron → proposer uniquement l'impression navigateur.
5. L'audio (Web Speech API) fonctionne nativement dans les navigateurs.

**Hébergement** : GitHub Pages (gratuit) ou Vercel (gratuit tier). Domaine : `dyslecteur.fr` ou `dyslecteur.app`.

---

## 2. SYSTÈME DE DONS / FINANCEMENT

### 2.1 Philosophie

L'application est **gratuite et open-source**. Le financement repose sur des **dons volontaires** (ponctuels et récurrents), pas sur un modèle freemium ou des licences.

Raison : le public cible (familles d'enfants dys, enseignants, AESH) a souvent des moyens limités. Bloquer des fonctionnalités derrière un paywall irait à l'encontre de la mission.

### 2.2 Solutions de paiement recommandées

| Solution | Dons ponctuels | Dons récurrents | Frais | Adapté France |
|----------|---------------|-----------------|-------|---------------|
| **Stripe Payment Links** | ✅ | ✅ | 1.5% + 0.25€ (SEPA) / 2.9% + 0.25€ (CB) | ✅ |
| **Ko-fi** | ✅ | ✅ (Gold 6$/mois) | 0% (dons) / 5% (boutique) | ✅ |
| **Buy Me a Coffee** | ✅ | ✅ | 5% | ✅ |
| **GitHub Sponsors** | ✅ | ✅ | 0% (GitHub absorbe les frais) | ✅ |
| **Liberapay** | ✅ | ✅ | ~0% (dons à la plateforme) | ✅ (basé en France !) |
| **Open Collective** | ✅ | ✅ | 10% (hébergement fiscal inclus) | ✅ |
| **PayPal Donate** | ✅ | ✅ | 1.2-3.4% + fixe | ✅ |

### 2.3 Recommandation : approche multi-canal

**Combinaison recommandée** :

1. **Stripe** (canal principal) — Pour le site web et l'application.
   - Créer un compte Stripe (gratuit, inscription en 10 min).
   - Créer 2 Payment Links : un ponctuel (montant libre), un récurrent (3€, 5€, 10€/mois).
   - Intégrer les liens dans l'app (page « Soutenir le projet ») et sur le site web.
   - Avantage : frais SEPA très bas (1.5%), gestion complète des abonnements, tableaux de bord pro.

2. **GitHub Sponsors** (canal développeurs/communauté) — 0% de frais.
   - Activer GitHub Sponsors sur le repo du projet.
   - Les contributeurs tech et les développeurs préfèrent ce canal.

3. **Liberapay** (canal militant / open-source) — Basé en France, philosophie proche.
   - Bon complément pour la communauté libre française.

4. **Ko-fi** (canal grand public) — Simple, visuel, « Offrez-moi un café ».
   - Bon pour les partages sur les réseaux sociaux.

### 2.4 Intégration dans l'application

Ajouter une page/modale « Soutenir DysLecteur » accessible depuis le menu Aide :

```
┌─────────────────────────────────────────────┐
│         💜  Soutenir DysLecteur             │
│                                             │
│  DysLecteur est gratuit et le restera.      │
│  Votre soutien finance le développement     │
│  et permet à d'autres familles d'en         │
│  bénéficier.                                │
│                                             │
│  ┌─────────────┐  ┌──────────────────┐      │
│  │ Don ponctuel│  │ Don mensuel      │      │
│  │  (Stripe)   │  │  (Stripe)        │      │
│  └─────────────┘  └──────────────────┘      │
│                                             │
│  Autres moyens :                            │
│  🔗 GitHub Sponsors  🔗 Ko-fi               │
│  🔗 Liberapay                               │
│                                             │
│  Merci à nos soutiens 💜                    │
│  [Liste des sponsors publics]               │
└─────────────────────────────────────────────┘
```

### 2.5 Statut juridique (France)

Pour recevoir des dons en France de manière légale :

- **Option 1 : Auto-entrepreneur** — Le plus simple. Les dons sont déclarés comme du chiffre d'affaires (prestation de service). TVA non applicable sous le seuil. Simple et rapide à mettre en place.

- **Option 2 : Association loi 1901** — Plus adapté si le projet grandit. Permet de recevoir des dons défiscalisés (si association d'intérêt général = réduction d'impôt pour les donateurs). Nécessite un bureau (président, trésorier, secrétaire).

- **Option 3 : Micro-entreprise + Open Collective** — Open Collective peut servir de « fiscal host » et gérer la comptabilité des dons pour le projet.

**Recommandation** : commencer en auto-entrepreneur (10 min sur le guichet unique INPI). Si le projet décolle (> 50 donateurs réguliers), créer une association loi 1901 pour la défiscalisation des dons.

---

## 3. FEUILLE DE ROUTE GLOBALE

### Phase 1 — MVP Public (Mois 1-2) 🔴

**Objectif** : une version téléchargeable et utilisable par n'importe qui.

- [ ] Finaliser les installeurs Windows (.exe) et macOS (.dmg) via electron-builder
- [ ] Créer le packaging Linux (AppImage + .deb)
- [ ] Mettre en place les GitHub Releases avec auto-update
- [ ] Créer un site web vitrine simple (1 page) : description, téléchargement, dons
- [ ] Intégrer Stripe Payment Links (ponctuel + récurrent)
- [ ] Ajouter la page « Soutenir » dans l'application
- [ ] Rédiger un README complet avec captures d'écran
- [ ] Tester les installeurs sur des machines vierges (Windows 10/11, macOS Monterey+, Ubuntu 22.04+)
- [ ] Préparer les icônes : .ico (Win), .icns (Mac), .png 512×512 (Linux)

### Phase 2 — Accessibilité renforcée (Mois 2-4) 🟡

**Objectif** : couvrir tous les profils dys avec des fonctionnalités robustes.

- [ ] Réglette de lecture / guide visuel
- [ ] Navigation clavier complète + raccourcis
- [ ] Lecture audio karaoké (suivi mot par mot)
- [ ] ARIA complet sur tous les composants
- [ ] Profils pré-configurés par trouble
- [ ] Overlays colorés personnalisables
- [ ] Mode fenêtre de lecture (N lignes visibles)
- [ ] Tests utilisateurs avec 3-5 familles dys (retour terrain)

### Phase 3 — Intelligence et contenu (Mois 4-6) 🟢

**Objectif** : enrichir l'expérience avec des aides intelligentes.

- [ ] OCR pour PDF scannés (Tesseract.js)
- [ ] Dictionnaire intégré (clic sur un mot)
- [ ] Détection multi-colonnes et reflow intelligent
- [ ] Annotations et marque-pages persistants
- [ ] Version web déployée (GitHub Pages ou Vercel)
- [ ] Activer GitHub Sponsors + Ko-fi

### Phase 4 — Écosystème (Mois 6-12) 🔵

**Objectif** : construire une communauté et un produit de référence.

- [ ] Mode examen / tiers-temps
- [ ] Statistiques de lecture
- [ ] Support EPUB / DOCX
- [ ] Simplification IA de textes (FALC)
- [ ] Internationalisation (anglais)
- [ ] Mac App Store (si certificat Apple)
- [ ] Microsoft Store (si certificat Windows)
- [ ] Partenariats : associations dys (APEDYS, FFDys, ANAPEDYS)
- [ ] Présentation dans des salons / colloques éducation

---

## 4. COMMUNICATION ET VISIBILITÉ

### 4.1 Canaux prioritaires

1. **Groupes Facebook** : « Parents d'enfants dys », « Enseignants spécialisés », « Orthophonistes » — c'est là que le public cible se trouve.
2. **Twitter/X et Mastodon** : communauté dev/open-source + communauté éducation.
3. **Reddit** : r/dyslexia, r/opensource, r/france.
4. **Forums enseignants** : Neoprofs, EDP, forums académiques.
5. **Associations** : FFDys, APEDYS, ANAPEDYS — proposer des démonstrations.
6. **Product Hunt** : lancement officiel avec captures et vidéo.

### 4.2 Contenu à préparer

- Vidéo de démonstration (2 min) : import PDF → réglages → lecture adaptée.
- Captures d'écran comparatives : avant (PDF brut) / après (DysLecteur).
- Témoignage d'un parent ou enseignant (dès que possible).
- Article de blog : « Pourquoi j'ai créé DysLecteur — un prof de physique-chimie face aux troubles dys ».

---

## 5. CE QUE TU AS PEUT-ÊTRE OUBLIÉ

### 5.1 Fonctionnalités manquantes identifiées

| Manque | Impact | Difficulté |
|--------|--------|------------|
| **Réglette de lecture** | Critique pour dyslexie et TDA/H | Moyen |
| **Navigation clavier** | Bloquant pour dyspraxie | Moyen |
| **Lecture audio karaoké** | Très demandé | Élevé |
| **OCR** | Nécessaire pour les PDF scannés | Élevé |
| **Overlays colorés personnalisables** | Important pour syndrome d'Irlen | Faible |
| **Dictionnaire intégré** | Aide à la compréhension | Moyen |
| **Mode examen / tiers-temps** | Usage scolaire concret | Moyen |
| **Support EPUB/DOCX** | Élargit le public | Élevé |
| **Marque-pages persistants** | Continuité de lecture | Faible |
| **Timer / Pomodoro** | TDA/H | Faible |
| **Description alt des images** | Accessibilité complète | Élevé (IA) |
| **Raccourci rapide pour tout masquer** | Stress en contexte classe | Faible |

### 5.2 Aspects techniques à ne pas oublier

- **Internationalisation (i18n)** : prévoir une structure de traduction dès maintenant, même si la v1 est en français seul. Un simple fichier `locales/fr.json` avec toutes les chaînes de l'interface suffit.
- **Analytics respectueux** : envisager un analytics anonyme et opt-in (ex : Plausible, 100% RGPD) pour comprendre quels réglages sont les plus utilisés.
- **Changelog public** : un fichier CHANGELOG.md mis à jour à chaque release. Les utilisateurs dys apprécient de savoir ce qui a changé.
- **Politique de confidentialité** : même si l'app est offline, il faut une page « vie privée » claire indiquant qu'aucune donnée n'est collectée ni transmise.
- **Licence open-source** : choisir une licence (GPL-3.0 pour le copyleft fort, MIT pour la permissivité). GPL-3.0 est recommandée pour un outil éducatif qui ne doit pas être capté par un acteur commercial.

### 5.3 Aspects humains à ne pas oublier

- **Test utilisateur réel** : faire tester par 3-5 personnes dys (enfants ET adultes) AVANT la v1 publique.
- **Bêta-testeurs enseignants** : recruter 2-3 collègues enseignants pour valider les cas d'usage scolaires.
- **Feedback in-app** : un bouton « Signaler un problème » ou « Donner mon avis » directement dans l'app, qui ouvre un formulaire simple ou un lien vers un GitHub Issue pré-rempli.
- **Documentation utilisateur** : un guide d'utilisation simple, illustré, en français facile. L'idéal serait un guide lui-même lisible dans DysLecteur.
