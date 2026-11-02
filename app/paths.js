// Aria Plume (application) — où Aria Plume range ses fichiers.
//
// Tout est dans un seul dossier, dans le dossier personnel (demande de Jérémy) :
//   C:\Users\<toi>\.Aria-Plume\
//   ├── aria-plume-reglages.json   réglages (dictionnaire, glossaire, mots ignorés…)
//   ├── extension\                 copie de l'extension que lit le navigateur
//   ├── pont\                      relais et jeton du pont avec l'extension
//   ├── office\                    certificat local et manifeste du complément Word
//   └── electron\                  données internes d'Electron (caches, verrou d'instance unique)
// Même dossier pour l'exe portable et la version zip. En développement : app/dev-data/.
// Seule exception, hors de notre main : l'exe portable se décompresse d'abord dans le dossier
// temporaire de Windows, avant que notre code ne démarre.
//
// Chargé en premier (main.js) : les chemins d'Electron doivent être posés avant qu'il crée quoi
// que ce soit.

import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DATA_FOLDER = ".Aria-Plume";
const SETTINGS_FILE = "aria-plume-reglages.json";
const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const testHooks = () => process.env.ARIA_TEST_HOOKS === "1";

export function dataDir() {
    // Banc automatique : dossier à part (jamais actif sans ARIA_TEST_HOOKS=1).
    if (testHooks() && process.env.ARIA_TEST_SETTINGS_DIR) {
        return process.env.ARIA_TEST_SETTINGS_DIR;
    }
    if (!app.isPackaged) {
        return path.join(APP_DIR, "dev-data");
    }
    return path.join(app.getPath("home"), DATA_FOLDER);
}

// Données internes d'Electron dans notre dossier (et non plus dans %APPDATA%\aria-plume).
export function useDataDir() {
    const electron = path.join(dataDir(), "electron");
    fs.mkdirSync(electron, { recursive: true });
    app.setPath("userData", electron);
    app.setPath("sessionData", electron);
    app.setPath("crashDumps", path.join(electron, "Crashpad"));
    app.setPath("logs", path.join(electron, "logs"));
}

// Versions d'avant la 0.36 : réglages à côté de l'exe (portable ou zip). Au premier lancement, ils
// sont copiés dans le nouveau dossier ; l'original reste en place, rien n'est effacé.
// Renvoie le fichier repris, ou null.
export function migrateOldSettings() {
    const target = path.join(dataDir(), SETTINGS_FILE);
    if (fs.existsSync(target)) {
        return null;
    }
    const candidates = testHooks()
        ? [process.env.ARIA_TEST_LEGACY_DIR].filter(Boolean)
        : app.isPackaged ? [process.env.PORTABLE_EXECUTABLE_DIR, path.dirname(process.execPath)].filter(Boolean) : [];
    for (const dir of candidates) {
        const old = path.join(dir, SETTINGS_FILE);
        if (fs.existsSync(old)) {
            try {
                JSON.parse(fs.readFileSync(old, "utf8"));
                fs.mkdirSync(dataDir(), { recursive: true });
                fs.copyFileSync(old, target);
                return old;
            } catch (error) {
                console.error(`Anciens réglages illisibles (${old}) : non repris.`, error.message);
            }
        }
    }
    return null;
}
