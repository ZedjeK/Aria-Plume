// Test de fumée de l'application : lance Electron avec ARIA_TEST_HOOKS=1, s'y connecte par CDP
// (Playwright) et vérifie la fenêtre (correcteur de l'extension servi en aria:), le moteur,
// les réglages, la fermeture vers l'icône et la sortie.
// Linux : cd app && xvfb-run -a npm test   (SHOTS=dossier pour des captures)
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";

const appDir = new URL("..", import.meta.url).pathname;
const shots = process.env.SHOTS;
const errors = [];
let failures = 0;
const check = (label, ok, detail = "") => {
    console.log(`${ok ? "OK   " : "ÉCHEC"} ${label}${detail ? ` : ${detail}` : ""}`);
    failures += ok ? 0 : 1;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Réglages de test : partir d'un fichier vierge.
fs.rmSync(`${appDir}/dev-data`, { recursive: true, force: true });
const downloads = fs.mkdtempSync(`${os.tmpdir()}/aria-test-`);
process.env.ARIA_TEST_DOWNLOADS = downloads;
// Installation assistée de l'extension : dossier cible et navigateur simulé (un script qui note
// ses arguments).
const extensionDir = `${downloads}/Aria Plume - extension`;
const browserArgs = `${downloads}/navigateur-args.txt`;
fs.writeFileSync(`${downloads}/navigateur.sh`, `#!/bin/sh\necho "$@" > "${browserArgs}"\n`, { mode: 0o755 });
const testBrowsers = JSON.stringify([{ id: "test", name: "Navigateur test", scheme: "chrome", exe: `${downloads}/navigateur.sh` }]);
const appVersion = JSON.parse(fs.readFileSync(`${appDir}/package.json`, "utf8")).version;
// APP_BINARY=chemin : teste l'application empaquetée (electron-builder) au lieu des sources.
const command = process.env.APP_BINARY
    ? [process.env.APP_BINARY, ["--no-sandbox", "--remote-debugging-port=9333"]]
    : [`${appDir}/node_modules/electron/dist/electron`, [appDir, "--no-sandbox", "--remote-debugging-port=9333"]];
const proc = spawn(...command, { env: { ...process.env, ARIA_TEST_HOOKS: "1", ARIA_FAKE_INPUT: "1", ARIA_TEST_DOWNLOADS: downloads, ARIA_TEST_EXTENSION_DIR: extensionDir, ARIA_TEST_BROWSERS: testBrowsers, NODE_OPTIONS: "" } });
proc.stderr.on("data", (d) => errors.push(String(d)));
const exited = new Promise((r) => proc.on("exit", (code) => r(code)));
let browser;
for (let i = 0; i < 60 && !browser; i++) {
    try {
        browser = await chromium.connectOverCDP("http://127.0.0.1:9333");
    } catch {
        await wait(250);
    }
}
let win;
for (let i = 0; i < 60 && !win; i++) {
    win = browser.contexts()[0]?.pages().find((p) => p.url().startsWith("aria://app/popup/popup.html"));
    if (!win) await wait(250);
}
win.on("console", (m) => m.type() === "error" && errors.push(m.text()));
win.on("pageerror", (e) => errors.push(String(e)));
await win.waitForLoadState();
await wait(800);

check("fenêtre", (await win.title()) === "Aria Plume");
check("isolation", await win.evaluate(() => typeof require === "undefined" && typeof process === "undefined"));
check("pont chrome", await win.evaluate(() => typeof chrome.runtime.sendMessage === "function"));
check("classes app", await win.evaluate(() => document.body.classList.contains("app") && document.body.classList.contains("window")));
check("éléments du navigateur masqués", await win.evaluate(() => ["#live", "#check", "#detach", "#fix-grab"].every((s) => document.querySelector(s).offsetParent === null)));

// Correction : vagues, liste, compteur.
await win.click("#tab-fix");
await win.click("#fix-text");
await win.keyboard.type("Les enfant sont partit a la plage.");
await win.waitForSelector("#fix-list .fix-item", { timeout: 15000 }).catch(() => {});
const items = await win.$$eval("#fix-list .fix-item .fix-word", (l) => l.map((x) => x.textContent));
check("correction FR (liste)", items.includes("a") && items.includes("enfant"), items.join(", "));
check("compteur", /faute/.test(await win.textContent("#fix-stats")), await win.textContent("#fix-stats"));
if (shots) await win.screenshot({ path: `${shots}/app-correction.png` });

// Appliquer une suggestion depuis la liste, puis vérifier le suivi des fautes.
await win.click("#fix-list .fix-item:has(.fix-word:text-is('a')) .sugg");
await wait(300);
check("suggestion appliquée", (await win.inputValue("#fix-text")).includes(" à la plage"), await win.inputValue("#fix-text"));
await wait(300);
const stats = await win.evaluate(() => chrome.storage.local.get({ mistakeStats: {} }));
check("fautes récurrentes", Object.keys(stats.mistakeStats).length > 0, JSON.stringify(stats.mistakeStats).slice(0, 80));

// Anglais imposé.
await win.selectOption("#fix-lang", "en");
await win.fill("#fix-text", "Your welcome, I'd rather walk then drive.");
await win.waitForFunction(() => [...document.querySelectorAll("#fix-list .fix-word")].some((x) => x.textContent === "then"), null, { timeout: 15000 }).catch(() => {});
const en = await win.$$eval("#fix-list .fix-item .fix-word", (l) => l.map((x) => x.textContent));
check("correction EN", en.includes("then") && en.includes("Your"), en.join(", "));

// Panneau « Tout corriger » (script de page).
await win.click("#fix-all");
await wait(1500);
check("panneau Tout corriger", await win.evaluate(() => { const host = document.querySelector("aria-odl-panel"); return !!host && !host.hidden; }));

// Traduction rapide.
await win.keyboard.press("Escape");
await win.click("#tab-quick");
await win.fill("#qt-a", "Le pare-feu bloque les connexions entrantes.");
await win.waitForFunction(() => document.querySelector("#qt-b").value.length > 0, null, { timeout: 20000 }).catch(() => {});
check("traduction", /firewall/i.test(await win.inputValue("#qt-b")), await win.inputValue("#qt-b"));
if (shots) await win.screenshot({ path: `${shots}/app-traduction.png` });

// Conjugaison.
await win.click("#tab-conj");
await win.fill("#conj-verb", "prenons");
await win.waitForSelector("#conj-results .tense", { timeout: 10000 }).catch(() => {});
check("conjugaison", (await win.textContent("#conj-info")).includes("prendre"));
if (shots) await win.screenshot({ path: `${shots}/app-conjugaison.png` });

// Réglages : écriture contrôlée, relue par la page.
const saved = await win.evaluate(async () => {
    await chrome.storage.local.set({ repetitionDistance: 999, hack: 1, englishDialect: "british" });
    return chrome.storage.local.get({ repetitionDistance: 0, hack: "absent", englishDialect: "" });
});
check("réglages contrôlés", saved.repetitionDistance === 60 && saved.hack === "absent" && saved.englishDialect === "british", JSON.stringify(saved));
check("action du navigateur refusée", (await win.evaluate(() => chrome.runtime.sendMessage({ target: "sw", cmd: "translate-page" }))).ok === false);
const statuses = await win.evaluate(async () => Promise.all(["aria://app/popup/popup.js", "aria://app/core/index.js", "aria://app/popup/%2e%2e/%2e%2e/package.json", "aria://autre/popup/popup.js", "aria://app/content/checker.js"].map((u) => window.ariaTest.serve(u))));
check("seuls les fichiers prévus sont servis", JSON.stringify(statuses) === "[200,404,404,404,200]", JSON.stringify(statuses));
check("la page ne peut rien charger d'autre (CSP)", await win.evaluate(async () => fetch("aria://app/popup/popup.js").then(() => false, () => true)));

// Raccourci global (logiciel simulé) : copie de la sélection, correction, « Renvoyer ».
const hk = await win.evaluate(() => window.ariaTest.pasted());
check("raccourci enregistré", hk.hotkey.ok && hk.hotkey.accelerator === "Alt+Shift+C", JSON.stringify(hk.hotkey));
await win.click("#tab-fix");
await win.selectOption("#fix-lang", "auto");
await win.evaluate(() => window.ariaTest.clipboard("ancien presse-papiers"));
await win.evaluate(() => window.ariaTest.hotkey("Je pense que il viendras demain."));
await wait(500);
check("sélection reçue", (await win.inputValue("#fix-text")) === "Je pense que il viendras demain.", await win.inputValue("#fix-text"));
check("onglet Correction", (await win.getAttribute("#tab-fix", "aria-selected")) === "true");
check("source affichée", (await win.textContent("#fix-source")).includes("Bloc-notes (simulé)"), await win.textContent("#fix-source"));
check("Renvoyer actif", !(await win.isDisabled("#fix-put")) && await win.isVisible("#fix-put"));
check("presse-papiers restauré après la copie", (await win.evaluate(() => window.ariaTest.clipboard())) === "ancien presse-papiers");
await win.waitForSelector("#fix-list .fix-item", { timeout: 15000 }).catch(() => {});
const corrected = await win.evaluate(() => document.querySelectorAll("#fix-list .fix-item").length);
// On corrige en appliquant les suggestions de la liste, une à une.
for (let i = 0; i < 4 && await win.$("#fix-list .fix-item .sugg"); i++) {
    await win.click("#fix-list .fix-item .sugg");
    await wait(900);
}
const fixed = await win.inputValue("#fix-text");
check("texte corrigé", fixed === "Je pense qu'il viendra demain.", `${fixed} (${corrected} fautes)`);
await win.click("#fix-put");
await wait(900);
const pasted = await win.evaluate(() => window.ariaTest.pasted());
check("texte recollé dans le logiciel", pasted.received === fixed, pasted.received);
check("fenêtre cachée après le collage", !(await win.evaluate(() => window.ariaTest.state())).windows[0].visible);
check("presse-papiers restauré après le collage", (await win.evaluate(() => window.ariaTest.clipboard())) === "ancien presse-papiers");
await win.evaluate(() => window.ariaTest.hotkey(""));
await wait(400);
check("rien de sélectionné : message", (await win.textContent("#fix-source")).includes("Rien de sélectionné") && await win.isDisabled("#fix-put"), await win.textContent("#fix-source"));

// Page de réglages (celle de l'extension, avec la section « Application »).
await win.evaluate(() => chrome.runtime.openOptionsPage());
let opt;
for (let i = 0; i < 40 && !opt; i++) {
    opt = browser.contexts()[0].pages().find((p) => p.url().startsWith("aria://app/options/options.html"));
    if (!opt) await wait(250);
}
opt.on("pageerror", (e) => errors.push(String(e)));
opt.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await opt.waitForSelector("#app-settings", { timeout: 10000 }).catch(() => {});
check("réglages : section Application", !!(await opt.$("#app-settings")));
check("réglages : parties propres au navigateur masquées", await opt.evaluate(() => [...document.querySelectorAll('[data-scope="navigateur"]')].every((el) => el.offsetParent === null) && document.querySelector("#dictInput").offsetParent !== null));
const mcpConfig = JSON.parse(await opt.inputValue(".mcp-config"));
check("réglages : configuration MCP", mcpConfig.mcpServers["aria-plume"].args.includes("--mcp") && !!mcpConfig.mcpServers["aria-plume"].command, JSON.stringify(mcpConfig.mcpServers["aria-plume"].args));
// Extension du navigateur : copie, ouverture du navigateur, presse-papiers, mise à jour.
check("extension : état initial", (await opt.textContent("#extensionStatus")).includes("sera copiée"), await opt.textContent("#extensionStatus"));
check("extension : bouton du navigateur détecté", (await opt.textContent('[data-browser="test"]')) === "Installer dans Navigateur test");
await opt.click('[data-browser="test"]');
await opt.waitForSelector("#extensionSteps:not([hidden])", { timeout: 60000 }).catch(() => {});
const copiedManifest = JSON.parse(fs.readFileSync(`${extensionDir}/manifest.json`, "utf8"));
check("extension : copiée, complète", copiedManifest.version === appVersion && ["background.js", "offscreen/offscreen.js", "content/checker.js", "engines", "models"].every((f) => fs.existsSync(`${extensionDir}/${f}`)), copiedManifest.version);
await wait(300);
check("extension : navigateur lancé sur sa page d'extensions", fs.existsSync(browserArgs) && fs.readFileSync(browserArgs, "utf8").trim() === "chrome://extensions");
check("extension : adresse dans le presse-papiers", (await win.evaluate(() => window.ariaTest.clipboard())) === "chrome://extensions");
check("extension : étapes affichées", (await opt.textContent("#extensionSteps")).includes("Navigateur test s'ouvre. L'adresse chrome://extensions est dans ton presse-papiers") && (await opt.textContent("#extensionStatus")).includes(`Extension ${appVersion} prête`), await opt.textContent("#extensionStatus"));
await opt.click("#extensionCopyPath");
await wait(300);
check("extension : chemin du dossier copié", (await win.evaluate(() => window.ariaTest.clipboard())) === extensionDir, await win.evaluate(() => window.ariaTest.clipboard()));
if (shots) await opt.screenshot({ path: `${shots}/app-extension.png`, fullPage: false });
// Mise à jour : une copie plus ancienne, avec un fichier qui n'existe plus et un fichier à l'utilisateur.
const markerFile = `${extensionDir}/.aria-plume-copie.json`;
const oldMarker = JSON.parse(fs.readFileSync(markerFile, "utf8"));
fs.writeFileSync(markerFile, JSON.stringify({ ...oldMarker, version: "0.0.1", files: [...oldMarker.files, "core/disparu.js"] }));
fs.writeFileSync(`${extensionDir}/core/disparu.js`, "// ancienne version");
fs.writeFileSync(`${extensionDir}/notes.txt`, "à moi");
await opt.reload();
await opt.waitForSelector("#app-settings", { timeout: 10000 }).catch(() => {});
check("extension : mise à jour proposée", (await opt.textContent('[data-browser="test"]')) === "Mettre à jour dans Navigateur test" && (await opt.textContent("#extensionStatus")).includes("0.0.1"));
await opt.click('[data-browser="test"]');
await opt.waitForSelector("#extensionSteps:not([hidden])", { timeout: 60000 }).catch(() => {});
check("extension : mise à jour faite", JSON.parse(fs.readFileSync(markerFile, "utf8")).version === appVersion && !fs.existsSync(`${extensionDir}/core/disparu.js`) && fs.existsSync(`${extensionDir}/notes.txt`));
check("extension : message de mise à jour", (await opt.textContent("#extensionSteps")).includes(`0.0.1 → ${appVersion}`), (await opt.textContent("#extensionSteps")).slice(0, 120));
check("réglages : raccourci affiché", (await opt.inputValue(".hotkey")) === "Alt+Maj+C", await opt.inputValue(".hotkey"));
await opt.click(".hotkey");
await opt.keyboard.press("Control+Alt+K");
await wait(500);
const hk2 = await win.evaluate(() => window.ariaTest.pasted());
check("réglages : nouveau raccourci enregistré", hk2.hotkey.accelerator === "Ctrl+Alt+K" && hk2.hotkey.ok, JSON.stringify(hk2.hotkey));
check("réglages : état du raccourci", (await opt.textContent("#hotkeyStatus")).includes("Ctrl+Alt+K"), await opt.textContent("#hotkeyStatus"));
await opt.click(".hotkey");
await opt.keyboard.press("Alt+Shift+C");
await wait(400);
// Dictionnaire : un mot ajouté ici n'est plus signalé dans le correcteur (le filtre est dans la page).
await opt.fill("#dictInput", "Elegoo");
await opt.click("#dictForm button[type=submit]");
await wait(400);
const dict = await win.evaluate(() => chrome.storage.local.get({ dictionary: [] }));
check("réglages : mot ajouté au dictionnaire", dict.dictionary.includes("Elegoo"), JSON.stringify(dict.dictionary));
await win.click("#tab-fix");
await win.selectOption("#fix-lang", "fr");
await win.fill("#fix-text", "J'imprime avec mon Elegoo et mon imprimante.");
await wait(1800);
const words = await win.$$eval("#fix-list .fix-word", (l) => l.map((x) => x.textContent));
check("réglages : dictionnaire pris en compte dans le correcteur", !words.includes("Elegoo"), words.join(", ") || "aucune alerte");
// Export puis import (fichier de l'extension).
await opt.click("#export");
let exported = null;
for (let i = 0; i < 30 && !(exported && fs.existsSync(exported) && fs.statSync(exported).size > 0); i++) {
    await wait(200);
    exported = await win.evaluate(() => window.ariaTest.download());
}
let exportedData = null;
try {
    exportedData = JSON.parse(fs.readFileSync(exported, "utf8"));
} catch {
    // pas de fichier
}
check("réglages : export", exportedData?.app === "Aria Plume" && exportedData.settings.dictionary.includes("Elegoo"), exported ?? "aucun fichier");
const importFile = `${process.env.ARIA_TEST_DOWNLOADS}/extension.json`;
fs.writeFileSync(importFile, JSON.stringify({ app: "Aria Plume", version: "0.29.2", settings: { glossary: [{ fr: "serveur", en: "server" }], keepTerms: ["VLAN"], formalFrench: true } }));
await opt.setInputFiles("#import", importFile);
await wait(600);
const imported = await win.evaluate(() => chrome.storage.local.get({ glossary: [], keepTerms: [], formalFrench: false }));
check("réglages : import d'un fichier de l'extension", imported.glossary.length === 1 && imported.keepTerms[0] === "VLAN" && imported.formalFrench === true, JSON.stringify(imported));
const tr = await win.evaluate(() => chrome.runtime.sendMessage({ target: "sw", cmd: "translate", from: "fr", text: "Le serveur est tombé." }));
check("réglages : glossaire utilisé par la traduction", /server/i.test(tr.text), tr.text);
await opt.close();

// Fermer = cacher ; réafficher ; quitter.
await win.evaluate(() => window.ariaTest.close());
await wait(700);
const state = await win.evaluate(() => window.ariaTest.state());
check("fermeture cache la fenêtre", state.windows.length === 1 && !state.windows[0].visible, JSON.stringify(state.windows));
await win.evaluate(() => window.ariaTest.show());
check("réaffichage", (await win.evaluate(() => window.ariaTest.state())).windows[0].visible);
const t0 = Date.now();
win.evaluate(() => window.ariaTest.quit()).catch(() => {});
const code = await Promise.race([exited, wait(8000).then(() => "toujours en vie")]);
check("sortie propre", code === 0, `${code} en ${Date.now() - t0} ms`);
if (code === "toujours en vie") proc.kill();

// Les deux refus de connexion du test CSP sont attendus.
const real = errors.filter((e) => !/Connecting to .aria:\/\/app\/popup\/popup.js. violates|Fetch API cannot load aria:\/\/app\/popup\/popup.js/.test(e)).filter((e) => !/use-openssl-ca|dbus|GPU|gpu|Fontconfig|libva|viz_main|ozone|DevTools listening|Debugger|EGL|vaapi|ANGLE|GLES|egl/i.test(e));
check("aucune erreur", real.length === 0, real.join(" | ").slice(0, 500));
console.log(failures ? `\n${failures} échec(s)` : "\ntout est bon");
process.exitCode = failures ? 1 : 0;
