// Aria Plume (application) — processus principal.
// Une seule instance, une icône près de l'horloge, une fenêtre de correction qui se cache
// au lieu de se fermer. Le moteur Aria tourne ici même (engine.js), sans fenêtre cachée.

import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const ICON_DIR = path.join(APP_DIR, "build");
const STARTED_HIDDEN = process.argv.includes("--hidden");

if (!app.requestSingleInstanceLock()) {
    app.quit();
    process.exit(0);
}

// Le moteur (et les réglages, qui en dépendent) ne se charge qu'une fois l'instance confirmée.
const { aria, ENGINE_METHODS } = await import("./engine.js");
const { loadSettings, saveSettings, settingsFile } = await import("./settings.js");

let tray = null;
let mainWindow = null;
let quitting = false;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 760,
        height: 640,
        minWidth: 420,
        minHeight: 360,
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
    mainWindow.loadFile(path.join(APP_DIR, "ui", "index.html"));
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
                saveSettings({ startWithWindows: item.checked });
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

ipcMain.handle("aria", async (event, method, args) => {
    const run = ENGINE_METHODS[method];
    if (!run) {
        throw new Error(`Méthode inconnue : ${method}`);
    }
    return run(args ?? {});
});
ipcMain.handle("settings:get", () => loadSettings());
ipcMain.handle("settings:set", (event, changes) => {
    const saved = saveSettings(changes ?? {});
    tray?.setContextMenu(buildTrayMenu());
    return saved;
});
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
    Menu.setApplicationMenu(null);
    createTray();
    createWindow();
    if (!STARTED_HIDDEN) {
        mainWindow.once("ready-to-show", showWindow);
    }
    // Le français se charge en arrière-plan : le premier appel au raccourci sera immédiat.
    setTimeout(() => aria.check({ text: "Bonjour.", lang: "fr" }).catch(() => {}), 1500);
});
