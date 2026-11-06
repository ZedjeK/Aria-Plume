// Aria Plume — grand banc génératif (06/11/2026) : « toutes les possibilités », reproductible.
//
// Des gabarits croisent sujets, personnes, temps, verbes, groupes nominaux, accords, homophones,
// orthographe et fautes de frappe. Chaque cas existe en version juste (fausses alertes) et en
// version fautive (une faute injectée, dont on connaît la correction). Même graine → mêmes phrases :
// le banc sert de référence (baseline.json) comme les autres.
//
//   buildFrench(aria, options)      → textes { lang: "fr", genre, text } balisés comme textes.mjs
//   buildEnglish(options)           → textes { lang: "en", genre, text }
//   buildTranslation(aria, options) → phrases { from, genre, text, ref, must, not?, register? }
//
// options : { seed = 2026, perFamily = 60 }. La famille est dans `genre`.

import fs from "node:fs";
import zlib from "node:zlib";

// --- Hasard reproductible (mulberry32) ---
function makeRandom(seed) {
    let s = seed | 0;
    const random = () => {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
        random,
        pick: (list) => list[Math.floor(random() * list.length)],
        chance: (p) => random() < p,
    };
}

const mark = (wrong, right, cat) => `{{${wrong}=>${right}|${cat}}}`;
const capitalize = (t) => t[0].toUpperCase() + t.slice(1);
const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Remplace la n-ième occurrence (mot entier) de `value` par une faute balisée.
function inject(text, value, wrong, cat, nth = 0) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}'’-])${escapeRe(value)}(?![\\p{L}\\p{N}-])`, "gu");
    let k = 0;
    let done = false;
    const out = text.replace(re, (m) => {
        if (done || k++ !== nth) {
            return m;
        }
        done = true;
        return mark(wrong, m, cat);
    });
    return done ? out : null;
}

// ============================================================================================
// Français
// ============================================================================================

const VOWEL = /^[aeiouyhâàéèêëîïôûœ]/i;
const H_ASPIRE = new Set(["haricot", "héros", "hibou", "hamster", "hall", "hache", "haie", "hangar", "hasard", "hauteur"]);
const elides = (word) => VOWEL.test(word) && !H_ASPIRE.has(word);

// Noms : [singulier, pluriel, genre, classe]
const FR_NOUNS = [
    ["rapport", "rapports", "m", "doc"], ["lettre", "lettres", "f", "doc"], ["facture", "factures", "f", "doc"], ["message", "messages", "m", "doc"],
    ["fichier", "fichiers", "m", "doc"], ["livre", "livres", "m", "doc"], ["document", "documents", "m", "doc"], ["contrat", "contrats", "m", "doc"],
    ["photo", "photos", "f", "doc"], ["liste", "listes", "f", "doc"],
    ["ordinateur", "ordinateurs", "m", "dev"], ["imprimante", "imprimantes", "f", "dev"], ["serveur", "serveurs", "m", "dev"], ["téléphone", "téléphones", "m", "dev"],
    ["voiture", "voitures", "f", "dev"], ["machine", "machines", "f", "dev"], ["vélo", "vélos", "m", "dev"], ["écran", "écrans", "m", "dev"],
    ["tablette", "tablettes", "f", "dev"], ["console", "consoles", "f", "dev"],
    ["gâteau", "gâteaux", "m", "food"], ["pomme", "pommes", "f", "food"], ["soupe", "soupes", "f", "food"], ["pizza", "pizzas", "f", "food"],
    ["salade", "salades", "f", "food"], ["tarte", "tartes", "f", "food"], ["sandwich", "sandwichs", "m", "food"], ["dessert", "desserts", "m", "food"],
];
const FR_PEOPLE = [
    ["technicien", "techniciens", "m"], ["voisin", "voisins", "m"], ["directeur", "directeurs", "m"], ["client", "clients", "m"],
    ["ami", "amis", "m"], ["cousin", "cousins", "m"], ["collègue", "collègues", "e"], ["élève", "élèves", "e"], ["frère", "frères", "m"],
    ["technicienne", "techniciennes", "f"], ["voisine", "voisines", "f"], ["directrice", "directrices", "f"], ["cliente", "clientes", "f"],
    ["amie", "amies", "f"], ["cousine", "cousines", "f"], ["sœur", "sœurs", "f"], ["infirmière", "infirmières", "f"], ["stagiaire", "stagiaires", "e"],
];
// Adjectifs : [m:s, m:p, f:s, f:p, classe]
const FR_ADJ = [
    ["rapide", "rapides", "rapide", "rapides", "dev"], ["lent", "lents", "lente", "lentes", "dev"], ["cassé", "cassés", "cassée", "cassées", "dev"],
    ["neuf", "neufs", "neuve", "neuves", "dev"], ["vieux", "vieux", "vieille", "vieilles", "dev"], ["bruyant", "bruyants", "bruyante", "bruyantes", "dev"],
    ["important", "importants", "importante", "importantes", "doc"], ["long", "longs", "longue", "longues", "doc"], ["complet", "complets", "complète", "complètes", "doc"],
    ["récent", "récents", "récente", "récentes", "doc"], ["officiel", "officiels", "officielle", "officielles", "doc"],
    ["délicieux", "délicieux", "délicieuse", "délicieuses", "food"], ["frais", "frais", "fraîche", "fraîches", "food"], ["sucré", "sucrés", "sucrée", "sucrées", "food"],
    ["chaud", "chauds", "chaude", "chaudes", "food"], ["parfait", "parfaits", "parfaite", "parfaites", "food"],
];
const FR_PEOPLE_ADJ = [
    ["content", "contents", "contente", "contentes"], ["fatigué", "fatigués", "fatiguée", "fatiguées"], ["prêt", "prêts", "prête", "prêtes"],
    ["occupé", "occupés", "occupée", "occupées"], ["inquiet", "inquiets", "inquiète", "inquiètes"], ["heureux", "heureux", "heureuse", "heureuses"],
    ["déçu", "déçus", "déçue", "déçues"], ["surpris", "surpris", "surprise", "surprises"], ["sérieux", "sérieux", "sérieuse", "sérieuses"],
    ["gentil", "gentils", "gentille", "gentilles"], ["actif", "actifs", "active", "actives"], ["patient", "patients", "patiente", "patientes"],
];
// Verbes transitifs et les classes d'objets qu'ils prennent.
const FR_VERBS = {
    doc: ["lire", "écrire", "envoyer", "imprimer", "recevoir", "signer", "corriger", "terminer", "oublier", "perdre", "chercher", "trouver", "garder", "ranger", "modifier", "préparer", "vérifier", "relire", "copier", "jeter"],
    dev: ["réparer", "configurer", "installer", "vérifier", "nettoyer", "vendre", "acheter", "allumer", "éteindre", "remplacer", "déplacer", "perdre", "trouver", "prendre", "voir", "ouvrir", "essayer", "payer"],
    food: ["manger", "préparer", "acheter", "goûter", "couper", "finir", "partager", "apporter", "commander", "prendre", "faire", "choisir", "servir", "mettre"],
};
const FR_ETRE_VERBS = ["arriver", "partir", "venir", "tomber", "rester", "entrer", "sortir", "rentrer", "revenir", "descendre", "monter", "naître", "devenir", "retourner"];
const FR_PRONOMINAL = ["lever", "tromper", "reposer", "amuser", "dépêcher", "arrêter", "préparer", "inquiéter", "coucher", "promener", "habiller", "perdre", "souvenir", "réveiller", "blesser", "excuser"];
const FR_PLACES = ["au bureau", "à la gare", "chez ses parents", "dans le parc", "à Lyon", "à Bordeaux", "au Japon", "à la maison", "devant l'école", "en ville"];
const FR_TIMES = {
    present: ["chaque jour", "en ce moment", "le samedi", "tous les matins", "souvent"],
    imparfait: ["autrefois", "chaque été", "à l'époque", "tous les soirs", "quand il pleuvait"],
    futur: ["demain", "la semaine prochaine", "bientôt", "dans deux heures", "jeudi prochain"],
    passe: ["hier soir", "ce matin", "la semaine dernière", "lundi dernier", "il y a deux jours"],
};
const PRONOUNS = [
    { word: "je", person: 0, n: "s" }, { word: "tu", person: 1, n: "s" }, { word: "il", person: 2, g: "m", n: "s" },
    { word: "elle", person: 2, g: "f", n: "s" }, { word: "on", person: 2, g: "m", n: "s" }, { word: "nous", person: 3, n: "p" },
    { word: "vous", person: 4, n: "p" }, { word: "ils", person: 5, g: "m", n: "p" }, { word: "elles", person: 5, g: "f", n: "p" },
];
const ETRE = { present: ["suis", "es", "est", "sommes", "êtes", "sont"], imparfait: ["étais", "étais", "était", "étions", "étiez", "étaient"], futur: ["serai", "seras", "sera", "serons", "serez", "seront"], conditionnel: ["serais", "serais", "serait", "serions", "seriez", "seraient"] };
const AVOIR = { present: ["ai", "as", "a", "avons", "avez", "ont"], imparfait: ["avais", "avais", "avait", "avions", "aviez", "avaient"], futur: ["aurai", "auras", "aura", "aurons", "aurez", "auront"], conditionnel: ["aurais", "aurais", "aurait", "aurions", "auriez", "auraient"] };
const REFLEXIVE = ["me", "te", "se", "nous", "vous", "se"];
const MODALS = { aller: ["vais", "vas", "va", "allons", "allez", "vont"], pouvoir: ["peux", "peux", "peut", "pouvons", "pouvez", "peuvent"], devoir: ["dois", "dois", "doit", "devons", "devez", "doivent"], vouloir: ["veux", "veux", "veut", "voulons", "voulez", "veulent"] };
const TENSE_KEYS = { "Indicatif:Présent": "present", "Indicatif:Imparfait": "imparfait", "Indicatif:Futur": "futur", "Indicatif:Passé simple": "simple", "Subjonctif:Présent": "subjonctif", "Conditionnel:Présent": "conditionnel", "Impératif:Présent": "imperatif" };

async function loadConjugations(aria, verbs) {
    const table = new Map();
    for (const verb of verbs) {
        const t = await aria.conjugate({ verb });
        if (!t.found) {
            continue;
        }
        const tenses = {};
        for (const mood of t.moods) {
            for (const tense of mood.tenses) {
                const key = TENSE_KEYS[`${mood.name}:${tense.name}`];
                if (key) {
                    tenses[key] = tense.forms.map((f) => f.replace(/’/g, "'").replace(/^(?:que |qu')?(?:je |j'|tu |il |elle |nous |vous |ils |elles )/, ""));
                }
            }
        }
        const pp = t.pastParticiples;
        const participle = pp.length === 4 ? { ms: pp[0], fs: pp[1], mp: pp[2], fp: pp[3] } : { ms: pp[0], fs: pp[1], mp: pp[0], fp: pp[2] ?? pp[1] };
        table.set(verb, { tenses, participle, aux: t.auxiliary });
    }
    return table;
}

const withSubject = (s, word) => (s === "je" && elides(word) ? `j'${word}` : `${s} ${word}`);
const adjForm = (adj, g, n) => adj[(g === "f" ? 2 : 0) + (n === "p" ? 1 : 0)];
// Nom épicène (collègue, élève, stagiaire) : le genre n'est pas connu, seul le nombre peut être faux.
const genderOf = (g) => (g === "e" ? "m" : g);
function determiner(R, kind, noun, g, n) {
    if (n === "p") {
        return { def: "les", indef: "des", poss: R.pick(["mes", "tes", "ses", "nos", "vos", "leurs"]), dem: "ces" }[kind];
    }
    const vowel = elides(noun);
    if (kind === "def") {
        return vowel ? "l'" : g === "f" ? "la" : "le";
    }
    if (kind === "indef") {
        return g === "f" ? "une" : "un";
    }
    if (kind === "dem") {
        return g === "f" ? "cette" : vowel ? "cet" : "ce";
    }
    const poss = R.pick(["mon", "ton", "son", "notre", "votre", "leur"]);
    return g === "f" && !vowel && ["mon", "ton", "son"].includes(poss) ? { mon: "ma", ton: "ta", son: "sa" }[poss] : poss;
}
const join = (det, noun) => (det.endsWith("'") ? det + noun : `${det} ${noun}`);
function np(R, list, { kinds = ["def", "indef", "poss", "dem"], n = null, cls = null } = {}) {
    const pool = cls ? list.filter((x) => x[3] === cls) : list;
    const [sing, plur, g, klass] = R.pick(pool);
    const num = n ?? (R.chance(0.45) ? "p" : "s");
    const noun = num === "p" ? plur : sing;
    const det = determiner(R, R.pick(kinds), noun, g, num);
    return { text: join(det, noun), g, n: num, noun, det, cls: klass, sing, plur };
}

// Une famille = une fonction qui renvoie { genre, right, wrong? } ; wrong est le texte balisé.
function frenchFamilies(R, C) {
    const conj = (verb, tense, person) => C.get(verb)?.tenses[tense]?.[person];
    const pp = (verb, g = "m", n = "s") => C.get(verb)?.participle[`${g}${n}`];
    const verbFor = (cls) => R.pick(FR_VERBS[cls]);
    const sentenceEnd = () => R.pick([".", ".", ".", " !"]);
    const families = {};

    // 1. Accord sujet pronom + verbe, tous les temps simples.
    families.sv_pronom = () => {
        const p = R.pick(PRONOUNS);
        const tense = R.pick(["present", "present", "imparfait", "futur", "conditionnel"]);
        const obj = np(R, FR_NOUNS, { kinds: ["def", "poss", "dem", "indef"] });
        const verb = verbFor(obj.cls);
        const form = conj(verb, tense, p.person);
        if (!form) {
            return null;
        }
        const timeKey = tense === "conditionnel" ? "present" : tense;
        const time = R.chance(0.6) ? ` ${R.pick(FR_TIMES[timeKey])}` : "";
        const right = `${capitalize(withSubject(p.word, form))} ${obj.text}${time}${sentenceEnd()}`;
        const others = [0, 1, 2, 5].map((k) => conj(verb, tense, k)).filter((f) => f && f !== form);
        if (!others.length || (p.word === "je" && elides(form) !== elides(others[0]))) {
            return { genre: "sv_pronom", right };
        }
        const wrongForm = R.pick(others);
        const subjectPart = p.word === "je" && elides(form) ? "J'" : `${capitalize(p.word)} `;
        const wrong = `${subjectPart}${mark(wrongForm, form, "conj")} ${obj.text}${time}${sentenceEnd()}`;
        return { genre: "sv_pronom", right, wrong: elides(wrongForm) === elides(form) ? wrong : null };
    };

    // 2. Sujet nom (avec complément ou relative) + verbe.
    families.sv_nom = () => {
        const subj = np(R, FR_PEOPLE.map((x) => [...x, "p"]), { kinds: ["def", "poss", "dem"] });
        const tense = R.pick(["present", "imparfait", "futur"]);
        const obj = np(R, FR_NOUNS, { kinds: ["def", "poss", "indef"] });
        const verb = verbFor(obj.cls);
        const person = subj.n === "p" ? 5 : 2;
        const form = conj(verb, tense, person);
        const other = conj(verb, tense, person === 5 ? 2 : 5);
        if (!form || !other) {
            return null;
        }
        const extra = R.pick(["", "", ` de ${R.pick(["Paul", "Inès", "l'équipe", "la mairie", "mon frère"])}`, ` que j'ai ${R.pick(["vu", "rencontré", "appelé"])}${subj.g === "f" ? "e" : ""}${subj.n === "p" ? "s" : ""} hier`, ` du ${R.pick(["deuxième étage", "service client", "garage"])}`]);
        const head = `${capitalize(subj.text)}${extra}`;
        const right = `${head} ${form} ${obj.text}.`;
        return { genre: extra ? "sv_eloigne" : "sv_nom", right, wrong: `${head} ${mark(other, form, "conj")} ${obj.text}.` };
    };

    // 3. Sujets coordonnés : « Ma femme et moi sommes… », « Paul et Léa arrivent ».
    families.sv_coord = () => {
        const verb = R.pick(["arriver", "partir", "travailler", "habiter", "venir", "jouer", "manger"]);
        const kind = R.pick(["moi", "toi", "noms"]);
        const tense = R.pick(["present", "futur", "imparfait"]);
        let subject;
        let person;
        if (kind === "moi") {
            subject = `${capitalize(np(R, FR_PEOPLE.map((x) => [...x, "p"]), { kinds: ["poss"], n: "s" }).text)} et moi`;
            person = 3;
        } else if (kind === "toi") {
            subject = R.pick(["Toi et moi", "Lui et moi", "Elle et moi"]);
            person = 3;
        } else {
            subject = `${R.pick(["Paul", "Léa", "Mon frère", "Ma voisine", "Le directeur"])} et ${R.pick(["Karim", "Julie", "sa femme", "son associé", "ses enfants"])}`;
            person = 5;
        }
        const form = conj(verb, tense, person);
        const wrongForm = conj(verb, tense, 2);
        if (!form || !wrongForm) {
            return null;
        }
        const tail = { arriver: "à l'heure", partir: "en vacances", travailler: "ensemble", habiter: "à Lyon", venir: "ce soir", jouer: "au tennis", manger: "au restaurant" }[verb];
        return { genre: "sv_coord", right: `${subject} ${form} ${tail}.`, wrong: `${subject} ${mark(wrongForm, form, "conj")} ${tail}.` };
    };

    // 4. « C'est moi qui ai… ».
    families.cest_qui = () => {
        const [pron, person] = R.pick([["moi", 0], ["toi", 1], ["nous", 3], ["vous", 4], ["lui", 2], ["eux", 5]]);
        const obj = np(R, FR_NOUNS, { kinds: ["def"] });
        const verb = verbFor(obj.cls);
        const tense = R.pick(["present", "futur"]);
        const form = conj(verb, tense, person);
        const wrongForm = conj(verb, tense, 2);
        if (!form || !wrongForm || form === wrongForm) {
            return null;
        }
        const head = pron === "eux" ? "Ce sont eux" : `C'est ${pron}`;
        return { genre: "cest_qui", right: `${head} qui ${form} ${obj.text}.`, wrong: `${head} qui ${mark(wrongForm, form, "conj")} ${obj.text}.` };
    };

    // 5. Participe avec être (verbes de mouvement) et attribut.
    families.pp_etre = () => {
        const usePronoun = R.chance(0.5);
        let subjText;
        let g;
        let n;
        let person;
        if (usePronoun) {
            const p = R.pick(PRONOUNS.filter((x) => ["il", "elle", "ils", "elles"].includes(x.word)));
            subjText = p.word;
            g = p.g;
            n = p.n;
            person = p.person;
        } else {
            const s = np(R, FR_PEOPLE.map((x) => [...x, "p"]), { kinds: ["def", "poss", "dem"] });
            subjText = s.text;
            g = s.g;
            if (g === "e") {
                return null;  // genre inconnu
            }
            n = s.n;
            person = n === "p" ? 5 : 2;
        }
        const verb = R.pick(FR_ETRE_VERBS);
        const tense = R.pick(["present", "imparfait", "futur"]);
        const aux = ETRE[tense][person];
        const right = pp(verb, g, n);
        const wrongs = [pp(verb, g === "f" ? "m" : "f", n), pp(verb, g, n === "p" ? "s" : "p")].filter((w) => w && w !== right);
        if (!right || !wrongs.length) {
            return null;
        }
        const tail = R.pick(FR_PLACES);
        const head = `${capitalize(subjText)} ${aux}`;
        return { genre: "pp_etre", right: `${head} ${right} ${tail}.`, wrong: `${head} ${mark(R.pick(wrongs), right, "acc")} ${tail}.` };
    };

    // 6. Attribut : « Mes voisines sont contentes ».
    families.attribut = () => {
        const s = np(R, FR_PEOPLE.map((x) => [...x, "p"]), { kinds: ["def", "poss", "dem"] });
        const adj = R.pick(FR_PEOPLE_ADJ);
        const tense = R.pick(["present", "imparfait", "futur", "conditionnel"]);
        const aux = ETRE[tense][s.n === "p" ? 5 : 2];
        const right = adjForm(adj, genderOf(s.g), s.n);
        const wrongs = [...(s.g === "e" ? [] : [adjForm(adj, s.g === "f" ? "m" : "f", s.n)]), adjForm(adj, genderOf(s.g), s.n === "p" ? "s" : "p")].filter((w) => w !== right && !(s.g === "e" && [adjForm(adj, "f", s.n)].includes(w)));
        if (!wrongs.length) {
            return null;
        }
        const adv = R.chance(0.4) ? `${R.pick(["très", "vraiment", "un peu", "toujours", "souvent"])} ` : "";
        return { genre: "attribut", right: `${capitalize(s.text)} ${aux} ${adv}${right}.`, wrong: `${capitalize(s.text)} ${aux} ${adv}${mark(R.pick(wrongs), right, "acc")}.` };
    };

    // 7. Participe avec avoir : pas d'accord avec le sujet.
    families.pp_avoir = () => {
        const p = R.pick(PRONOUNS.filter((x) => ["ils", "elles", "nous", "elle"].includes(x.word)));
        const obj = np(R, FR_NOUNS, { kinds: ["def", "poss", "dem"] });
        const verb = verbFor(obj.cls);
        const right = pp(verb);
        const wrong = pp(verb, p.g === "f" ? "f" : "m", p.n);
        if (!right || !wrong || wrong === right) {
            return null;
        }
        const aux = AVOIR.present[p.person];
        const time = R.pick(FR_TIMES.passe);
        return { genre: "pp_avoir", right: `${capitalize(p.word)} ${aux} ${right} ${obj.text} ${time}.`, wrong: `${capitalize(p.word)} ${aux} ${mark(wrong, right, "acc")} ${obj.text} ${time}.` };
    };

    // 8. COD placé avant : « Les lettres que tu as écrites », « Je les ai trouvées ».
    families.pp_cod_avant = () => {
        const obj = np(R, FR_NOUNS, { kinds: ["def", "poss"] });
        const verb = verbFor(obj.cls);
        const right = pp(verb, obj.g, obj.n);
        const wrong = pp(verb);
        if (!right || !wrong || wrong === right) {
            return null;
        }
        const p = R.pick(PRONOUNS.filter((x) => x.word !== "on"));
        const aux = AVOIR.present[p.person];
        if (R.chance(0.5)) {
            const subjAux = withSubject(p.word, aux);
            return { genre: "pp_cod_avant", right: `Voici ${obj.text} que ${p.word === "je" ? `j'${aux}` : subjAux} ${right}.`.replace("que il", "qu'il").replace("que elle", "qu'elle").replace("que ils", "qu'ils").replace("que elles", "qu'elles"),
                wrong: `Voici ${obj.text} que ${p.word === "je" ? `j'${aux}` : subjAux} ${mark(wrong, right, "acc")}.`.replace("que il", "qu'il").replace("que elle", "qu'elle").replace("que ils", "qu'ils").replace("que elles", "qu'elles") };
        }
        const pron = obj.n === "p" ? "les" : "l'";
        const head = `${capitalize(obj.text)} ? ${capitalize(p.word === "je" ? "je" : p.word)} ${pron}${pron === "les" ? " " : ""}${aux}`;
        return { genre: "pp_cod_avant", right: `${head} ${right} ${R.pick(FR_TIMES.passe)}.`, wrong: `${head} ${mark(wrong, right, "acc")} ${R.pick(FR_TIMES.passe)}.` };
    };

    // 9. Verbes pronominaux : « Elle s'est levée », « Elle s'est lavé les mains ».
    families.pp_pronominal = () => {
        const p = R.pick(PRONOUNS.filter((x) => ["il", "elle", "ils", "elles"].includes(x.word)));
        const verb = R.pick(FR_PRONOMINAL.filter((v) => !["perdre", "souvenir"].includes(v)));
        const right = pp(verb, p.g, p.n);
        const wrong = pp(verb, p.g === "f" ? "m" : "f", p.n === "p" ? "s" : p.n);
        if (!right || !wrong || right === wrong) {
            return null;
        }
        const refl = elides(ETRE.present[p.person]) ? "s'" : "se ";
        const head = `${capitalize(p.word)} ${refl}${ETRE.present[p.person]}`;
        const time = R.pick(FR_TIMES.passe);
        return { genre: "pp_pronominal", right: `${head} ${right} ${time}.`, wrong: `${head} ${mark(wrong, right, "acc")} ${time}.` };
    };

    // 10. Infinitif ou participe : après un modal, une préposition ; participe après avoir.
    families.inf_pp = () => {
        const obj = np(R, FR_NOUNS, { kinds: ["def", "poss", "dem"] });
        const verb = verbFor(obj.cls);
        if (!/er$/.test(verb)) {
            return null;
        }
        const p = R.pick(PRONOUNS.filter((x) => x.word !== "vous"));
        const ppForm = pp(verb);
        const ez = verb.replace(/er$/, "ez");
        switch (R.pick(["modal", "prep", "avoir"])) {
            case "modal": {
                const modal = R.pick(Object.keys(MODALS));
                const head = capitalize(withSubject(p.word, MODALS[modal][p.person]));
                return { genre: "inf_pp", right: `${head} ${verb} ${obj.text}.`, wrong: `${head} ${mark(R.pick([ppForm, ez]), verb, "pp")} ${obj.text}.` };
            }
            case "prep": {
                const prep = R.pick(["pour", "sans", "avant de", "afin de", "au lieu de"]);
                const head = R.pick(["Il faut se dépêcher", "J'ai appelé le service", "Nous sommes passés", "Elle a attendu longtemps"]);
                const word = /de$/.test(prep) && elides(verb) ? `${prep.slice(0, -2)}d'` : `${prep} `;
                return { genre: "inf_pp", right: `${head} ${word}${verb} ${obj.text}.`.replace("d' ", "d'"), wrong: `${head} ${word}${mark(ppForm, verb, "pp")} ${obj.text}.`.replace("d' ", "d'") };
            }
            default: {
                const head = capitalize(withSubject(p.word, AVOIR.present[p.person]));
                return { genre: "inf_pp", right: `${head} ${ppForm} ${obj.text} ${R.pick(FR_TIMES.passe)}.`, wrong: `${head} ${mark(verb, ppForm, "pp")} ${obj.text} ${R.pick(FR_TIMES.passe)}.` };
            }
        }
    };

    // 11. Impératif : « Mange ta soupe », « Manges-en », « Vas-y ».
    families.imperatif = () => {
        const obj = np(R, FR_NOUNS, { kinds: ["poss", "def"] });
        const verb = verbFor(obj.cls);
        const imp = C.get(verb)?.tenses.imperatif?.[0];
        if (!imp) {
            return null;
        }
        if (/e$/.test(imp) && R.chance(0.5)) {
            return { genre: "imperatif", right: `${capitalize(imp)}s-en un peu !`, wrong: `${mark(capitalize(imp), `${capitalize(imp)}s`, "conj")}-en un peu !`.replace("=>", "=>") };
        }
        const wrongImp = /e$/.test(imp) ? `${imp}s` : null;
        if (!wrongImp) {
            return { genre: "imperatif", right: `${capitalize(imp)} ${obj.text}, s'il te plaît.` };
        }
        return { genre: "imperatif", right: `${capitalize(imp)} ${obj.text}, s'il te plaît.`, wrong: `${mark(capitalize(wrongImp), capitalize(imp), "conj")} ${obj.text}, s'il te plaît.` };
    };

    // 12. Futur ou conditionnel avec « je ».
    families.futur_cond = () => {
        const obj = np(R, FR_NOUNS, { kinds: ["def", "poss"] });
        const verb = verbFor(obj.cls);
        const futur = conj(verb, "futur", 0);
        const cond = conj(verb, "conditionnel", 0);
        if (!futur || !cond) {
            return null;
        }
        if (R.chance(0.5)) {
            const head = R.pick(["Demain", "La semaine prochaine", "Promis, dès lundi", "Ce soir"]);
            return { genre: "futur_cond", right: `${head}, ${withSubject("je", futur)} ${obj.text}.`, wrong: `${head}, ${elides(futur) ? "j'" : "je "}${mark(cond, futur, "conj")} ${obj.text}.` };
        }
        const head = R.pick(["Si j'avais le temps", "Si tu me le demandais", "Avec plus d'argent", "Si c'était possible"]);
        return { genre: "futur_cond", right: `${head}, ${withSubject("je", cond)} ${obj.text}.`, wrong: `${head}, ${elides(cond) ? "j'" : "je "}${mark(futur, cond, "conj")} ${obj.text}.` };
    };

    // 13. Subjonctif : « Il faut que tu viennes ».
    families.subjonctif = () => {
        const obj = np(R, FR_NOUNS, { kinds: ["def", "poss"] });
        const verb = R.chance(0.5) ? R.pick(["prendre", "faire", "voir", "venir", "pouvoir", "aller", "savoir", "écrire", "lire", "finir", "choisir", "mettre", "recevoir"]) : verbFor(obj.cls);
        const p = R.pick(PRONOUNS.filter((x) => ["tu", "il", "elle", "nous", "vous", "ils"].includes(x.word)));
        if (!C.has(verb)) {
            return null;
        }
        const subj = conj(verb, "subjonctif", p.person);
        const ind = conj(verb, "present", p.person);
        const opener = R.pick(["Il faut que", "Je veux que", "Bien que", "Pour que", "Avant que"]);
        const que = elides(p.word) ? opener.replace(/que$/, "qu'") : `${opener} `;
        const obj2 = ["venir", "pouvoir", "aller", "savoir"].includes(verb) ? { venir: "ce soir", pouvoir: "venir", aller: "à la gare", savoir: "la vérité" }[verb] : obj.text;
        const right = `${que}${p.word} ${subj} ${obj2}.`.replace("' ", "'");
        if (!subj || !ind || subj === ind) {
            return { genre: "subjonctif", right };
        }
        return { genre: "subjonctif", right, wrong: `${que}${p.word} ${mark(ind, subj, "conj")} ${obj2}.`.replace("' ", "'") };
    };

    // 14. Homophones : cadres justes et faute injectée.
    const HOMOPHONES = [
        () => { const s = np(R, FR_PEOPLE.map((x) => [...x, "p"]), { kinds: ["def", "poss"], n: "s" }); const o = np(R, FR_NOUNS, { kinds: ["def", "poss"] }); const v = verbFor(o.cls); return [`${capitalize(s.text)} a ${pp(v)} ${o.text}.`, "a", "à"]; },
        () => [`Nous allons à ${R.pick(["Paris", "la plage", "la gare", "l'école"])} ${R.pick(FR_TIMES.futur)}.`, "à", "a"],
        () => { const s = np(R, FR_NOUNS, { kinds: ["def", "poss", "dem"], n: "s" }); const a = R.pick(FR_ADJ.filter((x) => x[4] === s.cls)); return [`${capitalize(s.text)} est ${adjForm(a, s.g, "s")}.`, "est", "et"]; },
        () => [`${capitalize(np(R, FR_NOUNS, { kinds: ["def"], n: "s" }).text)} et ${np(R, FR_NOUNS, { kinds: ["def"], n: "s" }).text} sont sur la table.`, "et", "est"],
        () => { const s = np(R, FR_PEOPLE.map((x) => [...x, "p"]), { kinds: ["def", "poss"], n: "p" }); return [`${capitalize(s.text)} sont ${R.pick(["arrivés", "partis", "là", "prêts"])}${s.g === "f" && !/là/.test("") ? "" : ""}.`.replace(/(arrivés|partis|prêts)\./, (m, w) => (s.g === "f" ? `${w.replace(/s$/, "es")}.` : m)), "sont", "son"]; },
        () => [`Il a oublié son ${R.pick(["téléphone", "manteau", "badge", "ordinateur"])} au bureau.`, "son", "sont"],
        () => [`${R.pick(["Ils", "Elles", "Mes parents", "Les enfants"])} ont ${R.pick(["fini", "mangé", "gagné", "compris"])} ${R.pick(["hier", "ce matin", "trop tard"])}.`, "ont", "on"],
        () => [`On ${R.pick(["part", "mange", "se voit", "commence"])} ${R.pick(FR_TIMES.futur)}.`, "On", "Ont"],
        () => [`${R.pick(["Il", "Elle", "Mon frère"])} se ${R.pick(["lève", "prépare", "repose", "dépêche"])} ${R.pick(FR_TIMES.present)}.`, "se", "ce"],
        () => [`Ce ${R.pick(["rapport", "serveur", "gâteau", "film"])} est ${R.pick(["excellent", "parfait", "important"])}.`, "Ce", "Se"],
        () => [`C'est ${R.pick(["génial", "trop tard", "parfait", "dommage", "vrai"])} !`, "C'est", "Ces"],
        () => [`${R.pick(["Il", "Elle", "Paul"])} s'est ${R.pick(["trompé", "levé", "reposé", "blessé"])}${R.pick(["", ""])} ${R.pick(FR_TIMES.passe)}.`, "s'est", "c'est"],
        () => [`Ça ${R.pick(["marche", "suffit", "dépend", "va"])} ${R.pick(["bien", "pour moi", "vraiment", "encore"])}.`, "Ça", "Sa"],
        () => [`Elle a pris sa ${R.pick(["voiture", "valise", "veste", "tablette"])} ce matin.`, "sa", "ça"],
        () => [`Où ${R.pick(["est passé le chargeur", "habites-tu", "vas-tu ce soir", "sont mes clés"])} ?`, "Où", "Ou"],
        () => [`Tu préfères du thé ou du café ?`, "ou", "où"],
        () => [`${R.pick(["Je", "Nous", "Elle"])} leur ${R.pick(["parle", "écris", "réponds", "téléphone"]).replace("écris", R.chance(0.5) ? "écris" : "écris")} ${R.pick(["souvent", "demain", "chaque semaine"])}.`.replace("Nous leur parle", "Nous leur parlons").replace("Nous leur écris", "Nous leur écrivons").replace("Nous leur réponds", "Nous leur répondons").replace("Nous leur téléphone", "Nous leur téléphonons").replace("Elle leur écris", "Elle leur écrit").replace("Elle leur réponds", "Elle leur répond"), "leur", "leurs"],
        () => [`Les enfants rangent leurs ${R.pick(["jouets", "livres", "affaires", "chaussures"])}.`, "leurs", "leur"],
        () => [`${R.pick(["Il", "Elle", "Mon voisin"])} peut ${R.pick(["venir", "attendre", "nous aider", "réparer ça"])} ${R.pick(FR_TIMES.futur)}.`, "peut", "peu"],
        () => [`Il reste un peu de ${R.pick(["café", "temps", "soupe", "place"])}.`, "peu", "peut"],
        () => [`Je ${R.pick(["pense", "crois", "sais"])} qu'elle ${R.pick(["viendra", "a raison", "est partie", "dort"])}.`, "qu'elle", "quel"],
        () => [`Il n'y a ${R.pick(["plus de pain", "personne", "rien à faire", "pas de réseau"])}.`, "n'y", "ni"],
        () => [`Il s'en ${R.pick(["souvient", "va", "occupe", "fiche"])} ${R.pick(["bien", "demain", "très bien", "maintenant"])}.`, "s'en", "sans"],
        () => [`Elle est partie sans ${R.pick(["dire au revoir", "son manteau", "attendre", "payer"])}.`, "sans", "s'en"],
        () => [`Quand ${R.pick(["tu arrives", "il pleut", "elle rentre", "le train part"])}, préviens-moi.`, "Quand", "Quant"],
        () => [`Quant à ${R.pick(["ton idée", "mon frère", "la réunion", "ce projet"])}, on verra plus tard.`, "Quant", "Quand"],
        () => [`${R.pick(["Je suis", "Il est", "Tu es"])} prêt à partir.`, "prêt", "près"],
        () => [`Ils habitent près de ${R.pick(["la gare", "chez nous", "Lyon", "l'école"])}.`, "près", "prêt"],
        () => [`Il faut partir plus tôt ${R.pick(["demain", "que prévu", "ce matin"])}.`, "plus tôt", "plutôt"],
        () => [`J'aime ${R.pick(["plutôt", "plutôt bien", "plutôt"])} ${R.pick(["le thé", "ce quartier", "cette idée"])}.`.replace("plutôt bien le thé", "plutôt bien le thé"), "plutôt", "plus tôt"],
        () => [`Tous les ${R.pick(["matins", "jours", "employés", "élèves"])} ${R.pick(["comptent", "sont importants", "passent vite"])}.`, "Tous", "Tout"],
        () => [`Tout le ${R.pick(["monde", "bureau", "quartier"])} est ${R.pick(["content", "fermé", "calme"])}.`, "Tout", "Tous"],
        () => [`J'ai rangé mes ${R.pick(["affaires", "livres", "outils", "dossiers"])}, mais je ne trouve pas mes clés.`, "mais", "mes"],
        () => [`Il est là depuis ${R.pick(["ce matin", "une heure", "midi"])}.`, "là", "la"],
        () => [`Je vais voir ${R.pick(["mes parents", "un film", "le médecin", "ce qu'il veut"])} ${R.pick(FR_TIMES.futur)}.`, "voir", "voire"],
        () => [`Cette tâche est ${R.pick(["urgente", "importante", "prioritaire"])}.`, "tâche", "tache"],
        () => [`Il est censé ${R.pick(["arriver à midi", "nous rappeler", "finir ce soir"])}.`, "censé", "sensé"],
        () => [`Elle a mal au foie depuis hier.`, "foie", "foi"],
        () => [`Nous avons cours de maths ${R.pick(["demain", "lundi", "à huit heures"])}.`, "cours", "court"],
    ];
    families.homophone = () => {
        const [right, value, wrong] = R.pick(HOMOPHONES)();
        const marked = inject(right, value, wrong, "hom");
        return marked ? { genre: "homophone", right, wrong: marked } : { genre: "homophone", right };
    };

    // 15. Accord dans le groupe nominal : adjectif épithète.
    families.accord_gn = () => {
        const obj = np(R, FR_NOUNS, { kinds: ["def", "poss", "indef", "dem"] });
        const adj = R.pick(FR_ADJ.filter((a) => a[4] === obj.cls));
        if (!adj) {
            return null;
        }
        const right = adjForm(adj, obj.g, obj.n);
        const wrongs = [adjForm(adj, obj.g === "f" ? "m" : "f", obj.n), adjForm(adj, obj.g, obj.n === "p" ? "s" : "p")].filter((w) => w !== right);
        if (!wrongs.length) {
            return null;
        }
        const verb = verbFor(obj.cls);
        const p = R.pick(PRONOUNS.filter((x) => !["on", "vous"].includes(x.word)));
        const head = capitalize(withSubject(p.word, AVOIR.present[p.person]));
        return { genre: "accord_gn", right: `${head} ${pp(verb)} ${obj.text} ${right}.`, wrong: `${head} ${pp(verb)} ${obj.text} ${mark(R.pick(wrongs), right, "acc")}.` };
    };

    // 16. Pluriel du nom après un déterminant pluriel.
    families.pluriel = () => {
        const [sing, plur, g] = R.pick(FR_NOUNS.concat(FR_PEOPLE.map((x) => [...x, "p"])).filter((x) => x[0] !== x[1]));
        const det = R.pick(["les", "des", "mes", "ces", "plusieurs", "quelques", "trois", "nos"]);
        const wrong = sing;
        const tail = R.pick(["sont là", "sont prêts", "attendent", "manquent"]).replace("prêts", g === "f" ? "prêtes" : "prêts");
        return { genre: "pluriel", right: `${capitalize(det)} ${plur} ${tail}.`, wrong: `${capitalize(det)} ${mark(wrong, plur, "acc")} ${tail}.` };
    };

    // 17. Pluriels irréguliers et nombres.
    const IRREGULAR = [["chevaux", "chevals"], ["journaux", "journals"], ["animaux", "animals"], ["hôpitaux", "hôpitals"], ["bijoux", "bijous"], ["genoux", "genous"], ["choux", "chous"], ["cailloux", "caillous"], ["jeux", "jeus"], ["cheveux", "cheveus"], ["bateaux", "bateaus"], ["gâteaux", "gâteaus"], ["travaux", "travails"], ["festivals", "festivaux"], ["pneus", "pneux"], ["bleus", "bleux"], ["yeux", "oeils"], ["bureaux", "bureaus"]];
    families.pluriel_irregulier = () => {
        if (R.chance(0.3)) {
            const [right, wrong, tail] = R.pick([["quatre-vingts", "quatre-vingt", "ans"], ["deux cents", "deux cent", "euros"], ["trois cents", "trois cent", "pages"], ["quatre-vingts", "quatre-vingt", "personnes"]]);
            return { genre: "nombre", right: `Il y avait ${right} ${tail}.`, wrong: `Il y avait ${mark(wrong, right, "acc")} ${tail}.` };
        }
        const [right, wrong] = R.pick(IRREGULAR);
        return { genre: "pluriel_irregulier", right: `On a vu des ${right} ${R.pick(["ce matin", "partout", "au marché", "hier"])}.`, wrong: `On a vu des ${mark(wrong, right, "acc")} ${R.pick(["ce matin", "partout", "au marché", "hier"])}.` };
    };

    // 18. Orthographe d'usage.
    const SPELLING = [
        ["parmi", "parmis", "Il était parmi les premiers."], ["aujourd'hui", "aujourd'hui", null], ["quelquefois", "quelques fois", "Je passe quelquefois le voir."],
        ["en fait", "en faite", "En fait, je ne viens pas."], ["dilemme", "dilemne", "C'est un vrai dilemme."], ["langage", "language", "Le langage des jeunes change vite."],
        ["malgré", "malgrès", "Il est venu malgré la pluie."], ["apparemment", "apparament", "Apparemment, il est malade."], ["évidemment", "évidament", "Évidemment, il a oublié."],
        ["vraiment", "vraiement", "C'est vraiment bien."], ["connexion", "connection", "La connexion est lente."], ["développement", "dévelopement", "Le développement prend du temps."],
        ["rendez-vous", "rendez vous", "J'ai un rendez-vous demain."], ["acquérir", "aquérir", "Il veut acquérir une maison."], ["occasion", "occassion", "C'est une bonne occasion."],
        ["professionnel", "professionel", "C'est un outil professionnel."], ["personnellement", "personellement", "Personnellement, je préfère le thé."], ["exercice", "exercise", "Cet exercice est facile."],
        ["accueil", "acceuil", "L'accueil était chaleureux."], ["ceuillir", "cueillir", null], ["cueillir", "ceuillir", "On va cueillir des fraises."], ["obscur", "obscure", null],
        ["parce que", "parceque", "Je reste parce que je suis fatigué."], ["quand même", "quand-même", "Il est venu quand même."], ["tout à fait", "tout-à-fait", "Tu as tout à fait raison."],
        ["bien sûr", "bien-sûr", "Bien sûr, je viendrai."], ["au fur et à mesure", "au fur et à mesures", "On avance au fur et à mesure."], ["d'ailleurs", "d'ailleur", "D'ailleurs, il pleut."],
        ["toujours", "toujour", "Il est toujours en retard."], ["jamais", "jamai", "Il ne vient jamais."], ["beaucoup", "beaucoups", "Merci beaucoup."], ["longtemps", "long temps", "Il a attendu longtemps."],
        ["aéroport", "aéroport", null], ["hôpital", "hopital", "Il est à l'hôpital."], ["être", "ètre", null], ["événement", "évènement", null], ["voilà", "voila", "Voilà le rapport."],
        ["déjà", "deja", "Il est déjà parti."], ["à cause", "a cause", null], ["chiffre", "chifre", "Ce chiffre est faux."], ["adresse", "addresse", "Envoie-moi ton adresse."],
        ["intéressant", "interessant", "Ce livre est intéressant."], ["différent", "différant", null], ["confortable", "comfortable", "Ce canapé est confortable."],
    ];
    families.orthographe = () => {
        const entry = R.pick(SPELLING.filter((x) => x[2] && x[0] !== x[1]));
        const [right, wrong, sentence] = entry;
        const marked = inject(sentence, sentence.includes(right) ? right : capitalize(right), sentence.includes(right) ? wrong : capitalize(wrong), "ortho");
        return marked ? { genre: "orthographe", right: sentence, wrong: marked } : { genre: "orthographe", right: sentence };
    };

    // 19. Élisions et traits d'union.
    families.elision = () => {
        const [right, wrong, sentence] = R.pick([
            ["l'ordinateur", "le ordinateur", "J'ai allumé l'ordinateur."], ["l'imprimante", "la imprimante", "Il faut réparer l'imprimante."], ["s'il", "si il", "Dis-moi s'il vient."],
            ["qu'il", "que il", "Je pense qu'il a raison."], ["j'ai", "je ai", "Hier, j'ai fini tôt."], ["d'un", "de un", "J'ai besoin d'un stylo."], ["l'école", "la école", "Il est à l'école."],
            ["peut-être", "peut être", "Il viendra peut-être demain."], ["est-ce que", "est ce que", "Dis-moi, est-ce que tu viens ?"], ["c'est-à-dire", "c'est à dire", "Lundi, c'est-à-dire demain."],
            ["vas-y", "vas y", "Allez, vas-y !"], ["dis-moi", "dis moi", "Alors, dis-moi tout."], ["quatre-vingt-dix", "quatre vingt dix", "Il a quatre-vingt-dix ans."], ["lorsqu'il", "lorsque il", "Appelle-moi lorsqu'il arrive."],
        ]);
        const marked = inject(sentence, right, wrong, R.pick(["ortho"]));
        return marked ? { genre: "elision", right: sentence, wrong: marked } : { genre: "elision", right: sentence };
    };

    // 20. Majuscules.
    families.majuscule = () => {
        const choice = R.pick(["debut", "ville", "nationalite", "jour"]);
        if (choice === "debut") {
            const s = families.sv_pronom();
            if (!s) {
                return null;
            }
            const first = s.right.split(/[\s']/)[0];
            const lower = first.toLowerCase();
            return lower === first ? null : { genre: "majuscule", right: s.right, wrong: `${mark(lower, first, "maj")}${s.right.slice(first.length)}` };
        }
        if (choice === "ville") {
            const city = R.pick(["Paris", "Lyon", "Marseille", "Toulouse", "Bordeaux", "Lille", "Nantes"]);
            return { genre: "majuscule", right: `Nous partons à ${city} demain.`, wrong: `Nous partons à ${mark(city.toLowerCase(), city, "maj")} demain.` };
        }
        if (choice === "nationalite") {
            const [adj, Adj] = R.pick([["belge", "Belge"], ["français", "Français"], ["espagnole", "Espagnole"], ["italien", "Italien"], ["canadienne", "Canadienne"]]);
            const subj = /e$/.test(adj) && adj !== "belge" ? "Ma collègue est" : "Mon collègue est";
            return { genre: "majuscule", right: `${subj} ${adj}.`, wrong: `${subj} ${mark(Adj, adj, "maj")}.` };
        }
        const [day, Day] = R.pick([["lundi", "Lundi"], ["mardi", "Mardi"], ["vendredi", "Vendredi"], ["janvier", "Janvier"], ["septembre", "Septembre"], ["mars", "Mars"]]);
        const sentence = /i$/.test(day) ? `On se voit ${day} prochain.` : `On part en ${day} cette année.`;
        return { genre: "majuscule", right: sentence, wrong: inject(sentence, day, Day, "maj") };
    };

    return families;
}

// Fautes de frappe : une lettre inversée, doublée, oubliée ou voisine, dans un mot d'une phrase juste.
const AZERTY = ["azertyuiop", "qsdfghjklm", "wxcvbn"];
const QWERTY = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
function typo(R, word, keyboard) {
    const i = 1 + Math.floor(R.random() * (word.length - 2));
    switch (R.pick(["swap", "double", "drop", "near"])) {
        case "swap":
            return word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2);
        case "double":
            return word.slice(0, i) + word[i] + word.slice(i);
        case "drop":
            return word.slice(0, i) + word.slice(i + 1);
        default: {
            const c = word[i];
            for (const row of keyboard) {
                const k = row.indexOf(c);
                if (k >= 0) {
                    const n = row[k + (k + 1 < row.length ? 1 : -1)];
                    return word.slice(0, i) + n + word.slice(i + 1);
                }
            }
            return null;
        }
    }
}

export async function buildFrench(aria, { seed = 2026, perFamily = 60 } = {}) {
    const R = makeRandom(seed);
    const verbs = new Set([...Object.values(FR_VERBS).flat(), ...FR_ETRE_VERBS, ...FR_PRONOMINAL, "arriver", "partir", "travailler", "habiter", "venir", "jouer", "manger", "prendre", "faire", "voir", "pouvoir", "aller", "savoir", "écrire", "lire", "finir", "choisir", "mettre", "recevoir"]);
    const C = await loadConjugations(aria, verbs);
    const families = frenchFamilies(R, C);
    const items = [];
    const seen = new Set();
    for (const [name, make] of Object.entries(families)) {
        let made = 0;
        for (let tries = 0; made < perFamily && tries < perFamily * 6; tries++) {
            const r = make();
            if (!r || seen.has(r.right)) {
                continue;
            }
            seen.add(r.right);
            items.push({ lang: "fr", genre: `${r.genre}:juste`, text: r.right });
            if (r.wrong && !seen.has(r.wrong)) {
                seen.add(r.wrong);
                items.push({ lang: "fr", genre: r.genre, text: r.wrong });
            }
            made++;
        }
        void name;
    }
    // Fautes de frappe dans des phrases justes déjà générées (mot de 5 lettres ou plus, faute qui
    // ne donne pas un autre mot du dictionnaire).
    const pool = items.filter((x) => x.genre.endsWith(":juste"));
    let typos = 0;
    for (let tries = 0; typos < perFamily && tries < perFamily * 10; tries++) {
        const base = R.pick(pool).text;
        const words = [...base.matchAll(/(?<![\p{L}'’-])\p{Ll}{5,}(?![\p{L}'’-])/gu)].map((m) => m[0]);
        if (!words.length) {
            continue;
        }
        const word = R.pick(words);
        const bad = typo(R, word, AZERTY);
        if (!bad || bad === word) {
            continue;
        }
        const known = await aria.morphFr([bad]);
        if (known?.[0]?.morph?.length) {
            continue;
        }
        const marked = inject(base, word, bad, "frappe");
        if (marked && !seen.has(marked)) {
            seen.add(marked);
            items.push({ lang: "fr", genre: "frappe", text: marked });
            typos++;
        }
    }
    return items;
}

// ============================================================================================
// Anglais
// ============================================================================================

// [base, 3s, past, pp, ing]
const EN_VERBS = [
    ["fix", "fixes", "fixed", "fixed", "fixing"], ["check", "checks", "checked", "checked", "checking"], ["install", "installs", "installed", "installed", "installing"],
    ["update", "updates", "updated", "updated", "updating"], ["clean", "cleans", "cleaned", "cleaned", "cleaning"], ["open", "opens", "opened", "opened", "opening"],
    ["watch", "watches", "watched", "watched", "watching"], ["finish", "finishes", "finished", "finished", "finishing"], ["print", "prints", "printed", "printed", "printing"],
    ["see", "sees", "saw", "seen", "seeing"], ["take", "takes", "took", "taken", "taking"], ["write", "writes", "wrote", "written", "writing"],
    ["give", "gives", "gave", "given", "giving"], ["do", "does", "did", "done", "doing"], ["break", "breaks", "broke", "broken", "breaking"],
    ["choose", "chooses", "chose", "chosen", "choosing"], ["buy", "buys", "bought", "bought", "buying"], ["bring", "brings", "brought", "brought", "bringing"],
    ["forget", "forgets", "forgot", "forgotten", "forgetting"], ["send", "sends", "sent", "sent", "sending"], ["find", "finds", "found", "found", "finding"],
    ["read", "reads", "read", "read", "reading"], ["sell", "sells", "sold", "sold", "selling"], ["lose", "loses", "lost", "lost", "losing"],
    ["eat", "eats", "ate", "eaten", "eating"], ["drink", "drinks", "drank", "drunk", "drinking"], ["begin", "begins", "began", "begun", "beginning"],
    ["teach", "teaches", "taught", "taught", "teaching"], ["catch", "catches", "caught", "caught", "catching"], ["throw", "throws", "threw", "thrown", "throwing"],
    ["drive", "drives", "drove", "driven", "driving"], ["speak", "speaks", "spoke", "spoken", "speaking"], ["steal", "steals", "stole", "stolen", "stealing"],
];
const EN_OBJECTS = ["the report", "a new laptop", "an old router", "the files", "the backup", "their keys", "the documentation", "a long email", "the server logs", "an invoice", "the printer", "a few tickets", "the car", "my phone", "the dishes", "her homework"];
// Compléments plausibles selon le verbe (sinon : « I eat the documentation »).
const EN_OBJECTS_FOR = {
    eat: ["a sandwich", "the soup", "the cake", "an apple"], drink: ["coffee", "the water", "a cup of tea", "some juice"], drive: ["the car", "a truck", "the van", "her bike"],
    teach: ["math", "the new interns", "French", "a yoga class"], steal: ["a bike", "the money", "my idea", "the show"], throw: ["the ball", "the old files", "a party", "the trash"],
    catch: ["the bus", "the ball", "a cold", "the train"], speak: ["French", "Spanish", "English", "German"], begin: ["the meeting", "the project", "a new job", "the test"],
    choose: ["a new laptop", "the red one", "a name", "the best option"], lose: ["their keys", "the game", "my phone", "the files"], sell: ["the car", "an old router", "the house", "a few tickets"],
    buy: ["a new laptop", "the car", "some bread", "an invoice"], give: ["a gift", "the keys", "an answer", "a long speech"], take: ["the bus", "a break", "the report", "a few tickets"],
    do: ["the dishes", "her homework", "the laundry", "the report"], break: ["the printer", "a glass", "the rules", "my phone"], bring: ["the documentation", "a cake", "their keys", "an umbrella"],
};
const objectFor = (R, verb) => R.pick(EN_OBJECTS_FOR[verb[0]] ?? EN_OBJECTS);
const EN_PRONOUNS = [["I", 0], ["you", 1], ["he", 2], ["she", 2], ["it", 2], ["we", 3], ["they", 5]];
const EN_PEOPLE = [["my brother", "s"], ["the manager", "s"], ["our neighbor", "s"], ["the new intern", "s"], ["my parents", "p"], ["the developers", "p"], ["our customers", "p"], ["the kids", "p"], ["Sarah", "s"], ["the team lead", "s"], ["my colleagues", "p"], ["the nurses", "p"]];
const EN_IRREGULAR_ERRORS = { went: ["goed", "gone"], saw: ["seen", "seed"], did: ["done"], wrote: ["writed", "written"], brought: ["brang", "brung", "bringed"], bought: ["buyed"], caught: ["catched"], taught: ["teached"], thought: ["thinked"], ate: ["eated", "eaten"], drank: ["drinked", "drunk"], began: ["begun", "beginned"], took: ["taked", "taken"], gave: ["gived", "given"], knew: ["knowed"], threw: ["throwed"], broke: ["breaked"], chose: ["choosed"], forgot: ["forgetted"], found: ["finded"], lost: ["losed"], sent: ["sended"], sold: ["selled"], drove: ["drived"], spoke: ["speaked"], stole: ["stealed"] };

function englishFamilies(R) {
    const families = {};
    const pickVerb = () => R.pick(EN_VERBS);
    // 1. Pronom + présent simple.
    families.sv_pronoun = () => {
        const [s, person] = R.pick(EN_PRONOUNS.filter(([w]) => w !== "it"));
        const v = pickVerb();
        const right = person === 2 ? v[1] : v[0];
        const wrong = person === 2 ? v[0] : v[1];
        const obj = objectFor(R, v);
        const when = R.pick(["every day", "on Mondays", "every morning", "twice a week", "after lunch"]);
        const head = capitalize(s);
        return { genre: "sv_pronoun", right: `${head} ${right} ${obj} ${when}.`, wrong: `${head} ${mark(wrong, right, "acc")} ${obj} ${when}.` };
    };
    // 2. be / have / do avec pronom.
    families.be_have_do = () => {
        const [s, person] = R.pick(EN_PRONOUNS);
        const kind = R.pick(["be", "have", "do", "was"]);
        const forms = { be: ["am", "are", "is", "are", "are", "are"], have: ["have", "have", "has", "have", "have", "have"], do: ["don't", "don't", "doesn't", "don't", "don't", "don't"], was: ["was", "were", "was", "were", "were", "were"] }[kind];
        const right = forms[person];
        const wrong = { am: "is", are: "is", is: "are", have: "has", has: "have", "don't": "doesn't", "doesn't": "don't", was: "were", were: "was" }[right];
        const tail = { be: R.pick(["ready", "at home", "late again", "in the office"]), have: R.pick(["a meeting at noon", "two cats", "a new job", "no idea"]), do: R.pick(["like spinach", "know the answer", "work on Fridays", "need help"]), was: R.pick(["at the party", "very tired", "in Boston last week"]) }[kind];
        return { genre: "be_have_do", right: `${capitalize(s)} ${right} ${tail}.`, wrong: `${capitalize(s)} ${mark(wrong, right, "acc")} ${tail}.` };
    };
    // 3. Sujet nom (singulier/pluriel, avec « of », avec relative).
    families.sv_noun = () => {
        const [s, n] = R.pick(EN_PEOPLE);
        const v = pickVerb();
        const right = n === "s" ? v[1] : v[0];
        const wrong = n === "s" ? v[0] : v[1];
        const extra = R.pick(["", "", " from the third floor", n === "s" ? " who lives next door" : " who live next door", " in the Berlin office"]);
        const obj = objectFor(R, v);
        return { genre: extra ? "sv_distant" : "sv_noun", right: `${capitalize(s)}${extra} ${right} ${obj} every week.`, wrong: `${capitalize(s)}${extra} ${mark(wrong, right, "acc")} ${obj} every week.` };
    };
    // 4. Indéfinis, there is/are, one of, the number of.
    families.special_subject = () => {
        const v = pickVerb();
        switch (R.pick(["indef", "there", "oneof", "number"])) {
            case "indef": {
                const s = R.pick(["Everyone", "Nobody", "Somebody", "Each student", "Every employee", "Everybody", "Neither of them"]);
                return { genre: "special_subject", right: `${s} ${v[1]} ${objectFor(R, v)} on time.`, wrong: `${s} ${mark(v[0], v[1], "acc")} ${objectFor(R, v)} on time.` };
            }
            case "there": {
                const plural = R.chance(0.5);
                const thing = plural ? R.pick(["three servers", "two meetings", "many errors", "some cookies"]) : R.pick(["a problem", "one meeting", "a cat", "an error"]);
                const right = plural ? "are" : "is";
                return { genre: "special_subject", right: `There ${right} ${thing} in the ${R.pick(["room", "log", "kitchen", "report"])}.`, wrong: `There ${mark(plural ? "is" : "are", right, "acc")} ${thing} in the ${R.pick(["room", "log", "kitchen", "report"])}.` };
            }
            case "oneof":
                return { genre: "special_subject", right: `One of the ${R.pick(["servers", "laptops", "printers", "doors"])} is broken.`, wrong: `One of the ${R.pick(["servers", "laptops", "printers", "doors"])} ${mark("are", "is", "acc")} broken.` };
            default:
                return { genre: "special_subject", right: `The number of ${R.pick(["tickets", "users", "errors", "visitors"])} has doubled.`, wrong: `The number of ${R.pick(["tickets", "users", "errors", "visitors"])} ${mark("have", "has", "acc")} doubled.` };
        }
    };
    // 5. Prétérit irrégulier.
    families.past_irregular = () => {
        const v = R.pick(EN_VERBS.filter((x) => EN_IRREGULAR_ERRORS[x[2]]));
        const [s] = R.pick(EN_PRONOUNS);
        const wrong = R.pick(EN_IRREGULAR_ERRORS[v[2]]);
        const head = `${R.pick(["Yesterday", "Last week", "This morning", "Two days ago"])}, ${s}`;
        const obj = objectFor(R, v);
        return { genre: "past_irregular", right: `${head} ${v[2]} ${obj}.`, wrong: `${head} ${mark(wrong, v[2], "pp")} ${obj}.` };
    };
    // 6. Participe après have.
    families.perfect = () => {
        const v = R.pick(EN_VERBS.filter((x) => x[2] !== x[3]));
        const [s, person] = R.pick(EN_PRONOUNS);
        const aux = person === 2 ? "has" : "have";
        const adv = R.pick(["already ", "just ", "never ", ""]);
        const obj = objectFor(R, v);
        return { genre: "perfect", right: `${capitalize(s)} ${aux} ${adv}${v[3]} ${obj}.`, wrong: `${capitalize(s)} ${aux} ${adv}${mark(v[2], v[3], "pp")} ${obj}.` };
    };
    // 7. do/does/did + base ; modal + base ; to + base.
    families.base_form = () => {
        const v = pickVerb();
        switch (R.pick(["did", "does", "modal", "to"])) {
            case "did":
                return { genre: "base_form", right: `Did ${R.pick(["he", "she", "they", "you"])} ${v[0]} ${objectFor(R, v)}?`, wrong: `Did ${R.pick(["he", "she", "they", "you"])} ${mark(v[2], v[0], "conj")} ${objectFor(R, v)}?` };
            case "does":
                return { genre: "base_form", right: `${R.pick(["He", "She", "My boss"])} doesn't ${v[0]} ${objectFor(R, v)}.`, wrong: `${R.pick(["He", "She", "My boss"])} doesn't ${mark(v[1], v[0], "conj")} ${objectFor(R, v)}.` };
            case "modal": {
                const modal = R.pick(["can", "should", "must", "will", "might", "could"]);
                return { genre: "base_form", right: `${R.pick(["She", "He", "We", "The intern"])} ${modal} ${v[0]} ${objectFor(R, v)}.`, wrong: `${R.pick(["She", "He", "We", "The intern"])} ${modal} ${mark(R.pick([v[1], v[2]]), v[0], "conj")} ${objectFor(R, v)}.` };
            }
            default:
                return { genre: "base_form", right: `${R.pick(["I want", "She needs", "We forgot", "They decided"])} to ${v[0]} ${objectFor(R, v)}.`, wrong: `${R.pick(["I want", "She needs", "We forgot", "They decided"])} to ${mark(R.pick([v[1], v[2]]), v[0], "conj")} ${objectFor(R, v)}.` };
        }
    };
    // 8. Present perfect avec since ; présent après when.
    families.tense_since_when = () => {
        if (R.chance(0.5)) {
            const [s, person] = R.pick([["I", 0], ["We", 3], ["They", 5], ["She", 2], ["My sister", 2]]);
            const [verb3s, base, ppForm] = R.pick([["lives", "live", "lived"], ["works", "work", "worked"], ["knows", "know", "known"]]);
            const aux = person === 2 ? "has" : "have";
            const wrong = person === 2 ? verb3s : base;
            const tail = { lived: "in Lyon", worked: "here", known: "Daniel" }[ppForm];
            return { genre: "tense_since", right: `${s} ${aux} ${ppForm} ${tail} since ${R.pick(["2019", "last year", "March", "college"])}.`, wrong: `${s} ${mark(wrong, `${aux} ${ppForm}`, "conj")} ${tail} since ${R.pick(["2019", "last year", "March", "college"])}.` };
        }
        const [s, three] = R.pick([["I", false], ["you", false], ["she", true], ["we", false]]);
        const v = R.pick([["arrive", "arrives", "home"], ["get", "gets", "home"], ["finish", "finishes", "work"], ["call", "calls", "back"]]);
        const right = three ? v[1] : v[0];
        return { genre: "tense_when", right: `I'll text you when ${s} ${right} ${v[2]}.`, wrong: `I'll text you when ${s} ${mark(`will ${v[0]}`, right, "conj")} ${v[2]}.` };
    };
    // 9. Homophones.
    const HOM = [
        [`It's ${R.pick(["raining", "late", "fine", "broken"])} again.`, "It's", "Its"], [`The dog wagged its tail.`, "its", "it's"],
        [`You're ${R.pick(["welcome", "right", "late", "amazing"])}.`, "You're", "Your"], [`Your ${R.pick(["password", "order", "car", "phone"])} is ready.`, "Your", "You're"],
        [`They're ${R.pick(["late", "coming", "tired", "here"])} today.`, "They're", "Their"], [`Their ${R.pick(["house", "car", "dog", "team"])} is huge.`, "Their", "There"],
        [`There are ${R.pick(["two", "three", "many"])} problems.`, "There", "Their"], [`This is too ${R.pick(["hot", "expensive", "slow", "loud"])}.`, "too", "to"],
        [`It is faster than ${R.pick(["mine", "before", "yours"])}.`, "than", "then"], [`We ate, and then we left.`, "then", "than"],
        [`Don't lose your ${R.pick(["keys", "wallet", "badge", "temper"])}.`, "lose", "loose"], [`The ${R.pick(["screw", "rope", "cable", "knot"])} is loose.`, "loose", "lose"],
        [`I accept your ${R.pick(["offer", "apology", "terms", "invitation"])}.`, "accept", "except"], [`Whose ${R.pick(["jacket", "phone", "bag", "laptop"])} is this?`, "Whose", "Who's"],
        [`Who's ${R.pick(["coming", "driving", "next", "ready"])}?`, "Who's", "Whose"], [`I don't know whether he ${R.pick(["called", "agreed", "left"])}.`, "whether", "weather"],
        [`Please be quiet ${R.pick(["now", "during the exam", "in the library"])}.`, "quiet", "quite"], [`Thanks for the ${R.pick(["good", "great", "helpful"])} advice.`, "advice", "advise"],
        [`Can you hear ${R.pick(["me", "the music", "that noise"])}?`, "hear", "here"], [`Let's take a ${R.pick(["short", "quick", "coffee"])} break.`, "break", "brake"],
        [`I'll see you next week.`, "week", "weak"], [`Please write ${R.pick(["your name", "an email", "a short report"])} here.`, "write", "right"],
        [`I should have ${R.pick(["called", "known", "left earlier"])}.`, "have", "of"], [`We walked past the ${R.pick(["station", "school", "park"])}.`, "past", "passed"],
        [`The weather ${R.pick(["affects", "will affect"])} our plans.`, "affects", "effects"], [`The effect was ${R.pick(["huge", "immediate", "small"])}.`, "effect", "affect"],
        [`I want a piece of ${R.pick(["cake", "pie", "bread"])}.`, "piece", "peace"], [`I know the ${R.pick(["answer", "way", "risk"])}.`, "know", "no"],
    ];
    families.homophone = () => {
        const [right, value, wrong] = R.pick(HOM);
        const marked = inject(right, value, wrong, "hom");
        return marked ? { genre: "homophone", right, wrong: marked } : { genre: "homophone", right };
    };
    // 10. a / an.
    families.article = () => {
        const [art, word] = R.pick([["an", "hour"], ["an", "honest mistake"], ["a", "university"], ["a", "European city"], ["an", "MBA"], ["an", "apple"], ["an", "email"], ["a", "user"], ["a", "one-time code"], ["an", "old car"], ["a", "new car"], ["an", "11-year-old"], ["an", "8-hour shift"], ["a", "useful tool"]]);
        const head = R.pick(["It took", "She has", "I saw", "We need"]);
        return { genre: "article", right: `${head} ${art} ${word}.`, wrong: `${head} ${mark(art === "a" ? "an" : "a", art, "acc")} ${word}.` };
    };
    // 11. much/many, indénombrables, pluriels irréguliers.
    families.countable = () => {
        switch (R.pick(["many", "uncount", "irregular"])) {
            case "many": {
                const noun = R.pick(["questions", "people", "problems", "emails", "friends", "errors"]);
                return { genre: "countable", right: `I have many ${noun}.`, wrong: `I have ${mark("much", "many", "acc")} ${noun}.` };
            }
            case "uncount": {
                const [right, wrong] = R.pick([["advice", "advices"], ["information", "informations"], ["feedback", "feedbacks"], ["equipment", "equipments"], ["furniture", "furnitures"], ["homework", "homeworks"], ["software", "softwares"], ["luggage", "luggages"]]);
                return { genre: "countable", right: `Thanks for the ${right}.`, wrong: `Thanks for the ${mark(wrong, right, "acc")}.` };
            }
            default: {
                const [right, wrong] = R.pick([["children", "childs"], ["men", "mans"], ["mice", "mouses"], ["criteria", "criterias"], ["feet", "foots"], ["teeth", "tooths"], ["women", "womans"]]);
                return { genre: "countable", right: `There were three ${right} in the room.`, wrong: `There were three ${mark(wrong, right, "acc")} in the room.` };
            }
        }
    };
    // 12. Comparatifs.
    families.comparative = () => {
        const [right, wrong] = R.pick([["better", "more better"], ["easier", "more easier"], ["worse", "more worse"], ["easiest", "most easiest"], ["worse", "badder"], ["faster", "more faster"]]);
        const head = /est$/.test(right) ? "This is the" : "This one is";
        const tail = /est$/.test(right) ? " option." : " than the old one.";
        return { genre: "comparative", right: `${head} ${right}${tail}`, wrong: `${head} ${mark(wrong, right, "acc")}${tail}` };
    };
    // 13. Majuscules.
    families.capital = () => {
        const [right, word] = R.pick([["See you on Monday.", "Monday"], ["She speaks English fluently.", "English"], ["My birthday is in June.", "June"], ["We love French food.", "French"], ["I think I can help.", "I"], ["The office is closed for Thanksgiving.", "Thanksgiving"], ["He moved to Boston last year.", "Boston"]]);
        const marked = inject(right, word, word.toLowerCase(), "maj", word === "I" ? 1 : 0);
        return marked ? { genre: "capital", right, wrong: marked } : { genre: "capital", right };
    };
    // 14. Apostrophes manquantes.
    families.apostrophe = () => {
        const [right, wrong, sentence] = R.pick([["don't", "dont", "I don't know."], ["can't", "cant", "We can't come tonight."], ["doesn't", "doesnt", "It doesn't work."], ["isn't", "isnt", "That isn't right."], ["I'm", "im", "I'm on my way."], ["won't", "wont", "It won't start."], ["they're", "theyre", "I think they're late."], ["you're", "youre", "I hope you're fine."], ["didn't", "didnt", "He didn't call."], ["it's", "its", "I think it's broken."], ["today's", "todays", "Here are today's notes."]]);
        const marked = inject(sentence, right, wrong, "typo");
        return marked ? { genre: "apostrophe", right: sentence, wrong: marked } : { genre: "apostrophe", right: sentence };
    };
    // 15. Orthographe d'usage.
    families.spelling = () => {
        const [right, wrong, sentence] = R.pick([["definitely", "definately", "I will definitely come."], ["receive", "recieve", "Did you receive my email?"], ["separate", "seperate", "Keep them separate."], ["occurred", "occured", "An error occurred."], ["accommodate", "accomodate", "We can accommodate you."], ["necessary", "neccessary", "Is it necessary?"], ["until", "untill", "Wait until noon."], ["beginning", "begining", "It's the beginning."], ["government", "goverment", "The government agreed."], ["environment", "enviroment", "Protect the environment."], ["embarrassed", "embarassed", "I was embarrassed."], ["calendar", "calender", "Check your calendar."], ["tomorrow", "tomorow", "See you tomorrow."], ["believe", "belive", "I believe you."], ["recommend", "recomend", "I recommend this book."], ["weird", "wierd", "That's weird."], ["truly", "truely", "I'm truly sorry."], ["argument", "arguement", "We had an argument."], ["already", "allready", "It's already done."], ["privilege", "priviledge", "It's a privilege."]]);
        const marked = inject(sentence, right, wrong, "ortho");
        return marked ? { genre: "spelling", right: sentence, wrong: marked } : { genre: "spelling", right: sentence };
    };
    // 16. Mots doublés.
    families.doubled = () => {
        const right = `${capitalize(R.pick(["the", "my", "our"]))} ${R.pick(["report", "server", "car", "plan"])} is ready for the ${R.pick(["meeting", "demo", "trip"])}.`;
        const word = R.pick(["is", "for", "the"]);
        const marked = inject(right, word, `${word} ${word}`, "frappe", word === "the" ? 0 : 0);
        return marked ? { genre: "doubled", right, wrong: marked } : { genre: "doubled", right };
    };
    return families;
}

let englishWords = null;
function isEnglishWord(word) {
    if (!englishWords) {
        englishWords = new Set();
        try {
            const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL("../../extension/data/thesaurus-en.json.gz", import.meta.url))).toString("utf8"));
            for (const entry of Object.values(data)) {
                for (const [, words] of entry) {
                    for (const w of words) {
                        englishWords.add(w.toLowerCase());
                    }
                }
            }
        } catch {
            // sans thésaurus : on accepte la faute
        }
    }
    return englishWords.has(word.toLowerCase());
}

export function buildEnglish({ seed = 2026, perFamily = 60 } = {}) {
    const R = makeRandom(seed + 1);
    const families = englishFamilies(R);
    const items = [];
    const seen = new Set();
    for (const make of Object.values(families)) {
        let made = 0;
        for (let tries = 0; made < perFamily && tries < perFamily * 6; tries++) {
            const r = make();
            if (!r || seen.has(r.right)) {
                continue;
            }
            seen.add(r.right);
            items.push({ lang: "en", genre: `${r.genre}:juste`, text: r.right });
            if (r.wrong && !seen.has(r.wrong)) {
                seen.add(r.wrong);
                items.push({ lang: "en", genre: r.genre, text: r.wrong });
            }
            made++;
        }
    }
    const pool = items.filter((x) => x.genre.endsWith(":juste"));
    let typos = 0;
    for (let tries = 0; typos < perFamily && tries < perFamily * 10; tries++) {
        const base = R.pick(pool).text;
        const words = [...base.matchAll(/(?<![\p{L}'’-])\p{Ll}{5,}(?![\p{L}'’-])/gu)].map((m) => m[0]);
        if (!words.length) {
            continue;
        }
        const word = R.pick(words);
        const bad = typo(R, word, QWERTY);
        if (!bad || bad === word || isEnglishWord(bad)) {
            continue;
        }
        const marked = inject(base, word, bad, "frappe");
        if (marked && !seen.has(marked)) {
            seen.add(marked);
            items.push({ lang: "en", genre: "frappe", text: marked });
            typos++;
        }
    }
    return items;
}

// ============================================================================================
// Traduction
// ============================================================================================

// [lemme français, formes anglaises acceptées : [base, 3s, past, pp, ing] (première = principale), classe]
const TR_VERBS = [
    ["lire", [["read", "reads", "read", "read", "reading"]], "doc"], ["écrire", [["write", "writes", "wrote", "written", "writing"]], "doc"],
    ["envoyer", [["send", "sends", "sent", "sent", "sending"]], "doc"], ["imprimer", [["print", "prints", "printed", "printed", "printing"]], "doc"],
    ["signer", [["sign", "signs", "signed", "signed", "signing"]], "doc"], ["oublier", [["forget", "forgets", "forgot", "forgotten", "forgetting"]], "doc"],
    ["perdre", [["lose", "loses", "lost", "lost", "losing"]], "doc"], ["trouver", [["find", "finds", "found", "found", "finding"]], "doc"],
    ["réparer", [["repair", "repairs", "repaired", "repaired", "repairing"], ["fix", "fixes", "fixed", "fixed", "fixing"]], "dev"],
    ["vendre", [["sell", "sells", "sold", "sold", "selling"]], "dev"], ["acheter", [["buy", "buys", "bought", "bought", "buying"], ["purchase", "purchases", "purchased", "purchased", "purchasing"]], "dev"],
    ["nettoyer", [["clean", "cleans", "cleaned", "cleaned", "cleaning"]], "dev"], ["remplacer", [["replace", "replaces", "replaced", "replaced", "replacing"]], "dev"],
    ["manger", [["eat", "eats", "ate", "eaten", "eating"]], "food"], ["préparer", [["prepare", "prepares", "prepared", "prepared", "preparing"], ["make", "makes", "made", "made", "making"], ["cook", "cooks", "cooked", "cooked", "cooking"]], "food"],
    ["couper", [["cut", "cuts", "cut", "cut", "cutting"], ["slice", "slices", "sliced", "sliced", "slicing"]], "food"], ["partager", [["share", "shares", "shared", "shared", "sharing"]], "food"],
    ["commander", [["order", "orders", "ordered", "ordered", "ordering"]], "food"],
];
// [français sing, plur, genre, anglais sing, plur, classe]
const TR_NOUNS = [
    ["rapport", "rapports", "m", "report", "reports", "doc"], ["lettre", "lettres", "f", "letter", "letters", "doc"], ["facture", "factures", "f", "invoice|bill", "invoices|bills", "doc"],
    ["contrat", "contrats", "m", "contract", "contracts", "doc"], ["livre", "livres", "m", "book", "books", "doc"], ["document", "documents", "m", "document", "documents", "doc"],
    ["ordinateur", "ordinateurs", "m", "computer", "computers", "dev"], ["imprimante", "imprimantes", "f", "printer", "printers", "dev"], ["voiture", "voitures", "f", "car", "cars", "dev"],
    ["vélo", "vélos", "m", "bike|bicycle", "bikes|bicycles", "dev"], ["téléphone", "téléphones", "m", "phone|telephone", "phones|telephones", "dev"], ["machine", "machines", "f", "machine", "machines", "dev"],
    ["gâteau", "gâteaux", "m", "cake", "cakes", "food"], ["pomme", "pommes", "f", "apple", "apples", "food"], ["soupe", "soupes", "f", "soup", "soups", "food"],
    ["pizza", "pizzas", "f", "pizza", "pizzas", "food"], ["salade", "salades", "f", "salad", "salads", "food"], ["tarte", "tartes", "f", "pie|tart", "pies|tarts", "food"],
];
const TR_SUBJECTS = [
    { fr: "je", en: ["i"], person: 0 }, { fr: "tu", en: ["you"], person: 1, register: "tu" }, { fr: "il", en: ["he"], person: 2 },
    { fr: "elle", en: ["she"], person: 2 }, { fr: "nous", en: ["we"], person: 3 }, { fr: "vous", en: ["you"], person: 4, register: "vous" },
    { fr: "ils", en: ["they"], person: 5 }, { fr: "elles", en: ["they"], person: 5 },
];
// EN → FR : sujet anglais, sujets français acceptés.
const TR_EN_SUBJECTS = [
    { en: "I", fr: ["je ", "j'", "j’"], person: 0, third: false }, { en: "He", fr: ["il "], person: 2, third: true }, { en: "She", fr: ["elle "], person: 2, third: true },
    { en: "We", fr: ["nous ", "on "], person: 3, third: false }, { en: "They", fr: ["ils ", "elles "], person: 5, third: false },
    { en: "You", fr: ["tu ", "t'", "vous "], person: 1, third: false, you: true },
];
const FR_STEMS = { lire: [" li", " lu", " lis", " lit", " lir", "'li", "'lu"], écrire: ["écri", "écrit"], envoyer: ["envo", "enverr"], imprimer: ["imprim"], signer: ["sign"], oublier: ["oubli"], perdre: ["perd"], trouver: ["trouv"], réparer: ["répar", "corrig", "arrang"], vendre: ["vend"], acheter: ["achet", "achèt"], nettoyer: ["nettoi", "nettoy"], remplacer: ["remplac", "rempla"], manger: ["mang"], préparer: ["prépar", "cuisin", "fai"], couper: ["coup", "tranch"], partager: ["partag"], commander: ["command"] };
const TR_GENDER = [
    ["My sister", "f", "s"], ["My mother", "f", "s"], ["My aunt", "f", "s"], ["Julie", "f", "s"], ["My daughters", "f", "p"], ["My brother", "m", "s"], ["My father", "m", "s"], ["My sons", "m", "p"],
];
// [anglais, [m:s, m:p, f:s, f:p] français]
const TR_ADJ = [
    ["tired", ["fatigué", "fatigués", "fatiguée", "fatiguées"]], ["happy", ["heureux", "heureux", "heureuse", "heureuses"]], ["ready", ["prêt", "prêts", "prête", "prêtes"]],
    ["sick", ["malade", "malades", "malade", "malades"]], ["surprised", ["surpris", "surpris", "surprise", "surprises"]], ["exhausted", ["épuisé", "épuisés", "épuisée", "épuisées"]],
    ["disappointed", ["déçu", "déçus", "déçue", "déçues"]], ["worried", ["inquiet", "inquiets", "inquiète", "inquiètes"]], ["busy", ["occupé", "occupés", "occupée", "occupées"]],
];

export async function buildTranslation(aria, { seed = 2026, perFamily = 60 } = {}) {
    const R = makeRandom(seed + 2);
    const C = await loadConjugations(aria, new Set([...TR_VERBS.map((v) => v[0]), "partir", "arriver", "venir", "rentrer"]));
    const phrases = [];
    const seen = new Set();
    const add = (p) => {
        if (!seen.has(p.text)) {
            seen.add(p.text);
            phrases.push(p);
        }
    };
    const frVerbForms = (lemma) => {
        const c = C.get(lemma);
        if (!c) {
            return [lemma];
        }
        return [...new Set([lemma, ...Object.values(c.tenses).flat(), ...Object.values(c.participle)])];
    };
    const stem = (lemma) => lemma.replace(/(?:er|ir|re)$/, "").replace(/é$/, "");

    // 1. Français → anglais : personne × temps × négation.
    const TENSES = [
        ["present", (v) => [v[0], v[1], v[4]], "present"], ["passe", (v) => [v[2], v[3]], "passe_compose"], ["imparfait", (v) => [v[2], v[4], "used to"], "imparfait"],
        ["futur", () => ["will", "'ll", "going to", "’ll"], "futur"], ["conditionnel", () => ["would", "'d", "’d"], "conditionnel"],
    ];
    for (let i = 0; i < perFamily * 3; i++) {
        const [lemma, enForms, cls] = R.pick(TR_VERBS);
        const noun = R.pick(TR_NOUNS.filter((x) => x[5] === cls));
        const plural = R.chance(0.3);
        const s = R.pick(TR_SUBJECTS);
        const [tense, expect, label] = R.pick(TENSES);
        const negative = R.chance(0.35);
        const c = C.get(lemma);
        if (!c) {
            continue;
        }
        const det = plural ? "les" : elides(noun[0]) ? "l'" : noun[2] === "f" ? "la" : "le";
        const obj = `${det}${det.endsWith("'") ? "" : " "}${plural ? noun[1] : noun[0]}`;
        let verbPart;
        if (tense === "passe") {
            const aux = AVOIR.present[s.person];
            verbPart = negative ? `${s.fr === "je" ? "je n'" : `${s.fr} n'`}${aux} pas ${c.participle.ms}` : `${withSubject(s.fr, aux)} ${c.participle.ms}`;
        } else {
            const form = c.tenses[tense === "present" ? "present" : tense][s.person];
            verbPart = negative ? `${s.fr === "je" && elides(form) ? "je n'" : `${s.fr} ${elides(form) ? "n'" : "ne "}`}${form} pas` : withSubject(s.fr, form);
        }
        const time = { present: "", passe: ` ${R.pick(["hier", "ce matin"])}`, imparfait: ` ${R.pick(["tous les jours", "autrefois"])}`, futur: ` ${R.pick(["demain", "la semaine prochaine"])}`, conditionnel: "" }[tense];
        const text = `${capitalize(verbPart)} ${obj}${time}.`;
        const enVerbGroup = [...new Set(enForms.flatMap((f) => [...expect(f), ...(negative ? [f[0], "won't", "won’t"] : [])]))];
        const nounGroup = (plural ? noun[4] : noun[3]).split("|");
        const must = [enVerbGroup, nounGroup, s.en.map((w) => ` ${w} `).concat(s.en.map((w) => ` ${w}'`), s.en.map((w) => ` ${w}’`))];
        if (negative) {
            must.push(["not", "n't", "n’t", "never"]);
        }
        const ref = [`${capitalize(s.en[0] === "i" ? "I" : s.en[0])} ${negative ? "don't " : ""}${enForms[0][0]} the ${plural ? noun[4].split("|")[0] : noun[3].split("|")[0]}.`];
        add({ from: "fr", genre: `fr-${label}${negative ? "-neg" : ""}`, text, ref, must, not: negative ? [] : [" not ", "n't "] });
    }

    // 2. Anglais → français : personne × temps × négation, avec le registre imposé pour « you ».
    const EN_TENSES = [
        ["present", (v, third) => (third ? v[1] : v[0]), (lemma, c, p) => [c.tenses.present[p]], "present"],
        ["past", (v) => v[2], (lemma, c) => [c.participle.ms, ...c.tenses.imparfait, ...(c.tenses.simple ?? [])], "past"],
        ["future", (v) => `will ${v[0]}`, (lemma, c, p) => [c.tenses.futur[p], lemma], "futur"],
        ["perfect", (v, third) => `${third ? "has" : "have"} ${v[3]}`, (lemma, c) => [c.participle.ms], "perfect"],
    ];
    for (let i = 0; i < perFamily * 3; i++) {
        const [lemma, enForms, cls] = R.pick(TR_VERBS);
        const noun = R.pick(TR_NOUNS.filter((x) => x[5] === cls));
        const s = R.pick(TR_EN_SUBJECTS);
        const [tense, build, frExpect, label] = R.pick(EN_TENSES);
        const c = C.get(lemma);
        if (!c) {
            continue;
        }
        const negative = R.chance(0.3);
        const v = enForms[0];
        let verbPart = build(v, s.third);
        if (negative) {
            verbPart = tense === "present" ? `${s.third ? "doesn't" : "don't"} ${v[0]}` : tense === "past" ? `didn't ${v[0]}` : tense === "future" ? `won't ${v[0]}` : `${s.third ? "hasn't" : "haven't"} ${v[3]}`;
        }
        const object = `the ${noun[3].split("|")[0]}`;
        const time = { present: "", past: " yesterday", future: " tomorrow", perfect: " already" }[tense];
        const text = `${s.en} ${verbPart} ${object}${negative && tense === "perfect" ? " yet" : time}.`.replace(" already.", ".").replace(" yet.", " yet.");
        const register = s.you ? R.pick(["tu", "vous"]) : undefined;
        const person = s.you ? (register === "tu" ? 1 : 4) : s.person;
        const stems = FR_STEMS[lemma] ?? [stem(lemma)];
        const must = [stems.map((x) => x.toLowerCase()), [noun[0], noun[1]]];
        if (negative) {
            must.push(["pas", "jamais", "ne ", "n'"]);
        }
        void frExpect;
        void person;
        add({ from: "en", genre: `en-${label}${negative ? "-neg" : ""}`, text, ref: [text], must, ...(register ? { register } : {}) });
    }

    // 3. Genre et accords vers le français : « My sister is tired » → fatiguée.
    for (let i = 0; i < perFamily * 2; i++) {
        const [subject, g, n] = R.pick(TR_GENDER);
        const [en, fr] = R.pick(TR_ADJ);
        const kind = R.pick(["be", "left", "arrived"]);
        let text;
        let good;
        let bad;
        if (kind === "be") {
            const verb = n === "p" ? R.pick(["are", "were"]) : R.pick(["is", "was"]);
            text = `${subject} ${verb} ${R.pick(["very ", "really ", "so ", ""])}${en}.`;
            good = fr[(g === "f" ? 2 : 0) + (n === "p" ? 1 : 0)];
            bad = fr[(g === "f" ? 0 : 2) + (n === "p" ? 1 : 0)];
        } else {
            text = `${subject} ${kind === "left" ? "left" : "arrived"} ${R.pick(["early", "late", "yesterday"])}.`;
            const base = kind === "left" ? ["parti", "partis", "partie", "parties"] : ["arrivé", "arrivés", "arrivée", "arrivées"];
            good = base[(g === "f" ? 2 : 0) + (n === "p" ? 1 : 0)];
            bad = base[(g === "f" ? 0 : 2) + (n === "p" ? 1 : 0)];
        }
        const must = [[good]];
        // Le masculin d'un adjectif féminin en -e est le même mot : on ne peut interdire que s'il diffère.
        const not = good !== bad ? [`${bad} `, `${bad}.`, `${bad},`, `${bad}!`] : [];
        add({ from: "en", genre: "en-genre", text, ref: [text], must, not: g === "f" ? not : [] });
    }

    // 4. Nombres, heures, dates, monnaies.
    const MONTHS = [["janvier", "January"], ["mars", "March"], ["juin", "June"], ["septembre", "September"], ["décembre", "December"]];
    for (let i = 0; i < perFamily; i++) {
        const h = 13 + Math.floor(R.random() * 9);
        const m = R.pick(["00", "15", "30", "45"]);
        const h12 = h - 12;
        const day = 1 + Math.floor(R.random() * 28);
        const [moisFr, monthEn] = R.pick(MONTHS);
        const euros = `${Math.floor(R.random() * 90) + 2},${R.pick(["50", "99", "20", "05"])}`;
        const thousands = `${1 + Math.floor(R.random() * 9)} ${R.pick(["250", "500", "999", "100"])}`;
        switch (R.pick(["heure", "date", "prix", "grand"])) {
            case "heure":
                add({ from: "fr", genre: "fr-nombres", text: `La réunion commence à ${h} h ${m}.`, ref: [`The meeting starts at ${h12}:${m} p.m.`], must: [[`${h12}:${m}`, `${h}:${m}`, `${h12} p.m.`, `${h12}pm`, `${h12} pm`]] });
                add({ from: "en", genre: "en-nombres", text: `The meeting starts at ${h12}:${m} p.m.`, ref: [`La réunion commence à ${h} h ${m}.`], must: [[`${h} h ${m}`, `${h}h${m}`, `${h}:${m}`, `${h} h${m === "00" ? "" : ` ${m}`}`]] });
                break;
            case "date":
                add({ from: "fr", genre: "fr-dates", text: `Le rendez-vous est le ${day} ${moisFr}.`, ref: [`The appointment is on ${monthEn} ${day}.`], must: [[monthEn], [`${day}`]] });
                add({ from: "en", genre: "en-dates", text: `The appointment is on ${monthEn} ${day}.`, ref: [`Le rendez-vous est le ${day} ${moisFr}.`], must: [[moisFr], [`${day}`]] });
                break;
            case "prix":
                add({ from: "fr", genre: "fr-nombres", text: `Le billet coûte ${euros} €.`, ref: [`The ticket costs €${euros.replace(",", ".")}.`], must: [[`€${euros.replace(",", ".")}`, `${euros.replace(",", ".")} €`, `${euros.replace(",", ".")} euros`, `${euros.replace(",", ".")}€`]] });
                add({ from: "en", genre: "en-nombres", text: `The ticket costs €${euros.replace(",", ".")}.`, ref: [`Le billet coûte ${euros} €.`], must: [[`${euros} €`, `${euros}€`, `${euros} euros`, `${euros} €`]] });
                break;
            default:
                add({ from: "fr", genre: "fr-nombres", text: `Plus de ${thousands} personnes sont venues.`, ref: [`More than ${thousands.replace(" ", ",")} people came.`], must: [[thousands.replace(" ", ","), thousands.replace(" ", "")]] });
                add({ from: "en", genre: "en-nombres", text: `More than ${thousands.replace(" ", ",")} people came.`, ref: [`Plus de ${thousands} personnes sont venues.`], must: [[thousands, thousands.replace(" ", " "), thousands.replace(" ", " "), thousands.replace(" ", "")]] });
        }
    }

    // 5. Tu ou vous imposé : plusieurs phrases qui s'adressent à quelqu'un.
    const YOU = [
        "Can you send me the file? Thanks for your help.", "Did you finish your report? Let me know when you are ready.", "Please call me when you get home, and bring your keys.",
        "You should rest. Your health matters more than your job.", "Could you check your email? I sent you the invoice.", "Are you coming tonight? You can bring your friends.",
        "Thank you for your order. You will receive your package tomorrow.", "If you need anything, you can ask me.", "Don't forget your passport. Have a safe trip!",
        "Sit down and tell me what you think.", "Can you help me? I can't find your number.", "Your car is ready. You can pick it up today.",
    ];
    for (let i = 0; i < perFamily; i++) {
        add({ from: "en", genre: "en-registre", text: YOU[i % YOU.length] + (i >= YOU.length ? ` ${R.pick(["See you soon.", "Talk to you later.", "Take care."])}` : ""), ref: ["—"], must: [], register: i % 2 ? "tu" : "vous" });
    }
    void frVerbForms;
    return phrases;
}
