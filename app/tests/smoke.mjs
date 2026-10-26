// Test de fumée de l'application : lance Electron avec ARIA_TEST_HOOKS=1, s'y connecte par CDP
// (Playwright) et vérifie fenêtre, moteur, réglages, fermeture vers l'icône et sortie.
// Linux : cd app && xvfb-run -a npm test   (SHOTS=dossier pour une capture)
import { chromium } from "playwright";
import { spawn } from "node:child_process";
const appDir = new URL("..", import.meta.url).pathname;
const shots = process.env.SHOTS;
const errors = [];
const proc = spawn(`${appDir}/node_modules/electron/dist/electron`, [appDir, "--no-sandbox", "--remote-debugging-port=9333"], { env: { ...process.env, ARIA_TEST_HOOKS: "1", NODE_OPTIONS: "" } });
proc.stderr.on("data", (d) => errors.push(String(d)));
proc.stdout.on("data", (d) => errors.push("STDOUT " + String(d)));
const exited = new Promise((r) => proc.on("exit", (code) => r(code)));
let browser;
for (let i = 0; i < 40 && !browser; i++) { try { browser = await chromium.connectOverCDP("http://127.0.0.1:9333"); } catch { await new Promise((r) => setTimeout(r, 250)); } }
let win;
for (let i = 0; i < 40 && !win; i++) { win = browser.contexts()[0]?.pages().find((p) => p.url().endsWith("index.html")); if (!win) await new Promise((r) => setTimeout(r, 250)); }
win.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await win.waitForLoadState();
console.log("titre :", await win.title(), "| aria :", await win.evaluate(() => typeof window.aria), "| require :", await win.evaluate(() => typeof require), "| process :", await win.evaluate(() => typeof process));
await win.waitForTimeout(2500);
console.log("statut :", await win.textContent("#status"));
console.log("état :", JSON.stringify(await win.evaluate(() => window.ariaTest.state())));
await win.click("#check");
await win.waitForSelector("#results li");
console.log("résultats :", await win.$$eval("#results li", (l) => l.map((x) => x.textContent.slice(0, 45))));
await win.selectOption("#lang", "en"); await win.fill("#text", "Your welcome, I'd rather walk then drive.");
await win.click("#check"); await win.waitForTimeout(3000);
console.log("anglais :", await win.$$eval("#results li", (l) => l.map((x) => x.textContent.slice(0, 40))));
console.log("traduction :", (await win.evaluate(() => window.aria.translate({ text: "Le pare-feu bloque tout.", from: "fr", to: "en" }))).text);
console.log("réglages :", JSON.stringify(await win.evaluate(async () => { const s = await window.aria.setSettings({ hotkey: "Alt+Shift+K", repetitionDistance: 999, hack: 1 }); return [s.hotkey, s.repetitionDistance, s.startWithWindows, "hack" in s]; })));
if (shots) await win.screenshot({ path: `${shots}/app.png` });
await win.evaluate(() => window.ariaTest.close());
await new Promise((r) => setTimeout(r, 700));
const targets = await (await fetch("http://127.0.0.1:9333/json/list")).json();
console.log("cibles après fermeture :", targets.map((t) => t.type + " " + t.url.split("/").pop()));
const b2 = await chromium.connectOverCDP("http://127.0.0.1:9333");
const p2 = b2.contexts()[0].pages()[0];
console.log("fenêtres :", JSON.stringify((await p2.evaluate(() => window.ariaTest.state())).windows));
await p2.evaluate(() => window.ariaTest.show());
console.log("réaffichée :", JSON.stringify((await p2.evaluate(() => window.ariaTest.state())).windows));
const pages = [p2];
const t0 = Date.now();
pages[0].evaluate(() => window.ariaTest.quit()).catch(() => {});
const code = await Promise.race([exited, new Promise((r) => setTimeout(() => r("toujours en vie"), 8000))]);
console.log("quitté :", code, "en", Date.now() - t0, "ms");
console.log("ERREURS :", errors.filter((e) => !/use-openssl-ca|dbus|GPU|gpu|Fontconfig|libva|viz_main|ozone|DevTools listening|Debugger|EGL|vaapi|ANGLE|GLES|egl/i.test(e)));
if (code === "toujours en vie") proc.kill();
