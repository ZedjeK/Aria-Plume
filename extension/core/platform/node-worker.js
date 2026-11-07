// Aria Plume — amorce des workers sous Node (worker_threads).
// Donne au script du worker l'environnement d'un worker de navigateur :
//   - worker classique (Grammalecte) : exécuté dans un contexte isolé, sans les objets
//     de Node, avec importScripts et un XMLHttpRequest synchrone qui lit les fichiers.
//     Sans ça, Grammalecte croirait tourner sous Node et prendrait d'autres chemins.
//   - worker module (Harper) : importé tel quel, avec self, postMessage et un fetch
//     qui sait lire les URL file: (pour le binaire WebAssembly).
// Les journaux de Grammalecte (« loadFile: … ») sont coupés : la sortie standard doit
// rester propre (le serveur MCP parle dessus). ARIA_DEBUG=1 les envoie sur la sortie d'erreur.

import { parentPort, workerData } from "node:worker_threads";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

// Harper lit son WebAssembly avec new URL(…).pathname : les accents et les espaces y restent
// encodés (« Héléna » → « H%C3%A9l%C3%A9na ») et un chemin Windows y garde la forme « /C:/… ».
// Dès que le dossier de l'application contient un accent ou un espace (C:\Users\Héléna…), le
// fichier est introuvable et la correction anglaise ne trouve plus rien. Sans toucher à Harper
// (copié sans modification) : dans ce worker seulement, un chemin introuvable de cette forme est
// relu une fois décodé.
function decodedPath(file) {
    if (typeof file !== "string" || !file.startsWith("/") || fs.existsSync(file)) {
        return file;
    }
    try {
        const candidate = fileURLToPath(new URL(`file://${file}`));
        return fs.existsSync(candidate) ? candidate : file;
    } catch {
        return file;
    }
}
const nodeReadFile = fs.readFile;
fs.readFile = function readFile(file, ...rest) {
    return nodeReadFile.call(this, decodedPath(file), ...rest);
};
syncBuiltinESMExports();

const { url, type } = workerData;
const readText = (fileUrl) => fs.readFileSync(new URL(fileUrl), "utf8");
const debug = process.env.ARIA_DEBUG ? (...args) => console.error(...args) : () => {};
const quietConsole = { log: debug, info: debug, debug, warn: (...args) => console.error(...args), error: (...args) => console.error(...args) };

if (type === "module") {
    const nativeFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
        const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (href.startsWith("file:")) {
            const body = fs.readFileSync(new URL(href));
            const contentType = href.endsWith(".wasm") ? "application/wasm" : "application/octet-stream";
            return new Response(body, { headers: { "content-type": contentType } });
        }
        return nativeFetch(input, init);
    };
    globalThis.self = globalThis;
    globalThis.location = new URL(url);
    globalThis.postMessage = (message) => parentPort.postMessage(message);
    await import(url);
    parentPort.on("message", (data) => globalThis.onmessage?.({ data }));
} else {
    class SyncXMLHttpRequest {
        open(method, fileUrl) {
            this.url = fileUrl;
        }

        overrideMimeType() {}

        send() {
            this.responseText = readText(this.url);
            this.status = 200;
        }
    }
    const context = {
        console: quietConsole,
        URL,
        TextEncoder,
        TextDecoder,
        performance,
        setTimeout,
        clearTimeout,
        queueMicrotask,
        structuredClone,
        XMLHttpRequest: SyncXMLHttpRequest,
        location: new URL(url),
    };
    context.self = context;
    context.postMessage = (message) => parentPort.postMessage(message);
    context.importScripts = (...files) => {
        for (const file of files) {
            vm.runInContext(readText(file), context, { filename: fileURLToPath(file) });
        }
    };
    vm.createContext(context);
    vm.runInContext(readText(url), context, { filename: fileURLToPath(url) });
    parentPort.on("message", (data) => context.onmessage?.({ data }));
}
