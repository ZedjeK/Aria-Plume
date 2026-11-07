// Inscriptions dans le registre de Windows (complément Word, pont avec l'extension), avec un faux
// PowerShell : ce que l'application lui envoie (script, variables), et ce qu'elle fait de ses
// réponses (succès relu, échec, valeur relue différente, aucune sortie).
// Le vrai PowerShell ne tourne que sous Windows : la vérification finale se fait sur un vrai poste Windows.
//     node tests/registry.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { POWERSHELL_SCRIPTS, manualCommand, registerWord, unregisterWord, wordRegistered } from "../office/manifest.js";
import { BRIDGE_SCRIPTS, bridgeRegistration, registerBridge } from "../bridge/register.js";
import { PREAMBLE, encodeScript } from "../powershell.js";

let failures = 0;
const check = (label, ok, detail = "") => {
    console.log(`${ok ? "OK   " : "ÉCHEC"} ${label}${detail ? ` : ${detail}` : ""}`);
    failures += ok ? 0 : 1;
};
const root = fs.mkdtempSync(path.join(os.tmpdir(), "aria-registre-"));
const dir = path.join(root, "Héléna Bérani", ".Aria-Plume", "office");
const manifest = path.join(dir, "manifeste-word.xml");
const calls = [];
// Faux PowerShell : enregistre l'appel, répond ce qu'on lui dit.
const fake = (answer) => async (script, env) => {
    calls.push({ script, env });
    return typeof answer === "function" ? answer(script, env) : answer;
};

// --- Lanceur ---
check("script encodé en UTF-16 (aucun souci de guillemets)", Buffer.from(encodeScript("Write-Output 'é'"), "base64").toString("utf16le") === "Write-Output 'é'");
check("sortie en UTF-8 sans BOM, erreurs bloquantes", PREAMBLE.includes("UTF8Encoding $false") && PREAMBLE.includes("$ErrorActionPreference = 'Stop'"));

// --- Word ---
const word = await registerWord({ dir, origin: "https://localhost:47823", version: "0.36.1", platform: "win32", run: fake((script, env) => ({ ok: true, output: env.ARIA_MANIFESTE, error: "" })) });
const sent = calls.at(-1);
check("Word : chemin du manifeste passé par une variable, pas dans le script", sent.env.ARIA_MANIFESTE === manifest && !sent.script.includes(manifest) && fs.existsSync(manifest));
check("Word : script vérifié sous Windows (clé, écriture, relecture)", sent.script.includes("'HKCU:\\Software\\Microsoft\\Office\\16.0\\WEF\\Developer'") && sent.script.includes("Set-ItemProperty -Path $cle -Name $manifeste -Value $manifeste") && sent.script.includes("(Get-ItemProperty -Path $cle -ErrorAction Stop).$manifeste"), sent.script);
check("Word : inscrit seulement si la relecture donne le chemin", word.registered === true && word.error === null);
const unreadable = await registerWord({ dir, origin: "https://localhost:47823", version: "0.36.1", platform: "win32", run: fake({ ok: true, output: "", error: "" }) });
check("Word : relecture vide → pas inscrit, raison donnée", unreadable.registered === false && /relue/.test(unreadable.error), unreadable.error);
const denied = await registerWord({ dir, origin: "https://localhost:47823", version: "0.36.1", platform: "win32", run: fake({ ok: false, output: "", error: "Accès refusé au registre" }) });
check("Word : erreur de PowerShell → pas inscrit, son message", denied.registered === false && denied.error === "Accès refusé au registre");
check("Word : état relu (inscrit / pas inscrit)", (await wordRegistered({ dir, platform: "win32", run: fake((s, env) => ({ ok: true, output: env.ARIA_MANIFESTE })) })) === true
    && (await wordRegistered({ dir, platform: "win32", run: fake({ ok: true, output: "" }) })) === false);
check("Word : script de lecture et de retrait", POWERSHELL_SCRIPTS.query.includes("Get-ItemProperty") && POWERSHELL_SCRIPTS.unregister.includes("Remove-ItemProperty -Path $cle -Name $manifeste"));
const command = manualCommand("C:\\Users\\O'Neil\\.Aria-Plume\\office\\manifeste-word.xml");
check("commande manuelle : apostrophe d'un chemin échappée", command.includes("'C:\\Users\\O''Neil\\.Aria-Plume\\office\\manifeste-word.xml'") && command.includes("Set-ItemProperty"), command);
await unregisterWord({ dir, platform: "win32", run: fake({ ok: true, output: "" }) });
check("Word : désinstallation (retrait demandé, manifeste supprimé)", calls.at(-1).script === POWERSHELL_SCRIPTS.unregister && !fs.existsSync(manifest));

// --- Pont ---
const bridgeDir = path.join(root, "pont");
const options = { dir: bridgeDir, exe: "C:\\Aria\\Aria Plume.exe", appCommand: { command: "C:\\Aria\\Aria Plume.exe", args: ["--hidden"] }, pipe: "\\\\.\\pipe\\aria-plume-zeman", tokenFile: path.join(bridgeDir, "jeton"), extensionId: "fpgalamdbelhkacggnnglgcljhdcioca", hostName: "fr.aria_plume.app", platform: "win32" };
// Chrome et Edge réussissent, Brave échoue, Chromium ne répond pas.
const bridge = await registerBridge({ ...options, run: fake((script, env) => {
    const keys = env.ARIA_CLES.split(";");
    return { ok: true, output: `${keys[0]}|ok\n${keys[1]}|ok\n${keys[2]}|Accès refusé`, error: "" };
}) });
const bridgeCall = calls.at(-1);
const keys = bridgeCall.env.ARIA_CLES.split(";");
check("pont : quatre clés, au bon endroit", keys.length === 4 && keys[0] === "HKCU:\\Software\\Google\\Chrome\\NativeMessagingHosts\\fr.aria_plume.app" && keys.includes("HKCU:\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\fr.aria_plume.app"), keys.join(" ; "));
check("pont : manifeste passé par une variable, relu (valeur par défaut)", bridgeCall.env.ARIA_MANIFESTE === path.join(bridgeDir, "fr.aria_plume.app.json") && BRIDGE_SCRIPTS.register.includes("GetValue('')"));
check("pont : réussites et échecs par navigateur", bridge.registered.join() === "Google Chrome, Opera, Vivaldi,Microsoft Edge" && bridge.failed.map((f) => `${f.name}=${f.error}`).join() === "Brave=Accès refusé,Chromium=pas de réponse de PowerShell", JSON.stringify(bridge));
const state = await bridgeRegistration({ ...options, run: fake((script, env) => ({ ok: true, output: env.ARIA_CLES.split(";").map((key, i) => `${key}|${i === 1 ? "ok" : "absente"}`).join("\r\n") })) });
check("pont : état relu (lignes Windows \\r\\n)", state.registered && state.browsers.join() === "Microsoft Edge", JSON.stringify(state.browsers));

fs.rmSync(root, { recursive: true, force: true });
console.log(failures ? `\n${failures} échec(s)` : "\ntout est bon");
process.exitCode = failures ? 1 : 0;
