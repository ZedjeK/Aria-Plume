// Aria Plume — worker français (Grammalecte 2.3, fichiers d'origine non modifiés)
"use strict";

const BASE = new URL("../../engines/grammalecte/", self.location).href;

importScripts(...[
    "graphspell/helpers.js",
    "graphspell/str_transform.js",
    "graphspell/char_player.js",
    "graphspell/lexgraph_fr.js",
    "graphspell/ibdawg.js",
    "graphspell/spellchecker.js",
    "text.js",
    "graphspell/tokenizer.js",
    "fr/conj.js",
    "fr/mfsp.js",
    "fr/phonet.js",
    "fr/cregex.js",
    "fr/gc_options.js",
    "fr/gc_functions.js",
    "fr/gc_rules.js",
    "fr/gc_rules_graph.js",
    "fr/gc_engine.js",
].map((file) => BASE + file));
importScripts(new URL("homophones.js", self.location).href);

const MAX_SUGGESTIONS = 5;
let spellChecker = null;
let homophones = null;

function init() {
    const start = performance.now();
    conj.init(helpers.loadFile(BASE + "fr/conj_data.json"));
    phonet.init(helpers.loadFile(BASE + "fr/phonet_data.json"));
    mfsp.init(helpers.loadFile(BASE + "fr/mfsp_data.json"));
    gc_engine.load("JavaScript", "aHSL", BASE + "graphspell/_dictionaries");
    spellChecker = gc_engine.getSpellChecker();
    if (!spellChecker || !spellChecker.oMainDic) {
        throw new Error("Dictionnaire principal de Grammalecte non chargé");
    }
    homophones = Homophones.create((word) => spellChecker.getMorph(word));
    // Apostrophe droite ' acceptée : pas de « l'homme » → « l’homme ».
    gc_engine.setOption("apos", false);
    return { ms: performance.now() - start };
}

// --- Suggestions d'orthographe ---
// Grammalecte rate certaines fautes de frappe simples (« chente » → « chante »).
// On ajoute donc les mots du dictionnaire à une seule modification de distance,
// classés selon la probabilité de la faute de frappe, avant ses propres suggestions.

const LETTERS = [..."abcdefghijklmnopqrstuvwxyzàâäçéèêëîïôöùûüÿœæ-'"];
const VOWELS = new Set([..."aeiouyàâäéèêëîïôöùûüÿœæ"]);
const ACCENT_BASE = { à: "a", â: "a", ä: "a", ç: "c", é: "e", è: "e", ê: "e", ë: "e", î: "i", ï: "i", ô: "o", ö: "o", ù: "u", û: "u", ü: "u", ÿ: "y" };
const AZERTY_ROWS = ["azertyuiop", "qsdfghjklm", "wxcvbn"];
const MAX_EDIT_CANDIDATES_WORDS = 30;
let editCandidatesBudget = 0;

const stripAccent = (c) => ACCENT_BASE[c] ?? c;

function keyboardNeighbours(a, b) {
    for (let row = 0; row < AZERTY_ROWS.length; row++) {
        const col = AZERTY_ROWS[row].indexOf(a);
        if (col === -1) {
            continue;
        }
        for (let r = row - 1; r <= row + 1; r++) {
            const line = AZERTY_ROWS[r];
            if (line && [col - 1, col, col + 1].some((c) => line[c] === b)) {
                return true;
            }
        }
    }
    return false;
}

// Lettres qui se prononcent pareil : fautes d'oreille plutôt que de clavier (« manje » → mange).
const SAME_SOUND = new Set(["gj", "jg", "cs", "sc", "sz", "zs", "ck", "kc", "kq", "qk", "iy", "yi"]);

function substitutionCost(a, b) {
    if (stripAccent(a) === stripAccent(b)) {
        return 0.5;  // accent oublié ou en trop
    }
    if (SAME_SOUND.has(a + b)) {
        return 0.6;
    }
    if (VOWELS.has(a) && VOWELS.has(b)) {
        return 0.8;
    }
    return keyboardNeighbours(a, b) ? 0.9 : 1.2;
}

// Mots du dictionnaire à une modification de la faute, du plus probable au moins probable.
// person : personne attendue d'après le sujet juste avant (« je ne sai » → :1s), ou null.
const capitalize = (text) => text[0].toUpperCase() + text.slice(1);
const RARE = (morphs) => morphs.length > 0 && morphs.every((m) => !m.endsWith("/*"));

// Graphies d'un même son (« fesait » → faisait, « souvant » → souvent, « aparament » → apparemment) :
// des fautes d'oreille de plusieurs lettres, que les retouches d'une lettre ne trouvent pas.
const SOUND_SWAPS = [["ai", "e"], ["e", "ai"], ["ai", "è"], ["è", "ai"], ["ei", "è"], ["é", "ai"], ["ai", "é"], ["au", "o"], ["o", "au"], ["eau", "o"],
    ["ph", "f"], ["f", "ph"], ["qu", "k"], ["k", "qu"], ["c", "qu"], ["qu", "c"], ["ss", "s"], ["s", "ss"], ["an", "en"], ["en", "an"], ["am", "em"], ["em", "am"],
    ["in", "ain"], ["ain", "in"], ["in", "ein"], ["ein", "in"], ["g", "gu"], ["gu", "g"], ["c", "ç"], ["ç", "c"], ["s", "c"], ["c", "s"], ["ill", "y"], ["y", "ill"],
    ["er", "é"], ["é", "er"], ["ez", "é"], ["t", "tt"], ["tt", "t"], ["l", "ll"], ["ll", "l"], ["m", "mm"], ["mm", "m"], ["n", "nn"], ["nn", "n"], ["p", "pp"], ["pp", "p"],
    ["r", "rr"], ["rr", "r"], ["f", "ff"], ["ff", "f"], ["c", "cc"], ["cc", "c"], ["ent", "ant"], ["ant", "ent"], ["emment", "amment"], ["amment", "emment"]];

// context : { person, infinitive, notFinite } d'après les mots avant (voir spellingContext).
// « jai » → j'ai, « cest » → c'est, « daccord » → d'accord ; mais pas « sai » → s'ai.
function elisionFits(candidate, rest) {
    const morphs = spellChecker.getMorph(rest);
    const has = (re) => morphs.some((m) => re.test(m));
    switch (candidate.slice(0, candidate.indexOf("'"))) {
        case "j": return has(/:V[^/]*:1s/) || rest === "y" || rest === "en";
        case "n": case "m": case "t": return has(/:V/) || ["y", "en"].includes(rest);
        case "s": return has(/:V[^/]*:3[sp]/) || ["il", "ils"].includes(rest);
        case "c": return ["est", "était", "étaient", "eût", "a", "en"].includes(rest);
        case "d": return has(/:[NAWY]/);
        case "l": return has(/:[NAV]/);
        case "qu": return ["il", "ils", "elle", "elles", "on", "un", "une", "en"].includes(rest);
        default: return false;
    }
}

function editCandidates(word, context = {}) {
    return scoredEditCandidates(word, context).map(([candidate]) => candidate);
}

// Fautes de frappe : une lettre oubliée (0.75), deux lettres inversées (0.7), une touche voisine
// (0.9), une voyelle pour une autre (0.8), un accent (0.5)… Renvoie [[mot, coût], …] trié.
function scoredEditCandidates(word, context = {}) {
    const person = context.person ?? null;
    const lower = word.toLowerCase();
    const capitalized = /^\p{Lu}/u.test(word);
    const costs = new Map();
    const add = (candidate, cost) => {
        if (candidate && candidate !== lower && !candidate.endsWith("è") && (!costs.has(candidate) || costs.get(candidate) > cost)) {
            costs.set(candidate, cost);
        }
    };
    // « oeuf » → œuf, « coeur » → cœur : le e dans l'o, que le clavier n'offre pas.
    if (lower.includes("oe")) {
        add(lower.replace(/oe/g, "œ"), 0.2);
    }
    // « volontée » → volonté : le e final en trop après é.
    if (/ées?$/.test(lower)) {
        add(lower.replace(/ée(s?)$/, "é$1"), 0.4);
    }
    for (const [from, to] of SOUND_SWAPS) {
        let at = lower.indexOf(from);
        while (at !== -1) {
            // En fin de mot, « e » → « ai » change le temps du verbe (remplire → remplirai) : plus rare.
            add(lower.slice(0, at) + to + lower.slice(at + from.length), at === 0 || at + from.length === lower.length ? 0.8 : 0.4);
            at = lower.indexOf(from, at + 1);
        }
    }
    // « daccord », « lhomme » → d'accord, l'homme : l'apostrophe oubliée.
    if (/^(?:[dljmtsnc]|qu)[aeiouyhâàéèêîôû]/.test(lower)) {
        const cut = lower.startsWith("qu") ? 2 : 1;
        add(`${lower.slice(0, cut)}'${lower.slice(cut)}`, 0.3);
    }
    // « remplire », « saisire » → remplir, saisir : un e final en trop.
    if (/[^e]e$/.test(lower)) {
        add(lower.slice(0, -1), 0.6);
    }
    for (let i = 0; i <= lower.length; i++) {
        const left = lower.slice(0, i);
        const right = lower.slice(i);
        // La première lettre est rarement fausse : une retouche à cet endroit coûte plus.
        const first = i === 0 ? 0.3 : 0;
        if (right) {
            add(left + right.slice(1), (right[0] === left.at(-1) || right[0] === right[1] ? 0.6 : 1) + first);
        }
        if (right.length > 1) {
            add(left + right[1] + right[0] + right.slice(2), 0.7 + first);
        }
        for (const letter of LETTERS) {
            if (right) {
                add(left + letter + right.slice(1), substitutionCost(right[0], letter) + first);
            }
            // « Pierr » → Pierre : le e final oublié est une faute très française.
            const forgottenE = letter === "e" && right === "" ? (left.endsWith("é") ? 0.4 : 0.7) : 0.75;  // « idé » → idée
            add(left + letter + right, (letter === left.at(-1) || letter === right[0] ? 0.6 : forgottenE) + first);
        }
    }
    const valid = [];
    for (const [candidate, cost] of costs) {
        // Nom propre : « Laurant » → Laurent (le dictionnaire ne le connaît qu'avec sa majuscule).
        const elided = /^(?:[dljmtsnc]|qu)'(.+)$/.exec(candidate)?.[1];
        const form = elided ? (spellChecker.isValid(elided) && elisionFits(candidate, elided) ? candidate : null)
            : spellChecker.isValid(candidate) ? candidate : capitalized && spellChecker.isValid(capitalize(candidate)) ? capitalize(candidate) : null;
        if (!form) {
            continue;
        }
        const morphs = spellChecker.getMorph(elided ?? form);
        let score = cost;
        if (RARE(morphs)) {
            score += 0.4;  // mots rares ou étrangers (« wai ») après les mots courants
        }
        if (person && morphs.some((m) => /:V/.test(m) && m.includes(person))) {
            score -= 0.7;  // « je ne sai » : le verbe à la bonne personne passe devant (sais)
            if (morphs.some((m) => /:V/.test(m) && m.includes(person) && /:Ip/.test(m))) {
                score -= 0.2;  // présent plutôt que passé simple (sais avant osai)
            }
        }
        if (capitalized && morphs.some((m) => /:M/.test(m))) {
            score -= 0.3;  // mot avec majuscule : les noms propres d'abord
        }
        const onlyFinite = morphs.length > 0 && morphs.every((m) => /:V[^/]*:(Ip|Iq|Is|If|K|Sp|Sq|E)/.test(m) && !/:(Q|Y|P)(?=[:/]|$)/.test(m));
        if (morphs.length > 0 && morphs.every((m) => /:S[q]/.test(m))) {
            score += 0.8;  // imparfait du subjonctif (arrêtât) : après les formes courantes (arrêta)
        }
        if (context.notFinite && onlyFinite) {
            score += 0.6;  // après un déterminant ou « est », pas un verbe conjugué (« était suvent » → souvent)
        }
        if (context.infinitive && morphs.some((m) => /:Y/.test(m))) {
            score -= 0.5;  // « merci de remplire » → remplir
        }
        // « il faut redémaré » : le participe est à une lettre, l'infinitif à deux ; on propose l'infinitif.
        if (context.infinitive) {
            const participle = morphs.find((m) => /:Q/.test(m) && /er\//.test(m));
            const infinitive = participle?.slice(1, participle.indexOf("/"));
            if (infinitive && infinitive !== candidate && spellChecker.isValid(infinitive)) {
                valid.push([infinitive, score - 0.3]);
            }
        }
        valid.push([candidate, score]);
    }
    valid.sort((a, b) => a[1] - b[1]);
    return valid;
}

// Ce que les mots d'avant laissent attendre : un verbe à telle personne, un infinitif, ou
// surtout pas un verbe conjugué (après un déterminant ou un auxiliaire).
const AFTER_DETERMINER = /(?:^|[\s(«"])(?:le|la|les|un|une|des|du|ce|cet|cette|ces|mon|ton|son|ma|ta|sa|mes|tes|ses|notre|votre|nos|vos|leur|leurs|chaque|plusieurs|quelques|aucun|aucune)\s+$|(?:^|[\s(«"])l['’]$/iu;
const AFTER_AUXILIARY = /(?:^|\s)(?:suis|es|est|sommes|êtes|sont|étais|était|étions|étiez|étaient|serai|seras|sera|serons|serez|seront|serais|serait|seraient|ai|as|a|avons|avez|ont|avais|avait|avaient|aura|aurait|auraient)\s+(?:(?:très|trop|assez|vraiment|bien|déjà|pas|plus|jamais|toujours|souvent|encore)\s+)?$/iu;
const BEFORE_INFINITIVE = /(?:^|[\s'’])(?:de|d['’]|à|peux|peut|pouvons|pouvez|peuvent|pouvait|pouvaient|pourrait|pourrais|pourraient|dois|doit|devons|devez|doivent|devait|devaient|devrait|devrais|devraient|veux|veut|voulons|voulez|veulent|voulait|voudrait|voudrais|vais|vas|va|allons|allez|vont|allait|faut|faudra|faudrait|fallait|pour|sans|savoir|aller|vouloir|pouvoir|devoir|faire|laisser)\s*(?:(?:le|la|les|l['’]|lui|leur|me|te|se|nous|vous|y|en|m['’]|t['’]|s['’])\s*)?$/iu;
const NOUN_SUBJECT = /(?:^|[.!?;,]\s*|^\s*)(le|la|un|une|ce|cet|cette|mon|ton|son|ma|ta|sa|notre|votre|leur|les|des|ces|mes|tes|ses|nos|vos|leurs)\s+[\p{L}-]+(?:\s+[\p{L}-]+)?\s+$|(?:^|[.!?;,]\s*)l['’][\p{L}-]+(?:\s+[\p{L}-]+)?\s+$/iu;

function spellingContext(before) {
    const person = expectedPerson(before);
    if (person) {
        return { person };
    }
    if (BEFORE_INFINITIVE.test(before)) {
        return { infinitive: true };
    }
    if (AFTER_DETERMINER.test(before) || AFTER_AUXILIARY.test(before)) {
        return { notFinite: true };
    }
    const subject = NOUN_SUBJECT.exec(before);
    if (subject) {
        return { person: /^(les|des|ces|mes|tes|ses|nos|vos|leurs)$/i.test(subject[1] ?? "") ? ":3p" : ":3s" };
    }
    return {};
}

// Personne attendue après un pronom sujet, éventuellement suivi de « ne » et d'un pronom
// complément : « je ne sai », « tu le fai », « il s'apel ».
const SUBJECT_PERSON = { "j'": ":1s", je: ":1s", tu: ":2s", il: ":3s", elle: ":3s", on: ":3s", nous: ":1p", vous: ":2p", ils: ":3p", elles: ":3p" };
const BEFORE_VERB = /(?:^|[\s(«"])(j['’]|je|tu|il|elle|on|nous|vous|ils|elles)(?:\s+|(?<=['’]))(?:(?:ne\s+|n['’]))?(?:(?:me|te|se|le|la|les|lui|leur|y|en|nous|vous)\s+|[mtsl]['’])?$/iu;

function expectedPerson(before) {
    const subject = BEFORE_VERB.exec(before)?.[1]?.toLowerCase().replace("’", "'");
    return subject ? SUBJECT_PERSON[subject] : null;
}

function matchCase(original, candidate) {
    if (original.length > 1 && original === original.toUpperCase()) {
        return candidate.toUpperCase();
    }
    if (original[0] !== original[0].toLowerCase()) {
        return candidate[0].toUpperCase() + candidate.slice(1);
    }
    return candidate;
}

// Le calcul des suggestions natives coûte quelques dizaines de ms par mot :
// en correction en direct, les mêmes mots reviennent à chaque analyse, d'où ce cache.
const suggestionCache = new Map();
const SUGGESTION_CACHE_MAX = 2000;

function spellSuggestions(word, context = {}) {
    const key = `${word}|${context.person ?? ""}|${context.infinitive ? "Y" : ""}|${context.notFinite ? "N" : ""}`;
    const cached = suggestionCache.get(key);
    if (cached) {
        return cached;
    }
    const result = computeSpellSuggestions(word, context);
    if (suggestionCache.size >= SUGGESTION_CACHE_MAX) {
        suggestionCache.delete(suggestionCache.keys().next().value);
    }
    suggestionCache.set(key, result);
    return result;
}

// --- Formes fautives courantes (barbarismes) ---
// « chevals » → chevaux, « faisez » → faites, « disez » → dites : des fautes qui ne sont pas
// des fautes de frappe. On reconstruit la forme juste avec les règles du pluriel et le module
// de conjugaison de Grammalecte, et on la propose en premier.

const PERSON_ENDINGS = [
    [/iez$/, [":2p"]], [/ez$/, [":2p"]], [/ions$/, [":1p"]], [/ons$/, [":1p"]],
    [/aient$/, [":3p"]], [/ront$/, [":3p"], [":If"]], [/ent$/, [":3p"]],
    [/ait$/, [":3s"]], [/ais$/, [":1s", ":2s"]], [/rai$/, [":1s"], [":If"]], [/ras$/, [":2s"], [":If"]],
];
const TENSES = [":Ip", ":If", ":Iq", ":K", ":Sp", ":Is"];  // du plus courant au plus rare
let verbsByPrefix = null;

function verbsStartingWith(prefix) {
    if (!verbsByPrefix) {
        verbsByPrefix = new Map();
        for (const verb of Object.keys(conj._dVerb)) {
            const key = verb.slice(0, 2);
            if (!verbsByPrefix.has(key)) {
                verbsByPrefix.set(key, []);
            }
            verbsByPrefix.get(key).push(verb);
        }
    }
    return verbsByPrefix.get(prefix.slice(0, 2))?.filter((v) => v.startsWith(prefix)) ?? [];
}

// Distance de Damerau-Levenshtein (transpositions comptées 1), arrêtée au-delà de max.
function damerau(a, b, max) {
    if (Math.abs(a.length - b.length) > max) {
        return max + 1;
    }
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) {
        d[0][j] = j;
    }
    for (let i = 1; i <= a.length; i++) {
        let rowMin = Infinity;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
            }
            rowMin = Math.min(rowMin, d[i][j]);
        }
        if (rowMin > max) {
            return max + 1;
        }
    }
    return d[a.length][b.length];
}

function barbarismSuggestions(word) {
    const lower = word.toLowerCase();
    const found = [];
    let confident = false;  // forme reconstruite sûre : les suggestions approchantes sont inutiles
    // Pluriel irrégulier : « chevals » → chevaux, « travails » → travaux, « bijous » → bijoux.
    if (/[sx]$/.test(lower) && lower.length > 3) {
        const base = lower.slice(0, -1);
        if (spellChecker.getMorph(base).some((m) => /:[NA]/.test(m) && /:[si]/.test(m))) {
            for (const plural of (suggPlur(base, true) || "").split("|")) {
                if (plural && plural !== lower && spellChecker.isValid(plural)) {
                    found.push(plural);
                    confident = true;
                }
            }
        }
    }
    // Participe passé accordé alors qu'il est invariable : « succédés » → succédé, « plus » → plu.
    const participle = /^(.+[éiu])(e|s|es)$/.exec(lower);
    if (participle && spellChecker.getMorph(participle[1]).some((m) => /:Q/.test(m))) {
        found.push(participle[1]);
        confident = true;
    }
    // Conjugaison : on retrouve la personne d'après la terminaison, puis les verbes qui
    // commencent comme le mot. Le cas typique est un vrai radical du verbe avec une
    // terminaison régulière (« fais » + « ez », « voy » + « ent », « envoie » + « rai ») :
    // ces verbes passent en premier, puis la forme la plus proche.
    const ending = PERSON_ENDINGS.find(([re]) => re.test(lower));
    if (ending && lower.length >= 5 && editCandidatesBudget > 0) {
        let verbs = verbsStartingWith(lower.slice(0, 2));
        if (verbs.length > 400) {
            verbs = verbsStartingWith(lower.slice(0, 3));
        }
        const scored = [];
        for (const verb of verbs) {
            const stems = new Set([
                (conj.getConj(verb, ":Ip", ":1p") || "").replace(/ons$/, ""),
                (conj.getConj(verb, ":Ip", ":3s") || "").replace(/[etd]$/, ""),
                conj.getConj(verb, ":Ip", ":3s") || "",
                verb.replace(/(er|ir|re|oir)$/, ""),
            ].filter((stem) => stem.length >= 2));
            const stemMatch = [...stems].some((stem) => lower.startsWith(stem) && /^(ez|iez|ons|ions|ent|aient|ais|ait|rai|ras|ra|rons|rez|ront|erai|eras|era|erons|erez|eront)$/.test(lower.slice(stem.length)));
            TENSES.forEach((tense, rank) => {
                if (ending[2] && !ending[2].includes(tense)) {
                    return;  // « -rai », « -ras » : futur seulement
                }
                for (const who of ending[1]) {
                    const form = conj.getConj(verb, tense, who);
                    if (!form || form === lower) {
                        continue;
                    }
                    const distance = damerau(lower, form, 3);
                    if (distance === 1 || (distance <= 3 && stemMatch)) {
                        scored.push({ form, distance, rank, stemMatch });
                    }
                }
            });
        }
        scored.sort((x, y) => Number(y.stemMatch) - Number(x.stemMatch) || x.rank - y.rank || x.distance - y.distance);
        // Si la meilleure forme vient d'un vrai radical, on ne garde que celles-là.
        const best = scored[0]?.stemMatch ? scored.filter((x) => x.stemMatch) : scored;
        found.push(...best.slice(0, 2).map((x) => x.form));
        confident ||= scored[0]?.stemMatch === true;
    }
    return { list: [...new Set(found)].map((c) => matchCase(word, c)), confident };
}

function computeSpellSuggestions(word, context = {}) {
    const barbarism = barbarismSuggestions(word);
    const native = [...spellChecker.suggest(word, MAX_SUGGESTIONS + 5)].flat();
    let scored = [];
    if (word.length <= 25 && editCandidatesBudget > 0) {
        editCandidatesBudget--;
        // Les suggestions de Grammalecte départagent les ex aequo (« potres » → portes avant pitres).
        const nativeRank = new Map(native.map((w, i) => [w.toLowerCase(), i]));
        scored = scoredEditCandidates(word, context)
            .map(([candidate, cost]) => [candidate, cost - (nativeRank.has(candidate) ? 0.15 - 0.02 * Math.min(nativeRank.get(candidate), 5) : 0)])
            .sort((a, b) => a[1] - b[1]);
    }
    if (barbarism.confident) {
        // « faisez » → faites, sans « baisez » ni « taisez » ; sauf un simple accent oublié (« reparez » → réparez).
        const accent = scored.find(([candidate, cost]) => cost <= 0.5 && stripAccents(candidate) === stripAccents(word.toLowerCase()));
        return [...new Set([...(accent ? [matchCase(word, accent[0])] : []), ...barbarism.list])].slice(0, MAX_SUGGESTIONS);
    }
    const suggestions = scored.map(([c]) => matchCase(word, c));
    // Formes reconstruites peu sûres : à leur rang parmi les retouches, sinon juste après la première.
    const extra = barbarism.list.filter((c) => !suggestions.includes(c));
    suggestions.splice(Math.min(1, suggestions.length), 0, ...extra);
    suggestions.push(...native);
    return [...new Set(suggestions)].slice(0, MAX_SUGGESTIONS);
}

const stripAccents = (text) => [...text].map(stripAccent).join("");

// --- Accords liés : une seule vague, des corrections complètes ---
// Grammalecte signale souvent un même accord en plusieurs morceaux :
//   « au matins »           → « au » → aux, « matins » → matin (deux options contradictoires)
//   « Les enfant sont prêt » → « enfant » → enfants, puis « prêt » → prêts (les deux à faire)
// On réunit les fautes liées (l'explication de l'une cite le mot de l'autre) et on cherche
// les phrases entièrement corrigées : on applique les suggestions une à une et on refait
// analyser le passage par Grammalecte, jusqu'à ce qu'il n'y trouve plus rien.
// On souligne alors tout le passage et on propose ces versions complètes.

const MAX_SUGGESTIONS_PER_ERROR = 3;
const MAX_FIX_DEPTH = 4;
const MAX_PARSES_PER_CLUSTER = 40;
const MAX_SOLUTIONS = 3;
const SENTENCE_END = /[.!?…]/;
const solutionCache = new Map();
const SOLUTION_CACHE_MAX = 500;
const quote = (word) => `« ${word} »`;

// Grammalecte cite les mots entre “…” ou « … » (avec des espaces insécables).
function mentions(line, part, other) {
    const word = line.slice(other.start, other.end).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return word !== "" && new RegExp(`[“«]\\s*${word}\\s*[”»]`).test(part.message);
}

function sentenceBounds(line, start, end) {
    let from = start;
    while (from > 0 && !SENTENCE_END.test(line[from - 1])) {
        from--;
    }
    let to = end;
    while (to < line.length && !SENTENCE_END.test(line[to])) {
        to++;
    }
    return [from, Math.min(line.length, to + 1)];
}

function clusters(line, errors) {
    const parent = errors.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let i = 0; i < errors.length; i++) {
        for (let j = i + 1; j < errors.length; j++) {
            const [si] = sentenceBounds(line, errors[i].start, errors[i].end);
            const [sj] = sentenceBounds(line, errors[j].start, errors[j].end);
            if (si === sj && (mentions(line, errors[i], errors[j]) || mentions(line, errors[j], errors[i]))) {
                parent[find(i)] = find(j);
            }
        }
    }
    const groups = new Map();
    errors.forEach((error, i) => {
        const root = find(i);
        groups.set(root, [...(groups.get(root) ?? []), error]);
    });
    return [...groups.values()];
}

// Recherche en largeur des versions du passage sans faute (les moins modifiées d'abord).
function solveRegion(sentence, regionStart, regionEnd) {
    const key = `${sentence}|${regionStart}|${regionEnd}`;
    if (solutionCache.has(key)) {
        return solutionCache.get(key);
    }
    const queue = [{ text: sentence, end: regionEnd, depth: 0 }];
    const seen = new Set([sentence]);
    const solutions = [];
    let parses = 0;
    while (queue.length > 0 && parses < MAX_PARSES_PER_CLUSTER && solutions.length < MAX_SOLUTIONS) {
        const node = queue.shift();
        parses++;
        const errors = gc_engine.parse(node.text, "FR", false, null, false)
            .filter((e) => e.nStart >= regionStart && e.nEnd <= node.end);
        if (errors.length === 0) {
            if (node.depth > 0) {
                solutions.push(node.text.slice(regionStart, node.end));
            }
            continue;
        }
        if (node.depth >= MAX_FIX_DEPTH) {
            continue;
        }
        for (const error of errors) {
            for (const suggestion of (error.aSuggestions || []).filter((sugg) => sugg !== "").slice(0, MAX_SUGGESTIONS_PER_ERROR)) {
                const text = node.text.slice(0, error.nStart) + suggestion + node.text.slice(error.nEnd);
                if (!seen.has(text)) {
                    seen.add(text);
                    const delta = suggestion.length - (error.nEnd - error.nStart);
                    queue.push({ text, end: node.end + delta, depth: node.depth + 1 });
                }
            }
        }
    }
    const result = [...new Set(solutions)];
    if (solutionCache.size >= SOLUTION_CACHE_MAX) {
        solutionCache.delete(solutionCache.keys().next().value);
    }
    solutionCache.set(key, result);
    return result;
}

function levenshtein(a, b) {
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const current = [i];
        for (let j = 1; j <= b.length; j++) {
            current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        previous = current;
    }
    return previous[b.length];
}

// Écarte les versions où un mot change de nature (« maisons » → « méson ») :
// un accord ne touche que la fin des mots.
function plausible(original, candidate) {
    const before = original.trim().split(/\s+/);
    const after = candidate.trim().split(/\s+/);
    if (before.length !== after.length) {
        return true;
    }
    return before.every((word, i) => {
        const other = after[i];
        if (word === other || word.length <= 3 || other.length <= 3) {
            return true;
        }
        let prefix = 0;
        while (prefix < word.length && word[prefix].toLowerCase() === other[prefix]?.toLowerCase()) {
            prefix++;
        }
        return prefix >= Math.min(word.length, other.length) - 2;
    });
}

// Les corrections les plus proches du texte d'origine d'abord ; on écarte celles qui s'en éloignent trop.
function rankSolutions(original, solutions) {
    const scored = solutions
        .filter((solution) => plausible(original, solution))
        .map((solution) => ({ solution, distance: levenshtein(original, solution) }))
        .sort((a, b) => a.distance - b.distance);
    if (scored.length === 0) {
        return [];
    }
    const limit = scored[0].distance * 2 + 2;
    return scored.filter((s) => s.distance <= limit).map((s) => s.solution);
}

function buildMerged(line, parts, start, end) {
    const [from, to] = sentenceBounds(line, start, end);
    let solutions = rankSolutions(line.slice(start, end), solveRegion(line.slice(from, to), start - from, end - from));
    if (solutions.length === 0) {
        return null;
    }
    // « Leurs voiture est en panne » : « Leurs voitures » corrige le passage mais fâche le verbe ; on
    // préfère les versions qui laissent toute la phrase sans faute (« Leur voiture est… »).
    if (solutions.length > 1) {
        const sentence = line.slice(from, to);
        const errorsWith = (solution) => gc_engine.parse(sentence.slice(0, start - from) + solution + sentence.slice(end - from), "FR", false, null, false).length;
        // Dans un accord, c'est plus souvent le déterminant ou l'adjectif qui est faux que le nom
        // (« quel heure » → quelle heure, pas « quel heurt ») : on compte les noms modifiés.
        const before = line.slice(start, end).trim().split(/\s+/);
        const nounsChanged = (solution) => solution.trim().split(/\s+/).filter((word, k) => before[k] && word !== before[k] && word !== `${before[k]}s` && word !== `${before[k]}x`
            && spellChecker.getMorph(before[k].replace(/^[A-ZÀ-Ý]/, (c) => c.toLowerCase())).some((m) => /:N/.test(m)) && !spellChecker.getMorph(before[k].toLowerCase()).some((m) => /:[DA]/.test(m))).length;
        const scored = solutions.map((solution, index) => ({ solution, index, errors: errorsWith(solution), nouns: nounsChanged(solution) }));
        solutions = scored.sort((a, b) => a.errors - b.errors || a.nouns - b.nouns || a.index - b.index).map((x) => x.solution);
    }
    // « Elles montre » : on corrige d'abord le verbe (Elles montrent) plutôt que le pronom (Elle montre).
    const firstWord = line.slice(start, end).trim().split(/\s+/)[0];
    if (/^(il|elle|ils|elles)$/i.test(firstWord)) {
        const keeps = (solution) => (solution.trim().split(/\s+/)[0] === firstWord ? 1 : 0);
        solutions = [...solutions].sort((a, b) => keeps(b) - keeps(a));
    }
    const words = [...new Set(parts.map((part) => quote(line.slice(part.start, part.end).trim())))];
    const list = words.length > 1 ? `${words.slice(0, -1).join(", ")} et ${words.at(-1)}` : words[0];
    const verb = words.length > 1 ? "ne s'accordent pas" : ": l'accord se répercute sur la suite de la phrase";
    return {
        start,
        end,
        kind: "grammaire",
        detail: [...new Set(parts.map((part) => part.detail))].join("+"),
        message: `${list} ${verb}. ${solutions.length > 1 ? "Choisis la correction à garder." : "Voici la correction complète."}`,
        suggestions: solutions,
        rule: parts.map((part) => part.rule).join("+"),
    };
}

function mergeCluster(line, unsortedParts) {
    const parts = [...unsortedParts].sort((a, b) => a.start - b.start);
    const start = Math.min(...parts.map((p) => p.start));
    const end = Math.max(...parts.map((p) => p.end));
    const merged = buildMerged(line, parts, start, end);
    return merged ? [merged] : parts;  // pas de version entièrement correcte : fautes séparées
}

// Accord en cascade : corriger « enfant » en « enfants » fait apparaître « mange » → « mangent ».
// On applique la première suggestion, on refait analyser la phrase, et si de nouvelles fautes
// surgissent, on souligne tout le passage concerné avec la phrase entièrement corrigée.
const cascadeCache = new Map();

function cascadeEnd(line, error) {
    const suggestion = error.suggestions.find((sugg) => sugg !== "");
    if (suggestion === undefined) {
        return null;
    }
    const [from, to] = sentenceBounds(line, error.start, error.end);
    const sentence = line.slice(from, to);
    const key = `${sentence}|${error.start - from}|${error.end - from}|${suggestion}`;
    if (cascadeCache.has(key)) {
        const cached = cascadeCache.get(key);
        return cached === null ? null : cached + from;
    }
    const localStart = error.start - from;
    const localEnd = error.end - from;
    const before = new Set(gc_engine.parse(sentence, "FR", false, null, false).map((e) => `${e.nStart}:${e.nEnd}`));
    const fixed = sentence.slice(0, localStart) + suggestion + sentence.slice(localEnd);
    const delta = suggestion.length - (localEnd - localStart);
    let end = null;
    for (const e of gc_engine.parse(fixed, "FR", false, null, false)) {
        if (e.nStart < localEnd + delta && e.nEnd > localStart) {
            continue;  // la correction elle-même
        }
        // Positions ramenées dans le texte d'origine.
        const start0 = e.nStart >= localEnd + delta ? e.nStart - delta : e.nStart;
        const end0 = e.nEnd >= localEnd + delta ? e.nEnd - delta : e.nEnd;
        if (!before.has(`${start0}:${end0}`) && start0 >= localEnd) {
            end = Math.max(end ?? 0, end0);
        }
    }
    if (cascadeCache.size >= SOLUTION_CACHE_MAX) {
        cascadeCache.delete(cascadeCache.keys().next().value);
    }
    cascadeCache.set(key, end);
    return end === null ? null : end + from;
}

function groupLinkedErrors(line, errors) {
    const groups = clusters(line, errors).sort((a, b) => Math.min(...a.map((e) => e.start)) - Math.min(...b.map((e) => e.start)));
    const result = [];
    let consumedUntil = -1;
    for (const group of groups) {
        const groupStart = Math.min(...group.map((e) => e.start));
        if (groupStart < consumedUntil) {
            continue;  // déjà couverte par un passage regroupé
        }
        if (group.length > 1) {
            const merged = mergeCluster(line, group);
            result.push(...merged);
            consumedUntil = Math.max(...merged.map((m) => m.end));
            continue;
        }
        const [error] = group;
        const end = cascadeEnd(line, error);
        if (end !== null) {
            const inside = errors.filter((e) => e.start >= error.start && e.end <= end);
            const merged = buildMerged(line, inside, error.start, end);
            if (merged) {
                result.push(merged);
                consumedUntil = end;
                continue;
            }
        }
        result.push(error);
        consumedUntil = error.end;
    }
    return result.sort((a, b) => a.start - b.start);
}

// --- Synonymes ---
// Thésaurus fourni avec Grammalecte, chargé au premier usage (environ 6 Mo).
// Il ne connaît que les formes de base (« marcher », « serveur ») : pour « marchait » ou
// « serveurs », on cherche le lemme et on accorde chaque synonyme comme le mot d'origine.
let thesaurus = null;
const MAX_SYNONYM_GROUPS = 8;

function loadThesaurus() {
    if (!thesaurus) {
        thesaurus = new Map();
        for (const file of ["fr/thesaurus1_data.json", "fr/thesaurus2_data.json"]) {
            for (const [word, groups] of Object.entries(JSON.parse(helpers.loadFile(BASE + file)))) {
                thesaurus.set(word, groups);
            }
        }
    }
    return thesaurus;
}

// « (Adjectif Nom) » → « adjectif, nom » ; les étiquettes inconnues (« (?) ») sont laissées vides.
function posLabel(raw) {
    const words = String(raw).replace(/[()]/g, "").toLowerCase().split(/\s+/)
        .map((w) => ({ adj: "adjectif", interj: "interjection", preposition: "préposition" }[w] ?? w))
        .filter((w) => /^(nom|verbe|adjectif|adverbe|pronom|préposition|conjonction|interjection|déterminant|determinant)$/.test(w));
    return [...new Set(words.map((w) => w.replace("determinant", "déterminant")))].join(", ");
}

const firstOf = (list) => (list ? list.split("|")[0] : "");

// Met le synonyme (forme de base) à la même forme que le mot d'origine, d'après ses étiquettes.
function inflect(synonym, tags) {
    if (/:Y/.test(tags) || (!/:V/.test(tags) && /:[me]:[si]/.test(tags) && !/:[fp]/.test(tags.replace(/:[me]:[si]/, "")))) {
        return synonym;  // infinitif, ou masculin singulier : rien à changer
    }
    if (/\s/.test(synonym)) {
        return null;  // locution : on ne sait pas l'accorder proprement
    }
    let form = "";
    if (/:V/.test(tags)) {
        if (!conj.isVerb(synonym)) {
            return null;
        }
        if (/:Q/.test(tags)) {
            const [, gender = "m", number = "s"] = /:([mfe]):([spi])/.exec(tags) ?? [];
            form = conj.getConj(synonym, ":Q", `:${gender === "f" ? "f" : "m"}:${number === "p" ? "p" : "s"}`);
        } else {
            const tense = /:(Ip|Iq|Is|If|K|Sp|Sq|E)/.exec(tags)?.[1];
            const persons = tags.match(/:[123][sp]/g) ?? [];
            const who = persons.includes(":3s") ? ":3s" : persons[0];
            form = tense && who ? conj.getConj(synonym, `:${tense}`, who) : "";
        }
    } else if (/:[NA]/.test(tags)) {
        const feminine = /:f/.test(tags);
        const plural = /:p/.test(tags);
        const synonymMorph = spellChecker.getMorph(synonym);
        if (/:A/.test(tags)) {
            const adjective = synonymMorph.filter((m) => /:A/.test(m) && !/:V/.test(m));
            if (adjective.length === 0) {
                return null;  // « bien » (adverbe) ne s'accorde pas comme « belles »
            }
            if (adjective.some((m) => /:e:i/.test(m))) {
                form = synonym;  // adjectif invariable (« bien », « super »)
            } else if (feminine) {
                form = firstOf(plural ? suggFemPlur(synonym) : suggFemSing(synonym));
            } else {
                form = plural ? firstOf(suggMasPlur(synonym)) || (/[sx]$/.test(synonym) ? synonym : "") : synonym;
            }
        } else if (!synonymMorph.some((m) => /:N/.test(m))) {
            return null;
        } else {
            form = plural ? firstOf(suggPlur(synonym, true)) : synonym;
        }
    }
    return form && spellChecker.isValid(form) ? form : null;
}

// Groupes d'une entrée du thésaurus, sans le mot lui-même et sans les groupes en double.
function addGroups(groups, label, words, word) {
    const lower = word.toLowerCase();
    const list = [...new Set(words.map((w) => w.replace(/\s+/gu, " ").trim()))].filter((w) => w && w.toLowerCase() !== lower);
    // Un groupe déjà contenu dans un autre (le thésaurus répète parfois une liste) est sauté.
    if (list.length && !groups.some((g) => list.every((w) => g.words.includes(w)))) {
        groups.push({ pos: label, words: list });
        return true;
    }
    return false;
}

function synonyms(word) {
    const data = loadThesaurus();
    // « l'écran » → « écran » ; « qu'importe » → « importe ».
    const clean = word.trim().replace(/’/g, "'").replace(/^(?:[ldjmnstc]|qu|jusqu|lorsqu|puisqu)'(?=\p{L})/iu, "");
    const lookup = (w) => data.get(w) ?? data.get(w.toLowerCase());
    const groups = [];
    const lemmas = [];
    // 1. L'entrée du mot tel quel (« grande », « rapide »).
    const exact = lookup(clean);
    if (exact) {
        for (const [pos, words] of exact) {
            addGroups(groups, posLabel(pos), words, clean);
        }
        if (groups.length) {
            lemmas.push(clean);
        }
    }
    // 2. Les lemmes (« grande » → « grand », « marchait » → « marcher »), synonymes accordés comme le mot.
    let inflected = false;
    const morphs = [...new Set([...spellChecker.getMorph(clean), ...spellChecker.getMorph(clean.toLowerCase())])];
    for (const morph of morphs) {
        const lemma = morph.slice(1, morph.indexOf("/"));
        const tags = morph.slice(morph.indexOf("/") + 1);
        if (!lemma || lemma.toLowerCase() === clean.toLowerCase()) {
            continue;
        }
        const entry = lookup(lemma);
        if (!entry) {
            continue;
        }
        const category = /:V/.test(tags) ? "verbe" : /:N/.test(tags) ? "nom" : /:A/.test(tags) ? "adjectif" : /:W/.test(tags) ? "adverbe" : null;
        for (const [pos, list] of entry) {
            const label = posLabel(pos);
            if (category && label && !label.includes(category) && !(category === "nom" && label.includes("adjectif")) && !(category === "adjectif" && label.includes("nom"))) {
                continue;
            }
            const words = list.map((syn) => inflect(syn, tags)).filter(Boolean);
            if (addGroups(groups, label, words, clean)) {
                inflected = true;
                if (!lemmas.includes(lemma)) {
                    lemmas.push(lemma);
                }
            }
        }
    }
    return { word: clean, lemma: lemmas.join(", ") || clean, inflected, groups: groups.slice(0, MAX_SYNONYM_GROUPS) };
}

// --- Conjugueur ---
// Module de conjugaison de Grammalecte (classe Verb). On accepte aussi une forme conjuguée
// (« marchait » → « marcher ») et un verbe pronominal (« se lever », « s'asseoir »).
function findInfinitive(input) {
    let word = input.trim().replace(/’/g, "'").replace(/\s+/g, " ");
    let pronominal = false;
    const pro = /^(?:se |s')(.+)$/iu.exec(word);
    if (pro) {
        word = pro[1];
        pronominal = true;
    }
    const candidates = [word, word.toLowerCase()];
    for (const candidate of candidates) {
        if (conj.isVerb(candidate)) {
            return { infinitive: candidate, pronominal, fromForm: false };
        }
    }
    const lemmas = [];
    for (const candidate of candidates) {
        for (const morph of spellChecker.getMorph(candidate)) {
            const lemma = morph.slice(1, morph.indexOf("/"));
            if (/:V/.test(morph) && conj.isVerb(lemma) && !lemmas.includes(lemma)) {
                lemmas.push(lemma);
            }
        }
    }
    return lemmas.length ? { infinitive: lemmas[0], others: lemmas.slice(1), pronominal, fromForm: true } : null;
}

function conjugate(input, options = {}) {
    if (!String(input ?? "").trim()) {
        throw new Error("Aucun verbe à conjuguer.");
    }
    const found = findInfinitive(String(input).slice(0, 60));
    if (!found) {
        // Proposer des verbes proches (« conjuger » → « conjuguer »).
        const word = String(input).trim().toLowerCase();
        const suggestions = spellSuggestions(word, { infinitive: true }).filter((w) => conj.isVerb(w)).slice(0, 5);
        return { found: false, input: String(input).trim(), suggestions };
    }
    const verb = new Verb(found.infinitive);
    // Pronominal : impossible (-1), possible (0), obligatoire (1), cas particuliers (2).
    const pronominal = verb.nPronominable === 1 || (verb.nPronominable !== -1 && (options.pronominal || found.pronominal));
    const negative = !!options.negative;
    const compound = !!options.compound;
    const interrogative = !!options.interrogative;
    const feminine = !!options.feminine;
    const t = verb.createConjTable(pronominal, negative, compound, interrogative, feminine);
    const persons = (prefix, count = 6) => Array.from({ length: count }, (_, i) => t[`${prefix}${i + 1}`] ?? "");
    const tense = (title, prefix, count) => (t[title] ? { name: t[title], forms: persons(prefix, count) } : null);
    const moods = [
        { name: "Indicatif", tenses: [tense("t_ipre", "ipre"), tense("t_iimp", "iimp"), tense("t_ipsi", "ipsi"), tense("t_ifut", "ifut")] },
        { name: "Subjonctif", tenses: [tense("t_spre", "spre"), tense("t_simp", "simp")] },
        { name: "Conditionnel", tenses: [tense("t_conda", "conda"), tense("t_condb", "condb")] },
        { name: "Impératif", tenses: [tense("t_impe", "impe", 3)] },
    ].map((mood) => ({ ...mood, tenses: mood.tenses.filter((x) => x && x.forms.some(Boolean)) })).filter((mood) => mood.tenses.length);
    return {
        found: true,
        input: String(input).trim(),
        infinitive: found.infinitive,
        others: found.others ?? [],
        fromForm: found.fromForm,
        info: verb.sInfo,
        auxiliary: verb.sVerbAux,
        pronominable: verb.nPronominable,
        incomplete: verb.bUncomplete,
        options: { pronominal, negative, compound, interrogative, feminine },
        infinitiveForm: t.infi,
        presentParticiple: t.ppre,
        pastParticiples: [t.ppas1, t.ppas2, t.ppas3, t.ppas4].filter(Boolean),
        moods,
    };
}

// --- Répétitions ---
// Même mot plein (nom, adjectif, verbe, adverbe en -ment) revenu à moins de « distance » mots,
// comparé par lemme (« serveur » / « serveurs », « redémarre » / « redémarré »). On souligne
// la répétition, pas la première occurrence, et on propose des synonymes accordés.
const REPEAT_WORD = /[\p{L}]+(?:[-'’][\p{L}]+)*/gu;
// Verbes trop courants pour qu'une répétition gêne (« il faut… il faut… »).
const COMMON_VERBS = new Set(["être", "avoir", "faire", "aller", "pouvoir", "devoir", "vouloir", "falloir", "savoir", "dire", "mettre", "prendre", "venir", "voir", "donner", "passer"]);
const MAX_REPEAT_SYNONYMS = 4;  // le thésaurus mêle les sens : les premiers sont les plus sûrs
// Unités et mesures : « huit heures… deux heures » n'est pas une maladresse.
const REPEAT_UNITS = new Set(["heure", "minute", "seconde", "jour", "semaine", "mois", "année", "fois", "euro", "dollar", "mètre", "kilomètre", "gramme", "kilo", "litre", "pourcent", "octet", "mégaoctet", "gigaoctet", "page", "ligne"]);
const NUMBER_WORD = /^(\d+([.,]\d+)?|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt|trente|quarante|cinquante|soixante|cent|cents|mille|plusieurs|quelques)$/i;

function contentLemma(word, sentenceStart) {
    if (word.length < 4 || (word === word.toUpperCase() && /\p{Lu}/u.test(word))) {
        return null;  // mots courts, sigles (VLAN, DNS)
    }
    if (/^\p{Lu}/u.test(word) && !sentenceStart) {
        return null;  // nom propre (Captur, Elegoo)
    }
    const morphs = spellChecker.getMorph(word).concat(sentenceStart ? spellChecker.getMorph(word.toLowerCase()) : []);
    if (morphs.length === 0 || morphs.some((m) => /:[MG]/.test(m) && !/:[NAV]/.test(m))) {
        return null;  // inconnu, nom propre, mot grammatical
    }
    // Un mot dont une lecture est grammaticale (« son », « bien ») est laissé de côté.
    if (morphs.some((m) => /:G/.test(m))) {
        return null;
    }
    const lemmas = new Set();
    for (const m of morphs) {
        const lemma = m.slice(1, m.indexOf("/"));
        if (/:V/.test(m)) {
            if (COMMON_VERBS.has(lemma)) {
                return null;
            }
            lemmas.add(lemma);
        } else if (/:[NA]/.test(m) || (/:W/.test(m) && /ment$/.test(lemma))) {
            lemmas.add(lemma.toLowerCase());
        }
    }
    if (lemmas.size === 0) {
        return null;
    }
    const lemma = [...lemmas].sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
    return lemma.length >= 4 ? lemma : null;
}

function repetitionSynonyms(word) {
    try {
        const result = synonyms(word);
        return [...new Set(result.groups.flatMap((g) => g.words))].filter((w) => !/\s/.test(w)).slice(0, MAX_REPEAT_SYNONYMS);
    } catch {
        return [];
    }
}

function findRepetitions(text, distance, taken) {
    const words = [];
    let previousEnd = 0;
    for (const match of text.matchAll(REPEAT_WORD)) {
        const between = text.slice(previousEnd, match.index);
        const sentenceStart = words.length === 0 || /[.!?…\n]\s*$/.test(between);
        words.push({ text: match[0], start: match.index, end: match.index + match[0].length, sentenceStart });
        previousEnd = match.index + match[0].length;
    }
    const lastSeen = new Map();  // lemme → indice du mot
    const results = [];
    words.forEach((word, index) => {
        // « l'écran » : on regarde le mot après l'élision.
        const elided = /^(?:[ldjmnstc]|qu|jusqu|lorsqu|puisqu)['’](.+)$/iu.exec(word.text);
        const surface = elided ? elided[1] : word.text;
        const start = elided ? word.end - surface.length : word.start;
        const lemma = contentLemma(surface, word.sentenceStart);
        if (!lemma || REPEAT_UNITS.has(lemma)) {
            return;
        }
        const before = lastSeen.get(lemma);
        lastSeen.set(lemma, index);
        if (before === undefined || index - before > distance) {
            return;
        }
        if (taken.some((m) => start < m.end && word.end > m.start)) {
            return;  // déjà soulignée pour une autre faute
        }
        const gap = index - before;
        results.push({
            start,
            end: word.end,
            kind: "style",
            detail: "répétition",
            message: `«\u00a0${words[before].text.replace(/^(?:[ldjmnstc]|qu|jusqu|lorsqu|puisqu)['’]/iu, "")}\u00a0» est déjà employé ${gap} mot${gap > 1 ? "s" : ""} plus tôt. Un synonyme ?`,
            suggestions: repetitionSynonyms(surface),
            rule: "aria_repetition",
        });
    });
    return results;
}

// --- Homophones ---
// Nos règles (homophones.js) complètent Grammalecte. Quand l'une se déclenche, la
// phrase est réanalysée avec la correction : les fautes que Grammalecte signalait
// à cause du mauvais homophone (« Il ces trompé » → « trompé » à mettre au pluriel)
// disparaissent alors, et on les retire.
const sameFix = (error, fix) => error.suggestions.some((sugg) => sugg.toLowerCase().replace("’", "'") === fix.toLowerCase().replace("’", "'"));

function addHomophones(line, grammar) {
    const all = homophones.find(line, { formal: formalMode });
    // Grammalecte a déjà vu la faute et propose notre correction, mais pas en premier
    // (« Il et parti » → ait, est, hait) : on la remonte en tête.
    for (const h of all) {
        for (const e of grammar) {
            if (e.start <= h.start && e.end >= h.end && sameFix(e, h.suggestions[0]) && !sameFix({ suggestions: e.suggestions.slice(0, 1) }, h.suggestions[0])) {
                const fix = e.suggestions.find((sugg) => sameFix({ suggestions: [sugg] }, h.suggestions[0]));
                e.suggestions = [fix, ...e.suggestions.filter((sugg) => sugg !== fix)];
            }
        }
    }
    // Accords de participe que nos règles jugent justes (« elles se sont parlé ») : on retire
    // la faute signalée par Grammalecte.
    const vetoes = all.vetoes ?? [];
    grammar = grammar.filter((e) => !vetoes.some((v) => e.start < v.end && e.end > v.start && (v.rule ?? /ppas/).test(e.rule)));
    // Nos corrections passent toujours devant : la phrase est réanalysée avec elles, et les fautes de
    // Grammalecte qu'elles règlent disparaissent (même quand Grammalecte proposait la même chose,
    // pour que ses fautes liées ne soient pas regroupées autrement, « ce perd » → « ce pers »).
    // Règles d'accord d'Aria (pluriel, attribut, sujet-verbe…) : elles complètent Grammalecte. S'il
    // signale déjà quelque chose au même endroit, sa correction (pensée pour la phrase entière) prime ;
    // on remonte seulement la nôtre en tête si elle figure dans ses propositions.
    const WEAK = /_(pluriel_nom|accord_attribut|accord_sujet_verbe|ppas_relative|nous_verbe|vous_verbe|on_verbe)$/;
    const found = all.filter((h) => !WEAK.test(h.rule) || !grammar.some((e) => e.start < h.end && e.end > h.start));
    if (found.length === 0) {
        return { grammar, extra: [] };
    }
    let fixed = "";
    let cursor = 0;
    const shifts = [];
    for (const h of found) {
        fixed += line.slice(cursor, h.start) + h.suggestions[0];
        shifts.push({ at: h.end, delta: h.suggestions[0].length - (h.end - h.start) });
        cursor = h.end;
    }
    fixed += line.slice(cursor);
    const shift = (pos) => pos + shifts.filter((s) => s.at <= pos).reduce((sum, s) => sum + s.delta, 0);
    const after = new Set(gc_engine.parse(fixed, "FR", false, null, false).map((e) => `${e.sRuleId}|${e.nStart}|${e.nEnd}`));
    const overlaps = (e) => found.some((h) => e.start < h.end && e.end > h.start);
    const kept = grammar.filter((e) => !overlaps(e) && after.has(`${e.rule}|${shift(e.start)}|${shift(e.end)}`));
    return { grammar: kept, extra: found };
}

// « Français écrit soigné » : règle du « ne » oublié de Grammalecte et règles de registre d'Aria.
// Les caches de réanalyse dépendent des options : on les vide quand le réglage change.
let formalMode = false;

function setFormal(formal) {
    if (formal !== formalMode) {
        formalMode = formal;
        gc_engine.setOption("neg", formal);
        solutionCache.clear();
        cascadeCache.clear();
    }
}

// Grammalecte met parfois sa suggestion en capitales (« C' » → « CE N' ») : on suit la casse du texte.
function followCase(original, suggestion) {
    const letters = original.replace(/[^\p{L}]/gu, "");
    const shouting = suggestion.replace(/[^\p{L}]/gu, "").length > 1 && suggestion === suggestion.toUpperCase();
    if (shouting && (letters.length <= 1 || letters !== letters.toUpperCase())) {
        const lower = suggestion.toLowerCase();
        return /^\p{Lu}/u.test(original) ? lower[0].toUpperCase() + lower.slice(1) : lower;
    }
    return suggestion;
}

// « Le serveur à redémarré » : Grammalecte propose deux corrections contraires, « a » sur « à »
// et « redémarrer » sur le participe. Une seule est juste : si la proposition a déjà un sujet
// pronom (« il reste plein de choses à organisé »), c'est l'infinitif ; sinon (« le serveur… »),
// c'est « a ». On retire l'autre.
const A_VERB_RULE = /^g\d__conf_a_à_verbe__/;
const SUBJECT_PRONOUN = /(?:^|[\s'’])(je|j|tu|il|elle|on|nous|vous|ils|elles)(?=[\s'’])/i;

function resolveAOrInfinitive(line, grammar) {
    const drop = new Set();
    for (const onA of grammar) {
        if (!A_VERB_RULE.test(onA.rule) || !/^à(?!\p{L})/u.test(line.slice(onA.start, onA.end))) {
            continue;
        }
        const onVerb = grammar.find((m) => m !== onA && m.start >= onA.end && m.start - onA.end <= 12
            && (A_VERB_RULE.test(m.rule) || /^g\d__infi_/.test(m.rule)));
        if (!onVerb) {
            continue;
        }
        const clause = line.slice(0, onA.start).split(/[.!?;:,\n]|\b(?:et|mais|puis|qui|que)\b/).pop();
        drop.add(SUBJECT_PRONOUN.test(clause) ? onA : onVerb);
    }
    return grammar.filter((m) => !drop.has(m));
}

// « La tâche planifiée était désactiver » : Grammalecte propose désactivé | désactivée. On met
// en tête la forme qui s'accorde avec le sujet (désactivée).
function orderParticiples(line, grammar) {
    return grammar.map((match) => {
        if (match.suggestions.length < 2 || !(/ppas/.test(match.rule) || /conf_a_à_verbe|infi/.test(match.rule))) {
            return match;
        }
        const lastWord = line.slice(match.start, match.end).trim().split(/\s+/).at(-1);
        if (!spellChecker.getMorph(lastWord.toLowerCase()).some((m) => /:[QY]/.test(m))) {
            return match;  // « vides » n'est pas un participe : on ne propose pas « vidé »
        }
        const agreement = homophones.agreementBefore(line, match.start);
        if (!agreement) {
            return match;
        }
        const [gender, number] = agreement.split(":");
        const genders = gender === "?" ? "mfe" : `${gender}e`;
        const fits = (suggestion) => {
            const word = suggestion.trim().split(/\s+/).at(-1);
            return spellChecker.getMorph(word).some((m) => /:Q/.test(m) && new RegExp(`:[${genders}]:[${number}i]`).test(m));
        };
        const best = match.suggestions.findIndex(fits);
        if (best <= 0) {
            return match;
        }
        return { ...match, suggestions: [match.suggestions[best], ...match.suggestions.filter((_, i) => i !== best)] };
    });
}

// Jargon informatique passé dans le français courant des équipes techniques : pas une faute.
const IT_WORDS = new Set(["switch", "switchs", "switches", "firewall", "firewalls", "backup", "backups", "hotfix", "hotfixes", "release", "releases",
    "merge", "merges", "push", "rollback", "rollbacks", "frontend", "front-end", "backend", "back-end", "debug", "debugger", "débugger", "débuggé",
    "workflow", "workflows", "dashboard", "dashboards", "email", "emails", "reboot", "reboots", "rebooter", "rebooté", "update", "updates",
    "ping", "pings", "pinger", "pingé", "datacenter", "datacenters", "repo", "repos", "helpdesk", "backlog", "backlogs", "scrum", "visio", "visios",
    "webhook", "webhooks", "endpoint", "endpoints", "fullstack", "devops", "bash", "crontab", "crontabs", "cron", "crons", "laptop", "laptops",
    "app", "apps", "checklist", "checklists", "roadmap", "roadmaps", "deadline", "deadlines", "template", "templates", "snapshot", "snapshots",
    "alerting", "ticketing", "check", "checks", "checker", "checké", "call", "calls", "password", "passwords", "sysadmin", "sysadmins", "homelab"]);

// Un mot inconnu avec une majuscule au milieu d'une phrase est presque toujours un nom propre ou
// une marque (Elegoo, Captur, Proxmox). On ne le souligne que si un nom propre connu est tout
// proche (« Marseile » → Marseille).
function likelyProperNoun(word, before, context) {
    if (!/^\p{Lu}\p{Ll}/u.test(word) || /(?:^|[.!?…:;«"“(\-•*]\s*)$/u.test(before.trimEnd()) || before.trim() === "") {
        return false;
    }
    const candidates = spellSuggestions(word, context).slice(0, 3);
    const limit = word.length >= 8 ? 2 : 1;
    return !candidates.some((c) => spellChecker.getMorph(c).some((m) => /:M/.test(m)) && damerau(c.toLowerCase(), word.toLowerCase(), limit) <= limit);
}

// « Tu pourrai m'appeler ? », « Je serait là demain », « Je vous saurez gré » : Grammalecte corrige la
// personne mais hésite entre futur et conditionnel. On met en tête celui que la phrase appelle :
// conditionnel dans une question, dans « saurais gré » et avec les verbes de politesse (je voudrais,
// tu devrais) ; futur avec un repère de temps à venir (demain, la semaine prochaine…).
const FUTURE_MARKERS = /(?:^|[\s'’])(demain|bientôt|prochaine?s?|plus tard|tout à l'heure|ce soir|cette semaine|dans (?:une|un|deux|trois|quatre|cinq|dix|quelques|\d+)|dès que|quand|lorsque|lorsqu)(?=[\s,.!?;:]|$)/iu;
const POLITE_VERBS = new Set(["pouvoir", "vouloir", "devoir", "aimer", "souhaiter", "préférer", "falloir", "désirer"]);
// Souhait ou désir : conditionnel même avec un repère futur (« il souhaiterait vous voir la semaine prochaine »).
const WISH_VERBS = new Set(["vouloir", "aimer", "souhaiter", "préférer", "désirer"]);

function orderFutureConditional(line, grammar) {
    return grammar.map((match) => {
        const original = line.slice(match.start, match.end);
        const first = match.suggestions[0];
        if (!first || !/^\p{L}+$/u.test(original) || !/r(ai|ais|ait|as|a|ions|iez|aient|ons|ez|ont)$/i.test(original)) {
            return match;
        }
        // Verbe : celui du mot fautif ; personne : celle de la suggestion, sinon celle du sujet.
        const own = spellChecker.getMorph(original.toLowerCase()).find((m) => /:V[^/]*:(If|K)/.test(m));
        const entry = spellChecker.getMorph(first.toLowerCase()).find((m) => /:V[^/]*:(If|K)/.test(m));
        const person = (entry && /:([123][sp])/.exec(entry)?.[1]) || expectedPerson(line.slice(0, match.start))?.slice(1);
        const source = own ?? entry;
        if (!person || !source) {
            return match;
        }
        const lemma = source.slice(1, source.indexOf("/"));
        const future = conj.getConj(lemma, ":If", `:${person}`);
        const conditional = conj.getConj(lemma, ":K", `:${person}`);
        // Le mot est déjà à la bonne personne (la faute est ailleurs, « il viendra pas ») : on n'y touche pas.
        if (!future || !conditional || [future, conditional].includes(original.toLowerCase())) {
            return match;
        }
        const [from, to] = sentenceBounds(line, match.start, match.end);
        const sentence = line.slice(from, to);
        const after = line.slice(match.end, match.end + 8);
        let preferConditional = null;
        if (/\?/.test(sentence) || /^\s*gré(?!\p{L})/u.test(after) || WISH_VERBS.has(lemma)) {
            preferConditional = true;
        } else if (FUTURE_MARKERS.test(sentence)) {
            preferConditional = false;
        } else if (POLITE_VERBS.has(lemma)) {
            preferConditional = true;
        }
        if (preferConditional === null) {
            return match;
        }
        const best = followCase(original, preferConditional ? conditional : future);
        const second = followCase(original, preferConditional ? future : conditional);
        const keep = (x) => (/^\p{Lu}/u.test(original) ? x[0].toUpperCase() + x.slice(1) : x);
        return { ...match, suggestions: [...new Set([keep(best), keep(second), ...match.suggestions])].filter((x) => x.toLowerCase() !== original.toLowerCase()) };
    });
}

// « Les candidatures reçus après le 30 novembre ne seront pas étudiées » : Grammalecte lit « reçus »
// comme un verbe conjugué (je reçus) et propose « reçoivent ». Si la phrase a son verbe plus loin,
// c'est un participe à accorder avec le nom : on propose d'abord « reçues ».
function participleAfterNoun(line, grammar) {
    return grammar.map((match) => {
        const word = line.slice(match.start, match.end);
        if (!/conj/.test(match.rule) || !/^\p{L}+$/u.test(word)) {
            return match;
        }
        const entry = spellChecker.getMorph(word.toLowerCase()).find((m) => /:Q/.test(m));
        if (!entry) {
            return match;
        }
        const [, to] = sentenceBounds(line, match.start, match.end);
        const rest = homophones ? Homophones.tokenize(line.slice(match.end, to)) : [];
        const laterVerb = rest.some((t) => spellChecker.getMorph(t.text).some((m) => /:V[^/]*:(Ip|Iq|If|K|Is)/.test(m)) && !spellChecker.getMorph(t.text).some((m) => /:[NAQ]/.test(m)));
        const agreement = laterVerb && homophones.agreementBefore(line, match.start);
        if (!agreement) {
            return match;
        }
        const [gender, number] = agreement.split(":");
        const form = conj.getConj(entry.slice(1, entry.indexOf("/")), ":Q", `:${gender === "?" ? "m" : gender}:${number}`);
        if (!form || form === word.toLowerCase()) {
            return match;
        }
        return { ...match, suggestions: [form, ...match.suggestions.filter((x) => x !== form)] };
    });
}

// « Elle est très prête » : Grammalecte propose « près ». Après « être » (et un adverbe), en fin
// de phrase ou devant « à », « pour », c'est bien l'adjectif « prêt ».
const PRET_BEFORE = /(?:^|\s)(?:suis|es|est|sommes|êtes|sont|étais|était|étions|étiez|étaient|serai|seras|sera|serons|serez|seront|serais|serait|seraient|sois|soit|soient|fin|presque|toujours|déjà|enfin|vraiment|très|trop|assez|bien|pas|tout|toute|toutes|tous|plus)\s+$/iu;

function vetoPretPres(line, grammar) {
    return grammar.filter((m) => {
        if (!/conf_près_prêt/.test(m.rule) || !/^prête?s?$/i.test(line.slice(m.start, m.end))) {
            return true;
        }
        return !(PRET_BEFORE.test(line.slice(0, m.start)) && /^\s*(?:$|[.,;:!?)]|à\b|pour\b|au\b)/u.test(line.slice(m.end)));
    });
}

// Majuscule en début de paragraphe : « bonjours, je… », « ok, je m'en occupe ». Une ligne qui suit
// une ligne sans ponctuation finale est la suite de la même phrase (texte coupé) : on n'y touche pas.
// Les mots inconnus du dictionnaire (systemd, nginx), les noms à majuscule interne (iPhone), les
// adresses, mentions et hashtags gardent leur minuscule.
const PARAGRAPH_WORD = /^[\s"«“(\[]*(\p{Ll}[\p{L}'’-]*)/u;

function capitalAtStart(line, previous) {
    if (previous !== null && previous.trim() !== "" && !/[.!?…:,;)»”"]\s*$/.test(previous)) {
        return null;
    }
    const match = PARAGRAPH_WORD.exec(line);
    if (!match || /^(https?|www|ftp)\b/i.test(line.trim()) || /[@#/\\]/.test(line.slice(0, match.index + match[0].length + 1))) {
        return null;
    }
    const word = match[1].replace(/['’-].*$/, "");
    if (/\p{Lu}/u.test(word)) {
        return null;
    }
    let capital = word[0].toUpperCase() + word.slice(1);
    if (!spellChecker.isValid(capital) && word.length <= 3 && spellChecker.isValid(word.toUpperCase())) {
        capital = word.toUpperCase();  // « ok » → OK
    }
    if (!spellChecker.isValid(word) && !spellChecker.isValid(capital)) {
        return null;
    }
    const start = match[0].length - match[1].length;
    return {
        start,
        end: start + word.length,
        kind: "grammaire",
        detail: "majuscule",
        message: "Majuscule en début de phrase.",
        suggestions: [capital],
        rule: "aria_majuscule_debut",
    };
}

function check(text, formal = false, repetitionDistance = 0) {
    setFormal(formal);
    const start = performance.now();
    const matches = [];
    let offset = 0;
    editCandidatesBudget = MAX_EDIT_CANDIDATES_WORDS;
    let previous = null;
    for (const line of text.split("\n")) {
        if (line.trim() !== "") {
            const grammar = gc_engine.parse(line, "FR", false, null, false).map((err) => ({
                start: err.nStart,
                end: err.nEnd,
                kind: "grammaire",
                detail: /^g\d__neg_/.test(err.sRuleId) ? "français soigné" : err.sType,
                message: err.sMessage,
                suggestions: (err.aSuggestions || []).map((sugg) => followCase(line.slice(err.nStart, err.nEnd), sugg)),
                rule: err.sRuleId,
            }));
            const { grammar: independent, extra: aria } = addHomophones(line, participleAfterNoun(line, orderParticiples(line, resolveAOrInfinitive(line, vetoPretPres(line, grammar)))));
            const extra = orderFutureConditional(line, aria);
            const grouped = orderFutureConditional(line, orderParticiples(line, groupLinkedErrors(line, independent).filter((m) => !extra.some((h) => m.start < h.end && m.end > h.start))));
            // Les suggestions suivent l'apostrophe du texte : droite ('), sauf si le texte n'emploie que la courbe (’).
            const apostrophe = line.includes("’") && !line.includes("'") ? "’" : "'";
            const withApostrophe = (list) => list.map((sugg) => sugg.replace(/['’]/g, apostrophe));
            for (const match of [...grouped, ...extra]) {
                matches.push({ ...match, suggestions: withApostrophe(match.suggestions), start: offset + match.start, end: offset + match.end });
            }
            const capital = capitalAtStart(line, previous);
            if (capital) {
                const covering = matches.filter((m) => m.start <= offset + capital.start && m.end > offset + capital.start && m.rule !== "spelling");
                if (covering.length) {
                    // Une autre faute sur le premier mot (« personnes ne… ») : sa correction prend la majuscule.
                    for (const m of covering) {
                        m.suggestions = m.suggestions.map((sugg) => (sugg ? sugg[0].toUpperCase() + sugg.slice(1) : sugg));
                    }
                } else {
                    matches.push({ ...capital, start: offset + capital.start, end: offset + capital.end });
                }
            }
            for (const err of spellChecker.parseParagraph(line)) {
                if (capital && err.nStart === capital.start && spellChecker.isValid(capital.suggestions[0])) {
                    continue;  // « ok » au début : c'est la majuscule qui manque (Ok), pas l'orthographe
                }
                if (IT_WORDS.has(err.sValue.toLowerCase())) {
                    continue;  // jargon informatique courant (switch, backup, firewall…)
                }
                const before = line.slice(0, err.nStart);
                const context = spellingContext(before);
                if (likelyProperNoun(err.sValue, before, context)) {
                    continue;  // nom propre ou marque inconnue au milieu d'une phrase (Elegoo, Captur)
                }
                matches.push({
                    start: offset + err.nStart,
                    end: offset + err.nEnd,
                    kind: "orthographe",
                    detail: "spelling",
                    message: "Mot absent du dictionnaire.",
                    suggestions: withApostrophe(spellSuggestions(err.sValue, context)),
                    rule: "spelling",
                });
            }
        }
        offset += line.length + 1;
        if (line.trim() !== "") {
            previous = line;
        }
    }
    if (repetitionDistance > 0) {
        matches.push(...findRepetitions(text, repetitionDistance, matches));
    }
    matches.sort((a, b) => a.start - b.start);
    return { matches, ms: performance.now() - start };
}

self.onmessage = (event) => {
    const { id, cmd, payload } = event.data;
    try {
        let result;
        if (cmd === "init") {
            result = init();
        } else if (cmd === "check") {
            result = check(payload.text, !!payload.formal, Number(payload.repetitions) || 0);
        } else if (cmd === "conjugate") {
            result = conjugate(payload.verb, payload.options);
        } else if (cmd === "synonyms") {
            result = synonyms(payload.word);
        } else if (cmd === "morph") {
            // Banc et mise au point : étiquettes du dictionnaire et type de verbe.
            result = (payload.words ?? []).map((word) => ({ word, morph: spellChecker.getMorph(word), vtyp: conj.isVerb(word) ? conj.getVtyp(word) : null }));
        } else if (cmd === "rules") {
            // Banc de mesure : les règles d'Aria seules, sans Grammalecte.
            result = [...homophones.find(payload.text, { formal: !!payload.formal })];
        } else {
            throw new Error(`Commande inconnue : ${cmd}`);
        }
        self.postMessage({ id, ok: true, result });
    } catch (error) {
        self.postMessage({ id, ok: false, error: String(error?.message ?? error) });
    }
};
