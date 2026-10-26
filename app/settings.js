// Aria Plume (application) — réglages dans un fichier JSON, à côté de l'exécutable.
// Version portable : tout suit le dossier (clé USB comprise). Emplacement :
//   - exe portable           → dossier de l'exe portable (PORTABLE_EXECUTABLE_DIR)
//   - application empaquetée → dossier de l'exécutable
//   - développement          → app/dev-data/
// Les réglages de correction reprennent ceux de l'extension (mêmes clés, même contrôle),
// avec en plus les statistiques des fautes récurrentes et les réglages propres à l'application.

import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sharedSettings } from "./engine.js";

const FILE_NAME = "aria-plume-reglages.json";

// Réglages propres à l'application.
export const APP_DEFAULTS = {
    hotkey: "Alt+Shift+C",
    startWithWindows: false,
};
// Données que l'extension garde aussi dans son stockage (fautes récurrentes).
const EXTRA_DEFAULTS = {
    mistakeStats: {},
    mistakeStatsSince: null,
};

export function settingsDir() {
    if (process.env.PORTABLE_EXECUTABLE_DIR) {
        return process.env.PORTABLE_EXECUTABLE_DIR;
    }
    if (app.isPackaged) {
        return path.dirname(process.execPath);
    }
    return path.join(path.dirname(fileURLToPath(import.meta.url)), "dev-data");
}

export const settingsFile = () => path.join(settingsDir(), FILE_NAME);

function sanitizeApp(input) {
    const out = {};
    if (typeof input?.hotkey === "string" && /^[\w+]{1,40}$/.test(input.hotkey)) {
        out.hotkey = input.hotkey;
    }
    if (typeof input?.startWithWindows === "boolean") {
        out.startWithWindows = input.startWithWindows;
    }
    return out;
}

function sanitizeExtras(input) {
    const out = {};
    const stats = input?.mistakeStats;
    if (stats && typeof stats === "object" && !Array.isArray(stats) && JSON.stringify(stats).length < 200_000) {
        out.mistakeStats = JSON.parse(JSON.stringify(stats));
    }
    if (input?.mistakeStatsSince === null || (typeof input?.mistakeStatsSince === "string" && input.mistakeStatsSince.length < 40)) {
        out.mistakeStatsSince = input.mistakeStatsSince;
    }
    return out;
}

const clean = (input) => ({
    ...sharedSettings.DEFAULTS,
    ...EXTRA_DEFAULTS,
    ...APP_DEFAULTS,
    ...sharedSettings.sanitize(input),
    ...sanitizeExtras(input),
    ...sanitizeApp(input),
});

let cache = null;

export function loadSettings() {
    if (cache) {
        return cache;
    }
    let raw = {};
    try {
        raw = JSON.parse(fs.readFileSync(settingsFile(), "utf8"));
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error(`Réglages illisibles (${settingsFile()}) : valeurs par défaut.`, error.message);
        }
    }
    cache = clean(raw);
    return cache;
}

// Enregistre des changements. Renvoie les clés réellement modifiées, au format de
// chrome.storage.onChanged : { clé: { oldValue, newValue } }.
export function saveSettings(changes) {
    const before = loadSettings();
    const after = clean({ ...before, ...changes });
    const diff = {};
    for (const key of Object.keys(after)) {
        if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
            diff[key] = { oldValue: before[key], newValue: after[key] };
        }
    }
    cache = after;
    if (Object.keys(diff).length) {
        fs.mkdirSync(settingsDir(), { recursive: true });
        // Écriture atomique : un fichier temporaire, puis renommage.
        const temp = `${settingsFile()}.tmp`;
        fs.writeFileSync(temp, `${JSON.stringify(after, null, 4)}\n`);
        fs.renameSync(temp, settingsFile());
    }
    return diff;
}

// Lecture façon chrome.storage.local.get : rien (tout), une clé, une liste de clés,
// ou un objet de valeurs par défaut.
export function getValues(spec) {
    const all = loadSettings();
    if (spec === null || spec === undefined) {
        return { ...all };
    }
    const keys = typeof spec === "string" ? [spec] : spec;
    if (Array.isArray(keys)) {
        return Object.fromEntries(keys.filter((key) => key in all).map((key) => [key, all[key]]));
    }
    return Object.fromEntries(Object.entries(keys).map(([key, fallback]) => [key, key in all ? all[key] : fallback]));
}
