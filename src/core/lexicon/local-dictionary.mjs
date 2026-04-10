import { normalizeFrenchLexiconWord } from "./french-lexicon.mjs";

/**
 * Normalise une clé de dictionnaire local sans perdre le sens du mot.
 *
 * @param {string} value
 * @returns {string}
 */
function normalizeLocalDictionaryKey(value) {
  return normalizeFrenchLexiconWord(String(value || "").replace(/[’']/gu, "'"));
}

/**
 * Crée une entrée de dictionnaire local.
 *
 * @param {string} lemma
 * @param {string} definition
 * @param {{
 *   category?: string,
 *   variants?: string[],
 *   autoPlural?: boolean,
 *   autoFeminine?: boolean,
 *   feminineForm?: string,
 *   variantStrategy?: "nominal" | "custom"
 * }} [options]
 * @returns {{
 *   lemma: string,
 *   definition: string,
 *   category: string,
 *   variants: string[],
 *   autoPlural: boolean,
 *   autoFeminine: boolean,
 *   feminineForm: string,
 *   variantStrategy: "nominal" | "custom"
 * }}
 */
function createEntry(lemma, definition, options = {}) {
  return {
    lemma,
    definition,
    category: options.category || "general",
    variants: Array.isArray(options.variants) ? options.variants : [],
    autoPlural: options.autoPlural !== false,
    autoFeminine: options.autoFeminine === true,
    feminineForm: options.feminineForm || "",
    variantStrategy: options.variantStrategy || "nominal"
  };
}

/**
 * Crée une entrée verbale régulière en -er avec variantes courantes.
 *
 * @param {string} lemma
 * @param {string} definition
 * @param {{ category?: string }} [options]
 * @returns {ReturnType<typeof createEntry>}
 */
function createErVerbEntry(lemma, definition, options = {}) {
  return createEntry(lemma, definition, {
    category: options.category || "school",
    variants: buildErVerbVariants(lemma),
    autoPlural: false,
    variantStrategy: "custom"
  });
}

/**
 * Génère des variantes nominales/adjectivales simples.
 *
 * @param {string} lemma
 * @param {{ autoPlural?: boolean, autoFeminine?: boolean, feminineForm?: string }} [options]
 * @returns {string[]}
 */
function buildNominalVariants(lemma, options = {}) {
  const variants = new Set([lemma]);
  const safeLemma = String(lemma || "");

  if (options.autoPlural !== false) {
    if (/[sxz]$/u.test(safeLemma)) {
      variants.add(safeLemma);
    } else if (/eau$/u.test(safeLemma)) {
      variants.add(`${safeLemma}x`);
    } else if (/al$/u.test(safeLemma)) {
      variants.add(`${safeLemma.slice(0, -2)}aux`);
    } else if (/(au|eu)$/u.test(safeLemma)) {
      variants.add(`${safeLemma}x`);
    } else {
      variants.add(`${safeLemma}s`);
    }
  }

  if (options.autoFeminine) {
    const feminine = options.feminineForm || `${safeLemma}e`;
    variants.add(feminine);
    variants.add(/[sxz]$/u.test(feminine) ? feminine : `${feminine}s`);
  }

  return [...variants];
}

/**
 * Génère des formes très fréquentes pour un verbe régulier en -er.
 *
 * @param {string} lemma
 * @returns {string[]}
 */
function buildErVerbVariants(lemma) {
  const safeLemma = String(lemma || "");
  if (!safeLemma.endsWith("er")) {
    return [safeLemma];
  }

  const stem = safeLemma.slice(0, -2);
  return [
    safeLemma,
    `${stem}e`,
    `${stem}es`,
    `${stem}ent`,
    `${stem}ons`,
    `${stem}ez`,
    `${stem}ais`,
    `${stem}ait`,
    `${stem}aient`,
    `${stem}é`,
    `${stem}ée`,
    `${stem}és`,
    `${stem}ées`,
    `${stem}ant`
  ];
}

const GENERAL_ENTRIES = [
  createEntry("mot", "Petit élément de langue que l’on lit, écrit ou prononce avec un sens précis."),
  createEntry("phrase", "Suite de mots organisée pour exprimer une idée complète."),
  createEntry("texte", "Ensemble de phrases qui développent une ou plusieurs idées."),
  createEntry("document", "Support écrit qui contient des informations à lire ou à consulter."),
  createEntry("paragraphe", "Bloc de texte qui développe une idée ou une étape du raisonnement."),
  createEntry("page", "Face d’un document ou d’un livre que l’on lit séparément des autres."),
  createEntry("titre", "Texte court qui annonce le sujet d’un document, d’une partie ou d’une œuvre."),
  createEntry("chapitre", "Grande partie d’un livre ou d’un document."),
  createEntry("section", "Sous-partie d’un chapitre ou d’un document."),
  createEntry("lecture", "Action de lire et de comprendre un texte."),
  createEntry("compréhension", "Fait de saisir le sens d’un mot, d’une phrase ou d’un document."),
  createEntry("sens", "Idée ou signification portée par un mot, une phrase ou un texte."),
  createEntry("idée", "Contenu principal que l’on veut exprimer ou retenir."),
  createEntry("syllabe", "Petit morceau écrit et sonore d’un mot que l’on peut prononcer d’un seul élan."),
  createEntry("définition", "Explication courte qui aide à comprendre ce qu’un mot ou une notion veut dire."),
  createEntry("résumé", "Version plus courte d’un texte qui garde seulement l’essentiel."),
  createEntry("reformulation", "Nouvelle manière de dire la même idée avec des mots plus simples ou plus clairs."),
  createEntry("consigne", "Instruction qui indique ce qu’il faut faire."),
  createEntry("question", "Phrase qui demande une réponse, une recherche ou une explication."),
  createEntry("réponse", "Ce qui est donné pour expliquer, résoudre ou compléter une question."),
  createEntry("explication", "Texte ou parole qui aide à comprendre un fait, une idée ou une méthode."),
  createEntry("exemple", "Cas précis qui sert à mieux comprendre une règle ou une idée."),
  createEntry("vocabulaire", "Ensemble des mots employés dans une langue, un texte ou un domaine."),
  createEntry("source", "Origine d’une information, d’un document ou d’une citation."),
  createEntry("contexte", "Ensemble des éléments qui entourent une phrase, une situation ou une idée.")
];

const LITERATURE_ENTRIES = [
  createEntry("auteur", "Personne qui a écrit un texte, un livre ou une œuvre.", {
    category: "literature",
    variants: ["auteure", "auteurs", "auteures"],
    autoPlural: false,
    variantStrategy: "custom"
  }),
  createEntry("narrateur", "Voix qui raconte l’histoire dans un texte.", {
    category: "literature",
    variants: ["narratrice", "narrateurs", "narratrices"],
    autoPlural: false,
    variantStrategy: "custom"
  }),
  createEntry("personnage", "Être réel ou inventé qui joue un rôle dans un récit ou une pièce.", { category: "literature" }),
  createEntry("dialogue", "Échange de paroles entre plusieurs personnages.", { category: "literature" }),
  createEntry("tirade", "Longue prise de parole d’un personnage au théâtre.", { category: "literature" }),
  createEntry("scène", "Partie d’une pièce de théâtre ou moment précis représenté devant le public.", { category: "literature" }),
  createEntry("acte", "Grande division d’une pièce de théâtre.", { category: "literature" }),
  createEntry("roman", "Long récit écrit qui raconte une histoire.", { category: "literature" }),
  createEntry("conte", "Récit souvent court, parfois merveilleux, qui raconte une histoire symbolique ou imagée.", { category: "literature" }),
  createEntry("récit", "Texte qui raconte des événements ou une histoire.", { category: "literature" }),
  createEntry("fable", "Petit récit qui fait souvent passer une idée ou une morale à travers une histoire.", { category: "literature" }),
  createEntry("morale", "Leçon ou idée principale qu’un texte veut faire retenir.", { category: "literature" }),
  createEntry("poème", "Texte travaillé pour le rythme, les sons, les images et l’émotion.", { category: "literature" }),
  createEntry("vers", "Ligne d’un poème organisée par le rythme ou la longueur.", { category: "literature" }),
  createEntry("strophe", "Groupe de vers formant un ensemble dans un poème.", { category: "literature" }),
  createEntry("rime", "Retour d’un même son à la fin de plusieurs vers.", { category: "literature" }),
  createEntry("alexandrin", "Vers de douze syllabes souvent utilisé dans la poésie classique française.", { category: "literature" }),
  createEntry("hémistiche", "Moitié d’un vers, surtout dans un alexandrin.", { category: "literature" }),
  createEntry("monologue", "Longue parole d’un personnage qui s’exprime seul sur scène ou dans un texte.", { category: "literature" }),
  createEntry("didascalie", "Indication écrite dans une pièce pour préciser le jeu, le ton ou les gestes.", { category: "literature" }),
  createEntry("registre", "Couleur dominante d’un texte, comme le comique, le tragique ou le lyrique.", { category: "literature" }),
  createEntry("champ", "Ensemble de mots liés à une même idée.", { category: "literature" }),
  createEntry("lexical", "Qui concerne les mots employés dans un texte.", { category: "literature" }),
  createEntry("hyperbole", "Figure qui exagère pour frapper l’esprit.", { category: "literature" }),
  createEntry("ironie", "Manière de dire le contraire de ce que l’on pense pour faire comprendre une critique ou un décalage.", { category: "literature" }),
  createEntry("allégorie", "Image prolongée qui représente une idée abstraite sous une forme concrète.", { category: "literature" }),
  createEntry("satire", "Texte ou passage qui critique en se moquant.", { category: "literature" }),
  createEntry("portrait", "Description d’une personne, de son apparence ou de son caractère.", { category: "literature" }),
  createEntry("quiproquo", "Situation où plusieurs personnages comprennent mal ce qui se passe.", { category: "literature" }),
  createEntry("intrigue", "Enchaînement des événements d’un récit ou d’une pièce.", { category: "literature" }),
  createEntry("dénouement", "Moment où l’intrigue se termine et où la situation se clarifie.", { category: "literature" }),
  createEntry("réplique", "Parole brève d’un personnage dans un dialogue théâtral.", { category: "literature" }),
  createEntry("aparté", "Parole dite sur scène comme si les autres personnages ne l’entendaient pas.", { category: "literature" }),
  createEntry("confidence", "Parole intime confiée à une autre personne.", { category: "literature" }),
  createEntry("aveu", "Parole par laquelle on reconnaît ou révèle quelque chose.", { category: "literature" }),
  createEntry("jalousie", "Sentiment de crainte ou de souffrance lié à l’idée de perdre quelqu’un ou quelque chose.", { category: "literature" }),
  createEntry("passion", "Sentiment très fort qui emporte la pensée ou le comportement.", { category: "literature" }),
  createEntry("tragique", "Qui évoque la souffrance, le destin ou une issue grave.", {
    category: "literature",
    variants: ["tragiques"],
    autoPlural: false,
    variantStrategy: "custom"
  }),
  createEntry("lyrique", "Qui exprime fortement les sentiments et l’émotion.", {
    category: "literature",
    variants: ["lyriques"],
    autoPlural: false,
    variantStrategy: "custom"
  }),
  createEntry("théâtre", "Genre littéraire fondé sur les dialogues et la représentation sur scène.", { category: "literature" }),
  createEntry("prologue", "Début d’une œuvre qui introduit le contexte ou prépare la lecture.", { category: "literature" }),
  createEntry("épilogue", "Dernière partie d’un texte qui vient conclure ou fermer le récit.", { category: "literature" }),
  createEntry("tragédie", "Pièce ou récit grave où les événements conduisent à une issue malheureuse.", { category: "literature" }),
  createEntry("comédie", "Pièce ou récit qui fait sourire tout en montrant des travers humains.", { category: "literature" }),
  createEntry("métaphore", "Image qui rapproche deux choses sans outil de comparaison explicite.", { category: "literature" }),
  createEntry("comparaison", "Figure qui rapproche deux éléments avec un mot comme « comme », « tel » ou « semblable à ».", { category: "literature" }),
  createEntry("interprète", "Personne, signe ou parole qui sert à transmettre ou à expliquer un sens.", { category: "literature" }),
  createEntry("secret", "Ce qui est caché ou réservé à un petit nombre de personnes.", {
    category: "literature",
    variants: ["secrets", "secrète", "secrètes"],
    autoPlural: false,
    variantStrategy: "custom"
  }),
  createEntry("subtil", "Qui demande un peu d’attention pour être bien compris, car ce n’est pas évident au premier regard.", {
    category: "literature",
    variants: ["subtile", "subtils", "subtiles"],
    autoPlural: false,
    variantStrategy: "custom"
  }),
  createEntry("muet", "Qui ne parle pas ou qui reste silencieux dans un contexte donné.", {
    category: "literature",
    variants: ["muets", "muette", "muettes"],
    autoPlural: false,
    variantStrategy: "custom"
  }),
  createEntry("flamme", "Partie lumineuse et chaude d’un feu.", { category: "literature" }),
  createErVerbEntry("rencontrer", "Trouver, croiser ou vivre quelque chose en chemin.", { category: "literature" }),
  createErVerbEntry("interpréter", "Donner un sens à des mots, des signes ou une situation.", { category: "literature" }),
  createErVerbEntry("exiler", "Forcer quelqu’un à quitter un lieu ou vivre loin de son milieu habituel.", { category: "literature" })
];

const SCHOOL_ENTRIES = [
  createEntry("leçon", "Partie d’un cours que l’on doit comprendre, apprendre ou revoir.", { category: "school" }),
  createEntry("cours", "Ensemble des explications données pour apprendre un sujet.", { category: "school" }),
  createEntry("exercice", "Travail demandé pour s’entraîner ou vérifier une compétence.", { category: "school" }),
  createEntry("méthode", "Manière organisée de faire un exercice ou de résoudre un problème.", { category: "school" }),
  createEntry("correction", "Version expliquée d’un exercice ou d’une réponse attendue.", { category: "school" }),
  createEntry("argument", "Raison avancée pour défendre une idée ou une réponse.", { category: "school" }),
  createEntry("analyse", "Étude attentive d’un texte, d’un document ou d’une situation.", { category: "school" }),
  createEntry("synthèse", "Texte ou présentation qui rassemble l’essentiel de plusieurs idées.", { category: "school" }),
  createEntry("objectif", "Ce que l’on cherche à atteindre ou à comprendre.", { category: "school" }),
  createEntry("notion", "Idée importante à connaître dans une matière.", { category: "school" }),
  createEntry("compétence", "Capacité à réussir une tâche grâce à des connaissances et une méthode.", { category: "school" }),
  createEntry("repère", "Élément qui aide à se situer, à comprendre ou à s’orienter dans un document.", { category: "school" }),
  createEntry("chronologie", "Ordre des événements dans le temps.", { category: "school" }),
  createEntry("documentaire", "Qui apporte des informations réelles et vérifiables.", { category: "school" }),
  createEntry("conséquence", "Ce qui arrive après un fait ou une action.", { category: "school" }),
  createEntry("cause", "Ce qui produit un effet ou explique un événement.", { category: "school" }),
  createEntry("justification", "Explication qui montre pourquoi une réponse est correcte.", { category: "school" }),
  createEntry("observation", "Information relevée en regardant attentivement.", { category: "school" }),
  createEntry("hypothèse", "Idée de départ que l’on veut vérifier.", { category: "school" }),
  createEntry("conclusion", "Idée finale que l’on retient après l’analyse.", { category: "school" }),
  createEntry("résultat", "Ce que l’on obtient après une action, un calcul ou une expérience.", { category: "school" }),
  createEntry("démarche", "Suite d’étapes que l’on suit pour réussir une tâche ou résoudre un problème.", { category: "school" }),
  createEntry("raisonnement", "Enchaînement d’idées qui permet d’arriver à une réponse ou à une conclusion.", { category: "school" }),
  createEntry("énoncé", "Texte qui présente un exercice, un problème ou une question.", { category: "school" }),
  createEntry("problématique", "Question centrale à laquelle un travail doit répondre.", { category: "school" }),
  createEntry("recherche", "Action de chercher des informations ou une solution.", { category: "school" }),
  createEntry("stratégie", "Choix organisé d’une manière de faire pour réussir.", { category: "school" }),
  createEntry("brouillon", "Version provisoire d’un travail qui sert à chercher ou à tester.", { category: "school" }),
  createEntry("référence", "Élément précis sur lequel on s’appuie pour justifier ou compléter une réponse.", { category: "school" }),
  createEntry("pertinent", "Qui convient bien à la question ou à la tâche demandée.", {
    category: "school",
    variants: ["pertinente", "pertinents", "pertinentes"],
    autoPlural: false,
    variantStrategy: "custom"
  }),
  createEntry("essentiel", "Ce qui est le plus important à retenir.", {
    category: "school",
    variants: ["essentielle", "essentiels", "essentielles"],
    autoPlural: false,
    variantStrategy: "custom"
  }),
  createErVerbEntry("expliquer", "Rendre une idée plus claire pour qu’elle soit mieux comprise.", { category: "school" }),
  createErVerbEntry("montrer", "Faire voir, signaler ou rendre visible quelque chose.", { category: "school" }),
  createErVerbEntry("comparer", "Observer ce qui se ressemble et ce qui change entre deux éléments.", { category: "school" }),
  createErVerbEntry("mesurer", "Déterminer une grandeur à l’aide d’une unité ou d’un instrument.", { category: "school" }),
  createErVerbEntry("calculer", "Trouver un résultat en utilisant des nombres, des opérations ou une méthode.", { category: "school" }),
  createErVerbEntry("observer", "Regarder attentivement pour relever des informations.", { category: "school" }),
  createErVerbEntry("préparer", "Mettre en place ce qu’il faut avant une action, une expérience ou une séance.", { category: "school" }),
  createErVerbEntry("transformer", "Faire passer quelque chose d’un état ou d’une forme à un autre.", { category: "school" }),
  createErVerbEntry("analyser", "Étudier un document ou une situation avec attention pour en comprendre le sens.", { category: "school" }),
  createErVerbEntry("justifier", "Donner des raisons claires pour défendre une réponse.", { category: "school" }),
  createErVerbEntry("décrire", "Présenter ce que l’on voit ou comprend avec des mots précis.", { category: "school" }),
  createErVerbEntry("réviser", "Revoir une leçon ou une méthode pour mieux la retenir.", { category: "school" }),
  createErVerbEntry("mémoriser", "Retenir une information pour la retrouver plus tard.", { category: "school" }),
  createErVerbEntry("identifier", "Repérer précisément ce qu’il faut trouver ou nommer.", { category: "school" }),
  createErVerbEntry("relever", "Repérer dans un document l’information demandée.", { category: "school" }),
  createErVerbEntry("repérer", "Trouver un élément précis dans un texte, un schéma ou un document.", { category: "school" }),
  createErVerbEntry("citer", "Reprendre exactement une information ou un passage.", { category: "school" }),
  createErVerbEntry("souligner", "Mettre en évidence un mot, une idée ou un passage important.", { category: "school" }),
  createErVerbEntry("résumer", "Redire un texte plus brièvement en gardant l’essentiel.", { category: "school" }),
  createErVerbEntry("reformuler", "Redire une idée avec d’autres mots pour la rendre plus claire.", { category: "school" }),
  createErVerbEntry("classer", "Ranger des éléments selon un critère précis.", { category: "school" }),
  createErVerbEntry("relier", "Mettre en lien plusieurs idées ou informations.", { category: "school" }),
  createErVerbEntry("compléter", "Ajouter ce qui manque pour rendre un exercice ou une phrase corrects.", { category: "school" }),
  createErVerbEntry("entourer", "Tracer un cercle ou une marque autour de ce qu’il faut choisir.", { category: "school" }),
  createErVerbEntry("cocher", "Marquer une case pour indiquer un choix.", { category: "school" }),
  createErVerbEntry("associer", "Mettre ensemble des éléments qui vont avec.", { category: "school" }),
  createErVerbEntry("ordonner", "Mettre dans le bon ordre.", { category: "school" }),
  createErVerbEntry("déduire", "Trouver une idée ou une réponse à partir des informations données.", { category: "school" }),
  createErVerbEntry("argumenter", "Défendre une idée avec des raisons et des exemples.", { category: "school" }),
  createErVerbEntry("rédiger", "Écrire une réponse construite et compréhensible.", { category: "school" }),
  createErVerbEntry("développer", "Donner plus de détails pour rendre une idée plus complète.", { category: "school" })
];

const MATH_SCIENCE_ENTRIES = [
  createEntry("équation", "Écriture mathématique qui relie deux expressions avec un signe égal.", { category: "science" }),
  createEntry("variable", "Symbole, souvent une lettre, qui représente une valeur pouvant changer.", { category: "science" }),
  createEntry("exposant", "Petit nombre ou symbole placé en haut qui indique une puissance.", { category: "science", variants: ["exposants"], autoPlural: false, variantStrategy: "custom" }),
  createEntry("fraction", "Écriture qui représente une part d’un tout avec un numérateur et un dénominateur.", { category: "science" }),
  createEntry("quotient", "Résultat d’une division.", { category: "science" }),
  createEntry("somme", "Résultat d’une addition.", { category: "science" }),
  createEntry("produit", "Résultat d’une multiplication.", { category: "science" }),
  createEntry("différence", "Résultat d’une soustraction ou écart entre deux valeurs.", { category: "science" }),
  createEntry("moyenne", "Valeur qui représente un ensemble en faisant un partage équilibré.", { category: "science" }),
  createEntry("graphique", "Représentation visuelle de données ou de relations.", { category: "science" }),
  createEntry("tableau", "Organisation d’informations en lignes et en colonnes.", { category: "science" }),
  createEntry("colonne", "Ensemble d’éléments placés verticalement dans un tableau.", { category: "science" }),
  createEntry("ligne", "Ensemble d’éléments placés horizontalement dans un tableau ou un texte.", { category: "science" }),
  createEntry("formule", "Écriture courte qui résume une relation mathématique ou scientifique.", { category: "science" }),
  createEntry("unité", "Référence choisie pour mesurer une grandeur.", { category: "science", variants: ["unités"], autoPlural: false, variantStrategy: "custom" }),
  createEntry("mesure", "Action de quantifier une grandeur, ou résultat obtenu.", { category: "science" }),
  createEntry("conversion", "Passage d’une unité, d’une écriture ou d’un format à un autre.", { category: "science" }),
  createEntry("schéma", "Dessin simplifié qui aide à comprendre une organisation ou un fonctionnement.", { category: "science" }),
  createEntry("légende", "Texte court qui explique les éléments d’un schéma, d’une image ou d’un graphique.", { category: "science" }),
  createEntry("vitesse", "Mesure de la distance parcourue pendant un certain temps.", { category: "science" }),
  createEntry("masse", "Quantité de matière contenue dans un objet ou un corps.", { category: "science" }),
  createEntry("volume", "Place occupée par un objet ou quantité d’espace qu’il remplit.", { category: "science" }),
  createEntry("température", "Mesure du niveau de chaud ou de froid.", { category: "science" }),
  createEntry("densité", "Rapport entre une masse et le volume correspondant.", { category: "science" }),
  createEntry("énergie", "Grandeur qui décrit la capacité d’un système à produire un effet ou un changement.", { category: "science" }),
  createEntry("puissance", "Quantité d’énergie utilisée ou transférée en un certain temps.", { category: "science" }),
  createEntry("courant", "Déplacement de charges électriques dans un circuit.", { category: "science" }),
  createEntry("tension", "Différence d’état électrique entre deux points d’un circuit.", { category: "science" }),
  createEntry("résistance", "Grandeur qui traduit l’opposition au passage du courant.", { category: "science" }),
  createEntry("pression", "Force exercée sur une surface donnée.", { category: "science" }),
  createEntry("force", "Action capable de mettre un objet en mouvement ou de le déformer.", { category: "science" }),
  createEntry("gravité", "Attraction exercée par un astre sur les corps.", { category: "science" }),
  createEntry("molécule", "Assemblage d’atomes liés entre eux.", { category: "science" }),
  createEntry("atome", "Très petite unité de matière qui constitue les corps.", { category: "science" }),
  createEntry("réaction", "Transformation chimique où des espèces deviennent d’autres espèces.", { category: "science" }),
  createEntry("concentration", "Quantité d’une substance présente dans un volume donné.", { category: "science" }),
  createEntry("solution", "Mélange homogène obtenu quand une substance est dissoute dans un liquide.", { category: "science" }),
  createEntry("soluté", "Substance dissoute dans un solvant.", { category: "science" }),
  createEntry("solvant", "Liquide qui dissout une autre substance.", { category: "science", variants: ["solvants"], autoPlural: false, variantStrategy: "custom" }),
  createEntry("acide", "Substance qui a certaines propriétés chimiques, notamment en solution aqueuse.", { category: "science" }),
  createEntry("base", "Substance capable de neutraliser un acide dans certaines réactions.", { category: "science" }),
  createEntry("cellule", "Plus petite unité vivante d’un organisme.", { category: "science" }),
  createEntry("organe", "Partie du corps ou d’un être vivant qui remplit une fonction précise.", { category: "science" }),
  createEntry("organisme", "Être vivant considéré comme un ensemble organisé.", { category: "science" }),
  createEntry("écosystème", "Ensemble formé par les êtres vivants et leur milieu.", { category: "science" }),
  createEntry("gène", "Information biologique portée par l’ADN et liée à certains caractères.", { category: "science" }),
  createEntry("chromosome", "Structure qui porte une partie de l’information génétique.", { category: "science" }),
  createEntry("expérience", "Essai organisé pour observer un phénomène ou tester une idée.", { category: "science" }),
  createEntry("respiration", "Ensemble des échanges qui permettent à un organisme d’utiliser l’oxygène.", { category: "science" }),
  createEntry("digestion", "Transformation des aliments pour que le corps puisse les utiliser.", { category: "science" }),
  createEntry("circulation", "Déplacement d’un fluide, d’un courant ou d’une information dans un système.", { category: "science" }),
  createEntry("protocole", "Suite d’étapes prévues pour réaliser une expérience ou une manipulation.", { category: "science" }),
  createEntry("mélange", "Association de plusieurs substances ou éléments.", { category: "science" }),
  createEntry("dilution", "Action de rendre une solution moins concentrée en ajoutant du solvant.", { category: "science" }),
  createEntry("dosage", "Méthode qui permet de déterminer une quantité ou une concentration.", { category: "science" }),
  createEntry("échantillon", "Petite quantité représentative d’un ensemble plus grand.", { category: "science" }),
  createEntry("combustion", "Réaction chimique qui libère de l’énergie, souvent sous forme de chaleur et de lumière.", { category: "science" }),
  createEntry("trajectoire", "Chemin suivi par un objet en mouvement.", { category: "science" }),
  createEntry("accélération", "Variation de la vitesse d’un objet au cours du temps.", { category: "science" }),
  createEntry("intensité", "Valeur qui exprime la force ou l’importance d’un phénomène, par exemple du courant électrique.", { category: "science" }),
  createEntry("abscisse", "Coordonnée horizontale d’un point dans un repère.", { category: "science" }),
  createEntry("ordonnée", "Coordonnée verticale d’un point dans un repère.", { category: "science" }),
  createEntry("repère", "Système de lignes ou d’axes qui permet de placer et lire des points.", { category: "science" }),
  createEntry("proportionnalité", "Relation entre deux grandeurs qui évoluent toujours dans le même rapport.", { category: "science" }),
  createEntry("fonction", "Relation qui associe une valeur de sortie à une valeur d’entrée.", { category: "science" }),
  createEntry("droite", "Ligne rectiligne qui peut représenter une relation ou un tracé géométrique.", { category: "science" }),
  createEntry("segment", "Partie d’une droite comprise entre deux points.", { category: "science" }),
  createEntry("triangle", "Figure géométrique formée de trois côtés.", { category: "science" }),
  createEntry("cercle", "Figure formée par tous les points à la même distance d’un centre.", { category: "science" }),
  createEntry("alpha", "Nom d’une lettre grecque souvent utilisée dans les formules.", { category: "science" }),
  createEntry("beta", "Nom d’une lettre grecque souvent utilisée dans les formules.", { category: "science" }),
  createEntry("gamma", "Nom d’une lettre grecque souvent utilisée dans les formules.", { category: "science" }),
  createEntry("delta", "Nom d’une lettre grecque souvent utilisée dans les formules.", { category: "science" }),
  createEntry("lambda", "Nom d’une lettre grecque souvent utilisée dans les formules.", { category: "science" }),
  createEntry("omega", "Nom d’une lettre grecque souvent utilisée dans les formules.", { category: "science" })
];

const ADMIN_ENTRIES = [
  createEntry("garantie", "Engagement qui précise une protection, un droit ou une prise en charge.", { category: "admin" }),
  createEntry("remboursement", "Somme rendue après une dépense prise en charge en tout ou en partie.", { category: "admin" }),
  createEntry("contrat", "Accord qui fixe des règles, des droits et des obligations.", { category: "admin" }),
  createEntry("option", "Choix possible parmi plusieurs solutions.", { category: "admin" }),
  createEntry("dossier", "Ensemble de documents réunis pour suivre une situation ou faire une demande.", { category: "admin" }),
  createEntry("attestation", "Document qui sert à prouver qu’un fait est exact.", { category: "admin" }),
  createEntry("justificatif", "Document fourni pour prouver une dépense, une situation ou un droit.", { category: "admin" }),
  createEntry("formulaire", "Document à remplir avec des informations précises.", { category: "admin" }),
  createEntry("demande", "Action de solliciter un droit, un service ou une réponse.", { category: "admin" }),
  createEntry("couverture", "Niveau de protection prévu par un contrat ou une assurance.", { category: "admin" }),
  createEntry("prise", "Action de recevoir, d’obtenir ou d’assumer quelque chose dans un cadre précis.", { category: "admin", autoPlural: false }),
  createEntry("échéance", "Date limite à respecter pour un paiement ou une démarche.", { category: "admin" }),
  createEntry("cotisation", "Somme versée régulièrement pour bénéficier d’une protection ou d’un service.", { category: "admin" }),
  createEntry("assuré", "Personne couverte par une assurance.", {
    category: "admin",
    variants: ["assurée", "assurés", "assurées"],
    autoPlural: false,
    variantStrategy: "custom"
  }),
  createEntry("bénéficiaire", "Personne qui profite d’un droit, d’une prestation ou d’un versement.", { category: "admin" }),
  createEntry("facture", "Document qui indique ce qui est dû pour un achat ou un service.", { category: "admin" }),
  createEntry("devis", "Estimation écrite d’un prix avant réalisation d’un service ou d’un achat.", { category: "admin" }),
  createEntry("ordonnance", "Document médical qui indique un traitement, un soin ou un examen.", { category: "admin" }),
  createEntry("mutuelle", "Organisme complémentaire qui aide à rembourser certaines dépenses de santé.", { category: "admin" }),
  createEntry("plafond", "Limite maximale prévue pour un remboursement ou une prise en charge.", { category: "admin" }),
  createEntry("franchise", "Part de la dépense qui reste à la charge de l’assuré.", { category: "admin" }),
  createEntry("droit", "Ce qu’une personne peut légalement obtenir ou faire.", { category: "admin" }),
  createEntry("bordereau", "Document récapitulatif qui accompagne ou résume des pièces.", { category: "admin" }),
  createEntry("pièce", "Document demandé dans un dossier administratif.", { category: "admin" }),
  createEntry("bénéfice", "Avantage ou gain obtenu dans un cadre donné.", { category: "admin" }),
  createEntry("adhérent", "Personne inscrite dans un organisme, une mutuelle ou une association.", {
    category: "admin",
    variants: ["adhérente", "adhérents", "adhérentes"],
    autoPlural: false,
    variantStrategy: "custom"
  }),
  createEntry("ayant", "Personne qui bénéficie d’un droit ou d’une couverture par l’intermédiaire d’une autre.", { category: "admin", autoPlural: false }),
  createEntry("prestation", "Service ou somme versée dans un cadre administratif, social ou de santé.", { category: "admin" }),
  createEntry("soin", "Acte médical ou paramédical réalisé pour la santé.", { category: "admin" }),
  createEntry("hospitalisation", "Séjour dans un établissement de santé pour recevoir des soins.", { category: "admin" }),
  createEntry("consultation", "Rencontre avec un professionnel de santé pour un avis ou un soin.", { category: "admin" }),
  createEntry("acte", "Intervention ou soin précis réalisé par un professionnel.", { category: "admin" }),
  createEntry("forfait", "Montant fixe prévu pour une prestation ou une prise en charge.", { category: "admin" }),
  createEntry("optique", "Tout ce qui concerne la vue, les lunettes ou les équipements pour voir.", { category: "admin" }),
  createEntry("dentaire", "Qui concerne les dents et les soins associés.", { category: "admin" }),
  createEntry("auditif", "Qui concerne l’audition ou les aides pour entendre.", {
    category: "admin",
    variants: ["auditive", "auditifs", "auditives"],
    autoPlural: false,
    variantStrategy: "custom"
  }),
  createEntry("équipement", "Matériel ou dispositif fourni pour répondre à un besoin précis.", { category: "admin" }),
  createEntry("télétransmission", "Envoi automatique d’informations entre organismes pour accélérer un remboursement.", { category: "admin" }),
  createEntry("décompte", "Document qui détaille les montants remboursés et ce qu’il reste à payer.", { category: "admin" }),
  createEntry("carence", "Période pendant laquelle un droit n’est pas encore ouvert.", { category: "admin" }),
  createEntry("affiliation", "Rattachement officiel à un organisme ou à un régime.", { category: "admin" }),
  createEntry("radiation", "Fin d’inscription ou de couverture dans un organisme.", { category: "admin" }),
  createEntry("invalidité", "Situation reconnue quand un état de santé limite fortement certaines capacités.", { category: "admin" }),
  createEntry("dépendance", "Besoin d’aide régulier pour accomplir les actes essentiels de la vie.", { category: "admin" }),
  createEntry("pharmacie", "Lieu ou domaine lié aux médicaments et à leur délivrance.", { category: "admin" }),
  createEntry("prothèse", "Dispositif destiné à remplacer ou soutenir une partie du corps.", { category: "admin" }),
  createEntry("orthodontie", "Soins destinés à corriger l’alignement des dents et des mâchoires.", { category: "admin" }),
  createEntry("orthophonie", "Soins liés au langage, à la parole, à la voix ou à la lecture.", { category: "admin" }),
  createEntry("kinésithérapie", "Soins fondés sur le mouvement et la rééducation du corps.", { category: "admin" }),
  createEntry("appareillage", "Ensemble des dispositifs fournis pour compenser ou aider une fonction du corps.", { category: "admin" }),
  createEntry("opticien", "Professionnel qui fournit lunettes et équipements de correction visuelle.", { category: "admin" }),
  createEntry("audioprothèse", "Appareil ou dispositif destiné à améliorer l’audition.", { category: "admin" }),
  createEntry("chirurgie", "Intervention médicale réalisée pour soigner ou corriger un problème de santé.", { category: "admin" }),
  createEntry("forclusion", "Perte d’un droit parce qu’un délai n’a pas été respecté.", { category: "admin" }),
  createEntry("résiliation", "Fin officielle d’un contrat ou d’une adhésion.", { category: "admin" }),
  createEntry("avenant", "Document qui modifie ou complète un contrat déjà existant.", { category: "admin" })
];

const LOCAL_DICTIONARY_SEEDS = [
  ...GENERAL_ENTRIES,
  ...LITERATURE_ENTRIES,
  ...SCHOOL_ENTRIES,
  ...MATH_SCIENCE_ENTRIES,
  ...ADMIN_ENTRIES
];

/**
 * Construit les variantes effectivement indexées pour une entrée.
 *
 * @param {ReturnType<typeof createEntry>} entry
 * @returns {string[]}
 */
function buildEntryVariants(entry) {
  if (entry.variantStrategy === "custom") {
    return [...new Set([entry.lemma, ...entry.variants])];
  }

  return [...new Set([
    ...buildNominalVariants(entry.lemma, entry),
    ...entry.variants
  ])];
}

/**
 * Construit l’index de consultation du dictionnaire local.
 *
 * @param {Array<ReturnType<typeof createEntry>>} entries
 * @returns {Map<string, { lemma: string, definition: string, category: string }>}
 */
function buildLocalDictionaryIndex(entries) {
  const index = new Map();

  for (const entry of entries) {
    const variants = buildEntryVariants(entry);

    for (const variant of variants) {
      const key = normalizeLocalDictionaryKey(variant);
      if (!key || index.has(key)) {
        continue;
      }

      index.set(key, {
        lemma: entry.lemma,
        definition: entry.definition,
        category: entry.category
      });
    }
  }

  return index;
}

const LOCAL_DICTIONARY_INDEX = buildLocalDictionaryIndex(LOCAL_DICTIONARY_SEEDS);

/**
 * Essaie quelques réductions prudentes pour retrouver un lemme courant.
 *
 * @param {string} word
 * @returns {string[]}
 */
function buildFallbackCandidates(word) {
  const normalized = normalizeLocalDictionaryKey(word);
  const candidates = new Set([normalized]);

  if (normalized.endsWith("s") && normalized.length >= 5) {
    candidates.add(normalized.slice(0, -1));
  }
  if (normalized.endsWith("es") && normalized.length >= 6) {
    candidates.add(normalized.slice(0, -2));
  }
  if (normalized.endsWith("x") && normalized.length >= 5) {
    candidates.add(`${normalized.slice(0, -1)}u`);
    candidates.add(normalized.slice(0, -1));
  }
  if (normalized.endsWith("ée") && normalized.length >= 5) {
    candidates.add(`${normalized.slice(0, -2)}er`);
  }
  if (normalized.endsWith("ées") && normalized.length >= 6) {
    candidates.add(`${normalized.slice(0, -3)}er`);
  }
  if (normalized.endsWith("és") && normalized.length >= 5) {
    candidates.add(`${normalized.slice(0, -2)}er`);
  }
  if (normalized.endsWith("é") && normalized.length >= 4) {
    candidates.add(`${normalized.slice(0, -1)}er`);
  }

  return [...candidates];
}

/**
 * Cherche une définition locale pour un mot.
 *
 * @param {string} word
 * @returns {{ lemma: string, definition: string, category: string, matchedKey: string } | null}
 */
export function lookupLocalDictionaryEntry(word) {
  const candidates = buildFallbackCandidates(word);
  for (const candidate of candidates) {
    const found = LOCAL_DICTIONARY_INDEX.get(candidate);
    if (found) {
      return {
        ...found,
        matchedKey: candidate
      };
    }
  }

  return null;
}

/**
 * Indique si un mot est couvert par le dictionnaire local.
 *
 * @param {string} word
 * @returns {boolean}
 */
export function hasLocalDictionaryEntry(word) {
  return Boolean(lookupLocalDictionaryEntry(word));
}

/**
 * Retourne le nombre d’entrées réellement indexées.
 *
 * @returns {number}
 */
export function getLocalDictionarySize() {
  return LOCAL_DICTIONARY_INDEX.size;
}

/**
 * Retourne un résumé simple des domaines couverts par le dictionnaire local.
 *
 * @returns {{ general: number, literature: number, school: number, science: number, admin: number }}
 */
export function getLocalDictionaryDomainStats() {
  return {
    general: GENERAL_ENTRIES.length,
    literature: LITERATURE_ENTRIES.length,
    school: SCHOOL_ENTRIES.length,
    science: MATH_SCIENCE_ENTRIES.length,
    admin: ADMIN_ENTRIES.length
  };
}
