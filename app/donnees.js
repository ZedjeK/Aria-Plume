// Aria Plume (application) — rangement du dossier de données, selon le modèle des applis Aria.
//
//   C:\Users\<toi>\.Aria-Plume\
//   ├── reglages.json      les réglages
//   ├── journal.json       les 500 dernières opérations
//   ├── sauvegardes\       copies faites avant de modifier ou de déplacer un fichier
//   ├── cache\             données internes d'Electron (caches, verrou d'instance unique)
//   ├── extension\         copie de l'extension que lit le navigateur
//   ├── pont\              relais et jeton du pont avec l'extension
//   └── office\            certificat local et manifeste du complément Word
//
// Module sans Electron : il ne touche que des fichiers, et se teste seul (tests/donnees.mjs).

import fs from "node:fs";
import path from "node:path";

export const FICHIER_REGLAGES = "reglages.json";
// Nom des réglages jusqu'à la 0.39.0.
export const ANCIEN_FICHIER_REGLAGES = "aria-plume-reglages.json";
export const DOSSIER_CACHE = "cache";
const ANCIEN_DOSSIER_CACHE = "electron";
const JOURNAL = "journal.json";
const JOURNAL_MAX = 500;
// Sauvegardes des réglages : une par jour au plus, les plus récentes gardées.
const SAUVEGARDES_MAX = 10;

const horodatage = (date = new Date()) => date.toISOString().replace(/[:.]/g, "-").replace(/Z$/, "");

// Copie un fichier dans sauvegardes\, sous un nom daté. Renvoie le chemin de la copie.
export function sauvegarder(dossier, fichier, date = new Date()) {
    const source = path.join(dossier, fichier);
    const cible = path.join(dossier, "sauvegardes");
    fs.mkdirSync(cible, { recursive: true });
    const { name, ext } = path.parse(fichier);
    const copie = path.join(cible, `${name}-${horodatage(date)}${ext}`);
    fs.copyFileSync(source, copie);
    return copie;
}

// Ajoute une opération au journal (les 500 dernières). Jamais de valeur de réglage ni de texte :
// le genre d'opération et ce qu'elle a touché.
export function journaliser(dossier, operation, detail = "", date = new Date()) {
    const fichier = path.join(dossier, JOURNAL);
    let entrees = [];
    try {
        entrees = JSON.parse(fs.readFileSync(fichier, "utf8"));
        if (!Array.isArray(entrees)) {
            entrees = [];
        }
    } catch {
        // Pas encore de journal, ou illisible : on repart d'un journal vide.
    }
    entrees.push({ date: date.toISOString(), operation: String(operation), detail: String(detail).slice(0, 300) });
    entrees = entrees.slice(-JOURNAL_MAX);
    fs.mkdirSync(dossier, { recursive: true });
    const temp = `${fichier}.tmp`;
    fs.writeFileSync(temp, `${JSON.stringify(entrees, null, 1)}\n`);
    fs.renameSync(temp, fichier);
}

// Sauvegarde des réglages avant la première modification du jour ; les plus anciennes sont retirées
// au-delà de dix. Renvoie la copie faite, ou null.
export function sauvegarderReglagesDuJour(dossier, date = new Date()) {
    const fichier = path.join(dossier, FICHIER_REGLAGES);
    if (!fs.existsSync(fichier)) {
        return null;
    }
    const cible = path.join(dossier, "sauvegardes");
    const jour = date.toISOString().slice(0, 10);
    const existantes = fs.existsSync(cible) ? fs.readdirSync(cible).filter((nom) => /^reglages-.*\.json$/.test(nom)).sort() : [];
    if (existantes.some((nom) => nom.startsWith(`reglages-${jour}`))) {
        return null;
    }
    const copie = sauvegarder(dossier, FICHIER_REGLAGES, date);
    for (const ancienne of [...existantes, path.basename(copie)].sort().slice(0, -SAUVEGARDES_MAX)) {
        fs.rmSync(path.join(cible, ancienne), { force: true });
    }
    return copie;
}

// Passe un dossier de données d'avant la 0.40 aux noms du modèle. Rien n'est effacé : les réglages
// sont d'abord copiés dans sauvegardes\, puis renommés. Le dossier interne d'Electron est renommé
// s'il n'est pas utilisé (une autre instance ouverte le garde verrouillé : il reste alors en place,
// et dossierCache() le rend). Renvoie la liste de ce qui a été fait.
export function migrerDossier(dossier) {
    const fait = [];
    const ancien = path.join(dossier, ANCIEN_FICHIER_REGLAGES);
    const nouveau = path.join(dossier, FICHIER_REGLAGES);
    if (fs.existsSync(ancien) && !fs.existsSync(nouveau)) {
        const copie = sauvegarder(dossier, ANCIEN_FICHIER_REGLAGES);
        fs.renameSync(ancien, nouveau);
        fait.push(`réglages renommés en ${FICHIER_REGLAGES} (copie : ${path.relative(dossier, copie)})`);
    }
    const ancienCache = path.join(dossier, ANCIEN_DOSSIER_CACHE);
    const cache = path.join(dossier, DOSSIER_CACHE);
    if (fs.existsSync(ancienCache) && !fs.existsSync(cache)) {
        try {
            fs.renameSync(ancienCache, cache);
            fait.push(`${ANCIEN_DOSSIER_CACHE}\\ renommé en ${DOSSIER_CACHE}\\`);
        } catch (error) {
            fait.push(`${ANCIEN_DOSSIER_CACHE}\\ gardé (${error.code ?? error.message})`);
        }
    }
    return fait;
}

// Dossier interne d'Electron : cache\, ou l'ancien electron\ s'il n'a pas pu être renommé.
export function dossierCache(dossier) {
    const cache = path.join(dossier, DOSSIER_CACHE);
    const ancienCache = path.join(dossier, ANCIEN_DOSSIER_CACHE);
    return !fs.existsSync(cache) && fs.existsSync(ancienCache) ? ancienCache : cache;
}
