// Aria ODL — worker français (Grammalecte 2.3, fichiers d'origine non modifiés)
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

function computeSpellSuggestions(word) {
    const suggestions = [];
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

// --- Homophones ---
// Nos règles (fr_homophones.js) complètent Grammalecte. Quand l'une se déclenche, la
// phrase est réanalysée avec la correction : les fautes que Grammalecte signalait
// à cause du mauvais homophone (« Il ces trompé » → « trompé » à mettre au pluriel)
// disparaissent alors, et on les retire.
const sameFix = (error, fix) => error.suggestions.some((sugg) => sugg.toLowerCase().replace("’", "'") === fix.toLowerCase().replace("’", "'"));

function addHomophones(line, grammar) {
    const found = homophones.find(line).filter((h) => !grammar.some((e) => e.start <= h.start && e.end >= h.end && sameFix(e, h.suggestions[0])));
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

function check(text) {
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
                detail: err.sType,
                message: err.sMessage,
                suggestions: err.aSuggestions || [],
                rule: err.sRuleId,
            }));
            const { grammar: independent, extra } = addHomophones(line, grammar);
            const grouped = groupLinkedErrors(line, independent).filter((m) => !extra.some((h) => m.start < h.end && m.end > h.start));
            for (const match of [...grouped, ...extra]) {
                matches.push({ ...match, start: offset + match.start, end: offset + match.end });
            }
            for (const err of spellChecker.parseParagraph(line)) {
                matches.push({
                    start: offset + err.nStart,
                    end: offset + err.nEnd,
                    kind: "orthographe",
                    detail: "spelling",
                    message: "Mot absent du dictionnaire.",
                    suggestions: spellSuggestions(err.sValue),
                    rule: "spelling",
                });
            }
        }
        offset += line.length + 1;
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
            result = check(payload.text);
        } else {
            throw new Error(`Commande inconnue : ${cmd}`);
        }
        self.postMessage({ id, ok: true, result });
    } catch (error) {
        self.postMessage({ id, ok: false, error: String(error?.message ?? error) });
    }
};
