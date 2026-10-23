// Aria Plume — banc d'essai de l'étape 2

const FR_SAMPLE = "Les enfant mange des pomme. Je pense que il viendras demain. Le serveur et tombé en panne hier soir.";
const EN_SAMPLE = "The server are down since yesterday and their is no backup. I has checked the the logs.";

const STEPS = [
    { name: "Correction FR (Grammalecte)", msg: { cmd: "check", lang: "fr", text: FR_SAMPLE } },
    { name: "Correction EN (Harper)", msg: { cmd: "check", lang: "en", text: EN_SAMPLE } },
    { name: "Détection auto, texte FR", expect: "fr", msg: { cmd: "check", lang: "auto", text: "Bonjour, je vous envoie le compte rendu de la réunion de ce matin, avec les actions à mener." } },
    { name: "Détection auto, texte EN", expect: "en", msg: { cmd: "check", lang: "auto", text: "Please find attached the report from this morning's meeting, along with the action items." } },
    { name: "Traduction FR → EN (Bergamot)", msg: { cmd: "translate", from: "fr", to: "en", text: "Le serveur de production est tombé en panne cette nuit, il faut redémarrer le service et vérifier les journaux." } },
    { name: "Traduction EN → FR (Bergamot)", msg: { cmd: "translate", from: "en", to: "fr", text: "Make sure to save the configuration before applying the firewall rules, otherwise you might lock yourself out." } },
];

const $ = (selector) => document.querySelector(selector);
let reportText = "";

async function send(msg) {
    const start = performance.now();
    const response = await chrome.runtime.sendMessage({ target: "sw", ...msg });
    const totalMs = performance.now() - start;
    if (!response?.ok) {
        throw new Error(response?.error ?? "Aucune réponse du service worker");
    }
    return { ...response, totalMs };
}

function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    for (const child of children) {
        node.append(child);
    }
    return node;
}

const ms = (value) => `${Math.round(value)} ms`;

function browserLabel() {
    const brands = navigator.userAgentData?.brands
        ?.filter((b) => !/not.?a.?brand/i.test(b.brand))
        .map((b) => `${b.brand} ${b.version}`)
        .join(", ");
    return brands || navigator.userAgent;
}

async function collectEnv() {
    const rows = [["Navigateur", browserLabel()]];
    let swEnv = null;
    try {
        swEnv = await send({ cmd: "env" });
    } catch (error) {
        rows.push(["Service worker", `ERREUR : ${error.message}`]);
    }
    const yesNo = (value) => (value ? "oui" : "NON");
    if (swEnv) {
        rows.push(["API chrome.offscreen", yesNo(swEnv.offscreen)]);
        rows.push(["API runtime.getContexts", yesNo(swEnv.getContexts)]);
        rows.push(["API i18n.detectLanguage", yesNo(swEnv.detectLanguage)]);
    }
    rows.push(["WebAssembly", yesNo(typeof WebAssembly === "object")]);
    rows.push(["DecompressionStream (gzip)", yesNo(typeof DecompressionStream === "function")]);
    rows.push(["Cœurs logiques", String(navigator.hardwareConcurrency ?? "?")]);

    const tbody = $("#env tbody");
    tbody.replaceChildren(...rows.map(([key, value]) => {
        const cell = el("td", { textContent: value });
        if (value === "NON" || value.startsWith("ERREUR")) {
            cell.className = "ko";
        } else if (value === "oui") {
            cell.className = "ok";
        }
        return el("tr", {}, el("th", { textContent: key }), cell);
    }));
    return rows;
}

function summarize(step, response) {
    if (step.msg.cmd === "translate") {
        return { text: `« ${response.text} »`, good: response.text.trim().length > 0 };
    }
    const found = response.matches
        .slice(0, 5)
        .map((m) => `« ${step.msg.text.slice(m.start, m.end)} » → ${m.suggestions[0] ?? "?"}`)
        .join(" · ");
    let text = `${response.matches.length} erreur(s)${found ? " : " + found : ""}`;
    let good = true;
    if (step.expect) {
        const d = response.detection;
        good = d?.lang === step.expect;
        text = `langue détectée : ${d?.lang ?? "?"} (${d?.reliable ? "fiable" : "peu fiable"}, ${d?.source ?? "?"}) · ${text}`;
    }
    return { text, good };
}

async function runDiagnostic() {
    const runButton = $("#run");
    const status = $("#run-status");
    runButton.disabled = true;
    $("#copy").disabled = true;
    const tbody = $("#diag tbody");
    tbody.replaceChildren();
    const lines = [];

    status.textContent = "Déchargement des moteurs…";
    try {
        await send({ cmd: "unload" });
    } catch (error) {
        lines.push(`Déchargement : ERREUR ${error.message}`);
    }

    for (const step of STEPS) {
        status.textContent = `${step.name}…`;
        const row = el("tr", {}, el("td", { textContent: step.name }));
        const resultCell = el("td", { textContent: "…" });
        const coldCell = el("td", { className: "num" });
        const warmCell = el("td", { className: "num" });
        row.append(resultCell, coldCell, warmCell);
        tbody.append(row);
        try {
            const cold = await send(step.msg);
            const warm = await send(step.msg);
            const { text, good } = summarize(step, cold);
            resultCell.textContent = text;
            resultCell.className = good ? "" : "warn";
            const coldDetail = [];
            if (cold.offscreenCreated) {
                coldDetail.push("création offscreen");
            }
            if (cold.loadMs) {
                coldDetail.push(`chargement moteur ${ms(cold.loadMs)}`);
            }
            if (cold.pairCold) {
                coldDetail.push("chargement du modèle compris");
            }
            coldCell.replaceChildren(ms(cold.totalMs), el("div", { className: "small", textContent: coldDetail.join(", ") }));
            warmCell.replaceChildren(ms(warm.totalMs), el("div", { className: "small", textContent: `moteur ${ms(warm.engineMs)}` }));
            lines.push(`${step.name} | froid ${ms(cold.totalMs)}${coldDetail.length ? " (" + coldDetail.join(", ") + ")" : ""} | chaud ${ms(warm.totalMs)} (moteur ${ms(warm.engineMs)}) | ${text}`);
        } catch (error) {
            resultCell.textContent = `ERREUR : ${error.message}`;
            resultCell.className = "ko";
            lines.push(`${step.name} | ERREUR : ${error.message}`);
        }
    }

    const envRows = await collectEnv();
    reportText = [
        "Aria Plume — rapport de diagnostic (étape 2)",
        `Date : ${new Date().toLocaleString("fr-FR")}`,
        "",
        ...envRows.map(([key, value]) => `${key} : ${value}`),
        "",
        ...lines,
        "",
        "RAM : à relever dans le gestionnaire de tâches du navigateur (Maj+Échap), ligne « Aria Plume ».",
    ].join("\n");
    status.textContent = "Terminé.";
    status.className = "status ok";
    runButton.disabled = false;
    $("#copy").disabled = false;
}

async function copyReport() {
    try {
        await navigator.clipboard.writeText(reportText);
        $("#run-status").textContent = "Rapport copié dans le presse-papiers.";
    } catch (error) {
        $("#run-status").textContent = `Copie impossible : ${error.message}`;
    }
}

function setFreeStatus(text, className = "") {
    const node = $("#free-status");
    node.textContent = text;
    node.className = `status ${className}`;
}

// ---------------------------------------------------------------------------
// Essai libre : soulignement en direct (calque miroir) + infobulle au clic droit
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 400;
const input = $("#input");
const backdrop = $("#backdrop");
const menu = $("#ctxmenu");

const live = {
    text: input.value,  // texte auquel correspondent les positions de `matches`
    matches: [],
    ignored: new Set(),
    seq: 0,
    timer: null,
};

const ignoreKey = (match, text) => `${text.slice(match.start, match.end)}|${match.rule}`;

function visibleMatches() {
    return live.matches.filter((m) => !live.ignored.has(ignoreKey(m, live.text)));
}

// Garde le calque aligné sur le textarea (défilement et barre de défilement).
function syncBackdrop() {
    const style = getComputedStyle(input);
    const borders = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
    const scrollbar = input.offsetWidth - input.clientWidth - borders;
    backdrop.style.paddingRight = `${parseFloat(style.paddingRight) + scrollbar}px`;
    backdrop.scrollTop = input.scrollTop;
    backdrop.scrollLeft = input.scrollLeft;
}

function renderBackdrop() {
    const text = live.text;
    const parts = [];
    let cursor = 0;
    for (const match of visibleMatches()) {
        if (match.start < cursor || match.end <= match.start) {
            continue;
        }
        parts.push(text.slice(cursor, match.start));
        // Grammalecte inclut parfois l'espace qui suit (« que  » → « qu’ ») : on ne le souligne pas.
        const found = text.slice(match.start, match.end);
        const word = found.trimEnd() || found;
        const mark = el("mark", { className: match.kind, textContent: word });
        mark.match = match;
        parts.push(mark, found.slice(word.length));
        cursor = match.end;
    }
    // L'espace final garde la même hauteur que le textarea quand le texte finit par un saut de ligne.
    parts.push(text.slice(cursor) + " ");
    backdrop.replaceChildren(...parts);
    syncBackdrop();
}

function renderList() {
    const text = live.text;
    $("#matches").replaceChildren(...visibleMatches().map((match) => {
        const item = el("li", {},
            el("span", { className: "found", textContent: `« ${text.slice(match.start, match.end)} »` }),
            ` ${match.message} `,
            el("span", { className: "small", textContent: `[${match.kind} · ${match.detail ?? match.rule}]` }),
            el("br"),
        );
        for (const suggestion of match.suggestions) {
            const button = el("button", { textContent: suggestion === "" ? "(supprimer)" : suggestion });
            button.addEventListener("click", () => applySuggestion(match, suggestion));
            item.append(button);
        }
        return item;
    }));
}

function render() {
    renderBackdrop();
    renderList();
}

// Pendant la frappe : décale les soulignements situés après la modification,
// et retire ceux qui la touchent, en attendant la nouvelle analyse.
function shiftMatches(oldText, newText) {
    let prefix = 0;
    const maxPrefix = Math.min(oldText.length, newText.length);
    while (prefix < maxPrefix && oldText[prefix] === newText[prefix]) {
        prefix++;
    }
    let suffix = 0;
    while (suffix < maxPrefix - prefix
        && oldText[oldText.length - 1 - suffix] === newText[newText.length - 1 - suffix]) {
        suffix++;
    }
    const editEnd = oldText.length - suffix;
    const delta = newText.length - oldText.length;
    live.matches = live.matches.flatMap((m) => {
        if (m.end < prefix) {
            return [m];
        }
        if (m.start > editEnd) {
            return [{ ...m, start: m.start + delta, end: m.end + delta }];
        }
        return [];
    });
    live.text = newText;
}

async function runCheck() {
    clearTimeout(live.timer);
    const text = input.value;
    const seq = ++live.seq;
    if (text.trim() === "") {
        live.text = text;
        live.matches = [];
        render();
        setFreeStatus("");
        return;
    }
    setFreeStatus("Analyse…");
    try {
        const response = await send({ cmd: "check", lang: $("#lang").value, text });
        // Réponse périmée : le texte a changé ou une analyse plus récente est partie.
        if (seq !== live.seq || input.value !== text) {
            return;
        }
        live.text = text;
        live.matches = response.matches;
        render();
        $("#preview").replaceChildren();
        const count = visibleMatches().length;
        const detected = response.detection ? `langue détectée : ${response.lang}` : `langue : ${response.lang}`;
        const load = response.loadMs ? ` (dont chargement ${ms(response.loadMs)})` : "";
        setFreeStatus(`${detected} · ${count} erreur(s) · ${ms(response.totalMs)}${load}`, "ok");
    } catch (error) {
        if (seq === live.seq) {
            setFreeStatus(`ERREUR : ${error.message}`, "ko");
        }
    }
}

function scheduleCheck() {
    clearTimeout(live.timer);
    live.timer = setTimeout(runCheck, DEBOUNCE_MS);
}

// Remplace via execCommand pour que Ctrl+Z annule la correction comme une frappe.
function applySuggestion(match, suggestion) {
    hideMenu();
    if (input.value !== live.text) {
        return;
    }
    input.focus();
    input.setSelectionRange(match.start, match.end);
    const done = suggestion === ""
        ? document.execCommand("delete")
        : document.execCommand("insertText", false, suggestion);
    if (!done) {
        input.setRangeText(suggestion, match.start, match.end, "end");
        input.dispatchEvent(new Event("input", { bubbles: true }));
    }
}

function markAtPoint(x, y) {
    for (const mark of backdrop.querySelectorAll("mark")) {
        for (const rect of mark.getClientRects()) {
            if (x >= rect.left && x <= rect.right && y >= rect.top - 2 && y <= rect.bottom + 2) {
                return mark;
            }
        }
    }
    return null;
}

function hideMenu() {
    menu.hidden = true;
}

function showMenu(match, x, y) {
    const children = [
        el("div", { className: "kind", textContent: `${match.kind} · ${match.detail ?? match.rule}` }),
        el("p", { className: "msg", textContent: match.message }),
    ];
    const suggestions = el("div", { className: "suggestions" });
    if (match.suggestions.length === 0) {
        suggestions.append(el("span", { className: "none", textContent: "Aucune suggestion" }));
    }
    for (const suggestion of match.suggestions) {
        const button = el("button", { role: "menuitem", textContent: suggestion === "" ? "(supprimer)" : suggestion });
        button.addEventListener("click", () => applySuggestion(match, suggestion));
        suggestions.append(button);
    }
    const ignore = el("button", { className: "ignore", role: "menuitem", textContent: "Ignorer" });
    ignore.addEventListener("click", () => {
        live.ignored.add(ignoreKey(match, live.text));
        hideMenu();
        render();
        input.focus();
    });
    children.push(suggestions, ignore);
    menu.replaceChildren(...children);
    menu.hidden = false;
    // Garde l'infobulle dans la fenêtre.
    const { width, height } = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(x, innerWidth - width - 8))}px`;
    menu.style.top = `${Math.max(8, y + height + 12 > innerHeight ? y - height - 8 : y + 12)}px`;
    menu.querySelector("button")?.focus();
}

input.addEventListener("input", () => {
    hideMenu();
    shiftMatches(live.text, input.value);
    render();
    scheduleCheck();
});
input.addEventListener("scroll", syncBackdrop);
new ResizeObserver(syncBackdrop).observe(input);

input.addEventListener("contextmenu", (event) => {
    const mark = markAtPoint(event.clientX, event.clientY);
    if (!mark) {
        hideMenu();
        return;  // menu natif du navigateur (copier, coller…)
    }
    event.preventDefault();
    showMenu(mark.match, event.clientX, event.clientY);
});

document.addEventListener("mousedown", (event) => {
    if (!menu.hidden && !menu.contains(event.target)) {
        hideMenu();
    }
});
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) {
        hideMenu();
        input.focus();
    }
});
addEventListener("scroll", hideMenu, { passive: true });
addEventListener("resize", hideMenu);

async function translateFree(from, to) {
    setFreeStatus("Traduction…");
    try {
        const response = await send({ cmd: "translate", from, to, text: input.value });
        $("#preview").textContent = response.text;
        const load = response.pairCold ? " (chargement du modèle compris)" : "";
        setFreeStatus(`traduction ${from} → ${to} · ${ms(response.totalMs)}${load}`, "ok");
    } catch (error) {
        setFreeStatus(`ERREUR : ${error.message}`, "ko");
    }
}

$("#run").addEventListener("click", runDiagnostic);
$("#copy").addEventListener("click", copyReport);
$("#check").addEventListener("click", runCheck);
$("#lang").addEventListener("change", runCheck);
$("#tr-fr-en").addEventListener("click", () => translateFree("fr", "en"));
$("#tr-en-fr").addEventListener("click", () => translateFree("en", "fr"));
$("#unload").addEventListener("click", async () => {
    try {
        await send({ cmd: "unload" });
        live.matches = [];
        render();
        $("#preview").replaceChildren();
        setFreeStatus("Moteurs déchargés.", "ok");
    } catch (error) {
        setFreeStatus(`ERREUR : ${error.message}`, "ko");
    }
});

collectEnv();
render();
runCheck();
