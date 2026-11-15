// Aria Plume (application) — secrets du dossier de données, protégés par DPAPI (Windows).
//
// Le seul secret d'Aria Plume : le jeton du pont avec l'extension, dans
//     C:\Users\<toi>\.Aria-Plume\secrets\pont.jeton
// Sous Windows, le fichier ne contient que le texte chiffré par DPAPI (portée « utilisateur
// courant » : seul ton compte Windows peut le relire, sur cette machine). DPAPI ne protège pas
// contre un programme lancé sous le même compte, qui peut demander lui-même le déchiffrement : le
// README le dit dans « Limites à connaître ».
// Hors de Windows (tests, développement sous Linux), il n'y a pas de DPAPI : le jeton reste en
// clair dans le même fichier, lisible par l'utilisateur seul (0600).
//
// Le relais (bridge/relay.cjs) relit le jeton lui-même, avec la même commande PowerShell que
// ci-dessous : si tu changes l'un, change l'autre (tests/secrets.mjs vérifie leur accord).
//
// Les valeurs passent par des variables d'environnement du processus PowerShell, jamais dans son
// texte ni dans sa ligne de commande.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { journaliser } from "./donnees.js";
import { runPowerShell } from "./powershell.js";

export const DOSSIER_SECRETS = "secrets";
export const FICHIER_JETON = "pont.jeton";
// Mélangé au chiffrement : un autre programme qui appellerait DPAPI sans le connaître ne relit pas
// ce fichier par hasard. Même texte dans bridge/relay.cjs.
export const ENTROPIE = "Aria-Plume/pont";
const JETON = /^[0-9a-f]{64}$/;

export const dossierSecrets = (dossierDonnees) => path.join(dossierDonnees, DOSSIER_SECRETS);
export const fichierJeton = (dossierDonnees) => path.join(dossierSecrets(dossierDonnees), FICHIER_JETON);

export const SCRIPT_PROTEGER = `Add-Type -AssemblyName System.Security
$octets = [Text.Encoding]::UTF8.GetBytes($env:ARIA_SECRET)
$entropie = [Text.Encoding]::UTF8.GetBytes($env:ARIA_ENTROPIE)
[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($octets, $entropie, [Security.Cryptography.DataProtectionScope]::CurrentUser))`;

export const SCRIPT_OUVRIR = `Add-Type -AssemblyName System.Security
$blob = [Convert]::FromBase64String($env:ARIA_SECRET)
$entropie = [Text.Encoding]::UTF8.GetBytes($env:ARIA_ENTROPIE)
[Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($blob, $entropie, [Security.Cryptography.DataProtectionScope]::CurrentUser))`;

async function lancer(script, valeur, run) {
    const resultat = await run(script, { ARIA_SECRET: valeur, ARIA_ENTROPIE: ENTROPIE });
    if (!resultat.ok || !resultat.output) {
        throw new Error(`DPAPI : ${resultat.error || "aucune sortie"}`);
    }
    return resultat.output;
}

export const proteger = (texte, run = runPowerShell) => lancer(SCRIPT_PROTEGER, texte, run);
export const ouvrir = (base64, run = runPowerShell) => lancer(SCRIPT_OUVRIR, base64, run);

function ecrire(fichier, contenu) {
    fs.mkdirSync(path.dirname(fichier), { recursive: true });
    // Écriture atomique : un fichier temporaire, puis renommage.
    const temp = `${fichier}.tmp`;
    fs.writeFileSync(temp, `${contenu}\n`, { mode: 0o600 });
    fs.renameSync(temp, fichier);
}

function lireJetonClair(fichier) {
    try {
        const texte = fs.readFileSync(fichier, "utf8").trim();
        return JETON.test(texte) ? texte : null;
    } catch {
        return null;
    }
}

// Le jeton du pont : relu dans secrets\pont.jeton, repris de l'ancien fichier en clair (pont\jeton,
// d'avant la 0.40) s'il n'y est pas encore, sinon créé. Renvoie { token, ancien } : « ancien » est
// le fichier en clair à retirer une fois le relais réinscrit avec le nouveau chemin (retirerAncien),
// ou null.
export async function lireOuCreerJeton({ dossierDonnees, ancienFichier = null, plateforme = process.platform, run = runPowerShell }) {
    const fichier = fichierJeton(dossierDonnees);
    const dpapi = plateforme === "win32";
    let contenu = null;
    try {
        contenu = fs.readFileSync(fichier, "utf8").trim();
    } catch {
        // Pas encore de fichier.
    }
    if (contenu) {
        if (!dpapi) {
            if (JETON.test(contenu)) {
                return { token: contenu, ancien: ancienFichier && fs.existsSync(ancienFichier) ? ancienFichier : null };
            }
        } else if (JETON.test(contenu)) {
            // Écrit en clair (copie à la main, ancienne version) : on le protège sur place.
            ecrire(fichier, await proteger(contenu, run));
            journaliser(dossierDonnees, "secrets", "jeton du pont : protégé par DPAPI");
            return { token: contenu, ancien: ancienFichier && fs.existsSync(ancienFichier) ? ancienFichier : null };
        } else {
            const token = await ouvrir(contenu, run);
            if (JETON.test(token)) {
                return { token, ancien: ancienFichier && fs.existsSync(ancienFichier) ? ancienFichier : null };
            }
            throw new Error("jeton du pont illisible : supprime secrets\\pont.jeton pour en créer un nouveau.");
        }
    }
    const repris = ancienFichier ? lireJetonClair(ancienFichier) : null;
    const token = repris ?? crypto.randomBytes(32).toString("hex");
    ecrire(fichier, dpapi ? await proteger(token, run) : token);
    journaliser(dossierDonnees, "secrets", repris
        ? `jeton du pont repris de pont\\jeton${dpapi ? " et protégé par DPAPI" : ""}`
        : `jeton du pont créé${dpapi ? " et protégé par DPAPI" : ""}`);
    return { token, ancien: repris ? ancienFichier : null };
}

// Retire l'ancien fichier en clair, une fois le relais réinscrit avec le nouveau chemin.
export function retirerAncien(ancien, dossierDonnees) {
    if (!ancien) {
        return false;
    }
    try {
        fs.rmSync(ancien, { force: true });
        journaliser(dossierDonnees, "secrets", "ancien jeton en clair (pont\\jeton) retiré");
        return true;
    } catch {
        return false;
    }
}
