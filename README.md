# Odysey - Lecteur PDF adapte dys

Odysey transforme n'importe quel PDF en lecture adaptee pour les personnes
presentant des troubles dys : dyslexie, dysorthographie, dyscalculie,
dyspraxie et TDA/H.

**[Utiliser en ligne](https://lbelhomme-pc.github.io/odysey/app/)** ·
**[Telecharger pour Windows](https://github.com/lbelhomme-pc/odysey/releases/latest)** ·
**[Site web](https://lbelhomme-pc.github.io/odysey/)**

## Fonctionnalites

- Import PDF avec reconstruction de la structure
- 11 profils de lecture preconfigures par besoin
- Coloration syllabique et phonemique
- Lecture audio avec suivi mot par mot
- OCR integre pour les PDF scannes
- Support des expressions mathematiques avec verbalisation
- Reglette de lecture et mode fenetre
- Overlays colores et themes de lecture
- Mode immersion
- Marque-pages et annotations persistants
- Impression / export PDF adapte
- Navigation clavier complete

## Installation

### Version desktop

Telecharge l'installateur ou la version portable depuis les
[Releases](https://github.com/lbelhomme-pc/odysey/releases/latest).

### Version web / PWA

Ouvre directement [Odysey en ligne](https://lbelhomme-pc.github.io/odysey/app/)
dans ton navigateur. La PWA est installable apres le premier chargement.

### Depuis les sources

```bash
git clone https://github.com/lbelhomme-pc/odysey.git
cd odysey
npm install
npm start
```

## Developpement

```bash
npm start
npm run check
npm run build:win
npm run build:web
```

## Structure utile

- `src/` : code source de l'application Electron et web
- `site/` : landing page GitHub Pages
- `scripts/` : scripts de build et d'outillage
- `docs/` : documentation projet
- `.github/workflows/` : CI/CD desktop et deploy Pages

## Packaging desktop

- Windows local : `docs/packaging/COMMANDES_WINDOWS.txt`
- macOS et Linux : `docs/packaging/MACOS_LINUX.txt`
- CI multi-plateformes : `docs/packaging/GITHUB_ACTIONS.txt`

## Site web et PWA

- landing page : `site/index.html`
- style de la landing : `site/styles.css`
- build web statique : `npm run build:web`
- sortie PWA : `web-dist/`
- deploiement GitHub Pages : `.github/workflows/deploy-site.yml`
- documentation : `docs/web/DEPLOIEMENT_WEB_PWA.txt`

## Soutenir le projet

- Tipeee : [fr.tipeee.com/odysey](https://fr.tipeee.com/odysey/)

## Licence

MIT - Copyright (c) 2026 Ludovic Belhomme
