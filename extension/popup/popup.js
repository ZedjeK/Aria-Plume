// Aria ODL — popup : réglages de la correction en direct (stockés localement)
// et traduction rapide dans les deux sens entre deux bulles.
// La même page sert aussi de fenêtre séparée (popup.html?mode=window).

const DEFAULTS = { liveEnabled: true, disabledHosts: [] };
const WINDOW_SIZE = { width: 560, height: 780 };
const BOUNDS_KEY = "windowBounds";
const $ = (selector) => document.querySelector(selector);
const isWindow = new URLSearchParams(location.search).get("mode") === "window";
document.body.classList.toggle("window", isWindow);

let tab = null;
let host = "";
let settings = await chrome.storage.local.get(DEFAULTS);

// Onglet visé : celui de la fenêtre courante pour la popup ; pour la fenêtre séparée,
// l'onglet actif de la dernière fenêtre de navigation utilisée.
async function findTab() {
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
    if (!isWindow) {
        window.close();
    }
}

$("#live").addEventListener("change", (event) => save({ liveEnabled: event.target.checked }));

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
bubbles.a.focus();
