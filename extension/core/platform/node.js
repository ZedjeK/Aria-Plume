// Aria Plume — plateforme « Node » du moteur Aria (tests, application, serveur MCP).
// Même contrat que platform/browser.js :
//   - name                       nom de la plateforme
//   - readFile(url)              contenu brut d'un fichier (URL file:) → ArrayBuffer
//   - createWorker(url, opts)    lance un worker → { post, onMessage, onError, terminate }
//   - importModule(url)          import dynamique d'un module
//
// Les workers tournent dans des worker_threads, préparés par node-worker.js pour
// ressembler à des workers de navigateur (self, postMessage, importScripts…).

import { Worker } from "node:worker_threads";
import { readFile } from "node:fs/promises";

const BOOTSTRAP = new URL("./node-worker.js", import.meta.url);

export const nodePlatform = {
    name: "node",

    async readFile(url) {
        const buffer = await readFile(new URL(url));
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    },

    createWorker(url, { type } = {}) {
        const worker = new Worker(BOOTSTRAP, { workerData: { url: String(url), type: type ?? "classic" } });
        return {
            post: (message) => worker.postMessage(message),
            onMessage: (callback) => worker.on("message", callback),
            onError: (callback) => {
                worker.on("error", callback);
                worker.on("exit", (code) => code && callback(new Error(`arrêt inattendu (code ${code})`)));
            },
            terminate: () => worker.terminate(),
        };
    },

    importModule(url) {
        return import(url);
    },
};
