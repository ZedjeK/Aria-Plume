// Aria Plume — sonde : affiche les remarques du correcteur pour quelques phrases (diagnostic).
// Usage : ELECTRON_RUN_AS_NODE=1 "Aria Plume.exe" tests/bench/probe.mjs fr "phrase 1" "phrase 2"…
import { createAria } from "../../extension/core/index.js";
import { nodePlatform } from "../../extension/core/platform/node.js";

const [lang, ...phrases] = process.argv.slice(2);
const aria = createAria(nodePlatform);
for (const text of phrases) {
    const { matches } = await aria.check({ text, lang });
    console.log(text);
    for (const m of matches) {
        console.log(`   «${text.slice(m.start, m.end)}» → ${m.suggestions.slice(0, 4).join(" | ")}  [${m.rule}]`);
    }
}
await aria.close();
