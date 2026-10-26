// Aria Plume — document offscreen
// Fait tourner le moteur Aria (core/) dans le navigateur et relaie les messages
// du service worker. Toute la logique des moteurs est dans core/index.js.

import { createAria } from "../core/index.js";
import { browserPlatform } from "../core/platform/browser.js";

const aria = createAria(browserPlatform);

async function handle(msg) {
    switch (msg.cmd) {
        case "check":
            return { ok: true, ...(await aria.check(msg)) };
        case "translate":
            return { ok: true, ...(await aria.translate(msg)) };
        case "translate-cancel":
            await aria.cancelTranslation(msg.jobId);
            return { ok: true };
        case "conjugate":
            return { ok: true, ...(await aria.conjugate(msg)) };
        case "synonyms":
            return { ok: true, ...(await aria.synonyms(msg)) };
        case "info":
            return { ok: true, ...aria.info() };
        default:
            throw new Error(`Commande inconnue : ${msg.cmd}`);
    }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.target !== "offscreen" || sender.id !== chrome.runtime.id) {
        return false;
    }
    handle(msg).then(sendResponse, (error) => sendResponse({ ok: false, error: String(error?.message ?? error) }));
    return true;
});
