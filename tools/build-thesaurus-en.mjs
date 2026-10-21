// Construit extension/data/thesaurus-en.json.gz depuis WordNet 3.1 (paquet npm wordnet-db 3.1.14).
// Usage : node tools/build-thesaurus-en.mjs <dossier dict de wordnet-db> <fichier de sortie>
//
// Format (le même que le thésaurus français de Grammalecte) :
//   { "mot": [["nom", ["synonyme", …]], ["verbe", […]], …], … }
// Un groupe par sens, dans l'ordre de fréquence de WordNet ; les natures (nom, verbe…) sont
// classées par nombre de sens, puis de sens attestés dans le corpus de WordNet (« fast » :
// adjectif, 10 sens, avant nom, 1 sens). Pour un adjectif, les termes
// « similaires » (pointeur &) complètent le groupe, comme dans le thésaurus de LibreOffice.
import fs from "node:fs";
import zlib from "node:zlib";

const [dictDir, output] = process.argv.slice(2);
const FILES = ["noun", "verb", "adj", "adv"];
const LABEL = { noun: "nom", verb: "verbe", adj: "adjectif", adv: "adverbe" };
const MAX_GROUPS = 5;   // sens gardés par nature (nom, verbe…)
const MAX_WORDS = 12;   // mots gardés par sens

const clean = (w) => w.replace(/\(.*?\)$/, "").replace(/_/g, " ");
const synsets = new Map();  // "pos:offset" → { words, similar }

for (const pos of FILES) {
    for (const line of fs.readFileSync(`${dictDir}/data.${pos}`, "utf8").split("\n")) {
        if (!line || line.startsWith("  ")) {
            continue;
        }
        const parts = line.split(" ");
        const offset = parts[0];
        const count = parseInt(parts[3], 16);
        const words = [];
        for (let i = 0; i < count; i++) {
            words.push(clean(parts[4 + i * 2]));
        }
        let k = 4 + count * 2;
        const pointers = parseInt(parts[k], 10);
        const similar = [];
        for (let p = 0; p < pointers; p++) {
            const [symbol, target] = parts.slice(k + 1 + p * 4, k + 3 + p * 4);
            if (symbol === "&" && pos === "adj") {
                similar.push(`adj:${target}`);
            }
        }
        synsets.set(`${pos}:${offset}`, { words, similar });
    }
}

const thesaurus = new Map();
for (const pos of FILES) {
    for (const line of fs.readFileSync(`${dictDir}/index.${pos}`, "utf8").split("\n")) {
        if (!line || line.startsWith("  ")) {
            continue;
        }
        const parts = line.trim().split(" ");
        const lemma = clean(parts[0]);
        const synsetCount = parseInt(parts[2], 10);
        const ptrCount = parseInt(parts[3], 10);
        const tagged = parseInt(parts[4 + ptrCount + 1], 10) || 0;
        const offsets = parts.slice(4 + ptrCount + 2, 4 + ptrCount + 2 + synsetCount);
        const groups = [];
        for (const offset of offsets) {
            const synset = synsets.get(`${pos}:${offset}`);
            if (!synset) {
                continue;
            }
            const words = new Set(synset.words.filter((w) => w.toLowerCase() !== lemma.toLowerCase()));
            for (const ref of synset.similar) {
                for (const w of synsets.get(ref)?.words ?? []) {
                    if (w.toLowerCase() !== lemma.toLowerCase()) {
                        words.add(w);
                    }
                }
            }
            if (words.size) {
                groups.push([LABEL[pos], [...words].slice(0, MAX_WORDS)]);
            }
            if (groups.length >= MAX_GROUPS) {
                break;
            }
        }
        if (groups.length) {
            thesaurus.set(lemma, [...(thesaurus.get(lemma) ?? []), { senses: synsetCount, tagged, groups }]);
        }
    }
}
const result = {};
for (const [word, blocks] of thesaurus) {
    result[word] = blocks.sort((a, b) => b.senses - a.senses || b.tagged - a.tagged).flatMap((block) => block.groups);
}
// Sortie en .json.gz (gzip niveau 9, sans date pour un fichier reproductible) ou en .json.
const json = JSON.stringify(result);
fs.writeFileSync(output, output.endsWith(".gz") ? zlib.gzipSync(json, { level: 9 }) : json);
console.log(`${thesaurus.size} mots, ${(fs.statSync(output).size / 1e6).toFixed(1)} Mo`);
