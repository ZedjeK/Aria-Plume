// Aria Plume (application) — serveur du pont avec l'extension du navigateur.
//
// L'application écoute sur un canal local réservé à la session : canal nommé sous Windows
// (\\.\pipe\aria-plume-<utilisateur>), socket Unix ailleurs. Seul le relais (relay.cjs), lancé par
// le navigateur, s'y connecte. Une ligne JSON par message :
//
//     relais → appli   { id: 0, cmd: "hello", token, origin }   d'abord, sinon la connexion est fermée
//     appli → relais   { event: "ready", version }
//     relais → appli   { id, cmd, ... }                         une demande de l'extension
//     appli → relais   { id, ok: true, ... } ou { id, ok: false, error }
//     appli → relais   { event: "settings-changed", changes }   réglages modifiés (toutes les connexions)

import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const MAX_LINE = 64 * 1024 * 1024;
const HELLO_TIMEOUT_MS = 5000;

// Adresse du canal. ARIA_TEST_PIPE (banc uniquement) la remplace.
export function bridgePipePath({ env = process.env, platform = process.platform } = {}) {
    if (env.ARIA_TEST_HOOKS === "1" && env.ARIA_TEST_PIPE) {
        return env.ARIA_TEST_PIPE;
    }
    let user = "utilisateur";
    try {
        user = os.userInfo().username || user;
    } catch {
        // Pas de nom d'utilisateur : nom générique.
    }
    const safe = user.replace(/[^\w.-]/g, "_").slice(0, 60);
    if (platform === "win32") {
        return `\\\\.\\pipe\\aria-plume-${safe}`;
    }
    const uid = typeof process.getuid === "function" ? process.getuid() : safe;
    return path.join(env.XDG_RUNTIME_DIR || os.tmpdir(), `aria-plume-${uid}.sock`);
}

// Jeton partagé avec le relais, créé une fois, lisible par l'utilisateur seul.
export function ensureToken(file) {
    try {
        const token = fs.readFileSync(file, "utf8").trim();
        if (/^[0-9a-f]{64}$/.test(token)) {
            return token;
        }
    } catch {
        // Pas encore de jeton.
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const token = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(file, `${token}\n`, { mode: 0o600 });
    return token;
}

const sameToken = (a, b) => {
    const left = Buffer.from(String(a ?? ""));
    const right = Buffer.from(String(b ?? ""));
    return left.length === right.length && crypto.timingSafeEqual(left, right);
};

// Socket Unix laissé par une application arrêtée brutalement : on le retire s'il ne répond plus.
function removeStaleSocket(pipe) {
    return new Promise((resolve) => {
        const probe = net.connect(pipe);
        probe.once("connect", () => {
            probe.destroy();
            resolve(false);
        });
        probe.once("error", () => {
            try {
                fs.unlinkSync(pipe);
            } catch {
                // Déjà parti.
            }
            resolve(true);
        });
    });
}

// handle(msg) → Promise<objet> : la réponse, ou une erreur (message en français).
export async function startBridgeServer({ pipe, token, version, handle, log = () => {} }) {
    const clients = new Set();
    const send = (socket, message) => {
        if (!socket.destroyed) {
            socket.write(`${JSON.stringify(message)}\n`);
        }
    };

    const server = net.createServer((socket) => {
        socket.setEncoding("utf8");
        let ready = false;
        let buffer = "";
        const helloTimer = setTimeout(() => socket.destroy(), HELLO_TIMEOUT_MS);
        socket.on("close", () => {
            clearTimeout(helloTimer);
            clients.delete(socket);
        });
        socket.on("error", () => {});

        async function onMessage(msg) {
            if (!ready) {
                if (msg?.cmd !== "hello" || !sameToken(msg.token, token)) {
                    log("pont : connexion refusée (jeton absent ou faux)");
                    socket.destroy();
                    return;
                }
                clearTimeout(helloTimer);
                ready = true;
                clients.add(socket);
                send(socket, { event: "ready", version });
                return;
            }
            const id = msg?.id ?? null;
            try {
                const result = await handle(msg);
                send(socket, { id, ok: true, ...(result ?? {}) });
            } catch (error) {
                send(socket, { id, ok: false, error: String(error?.message ?? error) });
            }
        }

        socket.on("data", (text) => {
            buffer += text;
            if (buffer.length > MAX_LINE) {
                socket.destroy();
                return;
            }
            let end;
            while ((end = buffer.indexOf("\n")) >= 0) {
                const line = buffer.slice(0, end);
                buffer = buffer.slice(end + 1);
                if (!line.trim()) {
                    continue;
                }
                let msg;
                try {
                    msg = JSON.parse(line);
                } catch {
                    if (!ready) {
                        socket.destroy();
                        return;
                    }
                    send(socket, { id: null, ok: false, error: "Message illisible." });
                    continue;
                }
                onMessage(msg);
            }
        });
    });

    if (process.platform !== "win32" && fs.existsSync(pipe)) {
        await removeStaleSocket(pipe);
    }
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(pipe, () => {
            server.off("error", reject);
            resolve();
        });
    });
    if (process.platform !== "win32") {
        try {
            fs.chmodSync(pipe, 0o600);
        } catch {
            // Système de fichiers sans droits Unix.
        }
    }

    return {
        pipe,
        clients: () => clients.size,
        broadcast(message) {
            for (const socket of clients) {
                send(socket, message);
            }
        },
        close() {
            for (const socket of clients) {
                socket.destroy();
            }
            return new Promise((resolve) => server.close(() => resolve()));
        },
    };
}
