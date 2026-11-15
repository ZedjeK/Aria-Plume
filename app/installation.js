// Aria Plume (application) — installation par l'exe, selon le modèle des applis Aria.
//
// Lancé depuis un zip décompressé, l'exe propose « Installer » ou « Lancer sans installer ».
// Installer copie le dossier de l'application dans C:\Users\<toi>\.Aria-Plume\programme, garde la
// version précédente dans sauvegardes\versions\, puis l'application se relance depuis là.
// Rien n'est écrit ailleurs (le raccourci du Bureau, sur demande, est posé par app-main.js).
//
// Module sans Electron : il ne touche que des fichiers, et se teste seul (tests/installation.mjs).

import { createRequire } from "node:module";
import path from "node:path";
import { journaliser } from "./donnees.js";

// Dans Electron, « fs » montre les archives .asar comme des dossiers : copier resources\app.asar
// avec lui donnerait un dossier à la place du fichier. « original-fs » voit les vrais fichiers.
const fs = createRequire(import.meta.url)(process.versions.electron ? "original-fs" : "node:fs");

export const DOSSIER_PROGRAMME = "programme";
const FICHIER_VERSION = "version.txt";
// Ce sans quoi l'application ne démarre pas : son code et le moteur (l'extension embarquée).
const INDISPENSABLES = [["resources", "app.asar"], ["resources", "aria", "manifest.json"]];

export const dossierProgramme = (dossierDonnees) => path.join(dossierDonnees, DOSSIER_PROGRAMME);
const dossierVersions = (dossierDonnees) => path.join(dossierDonnees, "sauvegardes", "versions");

const dedans = (parent, enfant) => {
    const relatif = path.relative(path.resolve(parent), path.resolve(enfant));
    return relatif === "" || (!relatif.startsWith("..") && !path.isAbsolute(relatif));
};

// L'exe tourne-t-il depuis programme\ ?
export const estInstallee = (execPath, dossierDonnees) => dedans(dossierProgramme(dossierDonnees), execPath);

// Le dossier de l'exe a-t-il tout ce qu'il faut ? Lancé depuis l'aperçu d'un zip, l'Explorateur
// n'extrait que l'exe : il manque alors resources\.
export function analyserSource(dossierExe) {
    const manque = INDISPENSABLES.map((parties) => path.join(...parties)).filter((relatif) => !fs.existsSync(path.join(dossierExe, relatif)));
    return { complet: manque.length === 0, manque };
}

// Faut-il proposer l'installation ? Seulement pour l'application Windows empaquetée, lancée hors de
// programme\, sans --portable ni lancement en arrière-plan, et si la proposition n'est pas coupée.
export function proposerInstallation({ execPath, dossierDonnees, argv = [], proposer = true, plateforme = process.platform, empaquetee = true }) {
    if (plateforme !== "win32" || !empaquetee || !proposer) {
        return false;
    }
    if (argv.some((arg) => ["--portable", "--silencieux", "--hidden", "--mcp"].includes(arg))) {
        return false;
    }
    return !estInstallee(execPath, dossierDonnees);
}

// Version rangée dans programme\ (écrite à l'installation), ou null.
export function versionInstallee(dossierDonnees) {
    try {
        return fs.readFileSync(path.join(dossierProgramme(dossierDonnees), FICHIER_VERSION), "utf8").trim() || null;
    } catch {
        return null;
    }
}

// Les fichiers venus d'internet portent la marque « téléchargé depuis Internet » (flux
// Zone.Identifier), que la copie garde. L'utilisateur a lancé l'exe et accepté l'installation : la
// copie installée ne la garde pas.
export async function retirerMarqueInternet(dossier, plateforme = process.platform) {
    if (plateforme !== "win32") {
        return 0;
    }
    let retirees = 0;
    const entrees = await fs.promises.readdir(dossier, { recursive: true, withFileTypes: true });
    for (const entree of entrees) {
        if (!entree.isFile()) {
            continue;
        }
        const marque = `${path.join(entree.parentPath ?? entree.path, entree.name)}:Zone.Identifier`;
        try {
            await fs.promises.unlink(marque);
            retirees += 1;
        } catch {
            // Pas de marque sur ce fichier.
        }
    }
    return retirees;
}

function refuserLien(chemin) {
    try {
        if (fs.lstatSync(chemin).isSymbolicLink()) {
            throw new Error(`${chemin} est un lien ou une jonction : rien n'est copié ni supprimé.`);
        }
    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
    }
}

// Copie l'application dans programme\. La version déjà installée passe dans sauvegardes\versions\
// (seule la précédente est gardée). Renvoie le chemin de l'exe installé.
export async function installer({ source, dossierDonnees, nomExe, version, plateforme = process.platform }) {
    const programme = dossierProgramme(dossierDonnees);
    const neuf = `${programme}.nouveau`;
    if (dedans(programme, source) || dedans(source, dossierDonnees)) {
        throw new Error("L'application est déjà dans son dossier d'installation.");
    }
    const { complet, manque } = analyserSource(source);
    if (!complet) {
        throw new Error(`Il manque ${manque.join(", ")} à côté de l'exe : décompresse d'abord le zip en entier (clic droit, « Extraire tout »), puis relance l'exe depuis le dossier décompressé.`);
    }
    if (!fs.existsSync(path.join(source, nomExe))) {
        throw new Error(`${nomExe} est introuvable dans ${source}.`);
    }
    for (const chemin of [dossierDonnees, programme, neuf, path.dirname(dossierVersions(dossierDonnees)), dossierVersions(dossierDonnees)]) {
        refuserLien(chemin);
    }

    // 1. Copie complète à côté, pour ne jamais laisser un programme\ à moitié copié.
    await fs.promises.rm(neuf, { recursive: true, force: true });
    await fs.promises.mkdir(dossierDonnees, { recursive: true });
    let marques = 0;
    try {
        await fs.promises.cp(source, neuf, { recursive: true, verbatimSymlinks: true });
        await fs.promises.writeFile(path.join(neuf, FICHIER_VERSION), `${version}\n`);
        if (!analyserSource(neuf).complet) {
            throw new Error("la copie est incomplète.");
        }
        marques = await retirerMarqueInternet(neuf, plateforme);
    } catch (error) {
        // Copie ratée : rien de laissé à moitié, la version installée (s'il y en a une) reste en place.
        await fs.promises.rm(neuf, { recursive: true, force: true }).catch(() => {});
        throw error;
    }

    // 2. Version précédente de côté, puis la nouvelle à sa place.
    let precedente = null;
    if (fs.existsSync(programme)) {
        const ancienne = versionInstallee(dossierDonnees) ?? "precedente";
        const versions = dossierVersions(dossierDonnees);
        await fs.promises.mkdir(versions, { recursive: true });
        // Une seule version gardée : celle qu'on remplace.
        for (const nom of await fs.promises.readdir(versions)) {
            await fs.promises.rm(path.join(versions, nom), { recursive: true, force: true });
        }
        precedente = path.join(versions, ancienne);
        await fs.promises.rename(programme, precedente);
    }
    try {
        await fs.promises.rename(neuf, programme);
    } catch (error) {
        // Remise en place de la version précédente : l'utilisateur garde une application qui marche.
        if (precedente && !fs.existsSync(programme)) {
            await fs.promises.rename(precedente, programme).catch(() => {});
        }
        throw error;
    }
    journaliser(dossierDonnees, "installation", `version ${version} dans ${DOSSIER_PROGRAMME}\\${precedente ? `, précédente gardée dans sauvegardes\\versions\\${path.basename(precedente)}` : ""}${marques ? `, marque Internet retirée de ${marques} fichier(s)` : ""}`);
    return { exe: path.join(programme, nomExe), precedente };
}
