// Aria Plume — modèle de langue par paires de mots (bigrammes), français et anglais, sans réseau ni IA.
//
// Les données (ngrammes-fr.js, ngrammes-en.js) viennent de tools/build-ngrammes.mjs : combien de fois
// chaque mot et chaque paire de mots voisins apparaît dans les phrases de Tatoeba. On en tire la
// probabilité d'un mot entre ses deux voisins : « servir les tartes » est bien plus probable que
// « servir les tettes », « we arrive home » que « we aerie home ».
//
// Script classique (sans import/export), chargé à la demande par les workers ; il dépose
// self.AriaNgrammes. Le découpage en mots doit rester celui de tools/build-ngrammes.mjs.
(function () {
    const ELISION = /^(?:[cdjlmnst]|qu|jusqu|lorsqu|puisqu|quoiqu)'/;
    function tokens(text, lang) {
        const words = String(text).toLowerCase().replace(/[’`]/g, "'").match(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*'?/gu) ?? [];
        const out = [];
        for (const word of words) {
            const elided = lang === "fr" ? ELISION.exec(word) : null;
            if (elided && word.length > elided[0].length) {
                out.push(elided[0], word.slice(elided[0].length));
            } else {
                out.push(word);
            }
        }
        return out;
    }

    const models = {};
    function model(lang) {
        if (!models[lang]) {
            const data = self[`ARIA_NGRAMS_${lang.toUpperCase()}`];
            if (!data) {
                return null;
            }
            const read = (text) => {
                const map = new Map();
                for (const line of String(text).split("\n")) {
                    const tab = line.lastIndexOf("\t");
                    if (tab > 0) {
                        map.set(line.slice(0, tab), Number(line.slice(tab + 1)));
                    }
                }
                return map;
            };
            models[lang] = { total: data.total, unigrams: read(data.unigrams), bigrams: read(data.bigrams) };
        }
        return models[lang];
    }

    // Probabilité de « word » après « prev », avec repli sur la fréquence du mot seul (« stupid
    // backoff ») quand la paire n'a jamais été vue.
    function logPair(m, prev, word) {
        const pair = m.bigrams.get(`${prev} ${word}`);
        const before = m.unigrams.get(prev);
        if (pair && before) {
            return Math.log(pair / before);
        }
        const alone = m.unigrams.get(word) ?? 0.5;
        return Math.log(0.4 * alone / m.total);
    }

    // Probabilité d'une suite de mots (la suggestion) entre le mot d'avant et le mot d'après.
    function score(lang, before, suggestion, after) {
        const m = model(lang);
        if (!m) {
            return null;
        }
        const prev = tokens(before, lang).at(-1) ?? "<s>";
        const next = tokens(after, lang)[0] ?? "</s>";
        const words = [prev, ...tokens(suggestion, lang), next];
        let total = 0;
        for (let i = 1; i < words.length; i++) {
            total += logPair(m, words[i - 1], words[i]);
        }
        return total;
    }

    // Distance d'édition (Damerau, sans les accents ni la casse) entre le mot écrit et une suggestion.
    const plain = (text) => String(text).toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    function distance(a, b) {
        a = plain(a);
        b = plain(b);
        const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
        for (let j = 1; j <= b.length; j++) {
            d[0][j] = j;
        }
        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
                if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                    d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
                }
            }
        }
        return d[a.length][b.length];
    }

    // Remonte en tête la suggestion que le contexte rend nettement plus probable que la première,
    // à condition qu'elle ne soit pas plus loin du mot écrit (« lancait » reste lançait, pas « lance »).
    // Écart demandé en log : 2 (≈ 7 fois plus probable) si elle est plus proche, 6 (≈ 400 fois) à
    // distance égale. Sinon, l'ordre ne change pas.
    function rerank(lang, line, start, end, suggestions, limit = 5) {
        if (suggestions.length < 2) {
            return suggestions;
        }
        // Le contexte s'arrête aux ponctuations fortes : la phrase seulement.
        const before = line.slice(0, start).split(/[.!?;:\n]/).at(-1);
        const after = line.slice(end).split(/[.!?;:\n]/)[0];
        const scored = suggestions.slice(0, limit).map((suggestion) => ({ suggestion, value: score(lang, before, suggestion, after) }));
        if (scored.some((x) => x.value === null)) {
            return suggestions;
        }
        const written = line.slice(start, end);
        const firstDistance = distance(written, suggestions[0]);
        const candidates = scored.filter((x) => distance(written, x.suggestion) <= firstDistance);
        const best = candidates.reduce((a, b) => (b.value > a.value ? b : a));
        const margin = distance(written, best.suggestion) < firstDistance ? 2 : 6;
        if (best.suggestion === suggestions[0] || best.value - scored[0].value < margin) {
            return suggestions;
        }
        return [best.suggestion, ...suggestions.filter((s) => s !== best.suggestion)];
    }

    // --- Détection des homophones par le contexte (sans règle par paire) ---
    // Familles de mots qui se prononcent pareil (ou presque) et qu'on confond à l'écrit. Seulement des
    // confusions de sens : les accords (leur/leurs, tout/tous) restent à Grammalecte et à Harper.
    const FAMILIES = {
        fr: ["sans sang cent", "mer mère maire", "vers vert verre ver", "voie voix", "cour cours court", "foi fois foie",
            "tant temps", "près prêt", "sur sûr", "pain pin", "compte conte comte", "faim fin", "cou coup coût",
            "champ chant", "chêne chaîne", "poids pois", "signe cygne", "tante tente", "date datte", "père paire",
            "chair chère", "vain vin vingt", "mal mâle malle", "dessin dessein", "porc port", "golf golfe",
            "cœur chœur", "pause pose", "balade ballade", "tâche tache", "sceau seau saut", "air aire", "fée fait",
            "cuir cuire", "verre vers", "sel selle", "plaine pleine", "vice vis", "mur mûr", "dû du", "pâte patte",
            "boue bout", "cane canne", "chaud chaux", "conter compter", "dans dent", "pair père"],
        en: ["there their", "your you're", "its it's", "to too two", "then than", "lose loose", "affect effect",
            "accept except", "weather whether", "brake break", "peace piece", "weak week", "know no", "buy by bye",
            "hear here", "right write", "sea see", "sun son", "hole whole", "meat meet", "mail male", "tail tale",
            "flour flower", "plain plane", "principal principle", "stationary stationery", "complement compliment",
            "desert dessert", "quite quiet", "advice advise", "passed past", "threw through", "waist waste",
            "wait weight", "bare bear", "fair fare", "pair pear", "steal steel", "which witch", "whose who's",
            "where were", "of off", "allowed aloud", "board bored", "cell sell", "die dye", "flu flew", "hour our",
            "knew new", "not knot", "one won", "road rode", "role roll", "scene seen", "sole soul", "sore soar",
            "suite sweet", "tide tied", "toe tow", "wear where", "weigh way", "whole hole", "wood would"],
    };
    const confusable = {};
    for (const [lang, families] of Object.entries(FAMILIES)) {
        confusable[lang] = new Map();
        for (const family of families) {
            const words = family.split(" ");
            for (const word of words) {
                confusable[lang].set(word, [...new Set([...(confusable[lang].get(word) ?? []), ...words.filter((w) => w !== word)])]);
            }
        }
    }

    // Mots du texte avec leur position ; les élisions françaises sont séparées comme dans tokens().
    function positioned(text, lang) {
        const out = [];
        for (const m of String(text).matchAll(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*['’]?/gu)) {
            const lower = m[0].toLowerCase().replace(/[’`]/g, "'");
            const elided = lang === "fr" ? ELISION.exec(lower) : null;
            if (elided && lower.length > elided[0].length) {
                out.push({ word: elided[0], start: m.index, end: m.index + elided[0].length });
                out.push({ word: lower.slice(elided[0].length), start: m.index + elided[0].length, end: m.index + m[0].length });
            } else {
                out.push({ word: lower, start: m.index, end: m.index + m[0].length });
            }
        }
        return out;
    }

    // Une paire vue dans le corpus (pas un repli) : c'est elle qui fait la preuve.
    const seen = (m, a, b) => m.bigrams.has(`${a} ${b}`);

    // Mots d'une famille d'homophones que le contexte contredit nettement : une autre forme de la
    // famille est au moins e^THRESHOLD fois (≈ 3 000 fois) plus probable entre les deux voisins, ses deux paires
    // ont été vues dans le corpus, et au moins une paire du mot écrit ne l'a jamais été.
    const THRESHOLD = 8;
    function confusions(lang, text, threshold = THRESHOLD) {
        const m = model(lang);
        if (!m || !confusable[lang]) {
            return [];
        }
        const words = positioned(text, lang);
        const found = [];
        words.forEach((token, i) => {
            const alternatives = confusable[lang].get(token.word);
            if (!alternatives) {
                return;
            }
            const before = words[i - 1];
            const after = words[i + 1];
            const prev = before && !/[.!?;:\n«»"“”()]/.test(text.slice(before.end, token.start)) ? before.word : "<s>";
            const next = after && !/[.!?;:\n«»"“”()]/.test(text.slice(token.end, after.start)) ? after.word : "</s>";
            // Il faut au moins un vrai voisin (pas deux bords de phrase).
            if (prev === "<s>" && next === "</s>") {
                return;
            }
            const value = (w) => logPair(m, prev, w) + logPair(m, w, next);
            const own = value(token.word);
            if (seen(m, prev, token.word) && seen(m, token.word, next)) {
                return;  // le mot écrit est attesté dans ce contexte : on ne dit rien
            }
            let best = null;
            for (const alternative of alternatives) {
                if (!seen(m, prev, alternative) || !seen(m, alternative, next)) {
                    continue;
                }
                const gain = value(alternative) - own;
                if (gain >= threshold && (!best || gain > best.gain)) {
                    best = { alternative, gain };
                }
            }
            if (best) {
                const original = text.slice(token.start, token.end);
                const suggestion = /^\p{Lu}/u.test(original) ? best.alternative[0].toUpperCase() + best.alternative.slice(1) : best.alternative;
                found.push({ start: token.start, end: token.end, word: original, suggestion, gain: best.gain });
            }
        });
        return found;
    }

    self.AriaNgrammes = { tokens, score, rerank, confusions, ready: (lang) => !!model(lang) };
})();
