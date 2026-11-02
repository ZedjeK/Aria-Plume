// Test du pont, sans Electron : inscription (manifeste, lanceur, configuration), relais lancé comme
// le ferait le navigateur (trames de 4 octets sur stdin/stdout), jeton, démarrage automatique de
// l'application, réponse trop volumineuse, désinscription. Sous Linux (lanceur relay.sh).
//     node tests/bridge.mjs
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bridgeRegistration, bridgeSupport, registerBridge, unregisterBridge } from "../bridge/register.js";
import { ensureToken, startBridgeServer } from "../bridge/server.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
let failures = 0;
const check = (label, ok, detail = "") => {
    console.log(`${ok ? "OK   " : "ÉCHEC"} ${label}${detail ? ` : ${detail}` : ""}`);
    failures += ok ? 0 : 1;
};

const root = fs.mkdtempSync(path.join(os.tmpdir(), "aria-pont-"));
const dir = path.join(root, "pont");
const browserDirs = [path.join(root, "chrome", "NativeMessagingHosts"), path.join(root, "edge", "NativeMessagingHosts")];
const env = { ARIA_TEST_HOOKS: "1", ARIA_TEST_NATIVE_DIRS: JSON.stringify(browserDirs) };
const hostName = "fr.aria_plume.app";
const extensionId = "fpgalamdbelhkacggnnglgcljhdcioca";
const pipe = path.join(root, "pont.sock");
const tokenFile = path.join(dir, "jeton");

// L'« application » de ce test : un serveur du pont avec un service factice.
const fakeApp = path.join(root, "fausse-appli.mjs");
fs.writeFileSync(fakeApp, `
import { ensureToken, startBridgeServer } from ${JSON.stringify(path.join(HERE, "..", "bridge", "server.js"))};
const [pipe, tokenFile, marker] = process.argv.slice(2);
const server = await startBridgeServer({
    pipe, token: ensureToken(tokenFile), version: "9.9.9",
    handle: async (msg) => {
        if (msg.cmd === "check") return { matches: [{ start: 3, end: 4, suggestions: ["a"] }], echo: msg.text };
        if (msg.cmd === "big") return { text: "x".repeat(2 * 1024 * 1024) };
        if (msg.cmd === "fail") throw new Error("Échec voulu");
        if (msg.cmd === "quit") { setTimeout(() => process.exit(0), 50); return {}; }
        throw new Error("Commande inconnue");
    },
});
(await import("node:fs")).writeFileSync(marker, String(process.pid));
`);
const startedMarker = path.join(root, "appli-demarree");

check("inscription possible sous Linux", bridgeSupport({ env: {}, platform: "linux" }).ok);
check("exe portable refusé", bridgeSupport({ env: { PORTABLE_EXECUTABLE_FILE: "C:\\x.exe" }, platform: "win32" }).reason === "portable");
check("pas encore inscrit", !(await bridgeRegistration({ dir, hostName, env, platform: "linux" })).registered);

const result = await registerBridge({
    dir, hostName, extensionId, pipe, tokenFile, env, platform: "linux",
    exe: process.execPath,
    appCommand: { command: process.execPath, args: [fakeApp, pipe, tokenFile, startedMarker] },
});
check("inscription : deux navigateurs", result.registered.length === 2 && !result.failed.length, JSON.stringify(result));
const manifest = JSON.parse(fs.readFileSync(path.join(browserDirs[0], `${hostName}.json`), "utf8"));
check("manifeste : nom, type, origine autorisée", manifest.name === hostName && manifest.type === "stdio"
    && manifest.allowed_origins[0] === `chrome-extension://${extensionId}/`, JSON.stringify(manifest));
check("manifeste : lanceur exécutable", (fs.statSync(manifest.path).mode & 0o111) !== 0 && fs.readFileSync(manifest.path, "utf8").includes("ELECTRON_RUN_AS_NODE=1"));
check("état : inscrit", (await bridgeRegistration({ dir, hostName, env, platform: "linux" })).browsers.length === 2);
const token = ensureToken(tokenFile);
check("jeton : stable et privé", ensureToken(tokenFile) === token && (fs.statSync(tokenFile).mode & 0o077) === 0);

// Le relais, lancé comme par le navigateur.
function startRelay() {
    const child = spawn(manifest.path, [`chrome-extension://${extensionId}/`], { stdio: ["pipe", "pipe", "inherit"] });
    let buffer = Buffer.alloc(0);
    const messages = [];
    const waiters = [];
    child.stdout.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        while (buffer.length >= 4 && buffer.length >= 4 + buffer.readUInt32LE(0)) {
            const size = buffer.readUInt32LE(0);
            messages.push(JSON.parse(buffer.subarray(4, 4 + size).toString("utf8")));
            buffer = buffer.subarray(4 + size);
            waiters.splice(0).forEach((wake) => wake());
        }
    });
    const exited = new Promise((resolve) => child.on("exit", (code) => resolve(code)));
    return {
        child,
        exited,
        send(message) {
            const body = Buffer.from(JSON.stringify(message), "utf8");
            const header = Buffer.alloc(4);
            header.writeUInt32LE(body.length, 0);
            child.stdin.write(Buffer.concat([header, body]));
        },
        async wait(test, ms = 25000) {
            const deadline = Date.now() + ms;
            for (;;) {
                const found = messages.find(test);
                if (found) {
                    return found;
                }
                if (Date.now() > deadline) {
                    return null;
                }
                await new Promise((resolve) => {
                    waiters.push(resolve);
                    setTimeout(resolve, 200);
                });
            }
        },
    };
}

// 1. Application arrêtée : le relais la démarre, garde la demande en attente, puis la transmet.
const first = startRelay();
first.send({ id: 1, cmd: "check", text: "Il à fini." });
check("application absente : démarrage annoncé", !!(await first.wait((m) => m.event === "starting")));
check("application démarrée par le relais", !!(await first.wait((m) => m.event === "ready")) && fs.existsSync(startedMarker));
const reply = await first.wait((m) => m.id === 1);
check("demande en attente transmise", reply?.ok === true && reply.echo === "Il à fini." && reply.matches[0].suggestions[0] === "a", JSON.stringify(reply));
first.send({ id: 2, cmd: "fail" });
const failed = await first.wait((m) => m.id === 2);
check("erreur renvoyée en français", failed?.ok === false && failed.error === "Échec voulu");
first.send({ id: 3, cmd: "big" });
const big = await first.wait((m) => m.id === 3);
check("réponse de plus de 1 Mo remplacée par une erreur", big?.ok === false && /volumineuse/.test(big.error), JSON.stringify(big).slice(0, 120));
first.send({ id: 4, cmd: "check", text: "é😀 ok" });
check("UTF-8 et émojis intacts", (await first.wait((m) => m.id === 4))?.echo === "é😀 ok");

// 2. Deuxième relais (autre navigateur) pendant que l'application tourne : pas de nouveau démarrage.
const second = startRelay();
second.send({ id: 7, cmd: "check", text: "deux" });
check("deuxième connexion simultanée", (await second.wait((m) => m.id === 7))?.echo === "deux" && !second.child.killed);
check("pas de deuxième démarrage", !(await second.wait((m) => m.event === "starting", 300)));

// 3. Fermeture du port par le navigateur : le relais s'arrête.
second.child.stdin.end();
check("navigateur parti : relais arrêté", (await second.exited) === 0);

// 4. Jeton faux : connexion refusée par l'application.
const net = await import("node:net");
const refused = await new Promise((resolve) => {
    const socket = net.connect(pipe, () => socket.write(`${JSON.stringify({ id: 0, cmd: "hello", token: "0".repeat(64) })}\n`));
    let data = "";
    socket.setEncoding("utf8");
    socket.on("data", (text) => {
        data += text;
    });
    socket.on("close", () => resolve(data));
    socket.on("error", () => resolve(data));
});
check("jeton faux : connexion fermée sans réponse", refused === "");

// 5. L'application s'arrête : le relais aussi.
first.send({ id: 9, cmd: "quit" });
check("application arrêtée : relais arrêté", (await first.exited) === 0);

// 6. Relais sans application joignable ni démarrable : « unavailable » (l'extension reprend son moteur).
fs.writeFileSync(path.join(dir, "relay-config.json"), JSON.stringify({ pipe: path.join(root, "absent.sock"), tokenFile, app: null, connectTimeoutMs: 1500 }));
const lonely = startRelay();
const relayTimeout = Date.now();
const unavailable = await lonely.wait((m) => m.event === "unavailable", 10000);
check("application injoignable : « unavailable »", !!unavailable && (await lonely.exited) === 1, `${Date.now() - relayTimeout} ms`);

// 7. Désinscription.
await unregisterBridge({ dir, hostName, env, platform: "linux" });
check("désinscription : manifestes retirés", browserDirs.every((target) => !fs.existsSync(path.join(target, `${hostName}.json`))));
check("désinscription : relais retiré, jeton gardé", !fs.existsSync(path.join(dir, "relay.cjs")) && fs.existsSync(tokenFile));
check("état : plus inscrit", !(await bridgeRegistration({ dir, hostName, env, platform: "linux" })).registered);

// Serveur : socket abandonné par une application arrêtée brutalement → repris.
fs.writeFileSync(path.join(root, "vieux.sock"), "");
try {
    const server = await startBridgeServer({ pipe: path.join(root, "vieux.sock"), token, version: "1", handle: async () => ({}) });
    check("socket abandonné repris", true);
    await server.close();
} catch (error) {
    check("socket abandonné repris", false, error.message);
}

fs.rmSync(root, { recursive: true, force: true });
console.log(failures ? `\n${failures} échec(s)` : "\ntout est bon");
process.exitCode = failures ? 1 : 0;
