// Aria Plume (application) — processus principal.
// Une seule instance, une icône près de l'horloge, une fenêtre de correction qui se cache
// au lieu de se fermer. Le moteur Aria tourne ici même (engine.js), sans fenêtre cachée.
// La fenêtre affiche le correcteur de l'extension (popup.html), servi par le protocole aria:.

import { app, BrowserWindow, Menu, Tray, clipboard, dialog, globalShortcut, ipcMain, nativeImage, protocol, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
const { loadSettings, saveSettings, removeSettings, settingsFile, getValues } = await import("./settings.js");
const { createInput, captureSelection, pasteInto } = await import("./windows-input.js");

// --- Réglages : enregistrés dans le fichier, et signalés aux fenêtres ouvertes ---
function updateSettings(changes) {
    return announceChanges(saveSettings(changes ?? {}));
}

function announceChanges(diff) {
    if (Object.keys(diff).length) {
        for (const win of BrowserWindow.getAllWindows()) {
            win.webContents.send("storage-changed", diff);
        }
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
    ipcMain.handle("test:show", () => {
        showWindow();
    });
}

app.on("second-instance", showWindow);
app.on("before-quit", () => {
    quitting = true;
});
app.on("will-quit", () => {
    globalShortcut.unregisterAll();
    input.stop();
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
    // PowerShell compile son aide au démarrage : le premier raccourci sera immédiat.
    input.warmUp();
    createWindow();
    if (!STARTED_HIDDEN) {
        mainWindow.once("ready-to-show", showWindow);
    }
    // Le français se charge en arrière-plan : le premier appel au raccourci sera immédiat.
    setTimeout(() => aria.check({ text: "Bonjour.", lang: "fr" }).catch(() => {}), 1500);
});
