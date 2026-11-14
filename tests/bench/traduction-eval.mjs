// Évaluation du banc « traduction » (traduction.mjs, traduction-controle.mjs).
//
// Chaque phrase dit ce qu'une bonne traduction doit contenir (`must` : des groupes de formes
// acceptées, au moins une par groupe), ce qu'elle ne doit pas contenir (`not` : contresens et
// traductions mot à mot) et, vers le français, le registre attendu (`register` : tu ou vous).
// S'y ajoute le chrF, distance en caractères avec les traductions de référence (`ref`) :
// moins parlant qu'un œil humain, mais il voit les reculs d'ensemble.

const normalize = (text) => String(text ?? "")
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”]/g, "\"")
    .replace(/[   ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

// Formes du tutoiement et du vouvoiement dans un texte français.
const TU = /(?<![\p{L}'])(?:tu|te|toi|ton|ta|tes|tien|tienne|tiens|tiennes)(?![\p{L}'])|(?<![\p{L}])t'(?=\p{L})|-(?:toi|tu)(?![\p{L}])/iu;
const VOUS = /(?<![\p{L}'])(?:vous|votre|vos|vôtre|vôtres)(?![\p{L}'])/iu;

export function registerOf(text) {
    const tu = TU.test(text);
    const vous = VOUS.test(text);
    return tu && vous ? "mixte" : tu ? "tu" : vous ? "vous" : null;
}

// Une forme cherchée : comme le texte, mais sans rogner les espaces de bord (« promu » suivi d'une
// espace interdit le masculin sans interdire « promue »).
const normalizeForm = (form) => String(form ?? "")
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”]/g, "\"")
    .replace(/[   ]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();

// Une phrase : sens respecté (must/not) et registre.
export function judge(phrase, output) {
    const out = ` ${normalize(output)} `;
    const missing = (phrase.must ?? []).filter((group) => !group.some((form) => out.includes(normalizeForm(form))));
    const forbidden = (phrase.not ?? []).filter((form) => out.includes(normalizeForm(form)));
    let register = true;
    if (phrase.register && phrase.from === "en") {
        const found = registerOf(output);
        register = found === null || found === phrase.register;
    }
    return { ok: !missing.length && !forbidden.length && register, missing, forbidden, register };
}

// --- chrF (Popović 2015), n-grammes de caractères 1 à 6, β = 2, espaces ignorés ---
const N = 6;
const BETA = 2;

function grams(text, n) {
    const chars = [...normalize(text).replace(/ /g, "")];
    const counts = new Map();
    for (let i = 0; i + n <= chars.length; i++) {
        const gram = chars.slice(i, i + n).join("");
        counts.set(gram, (counts.get(gram) ?? 0) + 1);
    }
    return counts;
}

// Statistiques d'une paire (hypothèse, référence) : pour chaque n, [communs, hypothèse, référence].
function stats(hyp, ref) {
    const out = [];
    for (let n = 1; n <= N; n++) {
        const h = grams(hyp, n);
        const r = grams(ref, n);
        let common = 0;
        let totalH = 0;
        let totalR = 0;
        for (const [gram, count] of h) {
            totalH += count;
            common += Math.min(count, r.get(gram) ?? 0);
        }
        for (const count of r.values()) {
            totalR += count;
        }
        out.push([common, totalH, totalR]);
    }
    return out;
}

function score(stat) {
    let precision = 0;
    let recall = 0;
    let used = 0;
    for (const [common, h, r] of stat) {
        if (!h || !r) {
            continue;
        }
        precision += common / h;
        recall += common / r;
        used++;
    }
    if (!used) {
        return 0;
    }
    precision /= used;
    recall /= used;
    if (!precision && !recall) {
        return 0;
    }
    const b2 = BETA * BETA;
    return (100 * (1 + b2) * precision * recall) / (b2 * precision + recall);
}

// Meilleure référence pour une phrase (statistiques gardées pour le score d'ensemble).
export function bestStats(output, refs) {
    let best = null;
    for (const ref of refs) {
        const s = stats(output, ref);
        const value = score(s);
        if (!best || value > best.value) {
            best = { stats: s, value };
        }
    }
    return best;
}

// chrF d'ensemble : somme des statistiques de toutes les phrases.
export function corpusChrf(allStats) {
    const total = Array.from({ length: N }, () => [0, 0, 0]);
    for (const s of allStats) {
        s.forEach(([c, h, r], i) => {
            total[i][0] += c;
            total[i][1] += h;
            total[i][2] += r;
        });
    }
    return score(total);
}

// Résumé d'une série : par sens et par genre.
export function summarize(rows) {
    const bucket = () => ({ phrases: 0, ok: 0, register: 0, registerTotal: 0, stats: [] });
    const total = bucket();
    const bySide = {};
    const byGenre = {};
    for (const row of rows) {
        const side = `${row.phrase.from}→${row.phrase.from === "fr" ? "en" : "fr"}`;
        for (const b of [total, (bySide[side] ??= bucket()), (byGenre[`${side} ${row.phrase.genre ?? "?"}`] ??= bucket())]) {
            b.phrases++;
            b.ok += row.verdict.ok ? 1 : 0;
            if (row.phrase.register && row.phrase.from === "en") {
                b.registerTotal++;
                b.register += row.verdict.register ? 1 : 0;
            }
            b.stats.push(row.best.stats);
        }
    }
    const finish = (b) => ({ phrases: b.phrases, ok: b.ok, register: b.register, registerTotal: b.registerTotal, chrf: Math.round(corpusChrf(b.stats) * 10) / 10 });
    return {
        total: finish(total),
        bySide: Object.fromEntries(Object.entries(bySide).map(([k, b]) => [k, finish(b)])),
        byGenre: Object.fromEntries(Object.entries(byGenre).sort().map(([k, b]) => [k, finish(b)])),
    };
}

const pct = (a, b) => (b ? `${Math.round((100 * a) / b)} %` : "—");

export function report({ total, bySide, byGenre }, { genres = false } = {}) {
    const lines = [];
    lines.push(`  ${total.phrases} phrases · sens respecté ${total.ok}/${total.phrases} (${pct(total.ok, total.phrases)}) · registre tu/vous ${total.register}/${total.registerTotal} · chrF ${total.chrf}`);
    for (const [side, b] of Object.entries(bySide)) {
        lines.push(`  ${side} : ${b.phrases} phrases · sens respecté ${pct(b.ok, b.phrases)} · chrF ${b.chrf}${b.registerTotal ? ` · registre ${b.register}/${b.registerTotal}` : ""}`);
    }
    if (genres) {
        for (const [genre, b] of Object.entries(byGenre)) {
            lines.push(`    ${genre.padEnd(18)} ${String(b.phrases).padStart(3)} · sens ${pct(b.ok, b.phrases).padStart(5)} · chrF ${b.chrf}`);
        }
    }
    return lines.join("\n");
}
