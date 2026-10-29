// Aria Plume — worker anglais (Harper 2.10, binaire WebAssembly « slim », fichiers d'origine non modifiés)
import { LocalLinter, Dialect, SuggestionKind } from "../../engines/harper/index.js";
import { slimBinary } from "../../engines/harper/slimBinary.js";
import { findEnglishRules, IRREGULAR_PP } from "./rules.js";

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

// Distance de frappe : touche voisine 0.5, inversion 0.5, lettre doublée 0.5, voyelle 0.8, le reste 1.
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
                d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 0.5);
            }
        }
    }
    return d[a.length][b.length];
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
    // Fautes de frappe : Harper classe ses suggestions sans tenir compte du clavier ; on remonte celles
    // qui ne demandent qu'une touche voisine, une inversion ou une lettre doublée (« moening » → morning).
    for (const m of matches) {
        if (m.kind === "orthographe" && m.suggestions.length > 1) {
            const original = text.slice(m.start, m.end).toLowerCase();
            m.suggestions = m.suggestions
                .map((suggestion, index) => ({ suggestion, index, cost: typingCost(original, suggestion.toLowerCase()) }))
                .sort((a, b) => Math.round(a.cost * 5) - Math.round(b.cost * 5) || a.index - b.index)
                .map((x) => x.suggestion);
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
