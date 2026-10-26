// Aria Plume (application) — pont entre la fenêtre et le processus principal.
// La fenêtre affiche le correcteur de l'extension (popup.html et le script de page) : on lui
// donne donc les quelques API « chrome » dont il se sert, branchées sur le processus principal.
//   - chrome.runtime.sendMessage   → le service du moteur Aria (vérifier, traduire, conjuguer…)
//   - chrome.storage.local         → le fichier de réglages portable
//   - chrome.storage.session       → en mémoire, le temps de la session
// La fenêtre n'a pas accès à Node, et le processus principal filtre chaque demande.

const { contextBridge, ipcRenderer } = require("electron");

const RUNTIME_ID = "aria-plume-app";
const storageListeners = new Set();
const messageListeners = new Set();
const sessionStore = new Map();

ipcRenderer.on("storage-changed", (event, changes) => {
    for (const listener of storageListeners) {
        try {
            listener(changes, "local");
        } catch (error) {
            console.error(error);
        }
    }
});

// Messages du processus principal vers la page (raccourci global, étape 2.3).
ipcRenderer.on("content-message", (event, { id, msg }) => {
    let answered = false;
    const sendResponse = (response) => {
        if (!answered) {
            answered = true;
            ipcRenderer.send("content-response", { id, response });
        }
    };
    for (const listener of messageListeners) {
        listener(msg, { id: RUNTIME_ID }, sendResponse);
    }
    setTimeout(() => sendResponse(undefined), 0);
});

function sessionGet(spec) {
    if (spec === null || spec === undefined) {
        return Object.fromEntries(sessionStore);
    }
    const keys = typeof spec === "string" ? [spec] : spec;
    if (Array.isArray(keys)) {
        return Object.fromEntries(keys.filter((key) => sessionStore.has(key)).map((key) => [key, sessionStore.get(key)]));
    }
    return Object.fromEntries(Object.entries(keys).map(([key, fallback]) => [key, sessionStore.has(key) ? sessionStore.get(key) : fallback]));
}

// Rien ne doit être renvoyé à la page qui ne passe pas le pont (un Set de fonctions, par exemple).
const event = (listeners) => ({
    addListener: (listener) => {
        listeners.add(listener);
    },
    removeListener: (listener) => {
        listeners.delete(listener);
    },
    hasListener: (listener) => listeners.has(listener),
});

// Chromium définit déjà window.chrome : le pont est exposé sous un autre nom, et ui/chrome.js
// le pose à la place de window.chrome avant les scripts du correcteur.
contextBridge.exposeInMainWorld("ariaChrome", {
    runtime: {
        id: RUNTIME_ID,
        getURL: (path) => `aria://app/${String(path).replace(/^\/+/, "")}`,
        sendMessage: (msg) => ipcRenderer.invoke("sw", msg),
        openOptionsPage: () => ipcRenderer.invoke("app:options"),
        onMessage: event(messageListeners),
    },
    storage: {
        local: {
            get: (spec) => ipcRenderer.invoke("storage:get", spec),
            set: (values) => ipcRenderer.invoke("storage:set", values),
        },
        session: {
            get: async (spec) => sessionGet(spec),
            set: async (values) => {
                for (const [key, value] of Object.entries(values ?? {})) {
                    sessionStore.set(key, value);
                }
            },
        },
        onChanged: event(storageListeners),
    },
});

contextBridge.exposeInMainWorld("ariaApp", {
    version: () => ipcRenderer.invoke("app:version"),
    info: () => ipcRenderer.invoke("app:info"),
});

// Banc automatique seulement (les gestionnaires n'existent que si ARIA_TEST_HOOKS=1).
contextBridge.exposeInMainWorld("ariaTest", {
    state: () => ipcRenderer.invoke("test:state"),
    quit: () => ipcRenderer.invoke("test:quit"),
    close: () => ipcRenderer.invoke("test:close"),
    show: () => ipcRenderer.invoke("test:show"),
    serve: (url) => ipcRenderer.invoke("test:serve", url),
});
