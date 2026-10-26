// Aria Plume — banc de mesure du moteur Aria, sous Node (plus besoin de Chromium pour mesurer).
//
//     node tests/bench/run.mjs                  toutes les suites
//     node tests/bench/run.mjs fr grammalecte   seulement celles-là (fr, en, grammalecte, wordnet, textes)
//     node tests/bench/run.mjs -v               détail de chaque phrase
//     node tests/bench/run.mjs --update         enregistre les chiffres comme nouvelle référence
//
// Chaque suite est comparée à baseline.json : le banc sort en erreur si une faute trouvée
// est perdue ou si une fausse alerte apparaît. Suites :
//   - fr          corpus maison (corpus-fr.mjs), moteur complet : Grammalecte + règles d'Aria
//   - en          corpus maison (corpus-en.mjs), règles anglaises d'Aria
//   - grammalecte 14 160 phrases de test de Grammalecte, règles françaises d'Aria seules :
//                 une alerte hors des zones fautives est une fausse alerte
//   - wordnet     47 478 phrases d'exemple de WordNet 3.1 (anglais correct), règles anglaises
//                 d'Aria : chaque signalement est à examiner (vraie faute ou fausse alerte)
//   - textes      une centaine de textes du quotidien avec des fautes volontaires (textes.mjs),
//                 moteur complet par le service, comme dans l'extension et l'application

import fs from "node:fs";
import zlib from "node:zlib";
import { createAria } from "../../extension/core/index.js";
import { nodePlatform } from "../../extension/core/platform/node.js";
import { findEnglishRules } from "../../extension/core/en/rules.js";
import { corpus as corpusFr } from "./corpus-fr.mjs";
import { corpus as corpusEn } from "./corpus-en.mjs";
import { createService } from "../../extension/core/service.js";
import { DEFAULTS } from "../../extension/core/shared/settings.js";
import { textes } from "./textes.mjs";
import { parse, evaluate, summarize, report, misses } from "./textes-eval.mjs";

const args = process.argv.slice(2);
const verbose = args.includes("-v");
const update = args.includes("--update");
const SUITES = ["fr", "en", "grammalecte", "wordnet", "textes"];
const chosen = args.filter((a) => SUITES.includes(a));
const suites = chosen.length ? chosen : SUITES;
const here = (path) => new URL(path, import.meta.url);
const readGzip = (path) => zlib.gunzipSync(fs.readFileSync(here(path))).toString("utf8");
const log = (...parts) => console.log(...parts);
const detail = (...parts) => verbose && console.log(...parts);

const aria = createAria(nodePlatform);
const results = {};

// --- fr : corpus maison, moteur complet ---
async function benchFr() {
    let hit = 0, miss = 0, wrongFix = 0, first = 0, fa = 0, ok = 0;
    for (let [text, bad, fix, opts] of corpusFr) {
        // 4e élément facultatif : { formal: true } (français écrit soigné), { repetitions: n }.
        const { matches } = await aria.check({ text, lang: "fr", formal: !!opts?.formal, repetitions: opts?.repetitions ?? 0 });
        const show = matches.map((m) => `«${text.slice(m.start, m.end)}»→${m.suggestions.slice(0, 3).join("|")} [${m.rule}]`).join("  ");
        if (bad) {
            // « mot#2 » : la 2e occurrence du mot (pour les répétitions).
            const [, word, nth] = /^(.*?)(?:#(\d+))?$/u.exec(bad);
            const after = /\p{L}$/u.test(word) ? "(?![\\p{L}])" : "";
            const occurrences = [...text.matchAll(new RegExp(`(?<![\\p{L}])${word}${after}`, "gu"))];
            const idx = occurrences[(Number(nth) || 1) - 1]?.index ?? -1;
            const m = matches.find((m) => m.start <= idx && m.end >= idx + word.length);
            if (!m) {
                miss++;
                log(`  RATÉ     ${text}   ${show}`);
            } else if (!m.suggestions.some((s) => s.includes(fix))) {
                wrongFix++;
                log(`  MAUVAISE ${text}   ${show}`);
            } else {
                hit++;
                if (m.suggestions[0].replace("’", "'").includes(fix)) {
                    first++;
                    detail(`  OK       ${text}   ${show}`);
                } else {
                    log(`  2e RANG  ${text}   ${show}`);
                }
            }
        } else {
            // Phrase juste : seules comptent les alertes de grammaire et de style.
            const alerts = matches.filter((m) => m.kind !== "orthographe" && m.kind !== "typographie" && !/apostrophe|typo/.test(m.rule));
            if (alerts.length) {
                fa++;
                log(`  FAUSSE   ${text}   ${show}`);
            } else {
                ok++;
                detail(`  OK       ${text}`);
            }
        }
    }
    log(`  fautes détectées ${hit}/${hit + miss + wrongFix} (bonne correction en 1re position ${first}) | phrases justes sans alerte ${ok}/${ok + fa}`);
    return { found: hit, firstRank: first, total: hit + miss + wrongFix, falseAlerts: fa, correct: ok + fa };
}

// --- en : corpus maison, règles anglaises d'Aria ---
function benchEn() {
    let hit = 0, miss = 0, fa = 0, ok = 0;
    const show = (text, found) => found.map((f) => `«${text.slice(f.start, f.end)}»→${f.suggestions[0]}`).join(" ");
    for (const [text, bad, fix] of corpusEn) {
        const found = findEnglishRules(text);
        if (bad) {
            const idx = text.search(new RegExp(`(?<![A-Za-z'’])${bad.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z])`));
            const m = found.find((f) => f.start <= idx && f.end >= idx + bad.length);
            if (m && m.suggestions[0] === fix) {
                hit++;
                detail(`  OK      ${text}   ${show(text, found)}`);
            } else {
                miss++;
                log(`  RATÉ    ${text}   ${show(text, found)}`);
            }
        } else if (found.length) {
            fa++;
            log(`  FAUSSE  ${text}   ${show(text, found)}`);
        } else {
            ok++;
        }
    }
    log(`  fautes trouvées ${hit}/${hit + miss} | phrases justes sans alerte ${ok}/${ok + fa}`);
    return { found: hit, total: hit + miss, falseAlerts: fa, correct: ok + fa };
}

// --- grammalecte : phrases de test de Grammalecte, règles d'Aria seules ---
async function benchGrammalecte() {
    const data = JSON.parse(readGzip("data/grammalecte-tests.json.gz")).aData;
    let fa = 0, inZone = 0;
    for (const raw of data) {
        const line = raw.replace(/^\d+\s+/, "").replace(/^__\w+__\s+/, "");
        const marked = line.split(/\s+->>\s+/)[0].trim();
        const plain = marked.replace(/\{\{|\}\}/g, "");
        // Zones fautives {{…}}, en positions du texte nettoyé.
        const zones = [];
        let offset = 0;
        marked.replace(/\{\{(.*?)\}\}/g, (all, inner, index) => {
            zones.push([index - offset, index - offset + inner.length]);
            offset += 4;
            return all;
        });
        for (const f of await aria.rulesFr({ text: plain })) {
            if (zones.some(([s, e]) => f.start < e && f.end > s)) {
                inZone++;
            } else {
                fa++;
                log(`  HORS ZONE ${f.rule.padEnd(30)} «${plain.slice(f.start, f.end)}» ${plain}`);
            }
        }
    }
    log(`  phrases ${data.length} | alertes hors zone ${fa} | déclenchements dans une zone fautive ${inZone}`);
    return { sentences: data.length, outsideZone: fa, inZone };
}

// --- wordnet : exemples de WordNet, anglais correct ---
function benchWordnet() {
    const lines = readGzip("data/wordnet-examples.txt.gz").split("\n").filter(Boolean);
    const byRule = {};
    let flagged = 0;
    for (const line of lines) {
        for (const m of findEnglishRules(line)) {
            flagged++;
            byRule[m.rule] = (byRule[m.rule] ?? 0) + 1;
            log(`  SIGNALÉ  ${m.rule.padEnd(22)} «${line.slice(m.start, m.end)}» ${line}`);
        }
    }
    log(`  phrases ${lines.length} | signalements ${flagged} ${JSON.stringify(byRule)}`);
    return { sentences: lines.length, flagged };
}

// --- textes : textes du quotidien, moteur complet par le service (réglages par défaut, sans répétitions) ---
async function benchTextes() {
    const settings = { ...DEFAULTS, repetitions: false };
    const service = createService({
        aria,
        getSettings: async (defaults) => Object.fromEntries(Object.keys(defaults).map((key) => [key, key in settings ? settings[key] : defaults[key]])),
        saveValues: async () => {},
    });
    const results = [];
    for (const item of textes) {
        const parsed = parse(item.text);
        const { matches } = await service.check({ text: parsed.wrong, lang: item.lang });
        const result = { ...evaluate(parsed, matches), lang: item.lang, wrong: parsed.wrong };
        results.push(result);
        const lines = misses(result);
        if (lines.length) {
            detail(`  ${parsed.wrong.replace(/\n/g, " / ")}`);
            lines.forEach((line) => detail(line));
        }
    }
    const summary = summarize(results);
    log(report(summary));
    const { total } = summary;
    return { found: total.found, fixed: total.fixed, firstRank: total.first, total: total.zones, falseAlerts: total.falseAlerts, oneClick: total.oneClick };
}

// Pour chaque mesure : faut-il qu'elle monte (more) ou qu'elle baisse (less) ?
const DIRECTION = { found: "more", fixed: "more", oneClick: "more", firstRank: "more", inZone: "more", falseAlerts: "less", outsideZone: "less", flagged: "less" };

const RUNNERS = { fr: benchFr, en: benchEn, grammalecte: benchGrammalecte, wordnet: benchWordnet, textes: benchTextes };
const baselineFile = here("baseline.json");
const baseline = fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, "utf8")) : {};
let regressions = 0;
try {
    for (const name of suites) {
        log(`\n=== ${name}`);
        const start = performance.now();
        results[name] = await RUNNERS[name]();
        const ref = baseline[name];
        for (const [key, value] of Object.entries(results[name])) {
            const before = ref?.[key];
            if (before === undefined || before === value || !DIRECTION[key]) {
                continue;
            }
            const better = DIRECTION[key] === "more" ? value > before : value < before;
            log(`  ${better ? "MIEUX" : "MOINS BIEN"} : ${key} ${before} → ${value}`);
            regressions += better ? 0 : 1;
        }
        log(`  (${((performance.now() - start) / 1000).toFixed(1)} s)`);
    }
} finally {
    await aria.close();
}

if (update) {
    fs.writeFileSync(baselineFile, `${JSON.stringify({ ...baseline, ...results }, null, 4)}\n`);
    log("\nRéférence mise à jour (baseline.json).");
} else if (regressions) {
    log(`\n${regressions} recul(s) par rapport à la référence.`);
    process.exitCode = 1;
} else {
    log("\nAucun recul par rapport à la référence.");
}
