// Installation par l'exe (installation.js) : proposition, copie, version précédente gardée, zip
// incomplet refusé, marque Internet retirée (Windows). Sans Electron.
//     node tests/installation.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyserSource, estInstallee, installer, proposerInstallation, versionInstallee } from "../installation.js";

let echecs = 0;
const check = (label, ok, detail = "") => {
    console.log(`${ok ? "OK   " : "ÉCHEC"} ${label}${detail ? ` : ${detail}` : ""}`);
    echecs += ok ? 0 : 1;
};
const racine = fs.mkdtempSync(path.join(os.tmpdir(), "aria-installation-"));
const EXE = "Aria Plume.exe";

// Un faux zip décompressé : l'exe, son code, le moteur, une DLL.
function fauxZip(nom, contenu) {
    const dossier = path.join(racine, nom);
    fs.mkdirSync(path.join(dossier, "resources", "aria"), { recursive: true });
    fs.writeFileSync(path.join(dossier, EXE), contenu);
    fs.writeFileSync(path.join(dossier, "ffmpeg.dll"), "dll");
    fs.writeFileSync(path.join(dossier, "resources", "app.asar"), "asar");
    fs.writeFileSync(path.join(dossier, "resources", "aria", "manifest.json"), "{}");
    return dossier;
}
const donnees = path.join(racine, ".Aria-Plume");

// Proposition.
const zip = fauxZip("Aria-Plume-0.40.0-win-x64", "v040");
const exeZip = path.join(zip, EXE);
const base = { execPath: exeZip, dossierDonnees: donnees, plateforme: "win32", empaquetee: true };
check("proposée depuis le zip décompressé", proposerInstallation(base));
check("pas avec --portable", !proposerInstallation({ ...base, argv: ["--portable"] }));
check("pas en arrière-plan (--silencieux, --hidden)", !proposerInstallation({ ...base, argv: ["--silencieux"] }) && !proposerInstallation({ ...base, argv: ["--hidden"] }));
check("pas pour le serveur MCP", !proposerInstallation({ ...base, argv: ["--mcp"] }));
check("pas si « Ne plus me proposer »", !proposerInstallation({ ...base, proposer: false }));
check("pas hors de Windows ni en développement", !proposerInstallation({ ...base, plateforme: "linux" }) && !proposerInstallation({ ...base, empaquetee: false }));
check("pas depuis programme\\", !proposerInstallation({ ...base, execPath: path.join(donnees, "programme", EXE) }));
check("programme.nouveau n'est pas programme\\", !estInstallee(path.join(donnees, "programme.nouveau", EXE), donnees));

// Zip lancé depuis l'aperçu de l'Explorateur : l'exe seul.
const seul = path.join(racine, "apercu");
fs.mkdirSync(seul);
fs.writeFileSync(path.join(seul, EXE), "v040");
check("exe seul : incomplet", !analyserSource(seul).complet, analyserSource(seul).manque.join(", "));
let refus = "";
try {
    await installer({ source: seul, dossierDonnees: donnees, nomExe: EXE, version: "0.40.0" });
} catch (error) {
    refus = error.message;
}
check("exe seul : refusé, avec « décompresse d'abord le zip »", refus.includes("décompresse d'abord le zip") && !fs.existsSync(path.join(donnees, "programme")), refus);

// Marque Internet sur l'exe du zip (flux Zone.Identifier, Windows seulement).
const windows = process.platform === "win32";
if (windows) {
    fs.writeFileSync(`${exeZip}:Zone.Identifier`, "[ZoneTransfer]\r\nZoneId=3\r\n");
}

// Première installation.
const premiere = await installer({ source: zip, dossierDonnees: donnees, nomExe: EXE, version: "0.40.0" });
check("exe installé dans programme\\", premiere.exe === path.join(donnees, "programme", EXE) && fs.readFileSync(premiere.exe, "utf8") === "v040");
check("dossier complet copié", analyserSource(path.join(donnees, "programme")).complet && fs.existsSync(path.join(donnees, "programme", "ffmpeg.dll")));
check("version notée", versionInstallee(donnees) === "0.40.0");
check("pas de version précédente", premiere.precedente === null);
check("zip d'origine laissé en place", fs.existsSync(exeZip));
if (windows) {
    let marque = true;
    try {
        fs.readFileSync(`${premiere.exe}:Zone.Identifier`);
    } catch {
        marque = false;
    }
    check("marque Internet retirée de la copie", !marque);
    check("marque Internet gardée sur le zip d'origine", fs.readFileSync(`${exeZip}:Zone.Identifier`, "utf8").includes("ZoneId=3"));
} else {
    console.log("(marque Internet : vérifiée sous Windows seulement)");
}

// Deuxième installation : la 0.40.0 passe de côté.
const zip2 = fauxZip("Aria-Plume-0.41.0-win-x64", "v041");
const seconde = await installer({ source: zip2, dossierDonnees: donnees, nomExe: EXE, version: "0.41.0" });
check("nouvelle version en place", fs.readFileSync(seconde.exe, "utf8") === "v041" && versionInstallee(donnees) === "0.41.0");
check("précédente gardée dans sauvegardes\\versions\\0.40.0", seconde.precedente === path.join(donnees, "sauvegardes", "versions", "0.40.0") && fs.readFileSync(path.join(seconde.precedente, EXE), "utf8") === "v040");
check("pas de programme.nouveau laissé", !fs.existsSync(path.join(donnees, "programme.nouveau")));

// Troisième : seule la précédente est gardée.
const zip3 = fauxZip("Aria-Plume-0.42.0-win-x64", "v042");
await installer({ source: zip3, dossierDonnees: donnees, nomExe: EXE, version: "0.42.0" });
const gardees = fs.readdirSync(path.join(donnees, "sauvegardes", "versions"));
check("une seule version précédente gardée", gardees.length === 1 && gardees[0] === "0.41.0", gardees.join(", "));

// Installer depuis programme\ lui-même : refusé.
refus = "";
try {
    await installer({ source: path.join(donnees, "programme"), dossierDonnees: donnees, nomExe: EXE, version: "0.42.0" });
} catch (error) {
    refus = error.message;
}
check("installer depuis programme\\ : refusé", refus.includes("déjà"), refus);

// Journal.
const journal = JSON.parse(fs.readFileSync(path.join(donnees, "journal.json"), "utf8"));
check("trois installations au journal", journal.filter((entree) => entree.operation === "installation").length === 3);

fs.rmSync(racine, { recursive: true, force: true });
console.log(echecs ? `${echecs} échec(s)` : "tout est bon");
process.exit(echecs ? 1 : 0);
