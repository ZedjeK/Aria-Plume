// node tests/anglais/run.mjs : passe le corpus dans les règles anglaises d'Aria. Sort en erreur
// à la moindre fausse alerte ou faute ratée.
import { findEnglishRules } from "../../extension/core/en/rules.js";
import { corpus } from "./corpus.mjs";

let hit = 0, miss = 0, fa = 0, ok = 0;
for (const [text, bad, fix] of corpus) {
    const found = findEnglishRules(text);
    if (bad) {
        const idx = text.search(new RegExp(`(?<![A-Za-z'’])${bad.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z])`));
        const m = found.find((f) => f.start <= idx && f.end >= idx + bad.length);
        if (m && m.suggestions[0] === fix) {
            hit++;
        } else {
            miss++;
            console.log(`RATÉ    ${text}   ${found.map((f) => `«${text.slice(f.start, f.end)}»→${f.suggestions[0]}`).join(" ")}`);
        }
    } else if (found.length) {
        fa++;
        console.log(`FAUSSE  ${text}   ${found.map((f) => `«${text.slice(f.start, f.end)}»→${f.suggestions[0]}`).join(" ")}`);
    } else {
        ok++;
    }
}
console.log(`\nfautes trouvées ${hit}/${hit + miss} | phrases justes sans alerte ${ok}/${ok + fa}`);
process.exitCode = fa || miss ? 1 : 0;
