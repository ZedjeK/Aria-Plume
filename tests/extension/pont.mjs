// De bout en bout : Chromium + extension + relais + application Aria Plume.
//   1. l'application inscrit le relais (bouton « Connecter les navigateurs »), puis s'arrête ;
//   2. l'extension démarre l'application cachée et lui confie les corrections et traductions ;
//   3. réglages partagés : fusion à la première connexion, puis dans les deux sens ;
//   4. application tuée : le moteur de l'extension prend le relais, puis l'application est relancée
//      et reçoit ce qui a changé entre-temps.
//     cd app && xvfb-run -a node ../tests/extension/pont.mjs   (SHOTS=dossier pour une capture)
import { createRequire } from "node:module";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { EXTENSION_ID } from "../../extension/core/shared/ids.js";

const APP = path.resolve(new URL("../../app", import.meta.url).pathname);
const require = createRequire(path.join(APP, "package.json"));
const { chromium } = require("playwright");
const extension = path.resolve(new URL("../../extension", import.meta.url).pathname);
const electron = path.join(APP, "node_modules", "electron", "dist", "electron");

let failures = 0;
const check = (label, ok, detail = "") => {
    console.log(`${ok ? "OK   " : "ÉCHEC"} ${label}${detail ? ` : ${detail}` : ""}`);
    failures += ok ? 0 : 1;
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(test, ms = 20000, step = 200) {
    for (let t = 0; t < ms; t += step) {
        const value = await test();
        if (value) {
            return value;
        }
        await wait(step);
    }
    return null;
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "aria-pont-e2e-"));
const profile = path.join(root, "profil");
const settingsDir = path.join(root, "reglages");
const settingsFile = path.join(settingsDir, "aria-plume-reglages.json");
const readAppSettings = () => JSON.parse(fs.readFileSync(settingsFile, "utf8"));
const testEnv = {
    ARIA_TEST_HOOKS: "1",
    ARIA_TEST_PIPE: path.join(root, "pont.sock"),
    ARIA_TEST_SETTINGS_DIR: settingsDir,
    ARIA_TEST_NATIVE_DIRS: JSON.stringify([path.join(profile, "NativeMessagingHosts")]),
    ARIA_TEST_EXTRA_ARGS: JSON.stringify(["--no-sandbox"]),
    ARIA_FAKE_INPUT: "1",
    NODE_OPTIONS: "",
};
// Réglages de l'application avant la première connexion.
fs.mkdirSync(settingsDir, { recursive: true });
fs.writeFileSync(settingsFile, JSON.stringify({ dictionary: ["Elegoo"], glossary: [{ fr: "serveur", en: "server" }], formalFrench: true }));

// Processus de l'application (lancée par le relais) : arrêt brutal.
// Electron réordonne ses arguments (« electron --hidden --no-sandbox <dossier> ») : on cherche le
// processus principal (sans --type=) qui a --hidden et le dossier de l'application.
function killApp() {
    const list = execFileSync("ps", ["-eo", "pid=,args="]).toString().split("\n");
    for (const line of list) {
        const [, pid, args] = line.match(/^\s*(\d+)\s+(.*)$/) ?? [];
        if (pid && args.includes("--hidden") && args.includes(APP) && !args.includes("--type=") && !args.includes("relay.cjs")) {
            try {
                process.kill(Number(pid), "SIGKILL");
            } catch {
                // déjà parti
            }
        }
    }
}

// --- 1. L'application inscrit le relais, puis s'arrête ---
const appProc = spawn(electron, [APP, "--no-sandbox", "--hidden", "--remote-debugging-port=9334"], { env: { ...process.env, ...testEnv } });
const appExit = new Promise((resolve) => appProc.on("exit", resolve));
let cdp = null;
for (let i = 0; i < 80 && !cdp; i++) {
    cdp = await chromium.connectOverCDP("http://127.0.0.1:9334").catch(() => null);
    if (!cdp) {
        await wait(250);
    }
}
const appPage = await until(() => cdp?.contexts()[0]?.pages().find((page) => page.url().startsWith("aria://app/popup/")));
await appPage.waitForLoadState();
const registration = await appPage.evaluate(() => window.ariaApp.registerBridge());
check("application : relais inscrit", registration.registered.length === 1 && registration.state.registered, JSON.stringify(registration.registered));
appPage.evaluate(() => window.ariaTest.quit()).catch(() => {});
check("application : arrêtée avant le test", (await Promise.race([appExit, wait(8000).then(() => "toujours en vie")])) === 0);

// --- 2. Chromium avec l'extension ---
const context = await chromium.launchPersistentContext(profile, {
    headless: false,
    env: { ...process.env, ...testEnv },
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, "--no-sandbox"],
});
try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 15000 });
    // Les API de l'extension arrivent un instant après le démarrage du service worker.
    await until(() => worker.evaluate(() => !!globalThis.chrome?.storage?.local).catch(() => false), 10000);
    // Réglages de l'extension avant la première connexion.
    await worker.evaluate(() => chrome.storage.local.set({ dictionary: ["systemd"], repetitionDistance: 45, formalFrench: false, glossary: [{ fr: "sauvegarde", en: "backup" }] }));
    const page = await context.newPage();
    await page.goto(`chrome-extension://${EXTENSION_ID}/popup/popup.html`);
    const send = (msg) => page.evaluate((m) => chrome.runtime.sendMessage({ target: "sw", ...m }), msg);

    const badge = await until(async () => {
        const text = await page.textContent("#engine");
        return (await page.isVisible("#engine")) && text.includes("application ✓") ? text : null;
    }, 30000, 300);
    check("popup : « Moteur : application ✓ » (application démarrée par l'extension)", !!badge, badge ?? await page.textContent("#engine"));
    if (process.env.SHOTS) {
        await page.setViewportSize({ width: 560, height: 260 });
        await page.screenshot({ path: path.join(process.env.SHOTS, "popup-moteur-application.png") });
    }
    const status = await send({ cmd: "bridge-status" });
    check("pont prêt, réglages synchronisés", status.state === "ready" && status.synced === true, JSON.stringify(status));

    // Fusion de la première connexion.
    const local = await worker.evaluate(() => chrome.storage.local.get(null));
    const shared = readAppSettings();
    check("fusion : dictionnaires réunis des deux côtés", ["Elegoo", "systemd"].every((w) => local.dictionary.includes(w) && shared.dictionary.includes(w)), `${local.dictionary} / ${shared.dictionary}`);
    check("fusion : glossaires réunis", local.glossary.length === 2 && shared.glossary.length === 2, JSON.stringify(shared.glossary));
    check("fusion : réglage laissé par défaut dans l'application → valeur de l'extension", local.repetitionDistance === 45 && shared.repetitionDistance === 45);
    check("fusion : réglage choisi dans l'application → gardé", local.formalFrench === true && shared.formalFrench === true);

    // Le moteur de l'application.
    const text = "Les enfant sont partit a la plage.";
    const result = await send({ cmd: "check", text, lang: "auto" });
    const words = (result.matches ?? []).map((m) => text.slice(m.start, m.end));
    check("correction par l'application", result.ok && result.engine === "application" && words.includes("a") && result.lang === "fr", `${result.engine} : ${words.join(", ")}`);
    const translation = await send({ cmd: "translate", from: "fr", text: "La sauvegarde du serveur est finie." });
    check("traduction par l'application, avec le glossaire fusionné", translation.engine === "application" && /backup/i.test(translation.text) && /server/i.test(translation.text), translation.text);
    const conj = await send({ cmd: "conjugate", verb: "prenons" });
    check("conjugaison par l'application", conj.engine === "application" && conj.infinitive === "prendre");
    const syn = await send({ cmd: "synonyms", word: "rapide", context: "Une voiture rapide." });
    check("synonymes par l'application", syn.engine === "application" && syn.groups?.length > 0);
    const offscreen = await send({ cmd: "env" });
    check("moteur de l'extension pas chargé", offscreen.offscreenActive === false);

    // Réglages : extension → application.
    await worker.evaluate(async () => {
        const { dictionary } = await chrome.storage.local.get("dictionary");
        await chrome.storage.local.set({ dictionary: [...dictionary, "Warhammer"] });
    });
    check("réglage changé dans l'extension → application", !!(await until(() => readAppSettings().dictionary.includes("Warhammer"))));
    // Application → extension (un autre client du canal, comme la fenêtre de l'application).
    const token = fs.readFileSync(path.join(settingsDir, "pont", "jeton"), "utf8").trim();
    await new Promise((resolve) => {
        const socket = net.connect(testEnv.ARIA_TEST_PIPE, () => {
            socket.write(`${JSON.stringify({ id: 0, cmd: "hello", token })}\n`);
            socket.write(`${JSON.stringify({ id: 1, cmd: "settings-set", values: { repetitionDistance: 20 } })}\n`);
        });
        socket.on("data", (data) => {
            if (String(data).includes('"id":1')) {
                socket.end();
                resolve();
            }
        });
    });
    check("réglage changé dans l'application → extension", !!(await until(async () => (await worker.evaluate(() => chrome.storage.local.get("repetitionDistance"))).repetitionDistance === 20)));

    // --- 4. Application tuée ---
    // Aussitôt après : un réglage change, une correction est demandée (sans attendre que l'extension
    // voie la coupure, comme dans la vraie vie).
    killApp();
    await worker.evaluate(async () => {
        const { dictionary } = await chrome.storage.local.get("dictionary");
        await chrome.storage.local.set({ dictionary: [...dictionary, "Kraftwerk"] });
    });
    const fallback = await send({ cmd: "check", text, lang: "fr" });
    const fallbackWords = (fallback.matches ?? []).map((m) => text.slice(m.start, m.end));
    check("application tuée : le moteur de l'extension prend le relais", fallback.ok && fallback.engine === "extension" && fallbackWords.includes("a"), `${fallback.engine} : ${fallbackWords.join(", ")}`);
    const back = await until(async () => (await send({ cmd: "bridge-status" })).state === "ready", 30000, 500);
    check("application relancée par l'extension", !!back);
    check("changement fait pendant la coupure → envoyé à l'application", !!(await until(() => readAppSettings().dictionary.includes("Kraftwerk"))), readAppSettings().dictionary.join(", "));
    const again = await send({ cmd: "check", text, lang: "fr" });
    check("de nouveau par l'application", again.engine === "application");
    await page.close();
} finally {
    await context.close();
    killApp();
    await wait(500);
    fs.rmSync(root, { recursive: true, force: true });
}
console.log(failures ? `\n${failures} échec(s)` : "\ntout est bon");
process.exitCode = failures ? 1 : 0;
