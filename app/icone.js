// Aria Plume (application) — icône de notification et son menu, selon le modèle des applis Aria.
//
// L'icône est le logo de l'appli : délavée quand rien n'est actif, pleine quand quelque chose l'est.
// Une seule pastille à la fois, par ordre de priorité :
//     orange  à regarder (raccourci indisponible, pont en erreur)
//     cyan    l'appli agit en ce moment (capture de la sélection, vérification des mises à jour)
//     bleue   information (une mise à jour est disponible)
// L'infobulle dit la même chose en une ligne. Le menu est en blocs titrés : Ouvrir, État, puis
// « Agir sans ouvrir » et « Aller à », et en bas « Démarrer avec Windows » et « Quitter ».
//
// Module sans Electron : il calcule l'état, l'image (octets BGRA) et le modèle du menu, et se teste
// seul (tests/icone.mjs). app-main.js n'a plus qu'à les poser.

export const PASTILLES = { orange: [0xff, 0x8a, 0x1f], cyan: [0x7d, 0xf9, 0xff], bleue: [0x5c, 0x8b, 0xff] };
const DELAVEE = 0.4;
// Un cercle posé en bas à droite, cerné de la couleur du fond de la barre des tâches (#0b1424).
const BORD = [0x0b, 0x14, 0x24];

// { agit, alerte, info } → { pastille, delavee, phrase }
export function etatIcone({ agit = false, alerte = null, info = null, raccourci = "" } = {}) {
    if (alerte) {
        return { pastille: "orange", delavee: false, phrase: alerte };
    }
    if (agit) {
        return { pastille: "cyan", delavee: false, phrase: typeof agit === "string" ? agit : "Aria Plume travaille…" };
    }
    if (info) {
        return { pastille: "bleue", delavee: false, phrase: info };
    }
    return { pastille: null, delavee: true, phrase: raccourci ? `Prête · ${raccourci} sur un texte sélectionné` : "Prête" };
}

export const infobulle = (etat) => `Aria Plume — ${etat.phrase}`;

// Octets BGRA (4 par pixel, la ligne en haut) d'un logo de `taille` pixels de côté → icône de l'état :
// logo délavé (opacité réduite) ou plein, avec sa pastille.
export function dessinerIcone(bgra, taille, etat) {
    const sortie = Buffer.from(bgra);
    if (etat.delavee) {
        for (let i = 3; i < sortie.length; i += 4) {
            sortie[i] = Math.round(sortie[i] * DELAVEE);
        }
        // Les octets sont prémultipliés par l'alpha : les couleurs suivent.
        for (let i = 0; i < sortie.length; i += 4) {
            sortie[i] = Math.round(sortie[i] * DELAVEE);
            sortie[i + 1] = Math.round(sortie[i + 1] * DELAVEE);
            sortie[i + 2] = Math.round(sortie[i + 2] * DELAVEE);
        }
    }
    if (etat.pastille) {
        const [r, v, b] = PASTILLES[etat.pastille];
        const rayon = Math.max(3, Math.round(taille * 0.2));
        const cx = taille - rayon - 1;
        const cy = taille - rayon - 1;
        for (let y = 0; y < taille; y++) {
            for (let x = 0; x < taille; x++) {
                const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
                if (d > rayon + 1.6) {
                    continue;
                }
                const [pr, pv, pb] = d <= rayon ? [r, v, b] : BORD;
                const i = (y * taille + x) * 4;
                sortie[i] = pb;
                sortie[i + 1] = pv;
                sortie[i + 2] = pr;
                sortie[i + 3] = 255;
            }
        }
    }
    return sortie;
}

// Modèle du menu (Menu.buildFromTemplate). `actions` : ouvrir, agir, aller(section), dossier,
// miseAJour, verifierMiseAJour, demarrage(case), quitter. `contexte` : etat, raccourci, demarrage,
// miseAJour (version ou null), windows.
export function modeleMenu({ etat, raccourci, demarrage, miseAJour, windows }, actions) {
    const titre = (label) => ({ label: label.toUpperCase(), enabled: false });
    const modele = [
        { label: "Ouvrir Aria Plume", click: actions.ouvrir },
        { label: `État : ${etat.phrase}`, enabled: false },
        { type: "separator" },
        titre("Agir sans ouvrir"),
        { label: `Corriger la sélection (${raccourci})`, click: actions.agir },
        { type: "separator" },
        titre("Aller à"),
        { label: "Correction", click: () => actions.aller("fix") },
        { label: "Traduction", click: () => actions.aller("quick") },
        { label: "Conjugaison", click: () => actions.aller("conj") },
        { label: "Réglages…", click: actions.reglages },
        { label: "Dossier de données", click: actions.dossier },
        { type: "separator" },
        miseAJour
            ? { label: `Voir la mise à jour (${miseAJour})…`, click: actions.miseAJour }
            : { label: "Rechercher une mise à jour", click: actions.verifierMiseAJour },
        { type: "separator" },
    ];
    if (windows) {
        modele.push({ label: "Démarrer avec Windows", type: "checkbox", checked: !!demarrage, click: (item) => actions.demarrage(item.checked) });
    }
    modele.push({ label: "Quitter Aria Plume", click: actions.quitter });
    return modele;
}
