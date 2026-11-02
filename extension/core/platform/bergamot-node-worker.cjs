// Aria Plume — amorce des workers de traduction de Bergamot sous Node (application, MCP, tests).
//
// Bergamot (engines/bergamot, copié sans modification) a sa propre couche Node, qui lit son
// fichier WebAssembly avec url.pathname : les accents et les espaces y restent encodés
// (« Jérémy » → « J%C3%A9r%C3%A9my ») et un chemin Windows y garde la forme d'une adresse
// (« /C:/… »). Résultat : fichier introuvable dès que le dossier de l'application contient un
// accent ou un espace, et une traduction qui attend sans fin. Cette amorce pose à la place un
// environnement de worker correct (vrais chemins de fichiers), puis exécute le worker de Bergamot
// tel quel : sa propre couche Node est sautée, puisque « self » existe déjà.

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { parentPort, workerData } = require("node:worker_threads");
const { fileURLToPath, pathToFileURL } = require("node:url");

const script = workerData.script;
const directory = path.dirname(script);

global.self = new class GlobalWorkerScope {
    addEventListener(eventName, callback) {
        parentPort.on(eventName, (data) => callback({ data }));
    }

    postMessage(message) {
        parentPort.postMessage(message);
    }

    // Scripts du worker, à côté de lui, exécutés dans la portée globale (comme dans un navigateur).
    importScripts(...scripts) {
        for (const name of scripts) {
            (0, eval)(fs.readFileSync(path.join(directory, name), "utf8"));
        }
    }

    // Fichiers locaux seulement : la traduction n'a jamais besoin du réseau.
    async fetch(url) {
        const target = url instanceof URL ? url : new URL(String(url), this.location);
        if (target.protocol !== "file:") {
            throw new Error(`Accès refusé : ${target.href} (la traduction reste locale)`);
        }
        const buffer = fs.readFileSync(fileURLToPath(target));
        return new Response(new Blob([buffer]), {
            status: 200,
            headers: { "Content-Type": "application/wasm", "Content-Length": String(buffer.length) },
        });
    }

    get location() {
        return pathToFileURL(script);
    }
}();

// Le worker de Bergamot, dans la portée globale : son « var Module » devient global, comme dans un
// worker de navigateur, et le script WebAssembly qu'il charge le retrouve.
(0, eval)(fs.readFileSync(script, "utf8"));
