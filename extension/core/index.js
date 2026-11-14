// Aria Plume — moteur Aria : l'interface unique.
//
//     const aria = createAria(platform);
//     await aria.check({ text, lang: "fr", formal, repetitions, dialect });
//     await aria.translate({ text, from: "fr", to: "en", html, glossary, register, rewrite });
//     await aria.conjugate({ verb: "prendre" });
//     await aria.synonyms({ word: "rapide", lang: "fr" });
//     await aria.close();
//
// Le moteur ne dépend ni de Chrome ni de Node : tout ce qui touche à l'environnement
// (lire un fichier, lancer un worker, importer Bergamot) passe par la plateforme,
// voir platform/browser.js et platform/node.js. Les moteurs sont chargés à la demande, au premier usage :
//   - fr : Grammalecte (worker classique) + règles d'Aria
//   - en : Harper (worker module, WebAssembly) + règles d'Aria
//   - traduction : Bergamot (ses propres workers, WebAssembly) + modèles Mozilla compressés en gzip
//
// Contrat détaillé (entrées, sorties) : voir api.md.

import { prepareGlossary } from "./translate/glossary.js";
import { rewriteSource, fixTarget, harmonizeImperatives, keptTerms, maskNames } from "./translate/rewrite.js";
import { createEnglishThesaurus } from "./en/thesaurus.js";
import { findEnglishRepetitions } from "./en/repetitions.js";
import { prepareText, filterProtected } from "./protect.js";
import { filterNames } from "./shared/names.js";

export const LANGUAGES = ["fr", "en"];
const TRANSLATION_WORKERS = 2;
// Une traduction sans aucun progrès pendant ce délai : moteur de traduction considéré comme bloqué.
const TRANSLATION_STALL_MS = 90000;

const here = (path) => new URL(path, import.meta.url).href;
const PATHS = {
    frWorker: here("./fr/worker.js"),
    enWorker: here("./en/worker.js"),
    thesaurusEn: here("../data/thesaurus-en.json.gz"),
    models: here("../models/registry.json"),
    bergamot: here("../engines/bergamot/translator.js"),
};

// Dialogue avec un worker par messages { id, cmd, payload } → { id, ok, result, error }.
class WorkerClient {
    constructor(port, name) {
        this.port = port;
        this.seq = 0;
        this.pending = new Map();
        port.onMessage(({ id, ok, result, error }) => {
            const entry = this.pending.get(id);
            if (!entry) {
                return;
            }
            this.pending.delete(id);
            ok ? entry.resolve(result) : entry.reject(new Error(error));
        });
        port.onError((cause) => {
            const error = new Error(`Erreur du worker ${name} : ${cause?.message || "chargement impossible"}`);
            for (const entry of this.pending.values()) {
                entry.reject(error);
            }
            this.pending.clear();
        });
    }

    call(cmd, payload = {}) {
        const id = ++this.seq;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.port.post({ id, cmd, payload });
        });
    }
}

async function gunzip(buffer) {
    const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).arrayBuffer();
}

const toHex = (buffer) => Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");

export function createAria(platform) {
    const checkers = {};
    const loadTimes = {};
    const warmPairs = new Set();
    let translatorPromise = null;
    // Traductions en cours : rejetées d'un coup si le moteur de traduction tombe (sinon elles
    // attendraient sans fin). lastProgress : dernière traduction terminée (détection d'un blocage).
    const inflight = new Set();
    let lastProgress = 0;

    // Arrêt d'un traducteur, même à moitié démarré (Bergamot.delete() échoue sur un worker qui n'a
    // pas pu naître). File vidée, plus de nouveaux workers, workers existants arrêtés.
    const retired = new Set();
    function stopTranslator(translator) {
        if (!translator) {
            return;
        }
        translator.queue = [];
        translator.workerLimit = 0;
        for (const entry of translator.workers ?? []) {
            try {
                entry.worker?.terminate();
            } catch {
                // Déjà arrêté.
            }
        }
    }

    function translationFailed(cause) {
        // Sans le détail technique de Bergamot (« (response to initialize(…)) »).
        const message = String(cause?.message ?? cause).replace(/\s*\(response to [\s\S]*\)$/, "");
        const error = new Error(`Le moteur de traduction s'est arrêté (${message}). Réessaie : il redémarre.`);
        const failed = translatorPromise;
        translatorPromise = null;
        failed?.then((translator) => {
            retired.add(translator);
            stopTranslator(translator);
        }).catch(() => {});
        // Sous Node : aussi les workers que Bergamot a perdus (échec au démarrage).
        platform.BergamotWorker?.terminateAll?.();
        for (const reject of inflight) {
            reject(error);
        }
        inflight.clear();
    }

    async function readJson(url, { gzip = false } = {}) {
        let buffer = await platform.readFile(url);
        if (gzip) {
            buffer = await gunzip(buffer);
        }
        return JSON.parse(new TextDecoder().decode(buffer));
    }

    const thesaurusEn = createEnglishThesaurus(() => readJson(PATHS.thesaurusEn, { gzip: true }));
    const englishSynonyms = (word) => thesaurusEn.synonyms(word);

    function getChecker(lang) {
        if (!checkers[lang]) {
            checkers[lang] = (async () => {
                const start = performance.now();
                const port = lang === "fr"
                    ? platform.createWorker(PATHS.frWorker)
                    : platform.createWorker(PATHS.enWorker, { type: "module" });
                const client = new WorkerClient(port, lang);
                await client.call("init");
                loadTimes[lang] = performance.now() - start;
                return client;
            })();
            checkers[lang].catch(() => {
                delete checkers[lang];
            });
        }
        return checkers[lang];
    }

    // Fichier de modèle : décompressé si besoin, puis contrôlé avec l'empreinte publiée par Mozilla.
    async function readModelFile(url, expectedSha256) {
        let buffer = await platform.readFile(url);
        if (url.endsWith(".gz")) {
            buffer = await gunzip(buffer);
        }
        if (expectedSha256) {
            const actual = toHex(await crypto.subtle.digest("SHA-256", buffer));
            if (actual !== expectedSha256) {
                throw new Error(`Empreinte SHA-256 invalide pour ${url}`);
            }
        }
        return buffer;
    }

    function getTranslator() {
        if (!translatorPromise) {
            translatorPromise = (async () => {
                const start = performance.now();
                const registry = await readJson(PATHS.models);
                for (const entry of registry) {
                    for (const file of Object.values(entry.files)) {
                        file.name = new URL(file.name, PATHS.models).href;
                    }
                }
                const { BatchTranslator, TranslatorBacking } = await platform.importModule(PATHS.bergamot);
                // Sous Node, nos workers de traduction remplacent ceux de Bergamot (chemins avec
                // accents, espaces, lettre de lecteur : voir platform/bergamot-node-worker.cjs).
                if (platform.BergamotWorker) {
                    globalThis.Worker = platform.BergamotWorker;
                }

                class LocalBacking extends TranslatorBacking {
                    async loadModelRegistery() {
                        return registry;
                    }

                    async fetch(url, checksum) {
                        return readModelFile(url, checksum);
                    }
                }

                // Traducteur par lots : il traite plusieurs demandes à la fois (page entière) en respectant
                // les priorités (une sélection passe avant les blocs de page). Deux workers suffisent.
                const onerror = (cause) => translationFailed(cause);
                // Les options du chargeur partent dans les workers (copie) : son onerror se pose après.
                const backing = new LocalBacking({ pivotLanguage: null });
                backing.onerror = onerror;
                const translator = new BatchTranslator({ workers: TRANSLATION_WORKERS, batchSize: 8, onerror }, backing);
                loadTimes.translation = performance.now() - start;
                return translator;
            })();
            translatorPromise.catch(() => {
                translatorPromise = null;
            });
        }
        return translatorPromise;
    }

    // Français traduit : tutoiement ou vouvoiement (register), masculin par défaut pour « je »
    // (l'anglais ne dit pas le genre de celui qui parle), par le worker français (Grammalecte).
    const FEMININE_SPEAKER = /\b(?:I['’]m|I\s+am|as)\s+(?:a|an|the|your|his|her|their|my\s+\w+['’]s)\s+(?:\w+\s+)?(?:woman|girl|mother|mom|mum|wife|sister|daughter|aunt|grandmother|grandma|lady|actress|waitress|queen|princess|bride|girlfriend|niece|nun|businesswoman|policewoman|hostess|stewardess)\b|\b(?:I['’]m|I\s+am)\s+(?:pregnant|a\s+mother|a\s+mom)\b/i;
    const FIRST_PERSON = /\b(?:I|I['’]m|I['’]ve|I['’]ll|I['’]d|me|myself)\b/;
    // Relecture du français produit par le modèle : seulement des fautes de grammaire sûres
    // (accords surtout), jamais l'orthographe (noms propres, marques) ni le style.
    const PROOFREAD_SKIP = /maj|capital|typo|neg|pleo|repet|style|apos|esp|nbsp|virg|ponct|eleu|registre/i;
    async function proofread(output, lang) {
        const client = await getChecker(lang);
        const { clean, toOriginal } = prepareText(output);
        if (toOriginal) {
            return output;
        }
        const result = await client.call("check", { text: clean, dialect: "american", formal: false, repetitions: 0 });
        const edits = [];
        for (const m of filterProtected(output, result.matches).sort((a, b) => a.start - b.start)) {
            if (m.kind !== "grammaire" || !m.suggestions?.length || PROOFREAD_SKIP.test(m.rule ?? "") || edits.some((e) => e.start < m.end && m.start < e.end)) {
                continue;
            }
            edits.push({ start: m.start, end: m.end, text: m.suggestions[0] });
        }
        let fixed = output;
        for (const e of edits.sort((a, b) => b.start - a.start)) {
            fixed = fixed.slice(0, e.start) + e.text + fixed.slice(e.end);
        }
        return fixed;
    }

    async function finishFrench(output, source, register) {
        const masculine = !FEMININE_SPEAKER.test(source) && FIRST_PERSON.test(source);
        const target = ["tu", "vous", "auto"].includes(register) ? register : null;
        let text = output;
        try {
            if (masculine || target) {
                const client = await getChecker("fr");
                const result = await client.call("register", { text, target, masculine });
                text = result?.text ?? text;
            }
            text = await proofread(text, "fr");
        } catch (error) {
            if (globalThis.process?.env?.ARIA_DEBUG) {
                console.error("finition du français :", error);
            }
        }
        return text;  // au pire le texte du modèle, plutôt qu'une erreur
    }

    return {
        // Fautes d'un texte. repetitions : distance en mots (0 = pas de répétitions).
        async check({ text, lang, dialect, formal = false, repetitions = 0 }) {
            if (!LANGUAGES.includes(lang)) {
                throw new Error(`Langue non prise en charge : ${lang}`);
            }
            const cold = !checkers[lang];
            const client = await getChecker(lang);
            const distance = Number(repetitions) || 0;
            // Texte nettoyé (invisibles retirés, accents recomposés) ; positions ramenées ensuite.
            const { clean, toOriginal } = prepareText(String(text ?? ""));
            const result = await client.call("check", { text: clean, dialect, formal: !!formal, repetitions: distance });
            // Le worker français trouve lui-même les répétitions (il a les lemmes) ; pour l'anglais, c'est ici.
            if (lang === "en" && distance > 0) {
                result.matches.push(...await findEnglishRepetitions(clean, distance, result.matches, englishSynonyms));
            }
            let matches = toOriginal ? result.matches.map((m) => ({ ...m, ...toOriginal(m.start, m.end) })) : result.matches;
            // Code, adresses, chemins, identifiants : rien à corriger.
            matches = filterProtected(text, matches).sort((a, b) => a.start - b.start);
            // Noms propres (marques, personnes, lieux) et grossièretés : pas des fautes.
            matches = filterNames(text, matches, lang);
            return { matches, engineMs: result.ms, loadMs: cold ? loadTimes[lang] : 0, cold };
        },

        // Traduction, avec le glossaire ({ glossary, keepTerms }) appliqué s'il est fourni.
        // Texte brut (pas en HTML) : réécritures avant et après le modèle (rewrite, par défaut),
        // registre du français (register : "tu", "vous", "auto" = le plus présent, null = rien).
        async translate({ text, from, to, html = false, glossary, priority, jobId, register = null, rewrite = true }) {
            const cold = !translatorPromise;
            const translator = await getTranslator();
            const pair = `${from}-${to}`;
            const pairCold = !warmPairs.has(pair);
            const start = performance.now();
            const original = String(text ?? "");
            const plain = !html && rewrite !== false;
            text = plain ? rewriteSource(original, from) : original;
            // Prénoms et marques qui sont aussi des mots : cachés au modèle, remis après.
            const masked = plain ? maskNames(text, from) : null;
            text = masked ? masked.text : text;
            // Adresses, courriels, code, chemins, identifiants : recopiés tels quels (le modèle les abîme).
            const kept = plain ? keptTerms(text) : [];
            const glossaryData = kept.length ? { glossary: glossary?.glossary ?? [], keepTerms: [...(glossary?.keepTerms ?? []), ...kept] } : glossary;
            const prepared = prepareGlossary({ text, html, from, to, glossary: glossaryData });
            let reject;
            let timer;
            const failure = new Promise((_, fail) => {
                reject = fail;
                inflight.add(fail);
                // Filet de sécurité : rien n'a avancé depuis le début de cette demande.
                const watch = () => {
                    timer = setTimeout(() => {
                        if (lastProgress > start) {
                            watch();
                        } else {
                            translationFailed(new Error("aucune réponse"));
                        }
                    }, TRANSLATION_STALL_MS);
                };
                watch();
            });
            let response;
            try {
                response = await Promise.race([translator.translate({
                    from,
                    to,
                    text: prepared ? prepared.html : text,
                    html: prepared ? true : !!html,
                    priority: priority ?? 0,
                    jobId: jobId ?? null,
                }), failure]);
            } finally {
                clearTimeout(timer);
                inflight.delete(reject);
            }
            lastProgress = performance.now();
            warmPairs.add(pair);
            let output = prepared ? prepared.finish(response.target.text) : response.target.text;
            output = masked ? masked.restore(output) : output;
            if (plain) {
                output = fixTarget(output, to, { source: original });
                if (to === "fr" && output.trim()) {
                    output = await finishFrench(output, original, register);
                    output = harmonizeImperatives(output);
                }
            }
            return {
                text: output,
                glossaryHits: glossary ? prepared?.hits ?? 0 : 0,
                engineMs: performance.now() - start,
                loadMs: cold ? loadTimes.translation : 0,
                cold,
                pairCold,
            };
        },

        // Abandonne les blocs encore en file d'attente d'une traduction de page arrêtée.
        async cancelTranslation(jobId) {
            if (translatorPromise && jobId) {
                const translator = await translatorPromise;
                translator.remove((request) => request.jobId === jobId);
            }
        },

        async conjugate({ verb, options = {} }) {
            const client = await getChecker("fr");
            return client.call("conjugate", { verb, options });
        },

        async synonyms({ word, lang = "fr" }) {
            if (lang === "en") {
                return englishSynonyms(word);
            }
            const client = await getChecker("fr");
            return client.call("synonyms", { word });
        },

        // Banc de mesure : les règles françaises d'Aria seules, sans Grammalecte ni filtrage.
        async rulesFr({ text, formal = false }) {
            const client = await getChecker("fr");
            return client.call("rules", { text, formal });
        },

        // Mise au point : étiquettes du dictionnaire français pour une liste de mots.
        async morphFr(words) {
            const client = await getChecker("fr");
            return client.call("morph", { words });
        },

        // Arrête les workers (indispensable sous Node pour que le programme se termine).
        async close() {
            const clients = await Promise.allSettled(Object.values(checkers));
            for (const { value } of clients) {
                value?.port.terminate();
            }
            for (const lang of Object.keys(checkers)) {
                delete checkers[lang];
            }
            if (translatorPromise) {
                stopTranslator(await translatorPromise.catch(() => null));
                translatorPromise = null;
            }
            for (const translator of retired) {
                stopTranslator(translator);
            }
            retired.clear();
            platform.BergamotWorker?.terminateAll?.();
        },

        // Moteurs chargés et temps de chargement (ms).
        info() {
            return {
                platform: platform.name,
                loaded: { fr: !!checkers.fr, en: !!checkers.en, translation: !!translatorPromise },
                loadTimes: { ...loadTimes },
            };
        },
    };
}
