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

    // Complément Word : un bouton, et la liste de ce qui est vérifié pour de vrai (certificat approuvé
    // par Windows, serveur qui répond en HTTPS, inscription relue dans le registre).
    // Word et Outlook partagent le certificat et le serveur (et « Désinstaller » retire les deux) :
    // ce que fait un bloc est montré dans l'autre.
    const officeChanged = (from, state) => document.dispatchEvent(new CustomEvent("aria-office", { detail: { from, state } }));
    const onOfficeChange = (self, show) => document.addEventListener("aria-office", ({ detail }) => {
        if (detail.from !== self) {
            show(detail.state);
        }
    });
    const seenDate = (iso) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

    async function officeBlock() {
        const checks = el("ul", { className: "checks", id: "officeChecks" });
        const status = el("p", { className: "status", id: "officeStatus" });
        status.setAttribute("aria-live", "polite");
        const install = el("button", { type: "button", id: "officeInstall" });
        const remove = el("button", { type: "button", textContent: "Désinstaller", id: "officeUninstall" });
        const manual = el("div", { className: "manual", id: "officeManual", hidden: true });

        const line = (ok, text, help = "") => el("li", { className: ok === true ? "ok" : ok === false ? "ko" : "na" },
            el("span", { className: "mark", textContent: ok === true ? "✓" : ok === false ? "✗" : "–" }),
            el("span", {}, text, help ? el("small", { textContent: ` — ${help}` }) : ""));

        function showState(state, message = "") {
            install.textContent = state.installed ? "Réparer" : "Installer dans Word";
            remove.hidden = !state.installed;
            checks.hidden = !state.installed;
            checks.replaceChildren(
                line(state.trusted, "Certificat local approuvé par Windows", state.trusted === false ? "clique sur « Réparer » et réponds « Oui » à l'avertissement de Windows" : state.trusted === null ? "rien à approuver hors Windows" : ""),
                line(state.server, `Serveur prêt sur ${state.url}`, state.server ? "" : `ne répond pas (${state.serverError ?? "raison inconnue"}) : relance l'application`),
                line(state.word, "Inscrit dans Word", state.word === true ? (state.seen?.Word ? `panneau ouvert dans Word le ${seenDate(state.seen.Word)}` : "redémarre Word : bouton « Aria Plume » dans l'onglet Accueil") : state.word === null ? "rien à inscrire hors Windows" : "voir la commande ci-dessous"),
            );
            // Inscription impossible : la commande à lancer soi-même dans PowerShell.
            manual.hidden = !(state.installed && state.word === false && state.manualCommand);
            if (!manual.hidden) {
                const code = el("pre", { className: "command", textContent: state.manualCommand });
                const copy = el("button", { type: "button", textContent: "Copier la commande" });
                copy.addEventListener("click", async () => {
                    try {
                        await navigator.clipboard.writeText(state.manualCommand);
                        copy.textContent = "Copiée ✓";
                    } catch {
                        copy.textContent = "Sélectionne-la : Ctrl+C";
                    }
                });
                manual.replaceChildren(
                    el("p", { className: "hint", textContent: "Aria Plume n'a pas pu s'inscrire dans Word (un antivirus peut bloquer l'écriture dans le registre). Colle cette commande dans PowerShell, puis redémarre Word et clique sur « Réparer » pour vérifier :" }),
                    code,
                    el("div", { className: "buttons" }, copy));
            }
            status.textContent = state.installed ? message : "Pas encore installé.";
            status.classList.toggle("error", /impossible|Non/.test(message));
        }

        async function act(button, action) {
            install.disabled = true;
            remove.disabled = true;
            status.classList.remove("error");
            status.textContent = "Vérification…";
            try {
                const state = await action();
                const notes = [
                    state.refused ? "Tu as répondu « Non » à Windows : le certificat n'est pas approuvé." : "",
                    state.wordError ? `Inscription dans Word impossible : ${state.wordError}` : "",
                ].filter(Boolean).join(" ");
                showState(state, notes);
                officeChanged("word", state);
            } catch (error) {
                status.textContent = String(error?.message ?? error).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
                status.classList.add("error");
            } finally {
                install.disabled = false;
                remove.disabled = false;
                button.focus();
            }
        }
        onOfficeChange("word", (state) => showState(state, status.textContent));
        install.addEventListener("click", () => act(install, () => window.ariaApp.installOffice()));
        remove.addEventListener("click", () => act(remove, () => window.ariaApp.uninstallOffice()));
        showState(await window.ariaApp.officeState());
        return [
            el("h3", { textContent: "Complément Word" }),
            el("p", { className: "hint", textContent: "Un bouton « Aria Plume » dans l'onglet Accueil de Word : corriger le document, traduire, synonymes, conjugaison. Windows te demandera une fois d'approuver un certificat valable uniquement pour ce PC (localhost) : réponds « Oui ». L'application doit tourner pendant que tu utilises Word." }),
            el("div", { className: "buttons" }, install, remove),
            checks,
            status,
            manual,
        ];
    }

    // Complément Outlook : pas de registre, l'installation se fait sur la page de Microsoft (une fois,
    // elle suit le compte). L'application prépare le fichier, ouvre la page et le dossier.
    async function outlookBlock() {
        const checks = el("ul", { className: "checks", id: "outlookChecks" });
        const status = el("p", { className: "status", id: "outlookStatus" });
        status.setAttribute("aria-live", "polite");
        const install = el("button", { type: "button", id: "outlookInstall" });
        const copyPath = el("button", { type: "button", textContent: "Copier le chemin du fichier", id: "outlookCopy" });
        const steps = el("ol", { className: "steps", id: "outlookSteps" });

        const line = (ok, text, help = "") => el("li", { className: ok === true ? "ok" : ok === false ? "ko" : "na" },
            el("span", { className: "mark", textContent: ok === true ? "✓" : ok === false ? "✗" : "–" }),
            el("span", {}, text, help ? el("small", { textContent: ` — ${help}` }) : ""));

        function showState(state, message = "") {
            const ready = Boolean(state.outlookManifest);
            install.textContent = ready ? "Rouvrir la page d'installation" : "Installer dans Outlook";
            copyPath.hidden = !ready;
            steps.hidden = !ready;
            checks.hidden = !ready;
            steps.replaceChildren(
                el("li", { textContent: "Sur la page « Compléments » qui vient de s'ouvrir dans ton navigateur (connecte-toi à ton compte Outlook si besoin) : « Mes compléments »." }),
                el("li", { textContent: "Tout en bas : « Ajouter un complément personnalisé », puis « Ajouter à partir du fichier »." }),
                el("li", {}, "Choisis ", el("code", { textContent: state.outlookManifest ?? "manifeste-outlook.xml" }), " (le dossier est ouvert), puis « Installer »."),
                el("li", { textContent: "Ouvre un mail : bouton « Aria Plume » dans le ruban (ou dans le menu « … » sur le web). Outlook classique peut mettre jusqu'à 24 h à l'afficher." }),
            );
            checks.replaceChildren(
                line(state.trusted, "Certificat local approuvé par Windows", state.trusted === false ? "clique sur le bouton ci-dessus et réponds « Oui » à l'avertissement de Windows" : state.trusted === null ? "rien à approuver hors Windows" : ""),
                line(state.server, `Serveur prêt sur ${state.url}`, state.server ? "" : `ne répond pas (${state.serverError ?? "raison inconnue"}) : relance l'application`),
                line(state.seen?.Outlook ? true : null, state.seen?.Outlook ? `Panneau ouvert dans Outlook le ${seenDate(state.seen.Outlook)}` : "Pas encore ouvert dans Outlook"),
            );
            status.textContent = ready ? message : "Pas encore installé.";
            status.classList.toggle("error", /impossible|Non/.test(message));
        }

        install.addEventListener("click", async () => {
            install.disabled = true;
            status.classList.remove("error");
            status.textContent = "Préparation…";
            try {
                const state = await window.ariaApp.installOutlook();
                showState(state, state.refused ? "Tu as répondu « Non » à Windows : le certificat n'est pas approuvé, Outlook ne pourra pas afficher le panneau." : "");
                officeChanged("outlook", state);
            } catch (error) {
                status.textContent = String(error?.message ?? error).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
                status.classList.add("error");
            } finally {
                install.disabled = false;
                install.focus();
            }
        });
        onOfficeChange("outlook", (state) => showState(state, ""));
        copyPath.addEventListener("click", async () => {
            await window.ariaApp.copyOutlookPath();
            copyPath.textContent = "Chemin copié ✓";
            setTimeout(() => {
                copyPath.textContent = "Copier le chemin du fichier";
            }, 2000);
        });
        showState(await window.ariaApp.officeState());
        return [
            el("h3", { textContent: "Complément Outlook" }),
            el("p", { className: "hint", textContent: "Un bouton « Aria Plume » quand tu lis un mail, dans Outlook classique, le nouvel Outlook et Outlook sur le web : traduire le message (sans l'historique cité), synonymes, conjugaison. Pour un compte Outlook.com ou Microsoft 365. L'installation se fait une fois, sur la page de Microsoft, et suit ton compte sur tous tes appareils ; l'application doit tourner sur ce PC pour que le panneau réponde. Pour le retirer : même page, « Mes compléments », Aria Plume, « Supprimer »." }),
            el("div", { className: "buttons" }, install, copyPath),
            steps,
            checks,
            status,
        ];
    }

    // Mises à jour : vérification au démarrage (une fois par jour) ou à la demande.
    async function updateBlock(settings) {
        const status = el("p", { className: "status", id: "updateStatus" });
        status.setAttribute("aria-live", "polite");
        const notes = el("ul", { className: "update-notes", id: "updateNotes", hidden: true });
        const checkNow = el("button", { type: "button", textContent: "Vérifier maintenant", id: "updateCheck" });
        const open = el("button", { type: "button", textContent: "Ouvrir la page de téléchargement", id: "updateOpen", hidden: true });
        const auto = el("input", { type: "checkbox", className: "toggle", id: "checkUpdates", checked: settings.checkUpdates });
        auto.addEventListener("change", () => chrome.storage.local.set({ checkUpdates: auto.checked }));
        const date = (iso) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
        const FILES = { portable: "l'exe portable", zip: "le zip Windows" };

        function show({ last, kind, version }) {
            open.hidden = last?.status !== "available";
            notes.hidden = !last?.notes?.length;
            notes.replaceChildren(...(last?.notes ?? []).map((line) => el("li", { textContent: line })));
            status.classList.toggle("error", last?.status === "error");
            status.classList.toggle("available", last?.status === "available");
            if (!last) {
                status.textContent = `Version installée : ${version}.`;
            } else if (last.status === "available") {
                const file = last.asset ? ` Fichier à prendre : ${last.asset.name} (${FILES[kind] ?? "ta version"}).` : "";
                status.textContent = `Version ${last.latest} disponible${last.publishedAt ? `, publiée le ${date(last.publishedAt)}` : ""} (tu as la ${version}).${file}`;
            } else if (last.status === "up-to-date") {
                status.textContent = last.error ? `${last.error} Version installée : ${version}.` : `À jour ✓ — version ${version}, la plus récente.`;
            } else {
                status.textContent = `Vérification impossible : ${last.error}`;
            }
        }
        checkNow.addEventListener("click", async () => {
            checkNow.disabled = true;
            status.classList.remove("error", "available");
            status.textContent = "Vérification…";
            try {
                const last = await window.ariaApp.checkUpdate();
                show({ ...(await window.ariaApp.updateState()), last });
            } finally {
                checkNow.disabled = false;
                checkNow.focus();
            }
        });
        open.addEventListener("click", () => window.ariaApp.openUpdate());
        window.ariaApp.onUpdateResult(async () => show(await window.ariaApp.updateState()));
        show(await window.ariaApp.updateState());
        return [
            el("h3", { textContent: "Mises à jour" }),
            row("Vérifier au démarrage", "Une fois par jour au plus, Aria Plume demande à GitHub la dernière version publiée et te prévient près de l'horloge si elle est plus récente. C'est le seul accès à internet de l'application : aucun texte ni réglage n'est envoyé. Rien n'est téléchargé tout seul.", auto),
            status,
            notes,
            el("div", { className: "buttons" }, checkNow, open),
        ];
    }

    async function build() {
        const settings = await chrome.storage.local.get({ hotkey: "Alt+Shift+C", startWithWindows: false, checkUpdates: true });
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
        section.append(...await outlookBlock());
        section.append(...await updateBlock(settings));
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
