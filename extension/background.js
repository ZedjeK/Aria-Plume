// Aria ODL — service worker
// Rôle : router les demandes des pages vers le document offscreen, qui héberge les moteurs.
// Aucun accès réseau : la CSP de l'extension limite connect-src à 'self'.
// Les pages ne sont que lues localement par le script de contenu ; rien n'est envoyé à l'extérieur.

const OFFSCREEN_PATH = "offscreen/offscreen.html";
const CONTENT_SCRIPT = "content/checker.js";
const MENUS = [
    { id: "aria-odl-check", title: "Vérifier avec Aria ODL", contexts: ["editable", "selection"], cmd: "open-panel" },
    { id: "aria-odl-translate", title: "Traduire avec Aria ODL", contexts: ["editable", "selection"], cmd: "translate-selection" },
    { id: "aria-odl-translate-page", title: "Traduire la page avec Aria ODL", contexts: ["page"], cmd: "translate-page" },
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
    console.warn("Aria ODL : action impossible sur cette page", error);
    try {
        await chrome.action.setBadgeBackgroundColor({ tabId, color: "#ff4fd8" });
        await chrome.action.setBadgeText({ tabId, text: "!" });
        await chrome.action.setTitle({ tabId, title: `Aria ODL : action impossible sur cette page (${error?.message ?? error})` });
        setTimeout(() => {
            chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
            chrome.action.setTitle({ tabId, title: "Aria ODL" }).catch(() => {});
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

// Détection de langue. Le détecteur du navigateur se trompe souvent sur les textes courts
// (« Please restart the backup service tonight. » → finnois, « Hello » → serbe). Comme seuls
// le français et l'anglais nous intéressent, on le complète par un comptage de mots-outils.
const FR_WORDS = new Set(("le la les un une des du de et est sont pas ne que qui quoi je tu il elle nous vous ils elles "
    + "ce cette ces mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs pour dans sur avec mais ou donc car au aux "
    + "y été être avoir fait très bien merci bonjour salut oui non l d j qu n c m peux veux faut aussi plus moins comme").split(" "));
const EN_WORDS = new Set(("the an and is are was were be been being not that which who what i you he she it we they this these "
    + "those my your his her its our their for in with but or so to of at by from have has had do does did will would can could "
    + "should please thanks thank hello hi yes no don isn aren won can't there here just also more less like").split(" "));

function guessFrenchOrEnglish(text) {
    const words = text.toLowerCase().split(/[^a-zà-ÿœæ]+/u).filter(Boolean);
    let fr = 0;
    let en = 0;
    for (const word of words) {
        if (FR_WORDS.has(word)) {
            fr++;
        }
        if (EN_WORDS.has(word)) {
            en++;
        }
    }
    fr += Math.min(3, (text.match(/[éèêàçùûôîœ]/giu) ?? []).length * 0.5);
    if (fr === en) {
        return null;
    }
    return fr > en ? "fr" : "en";
}

function browserDetect(text) {
    if (!chrome.i18n?.detectLanguage) {
        return Promise.resolve({ isReliable: false, languages: [] });
    }
    return new Promise((resolve) => chrome.i18n.detectLanguage(text, (result) => resolve(result ?? { isReliable: false, languages: [] })));
}

async function detectLanguage(text) {
    const result = await browserDetect(text);
    const languages = result.languages ?? [];
    const best = languages
        .filter((l) => ["fr", "en"].includes(l.language.slice(0, 2)))
        .sort((a, b) => b.percentage - a.percentage)[0];
    const bestLang = best?.language.slice(0, 2) ?? null;
    if (bestLang && result.isReliable) {
        return { lang: bestLang, supported: true, reliable: true, source: "chrome.i18n", raw: languages };
    }
    const guess = guessFrenchOrEnglish(text);
    if (guess) {
        return { lang: guess, supported: true, reliable: false, source: "mots-outils", raw: languages };
    }
    // Rien de concluant : on prend l'avis du navigateur s'il penche pour le français ou l'anglais,
    // sauf s'il est sûr de lui pour une autre langue.
    const otherReliable = result.isReliable && languages.length > 0;
    if (bestLang && !otherReliable) {
        return { lang: bestLang, supported: true, reliable: false, source: "chrome.i18n (peu fiable)", raw: languages };
    }
    return { lang: "fr", supported: false, reliable: false, source: "langue non reconnue", raw: languages };
}

// Distance d'édition avec transposition (« sytemd » → « systemd » : une seule faute de frappe).
function editDistance(a, b, limit) {
    if (Math.abs(a.length - b.length) > limit) {
        return limit + 1;
    }
    const rows = [Array.from({ length: b.length + 1 }, (_, j) => j)];
    for (let i = 1; i <= a.length; i++) {
        rows[i] = [i];
        let best = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            let value = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                value = Math.min(value, rows[i - 2][j - 2] + 1);
            }
            rows[i][j] = value;
            best = Math.min(best, value);
        }
        if (best > limit) {
            return limit + 1;
        }
    }
    return rows[a.length][b.length];
}

// Fautes d'orthographe proches d'un mot du dictionnaire personnel : ce mot passe en tête des suggestions.
function suggestFromDictionary(matches, text, dictionary) {
    if (!Array.isArray(matches) || !Array.isArray(dictionary) || dictionary.length === 0) {
        return;
    }
    for (const match of matches) {
        if (match.kind !== "orthographe") {
            continue;
        }
        const word = text.slice(match.start, match.end).trim();
        if (word.length < 3) {
            continue;
        }
        const limit = word.length <= 5 ? 1 : 2;
        const close = dictionary
            .map((entry) => ({ entry, d: editDistance(word.toLowerCase(), entry.toLowerCase(), limit) }))
            .filter((x) => x.d <= limit && x.d > 0)
            .sort((x, y) => x.d - y.d)
            .slice(0, 3)
            .map((x) => x.entry);
        if (close.length > 0) {
            match.suggestions = [...new Set([...close, ...match.suggestions])].slice(0, 6);
        }
    }
}

async function toOffscreen(payload) {
    const response = await chrome.runtime.sendMessage({ target: "offscreen", ...payload });
    if (!response) {
        throw new Error("Aucune réponse du document offscreen");
    }
    if (!response.ok) {
        throw new Error(response.error);
    }
    return response;
}

// Sens de traduction : détecté sur le texte, avec la langue de la page comme indice
// pour les sélections trop courtes pour être reconnues (un mot, un titre…).
async function resolvePair(msg) {
    if (msg.from && msg.from !== "auto") {
        return { from: msg.from, to: msg.to ?? (msg.from === "fr" ? "en" : "fr"), detection: null };
    }
    const detection = await detectLanguage(msg.text);
    let from = detection.supported ? detection.lang : null;
    if (!from && ["fr", "en"].includes(msg.hint)) {
        from = msg.hint;
    }
    if (!from) {
        throw new Error("Langue non prise en charge : seuls le français et l'anglais sont disponibles.");
    }
    return { from, to: from === "fr" ? "en" : "fr", detection };
}

async function translate(msg) {
    const offscreenCreated = await ensureOffscreen();
    const { from, to, detection } = await resolvePair(msg);
    const common = { cmd: "translate", from, to, html: !!msg.html, priority: msg.priority ?? 0, jobId: msg.jobId ?? null };
    // Texte brut sur plusieurs lignes : chaque ligne est traduite à part, les sauts de ligne restent en place.
    const lines = msg.html ? [msg.text] : msg.text.split("\n");
    if (lines.length > 1) {
        const results = await Promise.all(lines.map((line) => (line.trim() === ""
            ? Promise.resolve({ text: line, engineMs: 0 })
            : toOffscreen({ ...common, text: line }))));
        return {
            text: results.map((r) => r.text).join("\n"),
            engineMs: Math.max(...results.map((r) => r.engineMs ?? 0)),
            pairCold: results.some((r) => r.pairCold),
            loadMs: Math.max(...results.map((r) => r.loadMs ?? 0)),
            from,
            to,
            detection,
            offscreenCreated,
        };
    }
    const result = await toOffscreen({ ...common, text: msg.text });
    return { ...result, from, to, detection, offscreenCreated };
}

async function handle(msg) {
    switch (msg.cmd) {
        case "env":
            return {
                offscreen: !!chrome.offscreen,
                getContexts: !!chrome.runtime.getContexts,
                detectLanguage: !!chrome.i18n?.detectLanguage,
                offscreenActive: chrome.offscreen ? await hasOffscreen() : false,
            };
        case "check": {
            let lang = msg.lang;
            let detection = null;
            if (lang === "auto") {
                detection = await detectLanguage(msg.text);
                lang = detection.lang;
            }
            const offscreenCreated = await ensureOffscreen();
            const { englishDialect, dictionary } = await chrome.storage.local.get({ englishDialect: "american", dictionary: [] });
            const result = await toOffscreen({ cmd: "check", lang, text: msg.text, dialect: englishDialect });
            suggestFromDictionary(result.matches, msg.text, dictionary);
            return { ...result, lang, detection, offscreenCreated };
        }
        case "detect":
            return detectLanguage(msg.text);
        case "translate":
            return translate(msg);
        case "translate-cancel":
            if (chrome.offscreen && await hasOffscreen()) {
                await toOffscreen({ cmd: "translate-cancel", jobId: msg.jobId });
            }
            return {};
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
    handle(msg).then(
        (result) => sendResponse({ ok: true, ...result }),
        (error) => sendResponse({ ok: false, error: String(error?.message ?? error) }),
    );
    return true;
});
