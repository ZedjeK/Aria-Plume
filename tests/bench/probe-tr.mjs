// Aria Plume — sonde de traduction : affiche la traduction de quelques phrases (diagnostic).
// Usage : ELECTRON_RUN_AS_NODE=1 "Aria Plume.exe" tests/bench/probe-tr.mjs fr "phrase 1" "phrase 2"…
import { createAria } from "../../extension/core/index.js";
import { nodePlatform } from "../../extension/core/platform/node.js";

const [from, ...phrases] = process.argv.slice(2);
const to = from === "fr" ? "en" : "fr";
const aria = createAria(nodePlatform);
for (const text of phrases) {
    const result = await aria.translate({ text, from, to });
    console.log(`${text}\n   → ${result.text ?? result}`);
}
await aria.close();
