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

    // Extension du navigateur : installation assistée. Les navigateurs interdisent à un logiciel
    // d'installer une extension seul ; l'application copie l'extension dans un dossier fixe, ouvre
    // le navigateur et guide les trois clics qui restent.
    async function extensionBlock() {
        const status = el("p", { className: "status", id: "extensionStatus" });
        status.setAttribute("aria-live", "polite");
        const buttons = el("div", { className: "buttons", id: "extensionButtons" });
        const steps = el("div", { className: "ext-steps", id: "extensionSteps", hidden: true });

        const copyPath = el("button", { type: "button", textContent: "Copier le chemin du dossier", id: "extensionCopyPath" });
        copyPath.addEventListener("click", async () => {
            await window.ariaApp.copyExtensionPath();
            copyPath.textContent = "Chemin copié ✓";
            setTimeout(() => {
                copyPath.textContent = "Copier le chemin du dossier";
            }, 1500);
        });
        const openFolder = el("button", { type: "button", textContent: "Ouvrir le dossier", id: "extensionOpenFolder" });
        openFolder.addEventListener("click", () => window.ariaApp.openExtensionFolder());

        function showState(state) {
            if (!state.copied) {
                status.textContent = `L'extension sera copiée dans « ${state.folder} ». Laisse ce dossier en place : le navigateur la lit depuis là.`;
            } else if (state.copied !== state.version) {
                status.textContent = `Mise à jour disponible : l'extension copiée est en version ${state.copied}, l'application en ${state.version}. Clique sur ton navigateur pour la mettre à jour.`;
            } else {
                status.textContent = `Extension ${state.copied} prête dans « ${state.folder} ».`;
            }
            status.classList.toggle("error", !!state.copied && state.copied !== state.version);
        }

        function showSteps(result, name) {
            const update = result.updated && result.previous;
            const step = (...content) => el("li", {}, ...content);
            const list = el("ol", {},
                step(result.launched ? `${name} s'ouvre. L'adresse ` : "Ouvre ton navigateur. L'adresse ",
                    el("code", { textContent: result.url }), " est dans ton presse-papiers : colle-la (Ctrl+V) dans sa barre d'adresse, puis Entrée."),
                step("Active le « Mode développeur » (un interrupteur en haut ou dans le coin de la page)."),
                step("Clique sur « Charger l'extension non empaquetée » (Edge : « Charger l'extension décompressée »)."),
                step("Clique ici sur « Copier le chemin du dossier », colle-le dans la case « Dossier » de la fenêtre qui s'est ouverte, puis « Sélectionner le dossier ». Aria Plume apparaît dans tes extensions."),
            );
            steps.replaceChildren(
                ...(update ? [el("p", { className: "hint", textContent: `Fichiers mis à jour (${result.previous} → ${result.copied}). Si l'extension est déjà installée dans ce navigateur, il suffit de cliquer sur ↻ (Recharger) sur sa carte, dans la page des extensions. Sinon :` })] : []),
                ...(result.error ? [el("p", { className: "status error", textContent: `Impossible d'ouvrir ${name} (${result.error}) : ouvre-le toi-même.` })] : []),
                list,
                el("div", { className: "buttons" }, copyPath),
            );
            steps.hidden = false;
        }

        async function install(id, name, button) {
            const all = buttons.querySelectorAll("button");
            all.forEach((item) => {
                item.disabled = true;
            });
            const before = await window.ariaApp.extensionState();
            status.classList.remove("error");
            status.textContent = before.copied === before.version ? `Ouverture de ${name}…` : "Copie de l'extension…";
            try {
                const result = await window.ariaApp.installExtension(id);
                showState(result);
                showSteps({ ...result, previous: before.copied }, name);
            } catch (error) {
                status.textContent = String(error?.message ?? error).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
                status.classList.add("error");
            } finally {
                all.forEach((item) => {
                    item.disabled = false;
                });
                button.focus();
            }
        }

        const state = await window.ariaApp.extensionState();
        const label = (name) => (state.copied && state.copied !== state.version ? `Mettre à jour dans ${name}` : `Installer dans ${name}`);
        for (const browser of state.browsers) {
            const button = el("button", { type: "button", textContent: label(browser.name) });
            button.dataset.browser = browser.id;
            button.addEventListener("click", () => install(browser.id, browser.name, button));
            buttons.append(button);
        }
        const other = el("button", { type: "button", textContent: state.browsers.length ? "Autre navigateur" : "Préparer l'extension" });
        other.dataset.browser = "other";
        other.addEventListener("click", () => install("other", "ton navigateur", other));
        buttons.append(other, openFolder);
        showState(state);
        return [
            el("h3", { textContent: "Extension du navigateur" }),
            el("p", { className: "hint", textContent: "La même correction directement dans les pages web (Chrome, Edge, Brave, Opera, Opera GX, Vivaldi…). Les navigateurs interdisent à un logiciel d'installer une extension tout seul : Aria Plume prépare tout, il te reste trois clics, guidés ici. Pour qu'elle partage les réglages de l'application (dictionnaire, glossaire…), connecte ensuite les navigateurs, juste en dessous. Firefox n'est pas pris en charge." }),
            status,
            buttons,
            steps,
        ];
    }

    // Pont avec l'extension : le navigateur fait corriger et traduire par l'application (mêmes
    // réglages, même dictionnaire). L'inscription se fait dans HKEY_CURRENT_USER, sans droit administrateur.
    async function bridgeBlock() {
        const status = el("p", { className: "status", id: "bridgeStatus" });
        status.setAttribute("aria-live", "polite");
        const connect = el("button", { type: "button", id: "bridgeRegister" });
        const disconnect = el("button", { type: "button", textContent: "Déconnecter", id: "bridgeUnregister" });

        function showState(state, extra = "") {
            connect.hidden = !state.supported;
            disconnect.hidden = !state.registered;
            connect.textContent = state.registered ? "Reconnecter les navigateurs" : "Connecter les navigateurs";
            let text;
            if (!state.supported) {
                text = state.reason === "portable"
                    ? "Tu utilises l'exe portable, qui se décompresse ailleurs à chaque lancement : pour connecter les navigateurs, utilise la version zip."
                    : "La connexion avec les navigateurs n'est prévue que sous Windows.";
            } else if (!state.registered) {
                text = "Navigateurs non connectés : l'extension utilise son propre moteur et ses propres réglages.";
            } else {
                const clients = state.clients ? ` ${state.clients} connexion${state.clients > 1 ? "s" : ""} en cours.` : "";
                text = `Navigateurs connectés (${state.browsers.join(", ")}).${clients}`;
            }
            if (state.error) {
                text += ` Le canal de l'application n'a pas pu s'ouvrir : ${state.error}`;
            }
            status.textContent = `${text}${extra}`;
            status.classList.toggle("error", !state.supported || !!state.error);
        }

        async function act(button, action) {
            connect.disabled = true;
            disconnect.disabled = true;
            try {
                const result = await action();
                const state = result.state ?? result;
                const failed = result.failed?.length ? ` Échec pour : ${result.failed.map(({ name }) => name).join(", ")}.` : "";
                showState(state, failed);
            } catch (error) {
                status.textContent = String(error?.message ?? error).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
                status.classList.add("error");
            } finally {
                connect.disabled = false;
                disconnect.disabled = false;
                button.focus();
            }
        }
        connect.addEventListener("click", () => act(connect, () => window.ariaApp.registerBridge()));
        disconnect.addEventListener("click", () => act(disconnect, () => window.ariaApp.unregisterBridge()));
        showState(await window.ariaApp.bridgeState());
        return [
            el("h3", { textContent: "Connexion avec l'extension" }),
            el("p", { className: "hint", textContent: "Une fois connectée, l'extension fait corriger et traduire par l'application : un seul moteur, les mêmes réglages et le même dictionnaire partout. Si l'application est fermée, l'extension la démarre en arrière-plan ; si elle ne répond pas, l'extension reprend son propre moteur. Rien ne sort de ton PC : le navigateur et l'application se parlent par un canal réservé à ta session Windows." }),
            status,
            el("div", { className: "buttons" }, connect, disconnect),
        ];
    }

    // Complément Office (Word, Outlook) : serveur HTTPS local et son certificat.
    async function officeBlock() {
        const status = el("p", { className: "status", id: "officeStatus" });
        status.setAttribute("aria-live", "polite");
        const install = el("button", { type: "button", id: "officeInstall" });
        const test = el("button", { type: "button", textContent: "Tester dans le navigateur", id: "officeTest" });
        const remove = el("button", { type: "button", textContent: "Désinstaller", id: "officeUninstall" });

        function showState(state, extra = "") {
            install.textContent = state.installed ? "Réparer le complément Office" : "Installer le complément Office";
            test.hidden = !state.listening;
            remove.hidden = !state.installed;
            let text;
            if (!state.installed) {
                text = "Complément non installé.";
            } else if (state.trusted === false) {
                text = "Certificat pas encore approuvé par Windows : clique sur « Réparer le complément Office » et réponds « Oui » à l'avertissement de Windows.";
            } else if (state.error) {
                text = `Le serveur du complément n'a pas pu démarrer : ${state.error}.`;
            } else {
                text = `Serveur du complément prêt sur ${state.url}${state.trusted ? ", certificat approuvé par Windows" : ""}.`;
            }
            status.textContent = `${text}${extra}`;
            status.classList.toggle("error", state.installed && (state.trusted === false || !!state.error));
        }

        async function act(button, action) {
            [install, test, remove].forEach((item) => {
                item.disabled = true;
            });
            try {
                const state = await action();
                if (state?.installed !== undefined) {
                    showState(state, state.refused ? " (Tu as répondu « Non » à Windows : rien n'a été approuvé.)" : "");
                }
            } catch (error) {
                status.textContent = String(error?.message ?? error).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
                status.classList.add("error");
            } finally {
                [install, test, remove].forEach((item) => {
                    item.disabled = false;
                });
                button.focus();
            }
        }
        install.addEventListener("click", () => act(install, () => window.ariaApp.installOffice()));
        test.addEventListener("click", () => act(test, async () => {
            await window.ariaApp.openOfficeTest();
            return null;
        }));
        remove.addEventListener("click", () => act(remove, () => window.ariaApp.uninstallOffice()));
        showState(await window.ariaApp.officeState());
        return [
            el("h3", { textContent: "Complément Office (Word, Outlook)" }),
            el("p", { className: "hint", textContent: "Word et Outlook n'affichent un complément que servi en HTTPS, avec un certificat approuvé par Windows. Aria Plume crée un certificat valable uniquement pour localhost, puis détruit la clé qui l'a signé : il ne peut servir à rien d'autre. Windows te demandera une fois de l'approuver, pour ta session seulement (« Oui » dans son avertissement). Le serveur n'écoute que ton PC. « Tester dans le navigateur » ouvre une page qui doit s'afficher sans avertissement." }),
            status,
            el("div", { className: "buttons" }, install, test, remove),
        ];
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
        section.append(...await extensionBlock());
        section.append(...await bridgeBlock());
        section.append(...await officeBlock());
        // Serveur MCP : la configuration à copier dans Claude Desktop, LM Studio…
        const mcp = await window.ariaApp.mcpConfig();
        const args = mcp.packaged ? mcp.args : [mcp.appDir, ...mcp.args];
        const config = JSON.stringify({ mcpServers: { "aria-plume": { command: mcp.command, args } } }, null, 2);
        const configBox = el("textarea", { className: "mcp-config", readOnly: true, rows: 7, spellcheck: false, value: config });
        configBox.setAttribute("aria-label", "Configuration MCP");
        const copy = el("button", { type: "button", textContent: "Copier la configuration" });
        copy.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(config);
                copy.textContent = "Copiée ✓";
            } catch {
                configBox.select();
                copy.textContent = "Sélectionnée : Ctrl+C";
            }
            setTimeout(() => {
                copy.textContent = "Copier la configuration";
            }, 1500);
        });
        section.append(
            el("h3", { textContent: "Serveur MCP (pour les IA)" }),
            el("p", { className: "hint", textContent: "Aria Plume peut prêter ses outils (corriger, traduire, conjuguer, synonymes) à une IA qui parle MCP : Claude Desktop, LM Studio… Ajoute cette configuration dans la sienne (Claude Desktop : fichier claude_desktop_config.json, accessible depuis ses réglages développeur ; LM Studio : mcp.json), puis redémarre-la. Les corrections tournent sur ton PC ; c'est l'IA que tu utilises qui décide où va le reste de la conversation." }),
            ...(mcp.portable ? [el("p", { className: "status error", textContent: "Tu utilises l'exe portable, qui se décompresse ailleurs à chaque lancement : pour le MCP, télécharge plutôt la version zip et indique le chemin de son « Aria Plume.exe »." })] : []),
            configBox,
            el("div", { className: "buttons" }, copy),
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
