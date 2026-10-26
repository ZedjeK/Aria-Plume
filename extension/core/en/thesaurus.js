// Aria Plume — synonymes anglais (thésaurus tiré de WordNet 3.1, voir tools/build-thesaurus-en.mjs).
// Chargé au premier usage : environ 2 Mo compressés, 8 Mo une fois décompressé.
//
// WordNet ne connaît que les formes de base (« server », « run »). Pour « servers » ou
// « runs », on retrouve la base avec quelques règles simples et on remet le synonyme au
// pluriel ou à la 3e personne. Pour « running » ou « faster », on montre les formes de base.

const MAX_GROUPS = 8;

// Le fichier est lu par la plateforme (navigateur ou Node) : loadJson() renvoie le JSON décompressé.
export function createEnglishThesaurus(loadJson) {
    let dataPromise = null;
    const load = () => {
        dataPromise ??= loadJson()
            .then((json) => new Map(Object.entries(json)))
            .catch((error) => {
                dataPromise = null;
                throw error;
            });
        return dataPromise;
    };
    return {
        async synonyms(word) {
            return lookup(await load(), word);
        },
    };
}

const CONSONANT_Y = /[^aeiou]y$/;

// « server » → « servers », « box » → « boxes », « reply » → « replies ».
function addS(word) {
    if (CONSONANT_Y.test(word)) {
        return `${word.slice(0, -1)}ies`;
    }
    if (/(s|x|z|ch|sh|o)$/.test(word) && !/(oo|eo)$/.test(word)) {
        return `${word}es`;
    }
    return `${word}s`;
}

// Locution : le pluriel porte sur le dernier mot (« server farm » → « server farms »),
// la 3e personne sur le premier (« look into » → « looks into »).
function inflectPhrase(phrase, form) {
    const words = phrase.split(" ");
    if (form === "plural") {
        words[words.length - 1] = addS(words[words.length - 1]);
    } else if (form === "3s") {
        words[0] = addS(words[0]);
    }
    return words.join(" ");
}

// Bases possibles d'une forme fléchie, avec la nature attendue et la forme à reproduire.
function candidates(word) {
    const w = word.toLowerCase();
    const list = [];
    const add = (lemma, pos, form) => {
        if (lemma.length >= 2 && lemma !== w) {
            list.push({ lemma, pos, form });
        }
    };
    if (/ies$/.test(w)) {
        add(`${w.slice(0, -3)}y`, ["nom", "verbe"], "s");
    }
    if (/(s|x|z|ch|sh|o)es$/.test(w)) {
        add(w.slice(0, -2), ["nom", "verbe"], "s");
    }
    if (/[^s]s$/.test(w)) {
        add(w.slice(0, -1), ["nom", "verbe"], "s");
    }
    if (/men$/.test(w)) {
        add(`${w.slice(0, -3)}man`, ["nom"], "plural");
    }
    if (/ied$/.test(w)) {
        add(`${w.slice(0, -3)}y`, ["verbe", "adjectif"], "base");
    }
    if (/ed$/.test(w)) {
        add(w.slice(0, -2), ["verbe", "adjectif"], "base");
        add(w.slice(0, -1), ["verbe", "adjectif"], "base");
        if (/([^aeiou])\1ed$/.test(w)) {
            add(w.slice(0, -3), ["verbe", "adjectif"], "base");
        }
    }
    if (/ing$/.test(w)) {
        add(w.slice(0, -3), ["verbe", "adjectif", "nom"], "base");
        add(`${w.slice(0, -3)}e`, ["verbe", "adjectif", "nom"], "base");
        if (/([^aeiou])\1ing$/.test(w)) {
            add(w.slice(0, -4), ["verbe", "adjectif", "nom"], "base");
        }
    }
    for (const suffix of ["er", "est"]) {
        if (w.endsWith(`i${suffix}`)) {
            add(`${w.slice(0, -suffix.length - 1)}y`, ["adjectif", "adverbe"], "base");
        }
        if (w.endsWith(suffix)) {
            add(w.slice(0, -suffix.length), ["adjectif", "adverbe"], "base");
            add(w.slice(0, -suffix.length + 1), ["adjectif", "adverbe"], "base");
            if (new RegExp(`([^aeiou])\\1${suffix}$`).test(w)) {
                add(w.slice(0, -suffix.length - 1), ["adjectif", "adverbe"], "base");
            }
        }
    }
    return list;
}

// Ajoute un groupe, sans le mot lui-même et sans répéter un groupe déjà présent.
function addGroup(groups, pos, words, word) {
    const lower = word.toLowerCase();
    const list = [...new Set(words)].filter((w) => w.toLowerCase() !== lower);
    if (list.length && !groups.some((g) => list.every((w) => g.words.includes(w)))) {
        groups.push({ pos, words: list });
        return true;
    }
    return false;
}

function lookup(data, word) {
    const clean = word.trim().replace(/’/g, "'");
    const groups = [];
    const lemmas = [];
    // 1. Le mot tel quel (« running » nom ou adjectif).
    const exact = data.get(clean) ?? data.get(clean.toLowerCase());
    for (const [pos, words] of exact ?? []) {
        addGroup(groups, pos, words, clean);
    }
    if (groups.length) {
        lemmas.push(clean);
    }
    // 2. Sa forme de base (« running » → « run », « servers » → « server »).
    let inflected = false;
    let base = false;
    for (const { lemma, pos, form } of candidates(clean)) {
        const entry = data.get(lemma);
        if (!entry) {
            continue;
        }
        for (const [groupPos, words] of entry) {
            if (!pos.includes(groupPos)) {
                continue;
            }
            const plural = form === "s" || form === "plural";
            const shown = plural ? words.map((w) => inflectPhrase(w, groupPos === "verbe" ? "3s" : "plural")) : words;
            if (addGroup(groups, groupPos, shown, clean)) {
                plural ? (inflected = true) : (base = true);
                if (!lemmas.includes(lemma)) {
                    lemmas.push(lemma);
                }
            }
        }
    }
    return { word: clean, lemma: lemmas.join(", ") || clean, inflected: inflected && !base, base, groups: groups.slice(0, MAX_GROUPS) };
}
