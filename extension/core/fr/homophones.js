// Aria Plume — règles que Grammalecte laisse passer ou corrige mal : homophones (sa/ça, et/est,
// à/a, ces/ses/c'est/s'est, on/ont, quel/qu'elle, ni/n'y, prêt/près, vas-y), participe passé
// des verbes pronominaux, concordance après « si », « tout » devant un adjectif féminin.
//
// Règles volontairement prudentes : elles ne se déclenchent que quand le contexte ne
// laisse aucun doute, d'après la morphologie du dictionnaire de Grammalecte
// (:N nom, :A adjectif, :Q participe passé, :V verbe, :W adverbe, :M nom propre,
// :s/:p/:i singulier/pluriel/invariable, :f/:m/:e féminin/masculin/épicène).
// Mieux vaut rater une faute que souligner une phrase juste.
"use strict";

const Homophones = (() => {
    const TOKEN = /(?:jusqu|lorsqu|puisqu|quoiqu|qu|[cdjlmnst])['’](?=\p{L})|[\p{L}\p{N}]+(?:[-·][\p{L}\p{N}]+)*|\S/giu;
    const PUNCT = /^[^\p{L}\p{N}'’]$/u;

    const DET_SING = new Set(["le", "la", "l'", "un", "une", "ce", "cet", "cette", "mon", "ton", "son", "ma", "ta", "sa", "notre", "votre", "leur", "chaque"]);
    const DET_PLUR = new Set(["les", "des", "ces", "mes", "tes", "ses", "nos", "vos", "leurs", "plusieurs", "quelques", "certains", "certaines"]);
    const PREPOSITIONS = new Set(["à", "au", "aux", "de", "du", "d'", "dans", "avec", "pour", "par", "sur", "sous", "chez", "sans", "vers", "contre", "entre", "après", "avant", "pendant", "depuis", "selon", "malgré", "parmi", "envers", "derrière", "devant", "durant", "hors", "dès", "comme", "en"]);
    const CLAUSE_WORDS = new Set(["mais", "et", "donc", "car", "alors", "bon", "ouais", "oui", "non", "enfin", "sinon", "puis", "ben", "bah", "bref", "franchement", "honnêtement", "parce", "si", "quand"]);
    const SUBJECT_3S = new Set(["il", "elle", "on"]);

    // Ce qui suit « ça » et jamais le déterminant « sa ».
    const AFTER_CA = new Set(["on", "que", "qu'", "qui", "ne", "n'", "me", "m'", "te", "t'", "se", "s'", "lui", "leur", "y", "en", "a", "c'", "l'", "va", "fait"]);
    const NEGATION = new Set(["pas", "jamais", "rien"]);
    const SOFT_NEGATION = new Set(["plus", "bien", "mal"]);
    // « Sa plante encore ! » → Ça : un adverbe puis la fin de la phrase (« sa plante encore verte » reste).
    const CA_ADVERBS = new Set(["encore", "toujours", "souvent", "trop", "beaucoup", "vraiment", "grave", "complètement", "carrément", "aussi", "parfois"]);
    // Ce qui suit « c'est » et ne peut pas suivre le déterminant « ces » / « ses ».
    const AFTER_CEST = new Set(["moi", "toi", "lui", "eux", "ça", "cela", "le", "la", "l'", "un", "une", "mon", "ton", "son", "ma", "ta", "sa", "pour", "à", "au", "que", "qu'", "qui", "comme", "quand", "ici", "dommage", "ok", "pourquoi"]);
    // Participes rares qui sont d'abord autre chose (« lui » de luire, « été » la saison).
    const NOT_PARTICIPLE = new Set(["lui", "été", "nui", "plu", "su"]);
    const RELATIVE = new Set(["qui", "quoi", "lequel", "laquelle", "lesquels", "lesquelles", "celui", "celle", "ceux", "celles"]);
    // Ce qui suit « ont » après un groupe nominal pluriel.
    const AFTER_ONT = new Set(["raison", "tort", "faim", "soif", "peur", "froid", "chaud", "besoin", "envie", "été", "eu", "déjà", "jamais"]);

    const MESSAGES = {
        ca: "« sa » est un déterminant (sa voiture). Ici, il faut le pronom « ça » (= cela).",
        est: "« et » relie deux éléments. Ici, il faut le verbe être : « est ».",
        a: "« à » est une préposition. Ici, il faut le verbe avoir : « a ».",
        cest: "Ici, il faut « c'est » (= cela est), pas un déterminant.",
        sest: "Ici, il faut « s'est » : le verbe pronominal (il s'est trompé).",
        ont: "Avec un sujet pluriel, il faut le verbe avoir : « ont ».",
        quelle: "« quel » se place devant un nom (quel jour). Ici, il faut « qu'elle » (que + elle), sujet du verbe.",
        ny: "« ni » relie deux négations (ni l'un ni l'autre). Ici, il faut « n'y » (ne + y).",
        accord: "Verbe pronominal : le participe passé s'accorde avec le sujet quand le pronom est complément d'objet direct (elles se sont lavées).",
        invariable: "Avec ce verbe, le pronom est complément indirect (parler à quelqu'un) : le participe passé reste invariable (elles se sont parlé).",
        concordance: "Après « si » suivi de l'imparfait ou du plus-que-parfait, l'autre verbe se met au conditionnel, pas au futur (si j'avais su, je serais venu).",
        tout: "« tout » (= tout à fait) s'accorde devant un adjectif féminin qui commence par une consonne (elle est toute contente, elle est tout émue).",
        pres: "« prêt » = disposé à (prêt à partir). Pour la proximité, c'est « près de » (près de la gare).",
        vasy: "Impératif de « aller » devant « y » : on écrit « vas-y », avec un trait d'union.",
        quanta: "« Tant qu'à » + nom ou pronom est fautif : on écrit « quant à » (quant à moi).",
        quoique: "« quoique » = bien que. Pour « quelle que soit la chose que », c'est « quoi que » (quoi que tu fasses).",
        sinon: "Au sens de « autrement », on écrit « sinon » en un seul mot.",
        la: "Adverbe de lieu : « là », avec un accent (il est là). « la » est un article ou un pronom.",
        plusdun: "Après « plus d'un », le verbe se met au singulier (plus d'un technicien est venu).",
        en: "Avec le pronom « en » placé avant, le participe passé reste invariable (des pommes, j'en ai mangé).",
        combien: "Le complément « combien de… » est placé avant : le participe passé s'accorde avec lui (combien de pommes as-tu mangées ?).",
        senprendre: "« s'en prendre à » : le participe reste invariable (elle s'en est pris à moi).",
        imperatif: "À l'impératif, devant « en » ou « y », on ajoute un « s » aux verbes terminés par -e (manges-en, penses-y).",
        adjectif: "Employé comme adjectif (sans complément), le mot en -ant s'accorde avec le nom (des enfants obéissants).",
        rappeler: "En français soigné, on se rappelle quelque chose, sans « de » (je me rappelle cette journée) ; « se souvenir de » prend « de ».",
        pallier: "« pallier » se construit sans « à » : on pallie un problème (pallier ce problème).",
        chez: "On va « chez » quelqu'un (chez le coiffeur), et « à » un lieu (au salon de coiffure).",
        doubleneg: "« pas » fait double emploi avec « personne », « rien » ou « aucun » : je n'ai vu personne.",
        bonjour: "Pour saluer, « bonjour » reste au singulier (« des bonjours » seulement quand on en parle comme d'un nom).",
        nombre: "Il manque une espace entre le nombre et le mot",
        nombrePluriel: ", et le nom se met au pluriel à partir de 2",
        nombreSingulier: ", et le nom reste au singulier pour 0 ou 1",
        unite: "Il manque une espace (insécable de préférence) entre le nombre et l'unité",
        infinitif: "Après « aller », « pouvoir », « devoir » ou « vouloir », le verbe qui suit se met à l'infinitif (tu vas l'adorer).".replace(/« /g, "« ").replace(/ »/g, " »"),
        personne: "« personne ne… » (aucune personne) reste au singulier.".replace(/« /g, "« ").replace(/ »/g, " »"),
        personneVerbe: "Le verbe s'accorde avec le sujet",
        sont: "« son » est un déterminant (son livre). Avec un sujet pluriel, il faut le verbe être : « sont ».",
        se: "« ce » est un déterminant ou un pronom démonstratif. Devant un verbe pronominal, c'est « se » (il se lève).",
        ou: "« ou » marque un choix (ceci ou cela). Pour le lieu ou le moment, c'est « où » avec un accent (là où, d'où, où est…).",
        attribut: "L'adjectif ou le participe placé après « être » s'accorde avec le sujet",
        relative: "Avec « avoir », le participe passé s'accorde avec le complément d'objet direct placé avant (ici « que », mis pour",
        verbe: "Le verbe s'accorde avec son sujet",
        pluriel: "Après un déterminant pluriel, le nom se met au pluriel",
        prie: "Formule de politesse : « je vous prie », du verbe prier.",
        estceque: "« est-ce que » s'écrit avec un seul trait d'union : est-ce que.",
        toutafait: "« tout à fait » est une locution invariable.",
        coordonnees: "Les informations pour joindre quelqu'un sont ses « coordonnées » (nom féminin pluriel).",
        si: "« ci » s'emploie avec un trait d'union (ci-joint, celui-ci). Pour la condition, c'est « si ».",
        infinitifA: "Après « penser à », « commencer à », « réussir à »…, le verbe se met à l'infinitif (pensez à vérifier).",
        coordonne: "Ce verbe complète le même auxiliaire que le participe d'avant (j'ai mis à jour… et redémarré) : c'est un participe passé.",
        codApres: "Le complément d'objet direct est placé après le participe (elle s'est coupé les cheveux) : pas d'accord.",
        sujetLoin: "Le verbe s'accorde avec le sujet, même s'il est séparé du verbe",
        sujetInverse: "Le sujet est placé après le verbe : le verbe s'accorde avec lui",
        cestQui: "Après « c'est … qui », le verbe s'accorde avec le pronom",
        sen: "« s'en » = se + en (il s'en va, il s'en souvient). « sans » est une préposition (sans rien dire).",
        sans: "« sans » (préposition) devant un infinitif : partir sans prévenir. « s'en » va avec un verbe pronominal (s'en aller).",
        voirInf: "« voire » signifie « et même ». Pour le verbe, c'est l'infinitif « voir ».",
        toutVoyelle: "« tout » (= tout à fait) reste invariable devant un adjectif féminin qui commence par une voyelle (elle est tout étonnée).",
        plutot: "« plutôt » = assez, de préférence (plutôt bien). « plus tôt » = de meilleure heure.",
        plusTot: "« plus tôt » = de meilleure heure (partir plus tôt). « plutôt » = assez, de préférence.",
        quelQue: "« quel que » s'écrit en deux mots et s'accorde avec le sujet de « être » (quelle que soit ta décision).",
        ma: "Ici, « m'a » (me + a, du verbe avoir), pas le déterminant « ma ».",
        ta: "Ici, « t'a » (te + a, du verbe avoir), pas le déterminant « ta ».",
        lai: "« l'ai » = le/la + ai (je l'ai vu). « lai » est un poème du Moyen Âge.",
        mes: "« mes » est un déterminant (mes amis). Pour l'opposition, c'est « mais ».",
        mesDet: "Devant un nom, c'est le déterminant « mes » (mes amis). « mais » marque l'opposition.",
        ses: "Devant un nom, c'est le déterminant « ses » (ses clés), pas « c'est ».",
        sy: "« s'y » = se + y (il s'y attendait). « si » est une conjonction ou un adverbe.",
        imparfait: "Action habituelle dans le passé : imparfait (je jouais souvent), pas passé simple.",
        futur: "Un repère dans l'avenir (demain…) : futur, « -rai » sans s (je viendrai).",
        conditionnel: "Souhait poli : conditionnel, « -rais » avec un s (j'aimerais bien).",
        adjectifAdverbe: "L'adjectif s'accorde avec le nom, même avec un adverbe entre eux",
        memes: "« -mêmes » s'accorde avec le pronom pluriel (nous-mêmes, eux-mêmes).",
        aucun: "« aucun » ne se met au pluriel que devant un nom toujours pluriel (aucuns frais) : aucune raison.",
        langue: "Les noms de langues s'écrivent avec une minuscule (il parle anglais) ; la majuscule est pour les habitants (les Anglais).",
        quelExclamatif: "Le complément « quel… » est placé avant : le participe s'accorde avec lui (quelle chance nous avons eue).",
        lAvant: "Le pronom « l' » mis pour",
        quelleSubj: "Devant un verbe au subjonctif, c'est « qu'elle » (que + elle) : qu'elle vienne ou non.",
        promis: "« se promettre de », « se permettre de » : le pronom est complément indirect, le participe reste invariable (elle s'est promis de revenir).",
    };
    // « 21an » → 21 ans : nombre collé à un nom de durée, de mesure ou de quantité courant.
    const GLUED_NUMBER = /^(\d+)(ans?|jours?|mois|semaines?|heures?|minutes?|secondes?|euros?|fois|kilos?|mètres?|kilomètres?|personnes?|pages?|lignes?|fichiers?|serveurs?|enfants?|places?)$/iu;
    const INVARIABLE_PLURAL = /[sx]$/;
    // « 12Go », « 20min » → 12 Go, 20 min : nombre collé à une unité (qui ne prend pas de s).
    const GLUED_UNIT = /^(\d+)(Ko|Mo|Go|To|ko|mo|go|to|min|km|kg|cm|mm|ms|Mbps|Gbps)$/u;
    // « le 12novembre » → 12 novembre.
    const GLUED_MONTH = /^(\d{1,2}|1er)(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)$/iu;
    // Verbes qui se construisent avec un infinitif : « tu vas l'adorer », « je peux le changer ».
    const INFINITIVE_VERBS = new Set(["aller", "pouvoir", "devoir", "vouloir"]);
    const PRONOUNS_BEFORE_VERB = new Set(["le", "la", "les", "l'", "me", "m'", "te", "t'", "se", "s'", "lui", "leur", "y", "en", "nous", "vous"]);
    const VOWEL_START = /^[aeiouyhàâäéèêëîïôöùûüœæ]/;
    const BE_FORMS = new Set(["suis", "es", "est", "sommes", "êtes", "sont", "étais", "était", "étions", "étiez", "étaient", "serai", "seras", "sera", "serons", "serez", "seront", "serais", "serait", "serions", "seriez", "seraient", "sois", "soit", "soyons", "soyez", "soient", "fus", "fut", "fûmes", "fûtes", "furent", "fût"]);
    const REFLEXIVES = new Set(["se", "s'", "me", "m'", "te", "t'", "nous", "vous"]);
    const NEGATIONS = new Set(["pas", "jamais", "plus", "point", "guère"]);
    // Verbes dont le pronom est complément indirect (se parler = parler à soi / l'un à l'autre) :
    // le participe reste invariable (« elles se sont parlé », « ils se sont succédé »).
    const INDIRECT_PRONOMINAL = new Set(["parler", "téléphoner", "écrire", "succéder", "plaire", "déplaire", "complaire", "rire", "sourire", "nuire", "mentir", "ressembler", "suffire", "convenir", "survivre", "demander", "répondre"]);
    // « nous » et « vous » sont laissés de côté : ils peuvent désigner une seule personne
    // (vous de politesse : « vous vous êtes retourné »).
    const SUBJECT_AGREEMENT = { il: "m:s", elle: "f:s", ils: "m:p", elles: "f:p", nous: "?:p" };
    // Verbes souvent suivis d'un complément direct qui n'est pas le pronom (« se sont dit : … »,
    // « s'est fait mal », « se sont rendu compte ») : on ne propose pas d'accord.
    const OFTEN_INDIRECT = new Set(["dire", "donner", "faire", "laisser", "rendre", "permettre", "promettre", "offrir", "accorder", "envoyer", "acheter", "procurer", "poser", "fixer", "imposer", "partager", "échanger", "jurer", "rappeler", "imaginer", "figurer", "attribuer", "réserver", "souhaiter"]);
    const SI_WORDS = new Set(["si", "s'"]);
    const QUEL = new Set(["quel", "quelle", "quels", "quelles"]);
    const OBJECT_PRONOUNS = new Set(["me", "m'", "te", "t'", "se", "s'", "le", "la", "les", "l'", "lui", "leur", "y", "en", "ne", "n'", "nous", "vous"]);
    const ETRE = new Set(["est", "était", "sera", "serait", "soit", "fut", "sont", "étaient", "seront", "seraient", "soient"]);
    const SUBJECTS = new Set(["je", "j'", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles", "ça", "cela"]);
    // Noms collectifs ou de quantité : l'accord peut se faire avec le complément (« la plupart sont
    // partis ») ; noms de temps qui ouvrent une phrase sans en être le sujet (« ce soir, venez »).
    const COLLECTIVE = new Set(["plupart", "majorité", "minorité", "moitié", "totalité", "reste", "nombre", "foule", "tas", "multitude", "ensemble", "dizaine", "douzaine", "vingtaine", "trentaine", "centaine", "millier", "quantité", "partie", "poignée", "infinité", "masse", "série", "groupe", "équipe", "peu", "personnel", "famille", "couple"]);
    const TIME_NOUNS = new Set(["matin", "soir", "midi", "minuit", "jour", "journée", "nuit", "soirée", "matinée", "semaine", "mois", "an", "année", "fois", "week-end", "weekend", "après-midi", "veille", "lendemain", "été", "hiver", "printemps", "automne", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche", "heure", "moment", "instant", "siècle", "trimestre"]);
    const TIME_WORDS = new Set(["hier", "aujourd'hui", "demain", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche", "tôt", "tard", "récemment", "longtemps", "ensemble", "plus", "maintenant", "ici", "là", "partout"]);
    const ETRE_FINITE = new Set(["suis", "es", "est", "sommes", "êtes", "sont", "étais", "était", "étions", "étiez", "étaient", "serai", "seras", "sera", "serons", "serez", "seront", "serais", "serait", "serions", "seriez", "seraient", "sois", "soit", "soyons", "soyez", "soient", "fut", "furent", "fût"]);
    const BODY_PARTS = new Set(["cheveux", "mains", "main", "dents", "pieds", "pied", "bras", "jambe", "jambes", "yeux", "visage", "doigt", "doigts", "genou", "genoux", "cou", "tête", "nez", "oreilles", "ongles", "lèvres", "dos", "figure", "barbe", "cheville", "poignet", "épaule"]);
    const S_EN_VERBS = new Set(["aller", "occuper", "souvenir", "servir", "sortir", "charger", "moquer", "plaindre", "douter", "apercevoir", "inquiéter", "méfier", "passer", "tenir", "prendre", "vouloir", "remettre", "débarrasser", "féliciter", "rendre", "faire", "aller", "tirer", "contenter", "approcher", "éloigner", "retourner", "réjouir", "excuser", "foutre", "ficher", "remettre", "mêler", "emparer", "envoler", "enfuir"]);
    const EARLY_VERBS = new Set(["partir", "arriver", "venir", "rentrer", "commencer", "finir", "lever", "coucher", "revenir", "appeler", "prévenir", "terminer", "dire", "savoir", "réveiller", "sortir", "quitter"]);
    const HABIT_WORDS = new Set(["souvent", "toujours", "autrefois", "d'habitude", "habituellement", "parfois", "régulièrement", "fréquemment"]);
    const FUTURE_WORDS = new Set(["demain", "bientôt", "prochain", "prochaine", "prochains", "prochaines", "tard"]);
    const WISH_LEMMAS = new Set(["aimer", "vouloir", "souhaiter", "préférer", "désirer", "adorer"]);
    const LANGUAGES = new Set(["anglais", "français", "japonais", "espagnol", "allemand", "italien", "chinois", "coréen", "russe", "arabe", "portugais", "néerlandais", "suédois", "polonais", "grec", "turc", "hindi", "vietnamien", "thaï", "breton", "basque", "corse", "catalan", "latin", "hébreu"]);
    const LANGUAGE_VERBS = new Set(["parler", "apprendre", "étudier", "enseigner", "comprendre", "lire", "écrire", "traduire", "maîtriser", "pratiquer", "baragouiner"]);
    const COLORS = new Set(["noir", "blanc", "bleu", "rouge", "vert", "jaune", "gris", "brun", "rose", "violet", "orange", "marron", "beige", "doré", "argenté"]);
    // Noms suivis d'une complétive (« l'impression que tu as compris ») : « que » n'y est pas un relatif.
    const COMPLETIVE_NOUNS = new Set(["impression", "idée", "sentiment", "fait", "preuve", "espoir", "certitude", "peur", "crainte", "conviction", "nouvelle", "information", "hypothèse", "assurance", "garantie", "illusion", "intuition", "soupçon", "doute", "chance", "possibilité", "probabilité", "risque", "condition", "envie", "honte", "avis", "opinion", "signe", "rumeur", "promesse", "annonce", "confirmation", "constat", "affirmation", "raison", "manière", "façon"]);
    const ATTRIBUTE_ADVERBS = new Set(["très", "trop", "assez", "vraiment", "souvent", "toujours", "si", "plus", "moins", "bien", "déjà", "encore", "pas", "jamais", "plutôt", "parfois", "aussi", "particulièrement", "complètement", "totalement", "presque", "peu", "un", "tellement", "enfin", "désormais", "maintenant", "ensuite", "point", "guère", "fort", "tous", "toutes"]);
    const A_INFINITIVE_VERBS = new Set(["penser", "commencer", "continuer", "arriver", "aider", "apprendre", "réussir", "chercher", "servir", "tenir", "hésiter", "parvenir", "renoncer", "inviter", "encourager", "obliger", "autoriser", "consister", "viser", "tendre", "habituer", "préparer", "décider", "songer", "s'amuser", "amuser", "passer", "rester", "avoir"]);
    const TAKES_INFINITIVE = new Set(["vouloir", "pouvoir", "devoir", "savoir", "aimer", "préférer", "oser", "décider", "essayer", "commencer", "finir", "oublier", "apprendre", "penser", "croire", "espérer", "souhaiter", "faillir", "laisser", "faire", "entendre", "voir", "regarder", "sentir", "envoyer", "emmener", "aller", "venir", "devoir", "réussir", "chercher", "accepter", "refuser", "promettre", "demander", "permettre", "proposer", "continuer", "arrêter", "cesser", "tenter", "prévoir", "choisir"]);
    const NO_QUE_AGREEMENT = new Set(["coûter", "valoir", "peser", "mesurer", "durer", "vivre", "courir", "régner", "dormir", "marcher", "falloir", "pouvoir", "devoir", "vouloir", "savoir", "être", "faire", "laisser", "croire", "penser", "dire", "permettre", "promettre"]);

    function tokenize(line) {
        const tokens = [];
        for (const match of line.matchAll(TOKEN)) {
            const text = match[0];
            tokens.push({
                text,
                lower: text.toLowerCase().replace("’", "'"),
                start: match.index,
                end: match.index + text.length,
                punct: PUNCT.test(text),
            });
        }
        return tokens;
    }

    function create(getMorph) {
        const cache = new Map();
        function morph(token) {
            if (!token || token.punct) {
                return [];
            }
            const word = token.text.replace("’", "'");
            if (!cache.has(word)) {
                let result = getMorph(word) ?? [];
                if (result.length === 0 && word !== word.toLowerCase()) {
                    result = getMorph(word.toLowerCase()) ?? [];
                }
                if (cache.size > 5000) {
                    cache.clear();
                }
                cache.set(word, result);
            }
            return cache.get(word);
        }
        const has = (token, re) => morph(token).some((m) => re.test(m));
        const isParticiple = (token) => !!token && !NOT_PARTICIPLE.has(token.lower) && has(token, /:Q/);
        const isFiniteVerb = (token) => has(token, /:V[^/]*:(Ip|Iq|Is|If|K)[^/]*:3s/);
        const isAdverb = (token) => has(token, /:W/);
        const isPureAdjective = (token) => has(token, /:A/) && !has(token, /:N/);
        const hasFemSingNounOrAdj = (token) => morph(token).some((m) => /:[NA]/.test(m) && /:[fe]/.test(m) && /:[si]/.test(m));
        const hasPlural = (token) => morph(token).some((m) => /:[NAQ]/.test(m) && /:p/.test(m));
        const singularAdjectiveOnly = (token) => {
            const forms = morph(token).filter((m) => /:[AQ]/.test(m));
            return forms.length > 0 && forms.every((m) => /:s/.test(m)) && !hasPlural(token);
        };
        const isAcronym = (token) => token && !token.punct && token.text.length >= 2 && token.text === token.text.toUpperCase() && /\p{Lu}/u.test(token.text);

        // Nom du nombre demandé ("s", "p", ou null pour indifférent), qui n'est pas aussi un participe
        // (« un document imprimé et signé »). Un sigle (VLAN, DNS) compte comme un nom.
        function noun(token, number) {
            if (isAcronym(token)) {
                return true;
            }
            const numberRe = number === "s" ? /:[si]/ : number === "p" ? /:[pi]/ : /./;
            return morph(token).some((m) => /:N/.test(m) && numberRe.test(m)) && !morph(token).some((m) => /:Q/.test(m) && !/:N/.test(m));
        }

        // Le mot avant un groupe nominal n'est pas une préposition (« Après les cours on… »).
        const notAfterPreposition = (tokens, j) => j < 0 || tokens[j].punct || !PREPOSITIONS.has(tokens[j].lower);

        const ALL_DETS = new Set([...DET_SING, ...DET_PLUR, "du"]);

        // Groupe « dét (adj) nom (SIGLE) » qui se termine en i - 1, du nombre demandé
        // ("s", "p" ou null pour indifférent). Renvoie l'indice de son premier mot, ou -1.
        function simpleNounPhrase(tokens, i, number, needDeterminer = true) {
            let j = i - 1;
            if (isAcronym(tokens[j]) && j > 0 && noun(tokens[j - 1], number)) {
                j--;
            }
            const head = tokens[j];
            const dets = number === "s" ? DET_SING : number === "p" ? DET_PLUR : ALL_DETS;
            // Juste après un déterminant, un mot qui peut être un nom en est un (« le bus », même si
            // « bus » est aussi un participe de boire).
            const numberRe = number === "s" ? /:[si]/ : number === "p" ? /:[pi]/ : /./;
            // Un mot inconnu du dictionnaire juste après un déterminant est un nom (« les switchs »).
            const unknownNoun = head && !head.punct && /^\p{Ll}[\p{L}-]{2,}$/u.test(head.text) && morph(head).length === 0;
            const nounAfterDet = head && !head.punct && (dets.has(tokens[j - 1]?.lower) && (morph(head).some((m) => /:N/.test(m) && numberRe.test(m)) || unknownNoun)
                || (unknownNoun && tokens[j - 1] && has(tokens[j - 1], /:A/) && dets.has(tokens[j - 2]?.lower)));
            if (!head || head.punct || !(noun(head, number) || nounAfterDet)) {
                return -1;
            }
            let k = j - 1;
            if (tokens[k] && !tokens[k].punct && (isPureAdjective(tokens[k]) || (unknownNoun && has(tokens[k], /:A/))) && dets.has(tokens[k - 1]?.lower)) {
                k--;
            }
            if (tokens[k] && dets.has(tokens[k].lower)) {
                return k;
            }
            return needDeterminer ? -1 : j;
        }

        // Groupe nominal sujet qui se termine en i - 1 : « le serveur », « le vieux serveur DNS »,
        // « les serveurs de production », « Marc ». Jamais après une préposition (« Après les cours on… »).
        function nounPhraseBefore(tokens, i, number, allowAdjective = true) {
            const head = tokens[i - 1];
            // « le technicien surpris », « les serveurs neufs » : un adjectif après le nom.
            if (allowAdjective && head && !head.punct && has(head, /:[AQ]/) && (!noun(head, null) || noun(tokens[i - 2], null)) && i >= 3) {
                const numberRe = number === "s" ? /:[AQ][^/]*:[si]/ : number === "p" ? /:[AQ][^/]*:[pi]/ : /:[AQ]/;
                const inner = simpleNounPhrase(tokens, i - 1, number);
                if (has(head, numberRe) && inner >= 0 && clauseStart(tokens, inner) && !coordinated(tokens, inner)) {
                    return true;
                }
            }
            if (number === "s" && head && !head.punct && /^\p{Lu}/u.test(head.text) && has(head, /:M/) && clauseStart(tokens, i - 1)) {
                return true;
            }
            let start = simpleNounPhrase(tokens, i, number);
            if (start < 0) {
                // Complément du nom : « [les serveurs] de production », « [la sauvegarde] de la base ».
                const complement = simpleNounPhrase(tokens, i, null, false);
                let de = -1;
                if (complement > 0 && ["du", "des"].includes(tokens[complement].lower)) {
                    de = complement;
                } else if (complement > 0 && ["de", "d'"].includes(tokens[complement - 1].lower)) {
                    de = complement - 1;
                }
                start = de > 0 ? simpleNounPhrase(tokens, de, number) : -1;
            }
            return start >= 0 && notAfterPreposition(tokens, start - 1);
        }

        const clauseStart = (tokens, i) => i === 0 || tokens[i - 1].punct || CLAUSE_WORDS.has(tokens[i - 1].lower);
        // Groupe coordonné (« le chat et le chien », « son courage, son ardeur ») : l'accord se fait
        // avec l'ensemble, pas avec le dernier groupe.
        const coordinated = (tokens, start) => start > 0 && (["et", "ou", "ni", "comme", ",", "&"].includes(tokens[start - 1].lower) || tokens[start - 1].text === ",");
        const endOrPunct = (token) => !token || token.punct;

        function ruleSa(tokens, i) {
            const next = tokens[i + 1];
            if (i > 0 && (DET_SING.has(tokens[i - 1].lower) || DET_PLUR.has(tokens[i - 1].lower))) {
                return false;  // « la SA »
            }
            if (endOrPunct(next)) {
                return i > 0 && !tokens[i - 1].punct;  // « Tu as vu sa ? »
            }
            if (AFTER_CA.has(next.lower)) {
                return true;
            }
            if (morph(next).length === 0) {
                return false;
            }
            if (isFiniteVerb(next) && !hasFemSingNounOrAdj(next)) {
                return true;
            }
            // « Sa marche pas » (verbe) / « Sa marche quotidienne » (nom).
            if (isFiniteVerb(next)) {
                const after = tokens[i + 2];
                if (after && NEGATION.has(after.lower)) {
                    return true;
                }
                if (after && (SOFT_NEGATION.has(after.lower) || CA_ADVERBS.has(after.lower))) {
                    const third = tokens[i + 3];
                    return endOrPunct(third) || !has(third, /:A/);
                }
            }
            return false;
        }

        function subject3s(tokens, i) {
            const prev = tokens[i - 1];
            return prev && (SUBJECT_3S.has(prev.lower) || ["ça", "cela"].includes(prev.lower));
        }

        function ruleEt(tokens, i) {
            const prev = tokens[i - 1];
            const next = tokens[i + 1];
            if (!prev || endOrPunct(next)) {
                return false;
            }
            const pronoun = subject3s(tokens, i) && clauseStart(tokens, i - 1);
            // Sans l'extension « nom + adjectif » : « un document imprimé et signé » coordonne deux participes.
            if (!pronoun && !nounPhraseBefore(tokens, i, "s", false)) {
                return false;
            }
            if (isParticiple(next)) {
                return true;
            }
            if (isAdverb(next) && next.lower !== "pas" && tokens[i + 2] && (isParticiple(tokens[i + 2]) || has(tokens[i + 2], /:A/))) {
                return true;
            }
            // « Elle et contente » ; mais « Elle et maman », « elle et moi » restent justes.
            return pronoun && has(next, /:A/) && !has(next, /:G/);
        }

        function ruleA(tokens, i) {
            const prev = tokens[i - 1];
            const next = tokens[i + 1];
            if (!prev || endOrPunct(next) || RELATIVE.has(next.lower)) {
                return false;  // « elle à qui nous avons… »
            }
            if (SUBJECT_3S.has(prev.lower) && clauseStart(tokens, i - 1)) {
                return true;
            }
            if (prev.lower === "y" && SUBJECT_3S.has(tokens[i - 2]?.lower)) {
                return true;  // « il y à »
            }
            if (prev.lower === "qui" && isParticiple(next)) {
                return true;
            }
            if (!nounPhraseBefore(tokens, i, "s")) {
                return false;
            }
            // « la résine à enfin bien durci » : des adverbes peuvent séparer « a » du participe.
            let k = i + 1;
            while (k < i + 4 && tokens[k] && isAdverb(tokens[k]) && !has(tokens[k], /:Q/) && !["pas", "plus", "point"].includes(tokens[k].lower)) {
                k++;
            }
            if (tokens[k]?.lower === "été") {
                return true;  // « la base à été migrée », « la sortie à encore été repoussée »
            }
            if (!isParticiple(tokens[k]) || ["de", "d'"].includes(tokens[k + 1]?.lower)) {
                return false;
            }
            // Participe qui est aussi un nom (« rendu », « fait », « perdu ») : seulement suivi d'un
            // déterminant, d'un pronom, d'un adverbe ou de la fin (« le cousin à perdu la maison »).
            const after = tokens[k + 1];
            return !has(tokens[k], /:N/) || (after?.punct && /^[,;:)]$/.test(after.text)) || (!endOrPunct(after) && (ALL_DETS.has(after.lower) || OBJECT_PRONOUNS.has(after.lower) || isAdverb(after) || TIME_WORDS.has(after.lower)));
        }

        // Après « a » (avoir) sans complément placé avant, le participe reste au masculin singulier :
        // « la résine à durcie » → a durci. Renvoie [indice du participe, forme juste] ou null.
        function participleAfterAvoir(tokens, i) {
            let k = i + 1;
            while (tokens[k] && isAdverb(tokens[k]) && !has(tokens[k], /:Q/) && k < i + 4) {
                k++;
            }
            const entry = tokens[k] && participleEntry(tokens[k]);
            if (!entry || !hasConj || tokens.slice(0, i).some((t) => ["que", "qu'", "l'", "la", "les", "le"].includes(t.lower) && !DET_SING.has(t.lower) && !DET_PLUR.has(t.lower))) {
                return null;
            }
            const invariable = conj.getConj(lemmaOf(entry), ":Q", ":m:s");
            return invariable && invariable !== tokens[k].lower ? [k, invariable] : null;
        }

        function ruleCest(tokens, i) {
            if (!clauseStart(tokens, i)) {
                return false;
            }
            const next = tokens[i + 1];
            if (endOrPunct(next)) {
                return false;
            }
            if (AFTER_CEST.has(next.lower)) {
                return true;
            }
            const after = tokens[i + 2];
            if (next.lower === "pas" || (isAdverb(next) && !has(next, /:[NA][^/]*:[pi]/))) {
                // « Ces pas grave » oui ; « Ses pas résonnaient », « ces pas lourds », « ces très beaux » non.
                return !!after && !after.punct && !hasPlural(after) && (AFTER_CEST.has(after.lower) || has(after, /:[AQW]/));
            }
            // « Ces génial », « Ces fini » ; un mot qui peut être un nom (« ces étudiant sont… ») seulement en fin de phrase.
            return singularAdjectiveOnly(next) && (!has(next, /:N/) || endOrPunct(tokens[i + 2]));
        }

        // Adverbes qui peuvent séparer « s'est » du participe : « c'est bien passé » → s'est bien passé.
        const SEST_ADVERBS = new Set(["bien", "mal", "déjà", "vite", "encore", "toujours", "finalement", "enfin", "aussi", "très"]);
        const pronominalVerb = (token) => {
            const entry = participleEntry(token);
            return !!entry && hasConj && /^.{5}[pqr]/.test(conj.getVtyp(lemmaOf(entry)) || "");
        };

        function ruleSest(tokens, i) {
            let next = tokens[i + 1];
            if (next && SEST_ADVERBS.has(next.lower) && isParticiple(tokens[i + 2]) && pronominalVerb(tokens[i + 2])) {
                next = tokens[i + 2];
            }
            if (endOrPunct(next) || !isParticiple(next)) {
                return false;
            }
            // « … c'est bien passée » : après « c'est », un adjectif serait au masculin singulier ;
            // un participe accordé au féminin ou au pluriel d'un verbe pronominal appelle « s'est ».
            if (tokens[i].lower === "c'" && pronominalVerb(next) && morph(next).some((m) => /:Q/.test(m) && /:(f|p)/.test(m)) && !morph(next).some((m) => /:Q/.test(m) && /:m:s/.test(m))) {
                return true;
            }
            const prev = tokens[i - 1];
            if (prev && (subject3s(tokens, i) || prev.lower === "qui")) {
                return true;
            }
            return nounPhraseBefore(tokens, i, "s");
        }

        function ruleOnt(tokens, i) {
            const prev = tokens[i - 1];
            const next = tokens[i + 1];
            if (!prev || endOrPunct(next)) {
                return false;
            }
            if (["ils", "elles"].includes(prev.lower)) {
                return true;
            }
            if (!nounPhraseBefore(tokens, i, "p")) {
                return false;
            }
            return AFTER_ONT.has(next.lower) || (isParticiple(next) && !has(next, /:V[^/]*:(Ip|Iq|Is|If|K)/));
        }

        // « Je pense quel viendra » → qu'elle ; « Je sais quel temps il fait » reste juste.
        function ruleQuel(tokens, i) {
            const prev = tokens[i - 1];
            const next = tokens[i + 1];
            if (!prev || prev.punct || endOrPunct(next) || clauseStart(tokens, i)) {
                return false;
            }
            if (!has(prev, /:V[^/]*:(Ip|Iq|If|K)/) && prev.lower !== "parce") {
                return false;
            }
            if (OBJECT_PRONOUNS.has(next.lower)) {
                return true;
            }
            if (ETRE.has(next.lower)) {
                const after = tokens[i + 2];
                return !!after && !after.punct && (isParticiple(after) || has(after, /:A/)) && !has(after, /:D/);
            }
            return has(next, /:V[^/]*:(Ip|Iq|If|K|Sp)/) && !has(next, /:[NA]/);
        }

        // « Il ni a plus rien » → n'y ; « ni lui ni elle » reste juste.
        function ruleNi(tokens, i) {
            const prev = tokens[i - 1];
            const next = tokens[i + 1];
            if (endOrPunct(next)) {
                return false;
            }
            // « Ni pense plus » → N'y : en tête de phrase, devant un verbe, sans autre « ni ».
            if (clauseStart(tokens, i) && (!prev || prev.punct)) {
                let end = i + 1;
                while (end < tokens.length && !/[.!?;]/.test(tokens[end].text)) {
                    end++;
                }
                return has(next, /:V[^/]*:(Ip|Iq|If|K|Sp|E)/) && !has(next, /:[NAD]/) && !tokens.slice(i + 1, end).some((t) => t.lower === "ni");
            }
            if (!prev || !SUBJECTS.has(prev.lower)) {
                return false;
            }
            for (let k = i - 1; k >= 0 && !tokens[k].punct; k--) {
                if (tokens[k].lower === "ni") {
                    return false;  // énumération « ni il ni… »
                }
            }
            // Après un pronom sujet, un mot qui peut être un verbe conjugué en est un (« a », « pense »).
            return has(next, /:V[^/]*:(Ip|Iq|If|K|Sp)/);
        }

        // « Mes parents son arrivés », « Les supports son trop fins » → sont ; « Ce son les… » → Ce sont.
        function ruleSon(tokens, i) {
            const prev = tokens[i - 1];
            const next = tokens[i + 1];
            if (!prev || endOrPunct(next)) {
                return false;
            }
            if (prev.lower === "ce" && clauseStart(tokens, i - 1)) {
                return DET_PLUR.has(next.lower) || ["eux", "elles"].includes(next.lower);
            }
            if (["ils", "elles"].includes(prev.lower) && clauseStart(tokens, i - 1)) {
                return true;  // « ils son… » : jamais le déterminant
            }
            if (!nounPhraseBefore(tokens, i, "p")) {
                return false;
            }
            let k = i + 1;
            while (k < i + 3 && tokens[k] && isAdverb(tokens[k]) && !has(tokens[k], /:[NAQ]/)) {
                k++;
            }
            const word = tokens[k];
            if (endOrPunct(word)) {
                return false;
            }
            // Après un adverbe, un adjectif (« son trop fins ») ; sinon un adjectif ou participe au
            // pluriel, que le déterminant « son » ne peut pas précéder (« son arrivés »).
            if (k > i + 1) {
                return has(word, /:[AQ]/) && endOrPunct(tokens[k + 1]);
            }
            return hasPlural(word) && has(word, /:[AQ]/) && !morph(word).some((m) => /:N/.test(m) && /:[si]/.test(m));
        }

        // « Il ce lève », « Ma cliente ce couche » → se.
        function ruleCe(tokens, i) {
            const prev = tokens[i - 1];
            const next = tokens[i + 1];
            if (!prev || endOrPunct(next) || ETRE_FINITE.has(next.lower) || !has(next, /:V[^/]*:(Ip|Iq|Is|If|K|Sp)/)) {
                return false;
            }
            if (["il", "elle", "on", "ils", "elles"].includes(prev.lower) && clauseStart(tokens, i - 1)) {
                return true;
            }
            if (!nounPhraseBefore(tokens, i, null)) {
                return false;
            }
            // « le directeur ce soir… » : « ce » + nom ou adjectif masculin singulier est un déterminant.
            return !morph(next).some((m) => /:[NA]/.test(m) && /:[me]:[si]/.test(m));
        }

        // « Tu sais ou j'ai mis… », « d'ou vient… », « là ou tu veux », « Ou est le chargeur ? » → où.
        const OU_VERBS = new Set(["savoir", "demander", "ignorer", "deviner", "indiquer", "montrer", "expliquer", "comprendre", "oublier", "voir", "dire", "préciser", "découvrir", "regarder"]);
        const OU_NOT_AFTER = new Set(["bien", "alors", "plutôt", "non", "pas", "encore", "même", "sinon", "presque", "moins", "plus"]);
        function ruleOu(tokens, i, line) {
            const prev = tokens[i - 1];
            const next = tokens[i + 1];
            if (endOrPunct(next) || OU_NOT_AFTER.has(next.lower)) {
                return false;
            }
            const subjectNext = SUBJECTS.has(next.lower) || ["c'", "se", "s'", "ce", "les", "la", "le", "l'"].includes(next.lower) || has(next, /:V[^/]*:(Ip|Iq|If|K)/);
            if (prev && ["d'", "jusqu'"].includes(prev.lower)) {
                return true;
            }
            if (prev && prev.lower === "par") {
                return subjectNext && !ALL_DETS.has(next.lower);
            }
            // Une alternative « ou … ou … » dans la même phrase : on ne dit rien.
            let end = i + 1;
            while (end < tokens.length && !/[.!?;]/.test(tokens[end].text)) {
                end++;
            }
            const sentence = tokens.slice(i + 1, end);
            if (sentence.some((t) => t.lower === "ou")) {
                return false;
            }
            if (clauseStart(tokens, i) && tokens[end]?.text === "?") {
                return (has(next, /:V[^/]*:(Ip|If|K)/) && !has(next, /:[NA]/)) || ["se", "s'"].includes(next.lower) || /^(est|sont|va|vas|vont|était|étaient)-?/.test(next.lower);
            }
            // Verbe de savoir ou de question juste avant (« sais », « ne sais pas », « dis-moi »).
            let v = i - 1;
            if (v >= 0 && ["pas", "plus", "jamais", "vraiment", "bien", "toujours", "trop"].includes(tokens[v].lower)) {
                v--;
            }
            const verbToken = tokens[v];
            if (!verbToken || verbToken.punct) {
                return false;
            }
            const base = verbToken.text.replace(/-(moi|nous|lui|leur|toi)$/i, "");
            const lemmas = morph({ text: base, punct: false }).filter((m) => /:V/.test(m)).map(lemmaOf);
            if (!lemmas.some((l) => OU_VERBS.has(l)) || !subjectNext) {
                return false;
            }
            // « je le dis ou je me tais » : complément avant le verbe, ou même verbe répété : alternative.
            if (["le", "la", "les", "l'"].includes(tokens[v - 1]?.lower) && base === verbToken.text) {
                return false;
            }
            return !sentence.some((t) => morph(t).some((m) => /:V/.test(m) && lemmas.includes(lemmaOf(m))));
        }

        // Adjectif ou participe à la forme demandée (« content » → contentes).
        function inflectAdjective(token, gender, number) {
            const entry = morph(token).find((m) => /:Q/.test(m)) ?? morph(token).find((m) => /:A/.test(m));
            if (!entry) {
                return null;
            }
            const lemma = lemmaOf(entry);
            if (/:Q/.test(entry) && hasConj) {
                return conj.getConj(lemma, ":Q", `:${gender}:${number}`) || null;
            }
            if (typeof suggFemSing === "undefined") {
                return null;
            }
            const first = (list) => String(list || "").split("|")[0];
            const form = gender === "f"
                ? first(number === "p" ? suggFemPlur(lemma) : suggFemSing(lemma))
                : number === "p" ? first(suggMasPlur(lemma)) || (/[sx]$/.test(lemma) ? lemma : `${lemma}s`) : lemma;
            return form && morph({ text: form, punct: false }).some((m) => /:[AQ]/.test(m) && new RegExp(`:[${gender}e]:[${number}i]`).test(m)) ? form : null;
        }

        // Sujet d'un verbe « être » placé en k : « elles », « la cliente », « les serveurs neufs ».
        // « je », « tu », « nous » : genre inconnu (« ? »). Renvoie « f:p »… ou null.
        function attributeSubject(tokens, k) {
            let s = k - 1;
            if (s >= 0 && ["m'", "t'", "lui", "leur", "y", "en"].includes(tokens[s].lower)) {
                s--;
            }
            if (s >= 0 && ["ne", "n'"].includes(tokens[s].lower)) {
                s--;
            }
            const subject = tokens[s];
            if (!subject || subject.punct || subject.text.length < 2) {
                return null;  // « la variable x est constante »
            }
            const pronoun = { il: "m:s", elle: "f:s", ils: "m:p", elles: "f:p", je: "?:s", "j'": "?:s", tu: "?:s", nous: "?:p" }[subject.lower];
            if (pronoun) {
                return clauseStart(tokens, s) && !coordinated(tokens, s) ? pronoun : null;
            }
            let head = s;
            if (has(subject, /:[AQ]/) && s > 0 && noun(tokens[s - 1], null) && simpleNounPhrase(tokens, s, null) >= 0) {
                head = s - 1;
            }
            if (COLLECTIVE.has(tokens[head].lower) || isAcronym(tokens[head])) {
                return null;
            }
            const start = simpleNounPhrase(tokens, head + 1, null);
            if (start < 0 || coordinated(tokens, start)) {
                return null;
            }
            return subjectAgreement(tokens, head);
        }

        // « Ces portes seront trop vide », « La voisine surprise est descendu » → vides, descendue.
        function ruleAttribute(tokens, i, push) {
            const token = tokens[i];
            if (NOT_PARTICIPLE.has(token.lower) || !has(token, /:[AQ]/) || /^\p{Lu}/u.test(token.text) || has(token, /:[WRGDB]/) || ["bel", "nouvel", "vieil", "fol", "mol"].includes(token.lower)) {
                return;  // « juste », « même », « sur » (adverbe, préposition) ; « bel et bien »
            }
            const following = tokens[i + 1];
            // « ils sont autre chose », « dernier cri », « bleu saphir », « noir de jais » : l'adjectif porte sur ce qui suit.
            if (following && !following.punct && (has(following, /:N/) || (COLORS.has(token.lower) && ["de", "d'"].includes(following.lower)))) {
                return;
            }
            if (["entendu", "sûr", "sûrs"].includes(token.lower) && tokens[i - 1]?.lower === "bien") {
                return;
            }
            let k = i - 1;
            while (k >= 0 && k > i - 4 && ATTRIBUTE_ADVERBS.has(tokens[k].lower)) {
                k--;
            }
            if (k < 0 || !ETRE_FINITE.has(tokens[k].lower) || ["tout", "toute", "toutes"].includes(tokens[i - 1].lower)) {
                return;
            }
            if (tokens.slice(k + 1, i).some((t, j, list) => t.lower === "un" && list[j + 1]?.lower !== "peu")) {
                return;
            }
            const agreement = attributeSubject(tokens, k);
            if (!agreement) {
                return;
            }
            const [gender, number] = agreement.split(":");
            // « elle sont parties » : le verbe ne va pas avec le sujet, l'accord est incertain.
            const plural = ["sommes", "êtes", "sont", "étions", "étiez", "étaient", "serons", "serez", "seront", "serions", "seriez", "seraient", "soyons", "soyez", "soient", "furent"].includes(tokens[k].lower);
            if (plural !== (number === "p")) {
                return;
            }
            const fits = morph(token).filter((m) => /:[AQ]/.test(m)).some((m) => {
                const genderOk = gender === "?" || new RegExp(`:[${gender}e]:`).test(m);
                return genderOk && new RegExp(`:[mfe]:[${number}i]`).test(m);
            });
            if (fits) {
                return;
            }
            const genders = gender === "?" ? ["m", "f"] : [gender];
            const forms = [...new Set(genders.map((g) => inflectAdjective(token, g, number)).filter((f) => f && f !== token.lower))];
            if (forms.length) {
                push(token, token.end, forms, `${MESSAGES.attribut} : « ${forms[0]} ».`, "accord_attribut", "accord");
            }
        }

        // « La figurine qu'ils m'ont offert » → offerte : nom + que + sujet + avoir + participe.
        function ruleRelativeParticiple(tokens, i, push, vetoes = []) {
            const entry = participleEntry(tokens[i]);
            if (!entry || !hasConj || NOT_PARTICIPLE.has(tokens[i].lower)) {
                return;
            }
            const lemma = lemmaOf(entry);
            // « Les années qu'il a vécu à Tokyo » : durée ou mesure, pas un complément direct.
            if (["vivre", "durer", "coûter", "valoir", "peser", "mesurer", "courir", "dormir", "régner", "marcher"].includes(lemma) && tokens.slice(Math.max(0, i - 6), i).some((t) => ["que", "qu'"].includes(t.lower))) {
                vetoes.push({ start: tokens[i].start, end: tokens[i].end });
            }
            if (NO_QUE_AGREEMENT.has(lemma) || !/^.{3}t/.test(conj.getVtyp(lemma) || "")) {
                return;
            }
            const next = tokens[i + 1];
            // « que » n'est complément du participe que si rien ne le remplace après : pas de complément
            // direct (« que j'ai découvert le pot »), pas de « de/à + infinitif » (« que j'ai essayé de
            // lire »), pas d'infinitif (« qu'il a fait construire »).
            const placeNext = next && ["au", "aux", "à"].includes(next.lower) && tokens[i + 2] && !has(tokens[i + 2], /:Y/) && !OBJECT_PRONOUNS.has(tokens[i + 2].lower);
            const mainResumes = next && OBJECT_PRONOUNS.has(next.lower) && tokens[i + 2] && has(tokens[i + 2], /:V[^/]*:(Ip|Iq|If|K)/) && !has(tokens[i + 2], /:N/);
            if (next && !next.punct && !ETRE_FINITE.has(next.lower) && !placeNext && !mainResumes && !["et", "mais", "ou", "hier", "aujourd'hui", "avant", "après", "pendant", "depuis", "pour", "avec", "dans", "sur", "chez", "sans", "par", "en"].includes(next.lower) && !(isAdverb(next) && !has(next, /:[NDR]/)) && !isTimeComplement(tokens, i + 1)) {
                return;
            }
            let k = i - 1;
            while (k >= 0 && ["pas", "plus", "jamais", "bien", "déjà", "toujours", "souvent", "enfin", "finalement", "même", "aussi"].includes(tokens[k].lower)) {
                k--;
            }
            if (k < 0 || !AVOIR_FORMS.has(tokens[k].lower)) {
                return;
            }
            k--;
            if (k >= 0 && ["m'", "t'", "lui", "leur"].includes(tokens[k].lower)) {
                k--;
            }
            if (k >= 0 && ["ne", "n'"].includes(tokens[k].lower)) {
                k--;
            }
            if (k >= 0 && ["m'", "t'", "lui", "leur"].includes(tokens[k].lower)) {
                k--;
            }
            const subject = tokens[k];
            if (!subject || subject.punct) {
                return;
            }
            let subjectStart = -1;
            if (SUBJECTS.has(subject.lower) && !["ça", "cela"].includes(subject.lower)) {
                subjectStart = k;
            } else if (/^\p{Lu}/u.test(subject.text) && has(subject, /:M/)) {
                subjectStart = k;
            } else {
                let head = k;
                if (has(subject, /:[AQ]/) && k > 0 && noun(tokens[k - 1], null) && simpleNounPhrase(tokens, k, null) >= 0) {
                    head = k - 1;
                }
                subjectStart = simpleNounPhrase(tokens, head + 1, null);
            }
            if (subjectStart < 1 || !["que", "qu'"].includes(tokens[subjectStart - 1].lower)) {
                return;
            }
            const nounIndex = subjectStart - 2;
            const nounToken = tokens[nounIndex];
            const start = nounToken ? simpleNounPhrase(tokens, nounIndex + 1, null) : -1;
            if (start < 0 || ["de", "d'", "du", "des"].includes(tokens[start - 1]?.lower) || COLLECTIVE.has(nounToken.lower) || isAcronym(nounToken)
                || coordinated(tokens, start) || COMPLETIVE_NOUNS.has(nounToken.lower) || TIME_NOUNS.has(nounToken.lower) || TIME_NOUNS.has(nounToken.lower.replace(/s$/, ""))) {
                return;
            }
            // « dis à ces femmes que tu m'as contacté » : complétive après un verbe + « à ».
            if (tokens[start - 1]?.lower === "à" && has(tokens[start - 2], /:V/)) {
                return;
            }
            const det = tokens[start].lower;
            const nounMorph = morph(nounToken).filter((m) => /:N/.test(m));
            const gender = nounMorph.length && nounMorph.every((m) => /:f/.test(m)) ? "f" : nounMorph.length && nounMorph.every((m) => /:m/.test(m)) ? "m" : null;
            const number = DET_PLUR.has(det) ? "p" : DET_SING.has(det) ? "s" : null;
            if (!number || !gender) {
                return;
            }
            const [, g, n] = participleTags(tokens[i]);
            if ((g === gender || g === "e") && (n === number || n === "i")) {
                return;
            }
            const form = qForm(lemma, gender, number);
            if (form && form !== tokens[i].lower) {
                push(tokens[i], tokens[i].end, form, `${MESSAGES.relative} « ${tokens.slice(start, nounIndex + 1).map((t) => t.text).join(" ").replace(/' /g, "'")} »).`, "ppas_relative", "accord");
            }
        }

        // « Le certificat SSL expirent », « Votre infirmière contente préparerez » → expire, préparera.
        const TENSE_ORDER = ["Ip", "If", "K", "Iq", "Sp", "Is"];
        const SUBORDINATORS = new Set(["que", "qu'", "lorsque", "lorsqu'", "puisque", "puisqu'", "quand", "si", "où"]);
        function finiteEntry(token) {
            // Seulement un verbe conjugué : ni nom, ni adjectif, ni participe, ni infinitif.
            const all = morph(token);
            const entries = all.filter((m) => /:V[^/]*:(Ip|Iq|Is|If|K|Sp)/.test(m));
            if (!entries.length || all.some((m) => !/:V/.test(m) || /:(Q|Y|P)(?=[:/]|$)/.test(m))) {
                return null;
            }
            return entries.sort((a, b) => TENSE_ORDER.indexOf(/:(Ip|Iq|Is|If|K|Sp)/.exec(a)[1]) - TENSE_ORDER.indexOf(/:(Ip|Iq|Is|If|K|Sp)/.exec(b)[1]))[0];
        }

        // Verbe conjugué qui peut aussi être un nom pluriel (« chauffes ») ou singulier : toléré
        // seulement si ce nom ne s'accorderait pas avec le groupe sujet (voir plus bas).
        function finiteEntryLoose(token) {
            const all = morph(token);
            const entries = all.filter((m) => /:V[^/]*:(Ip|Iq|Is|If|K|Sp)/.test(m));
            if (!entries.length || all.some((m) => (!/:V/.test(m) && !/:N/.test(m)) || /:(Q|Y|P)(?=[:/]|$)/.test(m))) {
                return null;
            }
            return entries.sort((a, b) => TENSE_ORDER.indexOf(/:(Ip|Iq|Is|If|K|Sp)/.exec(a)[1]) - TENSE_ORDER.indexOf(/:(Ip|Iq|Is|If|K|Sp)/.exec(b)[1]))[0];
        }

        function ruleSubjectVerb(tokens, i, push) {
            const verb = tokens[i];
            const entry = finiteEntryLoose(verb);
            if (!entry || !hasConj || i < 2) {
                return;
            }
            let head = i - 1;
            if ((isParticiple(tokens[head]) || (has(tokens[head], /:A/) && !has(tokens[head], /:[GR]/))) && head > 0 && noun(tokens[head - 1], null) && simpleNounPhrase(tokens, head, null) >= 0) {
                head--;  // « le stagiaire fatigué attendez », « le joueur content nettoyez »
            }
            if (isAcronym(tokens[head]) && head > 0 && noun(tokens[head - 1], null)) {
                head--;  // « le certificat SSL »
            }
            const headToken = tokens[head];
            if (!headToken || headToken.punct || headToken.text.length < 2 || COLLECTIVE.has(headToken.lower) || TIME_NOUNS.has(headToken.lower) || isAcronym(headToken) || OBJECT_PRONOUNS.has(headToken.lower) || NOT_PARTICIPLE.has(headToken.lower)) {
                return;
            }
            let start = simpleNounPhrase(tokens, head + 1, null);
            if (start < 0 && has(headToken, /:A/) && head > 1 && noun(tokens[head - 1], null)) {
                head--;  // « la carte graphique » : « graphique » est aussi un nom
                start = simpleNounPhrase(tokens, head + 1, null);
            }
            if (start < 0 || (coordinated(tokens, start) && !afterLeadingClause(tokens, start))) {
                return;
            }
            const opener = tokens[start - 1];
            if (start > 0 && !(opener.punct && opener.text !== ",") && !(CLAUSE_WORDS.has(opener.lower) && !["et", "ou"].includes(opener.lower)) && !SUBORDINATORS.has(opener.lower) && !afterLeadingClause(tokens, start)) {
                return;
            }
            const det = tokens[start].lower;
            const number = DET_PLUR.has(det) ? "p" : DET_SING.has(det) ? "s" : null;
            if (!number || !noun(tokens[head], number)) {
                return;
            }
            const person = number === "s" ? ":3s" : ":3p";
            if (morph(verb).some((m) => m.includes(person))) {
                return;
            }
            // Un nom peut suivre le groupe (« le chef cuisinier », « des talons aiguille ») : on n'accepte
            // un mot qui est aussi un nom que s'il est au pluriel après un sujet singulier (« la carte chauffes »).
            // Après un sujet pluriel, un nom ou un adjectif (« des créatures marines », « des talons
            // aiguille ») ; après un sujet singulier, seulement un nom singulier (« le chef cuisinier »).
            // Suivi d'un déterminant (« nos techniciens lirons vos câbles ») : c'est bien un verbe.
            const objectAfter = tokens[i + 1] && ALL_DETS.has(tokens[i + 1].lower) && !["l'", "du", "des"].includes(tokens[i + 1].lower);
            if (!objectAfter && morph(verb).some((m) => /:[NA]/.test(m) && (number === "p" || /:[si]/.test(m)))) {
                return;
            }
            const forms = personForms(entry, person, verb.lower, tokens, i);
            if (forms.length) {
                push(verb, verb.end, forms, `${MESSAGES.verbe} : « ${forms[0]} ».`, "accord_sujet_verbe", "conjugaison");
            }
        }

        // « Vous réparent ces tâches », « Quand je terminerai, nous liront le badge » → réparez, lirons.
        const NOUS_OPENERS = new Set(["que", "qu'", "quand", "lorsque", "lorsqu'", "si", "comme", "où", "parce", "puisque", "puisqu'", "car", "donc"]);
        // « Quand mes directrices termineront, notre joueur choisiront… » : la virgule qui ferme une
        // subordonnée placée en tête ouvre la principale.
        function afterLeadingClause(tokens, start) {
            if (tokens[start - 1]?.text !== ",") {
                return false;
            }
            let first = start - 1;
            while (first > 0 && !/[.!?;:]/.test(tokens[first - 1].text)) {
                first--;
            }
            const commas = tokens.slice(first, start).filter((t) => t.text === ",").length;
            return commas === 1 && SUBORDINATE_STARTS.has(tokens[first]?.lower);
        }
        const SUBORDINATE_STARTS = new Set(["quand", "si", "s'", "lorsque", "lorsqu'", "comme", "puisque", "puisqu'", "dès", "après", "avant", "pendant", "bien", "même", "une"]);
        function ruleNousVous(tokens, i, push) {
            const token = tokens[i];
            const opener = tokens[i - 1];
            // Après « et », « mais » : « nous » peut être complément (« il les garde, mais nous ignore »).
            // Seulement si le verbe n'est ni à sa personne ni à la 3e (« mais nous ouvrez » → ouvrons).
            const afterConjunction = opener && ["et", "mais", "puis", "ou"].includes(opener.lower) && tokens[i + 1] && !has(tokens[i + 1], /:V[^/]*:3[sp]/);
            if (i > 0 && !opener.punct && !NOUS_OPENERS.has(opener.lower) && !afterConjunction) {
                return;
            }
            let sentenceStart = i - 1;
            while (sentenceStart >= 0 && !/[.!?;:«"“\n]/.test(tokens[sentenceStart].text)) {
                sentenceStart--;
            }
            sentenceStart++;
            // Après une virgule, seulement au sortir d'une subordonnée en tête (« Quand je finirai,
            // nous lirons… ») ; pas dans une incise ou une énumération (« L'espoir, il est vrai, nous soulage »).
            if (opener && opener.text === ",") {
                const commas = tokens.slice(sentenceStart, i).filter((t) => t.text === ",").length;
                if (commas !== 1 || !SUBORDINATE_STARTS.has(tokens[sentenceStart]?.lower)) {
                    return;
                }
            } else if (opener && opener.punct && !/[.!?;:«"“]/.test(opener.text)) {
                return;
            }
            // « Nous » avec une majuscule au milieu d'une phrase : poésie ou citation.
            if (i > 0 && /^\p{Lu}/u.test(token.text) && !/[.!?…:;«"“]/.test(opener.text)) {
                return;
            }
            // Ligne qui commence en minuscule : la suite d'un texte coupé, le sujet est avant.
            if (i === 0 && /^\p{Ll}/u.test(token.text)) {
                return;
            }
            // « Que vous semble… ? » : « que » interrogatif en tête de phrase.
            if (["que", "qu'"].includes(opener?.lower) && i - 1 === sentenceStart) {
                return;
            }
            const verb = tokens[i + 1];
            // Juste après « nous » ou « vous » sujet, un nom est impossible : « lit », « achète » sont des verbes.
            const entry = verb && !verb.punct && finiteEntryLoose(verb);
            if (!entry || !hasConj) {
                return;
            }
            const person = token.lower === "nous" ? ":1p" : ":2p";
            if (has(verb, new RegExp(person))) {
                return;
            }
            // « ce que vous dit le médecin », « nous viennent les rêves » : sujet inversé.
            const after = tokens[i + 2];
            // « que » relatif (après « ce » ou un nom) ; après un verbe (« je pense que »), c'est une conjonction.
            const relativeQue = ["que", "qu'"].includes(opener?.lower) && (tokens[i - 2]?.lower === "ce" || noun(tokens[i - 2], null));
            if (after && !after.punct && (has(after, /:Y/) || ((relativeQue || !/^.{3}t/.test(conj.getVtyp(lemmaOf(entry)) || "")) && (ALL_DETS.has(after.lower) || /^\p{Lu}/u.test(after.text))))) {
                return;
            }
            const forms = personForms(entry, person, verb.lower, tokens, i + 1);
            if (forms.length) {
                push(verb, verb.end, forms, `${MESSAGES.personneVerbe} : « ${token.lower} ${forms[0]} ».`, `${token.lower}_verbe`, "conjugaison");
            }
        }

        // Formes du verbe à la personne voulue : d'abord celle qui se prononce comme le mot écrit
        // (« vous venait » → venez, « nous liront » → lirons), puis celle du même temps.
        const sound = (word) => word.replace(/(aient|ait|ais|ai|ez|er|ées|ée|és|é)$/, "É");
        // Proposition au subjonctif : « il faut que », « pour que », « avant que », « bien que »…
        const SUBJUNCTIVE_TRIGGERS = new Set(["faut", "faudrait", "fallait", "faudra", "pour", "avant", "afin", "sans", "bien", "pourvu", "veux", "voudrais", "voulait", "veut", "souhaite", "souhaiterais", "aimerais", "préfère", "exige", "demande", "attends", "doute", "crains", "quoique", "condition", "peur", "crainte", "important", "nécessaire", "possible", "temps", "essentiel", "dommage", "normal"]);
        function subjunctiveAt(tokens, i) {
            for (let k = i - 1; k >= 1 && !/[.!?;]/.test(tokens[k].text); k--) {
                if (["que", "qu'"].includes(tokens[k].lower)) {
                    return SUBJUNCTIVE_TRIGGERS.has(tokens[k - 1].lower);
                }
            }
            return false;
        }
        // Formes du verbe à la personne voulue, au même temps (au subjonctif si la proposition
        // l'exige) ; « vous venait » (imparfait) → venez d'abord, qui se prononce pareil.
        function personForms(entry, person, original, tokens = null, i = 0) {
            const lemma = lemmaOf(entry);
            let tense = /:(Ip|Iq|Is|If|K|Sp)/.exec(entry)[1];
            if (tokens && subjunctiveAt(tokens, i)) {
                tense = "Sp";
            }
            const same = conj.getConj(lemma, `:${tense}`, person);
            // Phrase au passé (un autre imparfait) : on garde l'imparfait (« parce que vous oubliait » → oubliiez).
            const pastContext = tokens && tokens.some((t, k) => k !== i && has(t, /:V[^/]*:Iq/) && !has(t, /:[NA]/));
            const present = tense === "Iq" && !pastContext ? conj.getConj(lemma, ":Ip", person) : null;
            const sounding = present && sound(present) === sound(original) ? present : null;
            return [...new Set([sounding, same].filter((f) => f && f !== original))];
        }

        // --- Sujet éloigné du verbe : « La liste des participants sont… », « Les fichiers que tu m'as
        // envoyés ce matin est… », « Chacun des candidats doivent… », « Mon frère et ma sœur habite… ».
        const CHAIN_PREPOSITIONS = new Set(["auprès", "par", "pour", "avec", "dans", "sur", "sous", "chez", "en", "à", "au", "aux", "vers", "sans", "contre", "entre", "près", "envers", "selon", "depuis", "pendant", "lors"]);
        const SINGULAR_PRONOUN_SUBJECTS = new Set(["chacun", "chacune", "aucun", "aucune"]);

        // Fin d'un groupe nominal commençant en k (dét. + adjectifs + nom + adjectifs) : indice après, ou -1.
        function nounGroupEnd(tokens, k) {
            if (!tokens[k] || !ALL_DETS.has(tokens[k].lower) && !["du", "des", "d'"].includes(tokens[k].lower)) {
                return -1;
            }
            let j = k + 1;
            // Adjectifs avant le nom (« le deuxième étage », « les anciens serveurs »).
            while (tokens[j] && ((isPureAdjective(tokens[j]) && !noun(tokens[j], null)) || (has(tokens[j], /:A/) && tokens[j + 1] && !tokens[j + 1].punct && has(tokens[j + 1], /:N/) && (!has(tokens[j + 1], /:V[^/]*:(Ip|Iq|If|K)/) || /ième$|^(premier|première|dernier|dernière|seul|seule|même)$/.test(tokens[j].lower))))) {
                j++;
            }
            if (!tokens[j] || tokens[j].punct || !(noun(tokens[j], null) || morph(tokens[j]).some((m) => /:N/.test(m)))) {
                return -1;
            }
            j++;
            // Adjectifs après le nom ; un adjectif qui est aussi un verbe (« prête », « lourdes ») compte
            // comme adjectif s'il est suivi d'un verbe conjugué (« la directrice prête a déplacé »).
            const finite = (t) => !!t && has(t, /:V[^/]*:(Ip|Iq|If|K|Is)/);
            const verbNext = (k) => (finite(tokens[k + 1]) && !has(tokens[k + 1], /:[NA]/)) || AVOIR_FORMS.has(tokens[k + 1]?.lower ?? "") || BE_FORMS.has(tokens[k + 1]?.lower ?? "");
            while (tokens[j] && !tokens[j].punct && has(tokens[j], /:[AQ]/) && ((!noun(tokens[j], null) && !finite(tokens[j])) || (has(tokens[j], /:A/) && verbNext(j)))) {
                j++;
            }
            return j;
        }

        // Saute les compléments du nom sujet : « de/des … », participe ou adjectif + complément,
        // proposition relative. Renvoie l'indice du verbe principal présumé, ou -1.
        function skipSubjectModifiers(tokens, j, end) {
            let skipped = false;
            for (let guard = 0; guard < 12 && j < end; guard++) {
                const t = tokens[j];
                if (!t || t.punct) {
                    return -1;
                }
                if (["de", "d'", "du", "des"].includes(t.lower)) {
                    const start = ["de", "d'"].includes(t.lower) ? j + 1 : j;
                    let next = nounGroupEnd(tokens, start);
                    if (next < 0 && ["de", "d'"].includes(t.lower) && tokens[j + 1] && noun(tokens[j + 1], null)) {
                        next = j + 2;  // « de tickets », « d'identité »
                        while (tokens[next] && !tokens[next].punct && has(tokens[next], /:[AQ]/) && !has(tokens[next], /:V[^/]*:(Ip|Iq|If|K|Is)/) && !noun(tokens[next], null)) {
                            next++;
                        }
                    }
                    if (next < 0) {
                        return -1;
                    }
                    j = next;
                    skipped = true;
                    continue;
                }
                if (CHAIN_PREPOSITIONS.has(t.lower) && skipped) {
                    let k = j + 1;
                    if (["de", "d'", "du", "des"].includes(tokens[k]?.lower)) {
                        k = ["du", "des"].includes(tokens[k].lower) ? k : k + 1;
                    }
                    const next = nounGroupEnd(tokens, k);
                    if (next < 0) {
                        return -1;
                    }
                    j = next;
                    continue;
                }
                if (["que", "qu'", "où", "dont", "qui"].includes(t.lower)) {
                    let k = j + 1;
                    if (t.lower !== "qui") {
                        // Sujet de la relative : pronom ou groupe nominal.
                        if (SUBJECTS.has(tokens[k]?.lower)) {
                            k++;
                        } else {
                            const next = nounGroupEnd(tokens, k);
                            if (next < 0 && !(/^\p{Lu}/u.test(tokens[k]?.text ?? "") && has(tokens[k], /:M/))) {
                                return -1;
                            }
                            k = next < 0 ? k + 1 : next;
                        }
                    }
                    while (tokens[k] && (OBJECT_PRONOUNS.has(tokens[k].lower))) {
                        k++;
                    }
                    if (!tokens[k] || !has(tokens[k], /:V[^/]*:(Ip|Iq|If|K|Is|Sp)/)) {
                        return -1;
                    }
                    k++;
                    while (tokens[k] && ["pas", "plus", "jamais", "déjà", "bien", "toujours"].includes(tokens[k].lower)) {
                        k++;
                    }
                    if (tokens[k] && isParticiple(tokens[k])) {
                        k++;
                    }
                    // Compléments de la relative : groupe nominal, complément de temps, adverbe.
                    for (let g = 0; g < 4; g++) {
                        const next = nounGroupEnd(tokens, k);
                        if (next > 0) {
                            k = next;
                        } else if (isTimeComplement(tokens, k)) {
                            k += TIME_NOUNS.has(tokens[k + 1]?.lower) ? 2 : 1;
                        } else if (tokens[k] && isAdverb(tokens[k]) && !has(tokens[k], /:V/)) {
                            k++;
                        } else {
                            break;
                        }
                    }
                    j = k;
                    skipped = true;
                    continue;
                }
                if (isParticiple(t) && !has(t, /:V[^/]*:(Ip|Iq|If|K|Is)/) && skipped !== null) {
                    j++;
                    skipped = true;
                    continue;
                }
                if (isAdverb(t) && !has(t, /:[VNA]/) && skipped) {
                    j++;
                    continue;
                }
                if (["ne", "n'"].includes(t.lower)) {
                    j++;
                    continue;
                }
                return skipped ? j : -1;
            }
            return -1;
        }

        function ruleDistantSubject(tokens, push) {
            let s0 = 0;
            while (s0 < tokens.length) {
                let end = s0;
                while (end < tokens.length && !/[.!?;:]/.test(tokens[end].text)) {
                    end++;
                }
                checkSentenceSubject(tokens, s0, end, push);
                s0 = end + 1;
            }
        }

        function checkSentenceSubject(tokens, s0, end, push) {
            const first = tokens[s0];
            if (!first || first.punct) {
                return;
            }
            let person = null;
            let j = -1;
            let label = "";
            // « Chacun des », « Aucun des », « L'un des » : singulier.
            if (SINGULAR_PRONOUN_SUBJECTS.has(first.lower) && ["des", "de", "d'"].includes(tokens[s0 + 1]?.lower)) {
                person = ":3s";
                j = skipSubjectModifiers(tokens, s0 + 1, end);
                label = first.text;
            } else if (first.lower === "l'" && ["un", "une"].includes(tokens[s0 + 1]?.lower) && ["des", "d'"].includes(tokens[s0 + 2]?.lower)) {
                person = ":3s";
                j = skipSubjectModifiers(tokens, s0 + 2, end);
                label = `l'${tokens[s0 + 1].text}`;
            } else if (first.lower === "la" && tokens[s0 + 1]?.lower === "plupart" && ["des", "de", "d'"].includes(tokens[s0 + 2]?.lower)) {
                person = ":3p";
                j = skipSubjectModifiers(tokens, s0 + 2, end);
                label = "la plupart";
            } else {
                const groupEnd = nounGroupEnd(tokens, s0);
                if (groupEnd < 0) {
                    return;
                }
                const det = first.lower;
                let head = groupEnd - 1;
                while (head > s0 && !has(tokens[head], /:N/) && !isAcronym(tokens[head])) {
                    head--;
                }
                const headToken = tokens[head];
                if (TIME_NOUNS.has(headToken.lower) || isAcronym(headToken)) {
                    return;
                }
                // « Mon frère et ma sœur habite » : deux groupes coordonnés.
                if (tokens[groupEnd]?.lower === "et") {
                    const secondEnd = nounGroupEnd(tokens, groupEnd + 1);
                    if (secondEnd > 0 && tokens[secondEnd] && has(tokens[secondEnd], /:V[^/]*:(Ip|Iq|If|K)/)) {
                        person = ":3p";
                        j = secondEnd;
                        label = "les deux sujets";
                    }
                }
                if (!person) {
                    if (headToken.lower === "nombre" && det === "le") {
                        person = ":3s";
                    } else if (COLLECTIVE.has(headToken.lower)) {
                        return;
                    } else {
                        person = DET_PLUR.has(det) ? ":3p" : DET_SING.has(det) ? ":3s" : null;
                    }
                    j = skipSubjectModifiers(tokens, groupEnd, end);
                    label = tokens.slice(s0, head + 1).map((t) => t.text).join(" ").replace(/' /g, "'");
                }
            }
            if (!person || j < 0 || j >= end) {
                return;
            }
            const verb = tokens[j];
            const entry = verb && finiteEntryLoose(verb);
            if (!entry || !hasConj || morph(verb).some((m) => /:V/.test(m) && m.includes(person))) {
                return;
            }
            // Un nom ou un adjectif qui pourrait s'accorder avec le sujet (« les taux domestiques »,
            // « les méthodes qui ont cours ») : ce n'est pas le verbe. « n'importe qui » non plus.
            const subjectNumber = person === ":3p" ? "p" : "s";
            const objectAfter = tokens[j + 1] && ALL_DETS.has(tokens[j + 1].lower) && !["l'", "du", "des"].includes(tokens[j + 1].lower);
            if ((!AVOIR_FORMS.has(verb.lower) && !BE_FORMS.has(verb.lower) && !objectAfter && morph(verb).some((m) => /:[NA]/.test(m) && new RegExp(`:[${subjectNumber}i]`).test(m))) || (verb.lower === "importe" && tokens[j - 1]?.lower === "n'")
                || (["ne", "n'"].includes(tokens[j - 1]?.lower) && CHAIN_PREPOSITIONS.has(tokens[j - 2]?.lower ?? ""))) {
                return;
            }
            const forms = personForms(entry, person, verb.lower, tokens, j);
            if (forms.length) {
                push(verb, verb.end, forms, `${MESSAGES.sujetLoin} (${label}) : « ${forms[0]} ».`, "accord_sujet_loin", "conjugaison");
            }
        }

        // « Où sont passé le chargeur ? » : sujet inversé après le verbe.
        const QUESTION_WORDS = new Set(["où", "quand", "comment", "pourquoi", "que", "qu'", "combien"]);
        function ruleInvertedSubject(tokens, push) {
            for (let i = 0; i < tokens.length; i++) {
                if (!QUESTION_WORDS.has(tokens[i].lower) || !clauseStart(tokens, i)) {
                    continue;
                }
                const verb = tokens[i + 1];
                const entry = verb && !verb.punct && finiteEntryLoose(verb);
                if (!entry) {
                    continue;
                }
                let k = i + 2;
                if (tokens[k] && isParticiple(tokens[k])) {
                    k++;
                }
                const groupEnd = nounGroupEnd(tokens, k);
                let end = groupEnd;
                while (end > 0 && tokens[end] && !/[?]/.test(tokens[end].text) && !tokens[end].punct) {
                    end++;
                }
                if (groupEnd < 0 || tokens[end]?.text !== "?" || ["et", "ou", ","].includes(tokens[groupEnd]?.lower)) {
                    continue;  // « comment sont la petite et son frère ? » : sujet coordonné
                }
                const det = tokens[k].lower;
                const person = DET_PLUR.has(det) ? ":3p" : DET_SING.has(det) ? ":3s" : null;
                if (!person || morph(verb).some((m) => /:V/.test(m) && m.includes(person))) {
                    continue;
                }
                const forms = personForms(entry, person, verb.lower);
                if (forms.length) {
                    push(verb, verb.end, forms, `${MESSAGES.sujetInverse} : « ${forms[0]} ».`, "sujet_inverse", "conjugaison");
                }
            }
        }

        // « Il faut qu'on apportions », « on cherchent » → apporte, cherche.
        function ruleOn(tokens, i, push) {
            const opener = tokens[i - 1];
            if (i > 0 && !opener.punct && !NOUS_OPENERS.has(opener.lower) && !CLAUSE_WORDS.has(opener.lower)) {
                return;
            }
            let k = i + 1;
            if (["ne", "n'"].includes(tokens[k]?.lower)) {
                k++;
            }
            const verb = tokens[k];
            const entry = verb && !verb.punct && finiteEntry(verb);
            if (!entry || !hasConj || has(verb, /:3s/)) {
                return;
            }
            const forms = personForms(entry, ":3s", verb.lower, tokens, k);
            if (forms.length) {
                push(verb, verb.end, forms, `${MESSAGES.personneVerbe} : « on ${forms[0]} ».`, "on_verbe", "conjugaison");
            }
        }

        // « Elles ne rendent pas ces photo », « réparé les facture » → photos, factures.
        const PLURAL_DETS = new Set(["les", "des", "ces", "mes", "tes", "ses", "nos", "vos", "leurs", "plusieurs", "quelques", "certains", "certaines", "différents", "différentes", "divers", "diverses", "nombreux", "nombreuses"]);
        const PRONOUN_LES_BEFORE = new Set(["ne", "n'", "me", "m'", "te", "t'", "se", "s'", "nous", "vous", "je", "j'", "tu", "il", "elle", "on", "ils", "elles", "ça", "cela", "qui", "pour", "de", "à", "sans"]);
        function rulePluralNoun(tokens, i, push) {
            const det = tokens[i];
            const prev = tokens[i - 1];
            const nounToken = tokens[i + 1];
            if (!nounToken || nounToken.punct || /^\p{Lu}/u.test(nounToken.text) || /[sxz]$/i.test(nounToken.lower) || nounToken.start !== det.end + 1) {
                return;
            }
            const readings = morph(nounToken);
            if (!readings.some((m) => /:N/.test(m) && /:s/.test(m)) || readings.some((m) => /:N/.test(m) && /:[pi]/.test(m)) || has(nounToken, /:[BGD]/) || readings.some((m) => /:(Y|P)(?=[:/]|$)/.test(m))) {
                return;
            }
            // « vos nom et prénom », « ses père et mère », « ces don Juan », « les bac +2 ».
            const third = tokens[i + 2];
            if (third && (["et", "ou", "&"].includes(third.lower) || third.text === "," || /^[\p{Lu}\d+]/u.test(third.text))) {
                return;
            }
            // « les » pronom (« il les facture », « puis les glisse »).
            if (det.lower === "les" && ((prev && PRONOUN_LES_BEFORE.has(prev.lower)) || (has(nounToken, /:V/) && !(prev && has(prev, /:Q/))))) {
                return;
            }
            const plural = typeof suggPlur === "function" ? String(suggPlur(nounToken.lower, true) || "").split("|").find((f) => f && f !== nounToken.lower && morph({ text: f, punct: false }).some((m) => /:N/.test(m))) : null;
            if (plural) {
                push(nounToken, nounToken.end, plural, `${MESSAGES.pluriel} : « ${plural} ».`, "pluriel_nom", "accord");
            }
        }

        const hasConj = typeof conj !== "undefined";
        const participleEntry = (token) => morph(token).find((m) => /:Q/.test(m));
        const lemmaOf = (entry) => entry.slice(1, entry.indexOf("/"));

        // Genre et nombre attendus du sujet d'un verbe pronominal : « elles », « les filles ».
        function subjectAgreement(tokens, k) {
            let subject = tokens[k];
            if (!subject || subject.punct) {
                return null;
            }
            if (SUBJECT_AGREEMENT[subject.lower]) {
                return SUBJECT_AGREEMENT[subject.lower];
            }
            // « la voisine surprise » : l'adjectif après le nom.
            if (has(subject, /:[AQ]/) && k > 0 && noun(tokens[k - 1], null) && simpleNounPhrase(tokens, k, null) >= 0) {
                k--;  // « la voisine surprise », « le client malade » (adjectif qui peut aussi être un nom)
                subject = tokens[k];
            }
            // Le groupe nominal doit ouvrir la proposition : dans « le bruit que Manuel avait découvert
            // une source s'était répandu », « une source » n'est pas le sujet de « s'était répandu ».
            const start = simpleNounPhrase(tokens, k + 1, null);
            if (start < 0 || !clauseStart(tokens, start) || ["que", "qu'"].includes(tokens[start - 1]?.lower)) {
                return null;
            }
            const det = tokens[start].lower;
            const nounMorph = morph(subject).filter((m) => /:N/.test(m));
            if (nounMorph.length === 0) {
                return null;  // mot inconnu : genre inconnu
            }
            const gender = nounMorph.every((m) => /:f/.test(m)) ? "f" : nounMorph.every((m) => /:m/.test(m)) ? "m" : "?";  // épicène (« stagiaire »)
            const number = DET_PLUR.has(det) ? "p" : DET_SING.has(det) ? "s" : null;
            return number ? `${gender}:${number}` : null;
        }

        // Complément de temps : « hier », « lundi », « la semaine dernière », « toute la soirée », « il y a ».
        function isTimeComplement(tokens, k) {
            const t = tokens[k];
            if (!t || t.punct) {
                return false;
            }
            if (TIME_WORDS.has(t.lower) || TIME_NOUNS.has(t.lower)) {
                return true;
            }
            if (["ce", "cet", "cette", "ces", "la", "le", "l'", "toute", "tout", "tous", "toutes", "chaque", "une", "un", "deux", "trois"].includes(t.lower)) {
                let j = k + 1;
                if (["la", "le", "les", "l'"].includes(tokens[j]?.lower)) {
                    j++;
                }
                return !!tokens[j] && TIME_NOUNS.has(tokens[j].lower.replace(/s$/, ""));
            }
            return t.lower === "il" && tokens[k + 1]?.lower === "y" && ["a", "avait"].includes(tokens[k + 2]?.lower);
        }

        // Participe passé des verbes pronominaux : « Elles se sont lavé » → lavées.
        function rulePronominalParticiple(tokens, i, push, vetoes) {
            const entry = participleEntry(tokens[i]);
            if (!entry || !hasConj) {
                return;
            }
            let k = i - 1;
            while (k >= 0 && NEGATIONS.has(tokens[k].lower)) {
                k--;
            }
            if (k < 1 || !BE_FORMS.has(tokens[k].lower) || !REFLEXIVES.has(tokens[k - 1].lower)) {
                return;
            }
            let s = k - 2;
            if (s >= 0 && ["ne", "n'"].includes(tokens[s].lower)) {
                s--;
            }
            const agreement = subjectAgreement(tokens, s);
            if (!agreement) {
                return;
            }
            const lemma = lemmaOf(entry);
            const vtyp = conj.getVtyp(lemma) || "";
            const [gender, number] = agreement.split(":");
            const formTags = /:([mfe]):([spi])/.exec(entry) ?? [];
            if (INDIRECT_PRONOMINAL.has(lemma)) {
                // Sujet personnel au pluriel : réciproque (« elles se sont parlé »).
                if (["ils", "elles", "nous", "vous"].includes(tokens[s].lower)) {
                    vetoes.push({ start: tokens[i].start, end: tokens[i].end });
                    const invariable = conj.getConj(lemma, ":Q", ":m:s");
                    if (invariable && invariable !== tokens[i].lower) {
                        push(tokens[i], tokens[i].end, invariable, MESSAGES.invariable, "ppas_invariable", "accord");
                    }
                }
                return;
            }
            // « Elle s'est coupée les cheveux », « ils se sont lavés les mains » : le complément direct est
            // après, le participe reste invariable.
            const after = tokens[i + 1];
            const agreed = formTags[1] === "f" || formTags[2] === "p";
            const directDet = after && ["un", "une", "mon", "ton", "son", "ma", "ta", "sa", "mes", "tes", "ses", "notre", "votre", "nos", "vos", "leur", "leurs", "ce", "cet", "cette", "ces"].includes(after.lower)
                && tokens[i + 2] && noun(tokens[i + 2], null) && !isTimeComplement(tokens, i + 1);
            const bodyPart = after && ["les", "la", "le", "l'"].includes(after.lower) && BODY_PARTS.has(tokens[i + 2]?.lower ?? "");
            if (agreed && /^.{3}t/.test(vtyp) && (directDet || bodyPart)) {
                const invariable = conj.getConj(lemma, ":Q", ":m:s");
                vetoes.push({ start: tokens[i].start, end: tokens[i].end });
                if (invariable && invariable !== tokens[i].lower) {
                    push(tokens[i], tokens[i].end, invariable, MESSAGES.codApres, "ppas_cod_apres", "accord");
                }
                return;
            }
            // « nous nous sommes attaché à démontrer » : « nous » d'auteur, peut-être singulier.
            if (tokens[s].lower === "nous" && tokens[i + 1] && !tokens[i + 1].punct && !isTimeComplement(tokens, i + 1)) {
                return;
            }
            // « Elle s'était promise de revenir » → promis : « se » est complément indirect.
            if (["promettre", "permettre", "jurer", "imposer", "interdire"].includes(lemma) && ["de", "d'"].includes(tokens[i + 1]?.lower) && (formTags[1] === "f" || formTags[2] === "p")) {
                const invariable = conj.getConj(lemma, ":Q", ":m:s");
                vetoes.push({ start: tokens[i].start, end: tokens[i].end });
                if (invariable && invariable !== tokens[i].lower) {
                    push(tokens[i], tokens[i].end, invariable, MESSAGES.promis, "ppas_invariable", "accord");
                }
                return;
            }
            if ((vtyp[5] !== "p" && vtyp[3] !== "t") || OFTEN_INDIRECT.has(lemma)) {
                return;
            }
            if (s > 0 && ["que", "qu'"].includes(tokens[s - 1].lower)) {
                return;  // « la prise qu'il s'était faite » : accord avec « que », placé avant
            }
            // Un complément après le participe (« lavé les mains », « fait avoir », « rendu compte ») :
            // le pronom n'est peut-être pas complément direct. On ne dit rien.
            const next = tokens[i + 1];
            const quiet = !next || (next.punct && !/[:«"“]/.test(next.text)) || PREPOSITIONS.has(next.lower) || (isAdverb(next) && !has(next, /:[ND]/)) || isTimeComplement(tokens, i + 1)
                || (["tout", "toute", "tous", "toutes"].includes(next.lower) && /^seul/.test(tokens[i + 2]?.lower ?? ""));
            if (!quiet) {
                return;
            }
            const wantPlural = number === "p";
            const isPlural = formTags[2] === "p";
            const isFeminine = formTags[1] === "f";
            if (isPlural === wantPlural && (gender === "?" || isFeminine === (gender === "f"))) {
                return;
            }
            const genders = gender === "?" ? ["m", "f"] : [gender];
            const forms = genders.map((g) => conj.getConj(lemma, ":Q", `:${g}:${number}`) || conj.getConj(lemma, ":Q", ":m:s")).filter(Boolean);
            if (forms.length && !forms.includes(tokens[i].lower)) {
                push(tokens[i], tokens[i].end, forms, MESSAGES.accord, "ppas_pronominal", "accord");
            }
        }

        const personOf = (entry) => /:([123][sp])/.exec(entry)?.[1];
        const futureEntry = (token) => morph(token).find((m) => /:V[^/]*:If/.test(m) && !/:K/.test(m));
        const isImperfect = (token) => has(token, /:V[^/]*:Iq/);

        // « Si j'avais su, je serai venu » → serais ; « Je viendrai si j'avais le temps » → viendrais.
        function ruleConcordance(tokens, push) {
            for (let i = 0; i < tokens.length; i++) {
                if (!SI_WORDS.has(tokens[i].lower) || (tokens[i].lower === "s'" && !["il", "ils"].includes(tokens[i + 1]?.lower))) {
                    continue;
                }
                if (i > 0 && !clauseStart(tokens, i) && !["même", "et", "mais"].includes(tokens[i - 1].lower)) {
                    // « si » au milieu d'une proposition : peut-être « je me demande si… ».
                    if (!tokens.slice(0, i).some((t) => futureEntry(t))) {
                        continue;
                    }
                }
                // L'imparfait doit suivre de près (« si j'avais », « si tu venais »).
                let end = i + 1;
                while (end < tokens.length && !(tokens[end].punct && tokens[end].text !== "'")) {
                    end++;
                }
                const clause = tokens.slice(i + 1, Math.min(end, i + 6));
                if (!clause.some(isImperfect) || clause.some((t) => futureEntry(t))) {
                    continue;
                }
                // Proposition principale : après la virgule, ou avant « si ».
                const sentenceEnd = tokens.findIndex((t, k) => k > end && /[.!?…;]/.test(t.text));
                const before = !(clauseStart(tokens, i) && tokens[end]?.text === ",");
                const candidates = before
                    ? tokens.slice(0, i).reverse().slice(0, 8)
                    : tokens.slice(end + 1, sentenceEnd < 0 ? tokens.length : sentenceEnd);
                const verb = candidates.find((t) => futureEntry(t));
                if (!verb) {
                    continue;
                }
                // Principale avant « si » : seulement le futur antérieur (« je serai venu si j'avais su »).
                // « Je te dirai si ça marchait » est une question indirecte, juste.
                if (before) {
                    const after = tokens[tokens.indexOf(verb) + 1];
                    if (!["être", "avoir"].includes(lemmaOf(futureEntry(verb))) || !after || !isParticiple(after)) {
                        continue;
                    }
                }
                const entry = futureEntry(verb);
                const lemma = lemmaOf(entry);
                const person = personOf(entry);
                const conditional = hasConj && person ? conj.getConj(lemma, ":K", `:${person}`) : null;
                if (conditional && conditional !== verb.lower) {
                    push(verb, verb.end, conditional, MESSAGES.concordance, "si_conditionnel", "concordance");
                }
            }
        }

        // « tout fières » → toutes fières ; « tout émue » reste juste (voyelle).
        function ruleTout(tokens, i, push) {
            const next = tokens[i + 1];
            if (endOrPunct(next) || VOWEL_START.test(next.lower)) {
                return;
            }
            const forms = morph(next).filter((m) => /:[AQ]/.test(m));
            if (!forms.length || !forms.every((m) => /:f:[sp]/.test(m))) {
                return;
            }
            if (i > 0 && (DET_SING.has(tokens[i - 1].lower) || DET_PLUR.has(tokens[i - 1].lower) || ["du", "rien"].includes(tokens[i - 1].lower))) {
                return;  // « le tout petit », « pas du tout claire »
            }
            const plural = forms.every((m) => /:f:p/.test(m));
            push(tokens[i], tokens[i].end, plural ? "toutes" : "toute", MESSAGES.tout, "tout_adverbe", "accord");
        }

        const AVOIR_FORMS = new Set(["ai", "as", "a", "avons", "avez", "ont", "avais", "avait", "avions", "aviez", "avaient", "aurai", "auras", "aura", "aurons", "aurez", "auront", "aurais", "aurait", "aurions", "auriez", "auraient", "aie", "aies", "ait", "ayons", "ayez", "aient", "eus", "eut", "eurent"]);
        const QUOI_QUE_VERBS = new Set(["faire", "dire", "penser", "arriver", "advenir", "décider", "choisir", "vouloir", "demander", "entreprendre", "proposer", "répondre", "raconter", "prétendre", "écrire"]);
        const PLACE_FOLLOWERS = new Set(["depuis", "dans", "sur", "avec", "en", "à", "au", "aux", "pour", "devant", "derrière", "chez", "aussi", "encore", "déjà", "toujours", "maintenant", "ce", "cette", "hier", "demain", "aujourd'hui", "tout", "non", "bas", "haut", "dedans", "dehors"]);
        const qForm = (lemma, gender, number) => (hasConj ? conj.getConj(lemma, ":Q", `:${gender}:${number}`) || conj.getConj(lemma, ":Q", ":m:s") : null);

        // Accord d'un participe placé après « avoir » ; renvoie l'entrée :Q du participe.
        const participleTags = (token) => /:([mfe]):([spi])/.exec(participleEntry(token) ?? "") ?? [];

        function moreRules(tokens, i, push, vetoes = []) {
            const token = tokens[i];
            const next = tokens[i + 1];
            const prev = tokens[i - 1];
            // 0a. « bonjours, Marc ! » → bonjour : salutation en début de phrase, suivie d'une
            // ponctuation, d'un nom propre ou de la fin. « de gros bonjours » reste.
            if ((token.lower === "bonjours" || token.lower === "bonsoirs") && (!prev || /[.!?…:;«"(]/.test(prev.text))
                && (!next || next.punct || /^\p{Lu}/u.test(next.text))) {
                push(token, token.end, token.text.slice(0, -1), MESSAGES.bonjour, "bonjour", "orthographe");
            }
            // 0c. « 12Go » → 12 Go ; « 10€ » → 10 €.
            const unit = GLUED_UNIT.exec(token.text);
            if (unit) {
                const fixed = `${unit[1]} ${unit[2]}`;
                push(token, token.end, fixed, `${MESSAGES.unite} : « ${fixed} ».`, "nombre_colle", "typographie");
            }
            const month = GLUED_MONTH.exec(token.text);
            if (month) {
                const fixed = `${month[1]} ${month[2]}`;
                push(token, token.end, fixed, `${MESSAGES.nombre} : « ${fixed} ».`, "nombre_colle", "typographie");
            }
            // « Je vous prit de… », « je te pris de » → prie.
            if (["pris", "prit", "pries", "prient"].includes(token.lower) && ["te", "vous"].includes(prev?.lower) && ["je", "j'"].includes(tokens[i - 2]?.lower) && ["de", "d'"].includes(next?.lower)) {
                push(token, token.end, "prie", MESSAGES.prie, "je_vous_prie", "conjugaison");
            }
            // « Il sans est allé », « il ne sans souvient plus » → s'en.
            if (token.lower === "sans" && prev && (["il", "elle", "on", "ils", "elles", "ne", "n'"].includes(prev.lower)) && next && has(next, /:V[^/]*:(Ip|Iq|If|K|Is|Sp)/) && (!has(next, /:[NA]/) || BE_FORMS.has(next.lower))) {
                push(token, token.end, "s'en", MESSAGES.sen, "sans_sen", "homophone");
            }
            // « parti s'en prévenir personne » → sans : « s'en » devant un infinitif qui n'est pas pronominal.
            if (token.lower === "s'" && next?.lower === "en" && tokens[i + 2] && has(tokens[i + 2], /:Y/) && !S_EN_VERBS.has(tokens[i + 2].lower)
                && prev && (isParticiple(prev) || prev.text === ",") && !morph(prev).some((m) => /:V/.test(m) && INFINITIVE_VERBS.has(lemmaOf(m)))) {
                push(token, next.end, "sans", MESSAGES.sans, "sen_sans", "homophone");
            }
            // « Tu peux venir voire le match » → voir.
            if (token.lower === "voire" && next && (ALL_DETS.has(next.lower) || /^\p{Lu}/u.test(next.text)) && prev
                && (morph(prev).some((m) => /:V/.test(m) && (INFINITIVE_VERBS.has(lemmaOf(m)) || ["venir", "aller", "falloir", "vouloir", "pouvoir", "devoir", "savoir", "faire", "laisser", "aimer", "adorer", "préférer"].includes(lemmaOf(m)))) || ["pour", "de", "d'", "à", "sans"].includes(prev.lower))) {
                push(token, token.end, "voir", MESSAGES.voirInf, "voire_voir", "homophone");
            }
            // « Elle est toute étonnée » → tout (devant une voyelle, « tout » adverbe reste invariable).
            if (token.lower === "toute" && next && VOWEL_START.test(next.lower) && !/^h/.test(next.lower) && has(next, /:[AQ]/) && !has(next, /:N/) && prev && (BE_FORMS.has(prev.lower) || ATTRIBUTE_ADVERBS.has(prev.lower))) {
                push(token, token.end, "tout", MESSAGES.toutVoyelle, "toute_tout", "accord");
            }
            // « plus tôt bien » → plutôt ; « partir plutôt pour éviter » → plus tôt.
            if (token.lower === "plus" && next?.lower === "tôt" && prev?.lower !== "le" && tokens[i + 2] && tokens[i + 2].lower !== "possible" && (["bien", "mal", "content", "contente", "contents", "contentes", "facile", "difficile", "bon", "bonne", "sympa", "rare", "rapide", "lent", "lente"].includes(tokens[i + 2].lower) || (isPureAdjective(tokens[i + 2]) && !has(tokens[i + 2], /:N/)))) {
                push(token, next.end, "plutôt", MESSAGES.plutot, "plus_tot_plutot", "homophone");
            }
            if (token.lower === "plutôt" && prev && morph(prev).some((m) => /:V/.test(m) && EARLY_VERBS.has(lemmaOf(m))) && (endOrPunct(next) || ["pour", "afin", "que", "qu'", "le", "la", "ce", "cette", "demain", "ce"].includes(next.lower)) && !(["que", "qu'"].includes(next?.lower) && /^(de|d')/.test(tokens[i + 2]?.lower ?? ""))) {
                push(token, token.end, "plus tôt", MESSAGES.plusTot, "plutot_plus_tot", "homophone");
            }
            // « Quelque soit ta décision » → Quelle que soit.
            if (token.lower === "quelque" && ["soit", "soient", "fût", "fussent", "puisse", "puissent", "sera", "serait"].includes(next?.lower)) {
                const group = tokens[i + 2] && ALL_DETS.has(tokens[i + 2].lower) ? tokens[i + 3] : tokens[i + 2];
                const nounMorph = group ? morph(group).filter((m) => /:N/.test(m)) : [];
                const feminine = nounMorph.length && nounMorph.every((m) => /:f/.test(m));
                const plural = /nt$/.test(next.lower);
                const form = `quel${feminine ? "le" : ""}${plural ? "s" : ""} que`;
                push(token, token.end, form, MESSAGES.quelQue, "quelque_quel_que", "homophone");
            }
            // « Elle ma appelé » → m'a ; « il ta laissé » → t'a.
            if (["ma", "ta"].includes(token.lower) && next && isParticiple(next) && !morph(next).some((m) => /:N/.test(m) && /:f/.test(m)) && prev && (SUBJECTS.has(prev.lower) || ["ne", "n'", "qui"].includes(prev.lower) || nounPhraseBefore(tokens, i, null))) {
                push(token, token.end, token.lower === "ma" ? "m'a" : "t'a", token.lower === "ma" ? MESSAGES.ma : MESSAGES.ta, "ma_ma", "homophone");
            }
            // « Je lai vu » → l'ai.
            if (token.lower === "lai" && prev && ["je", "j'"].includes(prev.lower) && next && (isParticiple(next) || has(next, /:W/))) {
                push(token, token.end, "l'ai", MESSAGES.lai, "lai_lai", "homophone");
            }
            // « Mais amis arrivent » → Mes ; « essayé, mes ça ne marche pas » → mais.
            if (token.lower === "mais" && clauseStart(tokens, i) && next && morph(next).some((m) => /:N/.test(m) && /:p/.test(m)) && !has(next, /:[VG]/) && tokens[i + 2] && has(tokens[i + 2], /:V[^/]*:(Ip|Iq|If|K)/) && !has(tokens[i + 2], /:[NA]/)) {
                push(token, token.end, "mes", MESSAGES.mesDet, "mais_mes", "homophone");
            }
            if (token.lower === "mes" && next && (SUBJECTS.has(next.lower) || ["c'", "on", "ça", "il", "pourtant", "bon", "non", "si"].includes(next.lower))) {
                push(token, token.end, "mais", MESSAGES.mes, "mes_mais", "homophone");
            }
            // « Il a perdu c'est clés » → ses.
            if (token.lower === "c'" && next?.lower === "est" && tokens[i + 2] && morph(tokens[i + 2]).some((m) => /:N/.test(m) && /:p/.test(m)) && !has(tokens[i + 2], /:[AQVW]/) && prev && has(prev, /:[QV]/) && !clauseStart(tokens, i)) {
                push(token, next.end, "ses", MESSAGES.ses, "cest_ses", "homophone");
            }
            // « Il ne si attendait pas » → s'y.
            if (token.lower === "si" && prev && ["ne", "n'", "il", "elle", "on", "ils", "elles"].includes(prev.lower) && next && has(next, /:V[^/]*:(Ip|Iq|If|K|Is)/) && !has(next, /:[NAW]/)) {
                push(token, token.end, "s'y", MESSAGES.sy, "si_sy", "homophone");
            }
            // « Quand j'étais petit, je jouai souvent » → jouais : habitude passée.
            if (prev && ["je", "j'"].includes(prev.lower) && /ai$/.test(token.lower) && hasConj) {
                const entry = morph(token).find((m) => /:V[^/]*:Is:1s/.test(m));
                // Repère d'habitude dans la même proposition (« je jouais souvent », « chaque été »),
                // ou « Quand j'étais petit, … » en tête de phrase.
                let from = i - 1;
                while (from > 0 && !tokens[from - 1].punct && from > i - 6) {
                    from--;
                }
                let to = i + 1;
                while (to < tokens.length && !tokens[to].punct && to < i + 4) {
                    to++;
                }
                const near = tokens.slice(from, to).map((t) => t.lower);
                const habit = near.some((w, k) => HABIT_WORDS.has(w) || (["chaque", "tous"].includes(w) && TIME_NOUNS.has((near[k + 1] === "les" ? near[k + 2] : near[k + 1])?.replace(/s$/, "") ?? "")))
                    || (["quand", "lorsque", "lorsqu'"].includes(tokens[0]?.lower) && tokens.slice(1, 5).some((t) => ["étais", "étions"].includes(t.lower)) && tokens.slice(2, 6).some((t) => ["petit", "petite", "petits", "jeune", "jeunes", "enfant", "enfants", "gamin", "gamine", "ado"].includes(t.lower)));
                if (entry && habit && !has(token, /:V[^/]*:(Ip|If)/)) {
                    const form = conj.getConj(lemmaOf(entry), ":Iq", ":1s");
                    if (form && form !== token.lower) {
                        push(token, token.end, form, MESSAGES.imparfait, "passe_simple_imparfait", "conjugaison");
                    }
                }
            }
            // « Demain, je viendrais » → viendrai ; « J'aimerai bien un café » → aimerais.
            if (prev && ["je", "j'"].includes(prev.lower) && /rai?s?$/.test(token.lower) && hasConj) {
                const conditional = morph(token).find((m) => /:V[^/]*:K:1s/.test(m));
                const future = morph(token).find((m) => /:V[^/]*:If:1s/.test(m));
                const words = tokens.map((t) => t.lower);
                const futureMarker = words.some((w) => FUTURE_WORDS.has(w)) && !words.some((w) => ["si", "s'"].includes(w));
                if (conditional && futureMarker && !WISH_LEMMAS.has(lemmaOf(conditional))) {
                    const form = conj.getConj(lemmaOf(conditional), ":If", ":1s");
                    if (form && form !== token.lower) {
                        push(token, token.end, form, MESSAGES.futur, "conditionnel_futur", "conjugaison");
                    }
                }
                if (future && WISH_LEMMAS.has(lemmaOf(future)) && !futureMarker && ["bien", "un", "une", "des", "du", "vous", "te", "savoir", "avoir"].concat([]).some((w) => w === next?.lower || has(next, /:Y/))) {
                    const form = conj.getConj(lemmaOf(future), ":K", ":1s");
                    if (form && form !== token.lower) {
                        push(token, token.end, form, MESSAGES.conditionnel, "futur_conditionnel", "conjugaison");
                    }
                }
            }
            // « des articles très intéressant » → intéressants : adjectif après un adverbe.
            if (prev && ["très", "trop", "assez", "vraiment", "particulièrement", "extrêmement"].includes(prev.lower) && isPureAdjective(token) && !has(token, /:[NQ]/) && i >= 3) {
                const nounToken = tokens[i - 2];
                const start = simpleNounPhrase(tokens, i - 1, null);
                // « rend la marche à ces endroits très agréable » : attribut d'un autre mot. On s'en tient
                // au pluriel oublié après un nom pluriel, sans verbe d'opinion avant, en fin de groupe.
                const opinion = tokens.slice(0, start).some((t) => morph(t).some((m) => /:V/.test(m) && ["rendre", "trouver", "juger", "estimer", "considérer", "croire", "penser", "trouver"].includes(lemmaOf(m))));
                const groupEnds = endOrPunct(next) || PREPOSITIONS.has(next.lower) || ["et", "mais", "ou", "qui", "que", "sur"].includes(next.lower);
                if (start >= 0 && noun(nounToken, null) && PLURAL_DETS.has(tokens[start].lower) && !TIME_NOUNS.has(nounToken.lower) && !TIME_NOUNS.has(nounToken.lower.replace(/s$/, "")) && !opinion && groupEnds && !morph(token).some((m) => /:A/.test(m) && /:[pi]/.test(m))) {
                    const nounMorph = morph(nounToken).filter((m) => /:N/.test(m));
                    const gender = nounMorph.every((m) => /:f/.test(m)) ? "f" : nounMorph.every((m) => /:m/.test(m)) ? "m" : null;
                    const number = DET_PLUR.has(tokens[start].lower) ? "p" : DET_SING.has(tokens[start].lower) ? "s" : null;
                    if (gender && number && !morph(token).some((m) => /:A/.test(m) && new RegExp(`:[${gender}e]:[${number}i]`).test(m))) {
                        const form = inflectAdjective(token, gender, number);
                        if (form && form !== token.lower) {
                            push(token, token.end, form, `${MESSAGES.adjectifAdverbe} : « ${form} ».`, "accord_adjectif_adverbe", "accord");
                        }
                    }
                }
            }
            // « nous-même » → nous-mêmes.
            if (["nous-même", "eux-même", "elles-même"].includes(token.lower)) {
                push(token, token.end, `${token.lower}s`, MESSAGES.memes, "memes", "accord");
            }
            // « aucunes raison » → aucune.
            if (["aucuns", "aucunes"].includes(token.lower) && next && morph(next).some((m) => /:N/.test(m) && /:s/.test(m)) && !morph(next).some((m) => /:N/.test(m) && /:p/.test(m))) {
                push(token, token.end, token.lower.slice(0, -1), MESSAGES.aucun, "aucun_pluriel", "accord");
            }
            // « Il parle Anglais » → anglais.
            if (LANGUAGES.has(token.lower) && /^\p{Lu}/u.test(token.text) && !clauseStart(tokens, i) && prev && (morph(prev).some((m) => /:V/.test(m) && LANGUAGE_VERBS.has(lemmaOf(m))) || (["le", "l'", "en"].includes(prev.lower) && morph(tokens[i - 2] ?? prev).some((m) => /:V/.test(m) && LANGUAGE_VERBS.has(lemmaOf(m)))))) {
                push(token, token.end, token.lower, MESSAGES.langue, "langue_minuscule", "majuscule");
                lastResult().suggestions = [token.lower];
            }
            // « C'est nous qui ont raison » → avons.
            if (token.lower === "qui" && ["nous", "vous", "toi", "moi"].includes(prev?.lower) && tokens[i - 2]?.lower === "est" && tokens[i - 3]?.lower === "c'" && next && hasConj) {
                const person = { nous: ":1p", vous: ":2p", toi: ":2s", moi: ":1s" }[prev.lower];
                const entry = finiteEntryLoose(next);
                if (entry && !has(next, new RegExp(`:V[^/]*${person}`))) {
                    const forms = personForms(entry, person, next.lower, tokens, i + 1);
                    if (forms.length) {
                        push(next, next.end, forms, `${MESSAGES.cestQui} (${prev.lower}) : « ${forms[0]} ».`, "cest_qui", "conjugaison");
                    }
                }
            }
            // « Quelle chance nous avons eu ! » → eue.
            if (QUEL.has(token.lower) && clauseStart(tokens, i) && next && noun(next, null) && hasConj) {
                let k = i + 2;
                // Le sujet doit aller avec l'auxiliaire (« quelle mouche nous a piqués » : « nous » est complément).
                const AVOIR_BY_SUBJECT = { je: "ai", "j'": "ai", tu: "as", il: "a", elle: "a", on: "a", nous: "avons", vous: "avez", ils: "ont", elles: "ont" };
                if (AVOIR_BY_SUBJECT[tokens[k]?.lower]) {
                    if (tokens[k + 1]?.lower !== AVOIR_BY_SUBJECT[tokens[k].lower]) {
                        return;
                    }
                    k++;
                }
                const aux = tokens[k];
                const pp = tokens[k + 1];
                const entry = pp && participleEntry(pp);
                if (aux && AVOIR_FORMS.has(aux.lower.split("-")[0]) && entry && /^.{3}t/.test(conj.getVtyp(lemmaOf(entry)) || "")) {
                    const nounMorph = morph(next).filter((m) => /:N/.test(m));
                    const gender = nounMorph.every((m) => /:f/.test(m)) ? "f" : nounMorph.every((m) => /:m/.test(m)) ? "m" : null;
                    const number = /s$/.test(token.lower) ? "p" : "s";
                    const [, g, n] = participleTags(pp);
                    if (gender && !((g === gender || g === "e") && (n === number || n === "i"))) {
                        const form = qForm(lemmaOf(entry), gender, number);
                        if (form && form !== pp.lower) {
                            push(pp, pp.end, form, MESSAGES.quelExclamatif, "ppas_quel", "accord");
                        }
                    }
                }
            }
            // « Cette erreur, je l'ai vu trop tard » → vue : « l' » reprend le nom détaché en tête.
            if (token.lower === "l'" && next && AVOIR_FORMS.has(next.lower) && tokens[i + 2] && participleEntry(tokens[i + 2]) && hasConj) {
                const comma = tokens.findIndex((t) => t.text === ",");
                const groupEnd = comma > 0 ? nounGroupEnd(tokens, 0) : -1;
                if (groupEnd === comma) {
                    let head = groupEnd - 1;
                    while (head > 0 && !has(tokens[head], /:N/)) {
                        head--;
                    }
                    const nounMorph = morph(tokens[head]).filter((m) => /:N/.test(m));
                    const gender = nounMorph.length && nounMorph.every((m) => /:f/.test(m)) ? "f" : nounMorph.length && nounMorph.every((m) => /:m/.test(m)) ? "m" : null;
                    const number = DET_SING.has(tokens[0].lower) ? "s" : null;
                    const pp = tokens[i + 2];
                    const [, g, n] = participleTags(pp);
                    if (gender && number && !((g === gender || g === "e") && (n === number || n === "i"))) {
                        const form = qForm(lemmaOf(participleEntry(pp)), gender, number);
                        if (form && form !== pp.lower) {
                            push(pp, pp.end, form, `${MESSAGES.lAvant} « ${tokens.slice(0, head + 1).map((t) => t.text).join(" ")} » est placé avant : le participe s'accorde avec lui.`, "ppas_l_avant", "accord");
                        }
                    }
                }
            }
            // « Ci tu veux » → Si.
            if (token.lower === "ci" && clauseStart(tokens, i) && next && (SUBJECTS.has(next.lower) || ["on", "c'", "ça"].includes(next.lower))) {
                push(token, token.end, "si", MESSAGES.si, "ci_si", "homophone");
            }
            // « Nous somme » → sommes.
            if (token.lower === "somme" && prev?.lower === "nous" && clauseStart(tokens, i - 1)) {
                push(token, token.end, "sommes", `${MESSAGES.personneVerbe} : « nous sommes ».`, "nous_verbe", "conjugaison");
            }
            // « Pensez à vérifié » → vérifier : « à » + infinitif après penser, commencer, réussir…
            if (token.lower === "à" && prev && next && morph(prev.text.includes("-") ? { text: prev.text.split("-")[0], punct: false } : prev).some((m) => /:V/.test(m) && A_INFINITIVE_VERBS.has(lemmaOf(m)))) {
                let k = i + 1;
                while (tokens[k] && PRONOUNS_BEFORE_VERB.has(tokens[k].lower) && k < i + 3) {
                    k++;
                }
                const verb = tokens[k];
                const entry = verb && participleEntry(verb);
                if (entry && /er$/.test(lemmaOf(entry)) && /é(e|s|es)?$/.test(verb.lower) && !has(verb, /:[YN]/)) {
                    push(verb, verb.end, lemmaOf(entry), MESSAGES.infinitifA, "infinitif_apres_a", "infinitif");
                    vetoes.push({ start: token.start, end: verb.end, rule: /conf_a_à|infi/ });
                }
            }
            // « J'ai mis à jour les règles et redémarrer le routeur » → redémarré : participe coordonné.
            if (["et", "puis"].includes(prev?.lower) && has(token, /:Y/) && /er$/.test(token.lower) && hasConj && !has(token, /:N/)) {
                let k = i - 2;
                let found = null;
                while (k >= 0 && !/[.!?;]/.test(tokens[k].text)) {
                    if (AVOIR_FORMS.has(tokens[k].lower) && has(tokens[k + 1], /:V/) && !has(tokens[k + 1], /:Y/)) {
                        found = tokens[k + 1];
                        break;
                    }
                    if ((has(tokens[k], /:Y/) && !has(tokens[k], /:N/)) || morph(tokens[k]).some((m) => /:V/.test(m) && INFINITIVE_VERBS.has(lemmaOf(m)))) {
                        break;  // un infinitif plus tôt : « pour vérifier et redémarrer » est juste
                    }
                    k--;
                }
                const foundLemma = found && lemmaOf(participleEntry(found) ?? morph(found).find((m) => /:V/.test(m)));
                if (found && !TAKES_INFINITIVE.has(foundLemma)) {
                    const pp = conj.getConj(token.lower, ":Q", ":m:s");
                    if (pp && pp !== token.lower) {
                        push(token, token.end, pp, MESSAGES.coordonne, "participe_coordonne", "infinitif");
                    }
                }
            }
            // « Est-ce-que » → Est-ce que.
            if (token.lower === "est-ce-que") {
                push(token, token.end, "est-ce que", MESSAGES.estceque, "est_ce_que", "orthographe");
            }
            // « tous à fait », « toute à fait » → tout à fait.
            if (["tous", "toute", "toutes"].includes(token.lower) && next?.lower === "à" && tokens[i + 2]?.lower === "fait") {
                push(token, token.end, "tout", MESSAGES.toutafait, "tout_a_fait", "accord");
            }
            // « mes coordonnés » → coordonnées.
            if (token.lower === "coordonnés" && prev && ["les", "mes", "tes", "ses", "nos", "vos", "leurs", "vos", "des", "ces"].includes(prev.lower) && !["par", "avec", "entre"].includes(next?.lower)) {
                push(token, token.end, "coordonnées", MESSAGES.coordonnees, "coordonnees", "orthographe");
            }
            // « Quelle vienne ou non » → Qu'elle : en tête de phrase, devant un subjonctif.
            if (QUEL.has(token.lower) && clauseStart(tokens, i) && next && has(next, /:V[^/]*:Sp/) && !has(next, /:V[^/]*:(Ip|Iq)/) && !has(next, /:[NA]/)) {
                push(token, token.end, /s$/.test(token.lower) ? "qu'elles" : "qu'elle", MESSAGES.quelleSubj, "quel_quelle");
            }
            if (/^\d+$/.test(token.text) && next?.text === "€" && next.start === token.end) {
                push(token, next.end, `${token.text} €`, `${MESSAGES.unite} : « ${token.text} € ».`, "nombre_colle", "typographie");
            }
            // 0d. « Personnes ne les réussissait » → Personne ne.
            if (token.lower === "personnes" && clauseStart(tokens, i) && ["ne", "n'"].includes(next?.lower)) {
                push(token, token.end, "personne", MESSAGES.personne, "personne_ne", "accord");
            }
            // 0e. « tu vas l'adorée », « je peux le changé » → l'adorer, le changer.
            if (hasConj && has(token, /:V[^/]*:(Ip|Iq|If|K)/) && morph(token).some((m) => INFINITIVE_VERBS.has(lemmaOf(m)) && /:V/.test(m))) {
                let k = i + 1;
                while (tokens[k] && PRONOUNS_BEFORE_VERB.has(tokens[k].lower) && k < i + 3) {
                    k++;
                }
                const verb = tokens[k];
                const entry = verb && k > i + 1 && participleEntry(verb);
                // « ils voulaient les damnés » : après vouloir, devoir ou pouvoir, « le », « la », « les »
                // suivis d'un nom sont un complément (pas de nom possible directement après « aller »).
                const isAller = morph(token).some((m) => lemmaOf(m) === "aller");
                const article = ["le", "la", "les", "l'"].includes(tokens[k - 1]?.lower) && has(verb, /:N/);
                if (entry && (isAller || !article) && /er$/.test(lemmaOf(entry)) && /é(e|s|es)?$/.test(verb.lower) && !has(verb, /:Y/)) {
                    push(verb, verb.end, lemmaOf(entry), MESSAGES.infinitif, "infinitif_apres_aller", "infinitif");
                }
            }
            // 0f. « Nous avons reçu votre demande et nous reviendront » → reviendrons : « nous » sujet
            // après « et » ou « mais », quand la phrase a déjà « nous » sujet d'un verbe à la 1re personne.
            if ((token.lower === "nous" || token.lower === "vous") && ["et", "mais", "puis"].includes(prev?.lower) && next && hasConj) {
                const person = token.lower === "nous" ? ":1p" : ":2p";
                const earlier = tokens.slice(0, i - 1).some((t, j) => t.lower === token.lower && has(tokens[j + 1], new RegExp(`:V[^/]*${person}`)));
                const verbEntry = morph(next).find((m) => /:V[^/]*:(Ip|Iq|If|K)/.test(m));
                if (earlier && verbEntry && !has(next, new RegExp(`:V[^/]*${person}`)) && !has(next, /:[NAW]/)) {
                    const tense = /:(Ip|Iq|If|K)/.exec(verbEntry)[0];
                    const form = conj.getConj(lemmaOf(verbEntry), tense, person);
                    if (form && form !== next.lower) {
                        push(next, next.end, form, `${MESSAGES.personneVerbe} : « ${token.lower} ${form} ».`, `${token.lower}_verbe`, "conjugaison");
                    }
                }
            }
            // 0b. « 21an » → 21 ans.
            const glued = GLUED_NUMBER.exec(token.text);
            if (glued) {
                const count = Number(glued[1]);
                const noun = glued[2];
                const plural = count >= 2 && !INVARIABLE_PLURAL.test(noun);
                const singular = count < 2 && /s$/i.test(noun) && !/^(mois|fois)$/i.test(noun);
                const fixed = `${glued[1]} ${plural ? `${noun}s` : singular ? noun.slice(0, -1) : noun}`;
                push(token, token.end, fixed, `${MESSAGES.nombre}${plural ? MESSAGES.nombrePluriel : singular ? MESSAGES.nombreSingulier : ""} : « ${fixed} ».`, "nombre_colle", "typographie");
            }
            // 1. « Tant qu'à moi » → Quant à moi ; « tant qu'à faire » (+ infinitif) reste.
            if (token.lower === "tant" && next?.lower === "qu'" && tokens[i + 2]?.lower === "à") {
                const after = tokens[i + 3];
                // « tant qu'à faire », « tant qu'à y être » (infinitif, éventuellement précédé d'un pronom) restent.
                if (after && !after.punct && !has(after, /:Y/) && !OBJECT_PRONOUNS.has(after.lower)) {
                    push(token, tokens[i + 2].end, "quant à", MESSAGES.quanta, "tant_qua", "homophone");
                }
            }
            // 2. « Quoique tu fasses, … » → Quoi que ; « quoiqu'il soit malade » (= bien que) reste.
            if (["quoique", "quoiqu'"].includes(token.lower)) {
                let k = i + 1;
                if (token.lower === "quoique" && SUBJECTS.has(tokens[k]?.lower)) {
                    k++;
                } else if (token.lower === "quoiqu'" && ["il", "ils", "elle", "elles", "on"].includes(tokens[k]?.lower)) {
                    k++;
                } else {
                    return;
                }
                const verb = tokens[k];
                const entry = verb && morph(verb).find((m) => /:V[^/]*:S[pq]/.test(m));
                if (entry && QUOI_QUE_VERBS.has(lemmaOf(entry)) && endOrPunct(tokens[k + 1])) {
                    push(token, token.end, token.lower === "quoique" ? "quoi que" : "quoi qu'", MESSAGES.quoique, "quoique_quoi_que", "homophone");
                }
            }
            // 3. « Si non, on reporte » → Sinon.
            if (token.lower === "si" && next?.lower === "non" && clauseStart(tokens, i) && tokens[i + 2]?.text === ",") {
                push(token, next.end, "sinon", MESSAGES.sinon, "si_non", "homophone");
            }
            // 4. « Il est la depuis ce matin » → là ; « c'est la que » → là ; « il est la meilleure » reste.
            if (token.lower === "la" && i > 0 && (BE_FORMS.has(tokens[i - 1].lower) || ["voilà", "voici"].includes(tokens[i - 1].lower))) {
                const quiet = endOrPunct(next) || PLACE_FOLLOWERS.has(next.lower)
                    || (["que", "qu'"].includes(next.lower) && tokens[i - 2]?.lower === "c'");
                if (quiet && !(next && has(next, /:[NA]/) && !PLACE_FOLLOWERS.has(next.lower) && !endOrPunct(next))) {
                    push(token, token.end, "là", MESSAGES.la, "la_adverbe", "homophone");
                }
            }
            // 5. « Plus d'un technicien sont venus » → est.
            if (token.lower === "plus" && ["d'", "de"].includes(next?.lower) && ["un", "une"].includes(tokens[i + 2]?.lower)) {
                // Avec un nom seulement (« plus d'un technicien ») : « plus d'un ont été… » est toléré.
                let k = i + 3;
                if (!tokens[k] || !noun(tokens[k], "s")) {
                    return;
                }
                k++;
                const verb = tokens[k];
                const entry = verb && morph(verb).find((m) => /:V[^/]*:(Ip|Iq|If|K|Is):[^/]*3p/.test(m));
                if (entry && !REFLEXIVES.has(tokens[k - 1].lower)) {
                    const tense = /:(Ip|Iq|If|K|Is)/.exec(entry)[1];
                    const singular = hasConj ? conj.getConj(lemmaOf(entry), `:${tense}`, ":3s") : null;
                    if (singular) {
                        push(verb, verb.end, singular, MESSAGES.plusdun, "plus_dun", "accord");
                    }
                }
            }
            // 6. « Des pommes, j'en ai mangées » → mangé (sauf « … qu'il en a tirées », accord avec que).
            if (token.lower === "en" && next && AVOIR_FORMS.has(next.lower)) {
                let k = i + 2;
                while (tokens[k] && NEGATIONS.has(tokens[k].lower)) {
                    k++;
                }
                const pp = tokens[k];
                const [, gender, number] = pp ? participleTags(pp) : [];
                let clause = i - 1;
                while (clause >= 0 && !tokens[clause].punct) {
                    clause--;
                }
                const relative = tokens.slice(clause + 1, i).some((t) => ["que", "qu'"].includes(t.lower));
                // Seulement avec une quantité après (« j'en ai mangées trois ») : sans elle, l'accord
                // est toléré par certains grammairiens (« elle en avait eus »).
                const quantity = tokens[k + 1] && (/^\d/.test(tokens[k + 1].text) || has(tokens[k + 1], /:B/) || ["un", "une", "beaucoup", "plusieurs", "trop", "assez", "peu", "tant", "autant", "moins", "plus", "quelques-uns", "quelques-unes", "certains", "certaines"].includes(tokens[k + 1].lower));
                if (pp && !relative && quantity && (gender === "f" || number === "p")) {
                    const invariable = qForm(lemmaOf(participleEntry(pp)), "m", "s");
                    if (invariable && invariable !== pp.lower) {
                        push(pp, pp.end, invariable, MESSAGES.en, "ppas_en", "accord");
                    }
                }
            }
            // 7. « Combien de pommes as-tu mangé ? » → mangées.
            if (token.lower === "combien" && ["de", "d'"].includes(next?.lower)) {
                const nounToken = tokens[i + 2];
                const nounMorph = nounToken ? morph(nounToken).filter((m) => /:N/.test(m)) : [];
                if (nounMorph.length) {
                    const gender = nounMorph.every((m) => /:f/.test(m)) ? "f" : nounMorph.every((m) => /:m/.test(m)) ? "m" : null;
                    // « combien de temps » (invariable) : sens singulier, on ne dit rien.
                    const number = nounMorph.every((m) => /:p/.test(m)) ? "p" : null;
                    for (let k = i + 3; k < Math.min(tokens.length - 1, i + 8) && !tokens[k].punct; k++) {
                        const aux = tokens[k].lower.split("-")[0];
                        if (AVOIR_FORMS.has(aux) && participleEntry(tokens[k + 1]) && gender && number) {
                            const pp = tokens[k + 1];
                            const [, g, n] = participleTags(pp);
                            if (g !== gender || n !== number) {
                                const form = qForm(lemmaOf(participleEntry(pp)), gender, number);
                                if (form && form !== pp.lower) {
                                    push(pp, pp.end, form, MESSAGES.combien, "ppas_combien", "accord");
                                }
                            }
                            break;
                        }
                    }
                }
            }
            // 8. « Elle s'en est prise à moi » → pris.
            if (["s'", "se", "m'", "me", "t'", "te", "nous", "vous"].includes(token.lower) && next?.lower === "en" && BE_FORMS.has(tokens[i + 2]?.lower)) {
                const pp = tokens[i + 3];
                const entry = pp && participleEntry(pp);
                if (entry && lemmaOf(entry) === "prendre" && pp.lower !== "pris" && ["à", "au", "aux"].includes(tokens[i + 4]?.lower)) {
                    push(pp, pp.end, "pris", MESSAGES.senprendre, "sen_prendre", "accord");
                }
            }
            // 9. « Mange-s-en », « Achète-en », « Pense-y » → Manges-en, Achètes-en, Penses-y.
            const imperative = /^(\p{L}+e)(-s)?-(en|y)$/iu.exec(token.text);
            if (imperative && clauseStart(tokens, i)) {
                const base = imperative[1];
                if (morph({ text: base, punct: false }).some((m) => /:V[^/]*:E:2s/.test(m))) {
                    push(token, token.end, `${base}s-${imperative[3]}`, MESSAGES.imperatif, "imperatif_s", "conjugaison");
                }
            }
            // 10. « Les enfants obéissant sont rares » → obéissants (adjectif sans complément).
            if (/ant$/.test(token.lower) && i >= 2 && has(token, /:V[^/]*:P/) && next && has(next, /:V[^/]*:(Ip|Iq|Is|If|K)/) && !has(next, /:[NA]/)) {
                const start = simpleNounPhrase(tokens, i, null);
                const nounToken = tokens[i - 1];
                const nounMorph = morph(nounToken).filter((m) => /:N/.test(m));
                if (start >= 0 && nounMorph.length) {
                    const plural = DET_PLUR.has(tokens[start].lower);
                    const feminine = nounMorph.every((m) => /:f/.test(m));
                    const form = token.lower + (feminine ? "e" : "") + (plural ? "s" : "");
                    if (form !== token.lower && morph({ text: form, punct: false }).some((m) => /:A/.test(m))) {
                        push(token, token.end, form, MESSAGES.adjectif, "adjectif_verbal", "accord");
                    }
                }
            }
        }

        // --- Campagne du 06/11/2026 ---
        const INF_PREPS = new Set(["à", "de", "d'", "pour", "sans", "par"]);
        const A_INF_WORDS = new Set(["facile", "faciles", "difficile", "difficiles", "simple", "simples", "impossible", "impossibles", "agréable", "agréables", "dur", "dure", "durs", "dures",
            "pénible", "pénibles", "compliqué", "compliquée", "compliqués", "compliquées", "prêt", "prête", "prêts", "prêtes", "lourd", "lourde", "long", "longue", "lent", "lente",
            "délicat", "délicate", "intéressant", "intéressante", "amusant", "amusante", "drôle", "drôles", "rapide", "rapides", "machine", "machines", "salle", "fer", "chambre",
            "planche", "table", "pince", "brosse", "moulin", "pâte", "crème", "papier", "corde", "rouleau", "sac", "boîte", "verre", "fil", "chose", "choses", "rien", "beaucoup", "peu", "reste"]);
        const INF_CLITICS = new Set(["le", "la", "les", "l'", "me", "m'", "te", "t'", "se", "s'", "nous", "vous", "lui", "leur", "y", "en", "ne", "n'", "pas", "plus", "jamais", "rien"]);
        const DE_INF_LEMMAS = new Set(["oublier", "essayer", "décider", "arrêter", "cesser", "finir", "refuser", "accepter", "permettre", "demander", "choisir", "éviter", "tenter", "venir", "prier", "envisager", "rêver", "craindre", "risquer", "promettre", "proposer", "conseiller", "interdire", "empêcher", "menacer", "mériter", "négliger", "charger", "dépêcher", "souvenir", "rappeler", "penser", "permettre", "suggérer", "recommander", "ordonner", "dire", "écrire", "jurer"]);
        const DE_INF_WORDS = new Set(["merci", "besoin", "envie", "temps", "moyen", "peur", "honte", "raison", "droit", "possibilité", "occasion", "intention", "façon", "manière", "afin", "capable", "content", "contente", "ravi", "ravie", "fier", "fière", "obligé", "obligée", "libre", "sûr", "sûre", "certain", "certaine", "important", "nécessaire", "possible", "impossible", "difficile", "facile", "utile", "inutile", "prière", "avant", "plutôt"]);
        const IMPERATIVE_LINKS = new Set(["puis", "et", "ensuite", "enfin", "alors", "mais", "ou"]);
        const STATE_ADJECTIVES = new Set(["malade", "malades", "absent", "absente", "occupé", "occupée", "prêt", "prête", "fatigué", "fatiguée", "content", "contente", "fermé", "fermée", "ouvert", "ouverte", "cassé", "cassée", "parti", "partie", "enceinte", "seul", "seule", "libre", "disponible", "désolé", "désolée", "ravi", "ravie", "gentil", "gentille", "sympa", "génial", "géniale", "nul", "nulle", "fini", "finie", "complet", "complète", "vide", "plein", "pleine", "loin", "proche", "sûr", "sûre", "heureux", "heureuse", "triste", "énervé", "énervée", "inquiet", "inquiète", "furieux", "furieuse", "déçu", "déçue", "en", "là"]);
        const NATIONALITIES = new Set(["Belge", "Belges", "Français", "Française", "Françaises", "Anglais", "Anglaise", "Anglaises", "Américain", "Américaine", "Américains", "Américaines", "Allemand", "Allemande", "Allemands", "Allemandes", "Italien", "Italienne", "Italiens", "Italiennes", "Espagnol", "Espagnole", "Espagnols", "Espagnoles", "Suisse", "Suisses", "Canadien", "Canadienne", "Canadiens", "Canadiennes", "Japonais", "Japonaise", "Japonaises", "Chinois", "Chinoise", "Chinoises", "Portugais", "Portugaise", "Portugaises", "Marocain", "Marocaine", "Marocains", "Marocaines", "Algérien", "Algérienne", "Algériens", "Algériennes", "Tunisien", "Tunisienne", "Tunisiens", "Tunisiennes", "Russe", "Russes", "Grec", "Grecque", "Grecs", "Grecques", "Polonais", "Polonaise", "Polonaises", "Néerlandais", "Néerlandaise", "Néerlandaises", "Québécois", "Québécoise", "Québécoises", "Sénégalais", "Sénégalaise", "Ivoirien", "Ivoirienne", "Turc", "Turque", "Turcs", "Turques", "Brésilien", "Brésilienne", "Mexicain", "Mexicaine", "Irlandais", "Irlandaise", "Écossais", "Écossaise", "Suédois", "Suédoise", "Norvégien", "Norvégienne", "Danois", "Danoise", "Autrichien", "Autrichienne", "Roumain", "Roumaine", "Ukrainien", "Ukrainienne", "Libanais", "Libanaise", "Indien", "Indienne", "Coréen", "Coréenne", "Vietnamien", "Vietnamienne", "Breton", "Bretonne", "Corse", "Basque", "Alsacien", "Alsacienne", "Européen", "Européenne", "Européens", "Européennes", "Africain", "Africaine"]);
        const LANGUAGE_NAMES = new Set(["Anglais", "Français", "Allemand", "Italien", "Espagnol", "Portugais", "Néerlandais", "Japonais", "Chinois", "Russe", "Arabe", "Coréen", "Polonais", "Grec", "Turc", "Suédois", "Hébreu", "Latin", "Breton", "Basque", "Corse", "Catalan", "Hindi", "Vietnamien", "Ukrainien", "Roumain"]);
        const COPULA = new Set(["suis", "es", "est", "sommes", "êtes", "sont", "était", "étais", "étaient", "être", "devenu", "devenue", "reste", "semble", "paraît"]);
        const SPEAK_VERBS = /^(?:parle|parles|parlent|parlons|parlez|parler|parlé|apprend|apprends|apprennent|apprendre|étudie|étudies|étudient|étudier|enseigne|enseignes|enseigner|comprend|comprends|comprendre|traduit|traduis|traduire|maîtrise|maîtriser|écrit|écris|écrire|lit|lis|lire)$/;

        function infinitiveOf(token) {
            for (const m of morph(token)) {
                if (/:V/.test(m)) {
                    const lemma = lemmaOf(m);
                    if (lemma && lemma !== token.lower) {
                        return lemma;
                    }
                }
            }
            return null;
        }
        const verbLemmas = (token) => morph(token).filter((m) => /:V/.test(m)).map(lemmaOf);
        const hasNounReading = (token) => has(token, /:N/);

        function campaignRules(tokens, push, line) {
            const text = (k) => tokens[k]?.lower ?? "";
            const imperativeLine = tokens.some((t, k) => !t.punct && has(t, /:E:2p/) && !hasNounReading(t)
                && (k === 0 || tokens[k - 1].punct || IMPERATIVE_LINKS.has(tokens[k - 1].lower)) && tokens[k - 1]?.lower !== "vous");
            tokens.forEach((token, i) => {
                if (token.punct) {
                    return;
                }
                const prev = tokens[i - 1];
                const next = tokens[i + 1];

                // 1. Préposition (+ pronom) + participe ou 2e personne → infinitif :
                //    « pensez à vous déconnectez », « Pour le renouvelé », « N'hésitez pas à passé »,
                //    « Merci de redémarrez », « laisse à désiré », « Points à traités », « de produirent ».
                // « Il ne les leur à pas imposés » : ce « à » est le verbe avoir, pas une préposition.
                const avoirMisspelt = token.lower === "à" && prev && (OBJECT_PRONOUNS.has(prev.lower) || SUBJECTS.has(prev.lower));
                // « a pour nous cessé » : temps composé ; « de lui vous prenez » : le pronom est le
                // complément de la préposition, la suite est une autre proposition.
                // (« m'a conseillé d'arrêté » : le participe « conseillé » ferme le temps composé.)
                const COMPOUND_AUX = ["a", "ai", "as", "avons", "avez", "ont", "avait", "avaient", "est", "sont", "était", "été"];
                const compound = COMPOUND_AUX.includes(text(i - 1)) || (COMPOUND_AUX.includes(text(i - 2)) && !isParticiple(prev));
                const stressedObject = ["lui", "elle", "eux", "elles", "moi", "toi", "soi"].includes(text(i + 1));
                if (INF_PREPS.has(token.lower) && hasConj && !avoirMisspelt && !compound && !stressedObject) {
                    let j = i + 1;
                    let clitic = false;
                    let objectClitic = false;
                    while (j < tokens.length && INF_CLITICS.has(tokens[j].lower) && j - i <= 3) {
                        clitic ||= !["ne", "n'", "pas", "plus", "jamais", "rien"].includes(tokens[j].lower);
                        objectClitic ||= ["me", "m'", "te", "t'", "se", "s'", "nous", "vous", "lui", "leur", "y", "en"].includes(tokens[j].lower);
                        j++;
                    }
                    const skipped = j > i + 1;
                    const w = tokens[j];
                    if (w && !w.punct && /^\p{Ll}/u.test(w.text) && !has(w, /:Y/) && !NOT_PARTICIPLE.has(w.lower)) {
                        // « le temps de fini le rapport » : participe en -i/-u suivi de son complément.
                        const objectFollows = tokens[j + 1] && ALL_DETS.has(tokens[j + 1].lower);
                        const participle = (/(?:é|ée|és|ées)$/.test(w.lower) || (/(?:i|u)$/.test(w.lower) && objectFollows && w.lower.length > 3)) && has(w, /:Q/);
                        const second = /ez$/.test(w.lower) && has(w, /:V[^/]*:2p/);
                        // Un verbe conjugué juste après « de » (« permet aux plantes de produirent ») ; jamais
                        // après un pronom (« de lui voulait », « de vous y contribuera » : le verbe principal).
                        const finite = !participle && !second && !skipped && has(w, /:V[^/]*:(?:Ip|Iq|Is|If|K|Sp)/) && !has(w, /:[NAQWGRM]/);
                        const lemma = infinitiveOf(w);
                        if (lemma && (participle || second || finite) && /(?:er|ir|re|oir)$/.test(lemma)) {
                            const head = [...tokens.slice(0, i)].reverse().find((t) => !t.punct && !["ne", "n'", "pas", "plus", "jamais", "vous", "te", "me", "nous"].includes(t.lower));
                            const headVerb = head && verbLemmas(head).some((l) => (token.lower === "à" ? A_INFINITIVE_VERBS.has(l) || l === "laisser" || l === "arriver" : DE_INF_LEMMAS.has(l)));
                            // « difficile à expliqué », « la machine à lavé » : adjectif ou nom qui appelle « à » + infinitif.
                            const headWord = head && (token.lower !== "à" ? DE_INF_WORDS.has(head.lower) : A_INF_WORDS.has(head.lower));
                            // « tenir pour acquis », « laisser pour mort » : adjectif attendu.
                            const pourAttribute = token.lower === "pour" && head && verbLemmas(head).some((l) => ["tenir", "considérer", "compter", "laisser", "prendre", "donner", "passer", "faire"].includes(l));
                            const noun = hasNounReading(w) && !(objectFollows && (headVerb || headWord));
                            const determinerBefore = ["le", "la", "les", "l'"].includes(text(j - 1)) && !objectClitic;
                            const pluralParticipleAfterNoun = token.lower === "à" && participle && /s$/.test(w.lower) && !noun && !skipped && prev && hasNounReading(prev) && !has(prev, /:V/);
                            const ok = (objectClitic && !noun)
                                || (second && !noun && !determinerBefore)
                                || (finite && ["de", "d'", "pour"].includes(token.lower))
                                || (["pour", "sans"].includes(token.lower) && !noun && (participle || second) && !pourAttribute && !(determinerBefore && token.lower !== "pour"))
                                || (headVerb && (participle || second) && !determinerBefore)
                                || (headWord && (participle || second) && !noun && !determinerBefore)
                                || pluralParticipleAfterNoun;
                            if (ok && !(token.lower === "par" && participle)) {
                                push(w, w.end, keepCase(w.text, lemma), MESSAGES.infinitif ?? "Après une préposition, le verbe se met à l'infinitif.", "prep_infinitif", "conjugaison");
                            }
                        }
                    }
                }

                // 2. Consignes à l'impératif : « Faites fondre le beurre, puis ajouté le sucre »,
                //    « piquez-la et enfourné », « ne tarder pas ! » → ajoutez, enfournez, tardez.
                const isNe = ["ne", "n'"].includes(prev?.lower);
                if (hasConj && (imperativeLine || (isNe && /!\s*$/.test(line))) && (i === 0 || prev.punct || IMPERATIVE_LINKS.has(prev.lower) || isNe)) {
                    const w = token;
                    if ((/(?:é|er)$/.test(w.lower) && (has(w, /:Q/) || has(w, /:Y/))) && !hasNounReading(w) && (!isNe || ["pas", "plus", "jamais"].includes(next?.lower)) && next?.lower !== "par") {
                        const lemma = has(w, /:Y/) ? w.lower : infinitiveOf(w);
                        const form = lemma && /er$/.test(lemma) ? conj.getConj(lemma, ":E", ":2p") : null;
                        // « est arrêté et redémarré » : deux participes coordonnés, pas une consigne.
                        const afterLink = (i > 0 && (IMPERATIVE_LINKS.has(prev.lower) || prev.text === "," || prev.text === ";") && !(i > 1 && isParticiple(tokens[i - 2]) && !has(tokens[i - 2], /:E/))) || isNe;
                        if (form && form !== w.lower && (afterLink || (i === 0 && imperativeLine && next && !next.punct))) {
                            push(w, w.end, keepCase(w.text, form), "Consigne à l'impératif : « " + form + " ».", "imperatif_consigne", "conjugaison");
                        }
                    }
                }

                // 3. « Ma sœur et malade » → est : groupe nominal sujet + « et » + adjectif seul.
                const npStart = token.lower === "et" && i >= 2 ? simpleNounPhrase(tokens, i, null) : -1;
                if (token.lower === "et" && next && npStart >= 0 && clauseStart(tokens, npStart) && !has(prev, /:A/)
                    && has(next, /:[AQ]/) && (!hasNounReading(next) || STATE_ADJECTIVES.has(next.lower)) && !ALL_DETS.has(next.lower) && (endOrPunct(tokens[i + 2]) || ["et", "aujourd'hui", "depuis", "ce", "cette", "donc", "alors"].includes(text(i + 2)))
                    && !has(next, /:V[^/]*:(?:Ip|Iq|If|K)/) && !tokens.slice(0, i).some((t) => ["et", "ou"].includes(t.lower))) {
                    push(token, token.end, "est", MESSAGES.est, "et_est_attribut", "homophone");
                }

                // 4. « Merci a tous », « Bonjour a toi » → à.
                if (token.lower === "a" && prev && ["merci", "bonjour", "salut", "bonsoir", "bienvenue", "bravo", "félicitations", "courage", "rendez-vous"].includes(prev.lower)
                    && next && (["tous", "toutes", "toi", "vous", "tout", "demain", "bientôt", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"].includes(next.lower) || /^\p{Lu}/u.test(next.text) || ["la", "l'", "ma", "ta", "notre", "votre", "mon", "ton"].includes(next.lower))) {
                    push(token, token.end, "à", MESSAGES.aPrep ?? "Ici, il faut la préposition « à ».", "a_prep", "homophone");
                }

                // 5. « Victor Hugo à écrit », « l'avion à décollé », « Tu à pensé » → a, as.
                if (token.lower === "à" && next && isParticiple(next) && hasConj) {
                    const subjectTu = prev?.lower === "tu";
                    // Un nom propre (« Victor Hugo à écrit ») : inconnu du dictionnaire ou marqué :M, pas un verbe
                    // en tête de phrase (« Pensez à vérifié »).
                    const nameSubject = prev && /^\p{Lu}/u.test(prev.text) && !ALL_DETS.has(prev.lower) && (morph(prev).length === 0 || (has(prev, /:M/) && !has(prev, /:V/)))
                        && (i - 1 === 0 || tokens[i - 2].punct || /^\p{Lu}/u.test(tokens[i - 2].text));
                    const nounSubject = prev && nounPhraseBefore(tokens, i, "s", false);
                    const after = tokens[i + 2];
                    const strongObject = after && (ALL_DETS.has(after.lower) || /^\p{Lu}/u.test(after.text));
                    const objectFollows = !after || after.punct || strongObject || ["avec", "pendant", "hier", "depuis", "en", "à", "au", "aux", "de", "du", "des", "tout", "très", "beaucoup", "trop", "bien", "mal", "déjà", "encore"].includes(after.lower);
                    if ((subjectTu || nameSubject || nounSubject) && objectFollows && (!hasNounReading(next) || strongObject || subjectTu)) {
                        push(token, token.end, subjectTu ? "as" : "a", MESSAGES.a, "a_verbe_avoir", "homophone");
                    }
                }

                // 5b. « son mot de passe à été changé » → a été.
                if (token.lower === "à" && next?.lower === "été" && tokens[i + 2] && isParticiple(tokens[i + 2]) && prev && (nounPhraseBefore(tokens, i, null, false) || SUBJECTS.has(prev.lower) || (/^\p{Lu}/u.test(prev.text) && morph(prev).length === 0))) {
                    push(token, token.end, ["ils", "elles"].includes(prev.lower) ? "ont" : "a", MESSAGES.a, "a_ete", "homophone");
                }

                // 6. « ne veut n'y manger ni boire » → ni.
                if (token.lower === "n'" && next?.lower === "y" && tokens[i + 2] && has(tokens[i + 2], /:Y/) && tokens.slice(i + 3, i + 6).some((t) => t.lower === "ni")) {
                    push(token, next.end, "ni", MESSAGES.ni ?? "Ici, la négation « ni… ni… ».", "ny_ni", "homophone");
                }

                // 7. Homophones d'usage : tâche, plus tôt, ses propres, ou, et, qu'en, balade, voix, foie.
                const STAIN_VERBS = /^(?:effacer|enlever|nettoyer|ravoir|retirer|détacher|faire|partir|laver|cacher|masquer|traiter)$/;
                if (token.lower === "tache" && (["urgente", "importante", "quotidienne", "ménagère", "ingrate", "prioritaire", "principale"].includes(text(i + 1)) || (text(i + 1) === "à" && tokens[i + 2] && has(tokens[i + 2], /:Y/) && !STAIN_VERBS.test(text(i + 2))))) {
                    push(token, token.end, "tâche", "« tache » est une salissure ; un travail à faire est une « tâche ».", "tache_tache", "homophone");
                }
                if (token.lower === "taches" && (["urgentes", "importantes", "ménagères", "quotidiennes", "prioritaires"].includes(text(i + 1)) || (text(i + 1) === "à" && tokens[i + 2] && has(tokens[i + 2], /:Y/)))) {
                    push(token, token.end, "tâches", "Un travail à faire : « tâches ».", "tache_tache", "homophone");
                }
                if (token.lower === "plutôt" && text(i + 1) === "que" && ["d'habitude", "prévu", "d'ordinaire", "hier", "la", "les", "moi", "toi", "lui", "nous", "vous", "eux", "elle", "elles", "les autres"].includes(text(i + 2)) && verbLemmas(prev ?? {}).some((l) => EARLY_VERBS.has(l))) {
                    push(token, token.end, "plus tôt", MESSAGES.plusTot, "plutot_que_plus_tot", "homophone");
                }
                if (token.lower === "plutôt" && text(i + 1) === "que" && text(i + 2) === "d'" && text(i + 3) === "habitude") {
                    push(token, token.end, "plus tôt", MESSAGES.plusTot, "plutot_que_plus_tot", "homophone");
                }
                if (token.lower === "ces" && next?.lower === "propres" && tokens.slice(0, i).some((t) => ["chacun", "chacune", "il", "elle", "on", "personne", "quiconque"].includes(t.lower))) {
                    push(token, token.end, "ses", "Possessif : « ses propres… ».", "ces_ses_propres", "homophone");
                }
                if (token.lower === "où" && prev && i >= 2 && (hasNounReading(prev) || isAcronym(prev)) && ["du", "de", "des", "un", "une", "le", "la", "les", "d'"].includes(text(i + 1))
                    && (/\?\s*$/.test(line) || tokens.slice(0, i).some((t) => /^(?:veux|voulez|veut|préfères|préférez|préfère|choisis|choisissez|prends|prenez|aimes|aimez)$/.test(t.lower)))) {
                    push(token, token.end, "ou", "« où » indique le lieu ; pour une alternative, c'est « ou ».", "ou_alternative", "homophone");
                }
                if (token.lower === "est" && prev && TIME_NOUNS.has(prev.lower) && ["le", "la", "l'"].includes(text(i + 1)) && tokens[i + 2] && TIME_NOUNS.has(tokens[i + 2].lower)) {
                    push(token, token.end, "et", "Ici, il faut la conjonction « et ».", "est_et", "homophone");
                }
                if (token.lower === "quand" && prev && tokens.slice(Math.max(0, i - 3), i).some((t) => ["ne", "n'"].includes(t.lower)) && has(prev, /:V/) && next
                    && (LANGUAGES.has(next.lower) || ["cas", "fin", "partie", "dernier", "plus", "général", "début", "semaine", "été", "hiver", "voiture", "ligne", "anglais", "français", "privé", "public"].includes(next.lower))) {
                    push(token, token.end, "qu'en", "Ne… qu'en (= seulement en).", "quand_quen", "homophone");
                }
                if (["ballade", "ballades"].includes(token.lower) && (["au", "à", "en", "dans", "le", "sur", "avec", "dans", "digestive", "en"].includes(text(i + 1)) || ["fait", "faire", "fais", "faisons", "faites", "font", "petite", "grande", "belle", "jolie"].includes(prev?.lower))) {
                    push(token, token.end, token.lower === "ballades" ? "balades" : "balade", "Une promenade est une « balade » ; une « ballade » est un poème ou une chanson.", "ballade_balade", "homophone");
                }
                if (["voie"].includes(token.lower) && (["belle", "jolie", "douce", "grave", "aiguë", "superbe", "magnifique", "forte", "faible", "rauque", "cassée", "grosse"].includes(prev?.lower) || ["haute", "basse"].includes(next?.lower) && prev?.lower === "à")) {
                    push(token, token.end, "voix", "Ici, il s'agit de la « voix » (celle qu'on entend).", "voie_voix", "homophone");
                }
                if (token.lower === "foi" && ["au", "du"].includes(prev?.lower) && ["mal", "crise", "pâté", "cancer"].some((w) => tokens.slice(Math.max(0, i - 3), i).some((t) => t.lower === w))) {
                    push(token, token.end, "foie", "L'organe est le « foie ».", "foi_foie", "homophone");
                }

                // 8. Accords divers : couleurs variables, « Tous ce que », « quatre-vingt », « bel » devant consonne.
                if (["rose", "mauve", "pourpre", "écarlate", "fauve", "violette", "violet", "verte", "vert", "bleue", "noire", "blanche", "grise", "jaune", "rouge"].includes(token.lower) && prev && noun(prev, "p") && hasPlural(prev) && !/s$/.test(token.lower)
                    && (endOrPunct(next) && next?.text !== ",") && tokens[i - 2] && (DET_PLUR.has(tokens[i - 2].lower) || (has(tokens[i - 2], /:A[^/]*:p/) && DET_PLUR.has(text(i - 3)))) && prev.lower !== "couleurs") {
                    push(token, token.end, `${token.text}s`, "La couleur s'accorde avec le nom au pluriel.", "couleur_pluriel", "accord");
                }
                if (token.lower === "tous" && ["ce", "ceux", "cela"].includes(text(i + 1)) && ["que", "qu'", "qui"].includes(text(i + 2)) && text(i + 1) === "ce") {
                    push(token, token.end, "tout", "« Tout ce que » : « tout » est invariable ici.", "tous_ce_que", "accord");
                }
                if (token.lower === "quatre-vingt" && next && /^(?:ans|euros|personnes|kilomètres|km|mètres|pages|jours|mois|fois|élèves|invités|participants|minutes|degrés|kilos|kg|%|centimes|places|ans,)$/.test(next.lower)) {
                    push(token, token.end, "quatre-vingts", "« quatre-vingts » prend un s quand il n'est pas suivi d'un autre nombre.", "quatre_vingts", "accord");
                }
                if (["bel", "nouvel", "vieil", "fol", "mol"].includes(token.lower) && next && /^[bcdfgjklmnpqrstvwxz]/i.test(next.lower) && has(next, /:N/) && !has(next, /:N[^/]*:f/)) {
                    const fixed = { bel: "beau", nouvel: "nouveau", vieil: "vieux", fol: "fou", mol: "mou" }[token.lower];
                    push(token, token.end, fixed, `Devant une consonne : « ${fixed} ».`, "bel_beau", "accord");
                }

                // 9. Majuscules : nationalité adjectif et langue en minuscule, « noël » → Noël.
                if (NATIONALITIES.has(token.text) && prev && ["est", "suis", "es", "sont", "sommes", "êtes", "était", "étais", "étaient"].includes(prev.lower) && i > 1 && SUBJECTS.has(text(i - 2)) && (endOrPunct(next) || ["et", "mais", "depuis", "comme", "aussi", "d'origine"].includes(next.lower))) {
                    push(token, token.end, token.text.toLowerCase(), "Adjectif de nationalité : minuscule (« il est belge », un Belge).", "nationalite_minuscule", "majuscule");
                }
                if (LANGUAGE_NAMES.has(token.text) && prev && (SPEAK_VERBS.test(prev.lower) || (prev.lower === "en" && i > 1 && SPEAK_VERBS.test(tokens[i - 2].lower)) || ["le", "l'"].includes(prev.lower) && tokens[i - 2] && SPEAK_VERBS.test(tokens[i - 2].lower))) {
                    push(token, token.end, token.text.toLowerCase(), "Les noms de langues s'écrivent en minuscule.", "langue_minuscule", "majuscule");
                }
                if (token.text === "noël") {
                    push(token, token.end, "Noël", "La fête s'écrit avec une majuscule : « Noël ».", "noel_majuscule", "majuscule");
                }

                // 10. « 12% » → 12 % (le signe pour cent se sépare du nombre).
                if (/^\d+(?:[.,]\d+)?$/.test(token.text) && next?.text === "%" && next.start === token.end) {
                    push(token, next.end, `${token.text} %`, "Une espace (insécable) avant « % ».", "pourcent_espace", "typographie");
                }

                // 11. « L'utilisateur signal que » : nom employé à la place du verbe (signale).
                const subjectStart = prev ? simpleNounPhrase(tokens, i, "s") : -1;
                if (subjectStart >= 0 && clauseStart(tokens, subjectStart) && hasNounReading(token) && !has(token, /:V/) && next && ["que", "qu'"].includes(next.lower)) {
                    const verb = `${token.lower}e`;
                    if (getMorph(verb).some((m) => /:V[^/]*:Ip[^/]*:3s/.test(m))) {
                        push(token, token.end, keepCase(token.text, verb), `Verbe : « ${verb} ».`, "nom_verbe", "conjugaison");
                    }
                }
            });
        }

        // --- Grand banc génératif (06/11/2026) ---
        const STRESSED = { moi: ":1p", toi: ":2p", nous: ":1p", vous: ":2p" };
        const QUI_PERSON = { moi: ":1s", toi: ":2s", lui: ":3s", elle: ":3s", nous: ":1p", vous: ":2p", eux: ":3p", elles: ":3p" };
        const FUTURE_HINT = /(?:^|[\s,'’])(?:demain|dès\s+(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|demain|ce\s+soir|que)|ce\s+soir|promis|la\s+semaine\s+prochaine|bientôt|tout\s+à\s+l['’]heure|plus\s+tard|dans\s+(?:une|deux|trois|quelques|\d+)\s+(?:minutes?|heures?|jours?|semaines?))(?=[\s,.!?]|$)/iu;
        const HYPOTHESIS = /^(?:\s*)(?:si\s|s['’]il\s|s['’]ils\s|avec\s+plus\s+d|à\s+ta\s+place|à\s+votre\s+place|sans\s+(?:toi|vous|lui|elle|ça)|au\s+cas\s+où|même\s+si)/iu;
        const POLITE = new Set(["aimer", "vouloir", "pouvoir", "devoir", "souhaiter", "préférer", "falloir", "savoir", "désirer", "adorer"]);
        const IRREGULAR_PLURALS = { festivaux: "festivals", oeils: "yeux", œils: "yeux", travails: "travaux", chevals: "chevaux", journals: "journaux", animals: "animaux", hôpitals: "hôpitaux", bijous: "bijoux", genous: "genoux", chous: "choux", caillous: "cailloux", hibous: "hiboux", joujous: "joujoux", poux: "poux", bateaus: "bateaux", gâteaus: "gâteaux", cheveus: "cheveux", jeus: "jeux", feus: "feux", pneux: "pneus", bleux: "bleus", carnavaux: "carnavals", récitaux: "récitals", chacals: "chacals" };
        const NUMBER_WORDS_FR = new Set(["deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quinze", "vingt", "trente", "quarante", "cinquante", "cent", "mille"]);

        // Fin d'un groupe nominal sujet qui commence en k : « Paul », « le directeur », « ma vieille voisine ».
        function subjectGroupEnd(tokens, k) {
            const t = tokens[k];
            if (!t || t.punct) {
                return -1;
            }
            if (STRESSED[t.lower] || ["lui", "elle", "eux", "elles"].includes(t.lower)) {
                return k;
            }
            if (/^\p{Lu}/u.test(t.text) && !ALL_DETS.has(t.lower) && (morph(t).length === 0 || has(t, /:M/))) {
                return /^\p{Lu}/u.test(tokens[k + 1]?.text ?? "") && morph(tokens[k + 1]).length === 0 ? k + 1 : k;
            }
            if (ALL_DETS.has(t.lower)) {
                let j = k + 1;
                if (tokens[j] && isPureAdjective(tokens[j]) && tokens[j + 1] && noun(tokens[j + 1], null)) {
                    j++;
                }
                if (tokens[j] && (noun(tokens[j], null) || (morph(tokens[j]).length === 0 && /^\p{Ll}/u.test(tokens[j].text)))) {
                    if (tokens[j + 1] && isPureAdjective(tokens[j + 1]) && !has(tokens[j + 1], /:V/)) {
                        return j + 1;
                    }
                    return j;
                }
            }
            return -1;
        }

        // « Si j'avais… » (imparfait) appelle le conditionnel ; « Si tu viens… » (présent), le futur.
        // Sans « si » (« Avec plus d'argent, », « À ta place, ») : le conditionnel.
        function hypotheticalPast(tokens, from, to, sentenceStart) {
            if (!/^\s*(?:si\s|s['’]il|s['’]ils|même\s+si)/iu.test(sentenceStart)) {
                return true;
            }
            return tokens.some((t) => t.start >= from && t.start < to && has(t, /:V[^/]*:Iq/) && !has(t, /:[NA]/));
        }

        function verbAt(tokens, j) {
            const entry = finiteEntryLoose(tokens[j]) ?? finiteEntry(tokens[j]);
            return entry ? { entry, lemma: lemmaOf(entry), tense: /:(Ip|Iq|Is|If|K|Sp)/.exec(entry)[1] } : null;
        }

        function bigBenchRules(tokens, push, line) {
            const text = (k) => tokens[k]?.lower ?? "";
            tokens.forEach((token, i) => {
                if (token.punct || !hasConj) {
                    return;
                }
                const prev = tokens[i - 1];
                const next = tokens[i + 1];

                // 12. Sujets coordonnés : « Mon frère et moi mangeons », « Paul et sa femme arrivent ».
                if (token.lower === "et" && i > 0) {
                    let s0 = i - 1;
                    while (s0 > 0 && !tokens[s0 - 1].punct && !CLAUSE_WORDS.has(tokens[s0 - 1].lower) && !["que", "qu'"].includes(tokens[s0 - 1].lower) && i - s0 < 4) {
                        s0--;
                    }
                    const firstEnd = subjectGroupEnd(tokens, s0);
                    const secondEnd = subjectGroupEnd(tokens, i + 1);
                    // « Est-ce que Léa et toi viendrez ? » : après « que », un sujet commence aussi.
                    const opens = clauseStart(tokens, s0) || ["que", "qu'"].includes(text(s0 - 1));
                    if (firstEnd === i - 1 && secondEnd > i && opens && tokens[secondEnd + 1]) {
                        const verb = verbAt(tokens, secondEnd + 1);
                        const group = tokens.slice(s0, secondEnd + 1).map((t) => t.lower);
                        const person = group.some((w) => w === "moi" || w === "nous") ? ":1p" : group.some((w) => w === "toi" || w === "vous") ? ":2p" : ":3p";
                        if (verb && !morph(tokens[secondEnd + 1]).some((m) => m.includes(person)) && !has(tokens[secondEnd + 1], /:[NA]/)) {
                            const form = conj.getConj(verb.lemma, `:${verb.tense}`, person);
                            if (form) {
                                push(tokens[secondEnd + 1], tokens[secondEnd + 1].end, form, `Sujets coordonnés : « ${form} ».`, "accord_sujet_verbe", "conjugaison");
                            }
                        }
                    }
                }

                // 13. « Ce sont eux qui installent », « C'est nous qui avons ».
                if (token.lower === "qui" && i >= 2 && QUI_PERSON[text(i - 1)] && ["est", "sont", "était", "étaient", "sera", "seront"].includes(text(i - 2)) && next) {
                    const person = QUI_PERSON[text(i - 1)];
                    const verb = verbAt(tokens, i + 1);
                    if (verb && !morph(next).some((m) => m.includes(person))) {
                        const form = conj.getConj(verb.lemma, `:${verb.tense}`, person);
                        if (form && form !== next.lower) {
                            push(next, next.end, form, `Le verbe s'accorde avec « ${text(i - 1)} » : « ${form} ».`, "accord_sujet_verbe", "conjugaison");
                        }
                    }
                }

                // 14. Futur ou conditionnel avec « je » : « Demain, je mangerais » → mangerai ;
                //     « Si j'avais le temps, je mangerai » → mangerais.
                if (["je", "j'"].includes(text(i - 1)) && /(?:rai|rais)$/.test(token.lower)) {
                    const cond = morph(token).find((m) => /:V[^/]*:K[^/]*:1s/.test(m));
                    const fut = morph(token).find((m) => /:V[^/]*:If[^/]*:1s/.test(m));
                    const sentenceStart = line.slice(0, token.start).replace(/^.*[.!?]\s*/s, "");
                    if (cond && !fut && FUTURE_HINT.test(line) && !HYPOTHESIS.test(sentenceStart) && !/\bsi\b/i.test(sentenceStart) && !POLITE.has(lemmaOf(cond))) {
                        const form = conj.getConj(lemmaOf(cond), ":If", ":1s");
                        if (form) {
                            push(token, token.end, form, `Un fait à venir : futur, « ${form} ».`, "futur_conditionnel", "conjugaison");
                        }
                    } else if (fut && !cond && HYPOTHESIS.test(sentenceStart) && /,/.test(sentenceStart) && hypotheticalPast(tokens, token.start - sentenceStart.length, token.start, sentenceStart)) {
                        const form = conj.getConj(lemmaOf(fut), ":K", ":1s");
                        if (form) {
                            push(token, token.end, form, `Une hypothèse : conditionnel, « ${form} ».`, "futur_conditionnel", "conjugaison");
                        }
                    }
                }

                // 15. Impératif en tête de phrase : « Achètes le pain » → Achète.
                if (clauseStart(tokens, i) && !["tu", "t'"].includes(text(i - 1)) && /es$/.test(token.lower) && line.slice(token.end, token.end + 1) !== "-" && next && (ALL_DETS.has(next.lower) || ["moi", "le", "la", "les", "lui", "leur", "un", "une", "des", "du", "ça", "cela", "tout"].includes(next.lower))) {
                    const entry = morph(token).find((m) => /:V1[^/]*:Ip[^/]*:2s/.test(m));
                    if (entry && !has(token, /:N/)) {
                        const form = conj.getConj(lemmaOf(entry), ":E", ":2s");
                        if (form && form !== token.lower && /!|s'il te plaît|stp/.test(line.slice(token.end)) ) {
                            push(token, token.end, keepCase(token.text, form), `Impératif : « ${form} » (sans s).`, "imperatif_2s", "conjugaison");
                        }
                    }
                }

                // 16. « La pomme ? Il l'a goûté » → goûtée : le pronom reprend le nom d'avant.
                if (["l'", "les"].includes(token.lower) && next && ["ai", "as", "a", "avons", "avez", "ont", "avais", "avait", "avions", "aviez", "avaient", "aurai", "aura"].includes(next.lower) && tokens[i + 2] && isParticiple(tokens[i + 2])) {
                    const before = tokens.slice(0, i);
                    const cut = before.map((t) => t.text).lastIndexOf("?") >= 0 ? before.map((t) => t.text).lastIndexOf("?") : before.map((t) => t.text).lastIndexOf(",");
                    // Le nom repris ouvre la phrase et forme tout le passage avant « ? » ou « , »
                    // (« Ta lettre, je l'ai lue », « La pomme ? Il l'a goûtée »).
                    if (cut > 0 && subjectGroupEnd(tokens, 0) === cut - 1 && ALL_DETS.has(tokens[0].lower)) {
                        const head = before.slice(0, cut).reverse().find((t) => noun(t, null) && !/^\p{Lu}/u.test(t.text));
                        const headMorph = head ? morph(head).find((m) => /:N/.test(m)) : null;
                        if (headMorph && /:[mf]/.test(headMorph) && !/:e/.test(headMorph)) {
                            const gender = /:f/.test(headMorph) ? "f" : "m";
                            const number = token.lower === "les" ? "p" : "s";
                            const pp = tokens[i + 2];
                            const form = inflectAdjective(pp, gender, number);
                            const causative = ["fait", "laissé", "vu", "entendu"].includes(pp.lower) && tokens[i + 3] && (has(tokens[i + 3], /:Y/) || ["se", "s'"].includes(tokens[i + 3].lower));
                            if (form && form !== pp.lower && !NOT_PARTICIPLE.has(pp.lower) && !causative) {
                                push(pp, pp.end, form, `Accord avec « ${head.text} », placé avant : « ${form} ».`, "ppas_cod_avant", "accord");
                            }
                        }
                    }
                }

                // 17. « Elle a prise ce serveur » → pris : avoir + participe, complément après.
                if (["ai", "as", "a", "avons", "avez", "ont", "avait", "avaient", "avais"].includes(token.lower) && next && isParticiple(next) && tokens[i + 2] && ALL_DETS.has(tokens[i + 2].lower)
                    && !tokens.slice(Math.max(0, i - 3), i).some((t) => ["l'", "les", "la", "le", "que", "qu'", "me", "m'", "te", "t'", "nous", "vous", "se", "s'", "en"].includes(t.lower))
                    && morph(next).some((m) => /:Q[^/]*:(?:f|[mf]:p|m:p)/.test(m)) && !morph(next).some((m) => /:Q[^/]*:m:[si]/.test(m))) {
                    const form = inflectAdjective(next, "m", "s");
                    if (form && form !== next.lower) {
                        push(next, next.end, form, `Avec avoir, le participe ne s'accorde pas avec ce qui suit : « ${form} ».`, "ppas_avoir_invariable", "accord");
                    }
                }

                // 19. Pluriels irréguliers inventés : « festivaux » → festivals, « travails » → travaux.
                if (IRREGULAR_PLURALS[token.lower] && IRREGULAR_PLURALS[token.lower] !== token.lower) {
                    push(token, token.end, keepCase(token.text, IRREGULAR_PLURALS[token.lower]), `Pluriel : « ${IRREGULAR_PLURALS[token.lower]} ».`, "pluriel_irregulier", "accord");
                }

                // 20. Nombre + nom au singulier : « Trois téléphone » → téléphones.
                if (NUMBER_WORDS_FR.has(token.lower) && !["neuf", "cent", "mille"].includes(token.lower) && next && noun(next, "s") && !noun(next, "p") && !has(next, /:[VWGDROYA]/) && !["minimum", "maximum", "environ", "fois"].includes(next.lower) && !NUMBER_WORDS_FR.has(next.lower)
                    && !/[sxz]$/.test(next.lower) && !["le", "la", "les", "des", "de", "d'", "du", "au", "aux"].includes(text(i - 1)) && /^\p{Ll}/u.test(next.text)) {
                    const nm = morph(next).find((m) => /:N/.test(m));
                    const plural = nm ? (/(?:au|eau|eu)$/.test(next.lower) ? `${next.lower}x` : /al$/.test(next.lower) ? `${next.lower.slice(0, -2)}aux` : `${next.lower}s`) : null;
                    if (plural && morph({ text: plural, punct: false }).some((m) => /:N[^/]*:[pi]/.test(m))) {
                        push(next, next.end, plural, `Après « ${token.text} », le nom est au pluriel : « ${plural} ».`, "pluriel_nombre", "accord");
                    }
                }
                void prev;
            });
        }

        // --- Banc réaliste à l'aveugle (06/11/2026, textes-5) ---
        // Sujets loin du verbe (« Le nombre d'accidents sur cette route ont baissé »), sujet inversé
        // (« À quelle heure arrive les invités »), concordance des temps, participes des verbes
        // pronominaux sans complément d'objet (« se sont nui »), infinitif après « à »/« de »/un modal,
        // homophones de la vie courante (la/là, mère/maire/mer, sang/sans, vers/vert…), élisions,
        // pluriels des noms composés, majuscules (Seine, Jean-Pierre).
        const QUANTITY_DETS = new Set(["deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "quinze", "vingt", "trente", "cent", "mille", "plusieurs", "quelques", "certains", "certaines"]);
        const COLLECTIVE_FR = new Set(["plupart", "majorité", "minorité", "foule", "dizaine", "douzaine", "quinzaine", "vingtaine", "trentaine", "quarantaine", "cinquantaine", "centaine", "millier", "multitude", "partie", "moitié", "quart", "tiers", "totalité", "ensemble", "reste", "série", "tas", "troupe", "groupe", "bande", "masse", "infinité", "poignée", "nuée", "flopée", "kyrielle", "nombre"]);
        const STOP_SCAN = new Set(["qui", "que", "qu'", "dont", "où", "et", "ou", "mais", "car", "si", "quand", "lorsque", "parce", "comme"]);
        const SAY_THINK = new Set(["dire", "promettre", "jurer", "assurer", "annoncer", "écrire", "expliquer", "répéter", "affirmer", "prévenir", "confirmer", "penser", "croire", "savoir", "espérer", "imaginer", "supposer", "prévoir", "garantir", "certifier", "raconter", "prétendre", "déclarer"]);
        const CLITICS = new Set(["ne", "n'", "me", "m'", "te", "t'", "se", "s'", "le", "la", "les", "l'", "lui", "leur", "y", "en", "nous", "vous"]);
        const PRONOMINAL_INVARIABLE = { nuis: "nui", nuie: "nui", nuies: "nui", souris: "souri", sourie: "souri", souries: "souri", succédés: "succédé", succédée: "succédé", succédées: "succédé", déplus: "déplu", déplue: "déplu", déplues: "déplu", plue: "plu", plues: "plu", parlés: "parlé", parlée: "parlé", parlées: "parlé", téléphonés: "téléphoné", téléphonée: "téléphoné", téléphonées: "téléphoné", mentis: "menti", mentie: "menti", menties: "menti", ressemblés: "ressemblé", ressemblée: "ressemblé", ressemblées: "ressemblé", suffis: "suffi", suffie: "suffi", suffies: "suffi" };
        const COMPOUND_PLURALS = { "coffre-forts": "coffres-forts", "coffres-fort": "coffres-forts", "arc-en-ciels": "arcs-en-ciel", "arcs-en-ciels": "arcs-en-ciel", "belle-sœurs": "belles-sœurs", "belle-soeurs": "belles-sœurs", "beau-frères": "beaux-frères", "beaux-frère": "beaux-frères", "beau-parents": "beaux-parents", "beau-pères": "beaux-pères", "belle-mères": "belles-mères", "belle-filles": "belles-filles", "chef-d'œuvres": "chefs-d'œuvre", "chefs-d'œuvres": "chefs-d'œuvre", "chou-fleurs": "choux-fleurs", "choux-fleur": "choux-fleurs", "petit-enfants": "petits-enfants", "petits-enfant": "petits-enfants", "haut-parleurs": "hauts-parleurs", "basse-cours": "basses-cours", "rouge-gorges": "rouges-gorges", "chauve-souris": null, "nouveaux-nés": "nouveau-nés", "nus-pieds": "nu-pieds", "nue-pieds": "nu-pieds", "demie-heure": "demi-heure", "demis-heures": "demi-heures", "demies-heures": "demi-heures", "grand-pères": "grands-pères", "timbre-postes": "timbres-poste", "compte-rendus": "comptes rendus", "comptes-rendus": "comptes rendus", "sourd-muets": "sourds-muets", "wagon-lits": "wagons-lits", "oiseau-mouches": "oiseaux-mouches", "plate-bandes": "plates-bandes", "porte-clé": "porte-clés", "garde-robes": "garde-robes", "après-midis": "après-midi" };
        const ADJ_ANT = { fatiguant: "fatigant", fatiguante: "fatigante", fatiguants: "fatigants", fatiguantes: "fatigantes", convainquant: "convaincant", convainquante: "convaincante", convainquants: "convaincants", convainquantes: "convaincantes", provoquante: "provocante", intriguant: "intrigant", intriguante: "intrigante", suffoquant: "suffocant", suffoquante: "suffocante", zigzaguant: "zigzagant" };
        const SUBJECT_PERSON = { je: "1s", "j'": "1s", tu: "2s", il: "3s", elle: "3s", on: "3s", nous: "1p", vous: "2p", ils: "3p", elles: "3p" };
        // Personne du sujet pronom placé avant le verbe en i (en sautant les pronoms compléments).
        function subjectPerson(tokens, i) {
            let k = i - 1;
            while (k >= 0 && CLITICS.has(tokens[k].lower) && !SUBJECT_PERSON[tokens[k].lower]) {
                k--;
            }
            return SUBJECT_PERSON[tokens[k]?.lower] ?? null;
        }
        const RIVERS = { seine: "Seine", loire: "Loire", garonne: "Garonne", dordogne: "Dordogne", rhône: "Rhône", rhin: "Rhin", marne: "Marne", oise: "Oise", moselle: "Moselle", meuse: "Meuse", durance: "Durance", charente: "Charente", saône: "Saône", tamise: "Tamise", tibre: "Tibre", danube: "Danube", volga: "Volga", ardèche: "Ardèche", isère: "Isère", vilaine: "Vilaine" };
        const FIRST_NAMES_FR = new Set(["jean", "pierre", "marie", "paul", "luc", "marc", "anne", "sophie", "claire", "yves", "michel", "baptiste", "louis", "françois", "jacques", "philippe", "hélène", "christine", "laure", "charlotte", "louise", "noël", "rose", "claude", "joseph", "lou", "eve", "ève", "loup", "christophe", "charles", "élise", "alice", "andré", "antoine", "julie", "thérèse", "france", "jo", "pascal", "édouard", "eudes", "mathieu", "matthieu", "noëlle", "agnès", "odile", "laurence", "cécile", "caroline", "camille", "emmanuel", "emmanuelle", "max", "guy", "hugues", "henri", "eric", "éric", "denis", "daniel", "dominique", "sébastien", "thomas", "victor", "vincent", "yann", "alexandre", "olivier", "benoît", "bernard", "gabriel", "georges", "gilles", "jules", "lucie", "manon", "nicolas", "patrick", "raphaël", "rémi", "simon", "stéphane", "xavier"]);
        const KINSHIP = new Set(["parents", "grands-parents", "enfants", "frères", "sœurs", "soeurs", "cousins", "cousines", "oncles", "tantes", "neveux", "nièces", "petits-enfants", "beaux-parents", "filles", "fils", "grand-parents", "arrière-grands-parents"]);
        const ELIDE_NEXT = /^(?:il|ils|elle|elles|on|un|une|en|eux|à|au|aux|ici|alors|aujourd'hui|avec|ainsi)$/;
        // Premier verbe conjugué non ambigu à partir de k, dans la même proposition (-1 sinon).
        function nextFiniteVerb(tokens, k, limit = 9) {
            for (let j = k; j < tokens.length && j - k < limit; j++) {
                const t = tokens[j];
                if (t.punct || STOP_SCAN.has(t.lower)) {
                    return -1;
                }
                if (has(t, /:V[^/]*:(Ip|Iq|Is|If|K)/) && !has(t, /:[NAQDGRW]/)) {
                    return j;
                }
            }
            return -1;
        }
        function realRules(tokens, push, line) {
            // Seulement là où aucune autre règle d'Aria n'a déjà parlé.
            const add = (token, end, fix, message, rule, detail = "homophone") => {
                if (!currentResults.some((r) => r.start < end && token.start < r.end)) {
                    push(token, end, fix, message, rule, detail);
                }
            };
            const text = (k) => tokens[k]?.lower ?? "";
            const sentenceOf = (offset) => line.slice(0, offset).replace(/^.*[.!?]\s*/s, "");
            tokens.forEach((token, i) => {
                if (token.punct) {
                    return;
                }
                const prev = tokens[i - 1];
                const next = tokens[i + 1];
                const lower = token.lower;

                if (hasConj) {
                    // R1. « Nous ira chercher » → irons ; « vous avait tout déchiré » → avez.
                    if (["nous", "vous"].includes(lower) && (i === 0 || /^[.!?]$/.test(prev.text)) && !["le", "la", "les", "l'", "lui", "leur", "en", "y"].includes(text(i + 1))) {
                        let j = i + 1;
                        while (tokens[j] && CLITICS.has(tokens[j].lower) && j - i <= 3) {
                            j++;
                        }
                        const v = tokens[j];
                        const verb = v && !v.punct ? verbAt(tokens, j) : null;
                        const person = lower === "nous" ? ":1p" : ":2p";
                        if (verb && ["If", "Iq", "K"].includes(verb.tense) && /:3s/.test(verb.entry) && !has(v, /:[NAQWGRD]/) && !morph(v).some((m) => m.includes(person)) && /^\p{Ll}/u.test(v.text)) {
                            const form = conj.getConj(verb.lemma, `:${verb.tense}`, person);
                            if (form && form !== v.lower) {
                                add(v, v.end, form, `Avec « ${lower} », le verbe se conjugue ainsi : « ${form} ».`, "accord_sujet_verbe", "conjugaison");
                            }
                        }
                    }

                    // R3. « De nombreux parents pense », « Trois élèves devrons » → 3e personne du pluriel.
                    if (clauseStart(tokens, i) || ["que", "qu'"].includes(text(i - 1))) {
                        let n = -1;
                        if (QUANTITY_DETS.has(lower) || /^\d+$/.test(lower)) {
                            n = i + 1;
                        } else if (["de", "d'"].includes(lower) && ["nombreux", "nombreuses"].includes(text(i + 1))) {
                            n = i + 2;
                        } else if (["beaucoup", "peu", "trop", "tant", "assez"].includes(lower) && ["de", "d'"].includes(text(i + 1))) {
                            n = i + 2;
                        }
                        if (n > 0 && tokens[n] && noun(tokens[n], "p") && !noun(tokens[n], "s")) {
                            let v = n + 1;
                            if (tokens[v] && isPureAdjective(tokens[v]) && hasPlural(tokens[v])) {
                                v++;
                            }
                            while (tokens[v] && CLITICS.has(tokens[v].lower) && v - n <= 4) {
                                v++;
                            }
                            const verb = tokens[v] && !tokens[v].punct ? verbAt(tokens, v) : null;
                            if (verb && !has(tokens[v], /:[NAQWGRD]/) && !morph(tokens[v]).some((m) => /:3p/.test(m))) {
                                const form = conj.getConj(verb.lemma, `:${verb.tense}`, ":3p");
                                if (form && form !== tokens[v].lower) {
                                    add(tokens[v], tokens[v].end, form, `Le sujet est au pluriel : « ${form} ».`, "accord_sujet_verbe", "conjugaison");
                                }
                            }
                        }
                    }

                    // R4. « Le nombre d'accidents sur cette route ont baissé » → a : le sujet est « le nombre ».
                    if (["le", "la", "l'"].includes(lower) && clauseStart(tokens, i) && next && noun(next, "s") && !noun(next, "p") && (!COLLECTIVE_FR.has(next.lower) || next.lower === "nombre")
                        && ["de", "d'", "des", "du"].includes(text(i + 2))) {
                        let k = i + 3;
                        if (text(i + 2) === "de" && ["la", "l'", "les", "ces", "mes", "tes", "ses", "nos", "vos", "leurs"].includes(text(k))) {
                            k++;
                        }
                        if (tokens[k] && noun(tokens[k], "p") && !noun(tokens[k], "s")) {
                            const v = nextFiniteVerb(tokens, k + 1);
                            const verb = v > 0 ? verbAt(tokens, v) : null;
                            if (verb && morph(tokens[v]).filter((m) => /:V/.test(m)).every((m) => /:3p/.test(m))) {
                                const form = conj.getConj(verb.lemma, `:${verb.tense}`, ":3s");
                                if (form && form !== tokens[v].lower) {
                                    add(tokens[v], tokens[v].end, form, `Le sujet est « ${token.text} ${next.text} » (singulier) : « ${form} ».`, "accord_sujet_verbe", "conjugaison");
                                }
                            }
                        }
                    }

                    // R5. Sujet inversé au pluriel : « À quelle heure arrive les invités ? »,
                    //     « Dans la vitrine trônait deux pièces montées. »
                    if (next && (DET_PLUR.has(next.lower) || QUANTITY_DETS.has(next.lower)) && !has(token, /:[NAQWGRD]/) && morph(token).some((m) => /:V[^/]*:(Ip|Iq|Is|If)[^/]*:3s/.test(m))) {
                        let n = i + 2;
                        if (tokens[n] && isPureAdjective(tokens[n]) && tokens[n + 1] && noun(tokens[n + 1], "p")) {
                            n++;
                        }
                        let end = n + 1;
                        while (tokens[end] && !tokens[end].punct && has(tokens[end], /:[AQ]/) && !has(tokens[end], /:V[^/]*:(Ip|Iq|Is|If|K)/) && end - n <= 2) {
                            end++;
                        }
                        const closes = !tokens[end] || tokens[end].punct || ["de", "du", "des", "d'", "et"].includes(tokens[end].lower);
                        const sentence = tokens.slice(0, i).reverse();
                        const startIdx = sentence.findIndex((t) => /^[.!?]$/.test(t.text));
                        const before = startIdx >= 0 ? sentence.slice(0, startIdx).reverse() : sentence.reverse();
                        const question = ["heure", "quand", "où", "comment", "pourquoi", "combien"].includes(text(i - 1));
                        const locative = before.length >= 2 && ["dans", "sur", "sous", "devant", "derrière", "au", "aux", "parmi", "près", "entre", "contre", "là-bas", "ici"].includes(before[0].lower)
                            && !before.some((t) => SUBJECTS.has(t.lower) || (!t.punct && has(t, /:V[^/]*:(Ip|Iq|Is|If|K)/) && !has(t, /:[NAD]/)));
                        if (tokens[n] && noun(tokens[n], "p") && !noun(tokens[n], "s") && closes && (question || locative)) {
                            const verb = verbAt(tokens, i);
                            const form = verb ? conj.getConj(verb.lemma, `:${verb.tense}`, ":3p") : null;
                            if (form && form !== lower) {
                                add(token, token.end, keepCase(token.text, form), `Le sujet, placé après le verbe, est au pluriel : « ${form} ».`, "accord_sujet_verbe", "conjugaison");
                            }
                        }
                    }

                    // R6. Concordance : « Il m'avait promis qu'il viendra » → viendrait.
                    if (["que", "qu'"].includes(lower) && i > 0) {
                        const before = tokens.slice(Math.max(0, i - 4), i);
                        const pastSay = before.some((t) => morph(t).some((m) => /:V[^/]*:Iq/.test(m) && SAY_THINK.has(lemmaOf(m))))
                            || (before.some((t) => ["avait", "avais", "aviez", "avions", "avaient"].includes(t.lower)) && before.some((t) => morph(t).some((m) => /:Q/.test(m) && SAY_THINK.has(lemmaOf(m)))));
                        if (pastSay) {
                            let j = i + 1;
                            if (SUBJECTS.has(text(j)) || ["j'"].includes(text(j))) {
                                j++;
                            } else {
                                const endSubject = subjectGroupEnd(tokens, j);
                                j = endSubject >= 0 ? endSubject + 1 : -1;
                            }
                            while (j > 0 && tokens[j] && CLITICS.has(tokens[j].lower) && !["le", "la", "les", "l'"].includes(tokens[j].lower) && j - i <= 5) {
                                j++;
                            }
                            const v = j > 0 ? tokens[j] : null;
                            const entry = v ? morph(v).find((m) => /:V[^/]*:If/.test(m)) : null;
                            if (entry && !has(v, /:[NA]/) && !/demain|prochain|bientôt/.test(line.slice(v.end))) {
                                const person = personOf(entry);
                                const form = person ? conj.getConj(lemmaOf(entry), ":K", `:${person}`) : null;
                                if (form && form !== v.lower) {
                                    add(v, v.end, form, `Concordance des temps : après un passé, « ${form} » (futur dans le passé).`, "concordance", "conjugaison");
                                }
                            }
                        }
                    }

                    // R7. « Si tu m'appelles ce soir, je te dirais tout » → dirai (si + présent → futur).
                    const condEntry = morph(token).find((m) => /:V[^/]*:K/.test(m));
                    if (condEntry && !morph(token).some((m) => /:V[^/]*:If/.test(m)) && !POLITE.has(lemmaOf(condEntry)) && !has(token, /:[NA]/)) {
                        const sentenceStart = sentenceOf(token.start);
                        if (/^\s*(?:si\s|s['’]ils?\s)/iu.test(sentenceStart) && !/^\s*si\s+ce\s+n/iu.test(sentenceStart) && /,/.test(sentenceStart) && !hypotheticalPast(tokens, token.start - sentenceStart.length, token.start, sentenceStart)) {
                            const siTokens = tokens.filter((t) => t.start >= token.start - sentenceStart.length && t.start < token.start - sentenceStart.length + sentenceStart.indexOf(","));
                            const presentInSi = siTokens.some((t) => has(t, /:V[^/]*:Ip/) && !has(t, /:[NA]/));
                            const person = subjectPerson(tokens, i) ?? personOf(condEntry);
                            const form = presentInSi && person ? conj.getConj(lemmaOf(condEntry), ":If", `:${person}`) : null;
                            if (form && form !== lower) {
                                add(token, token.end, form, `Avec « si » + présent, la suite est au futur : « ${form} ».`, "futur_conditionnel", "conjugaison");
                            }
                        }
                    }

                    // R8. « Je te rendrais ton livre la semaine prochaine » (pronoms entre « je » et le verbe) ;
                    //     « je voudrai deux places » → voudrais (demande polie, pas de date à venir).
                    if (/(?:rai|rais)$/.test(lower) && CLITICS.has(text(i - 1)) && (["je", "j'"].includes(text(i - 2)) || (CLITICS.has(text(i - 2)) && ["je", "j'"].includes(text(i - 3))))) {
                        const cond = morph(token).find((m) => /:V[^/]*:K[^/]*:1s/.test(m));
                        const fut = morph(token).find((m) => /:V[^/]*:If[^/]*:1s/.test(m));
                        const sentenceStart = sentenceOf(token.start);
                        if (cond && !fut && FUTURE_HINT.test(line) && !HYPOTHESIS.test(sentenceStart) && !/\bsi\b/i.test(sentenceStart) && !POLITE.has(lemmaOf(cond))) {
                            const form = conj.getConj(lemmaOf(cond), ":If", ":1s");
                            if (form) {
                                add(token, token.end, form, `Un fait à venir : futur, « ${form} ».`, "futur_conditionnel", "conjugaison");
                            }
                        }
                    }
                    if (["voudrai", "aimerai", "souhaiterai", "préférerai", "désirerai"].includes(lower) && (["je", "j'"].includes(text(i - 1)) || (CLITICS.has(text(i - 1)) && ["je", "j'"].includes(text(i - 2))))
                        && !FUTURE_HINT.test(line) && !/\b(?:toujours|jamais|quand|lorsque|dès)\b/i.test(line)
                        && next && (has(next, /:Y/) || ["bien", "beaucoup"].includes(next.lower) || (lower === "voudrai" && (ALL_DETS.has(next.lower) || QUANTITY_DETS.has(next.lower) || ["un", "une", "du", "de", "d'"].includes(next.lower))))) {
                        add(token, token.end, `${lower}s`, `Demande polie : conditionnel, « ${lower}s ».`, "futur_conditionnel", "conjugaison");
                    }
                }

                // R9. Pronominaux sans objet direct : « se sont nuis » → nui, « se sont rendus compte » → rendu.
                {
                    let k = i - 1;
                    while (k >= 0 && ["pas", "jamais", "plus", "guère", "point", "bien", "vraiment", "toujours", "déjà", "même"].includes(text(k))) {
                        k--;
                    }
                    const reflexive = BE_FORMS.has(text(k)) && ["se", "s'", "nous", "vous", "me", "m'", "te", "t'"].includes(text(k - 1) === "ne" || text(k - 1) === "n'" ? text(k - 2) : text(k - 1));
                    if (reflexive) {
                        const fix = PRONOMINAL_INVARIABLE[lower]
                            ?? (/^rendue?s?$/.test(lower) && lower !== "rendu" && text(i + 1) === "compte" ? "rendu" : null)
                            ?? (/^demandée?s?$/.test(lower) && lower !== "demandé" && ["si", "s'", "pourquoi", "comment", "ce", "qui", "quand", "où", "combien"].includes(text(i + 1)) ? "demandé" : null);
                        if (fix && !(lower === "souris" && !BE_FORMS.has(text(i - 1)))) {
                            add(token, token.end, fix, `« ${fix} » reste invariable : le pronom n'est pas complément d'objet direct.`, "ppas_pronominal_invariable", "accord");
                        }
                    }
                }

                // R10. « qu'elle a faits livrer » → fait (fait + infinitif reste invariable) ; « qu'il y a eue » → eu.
                if (["faits", "faite", "faites"].includes(lower) && AVOIR_FORMS.has(text(i - 1)) && next && has(next, /:Y/)) {
                    add(token, token.end, "fait", "« fait » suivi d'un infinitif reste invariable.", "fait_infinitif", "accord");
                }
                if (["eue", "eus", "eues"].includes(lower) && ["a", "avait", "aura", "aurait"].includes(text(i - 1)) && text(i - 2) === "y" && ["il", "qu'il"].includes(text(i - 3))) {
                    add(token, token.end, "eu", "« il y a eu » est impersonnel : « eu » reste invariable.", "il_y_a_eu", "accord");
                }

                // R12. « La voiture qu'il a acheté d'occasion » → achetée (le COD « que » est placé avant).
                if (["que", "qu'"].includes(lower) && hasConj && i >= 2 && noun(prev, null) && !/^\p{Lu}/u.test(prev.text)) {
                    const detIndex = ALL_DETS.has(text(i - 2)) ? i - 2 : (isPureAdjective(tokens[i - 2]) && ALL_DETS.has(text(i - 3)) ? i - 3 : -1);
                    if (detIndex >= 0 && !["ce", "cet"].includes(text(detIndex)) || (detIndex >= 0 && text(detIndex) === "cette")) {
                        let j = i + 1;
                        if (SUBJECTS.has(text(j))) {
                            j++;
                        } else {
                            const endSubject = subjectGroupEnd(tokens, j);
                            j = endSubject >= 0 ? endSubject + 1 : -1;
                        }
                        while (j > 0 && tokens[j] && ["ne", "n'"].includes(tokens[j].lower)) {
                            j++;
                        }
                        const aux = j > 0 ? tokens[j] : null;
                        const cleft = /\b(?:c['’]est|c['’]était|ce\s+n['’]est|se\s+n['’]est|c['’]étaient)\b/i.test(line.slice(0, token.start));
                        const timeNoun = ["années", "ans", "mois", "jours", "semaines", "heures", "fois", "temps", "minutes", "siècles", "décennies", "moment", "instant"].includes(prev.lower);
                        let p = j + 1;
                        while (tokens[p] && ["bien", "déjà", "jamais", "pas", "toujours", "souvent", "enfin", "finalement", "vite", "même"].includes(tokens[p].lower)) {
                            p++;
                        }
                        const pp = tokens[p];
                        const after = tokens[p + 1];
                        const nounMorph = morph(prev).find((m) => /:N/.test(m)) ?? "";
                        const det = text(detIndex);
                        const gender = /:f/.test(nounMorph) ? "f" : /:m/.test(nounMorph) ? "m" : ["la", "une", "cette", "ma", "ta", "sa"].includes(det) ? "f" : ["le", "un", "mon", "ton", "son"].includes(det) ? "m" : null;
                        const number = DET_PLUR.has(det) ? "p" : "s";
                        const lemma = pp ? infinitiveOf(pp) : null;
                        const impersonalFait = pp?.lower === "fait" && text(i + 1) === "il";
                        const objectAfter = after && !after.punct && (ALL_DETS.has(after.lower) || /^\p{Lu}/u.test(after.text) || ["au", "aux", "à", "que", "qu'", "ce", "cela", "ça", "tout", "rien"].includes(after.lower) || has(after, /:Y/)
                            || (["de", "d'"].includes(after.lower) && tokens[p + 2] && (has(tokens[p + 2], /:Y/) || ALL_DETS.has(tokens[p + 2].lower))));
                        if (aux && AVOIR_FORMS.has(aux.lower) && pp && isParticiple(pp) && gender && lemma && !NO_QUE_AGREEMENT.has(lemma) && !impersonalFait && !cleft && !timeNoun
                            && morph(pp).some((m) => /:Q[^/]*:m:s/.test(m)) && !objectAfter
                            && !(gender === "m" && number === "s")) {
                            const form = inflectAdjective(pp, gender, number);
                            if (form && form !== pp.lower) {
                                add(pp, pp.end, form, `Le complément « que » (${prev.text}) est placé avant avoir : accord, « ${form} ».`, "ppas_relative", "accord");
                            }
                        }
                    }
                }

                // R14. Modal + participe en -i/-u : « Tu pourras sorti les poubelles », « Laisse-moi réfléchi ».
                if (hasConj && /(?:i|u|is|us)$/.test(lower) && lower.length > 2 && !SUBJECTS.has(lower) && isParticiple(token) && !has(token, /:[NY]/) && /^\p{Ll}/u.test(token.text) && !/on\s+ne\s+peut\s+(?:plus|moins|mieux)/i.test(line)) {
                    let k = i - 1;
                    while (k >= 0 && ["aussi", "bien", "pas", "plus", "jamais", "encore", "vite", "toujours", "me", "m'", "te", "t'", "se", "s'", "lui", "leur", "y", "en", "nous", "vous", "moi", "toi"].includes(text(k)) && i - k <= 3) {
                        k--;
                    }
                    const head = tokens[k];
                    const modal = head && !head.punct && morph(head).some((m) => /:V[^/]*:(Ip|Iq|If|K|E)/.test(m) && ["pouvoir", "devoir", "vouloir", "savoir", "aller", "falloir", "laisser", "oser", "préférer", "espérer", "compter"].includes(lemmaOf(m)));
                    const clitic = ["le", "la", "les", "l'"].includes(text(k - 1));
                    const objectAfter = !next || next.punct || ALL_DETS.has(next.lower) || ["un", "une", "ça", "cela", "tout", "rien", "peu", "avant", "après", "demain", "ce", "de", "d'", "à"].includes(next.lower);
                    const lemma = infinitiveOf(token);
                    if (modal && !clitic && objectAfter && lemma && /(?:ir|re|oir)$/.test(lemma) && !["être", "avoir"].includes(lemma) && (head.text.includes("-") ? /^laisse/i.test(head.text) : true)) {
                        add(token, token.end, lemma, `Après « ${head.text} », le verbe se met à l'infinitif : « ${lemma} ».`, "prep_infinitif", "conjugaison");
                    }
                }
                // « Laisse-moi réfléchi » : le verbe et le pronom ne forment qu'un mot (« Laisse-moi »).
                if (hasConj && /(?:i|u)$/.test(lower) && isParticiple(token) && prev && /^(?:laisse|laissez|laissons)-(?:moi|nous|le|la|les|lui|leur)$/i.test(prev.text)) {
                    const lemma = infinitiveOf(token);
                    if (lemma && /(?:ir|re|oir)$/.test(lemma)) {
                        add(token, token.end, lemma, `Après « ${prev.text} », le verbe se met à l'infinitif : « ${lemma} ».`, "prep_infinitif", "conjugaison");
                    }
                }

                // R15. Homophones.
                // « Ce film et beaucoup trop long » → est.
                if (lower === "et" && i >= 2 && ALL_DETS.has(text(i - 2)) && noun(prev, "s") && clauseStart(tokens, i - 2)) {
                    let k = i + 1;
                    while (tokens[k] && ["beaucoup", "trop", "très", "vraiment", "plutôt", "assez", "si", "tellement", "super", "hyper", "pas", "toujours", "déjà", "encore", "bien", "un", "peu"].includes(tokens[k].lower) && k - i <= 3) {
                        k++;
                    }
                    if (k > i + 1 && tokens[k] && has(tokens[k], /:A/) && !has(tokens[k], /:V/) && (!tokens[k + 1] || tokens[k + 1].punct || ["à", "pour", "de", "d'"].includes(tokens[k + 1].lower))) {
                        add(token, token.end, "est", "« et » relie ; ici, c'est le verbe être : « est ».", "et_est");
                    }
                }
                // « on a rien compris » → on n'a rien ; « On entend rien » → On n'entend rien.
                if (lower === "on" && next && !next.punct && VOWEL_START.test(next.lower) && tokens[i + 2] && ["rien", "jamais", "personne", "guère", "aucun", "aucune", "nulle"].includes(tokens[i + 2].lower) && morph(next).some((m) => /:V[^/]*:(Ip|Iq|If|K)[^/]*:3s/.test(m))) {
                    const neg = `on n'${next.text}`;
                    add(token, next.end, neg, "Négation : il manque « ne » (on n'a rien, on ne voit rien).", "on_n");
                }
                // « Ce n'est n'y le lieu ni le moment » → ni.
                if (lower === "n'" && next?.lower === "y" && tokens[i + 2] && ALL_DETS.has(tokens[i + 2].lower) && tokens.slice(i + 3, i + 9).some((t) => t.lower === "ni")) {
                    add(token, next.end, "ni", "« ni… ni » : la négation se répète, sans apostrophe.", "ny_ni");
                }
                // « ce modèle-si » → modèle-ci.
                if (/-si$/.test(lower) && tokens.slice(Math.max(0, i - 2), i).some((t) => ["ce", "cet", "cette", "ces"].includes(t.lower))) {
                    add(token, token.end, `${token.text.slice(0, -2)}ci`, "« -ci » marque ce qui est proche (ce modèle-ci).", "si_ci");
                }
                // « Il sans fiche » → s'en.
                if (lower === "sans" && prev && ["il", "elle", "on", "ils", "elles", "ne", "n'"].includes(prev.lower) && next && ["fiche", "fichent", "fout", "foutent", "moque", "moquent", "occupe", "occupent", "souvient", "souviennent", "doute", "doutent", "sort", "sortent", "rend", "rendent", "charge", "chargent", "va", "vont", "remet", "remettent", "veut", "veulent", "prend", "prennent", "sert", "servent"].includes(next.lower)) {
                    add(token, token.end, "s'en", "« s'en » (se + en) : il s'en fiche, il s'en va.", "sans_sen");
                }
                // « Les valises sont près, on peut y aller » → prêtes.
                if (lower === "près" && BE_FORMS.has(text(i - 1)) && (!next || next.punct) && !["de", "d'"].includes(text(i + 1))) {
                    const agreement = attributeSubject(tokens, i - 1);
                    const [g, n] = agreement ? agreement.split(":") : ["m", "s"];
                    const form = `prêt${g === "f" ? "e" : ""}${n === "p" ? "s" : ""}`;
                    add(token, token.end, form, "« près » = proche ; pour « préparé », c'est « prêt ».", "pres_pret");
                }
                // « par ce que il a mal dormi » → parce que.
                if (lower === "par" && next?.lower === "ce" && text(i + 2) === "que" && ["il", "ils", "elle", "elles", "on"].includes(text(i + 3))) {
                    add(token, tokens[i + 2].end, "parce que", "Cause : « parce que » en un mot.", "par_ce_que");
                }
                // « Pose ton sac la, sur la chaise » → là.
                if (lower === "la" && next && /^[,.!?;]$/.test(next.text) && prev && !prev.punct && line[token.start - 1] !== "-" && noun(prev, null) && !SUBJECTS.has(prev.lower) && !has(prev, /:V/)) {
                    add(token, token.end, "là", "« là » (lieu) prend un accent.", "la_la");
                }
                // « dans la cours » → cour.
                if (lower === "cours" && ["la", "une", "cette", "ma", "ta", "sa", "notre", "votre", "leur"].includes(text(i - 1))) {
                    add(token, token.end, "cour", "« la cour » (de récréation, d'immeuble) ; « le cours » (leçon).", "cours_cour");
                }
                // « Le feu est passé au vers » → vert ; « vert 20 h » → vers.
                if (lower === "vers" && prev?.lower === "au" && (!next || next.punct)) {
                    add(token, token.end, "vert", "La couleur : « vert ».", "vers_vert");
                }
                if (lower === "vert" && next && /^\d{1,2}$/.test(next.text) && /^\s*h\b|^\s*heures?\b|^\s*:\d/u.test(line.slice(next.end))) {
                    add(token, token.end, "vers", "Pour une heure approximative : « vers ».", "vert_vers");
                }
                // « Le mère a inauguré » → maire ; « au bord de la mère » → mer.
                if (lower === "mère" && ["le", "du", "au", "un", "ce", "monsieur"].includes(text(i - 1))) {
                    add(token, token.end, "maire", "« le maire » (de la commune) ; « la mère » (maman).", "mere_maire");
                }
                if (lower === "mère" && text(i - 1) === "la" && ((["de", "à"].includes(text(i - 2)) && ["bord", "bords", "vue", "mal", "fruits", "bain", "bains", "côté"].includes(text(i - 3))) || ["sur", "en"].includes(text(i - 2)))) {
                    add(token, token.end, "mer", "« la mer » (l'océan).", "mere_mer");
                }
                // « signé le contrat sang le lire » → sans ; « coûte sans euros » → cent.
                if (lower === "sang" && !["le", "du", "de", "mon", "ton", "son", "ce", "un", "notre", "votre", "leur"].includes(text(i - 1)) && next) {
                    let k = i + 1;
                    if (["le", "la", "les", "l'", "me", "m'", "te", "t'", "se", "s'", "lui", "y", "en"].includes(text(k))) {
                        k++;
                    }
                    if (tokens[k] && has(tokens[k], /:Y/) && (k > i + 1 || !has(tokens[k], /:N/))) {
                        add(token, token.end, "sans", "« sans » (préposition) ; « le sang » (liquide).", "sang_sans");
                    }
                }
                if (lower === "sans" && next && ["euros", "euro", "dollars", "francs", "mètres", "kilomètres", "km", "grammes", "pages", "mille", "kilos"].includes(next.lower) && !["de", "d'"].includes(text(i - 1))) {
                    add(token, token.end, "cent", "Le nombre : « cent ».", "sans_cent");
                }
                // « Ce quartier est très sur » → sûr.
                if (lower === "sur" && ["très", "vraiment", "trop", "bien", "assez", "si", "tellement", "pas", "plus", "moins"].includes(text(i - 1))
                    && (!next || next.punct || (["de", "d'"].includes(next.lower) && text(i - 1) !== "pas") || ["que", "qu'"].includes(next.lower))) {
                    add(token, token.end, "sûr", "« sûr » (certain, sans danger) prend un accent.", "sur_sur");
                }
                // « un a un », « peu a peu » → à.
                if (lower === "a" && prev && next && ((prev.lower === next.lower && ["un", "une", "deux", "pas", "mot", "face", "côte", "goutte", "petit", "peu", "tête", "main", "bout", "corps", "porte", "nez", "dos", "jour"].includes(prev.lower)) || (prev.lower === "petit" && next.lower === "petit"))) {
                    add(token, token.end, "à", "« un à un », « peu à peu » : préposition, avec un accent.", "a_prep");
                }
                // « Quelqu'un à une idée ? », « mon chien, qui à des problèmes » → a.
                if (lower === "à" && prev && ["quelqu'un", "qui", "personne", "chacun"].includes(prev.lower) && !(prev.lower === "qui" && ["à", "de", "pour", "avec", "chez"].includes(text(i - 2)))
                    && next && ["un", "une", "des", "du", "beaucoup", "peur", "faim", "soif", "froid", "chaud", "raison", "tort", "besoin", "envie", "mal", "hâte", "été", "eu", "fait", "dit", "pris", "mis", "vu", "reçu", "toujours", "déjà", "encore", "jamais", "souvent", "aussi"].includes(next.lower)) {
                    add(token, token.end, "a", "Ici, c'est le verbe avoir : « a » (sans accent).", "a_verbe_avoir");
                }
                // « chez ces grands-parents » → ses (la famille de quelqu'un).
                if (lower === "ces" && ["chez", "avec", "à", "pour", "de"].includes(text(i - 1)) && next && KINSHIP.has(next.lower) && !(tokens[i + 2] && (["qui", "que", "qu'", "dont", "-là", "là"].includes(tokens[i + 2].lower) || line[next.end] === "-"))) {
                    add(token, token.end, "ses", "« ses » (les siens) ; « ces » montre (ces gens-là).", "ces_ses");
                }

                // R16. Élisions : « jusque à » → jusqu'à, « Lorsque elle » → Lorsqu'elle, « de une » → d'une.
                if (["jusque", "lorsque", "puisque", "quoique", "presque"].includes(lower) && next && (lower === "jusque" ? /^(?:à|au|aux|ici|alors|en|où|aujourd'hui)$/.test(next.lower) : lower === "presque" ? next.lower === "île" : /^(?:il|ils|elle|elles|on|un|une|en|ainsi)$/.test(next.lower))) {
                    add(token, next.end, `${token.text.slice(0, -1)}'${next.text}`, "Élision devant une voyelle.", "elision", "orthographe");
                }
                if (lower === "de" && next && ["une", "un", "elle", "elles", "eux", "ici"].includes(next.lower) && !(next.lower === "un" && ["à", "a"].includes(text(i + 2)))) {
                    add(token, next.end, `${token.text[0]}'${next.text}`, "Élision devant une voyelle : « d' ».", "elision", "orthographe");
                }
                if (["que", "si"].includes(lower) && next && (lower === "si" ? ["il", "ils"] : ["il", "ils", "elle", "elles", "on", "un", "une"]).includes(next.lower)) {
                    add(token, next.end, `${token.text.slice(0, -1)}'${next.text}`, "Élision devant une voyelle.", "elision", "orthographe");
                }

                // R17. Pluriels des noms composés : « coffre-forts » → coffres-forts.
                if (COMPOUND_PLURALS[lower]) {
                    add(token, token.end, keepCase(token.text, COMPOUND_PLURALS[lower]), `Pluriel du nom composé : « ${COMPOUND_PLURALS[lower]} ».`, "pluriel_compose", "accord");
                }

                // R18. Majuscules : fleuves (« longé la seine »), prénoms composés (« jean-pierre »), « Mr » → M.
                if (RIVERS[lower] && token.text === lower && ["la", "le", "l'"].includes(text(i - 1)) && tokens.slice(Math.max(0, i - 4), i - 1).some((t) => /^(?:long|longé|longer|longe|longeant|longeons|traversé|traverser|traverse|bord|bords|quais|quai|rive|rives|crue|pont|sur|descendre|descendu|remonter|remonté|navigué|naviguer|baignade|berges)$/.test(t.lower))) {
                    add(token, token.end, RIVERS[lower], "Nom de fleuve : majuscule.", "majuscule", "orthographe");
                }
                if (/^\p{Ll}+-\p{Ll}+$/u.test(token.text) && token.text.split("-").every((p) => FIRST_NAMES_FR.has(p)) && ["jean", "marie", "anne", "pierre", "louis", "paul", "marc", "luc", "jo"].includes(token.text.split("-")[0])) {
                    add(token, token.end, token.text.split("-").map((p) => p[0].toUpperCase() + p.slice(1)).join("-"), "Prénom : majuscule à chaque partie.", "majuscule", "orthographe");
                }
                if (token.text === "Mr" && next && /^\p{Lu}/u.test(next.text) && !/^\s*\./.test(line.slice(token.end))) {
                    add(token, token.end, "M.", "En français, « Monsieur » s'abrège « M. ».", "monsieur_abrege", "orthographe");
                }

                // R19. « est rentrée toute essoufflée » → tout (devant une voyelle, adverbe invariable).
                if (lower === "toute" && next && VOWEL_START.test(next.lower) && !/^h/.test(next.lower) && has(next, /:[AQ]/) && !has(next, /:N/) && prev && isParticiple(prev) && !["autre", "autres"].includes(next.lower)) {
                    add(token, token.end, "tout", "Devant un adjectif qui commence par une voyelle, « tout » (= tout à fait) reste invariable.", "toute_tout", "accord");
                }

                // R20. Adjectifs en -ant / -ent : « un trajet fatiguant » → fatigant.
                if (ADJ_ANT[lower] && (BE_FORMS.has(text(i - 1)) || ATTRIBUTE_ADVERBS.has(text(i - 1)) || ["super", "hyper", "tellement"].includes(text(i - 1)) || (prev && noun(prev, null) && !has(prev, /:V/) && (!next || next.punct || ["et", "mais", "ou"].includes(next.lower))))) {
                    add(token, token.end, ADJ_ANT[lower], `L'adjectif s'écrit « ${ADJ_ANT[lower]} » (le participe : « en ${lower} »).`, "adjectif_participe", "orthographe");
                }

                // R21. « Les candidats ayants réussi » → ayant (participe présent invariable).
                if (["ayants", "étants"].includes(lower) && !["droit", "cause"].includes(text(i + 1))) {
                    add(token, token.end, lower.slice(0, -1), "Le participe présent est invariable.", "participe_present", "accord");
                }

                // R22. « L'orateur conclue » → conclut (indicatif, pas subjonctif).
                if (["conclue", "exclue", "inclue"].includes(lower) && prev && (SUBJECTS.has(prev.lower) || (noun(prev, "s") && morph(prev).some((m) => /:N[^/]*:m/.test(m)) && !morph(prev).some((m) => /:N[^/]*:f/.test(m)))) && !tokens.slice(Math.max(0, i - 4), i).some((t) => ["que", "qu'"].includes(t.lower)) && !BE_FORMS.has(prev.lower) && !AVOIR_FORMS.has(prev.lower)) {
                    const form = lower.replace(/ues?$/, lower.endsWith("s") && ["tu", "je"].includes(prev.lower) ? "us" : "ut");
                    add(token, token.end, form, `Indicatif : « ${form} ».`, "conclure", "conjugaison");
                }

                // R24. Sujet pluriel séparé du verbe par une incise : « Les membres du conseil, réunis en
                //      séance, a approuvé » → ont ; « Les voisins, que je croise tous les jours, ne me dise » → disent.
                if (hasConj && i === 0 && DET_PLUR.has(lower) && next && noun(next, "p") && !noun(next, "s")) {
                    const commas = tokens.map((t, k) => (t.text === "," ? k : -1)).filter((k) => k > i + 1);
                    if (commas.length >= 2 && !tokens.slice(0, commas[1]).some((t) => /^[.!?;:]$/.test(t.text))) {
                        let v = commas[1] + 1;
                        while (tokens[v] && CLITICS.has(tokens[v].lower) && v - commas[1] <= 4) {
                            v++;
                        }
                        const verbToken = tokens[v];
                        const verb = verbToken && !verbToken.punct ? verbAt(tokens, v) : null;
                        // Entre le nom et la 1re virgule : seulement son complément (« du conseil d'administration »).
                        const plainSubject = tokens.slice(i + 2, commas[0]).every((t) => !has(t, /:V[^/]*:(Ip|Iq|Is|If|K)/) || has(t, /:[NA]/));
                        if (verb && plainSubject && !has(verbToken, /:[NAQWGRD]/) && morph(verbToken).filter((m) => /:V/.test(m)).every((m) => /:3s/.test(m))) {
                            const form = conj.getConj(verb.lemma, `:${verb.tense}`, ":3p");
                            if (form && form !== verbToken.lower) {
                                add(verbToken, verbToken.end, form, `Le sujet « ${token.text} ${next.text} » est au pluriel : « ${form} ».`, "accord_sujet_verbe", "conjugaison");
                            }
                        }
                    }
                }

                // R25. Couleur après un nom : « des bottes blanc » → blanches.
                if (["blanc", "noir", "vert", "bleu", "gris", "brun", "violet", "blond", "roux", "blanche", "noire", "verte", "bleue", "grise", "brune", "violette", "blonde", "rousse", "blancs", "noirs", "verts", "bleus", "bruns", "violets", "blonds"].includes(lower)
                    && prev && i >= 2 && ALL_DETS.has(text(i - 2)) && noun(prev, null) && !has(prev, /:V/)
                    // Couleur composée ou nuancée (« bleu foncé », « vert olive », « noir et blanc ») : invariable.
                    && (!next || next.punct || (["et", "ou"].includes(next.lower) && ALL_DETS.has(text(i + 2))) || ["à", "pour", "avec", "sur", "dans", "sous", "qui", "que", "est", "sont", "était", "a", "ont"].includes(next.lower))
                    && !(/s$/.test(lower) && !DET_PLUR.has(text(i - 2)))) {
                    const nounMorph = morph(prev).filter((m) => /:N/.test(m));
                    const gender = nounMorph.length && nounMorph.every((m) => /:f/.test(m)) ? "f" : nounMorph.length && nounMorph.every((m) => /:m/.test(m)) ? "m" : null;
                    const number = DET_PLUR.has(text(i - 2)) ? "p" : "s";
                    const form = gender ? inflectAdjective(token, gender, number) : null;
                    if (form && form !== lower) {
                        add(token, token.end, form, `L'adjectif s'accorde avec « ${prev.text} » : « ${form} ».`, "couleur_accord", "accord");
                    }
                }

                // « Quelqu'un à une idée ? » (« quelqu'un » est coupé en deux mots).
                if (lower === "à" && /quelqu['’]un\s*$/i.test(line.slice(0, token.start)) && next && ["un", "une", "des", "du", "le", "la", "les", "l'", "mon", "ma", "mes", "ton", "ta", "tes", "votre", "vos", "déjà", "encore", "besoin", "envie", "peur", "été", "eu", "vu", "fait", "pris"].includes(next.lower)) {
                    add(token, token.end, "a", "Ici, c'est le verbe avoir : « a » (sans accent).", "a_verbe_avoir");
                }
                // « aurions dû réserver plutôt, il n'y a plus de place » → plus tôt.
                if (lower === "plutôt" && (!next || next.punct) && tokens.slice(Math.max(0, i - 3), i).some((t) => ["dû", "aurais", "aurait", "aurions", "auriez", "auraient", "fallu"].includes(t.lower)) && prev && has(prev, /:Y/)) {
                    add(token, token.end, "plus tôt", "« plus tôt » = avant (en avance) ; « plutôt » = de préférence.", "plutot_plus_tot");
                }
                // « Joyeux Noel » → Noël.
                if (token.text === "Noel" && ["joyeux", "de", "à", "pour", "le", "du", "avant", "après", "depuis", "réveillon", "sapin", "marché", "vacances", "père"].includes(text(i - 1))) {
                    add(token, token.end, "Noël", "Noël prend un tréma.", "noel", "orthographe");
                }

                // R26. Homophones courants, dans les deux sens.
                const homophone = (fix, message, rule = "homophone_courant", end = token.end) => add(token, end, keepCase(token.text, fix), message, rule);
                const nextIs = (...words) => next && words.includes(next.lower);
                const afterPunct = !next || next.punct;
                // Genre du déterminant contre genre du nom : « le foi » → foie, « la père » → paire.
                // Seulement quand une erreur de déterminant est peu probable (« un paire de » est une faute d'article).
                const MASC = ["le", "un", "ce", "du", "au"];
                const FEM = ["la", "une", "cette"];
                const GENDER_SWAP = { foi: { m: "foie" }, cour: { m: "cours" }, foie: { f: text(i - 1) === "la" ? "foi" : "fois" } };
                const swap = GENDER_SWAP[lower]?.[MASC.includes(text(i - 1)) ? "m" : FEM.includes(text(i - 1)) ? "f" : "-"];
                if (swap && line[token.end] !== "-") {
                    homophone(swap, `Avec « ${prev.text} », le mot attendu est « ${swap} ».`);
                }
                // « dans là maison » → la.
                if (lower === "là" && line[token.end] !== "-" && next && noun(next, "s") && morph(next).some((m) => /:N[^/]*:f/.test(m)) && !has(next, /:[WV]/) && prev && PREPOSITIONS.has(prev.lower)) {
                    homophone("la", "« là » indique un lieu ; l'article, c'est « la ».");
                }
                // « ma mer » → mère.
                if (["mer", "maire"].includes(lower) && ["ma", "ta", "sa"].includes(text(i - 1))) {
                    homophone("mère", "« ma mère » (maman).");
                }
                // « du sans » → sang ; « cent doute » → sans.
                if (lower === "sans" && ["du", "le", "mon", "ton", "son"].includes(text(i - 1)) && line[token.end] !== "-" && (afterPunct || nextIs("froid", "chaud", "neuf", "qui", "a", "est", "coule", "coulait", "de"))) {
                    homophone("sang", "Le liquide : « le sang ».");
                }
                if (lower === "cent" && nextIs("doute", "cesse", "problème", "souci", "hésiter", "rien", "aucun", "aucune", "toi", "moi", "lui", "eux", "arrêt", "fin", "compter", "parler", "savoir", "faute", "blague", "rire")) {
                    homophone("sans", "Préposition : « sans ».");
                }
                // « sûr la table » → sur.
                if (["sûr", "sure"].includes(lower) && next && ["la", "le", "les", "l'", "un", "une", "des", "mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses", "notre", "votre", "leur", "ce", "cette", "internet", "place", "twitter", "facebook"].includes(next.lower) && !BE_FORMS.has(text(i - 1)) && !["bien", "pas", "très", "tout", "assez", "coup", "pour", "plus", "moins", "si", "trop"].includes(text(i - 1))) {
                    homophone("sur", "Préposition : « sur » (sans accent).");
                }
                // « prêt de la gare » → près.
                if (lower === "prêt" && ["de", "d'"].includes(text(i + 1)) && ["la", "l'", "chez", "ici", "moi", "toi", "lui", "nous", "vous", "eux", "elle", "elles", "chez"].includes(text(i + 2)) && !["un", "le", "ce", "mon", "du"].includes(text(i - 1))) {
                    homophone("près", "« près de » = à côté de ; « prêt » = préparé.");
                }
                // « ses jours-ci », « ses gens-là » → ces.
                if (lower === "ses" && next && /-(?:là|ci)$/.test(next.lower)) {
                    homophone("ces", "Démonstratif devant « -ci / -là » : « ces ».");
                }
                // « il ni a pas » → n'y.
                if (lower === "ni" && prev && ["il", "on", "elle", "ils", "elles", "je", "j'", "tu", "ça", "ne"].includes(prev.lower) && next && ["a", "avait", "aura", "aurait", "ait", "est", "était", "vais", "va", "vont", "allait", "peut", "pense", "crois", "comprends", "comprend", "connais", "arrive", "arrivent", "suis", "es", "sont", "reviens", "retourne", "vois", "voit", "allons", "allez"].includes(next.lower)) {
                    homophone("n'y", "« n'y » (ne + y) : il n'y a pas.");
                }
                // « quant il viendra » → quand ; « quand pensez-vous ? » → qu'en.
                if (lower === "quant" && next && !["à", "au", "aux", "a"].includes(next.lower)) {
                    homophone("quand", "« quant » s'emploie seulement dans « quant à » ; pour le temps, c'est « quand ».");
                }
                if (lower === "quand" && next && /^(?:pensez|penses|pense|dites|dis|dit|savez)-(?:vous|tu|il|elle|on)$/.test(next.lower)) {
                    homophone("qu'en", "« Qu'en pensez-vous ? » (que + en).");
                }
                // « de tant en tant » → temps ; « en même tant » → temps ; « temps pis » → tant.
                if (lower === "tant" && ((text(i - 1) === "de" && text(i + 1) === "en" && text(i + 2) === "tant") || (text(i - 1) === "en" && text(i - 2) === "tant" && text(i - 3) === "de") || (text(i - 1) === "même" && text(i - 2) === "en") || (text(i - 1) === "est" && nextIs("de", "d'") && tokens[i + 2] && has(tokens[i + 2], /:Y/)))) {
                    homophone("temps", "La durée : « temps » (de temps en temps, en même temps).");
                }
                if (lower === "temps" && (nextIs("pis", "mieux") || (text(i - 1) === "en" && text(i - 2) !== "temps" && nextIs("que", "qu'")))) {
                    homophone("tant", "« tant pis », « tant mieux », « en tant que ».");
                }
                // « en voix de disparition » → voie ; « à voie haute » → voix.
                if (lower === "voix" && text(i - 1) === "en" && nextIs("de", "d'")) {
                    homophone("voie", "« en voie de » (en train de).");
                }
                if (lower === "voie" && text(i - 1) === "à" && nextIs("haute", "basse")) {
                    homophone("voix", "« à voix haute ».");
                }
                // « il est sensé venir » → censé.
                if (/^sensée?s?$/.test(lower) && next && has(next, /:Y/) && !has(next, /:N/)) {
                    homophone(lower.replace("sensé", "censé"), "« censé » (supposé) + infinitif ; « sensé » = raisonnable.");
                }
                // « il y a d'avantage de monde » → davantage.
                if (lower === "d'" && next?.lower === "avantage" && (!tokens[i + 2] || tokens[i + 2].punct || ["de", "d'", "que", "qu'"].includes(tokens[i + 2].lower)) && !["pas", "aucun", "plus"].includes(text(i - 1))) {
                    add(token, next.end, "davantage", "« davantage » (= plus) en un mot.", "homophone_courant");
                }
                // « cette normal » → c'est normal.
                if (lower === "cette" && next && ["normal", "pas", "vrai", "bon", "dommage", "évident", "clair", "sûr", "mieux", "pareil", "ouf", "ça", "moi", "toi", "lui", "nous", "vous", "eux", "parti", "fini", "toujours", "déjà", "encore", "le", "la", "les", "un", "une", "quoi", "comme", "pour", "à", "au"].includes(next.lower)) {
                    homophone("c'est", "« cette » montre un nom ; ici, c'est « c'est » (ce + est).");
                }
                // « Mes parents son à la retraite » → sont ; « avec sont frère » → son.
                if (lower === "son" && next && (["à", "en", "là", "ici", "très", "trop", "pas", "bien", "déjà", "toujours", "encore", "tous", "toutes", "dans", "chez", "partis", "parties", "allés", "allées", "venus", "venues", "arrivés", "arrivées", "prêts", "prêtes", "contents", "contentes", "malades", "fatigués", "fatiguées", "en"].includes(next.lower) || has(next, /:Q[^/]*:p/))
                    && prev && (["ils", "elles"].includes(prev.lower) || (noun(prev, "p") && !noun(prev, "s") && DET_PLUR.has(text(i - 2))))) {
                    homophone("sont", "Verbe être : « sont » (ils sont).");
                }
                if (lower === "sont" && prev && (PREPOSITIONS.has(prev.lower) || (has(prev, /:V/) && !has(prev, /:[NA]/) && !["ils", "elles"].includes(text(i - 2)))) && next && noun(next, "s") && !noun(next, "p") && !has(next, /:[AQVW]/)) {
                    homophone("son", "Possessif : « son » (son frère).");
                }
                // « mes je ne sais pas » → mais.
                if (lower === "mes" && (i === 0 || prev.punct) && next && ["je", "j'", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles", "c'", "ça", "bon", "non", "oui", "pourquoi", "comment", "quand", "si"].includes(next.lower)) {
                    homophone("mais", "Conjonction : « mais ».");
                }
                // « monter en au » → en haut.
                if (lower === "au" && text(i - 1) === "en" && (afterPunct || nextIs("de", "du", "des"))) {
                    homophone("haut", "« en haut » (en hauteur).");
                }
                // « vin euros » → vingt ; « en vin » → en vain.
                if (["vin", "vain", "vins"].includes(lower) && next && ["euros", "euro", "ans", "minutes", "heures", "jours", "mètres", "kilos", "km", "personnes", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"].includes(next.lower) && !ALL_DETS.has(text(i - 1)) && text(i - 1) !== "de") {
                    homophone("vingt", "Le nombre : « vingt ».");
                }
                if (lower === "vin" && text(i - 1) === "en" && (afterPunct || nextIs("car", "mais", "et"))) {
                    homophone("vain", "« en vain » (inutilement).");
                }
                // « j'ai très fin » → faim ; « la faim du film » → fin.
                if (lower === "fin" && i >= 1 && (AVOIR_FORMS.has(text(i - 1)) || (["très", "trop", "tellement", "super", "vraiment"].includes(text(i - 1)) && AVOIR_FORMS.has(text(i - 2)))) && (afterPunct || nextIs("et", "mais", "donc", "alors", "maintenant", "là"))) {
                    homophone("faim", "« avoir faim » ; « la fin » = le bout.");
                }
                if (lower === "faim" && text(i - 1) === "la" && ["du", "des"].includes(text(i + 1)) || (lower === "faim" && text(i - 1) === "la" && text(i + 1) === "de" && ["la", "l'"].includes(text(i + 2)))) {
                    homophone("fin", "« la fin » (le bout) ; « la faim » = l'envie de manger.");
                }
                // « un cou de main » → coup ; « le coup de la vie » → coût.
                if (["cou", "coût", "cout"].includes(lower) && text(i + 1) === "de" && ["main", "fil", "pied", "poing", "téléphone", "foudre", "soleil", "vent", "chance", "bol", "cœur", "coeur", "tête", "feu", "pouce", "frein", "grâce", "génie", "pub", "stress", "mou", "bluff"].includes(text(i + 2))) {
                    homophone("coup", "« un coup de main », « un coup de fil ».");
                }
                if (["cou", "coût", "cout"].includes(lower) && text(i - 1) === "à" && text(i - 2) === "tout") {
                    homophone("coup", "« tout à coup » (soudain).");
                }
                if (lower === "coup" && text(i + 1) === "de" && ((text(i + 2) === "la" && text(i + 3) === "vie") || ["revient", "production", "transport", "fabrication"].includes(text(i + 2)))) {
                    homophone("coût", "Le prix : « le coût ».");
                }
                // « au fonds du couloir » → fond ; « ils fond » → font.
                if (lower === "fonds" && text(i - 1) === "au" && !["de", "monétaire", "d'"].includes(text(i + 1)) || (lower === "fonds" && text(i - 1) === "au" && text(i + 1) === "de" && !["commerce", "pension", "roulement", "garantie"].includes(text(i + 2)))) {
                    homophone("fond", "« au fond » (tout au bout) ; « les fonds » = l'argent.");
                }
                if (lower === "fond" && ["ils", "elles"].includes(text(i - 1))) {
                    homophone("font", "Verbe faire : « ils font ».");
                }
                // « avoir tord », « à tord » → tort.
                if (["tord", "tors"].includes(lower) && (AVOIR_FORMS.has(text(i - 1)) || ["à", "donner", "donne", "donné", "donnez"].includes(text(i - 1)))) {
                    homophone("tort", "« avoir tort », « à tort ».");
                }
                // « il ma dit » → m'a dit.
                if (["ma", "ta"].includes(lower) && prev && ["il", "elle", "on", "ça", "qui", "cela"].includes(prev.lower) && next && ["dit", "fait", "donné", "appelé", "répondu", "demandé", "écrit", "envoyé", "montré", "expliqué", "proposé", "aidé", "vu", "eu", "pris", "mis", "semblé", "plu", "manqué", "déçu", "surpris", "conseillé", "prévenu", "parlé", "offert", "rappelé", "laissé"].includes(next.lower)) {
                    homophone(`${lower[0]}'a`, `« ${lower[0]}'a » (me/te + a) : il ${lower[0]}'a dit.`);
                }
                // « pour quelle soit prête » → qu'elle.
                if (["quelle", "quelles"].includes(lower) && next && ["soit", "soient", "ait", "aient", "puisse", "puissent", "fasse", "fassent", "vienne", "viennent", "sache", "sachent", "veuille", "aille", "aillent", "parte", "partent", "comprenne", "prenne"].includes(next.lower)) {
                    homophone(lower === "quelle" ? "qu'elle" : "qu'elles", "« qu'elle » (que + elle) devant un verbe.");
                }
                // « il si prend mal » → s'y.
                if (lower === "si" && prev && ["il", "elle", "on", "ils", "elles", "ne"].includes(prev.lower) && next && ["prend", "prennent", "connaît", "connait", "attend", "attendait", "habitue", "met", "mettent", "trouve", "trouvent", "rend", "rendent", "plaît", "plait", "sent", "retrouve", "perd", "perdent", "intéresse", "intéressent", "oppose", "opposent"].includes(next.lower)) {
                    homophone("s'y", "« s'y » (se + y) : il s'y prend.");
                }
                // « un vers d'eau » → verre ; « un vers de terre » → ver.
                if (["vers", "vert", "ver"].includes(lower) && ["un", "le", "mon", "ce", "son", "ton", "un"].includes(text(i - 1)) && ["de", "d'"].includes(text(i + 1)) && ["eau", "vin", "lait", "jus", "bière", "cidre", "champagne", "rouge", "blanc", "rosé", "whisky", "soda"].includes(text(i + 2))) {
                    homophone("verre", "Le récipient : « un verre ».");
                }
                if (["vers", "vert", "verre"].includes(lower) && ["un", "le", "ce"].includes(text(i - 1)) && text(i + 1) === "de" && text(i + 2) === "terre") {
                    homophone("ver", "L'animal : « un ver de terre ».");
                }
                // « j'ai du partir » → dû.
                if (lower === "du" && (AVOIR_FORMS.has(text(i - 1)) || (["bien", "déjà", "pas", "vraiment", "même"].includes(text(i - 1)) && AVOIR_FORMS.has(text(i - 2)))) && next && has(next, /:Y/) && !has(next, /:N/)) {
                    homophone("dû", "Participe de devoir : « dû » (j'ai dû partir).");
                }

                // R28. Impératif avec trait d'union : « Envoyer-nous vos questions » → Envoyez-nous ;
                //      « puis faite-les revenir » → faites-les (vous si la phrase vouvoie ou emploie -ez).
                const hyphen = /^(\p{L}+)-(nous|moi|le|la|les|lui|leur|en|y|toi)$/u.exec(token.text);
                if (hasConj && hyphen && (clauseStart(tokens, i) || IMPERATIVE_LINKS.has(text(i - 1)))) {
                    const head = morph({ text: hyphen[1], lower: hyphen[1].toLowerCase(), punct: false });
                    const entry = head.find((m) => /:V/.test(m) && /:(?:Y|Q)(?=[:/]|$)/.test(m));
                    if (entry && !head.some((m) => /:E/.test(m))) {
                        const vous = hyphen[2] === "nous" || /\b\p{L}+ez\b/u.test(line.replace(token.text, "")) || /\bvous\b/i.test(line);
                        const form = conj.getConj(lemmaOf(entry), ":E", vous ? ":2p" : ":2s");
                        if (form) {
                            add(token, token.end, keepCase(token.text, `${form}-${hyphen[2]}`), `Impératif : « ${form}-${hyphen[2]} ».`, "imperatif_trait_union", "conjugaison");
                        }
                    }
                }

                // R29. Participe pris pour un verbe conjugué : « Les identifiants fournit par le prestataire
                //      ne fonctionnent pas » → fournis (le verbe de la phrase vient après).
                if (hasConj && next?.lower === "par" && prev && i >= 2 && DET_PLUR.has(text(i - 2)) && noun(prev, "p") && !has(token, /:Q/)
                    && morph(token).some((m) => /:V[^/]*:(?:Ip|Is)/.test(m)) && nextFiniteVerb(tokens, i + 2, 14) > 0) {
                    const lemma = infinitiveOf(token);
                    const gender = morph(prev).filter((m) => /:N/.test(m)).every((m) => /:f/.test(m)) ? "f" : "m";
                    const form = lemma ? conj.getConj(lemma, ":Q", `:${gender}:p`) : null;
                    if (form && form !== lower) {
                        // Une autre règle a pu y voir un verbe à accorder (« fournissent ») : celle-ci la remplace.
                        for (let k = currentResults.length - 1; k >= 0; k--) {
                            if (currentResults[k].start < token.end && token.start < currentResults[k].end) {
                                currentResults.splice(k, 1);
                            }
                        }
                        push(token, token.end, form, `Participe accordé avec « ${prev.text} » : « ${form} ».`, "participe_verbe", "accord");
                    }
                }

                // R27. « Je les ai vu hier » → vus / vues : « les » (complément placé avant) commande l'accord.
                if (lower === "les" && hasConj && next && AVOIR_FORMS.has(next.lower) && tokens[i + 2]) {
                    let p = i + 2;
                    while (tokens[p] && ["bien", "déjà", "jamais", "pas", "toujours", "souvent", "enfin", "vite", "tous", "toutes"].includes(tokens[p].lower)) {
                        p++;
                    }
                    const pp = tokens[p];
                    const after = tokens[p + 1];
                    const lemma = pp ? infinitiveOf(pp) : null;
                    if (pp && isParticiple(pp) && lemma && !NO_QUE_AGREEMENT.has(lemma) && morph(pp).some((m) => /:Q[^/]*:m:s/.test(m)) && !morph(pp).some((m) => /:Q[^/]*:[mf]:p/.test(m))
                        && !(after && (has(after, /:Y/) || ["de", "d'", "à"].includes(after.lower)))) {
                        const masculine = inflectAdjective(pp, "m", "p");
                        const feminine = inflectAdjective(pp, "f", "p");
                        if (masculine && masculine !== pp.lower) {
                            add(pp, pp.end, [masculine, feminine].filter(Boolean), `« les », placé avant avoir, commande l'accord du participe : « ${masculine} » (ou « ${feminine} » au féminin).`, "ppas_cod_avant", "accord");
                        }
                    }
                }

                // R23. « Le cavalier fît demi-tour » → fit (passé simple, pas subjonctif imparfait).
                if (["fît", "dît", "prît", "mît", "vît", "vînt", "tînt", "fîmes", "prîmes"].includes(lower) && !tokens.slice(Math.max(0, i - 6), i).some((t) => ["que", "qu'", "quoique", "afin", "bien"].includes(t.lower))) {
                    add(token, token.end, lower.replace("î", "i"), "Passé simple : sans accent circonflexe (il fit, il vint).", "passe_simple", "conjugaison");
                }
            });
        }

        function grammarRules(tokens, push, vetoes) {
            tokens.forEach((token, i) => {
                if (token.punct) {
                    return;
                }
                moreRules(tokens, i, push, vetoes);
                rulePronominalParticiple(tokens, i, push, vetoes);
                ruleRelativeParticiple(tokens, i, push, vetoes);
                ruleAttribute(tokens, i, push);
                ruleSubjectVerb(tokens, i, push);
                if (token.lower === "nous" || token.lower === "vous") {
                    ruleNousVous(tokens, i, push);
                }
                if (token.lower === "on") {
                    ruleOn(tokens, i, push);
                }
                if (PLURAL_DETS.has(token.lower)) {
                    rulePluralNoun(tokens, i, push);
                }
                if (token.lower === "tout") {
                    ruleTout(tokens, i, push);
                }
                // « prêt de la gare » → près de ; « prêt à partir », « prêt de partir » restent.
                const before = tokens[i - 1];
                const nounUse = before && (DET_SING.has(before.lower) || DET_PLUR.has(before.lower) || isPureAdjective(before));
                if (/^prête?s?$/.test(token.lower) && !nounUse && ["de", "d'", "du", "des"].includes(tokens[i + 1]?.lower)) {
                    // Après « de » : un déterminant, « chez » ou un nom propre (« prêt de la gare »,
                    // « prêt de chez toi », « prêt de Paris ») ; pas « prêt de partir » ni « prêt de cœur ».
                    const after = tokens[i + 1].lower === "du" || tokens[i + 1].lower === "des" ? tokens[i + 1] : tokens[i + 2];
                    const place = after && (["du", "des", "chez"].includes(after.lower) || DET_SING.has(after.lower) || DET_PLUR.has(after.lower) || (/^\p{Lu}/u.test(after.text) && has(after, /:M/)));
                    if (place) {
                        push(token, token.end, "près", MESSAGES.pres, "pret_pres", "homophone");
                    }
                }
                // « Va s'y » → Vas-y.
                if (["va", "vas"].includes(token.lower) && clauseStart(tokens, i) && tokens[i + 1]?.lower === "s'" && tokens[i + 2]?.lower === "y" && endOrPunct(tokens[i + 3])) {
                    push(token, tokens[i + 2].end, "vas-y", MESSAGES.vasy, "vas_y", "conjugaison");
                }
            });
            ruleConcordance(tokens, push);
            ruleDistantSubject(tokens, push);
            ruleInvertedSubject(tokens, push);
        }

        let currentResults = null;
        const lastResult = () => currentResults.at(-1);
        const keepCase = (original, replacement) => (replacement && /^\p{Lu}/u.test(original) ? replacement[0].toUpperCase() + replacement.slice(1) : replacement);

        // --- Français écrit soigné (réglage, décoché par défaut) ---
        const PROFESSIONS = new Set(["coiffeur", "coiffeuse", "médecin", "docteur", "dentiste", "boucher", "boulanger", "garagiste", "notaire", "pharmacien", "kiné", "kinésithérapeute", "opticien", "vétérinaire", "véto", "plombier", "avocat", "banquier", "épicier", "fleuriste", "libraire", "ophtalmo", "ophtalmologue", "dermato", "dermatologue", "psy", "psychologue", "psychiatre", "gynéco", "gynécologue", "ostéo", "ostéopathe", "orthodontiste", "cordonnier", "tailleur", "traiteur", "charcutier", "poissonnier", "généraliste", "pédiatre", "radiologue", "esthéticienne", "toiletteur"]);
        const NEG_WORDS = new Set(["personne", "rien", "aucun", "aucune", "nulle"]);
        const lemmaIs = (token, lemma) => !!token && morph(token).some((m) => /:V/.test(m) && lemmaOf(m) === lemma);

        // Locutions (« de temps en temps », « de moins en moins »), interrogatifs (« de quelle manière »)
        // et pronoms de personne (« se rappeler de moi », admis) : « de » n'y est pas fautif.
        const RAPPELER_DE_OK = new Set(["temps", "moins", "plus", "loin", "suite", "quelle", "quel", "quels", "quelles", "nouveau", "même", "près", "façon", "manière", "mieux", "bonne", "moi", "toi", "lui", "elle", "nous", "vous", "eux", "elles", "soi"]);

        // Vrai verbe pronominal : « je me rappelle », « tu te rappelles », « il se rappelle ».
        // « Cela me rappelle… » ou « je vais te rappeler » ne sont pas pronominaux.
        function reflexiveUse(tokens, i) {
            const window = tokens.slice(Math.max(0, i - 4), i).map((t) => t.lower);
            if (window.includes("se") || window.includes("s'")) {
                return true;
            }
            const pairs = [["me", "je"], ["m'", "je"], ["me", "j'"], ["m'", "j'"], ["te", "tu"], ["t'", "tu"]];
            if (pairs.some(([pronoun, subject]) => window.includes(pronoun) && window.includes(subject))) {
                return true;
            }
            return ["nous", "vous"].some((p) => window.filter((w) => w === p).length >= 2);
        }

        function registerRules(tokens, push, setKind) {
            tokens.forEach((token, i) => {
                const next = tokens[i + 1];
                if (token.punct || !next) {
                    return;
                }
                // « Je me rappelle de cette journée » → je me rappelle cette journée ;
                // « je me rappelle de l'avoir vu » (+ infinitif) reste.
                if (lemmaIs(token, "rappeler") && reflexiveUse(tokens, i) && ["de", "d'", "du", "des"].includes(next.lower)
                    && !RAPPELER_DE_OK.has(tokens[i + 2]?.lower)) {
                    let k = i + 2;
                    while (tokens[k] && OBJECT_PRONOUNS.has(tokens[k].lower)) {
                        k++;
                    }
                    // Infinitif juste après (« de l'avoir vu », « de tout ranger ») : construction admise.
                    const infinitive = [tokens[k], tokens[i + 2], tokens[i + 3]].some((t) => t && !t.punct && has(t, /:Y/));
                    if (tokens[i + 2] && !tokens[i + 2].punct && !infinitive) {
                        const fix = { du: "le", des: "les" }[next.lower] ?? "";
                        const end = fix ? next.end : tokens[i + 2].start;
                        push(next, end, fix, MESSAGES.rappeler, "se_rappeler_de", "français soigné");
                        setKind("style");
                    }
                }
                // « pallier à ce problème » → pallier ce problème.
                if (lemmaIs(token, "pallier") && ["à", "au", "aux"].includes(next.lower) && tokens[i + 2]) {
                    const fix = { au: "le", aux: "les" }[next.lower] ?? "";
                    push(next, fix ? next.end : tokens[i + 2].start, fix, MESSAGES.pallier, "pallier_a", "français soigné");
                    setKind("style");
                }
                // « aller au coiffeur » → chez le coiffeur.
                if (["au", "aux"].includes(token.lower) && PROFESSIONS.has(next.lower.replace(/s$/, "")) && tokens.slice(Math.max(0, i - 3), i).some((t) => lemmaIs(t, "aller"))) {
                    push(token, token.end, token.lower === "au" ? "chez le" : "chez les", MESSAGES.chez, "aller_chez", "français soigné");
                    setKind("style");
                }
                // « Je n'ai pas vu personne » → je n'ai vu personne ; « ce n'est pas rien » reste.
                if (token.lower === "pas" && next.lower !== "rien") {
                    let start = i - 1;
                    while (start >= 0 && !tokens[start].punct) {
                        start--;
                    }
                    const hasNe = tokens.slice(start + 1, i).some((t) => ["ne", "n'"].includes(t.lower));
                    const neg = tokens.slice(i + 1, i + 4).find((t) => NEG_WORDS.has(t.lower));
                    const beforeNeg = neg ? tokens[tokens.indexOf(neg) - 1] : null;
                    if (hasNe && neg && beforeNeg && !DET_SING.has(beforeNeg.lower) && !DET_PLUR.has(beforeNeg.lower) && !tokens.slice(i + 1, tokens.indexOf(neg)).some((t) => t.punct)) {
                        push(token, next.start, "", MESSAGES.doubleneg, "double_negation", "français soigné");
                    }
                }
            });
        }

        function find(line, options = {}) {
            const tokens = tokenize(line);
            currentResults = null;
            const apostrophe = line.includes("’") ? "’" : "'";
            const results = [];
            const push = (token, end, fix, message, rule, detail = "homophone") => {
                results.push({
                    start: token.start,
                    end,
                    kind: "grammaire",
                    detail,
                    message,
                    suggestions: [fix].flat().map((f) => keepCase(token.text, f.replace("'", apostrophe))),
                    rule: `aria_homophone_${rule}`,
                });
            };
            currentResults = results;
            // Passages jugés justes par une règle d'Aria : les fautes de Grammalecte qui s'y
            // trouvent sont retirées (« elles se sont écrit » n'est pas à accorder).
            results.vetoes = [];
            tokens.forEach((token, i) => {
                switch (token.lower) {
                    case "sa":
                        if (ruleSa(tokens, i)) {
                            push(token, token.end, "ça", MESSAGES.ca, "sa_ca");
                        }
                        break;
                    case "et":
                        if (ruleEt(tokens, i)) {
                            push(token, token.end, "est", MESSAGES.est, "et_est");
                        }
                        break;
                    case "à":
                        if (ruleA(tokens, i)) {
                            const agreement = participleAfterAvoir(tokens, i);
                            if (agreement) {
                                const [k, form] = agreement;
                                const between = line.slice(token.end, tokens[k].start);
                                push(token, tokens[k].end, `a${between}${form}`, MESSAGES.a, "a_a");
                            } else {
                                push(token, token.end, "a", MESSAGES.a, "a_a");
                            }
                        }
                        break;
                    case "ces":
                    case "ses":
                        if (ruleSest(tokens, i) && !clauseStart(tokens, i)) {
                            push(token, token.end, "s'est", MESSAGES.sest, "ses_sest");
                        } else if (ruleCest(tokens, i)) {
                            push(token, token.end, "c'est", MESSAGES.cest, "ces_cest");
                        }
                        break;
                    case "c'":
                        if (tokens[i + 1]?.lower === "est" && ruleSest(tokens.slice(0, i).concat([token], tokens.slice(i + 2)), i)) {
                            push(token, tokens[i + 1].end, "s'est", MESSAGES.sest, "cest_sest");
                        }
                        break;
                    case "on":
                        if (ruleOnt(tokens, i)) {
                            push(token, token.end, "ont", MESSAGES.ont, "on_ont");
                        }
                        break;
                    case "quel":
                    case "quelle":
                    case "quels":
                    case "quelles":
                        if (ruleQuel(tokens, i)) {
                            const plural = /s$/.test(token.lower) || has(tokens[i + 1], /:3p/);
                            push(token, token.end, plural ? "qu'elles" : "qu'elle", MESSAGES.quelle, "quel_quelle");
                        }
                        break;
                    case "ni":
                        if (ruleNi(tokens, i)) {
                            push(token, token.end, "n'y", MESSAGES.ny, "ni_ny");
                        }
                        break;
                    case "son":
                        if (ruleSon(tokens, i)) {
                            push(token, token.end, "sont", MESSAGES.sont, "son_sont");
                        }
                        break;
                    case "ce":
                        if (ruleCe(tokens, i)) {
                            push(token, token.end, "se", MESSAGES.se, "ce_se");
                        }
                        break;
                    case "ou":
                        if (ruleOu(tokens, i, line)) {
                            push(token, token.end, "où", MESSAGES.ou, "ou_ou");
                        }
                        break;
                    default:
                        break;
                }
            });
            grammarRules(tokens, push, results.vetoes);
            campaignRules(tokens, push, line);
            bigBenchRules(tokens, push, line);
            realRules(tokens, push, line);
            if (options.formal) {
                registerRules(tokens, push, (kind) => {
                    results.at(-1).kind = kind;
                });
            }
            return results;
        }

        // Genre et nombre du sujet d'un participe employé avec « être » (« la tâche planifiée était
        // désactivée », « les mots de passe doivent être changés ») : « f:s », « m:p »… ou null.
        const MODALS = new Set(["pouvoir", "devoir", "aller", "sembler", "paraître", "vouloir"]);
        function agreementBefore(line, offset) {
            const tokens = tokenize(line);
            let k = tokens.findIndex((t) => t.start >= offset) - 1;
            const skippable = (t) => BE_FORMS.has(t.lower) || ["être", "été", "ne", "n'", "pas", "plus", "jamais", "toujours", "bien", "déjà", "encore"].includes(t.lower)
                || (AVOIR_FORMS.has(t.lower.replace("à", "a")) && tokens[tokens.indexOf(t) + 1]?.lower === "été")
                || morph(t).some((m) => /:V/.test(m) && MODALS.has(lemmaOf(m)));
            while (k >= 0 && !tokens[k].punct && skippable(tokens[k])) {
                k--;
            }
            if (k < 0 || tokens[k].punct) {
                return null;
            }
            if (has(tokens[k], /:[AQ]/) && !has(tokens[k], /:N/) && k > 0 && noun(tokens[k - 1], null)) {
                k--;  // « la tâche planifiée »
            }
            if (k > 1 && ["de", "d'"].includes(tokens[k - 1].lower) && noun(tokens[k - 2], null)) {
                k -= 2;  // « les mots de passe »
            }
            return subjectAgreement(tokens, k);
        }

        // Accord d'un adjectif ou d'un participe (utilisé par le worker pour classer les suggestions de
        // Grammalecte) : « délicieux » → délicieuse pour « une tarte ».
        const inflectWord = (word, gender, number) => inflectAdjective({ text: word, lower: word.toLowerCase(), punct: false }, gender, number);
        // Genre d'un nom : "f", "m" ou null (épicène, inconnu, ou à la fois nom masculin et féminin).
        const nounGender = (word) => {
            const nouns = morph({ text: word, lower: word.toLowerCase(), punct: false }).filter((m) => /:N/.test(m));
            if (!nouns.length || nouns.some((m) => /:e/.test(m))) {
                return null;
            }
            return nouns.every((m) => /:f/.test(m)) ? "f" : nouns.every((m) => /:m/.test(m)) ? "m" : null;
        };
        return { find, agreementBefore, inflectWord, nounGender };
    }

    return { create, tokenize };
})();
