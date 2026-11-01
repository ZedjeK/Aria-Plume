// Aria Plume — panneau du complément Office (Word, puis Outlook).
// Quatre onglets : Correction, Traduction, Synonymes, Conjugaison. Tout passe par le moteur de
// l'application (api.js) ; ce qui touche au document passe par l'adaptateur de l'hôte :
//   host.name, host.scopes [{ id, label }], host.readBlocks(scope) → [{ index, text }],
//   host.select(block, match), host.replace(block, edits) → { text, done },
//   host.selectionText(), host.selectionContext(), host.writeSelection(text, "Replace" | "After")

import { call } from "./api.js";

const KINDS = {
    orthographe: "Orthographe",
    grammaire: "Grammaire",
    style: "Style",
    typographie: "Typographie",
};
const FIXABLE = new Set(["orthographe", "grammaire"]);
const CONCURRENCY = 4;
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
    for (const [id, label] of [["fix", "Correction"], ["translate", "Traduction"], ["synonyms", "Synonymes"], ["conj", "Conjugaison"]]) {
        tabs[id] = el("button", { type: "button", role: "tab", id: `tab-${id}`, textContent: label, "aria-selected": "false" });
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
    call("ping").then(({ version: v }) => {
        version.textContent = `${host.name} · ${v}`;
    }).catch(fail);

    // --- Correction ---
    let items = [];
    let lastScope = host.scopes[0].id;
    let busy = false;
    const lang = el("select", { id: "fix-lang", "aria-label": "Langue du texte" },
        el("option", { value: "auto", textContent: "Langue : auto" }),
        el("option", { value: "fr", textContent: "Français" }),
        el("option", { value: "en", textContent: "Anglais" }));
    const scopeButtons = host.scopes.map(({ id, label }) => {
        const button = el("button", { type: "button", className: id === host.scopes[0].id ? "primary" : "", textContent: label, dataset: { scope: id } });
        button.addEventListener("click", () => runCheck(id));
        return button;
    });
    const fixAll = el("button", { type: "button", id: "fix-all", textContent: "Tout corriger", disabled: true });
    const summary = el("p", { className: "summary", id: "fix-summary", textContent: "Lance une vérification." });
    summary.setAttribute("aria-live", "polite");
    const list = el("ol", { className: "items", id: "fix-list" });
    panels.fix.append(el("div", { className: "row" }, ...scopeButtons), el("div", { className: "row" }, lang, fixAll), summary, list);

    const setBusy = (value) => {
        busy = value;
        for (const button of [...scopeButtons, fixAll]) {
            button.disabled = value || (button === fixAll && !items.some(fixable));
        }
    };
    const fixable = (item) => FIXABLE.has(item.match.kind) && item.match.suggestions.length > 0;
    const wordOf = (item) => item.block.text.slice(item.match.start, item.match.end);

    async function checkBlock(block) {
        const result = await call("check", { text: block.text, lang: lang.value, personal: true });
        return result.matches.map((match) => ({ block, match, lang: result.lang }));
    }

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
        return el("li", { className: `item kind-${match.kind}` },
            goto,
            el("p", { className: "msg", textContent: match.message }),
            suggestions.length ? el("div", { className: "suggs" }, ...suggestions) : null,
            el("div", { className: "actions" }, ignore, learn));
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
                const fresh = { index: block.index, text: result.text };
                const rechecked = fresh.text.trim() ? await checkBlock(fresh) : [];
                const position = items.findIndex((item) => item.block === block);
                items = items.filter((item) => item.block !== block);
                items.splice(position < 0 ? items.length : position, 0, ...rechecked);
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
            items = items.filter((other) => !(wordOf(other) === word && other.match.rule === item.match.rule));
            render();
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
            items = items.filter((other) => !(other.match.kind === "orthographe" && wordOf(other).trim() === word));
            render();
            say(`« ${word} » ajouté au dictionnaire.`, "ok");
        } catch (error) {
            fail(error);
        }
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

    async function translate() {
        const text = source.value;
        if (!text.trim()) {
            say("Rien à traduire.", "warn");
            return;
        }
        say("");
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
    grab.addEventListener("click", async () => {
        try {
            const text = await host.selectionText();
            if (!text.trim()) {
                say("Rien de sélectionné dans le document.", "warn");
                return;
            }
            source.value = text;
            forcedFrom = null;
            await translate();
        } catch (error) {
            fail(error);
        }
    });
    go.addEventListener("click", translate);
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

    showTab("fix");
    return { runCheck, showTab };
}
