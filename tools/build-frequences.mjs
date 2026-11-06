// Construit extension/core/shared/frequences-data.js depuis le vocabulaire des modèles de traduction
// de Mozilla (SentencePiece « unigram », MPL-2.0), déjà embarqués dans Aria Plume.
// Usage : node tools/build-frequences.mjs extension/models/fren/vocab.fren.spm.gz extension/core/shared/frequences-data.js
//
// Chaque morceau du vocabulaire (mot entier « ▁morning », ou bout de mot « ment ») a une probabilité
// apprise sur des millions de phrases françaises et anglaises : c'est une fréquence d'usage. Les
// suggestions d'orthographe s'en servent pour passer les mots courants devant les mots rares
// (« moring » → morning plutôt que « mo ring », « encire » → encore plutôt que « encre »).
//
// Format : une chaîne « morceau<TAB>score » par ligne, score = log-probabilité × 10, arrondie.
import fs from "node:fs";
import zlib from "node:zlib";

const [input, output] = process.argv.slice(2);
const buffer = zlib.gunzipSync(fs.readFileSync(input));

// Lecture minimale du protobuf ModelProto : champ 1 = pièce { 1: texte, 2: score, 3: type }.
function readVarint(bytes, state) {
    let result = 0;
    let shift = 0;
    let byte;
    do {
        byte = bytes[state.pos++];
        result += (byte & 0x7f) * 2 ** shift;
        shift += 7;
    } while (byte & 0x80);
    return result;
}

function skip(bytes, state, wire) {
    if (wire === 0) {
        readVarint(bytes, state);
    } else if (wire === 1) {
        state.pos += 8;
    } else if (wire === 2) {
        state.pos += readVarint(bytes, state);
    } else if (wire === 5) {
        state.pos += 4;
    } else {
        throw new Error(`type protobuf inattendu : ${wire}`);
    }
}

const lines = [];
const state = { pos: 0 };
while (state.pos < buffer.length) {
    const key = readVarint(buffer, state);
    if ((key >> 3) !== 1 || (key & 7) !== 2) {
        break;  // les pièces viennent en premier ; la suite (réglages de l'entraînement) ne sert pas
    }
    const length = readVarint(buffer, state);
    const end = state.pos + length;
    const sub = { pos: state.pos };
    let piece = "";
    let score = 0;
    let type = 1;
    while (sub.pos < end) {
        const k = readVarint(buffer, sub);
        const field = k >> 3;
        const wire = k & 7;
        if (field === 1 && wire === 2) {
            const length = readVarint(buffer, sub);
            piece = buffer.subarray(sub.pos, sub.pos + length).toString("utf8");
            sub.pos += length;
        } else if (field === 2 && wire === 5) {
            score = buffer.readFloatLE(sub.pos);
            sub.pos += 4;
        } else if (field === 3 && wire === 0) {
            type = readVarint(buffer, sub);
        } else {
            skip(buffer, sub, wire);
        }
    }
    state.pos = end;
    // Type 1 : pièce normale (les autres : inconnu, contrôle, octets bruts).
    if (type === 1 && /\p{L}/u.test(piece) && !/[\t\n]/.test(piece)) {
        lines.push(`${piece}\t${Math.round(score * 10)}`);
    }
}

const header = "// Aria Plume — fréquences des mots : généré par tools/build-frequences.mjs depuis le vocabulaire des\n"
    + "// modèles de traduction de Mozilla (MPL-2.0). Ne pas modifier à la main.\n";
fs.writeFileSync(output, `${header}self.ARIA_PIECES = ${JSON.stringify(lines.join("\n"))};\n`);
console.log(`${lines.length} morceaux → ${output} (${Math.round(fs.statSync(output).size / 1024)} Ko)`);
