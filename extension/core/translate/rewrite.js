// Aria Plume — réécritures autour de la traduction (texte brut seulement, jamais en HTML).
//
// Le modèle de traduction (Bergamot, modèles de Mozilla) a appris sur des textes soignés : il bute
// sur le langage SMS (« slt cv »), l'oral (« t'inquiète », « chui »), l'argot (« crevé », « ça rame »)
// et les expressions figées (« il pleut des cordes », « piece of cake »), qu'il traduit mot à mot.
//
//   1. rewriteSource(text, from) : AVANT la traduction, dans la langue d'origine, ces formes sont
//      remplacées par un équivalent standard que le modèle connaît (« je suis crevé » → « je suis
//      épuisé », « That's a piece of cake » → « That's very easy »). Le sens ne change pas.
//   2. fixTarget(text, to, { source }) : APRÈS la traduction, les calques connus du modèle sont
//      corrigés (« Ça a du sens » → « C'est logique », « Good day to you » → « Have a nice day »),
//      ainsi que le jargon informatique (« demande de tirage » → « pull request ») et la typographie
//      (espace insécable avant ? ! : ; en français).
//
// Code, adresses, chemins, mentions et identifiants techniques ne sont jamais touchés (zones
// protégées du correcteur). Chaque réécriture garde la majuscule du texte d'origine. Les règles
// sont prudentes : dans le doute (« le pneu est crevé », « un bras cassé »), rien ne change.

import { protectedSpans } from "../protect.js";

// Mot entier : ni lettre, ni chiffre, ni apostrophe, ni trait d'union collés avant ou après.
const B = (source) => `(?<![\\p{L}\\p{N}_'’-])(?:${source})(?![\\p{L}\\p{N}_'’-])`;
// Fin de mot (le début peut suivre une apostrophe : « j'suis »).
const E = "(?![\\p{L}\\p{N}_-])";
// Début de mot.
const S = "(?<![\\p{L}\\p{N}_'’-])";
const APOS = "['’]";
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

// La majuscule du texte remplacé passe au remplacement.
function keepCase(replacement, original) {
    if (!replacement || !original) {
        return replacement;
    }
    const letters = original.replace(/[^\p{L}]/gu, "");
    if (letters.length > 1 && letters === letters.toUpperCase() && /\p{Ll}/u.test(replacement)) {
        return replacement.toUpperCase();  // « SLT » → « SALUT »
    }
    if (/^\p{Lu}/u.test(original) && /^\p{Ll}/u.test(replacement)) {
        return replacement[0].toUpperCase() + replacement.slice(1);
    }
    return replacement;
}

// Règle : [motif, remplacement, condition facultative sur le texte d'origine].
function compile(rules) {
    return rules.map(([source, replacement, when]) => ({ re: new RegExp(source, "giu"), replacement, when }));
}

function applyRules(text, rules, context = {}) {
    let out = text;
    for (const { re, replacement, when } of rules) {
        if (when && !(typeof when === "function" ? when(context.source ?? "") : when.test(context.source ?? ""))) {
            continue;
        }
        out = out.replace(re, (...args) => {
            const match = args[0];
            const named = typeof args[args.length - 1] === "object" ? 1 : 0;
            const groups = args.slice(1, args.length - 2 - named);
            const value = typeof replacement === "function"
                ? replacement(match, ...groups)
                : replacement.replace(/\$(\d)/g, (_, n) => groups[Number(n) - 1] ?? "");
            return keepCase(value, match);
        });
    }
    return out;
}

// Les règles ne s'appliquent qu'en dehors des zones protégées (code, adresses, identifiants…).
function outsideProtected(text, transform) {
    const spans = protectedSpans(text).sort((a, b) => a.start - b.start);
    if (!spans.length) {
        return transform(text);
    }
    let out = "";
    let last = 0;
    for (const span of spans) {
        if (span.end <= last) {
            continue;
        }
        const start = Math.max(span.start, last);
        out += transform(text.slice(last, start)) + text.slice(start, span.end);
        last = span.end;
    }
    return out + transform(text.slice(last));
}

// Remplace des mots entiers d'après une table (clé en minuscules).
function replaceWords(text, table, { skipUpper = new Set() } = {}) {
    const words = Object.keys(table).sort((a, b) => b.length - a.length);
    if (!words.length) {
        return text;
    }
    const re = new RegExp(B(words.map((w) => escape(w).replace(/'/g, APOS).replace(/ /g, "\\s+")).join("|")), "giu");
    return text.replace(re, (match) => {
        if (skipUpper.has(match)) {
            return match;
        }
        const value = table[match.toLowerCase().replace(/’/g, "'").replace(/\s+/g, " ")];
        if (value === undefined) {
            return match;
        }
        return /^I\b/.test(value) ? value : keepCase(value, match);
    });
}

// ===================================================================================
// Français, avant traduction vers l'anglais
// ===================================================================================

// Abréviations de SMS et de messagerie, sans ambiguïté (mot entier, toute casse).
const FR_SMS = {
    slt: "salut", bjr: "bonjour", bsr: "bonsoir", wsh: "salut", wesh: "salut",
    tkt: "ne t'inquiète pas", tqt: "ne t'inquiète pas", jsp: "je ne sais pas", jpp: "je n'en peux plus",
    mdr: "lol", ptdr: "lol", xptdr: "lol", pk: "pourquoi", pq: "pourquoi", pkoi: "pourquoi", pourkoi: "pourquoi",
    bcp: "beaucoup", stp: "s'il te plaît", svp: "s'il vous plaît", dsl: "désolé", rdv: "rendez-vous",
    auj: "aujourd'hui", ajd: "aujourd'hui", aujd: "aujourd'hui", tjr: "toujours", tjrs: "toujours",
    qqn: "quelqu'un", qqun: "quelqu'un", qqch: "quelque chose", qqc: "quelque chose",
    mtn: "maintenant", mnt: "maintenant", jtm: "je t'aime", tlm: "tout le monde", pcq: "parce que",
    pck: "parce que", psk: "parce que", paske: "parce que", càd: "c'est-à-dire",
    tps: "temps", msg: "message", msgs: "messages", pb: "problème", pbs: "problèmes", pbm: "problème",
    koi: "quoi", kwa: "quoi", qd: "quand", keske: "qu'est-ce que", kesk: "qu'est-ce que", ske: "ce que",
    dac: "d'accord", "d'ac": "d'accord", osef: "on s'en fiche",
    chui: "je suis", chuis: "je suis", jsuis: "je suis", "j'suis": "je suis", jvais: "je vais", "j'vais": "je vais",
    jsais: "je sais", "j'sais": "je sais", "j'peux": "je peux", jpeux: "je peux", "j'fais": "je fais",
    "j'te": "je te", "j'me": "je me", "j'le": "je le", "j'la": "je la", "j'les": "je les", "j'crois": "je crois",
    "j'pense": "je pense", "j'veux": "je veux", jveux: "je veux", "j'sors": "je sors", "j'arrive": "j'arrive",
    ptit: "petit", ptite: "petite", ptits: "petits", ptites: "petites",
    "p'tit": "petit", "p'tite": "petite", "p'tits": "petits", "p'tites": "petites",
    ordi: "ordinateur", ordis: "ordinateurs", appart: "appartement", apparts: "appartements",
    resto: "restaurant", restos: "restaurants", aprèm: "après-midi", aprem: "après-midi",
    ciné: "cinéma", taf: "travail", exo: "exercice", exos: "exercices",
    ouais: "oui", ouep: "oui", ouaip: "oui", "a+": "à plus", "@+": "à plus",
    biz: "bisous", bizz: "bisous", fastoche: "facile", vrmt: "vraiment",
    ptn: "putain", ptain: "putain", fdp: "fils de pute", ntm: "nique ta mère", vtff: "va te faire foutre", nrv: "énervé",
    ctb: "c'est trop bien", stv: "si tu veux", mdrr: "lol", mdrrr: "lol", ptdrr: "lol", bdm: "bordel de merde",
    jai: "j'ai", jarrive: "j'arrive", japprends: "j'apprends", jattends: "j'attends", jaime: "j'aime", jadore: "j'adore", cé: "c'est", "y'a": "il y a", "t'as": "tu as", "t'es": "tu es", "t'étais": "tu étais",
    "t'avais": "tu avais", "t'auras": "tu auras", "t'aurais": "tu aurais", "t'vas": "tu vas", "t'sais": "tu sais",
    dispo: "disponible", dispos: "disponibles", déj: "déjeuner",
    "petit déj": "petit-déjeuner", "petit dej": "petit-déjeuner", "pause déj": "pause déjeuner", "pause dej": "pause déjeuner",
    "bon aprem": "bon après-midi", "bon aprèm": "bon après-midi", "bon app": "bon appétit",
    oké: "OK", okai: "OK", vazy: "vas-y", "vas y": "vas-y",
};

function frSms(text) {
    return replaceWords(text, FR_SMS)
        // « il y'a » (faute courante) : il y a, sans doubler le « il ».
        .replace(/(?<![\p{L}])il\s+il\s+y\s+a(?![\p{L}])/giu, (m) => keepCase("il y a", m))
        // « cc » de salutation, en tête de message (le « cc » d'un courriel reste).
        .replace(/^(\s*)cc(?=\s*[,!]|\s+(?:toi|vous|tout|ça|ca|cv|les|à|a)\b)/giu, (m, space) => `${space}${keepCase("coucou", m.trim())}`)
        // « c bon », « c pas grave » : c'est.
        .replace(new RegExp(`${S}c(?=\\s+(?:pas|bon|bien|nul|cool|top|super|grave|vrai|faux|sûr|moi|toi|lui|elle|nous|vous|eux|ça|ca|la|le|les|un|une|trop|vraiment|juste|fini|mort|ouf|quoi|qui|quand|comment|pour|parce|normal|génial|dommage|chiant|marrant|possible)${E})`, "giu"), (m) => keepCase("c'est", m))
        // « g faim », « g pas le temps » : j'ai.
        .replace(new RegExp(`${S}g(?=\\s+(?:faim|soif|froid|chaud|peur|mal|envie|besoin|pas|plus|rien|fini|vu|eu|fait|dit|pris|mis|oublié|reçu|compris|trouvé|perdu|raté|regardé|essayé|acheté|trop|vraiment|déjà|encore|jamais|toujours|hâte)${E})`, "giu"), (m) => keepCase("j'ai", m))
        // « sa va », « sa marche » : ça (« sa » possessif est suivi d'un nom).
        .replace(new RegExp(`${S}sa(?=\\s+(?:va|vas|marche|roule|me|te|nous|vous|fait|dépend|suffit|sert|y|craint|passe|arrive|change|commence|continue|existe|m['’]|t['’]|n['’]))`, "giu"), (m) => keepCase("ça", m))
        // « tu fé », « il fé ».
        .replace(new RegExp(`(?<=${S}(?:je|tu)\\s+)fé${E}`, "giu"), "fais")
        .replace(new RegExp(`(?<=${S}(?:il|elle|on|ça|ca)\\s+)fé${E}`, "giu"), "fait")
        // « il fo », « fo que » : faut.
        .replace(new RegExp(`(?<=${S}il\\s+)fo${E}|${S}fo(?=\\s+(?:que|qu['’]|pas|le|la|les|y|en|bien)${E})`, "giu"), "faut")
        // « ya un problème », « ya pas » : il y a.
        .replace(new RegExp(`${S}ya(?=\\s+(?:un|une|des|du|de|d['’]|pas|plus|rien|personne|trop|beaucoup|encore|toujours|jamais|quelqu['’]un|quelque|eu|le|la|les|moyen)${E})`, "giu"), (m) => keepCase("il y a", m))
        // « cv ? », « slt cv » : ça va (le « CV » d'un candidat est en capitales).
        .replace(new RegExp(`${S}cv(?=\\s*(?:\\?|$|,|!|\\.|et\\s+toi|et\\s+vous))`, "gu"), "ça va")
        .replace(new RegExp(`${S}ki(?=\\s+(?:est|a|va|vient|veut|peut|fait|sait|connaît|t['’]|m['’]))`, "giu"), (m) => keepCase("qui", m))
        .replace(new RegExp(`${S}kan(?=\\s+(?:tu|je|j['’]|il|elle|on|nous|vous|ils|elles|est|c['’]est)${E})`, "giu"), (m) => keepCase("quand", m))
        .replace(new RegExp(`${S}tt(?=\\s+(?:le|la|les|de|ça|va|est|ce|seul|seule|à|a)${E})`, "giu"), (m) => keepCase("tout", m))
        .replace(new RegExp(`${S}ns(?=\\s+(?:sommes|avons|allons|pouvons|voulons|devons|faisons|serons|aurons|étions|avions|ne|n['’]|les|le|la|y|en)${E})`, "giu"), (m) => keepCase("nous", m));
}

const ETRE = "suis|es|est|sommes|êtes|sont|étais|était|étions|étiez|étaient|serai|seras|sera|serons|serez|seront|serais|serait|serions|seriez|seraient|être|été|sois|soit|soyons|soyez|soient";
const SENS = "sens|sent|sentons|sentez|sentent|sentais|sentait|sentaient";
// Sujet personne + être (ou se sentir) + adverbes : « je suis », « tu te sens », « j'étais vraiment ».
const PERSON_ETRE = `(?:${S}(?:je|tu|il|elle|on|nous|vous|ils|elles)\\s+(?:ne\\s+|n['’])?(?:${ETRE}|(?:me|te|se|nous|vous)\\s+(?:${SENS}))|${S}j['’](?:étais|étai)|${S}(?:je|tu|il|elle|on|nous|vous|ils|elles)\\s+(?:ne\\s+|n['’])?(?:me|m['’]|te|t['’]|se|s['’]|nous|vous)\\s*(?:${SENS}))`;
const ADVERBS = "(?:\\s+(?:pas|vraiment|trop|complètement|super|hyper|tellement|un\\s+peu|grave|carrément|totalement|déjà|encore|toujours))*";
const DEVICE = "serveur|serveurs|PC|ordinateur|ordinateurs|ordi|portable|téléphone|smartphone|tablette|appli|application|applis|applications|logiciel|logiciels|programme|jeu|jeux|site|navigateur|système|machine|machines|VM|connexion|wifi|wi-fi|réseau|internet|Windows|Linux|Mac|Excel|Word|Outlook|Teams|Chrome|Firefox|imprimante|box|routeur|disque|script|base de données";
const DET = "(?:(?:le|la|les|mon|ma|mes|ton|ta|tes|son|sa|ses|notre|nos|votre|vos|leur|leurs|ce|cet|cette|ces)\\s+|l['’])";
const AVOIR_ETRE = { ai: "suis", as: "es", a: "est", avons: "sommes", avez: "êtes", ont: "sont", avais: "étais", avait: "était", avions: "étions", aviez: "étiez", avaient: "étaient", aurai: "serai", auras: "seras", aura: "sera", aurons: "serons", aurez: "serez", auront: "seront" };
const AVOIR = Object.keys(AVOIR_ETRE).join("|");
const SUBJECT = `(j['’]|(?:tu|il|elle|on|nous|vous|ils|elles|qui)\\s+)`;
// « j'ai le cafard » → « je suis déprimé » : avoir + expression → être + adjectif.
const avoirToEtre = (adjective) => (match, subject, verb) => {
    const etre = AVOIR_ETRE[verb.toLowerCase()];
    const who = /^j/i.test(subject) ? "je " : subject;
    return `${who}${etre} ${adjective}`;
};
const NE_ETRE = { a: "est", as: "es", ont: "sont", avez: "êtes", avait: "était", avaient: "étaient", avons: "sommes", ai: "suis" };

const FR_RULES = compile([
    // Expressions figées et familières.
    [`${S}(rat[ée]s?|rater|rate|rates|ratent|manqu[ée]s?|manquer|loup[ée]s?|louper)\\s+le\\s+coche${E}`, "$1 l'occasion"],
    [`${S}(?:il\\s+ne\\s+faut\\s+pas|faut\\s+pas)\\s+vendre\\s+la\\s+peau\\s+de\\s+l['’]ours\\s+avant\\s+de\\s+l['’]avoir\\s+tué${E}`, "il ne faut pas se réjouir trop tôt"],
    [`${S}(je|tu|il|elle|on|nous|vous|ils|elles)\\s+(suis|es|est|sommes|êtes|sont)\\s+tombé(e?s?)\\s+dans\\s+les\\s+pommes${E}`, (m, who, aux, end) => `${who} ${({ je: "me suis", tu: "t'es", il: "s'est", elle: "s'est", on: "s'est", nous: "nous sommes", vous: "vous êtes", ils: "se sont", elles: "se sont" })[who.toLowerCase()]} évanoui${end}`],
    [`${S}tomber\\s+dans\\s+les\\s+pommes${E}`, "s'évanouir"],
    [`${S}tourn(e|es|ez|ons|ent|er|é|ais|ait|aient)\\s+autour\\s+du\\s+pot${E}`, "évit$1 le sujet"],
    [`${S}(?:un|le)\\s+chat\\s+dans\\s+la\\s+gorge${E}`, "la voix enrouée"],
    [`${S}(pète|pètes|pètent|péter|pétait|pétaient)\\s+(?:la\\s+forme|le\\s+feu|la\\s+pêche)${E}`, (m, verb) => `${({ pète: "est", pètes: "es", pètent: "sont", péter: "être", pétait: "était", pétaient: "étaient" })[verb.toLowerCase()]} en pleine forme`],
    [`${S}mon\\s+petit\\s+doigt\\s+m['’]a\\s+dit${E}`, "j'ai entendu dire"],
    [`${S}(?:on|nous)\\s+(?:n['’]est|ne\\s+sommes|est)\\s+pas\\s+(?:encore\\s+)?sortis\\s+de\\s+l['’]auberge${E}`, "ce n'est pas encore fini"],
    [`${S}(?:c['’]est|ce\\s+n['’]est|ce\\s+sont|ce\\s+ne\\s+sont)\\s+pas\\s+(tes|vos|mes|ses|nos|leurs)\\s+oignons${E}`, "ce ne sont pas $1 affaires"],
    [`${S}(occupe|occupez|mêle|mêlez)-(toi|vous)\\s+de\\s+(tes|vos)\\s+oignons${E}`, "$1-$2 de $3 affaires"],
    [`${S}relous?${E}`, (m) => (/s$/i.test(m) ? "pénibles" : "pénible")],
    [`${S}(s['’]est|se\\s+sont|me\\s+suis|t['’]es|nous\\s+sommes|vous\\s+êtes)\\s+barré(e?s?)${E}`, (m, aux, end) => `${({ "s'est": "est", "se sont": "sont", "me suis": "suis", "t'es": "es", "nous sommes": "sommes", "vous êtes": "êtes" })[aux.toLowerCase().replace(/’/g, "'").replace(/\s+/g, " ")] ?? "est"} parti${end}`],
    [`(?<=${S}que\\s+)(je\\s+me|tu\\s+te|il\\s+se|elle\\s+se|on\\s+se)\\s+(?:barre|barres|casse|casses)(?=\\s*(?:[,.!?]|$))`, (m, who) => ({ je: "je m'en aille", tu: "tu t'en ailles", il: "il s'en aille", elle: "elle s'en aille", on: "on s'en aille" })[who.split(/\s+/)[0].toLowerCase()]],
    [`${S}(je\\s+me|tu\\s+te|il\\s+se|elle\\s+se|on\\s+se|nous\\s+nous|vous\\s+vous|ils\\s+se|elles\\s+se)\\s+(?:barre|barres|barrons|barrez|barrent|casse|casses|cassons|cassez|cassent)(?=\\s*(?:[,.!?]|$)|\\s+(?:d['’]ici|maintenant|là|tout\\s+de\\s+suite|vite|direct)${E})`, (m, who) => ({ je: "je m'en vais", tu: "tu t'en vas", il: "il s'en va", elle: "elle s'en va", on: "on s'en va", nous: "nous nous en allons", vous: "vous vous en allez", ils: "ils s'en vont", elles: "elles s'en vont" })[who.split(/\s+/)[0].toLowerCase()]],
    [`(?<=^\\s*|[.!?]\\s+)faut\\s+(?=que|qu['’]|pas|le|la|les|y|en|bien|vraiment|absolument)`, "il faut "],
    [`${S}((?:la\\s+|ma\\s+|ta\\s+|sa\\s+|notre\\s+|votre\\s+|leur\\s+)?(?:connexion|wifi|wi-fi|réseau|internet|électricité|courant|ligne|4G|5G|box)(?:\\s+(?:wi-?fi|internet))?)\\s+(saute|sautent|sautait|a\\s+sauté)${E}`, (m, subject, verb) => `${subject} ${({ saute: "se coupe", sautent: "se coupent", sautait: "se coupait", "a sauté": "s'est coupée" })[verb.toLowerCase().replace(/\s+/g, " ")]}`],
    [`${S}(préparer|installer|configurer|réserver|attribuer|monter)\\s+(un|son|le|ton|mon|leur|ce|votre|notre)\\s+poste(?!\\s+de)${E}`, "$1 $2 poste de travail"],
    [`${S}(remerci\\p{L}*|merci)([^.!?\\n]{0,40}?)\\s(pour|de)\\s+(votre|ton|vos|tes|leur|leurs)\\s+retours?${E}`, "$1$2 $3 $4 réponse"],
    [`${S}dans\\s+l['’]attente\\s+de\\s+(votre|ton|vos|tes)\\s+(?:retour|retours|réponse)${E}`, "en attendant $1 réponse"],
    [`${S}je\\s+me\\s+permets\\s+de\\s+(vous|te)\\s+relancer${E}`, "je reviens vers $1"],
    [`,?\\s*(?:je\\s+vous\\s+prie|nous\\s+vous\\s+prions|veuillez)\\s+(?:d['’]agréer|de\\s+recevoir|d['’]accepter)(?:\\s*,\\s*(?:madame|monsieur|madame,\\s*monsieur|messieurs|chère\\s+madame|cher\\s+monsieur)\\s*,)?\\s+(?:l['’]expression\\s+de\\s+)?(?:mes|nos)\\s+(?:salutations|sentiments)\\s+(?:distinguées|distingués|les\\s+meilleurs|respectueuses|cordiales)${E}`, ". Cordialement"],
    [`${S}(arrivée?s?|livrée?s?|reçue?s?)\\s+(?:complètement\\s+|tout\\s+)?cassée?s?${E}`, "$1 endommagé"],
    [`${S}validation\\s+de\\s+(la|ma|votre|ta|sa|notre|leur|cette)\\s+commande${E}`, "confirmation de $1 commande"],
    [`${S}on\\s+est\\s+le\\s+combien(?:\\s+aujourd['’]hui)?${E}`, "quelle est la date aujourd'hui"],
    [`${S}(rater|raté|rate|manquer|manqué|louper|loupé)\\s+(ma|ta|sa|notre|votre|leur|la)\\s+correspondance${E}`, "$1 $2 correspondance de train"],
    [`${S}on\\s+remet\\s+ça${E}`, "on recommence"],
    [`${S}à\\s+toute(?=\\s*(?:[!.,]|$))`, "à tout à l'heure"],
    [`${S}(je|j['’]|tu|il|elle|on|nous|vous|ils|elles)\\s*(ai|avais|aurai|as|avait|a|avons|avions|avez|aviez|ont|avaient)\\s+plus\\s+(de|d['’])`, (m, who, aux, de) => `${/^j/i.test(who) ? "je" : who} n'${aux} plus ${de}`],
    [`${S}(?:il\\s+)?y\\s+a\\s+plus\\s+(de|d['’])`, "il n'y a plus $1"],
    [`${S}(?:t['’]es|tu\\s+es)\\s+grave(?:\\s+toi)?(?=\\s*(?:[,.!?]|$))`, "tu es complètement fou"],
    [`${S}(?:ok|okay|oké|OK)\\s*,?\\s+(?:ça|ca|sa)\\s+(?:marche|roule)${E}`, "ça me va"],
    [`${S}j['’]arrive\\s+dans\\s+(\\d+|deux|cinq|dix|quinze|vingt|trente)`, "je serai là dans $1"],
    [`${S}(s['’]est|se\\s+sont|me\\s+suis|t['’]es|nous\\s+sommes|vous\\s+êtes)\\s+fait\\s+avoir${E}`, "$1 fait arnaquer"],
    [`${S}(?:ça|ca|sa)\\s+me\\s+prend\\s+la\\s+tête${E}`, "ça m'agace"],
    [`${S}(?:c['’]est|c['’]était)\\s+la\\s+goutte\\s+d['’]eau\\s+qui\\s+(?:fait|a\\s+fait)\\s+déborder\\s+le\\s+vase${E}`, "c'est la goutte de trop"],
    [`${S}(avoir|ai|as|a|avons|avez|ont)\\s+d['’]autres\\s+chats\\s+à\\s+fouetter${E}`, "$1 des choses plus importantes à faire"],
    [`${S}(?:il\\s+y\\s+a\\s+|y\\s+a\\s+)anguille\\s+sous\\s+roche${E}`, "il y a quelque chose de louche"],
    [`${S}(poser|pose|poses|posez|posé)\\s+une\\s+colle${E}`, "$1 une question difficile"],
    [`${S}(?:en\\s+)?un\\s+clin\\s+d['’]œil${E}`, "très vite"],
    [`${S}(?:c['’]est|ce\\s+n['’]est)\\s+pas\\s+(?:ma|ta|sa)\\s+tasse\\s+de\\s+thé${E}`, "ce n'est pas mon truc"],
    [`${S}(?:il\\s+(?:n['’])?y\\s+a\\s+|y\\s+a\\s+)pas\\s+photo${E}`, "c'est évident"],
    [`${S}(?:ça|ca)\\s+(?:caille|pèle)${E}`, "il fait très froid"],
    [`${S}(?:il\\s+)?(fait|faisait|fera)\\s+un\\s+(?:temps\\s+de\\s+chien|temps\\s+pourri|sale\\s+temps)${E}`, (m, verb) => `il ${verb} très mauvais`],
    [`${S}(?:un\\s+)?temps\\s+de\\s+chien${E}`, "un très mauvais temps"],
    [`${S}au\\s+bout\\s+du\\s+rouleau${E}`, "à bout de forces"],
    [`${S}(prendre|pris|prends|prend|prenez)\\s+un\\s+râteau${E}`, "$1 un refus"],
    [`${S}(?:la\\s+)?grasse\\s+mat${E}`, "la grasse matinée"],
    [`${S}(?:je|j['’])\\s*(?:suis|étais)\\s+(?:trop\\s+)?(?:deg|dég|dèg)${E}`, "je suis très déçu"],
    [`${S}trop\\s+(bien|cool|beau|belle|beaux|belles|mignon|mignonne|drôle|drôles|marrant|marrante|content|contente|contents|heureux|heureuse|bon|bonne|stylé|stylée|génial|géniale|sympa|gentil|gentille|fort|forte)${E}`, "vraiment $1"],
    [`${S}(adore|adores|adorent|aime|aimes|aiment|kiffe|kiffes)\\s+trop${E}`, "$1 vraiment"],
    // Expressions courantes (liste générale, au-delà des bancs).
    [`${S}(est|suis|es|sommes|êtes|sont|était|étais)\\s+tombé(e?s?)\\s+des\\s+nues${E}`, (m, aux, end) => `${({ est: "a été", suis: "ai été", es: "as été", sommes: "avons été", êtes: "avez été", sont: "ont été", était: "avait été", étais: "avais été" })[aux.toLowerCase()]} très surpris${end}`],
    [`${S}(?:${AVOIR})\\s+les\\s+dents\\s+longues${E}`, (m) => m.replace(/les\s+dents\s+longues/i, "beaucoup d'ambition")],
    [`${S}(il|elle|on|je|j['’]|tu|ils|elles)\\s*(a|ai|as|ont)\\s+un\\s+cœur\\s+d['’]artichaut${E}`, (m, who, aux) => `${/^j/i.test(who) ? "je" : who} ${({ a: "tombe", ai: "tombe", as: "tombes", ont: "tombent" })[aux.toLowerCase()]} très facilement amoureux`],
    [`${S}(?:pas|jamais)\\s+fermé\\s+l['’]œil${E}`, (m) => m.replace(/fermé\s+l['’]œil/i, "dormi")],
    [`${S}(a|ai|as|avons|avez|ont|avait)\\s+mis\\s+les\\s+pieds\\s+dans\\s+le\\s+plat${E}`, "$1 fait une gaffe"],
    [`${S}(cass\\p{L}*)\\s+les\\s+oreilles${E}`, (m, verb) => verb.toLowerCase().replace(/^cass/, "assourd").replace(/assourde$/, "assourdit").replace(/assourdé$/, "assourdi").replace(/assourder$/, "assourdir").replace(/assourdes$/, "assourdis").replace(/assourdent$/, "assourdissent").replace(/assourdez$/, "assourdissez")],
    [`${S}(?:c['’]est|c['’]était|ce\\s+serait)\\s+la\\s+fin\\s+des\\s+haricots${E}`, (m) => (/était/i.test(m) ? "c'était une catastrophe" : /serait/i.test(m) ? "ce serait une catastrophe" : "c'est une catastrophe")],
    [`${S}(?:il\\s+ne\\s+faut\\s+pas|faut\\s+pas)\\s+pousser\\s+mémé\\s+dans\\s+les\\s+orties${E}`, "il ne faut pas exagérer"],
    [`${S}(me|m['’]|te|t['’]|lui|nous|vous|leur)\\s*(cass\\p{L}*)\\s+les\\s+pieds${E}`, (m, who, verb) => {
        const form = verb.toLowerCase().replace(/^cass/, "embêt");
        const pronoun = who.toLowerCase().replace(/['’]$/, "e");
        return `${/^(me|te)$/.test(pronoun) ? `${pronoun[0]}'` : `${pronoun} `}${form}`;
    }],
    [`${S}(a|as|ai|ont|avoir)\\s+le\\s+bras\\s+long${E}`, "$1 beaucoup d'influence"],
    [`${S}(?:ça|ca)\\s+me\\s+fait\\s+une\\s+belle\\s+jambe${E}`, "ça ne m'aide pas du tout"],
    [`${S}(a|ai|as|avons|avez|ont|avait)\\s+fait\\s+chou\\s+blanc${E}`, "$1 échoué"],
    [`${S}(a|ont|ai|as)\\s+pris\\s+(?:ses|leurs|mes|tes)\\s+jambes\\s+à\\s+(?:son|leur|mon|ton)\\s+cou${E}`, (m, aux) => ({ a: "s'est enfui", ont: "se sont enfuis", ai: "me suis enfui", as: "t'es enfui" })[aux.toLowerCase()]],
    [`${S}(me|m['’]|te|t['’]|lui|nous|vous|leur)\\s*(court|courent)\\s+sur\\s+le\\s+(?:haricot|système|ciboulot)${E}`, (m, who, verb) => `${/^(m|t)/i.test(who) && who.length <= 2 ? `${who[0]}'` : `${who} `}${verb.toLowerCase() === "courent" ? "énervent" : "énerve"}`],
    [`${S}(je|tu|on)\\s+(donne|donnes)\\s+(?:ma|ta|sa|notre|votre)\\s+langue\\s+au\\s+chat${E}`, (m, who) => ({ je: "j'abandonne", tu: "tu abandonnes", on: "on abandonne" })[who.toLowerCase()]],
    [`${S}(c['’]est|c['’]était|ce\\s+film\\s+est)\\s+un\\s+(?:vrai\\s+)?navet${E}`, "$1 très mauvais"],
    [`${S}(?:se\\s+faire|s['’]est\\s+fait|me\\s+suis\\s+fait|t['’]es\\s+fait|se\\s+sont\\s+fait)\\s+remonter\\s+les\\s+bretelles${E}`, (m) => m.replace(/remonter\s+les\s+bretelles/i, "réprimander")],
    [`${S}(c['’]est|c['’]était)\\s+du\\s+(?:pipeau|flan|bidon)${E}`, "$1 faux"],
    [`${S}à\\s+la\\s+ramasse${E}`, "complètement dépassé"],
    [`(?<=\\p{L}\\s)comme\\s+un\\s+(?:malade|fou|dingue|taré|forcené)${E}`, "énormément"],
    [`${S}(suis|es|est|sommes|êtes|sont|étais|était)\\s+enrhumée?s?${E}`, (m, etre) => `${({ suis: "ai", es: "as", est: "a", sommes: "avons", êtes: "avez", sont: "ont", étais: "avais", était: "avait" })[etre.toLowerCase()]} un rhume`],
    [`${S}on\\s+se\\s+tient\\s+au\\s+courant${E}`, "tenons-nous au courant"],
    [`${S}(?:ça|ca)\\s+(te|vous)\\s+dit\\s+(?:de|d['’])\\s*`, (m, who) => (who.toLowerCase() === "te" ? "tu veux " : "vous voulez ")],
    [`${S}au\\s+taquet${E}`, "très motivé"],
    [`${S}(prend|prends|prennent|prenez|pris)\\s+pour\\s+un\\s+pigeon${E}`, "$1 pour un idiot"],
    [`${S}(?:ça|cela)\\s+m['’]a\\s+fait\\s+chaud\\s+au\\s+cœur${E}`, "ça m'a beaucoup touché"],
    [`${S}(?:c['’]est|ce\\s+n['’]est)\\s+pas\\s+demain\\s+la\\s+veille${E}`, "ce n'est pas près d'arriver"],
    [`${SUBJECT}(${AVOIR})\\s+un\\s+poil\\s+dans\\s+la\\s+main${E}`, avoirToEtre("très paresseux")],
    [`(?<=^\\s*|[.!?]\\s+)sans\\s+rire(?=\\s*[?!.])`, "sérieusement"],
    [`${S}(je|on)\\s+gère(?=\\s*(?:[,.!]|$))`, "$1 m'en occupe"],
    [`(?<=^\\s*|[.!?]\\s+)c['’]est\\s+mort(?=\\s*[,.!])`, "c'est fichu"],
    [`${S}(vas-y|allez-y|allez),\\s+fonce(z)?${E}`, (m, go, z) => (z ? "allez-y, lancez-vous" : "vas-y, lance-toi")],
    [`${S}fonce(?=\\s*!)`, "lance-toi"],
    [`${S}(a|ai|as|avons|avez|ont)\\s+séché\\s+(les\\s+cours|le\\s+cours|l['’]école|la\\s+réunion)${E}`, "$1 manqué volontairement $2"],
    [`${S}(?:se|me|te|s['’]|m['’]|t['’])\\s*(?:suis|est|es)?\\s*planté(e?)\\s+(à|au|en)\\s+(l['’]examen|l['’]exam|examen|partiel|contrôle|oral|entretien)${E}`, (m) => m],
    // Insultes et grossièretés : le registre reste le même, seul le mot à mot change.
    [`(?<=^\\s*|[.!?,]\\s+)tg(?=\\s*[!.,]|\\s*$)`, "ta gueule"],
    [`(?<![\\p{L}'’]|ferme\\s|fermez\\s)ta\\s+gueule(?=\\s*[!.,]|\\s*$)`, "ferme ta gueule"],
    [`(?<=^\\s*|[.!?]\\s+)(?:fait|fais)\\s+chier${E}`, "ça me fait chier"],
    [`(?<=^\\s*|[.!?]\\s+)(putain|merde|bordel|mince|zut)\\s+(?=(?:j['’]|je|tu|t['’]|il|elle|on|ça|c['’]|y|ils|elles|nous|vous|mon|ma|mes|le|la|les)${E})`, "$1, "],
    [`${S}(je|tu|il|elle|on)\\s+(m['’]en|t['’]en|s['’]en)\\s+(?:bats|bat|tape|tapes|branle|branles|carre|carres)\\s+(?:les\\s+couilles|le\\s+coquillard|les\\s+steaks|l['’]œil|complètement)${E}`, "$1 $2 fous"],
    [`(?<=^\\s*|[.!?,]\\s+|espèce\\s+d['’]|sale\\s+|gros\\s+|bande\\s+d['’])enculés?(?=\\s*[!.,]|\\s*$|\\s+(?:de|va))`, (m) => (/s$/i.test(m) ? "connards" : "connard")],
    [`${S}(faire|fais|fait|faites|faisait)\\s+le\\s+con${E}`, "$1 l'idiot"],
    [`${S}(t['’]es|tu\\s+es|il\\s+est|elle\\s+est|c['’]est|vous\\s+êtes|t['’]étais|il\\s+était|ils\\s+sont|elles\\s+sont)\\s+((?:vraiment|trop|complètement|super|un\\s+peu|tellement|carrément|grave)\\s+)?(con|conne|cons|connes)(?=\\s*(?:[!.,?]|$)|\\s+(?:ou|quand|de|comme|parfois)${E})`, (m, subj, adv, con) => `${subj} ${adv ?? ""}stupide${/s$/i.test(con) ? "s" : ""}`],
    // Vie de bureau et tournures du quotidien.
    [`${S}on\\s+se\\s+capte${E}`, "on se parle"],
    [`(?<=^\\s*|[.!?,]\\s+)tant\\s+pis(?=\\s*[,.!]|\\s*$)`, "dommage"],
    [`(?<=^\\s*|[.!?,]\\s+)tant\\s+mieux(?=\\s*[,.!]|\\s*$)`, "c'est une bonne chose"],
    [`${S}(?:ça|ca|cela)\\s+m['’]est\\s+(?:complètement\\s+|totalement\\s+|bien\\s+)?égal${E}`, "ça ne me dérange pas"],
    [`${S}(il\\s+)?(fait|faisait|fera)\\s+lourd${E}`, (m, il, verb) => `${il ?? "il "}${verb} chaud et humide`],
    [`${S}(il\\s+)?(fait|faisait|fera)\\s+un\\s+soleil\\s+de\\s+plomb${E}`, (m, il, verb) => `${il ?? "il "}${verb} très chaud et très ensoleillé`],
    [`${S}(?:un|le)\\s+soleil\\s+de\\s+plomb${E}`, "un soleil brûlant"],
    [`${S}(?:ça|ca|sa)\\s+me\\s+(?:gave|gonfle|soûle|saoule)${E}`, "ça m'énerve"],
    [`(${PERSON_ETRE}${ADVERBS}\\s+)(?:à\\s+plat|sur\\s+les\\s+rotules|sur\\s+les\\s+genoux|lessivé|K\\.?O\\.?)(?=\\s*(?:[,.!?]|$)|\\s+(?:aujourd|ce|depuis|après)${E})`, "$1épuisé"],
    [`${S}une\\s+faim\\s+de\\s+loup${E}`, "très faim"],
    [`${S}un\\s+appétit\\s+d['’]ogre${E}`, "un énorme appétit"],
    [`(?<=^\\s*|[.!?]\\s+)(?:ça|ca)\\s+tombe\\s+mal${E}`, "c'est un mauvais moment"],
    [`(?<=^\\s*|[.!?]\\s+)(?:ça|ca)\\s+tombe\\s+(?:bien|à\\s+pic)(?=\\s*[,.!]|\\s*$)`, "c'est parfait"],
    [`${S}(a|ai|as|avons|avez|ont)\\s+cartonné${E}`, "$1 brillamment réussi"],
    [`${S}(chiant|chiante|chiants|chiantes)${E}`, (m) => m.toLowerCase().replace(/^chiant/, "énervant")],
    [`${S}(?:je\\s+te|je\\s+vous)\\s+dois\\s+une\\s+fière\\s+chandelle${E}`, (m) => (/vous/i.test(m) ? "je vous dois beaucoup" : "je te dois beaucoup")],
    [`${S}(\\d+|deux|trois|quatre|cinq|dix|des)\\s+plombes${E}`, "$1 heures"],
    [`(?<=^\\s*|[.!?]\\s+)(pense|pensez)\\s+à\\s+(?=\\p{L}+(?:er|ir|re|oir)${E})`, (m, verb) => (/ez$/i.test(verb) ? "n'oubliez pas de " : "n'oublie pas de ")],
    [`${S}(?:t['’]as|tu\\s+as)\\s+pas\\s+vu${E}`, "as-tu vu"],
    // Civilités : « M. Dupont » (le modèle laisse « M. »).
    [`${S}M\\.\\s+(?=\\p{Lu})`, "Monsieur "],
    // Fatigue : crevé, claqué, lessivé, vanné, naze, HS → épuisé (seulement pour une personne).
    [`(${PERSON_ETRE}${ADVERBS}\\s+)(?:crevé|claqué|lessivé|vanné|rincé|mort\\s+de\\s+fatigue)(e?s?)${E}`, "$1épuisé$2"],
    [`(${PERSON_ETRE}${ADVERBS}\\s+)(?:naze|nase|HS)(s?)${E}`, "$1épuisé$2"],
    // Météo.
    [`${S}(il\\s+)?(pleut|pleuvait|pleuvra|a\\s+plu)\\s+(?:des\\s+cordes|à\\s+verse|des\\s+hallebardes|comme\\s+vache\\s+qui\\s+pisse)${E}`, (m, il, verb) => `${il ?? ""}${verb} très fort`],
    [`${S}(il\\s+)?(fait|faisait|fera)\\s+un\\s+froid\\s+de\\s+canard${E}`, (m, il, verb) => `${il ?? ""}${verb} très froid`],
    [`${S}(il\\s+)?(fait|faisait|fera)\\s+une\\s+chaleur\\s+(?:à\\s+crever|de\\s+four|d['’]enfer)${E}`, (m, il, verb) => `${il ?? ""}${verb} très chaud`],
    [`${S}un\\s+froid\\s+de\\s+canard${E}`, "un froid glacial"],
    // T'inquiète (pas) → ne t'inquiète pas (mais pas « qu'il t'inquiète »).
    [`(?<![\\p{L}'’]|(?:il|elle|ça|cela|qui|que|qu['’])\\s+)(?:ne\\s+)?t['’]inquiète(?:\\s+pas)?(?![\\p{L}])`, "ne t'inquiète pas"],
    // « Ça marche » / « ça roule » en réponse → d'accord.
    [`(?<=^\\s*|[.!?]\\s+|(?:ok|oui|super|parfait|top|génial|nickel|yes)\\s*,?\\s+)(?:ça|ca|sa)\\s+(?:marche|roule)(?=\\s*(?:[,.!]|$|\\s+(?:je|on|merci|à|pour|alors|on)${E}))`, "d'accord"],
    [`(?<=^\\s*|[.!?]\\s+)nickel(?=\\s*(?:[,.!]|$))`, "parfait"],
    [`(${S}(?:c['’]est|c['’]était|ce\\s+sera)\\s+)nickel${E}`, "$1parfait"],
    // Ramer (être lent) : seulement pour une machine ou « ça ».
    [`(${DET})?${S}(${DEVICE})\\s+(rame|rament|ramait|ramaient)(\\s+(?:trop|grave|à\\s+mort|énormément))?${E}`, (m, det, subject, verb) => {
        const plural = /nt$/.test(verb);
        const past = /ai/.test(verb);
        const etre = past ? (plural ? "étaient" : "était") : (plural ? "sont" : "est");
        return `${det ?? ""}${subject} ${etre} très lent${plural ? "s" : ""}`;
    }],
    [`${S}(?:ça|ca|sa)\\s+(rame|ramait)(?:\\s+(?:trop|grave|à\\s+mort))?${E}`, (m, verb) => (/ai/.test(verb) ? "c'était très lent" : "c'est très lent")],
    [`(${DET}serveurs?)\\s+(est|sont|était|étaient)\\s+(?:tombés?|planté|plantés|HS|down|out)(?=\\s*(?:[,.!?]|$|\\s+(?:depuis|ce|cette|hier|cet|à|encore|à\\s+nouveau|de\\s+nouveau)${E}))`, (m, subject, verb) => `${subject} ${verb} en panne`],
    // Avoir + expression → être + adjectif.
    [`${SUBJECT}(${AVOIR})\\s+le\\s+(?:cafard|blues|bourdon|moral\\s+à\\s+zéro|moral\\s+dans\\s+les\\s+chaussettes)${E}`, avoirToEtre("déprimé")],
    [`${SUBJECT}(${AVOIR})\\s+(?:la\\s+pêche|la\\s+patate|la\\s+frite)${E}`, avoirToEtre("en pleine forme")],
    [`${SUBJECT}(${AVOIR})\\s+un\\s+(?:gros\\s+)?coup\\s+de\\s+(?:barre|mou|pompe)${E}`, avoirToEtre("soudain très fatigué")],
    [`${SUBJECT}(${AVOIR})\\s+le\\s+seum${E}`, avoirToEtre("très déçu")],
    [`(${S}(?:${AVOIR})\\s+)(?:trop\\s+|grave\\s+|vraiment\\s+|carrément\\s+)?(?:la\\s+dalle|les\\s+crocs)${E}`, "$1très faim"],
    [`(${S}(?:${AVOIR})\\s+)la\\s+flemme${E}`, "$1aucune envie"],
    [`${S}quelle\\s+flemme${E}`, "je n'ai aucune envie"],
    [`${S}(co[uû]te|co[uû]tent|co[uû]tait|co[uû]taient|co[uû]té|co[uû]tés|co[uû]tée|co[uû]tées|va\\s+co[uû]ter|co[uû]ter)\\s+(?:un\\s+bras|une\\s+blinde|la\\s+peau\\s+des\\s+fesses|un\\s+rein|les\\s+yeux\\s+de\\s+la\\s+tête|une\\s+couille)${E}`, "$1 une fortune"],
    // Facile, difficile.
    [`${S}(c['’]est|c['’]était|ce\\s+n['’]est|ce\\s+n['’]était|ce\\s+sera)\\s+(?:pas\\s+)?(?:la\\s+mer\\s+à\\s+boire)${E}`, (m, cest) => (/ét/.test(cest) ? "ce n'était pas si difficile" : /sera/.test(cest) ? "ce ne sera pas si difficile" : "ce n'est pas si difficile")],
    [`${S}(?:c['’]est|ce\\s+n['’]est)\\s+pas\\s+(?:sorcier|bien\\s+sorcier)${E}`, "ce n'est pas compliqué"],
    [`${S}(c['’]est|c['’]était|ce\\s+sera)\\s+(?:du\\s+gâteau|du\\s+tout\\s+cuit|simple\\s+comme\\s+bonjour|un\\s+jeu\\s+d['’]enfant|fastoche)${E}`, "$1 très facile"],
    // Retard, envie, nourriture.
    [`${S}à\\s+la\\s+bourre${E}`, "en retard"],
    [`${S}(kiffe|kiffes|kiffent|kiffons|kiffez|kiffer|kiffé|kiffée|kiffés|kiffées|kiffais|kiffait|kiffaient)${E}`, (m) => m.toLowerCase().replace(/^kiff/, "ador")],
    [`${S}(je)\\s+(?=ador)`, "j'"],
    [`${S}(la|de\\s+la|ta|ma|sa)\\s+bouffe${E}`, "$1 nourriture"],
    [`${S}(bouffer|bouffe|bouffes|bouffent|bouffé|bouffait|bouffais)${E}`, (m) => ({ bouffer: "manger", bouffe: "mange", bouffes: "manges", bouffent: "mangent", bouffé: "mangé", bouffait: "mangeait", bouffais: "mangeais" })[m.toLowerCase()]],
    [`${S}(?:ça|ca|sa)\\s+(?:me|m['’])\\s*(?:saoule|soûle|soule|gonfle|prend\\s+la\\s+tête|casse\\s+les\\s+pieds|tape\\s+sur\\s+les\\s+nerfs|fout\\s+les\\s+boules)${E}`, "ça m'énerve"],
    [`${S}(?:ça|ca|sa)\\s+(?:me|m['’])\\s*(?:saoulait|soûlait|gonflait|prenait\\s+la\\s+tête)${E}`, "ça m'énervait"],
    [`${S}(me|te|se|nous|vous)\\s+prendre\\s+la\\s+tête${E}`, "$1 compliquer la vie"],
    // Ouf (fou), de ouf (incroyable).
    [`${S}(c['’]est|c['’]était)\\s+(?:trop\\s+|vraiment\\s+|complètement\\s+)?ouf${E}`, "$1 fou"],
    [`${S}(?:trop|vraiment|complètement|carrément)\\s+ouf${E}`, "vraiment fou"],
    [`${S}de\\s+ouf${E}`, "incroyable"],
    [`${S}comme\\s+un\\s+bleu${E}`, "comme un débutant"],
    // Poser un lapin, faire faux bond.
    [`${S}(m|t)['’](a|as|ont|avez|avait|avaient)\\s+(?:posé\\s+un\\s+lapin|fait\\s+faux\\s+bond)${E}`, (m, who, aux) => `n'${NE_ETRE[aux.toLowerCase()]} pas venu au rendez-vous avec ${who.toLowerCase() === "m" ? "moi" : "toi"}`],
    // « Je suis dégoûté » sans complément : déçu (le dégoût suit « de »).
    [`(${PERSON_ETRE}${ADVERBS}\\s+)dégoûté(e?s?)(?=\\s*(?:[,.!]|$|\\s+(?:parce|car|que|qu['’]|mais|là)${E}))`, "$1très déçu$2"],
    // Souhaits : « Bonne journée à toi » → « Passe une bonne journée ».
    [`${S}bonne\\s+(journée|soirée|nuit|semaine|fin\\s+de\\s+journée|soirée)\\s+à\\s+(toi|vous)${E}`, (m, when, who) => `${who.toLowerCase() === "toi" ? "passe" : "passez"} une bonne ${when}`],
    [`(?<=^\\s*|[.!?]\\s+)bonne\\s+soirée(?=\\s*(?:[!.]|$))`, "passe une bonne soirée"],
    // Négation orale.
    [`${S}c['’]est\\s+pas${E}`, "ce n'est pas"],
    [`${S}c['’]était\\s+pas${E}`, "ce n'était pas"],
    // Heures : « 8h15 », « 8 h 15 » → « 8:15 » (sinon : « the train by 8h15 »). « 14 h » reste.
    [`(?<![\\p{N}:,.])([01]?\\d|2[0-3])\\s?h\\s?([0-5]\\d)(?![\\p{N}])`, "$1:$2"],
    // La branche « main » (le modèle traduit « hand »).
    [`${S}(branche|sur|dans|vers|depuis|merger|merge|pusher|pousser|poussé|rebase|rebaser|checkout)\\s+(?:la\\s+branche\\s+)?(?:["«“]\\s*)?main(?:\\s*["»”])?${E}`, (m, before) => (/^branche$/i.test(before) ? "branche principale" : `${before} la branche principale`)],
]);

// ===================================================================================
// Anglais, avant traduction vers le français
// ===================================================================================

const EN_SMS = {
    pls: "please", plz: "please", plse: "please", plsss: "please", thx: "thanks", thnx: "thanks", tnx: "thanks",
    thanx: "thanks", tysm: "thank you so much", btw: "by the way", idk: "I don't know", idc: "I don't care",
    imo: "in my opinion", imho: "in my opinion", tbh: "to be honest", brb: "be right back", omg: "oh my God",
    lmao: "lol", lmfao: "lol", rofl: "lol", fyi: "for your information", afaik: "as far as I know",
    irl: "in real life", nvm: "never mind", ttyl: "talk to you later", gtg: "I have to go", g2g: "I have to go",
    wanna: "want to", gonna: "going to", gotta: "have to", kinda: "kind of", sorta: "sort of", dunno: "don't know",
    lemme: "let me", gimme: "give me", cuz: "because", coz: "because", tho: "though", thru: "through",
    b4: "before", "2day": "today", "2morrow": "tomorrow", "2nite": "tonight", tmrw: "tomorrow", tmr: "tomorrow",
    tonite: "tonight", "y'all": "you all", yall: "you all", im: "I'm", ive: "I've",
    dont: "don't", cant: "can't", didnt: "didn't", doesnt: "doesn't", isnt: "isn't", wasnt: "wasn't",
    arent: "aren't", werent: "weren't", couldnt: "couldn't", shouldnt: "shouldn't", wouldnt: "wouldn't",
    havent: "haven't", hasnt: "hasn't", hadnt: "hadn't", thats: "that's", whats: "what's", theres: "there's",
    youre: "you're", theyre: "they're", youve: "you've", weve: "we've", theyve: "they've", youll: "you'll",
    itll: "it'll", wouldve: "would've", couldve: "could've", shouldve: "should've", asap: "as soon as possible",
    ppl: "people", convo: "conversation", bday: "birthday", "b-day": "birthday", sry: "sorry", srry: "sorry",
    soz: "sorry", congrats: "congratulations", hbu: "how about you", wbu: "what about you", ikr: "I know, right",
    jk: "just kidding", "j/k": "just kidding", tysvm: "thank you so much", ofc: "of course", obv: "obviously",
    prob: "probably", probs: "probably", def: "definitely", defo: "definitely", rly: "really", srsly: "seriously",
    abt: "about", bout: "about", msg: "message", pic: "picture", pics: "pictures",
    wtf: "what the fuck", wth: "what the hell", stfu: "shut the fuck up", ffs: "for fuck's sake", omfg: "oh my God",
    lmk: "let me know", ngl: "not gonna lie", tbf: "to be fair", istg: "I swear to God", fml: "my life sucks",
    idgaf: "I don't give a fuck", gtfo: "get the fuck out",
};
const EN_SKIP_UPPER = new Set(["IM", "DEF", "PROB", "PIC", "PICS", "MSG", "ABT", "OFC", "BOUT"]);

function enSms(text) {
    return replaceWords(text, EN_SMS, { skipUpper: EN_SKIP_UPPER })
        // « i » seul : I (pas dans « i.e. », « i) », « i-th »).
        .replace(/(?<![\p{L}\p{N}_'’.-])i(?=\s|['’](?:m|ve|ll|d)(?![\p{L}])|[,!?]|$)/gu, "I")
        // « u » et « r » : you / are (« r u ok », « how r u », « thank u »).
        .replace(/(?<![\p{L}\p{N}_'’-])u(?![\p{L}\p{N}_'’-])/gu, "you")
        .replace(/(?<![\p{L}\p{N}_'’-])r(?=\s+(?:you|we|they|the|these|those|there|all|so|not|going|coming|ready|ok|OK|done|sure|free|busy|home|here)(?![\p{L}]))/gu, "are")
        .replace(/(?<=(?<![\p{L}])(?:you|we|they|how|where|what|who|when|why)\s+)r(?![\p{L}\p{N}_'’-])/giu, "are")
        // « ur » : you're devant un adjectif, your sinon.
        .replace(/(?<![\p{L}\p{N}_'’-])ur(?=\s+(?:welcome|right|wrong|the\s+best|so|not|going|kidding|joking|amazing|awesome|great|late|early|sure|ready|done|free|busy|crazy|funny|sweet|kind|always|never|still|just|probably|coming|being|doing|making|lucky|wrong)(?![\p{L}]))/giu, (m) => keepCase("you're", m))
        .replace(/(?<![\p{L}\p{N}_'’-])ur(?![\p{L}\p{N}_'’-])/giu, (m) => keepCase("your", m))
        // « ty », « np » seuls.
        .replace(/(?<![\p{L}\p{N}_'’-])ty(?=\s*(?:[!.,]|$|\s+(?:so\s+much|very\s+much|for|guys|all)(?![\p{L}])))/giu, (m) => keepCase("thank you", m))
        .replace(/(?<![\p{L}\p{N}_'’-])np(?=\s*(?:[!.,]|$))/giu, (m) => keepCase("no problem", m))
        // « k », « kk » seuls : OK (pas « 5 k »).
        .replace(/(?<![\p{L}\p{N}_'’-]|\p{N}\s)(?:kk|k)(?=\s*(?:[!.,]|$)|\s+(?:thanks|thx|see|bye|cool|I|i)(?![\p{L}]))/gu, "OK")
        .replace(/(?<![\p{L}\p{N}_'’-])(?:okay|ok)(?![\p{L}\p{N}_'’-])/giu, "OK")
        // « bc » (because) devant un sujet, « rn » en fin de phrase, « w/ », « w/o ».
        .replace(/(?<![\p{L}\p{N}_'’-])bc(?=\s+(?:I|i|you|he|she|it|we|they|the|my|your|of|there|this|that)(?![\p{L}]))/gu, "because")
        .replace(/(?<![\p{L}\p{N}_'’-])rn(?=\s*(?:[!.,?]|$))/gu, "right now")
        .replace(/(?<![\p{L}\p{N}_'’-])w\/o(?=\s)/giu, "without")
        .replace(/(?<![\p{L}\p{N}_'’-])w\/(?=\s)/giu, "with");
}

const COPULA = "(?:is|['’]s|was|be|been|are|['’]re|were|looks|seems|sounds|seemed|looked|sounded)";

const HOURS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const hour = (h) => HOURS[h.toLowerCase()] ?? Number(h);
const SUBJECT_HAVE = { "we're": "we have", "we are": "we have", "i'm": "I have", "i am": "I have", "you're": "you have", "you are": "you have", "they're": "they have", "they are": "they have" };

const EN_RULES = compile([
    // Expressions et tournures.
    [`${S}on\\s+cloud\\s+nine${E}`, "extremely happy"],
    [`${S}(don['’]t|do\\s+not|stop)\\s+beat(?:ing)?\\s+(yourself|yourselves|myself|himself|herself)\\s+up(?:\\s+(?:over|about)\\s+(?:it|this|that))?${E}`, (m, verb, who) => (/^stop/i.test(verb) ? `stop blaming ${who}` : `don't blame ${who}`)],
    [`${S}(?:that|this|the)\\s+ship\\s+has\\s+(?:already\\s+)?sailed${E}`, "it's too late"],
    [`${S}take\\s+a\\s+rain\\s*check\\s+on${E}`, "postpone"],
    [`${S}(?:take|get)\\s+a\\s+rain\\s*check${E}`, "do it another time"],
    [`${S}you\\s+can\\s+say\\s+that\\s+again${E}`, "that's so true"],
    [`(went\\s+down|crashed|failed|stopped\\s+working|happened|died|rebooted|broke\\s+down|went\\s+offline)\\s+overnight${E}`, "$1 during the night"],
    [`${S}(push|pushed|pushing|merge|merged|merging|deploy|deployed|deploying|ship|shipped|apply|applied|commit|committed)\\s+(the|a|my|our|this|that|your)\\s+fix${E}`, "$1 $2 patch"],
    [`${S}(is|are|['’]s|['’]re|was|were|can\\s+be|be)\\s+(?:a|such\\s+a)\\s+(?:real\\s+|total\\s+|huge\\s+|massive\\s+)?pain(?:\\s+in\\s+the\\s+(?:neck|butt|ass))?${E}`, "$1 very annoying"],
    [`${S}out\\s+of\\s+(?:the\\s+)?office${E}`, "away from the office"],
    [`${S}(is|are|['’]s|['’]re)\\s+(currently\\s+|temporarily\\s+)?out\\s+of\\s+stock${E}`, "$1 $2no longer in stock"],
    [`${S}(?:a\\s+)?quarter\\s+past\\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\\d{1,2})${E}`, (m, h) => `${hour(h)}:15`],
    [`${S}half\\s+past\\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\\d{1,2})${E}`, (m, h) => `${hour(h)}:30`],
    [`${S}(?:a\\s+)?quarter\\s+(?:to|of)\\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\\d{1,2})${E}`, (m, h) => `${((hour(h) + 10) % 12) + 1}:45`],
    [`(^|[.!?…]\\s+|\\p{Extended_Pictographic}\\s*)(?:just\\s+)?(landed|arrived|got\\s+home|got\\s+back|woke\\s+up)${E}`, (m, before, verb) => `${before}I just ${verb.toLowerCase()}`],
    [`(^|[.!?…]\\s+|\\p{Extended_Pictographic}\\s*)(running\\s+late|heading\\s+(?:out|home|over|back)|leaving\\s+now|on\\s+my\\s+way|almost\\s+there)${E}`, (m, before, what) => `${before}I'm ${what.toLowerCase()}`],
    [`(^|[.!?…]\\s+|[,;]\\s*)be\\s+(there|back|home|ready|done)\\s+in\\s+(\\d{1,2})(?:\\s*(?:min|mins|minutes))?(?=\\s*(?:[,.!]|$))`, "$1I'll be $2 in $3 minutes"],
    [`${S}omw${E}`, "I'm on my way"],
    [`${S}(what\\s+to|to)\\s+get\\s+(my|your|his|her|our|their)\\s+([\\p{L}-]+)\\s+for\\s+(her|his|their|my|your|our)\\s+(birthday|bday|christmas|anniversary)${E}`, "$1 buy $2 $3 for $4 $5"],
    [`${S}(will|should|would|may|might|can|could)\\s+ship${E}`, "$1 be shipped"],
    [`${S}(it|this|your\\s+order|the\\s+order|the\\s+package|the\\s+item)\\s+ships${E}`, "$1 is shipped"],
    [`${S}pick\\s+up\\s+(some|a\\s+few|a\\s+loaf\\s+of|a\\s+bottle\\s+of|a\\s+carton\\s+of)\\s+`, "buy $1 "],
    [`${S}picked\\s+up\\s+(some|a\\s+few|a\\s+loaf\\s+of|a\\s+bottle\\s+of|a\\s+carton\\s+of)\\s+`, "bought $1 "],
    [`${S}(we['’]re|we\\s+are|I['’]m|I\\s+am|you['’]re|you\\s+are|they['’]re|they\\s+are)\\s+(?:all\\s+|completely\\s+|totally\\s+)?out\\s+of\\s+(milk|bread|coffee|sugar|eggs|butter|toilet\\s+paper|gas|money|cash|time|ideas|ink|paper|water|beer|wine|food|salt|flour|pasta|rice|tea)(\\s+again)?${E}`, (m, who, what, again) => `${SUBJECT_HAVE[who.toLowerCase().replace(/’/g, "'").replace(/\s+/g, " ")]} no more ${what}${again ?? ""}`],
    [`${S}(it['’]s|it\\s+is|it\\s+was)\\s+(?:absolutely\\s+|so\\s+|really\\s+)?freezing(?=\\s+(?:in\\s+here|out\\s+there|outside|today|tonight|this|here)|\\s*[,.!]|\\s*$)`, (m, it) => `${/was/.test(it) ? "it was" : "it's"} very cold`],
    [`${S}(?:it['’]s|it\\s+is)\\s+boiling(?=\\s+(?:in\\s+here|out\\s+there|outside|today)|\\s*[,.!]|\\s*$)`, "it's very hot"],
    // Expressions figées → anglais littéral que le modèle traduit bien.
    [`(?<=${COPULA}\\s+(?:just\\s+|really\\s+|totally\\s+|literally\\s+)?)(?:a\\s+)?piece\\s+of\\s+cake${E}`, "very easy"],
    [`${S}break\\s+a\\s+leg${E}`, "good luck"],
    [`${S}(?:a\\s+(?:bit|little)\\s+)?under\\s+the\\s+weather${E}`, (m) => (/^a\s/i.test(m) ? "a bit sick" : "sick")],
    [`${S}(hit|hitting)\\s+the\\s+(?:sack|hay)${E}`, (m, verb) => (/ing/i.test(verb) ? "going to bed" : "go to bed")],
    [`${S}no\\s+worries${E}`, "no problem"],
    [`${S}my\\s+bad${E}`, "sorry"],
    [`${S}(it|this|that)(?:['’]s|\\s+is)\\s+not\\s+rocket\\s+science${E}`, "$1 is not complicated"],
    [`${S}(it|this|that)\\s+isn['’]t\\s+rocket\\s+science${E}`, "$1 isn't complicated"],
    [`${S}call\\s+it\\s+a\\s+(?:day|night)${E}`, "stop for today"],
    [`${S}(?:it['’]s|it\\s+is)\\s+(?:raining\\s+cats\\s+and\\s+dogs|pouring(?:\\s+(?:down|rain))?|bucketing(?:\\s+down)?)${E}`, "it's raining very hard"],
    [`${S}(?:it['’]s\\s+been|it\\s+has\\s+been)\\s+(?:raining\\s+cats\\s+and\\s+dogs|pouring(?:\\s+(?:down|rain))?)${E}`, "it has been raining very hard"],
    [`${S}raining\\s+cats\\s+and\\s+dogs${E}`, "raining very hard"],
    [`${S}on\\s+the\\s+same\\s+page${E}`, "in agreement"],
    [`${S}touch\\s+base(?:\\s+(?:on|about)\\s+(?:it|this|that))?${E}`, "talk about it"],
    [`${S}thanks\\s+for\\s+the\\s+heads[-\\s]up${E}`, "thanks for letting me know"],
    [`${S}(?:just\\s+)?a\\s+(?:quick\\s+)?heads[-\\s]up${E}`, (m) => (/^just/i.test(m) ? "just to let you know" : "a warning")],
    [`${S}long\\s+time\\s+no\\s+see${E}`, "it's been a long time"],
    [`${S}what['’]?s\\s+up(?=\\s*(?:[?!.,]|$)|\\s+(?:with\\s+you|guys|man|dude|bro|everyone)${E})`, "what's new"],
    [`${S}(?:wassup|whassup|sup)(?=\\s*(?:[?!.,]|$))`, "what's new"],
    [`${S}(?:that\\s+|it\\s+)?sounds\\s+good(?:\\s+to\\s+me)?${E}`, "that works for me"],
    [`${S}(?:that\\s+|it\\s+)?sounds\\s+great${E}`, "that's great"],
    [`${S}(that|it|this)\\s+makes\\s+(?:a\\s+lot\\s+of\\s+|total\\s+|perfect\\s+)?sense${E}`, "$1 is logical"],
    [`${S}makes\\s+sense${E}`, "is logical"],
    [`${S}fair\\s+enough${E}`, "that's fair"],
    [`${S}(?:I['’]m|I\\s+am)\\s+(?:down|in)(?=\\s*(?:[!.]|$))`, "I'm up for it"],
    [`${S}(?:I['’]m|I\\s+am)\\s+down\\s+(?=for|to)`, "I'm in "],
    [`${S}count\\s+me\\s+in${E}`, "I'm up for it"],
    [`${S}(cost|costs|costed|costing)\\s+an\\s+arm\\s+and\\s+a\\s+leg${E}`, "$1 a fortune"],
    [`${S}once\\s+in\\s+a\\s+blue\\s+moon${E}`, "very rarely"],
    [`${S}spill(ed|s)?\\s+the\\s+beans${E}`, (m, s) => `reveal${s ?? ""} the secret`],
    [`${S}beat(ing)?\\s+around\\s+the\\s+bush${E}`, (m, ing) => (ing ? "avoiding the subject" : "avoid the subject")],
    [`${S}the\\s+ball\\s+is\\s+in\\s+your\\s+court${E}`, "it's your decision"],
    [`${S}get\\s+the\\s+hang\\s+of${E}`, "learn how to do"],
    [`${S}I['’]m\\s+all\\s+ears${E}`, "I'm listening"],
    [`${S}it['’]s\\s+a\\s+deal${E}`, "agreed"],
    [`${S}feel\\s+free\\s+to\\s+reach\\s+out(?:\\s+to\\s+(me|us))?${E}`, (m, who) => `feel free to contact ${who ?? "me"}`],
    [`${S}(?:for\\s+)?reaching\\s+out(?!\\s+to)${E}`, (m) => (/^for/i.test(m) ? "for contacting me" : "contacting me")],
    [`${S}reach(ing|ed)?\\s+out\\s+to${E}`, (m, ending) => `contact${ending ?? ""}`],
    [`${S}circle\\s+back\\s+(?:on|to)\\s+(this|it|that)${E}`, "talk about $1 again"],
    [`${S}circle\\s+back(?:\\s+(?:to|on))?${E}`, "come back to"],
    // Insultes et grossièretés.
    [`(?<=^\\s*|[.!?,]\\s+)piss\\s+off(?=\\s*[!.,]|\\s*$)`, "get lost"],
    [`${S}screw\\s+(you|him|her|them|this|that)${E}`, (m, who) => (/^(this|that)$/i.test(who) ? "to hell with this" : "go to hell")],
    [`${S}hell\\s+(?:yeah|yes)${E}`, "absolutely"],
    [`${S}hell\\s+no${E}`, "absolutely not"],
    [`${S}dumbass(es)?${E}`, (m, es) => (es ? "idiots" : "idiot")],
    [`${S}(?:what\\s+a|such\\s+a|you)\\s+(?:dick|prick|douchebag|douche|tool|wanker|twat)${E}`, (m) => m.replace(/\S+$/, "jerk")],
    // Vie de bureau et tournures du quotidien.
    [`${S}push(ed)?\\s+(?:back\\s+)?(the|our|this|my|your|that)\\s+(meeting|call|deadline|appointment|launch|release|date|demo|review|interview)\\s+(?:back\\s+)?(?:to|until|till)${E}`, (m, ed, det, what) => `${ed ? "moved" : "move"} ${det} ${what} to`],
    [`${S}(hand|hands|handed|handing)\\s+in\\s+(?:his|her|my|their|your|our)\\s+(?:notice|resignation)${E}`, (m, verb) => ({ hand: "resign", hands: "resigns", handed: "resigned", handing: "resigning" })[verb.toLowerCase()]],
    [`${S}take\\s+(this|it|that)\\s+offline${E}`, "discuss $1 privately"],
    [`${S}walk\\s+(me|us|him|her|them)\\s+through\\s+(it|this|that|the\\s+[\\p{L}-]+)${E}`, "explain $2 to $1 step by step"],
    [`${S}(?:that['’]s|it['’]s|that\\s+is)\\s+a\\s+(?:fair|good|valid)\\s+point${E}`, "that's true"],
    [`${S}I\\s+couldn['’]t\\s+agree\\s+more${E}`, "I completely agree"],
    [`${S}(I['’]m|we['’]re|I\\s+am|we\\s+are)\\s+looking\\s+into\\s+(it|this|that)${E}`, "$1 checking $2"],
    [`${S}(?:it|that)\\s+slipped\\s+my\\s+mind${E}`, "I forgot"],
    [`${S}hang\\s+tight${E}`, "wait a moment"],
    [`${S}(?:I['’]m|I\\s+am)\\s+(?:so\\s+|really\\s+|totally\\s+)?stuffed${E}`, "I've eaten too much"],
    [`${S}(?:I['’]m|I\\s+am)\\s+sick\\s+and\\s+tired\\s+of${E}`, "I'm fed up with"],
    [`${S}(?:it['’]s|that['’]s|it\\s+is)\\s+not\\s+a\\s+big\\s+deal${E}`, "it's not serious"],
    [`${S}(?:it|that)\\s+isn['’]t\\s+a\\s+big\\s+deal${E}`, "it's not serious"],
    [`(?<=^\\s*|[.!?]\\s+)fingers\\s+crossed(?=\\s*[!.]|\\s*$)`, "I'm crossing my fingers"],
    [`(?<=^\\s*|[.!?]\\s+)(?:knock|touch)\\s+(?:on\\s+)?wood(?=\\s*[!.]|\\s*$)`, "I'm touching wood"],
    [`(?<=^\\s*|[.!?]\\s+)good\\s+for\\s+you(?=\\s*[!.]|\\s*$)`, "that's great for you"],
    [`${S}I\\s+owe\\s+you\\s+one${E}`, "I owe you a favor"],
    [`(?<=^\\s*|[.!?,]\\s+)you['’]re\\s+(?:very\\s+|so\\s+|most\\s+)?welcome(?=\\s*[!.]|\\s*$)`, "it's nothing"],
    [`(?<=^\\s*|[.!?]\\s+)no\\s+offen[cs]e(?=\\s*[,.!]|\\s*$|\\s+(?:but|intended))(?:\\s+intended)?`, "I don't want to offend you"],
    [`(?<=^\\s*|[.!?]\\s+)(?:it['’]s\\s+|it\\s+was\\s+|the\\s+)?(?:my|our)\\s+pleasure(?=\\s*[!.]|\\s*$)`, "with pleasure"],
    [`${S}what\\s+a\\s+shame${E}`, "what a pity"],
    [`${S}shoot\\s+(me|us|him|her|them)\\s+(an?|a\\s+quick)\\s+(email|e-mail|message|text|note|line|DM)${E}`, "send $1 $2 $3"],
    [`${S}cover\\s+for\\s+(me|him|her|us|them)${E}`, "replace $1"],
    [`${S}(?:I['’]m|I\\s+am|I\\s+feel|I['’]ve\\s+been)\\s+(?:completely\\s+|totally\\s+|so\\s+)?burn(?:ed|t)\\s+out${E}`, "I'm completely exhausted"],
    [`${S}(?:is|['’]s)\\s+(again\\s+)?jammed(\\s+again)?${E}`, (m, a, b) => `is ${a || b ? "blocked again" : "blocked"}`],
    [`${S}(wi-?fi|connection|internet|signal|call|VPN|network)\\s+keeps\\s+(?:dropping|cutting\\s+out|disconnecting|going\\s+out)${E}`, "$1 keeps disconnecting"],
    [`${S}bear\\s+with\\s+me${E}`, "be patient with me"],
    [`${S}hang\\s+in\\s+there${E}`, "don't give up"],
    [`${S}take\\s+it\\s+easy${E}`, "relax"],
    [`${S}no\\s+big\\s+deal${E}`, "not serious"],
    [`${S}(?:hang|hold)\\s+on(?:\\s+(?:a|one)\\s+(?:sec|second|minute|moment))?(?=\\s*(?:[,.!]|$))`, "wait a moment"],
    [`${S}(?:hang|hold)\\s+on\\s+(?:a|one)\\s+(?:sec|second|minute|moment)${E}`, "wait a moment"],
    [`${S}give\\s+me\\s+(?:a|one)\\s+(?:sec|second|minute)${E}`, "wait a moment"],
    [`${S}(I|we|you|he|she|they)\\s+(can['’]?t|cannot|won['’]t|will\\s+not|couldn['’]t)\\s+make\\s+it(?=\\s*(?:[,.!]|$)|\\s+(?:to|tonight|today|tomorrow|on|this|next|at|in\\s+time|after|before|by)${E})`, "$1 $2 come"],
    [`${S}(can|could|will)\\s+(you|we|they|he|she)\\s+make\\s+it(?=\\s*(?:[,.!?]|$)|\\s+(?:to|tonight|today|tomorrow|on|this|next|at|in\\s+time)${E})`, "$1 $2 come"],
    [`${S}I['’]m\\s+swamped(?:\\s+with\\s+work)?${E}`, "I'm overwhelmed with work"],
    // Expressions courantes (liste générale, au-delà des bancs).
    [`${S}(?:I['’]m|I\\s+am|she['’]s|he['’]s|we['’]re|they['’]re)\\s+over\\s+the\\s+moon${E}`, (m) => m.replace(/over\s+the\s+moon/i, "extremely happy")],
    [`${S}(feel|feeling|felt|feels)\\s+(?:a\\s+(?:bit|little)\\s+)?blue${E}`, "$1 sad"],
    [`${S}(a\\s+lot|so\\s+much|too\\s+much|enough|plenty)\\s+on\\s+(?:my|your|his|her|our|their)\\s+plate${E}`, "$1 to do"],
    [`${S}play\\s+it\\s+by\\s+ear${E}`, "improvise"],
    [`${S}(pull|pulling|pulled|pulls)\\s+(your|my|his|her|our|their)\\s+leg${E}`, (m, verb, pos) => `${({ pull: "tease", pulling: "teasing", pulled: "teased", pulls: "teases" })[verb.toLowerCase()]} ${({ your: "you", my: "me", his: "him", her: "her", our: "us", their: "them" })[pos.toLowerCase()]}`],
    [`${S}(that|it|this)\\s+rings\\s+a\\s+bell${E}`, "$1 sounds familiar"],
    [`${S}get\\s+the\\s+ball\\s+rolling${E}`, "get started"],
    [`${S}sleep\\s+on\\s+it${E}`, "think about it"],
    [`${S}(hit|hits)\\s+the\\s+nail\\s+on\\s+the\\s+head${E}`, "are exactly right"],
    [`${S}(kicked|kick|kicks|kicking)\\s+the\\s+bucket${E}`, (m, verb) => ({ kicked: "died", kick: "die", kicks: "dies", kicking: "dying" })[verb.toLowerCase()]],
    [`${S}don['’]t\\s+count\\s+your\\s+chickens(?:\\s+before\\s+they(?:['’]re|\\s+are)?\\s+hatch(?:ed)?)?${E}`, "don't celebrate too early"],
    [`${S}keep\\s+your\\s+chin\\s+up${E}`, "stay positive"],
    [`${S}the\\s+apple\\s+of\\s+(my|his|her|our|their)\\s+eyes?${E}`, "the person $1 loves most"],
    [`${S}(?:I['’]m|we['’]re)\\s+all\\s+set${E}`, (m) => (/we/i.test(m) ? "we're ready" : "I'm ready")],
    [`${S}good\\s+to\\s+go${E}`, "ready"],
    [`${S}sounds\\s+like\\s+a\\s+plan${E}`, "that's a good plan"],
    [`(?<=^\\s*|[.!?]\\s+)bless\\s+you(?=\\s*[!.]?\\s*$)`, "bless you"],
    [`${S}(?:just\\s+)?kidding(?=\\s*[!.]|\\s*$)`, "I'm joking"],
    [`${S}I['’]m\\s+on\\s+it(?=\\s*[!.]|\\s*$)`, "I'm taking care of it"],
    [`${S}loop\\s+(me|us|him|her|them)\\s+in(?:\\s+on)?${E}`, "include $1 in"],
    [`${S}ping\\s+(you|me|him|her|them|us)${E}`, "send $1 a message"],
    [`${S}(bricked|bricks|brick)\\s+(my|your|his|her|the)\\s+(phone|laptop|computer|tablet|router|console|device)${E}`, (m, verb, pos, what) => `made ${pos} ${what} unusable`],
    [`${S}(he|she)(?:['’]s|\\s+is)\\s+a\\s+(?:really\\s+)?big\\s+deal${E}`, "$1 is very important"],
    [`${S}(?:it['’]s|this\\s+is|that['’]s|it\\s+is)\\s+(?:on\\s+me|my\\s+treat)${E}`, "I'm paying"],
    [`(?<=^\\s*|[.!?]\\s+)I['’]ll\\s+pass(?=\\s*(?:[,.!]|$|\\s+(?:this\\s+time|on\\s+that)))`, "no thanks"],
    [`${S}hit\\s+me\\s+up${E}`, "contact me"],
    [`${S}(?:that\\s+was|it\\s+was)\\s+a\\s+close\\s+call${E}`, "that was a close call"],
    [`${S}speak\\s+of\\s+the\\s+devil${E}`, "speak of the devil"],
    [`${S}stay\\s+in(?=\\s*(?:[,.!]|$|\\s+(?:tonight|today|this)))`, "stay at home"],
    [`${S}circle\\s+back\\s+(?:on|to)\\s+(this|it|that)${E}`, "talk about $1 again"],
    [`${S}(?:I['’]m|I\\s+am)\\s+(?:so\\s+|really\\s+|totally\\s+|super\\s+)?(?:beat|wiped\\s+out|knackered|pooped|dead\\s+tired|worn\\s+out)${E}`, "I'm exhausted"],
    [`${S}keep\\s+me\\s+in\\s+the\\s+loop${E}`, "keep me informed"],
    [`${S}in\\s+the\\s+loop${E}`, "informed"],
    [`${S}no\\s+hard\\s+feelings${E}`, "no offense taken"],
    [`${S}my\\s+two\\s+cents${E}`, "my opinion"],
    [`${S}(?:ASAP|asap)${E}`, "as soon as possible"],
    [`${S}FYI${E}`, "for your information"],
    [`${S}LGTM${E}`, "looks good to me"],
    [`${S}WFH${E}`, "working from home"],
    [`${S}OOO${E}`, "out of the office"],
    [`${S}EOD${E}`, "end of day"],
    [`${S}TBD${E}`, "to be determined"],
    // Mails.
    [`${S}please\\s+find\\s+attached${E}`, "attached is"],
    [`${S}please\\s+see\\s+attached${E}`, "see the attachment"],
    [`${S}(?:I\\s+)?hope\\s+(?:this|my)\\s+(?:e-?mail|message|note)\\s+finds\\s+you\\s+well${E}`, "I hope you are well"],
    [`${S}please\\s+let\\s+me\\s+know${E}`, "please tell me"],
    [`${S}let\\s+me\\s+know${E}`, "tell me"],
    [`${S}dear\\s+sir\\s+or\\s+madam${E}`, "Madam, Sir"],
]);

// ===================================================================================
// Après la traduction
// ===================================================================================

const FR_DEVICE = ["l'application", "l'appli", "le serveur", "les serveurs", "l'ordinateur", "mon ordinateur", "ton ordinateur", "son ordinateur", "votre ordinateur", "notre ordinateur", "l'ordinateur portable", "mon ordinateur portable", "le PC", "mon PC", "le système", "le programme", "le logiciel", "le jeu", "le navigateur", "le site", "le site web", "le téléphone", "mon téléphone", "Windows", "Excel", "la machine", "la VM", "le service", "la base de données", "le script", "l'outil", "mon application", "votre application", "ton application", "cette application", "l'appareil"].map(escape).join("|");

const IT_SOURCE = /\b(?:commit|commits|committed|git|merge|branch|repo|repository|push|pull)\b/i;
const BUILD_SOURCE = /\bbuild\b/i;
const RELEASE_SOURCE = /\b(?:release|roll\s*back|rollback)\b/i;

// Contexte de la phrase d'origine pour le vocabulaire (« ticket », « commande », « fichier »).
const ORDER_SOURCE = (src) => /\borders?\b/i.test(src) && /\b(?:charg|ship|deliver|item|refund|purchas|cancel|track|placed|paid|payment|invoice|cart|checkout|shop|store|confirm)\w*/i.test(src);
const TICKET_SOURCE = (src) => /\btickets?\b/i.test(src) && /\b(?:support|IT|bug|jira|help\s*desk|helpdesk|issue|closed|open(?:ed)?|escalat\w*|assign\w*|resolved|priority|backlog|sprint|incident)\b/i.test(src);
const FILE_SOURCE = (src) => /\bfiles?\b/i.test(src) && !/\bfolders?\b|\bdirector(?:y|ies)\b|\bcase\s+files?\b/i.test(src);
const BROKE_SOURCE = /\b(?:I['’]m|I\s+am|we['’]re|we\s+are|he['’]s|she['’]s|they['’]re|you['’]re)\s+(?:so\s+|totally\s+|completely\s+|flat\s+)?broke\b(?!\s+(?:the|a|an|my|his|her|down|up|into|out|it))/i;
const ORDER_DET = { le: "la", ce: "cette", cet: "cette", un: "une", du: "de la", au: "à la", même: "même", nouvel: "nouvelle", nouveau: "nouvelle", votre: "votre", ma: "ma", ta: "ta", sa: "sa", notre: "notre", leur: "leur", mon: "ma", ton: "ta", son: "sa", "l'": "la " };

const FR_FIX = compile([
    // Idiomes : le modèle a traduit la paraphrase, on remet l'expression française.
    [`${S}(pleut|pleuvait|pleuvra|a\\s+plu)\\s+(?:très\\s+fort|beaucoup|à\\s+torrents)${E}`, "$1 des cordes", /cats\s+and\s+dogs|pouring|bucketing/i],
    [`${S}(?:extrêmement|très|tellement|si)\\s+heureu(?:x|se)s?${E}`, "aux anges", /cloud\s+nine|over\s+the\s+moon/i],
    [`^\\s*[^\\n]{1,40}?(?=\\s*[!.]?\\s*$)`, "à tes souhaits", /^\s*bless\s+you\s*[!.]?\s*$/i],
    [`^\\s*[^\\n]{1,40}?(?=\\s*[!.]?\\s*$)`, "je touche du bois", /^\s*(?:knock|touch)\s+(?:on\s+)?wood\s*[!.]?\s*$/i],
    [`^\\s*[^\\n]{1,40}?(?=\\s*[!.]?\\s*$)`, "va te faire voir", /^\s*screw\s+you\s*[!.]?\s*$/i],
    [`^\\s*[^\\n]{1,40}?(?=\\s*[!.]?\\s*$)`, "carrément", /^\s*hell\s+(?:yeah|yes)\s*[!.]?\s*$/i],
    [`^\\s*[^\\n]{1,40}?(?=\\s*[!.]?\\s*$)`, "dégage", /^\s*(?:piss\s+off|get\s+lost)\s*[!.]?\s*$/i],
    [`^\\s*(?:vous\\s+êtes|tu\\s+es|t['’]es)\\s+(?:un\\s+|une\\s+)?(idiot|idiote|crétin|crétine|imbécile|abruti|abrutie|débile|con|conne)(?=\\s*!)`, "espèce d'$1", /^\s*you\s+(?:idiot|moron|fool|dumbass|jerk|imbecile|halfwit)\s*!/i],
    [`${S}trous?\\s+du\\s+cul${E}`, (m) => (/^trous/i.test(m) ? "connards" : "connard")],
    [`${S}quelle\\s+(?:bite|queue)${E}`, "quel connard"],
    // Civilités anglaises restées dans le français.
    [`(?<![\\p{L}])Mr\\.?(?=\\s+\\p{Lu})`, "M."],
    [`(?<![\\p{L}])(?:Mrs|Ms)\\.?(?=\\s+\\p{Lu})`, "Mme"],
    [`(?<![\\p{L}])Miss(?=\\s+\\p{Lu})`, "Mlle"],
    [`(?<=^\\s*|[.!?]\\s+)(?:ce\\s+n['’]est\\s+rien|c['’]est\\s+rien)(?=\\s*[!.]|\\s*$)`, "de rien", /you['’]re\s+(?:very\s+|so\s+|most\s+)?welcome\s*[!.]?\s*$/i],
    [`${S}(avec|à|au|de)\\s+(?:l['’])?IT${E}`, (m, prep) => `${/^(avec|à|au)$/i.test(prep) ? "auprès du" : "du"} service informatique`, /\b(?:with|to|from|contact)\s+IT\b|\bIT\s+(?:department|support|team|desk)\b/],
    [`${S}(?:continue|ne\\s+cesse)\\s+de\\s+se\\s+bloquer${E}`, "plante sans arrêt", /crash/i],
    [`${S}(est|sont)\\s+(à\\s+nouveau\\s+|encore\\s+)?(?:coincée?s?|bloquée?s?)${E}`, (m, etre, again) => `${etre} ${again ?? ""}en bourrage papier`.replace(/\s+/g, " "), /\b(?:printer|copier|scanner)\b[^.!?]*\bjammed\b/i],
    [`${S}(?:reste|restez|soyez|sois)\\s+positi(?:f|ve|fs|ves)${E}`, (m) => (/ez$/i.test(m.split(/\s/)[0]) ? "gardez le moral" : "garde le moral"), /chin\s+up/i],
    [`${S}ne\\s+(?:te\\s+réjouis|vous\\s+réjouissez|fête|fêtez|célèbre|célébrez)\\s+pas\\s+trop\\s+(?:tôt|vite)${E}`, "il ne faut pas vendre la peau de l'ours avant de l'avoir tué", /count\s+your\s+chickens/i],
    [`${S}c['’]était\\s+(?:un\\s+appel\\s+(?:rapproché|serré|proche)|un\\s+appel\\s+de\\s+près)${E}`, "c'était moins une", /close\s+call/i],
    [`(?<=^\\s*|[.!?]\\s+)(?:parle|parlez|parlons)\\s+du\\s+diable${E}`, "quand on parle du loup", /speak\s+of\s+the\s+devil/i],
    [`${S}c['’]est\\s+un\\s+petit\\s+monde${E}`, "le monde est petit", /small\s+world/i],
    [`${S}pas\\s+(?:ma|ta|sa|notre|votre)\\s+tasse\\s+de\\s+thé${E}`, "pas mon truc", /cup\s+of\s+tea/i],
    [`${S}la\\s+personne\\s+qu['’](?:il|elle|ils|elles|je|j['’])\\s*(?:aime|aiment)\\s+le\\s+plus${E}`, "la prunelle de mes yeux", /apple\s+of\s+(?:my|his|her)\s+eye/i],
    [`${S}ne\\s+(?:te|vous)\\s+réjouis(?:sez)?\\s+pas\\s+trop\\s+(?:tôt|vite)${E}`, "il ne faut pas vendre la peau de l'ours avant de l'avoir tué", /count\s+your\s+chickens/i],
    [`${S}(?:garde|gardez)\\s+(?:le|ton|votre)\\s+moral(?:\\s+(?:en\\s+haut|élevé))?${E}`, (m) => (/gardez/i.test(m) ? "gardez le moral" : "garde le moral"), /chin\s+up|spirits\s+up/i],
    [`${S}(la|une|cette|la\\s+prochaine)\\s+rencontre${E}`, "$1 réunion", (src) => /\bmeetings?\b/i.test(src) && !/\b(?:nice|glad|pleased|happy)\s+to\s+meet\b|\bmet\b/i.test(src)],
    [`${S}(le|un|ce|du|au|mon|ton|votre|notre)\\s+pont${E}`, (m, det) => `${({ le: "la", un: "une", ce: "cette", du: "de la", au: "à la", mon: "ma", ton: "ta", votre: "votre", notre: "notre" })[det.toLowerCase()]} présentation`, (src) => /\bdeck\b/i.test(src) && /\b(?:slides?|call|present|meeting|pitch|review|send|share|client|investor)\w*/i.test(src)],
    [`${S}n['’]abandonne\\s+pas${E}`, "tiens bon", /hang\s+in\s+there/i],
    [`${S}n['’]abandonnez\\s+pas${E}`, "tenez bon", /hang\s+in\s+there/i],
    [`${S}(tu|vous|il|elle|on|je)\\s+(?:l['’])?(as|avez|a|ai)\\s+(complètement\\s+|totalement\\s+|vraiment\\s+|parfaitement\\s+)?(?:cloué|clouée|réussi)${E}`, (m, who, aux, adv) => `${who.toLowerCase() === "je" ? "j'" : `${who} `}${aux} ${adv ?? ""}assuré`.replace(/\s+/g, " "), /nailed\s+it/i],
    [`${S}meca${E}`, "mec", /\bdude\b/i],
    [`${S}ne\\s+te\\s+blâme\\s+pas${E}`, "ne t'en veux pas", /beat(?:ing)?\s+(?:yourself|yourselves)\s+up/i],
    [`${S}ne\\s+vous\\s+blâmez\\s+pas${E}`, "ne vous en voulez pas", /beat(?:ing)?\s+(?:yourself|yourselves)\s+up/i],
    [`${S}(?:très|vraiment|tellement|si)\\s+(?:ennuyeu(?:x|se)s?|agaçante?s?|pénibles?)${E}`, (m) => (/s$/i.test(m) && !/ennuyeux$/i.test(m) ? "pénibles" : "pénible"), /\bpain\b/i],
    [`${S}(${FR_DEVICE})\\s+(ne\\s+cesse\\s+(?:pas\\s+)?de\\s+geler|continue\\s+de\\s+geler|n['’]arrête\\s+pas\\s+de\\s+geler|gèle|a\\s+gelé|s['’]est\\s+gelée?)${E}`, (m, subject, verb) => `${subject} ${/cesse|continue|arrête/.test(verb) ? "se fige sans arrêt" : /a gelé|s.est/.test(verb) ? "s'est figé" : "se fige"}`],
    [`${S}(suis|es|est|sommes|êtes|sont)\\s+(?:complètement\\s+|totalement\\s+)?(?:brisée?s?|cassée?s?|ruinée?s?)${E}`, "$1 fauché", BROKE_SOURCE],
    [`${S}(je\\s+suis|je\\s+serai|nous\\s+sommes|on\\s+est)\\s+(?:à\\s+la|pour\\s+une|pour\\s+la|pour|à|dedans\\s+pour)\\s+(?=\\p{L})`, "$1 partant pour ", /\b(?:I['’]m|I\s+am|we['’]re)\s+(?:down|in|up)\s+for\b/i],
    [`${S}(?:pour\\s+)?(?:tout\\s+inconvénient|tous\\s+les\\s+inconvénients|les\\s+inconvénients|l['’]inconvénient|tout\\s+désagrément)(?:\\s+que\\s+cela\\s+(?:pourrait|peut|pourra|a\\s+pu)\\s+(?:vous\\s+)?(?:causer|occasionner|entraîner))?${E}`, (m) => `${/^pour/i.test(m) ? "pour " : ""}la gêne occasionnée`, /inconvenience/i],
    [`${S}(?:hors\\s+de\\s+(?:mes|ses|nos)\\s+fonctions|hors\\s+du\\s+bureau|loin\\s+du\\s+bureau)${E}`, "absent du bureau", /out\s+of\s+(?:the\s+)?office|away\s+from\s+the\s+office/i],
    // Vocabulaire selon le contexte de la phrase d'origine.
    [`${S}(le|les|un|des|ce|ces|mon|ton|son|votre|notre|leur|vos|nos)\\s+billets?${E}`, (m, det) => `${det} ${/s$/i.test(m) ? "tickets" : "ticket"}`, TICKET_SOURCE],
    [`${S}(un|des|deux|trois|au\\s+moins\\s+un|dont\\s+un|un\\s+seul)\\s+numéros?${E}`, (m, det) => `${det} ${/s$/i.test(m) ? "chiffres" : "chiffre"}`, (src) => /\b(?:password|passcode|PIN)\b/i.test(src) && /\bnumbers?\b/i.test(src)],
    [`${S}(sauvé|sauvés|sauvée|sauvées|sauver|sauve|sauves|sauvez)${E}`, (m) => m.replace(/sauv/i, "sauvegard"), /\bback(?:ed)?\s*up\b|\bbackups?\b/i],
    [`${S}de\\s+mise\\s+en\\s+scène${E}`, "de préproduction", /\bstaging\b/i],
    [`${S}(engager|engagez|engage)\\s+(?=(?:vos|tes|les|ses|nos|mes|des|ces)\\s+(?:clés|fichiers|modifications|changements|mots\\s+de\\s+passe|secrets|identifiants|données))`, (m) => (/ez\s*$/i.test(m) ? "commitez " : "commiter "), IT_SOURCE],
    [`${S}ne\\s+pas\\s+commiter${E}`, "ne commitez pas", /\bdon['’]t\s+commit\b/i],
    [`${S}(le|ce|cet|un|du|au)\\s+ordre${E}`, (m, det) => `${ORDER_DET[det.toLowerCase()]} commande`, ORDER_SOURCE],
    [`${S}(même|nouvel|nouveau|votre|ma|ta|sa|notre|leur|mon|ton|son)\\s+ordre${E}`, (m, det) => `${ORDER_DET[det.toLowerCase()]} commande`, ORDER_SOURCE],
    [`${S}l['’]ordre${E}`, "la commande", ORDER_SOURCE],
    [`${S}(le|la|un|une|ce|votre|mon|ton|son|notre|leur|mauvais|bon)\\s+dossiers?${E}`, (m, det) => `${det} ${/s$/i.test(m) ? "fichiers" : "fichier"}`, FILE_SOURCE],
    // Civilités : « Mme. Patel » → « Mme Patel », « Madame. Johnson » → « Madame Johnson ».
    [`${S}(Mme|Mmes|Mlle|Mlles|Dr|Pr|Me|Madame|Monsieur|Mademoiselle)\\.(?=\\s+\\p{Lu})`, "$1"],
    // Nombres : « 2.000 » ou « 2,000 » (séparateur anglais) → « 2 000 ».
    [`(?<![\\p{N}.,])(\\d{1,3})[.,](\\d{3})(?:[.,](\\d{3}))?(?![\\p{N}]|[.,]\\d)`, (m, a, b, c) => [a, b, c].filter(Boolean).join(" "), (src) => /\d{1,3},\d{3}(?!\d)/.test(src)],
    // Calques de l'anglais.
    [`${S}ça\\s+(?:a|fait)\\s+(?:du|beaucoup\\s+de|tout\\s+son)\\s+sens${E}`, "c'est logique"],
    [`${S}(?:c['’]est|ça)\\s+(?:est\\s+)?bon\\s+avec\\s+moi${E}`, "ça me va"],
    [`${S}ça\\s+me\\s+semble\\s+bon${E}`, "ça me va"],
    [`${S}ça\\s+sonne\\s+bien${E}`, "ça me va"],
    [`${S}ça\\s+marche\\s+pour\\s+moi${E}`, "ça me va"],
    [`${S}assez\\s+juste${E}`, "c'est juste"],
    [`${S}j['’]espère\\s+que\\s+(?:cet|ce)\\s+(?:e-?mail|courriel|message|courrier)\\s+vous\\s+trouve(?:ra)?\\s+(?:bien|en\\s+bonne\\s+santé)${E}`, "j'espère que vous allez bien"],
    [`${S}s['’]il\\s+vous\\s+pla[iî]t\\s+laissez-moi\\s+savoir${E}`, "merci de me faire savoir"],
    [`${S}s['’]il\\s+te\\s+pla[iî]t\\s+laisse-moi\\s+savoir${E}`, "merci de me faire savoir"],
    [`${S}laissez-moi\\s+savoir${E}`, "faites-moi savoir"],
    [`${S}laisse-moi\\s+savoir${E}`, "fais-moi savoir"],
    [`${S}(pourriez-vous|pouvez-vous|pourrais-tu|peux-tu|veuillez)\\s+s['’]il\\s+(?:vous|te)\\s+pla[iî]t${E}`, "$1"],
    [`${S}cher\\s+monsieur\\s+ou\\s+madame${E}`, "Madame, Monsieur"],
    [`${S}(?:les\\s+)?meilleures\\s+salutations${E}`, "cordialement"],
    [`${S}(?:salutations\\s+aimables|aimables\\s+salutations|sincères\\s+salutations|salutations\\s+chaleureuses|chaleureuses\\s+salutations)${E}`, "bien cordialement"],
    [`^\\s*sinc[eè]rement\\s*,\\s*$`, "Cordialement,"],
    [`^\\s*(?:à\\s+votre|à\\s+ta)\\s+santé\\s*,\\s*$`, "Cordialement,"],
    [`${S}ça\\s+fait\\s+des\\s+(?:âges|siècles)${E}`, "ça fait une éternité"],
    [`${S}je\\s+suis\\s+dedans${E}`, "je suis partant"],
    [`${S}prends-le\\s+doucement${E}`, "détends-toi"],
    [`${S}prenez-le\\s+doucement${E}`, "détendez-vous"],
    [`${S}accroche-toi\\s+là${E}`, "tiens bon"],
    [`${S}accrochez-vous\\s+là${E}`, "tenez bon"],
    [`${S}cassez?\\s+une\\s+jambe${E}`, "bonne chance"],
    [`${S}un\\s+morceau\\s+de\\s+gâteau${E}`, "du gâteau"],
    [`${S}revenir\\s+vers\\s+(toi|vous)${E}`, (m, who) => (who.toLowerCase() === "toi" ? "te recontacter" : "vous recontacter")],
    [`${S}(?:je\\s+suis\\s+)?en\\s+retard\\s+de\\s+courir${E}`, "je suis en retard"],
    // Informatique.
    [`${S}(une|la|ma|ta|sa|votre|notre|cette|leur|ma\\s+nouvelle)\\s+demande\\s+de\\s+(?:tirage|traction|extraction)${E}`, "$1 pull request"],
    [`${S}(?:les|des|mes|tes|vos|nos|ces)\\s+demandes\\s+de\\s+(?:tirage|traction|extraction)${E}`, (m) => `${m.split(/\s/)[0]} pull requests`],
    [`${S}demandes?\\s+de\\s+(?:tirage|traction|extraction)${E}`, (m) => (/^demandes/i.test(m) ? "pull requests" : "pull request")],
    [`${S}(mon|ton|son|votre|notre|leur|le|un|ce|dernier|premier)\\s+engagement${E}`, "$1 commit", IT_SOURCE],
    [`${S}(mes|tes|ses|vos|nos|leurs|les|des|ces)\\s+engagements${E}`, "$1 commits", IT_SOURCE],
    [`${S}(?:engager|commettre)\\s+(?=(?:mes|les|ses|vos|tes)\\s+(?:changements|modifications))`, "commiter ", IT_SOURCE],
    [`${S}(${FR_DEVICE})\\s+(s['’]est\\s+écrasée?|s['’]écrase|s['’]écrasent|se\\s+sont\\s+écrasés|ne\\s+cesse\\s+(?:pas\\s+)?de\\s+s['’]écraser|continue\\s+de\\s+s['’]écraser|n['’]arrête\\s+pas\\s+de\\s+s['’]écraser|s['’]écrasait)${E}`, (m, subject, verb) => {
        const v = verb.toLowerCase();
        const fixed = /s.est/.test(v) ? "a planté" : /se sont/.test(v) ? "ont planté" : /écrasent/.test(v) ? "plantent" : /cesse|continue|arrête/.test(v) ? "plante sans arrêt" : /écrasait/.test(v) ? "plantait" : "plante";
        return `${subject} ${fixed}`;
    }],
    [`${S}(${FR_DEVICE})\\s+(a|ont)\\s+arrêté\\s+de\\s+travailler${E}`, "$1 $2 cessé de fonctionner"],
    [`${S}(${FR_DEVICE})\\s+(est|sont)\\s+tombée?s?(?=\\s*(?:[,.!?]|$|\\s+(?:hier|ce|cette|la\\s+nuit|cet)${E}))`, "$1 $2 tombé en panne"],
    [`${S}la\\s+construction\\s+(?:est|a\\s+été)\\s+(?:cassée|brisée|rompue|interrompue)${E}`, "le build est cassé", BUILD_SOURCE],
    [`${S}(?:la|cette)\\s+construction${E}`, "le build", BUILD_SOURCE],
    [`${S}faire\\s+reculer\\s+la\\s+libération${E}`, "revenir à la version précédente", RELEASE_SOURCE],
    [`${S}la\\s+libération${E}`, "la version", RELEASE_SOURCE],
    // Heures : « 8:15 » → « 8 h 15 », « train 8:15 » → « train de 8 h 15 ».
    [`${S}(train|bus|vol|avion|métro|car|navette|TGV|RER|tram)\\s+(?=(?:[01]?\\d|2[0-3]):[0-5]\\d(?![\\p{N}:]))`, "$1 de "],
    [`(?<![\\p{N}:/.,])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\p{N}:])(?:\\s*(?:h|heures?))?`, "$1 h $2"],
    [`(?<![\\p{N}:/.,])([01]?\\d|2[0-3])h([0-5]\\d)(?![\\p{N}])`, "$1 h $2"],
    [`(?<![\\p{N}:/.,])([01]?\\d|2[0-3])\\s?h\\s?00(?![\\p{N}])`, "$1 h"],
]);

const TIME_AFTER_SINCE = "(?:\\d|yesterday|last|this|the|my|his|her|our|their|early|morning|noon|midnight|then|childhood|birth|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December|ages|forever|several|many|years|months|weeks|days|hours|a\\s+(?:few|long|while)|an?\\s+(?:hour|week|month|year))";
const STATE = "((?:very\\s+|so\\s+|really\\s+|quite\\s+|a\\s+bit\\s+|extremely\\s+|super\\s+|still\\s+)?[\\p{L}-]+)";

const SERVER_SOURCE = (src) => /\bserveurs?\b/i.test(src) && !/\b(?:restaurant|resto|café|bar|brasserie|pourboire|addition|menu|plat|table|serveuse|cuisine|boisson|apéro)\b/i.test(src);

const EN_FIX = compile([
    // Idiomes : la paraphrase traduite, puis l'expression anglaise.
    [`${S}(?:didn['’]t|did\\s+not)\\s+(?:come|show\\s+up)\\s+(?:to|for)\\s+(?:the|our|my)\\s+(?:meeting|appointment|date|rendezvous)(?:\\s+with\\s+(me|you))?${E}`, (m, who) => `stood ${who ?? "me"} up`, /posé\s+un\s+lapin|fait\s+faux\s+bond/i],
    [`${S}dig(s|ging|ged)?\\s+(my|your|his|her|our|their)\\s+(?:head|brain|mind)s?${E}`, (m, ending, pos) => `rack${ending === "ging" ? "ing" : ending === "ged" ? "ed" : ending ?? ""} ${pos} brain`, /creus\p{L}*\s+(?:la\s+tête|les\s+méninges)/iu],
    [`${S}(?:it['’]s|it\\s+is|they['’]re|they\\s+are|these\\s+are)\\s+not\\s+(?:your|my)\\s+(?:business|affairs?)${E}`, "it's none of your business", /oignons/i],
    [`${S}waiters?${E}`, (m) => (/s$/i.test(m) ? "servers" : "server"), SERVER_SOURCE],
    [`${S}(?:it\\s+)?made\\s+my\\s+heart\\s+warm${E}`, "it warmed my heart", /chaud\s+au\s+cœur/i],
    [`${S}damn\\s+shit${E}`, "fucking hell", /bordel\s+de\s+merde/i],
    [`${S}(I|you|he|she|we|they)\\s+(?:don['’]t|doesn['’]t)\\s+care${E}`, (m, who) => `${who} ${/^(he|she)$/i.test(who) ? "doesn't" : "don't"} give a fuck`, /bats\s+les\s+couilles|m['’]en\s+tape|branle/i],
    [`${S}(?:a\\s+|the\\s+|his\\s+|her\\s+|my\\s+|their\\s+)?(?:flashing|flasher|flashers|blinker|indicator\\s+light)s?${E}`, "signaling", /clignotant/i],
    [`${S}(telecommut\\p{L}*|teleworking|teletravailing)${E}`, (m) => (/ing$/i.test(m) ? "working from home" : "work from home"), /télétravail/i],
    [`${S}(by|to|with|from|for)\\s+(his|her|my|their|our|your|the)\\s+leaders?${E}`, (m, prep, pos) => `${prep} ${pos} boss`, /\bchef\b/i],
    [`${S}avoid(s|ing|ed)?\\s+the\\s+(?:subject|issue|question|topic)${E}`, (m, ending) => `beat${ending === "s" ? "s" : ending === "ing" ? "ing" : ""} around the bush`, /autour\s+du\s+pot/i],
    [`${S}(?:is\\s+|keeps\\s+)?(?:continuously\\s+|constantly\\s+|always\\s+)?(?:shut(?:s|ting)?\\s+down|disconnect(?:s|ing|ed)?|cut(?:s|ting)?\\s+(?:off|out))(?:\\s+(?:all\\s+the\\s+time|constantly|non-?stop|continuously))?${E}`, "keeps dropping", /\bsaute\b|\bsautent\b/i],
    [`${S}I(?:['’]ll|\\s+will)\\s+(?:come|get)\\s+back\\s+to\\s+you\\s+(?:about|regarding|concerning|on)${E}`, "I'm following up on", /relancer|reviens\s+vers\s+vous/i],
    [`${S}the\\s+good\\s+one${E}`, "the right one", (src) => /\b(?:le|la)\s+bon(?:ne)?\b/i.test(src) && /renvoy|envoi|envoy|donne|lien|fichier|version|adresse|numéro/i.test(src)],
    [`${S}(?:a\\s+)?(?:holly|hoarse|husky|broken|raspy)\\s+voice${E}`, "a frog in my throat", /chat\s+dans\s+la\s+gorge/i],
    [`${S}(crashed|went\\s+down|broke\\s+down|stopped\\s+working|failed|happened|died|rebooted|restarted|was|were)([^.!?\\n]*?)${S}tonight${E}`, "$1$2last night", /cette\s+nuit/i],
    [`${S}(?:make|do|have)\\s+a\\s+(quick\\s+)?point${E}`, (m, quick) => `have a ${quick ?? ""}catch-up`, /\bpoint\b/i],
    [`${S}a\\s+quick\\s+point${E}`, "a quick catch-up", /point\s+rapide|petit\s+point/i],
    [`${S}re-?read\\s+(my|your|the|this|our|his|her)\\s+(pull\\s+request|PR|merge\\s+request|code|changes|commit|branch|patch)${E}`, "review $1 $2"],
    [`${S}computer\\s+(support|department|service|team|helpdesk)${E}`, "IT $1", /informatique/i],
    [`${S}(?:raise|relaunch|revive|remind|boost)\\s+you\\s+(?:about|regarding|concerning|on)${E}`, "follow up with you on", /relancer/i],
    [`${S}I(?:['’]m|\\s+am)\\s+(?:coming|getting)\\s+back\\s+to\\s+you\\s+(?:about|regarding|concerning|on)${E}`, "I'm following up on", /relancer|reviens\s+vers\s+vous/i],
    [`${S}I\\s+come\\s+back\\s+to\\s+you\\s+(?:about|regarding|concerning|on)${E}`, "I'm following up on", /relancer|reviens\s+vers\s+vous/i],
    [`${S}(?:while\\s+waiting\\s+for|waiting\\s+for|awaiting|pending)\\s+your\\s+(?:answer|reply|response)${E}`, "I look forward to your reply", /attente\s+de\s+votre|en\s+attendant\s+votre/i],
    // Nombres : « 1 250 € » → « €1,250 », « 4,50 € » → « €4.50 ».
    [`(?<![\\p{N},.])(\\d{1,3})[   ](\\d{3})(?:[   ](\\d{3}))?(?![\\p{N}])`, (m, a, b, c) => [a, b, c].filter(Boolean).join(",")],
    [`(?<![\\p{N},.])(\\d[\\d,]*)(?:,(\\d{2}))?\\s?€`, (m, whole, cents) => `€${whole}${cents ? `.${cents}` : ""}`],
    // Civilités : « M. Dupont » → « Mr. Dupont », « Mme Leroy » → « Mrs. Leroy ».
    [`${S}M\\.\\s+(?=\\p{Lu})`, "Mr. "],
    [`${S}Mme\\.?\\s+(?=\\p{Lu})`, "Mrs. "],
    [`${S}Mlle\\.?\\s+(?=\\p{Lu})`, "Miss "],
    [`${S}good\\s+day\\s+to\\s+you${E}`, "have a nice day"],
    [`^\\s*good\\s+day(?=\\s*[!.]?\\s*$)`, "Have a nice day"],
    [`${S}bon\\s+app[eé]tite?${E}`, "enjoy your meal"],
    [`^\\s*cordially\\s*,?\\s*$`, "Best regards,"],
    [`^\\s*(?:good\\s+on\\s+you|well\\s+to\\s+you|good\\s+to\\s+you)\\s*,?\\s*$`, "Best regards,"],
    [`^\\s*(?:big|huge|lots\\s+of)\\s+kisses\\s*!?\\s*$`, "Lots of love"],
    [`^\\s*to\\s+more\\s*!?\\s*$`, "See you!"],
    [`^\\s*I['’]m\\s+kissing\\s+you\\s*[.!]?\\s*$`, "Love,"],
    // « is … since » : présent français avec « depuis » → present perfect.
    [`${S}(?:I['’]m|I\\s+am)\\s+${STATE}\\s+since\\s+(?=${TIME_AFTER_SINCE})`, (m, state) => `I've been ${state} since `],
    [`${S}(he|she|it|this|that)(?:['’]s|\\s+is)\\s+${STATE}\\s+since\\s+(?=${TIME_AFTER_SINCE})`, (m, subj, state) => (/^(been|had|got|gone)$/i.test(state) ? m : `${subj} has been ${state} since `)],
    [`${S}(you|we|they)(?:['’]re|\\s+are)\\s+${STATE}\\s+since\\s+(?=${TIME_AFTER_SINCE})`, "$1 have been $2 since "],
    [`${S}((?:my|your|his|her|our|their|the|this|that)\\s+[\\p{L}-]+)\\s+is\\s+${STATE}\\s+since\\s+(?=${TIME_AFTER_SINCE})`, (m, subj, state) => (/^(been|gone)$/i.test(state) ? m : `${subj} has been ${state} since `)],
    [`${S}((?:my|your|his|her|our|their|the|these|those)\\s+[\\p{L}-]+s)\\s+are\\s+${STATE}\\s+since\\s+(?=${TIME_AFTER_SINCE})`, (m, subj, state) => (/^(been|gone)$/i.test(state) ? m : `${subj} have been ${state} since `)],
    // Heures françaises restées telles quelles (« 8h15 ») : 8:15.
    [`(?<![\\p{N}:])([01]?\\d|2[0-3])\\s?h\\s?([0-5]\\d)(?![\\p{N}])`, "$1:$2"],
    [`${S}the\\s+(train|bus|flight|plane|ferry)\\s+(?:by|at|of)\\s+(\\d{1,2}:\\d\\d)${E}`, "the $2 $1"],
]);

// Typographie française : espace insécable avant ? ! : ; et à l'intérieur des guillemets.
function frenchTypography(text) {
    return text
        .replace(/[“"]([^“”"\n]{1,300})[”"]/g, "« $1 »")
        .replace(/(?<=[\p{L}\p{N}»)\]"'’…%€$])[   ]?([?!;:])(?=\s|$|[?!»")\]])/gu, " $1")
        .replace(/«[  ]*/g, "« ")
        .replace(/[  ]*»/g, " »");
}

function englishTypography(text) {
    return text
        .replace(/«[   ]*([^«»\n]{1,300}?)[   ]*»/g, "“$1”")
        .replace(/«[   ]*/g, "“")
        .replace(/[   ]*»/g, "”")
        .replace(/[   ]+([?!;:])(?=\s|$)/g, "$1");
}

// --- Noms propres ---
// Le modèle traduit les prénoms et les marques qui sont aussi des mots (« Pierre » → « Peter »,
// « Victoire » → « Victory », « Mrs. Hope » → « Mme L'espoir », « at Subway » → « au métro »).
// Avant la traduction, ces noms sont remplacés par des noms inventés que le modèle recopie tels
// quels ; ils sont remis en place après.
const NAME_WORDS = {
    fr: "Pierre Victoire Blanche Claire Constance Prudence Patience Ange Céleste Fleur Perle Reine Noël Grâce Aimé Aimée Désiré Désirée Fidèle Félicité Espérance Clémence Rose Violette Capucine Marguerite Olive Prune Cerise Mélodie Harmonie Aurore Océane Marine Ambre Jade Colombe Hermine Lune Étoile Constant Clément Modeste Sage Placide Fortuné Bienvenu Prosper Léger Lebrun Leblanc Lenoir Legrand Lefort Petit Grand Blanc Noir Roux Brun Boulanger Boucher Berger Charpentier Fournier Marchand Meunier Mercier Chevalier Bonnet Leroy Lemaire Masson Moulin Rivière Fontaine Lacroix Laforêt Lamy Bonhomme Lejeune Martin Pascal Lion Loup Renard Lapin Poisson Mouton Chasseur Pêcheur Lefèvre Faure Garnier Bertrand Roche Rocher Roy Duval Laporte Fabre Barbier Picard Legros Poulain Vacher Couturier Tailleur Messier Huet Paris",
    en: "Hope Joy Faith Grace Bill Mark Bob Frank Rose Lily Daisy Ivy Holly Iris Violet Poppy Sunny Dawn Eve Hunter Baker Smith Cook Mason Taylor Carter Hill Brown Green White Black King Young Rich Chance Destiny Harmony Melody Crystal Amber Ruby Pearl Jade Rusty Sandy Jack Nick Pat Sue Art Carol Drew Guy Ray Rob Rod Stone Wolf Fox Bird Lamb Wood Woods Rice Price Fields Rivers Banks Bush Cash Gates Jobs Page Bell Ford Cross Church Hall Lane Bishop Knight Porter Parker Miller Fisher Walker Butler Cooper Turner Glory Honor Liberty Patience Prudence Mercy Charity Trinity Heaven Angel Star Sky River Ocean Storm Rain Snow Robin Jay Wren Hawk Raven Dove Penny Hazel Willow Rowan Sage Marshall Hunt Wells Lake Marsh Moss Reed Field Brooks Peace Love Bliss Deacon Booker Archer Fletcher Sawyer Pierce Rocky Bud Buck Chip Lucky Max Spike Ace",
};
const BRAND_WORDS = "Orange Free Total Apple Fnac But Boulanger Casino Match Picard Sosh Teams Word Excel Outlook Office Edge Chrome Safari Windows Signal Notion Discord Steam Twitch Zoom Meta Slack Shell Target Subway Gap Visa Puma Jaguar Corona Uber Tinder Kindle Echo Alexa Siri Ring Nest Square Stripe Lime Bolt Lyft Monster Bounty Mars Dove Tide Amazon Oracle Mercury Galaxy Pixel Surface Switch Clio Twingo Mégane Captur Zoé Polo Golf Fiesta Panda Punto Yaris Corolla Civic Mustang Beetle Mini Smart Dacia Fiat Seat Kia Delta United Frontier Spirit Virgin Sun Gold Diesel Converse Vans Guess Coach Patagonia Uniqlo Chanel Mango Promod Celio Jules Kiabi Gifi Action Normal Lidl Aldi Leader Darty Conforama Castorama Truffaut Monoprix Auchan Carrefour Leclerc Intermarché Système Cora Vinted Leboncoin Doctolib Deezer Spotify Netflix Disney Canal Freebox Livebox Bbox Twitter Facebook Instagram WhatsApp Telegram Snapchat TikTok YouTube Google Microsoft Samsung Sony Nintendo Tesla Renault Peugeot Citroën";
const TITLES = "Mr\\.?|Mrs\\.?|Ms\\.?|Mx\\.?|Dr\\.?|Prof\\.?|M\\.|Mme|Mlle|Mmes|MM\\.|Monsieur|Madame|Mademoiselle|Messieurs|Docteur|Maître|Professeur|Sir|Lady|Lord|Miss|Uncle|Aunt|Oncle|Tante|Tonton|Tata|Papi|Mamie|Coach";
const PLACEHOLDERS = ["Zorvak", "Kelmira", "Dravenor", "Pelvator", "Quintarix", "Morvelan", "Tazurik", "Velkoran", "Brisvane", "Calvorn", "Nexildor", "Ombrevak", "Fendrask", "Silvarek", "Torvelin", "Grastovan", "Melkoriz", "Pendravix", "Kavorlin", "Zelmarok"];
const nameSets = {
    fr: new Set(NAME_WORDS.fr.split(" ")),
    en: new Set(NAME_WORDS.en.split(" ")),
    brands: new Set(BRAND_WORDS.split(" ")),
};
// Une marque en tête de phrase n'est un nom que si un verbe suit (« Orange a augmenté… »).
const BRAND_VERB = /^\s+(?:a|ont|est|sont|va|vient|propose|annonce|augmente|baisse|lance|offre|rachète|supprime|ferme|ouvre|recrute|licencie|has|have|is|are|was|were|announced|raised|launched|offers|bought|released|cut|closed|opened|hired|fired)\b/u;

function isSentenceStart(text, index) {
    const before = text.slice(0, index);
    return /^\s*$/.test(before) || /[.!?…:\n]\s*["«“(]?\s*$/.test(before);
}

export function maskNames(text, from) {
    const source = String(text ?? "");
    const spans = [];
    const add = (start, end) => {
        if (!spans.some((s) => start < s.end && end > s.start)) {
            spans.push({ start, end });
        }
    };
    // Après une civilité : « Mrs. Hope », « M. Boulanger », « Mme Petit ».
    const titled = new RegExp(`(?<![\\p{L}])(?:${TITLES})\\s+(\\p{Lu}[\\p{L}'’-]+)`, "gu");
    for (const m of source.matchAll(titled)) {
        // Vers le français, seulement les noms qui sont aussi des mots (« Mrs. Hope », « Mr. Baker »).
        if (from === "en" && !nameSets.en.has(m[1])) {
            continue;
        }
        const start = m.index + m[0].length - m[1].length;
        add(start, start + m[1].length);
    }
    // Prénoms et noms qui sont aussi des mots, marques : avec une majuscule.
    const names = nameSets[from] ?? new Set();
    for (const m of source.matchAll(/(?<![\p{L}\p{N}_'’-])\p{Lu}[\p{Ll}'’-]+(?![\p{L}\p{N}_])/gu)) {
        const word = m[0];
        const start = m.index;
        const atStart = isSentenceStart(source, start);
        const after = source.slice(start + word.length);
        const nextIsName = /^\s+(?:et|and|&)\s+\p{Lu}/u.test(after) || /^\s*,\s*\p{Lu}[\p{Ll}]+\s+(?:et|and)\s+\p{Lu}/u.test(after);
        // Nom composé (« White House », « Black Friday », « Bill Gates ») : le modèle le connaît.
        if (/^[  ]+\p{Lu}/u.test(after) || /\p{Lu}[\p{L}'’-]*[  ]+$/u.test(source.slice(0, start))) {
            continue;
        }
        // Vers le français, prudence : le modèle connaît la plupart des prénoms anglais. Seules les
        // marques après une préposition (« at Subway », « on Target ») sont cachées.
        if (from === "en") {
            if (nameSets.brands.has(word) && /(?:^|\s)(?:at|from|on|with|to|in|via|by)\s+$/i.test(source.slice(0, start))) {
                add(start, start + word.length);
            }
            continue;
        }
        if (names.has(word)) {
            // En tête de phrase, un mot anglais (« Hope you're well », « Will you… ») n'est un
            // prénom que devant « and Bob » ; en français, un prénom suivi d'un verbe aussi.
            if (atStart && !nextIsName && !(from === "fr" && /^\s+(?:a|est|va|vient|arrive|m['’]a|t['’]a|nous\s+a|dit|part|sera|était|avait|et|aussi|n['’]est|ne)\b/u.test(after))) {
                continue;
            }
            add(start, start + word.length);
        } else if (nameSets.brands.has(word)) {
            if (atStart && !BRAND_VERB.test(after)) {
                continue;
            }
            add(start, start + word.length);
        }
    }
    if (!spans.length) {
        return { text: source, restore: (out) => out };
    }
    const free = PLACEHOLDERS.filter((p) => !source.includes(p));
    const used = [];
    let out = "";
    let last = 0;
    for (const span of spans.sort((a, b) => a.start - b.start).slice(0, free.length)) {
        const placeholder = free[used.length];
        used.push({ placeholder, name: source.slice(span.start, span.end) });
        out += source.slice(last, span.start) + placeholder;
        last = span.end;
    }
    out += source.slice(last);
    const restore = (translated) => {
        let result = String(translated ?? "");
        for (const { placeholder, name } of used) {
            result = result.replace(new RegExp(placeholder, "giu"), name);
        }
        return result;
    };
    return { text: out, restore };
}

// --- Fonctions publiques ---

// Adresses, courriels, code, chemins, mentions et identifiants techniques du texte : recopiés tels
// quels pendant la traduction (le modèle abîme « https://exemple.fr/… » en « https://exampe.fr/… »).
const KEPT = /^(?:https?:\/\/|ftp:\/\/|www\.)|^`|^[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+\.|^(?:[A-Za-z]:\\|\\\\|~?\/|\.{1,2}\/)/u;

export function keptTerms(text) {
    const source = String(text ?? "");
    const terms = new Set();
    const spans = protectedSpans(source);
    // Seulement les zones les plus larges (l'adresse entière, pas ses morceaux).
    const widest = spans.filter((a) => !spans.some((b) => b !== a && b.start <= a.start && b.end >= a.end && (b.end - b.start) > (a.end - a.start)));
    for (const span of widest) {
        const term = source.slice(span.start, span.end).trim();
        // Adresses, courriels, code, chemins : le modèle les abîme. Les noms (iPhone, srv-web-02)
        // passent bien tels quels, et les entourer de marqueurs dégrade la phrase autour.
        if (term && term.length <= 300 && KEPT.test(term)) {
            terms.add(term);
        }
    }
    return [...terms].slice(0, 40);
}

export function rewriteSource(text, from) {
    const input = String(text ?? "");
    if (!input.trim()) {
        return input;
    }
    return outsideProtected(input, (part) => (from === "fr"
        ? applyRules(frSms(part), FR_RULES)
        : applyRules(enSms(part), EN_RULES)));
}

export function fixTarget(text, to, { source = "" } = {}) {
    const input = String(text ?? "");
    if (!input.trim()) {
        return input;
    }
    let fixed = outsideProtected(input, (part) => applyRules(part, to === "fr" ? FR_FIX : EN_FIX, { source }));
    // Tiret de dialogue ajouté par le modèle (« I'll pass. » → « - Non merci. »).
    if (/^\s*[-–—]\s/.test(fixed) && !/^\s*[-–—]/.test(source)) {
        fixed = fixed.replace(/^\s*[-–—]\s+/, "");
    }
    // Majuscule au début si le texte d'origine en avait une (« Let's play it by ear » → « improvisons »).
    if (/^\p{Lu}/u.test(source.trimStart()) && /^\p{Ll}/u.test(fixed.trimStart())) {
        fixed = fixed.replace(/^(\s*)(\p{Ll})/u, (m, space, letter) => space + letter.toUpperCase());
    }
    return to === "fr" ? frenchTypography(fixed) : englishTypography(fixed);
}
