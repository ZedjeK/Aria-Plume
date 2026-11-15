// Aria Plume (application) — mise à jour intégrée de l'application installée (programme\).
//
// Avec l'accord de l'utilisateur (bouton « Installer la mise à jour » des réglages) :
//   1. télécharge, depuis la release sur github.com en HTTPS, le zip Windows et son empreinte
//      (<zip>.sha256) ; GitHub renvoie le fichier depuis release-assets.githubusercontent.com,
//      seule redirection suivie ;
//   2. vérifie le SHA-256 du zip ; un zip qui ne correspond pas est supprimé, rien n'est installé ;
//   3. le décompresse dans .Aria-Plume\mises-a-jour\<version>\ (tar de Windows) ;
//   4. l'application se ferme et lance l'exe décompressé avec --mettre-a-jour : il attend la fin de
//      l'ancienne, s'installe dans programme\ (installation.js : la version précédente est gardée
//      dans sauvegardes\versions\), puis relance l'application depuis programme\.
// L'empreinte prouve que le zip est intact, pas d'où il vient : la provenance repose sur le compte
// de l'auteur et sur la release de GitHub (README, « Limites à connaître »).
//
// Module sans Electron : il ne touche que des fichiers et le réseau qu'on lui passe, et se teste
// seul (tests/miseajour.mjs).

import { execFile } from "node:child_process";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { REPOSITORY } from "./updates.js";
import { analyserSource } from "./installation.js";
import { journaliser } from "./donnees.js";

// Comme installation.js : le fs d'Electron montre les .asar comme des dossiers.
const fs = createRequire(import.meta.url)(process.versions.electron ? "original-fs" : "node:fs");

export const DOSSIER_MISES_A_JOUR = "mises-a-jour";
const TELECHARGEMENT = `https://github.com/${REPOSITORY}/releases/download/`;
const HOTES_REDIRECTION = ["release-assets.githubusercontent.com"];
const TAILLE_MAX = 1024 * 1024 * 1024;
const REDIRECTIONS_MAX = 3;
const DELAI_MS = 15 * 60 * 1000;

export const dossierMisesAJour = (dossierDonnees) => path.join(dossierDonnees, DOSSIER_MISES_A_JOUR);

// Adresse de départ : un fichier de cette release-là sur github.com. Banc automatique : un serveur
// local (http://127.0.0.1), jamais actif sans ARIA_TEST_HOOKS=1.
export function adresseAutorisee(url, version, { test = false } = {}) {
    if (typeof url !== "string") {
        return false;
    }
    if (test && /^http:\/\/127\.0\.0\.1:\d+\//.test(url)) {
        return true;
    }
    return url.startsWith(`${TELECHARGEMENT}v${version}/`) && !url.includes("..");
}

// Redirection : vers le stockage des fichiers de release de GitHub, en HTTPS, et rien d'autre.
export function redirectionAutorisee(url, { test = false } = {}) {
    try {
        const cible = new URL(url);
        if (test && cible.protocol === "http:" && cible.hostname === "127.0.0.1") {
            return true;
        }
        return cible.protocol === "https:" && HOTES_REDIRECTION.includes(cible.hostname);
    } catch {
        return false;
    }
}

// « 3f2a…  Aria-Plume-0.41.0-win-x64.zip » (format de sha256sum) → l'empreinte, si le nom
// correspond.
export function lireEmpreinte(texte, nom) {
    for (const ligne of String(texte ?? "").split(/\r?\n/)) {
        const morceaux = /^([0-9a-fA-F]{64})\s+\*?(.+?)\s*$/.exec(ligne.trim());
        if (morceaux && morceaux[2] === nom) {
            return morceaux[1].toLowerCase();
        }
    }
    return null;
}

// GET qui ne suit que les redirections autorisées. fetchImpl : fetch (net.fetch d'Electron).
async function obtenir(url, { fetchImpl, test, signal }) {
    let adresse = url;
    for (let saut = 0; saut <= REDIRECTIONS_MAX; saut++) {
        const reponse = await fetchImpl(adresse, { redirect: "manual", signal, headers: { "user-agent": "Aria-Plume" } });
        if ([301, 302, 303, 307, 308].includes(reponse.status)) {
            const suivante = new URL(reponse.headers.get("location") ?? "", adresse).href;
            if (!redirectionAutorisee(suivante, { test })) {
                throw new Error(`redirection refusée vers ${new URL(suivante).hostname}.`);
            }
            adresse = suivante;
            continue;
        }
        if (!reponse.ok) {
            throw new Error(`GitHub a répondu ${reponse.status}.`);
        }
        return reponse;
    }
    throw new Error("trop de redirections.");
}

// Télécharge dans un fichier en calculant le SHA-256 au passage. Renvoie l'empreinte.
async function telechargerFichier(url, cible, { fetchImpl, test, signal, onProgress, taille }) {
    const reponse = await obtenir(url, { fetchImpl, test, signal });
    const total = Number(reponse.headers.get("content-length")) || taille || 0;
    if (total > TAILLE_MAX) {
        throw new Error("fichier trop gros pour être la mise à jour attendue.");
    }
    const hachage = crypto.createHash("sha256");
    const sortie = fs.createWriteStream(cible);
    let recu = 0;
    try {
        for await (const morceau of reponse.body) {
            recu += morceau.length;
            if (recu > TAILLE_MAX) {
                throw new Error("fichier trop gros pour être la mise à jour attendue.");
            }
            hachage.update(morceau);
            if (!sortie.write(morceau)) {
                await new Promise((resolve) => sortie.once("drain", resolve));
            }
            onProgress?.(recu, total);
        }
    } finally {
        await new Promise((resolve) => sortie.end(resolve));
    }
    return hachage.digest("hex");
}

// Décompresse avec le tar de Windows (chemin complet : pas celui que trouverait le PATH).
function decompresser(zip, dossier, { tar = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe") } = {}) {
    return new Promise((resolve, reject) => {
        execFile(tar, ["-xf", zip, "-C", dossier], { windowsHide: true }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`décompression impossible (${String(stderr || error.message).trim()}).`));
            } else {
                resolve();
            }
        });
    });
}

// Le dossier de l'application dans ce qui a été décompressé : à la racine, ou dans un seul
// sous-dossier.
function trouverApplication(dossier, nomExe) {
    if (fs.existsSync(path.join(dossier, nomExe))) {
        return dossier;
    }
    const sous = fs.readdirSync(dossier, { withFileTypes: true }).filter((entree) => entree.isDirectory());
    if (sous.length === 1 && fs.existsSync(path.join(dossier, sous[0].name, nomExe))) {
        return path.join(dossier, sous[0].name);
    }
    return null;
}

// Prépare la mise à jour : téléchargement, vérification, décompression. Renvoie le dossier de la
// nouvelle application, prête à s'installer. Toute erreur laisse l'application en place.
export async function preparerMiseAJour({ version, zip, empreinte, dossierDonnees, nomExe, fetchImpl, test = false, onEtape, decompresseur = decompresser }) {
    if (!/^\d+\.\d+\.\d+$/.test(String(version))) {
        throw new Error("version inattendue.");
    }
    for (const fichier of [zip, empreinte]) {
        if (!adresseAutorisee(fichier?.url, version, { test })) {
            throw new Error(`adresse de téléchargement refusée : ${fichier?.url ?? "absente"}.`);
        }
    }
    const dossier = path.join(dossierMisesAJour(dossierDonnees), version);
    await fs.promises.rm(dossier, { recursive: true, force: true });
    await fs.promises.mkdir(dossier, { recursive: true });
    const controleur = new AbortController();
    const minuteur = setTimeout(() => controleur.abort(), DELAI_MS);
    try {
        onEtape?.({ etape: "empreinte" });
        const texte = await (await obtenir(empreinte.url, { fetchImpl, test, signal: controleur.signal })).text();
        const attendue = lireEmpreinte(texte.slice(0, 4096), zip.name);
        if (!attendue) {
            throw new Error(`empreinte de ${zip.name} introuvable dans ${empreinte.name}.`);
        }
        const fichierZip = path.join(dossier, zip.name);
        const obtenue = await telechargerFichier(zip.url, `${fichierZip}.part`, {
            fetchImpl,
            test,
            signal: controleur.signal,
            taille: zip.size,
            onProgress: (recu, total) => onEtape?.({ etape: "telechargement", recu, total }),
        });
        if (obtenue !== attendue) {
            throw new Error("le fichier téléchargé ne correspond pas à son empreinte SHA-256 : il a été supprimé, rien n'est installé.");
        }
        await fs.promises.rename(`${fichierZip}.part`, fichierZip);
        onEtape?.({ etape: "decompression" });
        const extrait = path.join(dossier, "application");
        await fs.promises.mkdir(extrait);
        await decompresseur(fichierZip, extrait);
        await fs.promises.rm(fichierZip, { force: true });
        const application = trouverApplication(extrait, nomExe);
        if (!application || !analyserSource(application).complet) {
            throw new Error("le zip téléchargé ne contient pas l'application attendue.");
        }
        journaliser(dossierDonnees, "mise à jour", `version ${version} téléchargée et vérifiée (SHA-256 ${attendue.slice(0, 12)}…)`);
        return { application, exe: path.join(application, nomExe), sha256: attendue };
    } catch (error) {
        await fs.promises.rm(dossier, { recursive: true, force: true }).catch(() => {});
        throw error;
    } finally {
        clearTimeout(minuteur);
    }
}

// Après la relance depuis programme\ : les dossiers de mise à jour ne servent plus.
export async function nettoyerMisesAJour(dossierDonnees) {
    await fs.promises.rm(dossierMisesAJour(dossierDonnees), { recursive: true, force: true }).catch(() => {});
}

// Attend la fin d'un processus (l'ancienne application), au plus delaiMs.
export async function attendreFin(pid, delaiMs = 60000) {
    const fin = Date.now() + delaiMs;
    while (Date.now() < fin) {
        try {
            process.kill(pid, 0);
        } catch {
            return true;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return false;
}
