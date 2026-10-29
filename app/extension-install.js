// Aria Plume (application) — installation assistée de l'extension dans un navigateur Chromium.
//
// Les navigateurs interdisent à un logiciel d'installer une extension tout seul (sous Windows,
// une installation venue de l'extérieur doit passer par le Chrome Web Store ; Chrome 137 a retiré
// --load-extension, et une adresse chrome://… passée au lancement n'est pas ouverte). Il reste donc
// « Charger l'extension non empaquetée », que seul l'utilisateur peut faire. L'application prépare
// tout le reste :
//   1. copie de l'extension dans un dossier fixe, à côté des réglages (l'exe portable se
//      décompresse ailleurs à chaque lancement : le navigateur doit pointer vers un dossier stable) ;
//   2. ouverture du navigateur, avec l'adresse de sa page d'extensions dans le presse-papiers ;
//   3. le chemin du dossier à copier au moment de le choisir.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const FOLDER_NAME = "Aria Plume - extension";
// Fichier témoin, écrit en dernier : la version copiée et la liste des fichiers (une copie
// interrompue n'a pas de témoin, et une mise à jour ne supprime que des fichiers qu'elle a posés).
const MARKER = ".aria-plume-copie.json";

// Navigateurs Chromium connus sous Windows : emplacements habituels de l'exécutable.
// « base » : variable d'environnement du dossier racine.
const BROWSERS = [
    { id: "chrome", name: "Google Chrome", scheme: "chrome", paths: [["ProgramFiles", "Google/Chrome/Application/chrome.exe"], ["ProgramFiles(x86)", "Google/Chrome/Application/chrome.exe"], ["LOCALAPPDATA", "Google/Chrome/Application/chrome.exe"]] },
    { id: "edge", name: "Microsoft Edge", scheme: "edge", paths: [["ProgramFiles(x86)", "Microsoft/Edge/Application/msedge.exe"], ["ProgramFiles", "Microsoft/Edge/Application/msedge.exe"]] },
    { id: "brave", name: "Brave", scheme: "brave", paths: [["ProgramFiles", "BraveSoftware/Brave-Browser/Application/brave.exe"], ["ProgramFiles(x86)", "BraveSoftware/Brave-Browser/Application/brave.exe"], ["LOCALAPPDATA", "BraveSoftware/Brave-Browser/Application/brave.exe"]] },
    { id: "opera-gx", name: "Opera GX", scheme: "opera", paths: [["LOCALAPPDATA", "Programs/Opera GX/opera.exe"], ["ProgramFiles", "Opera GX/opera.exe"]] },
    { id: "opera", name: "Opera", scheme: "opera", paths: [["LOCALAPPDATA", "Programs/Opera/opera.exe"], ["ProgramFiles", "Opera/opera.exe"]] },
    { id: "vivaldi", name: "Vivaldi", scheme: "vivaldi", paths: [["LOCALAPPDATA", "Vivaldi/Application/vivaldi.exe"], ["ProgramFiles", "Vivaldi/Application/vivaldi.exe"]] },
    { id: "chromium", name: "Chromium", scheme: "chrome", paths: [["LOCALAPPDATA", "Chromium/Application/chrome.exe"], ["ProgramFiles", "Chromium/Application/chrome.exe"]] },
];

const publicBrowser = ({ id, name, scheme, exe }) => ({ id, name, url: `${scheme}://extensions`, exe });

// Navigateurs installés. ARIA_TEST_BROWSERS (banc uniquement) : liste JSON à la place de la détection.
export function findBrowsers(env = process.env, platform = process.platform) {
    if (env.ARIA_TEST_HOOKS === "1" && env.ARIA_TEST_BROWSERS) {
        return JSON.parse(env.ARIA_TEST_BROWSERS).map(publicBrowser);
    }
    if (platform !== "win32") {
        return [];
    }
    const found = [];
    for (const browser of BROWSERS) {
        const exe = browser.paths
            .filter(([base]) => env[base])
            .map(([base, relative]) => path.win32.join(env[base], ...relative.split("/")))
            .find((candidate) => fs.existsSync(candidate));
        if (exe) {
            found.push(publicBrowser({ ...browser, exe }));
        }
    }
    return found;
}

function readJson(file) {
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        return null;
    }
}

// Tous les fichiers d'un dossier, en chemins relatifs avec des « / ».
async function listFiles(root) {
    const entries = await fs.promises.readdir(root, { recursive: true, withFileTypes: true });
    return entries
        .filter((entry) => entry.isFile())
        .map((entry) => path.relative(root, path.join(entry.parentPath ?? entry.path, entry.name)).split(path.sep).join("/"))
        .sort();
}

// État de la copie : version de l'extension embarquée, version copiée (null si aucune copie
// complète), dossier.
export function extensionState({ source, target }) {
    const marker = readJson(path.join(target, MARKER));
    return {
        folder: target,
        version: readJson(path.join(source, "manifest.json"))?.version ?? null,
        copied: marker?.version ?? null,
    };
}

// Le dossier cible est-il bien le nôtre (absent, vide, ou une copie d'Aria Plume) ?
function ownFolder(target) {
    if (!fs.existsSync(target)) {
        return true;
    }
    if (!fs.statSync(target).isDirectory()) {
        return false;
    }
    if (fs.readdirSync(target).length === 0 || fs.existsSync(path.join(target, MARKER))) {
        return true;
    }
    return readJson(path.join(target, "manifest.json"))?.name === "Aria Plume";
}

// Copie (ou met à jour) l'extension dans « target ». Ne touche qu'aux fichiers d'Aria Plume :
// ceux qu'une copie précédente a posés et qui n'existent plus sont retirés, rien d'autre.
export async function syncExtension({ source, target, force = false }) {
    const state = extensionState({ source, target });
    if (!state.version) {
        throw new Error("L'extension embarquée est introuvable dans l'application.");
    }
    if (!ownFolder(target)) {
        throw new Error(`Le dossier « ${target} » existe déjà et ne contient pas Aria Plume : renomme-le ou déplace-le, puis réessaie.`);
    }
    if (!force && state.copied === state.version) {
        return { ...state, updated: false };
    }
    const markerFile = path.join(target, MARKER);
    const previous = readJson(markerFile)?.files ?? [];
    await fs.promises.mkdir(target, { recursive: true });
    await fs.promises.rm(markerFile, { force: true });
    const files = await listFiles(source);
    for (const name of await fs.promises.readdir(source)) {
        await fs.promises.cp(path.join(source, name), path.join(target, name), { recursive: true, force: true });
    }
    const keep = new Set(files);
    for (const old of previous) {
        if (typeof old === "string" && !keep.has(old) && !old.split("/").includes("..")) {
            await fs.promises.rm(path.join(target, ...old.split("/")), { force: true });
        }
    }
    await fs.promises.writeFile(markerFile, `${JSON.stringify({ version: state.version, date: new Date().toISOString(), files }, null, 4)}\n`);
    return { ...state, copied: state.version, updated: true };
}

// Ouvre le navigateur. L'adresse de la page d'extensions est passée aussi : certains navigateurs
// l'ouvrent peut-être, Chromium l'ignore (nouvel onglet), d'où le presse-papiers en plus.
export function launchBrowser(browser) {
    return new Promise((resolve) => {
        let child;
        try {
            child = spawn(browser.exe, [browser.url], { detached: true, stdio: "ignore" });
        } catch (error) {
            resolve({ ok: false, error: String(error.message ?? error) });
            return;
        }
        child.once("error", (error) => resolve({ ok: false, error: String(error.message ?? error) }));
        child.once("spawn", () => {
            child.unref();
            resolve({ ok: true });
        });
    });
}
