// L'application empaquetée lancée depuis un dossier avec accents et espaces, comme le dossier
// temporaire où se décompresse l'exe portable chez un utilisateur « Jérémy Zémani ». Tout le test
// de fumée y passe (correction anglaise et traduction comprises : les deux attendaient sans fin
// avant la 0.36).
//     cd app && npm run test:package   (lancé à la suite, après la construction)
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const built = path.join(APP_DIR, "dist", "linux-unpacked");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "aria-accents-"));
const target = path.join(root, "Jérémy Zémani", "AppData", "Local", "Temp", "2k9x Aria Plume");
fs.cpSync(built, target, { recursive: true, verbatimSymlinks: true });
console.log(`Application copiée dans « ${target} »`);
// Linux : une langue UTF-8 est nécessaire pour un chemin accentué (sous Windows, les chemins sont
// toujours en Unicode).
const result = spawnSync(process.execPath, [path.join(APP_DIR, "tests", "smoke.mjs")], {
    stdio: "inherit",
    env: { ...process.env, APP_BINARY: path.join(target, "aria-plume"), LANG: "C.UTF-8", LC_ALL: "C.UTF-8" },
});
fs.rmSync(root, { recursive: true, force: true });
process.exitCode = result.status ?? 1;
