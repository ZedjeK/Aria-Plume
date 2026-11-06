// Aria Plume (application) — processus principal.
// Une seule instance, une icône près de l'horloge, une fenêtre de correction qui se cache
// au lieu de se fermer. Le moteur Aria tourne ici même (engine.js), sans fenêtre cachée.
// La fenêtre affiche le correcteur de l'extension (popup.html), servi par le protocole aria:.

import { app, BrowserWindow, Menu, Notification, Tray, clipboard, dialog, globalShortcut, ipcMain, nativeImage, net, protocol, shell } from "electron";
import crypto from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const ICON_DIR = path.join(APP_DIR, "build");
const STARTED_HIDDEN = process.argv.includes("--hidden");

if (!app.requestSingleInstanceLock()) {
    app.quit();
    process.exit(0);
}

// aria://app/… : nos pages, avec les droits d'une origine sûre (modules, fetch, presse-papiers).
protocol.registerSchemesAsPrivileged([
    { scheme: "aria", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

// Le moteur (et les réglages, qui en dépendent) ne se charge qu'une fois l'instance confirmée.
const { aria, createService, ENGINE_ROOT } = await import("./engine.js");
const { loadSettings, saveSettings, removeSettings, settingsFile, settingsDir, getValues } = await import("./settings.js");
const { FOLDER_NAME, findBrowsers, extensionState, syncExtension, launchBrowser } = await import("./extension-install.js");
const { createInput, captureSelection, pasteInto } = await import("./windows-input.js");
const { bridgePipePath, ensureToken, startBridgeServer } = await import("./bridge/server.js");
const { BRIDGE_FOLDER, bridgeSupport, registerBridge, unregisterBridge, bridgeRegistration } = await import("./bridge/register.js");
const { OFFICE_PORT, startOfficeServer } = await import("./office/server.js");
const { checkForUpdate, isDue, isReleaseUrl } = await import("./updates.js");
const { OUTLOOK_MANIFEST, OUTLOOK_SIDELOAD_URL, WORD_MANIFEST, manualCommand, registerWord, unregisterWord, wordRegistered, writeOutlookManifest } = await import("./office/manifest.js");
const { OFFICE_FOLDER, ensureCertificates, loadCertificates, isTrusted, trust, removeCertificates } = await import("./office/install.js");
const { EXTENSION_ID, NATIVE_HOST } = await import(pathToFileURL(path.join(ENGINE_ROOT, "core", "shared", "ids.js")).href);

// --- Réglages : enregistrés dans le fichier, et signalés aux fenêtres ouvertes ---
function updateSettings(changes) {
    return announceChanges(saveSettings(changes ?? {}));
}

function announceChanges(diff) {
    if (Object.keys(diff).length) {
        for (const win of BrowserWindow.getAllWindows()) {
            win.webContents.send("storage-changed", diff);
        }
        bridge?.broadcast({ event: "settings-changed", changes: diff });
        if (diff.hotkey) {
            registerHotkey();
        }
        if (diff.startWithWindows) {
            applyStartWithWindows(diff.startWithWindows.newValue);
        }
        tray?.setContextMenu(buildTrayMenu());
    }
    return diff;
}

const service = createService({
    aria,
    getSettings: async (defaults) => getValues(defaults),
    saveValues: async (values) => {
        updateSettings(values);
    },
});

// --- Pages servies en aria://app/ ---
// Seuls ces dossiers sont servis : le correcteur de l'extension et les retouches de l'application.
const SERVED = [
    { prefix: "app/", root: path.join(APP_DIR, "ui") },
    { prefix: "popup/", root: path.join(ENGINE_ROOT, "popup") },
    { prefix: "options/", root: path.join(ENGINE_ROOT, "options") },
    { prefix: "content/", root: path.join(ENGINE_ROOT, "content") },
    { prefix: "icons/", root: path.join(ENGINE_ROOT, "icons") },
    { prefix: "core/shared/", root: path.join(ENGINE_ROOT, "core", "shared") },
];
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };
const CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'";
const WINDOW_URL = "aria://app/popup/popup.html";
const OPTIONS_URL = "aria://app/options/options.html";

async function servePage(request) {
    const url = new URL(request.url);
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const entry = url.host === "app" ? SERVED.find(({ prefix }) => relative.startsWith(prefix)) : null;
    const file = entry ? path.resolve(entry.root, relative.slice(entry.prefix.length)) : null;
    const type = TYPES[path.extname(file ?? "")];
    if (!file || !type || !file.startsWith(entry.root + path.sep)) {
        return new Response("Introuvable", { status: 404 });
    }
    let body;
    try {
        body = await fs.promises.readFile(file);
    } catch {
        return new Response("Introuvable", { status: 404 });
    }
    // Les pages du correcteur et des réglages reçoivent le pont « chrome » et les retouches de
    // l'application (mise en page, éléments propres au navigateur masqués, réglages de l'appli).
    if (relative === "popup/popup.html" || relative === "options/options.html") {
        const extra = relative === "options/options.html" ? '\n    <script src="/app/options-app.js" defer></script>' : "";
        body = body.toString("utf8")
            .replace("<head>", '<head>\n    <script src="/app/chrome.js"></script>')
            .replace("</head>", `    <link rel="stylesheet" href="/app/app.css">${extra}\n</head>`);
    }
    return new Response(body, { headers: { "content-type": type, "content-security-policy": CSP } });
}

// --- Raccourci global « à la Antidote » ---
// Sélectionne du texte dans n'importe quel logiciel, appuie sur le raccourci : Aria Plume copie la
// sélection, l'ouvre dans le correcteur, et « Renvoyer » la remplace par le texte corrigé.
const input = createInput();
let lastCapture = null;
let capturing = false;
let hotkey = { accelerator: "", ok: false };

// Message vers la page du correcteur (une fois chargée).
async function sendToPage(msg) {
    if (!mainWindow) {
        createWindow();
    }
    const contents = mainWindow.webContents;
    if (contents.isLoading()) {
        await new Promise((resolve) => contents.once("did-finish-load", resolve));
        await new Promise((resolve) => setTimeout(resolve, 300));
    }
    contents.send("content-message", { id: Date.now(), msg });
}

async function onHotkey() {
    if (capturing) {
        return;
    }
    // Raccourci depuis notre propre fenêtre : rien à copier, on la garde au premier plan.
    if (mainWindow?.isVisible() && mainWindow.isFocused()) {
        showWindow();
        return;
    }
    capturing = true;
    try {
        const result = input.available
            ? await captureSelection(input)
            : { error: "La capture de la sélection n'est disponible que sous Windows : colle ton texte ici." };
        lastCapture = result.text ? { hwnd: result.hwnd, title: result.title } : null;
        showWindow();
        await sendToPage({ target: "popup", cmd: "set-text", text: result.text ?? "", source: result.title ?? "", error: result.error ?? "" });
    } finally {
        capturing = false;
    }
}

function registerHotkey() {
    globalShortcut.unregisterAll();
    const accelerator = loadSettings().hotkey;
    let ok = false;
    try {
        ok = globalShortcut.register(accelerator, () => {
            onHotkey().catch((error) => console.error("Raccourci :", error));
        });
    } catch {
        ok = false;  // combinaison invalide
    }
    hotkey = { accelerator, ok };
    tray?.setContextMenu(buildTrayMenu());
}

// « Alt+Shift+C » → « Alt+Maj+C ».
const showAccelerator = (accelerator) => accelerator.replace(/Shift/g, "Maj").replace(/CommandOrControl|CmdOrCtrl|Control/g, "Ctrl");

// --- Demandes de la fenêtre (chrome.runtime.sendMessage vers le « service worker ») ---
const SERVICE_COMMANDS = {
    check: (msg) => service.check({ text: String(msg.text ?? ""), lang: msg.lang, host: "" }),
    detect: (msg) => service.detectLanguage(String(msg.text ?? "")),
    translate: (msg) => service.translate({ ...msg, text: String(msg.text ?? "") }),
    synonyms: (msg) => service.synonyms(msg),
    conjugate: (msg) => service.conjugate(msg),
    "record-mistakes": async (msg) => {
        await service.recordMistakes(msg.items);
        return {};
    },
    "translate-cancel": async (msg) => {
        await aria.cancelTranslation(msg.jobId);
        return {};
    },
    // « Renvoyer » : le texte corrigé remplace la sélection dans le logiciel d'origine.
    exchange: async (msg) => {
        if (msg.op !== "put-text" || !lastCapture) {
            throw new Error("Rien à renvoyer : sélectionne d'abord du texte dans un logiciel, puis utilise le raccourci.");
        }
        const result = await pasteInto(input, lastCapture.hwnd, String(msg.text ?? ""));
        if (!result.ok) {
            throw new Error(result.error);
        }
        mainWindow?.hide();
        return { changes: 1 };
    },
};

// --- Pont avec l'extension du navigateur (messagerie native, voir bridge/) ---
// L'extension demande ici ce que son propre moteur ferait : mêmes commandes, mêmes réglages
// (le fichier de l'application). « Renvoyer » (exchange) reste propre à la fenêtre.
const BRIDGE_COMMANDS = {
    ping: async () => ({ version: app.getVersion() }),
    // personal : dictionnaire, mots ignorés et catégories appliqués ici (complément Office) ;
    // l'extension, elle, les applique dans ses pages.
    check: (msg) => service.check({ text: String(msg.text ?? ""), lang: msg.lang, host: typeof msg.host === "string" ? msg.host : "", personal: msg.personal === true }),
    detect: SERVICE_COMMANDS.detect,
    translate: SERVICE_COMMANDS.translate,
    synonyms: SERVICE_COMMANDS.synonyms,
    conjugate: SERVICE_COMMANDS.conjugate,
    "record-mistakes": SERVICE_COMMANDS["record-mistakes"],
    "translate-cancel": SERVICE_COMMANDS["translate-cancel"],
    // Le moteur seul : l'extension garde son service (détection de langue du navigateur, français
    // soigné selon le site, dictionnaire) et ne demande à l'application que l'analyse elle-même.
    "engine-check": async (msg) => aria.check({ text: String(msg.text ?? ""), lang: msg.lang, dialect: msg.dialect, formal: !!msg.formal, repetitions: Number(msg.repetitions) || 0 }),
    "engine-translate": async (msg) => aria.translate({ text: String(msg.text ?? ""), from: msg.from, to: msg.to, html: !!msg.html, glossary: msg.glossary ?? null, priority: Number(msg.priority) || 0, jobId: msg.jobId ?? null }),
    "engine-conjugate": async (msg) => aria.conjugate({ verb: String(msg.verb ?? ""), options: msg.options ?? {} }),
    "engine-synonyms": async (msg) => aria.synonyms({ word: String(msg.word ?? ""), lang: msg.lang }),
    "engine-cancel": async (msg) => {
        await aria.cancelTranslation(msg.jobId);
        return {};
    },
    "settings-get": async (msg) => ({ values: getValues(msg.spec ?? null) }),
    "settings-set": async (msg) => ({ changes: updateSettings(msg.values && typeof msg.values === "object" ? msg.values : {}) }),
    "settings-remove": async (msg) => ({ changes: announceChanges(removeSettings(msg.keys)) }),
};
const bridgeDir = () => path.join(settingsDir(), BRIDGE_FOLDER);
const bridgeTokenFile = () => path.join(bridgeDir(), "jeton");
let bridge = null;
let bridgeError = null;

async function startBridge() {
    try {
        bridge = await startBridgeServer({
            pipe: bridgePipePath(),
            token: ensureToken(bridgeTokenFile()),
            version: app.getVersion(),
            handle: async (msg) => {
                const run = BRIDGE_COMMANDS[msg?.cmd];
                if (!run) {
                    throw new Error(`Commande inconnue : ${String(msg?.cmd)}`);
                }
                return run(msg);
            },
            log: (text) => console.warn(text),
        });
    } catch (error) {
        bridgeError = String(error?.message ?? error);
        console.error("Pont :", bridgeError);
    }
}

// Commande qui démarre l'application cachée (utilisée par le relais).
function appCommand() {
    // Banc automatique : arguments en plus (--no-sandbox sous Linux en root…).
    const extra = process.env.ARIA_TEST_HOOKS === "1" && process.env.ARIA_TEST_EXTRA_ARGS ? JSON.parse(process.env.ARIA_TEST_EXTRA_ARGS) : [];
    return app.isPackaged
        ? { command: process.execPath, args: ["--hidden", ...extra] }
        : { command: process.execPath, args: [APP_DIR, "--hidden", ...extra] };
}

const bridgeOptions = () => ({
    dir: bridgeDir(),
    exe: process.execPath,
    appCommand: appCommand(),
    pipe: bridgePipePath(),
    tokenFile: bridgeTokenFile(),
    extensionId: EXTENSION_ID,
    hostName: NATIVE_HOST,
});

async function bridgeState() {
    const support = bridgeSupport();
    const registration = support.ok ? await bridgeRegistration(bridgeOptions()) : { registered: false, browsers: [] };
    return {
        supported: support.ok,
        reason: support.reason,
        ...registration,
        listening: !!bridge,
        error: bridgeError,
        clients: bridge?.clients() ?? 0,
    };
}

// Application déplacée ou mise à jour : l'inscription existante est réécrite avec les bons chemins.
async function refreshBridgeRegistration() {
    if (!bridgeSupport().ok || !fs.existsSync(path.join(bridgeDir(), `${NATIVE_HOST}.json`))) {
        return;
    }
    try {
        await registerBridge(bridgeOptions());
    } catch (error) {
        console.error("Pont : réinscription impossible :", error);
    }
}

// --- Complément Office : serveur HTTPS local (voir office/) ---
// Les pages du complément et le même moteur que le pont, sur https://localhost:47823.
const officeDir = () => path.join(settingsDir(), OFFICE_FOLDER);
const officePort = () => (process.env.ARIA_TEST_HOOKS === "1" && process.env.ARIA_TEST_OFFICE_PORT ? Number(process.env.ARIA_TEST_OFFICE_PORT) : OFFICE_PORT);
let officeServer = null;
let officeError = null;

async function startOffice() {
    const certificates = loadCertificates(officeDir());
    if (!certificates || officeServer) {
        return;
    }
    try {
        officeServer = await startOfficeServer({
            port: officePort(),
            cert: certificates.cert,
            key: certificates.key,
            version: app.getVersion(),
            roots: [
                { prefix: "icons/", root: ICON_DIR },
                { prefix: "", root: path.join(APP_DIR, "office", "pages") },
            ],
            handle: async (msg) => {
                const run = BRIDGE_COMMANDS[msg?.cmd];
                if (!run) {
                    throw new Error(`Commande inconnue : ${String(msg?.cmd)}`);
                }
                if (msg.cmd === "ping") {
                    noteOfficeUse(msg.host);
                }
                return run(msg);
            },
            log: (text) => console.warn(text),
        });
        officeError = null;
    } catch (error) {
        officeError = error?.code === "EADDRINUSE"
            ? `le port ${officePort()} est déjà pris par un autre logiciel`
            : String(error?.message ?? error);
        console.error("Complément Office :", officeError);
    }
}

const officeOrigin = () => `https://localhost:${officePort()}`;

// Le panneau d'un complément s'est ouvert (ping avec host « Word » ou « Outlook ») : noté au plus
// une fois par heure, et affiché dans les réglages.
function noteOfficeUse(host) {
    if (host !== "Word" && host !== "Outlook") {
        return;
    }
    const seen = loadSettings().officeSeen ?? {};
    const last = Date.parse(seen[host] ?? "");
    if (Number.isNaN(last) || Date.now() - last > 3600 * 1000) {
        updateSettings({ officeSeen: { ...seen, [host]: new Date().toISOString() } });
    }
}

// Certificat (approuvé par Windows) et serveur : commun à Word et Outlook.
async function prepareOffice() {
    const certificates = ensureCertificates(officeDir());
    let refused = false;
    if (await isTrusted(certificates) === false) {
        // Windows affiche son avertissement : la réponse de l'utilisateur décide.
        refused = (await trust(certificates)).refused;
    }
    await startOffice();
    return { refused };
}

// Manifeste Word réécrit au démarrage (nouvelle version, dossier déplacé) s'il était inscrit.
// Manifeste Outlook réécrit au démarrage s'il existe (même contenu tant que le port ne change pas ;
// une nouvelle version demande quand même de le réinstaller dans Outlook pour que la version suive).
function refreshOutlookManifest() {
    if (fs.existsSync(path.join(officeDir(), OUTLOOK_MANIFEST))) {
        writeOutlookManifest({ dir: officeDir(), origin: officeOrigin(), version: app.getVersion() });
    }
}

async function refreshWordRegistration() {
    if (!fs.existsSync(path.join(officeDir(), WORD_MANIFEST))) {
        return;
    }
    try {
        await registerWord({ dir: officeDir(), origin: officeOrigin(), version: app.getVersion() });
    } catch (error) {
        console.error("Complément Word : réinscription impossible :", error);
    }
}

// Le serveur répond-il vraiment, en HTTPS, avec notre certificat ? Renvoie { ok, error }.
// Le certificat présenté est comparé au nôtre par son empreinte : BoringSSL (le TLS d'Electron)
// refuse la contrainte de noms sur les adresses IP de notre autorité, que Windows, lui, accepte
// (c'est Windows qui valide pour Word ; son approbation est vérifiée à part, par certutil).
function pingOffice(certificates) {
    return new Promise((resolve) => {
        if (!certificates || !officeServer) {
            resolve({ ok: false, error: officeError ?? "serveur arrêté" });
            return;
        }
        const expected = new crypto.X509Certificate(certificates.cert).fingerprint256;
        const request = https.get({
            host: "127.0.0.1",
            port: officePort(),
            path: "/office/ping",
            servername: "localhost",
            headers: { host: `localhost:${officePort()}` },
            rejectUnauthorized: false,
            timeout: 3000,
        }, (response) => {
            const presented = response.socket.getPeerCertificate()?.fingerprint256;
            let body = "";
            response.on("data", (chunk) => {
                body += chunk;
            });
            response.on("end", () => resolve(presented !== expected
                ? { ok: false, error: "un autre certificat que celui d'Aria Plume" }
                : response.statusCode === 200 && body.includes("Aria Plume")
                    ? { ok: true, error: null }
                    : { ok: false, error: `réponse inattendue (${response.statusCode})` }));
        });
        request.on("error", (error) => resolve({ ok: false, error: error.code ?? error.message }));
        request.on("timeout", () => {
            request.destroy();
            resolve({ ok: false, error: "pas de réponse en 3 secondes" });
        });
    });
}

// État réel, vérifié : certificat approuvé, serveur qui répond, inscription relue dans le registre.
async function officeState() {
    const certificates = loadCertificates(officeDir());
    const manifest = path.join(officeDir(), WORD_MANIFEST);
    const ping = await pingOffice(certificates);
    return {
        installed: !!certificates,
        trusted: await isTrusted(certificates),
        server: ping.ok,
        serverError: ping.error,
        word: await wordRegistered({ dir: officeDir() }),
        url: `https://localhost:${officePort()}/office/`,
        manualCommand: process.platform === "win32" ? manualCommand(manifest) : null,
        outlookManifest: fs.existsSync(path.join(officeDir(), OUTLOOK_MANIFEST)) ? path.join(officeDir(), OUTLOOK_MANIFEST) : null,
        seen: loadSettings().officeSeen ?? {},
    };
}

// --- Mises à jour (voir updates.js) : seul accès à internet de l'application ---
// Au démarrage puis toutes les 6 heures, une vérification au plus par jour si la case est cochée ;
// ou à la demande (réglages, menu de l'icône). Une nouvelle version n'est signalée qu'une fois.
let lastUpdate = null;
let updateTimer = null;

// Sorte d'application : exe portable, zip Windows ou autre (développement, Linux).
const appKind = () => (process.env.PORTABLE_EXECUTABLE_FILE ? "portable" : app.isPackaged && process.platform === "win32" ? "zip" : "dev");

// Banc automatique : adresse de test, et aucune vérification automatique sans elle.
const testUpdateUrl = () => (process.env.ARIA_TEST_HOOKS === "1" ? process.env.ARIA_TEST_UPDATE_URL ?? null : undefined);

async function runUpdateCheck({ manual = false } = {}) {
    const testUrl = testUpdateUrl();
    if (testUrl === null) {
        return { status: "error", current: app.getVersion(), error: "Vérification désactivée pendant les tests.", notes: [] };
    }
    const result = await checkForUpdate({
        current: app.getVersion(),
        kind: appKind(),
        fetchImpl: (url, options) => net.fetch(url, options),
        ...(testUrl ? { url: testUrl } : {}),
    });
    lastUpdate = { ...result, checkedAt: new Date().toISOString(), kind: appKind() };
    const changes = { updateCheckedAt: lastUpdate.checkedAt };
    if (result.status === "available" && (manual || loadSettings().updateNotified !== result.latest)) {
        notifyUpdate(result);
        changes.updateNotified = result.latest;
    } else if (manual && result.status === "up-to-date") {
        notify("Aria Plume est à jour", `Version ${result.current}, la plus récente.`);
    } else if (manual && result.status === "error") {
        notify("Vérification impossible", result.error);
    }
    updateSettings(changes);
    tray?.setContextMenu(buildTrayMenu());
    for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send("update-result", lastUpdate);
    }
    return lastUpdate;
}

// Notification près de l'horloge (bulle de l'icône sous Windows, la plus fiable pour une
// application portable). Un clic ouvre la page de la version.
let notificationUrl = null;
let lastNotification = null;
function notify(title, content, url = null) {
    notificationUrl = url;
    lastNotification = { title, content, url };
    if (process.env.ARIA_TEST_HOOKS === "1") {
        return;
    }
    if (process.platform === "win32" && tray) {
        tray.displayBalloon({ title, content, iconType: "info" });
    } else if (Notification.isSupported()) {
        const notification = new Notification({ title, body: content });
        notification.on("click", () => openReleasePage(url));
        notification.show();
    }
}

function notifyUpdate(result) {
    notify(`Aria Plume ${result.latest} est disponible`, `Tu as la ${result.current}. Clique ici pour ouvrir la page de téléchargement.`, result.url);
}

let openedUrl = null;
function openReleasePage(url = lastUpdate?.url) {
    if (!isReleaseUrl(url)) {
        return false;
    }
    openedUrl = url;
    if (process.env.ARIA_TEST_HOOKS !== "1") {
        shell.openExternal(url);
    }
    return true;
}

function scheduleUpdateChecks() {
    const tick = () => {
        const settings = loadSettings();
        if (settings.checkUpdates && testUpdateUrl() !== null && isDue(settings.updateCheckedAt)) {
            runUpdateCheck().catch((error) => console.error("Mises à jour :", error));
        }
    };
    // Pas pendant le démarrage : quelques secondes après, puis toutes les 6 heures.
    setTimeout(tick, process.env.ARIA_TEST_HOOKS === "1" ? 1000 : 20000);
    updateTimer = setInterval(tick, 6 * 3600 * 1000);
    updateTimer.unref?.();
}

let tray = null;
let mainWindow = null;
let optionsWindow = null;
let quitting = false;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 920,
        height: 720,
        minWidth: 420,
        minHeight: 420,
        show: false,
        title: "Aria Plume",
        icon: path.join(ICON_DIR, "icon-128.png"),
        backgroundColor: "#14121c",
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(APP_DIR, "preload.cjs"),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
            spellcheck: false,
        },
    });
    mainWindow.loadURL(WINDOW_URL);
    // Fermer la fenêtre la cache : l'application reste près de l'horloge.
    mainWindow.on("close", (event) => {
        if (!quitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
    // Liens externes : dans le navigateur, jamais dans l'application.
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https:\/\//.test(url)) {
            shell.openExternal(url);
        }
        return { action: "deny" };
    });
    mainWindow.webContents.on("will-navigate", (event) => event.preventDefault());
}

// Page de réglages : celle de l'extension, avec une section pour l'application.
function openOptions() {
    if (optionsWindow) {
        optionsWindow.show();
        optionsWindow.focus();
        return;
    }
    optionsWindow = new BrowserWindow({
        width: 860,
        height: 820,
        minWidth: 480,
        minHeight: 400,
        title: "Aria Plume — réglages",
        icon: path.join(ICON_DIR, "icon-128.png"),
        backgroundColor: "#0d0f17",
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(APP_DIR, "preload.cjs"),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
            spellcheck: false,
        },
    });
    optionsWindow.loadURL(OPTIONS_URL);
    optionsWindow.on("closed", () => {
        optionsWindow = null;
    });
    optionsWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    optionsWindow.webContents.on("will-navigate", (event) => event.preventDefault());
}

function showWindow() {
    if (!mainWindow) {
        createWindow();
    }
    if (mainWindow.isMinimized()) {
        mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
}

// Démarrage avec Windows : on enregistre l'exe portable lui-même (pas sa copie temporaire).
function loginItemPath() {
    return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
}

function applyStartWithWindows(enabled) {
    if (process.platform !== "win32") {
        return;
    }
    app.setLoginItemSettings({ openAtLogin: enabled, path: loginItemPath(), args: ["--hidden"] });
}

function buildTrayMenu() {
    const settings = loadSettings();
    const template = [
        { label: "Ouvrir le correcteur", click: showWindow },
        {
            label: hotkey.ok
                ? `Raccourci : ${showAccelerator(hotkey.accelerator)} sur un texte sélectionné`
                : `Raccourci ${showAccelerator(hotkey.accelerator)} indisponible (déjà pris ?)`,
            enabled: false,
        },
        { type: "separator" },
    ];
    if (process.platform === "win32") {
        template.push({
            label: "Démarrer avec Windows",
            type: "checkbox",
            checked: settings.startWithWindows,
            click: (item) => {
                updateSettings({ startWithWindows: item.checked });
            },
        });
    }
    template.push(
        lastUpdate?.status === "available"
            ? { label: `Mise à jour disponible : ${lastUpdate.latest}…`, click: () => openReleasePage() }
            : { label: "Rechercher une mise à jour", click: () => runUpdateCheck({ manual: true }).catch(() => {}) },
        { label: "Réglages…", click: openOptions },
        { label: "Ouvrir le dossier des réglages", click: () => shell.showItemInFolder(settingsFile()) },
        { type: "separator" },
        { label: "Quitter Aria Plume", click: () => app.quit() },
    );
    return Menu.buildFromTemplate(template);
}

function createTray() {
    const icon = nativeImage.createFromPath(path.join(ICON_DIR, "icon-32.png")).resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    tray.setToolTip("Aria Plume");
    tray.setContextMenu(buildTrayMenu());
    tray.on("click", showWindow);
    tray.on("balloon-click", () => openReleasePage(notificationUrl));
}

ipcMain.handle("sw", async (event, msg) => {
    const run = SERVICE_COMMANDS[msg?.cmd];
    if (!run) {
        return { ok: false, error: "Cette action n'existe que dans l'extension du navigateur." };
    }
    try {
        return { ok: true, ...(await run(msg)) };
    } catch (error) {
        return { ok: false, error: String(error?.message ?? error) };
    }
});
ipcMain.handle("storage:get", (event, spec) => getValues(spec));
ipcMain.handle("storage:set", (event, values) => {
    updateSettings(values && typeof values === "object" ? values : {});
});
ipcMain.handle("storage:remove", (event, keys) => {
    announceChanges(removeSettings(keys));
});
ipcMain.handle("app:options", () => openOptions());
ipcMain.handle("app:hotkey", () => ({ ...hotkey, display: showAccelerator(hotkey.accelerator) }));
ipcMain.handle("app:settings-file", () => settingsFile());
// Configuration MCP à copier dans Claude Desktop, LM Studio… L'exe portable se décompresse
// ailleurs à chaque lancement : pour le MCP, c'est l'exe de la version zip qu'il faut indiquer.
ipcMain.handle("app:mcp-config", () => ({
    command: process.execPath,
    args: ["--mcp"],
    portable: !!process.env.PORTABLE_EXECUTABLE_FILE,
    packaged: app.isPackaged,
    appDir: APP_DIR,
}));
ipcMain.handle("app:show-settings-file", () => shell.showItemInFolder(settingsFile()));

// --- Extension du navigateur : installation assistée (voir extension-install.js) ---
const extensionPaths = () => ({
    source: ENGINE_ROOT,
    target: process.env.ARIA_TEST_HOOKS === "1" && process.env.ARIA_TEST_EXTENSION_DIR
        ? process.env.ARIA_TEST_EXTENSION_DIR
        : path.join(settingsDir(), FOLDER_NAME),
});
// Une seule copie à la fois (deux clics rapprochés attendent la même).
let copying = null;
function copyExtension() {
    copying ??= syncExtension(extensionPaths()).finally(() => {
        copying = null;
    });
    return copying;
}
ipcMain.handle("app:extension-state", () => ({
    ...extensionState(extensionPaths()),
    browsers: findBrowsers().map(({ id, name, url }) => ({ id, name, url })),
}));
// Copie (si besoin), puis ouverture du navigateur avec l'adresse de sa page d'extensions dans le
// presse-papiers. « other » : copie seulement, l'utilisateur ouvre lui-même son navigateur.
ipcMain.handle("app:extension-install", async (event, id) => {
    const copy = await copyExtension();
    const browser = findBrowsers().find((item) => item.id === id);
    const url = browser?.url ?? "chrome://extensions";
    clipboard.writeText(url);
    const launch = browser ? await launchBrowser(browser) : { ok: false };
    return { ...copy, url, launched: launch.ok, error: launch.error ?? null };
});
ipcMain.handle("app:extension-copy-path", async () => {
    const { folder } = await copyExtension();
    clipboard.writeText(folder);
    return folder;
});
ipcMain.handle("app:extension-open-folder", async () => {
    const { folder } = await copyExtension();
    return shell.openPath(folder);
});
// --- Pont : inscription auprès des navigateurs (Réglages → Connecter les navigateurs) ---
ipcMain.handle("app:bridge-state", () => bridgeState());
ipcMain.handle("app:bridge-register", async () => {
    const support = bridgeSupport();
    if (!support.ok) {
        throw new Error(support.reason === "portable"
            ? "L'exe portable se décompresse ailleurs à chaque lancement : utilise la version zip pour connecter les navigateurs."
            : "La connexion avec les navigateurs n'est prévue que sous Windows.");
    }
    const result = await registerBridge(bridgeOptions());
    return { ...result, state: await bridgeState() };
});
ipcMain.handle("app:bridge-unregister", async () => {
    if (bridgeSupport().ok) {
        await unregisterBridge(bridgeOptions());
    }
    return bridgeState();
});
// --- Complément Office : installation (certificat approuvé par Windows, serveur démarré) ---
ipcMain.handle("app:office-state", () => officeState());
ipcMain.handle("app:office-install", async () => {
    const { refused } = await prepareOffice();
    const word = await registerWord({ dir: officeDir(), origin: officeOrigin(), version: app.getVersion() });
    return { ...(await officeState()), refused, wordError: word.error ?? null };
});
// Outlook : pas de registre. Manifeste écrit, puis la page de Microsoft et le dossier du fichier
// ouverts : l'installation se fait là-bas, une fois, et suit le compte Microsoft.
ipcMain.handle("app:outlook-install", async () => {
    const { refused } = await prepareOffice();
    const manifest = writeOutlookManifest({ dir: officeDir(), origin: officeOrigin(), version: app.getVersion() });
    openedUrl = OUTLOOK_SIDELOAD_URL;
    if (process.env.ARIA_TEST_HOOKS !== "1") {
        await shell.openExternal(OUTLOOK_SIDELOAD_URL);
        shell.showItemInFolder(manifest);
    }
    return { ...(await officeState()), refused };
});
ipcMain.handle("app:outlook-copy-path", () => {
    const manifest = path.join(officeDir(), OUTLOOK_MANIFEST);
    clipboard.writeText(manifest);
    return manifest;
});
ipcMain.handle("app:office-uninstall", async () => {
    await officeServer?.close();
    officeServer = null;
    await unregisterWord({ dir: officeDir() });
    fs.rmSync(path.join(officeDir(), OUTLOOK_MANIFEST), { force: true });
    await removeCertificates(officeDir());
    return officeState();
});
// --- Mises à jour : réglages ---
ipcMain.handle("app:update-state", () => ({ last: lastUpdate, kind: appKind(), version: app.getVersion() }));
ipcMain.handle("app:update-check", () => runUpdateCheck({ manual: false }));
ipcMain.handle("app:update-open", () => openReleasePage());
// Enregistrement d'un fichier exporté par la page de réglages (réglages, dictionnaire) : boîte de
// dialogue « Enregistrer sous » de Windows, puis écriture. Le téléchargement de Chromium n'est pas
// utilisé (il perd le fichier quand la page libère son contenu juste après le clic).
let lastSaved = null;
ipcMain.handle("app:save-file", async (event, name, text) => {
    const fileName = path.basename(String(name || "aria-plume.txt")).replace(/[<>:"|?*]/g, "_");
    if (typeof text !== "string" || text.length > 10_000_000) {
        throw new Error("Contenu invalide.");
    }
    let target;
    if (process.env.ARIA_TEST_HOOKS === "1" && process.env.ARIA_TEST_DOWNLOADS) {
        target = path.join(process.env.ARIA_TEST_DOWNLOADS, fileName);
    } else {
        const owner = BrowserWindow.fromWebContents(event.sender);
        const choice = await dialog.showSaveDialog(owner, { defaultPath: path.join(app.getPath("downloads"), fileName) });
        if (choice.canceled || !choice.filePath) {
            return null;
        }
        target = choice.filePath;
    }
    await fs.promises.writeFile(target, text, "utf8");
    lastSaved = target;
    return target;
});
ipcMain.on("app:manifest", (event) => {
    event.returnValue = { name: "Aria Plume", version: app.getVersion(), platform: process.platform };
});
ipcMain.handle("app:info", () => aria.info());
ipcMain.handle("app:version", () => app.getVersion());
// Crochets de test (banc automatique uniquement, jamais actifs sans cette variable).
if (process.env.ARIA_TEST_HOOKS === "1") {
    ipcMain.handle("test:state", () => ({
        windows: BrowserWindow.getAllWindows().map((w) => ({ visible: w.isVisible(), title: w.getTitle() })),
        tray: !!tray && !tray.isDestroyed(),
        trayMenu: buildTrayMenu().items.map((item) => item.label).filter(Boolean),
        settingsFile: settingsFile(),
    }));
    ipcMain.handle("test:quit", () => {
        setTimeout(() => app.quit(), 50);
    });
    // Même chemin que le bouton de fermeture de la fenêtre.
    ipcMain.handle("test:close", () => {
        setTimeout(() => mainWindow?.close(), 50);
    });
    ipcMain.handle("test:serve", async (event, url) => (await servePage(new Request(url))).status);
    // Raccourci simulé (ARIA_FAKE_INPUT=1) : « selection » est le texte sélectionné dans l'autre logiciel.
    ipcMain.handle("test:hotkey", async (event, selection) => {
        input.fake.selection = selection;
        mainWindow?.hide();
        await onHotkey();
    });
    ipcMain.handle("test:pasted", () => ({ received: input.fake?.received ?? null, hotkey }));
    ipcMain.handle("test:clipboard", async (event, text) => {
        if (typeof text === "string") {
            await clipboard.writeText(text);
        }
        return clipboard.readText();
    });
    ipcMain.handle("test:download", () => lastSaved);
    ipcMain.handle("test:opened", () => openedUrl);
    ipcMain.handle("test:notified", () => lastNotification);
    ipcMain.handle("test:show", () => {
        showWindow();
    });
}

// Une deuxième instance lancée par le relais (--hidden) ne doit pas faire apparaître la fenêtre.
app.on("second-instance", (event, argv) => {
    if (!argv.includes("--hidden")) {
        showWindow();
    }
});
app.on("before-quit", () => {
    quitting = true;
});
app.on("will-quit", () => {
    globalShortcut.unregisterAll();
    input.stop();
    bridge?.close().catch(() => {});
    officeServer?.close().catch(() => {});
    // Arrêt des workers du moteur. Sans attendre : retarder la fermeture (preventDefault puis
    // nouvel app.quit()) empêche Electron de se terminer quand une fenêtre a existé.
    aria.close().catch(() => {});
});
// Fenêtre cachée ou fermée : l'application continue près de l'horloge.
app.on("window-all-closed", () => {});

// Pas de « await app.whenReady() » au niveau du module : Electron n'émet « ready » qu'une fois
// le module principal entièrement évalué, l'attendre ici bloquerait tout.
app.whenReady().then(() => {
    protocol.handle("aria", servePage);
    Menu.setApplicationMenu(null);
    createTray();
    registerHotkey();
    startBridge();
    refreshBridgeRegistration();
    startOffice();
    refreshWordRegistration();
    refreshOutlookManifest();
    scheduleUpdateChecks();
    // PowerShell compile son aide au démarrage : le premier raccourci sera immédiat.
    input.warmUp();
    createWindow();
    if (!STARTED_HIDDEN) {
        mainWindow.once("ready-to-show", showWindow);
    }
    // Le français se charge en arrière-plan : le premier appel au raccourci sera immédiat.
    setTimeout(() => aria.check({ text: "Bonjour.", lang: "fr" }).catch(() => {}), 1500);
});
