// Évaluation du banc « textes » (voir textes.mjs) : partagée par le banc sous Node
// (tests/bench/run.mjs) et par le passage dans l'application (app/tests/bench-textes.mjs).

const MARK = /\{\{(.+?)=>(.*?)\|(\w+)\}\}/g;
// Apostrophes et espaces : ’ et ' se valent, comme les espaces insécables et ordinaires.
const normalize = (text) => text.replace(/’/g, "'").replace(/[  ]/g, " ");
const COUNTED = new Set(["orthographe", "grammaire"]);

// Texte fautif, texte juste et zones fautives (positions dans le texte fautif).
export function parse(source) {
    let wrong = "";
    let right = "";
    let last = 0;
    const zones = [];
    for (const match of source.matchAll(MARK)) {
        const plain = source.slice(last, match.index);
        wrong += plain;
        right += plain;
        zones.push({ start: wrong.length, end: wrong.length + match[1].length, wrong: match[1], right: match[2], cat: match[3] });
        wrong += match[1];
        right += match[2];
        last = match.index + match[0].length;
    }
    wrong += source.slice(last);
    right += source.slice(last);
    return { wrong, right, zones };
}

const overlaps = (a, b) => a.start < b.end && a.end > b.start;

// Le texte fautif où seules les zones données sont corrigées.
function fixZones(wrong, zones) {
    let out = wrong;
    for (const zone of [...zones].sort((a, b) => b.start - a.start)) {
        out = out.slice(0, zone.start) + zone.right + out.slice(zone.end);
    }
    return out;
}

// Applique des corrections (non chevauchantes) au texte.
function applyAll(text, edits) {
    let out = text;
    for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
        out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
    }
    return out;
}

// Résultat d'un texte : pour chaque zone, trouvée / bien corrigée / correction en tête,
// les fausses alertes, et la correction « en un clic » (première suggestion partout).
export function evaluate({ wrong, right, zones }, matches) {
    const zoneResults = zones.map((zone) => ({ ...zone, found: false, fixed: false, first: false }));
    const falseAlerts = [];
    const outsideRemarks = [];
    for (const match of matches) {
        const touched = zoneResults.filter((zone) => overlaps(match, zone));
        if (!touched.length) {
            (COUNTED.has(match.kind) ? falseAlerts : outsideRemarks).push(match);
            continue;
        }
        const target = normalize(fixZones(wrong, touched));
        let rank = -1;
        match.suggestions.forEach((suggestion, index) => {
            const candidate = normalize(wrong.slice(0, match.start) + suggestion + wrong.slice(match.end));
            if (rank === -1 && candidate === target) {
                rank = index;
            }
        });
        for (const zone of touched) {
            zone.found = true;
            zone.fixed ||= rank >= 0;
            zone.first ||= rank === 0;
        }
    }
    // « Tout corriger » : première suggestion de chaque alerte d'orthographe ou de grammaire,
    // et des remarques de typographie qui touchent une faute (on laisse de côté le reste).
    const edits = [];
    for (const match of [...matches].sort((a, b) => a.start - b.start)) {
        const useful = COUNTED.has(match.kind) || zoneResults.some((zone) => overlaps(match, zone));
        if (!useful || match.suggestions.length === 0 || edits.some((edit) => overlaps(edit, match))) {
            continue;
        }
        edits.push({ start: match.start, end: match.end, text: match.suggestions[0] });
    }
    const oneClick = normalize(applyAll(wrong, edits)) === normalize(right);
    return { zones: zoneResults, falseAlerts, outsideRemarks, oneClick };
}

// Totaux et détail par catégorie et par langue.
export function summarize(results) {
    const total = { texts: results.length, zones: 0, found: 0, fixed: 0, first: 0, falseAlerts: 0, oneClick: 0 };
    const byCat = {};
    const byLang = {};
    for (const result of results) {
        total.falseAlerts += result.falseAlerts.length;
        total.oneClick += result.oneClick ? 1 : 0;
        const lang = (byLang[result.lang] ??= { texts: 0, zones: 0, found: 0, fixed: 0, first: 0, falseAlerts: 0, oneClick: 0 });
        lang.texts += 1;
        lang.falseAlerts += result.falseAlerts.length;
        lang.oneClick += result.oneClick ? 1 : 0;
        for (const zone of result.zones) {
            const cat = (byCat[`${result.lang}:${zone.cat}`] ??= { zones: 0, found: 0, fixed: 0, first: 0 });
            for (const bucket of [total, cat, lang]) {
                bucket.zones += 1;
                bucket.found += zone.found ? 1 : 0;
                bucket.fixed += zone.fixed ? 1 : 0;
                bucket.first += zone.first ? 1 : 0;
            }
        }
    }
    return { total, byCat, byLang };
}

const pct = (a, b) => (b ? `${Math.round((100 * a) / b)} %` : "—");

export function report({ total, byCat, byLang }) {
    const lines = [];
    lines.push(`  ${total.texts} textes, ${total.zones} fautes`);
    lines.push(`  trouvées ${total.found}/${total.zones} (${pct(total.found, total.zones)}) · bonne correction proposée ${total.fixed} (${pct(total.fixed, total.zones)}) · en 1re position ${total.first} (${pct(total.first, total.zones)})`);
    lines.push(`  fausses alertes ${total.falseAlerts} · textes entièrement corrigés en un clic ${total.oneClick}/${total.texts} (${pct(total.oneClick, total.texts)})`);
    for (const [lang, b] of Object.entries(byLang)) {
        lines.push(`  ${lang} : ${b.texts} textes · trouvées ${pct(b.found, b.zones)} · bien corrigées ${pct(b.fixed, b.zones)} · en tête ${pct(b.first, b.zones)} · fausses alertes ${b.falseAlerts} · un clic ${pct(b.oneClick, b.texts)}`);
    }
    for (const [cat, b] of Object.entries(byCat).sort()) {
        lines.push(`    ${cat.padEnd(10)} ${String(b.zones).padStart(3)} fautes · trouvées ${pct(b.found, b.zones).padStart(5)} · bien corrigées ${pct(b.fixed, b.zones).padStart(5)} · en tête ${pct(b.first, b.zones).padStart(5)}`);
    }
    return lines.join("\n");
}

// Détail des ratés, pour le mode bavard.
export function misses(result) {
    const out = [];
    for (const zone of result.zones) {
        if (!zone.first) {
            out.push(`    ${zone.found ? (zone.fixed ? "2e RANG " : "MAUVAISE") : "RATÉE   "} [${zone.cat}] «${zone.wrong}» → «${zone.right}»`);
        }
    }
    for (const match of result.falseAlerts) {
        out.push(`    FAUSSE   «${result.wrong.slice(match.start, match.end)}» → ${match.suggestions.slice(0, 3).join(" | ")} [${match.rule}]`);
    }
    return out;
}
