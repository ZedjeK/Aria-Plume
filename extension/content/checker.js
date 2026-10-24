// Aria Plume — script de page, présent sur tous les sites et dans tous les cadres.
//   - Correction en direct : soulignement des fautes 500 ms après la frappe, dans le champ actif.
//       · zones éditables (Gmail, Discord, claude.ai…) : API CSS Custom Highlight, sans toucher au HTML
//       · textarea / input : calque miroir posé par-dessus le champ
//   - Clic droit sur un mot souligné : infobulle de correction.
//   - Panneau complet à la demande (menu contextuel, Alt+Maj+V ou popup).
//   - Traduction français ↔ anglais : sélection ou champ (infobulle, Alt+Maj+L) et page entière.
// Toute l'analyse se fait dans l'extension : rien ne sort de la machine.

(() => {
    if (globalThis.__ariaOdl && !globalThis.__ariaOdlForce) {
        return;
    }
    // Réinjection forcée (extension rechargée) : on démonte l'ancienne instance.
    try {
        globalThis.__ariaOdl?.teardown();
    } catch {
        // ancienne instance déjà inutilisable
    }
    delete globalThis.__ariaOdlForce;

    // ---------------------------------------------------------------------
    // Constantes et état
    // ---------------------------------------------------------------------

    const PANEL_INPUT_TYPES = new Set(["text", "search", "email", "url", "tel"]);
    const BLOCK_TAGS = /^(ADDRESS|ARTICLE|ASIDE|BLOCKQUOTE|DD|DIV|DL|DT|FIELDSET|FIGCAPTION|FIGURE|FOOTER|FORM|H[1-6]|HEADER|HR|LI|MAIN|NAV|OL|P|PRE|SECTION|TABLE|TD|TH|TR|UL)$/;
    const SKIPPED_TAGS = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/;
    const CODE_EDITORS = ".monaco-editor, .CodeMirror, .cm-editor, .ace_editor";
    const SENSITIVE_AUTOCOMPLETE = /(cc-|one-time-code|password)/i;
    const KINDS = ["orthographe", "grammaire", "style", "typographie"];
    const CONTEXT_CHARS = 24;
    const MAX_LIVE_CHARS = 50000;
    // Copie de shared/settings.js (ce script n'est pas un module) : à garder alignée.
    const DEFAULT_COLORS = { orthographe: "#e5484d", grammaire: "#f59e0b", style: "#0ea5e9" };
    const DEFAULTS = {
        liveEnabled: true,
        disabledHosts: [],
        debounceMs: 500,
        disabledKinds: [],
        hideNativeSpellcheck: false,
        colors: DEFAULT_COLORS,
        ignored: [],
        dictionary: [],
        reviewBeforeSend: true,
    };
    const MAX_IGNORED = 2000;
    const COLOR = /^#[0-9a-f]{6}$/i;
    const prefs = {
        debounceMs: DEFAULTS.debounceMs,
        disabledKinds: new Set(),
        hideNativeSpellcheck: false,
        reviewBeforeSend: true,
    };
    const HIGHLIGHTS_SUPPORTED = typeof Highlight === "function" && !!globalThis.CSS?.highlights;

    // Mots ignorés : gardés dans les réglages, donc valables partout et après redémarrage.
    const ignored = new Set();
    const ignoreKey = (word, rule) => `${word}|${rule}`;
    const isIgnored = (word, rule) => ignored.has(ignoreKey(word, rule));
    // Dictionnaire personnel : un mot écrit en minuscules vaut pour toutes les casses
    // (« systemd », « Systemd »…) ; un mot avec des majuscules (« Elegoo ») garde les siennes,
    // ou passe tout en capitales.
    const dictionary = { lower: new Set(), exact: new Set() };
    function loadDictionary(words) {
        dictionary.lower.clear();
        dictionary.exact.clear();
        for (const word of Array.isArray(words) ? words : []) {
            if (typeof word === "string" && word.trim() !== "") {
                const w = word.trim();
                (w === w.toLowerCase() ? dictionary.lower : dictionary.exact).add(w);
            }
        }
    }
    function inDictionary(word) {
        const w = word.trim();
        if (dictionary.lower.has(w.toLowerCase()) || dictionary.exact.has(w)) {
            return true;
        }
        return [...dictionary.exact].some((entry) => entry.toUpperCase() === w);
    }
    async function addToDictionary(word) {
        const w = word.trim();
        (w === w.toLowerCase() ? dictionary.lower : dictionary.exact).add(w);
        try {
            const { dictionary: list } = await chrome.storage.local.get({ dictionary: [] });
            if (!list.includes(w)) {
                list.push(w);
                await chrome.storage.local.set({ dictionary: list.slice(-5000) });
            }
        } catch {
            // extension rechargée : le mot reste accepté sur cette page
        }
    }
    const canAddToDictionary = (match, word) => match.kind === "orthographe" && /^[\p{L}\p{N}][\p{L}\p{N}'’._-]{0,59}$/u.test(word.trim());

    const isHidden = (match, word) => isIgnored(word, match.rule)
        || prefs.disabledKinds.has(match.kind)
        || (match.kind === "orthographe" && inDictionary(word));

    async function addIgnored(word, rule, kind) {
        ignored.add(ignoreKey(word, rule));
        try {
            const { ignored: list } = await chrome.storage.local.get({ ignored: [] });
            if (!list.some((entry) => entry.word === word && entry.rule === rule)) {
                list.push({ word, rule, kind });
                await chrome.storage.local.set({ ignored: list.slice(-MAX_IGNORED) });
            }
        } catch {
            // extension rechargée : l'« Ignorer » reste valable pour cette page
        }
    }

    const cleanups = [];
    function listen(target, type, handler, options) {
        target.addEventListener(type, handler, options);
        cleanups.push(() => target.removeEventListener(type, handler, options));
    }

    function el(tag, props = {}, ...children) {
        const node = document.createElement(tag);
        Object.assign(node, props);
        node.append(...children);
        return node;
    }

    function sheet(css) {
        const result = new CSSStyleSheet();
        result.replaceSync(css);
        return result;
    }

    function extensionAlive() {
        try {
            return !!chrome.runtime?.id;
        } catch {
            return false;
        }
    }

    // Correction acceptée : comptée pour « tes fautes récurrentes » (réglages), sans attendre la réponse.
    function recordCorrections(items) {
        try {
            chrome.runtime.sendMessage({ target: "sw", cmd: "record-mistakes", items }).catch(() => {});
        } catch {
            // extension rechargée : tant pis pour cette correction
        }
    }

    const correction = (match, word, suggestion, lang) => ({ rule: match.rule, kind: match.kind, lang, word, suggestion });

    // Langue imposée par le champ (data-aria-lang="fr" ou "en", correcteur de la popup) ; sinon détection.
    function forcedLang(element) {
        const lang = element?.closest?.("[data-aria-lang]")?.getAttribute("data-aria-lang");
        return lang === "fr" || lang === "en" ? lang : "auto";
    }

    async function requestCheck(text, element = null) {
        try {
            return await chrome.runtime.sendMessage({ target: "sw", cmd: "check", lang: forcedLang(element), text });
        } catch (error) {
            return { ok: false, error: error.message };
        }
    }

    // ---------------------------------------------------------------------
    // Cibles : champ simple, zone éditable, sélection en lecture seule
    // ---------------------------------------------------------------------

    function isSensitive(element) {
        return element.type === "password"
            || SENSITIVE_AUTOCOMPLETE.test(element.getAttribute("autocomplete") ?? "")
            || element.getAttribute("data-aria-odl") === "off"
            || !!element.closest(CODE_EDITORS);
    }

    function editingHost(element) {
        let host = element;
        while (host.parentElement?.isContentEditable) {
            host = host.parentElement;
        }
        return host;
    }

    function shift(rect, ctx) {
        return {
            left: rect.left + ctx.offsetX,
            top: rect.top + ctx.offsetY,
            right: rect.right + ctx.offsetX,
            bottom: rect.bottom + ctx.offsetY,
        };
    }

    class FieldTarget {
        constructor(field, ctx) {
            this.el = field;
            this.ctx = ctx;
            this.editable = !field.readOnly && !field.disabled;
        }

        getText() {
            return this.el.value;
        }

        initialScope() {
            let start = null;
            let end = null;
            try {
                start = this.el.selectionStart;
                end = this.el.selectionEnd;
            } catch {
                // certains types d'input n'exposent pas la sélection
            }
            if (start !== null && end > start) {
                return { start, end, whole: false };
            }
            return { start: 0, end: this.el.value.length, whole: true };
        }

        // execCommand garde l'historique : Ctrl+Z annule la correction comme une frappe.
        replace(start, end, text) {
            const { el: field, ctx } = this;
            field.focus();
            field.setSelectionRange(start, end);
            const done = text === ""
                ? ctx.doc.execCommand("delete")
                : ctx.doc.execCommand("insertText", false, text);
            if (!done || field.value.slice(start, start + text.length) !== text) {
                field.setRangeText(text, start, end, "end");
                field.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: text }));
            }
        }

        rect() {
            return shift(this.el.getBoundingClientRect(), this.ctx);
        }
    }

    class EditableTarget {
        constructor(host, ctx) {
            this.host = host;
            this.ctx = ctx;
            this.editable = true;
            this.model = null;
        }

        // Texte de la zone éditable + correspondance position ↔ nœud texte.
        buildModel() {
            const segments = [];
            let text = "";
            const newline = () => {
                if (text !== "" && !text.endsWith("\n")) {
                    text += "\n";
                }
            };
            const walk = (node) => {
                for (const child of node.childNodes) {
                    if (child.nodeType === 3) {
                        segments.push({ node: child, start: text.length, end: text.length + child.data.length });
                        text += child.data;
                    } else if (child.nodeType === 1) {
                        const tag = child.tagName;
                        if (tag === "BR") {
                            text += "\n";
                        } else if (SKIPPED_TAGS.test(tag)) {
                            continue;
                        } else if (child.getAttribute("contenteditable") === "false") {
                            text += " ";
                        } else {
                            const block = BLOCK_TAGS.test(tag);
                            if (block) {
                                newline();
                            }
                            walk(child);
                            if (block) {
                                newline();
                            }
                        }
                    }
                }
            };
            walk(this.host);
            this.model = { text, segments };
            return this.model;
        }

        getText() {
            return this.buildModel().text;
        }

        pointToOffset(container, offset) {
            const { segments, text } = this.model;
            if (container.nodeType === 3) {
                const segment = segments.find((s) => s.node === container);
                if (segment) {
                    return segment.start + offset;
                }
            }
            const probe = this.ctx.doc.createRange();
            probe.setStart(container, offset);
            probe.collapse(true);
            const next = segments.find((s) => probe.comparePoint(s.node, 0) >= 0);
            return next ? next.start : text.length;
        }

        offsetToPoint(offset, isEnd) {
            const { segments } = this.model;
            const inside = segments.find((s) => (isEnd
                ? offset > s.start && offset <= s.end
                : offset >= s.start && offset < s.end));
            if (inside) {
                return [inside.node, offset - inside.start];
            }
            if (isEnd) {
                const before = [...segments].reverse().find((s) => s.end <= offset);
                return before ? [before.node, before.node.data.length] : [this.host, 0];
            }
            const after = segments.find((s) => s.start >= offset);
            return after ? [after.node, 0] : [this.host, this.host.childNodes.length];
        }

        rangeFor(start, end) {
            const range = this.ctx.doc.createRange();
            range.setStart(...this.offsetToPoint(start, false));
            range.setEnd(...this.offsetToPoint(end, true));
            return range;
        }

        initialScope() {
            this.buildModel();
            const selection = this.ctx.doc.getSelection();
            if (selection?.rangeCount && !selection.isCollapsed) {
                const range = selection.getRangeAt(0);
                if (this.host.contains(range.commonAncestorContainer)) {
                    const start = this.pointToOffset(range.startContainer, range.startOffset);
                    const end = this.pointToOffset(range.endContainer, range.endOffset);
                    if (end > start) {
                        return { start, end, whole: false };
                    }
                }
            }
            return { start: 0, end: this.model.text.length, whole: true };
        }

        replaceRange(range, text) {
            const { doc } = this.ctx;
            this.host.focus();
            const selection = doc.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            const done = text === ""
                ? doc.execCommand("delete")
                : doc.execCommand("insertText", false, text);
            if (!done) {
                range.deleteContents();
                if (text !== "") {
                    range.insertNode(doc.createTextNode(text));
                }
                this.host.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: text }));
            }
        }

        replace(start, end, text) {
            this.buildModel();
            this.replaceRange(this.rangeFor(start, end), text);
        }

        rect() {
            return shift(this.host.getBoundingClientRect(), this.ctx);
        }
    }

    class SelectionTarget {
        constructor(range, ctx) {
            this.range = range.cloneRange();
            this.text = range.toString();
            this.ctx = ctx;
            this.editable = false;
        }

        getText() {
            return this.text;
        }

        initialScope() {
            return { start: 0, end: this.text.length, whole: true };
        }

        rect() {
            return shift(this.range.getBoundingClientRect(), this.ctx);
        }
    }

    // ---------------------------------------------------------------------
    // Styles partagés (feuilles construites : non bloquées par la CSP des pages)
    // ---------------------------------------------------------------------

    const UI_SHEET = sheet(`
        :host { all: initial; }
        :host([hidden]) { display: none !important; }
        .box {
            position: fixed;
            z-index: 2147483647;
            background: #12162a;
            color: #e6e8f0;
            border: 1px solid #3ee6ff;
            border-radius: 10px;
            box-shadow: 0 0 18px rgba(62, 230, 255, 0.25), 0 10px 30px rgba(0, 0, 0, 0.55);
            font: 14px/1.45 system-ui, "Segoe UI", sans-serif;
            text-align: left;
        }
        .panel { width: min(380px, calc(100vw - 16px)); max-height: min(60vh, 520px); display: flex; flex-direction: column; }
        .bubble { min-width: 240px; max-width: min(360px, calc(100vw - 16px)); padding: 10px 12px; }
        .head { display: flex; align-items: center; gap: 8px; padding: 8px 10px 8px 12px; border-bottom: 1px solid #262c40; }
        .brand { color: #3ee6ff; font-weight: 600; }
        .info { flex: 1; color: #8b91a8; font: 12px Consolas, "Cascadia Code", monospace; }
        .body { overflow-y: auto; padding: 6px 12px 10px; scrollbar-width: thin; scrollbar-color: #3a4260 transparent; }
        .msg-box { padding: 10px 0; color: #8b91a8; }
        .msg-box.ok { color: #4ade80; }
        .msg-box.ko { color: #ff6b6b; }
        .item { border-left: 3px solid #ff6b6b; padding: 6px 0 6px 10px; margin: 6px 0; }
        .item.grammaire { border-left-color: #fbbf24; }
        .item.style, .item.typographie { border-left-color: #3ee6ff; }
        .kind { font: 11px Consolas, monospace; color: #8b91a8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 2px; }
        .ctx { font: 13px Consolas, "Cascadia Code", monospace; color: #8b91a8; margin: 2px 0; overflow-wrap: anywhere; }
        .ctx b { color: #ff4fd8; font-weight: 600; text-decoration: underline wavy #ff6b6b; text-underline-offset: 3px; }
        .item.grammaire .ctx b { text-decoration-color: #fbbf24; }
        .item.style .ctx b, .item.typographie .ctx b { text-decoration-color: #3ee6ff; }
        .text { margin: 2px 0 8px; }
        .actions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
        button {
            all: unset;
            cursor: pointer;
            font: 13px Consolas, "Cascadia Code", monospace;
            padding: 2px 10px;
            border-radius: 6px;
            border: 1px solid #262c40;
            background: #1d2235;
            color: #e6e8f0;
        }
        button:hover, button:focus-visible { border-color: #3ee6ff; }
        button.sugg { color: #3ee6ff; border-color: #3ee6ff; }
        button.ignore { color: #8b91a8; font-size: 12px; }
        button.close { border: none; background: none; font-size: 18px; line-height: 1; padding: 0 4px; color: #8b91a8; }
        .none, .ro { color: #8b91a8; font-style: italic; font-size: 13px; }
        .fixall { display: flex; align-items: center; gap: 8px; padding: 6px 0 4px; border-bottom: 1px solid #262c40; margin-bottom: 2px; }
        .fixall small { color: #8b91a8; font-size: 12px; }
        button.primary { color: #12162a; background: #3ee6ff; border-color: #3ee6ff; font-weight: 600; }
        button.primary:hover, button.primary:focus-visible { background: #7af0ff; }
        .done { color: #4ade80; font: 12px Consolas, "Cascadia Code", monospace; padding: 6px 0 2px; }
    `);

    const MIRROR_SHEET = sheet(`
        :host { all: initial; }
        .mirror {
            position: fixed;
            z-index: 2147483646;
            box-sizing: border-box;
            margin: 0;
            overflow: hidden;
            color: transparent;
            background: transparent;
            border-style: solid;
            border-color: transparent;
            pointer-events: none;
            word-break: normal;
        }
        .mirror.hidden { display: none; }
        mark {
            color: transparent;
            background: transparent;
            text-decoration: underline wavy #e5484d;
            text-decoration-thickness: 1.5px;
            text-decoration-skip-ink: none;
            text-underline-offset: 3px;
        }
        mark.grammaire { text-decoration-color: #f59e0b; }
        mark.style, mark.typographie { text-decoration-color: #0ea5e9; }
        .single mark { text-underline-offset: 1px; text-decoration-thickness: 1px; }
    `);

    // Couleurs choisies dans les réglages : une feuille pour les calques des champs,
    // une autre adoptée par la page pour les zones éditables (non bloquée par sa CSP).
    const MIRROR_COLOR_SHEET = sheet("");
    const PAGE_COLOR_SHEET = sheet("");

    function applyColors(colors) {
        const c = { ...DEFAULT_COLORS };
        for (const kind of Object.keys(DEFAULT_COLORS)) {
            if (COLOR.test(colors?.[kind] ?? "")) {
                c[kind] = colors[kind];
            }
        }
        MIRROR_COLOR_SHEET.replaceSync(`
            mark { text-decoration-color: ${c.orthographe}; }
            mark.grammaire { text-decoration-color: ${c.grammaire}; }
            mark.style, mark.typographie { text-decoration-color: ${c.style}; }
        `);
        PAGE_COLOR_SHEET.replaceSync(`
            ::highlight(aria-odl-orthographe) { text-decoration-color: ${c.orthographe}; }
            ::highlight(aria-odl-grammaire) { text-decoration-color: ${c.grammaire}; }
            ::highlight(aria-odl-style), ::highlight(aria-odl-typographie) { text-decoration-color: ${c.style}; }
        `);
        const custom = Object.keys(DEFAULT_COLORS).some((kind) => c[kind] !== DEFAULT_COLORS[kind]);
        try {
            const adopted = document.adoptedStyleSheets;
            if (custom && !adopted.includes(PAGE_COLOR_SHEET)) {
                document.adoptedStyleSheets = [...adopted, PAGE_COLOR_SHEET];
            } else if (!custom && adopted.includes(PAGE_COLOR_SHEET)) {
                document.adoptedStyleSheets = adopted.filter((s) => s !== PAGE_COLOR_SHEET);
            }
        } catch {
            // document sans feuilles adoptables : couleurs par défaut de highlight.css
        }
    }

    function createShadowHost(tag, sheets) {
        const host = document.createElement(tag);
        const root = host.attachShadow({ mode: "closed" });
        root.adoptedStyleSheets = sheets;
        document.documentElement.append(host);
        return { host, root };
    }

    function placeBox(box, rect, below = true) {
        const { width, height } = box.getBoundingClientRect();
        const margin = 8;
        let top = below ? rect.bottom + margin : rect.top - height - margin;
        if (below && top + height > innerHeight - margin && rect.top - height - margin > margin) {
            top = rect.top - height - margin;
        }
        top = Math.max(margin, Math.min(top, innerHeight - height - margin));
        const left = Math.max(margin, Math.min(rect.left, innerWidth - width - margin));
        box.style.top = `${top}px`;
        box.style.left = `${left}px`;
    }

    function suggestionButtons(match, onApply) {
        const nodes = [];
        if (match.suggestions.length === 0) {
            nodes.push(el("span", { className: "none", textContent: "Aucune suggestion" }));
        }
        for (const suggestion of match.suggestions) {
            const button = el("button", { className: "sugg", textContent: suggestion === "" ? "(supprimer)" : suggestion });
            button.addEventListener("click", () => onApply(suggestion));
            nodes.push(button);
        }
        return nodes;
    }

    // ---------------------------------------------------------------------
    // Peintres : comment dessiner les vagues selon le type de champ
    // ---------------------------------------------------------------------

    // Zones éditables : surlignage natif du navigateur, le HTML de l'éditeur reste intact.
    class HighlightPainter {
        constructor() {
            this.items = [];
        }

        paint(items) {
            this.clear();
            this.items = items;
            if (!HIGHLIGHTS_SUPPORTED) {
                return;
            }
            for (const item of items) {
                const name = `aria-odl-${item.match.kind}`;
                let highlight = CSS.highlights.get(name);
                if (!highlight) {
                    highlight = new Highlight();
                    CSS.highlights.set(name, highlight);
                }
                highlight.add(item.range);
            }
        }

        itemAt(x, y) {
            for (const item of this.items) {
                for (const rect of item.range.getClientRects()) {
                    if (x >= rect.left && x <= rect.right && y >= rect.top - 2 && y <= rect.bottom + 3) {
                        return item;
                    }
                }
            }
            return null;
        }

        setActive() {}

        clear() {
            if (HIGHLIGHTS_SUPPORTED) {
                for (const kind of KINDS) {
                    CSS.highlights.get(`aria-odl-${kind}`)?.clear();
                }
            }
            this.items = [];
        }

        dispose() {
            this.clear();
        }
    }

    // textarea / input : copie invisible du texte, alignée au pixel sur le champ.
    const COPIED_STYLES = [
        "fontFamily", "fontSize", "fontWeight", "fontStyle", "fontVariant", "fontStretch", "fontKerning",
        "fontFeatureSettings", "fontVariationSettings", "lineHeight", "letterSpacing", "wordSpacing",
        "textTransform", "textIndent", "textAlign", "direction", "tabSize", "textRendering",
        "paddingTop", "paddingLeft", "paddingBottom",
        "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
    ];

    class MirrorPainter {
        constructor(field) {
            this.field = field;
            this.isInput = field.tagName === "INPUT";
            this.items = [];
            this.active = false;
            this.frame = 0;
            this.lastGeometry = "";
            ({ host: this.host, root: this.root } = createShadowHost("aria-odl-overlay", [MIRROR_SHEET, MIRROR_COLOR_SHEET]));
            this.mirror = el("div", { className: this.isInput ? "mirror single hidden" : "mirror hidden" });
            this.root.append(this.mirror);
            this.onMove = () => this.layout();
            addEventListener("scroll", this.onMove, { capture: true, passive: true });
            addEventListener("resize", this.onMove, { passive: true });
            field.addEventListener("scroll", this.onMove, { passive: true });
            this.resizeObserver = new ResizeObserver(this.onMove);
            this.resizeObserver.observe(field);
        }

        paint(items, text) {
            this.items = items;
            const parts = [];
            let cursor = 0;
            for (const item of items) {
                if (item.start < cursor) {
                    continue;
                }
                parts.push(text.slice(cursor, item.start));
                // Grammalecte inclut parfois l'espace suivant (« que  » → « qu’ ») : on ne le souligne pas.
                const word = item.word.trimEnd() || item.word;
                const mark = el("mark", { className: item.match.kind, textContent: word });
                mark.item = item;
                parts.push(mark, item.word.slice(word.length));
                cursor = item.end;
            }
            parts.push(text.slice(cursor) + " ");
            this.mirror.replaceChildren(...parts);
            this.layout(true);
        }

        layout(force = false) {
            const field = this.field;
            const style = this.mirror.style;
            if (!this.active || !field.isConnected || this.items.length === 0) {
                this.mirror.classList.add("hidden");
                return;
            }
            const rect = field.getBoundingClientRect();
            const computed = getComputedStyle(field);
            if (rect.width === 0 || rect.height === 0 || computed.visibility === "hidden") {
                this.mirror.classList.add("hidden");
                return;
            }
            const geometry = `${rect.left},${rect.top},${rect.width},${rect.height},${field.scrollTop},${field.scrollLeft}`;
            if (!force && geometry === this.lastGeometry && !this.mirror.classList.contains("hidden")) {
                return;
            }
            this.lastGeometry = geometry;
            this.mirror.classList.remove("hidden");
            for (const property of COPIED_STYLES) {
                style[property] = computed[property];
            }
            const borders = parseFloat(computed.borderLeftWidth) + parseFloat(computed.borderRightWidth);
            const scrollbar = Math.max(0, field.offsetWidth - field.clientWidth - borders);
            style.paddingRight = `${parseFloat(computed.paddingRight) + scrollbar}px`;
            style.left = `${rect.left}px`;
            style.top = `${rect.top}px`;
            style.width = `${rect.width}px`;
            style.height = `${rect.height}px`;
            if (this.isInput) {
                // Un input centre verticalement sa ligne unique : on reproduit ce centrage.
                const contentHeight = field.clientHeight - parseFloat(computed.paddingTop) - parseFloat(computed.paddingBottom);
                style.lineHeight = `${contentHeight}px`;
                // Un peu de marge en bas : sinon la vague, sous la ligne, serait rognée par le bord du champ.
                style.height = `${rect.height + 6}px`;
                style.whiteSpace = "pre";
                style.overflowWrap = "normal";
            } else {
                style.whiteSpace = "pre-wrap";
                style.overflowWrap = "break-word";
            }
            this.mirror.scrollTop = field.scrollTop;
            this.mirror.scrollLeft = field.scrollLeft;
        }

        // Pendant que le champ a le focus, on suit ses déplacements (mise en page qui bouge, etc.).
        setActive(active) {
            this.active = active;
            cancelAnimationFrame(this.frame);
            this.layout(true);
            if (active) {
                const tick = () => {
                    this.layout();
                    this.frame = requestAnimationFrame(tick);
                };
                this.frame = requestAnimationFrame(tick);
            }
        }

        itemAt(x, y) {
            if (!this.active) {
                return null;
            }
            for (const mark of this.mirror.querySelectorAll("mark")) {
                for (const rect of mark.getClientRects()) {
                    if (x >= rect.left && x <= rect.right && y >= rect.top - 2 && y <= rect.bottom + 3) {
                        return mark.item;
                    }
                }
            }
            return null;
        }

        clear() {
            this.items = [];
            this.mirror.replaceChildren();
            this.layout();
        }

        dispose() {
            cancelAnimationFrame(this.frame);
            removeEventListener("scroll", this.onMove, { capture: true });
            removeEventListener("resize", this.onMove);
            this.field.removeEventListener("scroll", this.onMove);
            this.resizeObserver.disconnect();
            this.host.remove();
        }
    }

    // ---------------------------------------------------------------------
    // Correction en direct
    // ---------------------------------------------------------------------

    const live = { enabled: false, session: null };

    class LiveSession {
        constructor(target) {
            this.target = target;
            this.isField = target instanceof FieldTarget;
            this.el = this.isField ? target.el : target.host;
            this.painter = this.isField ? new MirrorPainter(target.el) : new HighlightPainter();
            this.items = [];
            this.text = this.target.getText();
            this.seq = 0;
            this.timer = null;
            this.disposed = false;
            this.onInput = () => {
                bubble.close();
                if (this.isField) {
                    this.shiftItems();
                    this.render();
                }
                this.schedule();
            };
            this.el.addEventListener("input", this.onInput);
            this.savedSpellcheck = undefined;
            this.updateSpellcheck();
        }

        // Option « masquer le correcteur du navigateur » : on coupe le soulignement natif
        // du champ suivi, et on remet la valeur d'origine en le quittant.
        updateSpellcheck() {
            if (prefs.hideNativeSpellcheck && this.savedSpellcheck === undefined) {
                this.savedSpellcheck = this.el.getAttribute("spellcheck");
                this.el.setAttribute("spellcheck", "false");
            } else if (!prefs.hideNativeSpellcheck && this.savedSpellcheck !== undefined) {
                this.restoreSpellcheck();
            }
        }

        restoreSpellcheck() {
            if (this.savedSpellcheck === undefined) {
                return;
            }
            if (this.savedSpellcheck === null) {
                this.el.removeAttribute("spellcheck");
            } else {
                this.el.setAttribute("spellcheck", this.savedSpellcheck);
            }
            this.savedSpellcheck = undefined;
        }

        schedule(delay = prefs.debounceMs) {
            clearTimeout(this.timer);
            this.timer = setTimeout(() => this.check(), delay);
        }

        async check() {
            if (!extensionAlive()) {
                teardown();
                return;
            }
            const seq = ++this.seq;
            const text = this.target.getText();
            if (text.trim().length < 2 || text.length > MAX_LIVE_CHARS) {
                this.text = text;
                this.items = [];
                this.render();
                return;
            }
            const response = await requestCheck(text, this.el);
            if (seq !== this.seq || this.disposed || !response?.ok) {
                return;
            }
            // Le texte a bougé pendant l'analyse : on relance plutôt que de souligner au mauvais endroit.
            if (this.target.getText() !== text) {
                this.schedule();
                return;
            }
            this.text = text;
            this.lang = response.lang;
            this.items = response.matches
                .filter((m) => m.end > m.start)
                .map((match) => {
                    const item = { match, word: text.slice(match.start, match.end), start: match.start, end: match.end };
                    if (!this.isField) {
                        item.range = this.target.rangeFor(match.start, match.end);
                    }
                    return item;
                });
            this.render();
        }

        visibleItems() {
            return this.items.filter((item) => !isHidden(item.match, item.word));
        }

        render() {
            if (!this.disposed) {
                this.painter.paint(this.visibleItems(), this.text);
            }
        }

        // Pendant la frappe dans un textarea : décale les vagues situées après la modification
        // et retire celles qui la touchent, en attendant la nouvelle analyse.
        shiftItems() {
            const oldText = this.text;
            const newText = this.target.getText();
            let prefix = 0;
            const max = Math.min(oldText.length, newText.length);
            while (prefix < max && oldText[prefix] === newText[prefix]) {
                prefix++;
            }
            let suffix = 0;
            while (suffix < max - prefix && oldText[oldText.length - 1 - suffix] === newText[newText.length - 1 - suffix]) {
                suffix++;
            }
            const editEnd = oldText.length - suffix;
            const delta = newText.length - oldText.length;
            this.items = this.items.flatMap((item) => {
                if (item.end < prefix) {
                    return [item];
                }
                if (item.start > editEnd) {
                    return [{ ...item, start: item.start + delta, end: item.end + delta }];
                }
                return [];
            });
            this.text = newText;
        }

        itemAt(x, y) {
            return this.disposed ? null : this.painter.itemAt(x, y);
        }

        apply(item, suggestion) {
            bubble.close();
            const stillThere = this.isField
                ? this.target.el.value.slice(item.start, item.end) === item.word
                : item.range?.toString() === item.word;
            if (!stillThere) {
                this.schedule(0);
                return;
            }
            if (this.isField) {
                this.target.replace(item.start, item.end, suggestion);
            } else {
                this.target.replaceRange(item.range, suggestion);
            }
            recordCorrections([correction(item.match, item.word, suggestion, this.lang)]);
        }

        setActive(active) {
            this.painter.setActive(active);
        }

        dispose() {
            this.disposed = true;
            clearTimeout(this.timer);
            this.el.removeEventListener("input", this.onInput);
            this.restoreSpellcheck();
            this.painter.dispose();
        }
    }

    function liveTargetFor(node) {
        if (node?.nodeType !== 1) {
            return null;
        }
        const ctx = { doc: node.ownerDocument, offsetX: 0, offsetY: 0 };
        const isLiveInput = node.tagName === "INPUT"
            && node.type === "text"
            && node.getAttribute("role") !== "combobox"
            && !node.hasAttribute("list");
        if (node.tagName === "TEXTAREA" || isLiveInput) {
            return node.readOnly || node.disabled || isSensitive(node) ? null : new FieldTarget(node, ctx);
        }
        if (node.isContentEditable) {
            const host = editingHost(node);
            return isSensitive(host) ? null : new EditableTarget(host, ctx);
        }
        return null;
    }

    function deepActiveElement() {
        let element = document.activeElement;
        while (element?.shadowRoot?.activeElement) {
            element = element.shadowRoot.activeElement;
        }
        return element;
    }

    function onFocus(node) {
        // Le correcteur de la popup (data-aria-odl="on") marche même si la correction en direct est coupée.
        if (!live.enabled && node?.closest?.('[data-aria-odl="on"]') === null) {
            return;
        }
        if (!live.enabled && !node?.closest) {
            return;
        }
        const target = liveTargetFor(node);
        if (!target) {
            return;
        }
        const element = target.el ?? target.host;
        if (live.session?.el === element) {
            live.session.setActive(true);
            return;
        }
        live.session?.dispose();
        live.session = new LiveSession(target);
        live.session.setActive(true);
        live.session.schedule(0);
    }

    listen(document, "focusin", (event) => onFocus(event.composedPath()[0]), true);
    listen(document, "focusout", (event) => {
        const node = event.composedPath()[0];
        const session = live.session;
        if (session && (node === session.el || session.el.contains(node))) {
            // On garde les fautes en mémoire ; seul le calque des textarea est masqué.
            setTimeout(() => {
                if (live.session === session && !session.el.contains(deepActiveElement())) {
                    session.setActive(false);
                }
            }, 0);
        }
    }, true);

    let lastContextPoint = null;
    listen(document, "contextmenu", (event) => {
        lastContextPoint = { x: event.clientX, y: event.clientY, time: Date.now() };
        const item = live.session?.itemAt(event.clientX, event.clientY);
        if (!item) {
            bubble.close();
            return;  // menu habituel du navigateur
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        bubble.show(item, live.session, event.clientX, event.clientY);
    }, true);

    // ---------------------------------------------------------------------
    // Infobulle du clic droit
    // ---------------------------------------------------------------------

    const bubble = {
        host: null,
        box: null,

        show(item, session, x, y) {
            if (!this.host?.isConnected) {
                const { host, root } = createShadowHost("aria-odl-bubble", [UI_SHEET]);
                this.host = host;
                this.box = el("div", { className: "box bubble" });
                this.box.setAttribute("role", "menu");
                // Garde le focus dans le champ pendant qu'on clique dans l'infobulle.
                this.box.addEventListener("mousedown", (event) => event.preventDefault());
                root.append(this.box);
            }
            const { match } = item;
            const actions = el("div", { className: "actions" }, ...suggestionButtons(match, (suggestion) => session.apply(item, suggestion)));
            const ignore = el("button", { className: "ignore", textContent: "Ignorer" });
            ignore.addEventListener("click", () => {
                addIgnored(item.word, match.rule, match.kind);
                this.close();
                session.render();
                panel.refresh();
            });
            if (canAddToDictionary(match, item.word)) {
                const learn = el("button", { className: "ignore", textContent: "Ajouter au dictionnaire" });
                learn.addEventListener("click", () => {
                    addToDictionary(item.word);
                    this.close();
                    session.render();
                    panel.refresh();
                });
                actions.append(learn);
            }
            actions.append(ignore);
            this.box.replaceChildren(
                el("div", { className: "kind", textContent: `${match.kind} · ${match.detail ?? match.rule}` }),
                el("div", { className: "text", textContent: match.message }),
                actions,
            );
            this.host.hidden = false;
            placeBox(this.box, { left: x, right: x, top: y, bottom: y + 4 });
        },

        close() {
            if (this.host) {
                this.host.hidden = true;
            }
        },

        isInPath(event) {
            return !!this.host && event.composedPath().includes(this.host);
        },

        dispose() {
            this.host?.remove();
            this.host = null;
        },
    };

    listen(document, "mousedown", (event) => {
        if (!bubble.isInPath(event)) {
            bubble.close();
        }
        if (!synonymBubble.isInPath(event)) {
            synonymBubble.close();
        }
    }, true);
    listen(window, "scroll", () => bubble.close(), { capture: true, passive: true });
    listen(window, "keydown", (event) => {
        if (event.key === "Escape") {
            bubble.close();
            panel.close();
            translateBubble.close();
            synonymBubble.close();
            sendReview.close();
        }
    }, true);

    // ---------------------------------------------------------------------
    // Panneau complet à la demande
    // ---------------------------------------------------------------------

    function deepActive() {
        let doc = document;
        let element = doc.activeElement;
        let offsetX = 0;
        let offsetY = 0;
        while (element && element.tagName === "IFRAME") {
            let inner = null;
            try {
                inner = element.contentDocument;
            } catch {
                inner = null;
            }
            if (!inner) {
                break;
            }
            const rect = element.getBoundingClientRect();
            offsetX += rect.left + element.clientLeft;
            offsetY += rect.top + element.clientTop;
            doc = inner;
            element = inner.activeElement;
        }
        while (element?.shadowRoot?.activeElement) {
            element = element.shadowRoot.activeElement;
        }
        return { el: element, doc, offsetX, offsetY };
    }

    function findPanelTarget() {
        const ctx = deepActive();
        const { el: element, doc } = ctx;
        if (element?.tagName === "TEXTAREA" || (element?.tagName === "INPUT" && PANEL_INPUT_TYPES.has(element.type))) {
            return new FieldTarget(element, ctx);
        }
        if (element?.isContentEditable) {
            return new EditableTarget(editingHost(element), ctx);
        }
        const selection = doc.getSelection();
        if (selection?.rangeCount && !selection.isCollapsed && selection.toString().trim() !== "") {
            return new SelectionTarget(selection.getRangeAt(0), ctx);
        }
        return null;
    }

    const panel = {
        host: null,
        box: null,
        info: null,
        body: null,
        anchor: null,
        frame: 0,
        state: null,

        ensure() {
            if (this.host?.isConnected) {
                this.host.hidden = false;
                return;
            }
            const { host, root } = createShadowHost("aria-odl-panel", [UI_SHEET]);
            this.host = host;
            this.info = el("span", { className: "info" });
            const close = el("button", { className: "close", title: "Fermer (Échap)", textContent: "×" });
            close.setAttribute("aria-label", "Fermer");
            close.addEventListener("click", () => this.close());
            this.body = el("div", { className: "body" });
            this.box = el("div", { className: "box panel" },
                el("div", { className: "head" }, el("span", { className: "brand", textContent: "Aria Plume" }), this.info, close),
                this.body,
            );
            this.box.setAttribute("role", "dialog");
            this.box.setAttribute("aria-label", "Aria Plume — corrections");
            this.box.addEventListener("mousedown", (event) => event.preventDefault());
            root.append(this.box);
            listen(window, "scroll", () => this.schedulePlace(), { capture: true, passive: true });
            listen(window, "resize", () => this.schedulePlace(), { passive: true });
        },

        isOpen() {
            return !!this.host?.isConnected && !this.host.hidden;
        },

        schedulePlace() {
            if (!this.isOpen()) {
                return;
            }
            cancelAnimationFrame(this.frame);
            this.frame = requestAnimationFrame(() => this.place());
        },

        place() {
            if (this.isOpen() && this.anchor) {
                placeBox(this.box, this.anchor());
            }
        },

        message(text, kind = "") {
            this.body.replaceChildren(el("div", { className: `msg-box ${kind}`, textContent: text }));
            this.place();
        },

        open() {
            const target = findPanelTarget();
            this.ensure();
            if (!target) {
                this.state = null;
                this.anchor = () => ({ left: innerWidth - 400, top: 16, right: innerWidth - 16, bottom: 16 });
                this.info.textContent = "";
                this.message("Place le curseur dans un champ de texte, ou sélectionne du texte, puis relance la vérification.");
                return;
            }
            this.state = { target, scope: target.initialScope(), checked: null, matches: [], lang: "" };
            this.anchor = () => target.rect();
            this.analyze();
        },

        async analyze() {
            const state = this.state;
            const full = state.target.getText();
            if (state.scope.whole) {
                state.scope.end = full.length;
            }
            const { start, end } = state.scope;
            const text = full.slice(start, end);
            if (text.trim() === "") {
                this.info.textContent = "";
                this.message("Rien à vérifier : le champ est vide.");
                return;
            }
            this.info.textContent = "analyse…";
            this.place();
            const response = await requestCheck(text, state.target.el ?? state.target.host);
            if (this.state !== state) {
                return;
            }
            if (!response?.ok) {
                this.info.textContent = "";
                this.message(`Erreur : ${response?.error ?? "pas de réponse de l'extension"}`, "ko");
                return;
            }
            state.checked = { full };
            state.lang = response.lang;
            state.matches = response.matches
                .filter((m) => m.end > m.start)
                .map((m) => ({ ...m, start: m.start + start, end: m.end + start, word: text.slice(m.start, m.end) }));
            this.render();
        },

        refresh() {
            if (this.isOpen() && this.state?.checked) {
                this.render();
            }
        },

        render() {
            const state = this.state;
            const { full } = state.checked;
            const visible = state.matches.filter((m) => !isHidden(m, m.word));
            const scopeLabel = state.scope.whole ? "" : " · sélection";
            if (visible.length === 0) {
                this.info.textContent = `${state.lang}${scopeLabel}`;
                this.message("Aucune faute détectée ✨", "ok");
                if (state.fixed) {
                    this.body.prepend(this.doneLine());
                }
                return;
            }
            this.info.textContent = `${state.lang} · ${visible.length} à corriger${scopeLabel}`;
            const top = [];
            if (state.fixed) {
                top.push(this.doneLine());
            }
            const fixable = this.fixable(visible);
            if (state.target.editable && fixable.length > 0) {
                const button = el("button", { className: "primary", textContent: `Tout corriger (${fixable.length})` });
                button.title = "Applique la première suggestion de chaque faute d'orthographe et de grammaire";
                button.addEventListener("click", () => this.applyAll());
                top.push(el("div", { className: "fixall" }, button, el("small", { textContent: "orthographe et grammaire" })));
            }
            this.body.replaceChildren(...top, ...visible.map((match) => this.renderItem(match, full)));
            this.place();
        },

        doneLine() {
            const { count, undoSteps } = this.state.fixed;
            const undo = undoSteps > 1 ? `Ctrl+Z × ${undoSteps} pour annuler` : "Ctrl+Z pour annuler";
            return el("div", { className: "done", textContent: `✓ ${count} correction${count > 1 ? "s" : ""} appliquée${count > 1 ? "s" : ""} · ${undo}` });
        },

        // « Tout corriger » : orthographe et grammaire avec au moins une suggestion,
        // sans chevauchement (on garde la première faute d'un passage qui se recoupe).
        fixable(visible) {
            const list = visible
                .filter((m) => (m.kind === "orthographe" || m.kind === "grammaire") && m.suggestions.length > 0)
                .sort((a, b) => a.start - b.start || b.end - a.end);
            const kept = [];
            for (const match of list) {
                if (!kept.length || match.start >= kept.at(-1).end) {
                    kept.push(match);
                }
            }
            return kept;
        },

        applyAll() {
            const state = this.state;
            if (state.target.getText() !== state.checked.full) {
                this.analyze();  // le texte a changé depuis l'analyse
                return;
            }
            const fixes = this.fixable(state.matches.filter((m) => !isHidden(m, m.word)));
            if (fixes.length === 0) {
                return;
            }
            const full = state.checked.full;
            const delta = fixes.reduce((sum, m) => sum + m.suggestions[0].length - (m.end - m.start), 0);
            let undoSteps = 1;
            if (state.target instanceof FieldTarget) {
                // Champ de texte : une seule insertion du passage corrigé, donc un seul Ctrl+Z.
                const from = fixes[0].start;
                const to = fixes.at(-1).end;
                let fixed = "";
                let cursor = from;
                for (const match of fixes) {
                    fixed += full.slice(cursor, match.start) + match.suggestions[0];
                    cursor = match.end;
                }
                fixed += full.slice(cursor, to);
                state.target.replace(from, to, fixed);
            } else {
                // Zone éditable : une correction à la fois, de la fin vers le début (les positions
                // avant restent justes), pour ne pas écraser la mise en forme entre deux fautes.
                for (const match of [...fixes].reverse()) {
                    state.target.replace(match.start, match.end, match.suggestions[0]);
                }
                undoSteps = fixes.length;
            }
            recordCorrections(fixes.map((m) => correction(m, m.word, m.suggestions[0], state.lang)));
            if (!state.scope.whole) {
                state.scope.end += delta;
            }
            state.fixed = { count: fixes.length, undoSteps };
            this.analyze();
        },

        renderItem(match, full) {
            const before = full.slice(Math.max(0, match.start - CONTEXT_CHARS), match.start).replace(/\s+/g, " ");
            const word = match.word.trimEnd() || match.word;
            const after = match.word.slice(word.length) + full.slice(match.end, match.end + CONTEXT_CHARS).replace(/\s+/g, " ");
            const actions = el("div", { className: "actions" });
            if (this.state.target.editable) {
                actions.append(...suggestionButtons(match, (suggestion) => this.apply(match, suggestion)));
            } else {
                actions.append(el("span", { className: "ro", textContent: `Texte non modifiable${match.suggestions.length ? " · suggestion : " + match.suggestions.join(", ") : ""}` }));
            }
            const ignore = el("button", { className: "ignore", textContent: "Ignorer" });
            ignore.addEventListener("click", () => {
                addIgnored(match.word, match.rule, match.kind);
                this.render();
                live.session?.render();
            });
            if (canAddToDictionary(match, match.word)) {
                const learn = el("button", { className: "ignore", textContent: "Ajouter au dictionnaire" });
                learn.addEventListener("click", () => {
                    addToDictionary(match.word);
                    this.render();
                    live.session?.render();
                });
                actions.append(learn);
            }
            actions.append(ignore);
            return el("div", { className: `item ${match.kind}` },
                el("div", { className: "kind", textContent: `${match.kind} · ${match.detail ?? match.rule}` }),
                el("div", { className: "ctx" }, `…${before}`, el("b", { textContent: word }), `${after}…`),
                el("div", { className: "text", textContent: match.message }),
                actions,
            );
        },

        apply(match, suggestion) {
            const state = this.state;
            if (state.target.getText() !== state.checked.full) {
                this.analyze();  // le texte a changé depuis l'analyse : on repart d'une analyse fraîche
                return;
            }
            state.target.replace(match.start, match.end, suggestion);
            recordCorrections([correction(match, match.word, suggestion, state.lang)]);
            if (!state.scope.whole) {
                state.scope.end += suggestion.length - (match.end - match.start);
            }
            state.fixed = null;
            this.analyze();
        },

        close() {
            if (this.host) {
                this.host.hidden = true;
            }
            this.state = null;
        },

        dispose() {
            this.host?.remove();
            this.host = null;
            this.state = null;
        },
    };

    // ---------------------------------------------------------------------
    // Traduction (français ↔ anglais, moteur Bergamot local)
    // ---------------------------------------------------------------------

    const TR_SHEET = sheet(`
        .tr { width: min(420px, calc(100vw - 16px)); max-height: min(60vh, 520px); display: flex; flex-direction: column; }
        .pair { flex: 1; font: 12px Consolas, "Cascadia Code", monospace; color: #3ee6ff; }
        button.swap { padding: 0 8px; }
        .tr-body { padding: 10px 12px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #3a4260 transparent; }
        .tr-text { white-space: pre-wrap; overflow-wrap: anywhere; user-select: text; cursor: text; }
        .tr-status { color: #8b91a8; font: 12px Consolas, "Cascadia Code", monospace; }
        .tr-status.ko { color: #ff6b6b; font-family: system-ui, "Segoe UI", sans-serif; font-size: 13px; }
        .tr-actions { display: flex; gap: 6px; padding: 0 12px 10px; }
        .bar { top: 12px; right: 12px; display: flex; align-items: center; gap: 10px; padding: 6px 6px 6px 12px; max-width: calc(100vw - 24px); }
        .bar .status { color: #8b91a8; font: 12px Consolas, "Cascadia Code", monospace; }
        .bar .status.ko { color: #ff6b6b; font-family: system-ui, "Segoe UI", sans-serif; }
    `);

    const SYN_SHEET = sheet(`
        .syn { width: min(400px, calc(100vw - 16px)); }
        .syn .pair { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .syn-body { display: flex; flex-direction: column; gap: 10px; }
        .syn-group .actions { gap: 5px; }
        .syn-note { color: #8b91a8; font-size: 12px; }
        button.more { color: #3ee6ff; border-color: transparent; background: transparent; }
    `);

    const pairLabel = (from, to) => `${from.toUpperCase()} → ${to.toUpperCase()}`;

    function pageLangHint() {
        const lang = (document.documentElement.lang || "").slice(0, 2).toLowerCase();
        return ["fr", "en"].includes(lang) ? lang : null;
    }

    async function requestTranslation(payload) {
        try {
            return await chrome.runtime.sendMessage({ target: "sw", cmd: "translate", hint: pageLangHint(), ...payload });
        } catch (error) {
            return { ok: false, error: error.message };
        }
    }

    async function copyText(text, root) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // page non sécurisée (http) : copie classique depuis un champ caché
        }
        const area = el("textarea", { value: text });
        area.style.position = "fixed";
        area.style.opacity = "0";
        root.append(area);
        area.select();
        const done = document.execCommand("copy");
        area.remove();
        return done;
    }

    // --- Sélection ou champ : infobulle de traduction ---

    function findTranslationSource() {
        const ctx = deepActive();
        const { el: element, doc } = ctx;
        if (element?.tagName === "TEXTAREA" || (element?.tagName === "INPUT" && PANEL_INPUT_TYPES.has(element.type))) {
            const target = new FieldTarget(element, ctx);
            const scope = target.initialScope();
            const text = element.value.slice(scope.start, scope.end);
            return { kind: "field", target, start: scope.start, end: scope.end, text, rect: () => target.rect() };
        }
        if (element?.isContentEditable) {
            const target = new EditableTarget(editingHost(element), ctx);
            const scope = target.initialScope();
            const range = target.rangeFor(scope.start, scope.end);
            const text = target.model.text.slice(scope.start, scope.end);
            const anchor = scope.whole ? target.host : range;
            return { kind: "editable", target, range, text, rect: () => shift(anchor.getBoundingClientRect(), ctx) };
        }
        const selection = doc.getSelection();
        if (selection?.rangeCount && !selection.isCollapsed && selection.toString().trim() !== "") {
            const range = selection.getRangeAt(0).cloneRange();
            return { kind: "page", text: selection.toString(), range, rect: () => shift(range.getBoundingClientRect(), ctx) };
        }
        return null;
    }

    const translateBubble = {
        host: null,
        root: null,
        box: null,
        state: null,

        ensure() {
            if (this.host?.isConnected) {
                this.host.hidden = false;
                return;
            }
            const { host, root } = createShadowHost("aria-odl-translate", [UI_SHEET, TR_SHEET]);
            this.host = host;
            this.root = root;
            this.box = el("div", { className: "box tr" });
            this.box.setAttribute("role", "dialog");
            this.box.setAttribute("aria-label", "Aria Plume — traduction");
            // Garde le focus et la sélection dans la page pendant qu'on clique dans l'infobulle.
            this.box.addEventListener("mousedown", (event) => {
                if (!event.composedPath().some((node) => node.classList?.contains("tr-text"))) {
                    event.preventDefault();
                }
            });
            root.append(this.box);
        },

        open() {
            const source = findTranslationSource();
            this.ensure();
            if (!source || source.text.trim() === "") {
                this.state = null;
                this.renderShell("", null);
                this.setBody(el("div", { className: "tr-status", textContent: "Sélectionne du texte (ou place le curseur dans un champ), puis relance la traduction." }));
                placeBox(this.box, { left: innerWidth - 440, right: innerWidth - 16, top: 16, bottom: 16 });
                return;
            }
            this.state = { source, from: null, to: null, result: null, seq: 0 };
            this.translate("auto");
        },

        async translate(from, to) {
            const state = this.state;
            const seq = ++state.seq;
            this.renderShell(from === "auto" ? "…" : pairLabel(from, to), null);
            this.setBody(el("div", { className: "tr-status", textContent: "Traduction…" }));
            placeBox(this.box, state.source.rect());
            const response = await requestTranslation({ text: state.source.text, from, to, priority: 0 });
            if (this.state !== state || seq !== state.seq) {
                return;
            }
            if (!response?.ok) {
                this.setBody(el("div", { className: "tr-status ko", textContent: response?.error ?? "Pas de réponse de l'extension." }));
                placeBox(this.box, state.source.rect());
                return;
            }
            state.from = response.from;
            state.to = response.to;
            state.result = response.text;
            this.renderShell(pairLabel(state.from, state.to), state);
            this.setBody(el("div", { className: "tr-text", textContent: state.result }));
            placeBox(this.box, state.source.rect());
        },

        renderShell(label, state) {
            const close = el("button", { className: "close", title: "Fermer (Échap)", textContent: "×" });
            close.setAttribute("aria-label", "Fermer");
            close.addEventListener("click", () => this.close());
            const head = el("div", { className: "head" }, el("span", { className: "brand", textContent: "Aria Plume" }), el("span", { className: "pair", textContent: label }));
            if (state) {
                const swap = el("button", { className: "swap", title: "Inverser le sens", textContent: "⇄" });
                swap.addEventListener("click", () => this.translate(state.to, state.from));
                head.append(swap);
            }
            head.append(close);
            this.body = el("div", { className: "tr-body" });
            const children = [head, this.body];
            if (state) {
                const actions = el("div", { className: "tr-actions" });
                const copy = el("button", { className: "sugg", textContent: "Copier" });
                copy.addEventListener("click", async () => {
                    const done = await copyText(state.result, this.root);
                    copy.textContent = done ? "Copié ✓" : "Copie impossible";
                });
                actions.append(copy);
                if (state.source.kind !== "page") {
                    const replace = el("button", { className: "sugg", textContent: "Remplacer" });
                    replace.addEventListener("click", () => this.replace());
                    actions.append(replace);
                }
                children.push(actions);
            }
            this.box.replaceChildren(...children);
        },

        setBody(node) {
            this.body.replaceChildren(node);
        },

        // Remplace le texte d'origine par la traduction (Ctrl+Z annule).
        replace() {
            const { source, result } = this.state;
            if (source.kind === "field") {
                if (source.target.el.value.slice(source.start, source.end) !== source.text) {
                    this.setBody(el("div", { className: "tr-status ko", textContent: "Le texte a changé depuis la traduction : relance-la." }));
                    return;
                }
                source.target.replace(source.start, source.end, result);
            } else if (source.kind === "editable") {
                const { doc } = source.target.ctx;
                source.target.host.focus();
                const selection = doc.getSelection();
                selection.removeAllRanges();
                selection.addRange(source.range);
                const done = result.includes("\n")
                    ? doc.execCommand("insertHTML", false, result.split("\n").map(escapeHtml).join("<br>"))
                    : doc.execCommand("insertText", false, result);
                if (!done) {
                    source.target.replaceRange(source.range, result);
                }
            }
            this.close();
        },

        close() {
            if (this.host) {
                this.host.hidden = true;
            }
            this.state = null;
        },

        dispose() {
            this.host?.remove();
            this.host = null;
            this.state = null;
        },
    };

    // --- Synonymes ---
    // Clic droit sur un mot (ou sur une sélection d'un à trois mots) → « Synonymes avec Aria Plume ».
    // Dans un champ, un clic sur un synonyme remplace le mot (Ctrl+Z annule) ; ailleurs, il le copie.

    const WORD_CHAR = /[\p{L}\p{N}'’-]/u;
    const MAX_SHOWN_SYNONYMS = 24;

    // Étend [start, end) aux limites du mot qui l'entoure.
    function wordBounds(text, start, end) {
        let from = start;
        let to = end;
        while (from > 0 && WORD_CHAR.test(text[from - 1])) {
            from--;
        }
        while (to < text.length && WORD_CHAR.test(text[to])) {
            to++;
        }
        // Pas d'apostrophe ni de tiret au bord : « l'écran » → « écran », « (mot) » → « mot ».
        while (from < to && /['’-]/.test(text[from])) {
            from++;
        }
        while (to > from && /['’-]/.test(text[to - 1])) {
            to--;
        }
        const elision = /^(?:[ldjmnstc]|qu|jusqu|lorsqu|puisqu)['’]/iu.exec(text.slice(from, to));
        if (elision && to - from > elision[0].length) {
            from += elision[0].length;
        }
        return [from, to];
    }

    // Sélection utilisable : un à trois mots, 60 caractères au plus. Renvoie [début, fin] sans les espaces.
    function trimmedSelection(text, start, end) {
        const raw = text.slice(start, end);
        const lead = raw.length - raw.trimStart().length;
        const trimmed = raw.trim();
        if (!trimmed || trimmed.length > 60 || trimmed.split(/\s+/u).length > 3) {
            return null;
        }
        return [start + lead, start + lead + trimmed.length];
    }

    const contextAround = (text, start, end) => text.slice(Math.max(0, start - 200), Math.min(text.length, end + 200));

    function pointRect(ctx) {
        if (lastContextPoint && Date.now() - lastContextPoint.time < 10000) {
            const { x, y } = lastContextPoint;
            return () => ({ left: x, right: x, top: y - 10, bottom: y + 10 });
        }
        return null;
    }

    function findSynonymSource() {
        const ctx = deepActive();
        const { el: element, doc } = ctx;
        if (element?.tagName === "TEXTAREA" || (element?.tagName === "INPUT" && PANEL_INPUT_TYPES.has(element.type))) {
            if (isSensitive(element)) {
                return null;
            }
            const value = element.value;
            let bounds = element.selectionStart !== element.selectionEnd
                ? trimmedSelection(value, element.selectionStart, element.selectionEnd)
                : wordBounds(value, element.selectionStart, element.selectionEnd);
            if (!bounds || bounds[0] === bounds[1]) {
                return null;
            }
            const target = new FieldTarget(element, ctx);
            const [start, end] = bounds;
            return { kind: "field", target, start, end, text: value.slice(start, end), context: contextAround(value, start, end), rect: pointRect(ctx) ?? (() => target.rect()) };
        }
        const selection = doc.getSelection();
        if (!selection?.rangeCount) {
            return null;
        }
        let range = selection.getRangeAt(0).cloneRange();
        // Zone éditable ou texte de page : c'est la sélection qui compte, pas l'élément actif
        // (une zone éditable peut garder le focus pendant qu'on sélectionne ailleurs).
        const anchor = range.commonAncestorContainer;
        const anchorElement = anchor.nodeType === 3 ? anchor.parentElement : anchor;
        const editable = !!anchorElement?.isContentEditable;
        if (range.collapsed) {
            // Curseur posé dans un mot (zone éditable) : on prend le mot entier.
            const node = range.startContainer;
            if (!editable || node.nodeType !== 3) {
                return null;
            }
            const [from, to] = wordBounds(node.data, range.startOffset, range.startOffset);
            if (from === to) {
                return null;
            }
            range = doc.createRange();
            range.setStart(node, from);
            range.setEnd(node, to);
        } else if (range.startContainer === range.endContainer && range.startContainer.nodeType === 3) {
            const bounds = trimmedSelection(range.startContainer.data, range.startOffset, range.endOffset);
            if (!bounds) {
                return null;
            }
            range.setStart(range.startContainer, bounds[0]);
            range.setEnd(range.startContainer, bounds[1]);
        } else if (!trimmedSelection(range.toString(), 0, range.toString().length)) {
            return null;
        }
        const text = range.toString().trim();
        const container = range.commonAncestorContainer;
        const context = (container.nodeType === 3 ? container.parentElement : container)?.textContent ?? text;
        const fixedRange = range;
        return {
            kind: editable ? "editable" : "page",
            target: editable ? { host: editingHost(anchorElement), ctx } : null,
            range: fixedRange,
            text,
            context: context.slice(0, 600),
            rect: () => shift(fixedRange.getBoundingClientRect(), ctx),
        };
    }

    // « Rapide » → « Agile » : la majuscule du mot d'origine passe au synonyme.
    function keepCapital(original, replacement) {
        if (original.length > 1 && original === original.toUpperCase() && /\p{Lu}/u.test(original)) {
            return replacement.toUpperCase();
        }
        return /^\p{Lu}/u.test(original) ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;
    }

    const POS_NAMES = { nom: "Nom", verbe: "Verbe", adjectif: "Adjectif", adverbe: "Adverbe" };

    const synonymBubble = {
        host: null,
        root: null,
        box: null,
        source: null,
        seq: 0,

        ensure() {
            if (this.host?.isConnected) {
                this.host.hidden = false;
                return;
            }
            const { host, root } = createShadowHost("aria-odl-synonyms", [UI_SHEET, TR_SHEET, SYN_SHEET]);
            this.host = host;
            this.root = root;
            this.box = el("div", { className: "box tr syn" });
            this.box.setAttribute("role", "dialog");
            this.box.setAttribute("aria-label", "Aria Plume — synonymes");
            // Garde le focus et la sélection dans la page pendant qu'on clique dans la bulle.
            this.box.addEventListener("mousedown", (event) => event.preventDefault());
            root.append(this.box);
        },

        async open() {
            const source = findSynonymSource();
            this.ensure();
            this.source = source;
            const seq = ++this.seq;
            if (!source) {
                this.render("", el("div", { className: "tr-status", textContent: "Fais un clic droit sur un mot dans un champ, ou sélectionne un à trois mots, puis relance." }));
                placeBox(this.box, pointRect(null)?.() ?? { left: innerWidth - 440, right: innerWidth - 16, top: 16, bottom: 16 });
                return;
            }
            this.render(`« ${source.text} »`, el("div", { className: "tr-status", textContent: "Recherche…" }));
            placeBox(this.box, source.rect());
            let response;
            try {
                response = await chrome.runtime.sendMessage({ target: "sw", cmd: "synonyms", word: source.text, context: source.context, hint: pageLangHint() });
            } catch (error) {
                response = { ok: false, error: error.message };
            }
            if (seq !== this.seq || this.source !== source) {
                return;
            }
            if (!response?.ok) {
                this.render(`« ${source.text} »`, el("div", { className: "tr-status ko", textContent: response?.error ?? "Pas de réponse de l'extension." }));
            } else {
                this.render(`« ${source.text} » · ${response.lang.toUpperCase()}`, this.results(response));
            }
            placeBox(this.box, source.rect());
        },

        results(response) {
            const body = el("div", { className: "syn-body" });
            if (!response.groups.length) {
                body.append(el("div", { className: "tr-status", textContent: `Aucun synonyme trouvé pour « ${response.word} ».` }));
                return body;
            }
            if (response.lemma && response.lemma.toLowerCase() !== response.word.toLowerCase()) {
                const note = response.base
                    ? `Synonymes de « ${response.lemma} », en forme de base.`
                    : `Synonymes de « ${response.lemma} », accordés comme « ${response.word} ».`;
                body.append(el("div", { className: "syn-note", textContent: note }));
            }
            for (const group of response.groups) {
                const list = el("div", { className: "actions" });
                const buttons = group.words.map((word) => {
                    const button = el("button", { className: "sugg", textContent: word });
                    button.addEventListener("click", () => this.pick(word, button));
                    return button;
                });
                list.append(...buttons.slice(0, MAX_SHOWN_SYNONYMS));
                if (buttons.length > MAX_SHOWN_SYNONYMS) {
                    const more = el("button", { className: "more", textContent: `+${buttons.length - MAX_SHOWN_SYNONYMS}` });
                    more.title = "Voir tous les synonymes";
                    more.addEventListener("click", () => {
                        more.replaceWith(...buttons.slice(MAX_SHOWN_SYNONYMS));
                        placeBox(this.box, this.source.rect());
                    });
                    list.append(more);
                }
                const label = group.pos.split(", ").map((p) => POS_NAMES[p] ?? p).join(" · ");
                body.append(el("div", { className: "syn-group" }, label ? el("div", { className: "kind", textContent: label }) : "", list));
            }
            if (this.source.kind === "page") {
                body.append(el("div", { className: "syn-note", textContent: "Clic sur un synonyme : copié dans le presse-papiers." }));
            }
            return body;
        },

        render(label, content) {
            const close = el("button", { className: "close", title: "Fermer (Échap)", textContent: "×" });
            close.setAttribute("aria-label", "Fermer");
            close.addEventListener("click", () => this.close());
            const head = el("div", { className: "head" },
                el("span", { className: "brand", textContent: "Synonymes" }),
                el("span", { className: "pair", textContent: label }),
                close);
            this.box.replaceChildren(head, el("div", { className: "tr-body" }, content));
        },

        async pick(word, button) {
            const source = this.source;
            const replacement = keepCapital(source.text, word);
            if (source.kind === "page") {
                const done = await copyText(replacement, this.root);
                button.textContent = done ? "Copié ✓" : "Copie impossible";
                return;
            }
            if (source.kind === "field") {
                if (source.target.el.value.slice(source.start, source.end) !== source.text) {
                    this.render(`« ${source.text} »`, el("div", { className: "tr-status ko", textContent: "Le texte a changé : relance la recherche." }));
                    return;
                }
                source.target.replace(source.start, source.end, replacement);
            } else {
                const { doc } = source.target.ctx;
                source.target.host.focus();
                const selection = doc.getSelection();
                selection.removeAllRanges();
                selection.addRange(source.range);
                if (!doc.execCommand("insertText", false, replacement)) {
                    source.range.deleteContents();
                    source.range.insertNode(doc.createTextNode(replacement));
                }
            }
            this.close();
        },

        isInPath(event) {
            return !!this.host && !this.host.hidden && event.composedPath().includes(this.host);
        },

        close() {
            if (this.host) {
                this.host.hidden = true;
            }
            this.source = null;
            this.seq++;
        },

        dispose() {
            this.host?.remove();
            this.host = null;
            this.source = null;
        },
    };

    // ---------------------------------------------------------------------
    // Relecture avant envoi (Gmail)
    // ---------------------------------------------------------------------
    // Au clic sur « Envoyer » (ou Ctrl+Entrée), s'il reste des fautes d'orthographe ou de
    // grammaire dans le mail, l'envoi est retenu et une bulle propose de les voir ou d'envoyer
    // quand même. En cas de doute (page de Gmail changée, analyse trop longue), le mail part.

    const REVIEW_HOSTS = ["mail.google.com"];
    const SEND_LABEL = /^\s*(envoyer|send)\b/i;
    const REVIEW_TIMEOUT_MS = 4000;
    const MESSAGE_BODY = '[contenteditable="true"][role="textbox"], [contenteditable="true"][g_editable="true"]';
    const REPLAY_EVENTS = ["pointerdown", "mousedown", "pointerup", "mouseup", "click"];

    const REVIEW_SHEET = sheet(`
        .review { width: min(340px, calc(100vw - 16px)); padding: 10px 12px; }
        .review .title { font-weight: 600; margin-bottom: 4px; }
        .review .title b { color: #ff4fd8; }
        .review .text { color: #8b91a8; font-size: 13px; margin: 0 0 10px; }
        .review .actions { justify-content: flex-end; }
    `);

    const sendReview = {
        host: null,
        box: null,
        busy: false,
        bypassUntil: 0,

        active() {
            return prefs.reviewBeforeSend && REVIEW_HOSTS.includes(location.hostname) && Date.now() > this.bypassUntil;
        },

        sendButtonIn(path) {
            for (const node of path) {
                if (!(node instanceof Element)) {
                    continue;
                }
                if (node.getAttribute("role") === "button" || node.tagName === "BUTTON") {
                    const label = node.getAttribute("data-tooltip") || node.getAttribute("aria-label") || "";
                    return SEND_LABEL.test(label) ? node : null;
                }
            }
            return null;
        },

        // Corps du brouillon : la zone éditable la plus proche du bouton « Envoyer ».
        bodyNear(button) {
            for (let node = button.parentElement, depth = 0; node && depth < 25; node = node.parentElement, depth++) {
                const body = node.querySelector(MESSAGE_BODY);
                if (body) {
                    return body;
                }
            }
            return null;
        },

        buttonNear(body) {
            for (let node = body.parentElement, depth = 0; node && depth < 25; node = node.parentElement, depth++) {
                const button = [...node.querySelectorAll('[role="button"], button')].find((b) => SEND_LABEL.test(b.getAttribute("data-tooltip") || b.getAttribute("aria-label") || ""));
                if (button) {
                    return button;
                }
            }
            return null;
        },

        // Texte écrit par toi : sans la citation du message auquel tu réponds ni la signature.
        ownText(body) {
            const clone = body.cloneNode(true);
            clone.querySelectorAll(".gmail_quote, blockquote, .gmail_signature, [data-smartmail='gmail_signature']").forEach((node) => node.remove());
            return new EditableTarget(clone, { doc: document, offsetX: 0, offsetY: 0 }).getText();
        },

        async countErrors(body) {
            const text = this.ownText(body);
            if (text.trim().length < 2) {
                return 0;
            }
            const timeout = new Promise((resolve) => setTimeout(() => resolve(null), REVIEW_TIMEOUT_MS));
            const response = await Promise.race([requestCheck(text), timeout]);
            if (!response?.ok) {
                return null;  // pas de réponse : on ne bloque pas l'envoi
            }
            return response.matches.filter((m) => (m.kind === "orthographe" || m.kind === "grammaire") && !isHidden(m, text.slice(m.start, m.end))).length;
        },

        async review(button, body) {
            if (this.busy) {
                return;
            }
            this.busy = true;
            try {
                const count = await this.countErrors(body);
                if (!count) {
                    this.send(button);
                } else {
                    this.show(button, body, count);
                }
            } finally {
                this.busy = false;
            }
        },

        // Rejoue le clic sur « Envoyer » (Gmail réagit à la séquence souris complète).
        send(button) {
            this.close();
            if (!button?.isConnected) {
                return;
            }
            this.bypassUntil = Date.now() + 1500;
            const rect = button.getBoundingClientRect();
            const point = { bubbles: true, cancelable: true, composed: true, view: window, button: 0, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
            for (const type of REPLAY_EVENTS) {
                const event = type.startsWith("pointer") ? new PointerEvent(type, { ...point, pointerType: "mouse", isPrimary: true }) : new MouseEvent(type, point);
                button.dispatchEvent(event);
            }
        },

        show(button, body, count) {
            if (!this.host?.isConnected) {
                const { host, root } = createShadowHost("aria-odl-review", [UI_SHEET, REVIEW_SHEET]);
                this.host = host;
                this.box = el("div", { className: "box review" });
                this.box.setAttribute("role", "alertdialog");
                this.box.setAttribute("aria-label", "Aria Plume — relecture avant envoi");
                this.box.addEventListener("mousedown", (event) => event.preventDefault());
                root.append(this.box);
            }
            this.host.hidden = false;
            const look = el("button", { textContent: "Voir les fautes" });
            look.addEventListener("click", () => {
                this.close();
                body.focus();
                panel.open();
            });
            const anyway = el("button", { className: "primary", textContent: "Envoyer quand même" });
            anyway.addEventListener("click", () => this.send(button));
            const plural = count > 1 ? "s" : "";
            this.box.replaceChildren(
                el("div", { className: "title" }, el("b", { textContent: `${count} faute${plural}` }), ` reste${count > 1 ? "nt" : ""} dans ton mail.`),
                el("p", { className: "text", textContent: "Orthographe ou grammaire. Échap pour revenir au mail." }),
                el("div", { className: "actions" }, look, anyway),
            );
            placeBox(this.box, button.getBoundingClientRect(), false);
            anyway.focus();
        },

        isOpen() {
            return !!this.host?.isConnected && !this.host.hidden;
        },

        isInPath(event) {
            return this.isOpen() && event.composedPath().includes(this.host);
        },

        close() {
            if (this.host) {
                this.host.hidden = true;
            }
        },

        dispose() {
            this.host?.remove();
            this.host = null;
        },
    };

    // Souris : on retient toute la séquence du clic sur « Envoyer », puis on relit.
    for (const type of REPLAY_EVENTS) {
        listen(window, type, (event) => {
            if (!event.isTrusted || !sendReview.active() || sendReview.isInPath(event)) {
                return;
            }
            const button = sendReview.sendButtonIn(event.composedPath());
            const body = button && sendReview.bodyNear(button);
            if (!body) {
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            if (type === "click") {
                sendReview.review(button, body);
            }
        }, true);
    }

    // Clavier : Ctrl+Entrée (Cmd+Entrée sur Mac) dans le corps du message.
    listen(window, "keydown", (event) => {
        if (!event.isTrusted || event.key !== "Enter" || !(event.ctrlKey || event.metaKey) || !sendReview.active()) {
            return;
        }
        const target = event.composedPath().find((node) => node instanceof Element && node.matches(MESSAGE_BODY));
        const button = target && sendReview.buttonNear(target);
        if (!button) {
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        sendReview.review(button, target);
    }, true);

    function escapeHtml(text) {
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // --- Page entière ---
    // La page est découpée en blocs (paragraphes, titres, cellules…). Seuls les blocs proches
    // de l'écran sont traduits, au fil du défilement, avec le mode HTML de Bergamot qui garde
    // liens et mises en forme. Quand c'est possible, seuls les nœuds texte changent : la structure
    // de la page (et le code du site qui s'y accroche) reste intacte.

    const PAGE_BLOCK = /^(ADDRESS|ARTICLE|ASIDE|BLOCKQUOTE|BODY|CAPTION|DD|DETAILS|DIALOG|DIV|DL|DT|FIELDSET|FIGCAPTION|FIGURE|FOOTER|FORM|H[1-6]|HEADER|HGROUP|HR|LEGEND|LI|MAIN|MENU|NAV|OL|P|SECTION|SUMMARY|TABLE|TBODY|TD|TFOOT|TH|THEAD|TR|UL)$/;
    const PAGE_SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|CODE|PRE|KBD|SAMP|VAR|TEXTAREA|INPUT|SELECT|OPTION|SVG|MATH|CANVAS|IFRAME|OBJECT|EMBED|VIDEO|AUDIO|HEAD|TITLE)$/;
    const MAX_PAGE_REQUESTS = 6;
    const meaningful = (text) => /\p{L}{2}/u.test(text);
    const tagOf = (element) => element.tagName.toUpperCase();

    function skippedForPage(element) {
        return PAGE_SKIP.test(tagOf(element))
            || tagOf(element).startsWith("ARIA-ODL-")
            || element.isContentEditable === true
            || element.getAttribute("translate") === "no"
            || !!element.classList?.contains("notranslate");
    }

    // Blocs à traduire sous `root` : éléments sans bloc descendant, ou texte isolé entre deux blocs.
    function collectUnits(root) {
        const hasBlock = new Map();
        const compute = (element) => {
            let result = false;
            for (const child of element.children) {
                if (!skippedForPage(child) && (compute(child) || PAGE_BLOCK.test(tagOf(child)))) {
                    result = true;
                }
            }
            hasBlock.set(element, result);
            return result;
        };
        const units = [];
        const visit = (element) => {
            if (!hasBlock.get(element)) {
                if (meaningful(element.textContent)) {
                    units.push(element);
                }
                return;
            }
            for (const child of element.childNodes) {
                if (child.nodeType === 3) {
                    if (meaningful(child.data)) {
                        units.push(child);
                    }
                } else if (child.nodeType === 1 && !skippedForPage(child)) {
                    visit(child);
                }
            }
        };
        if (root.nodeType === 3) {
            return meaningful(root.data) ? [root] : [];
        }
        if (root.nodeType !== 1 || skippedForPage(root)) {
            return [];
        }
        compute(root);
        visit(root);
        return units;
    }

    function textNodesOf(root, skip) {
        const nodes = [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => {
                for (let parent = node.parentElement; parent && parent !== root; parent = parent.parentElement) {
                    if (skip(parent)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                }
                return node.data.trim() === "" ? NodeFilter.FILTER_SKIP : NodeFilter.FILTER_ACCEPT;
            },
        });
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            nodes.push(node);
        }
        return nodes;
    }

    // Garde les espaces d'origine autour d'un texte traduit (sinon les mots collent aux balises).
    function keepSpaces(original, translated) {
        const lead = original.match(/^\s*/)[0];
        const trail = original.match(/\s*$/)[0];
        return lead + translated.trim() + trail;
    }

    async function translateUnit(job, unit) {
        const ask = (text, html) => requestTranslation({ text, html, from: job.from, to: job.to, priority: 1, jobId: job.id });
        if (unit.nodeType === 3) {
            const original = unit.data;
            const response = await ask(original.trim(), false);
            return response?.ok ? { kind: "text", entries: [[unit, original, keepSpaces(original, response.text)]] } : null;
        }
        const skipInside = (element) => skippedForPage(element);
        const texts = textNodesOf(unit, skipInside);
        if (texts.length === 0) {
            return null;
        }
        if (texts.length === 1 && unit.children.length === 0) {
            const [node] = texts;
            const response = await ask(node.data.trim(), false);
            return response?.ok ? { kind: "text", entries: [[node, node.data, keepSpaces(node.data, response.text)]] } : null;
        }
        // Copie allégée : balises sans attributs, repérées par leur rang (data-o). Le contenu protégé
        // (code…) reste dans la phrase pour que le moteur comprenne le contexte, mais n'est jamais modifié.
        const originals = [...unit.querySelectorAll("*")];
        const clone = unit.cloneNode(true);
        [...clone.querySelectorAll("*")].forEach((element, i) => {
            for (const name of element.getAttributeNames()) {
                element.removeAttribute(name);
            }
            element.setAttribute("data-o", String(i));
        });
        const response = await ask(clone.innerHTML, true);
        if (!response?.ok) {
            return null;
        }
        const parsed = new DOMParser().parseFromString(`<!doctype html><body>${response.text}</body>`, "text/html").body;
        const rank = (element) => (element === unit || element === parsed || !element ? -1 : Number(element.getAttribute?.("data-o") ?? -2));
        const originalRank = new Map(originals.map((element, i) => [element, i]));
        const owner = (node) => (node.parentElement === unit ? -1 : (originalRank.get(node.parentElement) ?? -2));
        const translatedTexts = textNodesOf(parsed, (element) => skippedForPage(originals[rank(element)] ?? element));
        const sameShape = translatedTexts.length === texts.length
            && texts.every((node, i) => owner(node) === (translatedTexts[i].parentElement === parsed ? -1 : rank(translatedTexts[i].parentElement)));
        if (sameShape) {
            return { kind: "text", entries: texts.map((node, i) => [node, node.data, keepSpaces(node.data, translatedTexts[i].data)]) };
        }
        // La traduction a déplacé des mots d'une balise à l'autre : on reconstruit le contenu du bloc
        // à partir des éléments d'origine (attributs conservés), sans jamais exécuter de code.
        const used = new Set();
        const rebuild = (node) => {
            if (node.nodeType === 3) {
                return [document.createTextNode(node.data)];
            }
            if (node.nodeType !== 1) {
                return [];
            }
            const source = originals[rank(node)];
            const children = [...node.childNodes].flatMap(rebuild);
            if (!source) {
                return children;  // balise inconnue : on garde seulement son texte
            }
            // Le moteur peut couper une balise en deux (« <a>serveur</a> de <a>production</a> ») :
            // les copies suivantes perdent leur id pour ne pas le dupliquer dans la page.
            const copy = skippedForPage(source) ? source.cloneNode(true) : source.cloneNode(false);
            if (used.has(source)) {
                copy.removeAttribute("id");
            }
            used.add(source);
            if (skippedForPage(source)) {
                return [copy];
            }
            copy.append(...children);
            return [copy];
        };
        return { kind: "replace", unit, original: [...unit.childNodes], translated: [...parsed.childNodes].flatMap(rebuild) };
    }

    function applyRecord(record, mode) {
        if (record.kind === "text") {
            for (const [node, original, translated] of record.entries) {
                const [from, to] = mode === "translation" ? [original, translated] : [translated, original];
                if (node.data === from) {
                    node.data = to;  // un texte modifié entre-temps par le site n'est pas écrasé
                }
            }
        } else {
            record.unit.replaceChildren(...(mode === "translation" ? record.translated : record.original));
        }
    }

    const pageBar = {
        host: null,
        box: null,
        status: null,
        toggle: null,

        open() {
            if (!this.host?.isConnected) {
                const { host, root } = createShadowHost("aria-odl-pagebar", [UI_SHEET, TR_SHEET]);
                this.host = host;
                this.status = el("span", { className: "status" });
                this.toggle = el("button", { className: "sugg" });
                this.toggle.addEventListener("click", () => pageTranslation.toggle());
                const close = el("button", { className: "close", title: "Arrêter et revenir à l'original", textContent: "×" });
                close.setAttribute("aria-label", "Arrêter la traduction");
                close.addEventListener("click", () => pageTranslation.stop());
                this.box = el("div", { className: "box bar" }, el("span", { className: "brand", textContent: "Aria Plume" }), this.status, this.toggle, close);
                this.box.setAttribute("role", "status");
                root.append(this.box);
            }
            this.host.hidden = false;
        },

        update() {
            const job = pageTranslation.job;
            if (!job || !this.status) {
                return;
            }
            const busy = job.inFlight + job.queue.length > 0;
            this.status.className = "status";
            this.status.textContent = `${pairLabel(job.from, job.to)} · ${job.done} bloc${job.done > 1 ? "s" : ""}${busy ? " · traduction…" : ""}`;
            this.toggle.hidden = false;
            this.toggle.textContent = job.showing === "translation" ? "Voir l'original" : "Voir la traduction";
        },

        message(text, isError = false) {
            this.status.className = isError ? "status ko" : "status";
            this.status.textContent = text;
            this.toggle.hidden = true;
        },

        close() {
            this.host?.remove();
            this.host = null;
        },
    };

    const pageTranslation = {
        job: null,

        async detectLanguage() {
            const sample = (document.body?.innerText ?? "").slice(0, 3000);
            let response = null;
            try {
                response = await chrome.runtime.sendMessage({ target: "sw", cmd: "detect", text: sample });
            } catch {
                response = null;
            }
            if (response?.ok && response.supported) {
                return response.lang;
            }
            return pageLangHint();
        },

        async start() {
            if (this.job) {
                this.show("translation");
                return;
            }
            pageBar.open();
            pageBar.message("Détection de la langue…");
            const lang = await this.detectLanguage();
            if (this.job) {
                return;
            }
            if (!lang) {
                pageBar.message("Langue de la page non prise en charge (français ↔ anglais uniquement).", true);
                return;
            }
            const job = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                from: lang,
                to: lang === "fr" ? "en" : "fr",
                records: new Map(),
                registered: new WeakSet(),
                targets: new Map(),
                queue: [],
                inFlight: 0,
                done: 0,
                showing: "translation",
            };
            this.job = job;
            job.intersection = new IntersectionObserver((entries) => this.onVisible(job, entries), { rootMargin: "800px 0px" });
            job.mutation = new MutationObserver((mutations) => this.onMutations(job, mutations));
            job.mutation.observe(document.body, { childList: true, subtree: true });
            this.register(job, collectUnits(document.body));
            pageBar.update();
        },

        register(job, units) {
            for (const unit of units) {
                if (job.registered.has(unit)) {
                    continue;
                }
                job.registered.add(unit);
                const target = unit.nodeType === 3 ? unit.parentElement : unit;
                if (!target) {
                    continue;
                }
                if (!job.targets.has(target)) {
                    job.targets.set(target, []);
                    job.intersection.observe(target);
                }
                job.targets.get(target).push(unit);
            }
        },

        onVisible(job, entries) {
            for (const entry of entries) {
                if (!entry.isIntersecting) {
                    continue;
                }
                job.intersection.unobserve(entry.target);
                const units = job.targets.get(entry.target) ?? [];
                job.targets.delete(entry.target);
                job.queue.push(...units);
            }
            this.pump(job);
            pageBar.update();
        },

        isCovered(job, node) {
            for (let current = node; current && current !== document.body; current = current.parentNode) {
                if (job.registered.has(current)) {
                    return true;
                }
            }
            return false;
        },

        // Contenu ajouté après coup (fil de discussion, défilement infini…).
        onMutations(job, mutations) {
            if (this.job !== job) {
                return;
            }
            const units = [];
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if ((node.nodeType === 1 || node.nodeType === 3) && node.isConnected && !this.isCovered(job, node)) {
                        units.push(...collectUnits(node));
                    }
                }
            }
            this.register(job, units);
        },

        pump(job) {
            while (this.job === job && job.inFlight < MAX_PAGE_REQUESTS && job.queue.length > 0) {
                const unit = job.queue.shift();
                if (!unit.isConnected) {
                    continue;
                }
                job.inFlight++;
                translateUnit(job, unit)
                    .then((record) => {
                        if (this.job !== job || !record || !unit.isConnected) {
                            return;
                        }
                        job.records.set(unit, record);
                        job.done++;
                        if (job.showing === "translation") {
                            applyRecord(record, "translation");
                        }
                    })
                    .catch(() => {})
                    .finally(() => {
                        job.inFlight--;
                        if (this.job === job) {
                            pageBar.update();
                            this.pump(job);
                        }
                    });
            }
        },

        show(mode) {
            const job = this.job;
            if (!job || job.showing === mode) {
                return;
            }
            job.showing = mode;
            for (const record of job.records.values()) {
                applyRecord(record, mode);
            }
            pageBar.update();
        },

        toggle() {
            if (this.job) {
                this.show(this.job.showing === "translation" ? "original" : "translation");
            }
        },

        stop() {
            const job = this.job;
            if (job) {
                this.show("original");
                job.intersection.disconnect();
                job.mutation.disconnect();
                job.queue.length = 0;
                try {
                    chrome.runtime.sendMessage({ target: "sw", cmd: "translate-cancel", jobId: job.id }).catch(() => {});
                } catch {
                    // extension rechargée : plus rien à annuler
                }
            }
            this.job = null;
            pageBar.close();
        },
    };

    // ---------------------------------------------------------------------
    // Réglages (popup) et messages du service worker
    // ---------------------------------------------------------------------

    // Le réglage « par site » suit le site de l'onglet, y compris dans ses iframes.
    function siteHost() {
        const ancestors = location.ancestorOrigins;
        if (ancestors?.length) {
            try {
                return new URL(ancestors[ancestors.length - 1]).hostname;
            } catch {
                // origine opaque
            }
        }
        return location.hostname;
    }

    async function applySettings() {
        let settings = DEFAULTS;
        try {
            settings = await chrome.storage.local.get(DEFAULTS);
        } catch {
            return;
        }
        prefs.debounceMs = Number.isFinite(settings.debounceMs) ? Math.min(2000, Math.max(200, settings.debounceMs)) : DEFAULTS.debounceMs;
        prefs.disabledKinds = new Set(Array.isArray(settings.disabledKinds) ? settings.disabledKinds : []);
        prefs.hideNativeSpellcheck = settings.hideNativeSpellcheck === true;
        prefs.reviewBeforeSend = settings.reviewBeforeSend !== false;
        ignored.clear();
        for (const entry of Array.isArray(settings.ignored) ? settings.ignored : []) {
            if (entry && typeof entry.word === "string" && typeof entry.rule === "string") {
                ignored.add(ignoreKey(entry.word, entry.rule));
            }
        }
        loadDictionary(settings.dictionary);
        applyColors(settings.colors);
        live.session?.updateSpellcheck();
        live.session?.render();
        panel.refresh();

        const enabled = settings.liveEnabled && !settings.disabledHosts.includes(siteHost());
        if (enabled === live.enabled) {
            return;
        }
        live.enabled = enabled;
        if (enabled) {
            onFocus(deepActiveElement());
        } else {
            live.session?.dispose();
            live.session = null;
            bubble.close();
        }
    }

    function onStorageChanged(changes, area) {
        if (area === "local") {
            applySettings();
            // Réglages qui changent l'analyse elle-même : on relance tout de suite.
            if (changes.formalFrench || changes.formalHosts || changes.casualHosts || changes.englishDialect || changes.repetitions || changes.repetitionDistance) {
                live.session?.schedule(0);
                if (panel.isOpen() && panel.state?.checked) {
                    panel.analyze();
                }
            }
        }
    }
    chrome.storage.onChanged.addListener(onStorageChanged);

    // Pages de l'extension (popup, fenêtre séparée) : le bouton « Tout corriger » ouvre le panneau.
    if (location.protocol === "chrome-extension:") {
        listen(window, "aria-odl-open-panel", () => panel.open());
    }
    cleanups.push(() => chrome.storage.onChanged.removeListener(onStorageChanged));

    function onMessage(msg, sender, sendResponse) {
        if (sender.id !== chrome.runtime.id || msg?.target !== "content") {
            return false;
        }
        if (msg.cmd === "open-panel") {
            panel.open();
        } else if (msg.cmd === "translate-selection") {
            translateBubble.open();
        } else if (msg.cmd === "translate-page") {
            pageTranslation.start();
        } else if (msg.cmd === "synonyms") {
            synonymBubble.open();
        }
        sendResponse({ ok: true });
        return false;
    }
    chrome.runtime.onMessage.addListener(onMessage);
    cleanups.push(() => chrome.runtime.onMessage.removeListener(onMessage));

    function teardown() {
        for (const cleanup of cleanups.splice(0)) {
            try {
                cleanup();
            } catch {
                // contexte d'extension déjà invalidé
            }
        }
        live.session?.dispose();
        live.session = null;
        live.enabled = false;
        bubble.dispose();
        panel.dispose();
        translateBubble.dispose();
        synonymBubble.dispose();
        sendReview.dispose();
        pageTranslation.stop();
    }

    globalThis.__ariaOdl = { teardown };
    applySettings();
})();
