// Jeton du pont protégé par DPAPI (secrets.js) : création, reprise de l'ancien fichier en clair,
// chiffrement (sous Windows, avec le vrai DPAPI), et relecture par le relais. Sans Electron.
//     node tests/secrets.mjs [exe d'Aria Plume pour lancer le relais en mode Node]
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENTROPIE, SCRIPT_OUVRIR, fichierJeton, lireOuCreerJeton, ouvrir, proteger, retirerAncien } from "../secrets.js";

let echecs = 0;
const check = (label, ok, detail = "") => {
    console.log(`${ok ? "OK   " : "ÉCHEC"} ${label}${detail ? ` : ${detail}` : ""}`);
    echecs += ok ? 0 : 1;
};
const HERE = path.dirname(fileURLToPath(import.meta.url));
const windows = process.platform === "win32";
const racine = fs.mkdtempSync(path.join(os.tmpdir(), "aria-secrets-"));
const dossier = (nom) => path.join(racine, nom);
const JETON = /^[0-9a-f]{64}$/;

// Faux DPAPI : « chiffrement » reconnaissable, pour tester le déroulé sans PowerShell.
const faux = async (script, env) => {
    if (script.includes("Protect(")) {
        return { ok: true, output: Buffer.from(`FAUX:${env.ARIA_SECRET}`).toString("base64") };
    }
    const clair = Buffer.from(env.ARIA_SECRET, "base64").toString("utf8");
    return clair.startsWith("FAUX:") ? { ok: true, output: clair.slice(5) } : { ok: false, output: "", error: "blob invalide" };
};

// Hors Windows : jeton en clair dans secrets\pont.jeton, stable, privé.
{
    const d = dossier("linux");
    const a = await lireOuCreerJeton({ dossierDonnees: d, plateforme: "linux" });
    const b = await lireOuCreerJeton({ dossierDonnees: d, plateforme: "linux" });
    check("hors Windows : jeton créé dans secrets\\pont.jeton", JETON.test(a.token) && fs.existsSync(fichierJeton(d)));
    check("hors Windows : stable d'un lancement à l'autre", a.token === b.token);
    if (!windows) {
        check("hors Windows : lisible par l'utilisateur seul", (fs.statSync(fichierJeton(d)).mode & 0o077) === 0);
    }
}

// Reprise de l'ancien fichier en clair (pont\jeton).
{
    const d = dossier("reprise");
    const ancien = path.join(d, "pont", "jeton");
    fs.mkdirSync(path.dirname(ancien), { recursive: true });
    const clair = "ab".repeat(32);
    fs.writeFileSync(ancien, `${clair}\n`);
    const r = await lireOuCreerJeton({ dossierDonnees: d, ancienFichier: ancien, plateforme: "win32", run: faux });
    const contenu = fs.readFileSync(fichierJeton(d), "utf8");
    check("reprise : même jeton, l'extension n'a rien à refaire", r.token === clair);
    check("reprise : le fichier ne contient plus le jeton en clair", !contenu.includes(clair) && !JETON.test(contenu.trim()));
    check("reprise : l'ancien fichier est signalé, pas encore retiré", r.ancien === ancien && fs.existsSync(ancien));
    check("relecture : le jeton chiffré redonne le même", (await lireOuCreerJeton({ dossierDonnees: d, ancienFichier: ancien, plateforme: "win32", run: faux })).token === clair);
    check("retirerAncien : l'ancien fichier en clair disparaît", retirerAncien(ancien, d) && !fs.existsSync(ancien));
    const journal = fs.readFileSync(path.join(d, "journal.json"), "utf8");
    check("journal : l'opération sans le jeton", journal.includes("secrets") && !journal.includes(clair));
}

// Fichier écrit en clair dans secrets\ : protégé sur place.
{
    const d = dossier("sur-place");
    const clair = "cd".repeat(32);
    fs.mkdirSync(path.dirname(fichierJeton(d)), { recursive: true });
    fs.writeFileSync(fichierJeton(d), `${clair}\n`);
    const r = await lireOuCreerJeton({ dossierDonnees: d, plateforme: "win32", run: faux });
    check("en clair dans secrets\\ : protégé sur place", r.token === clair && !fs.readFileSync(fichierJeton(d), "utf8").includes(clair));
}

// Fichier illisible : erreur claire, rien d'écrasé.
{
    const d = dossier("abime");
    fs.mkdirSync(path.dirname(fichierJeton(d)), { recursive: true });
    fs.writeFileSync(fichierJeton(d), "pasunblob\n");
    let message = "";
    try {
        await lireOuCreerJeton({ dossierDonnees: d, plateforme: "win32", run: faux });
    } catch (error) {
        message = error.message;
    }
    check("fichier illisible : refusé, pas écrasé", message.includes("DPAPI") && fs.readFileSync(fichierJeton(d), "utf8").trim() === "pasunblob", message);
}

// Le relais fait la même commande que l'application.
const relaisTexte = fs.readFileSync(path.join(HERE, "..", "bridge", "relay.cjs"), "utf8");
check("relais : même script de déchiffrement que secrets.js", relaisTexte.includes(SCRIPT_OUVRIR));
check("relais : même entropie que secrets.js", relaisTexte.includes(`DPAPI_ENTROPY = "${ENTROPIE}"`));

if (!windows) {
    console.log("(DPAPI et relais : vérifiés sous Windows seulement)");
} else {
    // Vrai DPAPI.
    const clair = "ef".repeat(32);
    const blob = await proteger(clair);
    check("DPAPI : le texte chiffré n'est pas le jeton", blob !== clair && !blob.includes(clair), `${blob.length} caractères`);
    check("DPAPI : aller-retour", (await ouvrir(blob)) === clair);
    check("DPAPI : deux chiffrements du même jeton diffèrent", (await proteger(clair)) !== blob);
    let refus = false;
    try {
        await ouvrir(Buffer.from("n'importe quoi").toString("base64"));
    } catch {
        refus = true;
    }
    check("DPAPI : un blob étranger est refusé", refus);

    // Relais lancé comme par le navigateur (node, ou l'exe d'Aria Plume en mode Node), jeton chiffré.
    const d = dossier("relais");
    const { token } = await lireOuCreerJeton({ dossierDonnees: d });
    const contenu = fs.readFileSync(fichierJeton(d), "utf8");
    check("vrai DPAPI : fichier chiffré, jeton relu", JETON.test(token) && !contenu.includes(token));
    const pont = path.join(d, "pont");
    fs.mkdirSync(pont, { recursive: true });
    fs.copyFileSync(path.join(HERE, "..", "bridge", "relay.cjs"), path.join(pont, "relay.cjs"));
    const pipe = `\\\\.\\pipe\\aria-test-secrets-${process.pid}`;
    fs.writeFileSync(path.join(pont, "relay-config.json"), JSON.stringify({ pipe, tokenFile: fichierJeton(d), tokenDpapi: true, app: null }));
    async function relais(commande, args, env) {
        let recu = null;
        const serveur = net.createServer((socket) => {
            socket.setEncoding("utf8");
            let tampon = "";
            socket.on("data", (texte) => {
                tampon += texte;
                if (recu === null && tampon.includes("\n")) {
                    recu = JSON.parse(tampon.split("\n")[0]);
                    socket.end();
                }
            });
        });
        await new Promise((resolve) => serveur.listen(pipe, resolve));
        const t0 = Date.now();
        const enfant = spawn(commande, args, { env: { ...process.env, ...env }, stdio: ["pipe", "ignore", "ignore"] });
        const fin = Date.now() + 30000;
        while (recu === null && Date.now() < fin) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        const duree = Date.now() - t0;
        enfant.kill();
        await new Promise((resolve) => serveur.close(resolve));
        return { recu, duree };
    }
    const viaNode = await relais(process.execPath, [path.join(pont, "relay.cjs")], {});
    check("relais (node) : lit le jeton chiffré et le présente au pont", viaNode.recu?.cmd === "hello" && viaNode.recu?.token === token, `${viaNode.duree} ms`);
    const exe = process.argv[2];
    if (exe && fs.existsSync(exe)) {
        const viaExe = await relais(exe, [path.join(pont, "relay.cjs")], { ELECTRON_RUN_AS_NODE: "1" });
        check("relais (exe d'Aria Plume en mode Node) : lit le jeton chiffré", viaExe.recu?.cmd === "hello" && viaExe.recu?.token === token, `${viaExe.duree} ms`);
    } else {
        console.log("(relais lancé par l'exe d'Aria Plume : donne son chemin en argument pour le vérifier)");
    }
}

fs.rmSync(racine, { recursive: true, force: true });
console.log(echecs ? `${echecs} échec(s)` : "tout est bon");
process.exit(echecs ? 1 : 0);
