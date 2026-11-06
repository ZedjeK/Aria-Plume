// Aria Plume — tutoiement et vouvoiement dans un texte français traduit.
//
// Le modèle de traduction choisit « tu » ou « vous » au hasard, parfois les deux dans la même
// phrase (« Peux-tu redémarrer… ? Merci pour votre aide »). Ce module passe un texte en entier
// au tutoiement ou au vouvoiement, avec la conjugaison de Grammalecte :
//   « Pouvez-vous m'aider ? » ↔ « Peux-tu m'aider ? »     « Dites-moi » ↔ « Dis-moi »
//   « Je vous remercie » ↔ « Je te remercie »             « Asseyez-vous » ↔ « Assieds-toi »
//   « votre adresse » ↔ « ton adresse »                    « s'il vous plaît » ↔ « s'il te plaît »
//
// Prudent : une phrase où un verbe ne se laisse pas conjuguer est laissée telle quelle.
// Aussi : le masculin par défaut pour « je » (« Je suis fatiguée » → « Je suis fatigué ») quand le
// texte d'origine ne dit rien du genre de celui qui parle.
"use strict";

const Register = (() => {
    const WORD = /[\p{L}\p{N}]+/gu;
    const VOWEL = /^[aeiouyàâäéèêëîïôöùûüœæ]/iu;
    // H muet des verbes courants (« t'habille », « t'hésites ») ; les autres h restent aspirés.
    const H_MUET = /^h(?:ab|és|ési|on|um|éb|ér|or|ui|yd|ypo|ist)/iu;
    const CLITICS = new Set(["ne", "n", "le", "la", "les", "l", "lui", "leur", "y", "en", "me", "m", "nous", "se", "s"]);
    const PREPOSITIONS = new Set(["à", "a", "de", "pour", "avec", "chez", "sans", "par", "sur", "sous", "vers", "contre", "entre", "après", "avant", "derrière", "devant", "envers", "selon", "malgré", "comme", "et", "ou", "que", "qu", "sauf", "excepté", "près", "auprès", "loin", "grâce", "quant"]);
    const TENSES = [":Ip", ":Iq", ":Is", ":If", ":K", ":Sp", ":Sq", ":E"];
    // Impératifs courants en tête de phrase (« Passe une bonne journée », « Fais attention »).
    const IMPERATIVES = new Set(["passe", "fais", "dis", "prends", "viens", "va", "regarde", "écoute", "attends", "appelle", "envoie", "oublie", "pense", "essaie", "essaye", "mets", "donne", "laisse", "sois", "aie", "profite", "vérifie", "clique", "appuie", "tape", "choisis", "sélectionne", "ouvre", "ferme", "redémarre", "relance", "installe", "télécharge", "contacte", "réponds", "écris", "lis", "note", "garde", "prépare", "rappelle", "excuse", "arrête", "continue", "commence", "reste", "sens", "imagine", "crois", "sache", "veuille", "lance", "ajoute", "supprime", "copie", "colle", "enregistre", "remplis", "signe", "lis", "suis", "rejoins", "rends", "montre", "explique", "demande", "préviens", "tiens", "reviens", "retourne", "tourne", "entre", "sors", "monte", "descends", "mange", "bois", "dors", "repose", "amuse", "détends", "calme", "occupe", "inquiète", "rassure", "souviens", "rappelle", "assieds", "lève", "couche", "dépêche", "approche", "éloigne", "habille", "prépare", "connecte", "déconnecte", "branche", "débranche", "active", "désactive", "mets", "fixe", "fais", "change", "modifie", "partage", "transfère", "réessaie", "réessaye", "patiente", "merci"]);

    function create({ getMorph, getConj, getFemForm = null }) {
        const morphs = (word) => getMorph(word).concat(/^\p{Lu}/u.test(word) ? getMorph(word.toLowerCase()) : []);

        // Entrées verbales d'un mot : { lemma, tenses: [":Ip", …], persons: [":2p", …] }.
        function verbEntries(word) {
            const out = [];
            for (const m of morphs(word)) {
                if (!/:V/.test(m)) {
                    continue;
                }
                const lemma = m.slice(1, m.indexOf("/"));
                const tenses = TENSES.filter((t) => new RegExp(`${t}(?=:|/|$)`).test(m));
                const persons = (m.match(/:[123][sp]/g) ?? []);
                if (tenses.length && persons.length) {
                    out.push({ lemma, tenses, persons });
                }
            }
            return out;
        }

        const isVerbWith = (word, person) => verbEntries(word).some((e) => e.persons.includes(person));
        const isNoun = (word) => morphs(word).some((m) => /:N/.test(m));

        // Conjugue « word » (à la personne from) à la personne to, au même temps.
        function conjugate(word, from, to, { imperative = null } = {}) {
            for (const entry of verbEntries(word)) {
                if (!entry.persons.includes(from)) {
                    continue;
                }
                let tenses = entry.tenses;
                if (imperative === true) {
                    tenses = tenses.filter((t) => t === ":E");
                } else if (imperative === false) {
                    tenses = tenses.filter((t) => t !== ":E");
                }
                for (const tense of tenses) {
                    const form = getConj(entry.lemma, tense, to);
                    if (form) {
                        return matchCase(form, word);
                    }
                }
            }
            return null;
        }

        function matchCase(form, original) {
            if (/^\p{Lu}/u.test(original)) {
                return form[0].toUpperCase() + form.slice(1);
            }
            return form;
        }

        function tokenize(text) {
            return [...text.matchAll(WORD)].map((m) => ({ text: m[0], lower: m[0].toLowerCase(), start: m.index, end: m.index + m[0].length }));
        }

        // Phrases : on travaille phrase par phrase (une phrase qui résiste reste telle quelle).
        function sentences(text) {
            const out = [];
            const re = /[^.!?…\n]+(?:[.!?…]+|\n|$)/g;
            for (const m of text.matchAll(re)) {
                if (m[0].trim()) {
                    out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
                }
            }
            return out;
        }

        // --- Marques du tutoiement et du vouvoiement ---
        function counts(text) {
            const tokens = tokenize(text);
            let tu = 0;
            let vous = 0;
            tokens.forEach((t, i) => {
                const after = text.slice(t.end, t.end + 1);
                if (["tu", "toi", "ton", "ta", "tes", "tien", "tienne", "tiens", "tiennes"].includes(t.lower)) {
                    // « tiens » peut être un verbe, « ta » rare ailleurs : on compte quand même.
                    tu += t.lower === "tiens" ? 0 : 1;
                } else if (t.lower === "te" || (t.lower === "t" && /['’]/.test(after) && !/-$/.test(text.slice(t.start - 1, t.start)))) {
                    tu += 1;
                } else if (["vous", "votre", "vos", "vôtre", "vôtres"].includes(t.lower)) {
                    vous += 1;
                } else if (/:E:2s/.test(morphs(t.text).join(" ")) && isSentenceStart(text, t.start) && IMPERATIVES.has(t.lower) && text.slice(t.end, t.end + 1) !== "'") {
                    tu += 1;
                } else if (/:E:2p/.test(morphs(t.text).join(" ")) && isSentenceStart(text, t.start) && !isVerbWith(t.text, ":1p")) {
                    vous += 1;
                }
                void i;
            });
            return { tu, vous };
        }

        function isSentenceStart(text, start) {
            const before = text.slice(0, start).replace(/\s*(?:n['’]|ne\s+)?$/iu, "");
            return before.trim() === "" || /[.!?…:\n]\s*$/.test(before) || /,\s*$/.test(before) && /^\s*$/.test(before.replace(/^.*[.!?…\n]/s, "").replace(/[^,]*,\s*$/, ""));
        }

        // --- Vers le tutoiement ---
        function sentenceToTu(text, base, edits) {
            const tokens = tokenize(text);
            const local = [];
            const question = /\?\s*$/.test(text);
            const sep = (i) => text.slice(tokens[i].end, tokens[i + 1]?.start ?? text.length);
            const sepBefore = (i) => text.slice(tokens[i - 1]?.end ?? 0, tokens[i].start);
            const replace = (i, value) => local.push({ start: tokens[i].start, end: tokens[i].end, value });
            const elide = (i, value) => {
                // « te » devant une voyelle : « t' » collé au mot suivant.
                const next = tokens[i + 1];
                if (next && sep(i) === " " && (VOWEL.test(next.text) || H_MUET.test(next.text))) {
                    local.push({ start: tokens[i].start, end: next.start, value: value === "Te" ? "T'" : "t'" });
                } else {
                    replace(i, value);
                }
            };
            for (let i = 0; i < tokens.length; i++) {
                const t = tokens[i];
                if (t.lower === "vous") {
                    const hyphenBefore = i > 0 && sepBefore(i) === "-";
                    if (i + 1 < tokens.length && sep(i) === "-" && /^mêmes?$/.test(tokens[i + 1].lower)) {
                        replace(i, matchCase("toi", t.text));
                        if (tokens[i + 1].lower === "mêmes") {
                            return null;  // « vous-mêmes » : un pluriel
                        }
                        continue;
                    }
                    if (hyphenBefore) {
                        // « Pouvez-vous », « Asseyez-vous », « Rappelez-vous », « Dites-vous ».
                        const verb = i - 1;
                        const imperative = !question && verbEntries(tokens[verb].text).some((e) => e.tenses.includes(":E") && e.persons.includes(":2p"));
                        const form = conjugate(tokens[verb].text, ":2p", ":2s", { imperative });
                        if (!form) {
                            return null;
                        }
                        local.push({ start: tokens[verb].start, end: tokens[verb].end, value: form });
                        replace(i, imperative ? "toi" : "tu");
                        continue;
                    }
                    // Sujet : un verbe à la 2e personne du pluriel suit (après d'éventuels pronoms).
                    let j = i + 1;
                    const clitics = [];
                    while (j < tokens.length && (CLITICS.has(tokens[j].lower) || tokens[j].lower === "vous") && /^\s*$|^['’]$/.test(sep(j - 1))) {
                        clitics.push(j);
                        j++;
                    }
                    if (j < tokens.length && isVerbWith(tokens[j].text, ":2p") && /^\s+$|^['’]$/.test(sep(j - 1))) {
                        const form = conjugate(tokens[j].text, ":2p", ":2s", { imperative: false });
                        if (!form) {
                            return null;
                        }
                        replace(i, matchCase("tu", t.text));
                        for (const k of clitics) {
                            if (tokens[k].lower === "vous") {
                                // « vous vous levez » → « tu te lèves » (élision si besoin).
                                const next = tokens[k + 1];
                                if (next && k + 1 === j && (VOWEL.test(form) || H_MUET.test(form))) {
                                    local.push({ start: tokens[k].start, end: next.start, value: "t'" });
                                } else {
                                    replace(k, "te");
                                }
                            }
                        }
                        local.push({ start: tokens[j].start, end: tokens[j].end, value: form });
                        i = j;
                        continue;
                    }
                    // Après une préposition, ou seul (« Et vous ? ») : toi.
                    const prev = tokens[i - 1];
                    const after = text.slice(t.end).trimStart();
                    if ((prev && PREPOSITIONS.has(prev.lower) && !/['’]$/.test(sepBefore(i))) || /^[,.!?;:)]|^$/.test(after)) {
                        replace(i, matchCase("toi", t.text));
                        continue;
                    }
                    // Complément devant un verbe : te / t'.
                    elide(i, matchCase("te", t.text));
                    continue;
                }
                if (t.lower === "votre" || t.lower === "vos") {
                    if (t.lower === "vos") {
                        replace(i, matchCase("tes", t.text));
                        continue;
                    }
                    const next = tokens[i + 1];
                    let feminine = false;
                    for (let k = i + 1; k < Math.min(tokens.length, i + 4); k++) {
                        const m = morphs(tokens[k].text).join(" ");
                        if (/:N/.test(m) || k === i + 3) {
                            feminine = /:N[^/]*:f/.test(m) && !/:N[^/]*:[me]/.test(m);
                            break;
                        }
                        if (/:A[^/]*:f/.test(m) && !/:A[^/]*:[me]/.test(m)) {
                            feminine = true;
                            break;
                        }
                    }
                    const vowel = next && (VOWEL.test(next.text) || H_MUET.test(next.text));
                    replace(i, matchCase(feminine && !vowel ? "ta" : "ton", t.text));
                    continue;
                }
                if (t.lower === "vôtre" || t.lower === "vôtres") {
                    const article = tokens[i - 1]?.lower;
                    const value = t.lower === "vôtres" ? "tiens" : article === "la" ? "tienne" : "tien";
                    replace(i, matchCase(value, t.text));
                    continue;
                }
                // Impératif sans pronom collé : « Dites-moi », « N'hésitez pas », « Veuillez noter ».
                if (isSentenceStart(text, t.start) && verbEntries(t.text).some((e) => e.tenses.includes(":E") && e.persons.includes(":2p")) && !isVerbWith(t.text, ":1p")) {
                    if (t.lower === "veuillez") {
                        continue;  // « Veuillez trouver ci-joint » : formule écrite, sans équivalent au tutoiement
                    }
                    const form = conjugate(t.text, ":2p", ":2s", { imperative: true });
                    if (!form) {
                        return null;
                    }
                    replace(i, form);
                    continue;
                }
            }
            for (const e of local) {
                edits.push({ start: base + e.start, end: base + e.end, value: e.value });
            }
            return true;
        }

        // --- Vers le vouvoiement ---
        function sentenceToVous(text, base, edits) {
            const tokens = tokenize(text);
            const local = [];
            const sep = (i) => text.slice(tokens[i].end, tokens[i + 1]?.start ?? text.length);
            const sepBefore = (i) => text.slice(tokens[i - 1]?.end ?? 0, tokens[i].start);
            const replace = (i, value) => local.push({ start: tokens[i].start, end: tokens[i].end, value });
            const done = new Set();
            for (let i = 0; i < tokens.length; i++) {
                const t = tokens[i];
                if (done.has(i)) {
                    continue;
                }
                if (t.lower === "tu") {
                    if (i > 0 && sepBefore(i) === "-") {
                        // « Peux-tu », « As-tu », « Pourrais-tu ».
                        const form = conjugate(tokens[i - 1].text, ":2s", ":2p", { imperative: false });
                        if (!form) {
                            return null;
                        }
                        local.push({ start: tokens[i - 1].start, end: tokens[i - 1].end, value: form });
                        replace(i, "vous");
                        continue;
                    }
                    let j = i + 1;
                    const clitics = [];
                    while (j < tokens.length && (CLITICS.has(tokens[j].lower) || ["te", "t"].includes(tokens[j].lower)) && /^\s*$|^['’]\s*$/.test(sep(j - 1))) {
                        clitics.push(j);
                        j++;
                    }
                    if (j < tokens.length && isVerbWith(tokens[j].text, ":2s")) {
                        const form = conjugate(tokens[j].text, ":2s", ":2p", { imperative: false });
                        if (!form) {
                            return null;
                        }
                        replace(i, matchCase("vous", t.text));
                        for (const k of clitics) {
                            if (["te", "t"].includes(tokens[k].lower)) {
                                local.push({ start: tokens[k].start, end: tokens[k + 1].start, value: "vous " });
                                done.add(k);
                            }
                        }
                        local.push({ start: tokens[j].start, end: tokens[j].end, value: form });
                        done.add(j);
                        i = j;
                        continue;
                    }
                    replace(i, matchCase("vous", t.text));
                    continue;
                }
                if (t.lower === "te" || (t.lower === "t" && /^['’]$/.test(sep(i)) && sepBefore(i) !== "-")) {
                    if (t.lower === "t") {
                        local.push({ start: t.start, end: tokens[i + 1]?.start ?? t.end + 1, value: matchCase("vous ", t.text) });
                    } else {
                        replace(i, matchCase("vous", t.text));
                    }
                    continue;
                }
                if (t.lower === "toi") {
                    if (i > 0 && sepBefore(i) === "-") {
                        // « Assieds-toi » → « Asseyez-vous ».
                        const form = conjugate(tokens[i - 1].text, ":2s", ":2p", { imperative: true });
                        if (!form) {
                            return null;
                        }
                        if (!done.has(i - 1)) {
                            local.push({ start: tokens[i - 1].start, end: tokens[i - 1].end, value: form });
                        }
                    }
                    replace(i, matchCase("vous", t.text));
                    continue;
                }
                if (["ton", "ta"].includes(t.lower)) {
                    replace(i, matchCase("votre", t.text));
                    continue;
                }
                if (t.lower === "tes") {
                    replace(i, matchCase("vos", t.text));
                    continue;
                }
                if (["tien", "tienne"].includes(t.lower) && ["le", "la"].includes(tokens[i - 1]?.lower)) {
                    replace(i, "vôtre");
                    continue;
                }
                if (["tiens", "tiennes"].includes(t.lower) && tokens[i - 1]?.lower === "les") {
                    replace(i, "vôtres");
                    continue;
                }
                // Impératif à la 2e personne du singulier en tête de phrase.
                if (isSentenceStart(text, t.start) && verbEntries(t.text).some((e) => e.tenses.includes(":E") && e.persons.includes(":2s"))
                    && (IMPERATIVES.has(t.lower) || !isNoun(t.text) || sep(i) === "-")) {
                    if (t.lower === "merci") {
                        continue;
                    }
                    const form = conjugate(t.text, ":2s", ":2p", { imperative: true });
                    if (!form) {
                        return null;
                    }
                    replace(i, form);
                    done.add(i);
                    continue;
                }
            }
            for (const e of local) {
                edits.push({ start: base + e.start, end: base + e.end, value: e.value });
            }
            return true;
        }

        function applyEdits(text, edits) {
            let out = text;
            for (const e of [...edits].sort((a, b) => b.start - a.start)) {
                out = out.slice(0, e.start) + e.value + out.slice(e.end);
            }
            return out;
        }

        // target : "tu", "vous" ou "auto" (le registre le plus présent, partout).
        function convert(text, target) {
            let goal = target;
            if (goal === "auto") {
                const { tu, vous } = counts(text);
                if (!tu || !vous) {
                    return text;
                }
                goal = tu > vous ? "tu" : "vous";
            }
            if (goal !== "tu" && goal !== "vous") {
                return text;
            }
            const edits = [];
            for (const s of sentences(text)) {
                const local = [];
                const ok = goal === "tu" ? sentenceToTu(s.text, s.start, local) : sentenceToVous(s.text, s.start, local);
                if (ok) {
                    edits.push(...local);
                }
            }
            return applyEdits(text, edits);
        }

        // « Je suis fatiguée » → « Je suis fatigué » (masculin par défaut pour « je »).
        function masculine(text) {
            const re = /(?<![\p{L}])((?:je|j['’])\s*(?:ne\s+|n['’])?(?:suis|étais|serai|serais|sois|fus|me\s+sens|me\s+sentais|me\s+suis\s+senti|reste|restais|deviens|devenais|ai\s+l['’]air)\s+(?:(?:pas|vraiment|très|si|tellement|trop|un\s+peu|assez|plutôt|complètement|toujours|encore|déjà|bien|super|hyper|aussi|plus|moins|tout|toute)\s+)*)([\p{L}-]+)/giu;
            return text.replace(re, (match, before, word) => {
                const m = morphs(word);
                // Après « je suis », un mot qui a une lecture d'adjectif ou de participe féminin
                // (« énervée » est aussi un nom) ; rien à faire s'il est aussi masculin ou épicène.
                if (!m.some((x) => /:[AQ][^/]*:f:s/.test(x)) || m.some((x) => /:[AQ][^/]*:[me]:[si]/.test(x))) {
                    return match;
                }
                // Participe : la forme masculine vient de la conjugaison.
                for (const x of m) {
                    if (/:Q[^/]*:f:s/.test(x)) {
                        const form = getConj(x.slice(1, x.indexOf("/")), ":Q", ":m:s");
                        if (form) {
                            return before.replace(/\btoute\s+$/iu, "tout ") + matchCase(form, word);
                        }
                    }
                }
                // Adjectif : une forme masculine dont le féminin est ce mot.
                const candidates = [
                    word.replace(/e$/u, ""), word.replace(/euse$/u, "eux"), word.replace(/ive$/u, "if"), word.replace(/ère$/u, "er"),
                    word.replace(/enne$/u, "en"), word.replace(/onne$/u, "on"), word.replace(/elle$/u, "el"), word.replace(/ette$/u, "et"),
                    word.replace(/trice$/u, "teur"), word.replace(/esse$/u, "e"), word.replace(/che$/u, "c"), word.replace(/gue$/u, "g"),
                ].filter((c) => c && c !== word);
                for (const c of candidates) {
                    const cm = morphs(c);
                    if (cm.some((x) => /:A[^/]*:[m]:[si]/.test(x)) && (!getFemForm || (getFemForm(c, false) ?? []).includes(word.toLowerCase()) || cm.length)) {
                        return before.replace(/\btoute\s+$/iu, "tout ") + matchCase(c, word);
                    }
                }
                return match;
            });
        }

        return { convert, counts, masculine };
    }

    return { create };
})();
