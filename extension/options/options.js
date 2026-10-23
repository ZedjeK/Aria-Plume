// Aria Plume — page de réglages. Tout est enregistré dès le changement, dans le stockage
// local du navigateur ; l'export produit un fichier JSON sur ton PC, rien n'est envoyé.
import { topMistakes } from "../shared/mistakes.js";
import { DEFAULTS, DEFAULT_COLORS, DIALECTS, KINDS, DEBOUNCE_RANGE, MAX_DICTIONARY, MAX_GLOSSARY, REPETITION_RANGE, cleanHost, sanitize, splitWords, cleanTerm, loadSettings } from "../shared/settings.js";

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
    $("#formalFrench").checked = settings.formalFrench;
    $("#trackMistakes").checked = settings.trackMistakes;
    $("#reviewBeforeSend").checked = settings.reviewBeforeSend;
    renderMistakes();
    $("#repetitions").checked = settings.repetitions;
    $("#repetitionDistance").value = settings.repetitionDistance;
    $("#repetitionDistance").disabled = !settings.repetitions;
    $("#repetitionRow").classList.toggle("disabled", !settings.repetitions);
    $("#repetitionValue").textContent = `${settings.repetitionDistance} mots`;
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
    renderGlossary();

    $("#ignoredCount").textContent = settings.ignored.length;
    $("#ignored").replaceChildren(...settings.ignored.map((entry, index) => {
        const remove = el("button", { textContent: "×", title: "Signaler de nouveau" });
        remove.setAttribute("aria-label", `Ne plus ignorer « ${entry.word} »`);
        remove.addEventListener("click", () => save({ ignored: settings.ignored.filter((_, i) => i !== index) }));
        return el("li", {}, el("span", { className: "word", textContent: entry.word }), el("span", { className: "meta", textContent: `${KIND_LABELS[entry.kind] ?? entry.kind} · ${entry.rule}` }), remove);
    }));
    $("#clearIgnored").disabled = settings.ignored.length === 0;

    for (const [key, other, list, count] of [["formalHosts", "casualHosts", "#formalHosts", "#formalCount"], ["casualHosts", "formalHosts", "#casualHosts", "#casualCount"]]) {
        $(count).textContent = settings[key].length;
        $(list).replaceChildren(...[...settings[key]].sort().map((host) => {
            const remove = el("button", { textContent: "×", title: "Retirer ce site" });
            remove.setAttribute("aria-label", `Retirer ${host}`);
            remove.addEventListener("click", () => save({ [key]: settings[key].filter((h) => h !== host) }));
            return el("li", {}, el("span", { className: "word", textContent: host }), remove);
        }));
    }

    $("#hostsCount").textContent = settings.disabledHosts.length;
    $("#hosts").replaceChildren(...settings.disabledHosts.map((host) => {
        const remove = el("button", { textContent: "×", title: "Réactiver sur ce site" });
        remove.setAttribute("aria-label", `Réactiver sur ${host}`);
        remove.addEventListener("click", () => save({ disabledHosts: settings.disabledHosts.filter((h) => h !== host) }));
        return el("li", {}, el("span", { className: "word", textContent: host }), el("span", { className: "meta" }), remove);
    }));
}

async function renderMistakes() {
    const { mistakeStats, mistakeStatsSince } = await chrome.storage.local.get({ mistakeStats: {}, mistakeStatsSince: null });
    const top = topMistakes(mistakeStats, 5);
    $("#mistakes").replaceChildren(...top.map((entry) => el("li", {},
        el("div", { className: "mistake-head" },
            el("strong", { textContent: entry.label }),
            el("span", { className: "mistake-count", textContent: `${entry.count} fois` })),
        el("div", { className: "mistake-examples", textContent: entry.examples.map((e) => `${e.from} → ${e.to || "(supprimé)"}`).join("   ·   ") }),
        el("div", { className: "mistake-rule", textContent: entry.rule }),
    )));
    const total = Object.values(mistakeStats).reduce((sum, e) => sum + (e?.count ?? 0), 0);
    $("#mistakesSince").textContent = mistakeStatsSince && total
        ? `${total} correction${total > 1 ? "s" : ""} comptée${total > 1 ? "s" : ""} depuis le ${new Date(mistakeStatsSince).toLocaleDateString("fr-FR")}.`
        : "";
    $("#clearMistakes").disabled = total === 0;
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

function renderGlossary() {
    const pairs = [...settings.glossary].sort((a, b) => a.fr.localeCompare(b.fr, "fr", { sensitivity: "base" }));
    $("#glossaryCount").textContent = settings.glossary.length;
    $("#glossary").replaceChildren(...pairs.map((pair) => {
        const remove = el("button", { textContent: "×", title: "Retirer du glossaire" });
        remove.setAttribute("aria-label", `Retirer « ${pair.fr} ↔ ${pair.en} » du glossaire`);
        remove.addEventListener("click", () => save({ glossary: settings.glossary.filter((p) => p.fr !== pair.fr || p.en !== pair.en) }));
        return el("li", {}, el("span", { className: "pair-fr", textContent: pair.fr }), el("span", { className: "pair-sep", textContent: "↔" }), el("span", { className: "pair-en", textContent: pair.en }), remove);
    }));
    const terms = [...settings.keepTerms].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
    $("#keepCount").textContent = settings.keepTerms.length;
    $("#keepTerms").replaceChildren(...terms.map((term) => {
        const remove = el("button", { textContent: "×", title: "Laisser traduire ce terme" });
        remove.setAttribute("aria-label", `Retirer « ${term} » des termes à ne pas traduire`);
        remove.addEventListener("click", () => save({ keepTerms: settings.keepTerms.filter((t) => t !== term) }));
        return el("li", {}, el("span", { className: "word", textContent: term }), remove);
    }));
    $("#clearGlossary").disabled = settings.glossary.length === 0 && settings.keepTerms.length === 0;
}

function setGlossaryStatus(text, kind) {
    const status = $("#glossaryStatus");
    status.textContent = text;
    status.className = `status ${kind}`;
}

const INVALID_TERM = "Terme invalide : lettres, chiffres, apostrophe, point ou tiret, quatre mots et 60 caractères au plus.";

async function addPair(frText, enText) {
    const fr = cleanTerm(frText);
    const en = cleanTerm(enText);
    if (!fr || !en) {
        setGlossaryStatus(INVALID_TERM, "ko");
        return false;
    }
    // Un terme français n'a qu'une traduction imposée : la nouvelle remplace l'ancienne (idem côté anglais).
    const rest = settings.glossary.filter((p) => p.fr.toLowerCase() !== fr.toLowerCase() && p.en.toLowerCase() !== en.toLowerCase());
    const replaced = settings.glossary.length - rest.length;
    await save({ glossary: [...rest, { fr, en }].slice(-MAX_GLOSSARY) });
    setGlossaryStatus(replaced ? `« ${fr} ↔ ${en} » remplace l'ancienne traduction.` : `« ${fr} ↔ ${en} » ajouté.`, "ok");
    return true;
}

async function addKeepTerms(text) {
    const terms = [...new Set(String(text).split(/[,;\n]+/u).map(cleanTerm).filter(Boolean))];
    if (terms.length === 0) {
        setGlossaryStatus(INVALID_TERM, "ko");
        return false;
    }
    const known = new Set(settings.keepTerms.map((t) => t.toLowerCase()));
    const fresh = terms.filter((t) => !known.has(t.toLowerCase()));
    await save({ keepTerms: [...settings.keepTerms, ...fresh].slice(-MAX_GLOSSARY) });
    setGlossaryStatus(fresh.length ? `${fresh.length} terme${fresh.length > 1 ? "s" : ""} ajouté${fresh.length > 1 ? "s" : ""}.` : "Déjà dans la liste.", "ok");
    return true;
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

    $("#glossaryForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        if (await addPair($("#glossaryFr").value, $("#glossaryEn").value)) {
            $("#glossaryFr").value = "";
            $("#glossaryEn").value = "";
            $("#glossaryFr").focus();
        }
    });
    $("#keepForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        if (await addKeepTerms($("#keepInput").value)) {
            $("#keepInput").value = "";
        }
    });
    $("#clearGlossary").addEventListener("click", () => save({ glossary: [], keepTerms: [] }));
    $("#clearDict").addEventListener("click", () => save({ dictionary: [] }));
    $("#dictExport").addEventListener("click", () => {
        const blob = new Blob([[...settings.dictionary].sort().join("\n") + "\n"], { type: "text/plain" });
        const link = el("a", { href: URL.createObjectURL(blob), download: "aria-plume-dictionnaire.txt" });
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
    $("#formalFrench").addEventListener("change", (e) => save({ formalFrench: e.target.checked }));
    $("#trackMistakes").addEventListener("change", (e) => save({ trackMistakes: e.target.checked }));
    $("#reviewBeforeSend").addEventListener("change", (e) => save({ reviewBeforeSend: e.target.checked }));
    $("#clearMistakes").addEventListener("click", async () => {
        await chrome.storage.local.remove(["mistakeStats", "mistakeStatsSince"]);
        renderMistakes();
    });
    $("#repetitions").addEventListener("change", (e) => save({ repetitions: e.target.checked }));
    const distance = $("#repetitionDistance");
    Object.assign(distance, { min: REPETITION_RANGE.min, max: REPETITION_RANGE.max, step: REPETITION_RANGE.step });
    distance.addEventListener("input", () => {
        $("#repetitionValue").textContent = `${distance.value} mots`;
    });
    distance.addEventListener("change", () => save({ repetitionDistance: Number(distance.value) }));

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

    // Un site ne peut être que dans une des deux listes : l'ajouter à l'une le retire de l'autre.
    for (const [form, input, key, other] of [["#formalForm", "#formalInput", "formalHosts", "casualHosts"], ["#casualForm", "#casualInput", "casualHosts", "formalHosts"]]) {
        $(form).addEventListener("submit", async (event) => {
            event.preventDefault();
            const host = cleanHost($(input).value);
            const status = $("#hostStatus");
            if (!host) {
                status.textContent = "Adresse de site invalide (exemple : mail.google.com).";
                status.className = "status ko";
                return;
            }
            await save({ [key]: [...settings[key].filter((h) => h !== host), host], [other]: settings[other].filter((h) => h !== host) });
            $(input).value = "";
            status.textContent = `${host} ajouté.`;
            status.className = "status ok";
        });
    }

    $("#export").addEventListener("click", () => {
        const data = { app: "Aria Plume", version: chrome.runtime.getManifest().version, exportedAt: new Date().toISOString(), settings };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const link = el("a", { href: URL.createObjectURL(blob), download: `aria-plume-reglages-${new Date().toISOString().slice(0, 10)}.json` });
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
                throw new Error("aucun réglage d'Aria Plume reconnu");
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
