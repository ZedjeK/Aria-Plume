// Aria Plume (application) — habillage de la fenêtre principale : menu latéral à gauche, zone
// principale avec le fond animé derrière le contenu. Chargé après les scripts du correcteur
// (popup.js) : il déplace ses éléments sans toucher à leurs écouteurs, et pilote ses onglets
// existants (Correction, Traduction, Conjugaison) depuis le menu.

(async function () {
    "use strict";
    const body = document.body;
    if (!body.classList.contains("app") || body.querySelector(".menu")) {
        return;
    }

    const SECTIONS = [
        { id: "fix", onglet: "tab-fix", titre: "Correction", texte: "Écris ou colle ton texte : les fautes se soulignent, clic droit pour corriger.", icone: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13 7l4 4"/>' },
        { id: "quick", onglet: "tab-quick", titre: "Traduction", texte: "Français et anglais, dans les deux sens, avec ton glossaire.", icone: '<path d="M4 5h9M8.5 3v2M6 5c1 4 3 6.5 6 8M12 5c-1 4-3 6.5-7 8.5"/><path d="M13 20l4-9 4 9M14.5 17h5"/>' },
        { id: "conj", onglet: "tab-conj", titre: "Conjugaison", texte: "Un verbe, tous ses temps.", icone: '<path d="M5 6h14M5 12h14M5 18h9"/>' },
    ];
    const svg = (dessin) => `<svg viewBox="0 0 24 24" aria-hidden="true">${dessin}</svg>`;

    // --- Menu latéral ---
    const menu = document.createElement("nav");
    menu.className = "menu";
    menu.setAttribute("aria-label", "Sections");
    menu.innerHTML = `
        <div class="marque"><img src="/icons/icon-128.png" width="38" height="38" alt=""><div><b>Aria Plume</b><small>correcteur local</small></div></div>
        <div class="groupe">Outils</div>`;
    // Les trois onglets d'origine (avec leurs écouteurs) deviennent les boutons du menu : popup.js
    // continue de les piloter, les tests les cliquent comme avant.
    const liste = document.createElement("div");
    liste.setAttribute("role", "tablist");
    liste.setAttribute("aria-label", "Outils");
    liste.className = "outils";
    menu.append(liste);
    for (const section of SECTIONS) {
        const bouton = document.getElementById(section.onglet);
        if (bouton) {
            bouton.innerHTML = `${svg(section.icone)}<span>${section.titre}</span>`;
            liste.append(bouton);
        }
    }
    const groupeApp = document.createElement("div");
    groupeApp.className = "groupe";
    groupeApp.textContent = "Application";
    const reglages = document.createElement("button");
    reglages.type = "button";
    reglages.innerHTML = `${svg('<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>')}<span>Réglages</span>`;
    reglages.dataset.section = "options";
    reglages.addEventListener("click", () => window.ariaApp.settingsView(true));
    const pied = document.createElement("div");
    pied.className = "pied";
    pied.innerHTML = "<i></i><span>100 % local</span>";
    menu.append(groupeApp, reglages, pied);

    // --- Zone principale : le fond, puis la page (tout ce que popup.html contenait) ---
    const principal = document.createElement("main");
    principal.className = "principal";
    const toile = document.createElement("canvas");
    toile.id = "fond";
    toile.setAttribute("aria-hidden", "true");
    const page = document.createElement("div");
    page.className = "page";
    const entete = document.createElement("div");
    entete.className = "entete";
    entete.innerHTML = "<h1></h1><p></p>";
    page.append(entete);
    for (const noeud of [...body.childNodes]) {
        if (noeud.nodeType === Node.ELEMENT_NODE && noeud.tagName === "SCRIPT") {
            continue;
        }
        page.append(noeud);
    }
    principal.append(toile, page);
    body.prepend(menu, principal);

    // --- Section affichée : suit l'onglet de popup.js, quel que soit ce qui l'a changé ---
    function suivre() {
        const actif = SECTIONS.find((s) => document.getElementById(s.onglet)?.getAttribute("aria-selected") === "true") ?? SECTIONS[0];
        entete.querySelector("h1").textContent = actif.titre;
        entete.querySelector("p").textContent = actif.texte;
    }
    // Réglages : affichés par la fenêtre dans la zone principale. Le bouton du menu suit, et un clic
    // sur un onglet d'outil les referme.
    window.ariaApp.onSettingsView((visible) => {
        body.classList.toggle("vue-reglages", visible);
        reglages.setAttribute("aria-selected", String(visible));
    });
    for (const section of SECTIONS) {
        document.getElementById(section.onglet)?.addEventListener("click", () => {
            if (body.classList.contains("vue-reglages")) {
                window.ariaApp.settingsView(false);
            }
        });
    }
    const observateur = new MutationObserver(suivre);
    for (const section of SECTIONS) {
        const onglet = document.getElementById(section.onglet);
        if (onglet) {
            observateur.observe(onglet, { attributes: true, attributeFilter: ["aria-selected"] });
        }
    }
    suivre();

    // --- Fond animé et ses réglages ---
    const CLES = { "fond.actif": true, "fond.vitesse": "normale", "fond.minimum": 3, "fond.maximum": 8 };
    if (window.AriaFond) {
        const fond = window.AriaFond(toile, await chrome.storage.local.get(CLES));
        chrome.storage.onChanged.addListener((changes) => {
            const valeurs = {};
            for (const cle of Object.keys(CLES)) {
                if (changes[cle]) {
                    valeurs[cle] = changes[cle].newValue;
                }
            }
            if (Object.keys(valeurs).length) {
                fond.regler(valeurs);
            }
        });
    }
})();
