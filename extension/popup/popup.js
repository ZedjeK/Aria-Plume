// Aria Plume — popup : réglages de la correction en direct (stockés localement),
// traduction rapide dans les deux sens entre deux bulles, et conjugueur.
// La même page sert aussi de fenêtre séparée (popup.html?mode=window) et de fenêtre
// de l'application de bureau (servie en aria:, voir app/).

import { DEFAULTS as ALL_DEFAULTS } from "../core/shared/settings.js";

const DEFAULTS = { liveEnabled: true, disabledHosts: [], formalFrench: ALL_DEFAULTS.formalFrench, formalHosts: ALL_DEFAULTS.formalHosts, casualHosts: ALL_DEFAULTS.casualHosts };
const WINDOW_SIZE = { width: 560, height: 780 };
const BOUNDS_KEY = "windowBounds";
const $ = (selector) => document.querySelector(selector);
const isApp = location.protocol === "aria:";
const isWindow = !isApp && new URLSearchParams(location.search).get("mode") === "window";
document.body.classList.toggle("window", isWindow || isApp);
document.body.classList.toggle("app", isApp);

let tab = null;
let host = "";
let settings = await chrome.storage.local.get(DEFAULTS);

// Onglet visé : celui de la fenêtre courante pour la popup ; pour la fenêtre séparée,
// l'onglet actif de la dernière fenêtre de navigation utilisée.
async function findTab() {
    if (isApp) {
        return null;  // l'application n'a pas d'onglet
    }
    if (!isWindow) {
        return (await chrome.tabs.query({ active: true, currentWindow: true }))[0] ?? null;
    }
    try {
        const win = await chrome.windows.getLastFocused({ windowTypes: ["normal"], populate: true });
        return win?.tabs?.find((t) => t.active) ?? null;
    } catch {
        return null;
    }
}

function hostOf(target) {
    try {
        const url = new URL(target?.url ?? "");
        return url.protocol === "http:" || url.protocol === "https:" ? url.hostname : "";
    } catch {
        return "";  // page interne du navigateur
    }
}

function render() {
    $("#live").checked = settings.liveEnabled;
    const siteToggle = $("#site");
    const siteRow = $("#site-row");
    renderFormal();
    $("#check").disabled = !host;
    $("#translate-page").disabled = !host;
    if (!host) {
        $("#site-name").textContent = "Page interne : non prise en charge";
        siteToggle.checked = false;
        siteToggle.disabled = true;
        siteRow.classList.add("disabled");
        return;
    }
    $("#site-name").textContent = host;
    siteToggle.checked = !settings.disabledHosts.includes(host);
    siteToggle.disabled = !settings.liveEnabled;
    siteRow.classList.toggle("disabled", !settings.liveEnabled);
}

async function refreshTab() {
    tab = await findTab();
    host = hostOf(tab);
    render();
}

async function save(patch) {
    settings = { ...settings, ...patch };
    await chrome.storage.local.set(patch);
    render();
}

// La popup se referme après une action ; la fenêtre séparée reste ouverte.
function done() {
    if (!isWindow && !isApp) {
        window.close();
    }
}

$("#live").addEventListener("change", (event) => save({ liveEnabled: event.target.checked }));

// Français soigné sur ce site : liste « soigné », liste « courant », ou réglage général.
function renderFormal() {
    const select = $("#formal-site");
    const row = $("#formal-row");
    $("#formal-hint").textContent = `Réglage général : ${settings.formalFrench ? "oui" : "non"}`;
    $("#formal-row").title = "Français écrit soigné : le « ne » oublié, « se rappeler de », « pallier à »…";
    select.disabled = !host;
    row.classList.toggle("disabled", !host);
    select.value = !host ? "default" : settings.formalHosts.includes(host) ? "formal" : settings.casualHosts.includes(host) ? "casual" : "default";
    // Un domaine parent (« google.com ») dans une liste : on le signale, sans le modifier ici.
    const parent = [...settings.formalHosts, ...settings.casualHosts].find((h) => host && h !== host && host.endsWith(`.${h}`));
    if (parent && select.value === "default") {
        $("#formal-hint").textContent = `Réglé pour ${parent} dans la page de réglages.`;
    }
}

// Réglages changés ailleurs (page de réglages, autre fenêtre) : la popup suit.
chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === "local" && Object.keys(changes).some((key) => key in DEFAULTS)) {
        settings = await chrome.storage.local.get(DEFAULTS);
        render();
    }
});

$("#formal-site").addEventListener("change", (event) => {
    const formalHosts = settings.formalHosts.filter((h) => h !== host);
    const casualHosts = settings.casualHosts.filter((h) => h !== host);
    if (event.target.value === "formal") {
        formalHosts.push(host);
    } else if (event.target.value === "casual") {
        casualHosts.push(host);
    }
    save({ formalHosts, casualHosts });
});

$("#site").addEventListener("change", (event) => {
    const others = settings.disabledHosts.filter((h) => h !== host);
    save({ disabledHosts: event.target.checked ? others : [...others, host] });
});

$("#check").addEventListener("click", async () => {
    await refreshTab();
    if (tab) {
        await chrome.runtime.sendMessage({ target: "sw", cmd: "open-panel", tabId: tab.id });
    }
    done();
});

$("#translate-page").addEventListener("click", async () => {
    await refreshTab();
    if (tab) {
        await chrome.runtime.sendMessage({ target: "sw", cmd: "translate-page", tabId: tab.id });
    }
    done();
});

$("#options").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
    done();
});

$("#bench").addEventListener("click", async () => {
    await chrome.tabs.create({ url: chrome.runtime.getURL("test/test.html"), ...(tab ? { windowId: tab.windowId } : {}) });
    done();
});

// Fenêtre séparée : une seule à la fois, on la remet au premier plan si elle existe déjà.
$("#detach").addEventListener("click", async () => {
    const { ariaWindowId } = await chrome.storage.session.get("ariaWindowId").catch(() => ({}));
    if (ariaWindowId) {
        try {
            await chrome.windows.update(ariaWindowId, { focused: true });
            window.close();
            return;
        } catch {
            // fenêtre fermée entre-temps
        }
    }
    // Réouverture à la taille et à la position que tu lui avais données.
    const saved = (await chrome.storage.local.get(BOUNDS_KEY))[BOUNDS_KEY];
    const win = await chrome.windows.create({
        url: chrome.runtime.getURL("popup/popup.html?mode=window"),
        type: "popup",
        ...(saved ?? WINDOW_SIZE),
    });
    await chrome.storage.session.set({ ariaWindowId: win.id }).catch(() => {});
    window.close();
});

if (isWindow) {
    $("#detach").hidden = true;
    const me = await chrome.windows.getCurrent();
    const maximize = $("#maximize");
    maximize.hidden = false;
    const showState = (state) => {
        const big = state === "maximized";
        maximize.textContent = big ? "⤡" : "⤢";
        maximize.title = big ? "Restaurer la taille" : "Agrandir la fenêtre";
        maximize.setAttribute("aria-label", maximize.title);
    };
    showState(me.state);
    maximize.addEventListener("click", async () => {
        const current = await chrome.windows.get(me.id);
        const state = current.state === "maximized" ? "normal" : "maximized";
        await chrome.windows.update(me.id, { state });
        showState((await chrome.windows.get(me.id)).state);
    });
    // Opera GX ne laisse pas étirer les bords de ce type de fenêtre : on pose nos propres poignées
    // sur les bords et les coins, et on redimensionne la fenêtre nous-mêmes en suivant la souris.
    const MIN_SIZE = { width: 380, height: 420 };
    for (const edge of ["n", "s", "e", "w", "ne", "nw", "se", "sw"]) {
        const handle = document.createElement("div");
        handle.className = `resize resize-${edge}`;
        handle.setAttribute("aria-hidden", "true");
        document.body.append(handle);
        handle.addEventListener("pointerdown", async (down) => {
            if (down.button !== 0) {
                return;
            }
            down.preventDefault();
            handle.setPointerCapture(down.pointerId);
            const start = await chrome.windows.get(me.id);
            if (start.state !== "normal") {
                await chrome.windows.update(me.id, { state: "normal" });
            }
            const origin = { x: down.screenX, y: down.screenY };
            let pending = null;
            let busy = false;
            const apply = async () => {
                if (busy || !pending) {
                    return;
                }
                busy = true;
                const bounds = pending;
                pending = null;
                try {
                    await chrome.windows.update(me.id, bounds);
                } finally {
                    busy = false;
                    apply();
                }
            };
            const onMove = (move) => {
                const dx = move.screenX - origin.x;
                const dy = move.screenY - origin.y;
                const bounds = { left: start.left, top: start.top, width: start.width, height: start.height };
                if (edge.includes("e")) {
                    bounds.width = Math.max(MIN_SIZE.width, start.width + dx);
                }
                if (edge.includes("s")) {
                    bounds.height = Math.max(MIN_SIZE.height, start.height + dy);
                }
                if (edge.includes("w")) {
                    bounds.width = Math.max(MIN_SIZE.width, start.width - dx);
                    bounds.left = start.left + start.width - bounds.width;
                }
                if (edge.includes("n")) {
                    bounds.height = Math.max(MIN_SIZE.height, start.height - dy);
                    bounds.top = start.top + start.height - bounds.height;
                }
                pending = bounds;
                apply();
            };
            const onUp = () => {
                handle.removeEventListener("pointermove", onMove);
                handle.removeEventListener("pointerup", onUp);
                handle.removeEventListener("pointercancel", onUp);
                document.body.classList.remove("resizing");
            };
            document.body.classList.add("resizing");
            handle.addEventListener("pointermove", onMove);
            handle.addEventListener("pointerup", onUp);
            handle.addEventListener("pointercancel", onUp);
        });
    }

    // Retient la taille et la position choisies en étirant les bords ou en déplaçant la fenêtre.
    chrome.windows.onBoundsChanged.addListener((win) => {
        if (win.id !== me.id) {
            return;
        }
        showState(win.state);
        if (win.state === "normal") {
            chrome.storage.local.set({ [BOUNDS_KEY]: { left: win.left, top: win.top, width: win.width, height: win.height } });
        }
    });
    // Suit l'onglet que tu regardes dans le navigateur.
    chrome.tabs.onActivated.addListener(refreshTab);
    chrome.tabs.onUpdated.addListener((tabId, change) => {
        if (tabId === tab?.id && change.url) {
            refreshTab();
        }
    });
    chrome.windows.onFocusChanged.addListener(refreshTab);
}

await refreshTab();

// --- Traduction rapide ---
// Écrire dans une bulle traduit vers l'autre (sens détecté automatiquement).
// Les textes sont gardés dans le stockage de session : locaux, effacés à la fermeture d'Opera.

const QUICK_DELAY_MS = 400;
const bubbles = { a: $("#qt-a"), b: $("#qt-b") };
const labels = { a: $("#qt-lang-a"), b: $("#qt-lang-b") };
const other = { a: "b", b: "a" };
let quickSeq = 0;
let quickTimer = null;

function setStatus(text, isError = false) {
    const status = $("#qt-status");
    status.textContent = text;
    status.className = isError ? "qt-status ko" : "qt-status";
}

function setLabels(side, from, to) {
    labels[side].textContent = from.toUpperCase();
    labels[other[side]].textContent = to.toUpperCase();
}

function remember() {
    chrome.storage.session?.set({ quickA: bubbles.a.value, quickB: bubbles.b.value, quickLabels: [labels.a.textContent, labels.b.textContent] }).catch(() => {});
}

async function translateFrom(side) {
    const seq = ++quickSeq;
    const text = bubbles[side].value;
    const target = other[side];
    if (text.trim() === "") {
        bubbles[target].value = "";
        setStatus("");
        remember();
        return;
    }
    setStatus("traduction…");
    let response;
    try {
        response = await chrome.runtime.sendMessage({ target: "sw", cmd: "translate", from: "auto", text, priority: 0 });
    } catch (error) {
        response = { ok: false, error: error.message };
    }
    // Une frappe plus récente (dans l'une ou l'autre bulle) l'emporte.
    if (seq !== quickSeq) {
        return;
    }
    if (!response?.ok) {
        setStatus(response?.error ?? "Pas de réponse de l'extension.", true);
        return;
    }
    bubbles[target].value = response.text;
    setLabels(side, response.from, response.to);
    setStatus(`${response.from.toUpperCase()} → ${response.to.toUpperCase()} · ${Math.round(response.engineMs ?? 0)} ms`);
    remember();
}

for (const side of ["a", "b"]) {
    bubbles[side].addEventListener("input", () => {
        clearTimeout(quickTimer);
        remember();
        quickTimer = setTimeout(() => translateFrom(side), QUICK_DELAY_MS);
    });
    $(`#qt-copy-${side}`).addEventListener("click", async (event) => {
        const button = event.currentTarget;
        try {
            await navigator.clipboard.writeText(bubbles[side].value);
            button.textContent = "Copié ✓";
        } catch {
            button.textContent = "Échec";
        }
        setTimeout(() => {
            button.textContent = "Copier";
        }, 1200);
    });
}

$("#qt-swap").addEventListener("click", () => {
    clearTimeout(quickTimer);
    quickSeq++;
    [bubbles.a.value, bubbles.b.value] = [bubbles.b.value, bubbles.a.value];
    [labels.a.textContent, labels.b.textContent] = [labels.b.textContent, labels.a.textContent];
    setStatus("");
    remember();
    bubbles.a.focus();
});

// --- Conjugueur ---
// Module de conjugaison de Grammalecte, dans le document offscreen. Le verbe, les options
// et l'onglet ouvert sont gardés dans le stockage de session.

const CONJ_DELAY_MS = 350;
const conjInput = $("#conj-verb");
const optionBoxes = [...document.querySelectorAll("#conj-options input")];
let conjSeq = 0;
let conjTimer = null;
// Choix de l'utilisateur pour « Pronominal ». La case peut aussi refléter le verbe
// (« se lever », verbe toujours pronominal) sans que ce choix passe au verbe suivant.
let pronominalChoice = false;

const el = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    Object.assign(node, props);
    node.append(...children);
    return node;
};

function conjOptions() {
    const options = Object.fromEntries(optionBoxes.map((box) => [box.dataset.option, box.checked]));
    options.pronominal = pronominalChoice;
    return options;
}

function rememberConj() {
    chrome.storage.session?.set({ conjVerb: conjInput.value, conjOptions: conjOptions() }).catch(() => {});
}

function renderConj(result) {
    const info = $("#conj-info");
    const results = $("#conj-results");
    if (!result.found) {
        info.replaceChildren(el("span", { className: "ko", textContent: `« ${result.input} » : verbe inconnu.` }));
        if (result.suggestions.length) {
            info.append(" Tu voulais dire : ", ...result.suggestions.map((verb) => {
                const button = el("button", { type: "button", textContent: verb });
                button.addEventListener("click", () => {
                    conjInput.value = verb;
                    runConj();
                });
                return button;
            }));
        }
        results.replaceChildren();
        return;
    }
    const pronominal = optionBoxes.find((box) => box.dataset.option === "pronominal");
    // Pronominal impossible (-1) ou obligatoire (1) : la case suit le verbe.
    pronominal.disabled = result.pronominable === -1 || result.pronominable === 1;
    pronominal.checked = result.options.pronominal;
    const line = [result.info, `auxiliaire ${result.auxiliary}`];
    if (result.incomplete) {
        line.push("conjugaison incomplète");
    }
    info.replaceChildren(
        el("strong", { textContent: result.infinitiveForm }),
        result.fromForm ? ` ← « ${result.input} »` : "",
        el("div", { textContent: line.join(" · ") }),
        el("div", { textContent: `Participe présent : ${result.presentParticiple} · participes passés : ${result.pastParticiples.join(", ")}` }),
    );
    if (result.others.length) {
        info.append(el("div", { textContent: `Autre${result.others.length > 1 ? "s" : ""} verbe${result.others.length > 1 ? "s" : ""} possible${result.others.length > 1 ? "s" : ""} : ` }, ...result.others.map((verb) => {
            const button = el("button", { type: "button", textContent: verb });
            button.addEventListener("click", () => {
                conjInput.value = verb;
                runConj();
            });
            return button;
        })));
    }
    results.replaceChildren(...result.moods.flatMap((mood) => [
        el("h3", { textContent: mood.name }),
        el("div", { className: "conj-grid" }, ...mood.tenses.map((tense) => el("div", { className: "tense" },
            el("h4", { textContent: tense.name }),
            el("ol", {}, ...tense.forms.map((form) => el("li", { textContent: form }))),
        ))),
    ]));
    results.scrollTop = 0;
    fitConjResults();
}

// Popup : Chrome la limite à 600 px de haut. La liste des temps défile dans la place qui reste.
function fitConjResults() {
    if (isWindow || isApp) {
        return;
    }
    const results = $("#conj-results");
    results.style.maxHeight = `${Math.max(140, 588 - results.getBoundingClientRect().top - 12)}px`;
}

async function runConj() {
    clearTimeout(conjTimer);
    rememberConj();
    const verb = conjInput.value.trim();
    const seq = ++conjSeq;
    if (!verb) {
        $("#conj-info").replaceChildren();
        $("#conj-results").replaceChildren();
        return;
    }
    $("#conj-info").textContent = "Conjugaison…";
    let response;
    try {
        response = await chrome.runtime.sendMessage({ target: "sw", cmd: "conjugate", verb, options: conjOptions() });
    } catch (error) {
        response = { ok: false, error: error.message };
    }
    if (seq !== conjSeq) {
        return;
    }
    if (!response?.ok) {
        $("#conj-info").replaceChildren(el("span", { className: "ko", textContent: response?.error ?? "Pas de réponse de l'extension." }));
        return;
    }
    renderConj(response);
}

$("#conj-form").addEventListener("submit", (event) => {
    event.preventDefault();
    runConj();
});
conjInput.addEventListener("input", () => {
    clearTimeout(conjTimer);
    conjTimer = setTimeout(runConj, CONJ_DELAY_MS);
});
for (const box of optionBoxes) {
    box.addEventListener("change", () => {
        if (box.dataset.option === "pronominal") {
            pronominalChoice = box.checked;
        }
        runConj();
    });
}

// --- Correcteur ---
// Le texte est corrigé par le même script que dans les pages (vagues, infobulle au clic droit,
// panneau « Tout corriger »). La langue peut être imposée ; le texte reste en stockage de session.
const fixText = $("#fix-text");
const fixBox = $("#fix-box");

function rememberFix() {
    chrome.storage.session?.set({ fixText: fixText.value, fixLang: $("#fix-lang").value }).catch(() => {});
}

function applyFixLang() {
    fixBox.setAttribute("data-aria-lang", $("#fix-lang").value);
    // Relance l'analyse avec la nouvelle langue.
    fixText.dispatchEvent(new Event("input", { bubbles: true }));
}

// Compteur sous le texte : fautes, style, répétitions, mots, temps de lecture.
const WORDS = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
let fixResults = { text: "", matches: [] };

function renderFixStats() {
    const stats = $("#fix-stats");
    const text = fixText.value;
    const words = (text.match(WORDS) ?? []).length;
    if (words === 0) {
        stats.replaceChildren();
        return;
    }
    const fresh = fixResults.text === text;
    const matches = fresh ? fixResults.matches : [];
    const faults = matches.filter((m) => m.kind === "orthographe" || m.kind === "grammaire").length;
    const repeats = matches.filter((m) => m.rule === "aria_repetition").length;
    const style = matches.filter((m) => (m.kind === "style" || m.kind === "typographie") && m.rule !== "aria_repetition").length;
    const plural = (n, word) => `${n} ${word}${n > 1 ? "s" : ""}`;
    const parts = [];
    if (fresh) {
        parts.push(el("span", faults ? { className: "bad", textContent: plural(faults, "faute") } : { className: "ok", textContent: "Aucune faute ✨" }));
        if (style) {
            parts.push(` · ${plural(style, "remarque")} de style`);
        }
        if (repeats) {
            parts.push(` · ${plural(repeats, "répétition")}`);
        }
        parts.push(" · ");
    }
    parts.push(`${plural(words, "mot")} · ${Math.max(1, Math.round(words / 230))} min de lecture`);
    stats.replaceChildren(...parts);
}

// Liste des fautes à côté du texte (fenêtre séparée large) : un clic applique la correction.
const KIND_NAMES = { orthographe: "Orthographe", grammaire: "Grammaire", style: "Style", typographie: "Typographie" };
const MAX_LISTED = 60;

function applyFix(match, suggestion) {
    if (fixText.value.slice(match.start, match.end) !== match.word) {
        return;  // le texte a bougé : la prochaine analyse remettra la liste à jour
    }
    fixText.focus();
    fixText.setSelectionRange(match.start, match.end);
    // execCommand garde l'historique : Ctrl+Z annule comme une frappe.
    if (!document.execCommand("insertText", false, suggestion)) {
        fixText.setRangeText(suggestion, match.start, match.end, "end");
        fixText.dispatchEvent(new Event("input", { bubbles: true }));
    }
    chrome.runtime.sendMessage({ target: "sw", cmd: "record-mistakes", items: [{ rule: match.rule, kind: match.kind, lang: fixResults.lang, word: match.word, suggestion }] }).catch(() => {});
}

async function ignoreFix(match) {
    const { ignored = [] } = await chrome.storage.local.get({ ignored: [] });
    if (!ignored.some((e) => e.word === match.word && e.rule === match.rule)) {
        await chrome.storage.local.set({ ignored: [...ignored, { word: match.word, rule: match.rule, kind: match.kind }].slice(-2000) });
    }
}

function renderFixList() {
    const list = $("#fix-list");
    const fresh = fixResults.text === fixText.value;
    const matches = fresh ? fixResults.matches.slice(0, MAX_LISTED) : [];
    list.replaceChildren(...matches.map((match) => {
        const actions = el("div", { className: "fix-actions" });
        for (const suggestion of match.suggestions.slice(0, 4)) {
            const button = el("button", { className: "sugg", textContent: suggestion === "" ? "(supprimer)" : suggestion });
            button.addEventListener("click", () => applyFix(match, suggestion));
            actions.append(button);
        }
        const ignore = el("button", { className: "ignore", textContent: "Ignorer" });
        ignore.addEventListener("click", () => ignoreFix(match));
        actions.append(ignore);
        return el("div", { className: `fix-item ${match.kind}` },
            el("div", { className: "fix-kind" }, `${KIND_NAMES[match.kind] ?? match.kind} · `, el("span", { className: "fix-word", textContent: match.word })),
            el("div", { className: "fix-message", textContent: match.message }),
            actions);
    }));
}

fixText.addEventListener("aria-odl-results", (event) => {
    fixResults = event.detail;
    renderFixStats();
    renderFixList();
});
fixText.addEventListener("input", renderFixStats);
fixText.addEventListener("input", rememberFix);
$("#fix-lang").addEventListener("change", () => {
    applyFixLang();
    rememberFix();
    fixText.focus();
});
$("#fix-all").addEventListener("click", () => {
    fixText.focus();
    window.dispatchEvent(new Event("aria-odl-open-panel"));
});
// Aller-retour avec la page : « Récupérer » prend la sélection ou le champ actif de l'onglet,
// « Renvoyer » y remet le texte corrigé (seules les lignes modifiées sont remplacées).
let grabbed = null;

function setSource(text, isError = false) {
    const source = $("#fix-source");
    source.textContent = text;
    source.className = isError ? "fix-source ko" : "fix-source";
}

$("#fix-grab").addEventListener("click", async () => {
    await refreshTab();
    if (!tab || !host) {
        setSource("Ouvre une page web pour en récupérer le texte.", true);
        return;
    }
    const response = await chrome.runtime.sendMessage({ target: "sw", cmd: "exchange", op: "grab-text", tabId: tab.id }).catch((error) => ({ ok: false, error: error.message }));
    if (!response?.ok) {
        setSource(response?.error ?? "Pas de réponse de la page.", true);
        return;
    }
    grabbed = { tabId: tab.id, host, editable: response.editable };
    fixText.value = response.text;
    fixText.dispatchEvent(new Event("input", { bubbles: true }));
    fixText.focus();
    $("#fix-put").disabled = !response.editable;
    setSource(`Récupéré depuis ${host}${response.whole ? "" : " (sélection)"}${response.editable ? " · « Renvoyer » le remettra à sa place" : " · texte non modifiable dans la page"}`);
});

$("#fix-put").addEventListener("click", async () => {
    if (!grabbed) {
        return;
    }
    const response = await chrome.runtime.sendMessage({ target: "sw", cmd: "exchange", op: "put-text", tabId: grabbed.tabId, text: fixText.value }).catch((error) => ({ ok: false, error: error.message }));
    if (!response?.ok) {
        setSource(response?.error ?? "Pas de réponse de la page.", true);
        return;
    }
    setSource(response.changes ? `Renvoyé dans ${grabbed.host} ✓ (${response.changes} passage${response.changes > 1 ? "s" : ""} modifié${response.changes > 1 ? "s" : ""}, Ctrl+Z dans la page pour annuler)` : `Rien à renvoyer : le texte n'a pas changé.`);
});

// « Traduire » : le texte corrigé part dans la bulle du haut de l'onglet Traduction.
$("#fix-translate").addEventListener("click", () => {
    if (!fixText.value.trim()) {
        return;
    }
    bubbles.a.value = fixText.value;
    bubbles.b.value = "";
    showTab("quick");
    remember();
    translateFrom("a");
});

$("#fix-copy").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    try {
        await navigator.clipboard.writeText(fixText.value);
        button.textContent = "Copié ✓";
    } catch {
        button.textContent = "Échec";
    }
    setTimeout(() => {
        button.textContent = "Copier";
    }, 1200);
});
$("#fix-clear").addEventListener("click", () => {
    grabbed = null;
    $("#fix-put").disabled = true;
    setSource("");
    fixText.value = "";
    fixText.dispatchEvent(new Event("input", { bubbles: true }));
    fixText.focus();
});
try {
    const saved = await chrome.storage.session.get({ fixText: "", fixLang: "auto" });
    fixText.value = saved.fixText;
    $("#fix-lang").value = ["auto", "fr", "en"].includes(saved.fixLang) ? saved.fixLang : "auto";
    fixBox.setAttribute("data-aria-lang", $("#fix-lang").value);
    renderFixStats();
} catch {
    // stockage de session indisponible
}

// --- Onglets ---
const TABS = { quick: { tab: $("#tab-quick"), panel: $("#panel-quick") }, fix: { tab: $("#tab-fix"), panel: $("#panel-fix") }, conj: { tab: $("#tab-conj"), panel: $("#panel-conj") } };

function showTab(name, focus = true) {
    for (const [key, { tab: button, panel }] of Object.entries(TABS)) {
        const active = key === name;
        button.setAttribute("aria-selected", String(active));
        button.tabIndex = active ? 0 : -1;
        panel.hidden = !active;
    }
    $("#qt-status").hidden = name !== "quick";  // l'état de la traduction, dans la barre d'onglets
    // Popup : la place manque, les interrupteurs et l'aide s'effacent le temps de conjuguer.
    document.body.classList.toggle("conj-mode", name === "conj");
    document.body.classList.toggle("fix-mode", name === "fix");
    if (name === "conj") {
        fitConjResults();
    }
    chrome.storage.session?.set({ activeTab: name }).catch(() => {});
    if (focus) {
        ({ conj: conjInput, fix: $("#fix-text"), quick: bubbles.a })[name].focus();
    }
}

for (const [name, { tab: button }] of Object.entries(TABS)) {
    button.addEventListener("click", () => showTab(name));
    button.addEventListener("keydown", (event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            const order = Object.keys(TABS);
            const step = event.key === "ArrowRight" ? 1 : order.length - 1;
            const next = order[(order.indexOf(name) + step) % order.length];
            showTab(next, false);
            TABS[next].tab.focus();
        }
    });
}

try {
    const saved = await chrome.storage.session.get({ quickA: "", quickB: "", quickLabels: null });
    bubbles.a.value = saved.quickA;
    bubbles.b.value = saved.quickB;
    if (saved.quickLabels) {
        [labels.a.textContent, labels.b.textContent] = saved.quickLabels;
    }
} catch {
    // stockage de session indisponible : bulles vides
}

let activeTab = "quick";
try {
    const saved = await chrome.storage.session.get({ conjVerb: "", conjOptions: {}, activeTab: "quick" });
    conjInput.value = saved.conjVerb;
    for (const box of optionBoxes) {
        box.checked = !!saved.conjOptions[box.dataset.option];
    }
    pronominalChoice = !!saved.conjOptions.pronominal;
    activeTab = saved.activeTab in TABS ? saved.activeTab : "quick";
} catch {
    // stockage de session indisponible
}
showTab(activeTab);
// Le script de correction se charge après cette page : on redonne le focus au correcteur
// pour qu'il prenne le champ en charge tout de suite.
const refocusFix = () => {
    if (!$("#panel-fix").hidden) {
        fixText.blur();
        fixText.focus();
    }
};
if (document.readyState === "complete") {
    setTimeout(refocusFix, 0);
} else {
    window.addEventListener("load", refocusFix, { once: true });
}
if (conjInput.value.trim()) {
    runConj();
}
