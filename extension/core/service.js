// Aria Plume — service du moteur Aria : ce qu'il y a entre une demande (« vérifie ce champ »,
// « traduis ce texte ») et les moteurs. Partagé par l'extension (service worker) et l'application.
//   - détection du français et de l'anglais
//   - réglages appliqués : dialecte, français soigné, répétitions, dictionnaire personnel, glossaire
//   - traduction ligne par ligne, synonymes dans la langue de la phrase, fautes récurrentes
//
//     const service = createService({ aria, getSettings, saveValues, detectNative });
//
//   aria          moteur (createAria) ou tout objet qui offre check, translate, conjugate,
//                 synonyms et cancelTranslation (l'extension passe par son document offscreen)
//   getSettings   (valeurs par défaut) → Promise des réglages, comme chrome.storage.local.get
//   saveValues    (objet) → Promise : enregistre des valeurs (fautes récurrentes)
//   detectNative  facultatif : (texte) → Promise<{ isReliable, languages: [{ language, percentage }] }>,
//                 le détecteur du navigateur (chrome.i18n.detectLanguage)

import { DEFAULTS, formalFor } from "./shared/settings.js";
import { addMistakes } from "./shared/mistakes.js";

// Détection de langue. Le détecteur du navigateur se trompe souvent sur les textes courts
// (« Please restart the backup service tonight. » → finnois, « Hello » → serbe). Comme seuls
// le français et l'anglais nous intéressent, on le complète par un comptage de mots-outils.
const FR_WORDS = new Set(("le la les un une des du de et est sont pas ne que qui quoi je tu il elle nous vous ils elles "
    + "ce cette ces mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs pour dans sur avec mais ou donc car au aux "
    + "y été être avoir fait très bien merci bonjour salut oui non l d j qu n c m peux veux faut aussi plus moins comme").split(" "));
const EN_WORDS = new Set(("the an and is are was were be been being not that which who what i you he she it we they this these "
    + "those my your his her its our their for in with but or so to of at by from have has had do does did will would can could "
    + "should please thanks thank hello hi yes no don isn aren won can't there here just also more less like").split(" "));

export function guessFrenchOrEnglish(text) {
    const words = text.toLowerCase().split(/[^a-zà-ÿœæ]+/u).filter(Boolean);
    let fr = 0;
    let en = 0;
    for (const word of words) {
        if (FR_WORDS.has(word)) {
            fr++;
        }
        if (EN_WORDS.has(word)) {
            en++;
        }
    }
    fr += Math.min(3, (text.match(/[éèêàçùûôîœ]/giu) ?? []).length * 0.5);
    if (fr === en) {
        return null;
    }
    return fr > en ? "fr" : "en";
}

// Distance d'édition avec transposition (« sytemd » → « systemd » : une seule faute de frappe).
function editDistance(a, b, limit) {
    if (Math.abs(a.length - b.length) > limit) {
        return limit + 1;
    }
    const rows = [Array.from({ length: b.length + 1 }, (_, j) => j)];
    for (let i = 1; i <= a.length; i++) {
        rows[i] = [i];
        let best = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            let value = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                value = Math.min(value, rows[i - 2][j - 2] + 1);
            }
            rows[i][j] = value;
            best = Math.min(best, value);
        }
        if (best > limit) {
            return limit + 1;
        }
    }
    return rows[a.length][b.length];
}

// Fautes d'orthographe proches d'un mot du dictionnaire personnel : ce mot passe en tête des suggestions.
function suggestFromDictionary(matches, text, dictionary) {
    if (!Array.isArray(matches) || !Array.isArray(dictionary) || dictionary.length === 0) {
        return;
    }
    for (const match of matches) {
        if (match.kind !== "orthographe") {
            continue;
        }
        const word = text.slice(match.start, match.end).trim();
        if (word.length < 3) {
            continue;
        }
        const limit = word.length <= 5 ? 1 : 2;
        const close = dictionary
            .map((entry) => ({ entry, d: editDistance(word.toLowerCase(), entry.toLowerCase(), limit) }))
            .filter((x) => x.d <= limit && x.d > 0)
            .sort((x, y) => x.d - y.d)
            .slice(0, 3)
            .map((x) => x.entry);
        if (close.length > 0) {
            match.suggestions = [...new Set([...close, ...match.suggestions])].slice(0, 6);
        }
    }
}

const NO_DETECTION = { isReliable: false, languages: [] };

// Filtre personnel, comme dans les pages (content/checker.js) : mots du dictionnaire (un mot en
// minuscules vaut pour toutes les casses, un mot avec majuscules garde les siennes ou passe tout
// en capitales), fautes ignorées (mot + règle) et catégories décochées.
export function personalFilter({ dictionary = [], ignored = [], disabledKinds = [] } = {}) {
    const lower = new Set();
    const exact = new Set();
    for (const word of dictionary) {
        if (typeof word === "string" && word.trim()) {
            const w = word.trim();
            (w === w.toLowerCase() ? lower : exact).add(w);
        }
    }
    const ignoredKeys = new Set(ignored.filter((e) => e && typeof e.word === "string").map((e) => `${e.word}|${e.rule}`));
    const disabled = new Set(disabledKinds);
    const inDictionary = (word) => lower.has(word.toLowerCase()) || exact.has(word) || [...exact].some((entry) => entry.toUpperCase() === word);
    return (match, text) => {
        const word = text.slice(match.start, match.end).trim();
        return !ignoredKeys.has(`${word}|${match.rule}`) && !disabled.has(match.kind) && !(match.kind === "orthographe" && inDictionary(word));
    };
}

export function createService({ aria, getSettings, saveValues, detectNative = null }) {
    async function detectLanguage(text) {
        const result = detectNative ? (await detectNative(text).catch(() => NO_DETECTION)) ?? NO_DETECTION : NO_DETECTION;
        const languages = result.languages ?? [];
        const best = languages
            .filter((l) => ["fr", "en"].includes(l.language.slice(0, 2)))
            .sort((a, b) => b.percentage - a.percentage)[0];
        const bestLang = best?.language.slice(0, 2) ?? null;
        if (bestLang && result.isReliable) {
            return { lang: bestLang, supported: true, reliable: true, source: "chrome.i18n", raw: languages };
        }
        const guess = guessFrenchOrEnglish(text);
        if (guess) {
            return { lang: guess, supported: true, reliable: false, source: "mots-outils", raw: languages };
        }
        // Rien de concluant : on prend l'avis du navigateur s'il penche pour le français ou l'anglais,
        // sauf s'il est sûr de lui pour une autre langue.
        const otherReliable = result.isReliable && languages.length > 0;
        if (bestLang && !otherReliable) {
            return { lang: bestLang, supported: true, reliable: false, source: "chrome.i18n (peu fiable)", raw: languages };
        }
        return { lang: "fr", supported: false, reliable: false, source: "langue non reconnue", raw: languages };
    }

    // Vérification avec les réglages. host : site d'où vient le texte (français soigné par site) ;
    // formal : impose (ou non) le français soigné ; personal : applique dictionnaire, mots ignorés
    // et catégories décochées (les pages le font elles-mêmes, le serveur MCP le demande ici).
    async function check({ text, lang, host = "", formal = null, personal = false }) {
        let detection = null;
        if (lang === "auto") {
            detection = await detectLanguage(text);
            lang = detection.lang;
        }
        const settings = await getSettings({ englishDialect: "american", dictionary: [], formalFrench: DEFAULTS.formalFrench, formalHosts: DEFAULTS.formalHosts, casualHosts: DEFAULTS.casualHosts, repetitions: true, repetitionDistance: 30 });
        const distance = settings.repetitions === true ? Math.min(60, Math.max(10, Number(settings.repetitionDistance) || 30)) : 0;
        const result = await aria.check({ lang, text, dialect: settings.englishDialect, formal: typeof formal === "boolean" ? formal : formalFor(host, settings), repetitions: distance });
        // Les mots du dictionnaire personnel (Elegoo, systemd…) ne comptent pas comme répétitions.
        const known = new Set(settings.dictionary.map((w) => w.toLowerCase()));
        result.matches = result.matches.filter((m) => m.rule !== "aria_repetition" || !known.has(text.slice(m.start, m.end).toLowerCase()));
        suggestFromDictionary(result.matches, text, settings.dictionary);
        if (personal) {
            const keep = personalFilter(await getSettings({ dictionary: [], ignored: [], disabledKinds: [] }));
            result.matches = result.matches.filter((m) => keep(m, text));
        }
        return { ...result, lang, detection };
    }

    // Sens de traduction : détecté sur le texte, avec la langue de la page comme indice
    // pour les sélections trop courtes pour être reconnues (un mot, un titre…).
    async function resolvePair({ text, from, to, hint }) {
        if (from && from !== "auto") {
            return { from, to: to ?? (from === "fr" ? "en" : "fr"), detection: null };
        }
        const detection = await detectLanguage(text);
        let source = detection.supported ? detection.lang : null;
        if (!source && ["fr", "en"].includes(hint)) {
            source = hint;
        }
        if (!source) {
            throw new Error("Langue non prise en charge : seuls le français et l'anglais sont disponibles.");
        }
        return { from: source, to: source === "fr" ? "en" : "fr", detection };
    }

    async function translate(msg) {
        const { from, to, detection } = await resolvePair(msg);
        const { glossary, keepTerms } = await getSettings({ glossary: [], keepTerms: [] });
        const glossaryData = glossary.length || keepTerms.length ? { glossary, keepTerms } : null;
        const common = { from, to, html: !!msg.html, priority: msg.priority ?? 0, jobId: msg.jobId ?? null, glossary: glossaryData };
        // Texte brut sur plusieurs lignes : chaque ligne est traduite à part, les sauts de ligne restent en place.
        const lines = msg.html ? [msg.text] : msg.text.split("\n");
        if (lines.length > 1) {
            const results = await Promise.all(lines.map((line) => (line.trim() === ""
                ? Promise.resolve({ text: line, engineMs: 0 })
                : aria.translate({ ...common, text: line }))));
            return {
                text: results.map((r) => r.text).join("\n"),
                engineMs: Math.max(...results.map((r) => r.engineMs ?? 0)),
                pairCold: results.some((r) => r.pairCold),
                loadMs: Math.max(...results.map((r) => r.loadMs ?? 0)),
                glossaryHits: results.reduce((sum, r) => sum + (r.glossaryHits ?? 0), 0),
                from,
                to,
                detection,
            };
        }
        const result = await aria.translate({ ...common, text: msg.text });
        return { ...result, from, to, detection };
    }

    // Synonymes : la langue vient de la phrase autour du mot (un mot seul se reconnaît mal).
    // Si le thésaurus de cette langue ne connaît pas le mot, on essaie l'autre.
    async function synonyms({ word: raw, context, hint }) {
        const word = String(raw ?? "").trim().slice(0, 80);
        if (!word) {
            throw new Error("Aucun mot à chercher.");
        }
        const detection = await detectLanguage(context || word);
        const lang = detection.supported ? detection.lang : ["fr", "en"].includes(hint) ? hint : "fr";
        const first = await aria.synonyms({ lang, word });
        if (first.groups?.length) {
            return { ...first, lang };
        }
        const other = lang === "fr" ? "en" : "fr";
        const second = await aria.synonyms({ lang: other, word });
        return second.groups?.length ? { ...second, lang: other } : { ...first, lang };
    }

    function conjugate({ verb, options }) {
        return aria.conjugate({ verb: String(verb ?? "").slice(0, 60), options: options ?? {} });
    }

    // Fautes récurrentes : les écritures passent l'une après l'autre (plusieurs onglets peuvent corriger en même temps).
    let mistakeQueue = Promise.resolve();
    function recordMistakes(items) {
        mistakeQueue = mistakeQueue.then(async () => {
            const { trackMistakes, mistakeStats, mistakeStatsSince } = await getSettings({ trackMistakes: true, mistakeStats: {}, mistakeStatsSince: null });
            if (trackMistakes !== true || !Array.isArray(items) || items.length === 0) {
                return;
            }
            await saveValues({
                mistakeStats: addMistakes(mistakeStats, items.slice(0, 200)),
                mistakeStatsSince: mistakeStatsSince ?? new Date().toISOString(),
            });
        }).catch(() => {});
        return mistakeQueue;
    }

    return { detectLanguage, check, translate, synonyms, conjugate, recordMistakes };
}
