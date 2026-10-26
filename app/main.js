// Aria Plume (application) — processus principal.
// Une seule instance, une icône près de l'horloge, une fenêtre de correction qui se cache
// au lieu de se fermer. Le moteur Aria tourne ici même (engine.js), sans fenêtre cachée.
// La fenêtre affiche le correcteur de l'extension (popup.html), servi par le protocole aria:.

import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, protocol, shell } from "electron";
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
const { loadSettings, saveSettings, settingsFile, getValues } = await import("./settings.js");

// --- Réglages : enregistrés dans le fichier, et signalés aux fenêtres ouvertes ---
function updateSettings(changes) {
    const diff = saveSettings(changes ?? {});
    if (Object.keys(diff).length) {
        for (const win of BrowserWindow.getAllWindows()) {
            win.webContents.send("storage-changed", diff);
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
    { prefix: "content/", root: path.join(ENGINE_ROOT, "content") },
    { prefix: "icons/", root: path.join(ENGINE_ROOT, "icons") },
    { prefix: "core/shared/", root: path.join(ENGINE_ROOT, "core", "shared") },
];
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };
const CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'";
const WINDOW_URL = "aria://app/popup/popup.html";

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
    // La page du correcteur reçoit les retouches de l'application (mise en page, éléments propres au navigateur masqués).
    if (relative === "popup/popup.html") {
        body = body.toString("utf8").replace("<head>", '<head>\n    <script src="/app/chrome.js"></script>').replace("</head>", '    <link rel="stylesheet" href="/app/app.css">\n</head>');
    }
    return new Response(body, { headers: { "content-type": type, "content-security-policy": CSP } });
}

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
};

let tray = null;
let mainWindow = null;
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
        { type: "separator" },
    ];
    if (process.platform === "win32") {
        template.push({
            label: "Démarrer avec Windows",
            type: "checkbox",
            checked: settings.startWithWindows,
            click: (item) => {
                updateSettings({ startWithWindows: item.checked });
                applyStartWithWindows(item.checked);
            },
        });
    }
    template.push(
        { label: "Ouvrir le fichier de réglages", click: () => shell.showItemInFolder(settingsFile()) },
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
ipcMain.handle("app:options", () => shell.showItemInFolder(settingsFile()));
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
    ipcMain.handle("test:show", () => {
        showWindow();
    });
}

app.on("second-instance", showWindow);
app.on("before-quit", () => {
    quitting = true;
});
app.on("will-quit", () => {
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
    createWindow();
    if (!STARTED_HIDDEN) {
        mainWindow.once("ready-to-show", showWindow);
    }
    // Le français se charge en arrière-plan : le premier appel au raccourci sera immédiat.
    setTimeout(() => aria.check({ text: "Bonjour.", lang: "fr" }).catch(() => {}), 1500);
});
