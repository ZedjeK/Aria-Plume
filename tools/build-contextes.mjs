// Construit extension/core/shared/contextes-<langue>.js : pour chaque forme des familles d'homophones
// de core/shared/ngrammes.js, combien de fois elle apparaît entre telle et telle NATURE de mots voisins
// (nom, participe, verbe conjugué… ou le mot lui-même pour les mots grammaticaux), compté sur les
// phrases de Tatoeba (CC BY 2.0 FR).
// Usage : node tools/build-contextes.mjs <fra_sentences.tsv> fr extension/core/shared/contextes-fr.js [seuil]
//         node tools/build-contextes.mjs <eng_sentences.tsv> en extension/core/shared/contextes-en.js <dossier dict de wordnet-db> [seuil]
//
// Les exports de Tatoeba : https://downloads.tatoeba.org/exports/per_language/<fra|eng>/<…>_sentences.tsv.bz2
// (une phrase par ligne : identifiant, langue, texte). Les familles, le découpage en mots et le calcul
// des natures sont ceux de ngrammes.js, les mêmes qu'à l'exécution :
//   - français : étiquettes du dictionnaire de Grammalecte (AriaNgrammes.natureOf) ;
//   - anglais : natures de WordNet 3.1 pour les formes de base (index.noun, index.verb, index.adj,
//     index.adv du paquet npm wordnet-db 3.1.14, comme tools/build-thesaurus-en.mjs ; le thésaurus
//     embarqué ne suffit pas : il ne garde que les mots qui ont des synonymes), et terminaisons
//     (AriaNgrammes.natureOfEnglish). Une nature autre que nom, sans aucune occurrence dans le corpus
//     étiqueté de WordNet, est écartée quand le mot en a une autre attestée (« sky » : nom, pas verbe). La table
//     des natures des mots simples de WordNet est écrite dans le fichier (« lexicon ») : le moteur
//     anglais n'a pas d'autre dictionnaire étiqueté, et les accords (en/agreement.js) s'en servent.
// On ne garde que les contextes vus au moins « seuil » fois (2 par défaut).
import fs from "node:fs";
import readline from "node:readline";
import vm from "node:vm";
import { createAria } from "../extension/core/index.js";
import { nodePlatform } from "../extension/core/platform/node.js";

const [input, lang, output, ...rest] = process.argv.slice(2);
const dictDir = lang === "en" ? rest.shift() : null;
const MIN = Number(rest[0] ?? 2);
if (!input || !["fr", "en"].includes(lang) || !output || (lang === "en" && !dictDir)) {
    console.error("Usage : node tools/build-contextes.mjs <phrases.tsv> fr <sortie.js> [seuil]");
    console.error("        node tools/build-contextes.mjs <phrases.tsv> en <sortie.js> <dossier dict de wordnet-db> [seuil]");
    process.exit(1);
}

// ngrammes.js est un script classique qui dépose self.AriaNgrammes.
const context = {};
context.self = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL("../extension/core/shared/ngrammes.js", import.meta.url), "utf8"), context);
const ngrammes = context.AriaNgrammes;

async function sentences(onSentence) {
    const lines = readline.createInterface({ input: fs.createReadStream(input, "utf8"), crlfDelay: Infinity });
    for await (const line of lines) {
        const text = line.split("\t")[2];
        if (text) {
            onSentence(text);
        }
    }
}

// Premier passage : les voisins des formes, pour connaître leur nature en une fois.
const neighbours = new Set();
let total = 0;
await sentences((text) => {
    total++;
    ngrammes.eachForm(lang, text, ({ before, after }) => {
        for (const word of [before, after]) {
            if (word) {
                neighbours.add(text.slice(word.start, word.end));
            }
        }
        return true;
    });
});

let natureOfWord;
let lexicon = null;
if (lang === "fr") {
    const aria = createAria(nodePlatform);
    const morphs = new Map();
    const wanted = [...new Set([...neighbours].flatMap((word) => [word, word.toLowerCase()]))];
    for (let i = 0; i < wanted.length; i += 5000) {
        for (const { word, morph } of await aria.morphFr(wanted.slice(i, i + 5000))) {
            morphs.set(word, morph);
        }
    }
    await aria.close();
    // Même calcul qu'à l'exécution (fr/worker.js) : étiquettes du mot en minuscules, sinon tel qu'écrit.
    natureOfWord = (original) => {
        const lower = original.toLowerCase().replace(/[’`]/g, "'");
        const found = morphs.get(lower)?.length ? morphs.get(lower) : morphs.get(original) ?? [];
        return ngrammes.natureOf(lower, found, /^\p{Lu}/u.test(original));
    };
} else {
    // index.<nature> : « lemme nature nb_sens nb_pointeurs [pointeurs…] nb_sens nb_sens_attestés … ».
    const readings = new Map();  // mot → [[nature, sens attestés], …]
    for (const [file, tag] of [["noun", "N"], ["verb", "V"], ["adj", "A"], ["adv", "W"]]) {
        for (const line of fs.readFileSync(`${dictDir}/index.${file}`, "utf8").split("\n")) {
            if (!line || line.startsWith("  ")) {
                continue;
            }
            const fields = line.trim().split(/\s+/);
            const word = fields[0];
            if (/^[a-z'-]+$/.test(word)) {
                const attested = Number(fields[5 + Number(fields[3])]);
                readings.set(word, [...(readings.get(word) ?? []), [tag, attested]]);
            }
        }
    }
    const all = new Map();
    for (const [word, list] of readings) {
        // Les noms sont toujours gardés (« update », « chat », « launch » : le corpus étiqueté est ancien) ;
        // une autre nature jamais attestée est écartée quand le mot en a une attestée.
        const anyAttested = list.some(([, count]) => count > 0);
        all.set(word, list.filter(([tag, count]) => tag === "N" || count > 0 || !anyAttested).map(([tag]) => tag).sort().join("+"));
    }
    natureOfWord = (original) => ngrammes.natureOfEnglish(original, all);
    // La table livrée : tous les mots simples de WordNet (elle sert aussi aux accords, en/agreement.js).
    lexicon = new Map([...all].sort());
}

// Second passage : les comptes.
const counts = new Map();
const add = (form, left, right) => {
    const key = `${form}\t${left}\t${right}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
};
await sentences((text) => {
    ngrammes.eachForm(lang, text, ({ entry, before, after }) => {
        const left = before ? natureOfWord(text.slice(before.start, before.end)) : "<s>";
        const right = after ? natureOfWord(text.slice(after.start, after.end)) : "</s>";
        add(entry.text, left, right);
        add(entry.text, left, "");
        add(entry.text, "", right);
        add(entry.text, "", "");
        return true;
    });
});

const kept = [...counts].filter(([key, count]) => count >= MIN || key.endsWith("\t\t")).sort((a, b) => b[1] - a[1]);
const header = `// Aria Plume — homophones (${lang}) entre les natures de leurs voisins : généré par\n`
    + `// tools/build-contextes.mjs depuis les phrases de Tatoeba (https://tatoeba.org, CC BY 2.0 FR). ${total} phrases ;\n`
    + `// contextes vus au moins ${MIN} fois.${lexicon ? " Natures des mots : WordNet 3.1 (voir data/LICENSE-WordNet.txt)." : ""} Ne pas modifier à la main.\n`;
const data = { counts: kept.map(([key, count]) => `${key}\t${count}`).join("\n") };
if (lexicon) {
    data.lexicon = [...lexicon].map(([word, pos]) => `${word}\t${pos}`).join("\n");
}
fs.writeFileSync(output, `${header}self.ARIA_CONTEXTS_${lang.toUpperCase()} = ${JSON.stringify(data)};\n`);
console.log(`${lang} : ${total} phrases, ${neighbours.size} voisins différents, ${kept.length} contextes gardés${lexicon ? `, ${lexicon.size} mots étiquetés` : ""} → ${output} (${Math.round(fs.statSync(output).size / 1024)} Ko)`);
