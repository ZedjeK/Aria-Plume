// Complément Outlook : le panneau dans Chromium, branché sur un faux Outlook (tests/fake-outlook.js)
// et sur le vrai moteur (serveur du complément avec Node seul, sans Electron).
//   1. historique cité retiré du message à traduire ;
//   2. manifeste Outlook ;
//   3. lecture d'un mail : onglets, traduction du message, synonymes, conjugaison ;
//   4. rédaction : onglets réduits et message d'attente ; erreur d'Outlook affichée.
//     node tests/office-outlook.mjs   (SHOTS=dossier pour des captures)
import { createRequire } from "node:module";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAria } from "../../extension/core/index.js";
import { nodePlatform } from "../../extension/core/platform/node.js";
import { createService } from "../../extension/core/service.js";
import { DEFAULTS } from "../../extension/core/shared/settings.js";
import { createLocalhostCertificates } from "../office/cert.js";
import { OUTLOOK_ADDIN_ID, OUTLOOK_MANIFEST, outlookManifest, writeOutlookManifest } from "../office/manifest.js";
import { startOfficeServer } from "../office/server.js";
import { messageToTranslate, quoteStart } from "../office/pages/outlook-host.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const shots = process.env.SHOTS;

let failures = 0;
const check = (label, ok, detail = "") => {
    console.log(`${ok ? "OK   " : "ÉCHEC"} ${label}${detail ? ` : ${detail}` : ""}`);
    failures += ok ? 0 : 1;
};

// --- 1. Historique cité ---
const REPLIES = {
    "Outlook (fr)": "Merci, c'est noté.\n\nDe : Paul Martin <paul@exemple.fr>\nEnvoyé : lundi 2 novembre 2026 10:00\nÀ : Jérémy\nObjet : Serveur\n\nLe serveur est tombé.",
    "Outlook (en)": "Thanks, noted.\r\n\r\nFrom: Paul Martin <paul@example.com>\r\nSent: Monday, November 2, 2026 10:00 AM\r\nTo: Jérémy\r\n\r\nThe server is down.",
    "Gmail (fr)": "D'accord pour demain.\n\nLe lun. 2 nov. 2026 à 10:00, Paul Martin <paul@exemple.fr> a écrit :\n> On se voit demain ?",
    "Gmail (en)": "Sounds good.\n\nOn Mon, Nov 2, 2026 at 10:00 AM Paul Martin <paul@example.com> wrote:\n> See you tomorrow?",
    "ancien Outlook": "Vu.\n\n-----Original Message-----\nFrom: Paul\nIl faut redémarrer.",
    "trait de séparation": "Vu.\n\n________________________________\nDe : Paul\nIl faut redémarrer.",
};
for (const [label, text] of Object.entries(REPLIES)) {
    const { text: part, note } = messageToTranslate(text);
    check(`historique coupé : ${label}`, !/Paul|redémarrer|server is down|serveur est tombé|tomorrow|demain \?/.test(part) && part.length > 0 && /historique/.test(note), JSON.stringify(part));
}
check("sans historique : message entier, pas de note", messageToTranslate("Bonjour,\n\nLe serveur redémarre à 22 h.\nJérémy").text === "Bonjour,\n\nLe serveur redémarre à 22 h.\nJérémy" && messageToTranslate("Bonjour").note === "");
check("message transféré sans mot : le début ne compte pas", quoteStart("-----Original Message-----\nFrom: Paul\nTexte") === -1);
check("« De : » seul dans une phrase : pas un historique", quoteStart("Bonjour,\nDe : mon côté, tout va bien.\nMerci") === -1);
const huge = messageToTranslate("mot ".repeat(8000));
check("message énorme : raccourci et signalé", huge.text.length === 20000 && /20\s000/.test(huge.note), `${huge.text.length} · ${huge.note}`);

// --- 2. Manifeste ---
const xml = outlookManifest({ origin: "https://localhost:47823", version: "0.37.0" });
check("manifeste : complément de messagerie, identifiant, version à 4 nombres", xml.includes('xsi:type="MailApp"') && xml.includes(`<Id>${OUTLOOK_ADDIN_ID}</Id>`) && xml.includes("<Version>0.37.0.0</Version>"));
check("manifeste : lecture et rédaction, Mailbox 1.3, page du panneau", xml.includes('<Set Name="Mailbox" MinVersion="1.3"/>') && xml.includes('FormType="Read"') && xml.includes('FormType="Edit"')
    && xml.includes("MessageReadCommandSurface") && xml.includes("MessageComposeCommandSurface") && xml.includes('DefaultValue="https://localhost:47823/office/outlook.html"'));
const ids = [...xml.matchAll(/\b(?:resid|id)="([^"]+)"/g)].map((m) => m[1]);
const defined = new Set([...xml.matchAll(/<bt:(?:Image|Url|String) id="([^"]+)"/g)].map((m) => m[1]));
const used = new Set([...xml.matchAll(/resid="([^"]+)"/g)].map((m) => m[1]));
check("manifeste : identifiants ≤ 32 caractères, ressources toutes définies et utilisées", ids.every((id) => id.length <= 32) && [...used].every((id) => defined.has(id)) && [...defined].every((id) => used.has(id)));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aria-outlook-"));
const written = writeOutlookManifest({ dir: path.join(tmp, "office"), origin: "https://localhost:47823", version: "0.37.0" });
check("manifeste écrit dans le dossier office", written === path.join(tmp, "office", OUTLOOK_MANIFEST) && fs.readFileSync(written, "utf8") === xml);
fs.rmSync(tmp, { recursive: true, force: true });

// --- Serveur du complément avec le vrai moteur ---
const settings = { ...DEFAULTS, mistakeStats: {}, mistakeStatsSince: null };
const getValues = (spec) => {
    if (spec === null || spec === undefined) {
        return { ...settings };
    }
    const keys = typeof spec === "string" ? [spec] : spec;
    if (Array.isArray(keys)) {
        return Object.fromEntries(keys.filter((key) => key in settings).map((key) => [key, settings[key]]));
    }
    return Object.fromEntries(Object.entries(keys).map(([key, fallback]) => [key, key in settings ? settings[key] : fallback]));
};
const aria = createAria(nodePlatform);
const service = createService({
    aria,
    getSettings: async (defaults) => getValues(defaults),
    saveValues: async (values) => Object.assign(settings, values),
});
const pings = [];
const COMMANDS = {
    ping: async (msg) => {
        pings.push(msg.host);
        return { version: "test" };
    },
    translate: (msg) => service.translate({ ...msg, text: String(msg.text ?? "") }),
    synonyms: (msg) => service.synonyms(msg),
    conjugate: (msg) => service.conjugate(msg),
    "settings-get": async (msg) => ({ values: getValues(msg.spec ?? null) }),
    "settings-set": async (msg) => {
        Object.assign(settings, msg.values);
        return { changes: {} };
    },
};
const certificates = createLocalhostCertificates();
const port = 47990 + Math.floor(Math.random() * 30);
const server = await startOfficeServer({
    port,
    cert: certificates.cert,
    key: certificates.key,
    version: "test",
    roots: [
        { prefix: "icons/", root: path.join(HERE, "..", "build") },
        { prefix: "", root: path.join(HERE, "..", "office", "pages") },
    ],
    handle: async (msg) => {
        const run = COMMANDS[msg.cmd];
        if (!run) {
            throw new Error(`Commande inconnue : ${msg.cmd}`);
        }
        return run(msg);
    },
});
const spki = crypto.createHash("sha256").update(new crypto.X509Certificate(certificates.cert).publicKey.export({ type: "spki", format: "der" })).digest("base64");
const browser = await chromium.launch({ args: [`--ignore-certificate-errors-spki-list=${spki}`, "--no-sandbox"] });
const fakeOutlook = fs.readFileSync(path.join(HERE, "fake-outlook.js"), "utf8");
const url = `https://localhost:${port}/office/outlook.html`;

async function openPanel(mail) {
    const page = await browser.newPage({ viewport: { width: 340, height: 760 } });
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("requestfailed", (r) => errors.push(`échec ${r.url()}`));
    page.on("response", (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
    await page.route("https://appsforoffice.microsoft.com/**", (route) => route.fulfill({ contentType: "text/javascript", body: fakeOutlook }));
    await page.addInitScript((value) => {
        window.__fakeOutlook = value;
    }, mail);
    await page.goto(url);
    await page.waitForSelector("#tab-translate", { state: "attached", timeout: 15000 }).catch(async () => {
        errors.push(`panneau absent : ${await page.textContent("#app")}`);
    });
    return { page, errors };
}
const visible = (page) => page.$$eval('[role="tab"]', (tabs) => tabs.filter((tab) => !tab.hidden).map((tab) => tab.id.replace("tab-", "")));

try {
    // --- 3. Lecture d'un mail ---
    const { page, errors } = await openPanel({
        mode: "read",
        subject: "Serveur",
        body: "Bonjour,\n\nLe serveur est tombé en panne cette nuit.\n\nLe lun. 2 nov. 2026 à 10:00, Paul Martin <paul@exemple.fr> a écrit :\n> Tout va bien de ton côté ?",
    });
    check("lecture : onglets traduction, synonymes, conjugaison (pas de correction)", (await visible(page)).join(",") === "translate,synonyms,conj", (await visible(page)).join(","));
    check("lecture : traduction ouverte d'office", (await page.getAttribute("#tab-translate", "aria-selected")) === "true");
    check("lecture : bouton « Traduire le message », rien à remplacer ni insérer", (await page.textContent("#tr-grab")) === "Traduire le message" && !(await page.isVisible("#tr-replace")) && !(await page.isVisible("#tr-insert")));
    await page.click("#tr-grab");
    await page.waitForFunction(() => document.querySelector("#tr-target").value && !document.querySelector("#tr-target").value.endsWith("…"), null, { timeout: 30000 }).catch(() => {});
    const source = await page.inputValue("#tr-source");
    const translation = await page.inputValue("#tr-target");
    check("message pris sans l'historique", source === "Bonjour,\n\nLe serveur est tombé en panne cette nuit.", JSON.stringify(source));
    check("message traduit, sens détecté", /last night/i.test(translation) && !/Paul/.test(translation) && (await page.textContent("#tr-direction")) === "FR → EN", `${translation} (${await page.textContent("#tr-direction")})`);
    check("note sur l'historique non traduit", /historique cité/.test(await page.textContent("#notice")), await page.textContent("#notice"));
    check("texte du mail lu par Outlook (texte brut)", (await page.evaluate(() => window.__fakeOutlook.log)).includes("body.getAsync:text"));
    if (shots) {
        await page.screenshot({ path: path.join(shots, "outlook-lecture.png") });
    }

    await page.click("#tab-synonyms");
    check("synonymes : pas de bouton « Mot sélectionné »", !(await page.isVisible("#syn-grab")));
    await page.fill("#syn-word", "rapide");
    await page.click("#syn-go");
    await page.waitForSelector("#syn-list .sugg", { timeout: 20000 }).catch(() => {});
    check("synonymes d'un mot tapé", (await page.$$("#syn-list .sugg")).length > 0);

    await page.click("#tab-conj");
    await page.fill("#conj-verb", "prenons");
    await page.click("#conj-go");
    await page.waitForSelector("#conj-out .mood", { timeout: 20000 }).catch(() => {});
    check("conjugaison", (await page.textContent("#conj-out")).includes("nous prenons"));
    check("ping avec le nom du complément", pings.includes("Outlook"), pings.join(","));
    check("lecture : aucune erreur dans la page", errors.length === 0, errors.join(" | ").slice(0, 400));
    await page.close();

    // Mail vide (seulement l'historique) et erreur d'Outlook.
    const empty = await openPanel({ mode: "read", subject: "Fwd", body: "-----Message d'origine-----\nDe : Paul\nTexte" });
    await empty.page.click("#tr-grab");
    await empty.page.waitForFunction(() => document.querySelector("#notice").textContent, null, { timeout: 5000 }).catch(() => {});
    check("message transféré sans mot : historique traduit faute de mieux", (await empty.page.inputValue("#tr-source")).includes("Texte"), await empty.page.textContent("#notice"));
    await empty.page.close();

    const broken = await openPanel({ mode: "read", subject: "x", body: "x", bodyError: "Le message n'est plus disponible." });
    await broken.page.click("#tr-grab");
    await broken.page.waitForFunction(() => /plus disponible/.test(document.querySelector("#notice").textContent), null, { timeout: 5000 }).catch(() => {});
    check("erreur d'Outlook affichée", /plus disponible/.test(await broken.page.textContent("#notice")), await broken.page.textContent("#notice"));
    await broken.page.close();

    // --- 4. Rédaction ---
    const compose = await openPanel({ mode: "compose", subject: "Brouillon", body: "Bonjour" });
    check("rédaction : synonymes et conjugaison seulement", (await visible(compose.page)).join(",") === "synonyms,conj", (await visible(compose.page)).join(","));
    check("rédaction : message d'attente", /prochaine version/.test(await compose.page.textContent("#notice")), await compose.page.textContent("#notice"));
    check("rédaction : aucune erreur dans la page", compose.errors.length === 0, compose.errors.join(" | ").slice(0, 400));
    await compose.page.close();
} finally {
    await browser.close();
    await server.close();
    await aria.close();
}
console.log(failures ? `\n${failures} échec(s)` : "\ntout est bon");
process.exitCode = failures ? 1 : 0;
