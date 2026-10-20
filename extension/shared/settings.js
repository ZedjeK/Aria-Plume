// Aria ODL — réglages partagés (popup, page de réglages, service worker).
// Le script de page n'est pas un module : il garde sa propre copie de DEFAULTS,
// à tenir alignée avec celle-ci.

export const KINDS = ["orthographe", "grammaire", "style", "typographie"];

export const DIALECTS = {
    american: "Américain",
    british: "Britannique",
    canadian: "Canadien",
    australian: "Australien",
    indian: "Indien",
};

export const DEFAULT_COLORS = {
    orthographe: "#e5484d",
    grammaire: "#f59e0b",
    style: "#0ea5e9",
};

export const DEFAULTS = {
    liveEnabled: true,
    disabledHosts: [],
    debounceMs: 500,
    englishDialect: "american",
    disabledKinds: [],
    hideNativeSpellcheck: false,
    colors: DEFAULT_COLORS,
    ignored: [],
};

export const DEBOUNCE_RANGE = { min: 200, max: 2000, step: 100 };
const COLOR = /^#[0-9a-f]{6}$/i;
const MAX_LIST = 2000;

const isString = (value) => typeof value === "string";

// Nettoie un objet de réglages (import d'un fichier, stockage) : seules les clés
// connues, avec le bon type, passent. Le reste est ignoré.
export function sanitize(input) {
    const result = {};
    if (!input || typeof input !== "object") {
        return result;
    }
    if (typeof input.liveEnabled === "boolean") {
        result.liveEnabled = input.liveEnabled;
    }
    if (typeof input.hideNativeSpellcheck === "boolean") {
        result.hideNativeSpellcheck = input.hideNativeSpellcheck;
    }
    if (Array.isArray(input.disabledHosts)) {
        result.disabledHosts = [...new Set(input.disabledHosts.filter(isString).map((h) => h.trim().toLowerCase()).filter(Boolean))].slice(0, MAX_LIST);
    }
    if (Number.isFinite(input.debounceMs)) {
        result.debounceMs = Math.min(DEBOUNCE_RANGE.max, Math.max(DEBOUNCE_RANGE.min, Math.round(input.debounceMs)));
    }
    if (isString(input.englishDialect) && input.englishDialect in DIALECTS) {
        result.englishDialect = input.englishDialect;
    }
    if (Array.isArray(input.disabledKinds)) {
        result.disabledKinds = [...new Set(input.disabledKinds.filter((k) => KINDS.includes(k)))];
    }
    if (input.colors && typeof input.colors === "object") {
        result.colors = { ...DEFAULT_COLORS };
        for (const kind of Object.keys(DEFAULT_COLORS)) {
            if (COLOR.test(input.colors[kind] ?? "")) {
                result.colors[kind] = input.colors[kind].toLowerCase();
            }
        }
    }
    if (Array.isArray(input.ignored)) {
        result.ignored = input.ignored
            .filter((entry) => entry && isString(entry.word) && isString(entry.rule))
            .map((entry) => ({
                word: entry.word.slice(0, 200),
                rule: entry.rule.slice(0, 200),
                kind: KINDS.includes(entry.kind) ? entry.kind : "grammaire",
            }))
            .slice(-MAX_LIST);
    }
    return result;
}

export async function loadSettings() {
    const stored = await chrome.storage.local.get(DEFAULTS);
    return { ...DEFAULTS, ...stored, ...sanitize(stored) };
}
