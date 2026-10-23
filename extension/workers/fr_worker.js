// Aria Plume — worker français (Grammalecte 2.3, fichiers d'origine non modifiés)
"use strict";

const BASE = new URL("../engines/grammalecte/", self.location).href;

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
importScripts(new URL("fr_homophones.js", self.location).href);

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

function substitutionCost(a, b) {
    if (stripAccent(a) === stripAccent(b)) {
        return 0.5;  // accent oublié ou en trop
    }
    if (VOWELS.has(a) && VOWELS.has(b)) {
        return 0.8;
    }
    return keyboardNeighbours(a, b) ? 0.9 : 1.2;
}

function editCandidates(word) {
    const lower = word.toLowerCase();
    const costs = new Map();
    const add = (candidate, cost) => {
        if (candidate && candidate !== lower && !candidate.endsWith("è") && (!costs.has(candidate) || costs.get(candidate) > cost)) {
            costs.set(candidate, cost);
        }
    };
    for (let i = 0; i <= lower.length; i++) {
        const left = lower.slice(0, i);
        const right = lower.slice(i);
        if (right) {
            add(left + right.slice(1), right[0] === left.at(-1) || right[0] === right[1] ? 0.6 : 1);
        }
        if (right.length > 1) {
            add(left + right[1] + right[0] + right.slice(2), 0.8);
        }
        for (const letter of LETTERS) {
            if (right) {
                add(left + letter + right.slice(1), substitutionCost(right[0], letter));
            }
            add(left + letter + right, letter === left.at(-1) || letter === right[0] ? 0.6 : 1);
        }
    }
    const valid = [...costs].filter(([candidate]) => spellChecker.isValid(candidate));
    valid.sort((a, b) => a[1] - b[1]);
    return valid.map(([candidate]) => candidate);
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

function spellSuggestions(word) {
    const cached = suggestionCache.get(word);
    if (cached) {
        return cached;
    }
    const result = computeSpellSuggestions(word);
    if (suggestionCache.size >= SUGGESTION_CACHE_MAX) {
        suggestionCache.delete(suggestionCache.keys().next().value);
    }
    suggestionCache.set(word, result);
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

function computeSpellSuggestions(word) {
    const barbarism = barbarismSuggestions(word);
    if (barbarism.confident) {
        return barbarism.list;  // « faisez » → faites, sans « baisez » ni « taisez »
    }
    const suggestions = barbarism.list;
    if (word.length <= 25 && editCandidatesBudget > 0) {
        editCandidatesBudget--;
        suggestions.push(...editCandidates(word).map((c) => matchCase(word, c)));
    }
    for (const block of spellChecker.suggest(word, MAX_SUGGESTIONS + 5)) {
        suggestions.push(...block);
    }
    return [...new Set(suggestions)].slice(0, MAX_SUGGESTIONS);
}

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
    const solutions = rankSolutions(line.slice(start, end), solveRegion(line.slice(from, to), start - from, end - from));
    if (solutions.length === 0) {
        return null;
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
        const suggestions = spellSuggestions(word).filter((w) => conj.isVerb(w)).slice(0, 5);
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
// Nos règles (fr_homophones.js) complètent Grammalecte. Quand l'une se déclenche, la
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
    grammar = grammar.filter((e) => !(/ppas/.test(e.rule) && vetoes.some((v) => e.start < v.end && e.end > v.start)));
    const found = all.filter((h) => !grammar.some((e) => e.start <= h.start && e.end >= h.end && sameFix(e, h.suggestions[0])));
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

function check(text, formal = false, repetitionDistance = 0) {
    setFormal(formal);
    const start = performance.now();
    const matches = [];
    let offset = 0;
    editCandidatesBudget = MAX_EDIT_CANDIDATES_WORDS;
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
            const { grammar: independent, extra } = addHomophones(line, grammar);
            const grouped = groupLinkedErrors(line, independent).filter((m) => !extra.some((h) => m.start < h.end && m.end > h.start));
            // Les suggestions suivent l'apostrophe du texte : droite ('), sauf si le texte n'emploie que la courbe (’).
            const apostrophe = line.includes("’") && !line.includes("'") ? "’" : "'";
            const withApostrophe = (list) => list.map((sugg) => sugg.replace(/['’]/g, apostrophe));
            for (const match of [...grouped, ...extra]) {
                matches.push({ ...match, suggestions: withApostrophe(match.suggestions), start: offset + match.start, end: offset + match.end });
            }
            for (const err of spellChecker.parseParagraph(line)) {
                matches.push({
                    start: offset + err.nStart,
                    end: offset + err.nEnd,
                    kind: "orthographe",
                    detail: "spelling",
                    message: "Mot absent du dictionnaire.",
                    suggestions: withApostrophe(spellSuggestions(err.sValue)),
                    rule: "spelling",
                });
            }
        }
        offset += line.length + 1;
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
        } else {
            throw new Error(`Commande inconnue : ${cmd}`);
        }
        self.postMessage({ id, ok: true, result });
    } catch (error) {
        self.postMessage({ id, ok: false, error: String(error?.message ?? error) });
    }
};
