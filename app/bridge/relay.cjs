// Aria Plume — relais de messagerie native (« native messaging »).
//
// Le navigateur lance ce relais quand l'extension appelle chrome.runtime.connectNative(), par
// relay.cmd (Windows) ou relay.sh, avec l'exécutable d'Aria Plume en mode Node
// (ELECTRON_RUN_AS_NODE=1). Il ne corrige rien lui-même : il fait passer les messages.
//
//     navigateur ⇄ relais : stdin/stdout, longueur sur 4 octets (ordre de la machine) + JSON UTF-8
//     relais ⇄ application : canal nommé de la session (\\.\pipe\…) ou socket Unix, une ligne JSON par message
//
// Si l'application ne répond pas, le relais la démarre cachée (--hidden) et réessaie pendant
// 20 secondes. Le premier message envoyé à l'application est « hello », avec le jeton lu dans un
// fichier que seul l'utilisateur peut lire. Ce fichier est copié à côté de relay-config.json par
// l'application (Réglages → Connecter les navigateurs) : il est autonome, sans dépendance.

"use strict";

const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");

const CONFIG_FILE = path.join(__dirname, "relay-config.json");
const CONNECT_TIMEOUT_MS = 20000;
const RETRY_MS = 250;
// Le navigateur refuse un message de plus de 1 Mo venant du relais (et coupe la connexion).
const MAX_TO_BROWSER = 1024 * 1024;
// Garde-fou sur ce qui vient du navigateur (il autorise jusqu'à 4 Go).
const MAX_FROM_BROWSER = 64 * 1024 * 1024;
const MAX_LINE = 64 * 1024 * 1024;

const origin = process.argv.slice(2).find((arg) => arg.startsWith("chrome-extension://")) ?? "";
let pipe = null;
let connected = false;
let closing = false;
const pending = [];

// --- Vers le navigateur ---
function toBrowser(message) {
    let body = Buffer.from(JSON.stringify(message), "utf8");
    if (body.length > MAX_TO_BROWSER) {
        body = Buffer.from(JSON.stringify({ id: message?.id ?? null, ok: false, error: "Réponse trop volumineuse pour l'extension." }), "utf8");
    }
    const header = Buffer.alloc(4);
    header.writeUInt32LE(body.length, 0);
    process.stdout.write(Buffer.concat([header, body]));
}

function finish(code = 0) {
    if (closing) {
        return;
    }
    closing = true;
    pipe?.destroy();
    // Laisser partir ce qui reste à écrire avant de quitter.
    process.stdout.write("", () => process.exit(code));
    setTimeout(() => process.exit(code), 1000).unref();
}

// --- Depuis le navigateur ---
let input = Buffer.alloc(0);
process.stdin.on("data", (chunk) => {
    input = Buffer.concat([input, chunk]);
    while (input.length >= 4) {
        const size = input.readUInt32LE(0);
        if (size > MAX_FROM_BROWSER) {
            toBrowser({ event: "error", error: "Message trop volumineux." });
            finish(1);
            return;
        }
        if (input.length < 4 + size) {
            break;
        }
        const body = input.subarray(4, 4 + size).toString("utf8");
        input = input.subarray(4 + size);
        if (connected) {
            pipe.write(`${body}\n`);
        } else {
            pending.push(body);
        }
    }
});
// Le navigateur a fermé la connexion (port fermé, extension rechargée) : on s'arrête.
process.stdin.on("end", () => finish(0));
process.stdin.on("error", () => finish(0));
process.stdout.on("error", () => finish(0));

// --- Configuration ---
function readConfig() {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    const token = fs.readFileSync(config.tokenFile, "utf8").trim();
    return { ...config, token };
}

// --- Vers l'application ---
function launchApp(config) {
    if (!config.app?.command) {
        return;
    }
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    try {
        const child = spawn(config.app.command, config.app.args ?? [], {
            detached: true,
            stdio: "ignore",
            env,
            windowsHide: false,
        });
        child.on("error", () => {});
        child.unref();
    } catch {
        // L'application introuvable : la connexion échouera et l'extension utilisera son moteur.
    }
}

function attach(socket, config) {
    pipe = socket;
    connected = true;
    socket.setEncoding("utf8");
    socket.write(`${JSON.stringify({ id: 0, cmd: "hello", token: config.token, origin, relay: 1 })}\n`);
    for (const body of pending.splice(0)) {
        socket.write(`${body}\n`);
    }
    let buffer = "";
    socket.on("data", (text) => {
        buffer += text;
        if (buffer.length > MAX_LINE) {
            finish(1);
            return;
        }
        let end;
        while ((end = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, end);
            buffer = buffer.slice(end + 1);
            if (!line.trim()) {
                continue;
            }
            try {
                toBrowser(JSON.parse(line));
            } catch {
                // Ligne illisible : ignorée.
            }
        }
    });
    // L'application s'est arrêtée : le navigateur le saura par la fermeture du port.
    socket.on("close", () => finish(0));
    socket.on("error", () => finish(0));
}

function connect() {
    let config;
    try {
        config = readConfig();
    } catch (error) {
        toBrowser({ event: "unavailable", error: `Configuration du relais illisible : ${error.message}` });
        finish(1);
        return;
    }
    const deadline = Date.now() + (Number(config.connectTimeoutMs) || CONNECT_TIMEOUT_MS);
    let launched = false;
    const attempt = () => {
        const socket = net.connect(config.pipe);
        socket.once("connect", () => {
            socket.removeAllListeners("error");
            attach(socket, config);
        });
        socket.once("error", () => {
            socket.destroy();
            if (closing) {
                return;
            }
            if (!launched) {
                launched = true;
                toBrowser({ event: "starting" });
                launchApp(config);
            }
            if (Date.now() > deadline) {
                toBrowser({ event: "unavailable", error: "L'application Aria Plume ne répond pas." });
                finish(1);
                return;
            }
            setTimeout(attempt, RETRY_MS);
        });
    };
    attempt();
}

connect();
