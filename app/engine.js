// Aria Plume (application) — le moteur Aria, directement dans le processus principal.
// En développement, il vient du dossier extension/ du dépôt ; une fois empaqueté, de
// resources/aria/ (copié par electron-builder, voir package.json → extraResources).

import { app } from "electron";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));

export const ENGINE_ROOT = app.isPackaged
    ? path.join(process.resourcesPath, "aria")
    : path.resolve(APP_DIR, "..", "extension");

const load = (relative) => import(pathToFileURL(path.join(ENGINE_ROOT, relative)).href);

const [{ createAria }, { nodePlatform }, settingsModule] = await Promise.all([
    load("core/index.js"),
    load("core/platform/node.js"),
    load("core/shared/settings.js"),
]);

export const aria = createAria(nodePlatform);
export const sharedSettings = settingsModule;

// Ce que la fenêtre a le droit de demander au moteur (rien d'autre ne passe).
export const ENGINE_METHODS = {
    check: (args) => aria.check(args),
    translate: (args) => aria.translate(args),
    conjugate: (args) => aria.conjugate(args),
    synonyms: (args) => aria.synonyms(args),
    info: () => aria.info(),
};
