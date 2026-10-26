// Aria Plume (application) — réglages dans un fichier JSON, à côté de l'exécutable.
// Version portable : tout suit le dossier (clé USB comprise). Emplacement :
//   - exe portable           → dossier de l'exe portable (PORTABLE_EXECUTABLE_DIR)
//   - application empaquetée → dossier de l'exécutable
//   - développement          → app/dev-data/
// Les réglages de correction reprennent ceux de l'extension (mêmes clés, même contrôle).

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
    const out = { ...APP_DEFAULTS };
    if (typeof input?.hotkey === "string" && /^[\w+]{1,40}$/.test(input.hotkey)) {
        out.hotkey = input.hotkey;
    }
    if (typeof input?.startWithWindows === "boolean") {
        out.startWithWindows = input.startWithWindows;
    }
    return out;
}

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
    cache = { ...sharedSettings.DEFAULTS, ...sharedSettings.sanitize(raw), ...sanitizeApp(raw) };
    return cache;
}

export function saveSettings(changes) {
    const merged = { ...loadSettings(), ...changes };
    cache = { ...sharedSettings.DEFAULTS, ...sharedSettings.sanitize(merged), ...sanitizeApp(merged) };
    fs.mkdirSync(settingsDir(), { recursive: true });
    // Écriture atomique : un fichier temporaire, puis renommage.
    const temp = `${settingsFile()}.tmp`;
    fs.writeFileSync(temp, `${JSON.stringify(cache, null, 4)}\n`);
    fs.renameSync(temp, settingsFile());
    return cache;
}
