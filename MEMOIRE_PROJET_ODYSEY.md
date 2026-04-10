# Memoire Projet Odysey

Date de synthese : 9 avril 2026
Version fonctionnelle de reference : 1.0.1
Projet : Odysey
Nature : application Electron + version web/PWA pour adapter la lecture de PDF aux troubles dys, aux difficultes attentionnelles et aux usages pedagogiques.

## 1. Identite du projet

Odysey est une application de lecture adaptee de documents PDF.
Son objectif est de transformer des documents souvent peu lisibles, mal extraits ou mal structures en une experience de lecture plus stable, plus sobre, plus pedagogique et plus accessible.

Le projet est pense pour :
- les eleves dys du primaire au superieur ;
- les adultes presentant des troubles du langage ecrit ou de l'attention ;
- les enseignants, orthophonistes, AESH, parents et accompagnants ;
- les situations de lecture scolaire, professionnelle et personnelle.

La philosophie du projet est constante :
- ne pas "medicaliser" l'interface ;
- ne pas imposer une seule facon de lire ;
- alleger la charge cognitive ;
- laisser la comprehension prendre le dessus sur le decodage ;
- proposer une adaptation concrete des PDF, y compris quand ils sont imparfaits.

## 2. Vision produit actuelle

Aujourd'hui, Odysey est a la fois :
- une application desktop Electron ;
- une application web/PWA diffusable via GitHub Pages ;
- un outil de lecture adaptee centre sur les PDF ;
- un environnement de lecture qui combine reflow, profils, audio, OCR, syllabes, maths/sciences, accompagnement lexical et outils de suivi.

Le projet ne se limite plus a un simple lecteur PDF.
Il s'approche d'une plateforme de lecture adaptee multi-usages avec :
- lecture recomposee ;
- export/impression adaptee ;
- OCR local ;
- profils differencies ;
- outils enseignant/parent/ortho ;
- amorce d'IA locale via Gemma.

## 3. Etat global du produit

L'etat actuel du projet peut etre resume ainsi :

- Le socle desktop est fonctionnel.
- La version web/PWA existe et peut etre publiee sur GitHub Pages.
- Le branding Odysey est en place sur l'application, le site, les icones et l'ecran d'ouverture.
- Les profils principaux ont ete largement calibres.
- La barre laterale a ete simplifiee par masquage/revelation progressive des options.
- L'import PDF, la reconstruction du texte, l'OCR, l'audio et l'aide au decodage ont deja beneficie de nombreuses passes de correction.
- Les mathematiques et sciences sont mieux gerees qu'au debut, y compris certaines lettres grecques et notations scientifiques.
- Une phase A d'IA locale Gemma est integree, avec un fonctionnement a la demande et en fallback.

Le projet est donc deja solide, mais encore en phase de maturation active.
Il reste un travail important de stabilisation totale sur les cas reels difficiles.

## 4. Stack technique

### Desktop

- Electron
- JavaScript vanilla en modules ESM
- PDF.js
- Web Speech API
- Tesseract.js
- electron-builder

### Web / PWA

- build statique du front
- manifest web app
- service worker
- publication via GitHub Pages

### OCR

- OCR local desktop avec modeles integres
- OCR web avec ressources servies localement par le site

### IA locale

- integration beta de Gemma 3 locale via Ollama
- usage cible : definitions enrichies, reformulations, resumes, comprehension contextuelle

## 5. Architecture actuelle

Le projet suit une architecture modulaire.

### Fichiers de pilotage

- `src/app.mjs` : orchestrateur principal du renderer
- `src/main.js` : processus principal Electron
- `src/preload.js` : bridge securise Electron
- `src/index.html` : interface principale
- `src/styles.css` : styles principaux de l'application
- `src/print.css` : styles d'impression/export
- `src/profiles.mjs` : definition et gestion des profils
- `src/pdf-processing.mjs` : import, nettoyage et reconstruction des PDF

### Noyau metier

- `src/core/document/` : modele documentaire, annotations, signets, rapports
- `src/core/reading/` : decodage, syllabes, audio, guide de lecture, maths, assistance de lecture
- `src/core/lexicon/` : lexique local et dictionnaire de formes
- `src/core/ocr/` : OCR local
- `src/core/ai/` : IA locale
- `src/core/accessibility/` : navigation clavier, ARIA, accessibilite
- `src/core/pwa/` : gestion PWA
- `src/core/support/` : liens de soutien / Tipeee

## 6. Fonctionnalites deja en place

### 6.1 Import PDF et reconstruction

Le projet sait :
- importer des PDF texte ;
- detecter des PDF scannes ou pauvres en couche texte ;
- reconstruire des blocs de lecture reflow ;
- nettoyer des parasites repetes ;
- detecter certains en-tetes et pieds de page repetes ;
- fusionner certains titres coupes ;
- nettoyer plusieurs artefacts OCR et collages de mots ;
- rendre le document plus lisible en colonne unique.

Des corrections ont ete faites sur :
- les barres verticales parasites ;
- les badges de page trop visibles ;
- les sommaires ;
- les titres scolaires ou litteraires mal recoles ;
- les apostrophes et clitiques colles ;
- les mots fusionnes ou decoupes apres OCR.

### 6.2 Lecture adaptee

L'application propose :
- largeur de lecture confortable ;
- interligne, espacements lettres et mots reglables ;
- themes de lecture distincts du theme de l'application ;
- police configurable ;
- profils integres et profils personnalises ;
- modes de syllabation pedagogique ou typographique de test ;
- etendue des syllabes configurable (`Auto` / `Tous les mots`).

### 6.3 Profils

Les profils principaux visibles ont ete simplifies et clarifies.
On retrouve notamment :
- Normal
- Lecture visuelle allegee
- Dyslexie
- Decodage renforce
- Audio / Focus

Les profils avances existent aussi, documentes et regroupes.
Des fiches detailles et comparatifs ont ete rediges dans `docs/profiles/`.

### 6.4 Decodage et syllabes

Le moteur de lecture gere :
- coloration syllabique ;
- coloration phonetique/sons dans certains profils ;
- attenuation de lettres muettes ;
- modes pedagogique et typographique separes ;
- exceptions lexicales de syllabation ;
- ajustement sur plusieurs familles de mots sensibles.

La syllabation a ete retravaillee pour coller a une logique pedagogique plus robuste.
Un dictionnaire d'exceptions separe existe.

### 6.5 Audio

L'application gere :
- lecture audio Web Speech API ;
- lecture depuis un bloc choisi ;
- lecture depuis un mot/phrase/bloc selon la selection ;
- pause/reprise ;
- `Lire ici` ;
- suivi plus fin du point de depart ;
- logique de reprise plus fiable qu'au debut.

Des corrections importantes ont ete faites sur :
- la selection du bon point de depart ;
- la reprise apres pause ;
- le clic sur un autre paragraphe en cours de pause ;
- la fluidite entre selection de texte et audio.

### 6.6 OCR local

L'OCR a beaucoup evolue.
Aujourd'hui :
- le desktop embarque des modeles OCR locaux ;
- l'application peut traiter des PDF scannes sans dependance reseau directe ;
- des messages de diagnostic plus utiles ont ete ajoutes ;
- plusieurs blocages de cache, de buffer et d'initialisation ont ete corriges ;
- la version web/PWA sait aussi reutiliser un OCR local navigateur avec ses ressources dediees.

### 6.7 Maths et sciences

Le support mathematique et scientifique est une brique importante du projet.
Les ameliorations integrees comprennent :
- detection de formules ;
- verbalisation ;
- traitement de plusieurs unites scientifiques ;
- support plus propre des exposants ;
- premiers traitements de lettres grecques ;
- nouvelles distinctions entre contenu scientifique reel et faux positifs.

Des faux positifs importants ont ete corriges sur des documents litteraires et administratifs.
Le moteur est meilleur qu'au debut, mais ce domaine reste encore a renforcer sur les cas les plus complexes.

### 6.8 Compréhension et vocabulaire

Cette zone de l'application sait maintenant :
- recuperer le mot clique ;
- afficher une syllabation coherente ;
- proposer une aide locale immediate ;
- proposer une definition avancee si l'IA locale est disponible ;
- produire une reformulation simple d'un bloc ;
- produire un resume court ;
- gerer la prononciation d'un mot isole.

Un alignement a ete fait entre :
- les reglages de syllabation du lecteur ;
- la zone Compréhension et vocabulaire ;
- le mode `Auto / Tous les mots`.

### 6.9 Outils de suivi

Le projet integre deja :
- repere de lecture ;
- reprise de lecture ;
- temps passe ;
- dernier profil utilise par document ;
- marque-pages ;
- annotations et remarques ;
- persistence locale de plusieurs informations par document.

### 6.10 Mode enseignant / parent / ortho

Une couche dediee a l'accompagnement pedagogique a ete ajoutee.
Elle permet :
- une lecture plus analytique ;
- une comparaison brut/adapte ;
- des remarques par document ;
- une logique d'export de fiche ;
- un usage accompagne par adulte ou professionnel.

### 6.11 Mode examen

Un mode examen sobre est present.
Il vise :
- un rendu plus discret ;
- une logique de passation ;
- la gestion du tiers-temps ;
- un affichage plus propre a l'impression.

### 6.12 IA locale Gemma - Phase A

Une premiere phase d'integration d'IA locale est presente.
Elle permet :
- de verifier la disponibilite de Gemma locale ;
- de choisir un mode de fonctionnement ;
- d'utiliser Gemma a la demande ou en prioritaire ;
- de garder un fallback local si l'IA n'est pas disponible.

Le moteur actuel s'appuie sur :
- Ollama
- Gemma 3 locale

Cette phase A n'est pas encore la phase "zero friction", mais elle pose deja la couche de base.

## 7. Identite visuelle et UX

### 7.1 Branding

Le projet a ete renomme et rebadge en Odysey.
Les elements suivants ont ete harmonises :
- logo principal large ;
- petit logo pour les icones ;
- splash screen d'ouverture ;
- favicon et icones de packaging ;
- vitrine web ;
- footer et lien Tipeee.

### 7.2 Themes d'application

L'application dispose d'un theme d'application distinct du fond de lecture PDF.
Les modes principaux sont :
- Clair
- Doux
- Sombre

Le fond du document reste gere separement.

### 7.3 Splash screen

Une animation d'apparition/disparition douce du branding Odysey a ete ajoutee au lancement.

### 7.4 Barre laterale

La barre laterale a ete simplifiee.
Les dernieres decisions UX vont dans ce sens :
- boites repliables ;
- tout masque par defaut ;
- bouton `Afficher / Masquer` aligne ;
- profils caches derriere une action explicite ;
- regroupement des actions documentaires ensemble ;
- suppression de la surcharge au premier regard.

### 7.5 Vitrine web

La landing page web a ete entierement refaite dans un style plus premium, editorial et sobre.
Les directions prises :
- hero large ;
- palette reduite ;
- image de fond parisienne desaturee ;
- ton plus haut de gamme ;
- contenu plus personnel et credible ;
- suppression des sections trop generiques.

## 8. Presentation personnelle integree au site

Le site presente maintenant plus clairement le porteur du projet.

Les elements mis en avant sont :
- professeur de physique-chimie au college actuellement ;
- ancien parcours de these en chimie ;
- interets et experiences du cote biologie / reseaux informatiques / telecommunications ;
- projet ne d'une confrontation concrete aux difficultes de lecture au college ;
- volonte d'ameliorer l'acces aux PDF et aux photocopies ;
- projet recent, encore perfectible ;
- invitation a signaler les problemes ;
- contact visible sur le site.

Le lien de soutien renvoie vers :
- Tipeee Odysey

## 9. Packaging et diffusion

### 9.1 Desktop

Le projet sait produire :
- un installateur Windows ;
- un package Windows sans installation ;
- un dossier `win-unpacked` avec executable direct ;
- des configurations macOS ;
- des configurations Linux.

Windows est deja le plus avance.
Les builds desktop ont ete prepares pour :
- installateur
- zip/noinstall
- executable direct

### 9.2 Icônes

Les icones Windows ont ete revues avec de vrais fichiers `.ico` multi-usages pour limiter les incoherences d'affichage sur les raccourcis et executables.

### 9.3 GitHub Actions

Le depot contient des workflows pour :
- build desktop multi-plateforme ;
- deploiement du site + de l'app web.

### 9.4 Web / PWA

La PWA existe et comprend :
- manifest ;
- service worker ;
- build statique dedie ;
- publication GitHub Pages ;
- app accessible sous `/app/`.

## 10. Site, web et deploiement GitHub

Le depot GitHub `odysey` a ete pousse et rendu public.
GitHub Pages a ete active.

Le site public vise :
- la vitrine a la racine ;
- l'application web dans `/app/`.

Des workflows ont ete prepares pour :
- `Deploy site + web app`
- `Build desktop packages`

## 11. Documentation produite

Le projet contient deja une documentation importante.

Parmi les documents notables :
- resumés de projet ;
- roadmap ;
- checkups de corpus PDF ;
- checklist de recette ;
- fiches profils principales ;
- fiches profils avances ;
- comparatifs de profils ;
- documentation packaging ;
- documentation web/PWA ;
- documentation des build scripts ;
- rapports d'audit.

## 12. Validation et tests

La commande de validation de reference du projet est :
- `npm run check`

Des tests existent deja notamment pour :
- syllabation francaise ;
- lecture assistee ;
- moteur audio ;
- moteur de decodage ;
- support mathematique ;
- lexique francais ;
- IA locale ;
- autres briques centrales.

Le projet a aussi ete verifie a plusieurs reprises sur un corpus de PDF reels dans `Test_pdf/`.

## 13. Corpus, donnees et lexique

Un dictionnaire/lexique francais local a ete integre au projet.
Il est utilise pour :
- verification OCR ;
- detection de mots douteux ;
- reparation partielle de mots colles ou deformes ;
- soutien a la lecture et a certaines heuristiques.

Des scripts de generation de lexique sont presents.
Un corpus de PDF de test manuel est conserve dans `Test_pdf/`.

## 14. Sauvegardes et securisation du travail

Un systeme de backup local a ete prepare.
Un snapshot date du projet existe dans `backups/`.

Cela permet de garder un etat de reference en cas de regression lourde pendant les evolutions futures.

## 15. Ce qui est considere comme deja bien stabilise

Les zones les plus stabilisees aujourd'hui sont :
- l'identite visuelle globale Odysey ;
- le socle Electron ;
- la logique de profils principaux ;
- le packaging Windows de base ;
- le deploiement GitHub Pages ;
- le branding site/app ;
- la documentation de profils ;
- la presence d'une PWA diffusable ;
- le socle OCR local ;
- l'amorce de lecture enrichie ;
- le systeme de themes d'application distinct des themes de lecture.

## 16. Ce qui reste encore fragile ou en maturation

Malgre les progres, certaines zones restent a consolider.

### 16.1 Priorite absolue

Stabilisation totale de la lecture sur cas reels :
- import PDF difficiles ;
- OCR abime ;
- tableaux ;
- colonnes ;
- formules complexes ;
- cas sciences lourds ;
- derniers artefacts de reflow ;
- fluidite de selection et d'audio.

### 16.2 Profils avances

Ils sont documentes mais pas encore tous calibres aussi finement que les profils principaux.

### 16.3 IA locale phase B

La phase A est faite.
La phase "zero friction" n'est pas encore en place.
Il reste a automatiser la preparation du runtime et des modeles pour que l'utilisateur n'ait presque rien a faire.

### 16.4 Dictionnaire local etendu

Le lexique existe.
Un vrai gros dictionnaire local complet avec definitions et couche pedagogique n'est pas encore construit.

### 16.5 Maths/sciences avancees

Le systeme est bien meilleur qu'au depart, mais il faut encore consolider :
- fractions complexes ;
- systemes d'equations plus denses ;
- tableaux scientifiques ;
- schemas legendees ;
- cas de chimie/physique plus riches.

### 16.6 Web/PWA au niveau desktop

La version web fonctionne, mais n'a pas encore exactement le meme niveau de maturite percue que la version desktop sur tous les plans.

## 17. Priorites logiques apres cette memoire

L'ordre le plus raisonnable aujourd'hui est :

1. stabiliser totalement la lecture sur vrais PDF ;
2. fiabiliser a fond audio / selection / reprise / guide ;
3. consolider maths/sciences et OCR ;
4. recalibrer les profils avances ;
5. preparer la phase B IA locale zero friction ;
6. construire ensuite un dictionnaire local plus ambitieux.

## 18. Etat reel du projet a ce jour

Odysey n'est plus un prototype.
C'est deja un produit logiciel riche, coherent, personalise, documente et deployable.

Il reste cependant encore en phase d'amelioration active :
- certaines zones sont tres abouties ;
- d'autres demandent encore de la validation sur cas reels ;
- le projet est recent et peut encore presenter des defauts ponctuels ;
- la trajectoire generale est claire et solide.

En resume :
- l'identite produit existe ;
- le socle technique existe ;
- la diffusion existe ;
- la documentation existe ;
- la logique pedagogique existe ;
- il faut maintenant continuer a durcir l'ensemble pour atteindre une lecture vraiment irreprochable sur tous les cas usuels.

