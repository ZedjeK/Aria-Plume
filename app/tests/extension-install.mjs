// Test de la copie de l'extension (installation assistée) : première copie, copie déjà à jour,
// mise à jour qui retire les anciens fichiers d'Aria Plume sans toucher aux autres, refus d'un
// dossier qui n'est pas le nôtre, détection des navigateurs.
//     node tests/extension-install.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { extensionState, findBrowsers, syncExtension } from "../extension-install.js";

let failures = 0;
const check = (label, ok, detail = "") => {
    console.log(`${ok ? "OK   " : "ÉCHEC"} ${label}${detail ? ` : ${detail}` : ""}`);
    failures += ok ? 0 : 1;
};
const write = (file, text) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
};
const marker = (target) => JSON.parse(fs.readFileSync(path.join(target, ".aria-plume-copie.json"), "utf8"));

const root = fs.mkdtempSync(path.join(os.tmpdir(), "aria-ext-"));
const source = path.join(root, "source");
const target = path.join(root, "Aria Plume - extension");
write(path.join(source, "manifest.json"), JSON.stringify({ name: "Aria Plume", version: "1.0.0" }));
write(path.join(source, "background.js"), "// v1");
write(path.join(source, "core", "ancien.js"), "// disparaîtra en 1.1");
write(path.join(source, "models", "fren", "model.bin"), "x".repeat(1000));

check("état avant copie", extensionState({ source, target }).copied === null);
const first = await syncExtension({ source, target });
check("première copie", first.updated && first.copied === "1.0.0" && fs.readFileSync(path.join(target, "models", "fren", "model.bin"), "utf8").length === 1000);
check("témoin : version et fichiers", marker(target).version === "1.0.0" && marker(target).files.includes("core/ancien.js"), marker(target).files.join(", "));
const again = await syncExtension({ source, target });
check("déjà à jour : pas de copie", again.updated === false && again.copied === "1.0.0");

// Version 1.1 : un fichier disparaît, un autre change ; l'utilisateur a posé un fichier à lui.
write(path.join(source, "manifest.json"), JSON.stringify({ name: "Aria Plume", version: "1.1.0" }));
write(path.join(source, "background.js"), "// v1.1");
fs.rmSync(path.join(source, "core", "ancien.js"));
write(path.join(source, "core", "nouveau.js"), "// nouveau");
write(path.join(target, "mes-notes.txt"), "à moi");
check("mise à jour détectée", extensionState({ source, target }).copied === "1.0.0" && extensionState({ source, target }).version === "1.1.0");
const update = await syncExtension({ source, target });
check("mise à jour copiée", update.updated && fs.readFileSync(path.join(target, "background.js"), "utf8") === "// v1.1" && fs.existsSync(path.join(target, "core", "nouveau.js")));
check("ancien fichier d'Aria Plume retiré", !fs.existsSync(path.join(target, "core", "ancien.js")));
check("fichier de l'utilisateur gardé", fs.existsSync(path.join(target, "mes-notes.txt")));

// Copie interrompue (pas de témoin) mais manifeste d'Aria Plume : on reprend.
fs.rmSync(path.join(target, ".aria-plume-copie.json"));
check("copie interrompue : à refaire", extensionState({ source, target }).copied === null);
check("copie interrompue : reprise", (await syncExtension({ source, target })).updated === true);

// Un dossier du même nom qui n'est pas à nous : refus, rien n'est touché.
const foreign = path.join(root, "autre");
write(path.join(foreign, "photo.jpg"), "photo");
let refused = null;
try {
    await syncExtension({ source, target: foreign });
} catch (error) {
    refused = error.message;
}
check("dossier étranger refusé", /ne contient pas Aria Plume/.test(refused ?? "") && fs.readdirSync(foreign).join() === "photo.jpg", refused ?? "accepté");

// Détection : rien hors Windows, rien sans dossiers, liste de test sous ARIA_TEST_HOOKS.
check("navigateurs : rien hors Windows", findBrowsers({}, "linux").length === 0);
check("navigateurs : rien d'installé", findBrowsers({ LOCALAPPDATA: path.join(root, "vide") }, "win32").length === 0);
const fake = findBrowsers({ ARIA_TEST_HOOKS: "1", ARIA_TEST_BROWSERS: JSON.stringify([{ id: "gx", name: "Opera GX", scheme: "opera", exe: "x" }]) }, "win32");
check("navigateurs : adresse de la page d'extensions", fake[0]?.url === "opera://extensions", JSON.stringify(fake));

fs.rmSync(root, { recursive: true, force: true });
console.log(failures ? `\n${failures} échec(s)` : "\ntout est bon");
process.exitCode = failures ? 1 : 0;
