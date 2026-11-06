// Aria Plume — panneau du complément Office (Word, puis Outlook).
// Quatre onglets : Correction, Traduction, Synonymes, Conjugaison. Tout passe par le moteur de
// l'application (api.js) ; ce qui touche au document passe par l'adaptateur de l'hôte :
//   host.name, host.scopes [{ id, label }], host.readBlocks(scope) → [{ index, text }],
//   host.select(block, match), host.replace(block, edits) → { text, done },
//   host.selectionText(), host.selectionContext(), host.writeSelection(text, "Replace" | "After"),
//   host.annotations (facultatif : soulignés dans le texte), host.readAll() (vérification en direct)
// Facultatifs, selon ce que l'hôte sait faire (Outlook en lecture : ni correction, ni sélection,
// ni écriture) : host.tabs (onglets montrés, dans l'ordre), host.translateSource ({ label, read }
// → { text, note } : ce que « Traduire » prend à la place de la sélection), host.notice (message
// d'accueil). Sans host.writeSelection : pas de « Remplacer » ni « Insérer » ; sans
// host.selectionText : pas de « Mot sélectionné ».

import { call } from "./api.js";

const KINDS = {
    orthographe: "Orthographe",
    grammaire: "Grammaire",
    style: "Style",
    typographie: "Typographie",
};
const FIXABLE = new Set(["orthographe", "grammaire"]);
const CONCURRENCY = 4;
const LIVE_DELAY_MS = 900;
const UNDERLINE_KEY = "aria-plume.souligner";
const MAX_LISTED = 300;

const el = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
        if (key === "dataset") {
            Object.assign(node.dataset, value);
        } else if (key in node) {
            node[key] = value;
        } else {
            node.setAttribute(key, value);
        }
    }
    node.append(...children.filter((child) => child !== null && child !== undefined && child !== false));
    return node;
};

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // Presse-papiers refusé dans la vue d'Office : copie à l'ancienne.
        const area = el("textarea", { value: text, readOnly: true, className: "offscreen" });
        document.body.append(area);
        area.select();
        const ok = document.execCommand("copy");
        area.remove();
        return ok;
    }
}

// Thème d'Office (clair ou sombre), sinon celui du système.
function applyTheme() {
    const color = globalThis.Office?.context?.officeTheme?.bodyBackgroundColor;
    if (typeof color === "string" && /^#?[0-9a-f]{6}$/i.test(color)) {
        const hex = color.replace("#", "");
        const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
        document.documentElement.dataset.theme = 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.5 ? "dark" : "light";
    }
}

export async function createPanel({ host, root }) {
    applyTheme();
    const notice = el("p", { className: "notice", id: "notice", hidden: true });
    notice.setAttribute("aria-live", "polite");
    function say(text, tone = "info") {
        notice.textContent = text;
        notice.className = `notice ${tone}`;
        notice.hidden = !text;
    }
    const fail = (error) => say(String(error?.message ?? error), "error");

    // --- En-tête et onglets ---
    const version = el("span", { className: "tag", id: "version" });
    const tabs = {};
    const panels = {};
    const tabBar = el("div", { className: "tabs", role: "tablist" });
    const shown = host.tabs ?? ["fix", "translate", "synonyms", "conj"];
    for (const [id, label] of [["fix", "Correction"], ["translate", "Traduction"], ["synonyms", "Synonymes"], ["conj", "Conjugaison"]]) {
        tabs[id] = el("button", { type: "button", role: "tab", id: `tab-${id}`, textContent: label, "aria-selected": "false", hidden: !shown.includes(id) });
        panels[id] = el("section", { id: `panel-${id}`, role: "tabpanel", hidden: true });
        tabs[id].addEventListener("click", () => showTab(id));
        tabBar.append(tabs[id]);
    }
    function showTab(id) {
        for (const key of Object.keys(tabs)) {
            tabs[key].setAttribute("aria-selected", String(key === id));
            panels[key].hidden = key !== id;
        }
        say("");
    }
    root.replaceChildren(
        el("header", {},
            el("span", { className: "brand" }, el("img", { src: "icons/icon-32.png", width: 20, height: 20, alt: "" }), "Aria Plume"),
            version),
        tabBar,
        notice,
        ...Object.values(panels),
    );
    // host : l'application note que ce complément sert (« Utilisé dans Outlook » dans ses réglages).
    call("ping", { host: host.name }).then(({ version: v }) => {
        version.textContent = `${host.name} · ${v}`;
    }).catch(fail);

    // --- Correction ---
    let items = [];
    const scopes = host.scopes ?? [];
    let lastScope = scopes[0]?.id ?? null;
    let busy = false;
    const lang = el("select", { id: "fix-lang", "aria-label": "Langue du texte" },
        el("option", { value: "auto", textContent: "Langue : auto" }),
        el("option", { value: "fr", textContent: "Français" }),
        el("option", { value: "en", textContent: "Anglais" }));
    const scopeButtons = scopes.map(({ id, label }) => {
        const button = el("button", { type: "button", className: id === lastScope ? "primary" : "", textContent: label, dataset: { scope: id } });
        button.addEventListener("click", () => runCheck(id));
        return button;
    });
    const fixAll = el("button", { type: "button", id: "fix-all", textContent: "Tout corriger", disabled: true });
    const summary = el("p", { className: "summary", id: "fix-summary", textContent: "Lance une vérification." });
    summary.setAttribute("aria-live", "polite");
    const list = el("ol", { className: "items", id: "fix-list" });
    // Soulignés dans le texte (Word avec Microsoft 365) : préférence gardée par cet ordinateur.
    let underlineWanted = true;
    try {
        underlineWanted = localStorage.getItem(UNDERLINE_KEY) !== "non";
    } catch {
        // Stockage indisponible : soulignés activés.
    }
    let annotations = host.annotations ?? null;
    const underlineBox = el("input", { type: "checkbox", id: "fix-underline", checked: underlineWanted });
    const underlineRow = annotations
        ? el("label", { className: "check", title: "Les fautes sont soulignées dans le document et chaque paragraphe modifié est revérifié." }, underlineBox, "Souligner dans le texte, vérifier pendant la frappe")
        : null;
    panels.fix.append(el("div", { className: "row" }, ...scopeButtons), el("div", { className: "row" }, lang, fixAll), underlineRow, summary, list);
    const underlining = () => !!annotations && underlineBox.checked;

    const setBusy = (value) => {
        busy = value;
        for (const button of [...scopeButtons, fixAll]) {
            button.disabled = value || (button === fixAll && !items.some(fixable));
        }
    };
    const fixable = (item) => FIXABLE.has(item.match.kind) && item.match.suggestions.length > 0;
    const wordOf = (item) => item.block.text.slice(item.match.start, item.match.end);

    // Dernier texte analysé de chaque paragraphe (vérification en direct : un paragraphe signalé par
    // Word mais inchangé n'est pas revérifié, ce qui évite toute boucle).
    const knownText = new Map();

    async function checkBlock(block) {
        const result = await call("check", { text: block.text, lang: lang.value, personal: true });
        if (block.id) {
            knownText.set(block.id, block.text);
        }
        return result.matches.map((match) => ({ block, match, lang: result.lang }));
    }

    // Soulignés des paragraphes donnés (all : tout le document, les autres perdent les leurs).
    async function underline(blocks, { all = false } = {}) {
        if (!underlining()) {
            return;
        }
        const groups = blocks.filter((block) => block.id).map((block) => ({ block, items: items.filter((item) => item.block === block) }));
        try {
            await annotations.show(groups, { all });
        } catch (error) {
            // Sans abonnement Microsoft 365, Word refuse les annotations : on garde la liste seule.
            console.warn("Aria Plume : soulignés indisponibles", error);
            annotations = null;
            underlineRow?.remove();
            say("Les soulignés dans le texte demandent Word avec un abonnement Microsoft 365 : la liste du panneau reste disponible.", "warn");
        }
    }

    underlineBox.addEventListener("change", async () => {
        try {
            localStorage.setItem(UNDERLINE_KEY, underlineBox.checked ? "oui" : "non");
        } catch {
            // Préférence non gardée : sans conséquence.
        }
        if (!annotations) {
            return;
        }
        if (underlineBox.checked) {
            await underline([...new Set(items.map((item) => item.block))], { all: true });
        } else {
            await annotations.clear().catch(() => {});
        }
    });

    // keepNotice : garder le message affiché (nouvelle vérification après un document modifié).
    async function runCheck(scope, { keepNotice = false } = {}) {
        if (busy) {
            return;
        }
        lastScope = scope;
        setBusy(true);
        if (!keepNotice) {
            say("");
        }
        list.replaceChildren();
        try {
            summary.textContent = "Lecture du document…";
            const blocks = (await host.readBlocks(scope)).filter((block) => block.text.trim());
            if (!blocks.length) {
                items = [];
                summary.textContent = scope === "selection" ? "Rien de sélectionné : sélectionne du texte dans le document." : "Le document est vide.";
                return;
            }
            const found = new Array(blocks.length);
            let next = 0;
            let done = 0;
            const worker = async () => {
                while (next < blocks.length) {
                    const i = next++;
                    found[i] = await checkBlock(blocks[i]);
                    done++;
                    summary.textContent = `Analyse… ${done}/${blocks.length} paragraphe${blocks.length > 1 ? "s" : ""}`;
                }
            };
            await Promise.all(Array.from({ length: Math.min(CONCURRENCY, blocks.length) }, worker));
            items = found.flat();
            render();
            await underline(blocks, { all: scope === "document" });
        } catch (error) {
            summary.textContent = "";
            fail(error);
        } finally {
            setBusy(false);
        }
    }

    function render() {
        const count = items.length;
        const fixes = items.filter(fixable).length;
        summary.textContent = count === 0
            ? "Aucune faute ✓"
            : `${count} remarque${count > 1 ? "s" : ""}${fixes && fixes !== count ? `, dont ${fixes} faute${fixes > 1 ? "s" : ""} à corriger d'un clic` : ""}.`;
        list.replaceChildren(...items.slice(0, MAX_LISTED).map(renderItem));
        if (count > MAX_LISTED) {
            list.append(el("li", { className: "more", textContent: `… et ${count - MAX_LISTED} autres : corrige celles-ci, puis relance la vérification.` }));
        }
        fixAll.disabled = busy || fixes === 0;
    }

    const rows = new WeakMap();
    function renderItem(item) {
        const { match } = item;
        const word = wordOf(item);
        const goto = el("button", { type: "button", className: "goto", title: "Montrer dans le document" },
            el("span", { className: "word", textContent: word.length > 60 ? `${word.slice(0, 57)}…` : word }),
            el("span", { className: "kind", textContent: KINDS[match.kind] ?? match.kind }));
        goto.addEventListener("click", () => show(item));
        const suggestions = match.suggestions.slice(0, 5).map((suggestion) => {
            const button = el("button", { type: "button", className: "sugg", textContent: suggestion || "(supprimer)" });
            button.addEventListener("click", () => apply([item], [suggestion]));
            return button;
        });
        const ignore = el("button", { type: "button", className: "link", textContent: "Ignorer" });
        ignore.addEventListener("click", () => ignoreItem(item));
        const learn = match.kind === "orthographe"
            ? el("button", { type: "button", className: "link", textContent: "Ajouter au dictionnaire" })
            : null;
        learn?.addEventListener("click", () => learnWord(item));
        const row = el("li", { className: `item kind-${match.kind}` },
            goto,
            el("p", { className: "msg", textContent: match.message }),
            suggestions.length ? el("div", { className: "suggs" }, ...suggestions) : null,
            el("div", { className: "actions" }, ignore, learn));
        rows.set(item, row);
        return row;
    }

    async function show(item) {
        try {
            if (!await host.select(item.block, item.match)) {
                say("Passage introuvable dans le document (texte modifié ?) : relance la vérification.", "warn");
            }
        } catch (error) {
            await handleChanged(error);
        }
    }

    // Le document a changé depuis l'analyse : on relance la vérification.
    async function handleChanged(error) {
        if (error?.name === "ChangedError" || /a changé/.test(String(error?.message))) {
            say("Le document a changé depuis l'analyse : nouvelle vérification, rien n'a été modifié.", "warn");
            await runCheck(lastScope, { keepNotice: true });
        } else {
            fail(error);
        }
    }

    // Applique des corrections (une par élément), paragraphe par paragraphe, puis réanalyse ces
    // paragraphes.
    async function apply(selected, replacements) {
        if (busy) {
            return;
        }
        setBusy(true);
        say("");
        try {
            const byBlock = new Map();
            selected.forEach((item, i) => {
                const edits = byBlock.get(item.block) ?? [];
                edits.push({ start: item.match.start, end: item.match.end, replacement: replacements[i], item });
                byBlock.set(item.block, edits);
            });
            let done = 0;
            const mistakes = [];
            for (const [block, edits] of byBlock) {
                // Passages qui se chevauchent : seul le premier est corrigé.
                edits.sort((a, b) => a.start - b.start);
                const kept = edits.filter((edit, i) => i === 0 || edit.start >= edits[i - 1].end);
                const result = await host.replace(block, kept);
                done += result.done;
                mistakes.push(...kept.map(({ item, replacement }) => ({ rule: item.match.rule, kind: item.match.kind, lang: item.lang, word: wordOf(item), suggestion: replacement })));
                const fresh = { index: block.index, text: result.text, id: block.id };
                const rechecked = fresh.text.trim() ? await checkBlock(fresh) : [];
                const position = items.findIndex((item) => item.block === block);
                items = items.filter((item) => item.block !== block);
                items.splice(position < 0 ? items.length : position, 0, ...rechecked);
                await underline([fresh]);
            }
            call("record-mistakes", { items: mistakes }).catch(() => {});
            render();
            if (done < selected.length) {
                say(`${done} correction${done > 1 ? "s" : ""} sur ${selected.length} : les autres passages n'ont pas été retrouvés tels quels.`, "warn");
            }
        } catch (error) {
            setBusy(false);
            await handleChanged(error);
            return;
        } finally {
            setBusy(false);
        }
    }

    fixAll.addEventListener("click", () => {
        const selected = items.filter(fixable);
        apply(selected, selected.map((item) => item.match.suggestions[0]));
    });

    async function ignoreItem(item) {
        const word = wordOf(item);
        try {
            const { values } = await call("settings-get", { spec: { ignored: [] } });
            await call("settings-set", { values: { ignored: [...values.ignored, { word, rule: item.match.rule, kind: item.match.kind }] } });
            const touched = new Set(items.filter((other) => wordOf(other) === word && other.match.rule === item.match.rule).map((other) => other.block));
            items = items.filter((other) => !(wordOf(other) === word && other.match.rule === item.match.rule));
            render();
            await underline([...touched]);
        } catch (error) {
            fail(error);
        }
    }

    async function learnWord(item) {
        const word = wordOf(item).trim();
        try {
            const { values } = await call("settings-get", { spec: { dictionary: [] } });
            if (!values.dictionary.includes(word)) {
                await call("settings-set", { values: { dictionary: [...values.dictionary, word] } });
            }
            const touched = new Set(items.filter((other) => other.match.kind === "orthographe" && wordOf(other).trim() === word).map((other) => other.block));
            items = items.filter((other) => !(other.match.kind === "orthographe" && wordOf(other).trim() === word));
            render();
            await underline([...touched]);
            say(`« ${word} » ajouté au dictionnaire.`, "ok");
        } catch (error) {
            fail(error);
        }
    }

    // --- Vérification en direct (Word avec Microsoft 365) ---
    // Word signale les paragraphes modifiés, ajoutés ou supprimés ; un peu après la dernière frappe,
    // les paragraphes dont le texte a vraiment changé sont revérifiés et soulignés.
    const pending = new Set();
    let liveTimer = null;
    function scheduleLive(ids) {
        if (!underlining()) {
            return;
        }
        ids.forEach((id) => pending.add(id));
        clearTimeout(liveTimer);
        liveTimer = setTimeout(liveRefresh, LIVE_DELAY_MS);
    }

    async function liveRefresh() {
        if (busy) {
            liveTimer = setTimeout(liveRefresh, LIVE_DELAY_MS);
            return;
        }
        const ids = [...pending];
        pending.clear();
        if (!ids.length || !underlining()) {
            return;
        }
        try {
            const all = await host.readAll();
            const byId = new Map(all.filter((block) => block.id).map((block) => [block.id, block]));
            // Positions à jour (paragraphes ajoutés ou supprimés plus haut) ; paragraphes disparus retirés.
            items = items.filter((item) => !item.block.id || byId.has(item.block.id));
            for (const item of items) {
                if (item.block.id) {
                    item.block.index = byId.get(item.block.id).index;
                }
            }
            const changed = ids.map((id) => byId.get(id)).filter((block) => block && block.text !== knownText.get(block.id));
            for (const block of changed) {
                const rechecked = block.text.trim() ? await checkBlock(block) : [];
                items = items.filter((item) => item.block.id !== block.id).concat(rechecked);
            }
            items.sort((a, b) => a.block.index - b.block.index || a.match.start - b.match.start);
            render();
            await underline(changed);
        } catch (error) {
            fail(error);
        }
    }

    if (annotations) {
        annotations.listen({
            // Bulle de Word : suggestion acceptée (Word corrige le texte, la frappe est revérifiée)
            // ou remarque écartée.
            onPopup: async (args, item) => {
                if (!item) {
                    return;
                }
                if (args.action === "Accept") {
                    call("record-mistakes", { items: [{ rule: item.match.rule, kind: item.match.kind, lang: item.lang, word: wordOf(item), suggestion: args.critiqueSuggestion ?? "" }] }).catch(() => {});
                } else {
                    items = items.filter((other) => other !== item);
                    render();
                }
            },
            // Clic sur un souligné : la remarque correspondante dans le panneau.
            onClick: (item) => {
                const row = item ? rows.get(item) : null;
                if (!row) {
                    return;
                }
                showTab("fix");
                list.querySelectorAll(".item.focus").forEach((other) => other.classList.remove("focus"));
                row.classList.add("focus");
                row.scrollIntoView({ block: "nearest" });
            },
            onParagraphs: (ids) => scheduleLive(ids),
        }).catch((error) => console.warn("Aria Plume : événements de Word indisponibles", error));
    }

    // --- Traduction ---
    let forcedFrom = null;
    const source = el("textarea", { id: "tr-source", rows: 4, placeholder: "Sélectionne du texte dans le document, ou écris ici…", spellcheck: false });
    const target = el("textarea", { id: "tr-target", rows: 4, spellcheck: false });
    const direction = el("span", { className: "direction", id: "tr-direction", textContent: "FR ⇄ EN" });
    const grab = el("button", { type: "button", className: "primary", id: "tr-grab", textContent: "Traduire la sélection" });
    const go = el("button", { type: "button", id: "tr-go", textContent: "Traduire" });
    const swap = el("button", { type: "button", id: "tr-swap", textContent: "⇄", title: "Inverser le sens" });
    const replaceSel = el("button", { type: "button", id: "tr-replace", textContent: "Remplacer la sélection" });
    const insertSel = el("button", { type: "button", id: "tr-insert", textContent: "Insérer après" });
    const copyTr = el("button", { type: "button", id: "tr-copy", textContent: "Copier" });
    panels.translate.append(
        el("div", { className: "row" }, grab, go),
        source,
        el("div", { className: "row" }, direction, swap),
        target,
        el("div", { className: "row" }, replaceSel, insertSel, copyTr));

    // note : remarque sur ce qui est traduit (historique laissé de côté…), gardée affichée.
    async function translate(note = "") {
        const text = source.value;
        if (!text.trim()) {
            say("Rien à traduire.", "warn");
            return;
        }
        say(typeof note === "string" ? note : "", "info");
        target.value = "Traduction…";
        try {
            const result = await call("translate", { text, from: forcedFrom ?? "auto" });
            target.value = result.text;
            direction.textContent = `${result.from.toUpperCase()} → ${result.to.toUpperCase()}`;
            direction.dataset.from = result.from;
        } catch (error) {
            target.value = "";
            fail(error);
        }
    }
    if (host.translateSource) {
        grab.textContent = host.translateSource.label;
    }
    if (!host.writeSelection) {
        replaceSel.hidden = true;
        insertSel.hidden = true;
    }
    grab.addEventListener("click", async () => {
        try {
            const { text, note } = host.translateSource ? await host.translateSource.read() : { text: await host.selectionText(), note: "" };
            if (!text.trim()) {
                say(host.translateSource ? "Rien à traduire dans ce message." : "Rien de sélectionné dans le document.", "warn");
                return;
            }
            source.value = text;
            forcedFrom = null;
            await translate(note);
        } catch (error) {
            fail(error);
        }
    });
    go.addEventListener("click", () => translate());
    swap.addEventListener("click", () => {
        const from = direction.dataset.from;
        forcedFrom = from === "fr" ? "en" : from === "en" ? "fr" : null;
        if (target.value && !target.value.endsWith("…")) {
            source.value = target.value;
        }
        translate();
    });
    async function write(where) {
        if (!target.value.trim()) {
            return;
        }
        try {
            await host.writeSelection(target.value, where);
            say(where === "Replace" ? "Sélection remplacée." : "Traduction insérée.", "ok");
        } catch (error) {
            fail(error);
        }
    }
    replaceSel.addEventListener("click", () => write("Replace"));
    insertSel.addEventListener("click", () => write("After"));
    copyTr.addEventListener("click", async () => say(await copyText(target.value) ? "Copié." : "Copie impossible : sélectionne le texte puis Ctrl+C.", "ok"));

    // --- Synonymes ---
    const synInput = el("input", { type: "text", id: "syn-word", placeholder: "Un mot", spellcheck: false });
    const synGrab = el("button", { type: "button", className: "primary", id: "syn-grab", textContent: "Mot sélectionné" });
    const synGo = el("button", { type: "button", id: "syn-go", textContent: "Chercher" });
    const synList = el("div", { className: "groups", id: "syn-list" });
    synGrab.hidden = !host.selectionText;
    panels.synonyms.append(el("div", { className: "row" }, synGrab), el("div", { className: "row" }, synInput, synGo), synList);
    let synSelection = null;
    let synContext = "";

    async function synonyms() {
        const word = synInput.value.trim();
        if (!word) {
            return;
        }
        say("");
        synList.replaceChildren(el("p", { className: "summary", textContent: "Recherche…" }));
        try {
            const result = await call("synonyms", { word, context: synContext });
            if (!result.groups?.length) {
                synList.replaceChildren(el("p", { className: "summary", textContent: `Pas de synonyme pour « ${word} ».` }));
                return;
            }
            synList.replaceChildren(...result.groups.map((group) => el("div", { className: "group" },
                el("h4", { textContent: group.pos }),
                el("div", { className: "suggs" }, ...group.words.map((synonym) => {
                    const button = el("button", { type: "button", className: "sugg", textContent: synonym });
                    button.addEventListener("click", () => useSynonym(word, synonym));
                    return button;
                })))));
        } catch (error) {
            synList.replaceChildren();
            fail(error);
        }
    }
    // Remplace le mot dans le document s'il est toujours sélectionné, sinon copie le synonyme.
    async function useSynonym(word, synonym) {
        try {
            const current = await host.selectionText();
            if (synSelection !== null && current === synSelection && current.trim() === word) {
                const replaced = current.replace(word, synonym);
                await host.writeSelection(replaced, "Replace");
                synSelection = replaced;
                synInput.value = synonym;
                say(`« ${word} » → « ${synonym} ».`, "ok");
                return;
            }
        } catch {
            // Pas de sélection lisible : on copie.
        }
        say(await copyText(synonym) ? `« ${synonym} » copié.` : synonym, "ok");
    }
    synGrab.addEventListener("click", async () => {
        try {
            const text = await host.selectionText();
            const word = text.trim();
            if (!word || word.split(/\s+/).length > 3) {
                say("Sélectionne un mot (ou deux, trois) dans le document.", "warn");
                return;
            }
            synSelection = text;
            synContext = await host.selectionContext().catch(() => "");
            synInput.value = word;
            await synonyms();
        } catch (error) {
            fail(error);
        }
    });
    synGo.addEventListener("click", () => {
        synSelection = null;
        synContext = "";
        synonyms();
    });
    synInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            synSelection = null;
            synContext = "";
            synonyms();
        }
    });

    // --- Conjugaison ---
    const conjInput = el("input", { type: "text", id: "conj-verb", placeholder: "Un verbe (prendre, prenons…)", spellcheck: false });
    const conjGo = el("button", { type: "button", className: "primary", id: "conj-go", textContent: "Conjuguer" });
    const OPTIONS = [["negative", "Négation"], ["interrogative", "Question"], ["compound", "Temps composés"], ["pronominal", "Pronominal"], ["feminine", "Féminin"]];
    const boxes = OPTIONS.map(([key, label]) => {
        const box = el("input", { type: "checkbox", dataset: { option: key } });
        box.addEventListener("change", conjugate);
        return el("label", { className: "check" }, box, label);
    });
    const conjOut = el("div", { className: "conj", id: "conj-out" });
    panels.conj.append(el("div", { className: "row" }, conjInput, conjGo), el("div", { className: "options" }, ...boxes), conjOut);

    async function conjugate() {
        const verb = conjInput.value.trim();
        if (!verb) {
            return;
        }
        const options = Object.fromEntries(boxes.map((label) => {
            const box = label.querySelector("input");
            return [box.dataset.option, box.checked];
        }));
        say("");
        try {
            const result = await call("conjugate", { verb, options });
            if (!result.found) {
                conjOut.replaceChildren(
                    el("p", { className: "summary", textContent: `« ${verb} » : verbe inconnu.${result.suggestions?.length ? " Tu voulais dire :" : ""}` }),
                    el("div", { className: "suggs" }, ...(result.suggestions ?? []).map((suggestion) => {
                        const button = el("button", { type: "button", className: "sugg", textContent: suggestion });
                        button.addEventListener("click", () => {
                            conjInput.value = suggestion;
                            conjugate();
                        });
                        return button;
                    })));
                return;
            }
            conjOut.replaceChildren(
                el("p", { className: "summary" }, el("strong", { textContent: result.infinitive }), ` · ${result.info}`),
                ...result.moods.map((mood) => el("div", { className: "mood" },
                    el("h4", { textContent: mood.name }),
                    ...mood.tenses.map((tense) => el("div", { className: "tense" },
                        el("h5", { textContent: tense.name }),
                        el("ul", {}, ...tense.forms.map((form) => el("li", { textContent: form }))))))));
        } catch (error) {
            fail(error);
        }
    }
    conjGo.addEventListener("click", conjugate);
    conjInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            conjugate();
        }
    });

    showTab(shown[0]);
    if (host.notice) {
        say(host.notice, "info");
    }
    // Avec les soulignés, le document est vérifié dès l'ouverture du panneau.
    if (underlining()) {
        runCheck("document");
    }
    return { runCheck, showTab };
}
