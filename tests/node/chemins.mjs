// Le moteur installé dans un dossier « difficile » : accents et espaces, comme
// C:\Users\Héléna Bérani\AppData\Local\Temp\… où se décompresse l'exe portable.
// Avant la 0.36, la traduction y attendait sans fin (Bergamot lisait son WebAssembly avec un
// chemin encodé). Vérifie aussi qu'un moteur de traduction cassé donne vite une erreur en
// français, puis repart une fois réparé.
//     node tests/node/chemins.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SOURCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../extension");
let failures = 0;
const check = (label, ok, detail = "") => {
    console.log(`${ok ? "OK   " : "ÉCHEC"} ${label}${detail ? ` : ${detail}` : ""}`);
    failures += ok ? 0 : 1;
};
// Une promesse qui ne se termine pas compte comme un échec (au lieu de bloquer le test).
function within(promise, ms) {
    let timer;
    return Promise.race([
        promise.then((value) => ({ value }), (error) => ({ error })),
        new Promise((resolve) => {
            timer = setTimeout(() => resolve({ timeout: true }), ms);
        }),
    ]).finally(() => clearTimeout(timer));
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "aria-chemins-"));
const target = path.join(root, "Users", "Héléna Bérani", "AppData", "Local", "Temp", "2k9x Aria Plume", "resources", "aria");
for (const folder of ["core", "engines", "models", "data"]) {
    fs.cpSync(path.join(SOURCE, folder), path.join(target, folder), { recursive: true });
}
const { createAria } = await import(pathToFileURL(path.join(target, "core", "index.js")).href);
const { nodePlatform } = await import(pathToFileURL(path.join(target, "core", "platform", "node.js")).href);
const aria = createAria(nodePlatform);

try {
    const check1 = await within(aria.check({ text: "Il à fini.", lang: "fr" }), 30000);
    check("correction française depuis « Héléna Bérani »", check1.value?.matches?.length === 1, check1.error?.message ?? "");
    const check2 = await within(aria.check({ text: "Your welcome, I would rather walk then drive.", lang: "en" }), 30000);
    const enWords = (check2.value?.matches ?? []).map((m) => "Your welcome, I would rather walk then drive.".slice(m.start, m.end));
    check("correction anglaise depuis « Héléna Bérani »", enWords.includes("Your") && enWords.includes("then"), check2.timeout ? "BLOQUÉE" : enWords.join(", ") || check2.error?.message || "aucune faute trouvée");
    const fr = await within(aria.translate({ text: "Le serveur est tombé en panne.", from: "fr", to: "en" }), 30000);
    check("traduction FR → EN depuis « Héléna Bérani »", /server|waiter/i.test(fr.value?.text ?? ""), fr.timeout ? "BLOQUÉE" : fr.value?.text ?? fr.error?.message);
    const en = await within(aria.translate({ text: "Hello everyone.", from: "en", to: "fr" }), 30000);
    check("traduction EN → FR depuis « Héléna Bérani »", /Bonjour/i.test(en.value?.text ?? ""), en.timeout ? "BLOQUÉE" : en.value?.text ?? en.error?.message);
} finally {
    await aria.close();
}

// Moteur de traduction cassé (WebAssembly absent) : erreur rapide, puis redémarrage une fois réparé.
const wasm = path.join(target, "engines", "bergamot", "worker", "bergamot-translator-worker.wasm");
fs.renameSync(wasm, `${wasm}.retire`);
const broken = createAria(nodePlatform);
try {
    const started = Date.now();
    const failed = await within(broken.translate({ text: "Bonjour.", from: "fr", to: "en" }), 20000);
    check("moteur de traduction cassé : erreur rapide, pas d'attente sans fin", !failed.timeout && !!failed.error && Date.now() - started < 15000, failed.timeout ? "BLOQUÉE" : `${Date.now() - started} ms`);
    check("moteur de traduction cassé : message en français", /moteur de traduction s'est arrêté/.test(failed.error?.message ?? ""), failed.error?.message);
    fs.renameSync(`${wasm}.retire`, wasm);
    const repaired = await within(broken.translate({ text: "Bonjour.", from: "fr", to: "en" }), 30000);
    check("moteur réparé : la demande suivante redémarre la traduction", /Hello|Good/i.test(repaired.value?.text ?? ""), repaired.timeout ? "BLOQUÉE" : repaired.value?.text ?? repaired.error?.message);
} finally {
    if (fs.existsSync(`${wasm}.retire`)) {
        fs.renameSync(`${wasm}.retire`, wasm);
    }
    await broken.close();
}

fs.rmSync(root, { recursive: true, force: true });
console.log(failures ? `\n${failures} échec(s)` : "\ntout est bon");
process.exitCode = failures ? 1 : 0;
