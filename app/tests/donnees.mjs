// Rangement du dossier de données (donnees.js) : migration des noms d'avant la 0.40, sauvegardes,
// journal. Sans Electron.
//     node tests/donnees.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { migrerDossier, dossierCache, journaliser, sauvegarderReglagesDuJour, FICHIER_REGLAGES, ANCIEN_FICHIER_REGLAGES } from "../donnees.js";

let echecs = 0;
const check = (label, ok, detail = "") => {
    console.log(`${ok ? "OK   " : "ÉCHEC"} ${label}${detail ? ` : ${detail}` : ""}`);
    echecs += ok ? 0 : 1;
};
const dossier = () => fs.mkdtempSync(path.join(os.tmpdir(), "aria-donnees-"));

// Migration d'un dossier de la 0.39.
const d = dossier();
fs.writeFileSync(path.join(d, ANCIEN_FICHIER_REGLAGES), JSON.stringify({ dictionary: ["Warhammer"] }));
fs.mkdirSync(path.join(d, "electron"));
fs.writeFileSync(path.join(d, "electron", "Local State"), "{}");
const fait = migrerDossier(d);
check("réglages renommés", fs.existsSync(path.join(d, FICHIER_REGLAGES)) && !fs.existsSync(path.join(d, ANCIEN_FICHIER_REGLAGES)), fait.join(" ; "));
check("contenu des réglages gardé", JSON.parse(fs.readFileSync(path.join(d, FICHIER_REGLAGES), "utf8")).dictionary[0] === "Warhammer");
const copies = fs.readdirSync(path.join(d, "sauvegardes"));
check("copie des anciens réglages dans sauvegardes\\", copies.length === 1 && copies[0].startsWith("aria-plume-reglages-"), copies.join(", "));
check("electron\\ renommé en cache\\", fs.existsSync(path.join(d, "cache", "Local State")) && !fs.existsSync(path.join(d, "electron")));
check("dossierCache : cache\\", dossierCache(d) === path.join(d, "cache"));
check("deuxième passage : rien à faire", migrerDossier(d).length === 0);

// Nouveaux réglages déjà là : l'ancien fichier n'est pas touché.
const e = dossier();
fs.writeFileSync(path.join(e, ANCIEN_FICHIER_REGLAGES), "{}");
fs.writeFileSync(path.join(e, FICHIER_REGLAGES), JSON.stringify({ dictionary: ["neuf"] }));
migrerDossier(e);
check("réglages récents gardés, ancien fichier laissé", JSON.parse(fs.readFileSync(path.join(e, FICHIER_REGLAGES), "utf8")).dictionary[0] === "neuf" && fs.existsSync(path.join(e, ANCIEN_FICHIER_REGLAGES)));

// Ancien dossier interne seul (renommage impossible simulé : cache\ absent, electron\ présent).
const f = dossier();
fs.mkdirSync(path.join(f, "electron"));
check("dossierCache : electron\\ tant qu'il n'est pas renommé", dossierCache(f) === path.join(f, "electron"));

// Sauvegarde des réglages : une par jour, dix au plus.
const g = dossier();
fs.writeFileSync(path.join(g, FICHIER_REGLAGES), "{}");
const jour = new Date("2026-11-15T08:00:00Z");
check("première modification du jour : copie", sauvegarderReglagesDuJour(g, jour) !== null);
check("deuxième modification du même jour : pas de copie", sauvegarderReglagesDuJour(g, new Date("2026-11-15T20:00:00Z")) === null);
for (let i = 1; i <= 12; i++) {
    sauvegarderReglagesDuJour(g, new Date(Date.UTC(2026, 11, i, 9)));
}
check("dix sauvegardes au plus", fs.readdirSync(path.join(g, "sauvegardes")).length === 10, String(fs.readdirSync(path.join(g, "sauvegardes")).length));

// Journal : 500 entrées au plus, les plus récentes.
const h = dossier();
for (let i = 0; i < 520; i++) {
    journaliser(h, "essai", `n° ${i}`);
}
const journal = JSON.parse(fs.readFileSync(path.join(h, "journal.json"), "utf8"));
check("journal : 500 entrées", journal.length === 500, String(journal.length));
check("journal : les plus récentes gardées", journal[0].detail === "n° 20" && journal.at(-1).detail === "n° 519");

console.log(echecs ? `${echecs} échec(s)` : "tout est bon");
process.exit(echecs ? 1 : 0);
