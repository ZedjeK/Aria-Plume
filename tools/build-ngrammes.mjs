// Construit extension/core/shared/ngrammes-<langue>.js : un petit modèle de langue (mots et paires de
// mots avec leur nombre d'occurrences) compté sur les phrases de Tatoeba (CC BY 2.0 FR).
// Usage : node tools/build-ngrammes.mjs <fra_sentences.tsv> fr extension/core/shared/ngrammes-fr.js [seuil]
//         node tools/build-ngrammes.mjs <eng_sentences.tsv> en extension/core/shared/ngrammes-en.js [seuil]
//
// Les exports de Tatoeba : https://downloads.tatoeba.org/exports/per_language/<fra|eng>/<…>_sentences.tsv.bz2
// (une phrase par ligne : identifiant, langue, texte). On compte les mots et les paires de mots voisins
// (avec « <s> » et « </s> » pour le début et la fin de phrase), puis on ne garde que ce qui revient au
// moins « seuil » fois (2 par défaut) : les suites rares n'apprennent rien et pèsent lourd.
//
// Le découpage en mots doit rester identique à celui de core/shared/ngrammes.js (tokens()).
import fs from "node:fs";
import readline from "node:readline";

const [input, lang, output, minArg] = process.argv.slice(2);
const MIN = Number(minArg ?? 2);
if (!input || !["fr", "en"].includes(lang) || !output) {
    console.error("Usage : node tools/build-ngrammes.mjs <phrases.tsv> fr|en <sortie.js> [seuil]");
    process.exit(1);
}

// Même découpage qu'à l'exécution : minuscules, apostrophe droite, élisions françaises gardées
// avec leur apostrophe (« l' », « qu' »), contractions anglaises en un mot (« don't »).
const ELISION = /^(?:[cdjlmnst]|qu|jusqu|lorsqu|puisqu|quoiqu)'/;
function tokens(text) {
    const words = text.toLowerCase().replace(/[’`]/g, "'").match(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*'?/gu) ?? [];
    const out = [];
    for (const word of words) {
        const elided = lang === "fr" ? ELISION.exec(word) : null;
        if (elided && word.length > elided[0].length) {
            out.push(elided[0], word.slice(elided[0].length));
        } else {
            out.push(word);
        }
    }
    return out;
}

const unigrams = new Map();
const bigrams = new Map();
let sentences = 0;
const lines = readline.createInterface({ input: fs.createReadStream(input, "utf8"), crlfDelay: Infinity });
for await (const line of lines) {
    const text = line.split("\t")[2];
    if (!text) {
        continue;
    }
    const words = ["<s>", ...tokens(text), "</s>"];
    sentences++;
    for (let i = 0; i < words.length; i++) {
        unigrams.set(words[i], (unigrams.get(words[i]) ?? 0) + 1);
        if (i > 0) {
            const pair = `${words[i - 1]} ${words[i]}`;
            bigrams.set(pair, (bigrams.get(pair) ?? 0) + 1);
        }
    }
}

const total = [...unigrams.values()].reduce((a, b) => a + b, 0);
const keepUni = [...unigrams].filter(([, c]) => c >= MIN).sort((a, b) => b[1] - a[1]);
const keepBi = [...bigrams].filter(([, c]) => c >= MIN).sort((a, b) => b[1] - a[1]);
const header = `// Aria Plume — modèle de langue (${lang}) : généré par tools/build-ngrammes.mjs depuis les phrases de\n`
    + `// Tatoeba (https://tatoeba.org, CC BY 2.0 FR). ${sentences} phrases, ${total} mots ; mots et paires vus au\n`
    + `// moins ${MIN} fois. Ne pas modifier à la main.\n`;
const name = `ARIA_NGRAMS_${lang.toUpperCase()}`;
const data = {
    total,
    unigrams: keepUni.map(([w, c]) => `${w}\t${c}`).join("\n"),
    bigrams: keepBi.map(([w, c]) => `${w}\t${c}`).join("\n"),
};
fs.writeFileSync(output, `${header}self.${name} = ${JSON.stringify(data)};\n`);
console.log(`${lang} : ${sentences} phrases, ${total} mots, ${keepUni.length} mots et ${keepBi.length} paires gardés → ${output} (${Math.round(fs.statSync(output).size / 1024)} Ko)`);
