// Aria Plume — service worker
// Rôle : router les demandes des pages vers le moteur : celui de l'application Aria Plume quand
// elle est connectée (messagerie native, voir bridge-client.js), sinon le document offscreen.
// Aucun accès réseau : la CSP de l'extension limite connect-src à 'self'.
// Les pages ne sont que lues localement par le script de contenu ; rien n'est envoyé à l'extérieur.

import { createService } from "./core/service.js";
import { BridgeError, createBridge, createSettingsSync } from "./bridge-client.js";

const OFFSCREEN_PATH = "offscreen/offscreen.html";
const CONTENT_SCRIPT = "content/checker.js";
const MENUS = [
    { id: "aria-odl-check", title: "Vérifier avec Aria Plume", contexts: ["editable", "selection"], cmd: "open-panel" },
    { id: "aria-odl-translate", title: "Traduire avec Aria Plume", contexts: ["editable", "selection"], cmd: "translate-selection" },
    { id: "aria-odl-synonyms", title: "Synonymes avec Aria Plume", contexts: ["editable", "selection"], cmd: "synonyms" },
    { id: "aria-odl-translate-page", title: "Traduire la page avec Aria Plume", contexts: ["page"], cmd: "translate-page" },
];
const COMMANDS = { "check-text": "open-panel", "translate-text": "translate-selection" };
let creating = null;

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
        for (const { id, title, contexts } of MENUS) {
            chrome.contextMenus.create({ id, title, contexts });
        }
    });
});

async function flagError(tabId, error) {
    console.warn("Aria Plume : action impossible sur cette page", error);
    try {
        await chrome.action.setBadgeBackgroundColor({ tabId, color: "#ff4fd8" });
        await chrome.action.setBadgeText({ tabId, text: "!" });
        await chrome.action.setTitle({ tabId, title: `Aria Plume : action impossible sur cette page (${error?.message ?? error})` });
        setTimeout(() => {
            chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
            chrome.action.setTitle({ tabId, title: "Aria Plume" }).catch(() => {});
        }, 5000);
    } catch {
        // onglet fermé entre-temps
    }
}

// Envoie une commande au script de page du cadre visé. S'il est absent (onglet ouvert
// avant l'installation ou la mise à jour de l'extension), on l'injecte d'abord.
async function sendToContent(tabId, frameId, cmd) {
    const message = { target: "content", cmd };
    try {
        await chrome.tabs.sendMessage(tabId, message, { frameId });
        return;
    } catch {
        // pas de script à l'écoute dans ce cadre
    }
    try {
        await chrome.scripting.executeScript({
            target: { tabId, frameIds: [frameId] },
            func: () => {
                globalThis.__ariaOdlForce = true;
            },
        });
        await chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, files: [CONTENT_SCRIPT] });
        await chrome.tabs.sendMessage(tabId, message, { frameId });
    } catch (error) {
        await flagError(tabId, error);
    }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
    const menu = MENUS.find((m) => m.id === info.menuItemId);
    if (menu && tab?.id >= 0) {
        // La page entière se traduit depuis le cadre principal.
        sendToContent(tab.id, menu.cmd === "translate-page" ? 0 : (info.frameId ?? 0), menu.cmd);
    }
});

chrome.commands.onCommand.addListener(async (command, tab) => {
    const cmd = COMMANDS[command];
    if (!cmd) {
        return;
    }
    const target = tab ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
    if (target?.id >= 0) {
        sendToContent(target.id, 0, cmd);
    }
});

// Points d'entrée exposés pour les tests automatisés.
globalThis.ariaOdl = {
    openPanel: (tabId, frameId = 0) => sendToContent(tabId, frameId, "open-panel"),
    sendToContent,
};

async function hasOffscreen() {
    const url = chrome.runtime.getURL(OFFSCREEN_PATH);
    if (chrome.runtime.getContexts) {
        const contexts = await chrome.runtime.getContexts({
            contextTypes: ["OFFSCREEN_DOCUMENT"],
            documentUrls: [url],
        });
        return contexts.length > 0;
    }
    const clientList = await self.clients.matchAll();
    return clientList.some((client) => client.url === url);
}

async function ensureOffscreen() {
    if (!chrome.offscreen) {
        throw new Error("API chrome.offscreen indisponible dans ce navigateur");
    }
    // Document en cours de création (appel simultané) : il existe déjà pour getContexts,
    // mais ne reçoit pas encore les messages. On attend la fin de la création.
    if (creating) {
        await creating;
        return false;
    }
    if (await hasOffscreen()) {
        return false;
    }
    if (!creating) {
        creating = chrome.offscreen
            .createDocument({
                url: OFFSCREEN_PATH,
                reasons: [chrome.offscreen.Reason.WORKERS],
                justification: "Exécuter localement les moteurs de correction et de traduction (WebAssembly).",
            })
            .finally(() => {
                creating = null;
            });
    }
    await creating;
    return true;
}

async function toOffscreen(payload) {
    let response;
    try {
        response = await chrome.runtime.sendMessage({ target: "offscreen", ...payload });
    } catch (error) {
        // Document tout juste chargé dont l'écouteur n'est pas encore en place : un seul nouvel essai.
        if (!/Receiving end does not exist/.test(String(error?.message))) {
            throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
        response = await chrome.runtime.sendMessage({ target: "offscreen", ...payload });
    }
    if (!response) {
        throw new Error("Aucune réponse du document offscreen");
    }
    if (!response.ok) {
        throw new Error(response.error);
    }
    return response;
}

function browserDetect(text) {
    if (!chrome.i18n?.detectLanguage) {
        return Promise.resolve({ isReliable: false, languages: [] });
    }
    return new Promise((resolve) => chrome.i18n.detectLanguage(text, (result) => resolve(result ?? { isReliable: false, languages: [] })));
}

// Moteur de l'extension : il vit dans le document offscreen, créé à la première demande.
async function viaOffscreen(payload) {
    const offscreenCreated = await ensureOffscreen();
    const { ok, ...result } = await toOffscreen(payload);
    return { ...result, offscreenCreated, engine: "extension" };
}

// Pont avec l'application. Les réglages sont partagés dès que la connexion est prête.
const settingsSync = createSettingsSync({
    request: (...args) => bridge.request(...args),
    isReady: () => bridge.isReady(),
});
const bridge = createBridge({
    onReady: () => settingsSync.sync(),
    onSettingsChanged: (changes) => settingsSync.fromApp(changes),
});
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
        settingsSync.fromExtension(changes).catch(() => {});
    }
});

// Délais au-delà desquels le moteur de l'extension prend le relais.
const BRIDGE_TIMEOUTS = { check: 20000, translate: 120000, conjugate: 20000, synonyms: 20000 };

// L'application si elle est prête (sa connexion est lancée au passage), sinon l'extension.
// Une erreur de transport (application quittée, trop lente) se rattrape ici ; une erreur
// renvoyée par l'application elle-même est transmise telle quelle.
function routed(name) {
    return async (args) => {
        bridge.connect();
        if (bridge.isReady()) {
            try {
                return { ...(await bridge.request(`engine-${name}`, args, BRIDGE_TIMEOUTS[name])), engine: "application" };
            } catch (error) {
                if (!(error instanceof BridgeError)) {
                    throw error;
                }
            }
        }
        return viaOffscreen({ cmd: name, ...args });
    };
}

const routedAria = {
    check: routed("check"),
    translate: routed("translate"),
    conjugate: routed("conjugate"),
    synonyms: routed("synonyms"),
    // Une traduction de page a pu partir d'un côté ou de l'autre : on annule des deux.
    cancelTranslation: async (jobId) => {
        if (bridge.isReady()) {
            await bridge.request("engine-cancel", { jobId }, 5000).catch(() => {});
        }
        if (chrome.offscreen && await hasOffscreen()) {
            await toOffscreen({ cmd: "translate-cancel", jobId });
        }
    },
};

const service = createService({
    aria: routedAria,
    getSettings: (defaults) => chrome.storage.local.get(defaults),
    saveValues: (values) => chrome.storage.local.set(values),
    detectNative: browserDetect,
});

// Site de l'onglet d'où vient l'analyse (cadre principal, même pour un éditeur dans une iframe).
function senderHost(sender) {
    try {
        return new URL(sender?.tab?.url ?? "").hostname;
    } catch {
        return "";
    }
}

async function handle(msg, sender) {
    switch (msg.cmd) {
        case "env":
            return {
                offscreen: !!chrome.offscreen,
                getContexts: !!chrome.runtime.getContexts,
                detectLanguage: !!chrome.i18n?.detectLanguage,
                offscreenActive: chrome.offscreen ? await hasOffscreen() : false,
            };
        case "check":
            return service.check({ text: msg.text, lang: msg.lang, host: senderHost(sender) });
        case "detect":
            return service.detectLanguage(msg.text);
        case "translate":
            return service.translate({ ...msg, host: senderHost(sender) });
        case "synonyms":
            return service.synonyms(msg);
        case "exchange": {
            // Aller-retour du correcteur de la popup : « grab-text » ou « put-text » dans l'onglet.
            if (!["grab-text", "put-text"].includes(msg.op) || !Number.isInteger(msg.tabId)) {
                throw new Error("Demande invalide.");
            }
            try {
                const response = await chrome.tabs.sendMessage(msg.tabId, { target: "content", cmd: msg.op, text: msg.text });
                if (!response) {
                    throw new Error("no response");
                }
                return response;
            } catch {
                throw new Error(msg.op === "grab-text"
                    ? "Rien à récupérer : sélectionne du texte ou place le curseur dans un champ de la page (recharge la page si elle était ouverte avant l'extension)."
                    : "Impossible de renvoyer le texte : la page a peut-être été rechargée.");
            }
        }
        case "record-mistakes":
            await service.recordMistakes(msg.items);
            return {};
        case "conjugate":
            return service.conjugate(msg);
        case "translate-cancel":
            await routedAria.cancelTranslation(msg.jobId);
            return {};
        // État de la connexion avec l'application (popup) ; lance la connexion au passage.
        case "bridge-status":
            bridge.connect();
            return { ...bridge.status(), synced: settingsSync.synced() };
        case "open-panel":
        case "translate-page":
            await sendToContent(msg.tabId, 0, msg.cmd);
            return {};
        case "unload":
            if (chrome.offscreen && await hasOffscreen()) {
                await chrome.offscreen.closeDocument();
            }
            return {};
        default:
            throw new Error(`Commande inconnue : ${msg.cmd}`);
    }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.target !== "sw" || sender.id !== chrome.runtime.id) {
        return false;
    }
    handle(msg, sender).then(
        (result) => sendResponse({ ok: true, ...result }),
        (error) => sendResponse({ ok: false, error: String(error?.message ?? error) }),
    );
    return true;
});
