# Check-up PDF et profils

Date : 2026-04-06

## Profils principaux

- `Normal`
  - valide sur texte simple
  - pas d'aide au décodage ni de repères parasites
  - sommaire et titres simples mieux reconstruits

- `Lecture visuelle allégée`
  - valide comme profil sobre
  - pas de coloration dys active
  - aération et largeur de lecture stables

- `Dyslexie`
  - valide comme profil léger
  - aide au décodage modérée, sans surcharge sur les titres et repères de structure
  - fond et espacements plus confortables que le mode simple

- `Décodage renforcé`
  - valide comme profil fort
  - l'aide au décodage ne s'applique plus au sommaire, aux auteurs ni aux repères courts
  - reste réservé au vrai texte de lecture

- `Audio / Focus`
  - amélioré
  - clic sur un bloc : le bloc devient le point de départ
  - bouton `Lire` : démarre depuis le bloc sélectionné
  - bouton `Lire la sélection` : démarre sur un passage sélectionné
  - clavier : `Entrée` ou `Espace` sur un bloc lancent la lecture depuis ce bloc
  - pause / reprise plus fluides

## Corpus testé

- `0476_ARR_ACA_ORL_018_023_INT_BELHOMME_LUDOVIC.pdf`
- `20251210113659656.pdf`
- `2025_01_AF_janvier.pdf`
- `cours.pdf`
- `fiche08_extrait.pdf`
- `fontaine11.pdf`
- `Tableau_garanties.pdf`

## Résultats globaux

- Import texte :
  - `6/7` PDF du corpus sortent en qualité `good`
  - `1/7` PDF scanné sort en qualité `poor` sans OCR, ce qui est attendu

- Nettoyage générique amélioré :
  - suppression d'en-têtes et pieds répétés sur plusieurs pages
  - fusion de titres coupés sur deux lignes
  - réparation de mots collés ou découpés :
    - `Cycle`
    - `Fables`
    - `Fable`
    - `Acide`
    - `Sociale`
    - `pH est`
    - `ci-dessous`
    - `un acide dans`
    - `une base dans`
    - `Extrait des Femmes Savantes de Molière`
    - `vient à s'en vouloir`

## Points encore à surveiller

- PDF administratifs :
  - quelques découpes résiduelles en capitales restent possibles
  - exemples observés : `ORLE ANS`, `BEL HOMME`, `CE RT.`

- PDF littéraires :
  - certains collages autour des apostrophes ou clitiques restent présents
  - exemples observés : `quel'on`, `Donts'est`, `pudeurs'est`

- PDF assurance / tableaux :
  - certains mots restent parfois collés ou mal segmentés dans des lignes très denses
  - exemples observés : `ENLIGNE`, `BRSS) er`

- PDF scanné :
  - nécessite toujours l'OCR pour produire une version lisible

## Etat technique

- `npm run check` : OK
- tests lexique : OK
- tests syllabes : OK
- tests décodage : OK
- tests maths : OK

## Prochaine étape recommandée

Passer ensuite sur les profils avancés, puis enrichir encore le moteur avec une couche générique dédiée aux erreurs de clitiques et apostrophes, avant d'ajouter de nouvelles exceptions ciblées si nécessaire.
