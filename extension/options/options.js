// Aria ODL — page de réglages. Tout est enregistré dès le changement, dans le stockage
// local du navigateur ; l'export produit un fichier JSON sur ton PC, rien n'est envoyé.
import { DEFAULTS, DEFAULT_COLORS, DIALECTS, KINDS, DEBOUNCE_RANGE, MAX_DICTIONARY, sanitize, splitWords, loadSettings } from "../shared/settings.js";

const $ = (selector) => document.querySelector(selector);
const KIND_LABELS = { orthographe: "Orthographe", grammaire: "Grammaire", style: "Style", typographie: "Typographie" };
const COLOR_LABELS = { orthographe: "Orthographe", grammaire: "Grammaire", style: "Style et typographie" };

let settings = await loadSettings();
let savedTimer = null;

function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    node.append(...children);
    return node;
}

function flashSaved() {
    $("#saved").textContent = "Enregistré ✓";
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => {
        $("#saved").textContent = "";
    }, 1500);
}

async function save(patch) {
    settings = { ...settings, ...patch };
    await chrome.storage.local.set(patch);
    flashSaved();
    render();
}

function render() {
    $("#liveEnabled").checked = settings.liveEnabled;
    $("#hideNativeSpellcheck").checked = settings.hideNativeSpellcheck;
    $("#debounceMs").value = settings.debounceMs;
    $("#debounceValue").textContent = `${settings.debounceMs} ms`;
    $("#englishDialect").value = settings.englishDialect;

    for (const kind of KINDS) {
        $(`#kind-${kind}`).checked = !settings.disabledKinds.includes(kind);
    }
    for (const kind of Object.keys(DEFAULT_COLORS)) {
        $(`#color-${kind}`).value = settings.colors[kind];
    }
    $("#preview").replaceChildren(
        "Aperçu : ",
        el("span", { textContent: "orthographe", style: `text-decoration-color: ${settings.colors.orthographe}` }),
        " · ",
        el("span", { textContent: "grammaire", style: `text-decoration-color: ${settings.colors.grammaire}` }),
        " · ",
        el("span", { textContent: "style", style: `text-decoration-color: ${settings.colors.style}` }),
    );

    renderDictionary();

    $("#ignoredCount").textContent = settings.ignored.length;
    $("#ignored").replaceChildren(...settings.ignored.map((entry, index) => {
        const remove = el("button", { textContent: "×", title: "Signaler de nouveau" });
        remove.setAttribute("aria-label", `Ne plus ignorer « ${entry.word} »`);
        remove.addEventListener("click", () => save({ ignored: settings.ignored.filter((_, i) => i !== index) }));
        return el("li", {}, el("span", { className: "word", textContent: entry.word }), el("span", { className: "meta", textContent: `${KIND_LABELS[entry.kind] ?? entry.kind} · ${entry.rule}` }), remove);
    }));
    $("#clearIgnored").disabled = settings.ignored.length === 0;

    $("#hostsCount").textContent = settings.disabledHosts.length;
    $("#hosts").replaceChildren(...settings.disabledHosts.map((host) => {
        const remove = el("button", { textContent: "×", title: "Réactiver sur ce site" });
        remove.setAttribute("aria-label", `Réactiver sur ${host}`);
        remove.addEventListener("click", () => save({ disabledHosts: settings.disabledHosts.filter((h) => h !== host) }));
        return el("li", {}, el("span", { className: "word", textContent: host }), el("span", { className: "meta" }), remove);
    }));
}

function renderDictionary() {
    const filter = $("#dictFilter").value.trim().toLowerCase();
    const words = [...settings.dictionary].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
    const shown = filter ? words.filter((w) => w.toLowerCase().includes(filter)) : words;
    $("#dictCount").textContent = settings.dictionary.length;
    $("#dictionary").className = "list words";
    $("#dictionary").replaceChildren(...shown.map((word) => {
        const remove = el("button", { textContent: "×", title: "Retirer du dictionnaire" });
        remove.setAttribute("aria-label", `Retirer « ${word} » du dictionnaire`);
        remove.addEventListener("click", () => save({ dictionary: settings.dictionary.filter((w) => w !== word) }));
        return el("li", {}, el("span", { className: "word", textContent: word }), remove);
    }));
    $("#clearDict").disabled = settings.dictionary.length === 0;
    $("#dictExport").disabled = settings.dictionary.length === 0;
}

function setDictStatus(text, kind) {
    const status = $("#dictStatus");
    status.textContent = text;
    status.className = `status ${kind}`;
}

async function addWords(text) {
    const words = splitWords(text);
    const fresh = words.filter((w) => !settings.dictionary.includes(w));
    if (words.length === 0) {
        setDictStatus("Aucun mot valide (lettres, chiffres, apostrophe, point ou tiret, 60 caractères au plus).", "ko");
        return;
    }
    await save({ dictionary: [...settings.dictionary, ...fresh].slice(-MAX_DICTIONARY) });
    setDictStatus(fresh.length ? `${fresh.length} mot${fresh.length > 1 ? "s" : ""} ajouté${fresh.length > 1 ? "s" : ""}.` : "Déjà dans le dictionnaire.", "ok");
}

function build() {
    $("#dictForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        await addWords($("#dictInput").value);
        $("#dictInput").value = "";
    });
    $("#dictFilter").addEventListener("input", renderDictionary);
    $("#clearDict").addEventListener("click", () => save({ dictionary: [] }));
    $("#dictExport").addEventListener("click", () => {
        const blob = new Blob([[...settings.dictionary].sort().join("\n") + "\n"], { type: "text/plain" });
        const link = el("a", { href: URL.createObjectURL(blob), download: "aria-odl-dictionnaire.txt" });
        link.click();
        URL.revokeObjectURL(link.href);
    });
    $("#dictImport").addEventListener("change", async (event) => {
        const [file] = event.target.files;
        event.target.value = "";
        if (!file) {
            return;
        }
        if (file.size > 2_000_000) {
            setDictStatus("Fichier trop gros.", "ko");
            return;
        }
        await addWords(await file.text());
    });

    const range = $("#debounceMs");
    Object.assign(range, { min: DEBOUNCE_RANGE.min, max: DEBOUNCE_RANGE.max, step: DEBOUNCE_RANGE.step });
    range.addEventListener("input", () => {
        $("#debounceValue").textContent = `${range.value} ms`;
    });
    range.addEventListener("change", () => save({ debounceMs: Number(range.value) }));

    $("#liveEnabled").addEventListener("change", (e) => save({ liveEnabled: e.target.checked }));
    $("#hideNativeSpellcheck").addEventListener("change", (e) => save({ hideNativeSpellcheck: e.target.checked }));

    const dialect = $("#englishDialect");
    for (const [value, label] of Object.entries(DIALECTS)) {
        dialect.append(el("option", { value, textContent: label }));
    }
    dialect.addEventListener("change", () => save({ englishDialect: dialect.value }));

    for (const kind of KINDS) {
        const box = el("input", { type: "checkbox", id: `kind-${kind}` });
        box.addEventListener("change", () => {
            const disabled = new Set(settings.disabledKinds);
            box.checked ? disabled.delete(kind) : disabled.add(kind);
            save({ disabledKinds: [...disabled] });
        });
        $("#kinds").append(el("label", {}, box, KIND_LABELS[kind]));
    }

    for (const kind of Object.keys(DEFAULT_COLORS)) {
        const input = el("input", { type: "color", id: `color-${kind}` });
        input.addEventListener("change", () => save({ colors: { ...settings.colors, [kind]: input.value } }));
        $("#colors").append(el("label", {}, input, COLOR_LABELS[kind]));
    }
    $("#resetColors").addEventListener("click", () => save({ colors: { ...DEFAULT_COLORS } }));

    $("#clearIgnored").addEventListener("click", () => save({ ignored: [] }));

    $("#export").addEventListener("click", () => {
        const data = { app: "Aria ODL", version: chrome.runtime.getManifest().version, exportedAt: new Date().toISOString(), settings };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const link = el("a", { href: URL.createObjectURL(blob), download: `aria-odl-reglages-${new Date().toISOString().slice(0, 10)}.json` });
        link.click();
        URL.revokeObjectURL(link.href);
        setStatus("Fichier exporté.", "ok");
    });

    $("#import").addEventListener("change", async (event) => {
        const [file] = event.target.files;
        event.target.value = "";
        if (!file) {
            return;
        }
        try {
            if (file.size > 5_000_000) {
                throw new Error("fichier trop gros");
            }
            const data = JSON.parse(await file.text());
            const clean = sanitize(data?.settings ?? data);
            const keys = Object.keys(clean);
            if (keys.length === 0) {
                throw new Error("aucun réglage d'Aria ODL reconnu");
            }
            await save(clean);
            setStatus(`Importé : ${keys.length} réglage${keys.length > 1 ? "s" : ""}.`, "ok");
        } catch (error) {
            setStatus(`Import impossible : ${error.message}`, "ko");
        }
    });
}

function setStatus(text, kind) {
    const status = $("#ioStatus");
    status.textContent = text;
    status.className = `status ${kind}`;
}

// Réglages modifiés ailleurs (popup, « Ignorer » dans une page…) : on suit en direct.
chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === "local") {
        settings = await loadSettings();
        render();
    }
});

build();
render();
