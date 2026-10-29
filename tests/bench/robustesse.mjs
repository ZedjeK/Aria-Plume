// Tests de robustesse du moteur Aria : textes limites (vides, énormes, emojis, CRLF, code, URL,
// Markdown, capitales, insécables, accents décomposés, autres écritures…). Pour chaque texte et
// chaque langue, on vérifie :
//   - pas de plantage, réponse en temps raisonnable ;
//   - positions valides (dans le texte, début < fin, sans couper un emoji ni un accent décomposé) ;
//   - suggestions : des chaînes, différentes du texte souligné ;
//   - même résultat à la deuxième analyse (déterminisme) ;
//   - rien de souligné dans le code, les adresses web, les courriels et les chemins ;
//   - « tout corriger » (première suggestion partout) ne fait pas apparaître de nouvelle faute
//     d'orthographe ou de grammaire là où il n'y en avait pas (corrections qui se contredisent).
//
//     node tests/bench/robustesse.mjs [-v]

import { createAria } from "../../extension/core/index.js";
import { nodePlatform } from "../../extension/core/platform/node.js";

const verbose = process.argv.includes("-v");
const aria = createAria(nodePlatform);
let failures = 0;
const problems = [];
const fail = (label, detail) => {
    failures++;
    problems.push(`ÉCHEC ${label} : ${detail}`);
};

const LONG_FR = "Le serveur de fichiers a redémarré cette nuit à cause d'une mise à jour du noyau. Les utilisateurs ont été prévenus par courriel. ".repeat(400);
const LONG_EN = "The file server restarted last night because of a kernel update. Users were notified by email. ".repeat(400);

// [nom, texte, zones protégées (sous-chaînes où rien ne doit être souligné)]
const CASES = [
    ["vide", "", []],
    ["espace", " ", []],
    ["sauts de ligne", "\n\n\n", []],
    ["un caractère", "a", []],
    ["ponctuation seule", "?!?!... ;;; ---", []],
    ["emojis seuls", "🎉😊👍🏽🇫🇷", []],
    ["emojis au milieu", "Bravo 🎉 pour ta promotion 😊, tu l'as bien mérité 👍🏽 !", []],
    ["emoji collé", "Merci🙏 pour tout💙", []],
    ["CRLF", "Bonjour,\r\nJe vous envoi le fichier.\r\nCordialement,", []],
    ["tabulations", "Nom\tPrénom\tVille\nDupont\tMarc\tLyon", []],
    ["insécables", "Il est 14\u00a0h\u202f; tu viens\u00a0? Oui\u202f!", []],
    ["espace de largeur nulle", "Le ser\u200bveur est tom\u200bbé.", []],
    ["accents décomposés", "Le cafe\u0301 est fermé. Il a ete\u0301 vendu.", []],
    ["capitales", "ATTENTION : LE SERVEUR SERA ÉTEINT DEMAIN À 22 H POUR MAINTENANCE.", []],
    ["mot très long", `${"a".repeat(2000)} est un mot.`, []],
    ["chiffres", "3,14 ; 1 000 000 ; 12/03/2026 ; 10:45 ; 192.168.1.1 ; v2.3.1 ; 4K ; 64 Go", []],
    ["code en ligne", "Lance `systemctl restat nginx` puis `journalctl -xe`.", ["systemctl restat nginx", "journalctl -xe"]],
    ["bloc de code", "Voici le script :\n```bash\nfor f in *.log; do gzip \"$f\"; done\necho fini\n```\nÇa marche.", ["for f in *.log; do gzip \"$f\"; done", "echo fini"]],
    ["URL", "Va sur https://www.exemple.fr/docs/instalation?lang=fr&mode=avancé pour la suite.", ["https://www.exemple.fr/docs/instalation?lang=fr&mode=avancé"]],
    ["www", "Le site www.monsiteperso.fr est en panne.", ["www.monsiteperso.fr"]],
    ["courriel", "Écris à jean.dupond@entreprize.fr pour le badge.", ["jean.dupond@entreprize.fr"]],
    ["chemins", "Le fichier /etc/nginx/sites-availables/defaut et C:\\Users\\zeman\\Desktop\\Aria-Plume sont prêts.", ["/etc/nginx/sites-availables/defaut", "C:\\Users\\zeman\\Desktop\\Aria-Plume"]],
    ["partage réseau", "Copie tout dans \\\\srv-fic-01\\partage\\compta avant midi.", ["\\\\srv-fic-01\\partage\\compta"]],
    ["identifiants", "Les VLAN vlan-20 et vlan-30 passent par eth0 et le switch sw-core-01.", ["vlan-20", "vlan-30", "eth0", "sw-core-01"]],
    ["snake_case", "La variable max_retry_count vaut 3.", ["max_retry_count"]],
    ["Markdown", "# Titre\n\n- **Gras** et *italique*\n- [lien](https://exemple.fr/page)\n> citation\n\n1. Premier\n2. Second", ["https://exemple.fr/page"]],
    ["HTML", "<p>Le <b>serveur</b> est <i>arrêté</i>.</p>", []],
    ["mentions", "Merci @jeremy et #teamInfra pour le coup de main !", []],
    ["guillemets déséquilibrés", "Il a dit « je reviens et il n'est jamais revenu.", []],
    ["japonais", "東京は大きい都市です。", []],
    ["coréen", "서울은 아름다워요.", []],
    ["arabe", "مرحبا بكم في الموقع.", []],
    ["mélange FR/EN", "Je t'envoie le report demain. The meeting is moved to Friday.", []],
    ["répétitions de lignes", "Bonjour.\n".repeat(200), []],
    ["long FR", LONG_FR, []],
    ["long EN", LONG_EN, []],
];

const SURROGATE_HIGH = /[\uD800-\uDBFF]$/;
const LOW_START = /^[\uDC00-\uDFFF]/;
const COMBINING_START = /^\p{M}/u;

function checkPositions(name, lang, text, matches) {
    for (const m of matches) {
        const where = `${name} [${lang}] «${text.slice(m.start, m.end)}» (${m.start}-${m.end}, ${m.rule})`;
        if (!(Number.isInteger(m.start) && Number.isInteger(m.end) && m.start >= 0 && m.end <= text.length && m.start < m.end)) {
            fail("positions", where);
            continue;
        }
        if (SURROGATE_HIGH.test(text.slice(0, m.start)) || LOW_START.test(text.slice(m.start)) || SURROGATE_HIGH.test(text.slice(0, m.end)) || LOW_START.test(text.slice(m.end))) {
            fail("emoji coupé", where);
        }
        if (COMBINING_START.test(text.slice(m.end))) {
            fail("accent décomposé coupé", where);
        }
        if (!/\S/.test(text.slice(m.start, m.end)) && m.kind !== "typographie") {
            fail("zone vide", where);
        }
        if (!Array.isArray(m.suggestions) || m.suggestions.some((s) => typeof s !== "string")) {
            fail("suggestions invalides", where);
        } else if (m.suggestions.includes(text.slice(m.start, m.end)) && m.kind !== "style") {
            fail("suggestion identique au texte", where);
        }
    }
}

function applyFirst(text, matches) {
    let out = text;
    let last = Infinity;
    for (const m of [...matches].filter((m) => ["orthographe", "grammaire"].includes(m.kind) && m.suggestions.length).sort((a, b) => b.start - a.start)) {
        if (m.end > last) {
            continue;
        }
        out = out.slice(0, m.start) + m.suggestions[0] + out.slice(m.end);
        last = m.start;
    }
    return out;
}

const key = (m) => `${m.start}:${m.end}:${m.rule}:${m.suggestions.join("|")}`;

try {
    for (const [name, text, protectedParts] of CASES) {
        for (const lang of ["fr", "en"]) {
            const start = performance.now();
            let result;
            try {
                result = await aria.check({ text, lang });
            } catch (error) {
                fail("plantage", `${name} [${lang}] : ${error.message}`);
                continue;
            }
            const ms = performance.now() - start;
            const limit = text.length > 10000 ? 60000 : 8000;
            if (ms > limit) {
                fail("trop lent", `${name} [${lang}] : ${Math.round(ms)} ms`);
            }
            const { matches } = result;
            checkPositions(name, lang, text, matches);
            const again = await aria.check({ text, lang });
            if (matches.map(key).join("\n") !== again.matches.map(key).join("\n")) {
                fail("non déterministe", `${name} [${lang}]`);
            }
            for (const part of protectedParts) {
                const at = text.indexOf(part);
                const inside = matches.filter((m) => m.start < at + part.length && m.end > at && m.kind !== "style");
                if (inside.length) {
                    fail("zone protégée soulignée", `${name} [${lang}] «${part}» : ${inside.map((m) => `«${text.slice(m.start, m.end)}» ${m.rule}`).join(", ")}`);
                }
            }
            // « Tout corriger », puis nouvelle analyse : de nouvelles fautes ailleurs ?
            if (text.length < 5000) {
                const fixed = applyFirst(text, matches);
                if (fixed !== text) {
                    const second = (await aria.check({ text: fixed, lang })).matches.filter((m) => ["orthographe", "grammaire"].includes(m.kind));
                    if (second.length > matches.filter((m) => ["orthographe", "grammaire"].includes(m.kind)).length) {
                        fail("tout corriger ajoute des fautes", `${name} [${lang}] : ${fixed.slice(0, 120)} → ${second.map((m) => `«${fixed.slice(m.start, m.end)}» ${m.rule}`).join(", ")}`);
                    }
                }
            }
            if (verbose) {
                console.log(`${name.padEnd(26)} [${lang}] ${String(Math.round(ms)).padStart(6)} ms · ${matches.length} remarque(s)${matches.length && text.length < 300 ? ` : ${matches.map((m) => `«${text.slice(m.start, m.end)}»→${m.suggestions[0] ?? ""} [${m.rule}]`).join("  ")}` : ""}`);
            }
        }
    }
    // Analyses en parallèle : chaque réponse doit correspondre à sa demande.
    const texts = ["Il à mangé.", "She go home.", "Les enfant sont partit.", "Their is a problem.", "On à vu le film."];
    const parallel = await Promise.all(Array.from({ length: 40 }, (_, i) => aria.check({ text: texts[i % 5], lang: i % 5 === 1 || i % 5 === 3 ? "en" : "fr" })));
    const sequential = [];
    for (let i = 0; i < 5; i++) {
        sequential.push(await aria.check({ text: texts[i], lang: i === 1 || i === 3 ? "en" : "fr" }));
    }
    parallel.forEach((r, i) => {
        if (r.matches.map(key).join() !== sequential[i % 5].matches.map(key).join()) {
            fail("parallèle", `demande ${i} : réponse mélangée`);
        }
    });
} finally {
    await aria.close();
}

problems.forEach((p) => console.log(p));
console.log(failures ? `\n${failures} échec(s)` : "\nrobustesse : tout est bon");
process.exitCode = failures ? 1 : 0;
