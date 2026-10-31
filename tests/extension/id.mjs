// Extension chargée dans Chromium : identifiant fixe (clé du manifeste) et service worker sans erreur.
//     cd app && xvfb-run -a node ../tests/extension/id.mjs
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EXTENSION_ID } from "../../extension/core/shared/ids.js";

const require = createRequire(new URL("../../app/package.json", import.meta.url));
const { chromium } = require("playwright");
const extension = path.resolve(new URL("../../extension", import.meta.url).pathname);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "aria-ext-"));
let failures = 0;
const check = (label, ok, detail = "") => {
    console.log(`${ok ? "OK   " : "ÉCHEC"} ${label}${detail ? ` : ${detail}` : ""}`);
    failures += ok ? 0 : 1;
};

const context = await chromium.launchPersistentContext(profile, {
    headless: false,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, "--no-sandbox"],
});
try {
    let worker = context.serviceWorkers()[0];
    if (!worker) {
        worker = await context.waitForEvent("serviceworker", { timeout: 15000 });
    }
    const id = new URL(worker.url()).host;
    check("identifiant fixe", id === EXTENSION_ID, id);
    const manifest = await worker.evaluate(() => chrome.runtime.getManifest());
    check("permission nativeMessaging", manifest.permissions.includes("nativeMessaging"));
    const page = await context.newPage();
    await page.goto(`chrome-extension://${id}/popup/popup.html`);
    check("popup ouverte", (await page.title()).length > 0, await page.title());
} finally {
    await context.close();
    fs.rmSync(profile, { recursive: true, force: true });
}
console.log(failures ? `\n${failures} échec(s)` : "\ntout est bon");
process.exitCode = failures ? 1 : 0;
