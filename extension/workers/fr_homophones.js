// Aria ODL — homophones que Grammalecte laisse passer (sa/ça, et/est, à/a, ces/ses/c'est/s'est, on/ont).
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
    };

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

        const keepCase = (original, replacement) => (/^\p{Lu}/u.test(original) ? replacement[0].toUpperCase() + replacement.slice(1) : replacement);

        function find(line) {
            const tokens = tokenize(line);
            const apostrophe = line.includes("’") ? "’" : "'";
            const results = [];
            const push = (token, end, fix, message, rule) => {
                results.push({
                    start: token.start,
                    end,
                    kind: "grammaire",
                    detail: "homophone",
                    message,
                    suggestions: [keepCase(token.text, fix.replace("'", apostrophe))],
                    rule: `aria_homophone_${rule}`,
                });
            };
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
                    default:
                        break;
                }
            });
            return results;
        }

        return { find };
    }

    return { create, tokenize };
})();
