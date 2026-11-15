// Empaquetage : chaque module chargé par l'application (depuis main.js, en suivant les import et
// require relatifs) est bien dans la liste « build.files » de package.json. Un module oublié ne se
// voit qu'au lancement de l'exe compilé, qui ne démarre plus. Sans Electron.
//     node tests/empaquetage.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = JSON.parse(fs.readFileSync(path.join(APP, "package.json"), "utf8")).build.files;

// Motifs d'electron-builder utilisés ici : « dossier/** », « dossier/*.ext » et noms exacts.
const couvert = (relatif) => files.some((motif) => {
    if (motif.endsWith("/**")) {
        return relatif.startsWith(motif.slice(0, -2));
    }
    if (motif.includes("*")) {
        return new RegExp(`^${motif.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")}$`).test(relatif);
    }
    return motif === relatif;
});

const vus = new Set();
const absents = [];
const aVoir = ["main.js"];
while (aVoir.length) {
    const relatif = aVoir.pop();
    if (vus.has(relatif)) {
        continue;
    }
    vus.add(relatif);
    if (!couvert(relatif)) {
        absents.push(relatif);
    }
    const source = fs.readFileSync(path.join(APP, relatif), "utf8");
    for (const [, cible] of source.matchAll(/(?:\bimport\s*\(|\bfrom\s+|\brequire\()\s*["'](\.{1,2}\/[^"']+)["']/g)) {
        const suivant = path.posix.normalize(path.posix.join(path.posix.dirname(relatif), cible));
        if (/\.(m?js|cjs)$/.test(suivant) && fs.existsSync(path.join(APP, suivant))) {
            aVoir.push(suivant);
        }
    }
}

console.log(`${vus.size} modules suivis depuis main.js.`);
if (absents.length) {
    console.log(`ÉCHEC modules absents de build.files (l'exe compilé ne démarrerait pas) : ${absents.join(", ")}`);
    process.exit(1);
}
console.log("tout est bon");
