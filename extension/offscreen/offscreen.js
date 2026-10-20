// Aria ODL — document offscreen
// Héberge les trois moteurs, chargés à la demande :
//   - fr : Grammalecte (worker classique)
//   - en : Harper (worker module, WebAssembly)
//   - traduction : Bergamot (son propre worker, WebAssembly) + modèles Mozilla compressés en gzip

class WorkerClient {
    constructor(url, options) {
        this.worker = new Worker(url, options);
        this.seq = 0;
        this.pending = new Map();
        this.worker.onmessage = (event) => {
            const { id, ok, result, error } = event.data;
            const entry = this.pending.get(id);
            if (!entry) {
                return;
            }
            this.pending.delete(id);
            ok ? entry.resolve(result) : entry.reject(new Error(error));
        };
        this.worker.onerror = (event) => {
            const error = new Error(`Erreur du worker ${url} : ${event.message || "chargement impossible"}`);
            for (const entry of this.pending.values()) {
                entry.reject(error);
            }
            this.pending.clear();
        };
    }

    call(cmd, payload = {}) {
        const id = ++this.seq;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.worker.postMessage({ id, cmd, payload });
        });
    }
}

const checkers = {};
const loadTimes = {};
let translatorPromise = null;

function getChecker(lang) {
    if (!checkers[lang]) {
        checkers[lang] = (async () => {
            const start = performance.now();
            const client = lang === "fr"
                ? new WorkerClient("../workers/fr_worker.js")
                : new WorkerClient("../workers/en_worker.js", { type: "module" });
            await client.call("init");
            loadTimes[lang] = performance.now() - start;
            return client;
        })();
        checkers[lang].catch(() => {
            delete checkers[lang];
        });
    }
    return checkers[lang];
}

function toHex(buffer) {
    return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function fetchModelFile(url, expectedSha256) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Fichier de modèle introuvable : ${url}`);
    }
    const buffer = url.endsWith(".gz")
        ? await new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()
        : await response.arrayBuffer();
    if (expectedSha256) {
        const actual = toHex(await crypto.subtle.digest("SHA-256", buffer));
        if (actual !== expectedSha256) {
            throw new Error(`Empreinte SHA-256 invalide pour ${url}`);
        }
    }
    return buffer;
}

function getTranslator() {
    if (!translatorPromise) {
        translatorPromise = (async () => {
            const start = performance.now();
            const registryUrl = new URL("../models/registry.json", import.meta.url);
            const registry = await (await fetch(registryUrl)).json();
            for (const entry of registry) {
                for (const file of Object.values(entry.files)) {
                    file.name = new URL(file.name, registryUrl).href;
                }
            }
            const { BatchTranslator, TranslatorBacking } = await import("../engines/bergamot/translator.js");

            class LocalBacking extends TranslatorBacking {
                async loadModelRegistery() {
                    return registry;
                }

                async fetch(url, checksum) {
                    return fetchModelFile(url, checksum);
                }
            }

            // Traducteur par lots : il traite plusieurs demandes à la fois (page entière) en respectant
            // les priorités (une sélection passe avant les blocs de page). Deux workers suffisent.
            const translator = new BatchTranslator({ workers: TRANSLATION_WORKERS, batchSize: 8 }, new LocalBacking({ pivotLanguage: null }));
            loadTimes.translation = performance.now() - start;
            return translator;
        })();
        translatorPromise.catch(() => {
            translatorPromise = null;
        });
    }
    return translatorPromise;
}

const warmPairs = new Set();
const TRANSLATION_WORKERS = 2;

async function handle(msg) {
    switch (msg.cmd) {
        case "check": {
            if (!["fr", "en"].includes(msg.lang)) {
                throw new Error(`Langue non prise en charge : ${msg.lang}`);
            }
            const cold = !checkers[msg.lang];
            const client = await getChecker(msg.lang);
            const result = await client.call("check", { text: msg.text, dialect: msg.dialect });
            return { ok: true, matches: result.matches, engineMs: result.ms, loadMs: cold ? loadTimes[msg.lang] : 0, cold };
        }
        case "translate": {
            const cold = !translatorPromise;
            const translator = await getTranslator();
            const pair = `${msg.from}-${msg.to}`;
            const pairCold = !warmPairs.has(pair);
            const start = performance.now();
            const response = await translator.translate({
                from: msg.from,
                to: msg.to,
                text: msg.text,
                html: !!msg.html,
                priority: msg.priority ?? 0,
                jobId: msg.jobId ?? null,
            });
            warmPairs.add(pair);
            return {
                ok: true,
                text: response.target.text,
                engineMs: performance.now() - start,
                loadMs: cold ? loadTimes.translation : 0,
                cold,
                pairCold,
            };
        }
        case "translate-cancel": {
            // Abandonne les blocs encore en file d'attente d'une traduction de page arrêtée.
            if (translatorPromise && msg.jobId) {
                const translator = await translatorPromise;
                translator.remove((request) => request.jobId === msg.jobId);
            }
            return { ok: true };
        }
        default:
            throw new Error(`Commande inconnue : ${msg.cmd}`);
    }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.target !== "offscreen" || sender.id !== chrome.runtime.id) {
        return false;
    }
    handle(msg).then(sendResponse, (error) => sendResponse({ ok: false, error: String(error?.message ?? error) }));
    return true;
});
