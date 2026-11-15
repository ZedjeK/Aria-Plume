// Mise à jour intégrée (miseajour.js) : adresses et redirections autorisées, lecture de l'empreinte,
// téléchargement vérifié par SHA-256 depuis un faux GitHub local, refus d'un fichier altéré ou d'une
// redirection ailleurs. Sans Electron.
//     node tests/miseajour.mjs
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { adresseAutorisee, lireEmpreinte, preparerMiseAJour, redirectionAutorisee } from "../miseajour.js";

let echecs = 0;
const check = (label, ok, detail = "") => {
    console.log(`${ok ? "OK   " : "ÉCHEC"} ${label}${detail ? ` : ${detail}` : ""}`);
    echecs += ok ? 0 : 1;
};
const EXE = "Aria Plume.exe";

// Adresses.
const GH = "https://github.com/ZedjeK/Aria-Plume/releases/download/";
check("adresse : fichier de la release attendue", adresseAutorisee(`${GH}v0.41.0/Aria-Plume-0.41.0-win-x64.zip`, "0.41.0"));
check("adresse : autre version refusée", !adresseAutorisee(`${GH}v0.40.0/Aria-Plume-0.40.0-win-x64.zip`, "0.41.0"));
check("adresse : autre dépôt refusé", !adresseAutorisee("https://github.com/autre/Aria-Plume/releases/download/v0.41.0/x.zip", "0.41.0"));
check("adresse : HTTP refusé", !adresseAutorisee(`${GH.replace("https", "http")}v0.41.0/x.zip`, "0.41.0"));
check("adresse : « .. » refusé", !adresseAutorisee(`${GH}v0.41.0/../v0.1.0/x.zip`, "0.41.0"));
check("adresse : serveur local seulement en test", adresseAutorisee("http://127.0.0.1:8080/x.zip", "0.41.0", { test: true }) && !adresseAutorisee("http://127.0.0.1:8080/x.zip", "0.41.0"));
check("redirection : stockage des releases de GitHub", redirectionAutorisee("https://release-assets.githubusercontent.com/github-production-release-asset/1/abc?x=1"));
check("redirection : autre hôte refusé", !redirectionAutorisee("https://exemple.org/x.zip") && !redirectionAutorisee("https://release-assets.githubusercontent.com.exemple.org/x"));
check("redirection : HTTP refusé", !redirectionAutorisee("http://release-assets.githubusercontent.com/x"));

// Empreinte.
const hex = "a".repeat(64);
check("empreinte : format sha256sum", lireEmpreinte(`${hex}  Aria-Plume-0.41.0-win-x64.zip\n`, "Aria-Plume-0.41.0-win-x64.zip") === hex);
check("empreinte : autre nom ignoré", lireEmpreinte(`${hex}  autre.zip\n`, "Aria-Plume-0.41.0-win-x64.zip") === null);
check("empreinte : texte quelconque", lireEmpreinte("<html>", "x.zip") === null);

// Faux GitHub : /download/<fichier> redirige vers /assets/<fichier> (comme release-assets).
const racine = fs.mkdtempSync(path.join(os.tmpdir(), "aria-miseajour-"));
const zipNom = "Aria-Plume-9.9.9-win-x64.zip";
const contenu = Buffer.from("faux zip de test ".repeat(5000));
let fichiers = { [zipNom]: contenu, [`${zipNom}.sha256`]: Buffer.from(`${crypto.createHash("sha256").update(contenu).digest("hex")}  ${zipNom}\n`) };
let redirection = (port, nom) => `http://127.0.0.1:${port}/assets/${nom}`;
const serveur = http.createServer((req, res) => {
    const [, genre, nom] = decodeURIComponent(req.url).split("/");
    if (genre === "download") {
        res.writeHead(302, { location: redirection(serveur.address().port, nom) });
        res.end();
    } else if (genre === "assets" && fichiers[nom]) {
        res.writeHead(200, { "content-length": fichiers[nom].length });
        res.end(fichiers[nom]);
    } else {
        res.writeHead(404);
        res.end();
    }
});
await new Promise((resolve) => serveur.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${serveur.address().port}/download/`;
const zip = { name: zipNom, size: contenu.length, url: `${base}${zipNom}` };
const empreinte = { name: `${zipNom}.sha256`, url: `${base}${zipNom}.sha256` };

// Décompression simulée : une application complète (le vrai tar est essayé plus bas, sous Windows).
const fausseDecompression = async (fichier, dossier) => {
    fs.mkdirSync(path.join(dossier, "resources", "aria"), { recursive: true });
    fs.writeFileSync(path.join(dossier, EXE), "v999");
    fs.writeFileSync(path.join(dossier, "resources", "app.asar"), "asar");
    fs.writeFileSync(path.join(dossier, "resources", "aria", "manifest.json"), "{}");
};

const donnees = path.join(racine, ".Aria-Plume");
const etapes = [];
const prete = await preparerMiseAJour({ version: "9.9.9", zip, empreinte, dossierDonnees: donnees, nomExe: EXE, fetchImpl: fetch, test: true, decompresseur: fausseDecompression, onEtape: (e) => etapes.push(e.etape) });
check("téléchargée, vérifiée, décompressée", fs.readFileSync(prete.exe, "utf8") === "v999" && prete.application.startsWith(path.join(donnees, "mises-a-jour", "9.9.9")), prete.exe);
check("empreinte rendue", prete.sha256 === crypto.createHash("sha256").update(contenu).digest("hex"));
check("étapes annoncées", etapes[0] === "empreinte" && etapes.includes("telechargement") && etapes.at(-1) === "decompression", [...new Set(etapes)].join(", "));
check("zip retiré après décompression", !fs.existsSync(path.join(donnees, "mises-a-jour", "9.9.9", zipNom)));
const journal = JSON.parse(fs.readFileSync(path.join(donnees, "journal.json"), "utf8"));
check("au journal", journal.some((e) => e.operation === "mise à jour" && e.detail.includes("9.9.9")));

async function refus(options, label, attendu) {
    let message = "";
    try {
        await preparerMiseAJour({ version: "9.9.9", zip, empreinte, dossierDonnees: donnees, nomExe: EXE, fetchImpl: fetch, test: true, decompresseur: fausseDecompression, ...options });
    } catch (error) {
        message = error.message;
    }
    check(label, message.includes(attendu) && !fs.existsSync(path.join(donnees, "mises-a-jour", "9.9.9")), message);
}

// Fichier altéré : l'empreinte ne correspond plus.
fichiers[zipNom] = Buffer.concat([contenu, Buffer.from("!")]);
await refus({}, "fichier altéré : refusé, rien de gardé", "ne correspond pas à son empreinte");
fichiers[zipNom] = contenu;

// Empreinte d'un autre fichier.
const sauve = fichiers[`${zipNom}.sha256`];
fichiers[`${zipNom}.sha256`] = Buffer.from(`${hex}  autre.zip\n`);
await refus({}, "empreinte absente pour ce fichier : refusé", "introuvable");
fichiers[`${zipNom}.sha256`] = sauve;

// Redirection vers un autre hôte (localhost au lieu de 127.0.0.1).
redirection = (port, nom) => `http://localhost:${port}/assets/${nom}`;
await refus({}, "redirection ailleurs : refusée", "redirection refusée");
redirection = (port, nom) => `http://127.0.0.1:${port}/assets/${nom}`;

// Hors test, l'adresse locale est refusée d'emblée.
await refus({ test: false }, "serveur local hors test : refusé", "adresse de téléchargement refusée");

// Zip sans l'application.
await refus({ decompresseur: async () => {} }, "zip sans l'application : refusé", "ne contient pas l'application");

// Vrai tar de Windows sur un vrai zip.
if (process.platform === "win32") {
    const app = path.join(racine, "zip-source");
    await fausseDecompression(null, app);
    const vraiZip = path.join(racine, zipNom);
    const { execFileSync } = await import("node:child_process");
    execFileSync(path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe"), ["-a", "-c", "-f", vraiZip, "-C", app, "."]);
    const octets = fs.readFileSync(vraiZip);
    fichiers = { [zipNom]: octets, [`${zipNom}.sha256`]: Buffer.from(`${crypto.createHash("sha256").update(octets).digest("hex")}  ${zipNom}\n`) };
    const vraie = await preparerMiseAJour({ version: "9.9.9", zip: { ...zip, size: octets.length }, empreinte, dossierDonnees: donnees, nomExe: EXE, fetchImpl: fetch, test: true });
    check("vrai zip décompressé par le tar de Windows", fs.readFileSync(vraie.exe, "utf8") === "v999");
} else {
    console.log("(tar de Windows : vérifié sous Windows seulement)");
}

serveur.close();
fs.rmSync(racine, { recursive: true, force: true });
console.log(echecs ? `${echecs} échec(s)` : "tout est bon");
process.exit(echecs ? 1 : 0);
