// Installation par l'exe, de bout en bout, sur l'application Windows compilée : lancement depuis un
// « zip décompressé » marqué comme téléchargé, clic sur « Installer » (raccourci coché) par le
// protocole de débogage de Chromium, copie dans programme\, relance depuis là. Tout se passe dans un
// dossier de travail isolé (données, Bureau, canal du pont et port Office de test) : rien chez toi.
// Windows seulement, à lancer avant une release (la CI tourne sous Linux) :
//     npx electron-builder --win dir --x64 --publish never
//     node tests/installation-windows.mjs dist/win-unpacked <dossier de travail vide> [--sans-raccourci]
// Le dossier de travail est vidé puis rempli : donne un dossier à toi, jamais un dossier qui compte.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [unpacked, travail] = process.argv.slice(2).filter((arg) => !arg.startsWith("--")).map((arg) => path.resolve(arg));
if (!unpacked || !travail || !fs.existsSync(path.join(unpacked ?? "", "Aria Plume.exe"))) {
    console.error("Usage : node tests/installation-windows.mjs <dossier win-unpacked> <dossier de travail vide>");
    process.exit(2);
}
if (fs.existsSync(travail) && fs.readdirSync(travail).length && !fs.existsSync(path.join(travail, "Telechargements"))) {
    console.error(`${travail} n'est pas vide et ne vient pas de ce test : rien n'est supprimé.`);
    process.exit(2);
}
const avecRaccourci = !process.argv.includes("--sans-raccourci");
const EXE = "Aria Plume.exe";
const PORT = 9345;
let echecs = 0;
const check = (label, ok, detail = "") => {
    console.log(`${ok ? "OK   " : "ÉCHEC"} ${label}${detail ? ` : ${detail}` : ""}`);
    echecs += ok ? 0 : 1;
};
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

fs.rmSync(travail, { recursive: true, force: true });
const zip = path.join(travail, "Telechargements", "Aria-Plume-test-win-x64");
const donnees = path.join(travail, "donnees", ".Aria-Plume");
const bureau = path.join(travail, "Bureau");
fs.mkdirSync(bureau, { recursive: true });
fs.cpSync(unpacked, zip, { recursive: true });
// Marque « téléchargé depuis Internet » sur l'exe du zip, comme après un vrai téléchargement.
fs.writeFileSync(`${path.join(zip, EXE)}:Zone.Identifier`, "[ZoneTransfer]\r\nZoneId=3\r\n");

const env = {
    ...process.env,
    ARIA_TEST_HOOKS: "1",
    ARIA_TEST_SETTINGS_DIR: donnees,
    ARIA_TEST_DESKTOP_DIR: bureau,
    ARIA_TEST_PIPE: "\\\\.\\pipe\\aria-plume-e2e-installation",
    ARIA_TEST_OFFICE_PORT: "47998",
};
const proc = spawn(path.join(zip, EXE), [`--remote-debugging-port=${PORT}`], { env, stdio: "ignore", detached: true });
proc.unref();

async function cible(motif, delai = 30000) {
    const fin = Date.now() + delai;
    while (Date.now() < fin) {
        try {
            const pages = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
            const page = pages.find((p) => p.url.includes(motif));
            if (page) {
                return page;
            }
        } catch {
            // pas encore prêt
        }
        await attendre(300);
    }
    return null;
}

function evaluer(ws, expression) {
    return new Promise((resolve) => {
        const id = Math.floor(Math.random() * 1e9);
        const ecoute = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.id === id) {
                ws.removeEventListener("message", ecoute);
                resolve(msg.result?.result?.value);
            }
        };
        ws.addEventListener("message", ecoute);
        ws.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }));
    });
}

const page = await cible("installation.html");
check("fenêtre d'installation ouverte au lancement depuis le zip", !!page, page?.url);
if (!page) {
    process.exit(1);
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
await attendre(1000);
const vue = await evaluer(ws, `({
    titre: document.querySelector("h1").textContent,
    destination: document.getElementById("destination").textContent,
    precedente: document.getElementById("precedente").textContent,
    raccourci: document.getElementById("raccourci").checked,
    installer: !document.getElementById("installer").disabled,
    etat: document.getElementById("etat").textContent,
    police: getComputedStyle(document.body).fontFamily,
})`);
console.log(vue);
check("destination : programme\\ du dossier de données", vue?.destination === path.join(donnees, "programme"), vue?.destination);
check("raccourci décoché d'office", vue?.raccourci === false);
check("bouton Installer actif (zip complet)", vue?.installer === true, vue?.etat);

if (avecRaccourci) {
    await evaluer(ws, `document.getElementById("raccourci").click()`);
}
await evaluer(ws, `document.getElementById("installer").click(), true`);

// Copie, fermeture de la fenêtre, relance depuis programme\.
const exeInstalle = path.join(donnees, "programme", EXE);
let relance = null;
const fin = Date.now() + 90000;
while (Date.now() < fin && !relance) {
    await attendre(1000);
    if (ws.readyState === WebSocket.OPEN) {
        const message = await Promise.race([evaluer(ws, `document.getElementById("etat").textContent`), attendre(500).then(() => null)]);
        if (message?.startsWith("Installation impossible")) {
            check("installation sans erreur", false, message);
            break;
        }
    }
    try {
        const sortie = execFileSync("powershell", ["-NoProfile", "-Command",
            `Get-CimInstance Win32_Process -Filter "Name = '${EXE}'" | Where-Object { $_.CommandLine -notmatch '--type=' } | ForEach-Object { "$($_.ProcessId)|$($_.ExecutablePath)" }`]).toString().trim();
        relance = sortie.split(/\r?\n/).filter(Boolean).map((l) => l.split("|")).find(([, chemin]) => chemin?.toLowerCase() === exeInstalle.toLowerCase()) ?? null;
    } catch {
        // relevé suivant
    }
}
check("exe installé dans programme\\", fs.existsSync(exeInstalle));
check("application relancée depuis programme\\", !!relance, relance?.join(" "));
let marque = true;
try {
    fs.readFileSync(`${exeInstalle}:Zone.Identifier`);
} catch {
    marque = false;
}
check("marque Internet retirée de l'exe installé", !marque);
check("version notée", fs.existsSync(path.join(donnees, "programme", "version.txt")), fs.existsSync(path.join(donnees, "programme", "version.txt")) ? fs.readFileSync(path.join(donnees, "programme", "version.txt"), "utf8").trim() : "");
check(avecRaccourci ? "raccourci créé sur le Bureau" : "pas de raccourci (case décochée)", fs.existsSync(path.join(bureau, "Aria Plume.lnk")) === avecRaccourci);
const journal = fs.existsSync(path.join(donnees, "journal.json")) ? JSON.parse(fs.readFileSync(path.join(donnees, "journal.json"), "utf8")) : [];
check("installation au journal", journal.some((e) => e.operation === "installation"), journal.map((e) => e.operation).join(", "));
check("zip d'origine intact", fs.existsSync(path.join(zip, EXE)));

// Relancée depuis programme\ : plus de proposition.
await attendre(4000);
const encore = await cible("installation.html", 3000);
check("pas de nouvelle proposition une fois installée", !encore);
const principale = await cible("popup.html", 15000);
check("fenêtre du correcteur ouverte après la relance", !!principale, principale?.url);

// Arrêt de toutes les instances de test.
try {
    execFileSync("powershell", ["-NoProfile", "-Command",
        `Get-CimInstance Win32_Process -Filter "Name = '${EXE}'" | Where-Object { $_.ExecutablePath -like '${travail.replace(/'/g, "''")}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`]);
} catch {
    // déjà arrêtées
}
ws.close();
console.log(echecs ? `${echecs} échec(s)` : "tout est bon");
process.exit(echecs ? 1 : 0);
