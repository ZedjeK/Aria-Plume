// Jeton du pont de bout en bout sur l'application Windows compilée : un ancien dossier de données
// (jeton en clair dans pont\jeton, d'avant la 0.40) est repris au démarrage, chiffré par DPAPI dans
// secrets\pont.jeton, et l'ancien fichier est retiré. Aucun relais n'est inscrit (pas de manifeste),
// donc rien n'est écrit dans le registre. Dossier de travail isolé.
// Windows seulement :
//     npx electron-builder --win dir --x64 --publish never
//     node tests/jeton-windows.mjs dist/win-unpacked <dossier de travail vide>
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [unpacked, travail] = process.argv.slice(2).map((arg) => path.resolve(arg));
const EXE = "Aria Plume.exe";
if (!unpacked || !travail || !fs.existsSync(path.join(unpacked, EXE))) {
    console.error("Usage : node tests/jeton-windows.mjs <dossier win-unpacked> <dossier de travail vide>");
    process.exit(2);
}
if (fs.existsSync(travail) && fs.readdirSync(travail).length && !fs.existsSync(path.join(travail, "donnees"))) {
    console.error(`${travail} n'est pas vide et ne vient pas de ce test : rien n'est supprimé.`);
    process.exit(2);
}
let echecs = 0;
const check = (label, ok, detail = "") => {
    console.log(`${ok ? "OK   " : "ÉCHEC"} ${label}${detail ? ` : ${detail}` : ""}`);
    echecs += ok ? 0 : 1;
};
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

fs.rmSync(travail, { recursive: true, force: true });
const donnees = path.join(travail, "donnees", ".Aria-Plume");
const ancien = path.join(donnees, "pont", "jeton");
const clair = "9f".repeat(32);
fs.mkdirSync(path.dirname(ancien), { recursive: true });
fs.writeFileSync(ancien, `${clair}\n`);

const env = { ...process.env, ARIA_TEST_HOOKS: "1", ARIA_TEST_SETTINGS_DIR: donnees, ARIA_TEST_PIPE: "\\\\.\\pipe\\aria-plume-e2e-jeton", ARIA_TEST_OFFICE_PORT: "47996" };
const appli = spawn(path.join(unpacked, EXE), ["--silencieux"], { env, stdio: "ignore", detached: true });
appli.unref();

const secret = path.join(donnees, "secrets", "pont.jeton");
const fin = Date.now() + 60000;
while (Date.now() < fin && (!fs.existsSync(secret) || fs.existsSync(ancien))) {
    await attendre(500);
}
const contenu = fs.existsSync(secret) ? fs.readFileSync(secret, "utf8").trim() : "";
check("jeton repris dans secrets\\pont.jeton", contenu.length > 0);
check("fichier chiffré : le jeton n'y est pas", contenu.length > 64 && !contenu.includes(clair), `${contenu.length} caractères`);
check("ancien fichier en clair retiré", !fs.existsSync(ancien));
const journal = fs.existsSync(path.join(donnees, "journal.json")) ? fs.readFileSync(path.join(donnees, "journal.json"), "utf8") : "";
check("journal : opération notée, jeton absent", journal.includes("secrets") && !journal.includes(clair));
const tout = (dossier) => fs.readdirSync(dossier, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => path.join(e.parentPath ?? e.path, e.name));
const fuites = tout(donnees).filter((f) => { try { return fs.readFileSync(f, "latin1").includes(clair); } catch { return false; } });
check("le jeton n'apparaît en clair nulle part dans le dossier de données", fuites.length === 0, fuites.join(", "));

try {
    execFileSync("powershell", ["-NoProfile", "-Command",
        `Get-CimInstance Win32_Process -Filter "Name = '${EXE}'" | Where-Object { $_.ExecutablePath -like '${travail.replace(/'/g, "''")}*' -or $_.ExecutablePath -like '${unpacked.replace(/'/g, "''")}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`]);
} catch {
    // déjà arrêtée
}
console.log(echecs ? `${echecs} échec(s)` : "tout est bon");
process.exit(echecs ? 1 : 0);
