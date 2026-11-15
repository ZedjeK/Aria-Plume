// Icône de notification et son menu (icone.js) : priorité des pastilles, icône délavée ou pleine,
// image dessinée, modèle du menu en blocs titrés. Sans Electron.
//     node tests/icone.mjs
import { PASTILLES, dessinerIcone, etatIcone, infobulle, modeleMenu } from "../icone.js";

let echecs = 0;
const check = (label, ok, detail = "") => {
    console.log(`${ok ? "OK   " : "ÉCHEC"} ${label}${detail ? ` : ${detail}` : ""}`);
    echecs += ok ? 0 : 1;
};

// Priorité : orange > cyan > bleue ; rien d'actif : délavée, sans pastille.
const repos = etatIcone({ raccourci: "Alt+Maj+C" });
check("rien d'actif : délavée, sans pastille", repos.delavee && repos.pastille === null, repos.phrase);
check("repos : l'état dit le raccourci", repos.phrase.includes("Alt+Maj+C"));
check("information seule : pastille bleue, icône pleine", (e => e.pastille === "bleue" && !e.delavee)(etatIcone({ info: "version 1.0.0 disponible" })));
check("action en cours : pastille cyan", etatIcone({ agit: true }).pastille === "cyan" && etatIcone({ agit: "Capture…" }).phrase === "Capture…");
check("à regarder : pastille orange", etatIcone({ alerte: "raccourci pris" }).pastille === "orange");
check("orange passe devant cyan et bleue", etatIcone({ alerte: "x", agit: true, info: "y" }).pastille === "orange");
check("cyan passe devant bleue", etatIcone({ agit: true, info: "y" }).pastille === "cyan");
check("infobulle : une ligne", !infobulle(repos).includes("\n") && infobulle(repos).startsWith("Aria Plume — "));

// Image : un logo 32 × 32 (BGRA) plein, opaque, gris moyen.
const T = 32;
const logo = Buffer.alloc(T * T * 4);
for (let i = 0; i < logo.length; i += 4) {
    logo.set([100, 100, 100, 255], i);
}
const pixel = (octets, x, y) => [...octets.subarray((y * T + x) * 4, (y * T + x) * 4 + 4)];
const delave = dessinerIcone(logo, T, repos);
check("délavée : opacité et couleur réduites", pixel(delave, 5, 5)[3] < 120 && pixel(delave, 5, 5)[0] < 60, JSON.stringify(pixel(delave, 5, 5)));
check("l'entrée n'est pas modifiée", pixel(logo, 5, 5)[3] === 255);
for (const [nom, [r, v, b]] of Object.entries(PASTILLES)) {
    const etat = { pastille: nom, delavee: false };
    const image = dessinerIcone(logo, T, etat);
    const rayon = Math.max(3, Math.round(T * 0.2));
    const centre = pixel(image, T - rayon - 1, T - rayon - 1);
    check(`pastille ${nom} : disque de la bonne couleur en bas à droite`, centre[0] === b && centre[1] === v && centre[2] === r && centre[3] === 255, JSON.stringify(centre));
    check(`pastille ${nom} : le reste du logo est intact`, JSON.stringify(pixel(image, 2, 2)) === JSON.stringify([100, 100, 100, 255]));
}

// Menu.
const appelees = [];
const actions = Object.fromEntries(["ouvrir", "agir", "reglages", "dossier", "miseAJour", "verifierMiseAJour", "quitter"].map((nom) => [nom, () => appelees.push(nom)]));
actions.aller = (section) => appelees.push(`aller:${section}`);
actions.demarrage = (coche) => appelees.push(`demarrage:${coche}`);
const modele = modeleMenu({ etat: repos, raccourci: "Alt+Maj+C", demarrage: true, miseAJour: null, windows: true }, actions);
const libelles = modele.map((e) => e.label ?? "—");
check("menu : Ouvrir en premier, puis l'état", libelles[0] === "Ouvrir Aria Plume" && libelles[1].startsWith("État : "));
check("menu : blocs titrés (titres en majuscules, non cliquables)", ["AGIR SANS OUVRIR", "ALLER À"].every((t) => modele.some((e) => e.label === t && e.enabled === false)));
check("menu : Démarrer avec Windows et Quitter en bas", libelles.at(-2) === "Démarrer avec Windows" && libelles.at(-1) === "Quitter Aria Plume");
check("menu : la case reflète le réglage", modele.at(-2).checked === true && modele.at(-2).type === "checkbox");
check("menu : « Rechercher une mise à jour » sans mise à jour", libelles.includes("Rechercher une mise à jour") && !libelles.some((l) => l.startsWith("Voir la mise à jour")));
const avec = modeleMenu({ etat: etatIcone({ info: "x" }), raccourci: "Alt+Maj+C", demarrage: false, miseAJour: "1.2.3", windows: false }, actions).map((e) => e.label ?? "—");
check("menu : « Voir la mise à jour » seulement si une version est disponible", avec.includes("Voir la mise à jour (1.2.3)…") && !avec.includes("Rechercher une mise à jour"));
check("menu : pas de case Windows hors de Windows", !avec.includes("Démarrer avec Windows"));
modele.find((e) => e.label === "Conjugaison").click();
modele.find((e) => e.label === "Correction").click();
modele.at(-2).click({ checked: false });
check("menu : les actions sont branchées", appelees.join(",") === "aller:conj,aller:fix,demarrage:false", appelees.join(","));

console.log(echecs ? `${echecs} échec(s)` : "tout est bon");
process.exit(echecs ? 1 : 0);
