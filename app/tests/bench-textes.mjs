// Banc « textes » dans l'application : chaque texte de tests/bench/textes.mjs passe par la
// fenêtre de l'application, exactement comme un texte collé dans l'onglet Correction
// (chrome.runtime.sendMessage → service du moteur), avec la langue en « auto » et les
// réglages par défaut. Mesure aussi la détection de langue et le temps de réponse.
// Linux : cd app && xvfb-run -a node tests/bench-textes.mjs [-v]   (APP_BINARY=… pour l'appli empaquetée)
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { textes } from "../../tests/bench/textes.mjs";
import { parse, evaluate, summarize, report, misses } from "../../tests/bench/textes-eval.mjs";

const appDir = new URL("..", import.meta.url).pathname;
const verbose = process.argv.includes("-v");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

fs.rmSync(`${appDir}/dev-data`, { recursive: true, force: true });
const command = process.env.APP_BINARY
    ? [process.env.APP_BINARY, ["--no-sandbox", "--remote-debugging-port=9334"]]
    : [`${appDir}/node_modules/electron/dist/electron`, [appDir, "--no-sandbox", "--remote-debugging-port=9334"]];
const proc = spawn(...command, { env: { ...process.env, ARIA_TEST_HOOKS: "1", NODE_OPTIONS: "" } });
const exited = new Promise((r) => proc.on("exit", r));
let browser;
for (let i = 0; i < 60 && !browser; i++) {
    try {
        browser = await chromium.connectOverCDP("http://127.0.0.1:9334");
    } catch {
        await wait(250);
    }
}
let win;
for (let i = 0; i < 60 && !win; i++) {
    win = browser.contexts()[0]?.pages().find((p) => p.url().startsWith("aria://app/popup/popup.html"));
    if (!win) await wait(250);
}
await win.waitForLoadState();

const results = [];
let detectionOk = 0;
const times = [];
for (const item of textes) {
    const parsed = parse(item.text);
    const start = Date.now();
    const response = await win.evaluate((text) => chrome.runtime.sendMessage({ target: "sw", cmd: "check", lang: "auto", text }), parsed.wrong);
    times.push(Date.now() - start);
    if (!response.ok) {
        console.log(`ERREUR : ${response.error}`);
        continue;
    }
    detectionOk += response.lang === item.lang ? 1 : 0;
    const result = { ...evaluate(parsed, response.matches), lang: item.lang, wrong: parsed.wrong };
    results.push(result);
    const lines = misses(result);
    if (verbose && (lines.length || response.lang !== item.lang)) {
        console.log(`  ${parsed.wrong.replace(/\n/g, " / ")}${response.lang !== item.lang ? `   (détecté : ${response.lang})` : ""}`);
        lines.forEach((line) => console.log(line));
    }
}
console.log(report(summarize(results)));
times.sort((a, b) => a - b);
console.log(`  langue détectée correctement : ${detectionOk}/${textes.length}`);
console.log(`  temps de réponse : médiane ${times[Math.floor(times.length / 2)]} ms, 90 % sous ${times[Math.floor(times.length * 0.9)]} ms, maximum ${times.at(-1)} ms (premier appel, chargement compris)`);

win.evaluate(() => window.ariaTest.quit()).catch(() => {});
await Promise.race([exited, wait(5000)]);
proc.kill();
