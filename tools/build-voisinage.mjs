// Construit extension/core/shared/voisinage-<langue>.js : pour chaque forme des familles d'homophones
// de sens de core/shared/ngrammes.js (« mer/mère/maire », « pain/pin »…), dans combien de phrases de
// Tatoeba (CC BY 2.0 FR) elle apparaît, et avec quels autres mots de la phrase. Le moteur s'en sert
// pour départager deux formes que leurs voisins immédiats ne distinguent pas (AriaNgrammes.senseConfusions).
// Usage : node tools/build-voisinage.mjs <fra_sentences.tsv> fr extension/core/shared/voisinage-fr.js [seuil]
//
// Les exports de Tatoeba : https://downloads.tatoeba.org/exports/per_language/<fra|eng>/<…>_sentences.tsv.bz2
// (une phrase par ligne : identifiant, langue, texte). Les familles, le découpage en mots et le choix
// des mots de contexte sont ceux de ngrammes.js, les mêmes qu'à l'exécution ; le modèle de paires de
// mots (ngrammes-<langue>.js) doit donc exister : il donne les mots-outils à écarter.
// On ne garde que les couples (forme, mot) vus dans au moins « seuil » phrases (2 par défaut).
import fs from "node:fs";
import readline from "node:readline";
import vm from "node:vm";

const [input, lang, output, minArg] = process.argv.slice(2);
const MIN = Number(minArg ?? 2);
if (!input || !["fr", "en"].includes(lang) || !output) {
    console.error("Usage : node tools/build-voisinage.mjs <phrases.tsv> fr|en <sortie.js> [seuil]");
    process.exit(1);
}

// ngrammes.js et ses données sont des scripts classiques qui déposent leurs tables dans « self ».
const context = {};
context.self = context;
vm.createContext(context);
for (const file of [`ngrammes-${lang}.js`, "ngrammes.js"]) {
    vm.runInContext(fs.readFileSync(new URL(`../extension/core/shared/${file}`, import.meta.url), "utf8"), context);
}
const ngrammes = context.AriaNgrammes;

const totals = new Map();   // forme → nombre de phrases
const counts = new Map();   // forme → mot de contexte → nombre de phrases
const spread = new Map();   // mot de contexte → nombre de phrases (toutes phrases confondues)
let sentences = 0;
const lines = readline.createInterface({ input: fs.createReadStream(input, "utf8"), crlfDelay: Infinity });
for await (const line of lines) {
    const text = line.split("\t")[2];
    if (!text) {
        continue;
    }
    sentences++;
    const all = new Set();
    for (const part of text.split(/[.!?;:\n]/)) {
        for (const word of ngrammes.sentenceContext(lang, part, 0, 0).words) {
            all.add(word);
        }
    }
    for (const word of all) {
        spread.set(word, (spread.get(word) ?? 0) + 1);
    }
    ngrammes.eachForm(lang, text, ({ entry, start, end }) => {
        if (ngrammes.senseForm(entry)) {
            totals.set(entry.text, (totals.get(entry.text) ?? 0) + 1);
            const map = counts.get(entry.text) ?? new Map();
            for (const word of ngrammes.sentenceContext(lang, text, start, end, entry.words).words) {
                map.set(word, (map.get(word) ?? 0) + 1);
            }
            counts.set(entry.text, map);
        }
        return true;
    });
}

const kept = [];
const used = new Set();
for (const [form, map] of [...counts].sort((a, b) => a[0].localeCompare(b[0]))) {
    for (const [word, count] of [...map].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
        if (count >= MIN) {
            kept.push(`${form}\t${word}\t${count}`);
            used.add(word);
        }
    }
}
const header = `// Aria Plume — homophones de sens (${lang}) : généré par tools/build-voisinage.mjs depuis les phrases de\n`
    + `// Tatoeba (https://tatoeba.org, CC BY 2.0 FR). ${sentences} phrases ; pour chaque forme, les mots vus avec\n`
    + `// elle dans au moins ${MIN} phrases. Ne pas modifier à la main.\n`;
const data = {
    sentences,
    forms: [...totals].sort((a, b) => a[0].localeCompare(b[0])).map(([form, count]) => `${form}\t${count}`).join("\n"),
    words: [...used].sort().map((word) => `${word}\t${spread.get(word) ?? 1}`).join("\n"),
    counts: kept.join("\n"),
};
fs.writeFileSync(output, `${header}self.ARIA_SENSE_${lang.toUpperCase()} = ${JSON.stringify(data)};\n`);
console.log(`${lang} : ${sentences} phrases, ${totals.size} formes, ${kept.length} couples gardés, ${used.size} mots de contexte → ${output} (${Math.round(fs.statSync(output).size / 1024)} Ko)`);
