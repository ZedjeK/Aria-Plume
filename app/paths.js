// Aria Plume (application) — où Aria Plume range ses fichiers.
//
// Tout est dans un seul dossier, dans le dossier personnel, rangé selon le modèle des applis Aria :
//   C:\Users\<toi>\.Aria-Plume\
//   ├── reglages.json      réglages (dictionnaire, glossaire, mots ignorés…)
//   ├── journal.json       les 500 dernières opérations
//   ├── sauvegardes\       copies faites avant de modifier ou de déplacer un fichier
//   ├── cache\             données internes d'Electron (caches, verrou d'instance unique)
//   ├── extension\         copie de l'extension que lit le navigateur
//   ├── pont\              relais et jeton du pont avec l'extension
//   └── office\            certificat local et manifeste du complément Word
// Détail du rangement et migration d'un dossier d'avant la 0.40 : donnees.js. En développement :
// app/dev-data/. Seule exception, hors de notre main : l'exe portable se décompresse d'abord dans le
// dossier temporaire de Windows, avant que notre code ne démarre.
//
// Chargé en premier (main.js) : les chemins d'Electron doivent être posés avant qu'il crée quoi
// que ce soit.

import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ANCIEN_FICHIER_REGLAGES, FICHIER_REGLAGES, dossierCache, journaliser, migrerDossier } from "./donnees.js";

export const DATA_FOLDER = ".Aria-Plume";
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

// Données internes d'Electron dans notre dossier (et non plus dans %APPDATA%\aria-plume), dans cache\.
// Un dossier d'avant la 0.40 passe d'abord aux noms du modèle (réglages copiés avant d'être renommés).
export function useDataDir() {
    try {
        for (const fait of migrerDossier(dataDir())) {
            console.error(`Dossier de données : ${fait}`);
            journaliser(dataDir(), "migration", fait);
        }
    } catch (error) {
        console.error("Dossier de données : migration impossible.", error.message);
    }
    const cache = dossierCache(dataDir());
    fs.mkdirSync(cache, { recursive: true });
    app.setPath("userData", cache);
    app.setPath("sessionData", cache);
    app.setPath("crashDumps", path.join(cache, "Crashpad"));
    app.setPath("logs", path.join(cache, "logs"));
}

// Versions d'avant la 0.36 : réglages à côté de l'exe (portable ou zip). Au premier lancement, ils
// sont copiés dans le nouveau dossier ; l'original reste en place, rien n'est effacé.
// Renvoie le fichier repris, ou null.
export function migrateOldSettings() {
    const target = path.join(dataDir(), FICHIER_REGLAGES);
    if (fs.existsSync(target)) {
        return null;
    }
    const candidates = testHooks()
        ? [process.env.ARIA_TEST_LEGACY_DIR].filter(Boolean)
        : app.isPackaged ? [process.env.PORTABLE_EXECUTABLE_DIR, path.dirname(process.execPath)].filter(Boolean) : [];
    for (const dir of candidates) {
        const old = path.join(dir, ANCIEN_FICHIER_REGLAGES);
        if (fs.existsSync(old)) {
            try {
                JSON.parse(fs.readFileSync(old, "utf8"));
                fs.mkdirSync(dataDir(), { recursive: true });
                fs.copyFileSync(old, target);
                journaliser(dataDir(), "migration", `réglages repris de ${old}`);
                return old;
            } catch (error) {
                console.error(`Anciens réglages illisibles (${old}) : non repris.`, error.message);
            }
        }
    }
    return null;
}
