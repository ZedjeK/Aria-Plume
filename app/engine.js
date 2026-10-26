// Aria Plume (application) — le moteur Aria et son service, directement dans le processus principal.
// En développement, ils viennent du dossier extension/ du dépôt ; une fois empaqueté, de
// resources/aria/ (copié par electron-builder, voir package.json → extraResources).

import { app } from "electron";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));

export const ENGINE_ROOT = app.isPackaged
    ? path.join(process.resourcesPath, "aria")
    : path.resolve(APP_DIR, "..", "extension");

const load = (relative) => import(pathToFileURL(path.join(ENGINE_ROOT, relative)).href);

const [{ createAria }, { nodePlatform }, settingsModule, { createService }] = await Promise.all([
    load("core/index.js"),
    load("core/platform/node.js"),
    load("core/shared/settings.js"),
    load("core/service.js"),
]);

export const aria = createAria(nodePlatform);
export const sharedSettings = settingsModule;
export { createService };
