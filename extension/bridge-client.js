// Aria Plume — pont avec l'application Aria Plume (messagerie native).
//
// Quand l'application est installée et connectée (Réglages de l'application → Connecter les
// navigateurs), l'extension lui confie l'analyse, la traduction, la conjugaison et les synonymes,
// et partage ses réglages avec elle. Sinon, ou si l'application ne répond pas, tout se fait ici,
// avec le moteur de l'extension, comme avant.
//
// Le relais lancé par le navigateur démarre l'application cachée si elle est fermée. Pendant ce
// temps (et tant que la connexion n'est pas prête), les demandes passent par le moteur de
// l'extension : la première correction n'attend jamais l'application.

import { NATIVE_HOST } from "./core/shared/ids.js";
import { DEFAULTS } from "./core/shared/settings.js";

// Application absente (pas inscrite, pas installée) : un nouvel essai au plus une fois par minute.
const RETRY_ABSENT_MS = 60_000;

// Erreur de transport (déconnexion, délai dépassé, pas prête) : l'appelant se replie sur le moteur
// de l'extension. Une erreur renvoyée par l'application elle-même est une Error ordinaire.
export class BridgeError extends Error {}

export function createBridge({ onReady = () => {}, onSettingsChanged = () => {} } = {}) {
    let port = null;
    let state = "off";          // off | connecting | ready | absent
    let version = null;
    let lastError = null;
    let lastFailure = 0;
    let nextId = 1;
    const pending = new Map();

    function failPending(message) {
        for (const { reject, timer } of pending.values()) {
            clearTimeout(timer);
            reject(new BridgeError(message));
        }
        pending.clear();
    }

    function onMessage(message) {
        if (message?.event === "ready") {
            state = "ready";
            version = message.version ?? null;
            lastError = null;
            Promise.resolve().then(onReady).catch((error) => console.warn("Aria Plume : synchronisation des réglages", error));
            return;
        }
        if (message?.event === "unavailable") {
            lastError = message.error ?? "L'application ne répond pas.";
            return;
        }
        if (message?.event === "settings-changed") {
            onSettingsChanged(message.changes ?? {});
            return;
        }
        const waiting = pending.get(message?.id);
        if (!waiting) {
            return;
        }
        pending.delete(message.id);
        clearTimeout(waiting.timer);
        const { id, ok, error, ...rest } = message;
        if (ok) {
            waiting.resolve(rest);
        } else {
            waiting.reject(new Error(error ?? "Erreur de l'application."));
        }
    }

    function connect() {
        if (port || !chrome.runtime.connectNative) {
            return;
        }
        if (state === "absent" && Date.now() - lastFailure < RETRY_ABSENT_MS) {
            return;
        }
        state = "connecting";
        try {
            port = chrome.runtime.connectNative(NATIVE_HOST);
        } catch (error) {
            port = null;
            state = "absent";
            lastError = String(error?.message ?? error);
            lastFailure = Date.now();
            return;
        }
        port.onMessage.addListener(onMessage);
        port.onDisconnect.addListener(() => {
            // Lire lastError évite l'avertissement « Unchecked runtime.lastError » (application absente).
            const reason = chrome.runtime.lastError?.message ?? null;
            const wasReady = state === "ready";
            port = null;
            // Application quittée : la prochaine demande la relancera. Jamais connectée : absente.
            state = wasReady ? "off" : "absent";
            if (!wasReady) {
                lastError = lastError ?? reason ?? "Application injoignable.";
                lastFailure = Date.now();
            }
            failPending(reason ?? "Application déconnectée.");
        });
    }

    function request(cmd, payload = {}, timeoutMs = 20000) {
        if (state !== "ready" || !port) {
            return Promise.reject(new BridgeError("Application non connectée."));
        }
        const id = nextId++;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                pending.delete(id);
                reject(new BridgeError("L'application met trop de temps à répondre."));
            }, timeoutMs);
            pending.set(id, { resolve, reject, timer });
            try {
                port.postMessage({ ...payload, id, cmd });
            } catch (error) {
                pending.delete(id);
                clearTimeout(timer);
                reject(new BridgeError(String(error?.message ?? error)));
            }
        });
    }

    return {
        connect,
        request,
        isReady: () => state === "ready",
        status: () => ({ state, version, error: state === "ready" ? null : lastError }),
    };
}

// --- Réglages partagés ---
// Une copie des réglages de l'application est tenue dans chrome.storage.local : les pages de
// l'extension (script de page, popup, réglages) continuent de lire leur stockage habituel.
//   - connexion : envoi de ce qui a changé ici pendant la déconnexion, puis copie des réglages
//     de l'application. La toute première fois, fusion : les listes (dictionnaire, glossaire,
//     termes gardés, mots ignorés, sites exclus) sont réunies, et un réglage laissé par défaut
//     dans l'application prend la valeur choisie dans l'extension ;
//   - changement ici → envoyé à l'application ; changement dans l'application → recopié ici.
const EXTRA_DEFAULTS = { mistakeStats: {}, mistakeStatsSince: null };
const ALL_DEFAULTS = { ...DEFAULTS, ...EXTRA_DEFAULTS };
export const SHARED_KEYS = Object.keys(ALL_DEFAULTS);
const SHARED = new Set(SHARED_KEYS);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Réunion de deux listes, sans doublons (clé : la valeur, ou keyOf(élément)).
function union(first, second, keyOf = (item) => item) {
    const seen = new Set();
    const out = [];
    for (const item of [...(Array.isArray(first) ? first : []), ...(Array.isArray(second) ? second : [])]) {
        const key = typeof item === "string" ? item : JSON.stringify(keyOf(item));
        if (!seen.has(key)) {
            seen.add(key);
            out.push(item);
        }
    }
    return out;
}
const MERGED_LISTS = {
    dictionary: (item) => item,
    keepTerms: (item) => item,
    disabledHosts: (item) => item,
    glossary: (item) => [item?.fr, item?.en],
    ignored: (item) => [item?.word, item?.rule],
};

// Première connexion : ce qu'il faut envoyer à l'application pour réunir les deux côtés.
export function firstMerge(local, app) {
    const out = {};
    for (const key of SHARED_KEYS) {
        if (!(key in local)) {
            continue;
        }
        let value;
        if (MERGED_LISTS[key]) {
            value = union(app[key], local[key], MERGED_LISTS[key]);
        } else if (same(app[key], ALL_DEFAULTS[key])) {
            value = local[key];
        } else {
            continue;
        }
        if (!same(value, app[key])) {
            out[key] = value;
        }
    }
    return out;
}

export function createSettingsSync(bridge) {
    // Dernières valeurs connues de l'application (null tant que la synchronisation n'est pas faite).
    let mirror = null;
    let syncing = null;

    async function rememberPending(keys) {
        const { bridgeSynced, bridgePending } = await chrome.storage.local.get({ bridgeSynced: false, bridgePending: [] });
        if (bridgeSynced) {
            await chrome.storage.local.set({ bridgePending: union(bridgePending, keys) });
        }
    }

    async function syncNow() {
        mirror = null;
        const flags = await chrome.storage.local.get({ bridgeSynced: false, bridgePending: [] });
        const local = await chrome.storage.local.get(SHARED_KEYS);
        const { values: app } = await bridge.request("settings-get", { spec: null });
        const toApp = flags.bridgeSynced
            ? Object.fromEntries(flags.bridgePending.filter((key) => SHARED.has(key) && key in local).map((key) => [key, local[key]]))
            : firstMerge(local, app);
        let final = app;
        if (Object.keys(toApp).length) {
            await bridge.request("settings-set", { values: toApp });
            final = (await bridge.request("settings-get", { spec: null })).values;
        }
        mirror = Object.fromEntries(SHARED_KEYS.filter((key) => key in final).map((key) => [key, final[key]]));
        // La copie est posée après « mirror » : son écho dans onChanged est reconnu et ignoré.
        await chrome.storage.local.set({ ...mirror, bridgeSynced: true, bridgePending: [] });
    }

    return {
        // À la connexion (événement « ready »).
        sync() {
            syncing = syncNow().finally(() => {
                syncing = null;
            });
            return syncing;
        },
        // Réglages changés dans l'application.
        fromApp(changes) {
            if (!mirror) {
                return;
            }
            const values = {};
            for (const [key, change] of Object.entries(changes)) {
                if (SHARED.has(key) && change && "newValue" in change) {
                    mirror[key] = change.newValue;
                    values[key] = change.newValue;
                }
            }
            if (Object.keys(values).length) {
                chrome.storage.local.set(values).catch(() => {});
            }
        },
        // Réglages changés dans l'extension (chrome.storage.onChanged).
        async fromExtension(changes) {
            const keys = Object.keys(changes).filter((key) => SHARED.has(key) && !(mirror && same(changes[key].newValue, mirror[key])));
            if (!keys.length) {
                return;
            }
            if (!bridge.isReady() || !mirror || syncing) {
                await rememberPending(keys);
                return;
            }
            const values = {};
            const removed = [];
            for (const key of keys) {
                if (changes[key].newValue === undefined) {
                    removed.push(key);
                } else {
                    values[key] = changes[key].newValue;
                }
                mirror[key] = changes[key].newValue;
            }
            try {
                if (Object.keys(values).length) {
                    await bridge.request("settings-set", { values });
                }
                if (removed.length) {
                    await bridge.request("settings-remove", { keys: removed });
                }
            } catch {
                await rememberPending(keys);
            }
        },
        synced: () => !!mirror,
    };
}
