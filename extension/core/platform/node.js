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
import { fileURLToPath } from "node:url";

const BOOTSTRAP = new URL("./node-worker.js", import.meta.url);
const BERGAMOT_BOOTSTRAP = new URL("./bergamot-node-worker.cjs", import.meta.url);

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

    // Workers de traduction de Bergamot : remplace la couche Node de Bergamot, qui casse les chemins
    // avec accents, espaces ou lettre de lecteur (voir bergamot-node-worker.cjs). Même interface que
    // le Worker que Bergamot attend.
    BergamotWorker: class BergamotWorker {
        // Tous les workers lancés : Bergamot perd la trace de ceux qui échouent à démarrer.
        static live = new Set();

        // Arrête tous les workers de traduction (moteur tombé, ou fermeture).
        static terminateAll() {
            for (const worker of BergamotWorker.live) {
                BergamotWorker.stopping.add(worker);
                worker.terminate();
            }
            BergamotWorker.live.clear();
        }

        // Workers arrêtés exprès : leur fin n'est pas une erreur.
        static stopping = new WeakSet();

        #worker;

        constructor(url) {
            this.#worker = new Worker(BERGAMOT_BOOTSTRAP, { workerData: { script: fileURLToPath(url) } });
            BergamotWorker.live.add(this.#worker);
            this.#worker.on("exit", () => BergamotWorker.live.delete(this.#worker));
        }

        addEventListener(eventName, callback) {
            this.#worker.on(eventName, (data) => callback(eventName === "error" ? data : { data }));
            // Un worker qui s'arrête tout seul est une erreur : sans elle, la traduction attendrait.
            if (eventName === "error") {
                this.#worker.on("exit", (code) => {
                    if (code && !BergamotWorker.stopping.has(this.#worker)) {
                        callback(new Error(`worker de traduction arrêté (code ${code})`));
                    }
                });
            }
        }

        postMessage(message) {
            this.#worker.postMessage(message);
        }

        terminate() {
            BergamotWorker.stopping.add(this.#worker);
            this.#worker.terminate();
        }
    },
};
