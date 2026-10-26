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
    };
    // « 21an » → 21 ans : nombre collé à un nom de durée, de mesure ou de quantité courant.
    const GLUED_NUMBER = /^(\d+)(ans?|jours?|mois|semaines?|heures?|minutes?|secondes?|euros?|fois|kilos?|mètres?|kilomètres?|personnes?|pages?|lignes?|fichiers?|serveurs?|enfants?|places?)$/iu;
    const INVARIABLE_PLURAL = /[sx]$/;
    // « 12Go », « 20min » → 12 Go, 20 min : nombre collé à une unité (qui ne prend pas de s).
    const GLUED_UNIT = /^(\d+)(Ko|Mo|Go|To|ko|mo|go|to|min|km|kg|cm|mm|ms|Mbps|Gbps)$/u;
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
    const SUBJECT_AGREEMENT = { il: "m:s", elle: "f:s", ils: "m:p", elles: "f:p" };
    // Verbes souvent suivis d'un complément direct qui n'est pas le pronom (« se sont dit : … »,
    // « s'est fait mal », « se sont rendu compte ») : on ne propose pas d'accord.
    const OFTEN_INDIRECT = new Set(["dire", "donner", "faire", "laisser", "rendre", "permettre", "promettre", "offrir", "accorder", "envoyer", "acheter", "procurer", "poser", "fixer", "imposer", "partager", "échanger", "jurer", "rappeler", "imaginer", "figurer", "attribuer", "réserver", "souhaiter"]);
    const SI_WORDS = new Set(["si", "s'"]);
    const QUEL = new Set(["quel", "quelle", "quels", "quelles"]);
    const OBJECT_PRONOUNS = new Set(["me", "m'", "te", "t'", "se", "s'", "le", "la", "les", "l'", "lui", "leur", "y", "en", "ne", "n'", "nous", "vous"]);
    const ETRE = new Set(["est", "était", "sera", "serait", "soit", "fut", "sont", "étaient", "seront", "seraient", "soient"]);
    const SUBJECTS = new Set(["je", "j'", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles", "ça", "cela"]);

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
            const nounAfterDet = head && !head.punct && dets.has(tokens[j - 1]?.lower) && morph(head).some((m) => /:N/.test(m) && numberRe.test(m));
            if (!head || head.punct || !(noun(head, number) || nounAfterDet)) {
                return -1;
            }
            let k = j - 1;
            if (tokens[k] && !tokens[k].punct && isPureAdjective(tokens[k]) && dets.has(tokens[k - 1]?.lower)) {
                k--;
            }
            if (tokens[k] && dets.has(tokens[k].lower)) {
                return k;
            }
            return needDeterminer ? -1 : j;
        }

        // Groupe nominal sujet qui se termine en i - 1 : « le serveur », « le vieux serveur DNS »,
        // « les serveurs de production », « Marc ». Jamais après une préposition (« Après les cours on… »).
        function nounPhraseBefore(tokens, i, number) {
            const head = tokens[i - 1];
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
                if (after && SOFT_NEGATION.has(after.lower)) {
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
            if (!pronoun && !nounPhraseBefore(tokens, i, "s")) {
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
            return isParticiple(tokens[k]) && !has(tokens[k], /:N/) && !["de", "d'", "du", "des"].includes(tokens[k + 1]?.lower);
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
            if (!prev || !SUBJECTS.has(prev.lower) || endOrPunct(next)) {
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

        const hasConj = typeof conj !== "undefined";
        const participleEntry = (token) => morph(token).find((m) => /:Q/.test(m));
        const lemmaOf = (entry) => entry.slice(1, entry.indexOf("/"));

        // Genre et nombre attendus du sujet d'un verbe pronominal : « elles », « les filles ».
        function subjectAgreement(tokens, k) {
            const subject = tokens[k];
            if (!subject || subject.punct) {
                return null;
            }
            if (SUBJECT_AGREEMENT[subject.lower]) {
                return SUBJECT_AGREEMENT[subject.lower];
            }
            // Le groupe nominal doit ouvrir la proposition : dans « le bruit que Manuel avait découvert
            // une source s'était répandu », « une source » n'est pas le sujet de « s'était répandu ».
            const start = simpleNounPhrase(tokens, k + 1, null);
            if (start < 0 || !clauseStart(tokens, start) || ["que", "qu'"].includes(tokens[start - 1]?.lower)) {
                return null;
            }
            const det = tokens[start].lower;
            const nounMorph = morph(subject).filter((m) => /:N/.test(m));
            const gender = nounMorph.every((m) => /:f/.test(m)) ? "f" : nounMorph.every((m) => /:m/.test(m)) ? "m" : null;
            const number = DET_PLUR.has(det) ? "p" : DET_SING.has(det) ? "s" : null;
            return gender && number ? `${gender}:${number}` : null;
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
            if ((vtyp[5] !== "p" && vtyp[3] !== "t") || OFTEN_INDIRECT.has(lemma)) {
                return;
            }
            if (s > 0 && ["que", "qu'"].includes(tokens[s - 1].lower)) {
                return;  // « la prise qu'il s'était faite » : accord avec « que », placé avant
            }
            // Un complément après le participe (« lavé les mains », « fait avoir », « rendu compte ») :
            // le pronom n'est peut-être pas complément direct. On ne dit rien.
            const next = tokens[i + 1];
            const quiet = !next || (next.punct && !/[:«"“]/.test(next.text)) || PREPOSITIONS.has(next.lower) || (isAdverb(next) && !has(next, /:[ND]/))
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

        function moreRules(tokens, i, push) {
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
                moreRules(tokens, i, push);
                rulePronominalParticiple(tokens, i, push, vetoes);
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
