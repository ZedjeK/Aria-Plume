// Mise à jour intégrée, de bout en bout, sur l'application Windows compilée : une application
// installée dans programme\ trouve une version 9.9.9 sur un faux GitHub local (redirection comme
// release-assets, empreinte .sha256), la télécharge, la vérifie, se ferme, et la nouvelle version
// s'installe puis redémarre depuis programme\. Tout se passe dans un dossier de travail isolé.
// Windows seulement, à lancer avant une release (la CI tourne sous Linux) :
//     npx electron-builder --win dir --x64 --publish never
//     node tests/miseajour-windows.mjs dist/win-unpacked <dossier de travail vide>
// Le dossier de travail est vidé puis rempli : donne un dossier à toi, jamais un dossier qui compte.
import { execFileSync, spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const [unpacked, travail] = process.argv.slice(2).filter((arg) => !arg.startsWith("--")).map((arg) => path.resolve(arg));
const EXE = "Aria Plume.exe";
if (!unpacked || !travail || !fs.existsSync(path.join(unpacked, EXE))) {
    console.error("Usage : node tests/miseajour-windows.mjs <dossier win-unpacked> <dossier de travail vide>");
    process.exit(2);
}
if (fs.existsSync(travail) && fs.readdirSync(travail).length && !fs.existsSync(path.join(travail, "faux-github"))) {
    console.error(`${travail} n'est pas vide et ne vient pas de ce test : rien n'est supprimé.`);
    process.exit(2);
}
const PORT = 9346;
let echecs = 0;
const check = (label, ok, detail = "") => {
    console.log(`${ok ? "OK   " : "ÉCHEC"} ${label}${detail ? ` : ${detail}` : ""}`);
    echecs += ok ? 0 : 1;
};
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const processus = () => {
    try {
        return execFileSync("powershell", ["-NoProfile", "-Command",
            `Get-CimInstance Win32_Process -Filter "Name = '${EXE}'" | Where-Object { $_.CommandLine -notmatch '--type=' } | ForEach-Object { "$($_.ProcessId)|$($_.ExecutablePath)|$($_.CommandLine)" }`])
            .toString().trim().split(/\r?\n/).filter(Boolean).map((l) => l.split("|"))
            .filter(([, chemin]) => chemin?.toLowerCase().startsWith(travail.toLowerCase()));
    } catch {
        return [];
    }
};

fs.rmSync(travail, { recursive: true, force: true });
const donnees = path.join(travail, "donnees", ".Aria-Plume");
const programme = path.join(donnees, "programme");
const github = path.join(travail, "faux-github");
fs.mkdirSync(github, { recursive: true });

// Application déjà installée (comme après « Installer »).
fs.cpSync(unpacked, programme, { recursive: true });
fs.writeFileSync(path.join(programme, "version.txt"), "0.39.0\n");
fs.writeFileSync(path.join(programme, "marque-ancienne-version.txt"), "ancienne");

// Release 9.9.9 : le zip de la même application et son empreinte.
const zipNom = "Aria-Plume-9.9.9-win-x64.zip";
const zip = path.join(github, zipNom);
execFileSync(path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe"), ["-a", "-c", "-f", zip, "-C", unpacked, "."]);
const empreinte = crypto.createHash("sha256").update(fs.readFileSync(zip)).digest("hex");
fs.writeFileSync(`${zip}.sha256`, `${empreinte}  ${zipNom}\n`);

const serveur = http.createServer((req, res) => {
    const port = serveur.address().port;
    const [, genre, nom] = decodeURIComponent(req.url).split("/");
    if (genre === "latest") {
        const asset = (n) => ({ name: n, size: fs.statSync(path.join(github, n)).size, browser_download_url: `http://127.0.0.1:${port}/download/${n}` });
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ tag_name: "v9.9.9", html_url: "https://github.com/ZedjeK/Aria-Plume/releases/tag/v9.9.9", published_at: "2026-11-15T00:00:00Z", body: "## Ce qui change\n- Test.", assets: [asset(zipNom), asset(`${zipNom}.sha256`)] }));
    } else if (genre === "download") {
        res.writeHead(302, { location: `http://127.0.0.1:${port}/assets/${nom}` });
        res.end();
    } else if (genre === "assets" && fs.existsSync(path.join(github, nom ?? ""))) {
        res.writeHead(200, { "content-length": fs.statSync(path.join(github, nom)).size });
        fs.createReadStream(path.join(github, nom)).pipe(res);
    } else {
        res.writeHead(404);
        res.end();
    }
});
await new Promise((r) => serveur.listen(0, "127.0.0.1", r));

const env = {
    ...process.env,
    ARIA_TEST_HOOKS: "1",
    ARIA_TEST_SETTINGS_DIR: donnees,
    ARIA_TEST_UPDATE_URL: `http://127.0.0.1:${serveur.address().port}/latest`,
    ARIA_TEST_PIPE: "\\\\.\\pipe\\aria-plume-e2e-miseajour",
    ARIA_TEST_OFFICE_PORT: "47997",
};
const ancienne = spawn(path.join(programme, EXE), [`--remote-debugging-port=${PORT}`], { env, stdio: "ignore", detached: true });
ancienne.unref();

async function cible(motif, delai = 30000) {
    const fin = Date.now() + delai;
    while (Date.now() < fin) {
        try {
            const page = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((p) => p.url.includes(motif));
            if (page) {
                return page;
            }
        } catch {
            // pas encore prête
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
                resolve(msg.result?.result?.value ?? msg.result?.exceptionDetails?.exception?.description);
            }
        };
        ws.addEventListener("message", ecoute);
        ws.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }));
    });
}

const page = await cible("popup.html");
check("application installée lancée, sans proposition d'installation", !!page && !(await cible("installation.html", 1000)), page?.url);
if (!page) {
    serveur.close();
    process.exit(1);
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
const verification = await evaluer(ws, "window.ariaApp.checkUpdate()");
check("9.9.9 disponible, zip et empreinte trouvés", verification?.status === "available" && verification?.asset?.url?.includes(zipNom) && verification?.checksum?.url?.endsWith(".sha256"), JSON.stringify({ status: verification?.status, latest: verification?.latest }));
const etat = await evaluer(ws, "window.ariaApp.updateState()");
check("sorte d'application : installée", etat?.kind === "installee", etat?.kind);
const debut = Date.now();
const resultat = await evaluer(ws, "window.ariaApp.installUpdate()");
check("mise à jour préparée (téléchargée, vérifiée, décompressée)", resultat?.ok === true, JSON.stringify(resultat));

// L'ancienne se ferme, la nouvelle s'installe, puis l'application redémarre depuis programme\.
let relancee = null;
const fin = Date.now() + 120000;
while (Date.now() < fin && !relancee) {
    await attendre(1000);
    const liste = processus();
    const ancienneVivante = liste.some(([pid]) => Number(pid) === ancienne.pid);
    relancee = !ancienneVivante && !fs.existsSync(path.join(programme, "marque-ancienne-version.txt"))
        ? liste.find(([, chemin, ligne]) => chemin.toLowerCase() === path.join(programme, EXE).toLowerCase() && !ligne.includes("--mettre-a-jour")) ?? null
        : null;
}
check("redémarrée depuis programme\\", !!relancee, relancee ? `pid ${relancee[0]} en ${Math.round((Date.now() - debut) / 1000)} s` : processus().map((p) => p[2]).join(" | "));
const precedente = path.join(donnees, "sauvegardes", "versions", "0.39.0");
check("version précédente gardée dans sauvegardes\\versions\\0.39.0", fs.existsSync(path.join(precedente, "marque-ancienne-version.txt")) && fs.existsSync(path.join(precedente, EXE)));
check("nouvelle version complète dans programme\\", fs.existsSync(path.join(programme, "resources", "app.asar")) && !fs.existsSync(path.join(programme, "marque-ancienne-version.txt")));
await attendre(5000);
check("dossier mises-a-jour\\ nettoyé après le redémarrage", !fs.existsSync(path.join(donnees, "mises-a-jour")));
const journal = fs.existsSync(path.join(donnees, "journal.json")) ? JSON.parse(fs.readFileSync(path.join(donnees, "journal.json"), "utf8")) : [];
check("journal : téléchargement vérifié puis installation", journal.some((e) => e.operation === "mise à jour" && e.detail.includes(empreinte.slice(0, 12))) && journal.some((e) => e.operation === "installation"), journal.map((e) => `${e.operation}: ${e.detail.slice(0, 50)}`).join(" / "));

for (const [pid] of processus()) {
    try {
        process.kill(Number(pid));
    } catch {
        // déjà partie
    }
}
ws.close();
serveur.close();
console.log(echecs ? `${echecs} échec(s)` : "tout est bon");
process.exit(echecs ? 1 : 0);
