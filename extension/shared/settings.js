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
    formalFrench: false,
    // Français écrit soigné site par site (le réglage général vaut ailleurs).
    formalHosts: ["mail.google.com", "outlook.live.com", "outlook.office.com", "outlook.office365.com"],
    casualHosts: ["discord.com"],
    repetitions: true,
    repetitionDistance: 30,
    trackMistakes: true,
    reviewBeforeSend: true,
    colors: DEFAULT_COLORS,
    ignored: [],
    dictionary: [],
    glossary: [],
    keepTerms: [],
};

export const MAX_DICTIONARY = 5000;
// Un mot du dictionnaire : lettres, chiffres, apostrophe, point, tiret, 60 caractères au plus.
export const DICTIONARY_WORD = /^[\p{L}\p{N}][\p{L}\p{N}'’._-]{0,59}$/u;

// « Elegoo, systemd ; VLAN » → ["Elegoo", "systemd", "VLAN"] (mots valides seulement).
export function splitWords(text) {
    return [...new Set(String(text).split(/[\s,;]+/u).map((w) => w.trim()).filter((w) => DICTIONARY_WORD.test(w)))];
}

export const MAX_GLOSSARY = 500;
// Un terme du glossaire : un à quatre mots (lettres, chiffres, apostrophe, point, tiret), 60 caractères au plus.
export const GLOSSARY_TERM = /^[\p{L}\p{N}][\p{L}\p{N}'’._-]*(?: [\p{L}\p{N}'’._-]+){0,3}$/u;

// Nettoie un terme saisi : espaces multiples réduits, 60 caractères au plus. Renvoie "" s'il n'est pas valide.
export function cleanTerm(text) {
    const term = String(text ?? "").trim().replace(/\s+/gu, " ");
    return term.length <= 60 && GLOSSARY_TERM.test(term) ? term : "";
}

export const DEBOUNCE_RANGE = { min: 200, max: 2000, step: 100 };
export const REPETITION_RANGE = { min: 10, max: 60, step: 5 };
const COLOR = /^#[0-9a-f]{6}$/i;
const MAX_LIST = 2000;

const isString = (value) => typeof value === "string";

// « https://Mail.Google.com/mail/u/0 » → « mail.google.com » ; "" si ce n'est pas un nom d'hôte.
export function cleanHost(text) {
    let host = String(text ?? "").trim().toLowerCase();
    try {
        if (/^[a-z]+:\/\//.test(host)) {
            host = new URL(host).hostname;
        }
    } catch {
        return "";
    }
    host = host.replace(/^\*\./, "").replace(/\/.*$/, "");
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$|^localhost$/.test(host) ? host : "";
}

// L'hôte (ou un de ses parents) figure-t-il dans la liste ? « mail.google.com » ⊂ « google.com ».
export function hostMatches(host, list) {
    return list.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

// Français soigné pour ce site : liste « soigné », sinon liste « courant », sinon réglage général.
export function formalFor(host, settings) {
    if (host && hostMatches(host, settings.formalHosts ?? [])) {
        return true;
    }
    if (host && hostMatches(host, settings.casualHosts ?? [])) {
        return false;
    }
    return settings.formalFrench === true;
}

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
    if (typeof input.formalFrench === "boolean") {
        result.formalFrench = input.formalFrench;
    }
    if (typeof input.reviewBeforeSend === "boolean") {
        result.reviewBeforeSend = input.reviewBeforeSend;
    }
    if (typeof input.trackMistakes === "boolean") {
        result.trackMistakes = input.trackMistakes;
    }
    if (typeof input.repetitions === "boolean") {
        result.repetitions = input.repetitions;
    }
    if (Number.isFinite(input.repetitionDistance)) {
        result.repetitionDistance = Math.min(REPETITION_RANGE.max, Math.max(REPETITION_RANGE.min, Math.round(input.repetitionDistance)));
    }
    for (const key of ["disabledHosts", "formalHosts", "casualHosts"]) {
        if (Array.isArray(input[key])) {
            result[key] = [...new Set(input[key].filter(isString).map(cleanHost).filter(Boolean))].slice(0, MAX_LIST);
        }
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
    if (Array.isArray(input.dictionary)) {
        result.dictionary = [...new Set(input.dictionary.filter(isString).map((w) => w.trim()).filter((w) => DICTIONARY_WORD.test(w)))].slice(-MAX_DICTIONARY);
    }
    if (Array.isArray(input.glossary)) {
        const seen = new Set();
        result.glossary = [];
        for (const entry of input.glossary) {
            const fr = cleanTerm(entry?.fr);
            const en = cleanTerm(entry?.en);
            const key = `${fr.toLowerCase()}|${en.toLowerCase()}`;
            if (fr && en && !seen.has(key)) {
                seen.add(key);
                result.glossary.push({ fr, en });
            }
        }
        result.glossary = result.glossary.slice(-MAX_GLOSSARY);
    }
    if (Array.isArray(input.keepTerms)) {
        result.keepTerms = [...new Set(input.keepTerms.map(cleanTerm).filter(Boolean))].slice(-MAX_GLOSSARY);
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
