// Aria Plume (application) — inscription du relais auprès des navigateurs (messagerie native).
//
// « Connecter les navigateurs » pose, dans le dossier « pont » d'Aria Plume (C:\Users\<toi>\.Aria-Plume\pont) :
//   relay.cjs            le relais (copie de bridge/relay.cjs)
//   relay-config.json    adresse du canal, fichier du jeton, commande qui démarre l'application
//   relay.cmd / relay.sh le lanceur : l'exécutable d'Aria Plume en mode Node
//   fr.aria_plume.app.json   le manifeste lu par le navigateur
// puis inscrit le manifeste :
//   Windows : une clé par navigateur dans HKEY_CURRENT_USER (aucun droit administrateur), écrite
//             par PowerShell puis relue ;
//   Linux   : une copie du manifeste dans le dossier NativeMessagingHosts de chaque navigateur.
// L'exe portable se décompresse ailleurs à chaque lancement : il ne peut pas être inscrit.

import { runPowerShell } from "../powershell.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const BRIDGE_FOLDER = "pont";
const RELAY_SOURCE = path.join(path.dirname(fileURLToPath(import.meta.url)), "relay.cjs");

// Clés lues par les navigateurs Chromium (Opera et Vivaldi lisent celle de Chrome).
const WINDOWS_KEYS = [
    ["Google Chrome, Opera, Vivaldi", "Google\\Chrome"],
    ["Microsoft Edge", "Microsoft\\Edge"],
    ["Brave", "BraveSoftware\\Brave-Browser"],
    ["Chromium", "Chromium"],
];
// Dossiers de configuration sous Linux (~/.config/<dossier>/NativeMessagingHosts).
const LINUX_DIRS = [
    ["Google Chrome", "google-chrome"],
    ["Chromium", "chromium"],
    ["Microsoft Edge", "microsoft-edge"],
    ["Brave", "BraveSoftware/Brave-Browser"],
    ["Vivaldi", "vivaldi"],
    ["Opera", "opera"],
];

// Peut-on inscrire le relais ici ? { ok, reason }
export function bridgeSupport({ env = process.env, platform = process.platform } = {}) {
    if (env.PORTABLE_EXECUTABLE_FILE) {
        return { ok: false, reason: "portable" };
    }
    if (platform !== "win32" && platform !== "linux") {
        return { ok: false, reason: "platform" };
    }
    return { ok: true, reason: null };
}

// Registre de Windows : par PowerShell, puis relu (l'appel direct à reg.exe depuis l'application ne
// laissait aucune trace dans le registre lors d'un essai réel). Clés et manifeste passent par des
// variables d'environnement. Une ligne de sortie par clé : « clé|ok » ou « clé|raison ».
export const BRIDGE_SCRIPTS = {
    register: `$manifeste = $env:ARIA_MANIFESTE
foreach ($cle in $env:ARIA_CLES -split ';') {
    try {
        if (-not (Test-Path $cle)) { New-Item -Path $cle -Force | Out-Null }
        Set-Item -Path $cle -Value $manifeste
        if ((Get-Item -Path $cle).GetValue('') -eq $manifeste) { "$cle|ok" } else { "$cle|valeur relue différente" }
    } catch { "$cle|$($_.Exception.Message)" }
}`,
    query: `$manifeste = $env:ARIA_MANIFESTE
foreach ($cle in $env:ARIA_CLES -split ';') {
    if ((Test-Path $cle) -and ((Get-Item -Path $cle -ErrorAction SilentlyContinue).GetValue('') -eq $manifeste)) { "$cle|ok" } else { "$cle|absente" }
}`,
    unregister: `foreach ($cle in $env:ARIA_CLES -split ';') { Remove-Item -Path $cle -ErrorAction SilentlyContinue }`,
};

// Clés PowerShell (HKCU:\…) des navigateurs, avec leur nom.
const windowsKeys = (hostName) => WINDOWS_KEYS.map(([name, vendor]) => ({ name, key: `HKCU:\\Software\\${vendor}\\NativeMessagingHosts\\${hostName}` }));

// Résultat par clé (« clé|ok » ou « clé|raison ») → { ok: [noms], failed: [{ name, error }] }.
function parseLines(keys, output, fallbackError) {
    const lines = new Map(String(output).split(/\r?\n/).map((line) => line.split("|")).filter((parts) => parts.length >= 2).map(([key, ...rest]) => [key.trim(), rest.join("|").trim()]));
    const ok = [];
    const failed = [];
    for (const { name, key } of keys) {
        const status = lines.get(key);
        if (status === "ok") {
            ok.push(name);
        } else {
            failed.push({ name, error: status || fallbackError || "pas de réponse de PowerShell" });
        }
    }
    return { ok, failed };
}

// Emplacements où inscrire le manifeste. ARIA_TEST_NATIVE_DIRS (banc uniquement) : liste JSON
// de dossiers à la place des vrais.
function linuxTargets(env) {
    if (env.ARIA_TEST_HOOKS === "1" && env.ARIA_TEST_NATIVE_DIRS) {
        return JSON.parse(env.ARIA_TEST_NATIVE_DIRS).map((dir) => ({ name: dir, dir }));
    }
    const config = env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
    return LINUX_DIRS
        .map(([name, folder]) => ({ name, base: path.join(config, ...folder.split("/")) }))
        // Seulement les navigateurs installés (leur dossier de configuration existe).
        .filter(({ base }) => fs.existsSync(base))
        .map(({ name, base }) => ({ name, dir: path.join(base, "NativeMessagingHosts") }));
}


function launcherText({ platform, exe, relay }) {
    if (platform === "win32") {
        // Un fichier .cmd attend la fin du programme, même graphique : le navigateur garde la main
        // sur stdin/stdout du relais.
        return `@echo off\r\nset ELECTRON_RUN_AS_NODE=1\r\n"${exe}" "${relay}" %*\r\n`;
    }
    const quote = (text) => `'${text.replace(/'/g, "'\\''")}'`;
    return `#!/bin/sh\nELECTRON_RUN_AS_NODE=1 exec ${quote(exe)} ${quote(relay)} "$@"\n`;
}

// Inscrit (ou réinscrit) le relais. Renvoie { registered: [noms], failed: [{ name, error }], dir }.
export async function registerBridge({ dir, exe, appCommand, pipe, tokenFile, extensionId, hostName, env = process.env, platform = process.platform, run = runPowerShell }) {
    fs.mkdirSync(dir, { recursive: true });
    const relay = path.join(dir, "relay.cjs");
    // Lecture puis écriture : la source peut être dans l'archive app.asar.
    fs.writeFileSync(relay, fs.readFileSync(RELAY_SOURCE));
    fs.writeFileSync(path.join(dir, "relay-config.json"), `${JSON.stringify({ pipe, tokenFile, app: appCommand }, null, 4)}\n`);
    const launcher = path.join(dir, platform === "win32" ? "relay.cmd" : "relay.sh");
    fs.writeFileSync(launcher, launcherText({ platform, exe, relay }), { mode: 0o755 });
    const manifest = {
        name: hostName,
        description: "Aria Plume : correction et traduction par l'application",
        path: launcher,
        type: "stdio",
        allowed_origins: [`chrome-extension://${extensionId}/`],
    };
    const manifestFile = path.join(dir, `${hostName}.json`);
    fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 4)}\n`);

    const registered = [];
    const failed = [];
    if (platform === "win32") {
        const keys = windowsKeys(hostName);
        const result = await run(BRIDGE_SCRIPTS.register, { ARIA_MANIFESTE: manifestFile, ARIA_CLES: keys.map(({ key }) => key).join(";") });
        const parsed = parseLines(keys, result.output, result.error);
        registered.push(...parsed.ok);
        failed.push(...parsed.failed);
    } else {
        for (const { name, dir: target } of linuxTargets(env)) {
            try {
                fs.mkdirSync(target, { recursive: true });
                fs.writeFileSync(path.join(target, `${hostName}.json`), `${JSON.stringify(manifest, null, 4)}\n`);
                registered.push(name);
            } catch (error) {
                failed.push({ name, error: error.message });
            }
        }
    }
    return { registered, failed, dir };
}

// Retire l'inscription et les fichiers du relais (le jeton reste, il ne sert à rien d'autre).
export async function unregisterBridge({ dir, hostName, env = process.env, platform = process.platform, run = runPowerShell }) {
    if (platform === "win32") {
        await run(BRIDGE_SCRIPTS.unregister, { ARIA_CLES: windowsKeys(hostName).map(({ key }) => key).join(";") });
    } else {
        for (const { dir: target } of linuxTargets(env)) {
            fs.rmSync(path.join(target, `${hostName}.json`), { force: true });
        }
    }
    for (const name of ["relay.cjs", "relay-config.json", "relay.cmd", "relay.sh", `${hostName}.json`]) {
        fs.rmSync(path.join(dir, name), { force: true });
    }
}

// État de l'inscription : { registered, browsers: [noms], manifest }.
// « registered » : notre manifeste existe et au moins un navigateur pointe vers lui.
export async function bridgeRegistration({ dir, hostName, env = process.env, platform = process.platform, run = runPowerShell }) {
    const manifestFile = path.join(dir, `${hostName}.json`);
    if (!fs.existsSync(manifestFile)) {
        return { registered: false, browsers: [], manifest: null };
    }
    const browsers = [];
    if (platform === "win32") {
        const keys = windowsKeys(hostName);
        const result = await run(BRIDGE_SCRIPTS.query, { ARIA_MANIFESTE: manifestFile, ARIA_CLES: keys.map(({ key }) => key).join(";") });
        browsers.push(...parseLines(keys, result.output, result.error).ok);
    } else {
        for (const { name, dir: target } of linuxTargets(env)) {
            if (fs.existsSync(path.join(target, `${hostName}.json`))) {
                browsers.push(name);
            }
        }
    }
    return { registered: browsers.length > 0, browsers, manifest: manifestFile };
}
