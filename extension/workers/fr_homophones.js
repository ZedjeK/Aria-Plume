// Aria ODL — règles que Grammalecte laisse passer ou corrige mal : homophones (sa/ça, et/est,
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
    const AFTER_CEST = new Set(["moi", "toi", "lui", "eux", "ça", "cela", "le", "la", "l'", "un", "une", "mon", "ton", "son", "ma", "ta", "sa", "pour", "à", "au", "que", "qu'", "qui", "comme", "quand", "ici", "dommage", "ok"]);
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
    };
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
            if (!head || head.punct || !noun(head, number)) {
                return -1;
            }
            const dets = number === "s" ? DET_SING : number === "p" ? DET_PLUR : ALL_DETS;
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
            return nounPhraseBefore(tokens, i, "s") && isParticiple(next) && !has(next, /:N/);
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

        function ruleSest(tokens, i) {
            const next = tokens[i + 1];
            if (endOrPunct(next) || !isParticiple(next)) {
                return false;
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

        function grammarRules(tokens, push, vetoes) {
            tokens.forEach((token, i) => {
                if (token.punct) {
                    return;
                }
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

        const keepCase = (original, replacement) => (/^\p{Lu}/u.test(original) ? replacement[0].toUpperCase() + replacement.slice(1) : replacement);

        function find(line) {
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
                            push(token, token.end, "a", MESSAGES.a, "a_a");
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
            return results;
        }

        return { find };
    }

    return { create, tokenize };
})();
