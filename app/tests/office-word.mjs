// Complément Word : le panneau dans Chromium, branché sur un faux Word (tests/fake-office.js) et
// sur le vrai moteur (serveur du complément avec Node seul, sans Electron).
//   1. recherche des passages (locate.js) ;
//   2. vérification du document et de la sélection, aller à une faute, corriger, Tout corriger,
//      document modifié entre-temps, dictionnaire, mots ignorés ;
//   3. traduction, synonymes, conjugaison ;
//   4. manifeste Word.
//     node tests/office-word.mjs   (SHOTS=dossier pour des captures)
import { createRequire } from "node:module";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAria } from "../../extension/core/index.js";
import { nodePlatform } from "../../extension/core/platform/node.js";
import { createService } from "../../extension/core/service.js";
import { DEFAULTS } from "../../extension/core/shared/settings.js";
import { createLocalhostCertificates } from "../office/cert.js";
import { WORD_ADDIN_ID, wordManifest } from "../office/manifest.js";
import { startOfficeServer } from "../office/server.js";
import { escapeSearch, occurrenceIndex, searchPlan } from "../office/pages/locate.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const shots = process.env.SHOTS;

let failures = 0;
const check = (label, ok, detail = "") => {
    console.log(`${ok ? "OK   " : "ÉCHEC"} ${label}${detail ? ` : ${detail}` : ""}`);
    failures += ok ? 0 : 1;
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- 1. Recherche des passages ---
check("occurrence : 2e « a »", occurrenceIndex("a la a", "a", 5) === 2);
check("occurrence : chevauchement introuvable", occurrenceIndex("aaa", "aa", 1) === -1);
check("« ^ » doublé pour Word", escapeSearch("x^2 ^p") === "x^^2 ^^p");
const long = Array.from({ length: 60 }, (_, i) => `mot${i}`).join(" ");
const span = searchPlan(long, { start: 4, end: long.length });
check("passage de plus de 255 caractères : début et fin", span.kind === "span" && span.head.length === 100 && span.tail.length === 100, span.kind);
check("passage vide refusé", searchPlan("abc", { start: 1, end: 1 }).kind === "none");

// --- 4. Manifeste ---
const xml = wordManifest({ origin: "https://localhost:47823", version: "0.36.0" });
check("manifeste : identifiant, version à 4 nombres, Word, page du panneau", xml.includes(`<Id>${WORD_ADDIN_ID}</Id>`) && xml.includes("<Version>0.36.0.0</Version>")
    && xml.includes('<Host Name="Document"/>') && xml.includes('DefaultValue="https://localhost:47823/office/word.html"'));
check("manifeste : identifiants de ressources ≤ 32 caractères", [...xml.matchAll(/(?:resid|id)="([^"]+)"/g)].every((m) => m[1].length <= 32));

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
const calls = [];
const COMMANDS = {
    ping: async () => ({ version: "test" }),
    check: (msg) => service.check({ text: String(msg.text ?? ""), lang: msg.lang, host: "", personal: msg.personal === true }),
    translate: (msg) => service.translate({ ...msg, text: String(msg.text ?? "") }),
    synonyms: (msg) => service.synonyms(msg),
    conjugate: (msg) => service.conjugate(msg),
    "record-mistakes": async (msg) => {
        await service.recordMistakes(msg.items);
        return {};
    },
    "settings-get": async (msg) => ({ values: getValues(msg.spec ?? null) }),
    "settings-set": async (msg) => {
        Object.assign(settings, msg.values);
        return { changes: {} };
    },
};
const certificates = createLocalhostCertificates();
const port = 47960 + Math.floor(Math.random() * 30);
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
        calls.push(msg.cmd);
        const run = COMMANDS[msg.cmd];
        if (!run) {
            throw new Error(`Commande inconnue : ${msg.cmd}`);
        }
        return run(msg);
    },
});
const spki = crypto.createHash("sha256").update(new crypto.X509Certificate(certificates.cert).publicKey.export({ type: "spki", format: "der" })).digest("base64");
const browser = await chromium.launch({ args: [`--ignore-certificate-errors-spki-list=${spki}`, "--no-sandbox"] });
const fakeOffice = fs.readFileSync(path.join(HERE, "fake-office.js"), "utf8");

try {
    const page = await browser.newPage({ viewport: { width: 340, height: 760 } });
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route("https://appsforoffice.microsoft.com/**", (route) => route.fulfill({ contentType: "text/javascript", body: fakeOffice }));
    await page.addInitScript(() => {
        window.__fakeWord = {
            paragraphs: [
                "Les enfant sont partit a la plage.",
                "",
                "Il a mangé une pomme hier soir et il à aimé.",
                "Le serveur est tombé en panne cette nuit.",
                "J'imprime mes figurines avec ma résinne.",
                "She have a car.",
                "Une voiture rapide.",
            ],
            selection: { p: 0, start: 0, end: 0 },
        };
    });
    await page.goto(`https://localhost:${port}/office/word.html`);
    const doc = () => page.evaluate(() => window.__fakeWord);
    const words = () => page.$$eval("#fix-list .item .word", (list) => list.map((x) => x.textContent));

    await page.waitForSelector("#tab-fix");
    await page.waitForFunction(() => /Word · test/.test(document.querySelector("#version").textContent), null, { timeout: 10000 }).catch(() => {});
    check("panneau chargé (Word, version de l'application)", (await page.textContent("#version")) === "Word · test", await page.textContent("#version"));

    // Vérification du document.
    await page.click('[data-scope="document"]');
    await page.waitForFunction(() => !/Analyse|Lecture/.test(document.querySelector("#fix-summary").textContent), null, { timeout: 30000 });
    const found = await words();
    check("document : fautes des paragraphes trouvées", ["enfant", "partit", "a", "à", "résinne", "have"].every((w) => found.includes(w)), found.join(" | "));
    check("document : paragraphe juste sans remarque", !found.some((w) => /serveur|tombé|panne/.test(w)));
    if (shots) {
        await page.screenshot({ path: path.join(shots, "word-correction.png"), fullPage: true });
    }

    // Aller à la faute.
    await page.click('#fix-list .item:has(.word:text-is("à")) .goto');
    await wait(200);
    const afterGoto = await doc();
    check("aller à la faute : passage sélectionné dans Word", afterGoto.selection.p === 2 && afterGoto.paragraphs[2].slice(afterGoto.selection.start, afterGoto.selection.end) === "à", JSON.stringify(afterGoto.selection));

    // Corriger une faute.
    await page.click('#fix-list .item:has(.word:text-is("a")) .sugg >> nth=0');
    await page.waitForFunction(() => window.__fakeWord.paragraphs[0].includes("à la plage"), null, { timeout: 10000 }).catch(() => {});
    check("correction appliquée dans le document", (await doc()).paragraphs[0] === "Les enfant sont partit à la plage.", (await doc()).paragraphs[0]);
    // Le panneau réanalyse le paragraphe après la correction : on attend la liste à jour.
    await page.waitForFunction(() => ![...document.querySelectorAll("#fix-list .item .word")].some((x) => x.textContent === "a"), null, { timeout: 10000 }).catch(() => {});
    check("liste mise à jour", !(await words()).includes("a"), (await words()).join(" | "));

    // Dictionnaire.
    await page.click('#fix-list .item:has(.word:text-is("résinne")) button.link:text("Ajouter au dictionnaire")');
    await wait(300);
    check("dictionnaire : mot ajouté aux réglages, retiré de la liste", settings.dictionary.includes("résinne") && !(await words()).includes("résinne"));

    // Document modifié entre-temps : nouvelle vérification au lieu de corriger au mauvais endroit.
    await page.evaluate(() => {
        window.__fakeWord.paragraphs[2] = "Il a mangé une pomme ce matin et il à aimé.";
    });
    await page.click('#fix-list .item:has(.word:text-is("à")) .sugg >> nth=0');
    await page.waitForFunction(() => /a changé/.test(document.querySelector("#notice").textContent), null, { timeout: 10000 }).catch(() => {});
    check("document modifié : pas de correction à l'aveugle, nouvelle vérification", /a changé/.test(await page.textContent("#notice")) && (await doc()).paragraphs[2] === "Il a mangé une pomme ce matin et il à aimé.", await page.textContent("#notice"));
    await page.waitForFunction(() => !/Analyse|Lecture/.test(document.querySelector("#fix-summary").textContent), null, { timeout: 30000 });

    // Tout corriger.
    await page.click("#fix-all");
    await page.waitForFunction(() => !document.querySelector("#fix-all").disabled || /Aucune/.test(document.querySelector("#fix-summary").textContent), null, { timeout: 30000 });
    await wait(300);
    const fixed = (await doc()).paragraphs;
    check("Tout corriger : français", fixed[0] === "Les enfants sont partis à la plage." && fixed[2] === "Il a mangé une pomme ce matin et il a aimé.", `${fixed[0]} / ${fixed[2]}`);
    check("Tout corriger : anglais", fixed[5] === "She has a car.", fixed[5]);
    check("Tout corriger : paragraphe juste intact", fixed[3] === "Le serveur est tombé en panne cette nuit.");
    check("fautes récurrentes enregistrées", Object.keys(settings.mistakeStats).length > 0);

    // Mots ignorés.
    await page.evaluate(() => {
        window.__fakeWord.paragraphs[6] = "Une voiture rapide et un camion rapidee.";
    });
    await page.click('[data-scope="document"]');
    await page.waitForFunction(() => !/Analyse|Lecture/.test(document.querySelector("#fix-summary").textContent), null, { timeout: 30000 });
    await page.click('#fix-list .item:has(.word:text-is("rapidee")) button.link:text("Ignorer")');
    await wait(300);
    check("ignorer : enregistré dans les réglages, retiré de la liste", settings.ignored.some((e) => e.word === "rapidee") && !(await words()).includes("rapidee"));
    await page.click('[data-scope="document"]');
    await page.waitForFunction(() => !/Analyse|Lecture/.test(document.querySelector("#fix-summary").textContent), null, { timeout: 30000 });
    check("ignorer : plus signalé à la vérification suivante", !(await words()).includes("rapidee"), (await words()).join(" | "));

    // Vérification de la sélection seulement.
    await page.evaluate(() => {
        window.__fakeWord.paragraphs[2] = "Il ont fini leur travail.";
        window.__fakeWord.paragraphs[0] = "Les enfant sont partit a la plage.";
        window.__fakeWord.selection = { p: 2, start: 3, end: 7 };
    });
    await page.click('[data-scope="selection"]');
    await page.waitForFunction(() => !/Analyse|Lecture/.test(document.querySelector("#fix-summary").textContent), null, { timeout: 30000 });
    const selectionWords = await words();
    check("sélection : seulement le paragraphe sélectionné", selectionWords.some((w) => /\bont\b/.test(w)) && !selectionWords.includes("enfant"), selectionWords.join(" | "));

    // Traduction.
    await page.click("#tab-translate");
    await page.evaluate(() => {
        window.__fakeWord.selection = { p: 3, start: 0, end: window.__fakeWord.paragraphs[3].length };
    });
    await page.click("#tr-grab");
    await page.waitForFunction(() => document.querySelector("#tr-target").value && !document.querySelector("#tr-target").value.endsWith("…"), null, { timeout: 30000 });
    const translation = await page.inputValue("#tr-target");
    check("traduction de la sélection, sens détecté", /\b(the|The)\b/.test(translation) && (await page.textContent("#tr-direction")) === "FR → EN", `${translation} (${await page.textContent("#tr-direction")})`);
    await page.click("#tr-insert");
    await wait(200);
    check("traduction insérée après la sélection", (await doc()).paragraphs[3] === `Le serveur est tombé en panne cette nuit.${translation}`, (await doc()).paragraphs[3]);
    await page.click("#tr-swap");
    await page.waitForFunction(() => document.querySelector("#tr-direction").textContent === "EN → FR", null, { timeout: 30000 }).catch(() => {});
    check("sens inversé", (await page.textContent("#tr-direction")) === "EN → FR", await page.textContent("#tr-direction"));

    // Synonymes : remplace le mot sélectionné.
    await page.click("#tab-synonyms");
    await page.evaluate(() => {
        window.__fakeWord.paragraphs[6] = "Une voiture rapide.";
        window.__fakeWord.selection = { p: 6, start: 12, end: 18 };
    });
    await page.click("#syn-grab");
    await page.waitForSelector("#syn-list .sugg", { timeout: 20000 }).catch(() => {});
    const synonym = await page.textContent("#syn-list .sugg >> nth=0").catch(() => null);
    check("synonymes du mot sélectionné", !!synonym && (await page.inputValue("#syn-word")) === "rapide", synonym ?? "aucun");
    await page.click("#syn-list .sugg >> nth=0");
    await wait(200);
    check("synonyme mis à la place du mot", (await doc()).paragraphs[6] === `Une voiture ${synonym}.`, (await doc()).paragraphs[6]);

    // Conjugaison.
    await page.click("#tab-conj");
    await page.fill("#conj-verb", "prenons");
    await page.click("#conj-go");
    await page.waitForSelector("#conj-out .mood", { timeout: 20000 }).catch(() => {});
    check("conjugaison : forme conjuguée reconnue", /prendre/.test(await page.textContent("#conj-out .summary")) && (await page.textContent("#conj-out")).includes("nous prenons"));
    await page.fill("#conj-verb", "conjuger");
    await page.press("#conj-verb", "Enter");
    await page.waitForFunction(() => /inconnu/.test(document.querySelector("#conj-out").textContent), null, { timeout: 20000 }).catch(() => {});
    check("conjugaison : verbe inconnu, propositions", (await page.textContent("#conj-out")).includes("conjuguer"));
    if (shots) {
        await page.screenshot({ path: path.join(shots, "word-conjugaison.png") });
    }

    // Thème sombre d'Office.
    const dark = await browser.newPage({ viewport: { width: 340, height: 500 } });
    await dark.route("https://appsforoffice.microsoft.com/**", (route) => route.fulfill({ contentType: "text/javascript", body: fakeOffice }));
    await dark.addInitScript(() => {
        window.__fakeWord = { paragraphs: ["Il à fini."], selection: { p: 0, start: 0, end: 0 }, officeTheme: { bodyBackgroundColor: "#262626" } };
    });
    await dark.goto(`https://localhost:${port}/office/word.html`);
    await dark.waitForSelector("#tab-fix");
    check("thème sombre d'Office suivi", (await dark.evaluate(() => document.documentElement.dataset.theme)) === "dark");
    if (shots) {
        await dark.click('[data-scope="document"]');
        await dark.waitForSelector("#fix-list .item", { timeout: 20000 }).catch(() => {});
        await dark.screenshot({ path: path.join(shots, "word-sombre.png") });
    }
    await dark.close();

    // --- Word avec Microsoft 365 : soulignés dans le texte et vérification en direct ---
    const live = await browser.newPage({ viewport: { width: 340, height: 760 } });
    live.on("console", (m) => m.type() === "error" && errors.push(`[direct] ${m.text()}`));
    live.on("pageerror", (e) => errors.push(`[direct] ${e}`));
    await live.route("https://appsforoffice.microsoft.com/**", (route) => route.fulfill({ contentType: "text/javascript", body: fakeOffice }));
    await live.addInitScript(() => {
        window.__fakeWord = {
            wordApi: "1.8",
            paragraphs: [
                "Les enfant sont partit a la plage.",
                "Il a mangé une pomme et il à aimé.",
                "Le serveur est tombé en panne cette nuit.",
                "J'ai acheté une imprimente hier.",
            ],
            selection: { p: 0, start: 0, end: 0 },
        };
    });
    await live.goto(`https://localhost:${port}/office/word.html`);
    const liveDoc = () => live.evaluate(() => ({ paragraphs: window.__fakeWord.paragraphs, annotations: window.__fakeWord.annotations, ids: window.__fakeWord.ids }));
    const liveWords = () => live.$$eval("#fix-list .item .word", (list) => list.map((x) => x.textContent));
    const settle = async () => {
        await live.waitForFunction(() => !/Analyse|Lecture/.test(document.querySelector("#fix-summary").textContent), null, { timeout: 30000 });
        await wait(1600);
    };
    await live.waitForSelector("#fix-underline");
    await settle();
    let state = await liveDoc();
    const listed = await liveWords();
    check("M365 : document vérifié et souligné dès l'ouverture", listed.length >= 5 && state.annotations.length === listed.length, `${listed.length} remarques, ${state.annotations.length} soulignés`);
    const annotationOf = (st, word) => st.annotations.find((a) => st.paragraphs[st.ids.indexOf(a.pid)].slice(a.start, a.start + a.length) === word);
    const spelling = annotationOf(state, "imprimente");
    const grammar = annotationOf(state, "à");
    check("M365 : couleurs (orthographe en rouge, grammaire en bleu), suggestions dans la bulle", spelling?.colorScheme === "Red" && grammar?.colorScheme === "Blue" && spelling.suggestions.includes("imprimante")
        && spelling.popupOptions.brandingTextResourceId === "Critique.Brand" && spelling.popupOptions.titleResourceId === "Critique.Ortho", JSON.stringify(spelling));

    // Clic sur un souligné : la remarque est montrée dans le panneau.
    await live.evaluate((id) => window.__fakeWord.click(id), grammar.id);
    await wait(300);
    check("M365 : clic sur un souligné → remarque mise en avant", (await live.textContent("#fix-list .item.focus .word")) === "à");

    // Suggestion acceptée dans la bulle de Word.
    const recordedBefore = JSON.stringify(settings.mistakeStats);
    await live.evaluate((id) => window.__fakeWord.accept(id, "a"), grammar.id);
    await settle();
    state = await liveDoc();
    check("M365 : suggestion acceptée dans la bulle → paragraphe revérifié", state.paragraphs[1] === "Il a mangé une pomme et il a aimé." && !(await liveWords()).includes("à"), (await liveWords()).join(" | "));
    check("M365 : faute acceptée comptée dans les fautes récurrentes", JSON.stringify(settings.mistakeStats) !== recordedBefore);

    // Frappe : une nouvelle faute apparaît soulignée.
    await live.evaluate(() => window.__fakeWord.edit(2, "Le serveur et tombé en panne cette nuit."));
    await settle();
    state = await liveDoc();
    check("M365 : faute tapée → soulignée et listée", (await liveWords()).includes("et") && !!annotationOf(state, "et"), (await liveWords()).join(" | "));

    // Pas de boucle : sans frappe, plus aucune analyse.
    const checksBefore = calls.filter((cmd) => cmd === "check").length;
    await wait(2500);
    check("M365 : au repos, aucune analyse en boucle", calls.filter((cmd) => cmd === "check").length === checksBefore);

    // Paragraphe ajouté plus haut : les remarques suivent leur paragraphe.
    await live.evaluate(() => window.__fakeWord.insertParagraph(0, "Un nouveau paragraphe tout à fait correct."));
    await settle();
    await live.click('#fix-list .item:has(.word:text-is("imprimente")) .goto');
    await wait(300);
    const moved = await live.evaluate(() => {
        const { selection, paragraphs } = window.__fakeWord;
        return paragraphs[selection.p].slice(selection.start, selection.end);
    });
    check("M365 : paragraphe ajouté au-dessus → « aller à la faute » toujours juste", moved === "imprimente", moved);

    // Correction depuis le panneau : soulignés refaits pour ce paragraphe, sans boucle.
    await live.click('#fix-list .item:has(.word:text-is("imprimente")) .sugg >> nth=0');
    await settle();
    state = await liveDoc();
    check("M365 : correction depuis le panneau, souligné retiré", state.paragraphs[4] === "J'ai acheté une imprimante hier." && !annotationOf(state, "imprimente") && !(await liveWords()).includes("imprimente"), state.paragraphs[4]);

    // Remarque écartée dans la bulle.
    const toReject = annotationOf(await liveDoc(), "et");
    await live.evaluate((id) => window.__fakeWord.reject(id), toReject.id);
    await wait(400);
    check("M365 : remarque écartée dans la bulle → retirée du panneau", !(await liveWords()).includes("et"));

    // Paragraphe supprimé : ses remarques disparaissent.
    await live.evaluate(() => window.__fakeWord.deleteParagraph(1));
    await settle();
    check("M365 : paragraphe supprimé → ses remarques retirées", !(await liveWords()).some((w) => ["enfant", "partit", "a"].includes(w)), (await liveWords()).join(" | "));

    // Case décochée : soulignés retirés, plus de vérification pendant la frappe.
    await live.uncheck("#fix-underline");
    await wait(400);
    check("M365 : case décochée → soulignés retirés", (await liveDoc()).annotations.length === 0);
    const quietBefore = calls.filter((cmd) => cmd === "check").length;
    await live.evaluate(() => window.__fakeWord.edit(0, "Une fote ici."));
    await wait(2000);
    check("M365 : case décochée → pas de vérification pendant la frappe", calls.filter((cmd) => cmd === "check").length === quietBefore);
    if (shots) {
        await live.screenshot({ path: path.join(shots, "word-direct.png") });
    }
    await live.close();

    // --- Word 2021/2024 sans abonnement : annotations refusées, liste seule ---
    const plain = await browser.newPage({ viewport: { width: 340, height: 600 } });
    plain.on("pageerror", (e) => errors.push(`[sans abonnement] ${e}`));
    await plain.route("https://appsforoffice.microsoft.com/**", (route) => route.fulfill({ contentType: "text/javascript", body: fakeOffice }));
    await plain.addInitScript(() => {
        window.__fakeWord = { wordApi: "1.8", noSubscription: true, paragraphs: ["Il à fini."], selection: { p: 0, start: 0, end: 0 } };
    });
    await plain.goto(`https://localhost:${port}/office/word.html`);
    await plain.waitForFunction(() => /Microsoft 365/.test(document.querySelector("#notice")?.textContent ?? ""), null, { timeout: 20000 }).catch(() => {});
    check("sans abonnement : message clair, case retirée, liste disponible", /abonnement Microsoft 365/.test(await plain.textContent("#notice")) && !(await plain.$("#fix-underline"))
        && (await plain.$$eval("#fix-list .item .word", (l) => l.map((x) => x.textContent))).includes("à"), await plain.textContent("#notice"));
    await plain.close();

    // Word plus ancien (sans annotations) : pas de case, pas de vérification automatique.
    check("Word sans annotations : ni case ni vérification à l'ouverture", !(await page.$("#fix-underline")));

    check("aucune erreur dans la page", errors.length === 0, errors.join(" | ").slice(0, 400));
} finally {
    await browser.close();
    await server.close();
    await aria.close();
}
console.log(failures ? `\n${failures} échec(s)` : "\ntout est bon");
process.exitCode = failures ? 1 : 0;
