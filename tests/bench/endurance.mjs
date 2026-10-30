// Aria Plume — test d'endurance : des phrases générées à la volée (simples et complexes), justes ou
// avec une faute volontaire, en français et en anglais, analysées sans arrêt pendant une durée donnée.
//
//     node tests/bench/endurance.mjs [--minutes 60] [--seed 42] [--lang fr|en] [--out rapport.json]
//
// Mesures :
//   - phrases justes : fausses alertes (orthographe ou grammaire), par règle, avec des exemples ;
//   - phrases fautives : faute trouvée, bonne correction proposée, en première position, par type ;
//   - temps de réponse (médiane, 99e centile, maximum), mémoire du processus, plantages.
//
// Les phrases viennent de gabarits (sujet, verbe conjugué par Grammalecte, complément, temps,
// subordonnées, relatives, négation, questions…) : le vocabulaire est limité, mais les combinaisons
// sont innombrables. Une faute est injectée en connaissant sa correction, comme dans textes.mjs.

import fs from "node:fs";
import { createAria } from "../../extension/core/index.js";
import { nodePlatform } from "../../extension/core/platform/node.js";
import { parse, evaluate } from "./textes-eval.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : fallback;
};
const minutes = Number(arg("minutes", "5"));
let seed = Number(arg("seed", String(Date.now() % 100000)));
const onlyLang = arg("lang", null);
const out = arg("out", null);

// Générateur pseudo-aléatoire reproductible (mulberry32).
function random() {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (list) => list[Math.floor(random() * list.length)];
const chance = (p) => random() < p;
const startSeed = seed;

// ---------------------------------------------------------------------------------------------
// Français
// ---------------------------------------------------------------------------------------------

const VOWEL = /^[aeiouyhâàéèêëîïôûœ]/i;
const H_ASPIRE = new Set([]);
const elides = (word) => VOWEL.test(word) && !H_ASPIRE.has(word);

// Noms : [singulier, pluriel, genre]
const THINGS = [
    ["serveur", "serveurs", "m"], ["routeur", "routeurs", "m"], ["disque", "disques", "m"], ["fichier", "fichiers", "m"],
    ["ordinateur", "ordinateurs", "m"], ["câble", "câbles", "m"], ["rapport", "rapports", "m"], ["message", "messages", "m"],
    ["projet", "projets", "m"], ["livre", "livres", "m"], ["gâteau", "gâteaux", "m"], ["journal", "journaux", "m"],
    ["jeu", "jeux", "m"], ["badge", "badges", "m"], ["écran", "écrans", "m"], ["colis", "colis", "m"],
    ["machine", "machines", "f"], ["imprimante", "imprimantes", "f"], ["voiture", "voitures", "f"], ["lettre", "lettres", "f"],
    ["sauvegarde", "sauvegardes", "f"], ["porte", "portes", "f"], ["maison", "maisons", "f"], ["figurine", "figurines", "f"],
    ["clé", "clés", "f"], ["facture", "factures", "f"], ["fenêtre", "fenêtres", "f"], ["photo", "photos", "f"],
    ["chanson", "chansons", "f"], ["armoire", "armoires", "f"], ["application", "applications", "f"],
];
const PEOPLE = [
    ["technicien", "techniciens", "m"], ["voisin", "voisins", "m"], ["directeur", "directeurs", "m"], ["client", "clients", "m"],
    ["joueur", "joueurs", "m"], ["ami", "amis", "m"], ["cousin", "cousins", "m"], ["stagiaire", "stagiaires", "m"],
    ["technicienne", "techniciennes", "f"], ["voisine", "voisines", "f"], ["directrice", "directrices", "f"], ["cliente", "clientes", "f"],
    ["joueuse", "joueuses", "f"], ["amie", "amies", "f"], ["cousine", "cousines", "f"], ["infirmière", "infirmières", "f"],
];
// Adjectifs placés après le nom : [m:s, m:p, f:s, f:p]
const THING_ADJ = [
    ["rapide", "rapides", "rapide", "rapides"], ["lent", "lents", "lente", "lentes"], ["cassé", "cassés", "cassée", "cassées"],
    ["neuf", "neufs", "neuve", "neuves"], ["vide", "vides", "vide", "vides"], ["rouge", "rouges", "rouge", "rouges"],
    ["noir", "noirs", "noire", "noires"], ["lourd", "lourds", "lourde", "lourdes"], ["important", "importants", "importante", "importantes"],
    ["récent", "récents", "récente", "récentes"], ["bruyant", "bruyants", "bruyante", "bruyantes"], ["ancien", "anciens", "ancienne", "anciennes"],
];
const PEOPLE_ADJ = [
    ["content", "contents", "contente", "contentes"], ["fatigué", "fatigués", "fatiguée", "fatiguées"], ["prêt", "prêts", "prête", "prêtes"],
    ["malade", "malades", "malade", "malades"], ["occupé", "occupés", "occupée", "occupées"], ["inquiet", "inquiets", "inquiète", "inquiètes"],
    ["heureux", "heureux", "heureuse", "heureuses"], ["déçu", "déçus", "déçue", "déçues"], ["surpris", "surpris", "surprise", "surprises"],
];
const ADVERBS = ["très", "vraiment", "souvent", "toujours", "un peu", "trop", "assez"];
const TRANSITIVE = ["regarder", "réparer", "configurer", "vérifier", "préparer", "envoyer", "acheter", "finir", "prendre", "voir", "faire",
    "mettre", "lire", "écrire", "ouvrir", "choisir", "attendre", "perdre", "vendre", "nettoyer", "imprimer", "installer", "chercher",
    "trouver", "oublier", "recevoir", "peindre", "remplacer", "déplacer", "terminer", "rendre", "garder", "montrer", "apporter"];
const ETRE_VERBS = ["arriver", "partir", "venir", "tomber", "rester", "entrer", "sortir", "rentrer", "revenir", "descendre", "monter", "passer"];
const PRONOMINAL = ["lever", "tromper", "reposer", "amuser", "perdre", "dépêcher", "arrêter", "préparer", "inquiéter", "coucher", "promener", "habiller"];
const PLACES = ["au bureau", "à la gare", "chez ses parents", "à l'heure", "en retard", "dans le parc", "à Lyon", "au Japon", "à la maison", "devant l'école"];
const TIMES = {
    past: ["hier soir", "ce matin", "la semaine dernière", "lundi", "il y a deux jours", "avant midi"],
    present: ["chaque jour", "en ce moment", "le samedi", "tous les matins", "maintenant"],
    future: ["demain", "la semaine prochaine", "bientôt", "dans deux heures", "jeudi prochain"],
    any: ["", "", ""],
};
const PRONOUNS = [
    { word: "je", person: 0, g: null, n: "s" }, { word: "tu", person: 1, g: null, n: "s" }, { word: "il", person: 2, g: "m", n: "s" },
    { word: "elle", person: 2, g: "f", n: "s" }, { word: "on", person: 2, g: "m", n: "s", on: true }, { word: "nous", person: 3, g: null, n: "p" },
    { word: "vous", person: 4, g: null, n: "p" }, { word: "ils", person: 5, g: "m", n: "p" }, { word: "elles", person: 5, g: "f", n: "p" },
];
const ETRE = { present: ["suis", "es", "est", "sommes", "êtes", "sont"], imparfait: ["étais", "étais", "était", "étions", "étiez", "étaient"], futur: ["serai", "seras", "sera", "serons", "serez", "seront"] };
const AVOIR = { present: ["ai", "as", "a", "avons", "avez", "ont"], imparfait: ["avais", "avais", "avait", "avions", "aviez", "avaient"], futur: ["aurai", "auras", "aura", "aurons", "aurez", "auront"] };
const REFLEXIVE = ["me", "te", "se", "nous", "vous", "se"];
const MODALS = { aller: ["vais", "vas", "va", "allons", "allez", "vont"], pouvoir: ["peux", "peux", "peut", "pouvons", "pouvez", "peuvent"], devoir: ["dois", "dois", "doit", "devons", "devez", "doivent"], vouloir: ["veux", "veux", "veut", "voulons", "voulez", "veulent"] };

const conjugations = new Map();
const TENSE_KEYS = { "Indicatif:Présent": "present", "Indicatif:Imparfait": "imparfait", "Indicatif:Futur": "futur", "Subjonctif:Présent": "subjonctif", "Conditionnel:Présent": "conditionnel" };

async function loadConjugations(aria) {
    for (const verb of new Set([...TRANSITIVE, ...ETRE_VERBS, ...PRONOMINAL])) {
        const table = await aria.conjugate({ verb });
        const tenses = {};
        for (const mood of table.moods) {
            for (const tense of mood.tenses) {
                const key = TENSE_KEYS[`${mood.name}:${tense.name}`];
                if (key) {
                    // « je prends », « j’arrive », « que je prenne » → « prends », « arrive », « prenne »
                    tenses[key] = tense.forms.map((f) => f.replace(/’/g, "'").replace(/^(?:que |qu')?(?:je |j'|tu |il |elle |nous |vous |ils |elles )/, ""));
                }
            }
        }
        const pp = table.pastParticiples;
        const participle = pp.length === 4 ? { ms: pp[0], fs: pp[1], mp: pp[2], fp: pp[3] } : { ms: pp[0], fs: pp[1], mp: pp[0], fp: pp[2] ?? pp[1] };
        conjugations.set(verb, { tenses, participle, infinitive: verb });
    }
}

// Faute d'accord injectable ? « je », « tu » : genre inconnu (seul le nombre compte) ;
// « vous » : peut-être un vouvoiement singulier. On ne fabrique pas de fausse faute.
function agreementError(s, rightG, rightN, wrongG, wrongN) {
    if ((rightG === wrongG && rightN === wrongN) || (s.pronoun && s.text === "vous")) {
        return false;
    }
    if (s.pronoun && ["je", "tu", "nous"].includes(s.text)) {
        return s.g === "m" && wrongG === "m" && rightN !== wrongN;  // seul le nombre est sûr
    }
    return true;
}

const ppForm = (verb, g, n) => conjugations.get(verb).participle[`${g ?? "m"}${n}`];
const adjForm = (adj, g, n) => adj[(g === "f" ? 2 : 0) + (n === "p" ? 1 : 0)];

// Groupe nominal : { text, g, n, person }
function determiner(kind, noun, g, n) {
    const vowel = elides(noun);
    if (n === "p") {
        return { def: "les", indef: "des", poss: pick(["mes", "tes", "ses", "nos", "vos", "leurs"]), dem: "ces" }[kind];
    }
    if (kind === "def") {
        return vowel ? "l'" : g === "f" ? "la" : "le";
    }
    if (kind === "indef") {
        return g === "f" ? "une" : "un";
    }
    if (kind === "dem") {
        return g === "f" ? "cette" : vowel ? "cet" : "ce";
    }
    const poss = pick(["mon", "ton", "son", "notre", "votre", "leur"]);
    if (g === "f" && !vowel && ["mon", "ton", "son"].includes(poss)) {
        return { mon: "ma", ton: "ta", son: "sa" }[poss];
    }
    return poss;
}

const join = (det, noun) => (det.endsWith("'") ? det + noun : `${det} ${noun}`);

function nounPhrase(list, adjectives, { kinds = ["def", "indef", "poss", "dem"], plural = null } = {}) {
    const [sing, plur, g] = pick(list);
    const n = plural === null ? (chance(0.4) ? "p" : "s") : plural ? "p" : "s";
    const noun = n === "p" ? plur : sing;
    const det = determiner(pick(kinds), noun, g, n);
    let text = join(det, noun);
    let adjective = null;
    if (adjectives && chance(0.35)) {
        adjective = adjForm(pick(adjectives), g, n);
        text += ` ${adjective}`;
    }
    return { text, g, n, person: n === "p" ? 5 : 2, noun, det, adjective };
}

function subject({ allowOn = true } = {}) {
    if (chance(0.55)) {
        const p = pick(PRONOUNS.filter((x) => allowOn || !x.on));
        return { text: p.word, person: p.person, g: p.g ?? pick(["m", "f"]), n: p.n, pronoun: true };
    }
    const np = nounPhrase(PEOPLE, chance(0.3) ? PEOPLE_ADJ : null, { kinds: ["def", "poss", "dem"] });
    return { ...np, pronoun: false };
}

// Sujet + mot suivant, avec l'élision de « je ».
const withSubject = (s, word) => (s.text === "je" && elides(word) ? `j'${word}` : `${s.text} ${word}`);
const capitalize = (t) => t[0].toUpperCase() + t.slice(1);
// Marque une zone fautive : {{faux=>juste|catégorie}}
const mark = (wrong, right, cat) => `{{${wrong}=>${right}|${cat}}}`;

// Chaque gabarit renvoie { text, errors: [{ cat, apply(text) → texte balisé }] } : le texte juste,
// et les fautes qu'on peut y injecter. Une faute remplace une sous-chaîne repérée par « slot ».
function slot(text, value, nth = 0) {
    let at = -1;
    for (let i = 0; i <= nth; i++) {
        at = text.indexOf(value, at + 1);
    }
    return at;
}

function inject(text, value, wrong, cat, right = value) {
    const re = new RegExp(`(?<![\\p{L}'])${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "u");
    const m = re.exec(text);
    if (!m || wrong === value) {
        return null;
    }
    return text.slice(0, m.index) + mark(wrong, right, cat) + text.slice(m.index + value.length);
}

function frSimple() {
    const s = subject();
    const verb = pick(TRANSITIVE);
    const tense = pick(["present", "present", "imparfait", "futur", "conditionnel", "passe"]);
    const object = nounPhrase(THINGS, chance(0.4) ? THING_ADJ : null);
    const time = tense === "passe" || tense === "imparfait" ? pick(TIMES.past.concat(TIMES.any)) : tense === "futur" ? pick(TIMES.future.concat(TIMES.any)) : pick(TIMES.present.concat(TIMES.any));
    const negative = chance(0.2);
    let verbText;
    const errors = [];
    if (tense === "passe") {
        const aux = AVOIR.present[s.person];
        const pp = ppForm(verb, "m", "s");
        verbText = negative ? `${s.text === "je" ? "je n'" : `${s.text} n'`}${aux} pas ${pp}` : `${withSubject(s, aux)} ${pp}`;
        const sentence = `${capitalize(verbText)} ${object.text}${time ? ` ${time}` : ""}.`;
        if (s.person === 2 && !negative) {
            errors.push(() => inject(sentence, aux, "à", "hom", "a"));
        }
        if (s.text === "ils" || s.text === "elles") {
            errors.push(() => inject(sentence, "ont", "on", "hom"));
        }
        if (/é$/.test(pp) && verb.endsWith("er")) {
            errors.push(() => inject(sentence, pp, verb, "pp"));
        }
        errors.push(() => objectErrors(sentence, object));
        return { text: sentence, errors };
    }
    const forms = conjugations.get(verb).tenses[tense];
    const form = forms[s.person];
    verbText = negative ? `${s.text === "je" ? (elides(form) ? "je n'" : "je ne ") : `${s.text} ${elides(form) ? "n'" : "ne "}`}${form} pas` : withSubject(s, form);
    const sentence = `${capitalize(verbText.replace(/' /g, "'"))} ${object.text}${time ? ` ${time}` : ""}.`;
    const wrongPersons = forms.filter((f) => f !== form);
    if (wrongPersons.length) {
        errors.push(() => inject(sentence, form, pick(wrongPersons), "conj"));
    }
    errors.push(() => objectErrors(sentence, object));
    return { text: sentence, errors };
}

function objectErrors(sentence, object) {
    if (object.n === "p" && object.noun.endsWith("s") && !["colis"].includes(object.noun)) {
        return inject(sentence, object.noun, object.noun.slice(0, -1), "acc");
    }
    if (object.adjective && object.n === "s") {
        const wrong = THING_ADJ.flat().find((a) => a !== object.adjective && a.startsWith(object.adjective.slice(0, 3)) && (a.endsWith("s") || a.endsWith("x")));
        return wrong ? inject(sentence, object.adjective, wrong, "acc") : null;
    }
    return null;
}

function frEtre() {
    const s = subject({ allowOn: false });
    const verb = pick(ETRE_VERBS);
    const tense = pick(["present", "imparfait", "futur"]);
    const aux = ETRE[tense][s.person];
    const pp = ppForm(verb, s.g, s.n);
    const place = pick(PLACES);
    const time = tense === "futur" ? pick(TIMES.future.concat(TIMES.any)) : pick(TIMES.past.concat(TIMES.any));
    const sentence = `${capitalize(withSubject(s, aux))} ${pp} ${place}${time ? ` ${time}` : ""}.`;
    const errors = [];
    const ms = ppForm(verb, "m", "s");
    if (pp !== ms && agreementError(s, s.g, s.n, "m", "s")) {
        errors.push(() => inject(sentence, pp, ms, "acc"));
    }
    if (aux === "est") {
        errors.push(() => inject(sentence, "est", "et", "hom"));
    }
    if (aux === "sont" && !s.pronoun) {
        errors.push(() => inject(sentence, "sont", "son", "hom"));
    }
    return { text: sentence, errors };
}

function frAdjective() {
    const people = chance(0.5);
    const s = people ? subject({ allowOn: false }) : { ...nounPhrase(THINGS, null, { kinds: ["def", "poss", "dem"] }), pronoun: false };
    const tense = pick(["present", "imparfait", "futur"]);
    const aux = ETRE[tense][s.person];
    const adj = adjForm(pick(people ? PEOPLE_ADJ : THING_ADJ), s.g, s.n);
    const adverb = chance(0.4) ? `${pick(ADVERBS)} ` : "";
    const sentence = `${capitalize(withSubject(s, aux))} ${adverb}${adj}.`;
    const errors = [];
    const list = people ? PEOPLE_ADJ : THING_ADJ;
    const entry = list.find((a) => a.includes(adj));
    const wrong = entry.find((a, index) => a !== adj && agreementError(s, s.g, s.n, index >= 2 ? "f" : "m", index % 2 ? "p" : "s"));
    if (wrong) {
        errors.push(() => inject(sentence, adj, wrong, "acc"));
    }
    if (aux === "est") {
        errors.push(() => inject(sentence, "est", "et", "hom"));
    }
    if (aux === "sont" && !s.pronoun) {
        errors.push(() => inject(sentence, "sont", "son", "hom"));
    }
    return { text: sentence, errors };
}

function frPronominal() {
    const s = subject({ allowOn: false });
    const verb = pick(PRONOMINAL);
    const compound = chance(0.5);
    const reflexive = REFLEXIVE[s.person];
    const time = compound ? pick(TIMES.past.concat(TIMES.any)) : pick(TIMES.present.concat(TIMES.any));
    let sentence;
    const errors = [];
    if (compound) {
        const aux = ETRE.present[s.person];
        const pp = ppForm(verb, s.g, s.n);
        const refl = elides(aux) && ["me", "te", "se"].includes(reflexive) ? `${reflexive[0]}'` : `${reflexive} `;
        sentence = `${capitalize(s.text)} ${refl}${aux} ${pp}${time ? ` ${time}` : ""}.`;
        const ms = ppForm(verb, "m", "s");
        if (pp !== ms && agreementError(s, s.g, s.n, "m", "s")) {
            errors.push(() => inject(sentence, pp, ms, "acc"));
        }
        if (s.person === 2) {
            errors.push(() => {
                const at = sentence.indexOf("s'est");
                return at < 0 ? null : sentence.slice(0, at) + mark("c'est", "s'est", "hom") + sentence.slice(at + 5);
            });
        }
    } else {
        const form = conjugations.get(verb).tenses.present[s.person];
        const refl = elides(form) && ["me", "te", "se"].includes(reflexive) ? `${reflexive[0]}'` : `${reflexive} `;
        sentence = `${capitalize(s.text)} ${refl}${form}${time ? ` ${time}` : ""}.`;
        if (reflexive === "se" && !elides(form)) {
            errors.push(() => inject(sentence, "se", "ce", "hom"));
        }
    }
    return { text: sentence, errors };
}

function frRelative() {
    const object = nounPhrase(THINGS, null, { kinds: ["def", "dem", "poss"] });
    const s = subject();
    const verb = pick(TRANSITIVE);
    const aux = AVOIR[pick(["present", "imparfait"])][s.person];
    const pp = ppForm(verb, object.g, object.n);
    const adj = adjForm(pick(THING_ADJ), object.g, object.n);
    const be = ETRE.present[object.person];
    const que = elides(s.text) ? "qu'" : "que ";
    const sentence = `${capitalize(object.text)} ${que}${withSubject(s, aux)} ${pp} ${be} ${adj}.`;
    const errors = [];
    const ms = ppForm(verb, "m", "s");
    if (pp !== ms) {
        errors.push(() => {
            // le participe (après l'auxiliaire), pas l'adjectif
            const at = sentence.search(new RegExp(`(?<=[ '])${aux} ${pp} `)) + aux.length + 1;
            return sentence.slice(0, at) + mark(ms, pp, "acc") + sentence.slice(at + pp.length);
        });
    }
    return { text: sentence, errors };
}

function frModal() {
    const s = subject();
    const modal = pick(Object.keys(MODALS));
    const verb = pick(TRANSITIVE);
    const object = nounPhrase(THINGS, chance(0.3) ? THING_ADJ : null);
    const time = modal === "aller" ? pick(TIMES.future.concat(TIMES.any)) : pick(TIMES.any.concat(TIMES.present));
    const form = MODALS[modal][s.person];
    const sentence = `${capitalize(withSubject(s, form))} ${verb} ${object.text}${time ? ` ${time}` : ""}.`;
    const errors = [];
    if (verb.endsWith("er")) {
        errors.push(() => inject(sentence, verb, ppForm(verb, "m", "s"), "pp"));
    }
    return { text: sentence, errors };
}

function frComplex() {
    const kind = pick(["quand", "si", "pense", "faut", "mais", "parce"]);
    const s1 = subject();
    const s2 = subject();
    const v1 = pick(TRANSITIVE);
    const v2 = pick(TRANSITIVE);
    const o1 = nounPhrase(THINGS, chance(0.3) ? THING_ADJ : null);
    const o2 = nounPhrase(THINGS, null);
    const c = (verb, tense, person) => conjugations.get(verb).tenses[tense][person];
    let sentence;
    let target = null;
    switch (kind) {
        case "quand":
            sentence = `Quand ${withSubject(s1, c(v1, "futur", s1.person))} ${o1.text}, ${withSubject(s2, c(v2, "futur", s2.person))} ${o2.text}.`;
            target = [s2, v2, "futur"];
            break;
        case "si":
            sentence = `Si ${withSubject(s1, c(v1, "imparfait", s1.person))} ${o1.text}, ${withSubject(s2, c(v2, "conditionnel", s2.person))} ${o2.text}.`.replace(/^Si (ils?) /, "S'$1 ");
            target = [s2, v2, "conditionnel"];
            break;
        case "pense": {
            const que = elides(s2.text) ? "qu'" : "que ";
            sentence = `${pick(["Je pense", "Je crois", "Il dit", "On sait"])} ${que}${withSubject(s2, c(v2, "present", s2.person))} ${o2.text}.`;
            target = [s2, v2, "present"];
            break;
        }
        case "faut": {
            const que = elides(s2.text) ? "qu'" : "que ";
            sentence = `Il faut ${que}${withSubject(s2, c(v2, "subjonctif", s2.person))} ${o2.text} ${pick(["avant ce soir", "rapidement", "aujourd'hui", "sans attendre"])}.`;
            target = [s2, v2, "subjonctif"];
            break;
        }
        case "mais":
            sentence = `${capitalize(withSubject(s1, c(v1, "present", s1.person)))} ${o1.text}, mais ${withSubject(s2, c(v2, "present", s2.person))} ${o2.text}.`;
            target = [s2, v2, "present"];
            break;
        default:
            sentence = `${capitalize(withSubject(s1, c(v1, "imparfait", s1.person)))} ${o1.text} parce ${elides(s2.text) ? "qu'" : "que "}${withSubject(s2, c(v2, "imparfait", s2.person))} ${o2.text}.`;
            target = [s2, v2, "imparfait"];
    }
    sentence = sentence.replace(/^je /, "Je ").replace(/^j'/, "J'");
    const errors = [];
    const [subj, verb, tense] = target;
    const forms = conjugations.get(verb).tenses[tense];
    const right = forms[subj.person];
    const wrong = forms.filter((f, i) => f !== right && i !== subj.person);
    if (wrong.length) {
        errors.push(() => {
            const at = sentence.lastIndexOf(` ${right} `);
            return at < 0 ? null : sentence.slice(0, at + 1) + mark(pick(wrong), right, "conj") + sentence.slice(at + 1 + right.length);
        });
    }
    return { text: sentence, errors };
}

// Sujet éloigné du verbe : complément du nom, relative, sujets coordonnés.
function frDistant() {
    const subject = nounPhrase(PEOPLE, null, { kinds: ["def", "poss", "dem"] });
    const verb = pick(TRANSITIVE);
    const object = nounPhrase(THINGS, null);
    const tense = pick(["present", "imparfait", "futur"]);
    let middle;
    let person = subject.person;
    const kind = pick(["de", "que", "qui", "et"]);
    if (kind === "de") {
        const other = nounPhrase(THINGS, chance(0.3) ? THING_ADJ : null, { kinds: ["def"] });
        middle = ` ${other.text.startsWith("le ") ? `du ${other.text.slice(3)}` : other.text.startsWith("les ") ? `des ${other.text.slice(4)}` : `de ${other.text}`}`;
    } else if (kind === "que") {
        const s2 = pick(PRONOUNS.filter((p) => !p.on));
        const v2 = pick(TRANSITIVE);
        const aux = AVOIR.present[s2.person];
        const pp = ppForm(v2, subject.g, subject.n);
        middle = ` ${elides(s2.word) ? "qu'" : "que "}${s2.word === "je" && elides(aux) ? `j'${aux}` : `${s2.word} ${aux}`} ${pp} ${pick(["hier", "ce matin", "la semaine dernière"])}`;
    } else if (kind === "qui") {
        const v2 = pick(TRANSITIVE);
        middle = ` qui ${conjugations.get(v2).tenses.imparfait[subject.person]} ${nounPhrase(THINGS, null, { kinds: ["def", "indef"] }).text}`;
    } else {
        const other = nounPhrase(PEOPLE, null, { kinds: ["poss", "def"] });
        middle = ` et ${other.text}`;
        person = 5;
    }
    const forms = conjugations.get(verb).tenses[tense];
    const form = forms[person];
    const sentence = `${capitalize(subject.text)}${middle} ${form} ${object.text}.`;
    const wrong = forms[person === 5 ? 2 : 5];
    const errors = [];
    if (wrong !== form) {
        errors.push(() => {
            const at = sentence.lastIndexOf(` ${form} `);
            return at < 0 ? null : sentence.slice(0, at + 1) + mark(wrong, form, "conj") + sentence.slice(at + 1 + form.length);
        });
    }
    return { text: sentence, errors };
}

// ---------------------------------------------------------------------------------------------
// Anglais
// ---------------------------------------------------------------------------------------------

// [base, 3e personne, passé, participe, -ing]
const EN_VERBS = [
    ["fix", "fixes", "fixed", "fixed", "fixing"], ["check", "checks", "checked", "checked", "checking"], ["install", "installs", "installed", "installed", "installing"],
    ["update", "updates", "updated", "updated", "updating"], ["need", "needs", "needed", "needed", "needing"], ["want", "wants", "wanted", "wanted", "wanting"],
    ["clean", "cleans", "cleaned", "cleaned", "cleaning"], ["open", "opens", "opened", "opened", "opening"], ["watch", "watches", "watched", "watched", "watching"],
    ["see", "sees", "saw", "seen", "seeing"], ["take", "takes", "took", "taken", "taking"], ["write", "writes", "wrote", "written", "writing"],
    ["give", "gives", "gave", "given", "giving"], ["do", "does", "did", "done", "doing"], ["break", "breaks", "broke", "broken", "breaking"],
    ["choose", "chooses", "chose", "chosen", "choosing"], ["buy", "buys", "bought", "bought", "buying"], ["bring", "brings", "brought", "brought", "bringing"],
    ["forget", "forgets", "forgot", "forgotten", "forgetting"], ["send", "sends", "sent", "sent", "sending"], ["find", "finds", "found", "found", "finding"],
    ["read", "reads", "read", "read", "reading"], ["sell", "sells", "sold", "sold", "selling"], ["lose", "loses", "lost", "lost", "losing"],
];
const EN_SUBJECTS = [
    { text: "I", p: "1s" }, { text: "you", p: "2" }, { text: "he", p: "3s" }, { text: "she", p: "3s" }, { text: "we", p: "p" }, { text: "they", p: "p" },
    { text: "the technician", p: "3s" }, { text: "my friend", p: "3s" }, { text: "our manager", p: "3s" }, { text: "the new intern", p: "3s" },
    { text: "the technicians", p: "p" }, { text: "my friends", p: "p" }, { text: "the children", p: "p" }, { text: "my parents", p: "p" },
];
const EN_OBJECTS = ["the report", "a new laptop", "an old router", "the files", "the backup", "their keys", "the documentation", "a long email", "the server logs", "an invoice", "the printer", "a few tickets"];
const EN_TIMES = { past: ["yesterday", "last night", "two days ago", "this morning", ""], present: ["every day", "on Mondays", "every morning", "", ""], future: ["tomorrow", "next week", "soon", ""] };
const enCap = (t) => t[0].toUpperCase() + t.slice(1);

function enSimple() {
    const s = pick(EN_SUBJECTS);
    const v = pick(EN_VERBS);
    const tense = pick(["present", "past", "perfect", "future", "progressive", "pastperfect"]);
    const o = pick(EN_OBJECTS);
    const errors = [];
    let verbText;
    let time;
    const third = s.p === "3s";
    if (tense === "present") {
        verbText = third ? v[1] : v[0];
        time = pick(EN_TIMES.present);
        if (third && v[1] !== v[0]) {
            errors.push((sentence) => inject(sentence, v[1], v[0], "acc"));
        } else if (!third) {
            errors.push((sentence) => inject(sentence, v[0], v[1], "acc"));
        }
    } else if (tense === "past") {
        verbText = v[2];
        time = pick(EN_TIMES.past);
    } else if (tense === "perfect") {
        const aux = third ? "has" : "have";
        verbText = `${aux} ${v[3]}`;
        time = pick(["already", "just", ""]);
        if (time) {
            verbText = `${aux} ${time} ${v[3]}`;
            time = "";
        }
        errors.push((sentence) => inject(sentence, aux, third ? "have" : "has", "acc"));
        if (v[2] !== v[3]) {
            errors.push((sentence) => inject(sentence, v[3], v[2], "conj"));
        }
    } else if (tense === "pastperfect") {
        verbText = `had ${v[3]}`;
        time = pick(["before the meeting", "by noon", ""]);
        if (v[2] !== v[3]) {
            errors.push((sentence) => inject(sentence, v[3], v[2], "conj"));
        }
    } else if (tense === "future") {
        verbText = `will ${v[0]}`;
        time = pick(EN_TIMES.future);
    } else {
        const be = s.text === "I" ? "am" : third ? "is" : "are";
        verbText = `${be} ${v[4]}`;
        time = pick(["right now", "at the moment", ""]);
        if (be !== "am") {
            errors.push((sentence) => inject(sentence, be, be === "is" ? "are" : "is", "acc"));
        }
    }
    const sentence = `${enCap(s.text)} ${verbText} ${o}${time ? ` ${time}` : ""}.`;
    return { text: sentence, errors: errors.map((e) => () => e(sentence)) };
}

const EN_FIXED = [
    // [phrase juste, [mot, faute, catégorie] …]
    ["It's raining again, so take an umbrella.", [["It's", "Its", "hom"]]],
    ["The dog wagged its tail when we came home.", [["its", "it's", "hom"]]],
    ["They're late because their car broke down.", [["They're", "Their", "hom"], ["their", "there", "hom"]]],
    ["There are three servers in the rack.", [["There", "Their", "hom"], ["are", "is", "acc"]]],
    ["You're welcome to join us.", [["You're", "Your", "hom"]]],
    ["Your password expires tomorrow.", [["Your", "You're", "hom"]]],
    ["This laptop is faster than mine.", [["than", "then", "hom"]]],
    ["We restarted the router, and then everything worked.", [["then", "than", "hom"]]],
    ["It was an honest mistake.", [["an", "a", "acc"]]],
    ["She bought a new car last week.", [["a", "an", "acc"]]],
    ["This coffee is too hot to drink.", [["too", "to", "hom"]]],
    ["Whose laptop is this?", [["Whose", "Who's", "hom"]]],
    ["Who's coming to the party tonight?", [["Who's", "Whose", "hom"]]],
    ["He doesn't know the answer.", [["doesn't", "don't", "acc"]]],
    ["They were at the meeting yesterday.", [["were", "was", "acc"]]],
    ["She has two cats and a dog.", [["has", "have", "acc"]]],
    ["I should have left earlier.", [["have", "of", "conj"]]],
    ["Don't lose your keys again.", [["lose", "loose", "hom"]]],
    ["The screws are loose.", [["loose", "lose", "hom"]]],
    ["The weather can affect your mood.", [["affect", "effect", "hom"]]],
    ["The effect of the patch was immediate.", [["effect", "affect", "hom"]]],
    ["I received your email this morning.", [["received", "recieved", "ortho"]]],
    ["This is definitely the best option.", [["definitely", "definately", "ortho"]]],
    ["Please keep the files separate.", [["separate", "seperate", "ortho"]]],
    ["The incident occurred at midnight.", [["occurred", "occured", "ortho"]]],
    ["I will wait until you come back.", [["until", "untill", "ortho"]]],
    ["We need to address this issue.", [["address", "adress", "ortho"]]],
    ["I'll send you the report tomorrow.", [["tomorrow", "tommorow", "ortho"]]],
    ["One of the disks is failing.", [["is", "are", "acc"]]],
    ["The children were playing in the garden.", [["were", "was", "acc"]]],
    ["My brother and I were late.", [["were", "was", "acc"]]],
    ["She had already gone home when I arrived.", [["gone", "went", "conj"]]],
    ["Make sure to choose a strong password.", [["choose", "chose", "hom"]]],
    ["Then we restarted the router.", [["Then", "Than", "hom"]]],
    ["I think it's time to replace this switch.", [["it's", "its", "hom"]]],
    ["Fewer people came than expected.", [["Fewer", "Less", "acc"]]],
    ["He lent me his car for the weekend.", [["lent", "lended", "conj"]]],
    ["I paid the invoice yesterday.", [["paid", "payed", "conj"]]],
];

function enFixed() {
    const [text, variants] = pick(EN_FIXED);
    return { text, errors: variants.map(([right, wrong, cat]) => () => inject(text, right, wrong, cat)) };
}

// ---------------------------------------------------------------------------------------------
// Fautes de frappe (les deux langues) : une lettre en moins, en trop, inversée, accent oublié.
// ---------------------------------------------------------------------------------------------
const NEIGHBOURS = { a: "zq", z: "ae", e: "zr", r: "et", t: "ry", y: "tu", u: "yi", i: "uo", o: "ip", p: "o", q: "as", s: "qd", d: "sf", f: "dg", g: "fh", h: "gj", j: "hk", k: "jl", l: "km", m: "l", w: "x", x: "wc", c: "xv", v: "cb", b: "vn", n: "b" };
const STRIP = { é: "e", è: "e", ê: "e", à: "a", â: "a", ç: "c", î: "i", ô: "o", û: "u", ù: "u" };

function typo(word) {
    const i = 1 + Math.floor(random() * (word.length - 2));
    const kind = pick(["drop", "double", "swap", "neighbour", "accent"]);
    if (kind === "accent" && /[éèêàâçîôûù]/.test(word)) {
        return word.replace(/[éèêàâçîôûù]/, (c) => STRIP[c]);
    }
    if (kind === "drop") {
        return word.slice(0, i) + word.slice(i + 1);
    }
    if (kind === "double") {
        return word.slice(0, i) + word[i] + word.slice(i);
    }
    if (kind === "swap" && word[i] !== word[i + 1] && i + 1 < word.length) {
        return word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2);
    }
    const n = NEIGHBOURS[word[i]];
    return n ? word.slice(0, i) + n[Math.floor(random() * n.length)] + word.slice(i + 1) : word.slice(0, i) + word.slice(i + 1);
}

function typoError(sentence) {
    const words = [...sentence.matchAll(/(?<![\p{L}'])\p{Ll}{5,}(?![\p{L}'])/gu)].filter((m) => m.index > 0);
    if (!words.length) {
        return null;
    }
    const w = pick(words);
    const wrong = typo(w[0]);
    if (wrong === w[0]) {
        return null;
    }
    return sentence.slice(0, w.index) + mark(wrong, w[0], "frappe") + sentence.slice(w.index + w[0].length);
}

// ---------------------------------------------------------------------------------------------
// Boucle
// ---------------------------------------------------------------------------------------------
const FR_TEMPLATES = { simple: frSimple, etre: frEtre, adjectif: frAdjective, pronominal: frPronominal, relative: frRelative, modal: frModal, complexe: frComplex, eloigne: frDistant };
const EN_TEMPLATES = { simple: enSimple, fixe: enFixed };

const aria = createAria(nodePlatform);
const stats = { checks: 0, crashes: [], times: [], memory: [], correct: {}, wrong: {}, falseByRule: {}, missByKind: {}, examples: { false: {}, miss: {} } };
const bucket = (obj, key) => (obj[key] ??= { n: 0, found: 0, fixed: 0, first: 0, falseAlerts: 0 });
const remember = (obj, key, value, max = 6) => {
    obj[key] ??= [];
    if (obj[key].length < max && !obj[key].includes(value)) {
        obj[key].push(value);
    }
};
// Une « faute de frappe » qui donne un autre mot juste (« porte » → « pote ») n'est pas une faute
// d'orthographe : on vérifie que le mot seul est bien inconnu.
const unknownCache = new Map();
async function isUnknown(word, lang) {
    const key = `${lang}:${word}`;
    if (!unknownCache.has(key)) {
        const { matches } = await aria.check({ text: word, lang });
        unknownCache.set(key, matches.some((m) => m.kind === "orthographe"));
    }
    return unknownCache.get(key);
}

async function runOne() {
    const lang = onlyLang ?? (chance(0.65) ? "fr" : "en");
    const templates = lang === "fr" ? FR_TEMPLATES : EN_TEMPLATES;
    const name = pick(Object.keys(templates));
    const { text, errors } = templates[name]();
    let source = text;
    let kind = "juste";
    if (chance(0.6)) {
        const typoPick = chance(0.2);
        const candidates = typoPick ? [() => typoError(text)] : errors;
        if (candidates.length) {
            const made = pick(candidates)();
            if (made) {
                source = made;
                kind = /\|(\w+)\}\}/.exec(made)[1];
                if (kind === "frappe") {
                    const wrongWord = /\{\{(.+?)=>/.exec(made)[1];
                    if (!(await isUnknown(wrongWord, lang))) {
                        source = text;
                        kind = "juste";
                    }
                }
            }
        }
    }
    const parsed = parse(source);
    const start = performance.now();
    let matches;
    try {
        ({ matches } = await aria.check({ text: parsed.wrong, lang }));
    } catch (error) {
        stats.crashes.push({ text: parsed.wrong, lang, error: String(error.message) });
        return;
    }
    stats.times.push(performance.now() - start);
    stats.checks++;
    const result = evaluate(parsed, matches);
    const key = `${lang}:${kind === "juste" ? name : `${kind}`}`;
    if (kind === "juste") {
        const b = bucket(stats.correct, `${lang}:${name}`);
        b.n++;
        if (result.falseAlerts.length) {
            b.falseAlerts++;
            for (const m of result.falseAlerts) {
                stats.falseByRule[`${lang}:${m.rule}`] = (stats.falseByRule[`${lang}:${m.rule}`] ?? 0) + 1;
                remember(stats.examples.false, `${lang}:${m.rule}`, `${parsed.wrong}  «${parsed.wrong.slice(m.start, m.end)}» → ${m.suggestions.slice(0, 2).join(" | ")}`);
            }
        }
    } else {
        const b = bucket(stats.wrong, `${key}:${name}`);
        b.n++;
        const zone = result.zones[0];
        b.found += zone.found ? 1 : 0;
        b.fixed += zone.fixed ? 1 : 0;
        b.first += zone.first ? 1 : 0;
        b.falseAlerts += result.falseAlerts.length ? 1 : 0;
        if (!zone.first) {
            const how = zone.found ? (zone.fixed ? "2e rang" : "mauvaise") : "ratée";
            remember(stats.examples.miss, `${key}:${name}:${how}`, `${parsed.wrong}  [${zone.wrong} → ${zone.right}]${zone.found ? `  proposé : ${matches.filter((m) => m.start < zone.end && m.end > zone.start).map((m) => m.suggestions.slice(0, 2).join(" | ")).join(" ; ")}` : ""}`);
        }
        for (const m of result.falseAlerts) {
            remember(stats.examples.false, `${lang}:${m.rule}`, `${parsed.wrong}  «${parsed.wrong.slice(m.start, m.end)}» → ${m.suggestions.slice(0, 2).join(" | ")}`);
        }
    }
}

const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)} %` : "—");
const quantile = (list, q) => {
    const sorted = [...list].sort((a, b) => a - b);
    return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0;
};

function report() {
    const lines = [];
    lines.push(`\nEndurance : ${stats.checks} analyses en ${minutes} min (graine ${startSeed}) · plantages ${stats.crashes.length}`);
    lines.push(`Temps : médiane ${quantile(stats.times, 0.5).toFixed(1)} ms · 99e centile ${quantile(stats.times, 0.99).toFixed(1)} ms · max ${Math.max(0, ...stats.times).toFixed(0)} ms`);
    lines.push(`Mémoire (RSS) : ${stats.memory.map((m) => `${m} Mo`).join(" → ")}`);
    lines.push("\nPhrases justes (fausse alerte = au moins une remarque d'orthographe ou de grammaire) :");
    for (const [key, b] of Object.entries(stats.correct).sort()) {
        lines.push(`  ${key.padEnd(18)} ${String(b.n).padStart(6)} phrases · fausses alertes ${pct(b.falseAlerts, b.n)}`);
    }
    lines.push("\nPhrases fautives :");
    const totals = {};
    for (const [key, b] of Object.entries(stats.wrong).sort()) {
        lines.push(`  ${key.padEnd(28)} ${String(b.n).padStart(6)} · trouvées ${pct(b.found, b.n).padStart(7)} · bien corrigées ${pct(b.fixed, b.n).padStart(7)} · en tête ${pct(b.first, b.n).padStart(7)}`);
        const lang = key.split(":")[0];
        const t = (totals[lang] ??= { n: 0, found: 0, first: 0 });
        t.n += b.n;
        t.found += b.found;
        t.first += b.first;
    }
    for (const [lang, t] of Object.entries(totals)) {
        lines.push(`  TOTAL ${lang} : ${t.n} fautes · trouvées ${pct(t.found, t.n)} · en tête ${pct(t.first, t.n)}`);
    }
    const justes = Object.entries(stats.correct).reduce((acc, [k, b]) => {
        const lang = k.split(":")[0];
        (acc[lang] ??= { n: 0, fa: 0 }).n += b.n;
        acc[lang].fa += b.falseAlerts;
        return acc;
    }, {});
    for (const [lang, t] of Object.entries(justes)) {
        lines.push(`  TOTAL ${lang} : ${t.n} phrases justes · avec fausse alerte ${pct(t.fa, t.n)}`);
    }
    lines.push("\nFausses alertes par règle :");
    for (const [rule, n] of Object.entries(stats.falseByRule).sort((a, b) => b[1] - a[1]).slice(0, 25)) {
        lines.push(`  ${String(n).padStart(6)}  ${rule}`);
        for (const ex of stats.examples.false[rule] ?? []) {
            lines.push(`          ${ex}`);
        }
    }
    lines.push("\nExemples de fautes ratées ou mal corrigées :");
    for (const [key, list] of Object.entries(stats.examples.miss).sort()) {
        lines.push(`  ${key}`);
        list.forEach((ex) => lines.push(`      ${ex}`));
    }
    if (stats.crashes.length) {
        lines.push("\nPlantages :");
        stats.crashes.slice(0, 10).forEach((c) => lines.push(`  [${c.lang}] ${c.text} : ${c.error}`));
    }
    return lines.join("\n");
}

try {
    await loadConjugations(aria);
    const end = Date.now() + minutes * 60_000;
    let nextMemory = 0;
    while (Date.now() < end) {
        await runOne();
        if (Date.now() >= nextMemory) {
            stats.memory.push(Math.round(process.memoryUsage().rss / 1048576));
            nextMemory = Date.now() + Math.max(60_000, (minutes * 60_000) / 10);
        }
    }
    stats.memory.push(Math.round(process.memoryUsage().rss / 1048576));
} finally {
    await aria.close();
}
const text = report();
console.log(text);
if (out) {
    fs.writeFileSync(out, JSON.stringify({ seed: startSeed, minutes, ...stats, times: undefined, timeSummary: { median: quantile(stats.times, 0.5), p99: quantile(stats.times, 0.99) } }, null, 2));
}
process.exitCode = stats.crashes.length ? 1 : 0;
