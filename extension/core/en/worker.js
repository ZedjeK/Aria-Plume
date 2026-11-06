// Aria Plume — worker anglais (Harper 2.10, binaire WebAssembly « slim », fichiers d'origine non modifiés)
import { LocalLinter, Dialect, SuggestionKind } from "../../engines/harper/index.js";
import { slimBinary } from "../../engines/harper/slimBinary.js";
import { articleForAcronym, findEnglishRules, IRREGULAR_PP } from "./rules.js";
import "../shared/frequences-data.js";
import "../shared/frequences.js";

// Prétérits et participes irréguliers (lent, sent, went, gone…) : voir les fausses alertes de Harper.
const PAST_FORMS = new Set([...Object.keys(IRREGULAR_PP), ...Object.values(IRREGULAR_PP), "lent", "sent", "spent", "bent", "meant", "built", "felt", "kept", "left", "lost", "paid", "said", "sold", "told", "thought", "brought", "bought", "caught", "taught", "fought", "found", "held", "led", "read", "slept", "stood", "understood", "won", "made", "had", "heard", "met", "put", "set", "cut", "hit", "let", "shut", "quit"]);

const KIND_MAP = {
    Spelling: "orthographe",
    Typo: "orthographe",
    Punctuation: "typographie",
    Capitalization: "typographie",
    Formatting: "typographie",
    Style: "style",
    Readability: "style",
    Redundancy: "style",
    Repetition: "style",
    Enhancement: "style",
    WordChoice: "style",
};

let linter = null;
let currentDialect = "american";
const DIALECT_VALUES = {
    american: Dialect.American,
    british: Dialect.British,
    canadian: Dialect.Canadian,
    australian: Dialect.Australian,
    indian: Dialect.Indian,
};

async function init() {
    const start = performance.now();
    linter = new LocalLinter({ binary: slimBinary, dialect: Dialect.American });
    await linter.setup();
    return { ms: performance.now() - start };
}

const QWERTY = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
function neighbours(a, b) {
    for (let row = 0; row < QWERTY.length; row++) {
        const col = QWERTY[row].indexOf(a);
        if (col >= 0) {
            for (let r = row - 1; r <= row + 1; r++) {
                if (QWERTY[r] && [col - 1, col, col + 1].some((c) => QWERTY[r][c] === b)) {
                    return true;
                }
            }
        }
    }
    return false;
}

// Distance de frappe : touche voisine 0.5, inversion 0.35, lettre doublée 0.5, voyelle 0.8, le reste 1.
function typingCost(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) {
        d[0][j] = j;
    }
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const x = a[i - 1];
            const y = b[j - 1];
            const sub = x === y ? 0 : neighbours(x, y) ? 0.5 : /[aeiouy]/.test(x) && /[aeiouy]/.test(y) ? 0.8 : 1;
            const del = i > 1 && a[i - 2] === x ? 0.5 : 1;
            const ins = j > 1 && b[j - 2] === y ? 0.5 : 1;
            d[i][j] = Math.min(d[i - 1][j] + del, d[i][j - 1] + ins, d[i - 1][j - 1] + sub);
            if (i > 1 && j > 1 && x === b[j - 2] && a[i - 2] === y) {
                d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 0.35);  // « wnat » → want : l'inversion est la faute de frappe la plus courante
            }
        }
    }
    return d[a.length][b.length];
}

// Mots courants à une retouche du mot écrit : lettre oubliée, en trop, remplacée ou inversée. Seuls
// restent ceux qui sont des mots entiers du vocabulaire (donc des mots d'usage) ; Harper tranche ensuite.
const LETTERS = "abcdefghijklmnopqrstuvwxyz";
function editCandidates(word) {
    const found = new Set();
    const keep = (candidate) => {
        if (candidate !== word && candidate.length > 1 && self.AriaFrequences?.known(candidate)) {
            found.add(candidate);
        }
    };
    for (let i = 0; i <= word.length; i++) {
        const left = word.slice(0, i);
        const right = word.slice(i);
        if (right) {
            keep(left + right.slice(1));
        }
        if (right.length > 1) {
            keep(left + right[1] + right[0] + right.slice(2));
        }
        for (const letter of LETTERS) {
            if (right) {
                keep(left + letter + right.slice(1));
            }
            keep(left + letter + right);
        }
    }
    return [...found];
}

// Classement : coût de frappe (touche voisine, lettre doublée…), fréquence d'usage, et une coupure
// en deux mots (« mo ring ») seulement si rien de mieux n'existe.
const FREQUENCY_WEIGHT = 1.2;
// Indices tirés des mots voisins : après un déterminant, pas un mot-outil (« the dors » → doors, pas
// does) ; après have/has/had, un participe (« has knon » → known) ; quelques suites figées
// (« evey day » → every, « evn if » → even).
const FUNCTION_WORDS = new Set(["does", "do", "did", "is", "are", "was", "were", "has", "have", "had", "be", "been", "am", "can", "will", "would", "should", "could", "may", "might", "must", "shall", "not", "no", "non", "and", "or", "but", "if", "of", "to", "in", "on", "at", "by", "for", "with", "from", "the", "a", "an", "this", "that", "these", "those", "it", "he", "she", "we", "they", "you", "i", "me", "him", "her", "us", "them", "my", "your", "his", "its", "our", "their", "so", "as", "than", "then", "too", "very"]);
const DETERMINERS = new Set(["the", "a", "an", "my", "your", "his", "her", "its", "our", "their", "this", "that", "these", "those", "some", "any", "every", "each", "no"]);
const PARTICIPLES = new Set(Object.values(IRREGULAR_PP));
const COLLOCATIONS = {
    every: /^(?:day|time|week|month|year|morning|night|evening|weekend|one|body|thing|where|single|other|minute|hour|second|now)$/,
    ever: /^(?:since|after|before|again|seen|been|had)$/,
    even: /^(?:if|though|more|less|better|worse|when|then|now|still)$/,
};
function rankTypos(original, suggestions, { prev = "", next = "" } = {}) {
    const score = (suggestion) => {
        const lower = suggestion.toLowerCase();
        const plain = lower.replace(/\s+/g, "");
        const split = lower.includes(" ") ? 0.8 : 0;
        const common = self.AriaFrequences?.ready ? self.AriaFrequences.commonness(plain) : 0.5;
        let context = 0;
        if (DETERMINERS.has(prev) && FUNCTION_WORDS.has(plain)) {
            context += 0.8;
        }
        if (/^(?:has|have|had|having|['’]ve)$/.test(prev) && (PARTICIPLES.has(plain) || /(?:ed|en|wn)$/.test(plain))) {
            context -= 0.6;
        }
        if (COLLOCATIONS[plain]?.test(next)) {
            context -= 0.6;
        }
        return typingCost(original, plain) + split + context - FREQUENCY_WEIGHT * (common - 0.5);
    };
    return suggestions.map((suggestion, index) => ({ suggestion, index, cost: score(suggestion) }))
        .sort((a, b) => a.cost - b.cost || a.index - b.index)
        .map((x) => x.suggestion);
}

const GRAMMAR_KINDS = /^(?:Agreement|Grammar|Miscellaneous|Usage|Word ?Choice)$/i;
async function fitInSentence(text, start, end, suggestions) {
    // La phrase seulement (jusqu'aux ponctuations fortes), pour un essai rapide.
    const from = Math.max(text.lastIndexOf(".", start - 1), text.lastIndexOf("!", start - 1), text.lastIndexOf("?", start - 1), text.lastIndexOf("\n", start - 1)) + 1;
    const stops = [".", "!", "?", "\n"].map((c) => text.indexOf(c, end)).filter((k) => k >= 0);
    const to = stops.length ? Math.min(...stops) + 1 : text.length;
    const top = suggestions.slice(0, 3).filter((s) => !s.includes(" "));
    if (top.length < 2) {
        return suggestions;
    }
    const counts = [];
    for (const suggestion of top) {
        const sentence = text.slice(from, start) + suggestion + text.slice(end, to);
        const at = start - from;
        const near = (s, e) => e > at - 20 && s < at + suggestion.length + 20;
        const harper = (await linter.lint(sentence, { language: "plaintext" })).filter((lint) => GRAMMAR_KINDS.test(lint.lint_kind()) && near(lint.span().start, lint.span().end)).length;
        const aria = findEnglishRules(sentence).filter((r) => r.kind === "grammaire" && near(r.start, r.end)).length;
        counts.push(harper + aria);
    }
    if (new Set(counts).size < 2) {
        return suggestions;
    }
    const ranked = top.map((suggestion, index) => ({ suggestion, index, errors: counts[index] }))
        .sort((a, b) => a.errors - b.errors || a.index - b.index)
        .map((x) => x.suggestion);
    return [...ranked, ...suggestions.filter((s) => !top.includes(s))];
}

// Mot d'avant et mot d'après (en minuscules), sans traverser une ponctuation forte.
function neighboursOf(text, m) {
    const prev = /([A-Za-z'’]+)\s+$/.exec(text.slice(Math.max(0, m.start - 40), m.start))?.[1]?.toLowerCase() ?? "";
    const next = /^\s+([A-Za-z'’]+)/.exec(text.slice(m.end, m.end + 40))?.[1]?.toLowerCase() ?? "";
    return { prev, next };
}

// Variante d'anglais choisie dans les réglages (orthographe américaine, britannique…).
async function useDialect(dialect) {
    if (dialect && dialect !== currentDialect && dialect in DIALECT_VALUES) {
        await linter.setDialect(DIALECT_VALUES[dialect]);
        currentDialect = dialect;
    }
}

async function check(text, dialect) {
    await useDialect(dialect);
    const start = performance.now();
    const lints = await linter.lint(text, { language: "plaintext" });
    const matches = lints.map((lint) => {
        const span = lint.span();
        // Harper 2.10 renvoie des positions en unités UTF-16, comme JavaScript (vérifié avec des
        // emojis : les convertir décalait les soulignements d'un cran par emoji).
        const from = span.start;
        const to = span.end;
        const original = text.slice(from, to);
        const suggestions = lint.suggestions().map((suggestion) => {
            const replacement = suggestion.get_replacement_text();
            const kind = suggestion.kind();
            suggestion.free?.();
            if (kind === SuggestionKind.Remove) {
                return "";
            }
            return kind === SuggestionKind.InsertAfter ? original + replacement : replacement;
        });
        const lintKind = lint.lint_kind();
        const match = {
            start: from,
            end: to,
            kind: KIND_MAP[lintKind] ?? "grammaire",
            detail: lintKind,
            message: lint.message(),
            suggestions: [...new Set(suggestions)],
            rule: lintKind,
        };
        span.free?.();
        lint.free?.();
        return match;
    });
    // Fautes de frappe (banc du 06/11/2026) : Harper ne propose parfois qu'une coupure en deux mots
    // (« moring » → « mo ring », « tited » → « ti ted ») ou des mots rares (« dors » → dirs, dobs). On
    // cherche aussi les mots courants à une retouche (lettre oubliée, en trop, voisine, inversée),
    // validés par Harper, et on classe le tout : coût de frappe, puis fréquence d'usage.
    const typos = matches.filter((m) => m.kind === "orthographe" && /^[A-Za-z]{3,}$/.test(text.slice(m.start, m.end)));
    const candidates = new Map(typos.map((m) => [m, editCandidates(text.slice(m.start, m.end).toLowerCase())]));
    const pool = [...new Set([...candidates.values()].flat())];
    if (pool.length) {
        const rejected = new Set((await linter.lint(pool.join("\n"), { language: "plaintext" }))
            .filter((lint) => /Spelling|Typo/.test(lint.lint_kind()))
            .map((lint) => pool.join("\n").slice(lint.span().start, lint.span().end).toLowerCase()));
        for (const m of typos) {
            const original = text.slice(m.start, m.end);
            const found = candidates.get(m).filter((c) => !rejected.has(c));
            const capital = /^[A-Z][a-z]/.test(original);
            const own = found.map((c) => (capital ? c[0].toUpperCase() + c.slice(1) : c)).filter((c) => !m.suggestions.includes(c));
            // Toutes les suggestions de Harper restent ; on y ajoute nos trois meilleurs candidats.
            const ranked = rankTypos(original.toLowerCase(), [...m.suggestions, ...own], neighboursOf(text, m));
            const best = new Set(ranked.filter((s) => own.includes(s)).slice(0, 3));
            m.suggestions = ranked.filter((s) => m.suggestions.includes(s) || best.has(s));
        }
    }
    for (const m of matches) {
        if (m.kind === "orthographe" && m.suggestions.length > 1 && !typos.includes(m)) {
            m.suggestions = rankTypos(text.slice(m.start, m.end).toLowerCase(), m.suggestions, neighboursOf(text, m));
        }
    }
    // Chaque suggestion est essayée dans la phrase (les trois premières) : celle qui ne crée pas de
    // faute de grammaire autour passe devant (« we arrie home » → arrive, pas « aerie »).
    for (const m of typos) {
        if (m.suggestions.length > 1) {
            m.suggestions = await fitInSentence(text, m.start, m.end, m.suggestions);
        }
    }
    // Fausses alertes connues de Harper : « He lent me » (accord sans suggestion sur un prétérit),
    // « it's time to » (lu comme un possessif), « missing a preposition » devant un modal.
    const vetoed = (m) => {
        const word = text.slice(m.start, m.end).trim().toLowerCase();
        const after = text.slice(m.end).trimStart().toLowerCase();
        if (m.rule === "Agreement" && m.suggestions.length === 0 && (/ed$/.test(word) || PAST_FORMS.has(word))) {
            return true;
        }
        if (m.rule === "Agreement" && word === "it's" && /^time\b/.test(after)) {
            return true;
        }
        // « I think it's good advice » : après un verbe d'opinion, « it's » ouvre la proposition.
        if (m.rule === "Agreement" && word === "it's" && /\b(?:think|thought|guess|believe|hope|know|sure|say|said|feel|felt|that)\s*$/i.test(text.slice(0, m.start))) {
            return true;
        }
        // « as soon as », « as long as », « as well as » : Harper propose de supprimer un « as ».
        // (Un « as as » doublé reste signalé.)
        if (m.rule === "Redundancy" && word === "as") {
            const before = text.slice(0, m.start);
            const after = text.slice(m.end);
            const pair = /^\s+(?:soon|long|well|far|much|many|good|quickly|fast|often|early|late|little)\s+as\b/i.test(after) || /\bas\s+(?:soon|long|well|far|much|many|good|quickly|fast|often|early|late|little)\s*$/i.test(before);
            if (pair && !/^\s+as\b/i.test(after) && !/\bas\s*$/i.test(before)) {
                return true;
            }
        }
        // « an SUV », « an HR manager » : Harper lit la lettre comme une consonne.
        if (/^an?$/.test(word)) {
            const next = /^\s*([A-Z][A-Z0-9]{1,4}s?)\b/.exec(text.slice(m.end))?.[1];
            if (next && articleForAcronym(next) === word) {
                return true;
            }
        }
        return /missing a preposition/i.test(m.message) && /^(will|would|can|could|shall|should|may|might|must)\b/.test(`${word} ${after}`.split(" ").slice(1).join(" ").trimStart() || after);
    };
    // Règles d'Aria : quand elles s'appliquent, elles remplacent ce que Harper disait au même
    // endroit (« Your the best » : Harper propose « Your » ou « The », Aria « You're »).
    const extra = findEnglishRules(text);
    const kept = matches.filter((m) => !vetoed(m) && !extra.some((e) => m.start < e.end && m.end > e.start));
    const all = [...kept, ...extra].sort((a, b) => a.start - b.start);
    return { matches: all, ms: performance.now() - start };
}

self.onmessage = async (event) => {
    const { id, cmd, payload } = event.data;
    try {
        let result;
        if (cmd === "init") {
            result = await init();
        } else if (cmd === "check") {
            result = await check(payload.text, payload.dialect);
        } else {
            throw new Error(`Commande inconnue : ${cmd}`);
        }
        self.postMessage({ id, ok: true, result });
    } catch (error) {
        self.postMessage({ id, ok: false, error: String(error?.message ?? error) });
    }
};
