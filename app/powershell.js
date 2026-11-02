// Aria Plume (application) — lancer un script PowerShell (Windows).
// Même méthode que windows-input.js, éprouvée chez Jérémy : le script part encodé
// (-EncodedCommand, UTF-16 en base64), donc aucun souci de guillemets ni de retours à la ligne.
// Les valeurs (chemins…) passent par des variables d'environnement, jamais dans le texte du script.

import { execFile } from "node:child_process";

export const encodeScript = (script) => Buffer.from(script, "utf16le").toString("base64");

// Sortie en UTF-8 (sinon la page de code de la console abîme les accents d'un chemin, et une
// relecture « C:\Users\Jérémy… » ne correspondrait plus) ; toute erreur arrête le script.
// (UTF-8 sans BOM : [Text.Encoding]::UTF8 en ajouterait un en tête de sortie sous PowerShell 5.1.)
export const PREAMBLE = "[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false; $ErrorActionPreference = 'Stop'\n";

// Renvoie { ok, output, error } (sortie standard nettoyée, erreur lisible).
export function runPowerShell(script, env = {}) {
    return new Promise((resolve) => {
        execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encodeScript(PREAMBLE + script)], {
            windowsHide: true,
            encoding: "utf8",
            env: { ...process.env, ...env },
        }, (error, stdout, stderr) => {
            resolve({ ok: !error, output: String(stdout ?? "").replace(/^\uFEFF/, "").trim(), error: String(stderr || error?.message || "").replace(/^\uFEFF/, "").trim() });
        });
    });
}
