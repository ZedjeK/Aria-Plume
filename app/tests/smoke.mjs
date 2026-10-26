// Test de fumée de l'application : lance Electron avec ARIA_TEST_HOOKS=1, s'y connecte par CDP
// (Playwright) et vérifie la fenêtre (correcteur de l'extension servi en aria:), le moteur,
// les réglages, la fermeture vers l'icône et la sortie.
// Linux : cd app && xvfb-run -a npm test   (SHOTS=dossier pour des captures)
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";

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
const proc = spawn(`${appDir}/node_modules/electron/dist/electron`, [appDir, "--no-sandbox", "--remote-debugging-port=9333"], { env: { ...process.env, ARIA_TEST_HOOKS: "1", ARIA_FAKE_INPUT: "1", NODE_OPTIONS: "" } });
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
