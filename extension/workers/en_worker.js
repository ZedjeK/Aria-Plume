// Aria ODL — worker anglais (Harper 2.10, binaire WebAssembly « slim », fichiers d'origine non modifiés)
import { LocalLinter, Dialect, SuggestionKind } from "../engines/harper/index.js";
import { slimBinary } from "../engines/harper/slimBinary.js";

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

// Harper compte les positions en caractères Unicode, JavaScript en unités UTF-16.
function codePointToUtf16(text) {
    if (!/[\uD800-\uDFFF]/.test(text)) {
        return (index) => index;
    }
    const map = [];
    let position = 0;
    for (const char of text) {
        map.push(position);
        position += char.length;
    }
    map.push(position);
    return (index) => map[index] ?? position;
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
    const toUtf16 = codePointToUtf16(text);
    const lints = await linter.lint(text, { language: "plaintext" });
    const matches = lints.map((lint) => {
        const span = lint.span();
        const from = toUtf16(span.start);
        const to = toUtf16(span.end);
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
    matches.sort((a, b) => a.start - b.start);
    return { matches, ms: performance.now() - start };
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
