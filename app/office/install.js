// Aria Plume (application) — fichiers et approbation du certificat du complément Office.
//
// Dossier « Aria Plume - Office », à côté des réglages :
//   autorite-localhost.cer   l'autorité limitée à localhost (publique, sa clé a été jetée)
//   serveur.pem              le certificat du serveur
//   serveur-cle.pem          sa clé privée (lisible par l'utilisateur seul)
//   etat.json                empreinte de l'autorité, date de création
// Sous Windows, l'autorité est ajoutée aux autorités de confiance de la session
// (certutil -user -addstore Root) : Windows affiche un avertissement et demande confirmation.

import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createLocalhostCertificates } from "./cert.js";

export const OFFICE_FOLDER = "Aria Plume - Office";
const FILES = { ca: "autorite-localhost.cer", cert: "serveur.pem", key: "serveur-cle.pem", state: "etat.json" };

const run = (command, args) => new Promise((resolve) => {
    execFile(command, args, { windowsHide: true }, (error, stdout, stderr) => {
        resolve({ ok: !error, code: error?.code ?? 0, output: `${stdout ?? ""}${stderr ?? ""}`.trim() });
    });
});

// Certificats existants, ou null.
export function loadCertificates(dir) {
    try {
        const state = JSON.parse(fs.readFileSync(path.join(dir, FILES.state), "utf8"));
        return {
            cert: fs.readFileSync(path.join(dir, FILES.cert), "utf8"),
            key: fs.readFileSync(path.join(dir, FILES.key), "utf8"),
            caFile: path.join(dir, FILES.ca),
            caThumbprint: state.caThumbprint,
            createdAt: state.createdAt,
        };
    } catch {
        return null;
    }
}

// Crée les certificats s'ils n'existent pas encore.
export function ensureCertificates(dir) {
    const existing = loadCertificates(dir);
    if (existing) {
        return { ...existing, created: false };
    }
    fs.mkdirSync(dir, { recursive: true });
    const made = createLocalhostCertificates();
    fs.writeFileSync(path.join(dir, FILES.ca), made.caDer);
    fs.writeFileSync(path.join(dir, FILES.cert), made.cert);
    fs.writeFileSync(path.join(dir, FILES.key), made.key, { mode: 0o600 });
    // Écrit en dernier : sans lui, les certificats sont refaits.
    fs.writeFileSync(path.join(dir, FILES.state), `${JSON.stringify({ caThumbprint: made.caThumbprint, createdAt: new Date().toISOString() }, null, 4)}\n`);
    return { ...loadCertificates(dir), created: true };
}

// L'autorité est-elle approuvée ? true / false, ou null hors Windows (rien à approuver).
export async function isTrusted(certificates, platform = process.platform) {
    if (platform !== "win32" || !certificates) {
        return platform === "win32" ? false : null;
    }
    return (await run("certutil", ["-user", "-verifystore", "Root", certificates.caThumbprint])).ok;
}

// Ajout aux autorités de confiance de la session. Renvoie { ok, refused, error }.
export async function trust(certificates, platform = process.platform) {
    if (platform !== "win32") {
        return { ok: false, refused: false, error: null, skipped: true };
    }
    const result = await run("certutil", ["-user", "-addstore", "Root", certificates.caFile]);
    if (result.ok && await isTrusted(certificates, platform)) {
        return { ok: true, refused: false, error: null };
    }
    // « Non » dans la fenêtre de Windows : certutil échoue (annulé par l'utilisateur).
    return { ok: false, refused: true, error: result.output.split(/\r?\n/).filter(Boolean).pop() ?? null };
}

// Retire l'autorité (si approuvée) et supprime le dossier.
export async function removeCertificates(dir, platform = process.platform) {
    const certificates = loadCertificates(dir);
    if (certificates && platform === "win32") {
        await run("certutil", ["-user", "-delstore", "Root", certificates.caThumbprint]);
    }
    for (const name of Object.values(FILES)) {
        fs.rmSync(path.join(dir, name), { force: true });
    }
    try {
        fs.rmdirSync(dir);
    } catch {
        // Le dossier contient autre chose (manifestes des étapes suivantes, fichiers à l'utilisateur).
    }
}
