// Aria Plume — formes verbales en anglais, d'après la nature des mots (WordNet et terminaisons, voir
// shared/ngrammes.js : natureOfEnglish) plutôt que des motifs écrits mot à mot :
//   - après un auxiliaire ou un modal : base verbale (« can goes », « didn't went », « Does she knows ») ;
//   - « let / make / help » + objet : base verbale (« made me to wait », « help me moved ») ;
//   - gérondif ou infinitif selon le verbe ou la préposition (« avoid to go », « decided going »,
//     « interested in learn », « thank you for help me », « getting used to work », « I use to play ») ;
//   - participe après have (« have went », « Has he wrote »), prétérit pour participe (« I seen »),
//     forme passive ou progressive (« was send », « was cook »), verbe régularisé (« teached ») ;
//   - temps et marqueur du passé (« Yesterday I go », « Last year we have visited », « If it will rain »,
//     « I live here since 2019 », « If I would have known ») ;
//   - accord d'un pronom ou d'un nom et de son verbe (« he go », « I has », « they was », « am agree »).
// On ne signale que ce dont on est sûr : dans le doute, rien.

const WORD = /[A-Za-z]+(?:[-'’][A-Za-z]+)*|\d+(?:[.,]\d+)*/g;

// --- Verbes irréguliers : base, prétérit, participe ---
const DIFFERENT = ("go went gone|do did done|see saw seen|take took taken|give gave given|write wrote written|eat ate eaten|drink drank drunk|begin began begun"
    + "|break broke broken|choose chose chosen|come came come|drive drove driven|fall fell fallen|fly flew flown|forget forgot forgotten|freeze froze frozen"
    + "|grow grew grown|hide hid hidden|know knew known|ride rode ridden|ring rang rung|rise rose risen|run ran run|shake shook shaken|sing sang sung"
    + "|sink sank sunk|speak spoke spoken|steal stole stolen|swim swam swum|throw threw thrown|wear wore worn|wake woke woken|blow blew blown|draw drew drawn"
    + "|bite bit bitten|tear tore torn|swear swore sworn|become became become|beat beat beaten|forgive forgave forgiven|shrink shrank shrunk"
    + "|mistake mistook mistaken|withdraw withdrew withdrawn|arise arose arisen|awake awoke awoken").split("|").map((s) => s.split(" "));
const SAME = ("buy bought|teach taught|think thought|catch caught|bring brought|build built|spend spent|leave left|feel felt|send sent|make made|keep kept"
    + "|lose lost|meet met|pay paid|say said|sell sold|sit sat|sleep slept|stand stood|tell told|understand understood|win won|find found|hold held|hear heard"
    + "|lead led|lend lent|fight fought|seek sought|deal dealt|mean meant|lay laid|swing swung|stick stuck|strike struck|dig dug|hang hung|get got"
    + "|cost cost|put put|cut cut|hit hit|set set|let let|shut shut|hurt hurt|quit quit|read read|spread spread|bet bet").split("|").map((s) => s.split(" "));
const PAST_OF = new Map();
const PP_OF = new Map();
const BASE_OF = new Map();   // prétérit ou participe → base
for (const [base, past, pp] of DIFFERENT) {
    PAST_OF.set(base, past);
    PP_OF.set(base, pp);
    BASE_OF.set(past, base);
    BASE_OF.set(pp, base);
}
for (const [base, past] of SAME) {
    PAST_OF.set(base, past);
    PP_OF.set(base, past);
    if (past !== base) {
        BASE_OF.set(past, base);
    }
}
// Formes identiques au présent et au passé : on ne peut pas dire laquelle est écrite.
const SAME_FORM = new Set(SAME.filter(([base, past]) => base === past).map(([base]) => base));
// Prétérits qui ne sont pas des participes : après « have », ce sont toujours des fautes.
const PERFECT_PAST_ONLY = new Set(DIFFERENT.filter(([, past, pp]) => past !== pp).map(([, past]) => past));
// Prétérits sûrs après « be » : sans « rose » (couleur) ni « bit » (« was bit by a dog »), ni « did » ou « came ».
const PASSIVE_PAST_ONLY = new Set([...PERFECT_PAST_ONLY].filter((word) => !["rose", "bit", "did", "came", "beat", "broke"].includes(word)));
// Prétérits sûrs après « to » ou un modal : les formes qui sont aussi un verbe, un nom ou un adjectif sont écartées.
const PAST_ONLY = new Set([...PERFECT_PAST_ONLY].filter((word) => !["saw", "rose", "bit", "tore", "spoke", "beat", "wore"].includes(word)));
// Participes qui ne sont pas des prétérits : « I seen », « He done it ».
const PP_ONLY = new Set(DIFFERENT.filter(([, past, pp]) => past !== pp && pp !== PAST_OF.get("go") && !["come", "become", "run"].includes(pp)).map(([, , pp]) => pp));
const PP_FROM_PAST = new Map(DIFFERENT.map(([, past, pp]) => [past, pp]));
const PAST_FROM_PP = new Map(DIFFERENT.map(([, past, pp]) => [pp, past]));
// Formes régularisées par erreur : « teached », « buyed »… (les verbes dont la forme régulière existe aussi sont écartés).
const NOT_REGULARIZED = new Set(["beat", "cost", "put", "cut", "hit", "set", "let", "shut", "hurt", "quit", "read", "spread", "bet", "get", "lay", "hang"]);
const FINAL_STRESS = new Set(["admit", "submit", "commit", "permit", "omit", "refer", "prefer", "occur", "control", "begin", "forget", "regret", "equip", "compel", "expel", "upset", "offset", "transfer", "rebel", "patrol"]);

const doubles = (word) => /[^aeiou][aeiou][^aeiouwxy]$/.test(word) && ((word.match(/[aeiouy]+/g) ?? []).length === 1 || FINAL_STRESS.has(word));
const pastRegular = (word) => (/e$/.test(word) ? `${word}d` : /[^aeiou]y$/.test(word) ? `${word.slice(0, -1)}ied` : doubles(word) ? `${word}${word.at(-1)}ed` : `${word}ed`);
const SAME_FORM_RE = /^(?:mis|re|over|under|out|up|type|off|inter|with|pre|un)(?:read|set|cut|put|hit|shut|hurt|quit|let|spread|bet|cost)$/;
const isSameForm = (word) => SAME_FORM.has(word) || SAME_FORM_RE.test(word);
const PREFIXES = ["re", "un", "mis", "over", "under", "out", "up", "with", "fore", "inter", "pre"];
const prefixed = (word, map) => {
    if (map.has(word)) {
        return map.get(word);
    }
    for (const prefix of PREFIXES) {
        if (word.startsWith(prefix) && map.has(word.slice(prefix.length))) {
            return prefix + map.get(word.slice(prefix.length));
        }
    }
    return null;
};
const pastOf = (word) => prefixed(word, PAST_OF) ?? (SAME_FORM_RE.test(word) ? word : pastRegular(word));
const ppOf = (word) => prefixed(word, PP_OF) ?? (SAME_FORM_RE.test(word) ? word : pastRegular(word));
const ingOf = (word) => (word === "be" ? "being" : /ie$/.test(word) ? `${word.slice(0, -2)}ying` : /[^eoy]e$/.test(word) ? `${word.slice(0, -1)}ing` : doubles(word) ? `${word}${word.at(-1)}ing` : `${word}ing`);
const thirdOf = (word) => ({ have: "has", do: "does", go: "goes", be: "is" }[word] ?? (/(s|sh|ch|x|z|o)$/.test(word) ? `${word}es` : /[^aeiou]y$/.test(word) ? `${word.slice(0, -1)}ies` : `${word}s`));
const REGULARIZED = new Map();
for (const [base] of [...DIFFERENT, ...SAME]) {
    if (!NOT_REGULARIZED.has(base)) {
        const regular = pastRegular(base);
        if (!BASE_OF.has(regular) && !PAST_OF.has(regular)) {
            REGULARIZED.set(regular, base);
        }
    }
}
REGULARIZED.set("costed", "cost");

// --- Mots de grammaire ---
const PRONOUNS = new Set(["i", "you", "he", "she", "it", "we", "they"]);
const PLURAL_PRONOUNS = new Set(["i", "you", "we", "they"]);
const SINGULAR_PRONOUNS = new Set(["he", "she", "it"]);
const ANIMATE = new Set(["i", "you", "he", "she", "we", "they"]);
const OBJECT_PRONOUNS = new Set(["me", "him", "her", "us", "them", "you", "it"]);
const INDEFINITE = new Set(["anyone", "anybody", "everyone", "everybody", "someone", "somebody", "nobody"]);
const DETERMINERS = new Set(["a", "an", "the", "my", "your", "his", "her", "our", "their", "its", "this", "that", "these", "those", "some", "any", "every", "each", "another", "no", "all", "both", "several", "many", "few"]);
const DO_FORMS = new Set(["do", "does", "did", "don't", "doesn't", "didn't"]);
const MODALS = new Set(["can", "could", "will", "would", "shall", "should", "may", "might", "must", "can't", "couldn't", "won't", "wouldn't", "shouldn't", "mustn't", "cannot",
    "i'll", "you'll", "we'll", "they'll", "he'll", "she'll", "it'll", "that'll"]);
const BE_FORMS = new Set(["am", "is", "are", "was", "were", "be", "been", "being", "isn't", "aren't", "wasn't", "weren't"]);
const BE_CONTRACTED = { "i'm": "i", "you're": "you", "we're": "we", "they're": "they" };
const GET_FORMS = new Set(["get", "gets", "got", "getting", "gotten"]);
const PERFECT_AUX = new Set(["have", "has", "had", "haven't", "hasn't", "hadn't", "i've", "you've", "we've", "they've"]);
const WH = new Set(["what", "where", "when", "why", "how", "who", "whom", "whose", "which", "long", "often", "much", "many", "far", "soon"]);
const ADVERBS = new Set(["not", "never", "always", "also", "just", "really", "still", "even", "only", "ever", "probably", "definitely", "actually", "already", "often", "usually", "sometimes", "simply", "quickly", "finally", "totally", "completely", "currently", "soon", "now", "then", "again", "once", "twice"]);
const CLEFT = new Set(["all", "what", "do", "does", "did"]);   // « All I did was test » : infinitif nu voulu
const SUBJUNCTIVE = new Set(["suggest", "suggested", "suggests", "recommend", "recommended", "recommends", "insist", "insisted", "insists", "demand", "demanded", "demands", "request", "requested", "require", "required", "propose", "proposed", "important", "essential", "necessary", "vital", "imperative", "crucial", "desire", "rather", "wish", "wished"]);
const COMPLEMENT_VERBS = new Set(["let", "lets", "make", "makes", "made", "making", "help", "helps", "helped", "have", "has", "had", "watch", "watched", "see", "saw", "hear", "heard", "feel", "felt", "notice", "noticed", "want", "wants", "wanted", "need", "needs", "needed", "like", "get", "got", "gets", "getting", "keep", "keeps", "kept"]);
const PREP_SET = new Set(("to for in on at with from by about before after during under over through across into onto of off up out down back around between against since until while and or but because so if when that than as there here again then now today tonight tomorrow yesterday soon").split(" "));
// Verbes qui sont aussi des noms de matière : « tired of work », « without pay », « the key is practice ».
const MASS_VERBS = new Set("work rest help sleep love hate hope travel research change progress damage trouble practice fear care use pay play show fun cost need".split(" "));
const AGENT_NOUN = /(?:er|or|ist|ian|ant|ent)$/;
const INFINITIVE_TAKERS = new Set("want wants need needs like likes love loves hate hates try tries plan plans hope hopes expect expects prefer prefers wish wishes decide decides intend intends begin begins start starts continue continues".split(" "));
const AMBIGUOUS_PAST = new Set(["saw", "rose", "bit", "tore", "spoke", "wore", "fell", "stole"]);
const COGNITION = new Set("think thinks believe believes know knows guess guesses hope hopes suppose supposes say says mean means feel feels doubt wonder bet imagine understand remember".split(" "));
const STATIVE = new Set("know understand believe remember want need prefer".split(" "));
const DURATIVE = new Set("live work know study teach own".split(" "));
const INDIRECT = new Set(["know", "wonder", "ask", "asked", "tell", "told", "sure", "idea", "see", "check", "depends", "whether", "matter", "doubt", "curious", "wondering", "asking"]);
const INFINITIVE_MARKERS = new Set("about want wants wanted need needs needed going trying try tries tried able have has had ought wish wished hope hoped decide decided plan planned afraid ready supposed".split(" "));
const PAST_UNITS = /^(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?|decades?)$/;
const PERIODS = /^(?:week|month|year|night|summer|winter|spring|fall|autumn|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)$/;
const SOLO_TIME = new Set(["every", "each", "always", "usually", "often", "never", "sometimes", "tomorrow", "next", "will", "would", "if", "unless", "whenever", "typically", "normally", "generally"]);

const GERUND_STRICT = new Set();
const GERUND_SOFT = new Set();
const INFINITIVE_VERBS = new Set();
const INFINITIVE_PAST = new Set();
for (const [target, lemmas] of [[GERUND_STRICT, "enjoy avoid finish imagine practice quit delay postpone resent appreciate mind"], [GERUND_SOFT, "keep suggest consider risk deny admit"]]) {
    for (const lemma of lemmas.split(" ")) {
        for (const form of [lemma, thirdOf(lemma), pastOf(lemma), ingOf(lemma)]) {
            target.add(form);
        }
    }
}
for (const lemma of "decide promise afford refuse hope manage agree fail offer attempt pretend threaten tend plan".split(" ")) {
    for (const form of [lemma, thirdOf(lemma), pastOf(lemma)]) {
        INFINITIVE_VERBS.add(form);
    }
    INFINITIVE_PAST.add(pastOf(lemma));
}
const ADJECTIVE_PREPOSITION = { interested: "in", tired: "of", afraid: "of", capable: "of", proud: "of", ashamed: "of", guilty: "of", good: "at", bad: "at", great: "at", excited: "about", worried: "about", sorry: "for", keen: "on", responsible: "for", famous: "for", accused: "of", suspected: "of", instead: "of" };
const VERB_PREPOSITION = new Map();
for (const [forms, preposition] of [["think thinks thought thinking", "about"], ["talk talks talked talking", "about"], ["worry worries worried worrying", "about"], ["dream dreams dreamed dreamt dreaming", "of"],
    ["insist insists insisted insisting", "on"], ["succeed succeeds succeeded succeeding", "in"], ["apologize apologizes apologized apologizing apologise apologised", "for"], ["believe believes believed believing", "in"]]) {
    for (const form of forms.split(" ")) {
        VERB_PREPOSITION.set(form, preposition);
    }
}

const sameCase = (original, fix) => (/^[A-Z]/.test(original) ? fix[0].toUpperCase() + fix.slice(1) : fix);

export function findVerbForms(text, natureOf) {
    const found = [];
    const add = (first, last, fix, rule, message) => {
        const start = first.start;
        const end = last.end;
        const original = text.slice(start, end);
        if (!fix || fix.toLowerCase() === original.toLowerCase() || found.some((m) => m.start < end && m.end > start)) {
            return;
        }
        found.push({ start, end, kind: "grammaire", detail: "aria", message, suggestions: [sameCase(original, fix)], rule: `aria_en_verbe_${rule}` });
    };
    for (const sentence of text.matchAll(/[^.!?;:\n]+[.!?]?/g)) {
        const tokens = [...sentence[0].matchAll(WORD)].map((m) => {
            const lower = m[0].toLowerCase().replace("’", "'");
            return { text: m[0], lower, start: sentence.index + m.index, end: sentence.index + m.index + m[0].length, nature: natureOf(m[0]) };
        });
        if (tokens.length < 2) {
            continue;
        }
        const tags = (t) => (t ? t.nature.split("+") : []);
        const has = (t, tag) => tags(t).includes(tag);
        const proper = (t, i) => i > 0 && /^[A-Z]/.test(t.text) && !PRONOUNS.has(t.lower);
        const spaced = (a, b) => /^\s+$/.test(text.slice(a.end, b.start));
        const isVerb = (word) => natureOf(word).split("+").includes("V");
        // Forme de base d'un verbe écrit à la 3e personne ou au passé (« goes », « finished »), si elle existe.
        const baseOfWord = (t) => {
            const word = t.lower;
            if (BASE_OF.has(word) && BASE_OF.get(word) !== word) {
                return BASE_OF.get(word);
            }
            const candidates = [];
            if (/ied$/.test(word)) {
                candidates.push(`${word.slice(0, -3)}y`);
            }
            if (/ies$/.test(word)) {
                candidates.push(`${word.slice(0, -3)}y`);
            }
            if (/ed$/.test(word)) {
                candidates.push(word.slice(0, -2), word.slice(0, -1), word.slice(0, -3));
            }
            if (/es$/.test(word)) {
                candidates.push(word.slice(0, -2), word.slice(0, -1));
            } else if (/s$/.test(word)) {
                candidates.push(word.slice(0, -1));
            }
            return candidates.find((c) => c.length > 1 && isVerb(c));
        };
        const baseOfIng = (t) => {
            if (!/ing$/.test(t.lower) || t.lower.length < 5) {
                return null;
            }
            const stem = t.lower.slice(0, -3);
            return [stem.replace(/(.)\1$/, "$1"), stem, `${stem}e`].find((c) => isVerb(c) && ingOf(c) === t.lower) ?? null;
        };
        const skipAdverbs = (j) => {
            while (tokens[j] && (ADVERBS.has(tokens[j].lower) || tokens[j].nature === "W")) {
                j++;
            }
            return j;
        };
        const startsObject = (t) => !!t && (DETERMINERS.has(t.lower) || OBJECT_PRONOUNS.has(t.lower) || t.nature === "#");
        const closes = (t, end = false) => (t ? startsObject(t) || has(t, "W") || PREP_SET.has(t.lower) : end);
        // Un mot qui peut être un verbe de base (même s'il est aussi un nom) : on l'a déjà reconnu comme verbe par son contexte.
        const verbLoose = (j) => {
            const t = tokens[j];
            return !!t && !proper(t, j) && has(t, "V") && !has(t, "G") && (!has(t, "D") || isSameForm(t.lower)) && !(/s$/.test(t.lower) && has(t, "S:V"));
        };
        // Un verbe de base dont rien n'indique qu'il soit un nom : seulement verbe, ou verbe devant un complément.
        const verbHere = (j, strict = false) => {
            const t = tokens[j];
            if (!verbLoose(j)) {
                return false;
            }
            if (has(t, "N") || has(t, "A")) {
                const next = tokens[j + 1];
                const closer = startsObject(next) || (!!next && (has(next, "W") || /^(?:for|in|on|at|with|from|by|about|into|onto|off|up|out|down|back|around|between|against|through|across|under|over|during)$/.test(next.lower)));
                return !strict && (MASS_VERBS.has(t.lower) ? startsObject(next) : closer);
            }
            return true;
        };
        const isQuestion = /\?\s*$/.test(sentence[0]);
        const startsQuestion = (i) => isQuestion && tokens.slice(0, i).every((x) => WH.has(x.lower));
        // Indice du premier mot après le sujet d'une question (pronom, nom propre, déterminant + nom), ou -1.
        const afterSubject = (j) => {
            const subject = tokens[j];
            if (!subject) {
                return -1;
            }
            if (PRONOUNS.has(subject.lower) || INDEFINITE.has(subject.lower) || proper(subject, j)) {
                return j + 1;
            }
            if (DETERMINERS.has(subject.lower) && tokens[j + 1] && spaced(subject, tokens[j + 1]) && (has(tokens[j + 1], "N") || has(tokens[j + 1], "S:N") || ["?", "M"].includes(tokens[j + 1].nature))) {
                return j + 2;
            }
            return -1;
        };

        // --- Après un auxiliaire ou un modal : la base verbale ---
        tokens.forEach((t, i) => {
            if (!DO_FORMS.has(t.lower) && !MODALS.has(t.lower) && !PERFECT_AUX.has(t.lower)) {
                return;
            }
            const perfect = PERFECT_AUX.has(t.lower);
            const before = tokens[i - 1];
            if (!perfect && before && (DETERMINERS.has(before.lower) || /['’]s$/.test(before.text) || BE_FORMS.has(before.lower))) {
                return;  // « the can opens », « the will to live »
            }
            const mainVerb = ["do", "does", "did"].includes(t.lower);
            let j = skipAdverbs(i + 1);
            const inverted = startsQuestion(i);
            if (inverted) {
                const subject = tokens[j];
                const k = afterSubject(j);
                if (k >= 0) {
                    const word = subject.lower;
                    if (t.lower === "do" && (SINGULAR_PRONOUNS.has(word) || INDEFINITE.has(word))) {
                        add(t, t, "does", "aux_accord", `Avec « ${subject.text} », « does ».`);
                    } else if (t.lower === "does" && PLURAL_PRONOUNS.has(word)) {
                        add(t, t, "do", "aux_accord", `Avec « ${subject.text} », « do ».`);
                    } else if (t.lower === "have" && (SINGULAR_PRONOUNS.has(word) || INDEFINITE.has(word))) {
                        add(t, t, "has", "aux_accord", `Avec « ${subject.text} », « has ».`);
                    } else if (t.lower === "has" && PLURAL_PRONOUNS.has(word)) {
                        add(t, t, "have", "aux_accord", `Avec « ${subject.text} », « have ».`);
                    }
                    j = skipAdverbs(k);
                } else if (!["who", "what", "which"].includes(tokens[0].lower)) {
                    return;  // « Who has threw » : « who » est le sujet, le verbe suit
                }
            }
            const verb = tokens[j];
            if (!verb || proper(verb, j)) {
                return;
            }
            if (t.lower === "must" && verb.lower === "needs") {
                return;
            }
            if (perfect) {
                // Participe après « have » (« Has he wrote », « I haven't did »).
                if (PERFECT_PAST_ONLY.has(verb.lower) && !(AMBIGUOUS_PAST.has(verb.lower) && has(verb, "N") && tokens[j + 1] && (has(tokens[j + 1], "N") || has(tokens[j + 1], "A")) && !startsObject(tokens[j + 1]))) {
                    add(verb, verb, PP_FROM_PAST.get(verb.lower), "participe", `Après « ${t.text} », le participe passé (${PP_FROM_PAST.get(verb.lower)}).`);
                }
                return;
            }
            if (MODALS.has(t.lower) && verb.lower === "to" && verbLoose(j + 1) && !(before && (has(before, "A") || has(before, "G")))) {
                add(verb, tokens[j + 1], tokens[j + 1].lower, "modal_to", `Après « ${t.text} », pas de « to » : la base verbale seule.`);
                return;
            }
            const message = `Après « ${t.text} », le verbe reste à la base.`;
            const nounRisk = mainVerb && !inverted;
            if (["has", "had"].includes(verb.lower)) {
                add(verb, verb, "have", "aux_base", message);
            } else if (verb.lower === "does" && !mainVerb) {
                add(verb, verb, "do", "aux_base", message);
            } else if (has(verb, "S:V") && !has(verb, "V") && !(nounRisk && (has(verb, "S:N") || has(verb, "N")))) {
                add(verb, verb, baseOfWord(verb), "aux_base", message);
            } else if (BASE_OF.has(verb.lower) && BASE_OF.get(verb.lower) !== verb.lower && !["saw", "lay", "wound", "found", "bore"].includes(verb.lower) && !(nounRisk && has(verb, "N"))) {
                add(verb, verb, BASE_OF.get(verb.lower), "aux_base", message);
            } else if (has(verb, "D") && !has(verb, "V") && !PAST_OF.has(verb.lower) && !BASE_OF.has(verb.lower)) {
                const base = baseOfWord(verb);
                if (base && !(nounRisk && (has(verb, "A") || has(verb, "N")))) {
                    add(verb, verb, base, "aux_base", message);
                }
            } else if (has(verb, "G") && baseOfIng(verb) && !nounRisk) {
                add(verb, verb, baseOfIng(verb), "aux_base", message);
            }
        });

        // --- let / make / help + pronom objet : la base verbale, sans « to » ---
        tokens.forEach((t, i) => {
            if (!["let", "lets", "make", "makes", "made", "making", "help", "helps", "helped"].includes(t.lower)) {
                return;
            }
            const helping = t.lower.startsWith("help");
            const object = tokens[i + 1];
            if (!object || !OBJECT_PRONOUNS.has(object.lower) || object.lower === "it") {
                return;
            }
            const x = tokens[i + 2];
            if (!helping && x?.lower === "to" && verbLoose(i + 3)) {
                add(x, tokens[i + 3], tokens[i + 3].lower, "causatif_to", `Après « ${t.text} » et son objet, pas de « to » : la base verbale seule.`);
            } else if (x && !proper(x, i + 2) && has(x, "D") && !has(x, "V") && !PAST_OF.has(x.lower) && !BASE_OF.has(x.lower)) {
                const base = baseOfWord(x);
                if (base && isVerb(base) && !has(x, "N")) {
                    add(x, x, base, "causatif_base", `Après « ${t.text} » et son objet, la base verbale.`);
                }
            }
        });

        // --- Gérondif ou infinitif selon le verbe ---
        tokens.forEach((t, i) => {
            const strict = GERUND_STRICT.has(t.lower);
            if ((strict || GERUND_SOFT.has(t.lower)) && !proper(t, i)) {
                const before = tokens[i - 1];
                if (before && (DETERMINERS.has(before.lower) || PREP_SET.has(before.lower) || (has(before, "A") && !PRONOUNS.has(before.lower)))) {
                    return;  // « common practice to… », « in mind to… » : un nom
                }
                let back = i - 1;
                while (back >= 0 && (ADVERBS.has(tokens[back].lower) || tokens[back].nature === "W")) {
                    back--;
                }
                if (/ed$/.test(t.lower) && tokens[back] && BE_FORMS.has(tokens[back].lower)) {
                    return;  // « I am not minded to answer »
                }
                const j = skipAdverbs(i + 1);
                const next = tokens[j + 1];
                const keepLike = ["keep", "keeps", "kept", "keeping"].includes(t.lower);
                if (tokens[j]?.lower === "to" && next && verbLoose(j + 1)) {
                    const noun = has(next, "N") || has(next, "A");
                    const ok = !noun || (strict && !MASS_VERBS.has(next.lower)) || (!keepLike && closes(tokens[j + 2], false)) || (keepLike && closes(tokens[j + 2], false) && !startsObject(tokens[j + 2]));
                    if (ok) {
                        add(tokens[j], next, ingOf(next.lower), "gerondif", `Après « ${t.text} », la forme en -ing.`);
                    }
                }
            }
            if (INFINITIVE_VERBS.has(t.lower) && !proper(t, i)) {
                const before = tokens[i - 1];
                if (before && (DETERMINERS.has(before.lower) || /['’]s$/.test(before.text))) {
                    return;
                }
                const subjectBefore = !before || PRONOUNS.has(before.lower) || MODALS.has(before.lower) || DO_FORMS.has(before.lower)
                    || ["to", "not", "never", "also", "just", "already", "and", "but", "really"].includes(before.lower);
                if (!INFINITIVE_PAST.has(t.lower) && !subjectBefore) {
                    return;
                }
                const g = tokens[i + 1];
                if (g && !proper(g, i + 1) && has(g, "G") && baseOfIng(g) && spaced(t, g) && closes(tokens[i + 2], true)) {
                    add(g, g, `to ${baseOfIng(g)}`, "infinitif", `Après « ${t.text} », « to » et la base verbale.`);
                }
            }
            // « can't help to laugh », « look forward to see », « in order of finish »
            if (["help", "helped", "helping"].includes(t.lower) && i > 0 && /^(?:can't|cannot|couldn't|can|could|won't)$/.test(tokens[i - 1].lower) && tokens[i + 1]?.lower === "to" && verbLoose(i + 2)) {
                add(tokens[i + 1], tokens[i + 2], ingOf(tokens[i + 2].lower), "gerondif", `Après « ${tokens[i - 1].text} help », la forme en -ing.`);
            }
            if (/^look(?:s|ed|ing)?$/.test(t.lower) && tokens[i + 1]?.lower === "forward" && tokens[i + 2]?.lower === "to" && verbHere(i + 3, false)) {
                add(tokens[i + 3], tokens[i + 3], ingOf(tokens[i + 3].lower), "look_forward", "Après « look forward to », la forme en -ing.");
            }
            if (t.lower === "order" && tokens[i - 1]?.lower === "in" && tokens[i + 1]?.lower === "of" && verbLoose(i + 2)) {
                add(tokens[i + 1], tokens[i + 1], "to", "in_order_to", "« in order to » + la base verbale.");
            }
        });

        // --- Gérondif après une préposition ---
        tokens.forEach((t, i) => {
            let j = null;
            if (ADJECTIVE_PREPOSITION[t.lower] && tokens[i + 1]?.lower === ADJECTIVE_PREPOSITION[t.lower]) {
                j = i + 2;
            } else if (VERB_PREPOSITION.has(t.lower) && tokens[i + 1]?.lower === VERB_PREPOSITION.get(t.lower) && !proper(t, i)) {
                j = i + 2;
            } else if (["thank", "thanks", "thanked"].includes(t.lower)) {
                const k = OBJECT_PRONOUNS.has(tokens[i + 1]?.lower) ? i + 2 : i + 1;
                if (tokens[k]?.lower === "for") {
                    j = k + 1;
                }
            } else if (t.lower === "without") {
                j = i + 1;
            } else if (["after", "before", "while"].includes(t.lower) && tokens[i + 1] && verbLoose(i + 1) && !has(tokens[i + 1], "N") && !has(tokens[i + 1], "A") && startsObject(tokens[i + 2])) {
                j = i + 1;
            }
            if (j !== null && verbHere(j, false)) {
                add(tokens[j], tokens[j], ingOf(tokens[j].lower), "preposition_ing", `Après « ${t.text} », la forme en -ing.`);
            }
        });

        // --- « used to » ---
        tokens.forEach((t, i) => {
            const before = tokens[i - 1];
            if (t.lower === "use" && before && PRONOUNS.has(before.lower) && tokens[i + 1]?.lower === "to" && verbLoose(i + 2) && !(tokens[i - 2] && (DO_FORMS.has(tokens[i - 2].lower) || WH.has(tokens[i - 2].lower) || has(tokens[i - 2], "N")))) {
                add(t, t, "used", "used_to", "« I used to… » : habitude passée, avec « used ».");
            }
            if (t.lower === "used" && tokens[i + 1]?.lower === "to" && verbHere(i + 2, false)) {
                let k = i - 1;
                while (k >= 0 && (ADVERBS.has(tokens[k].lower) || tokens[k].nature === "W")) {
                    k--;
                }
                const be = tokens[k];
                const getting = be && (GET_FORMS.has(be.lower) || ["become", "becomes", "became", "becoming"].includes(be.lower));
                const animate = be && ((BE_FORMS.has(be.lower) && tokens[k - 1] && ANIMATE.has(tokens[k - 1].lower)) || BE_CONTRACTED[be.lower]);
                if (getting || animate) {
                    add(tokens[i + 2], tokens[i + 2], ingOf(tokens[i + 2].lower), "used_to_ing", "« get used to » et « be used to » (être habitué à) se construisent avec la forme en -ing.");
                }
            }
        });

        // --- Participe après be ou get, et progressif ---
        const closesPassive = (t, end = false, extra = "") => (t
            ? has(t, "W") || (extra !== "" && t.lower === extra)
                || /^(?:in|on|at|for|with|from|by|about|into|over|up|out|down|back|around|until|since|after|before|during|through|across|under|between|against|again|twice|now|today|tonight|tomorrow|yesterday|soon|right|even|already|yet)$/.test(t.lower)
            : end);
        tokens.forEach((t, i) => {
            const contracted = BE_CONTRACTED[t.lower];
            if (!BE_FORMS.has(t.lower) && !GET_FORMS.has(t.lower) && !contracted) {
                return;
            }
            const j = skipAdverbs(i + 1);
            const x = tokens[j];
            if (!x || proper(x, j) || !spaced(t, tokens[i + 1])) {
                return;
            }
            if (PASSIVE_PAST_ONLY.has(x.lower) || (x.lower === "broke" && closesPassive(tokens[j + 1], false))) {
                add(x, x, PP_FROM_PAST.get(x.lower), "passif", `Au passif, le participe passé (${PP_FROM_PAST.get(x.lower)}).`);
                return;
            }
            if (GET_FORMS.has(t.lower)) {
                return;
            }
            const base = x.lower;
            if (!has(x, "V") || has(x, "G") || has(x, "D") || has(x, "A") || has(x, "S:V") || STATIVE.has(base) || base === "agree" || base === "disagree" || MODALS.has(base) || PRONOUNS.has(base)
                || DO_FORMS.has(base) || BE_FORMS.has(base) || PERFECT_AUX.has(base) || !/^[a-z]+$/.test(base) || base.length < 3) {
                return;
            }
            // Le sujet : le mot avant « be », en passant sur have et les modaux (« has been cancel », « will be pay »).
            let k = i - 1;
            while (k >= 0 && (PERFECT_AUX.has(tokens[k].lower) || MODALS.has(tokens[k].lower) || ADVERBS.has(tokens[k].lower) || tokens[k].lower === "to")) {
                k--;
            }
            const subject = contracted ? { lower: contracted } : tokens[k];
            if (!subject || subject.lower === "there" || tokens.slice(Math.max(0, k - 6), k + 1).some((y) => CLEFT.has(y.lower))) {
                return;
            }
            const being = t.lower === "being";
            const modalBe = t.lower === "be" && !!tokens[i - 1] && (MODALS.has(tokens[i - 1].lower) || tokens[i - 1].lower === "to");
            const animate = ANIMATE.has(subject.lower);
            const next = tokens[j + 1];
            const noun = !contracted && (has(subject, "N") || has(subject, "S:N") || INDEFINITE.has(subject.lower) || subject.lower === "it");
            if (!animate && !noun && !modalBe && !being) {
                return;
            }
            const irregular = PP_OF.has(base) && PP_OF.get(base) !== base;
            const pp = irregular ? PP_OF.get(base) : ppOf(base);
            if (animate && !being) {
                // Sujet qui agit : forme progressive, s'il y a un complément derrière (« she was teach English »).
                const objectNext = startsObject(next) || (!!next && (has(next, "N") || has(next, "S:N") || next.nature === "M") && !has(next, "V") && !has(next, "D"))
                    || (!!next && /^(?:on|in|at|for|with|through|around|over)$/.test(next.lower));
                if (next && next.lower === "by") {
                    add(x, x, pp, "passif", `Au passif, le participe passé (${pp}).`);
                } else if (objectNext) {
                    add(x, x, ingOf(base), "progressif", `Forme progressive : « ${t.text} » + la forme en -ing.`);
                }
                return;
            }
            if (being || modalBe) {
                if (closesPassive(next, true, "to") || /^(?:this|that|next|last|every|each)$/.test(next?.lower ?? "")) {
                    add(x, x, pp, "passif", `Au passif, le participe passé (${pp}).`);
                }
                return;
            }
            if (irregular ? closesPassive(next, true, "to") : (!has(x, "N") && !MASS_VERBS.has(base) && closesPassive(next, true))) {
                add(x, x, pp, "passif", `Au passif, le participe passé (${pp}).`);
            }
        });

        // --- Participe employé comme prétérit : « I seen », « He done it » ---
        tokens.forEach((t, i) => {
            const b = tokens[i - 1];
            if (!PP_ONLY.has(t.lower) || !b || !(ANIMATE.has(b.lower) || INDEFINITE.has(b.lower)) || tokens[i - 2] && (COMPLEMENT_VERBS.has(tokens[i - 2].lower) || WH.has(tokens[i - 2].lower) || ["that", "if", "whether", "to", "and", "or"].includes(tokens[i - 2].lower) && false)) {
                return;
            }
            if (tokens[i - 2] && (COMPLEMENT_VERBS.has(tokens[i - 2].lower) || PERFECT_AUX.has(tokens[i - 2].lower) || BE_FORMS.has(tokens[i - 2].lower))) {
                return;
            }
            add(t, t, PAST_FROM_PP.get(t.lower), "participe_passe", "Sans auxiliaire, on emploie le prétérit, pas le participe.");
        });

        // --- Formes régularisées par erreur : « teached », « buyed »… ---
        tokens.forEach((t, i) => {
            const base = REGULARIZED.get(t.lower);
            if (!base || proper(t, i) || ["flied", "singed", "leaded", "ringed"].includes(t.lower) || tags(t).some((x) => x !== "D" && !(x === "A" && startsObject(tokens[i + 1])))) {
                return;
            }
            if (t.lower === "costed" && !OBJECT_PRONOUNS.has(tokens[i + 1]?.lower)) {
                return;
            }
            let j = i - 1;
            while (j >= 0 && (ADVERBS.has(tokens[j].lower) || tokens[j].nature === "W")) {
                j--;
            }
            const aux = tokens[j]?.lower;
            const participle = aux && (BE_FORMS.has(aux) || GET_FORMS.has(aux) || PERFECT_AUX.has(aux));
            add(t, t, participle ? PP_OF.get(base) : PAST_OF.get(base), "regularise", `« ${base} » est irrégulier : ${PAST_OF.get(base)}, ${PP_OF.get(base)}.`);
        });

        // --- « to » + prétérit : « to went », « about to left », « to finished the deck » ---
        tokens.forEach((t, i) => {
            if (t.lower !== "to" || !tokens[i + 1]) {
                return;
            }
            const x = tokens[i + 1];
            const before = tokens[i - 1];
            if (before && /^(?:up|due|according|compared|next|close|similar|prior|key|opposed|front|back|way|thanks|owing)$/.test(before.lower)) {
                return;
            }
            if (PAST_ONLY.has(x.lower) && !has(x, "N") && !proper(x, i + 1)) {
                add(x, x, BASE_OF.get(x.lower), "to_passe", "Après « to », la base verbale.");
            } else if (before && INFINITIVE_MARKERS.has(before.lower) && BASE_OF.has(x.lower) && BASE_OF.get(x.lower) !== x.lower && PAST_OF.get(BASE_OF.get(x.lower)) === x.lower && !["saw", "lay", "wound", "found", "bore"].includes(x.lower)) {
                add(x, x, BASE_OF.get(x.lower), "to_passe", "Après « to », la base verbale.");
            } else if (has(x, "D") && !has(x, "V") && !has(x, "N") && !proper(x, i + 1) && /ed$/.test(x.lower) && startsObject(tokens[i + 2])) {
                const base = baseOfWord(x);
                if (base && isVerb(base)) {
                    add(x, x, base, "to_passe", "Après « to », la base verbale.");
                }
            }
        });

        // --- Marqueur du passé avec un temps du présent ---
        const markers = [];
        const markerTokens = new Set();   // les mots du marqueur lui-même : ils ne sont pas des verbes
        tokens.forEach((t, i) => {
            const before = tokens[i - 1];
            const mark = (...indexes) => {
                markers.push(i);
                indexes.forEach((k) => markerTokens.add(k));
            };
            if (t.lower === "yesterday") {
                mark(i);
            } else if (t.lower === "last" && tokens[i + 1] && PERIODS.test(tokens[i + 1].lower) && !(before && /^(?:the|since|until|for|of|at|over|during|within|from|by|through|this|that|in|every|each)$/.test(before.lower)) && !(before && before.nature === "?")) {
                mark(i, i + 1);
            } else if (t.lower === "ago" && before && PAST_UNITS.test(before.lower)) {
                mark(i, i - 1, i - 2);
            } else if (t.lower === "in" && tokens[i + 1] && /^(?:19\d\d|20[01]\d|202[0-5])$/.test(tokens[i + 1].text) && !(before && (/^(?:since|by|until|before|after|from)$/.test(before.lower) || before.nature === "?"))) {
                mark(i, i + 1);
            }
        });
        const soloTime = tokens.some((t) => SOLO_TIME.has(t.lower));
        if (markers.length > 0 && !soloTime) {
            const near = (i) => markers.some((m) => Math.abs(m - i) <= 12);
            const blocks = (w) => DO_FORMS.has(w.lower) || MODALS.has(w.lower) || ["to", "let", "lets", "make", "help"].includes(w.lower) || WH.has(w.lower);
            const isPastForm = (word) => BASE_OF.has(word) && BASE_OF.get(word) !== word;
            // « I », « he », « we »… sont toujours sujets ; « you » et « it » seulement en tête de proposition (« see you last week »).
            const leader = (k) => k === 0 || ["and", "but", "so", "then", "because", "when", "while", "that", "if", "as", "or"].includes(tokens[k - 1].lower)
                || markerTokens.has(k - 1) || /,\s*$/.test(text.slice(tokens[k - 1].end, tokens[k].start));
            const subjectAt = (k) => !!tokens[k] && (["i", "he", "she", "we", "they"].includes(tokens[k].lower) || (["you", "it"].includes(tokens[k].lower) && leader(k)));
            tokens.forEach((t, i) => {
                if (!near(i) || markerTokens.has(i)) {
                    return;
                }
                if (["have", "has", "i've", "you've", "we've", "they've"].includes(t.lower)) {
                    if (i > 0 && MODALS.has(tokens[i - 1].lower)) {
                        return;  // « must have hung years ago » : l'hypothèse sur le passé est correcte
                    }
                    let j = skipAdverbs(i + 1);
                    if (startsQuestion(i)) {
                        const k = afterSubject(j);
                        if (k < 0) {
                            return;
                        }
                        j = skipAdverbs(k);
                    }
                    const pp = tokens[j];
                    if (pp && has(pp, "D") && !["been", "had", "got", "gotten"].includes(pp.lower) && !proper(pp, j) && !has(pp, "N") && !has(pp, "A")) {
                        const base = baseOfWord(pp);
                        const past = PAST_FROM_PP.get(pp.lower) ?? (base ? pastOf(base) : pp.lower);
                        if (startsQuestion(i)) {
                            // « Have you seen that show last night? » → « Did you see … ».
                            const subjectFrom = tokens[skipAdverbs(i + 1)];
                            const subjectTo = tokens[afterSubject(skipAdverbs(i + 1)) - 1];
                            const plain = BASE_OF.get(pp.lower) ?? base;
                            if (plain) {
                                add(t, pp, `did ${text.slice(subjectFrom.start, subjectTo.end)} ${plain}`, "marqueur_passe_q", "Avec un moment passé précis, on emploie le prétérit, pas le present perfect.");
                            }
                        } else if (/'ve$/.test(t.lower)) {
                            add(pp, pp, past, "marqueur_passe", "Avec un moment passé précis, on emploie le prétérit, pas le present perfect.");
                        } else {
                            add(t, pp, past, "marqueur_passe", "Avec un moment passé précis, on emploie le prétérit, pas le present perfect.");
                        }
                    }
                    return;
                }
                // Un verbe déjà au passé entre ce mot et le marqueur : le marqueur se rapporte à lui (« the secretary that left a month ago »).
                const nearest = markers.reduce((best, m) => (Math.abs(m - i) < Math.abs(best - i) ? m : best), markers[0]);
                const [lo, hi] = [Math.min(i, nearest), Math.max(i, nearest)];
                if (tokens.slice(lo + 1, hi).some((y, idx) => !markerTokens.has(lo + 1 + idx) && (has(y, "D") || ["was", "were", "had", "did"].includes(y.lower))) || (tokens[i + 1]?.lower === "to" && INFINITIVE_TAKERS.has(t.lower))) {
                    return;
                }
                const before = tokens[i - 1];
                const earlier = tokens[i - 2];
                if (!before || blocks(before) || (earlier && (blocks(earlier) || ["whether", "if"].includes(earlier.lower))) || COGNITION.has(t.lower)) {
                    return;
                }
                if (PRONOUNS.has(before.lower) && subjectAt(i - 1) && verbLoose(i) && !has(t, "S:V") && !isPastForm(t.lower) && !isSameForm(t.lower) && !MODALS.has(t.lower) && !PREP_SET.has(t.lower)) {
                    add(t, t, pastOf(t.lower), "marqueur_present", "Avec un moment passé précis, le verbe se met au prétérit.");
                } else if (ANIMATE.has(before.lower) && subjectAt(i - 1) && t.lower === "been") {
                    add(t, t, SINGULAR_PRONOUNS.has(before.lower) || before.lower === "i" ? "was" : "were", "marqueur_present", "Avec un moment passé précis, le verbe se met au prétérit.");
                } else if (SINGULAR_PRONOUNS.has(before.lower) && subjectAt(i - 1) && has(t, "S:V") && !proper(t, i)) {
                    const base = baseOfWord(t);
                    if (base && isVerb(base)) {
                        add(t, t, pastOf(base), "marqueur_present", "Avec un moment passé précis, le verbe se met au prétérit.");
                    }
                } else if (earlier && DETERMINERS.has(earlier.lower) && leader(i - 2) && has(before, "N") && (verbLoose(i) || has(t, "S:V")) && !has(t, "D") && !isSameForm(t.lower) && !isPastForm(t.lower) && closes(tokens[i + 1], true) && !PREP_SET.has(t.lower)) {
                    // « Yesterday the team win its third game », « The meeting start at nine yesterday ».
                    const base = has(t, "S:V") && !has(t, "V") ? baseOfWord(t) : t.lower;
                    if (base && isVerb(base)) {
                        add(t, t, pastOf(base), "marqueur_present", "Avec un moment passé précis, le verbe se met au prétérit.");
                    }
                }
            });
        }

        // --- Présent à la place du present perfect : « I live here since 2019 », « How long do you live… » ---
        const since = tokens.findIndex((t, i) => t.lower === "since" && i > 0 && tokens[i + 1]);
        const duration = tokens.findIndex((t, i) => t.lower === "for" && tokens[i + 1] && (/^(?:\d+|a|an|two|three|four|five|six|seven|eight|nine|ten|several|many|a few|ten|twenty)$/.test(tokens[i + 1].lower)) && tokens[i + 2] && PAST_UNITS.test(tokens[i + 2].lower));
        const perfectPresent = tokens.some((t) => PERFECT_AUX.has(t.lower) || MODALS.has(t.lower) || ["was", "were", "will", "going", "been", "being"].includes(t.lower) || (t.lower !== "is" && GET_FORMS.has(t.lower)));
        if ((since > 0 || duration > 0) && !perfectPresent && !tokens.some((t) => SOLO_TIME.has(t.lower)) && !(tokens[0].lower === "since")) {
            const limit = since > 0 ? since : duration;
            tokens.forEach((t, i) => {
                if (i >= limit || !PRONOUNS.has(t.lower)) {
                    return;
                }
                const next = tokens[i + 1];
                const after = tokens[i + 2];
                if (!next || !spaced(t, next) || (i > 0 && (blocksSince(tokens[i - 1])))) {
                    return;
                }
                const singular = SINGULAR_PRONOUNS.has(t.lower);
                const aux = singular ? "has" : "have";
                if (since > 0 && ["am", "is", "are"].includes(next.lower)) {
                    add(next, next, `${aux} been`, "present_perfect", "Avec « since » (depuis), on emploie le present perfect.");
                } else if (["don't", "doesn't", "didn't"].includes(next.lower) && after && verbLoose(i + 2)) {
                    add(next, after, `${singular ? "hasn't" : "haven't"} ${ppOf(after.lower)}`, "present_perfect", "Avec « since » (depuis), on emploie le present perfect.");
                } else if (!singular && verbLoose(i + 1) && !has(next, "S:V") && !isSameForm(next.lower) && (since > 0 || DURATIVE.has(next.lower)) && !MODALS.has(next.lower)) {
                    add(next, next, `${aux} ${ppOf(next.lower)}`, "present_perfect", "Avec « since » ou « for » (depuis), on emploie le present perfect.");
                } else if (singular && has(next, "S:V") && !has(next, "V") && (since > 0 || DURATIVE.has(baseOfWord(next) ?? ""))) {
                    const base = baseOfWord(next);
                    if (base && isVerb(base) && !isSameForm(base)) {
                        add(next, next, `has ${ppOf(base)}`, "present_perfect", "Avec « since » ou « for » (depuis), on emploie le present perfect.");
                    }
                }
            });
        }
        if (tokens[0].lower === "how" && tokens[1]?.lower === "long" && ["do", "does"].includes(tokens[2]?.lower) && PRONOUNS.has(tokens[3]?.lower) && verbLoose(4) && !tokens.some((t) => PERFECT_AUX.has(t.lower))) {
            const singular = SINGULAR_PRONOUNS.has(tokens[3].lower);
            add(tokens[2], tokens[4], `${singular ? "has" : "have"} ${tokens[3].text} ${ppOf(tokens[4].lower)}`, "present_perfect", "« How long » (depuis combien de temps) demande le present perfect.");
        }

        // --- Conditionnel dans la subordonnée : « If I would have known » ---
        tokens.forEach((t, i) => {
            if (!["if", "unless"].includes(t.lower) || !(i === 0 || /,\s*$/.test(text.slice(tokens[i - 1].end, t.start)))) {
                return;
            }
            const s = tokens[i + 1];
            if (s && PRONOUNS.has(s.lower) && s.lower !== "you" && tokens[i + 2]?.lower === "would" && tokens[i + 3]?.lower === "have" && tokens[i + 4] && has(tokens[i + 4], "D")) {
                add(tokens[i + 2], tokens[i + 3], "had", "if_would_have", "Dans la subordonnée en « if », « had » + participe (pas « would have »).");
            }
        });

        // --- « If it will rain » : pas de « will » après if, when, as soon as… ---
        tokens.forEach((t, i) => {
            const clauseStart = i === 0 || /,\s*$/.test(text.slice(tokens[i - 1].end, t.start));
            let subjectAt;
            let triggerOk = false;
            if (["if", "unless", "when", "whenever"].includes(t.lower)) {
                triggerOk = clauseStart && !tokens.slice(0, i).some((y) => INDIRECT.has(y.lower));
                subjectAt = i + 1;
            } else if (t.lower === "once") {
                triggerOk = true;
                subjectAt = i + 1;
            } else if (t.lower === "as" && tokens[i + 1]?.lower === "soon" && tokens[i + 2]?.lower === "as") {
                triggerOk = true;
                subjectAt = i + 3;
            } else if (t.lower === "moment" && tokens[i - 1]?.lower === "the") {
                triggerOk = true;
                subjectAt = i + 1;
            }
            if (!triggerOk) {
                return;
            }
            let k = afterSubject(subjectAt);
            const s = tokens[subjectAt];
            if (!s || k < 0 || INDEFINITE.has(s.lower) || proper(s, subjectAt) || (s.lower === "you" && ["if", "unless", "when", "whenever"].includes(t.lower))) {
                return;
            }
            const will = tokens[k];
            const verb = tokens[k + 1];
            if (will?.lower === "will" && verb && verbLoose(k + 1)) {
                const plural = PLURAL_PRONOUNS.has(s.lower) || (DETERMINERS.has(s.lower) && has(tokens[subjectAt + 1], "S:N") && !has(tokens[subjectAt + 1], "N"));
                add(will, verb, plural ? verb.lower : thirdOf(verb.lower), "if_will", `Après « ${t.text} », le présent suffit pour parler de l'avenir : pas de « will ».`);
            }
        });

        // --- Un pronom ou un nom et son verbe ---
        tokens.forEach((t, i) => {
            const p = t.lower;
            if (!PRONOUNS.has(p)) {
                return;
            }
            const before = tokens[i - 1];
            if (before && (DO_FORMS.has(before.lower) || MODALS.has(before.lower) || COMPLEMENT_VERBS.has(before.lower) || ["to", "that", "than", "as", "if", "whether", "though"].includes(before.lower) || WH.has(before.lower))) {
                return;
            }
            if (p === "i" && before && /^[A-Z]/.test(before.text)) {
                return;  // « Constantine I is » : un chiffre romain
            }
            if ((p === "you" || p === "it") && before && !(["and", "but", "so", "then", "because", "when", "while", "that", "if", "as", "or", "though", "although", "since"].includes(before.lower)
                || /[,(]\s*$/.test(text.slice(before.end, t.start)) || ADVERBS.has(before.lower) || before.nature === "W")) {
                return;  // « see you », « with it » : un objet
            }
            const compound = !!before && ["and", "or", "nor"].includes(before.lower);
            const next = tokens[i + 1];
            if (!next || !spaced(t, next)) {
                return;
            }
            const word = next.lower;
            // « am agree », « is wanting » : un verbe d'état n'a pas de « be » devant.
            const stateVerb = tokens[i + 2];
            if (!compound && ["am", "is", "are"].includes(word) && stateVerb && spaced(next, stateVerb) && !tokens.slice(0, i).some((y) => CLEFT.has(y.lower))) {
                const ing = /ing$/.test(stateVerb.lower);
                const verbForm = ing ? baseOfIng(stateVerb) : stateVerb.lower;
                if (verbForm && (verbForm === "agree" || verbForm === "disagree" || STATIVE.has(verbForm)) && (ing || !has(stateVerb, "G"))) {
                    add(next, stateVerb, SINGULAR_PRONOUNS.has(p) ? thirdOf(verbForm) : verbForm, "etat_be", `« ${verbForm} » est un verbe d'état : pas de « ${next.text} » devant.`);
                    return;
                }
            }
            if (!compound && word === "were" && tokens.some((y, k) => k <= i + 1 && (SUBJUNCTIVE.has(y.lower) || ["if", "as", "though", "even", "unless", "would", "imagine", "supposing"].includes(y.lower)))) {
                return;
            }
            const be = { i: { is: "am", are: "am", were: "was" }, you: { is: "are", was: "were", am: "are" }, we: { is: "are", was: "were", am: "are" }, they: { is: "are", was: "were", am: "are" },
                he: { are: "is", were: "was", am: "is" }, she: { are: "is", were: "was", am: "is" }, it: { are: "is", were: "was", am: "is" } };
            if (!compound && be[p]?.[word]) {
                add(next, next, be[p][word], "accord_pronom", `« ${t.text} » s'accorde avec « ${be[p][word]} ».`);
                return;
            }
            if (!compound && word === "has" && PLURAL_PRONOUNS.has(p)) {
                add(next, next, "have", "accord_pronom", `« ${t.text} » s'accorde avec « have ».`);
                return;
            }
            if (!compound && word === "have" && SINGULAR_PRONOUNS.has(p) && !tokens.slice(0, i).some((y) => SUBJUNCTIVE.has(y.lower))) {
                add(next, next, "has", "accord_pronom", `« ${t.text} » s'accorde avec « has ».`);
                return;
            }
            if (word === "don't" && SINGULAR_PRONOUNS.has(p)) {
                add(next, next, "doesn't", "accord_pronom", `« ${t.text} » s'accorde avec « doesn't ».`);
                return;
            }
            if (word === "doesn't" && PLURAL_PRONOUNS.has(p)) {
                add(next, next, "don't", "accord_pronom", `« ${t.text} » s'accorde avec « don't ».`);
                return;
            }
            if (BE_FORMS.has(word) || compound) {
                return;
            }
            if (tokens.slice(0, i).some((y) => SUBJUNCTIVE.has(y.lower))) {
                return;
            }
            if (PLURAL_PRONOUNS.has(p) && has(next, "S:V") && !proper(next, i + 1) && !has(next, "V") && !PAST_OF.has(word)) {
                const base = baseOfWord(next);
                if (base && isVerb(base) && !MODALS.has(word)) {
                    add(next, next, base, "accord_pronom", `Après « ${t.text} », le verbe n'a pas de « -s ».`);
                }
            } else if (SINGULAR_PRONOUNS.has(p) && has(next, "V") && !has(next, "D") && !has(next, "G") && !has(next, "S:V") && !MODALS.has(word) && !DO_FORMS.has(word) && !isSameForm(word) && !PERFECT_AUX.has(word) && !proper(next, i + 1)
                && (!has(next, "N") || closes(tokens[i + 2], false)) && !has(next, "A")) {
                add(next, next, thirdOf(word), "accord_pronom", `Après « ${t.text} », le verbe prend un « -s ».`);
            }
        });
        // Un nom propre ou un groupe nominal simple avec « don't » ou « doesn't » : « Anna don't live here », « The dogs doesn't bark ».
        tokens.forEach((t, i) => {
            if (!["don't", "doesn't"].includes(t.lower) || i === 0) {
                return;
            }
            const n = tokens[i - 1];
            const d = tokens[i - 2];
            if (!spaced(n, t) || PRONOUNS.has(n.lower) || (d && ["and", "or"].includes(d.lower))) {
                return;
            }
            const name = n.nature === "M" || (proper(n, i - 1) && n.nature === "?");
            const nounPhrase = d && DETERMINERS.has(d.lower) && (has(n, "N") || has(n, "S:N"));
            if (!name && !nounPhrase) {
                return;
            }
            const plural = nounPhrase && has(n, "S:N") && !/(?:ss|us|is)$/.test(n.lower);
            if (t.lower === "don't" && !plural && !(d && ["these", "those", "both", "many", "several", "few"].includes(d.lower))) {
                add(t, t, "doesn't", "accord_nom", `« ${n.text} » est singulier : « doesn't ».`);
            } else if (t.lower === "doesn't" && (plural || (d && ["these", "those", "both", "many", "several", "few"].includes(d.lower)))) {
                add(t, t, "don't", "accord_nom", `« ${n.text} » est pluriel : « don't ».`);
            }
        });
    }
    return found;

    function blocksSince(w) {
        return DO_FORMS.has(w.lower) || MODALS.has(w.lower) || ["to", "let", "lets", "make", "help", "that", "if", "whether"].includes(w.lower) || WH.has(w.lower);
    }
}
