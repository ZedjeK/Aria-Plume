// Aria Plume (application) — pont entre la fenêtre et le processus principal.
// La fenêtre n'a pas accès à Node : elle ne voit que window.aria, et chaque appel
// passe par une liste de méthodes autorisées côté processus principal.

const { contextBridge, ipcRenderer } = require("electron");

const call = (method, args) => ipcRenderer.invoke("aria", method, args);

contextBridge.exposeInMainWorld("aria", {
    check: (args) => call("check", args),
    translate: (args) => call("translate", args),
    conjugate: (args) => call("conjugate", args),
    synonyms: (args) => call("synonyms", args),
    info: () => call("info"),
    getSettings: () => ipcRenderer.invoke("settings:get"),
    setSettings: (changes) => ipcRenderer.invoke("settings:set", changes),
    version: () => ipcRenderer.invoke("app:version"),
});

// Banc automatique seulement (les gestionnaires n'existent que si ARIA_TEST_HOOKS=1).
contextBridge.exposeInMainWorld("ariaTest", {
    state: () => ipcRenderer.invoke("test:state"),
    quit: () => ipcRenderer.invoke("test:quit"),
    close: () => ipcRenderer.invoke("test:close"),
    show: () => ipcRenderer.invoke("test:show"),
});
