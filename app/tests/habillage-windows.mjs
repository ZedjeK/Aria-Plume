// Habillage de la fenêtre, sur l'application Windows compilée : menu latéral de 220 px à gauche, zone
// principale avec le fond animé (jamais sous le menu), onglets d'origine devenus les boutons du menu
// (cliquables par Playwright), réglages fond.* relus et validés. Dossier de travail isolé.
// Windows seulement :
//     npx electron-builder --win dir --x64 --publish never
//     node tests/habillage-windows.mjs dist/win-unpacked <dossier de travail vide>
import { chromium } from "playwright";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [unpacked, travail] = process.argv.slice(2).map((arg) => path.resolve(arg));
const EXE = "Aria Plume.exe";
if (!unpacked || !travail || !fs.existsSync(path.join(unpacked, EXE))) {
    console.error("Usage : node tests/habillage-windows.mjs <dossier win-unpacked> <dossier de travail vide>");
    process.exit(2);
}
if (fs.existsSync(travail) && fs.readdirSync(travail).length && !fs.existsSync(path.join(travail, "donnees"))) {
    console.error(`${travail} n'est pas vide et ne vient pas de ce test : rien n'est supprimé.`);
    process.exit(2);
}
let echecs = 0;
const check = (label, ok, detail = "") => {
    console.log(`${ok ? "OK   " : "ÉCHEC"} ${label}${detail ? ` : ${detail}` : ""}`);
    echecs += ok ? 0 : 1;
};
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

fs.rmSync(travail, { recursive: true, force: true });
const env = { ...process.env, ARIA_TEST_HOOKS: "1", ARIA_TEST_SETTINGS_DIR: path.join(travail, "donnees", ".Aria-Plume"), ARIA_TEST_PIPE: "\\\\.\\pipe\\aria-plume-habillage", ARIA_TEST_OFFICE_PORT: "47993" };
// --portable : pas de proposition d'installation.
spawn(path.join(unpacked, EXE), ["--portable", "--remote-debugging-port=9349"], { env, stdio: "ignore", detached: true }).unref();

let navigateur = null;
for (let i = 0; i < 60 && !navigateur; i++) {
    await attendre(500);
    navigateur = await chromium.connectOverCDP("http://127.0.0.1:9349").catch(() => null);
}
const win = navigateur?.contexts()[0].pages().find((p) => p.url().includes("popup.html"));
check("fenêtre du correcteur ouverte", !!win);
if (!win) {
    process.exit(1);
}
await win.setViewportSize({ width: 1100, height: 760 });
await attendre(1500);
const boite = (selecteur) => win.$eval(selecteur, (e) => { const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; });
const menu = await boite(".menu");
const principal = await boite(".principal");
const fond = await boite("#fond");
check("menu latéral à gauche, 220 px, toute la hauteur", menu.x === 0 && menu.w === 220 && menu.h === 760, JSON.stringify(menu));
check("zone principale à droite du menu", principal.x === 220 && principal.w === 880, JSON.stringify(principal));
check("fond dans la zone principale, jamais sous le menu", fond.x === 220 && fond.w === 880 && fond.h === 760, JSON.stringify(fond));
const boutons = await win.$$eval(".menu button", (liste) => liste.map((b) => b.textContent.trim()));
check("menu : Correction, Traduction, Conjugaison, Réglages", boutons.join("|") === "Correction|Traduction|Conjugaison|Réglages", boutons.join("|"));

for (const [id, titre] of [["#tab-fix", "Correction"], ["#tab-quick", "Traduction"], ["#tab-conj", "Conjugaison"], ["#tab-fix", "Correction"]]) {
    await win.click(id, { timeout: 5000 });
    await attendre(200);
    const courant = await win.textContent(".menu [aria-selected=true]");
    const entete = await win.textContent(".entete h1");
    check(`clic ${id} : section ${titre} au menu et en titre`, courant.trim() === titre && entete === titre, `${courant.trim()} / ${entete}`);
}
await win.fill("#fix-text", "Il on mangé des pomme.");
await attendre(2500);
check("le correcteur marche dans la nouvelle mise en page", /faute/.test(await win.textContent("#fix-stats")), await win.textContent("#fix-stats"));

const dessine = () => win.$eval("#fond", (toile) => { const d = toile.getContext("2d").getImageData(0, 0, toile.width, toile.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
check("le fond dessine des lignes", (await dessine()) > 1000, String(await dessine()));
const lire = () => win.evaluate(() => chrome.storage.local.get({ "fond.actif": null, "fond.vitesse": null, "fond.minimum": null, "fond.maximum": null }));
await win.evaluate(() => chrome.storage.local.set({ "fond.actif": false }));
await attendre(500);
check("fond coupé : canvas caché", await win.$eval("#fond", (e) => e.hidden));
await win.evaluate(() => chrome.storage.local.set({ "fond.actif": true, "fond.vitesse": "rapide", "fond.minimum": 2, "fond.maximum": 5 }));
await attendre(500);
const reglages = await lire();
check("réglages relus", reglages["fond.actif"] === true && reglages["fond.vitesse"] === "rapide" && reglages["fond.minimum"] === 2 && reglages["fond.maximum"] === 5, JSON.stringify(reglages));
await win.evaluate(() => chrome.storage.local.set({ "fond.vitesse": "turbo", "fond.maximum": 99, "fond.minimum": -1 }));
await attendre(300);
const apres = await lire();
// Comme pour les autres réglages, une valeur hors limites n'est jamais gardée : retour à la valeur par défaut.
check("valeurs hors limites jamais gardées (retour aux valeurs par défaut)", apres["fond.vitesse"] === "normale" && apres["fond.maximum"] === 8 && apres["fond.minimum"] === 3, JSON.stringify(apres));
await win.evaluate(() => chrome.storage.local.set({ "fond.minimum": 9 }));
await attendre(300);
check("le minimum ne dépasse jamais le maximum", (await lire())["fond.minimum"] <= (await lire())["fond.maximum"], JSON.stringify(await lire()));

// Réglages : dans la même fenêtre, à la place du correcteur, sans nouvelle fenêtre.
const fenetres = async () => (await win.evaluate(() => window.ariaTest.state())).windows.length;
const avant = await fenetres();
await win.click(".menu button[data-section=options]");
await attendre(2500);
const vueReglages = navigateur.contexts()[0].pages().find((p) => p.url().includes("options.html"));
check("Réglages : s'ouvre dans la même fenêtre (aucune nouvelle fenêtre)", !!vueReglages && (await fenetres()) === avant, `${avant} → ${await fenetres()}`);
check("Réglages : le bouton du menu est mis en avant, l'outil précédent non", (await win.getAttribute(".menu button[data-section=options]", "aria-selected")) === "true" && await win.evaluate(() => document.body.classList.contains("vue-reglages")));
check("Réglages : la page a sa section Application", !!vueReglages && (await vueReglages.locator("#app-settings").count()) === 1);
await win.click("#tab-conj");
await attendre(800);
check("un outil du menu referme les réglages", !(await win.evaluate(() => document.body.classList.contains("vue-reglages"))) && (await win.getAttribute("#tab-conj", "aria-selected")) === "true");
await win.setViewportSize({ width: 700, height: 700 });
await attendre(500);
const etroit = await boite(".menu");
check("fenêtre étroite : menu réduit aux icônes", etroit.w === 58, JSON.stringify(etroit));

await navigateur.close();
try {
    execFileSync("powershell", ["-NoProfile", "-Command", `Get-CimInstance Win32_Process -Filter "Name = '${EXE}'" | Where-Object { $_.ExecutablePath -like '${unpacked.replace(/'/g, "''")}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`]);
} catch {
    // déjà arrêtée
}
console.log(echecs ? `${echecs} échec(s)` : "tout est bon");
process.exit(echecs ? 1 : 0);
