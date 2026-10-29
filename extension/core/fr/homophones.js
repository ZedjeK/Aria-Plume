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
        function ruleRelativeParticiple(tokens, i, push) {
            const entry = participleEntry(tokens[i]);
            if (!entry || !hasConj || NOT_PARTICIPLE.has(tokens[i].lower)) {
                return;
            }
            const lemma = lemmaOf(entry);
            if (NO_QUE_AGREEMENT.has(lemma) || !/^.{3}t/.test(conj.getVtyp(lemma) || "")) {
                return;
            }
            const next = tokens[i + 1];
            // « que » n'est complément du participe que si rien ne le remplace après : pas de complément
            // direct (« que j'ai découvert le pot »), pas de « de/à + infinitif » (« que j'ai essayé de
            // lire »), pas d'infinitif (« qu'il a fait construire »).
            if (next && !next.punct && !ETRE_FINITE.has(next.lower) && !["et", "mais", "ou", "hier", "aujourd'hui", "avant", "après", "pendant", "depuis", "pour", "avec", "dans", "sur", "chez", "sans", "par", "en"].includes(next.lower) && !(isAdverb(next) && !has(next, /:[NDR]/)) && !isTimeComplement(tokens, i + 1)) {
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
                || coordinated(tokens, start) || COMPLETIVE_NOUNS.has(nounToken.lower) || TIME_NOUNS.has(nounToken.lower.replace(/s$/, ""))) {
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
            if (morph(verb).some((m) => /:[NA]/.test(m) && (number === "p" || /:[si]/.test(m)))) {
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
            if (i > 0 && !opener.punct && !NOUS_OPENERS.has(opener.lower)) {
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
            const present = tense === "Iq" ? conj.getConj(lemma, ":Ip", person) : null;
            const sounding = present && sound(present) === sound(original) ? present : null;
            return [...new Set([sounding, same].filter((f) => f && f !== original))];
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
            // « nous nous sommes attaché à démontrer » : « nous » d'auteur, peut-être singulier.
            if (tokens[s].lower === "nous" && tokens[i + 1] && !tokens[i + 1].punct && !isTimeComplement(tokens, i + 1)) {
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

        function grammarRules(tokens, push, vetoes) {
            tokens.forEach((token, i) => {
                if (token.punct) {
                    return;
                }
                moreRules(tokens, i, push, vetoes);
                rulePronominalParticiple(tokens, i, push, vetoes);
                ruleRelativeParticiple(tokens, i, push);
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
        }

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

        return { find, agreementBefore };
    }

    return { create, tokenize };
})();
