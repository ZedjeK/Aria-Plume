// Aria Plume (application) — section « Application » ajoutée en tête de la page de réglages de
// l'extension : raccourci global, démarrage avec Windows, emplacement du fichier de réglages.
// Les réglages propres au navigateur (correction en direct sur les sites, relecture Gmail…) sont
// masqués par app.css.

(() => {
    // Exports (réglages, dictionnaire) : la page crée un lien de téléchargement vers un Blob ; dans
    // l'application, on enregistre plutôt le contenu par la boîte « Enregistrer sous » de Windows.
    const blobs = new Map();
    const createObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
        const url = createObjectURL(blob);
        blobs.set(url, blob);
        return url;
    };
    const anchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function click() {
        const blob = blobs.get(this.href);
        if (!this.download || !blob) {
            return anchorClick.call(this);
        }
        blobs.delete(this.href);
        blob.text().then((text) => window.ariaApp.saveFile(this.download, text)).catch((error) => console.error(error));
        return undefined;
    };

    const el = (tag, props = {}, ...children) => {
        const node = document.createElement(tag);
        Object.assign(node, props);
        node.append(...children);
        return node;
    };
    const row = (title, help, control) => el("label", { className: "row" },
        el("span", {}, el("strong", { textContent: title }), el("small", { textContent: help })),
        control);

    // « Alt+Shift+C » → « Alt+Maj+C ».
    const show = (accelerator) => accelerator.replace(/Shift/g, "Maj").replace(/CommandOrControl|CmdOrCtrl|Control/g, "Ctrl");
    const KEY_NAMES = { " ": "Space", ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right" };

    // Combinaison au format Electron à partir d'un appui de touches, ou null si incomplète.
    function accelerator(event) {
        const key = KEY_NAMES[event.key] ?? event.key;
        if (["Control", "Shift", "Alt", "Meta", "AltGraph"].includes(key)) {
            return null;
        }
        const main = /^F\d{1,2}$/.test(key) || key === "Space" || /^(Up|Down|Left|Right)$/.test(key)
            ? key
            : /^Key[A-Z]$/.test(event.code) ? event.code.slice(3)
                : /^Digit\d$/.test(event.code) ? event.code.slice(5) : null;
        if (!main) {
            return null;
        }
        const mods = [event.ctrlKey && "Ctrl", event.altKey && "Alt", event.shiftKey && "Shift"].filter(Boolean);
        // Une touche seule (sauf F1-F24) volerait la frappe à tous les logiciels.
        if (!mods.length && !/^F\d{1,2}$/.test(main)) {
            return null;
        }
        return [...mods, main].join("+");
    }

    async function build() {
        const settings = await chrome.storage.local.get({ hotkey: "Alt+Shift+C", startWithWindows: false });
        const hotkeyInput = el("input", { type: "text", readOnly: true, className: "hotkey", value: show(settings.hotkey), title: "Clique puis appuie sur la combinaison voulue" });
        hotkeyInput.setAttribute("aria-label", "Raccourci global");
        const hotkeyStatus = el("p", { className: "status", id: "hotkeyStatus" });
        hotkeyStatus.setAttribute("aria-live", "polite");

        async function refreshStatus() {
            const state = await window.ariaApp.hotkey();
            hotkeyInput.value = show(state.accelerator);
            hotkeyStatus.textContent = state.ok
                ? `Raccourci actif : ${state.display}.`
                : `Le raccourci ${state.display} est indisponible (déjà pris par un autre logiciel ?) : choisis-en un autre.`;
            hotkeyStatus.classList.toggle("error", !state.ok);
        }

        hotkeyInput.addEventListener("focus", () => {
            hotkeyInput.value = "Appuie sur la combinaison…";
        });
        hotkeyInput.addEventListener("blur", refreshStatus);
        hotkeyInput.addEventListener("keydown", async (event) => {
            event.preventDefault();
            if (event.key === "Escape") {
                hotkeyInput.blur();
                return;
            }
            const combination = accelerator(event);
            if (!combination) {
                return;
            }
            hotkeyInput.value = show(combination);
            await chrome.storage.local.set({ hotkey: combination });
            await new Promise((resolve) => setTimeout(resolve, 150));
            await refreshStatus();
            hotkeyInput.blur();
        });

        const section = el("section", { id: "app-settings" }, el("h2", { textContent: "Application" }));
        section.append(
            row("Raccourci global", "Sélectionne du texte dans n'importe quel logiciel, puis appuie sur ce raccourci : la sélection s'ouvre dans le correcteur, et « Renvoyer » la remplace par le texte corrigé. Clique dans la case puis appuie sur la combinaison voulue.", hotkeyInput),
            hotkeyStatus,
        );
        if (window.ariaApp.platform === "win32") {
            const startBox = el("input", { type: "checkbox", className: "toggle", id: "startWithWindows", checked: settings.startWithWindows });
            startBox.addEventListener("change", () => chrome.storage.local.set({ startWithWindows: startBox.checked }));
            section.append(row("Démarrer avec Windows", "Aria Plume se lance à l'ouverture de ta session, directement près de l'horloge.", startBox));
        }
        const file = await window.ariaApp.settingsFile();
        const openFolder = el("button", { type: "button", textContent: "Ouvrir le dossier" });
        openFolder.addEventListener("click", () => window.ariaApp.showSettingsFile());
        section.append(
            el("p", { className: "hint" }, "Tes réglages sont enregistrés dans ", el("code", { textContent: file }), ". Pour retrouver ceux de l'extension (dictionnaire, glossaire…), exporte-les depuis ses réglages, puis utilise « Importer » tout en bas de cette page."),
            el("div", { className: "buttons" }, openFolder),
        );
        document.querySelector("main").prepend(section);
        await refreshStatus();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", build);
    } else {
        build();
    }
})();
