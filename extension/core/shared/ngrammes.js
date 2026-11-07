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

    self.AriaNgrammes = { tokens, score, rerank, ready: (lang) => !!model(lang) };
})();
