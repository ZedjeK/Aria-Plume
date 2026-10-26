// Aria Plume — plateforme « navigateur » du moteur Aria (extension, et plus tard la fenêtre
// cachée de l'application). Ce que le moteur demande à son environnement :
//   - name                       nom de la plateforme
//   - readFile(url)              contenu brut d'un fichier → ArrayBuffer
//   - createWorker(url, opts)    lance un worker → { post, onMessage, onError, terminate }
//   - importModule(url)          import dynamique d'un module

export const browserPlatform = {
    name: "browser",

    async readFile(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Fichier introuvable : ${url} (${response.status})`);
        }
        return response.arrayBuffer();
    },

    createWorker(url, { type } = {}) {
        const worker = new Worker(url, type ? { type } : undefined);
        return {
            post: (message) => worker.postMessage(message),
            onMessage: (callback) => {
                worker.onmessage = (event) => callback(event.data);
            },
            onError: (callback) => {
                worker.onerror = (event) => callback(new Error(event.message || "chargement impossible"));
            },
            terminate: () => worker.terminate(),
        };
    },

    importModule(url) {
        return import(url);
    },
};
