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
function replaceWords(text, table, { skipUpper = new Set(), acronyms = new Set() } = {}) {
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
        if (acronyms.has(match) || /^I\b/.test(value)) {
            return value;
        }
        return keepCase(value, match);
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
    // Ajouts du 06/11/2026.
    "2m1": "demain", "2main": "demain", dem1: "demain", dmain: "demain", a2m1: "à demain", "@2m1": "à demain",
    jte: "je te", jme: "je me", jle: "je le", jla: "je la", jles: "je les", jcrois: "je crois", jpense: "je pense",
    jfais: "je fais", jsui: "je suis", jss: "je suis", jvx: "je veux", jpe: "je peux", jtd: "je t'adore",
    "j'm'en": "je m'en", jmen: "je m'en", "j'men": "je m'en",
    askip: "apparemment", asquip: "apparemment", rapel: "rappelle", rapl: "rappelle",
    pa: "pas", ke: "que", tro: "trop", bi1: "bien", ri1: "rien", koa: "quoi", jamé: "jamais", cmt: "comment",
    cmb: "combien", vla: "voilà", ui: "oui", nn: "non", ouai: "oui", wai: "oui", dacc: "d'accord", dak: "d'accord",
    "d'acc": "d'accord", tfk: "tu fais quoi", tfq: "tu fais quoi", kestu: "qu'est-ce que tu", keskon: "qu'est-ce qu'on",
    bsx: "bisous", tmtc: "toi-même tu sais", oklm: "tranquille", ct: "c'était", gt: "j'étais", ojd: "aujourd'hui",
    num: "numéro", chépa: "je ne sais pas", "chais pas": "je ne sais pas", cad: "c'est-à-dire", pti: "petit",
    reveillé: "réveillé", reveillée: "réveillée", pr: "pour",
    mrc: "merci", mrci: "merci", bne: "bonne", jcp: "je ne sais pas", frr: "frère", dc: "donc", srx: "sérieux",
    jgère: "je gère", jgere: "je gère", jkiffe: "j'adore", jdois: "je dois", jpars: "je pars", jsors: "je sors",
    jregarde: "je regarde", jtrouve: "je trouve", jcomprends: "je comprends", jattend: "j'attends",
    grv: "grave", vrm: "vraiment", tte: "toute", ttes: "toutes", ac: "avec",
};
// Ces formes en capitales sont des sigles (« PR », « UI », « CT », « Pr Dupont ») : elles restent.
const FR_SKIP_UPPER = new Set(["PR", "Pr", "UI", "CT", "GT", "NN", "PA", "Pa", "NUM", "Num", "KE", "CAD", "Cad", "TPS", "AC", "DC", "TTE"]);

// Argot et verlan → mot courant (« reup » → « père », « keufs » → « flics », « chanmé » → « incroyable »).
const FR_ARGOT = {
    reup: "père", daron: "père", daronne: "mère", darons: "parents", daronnes: "mères", reum: "mère", reuf: "frère",
    reus: "sœur", keuf: "flic", keufs: "flics", meuf: "fille", meufs: "filles", keum: "mec", keums: "mecs",
    vénère: "furieux", vénères: "furieux", vener: "furieux", venere: "furieux", chanmé: "incroyable", chanmée: "incroyable",
    chanmés: "incroyables", teuf: "fête", teufs: "fêtes", chelou: "bizarre", chelous: "bizarres", zarbi: "bizarre",
    teubé: "débile", teubée: "débile", teubés: "débiles", céfran: "français", bouquin: "livre", bouquins: "livres",
    fringues: "vêtements", clope: "cigarette", clopes: "cigarettes", toubib: "médecin", toubibs: "médecins",
    frangin: "frère", frangine: "sœur", frangins: "frères", frangines: "sœurs", bagnole: "voiture", bagnoles: "voitures",
    zonzon: "prison", taule: "prison", piaule: "chambre", gosse: "enfant", gosses: "enfants", môme: "enfant", mômes: "enfants",
    pote: "ami", potes: "amis", bolos: "loser", boloss: "loser", tocard: "loser", tocarde: "loser", tocards: "losers",
    flemmard: "paresseux", flemmarde: "paresseuse", flemmards: "paresseux", pompette: "un peu ivre",
    fric: "argent", pognon: "argent", flouze: "argent", bosser: "travailler",
    barjot: "fou", barjo: "fou", maboul: "fou", zinzin: "fou", fayot: "flatteur", fayote: "flatteuse", fayots: "flatteurs",
    baltringue: "loser", baltringues: "losers", pouffiasse: "pétasse", glandeur: "fainéant", glandeuse: "fainéante",
    dar: "génial", magouille: "manœuvre malhonnête", magouilles: "manœuvres malhonnêtes", bosse: "travaille", bosses: "travailles", bossé: "travaillé", bossent: "travaillent",
    bossait: "travaillait", bossais: "travaillais", bossez: "travaillez", bossons: "travaillons",
};

function frSms(text) {
    const sms = replaceWords(text, FR_SMS, { skipUpper: FR_SKIP_UPPER })
        // « ma meuf » : ma copine (pas « ma fille ») ; « le fric » : l'argent.
        .replace(/(?<![\p{L}])(ma|ta|sa|leur|notre|votre)\s+meuf(?![\p{L}])/giu, "$1 copine")
        .replace(/(?<![\p{L}])(le|du)\s+(?:fric|pognon|flouze)(?![\p{L}])/giu, (m, det) => (det.toLowerCase() === "le" ? keepCase("l'argent", m) : keepCase("de l'argent", m)))
        .replace(/(?<![\p{L}])(de|pas\s+de|plus\s+de|beaucoup\s+de|trop\s+de|plein\s+de|assez\s+de|un\s+max\s+de|des\s+tas\s+de)\s+(?:fric|pognon|flouze|thunes?)(?![\p{L}])/giu, (m, det) => `${det.replace(/de$/i, "")}d'argent`)
        .replace(/(?<![\p{L}])(pas|plus|jamais)\s+(?:une|un)\s+(?:thune|rond|radis|kopeck|balle)(?![\p{L}])/giu, (m, neg) => (/^plus$/i.test(neg) ? keepCase("plus d'argent", m) : `${neg} un centime`))
        .replace(/(?<![\p{L}])(?:la|de\s+la|des)\s+thunes?(?![\p{L}])/giu, (m) => keepCase(/^d/i.test(m) ? "de l'argent" : "l'argent", m));
    return replaceWords(sms, FR_ARGOT)
        // « une bosse », « la bosse » : le nom reste (seul le verbe « bosser » est de l'argot).
        .replace(/(?<![\p{L}])(une|la|ma|sa|ta|des|les|grosse|petite)\s+travaille(s?)(?![\p{L}])/giu, (m, det, s) => `${det} bosse${s}`)
        // « dans » : « ds le train » (pas le « DS » de maths, en capitales, ni « le ds de »).
        .replace(new RegExp(`${S}ds(?=\\s+(?:le|la|les|l['’]|un|une|des|mon|ma|mes|ton|ta|tes|son|sa|ses|ce|cette|ces|notre|votre|leur|\\d+|deux|trois|cinq|dix|quelques)${E})`, "gu"), "dans")
        // « o courant », « o ciné » : au.
        .replace(new RegExp(`${S}o(?=\\s+(?:courant|ciné|cinéma|resto|restaurant|lit|boulot|travail|bureau|parc|téléphone|tel)${E})`, "giu"), (m) => keepCase("au", m))
        // « + tard » : plus tard.
        .replace(/(?<![\p{L}\p{N}])\+\s*(?=tard(?![\p{L}]))/gu, "plus ")
        // « 14,40 € TTC » : toutes taxes comprises (le modèle laisse « TTC »).
        .replace(/(?<=\d[\s  ]?(?:€|euros?)?[\s  ]?)TTC(?![\p{L}])/gu, "toutes taxes comprises")
        .replace(/(?<=\d[\s  ]?(?:€|euros?)?[\s  ]?)HT(?![\p{L}])/gu, "hors taxes")
        // « 3 000 milliards » : « 3 billions » (le modèle s'embrouille dans les milliers de milliards).
        .replace(/(?<![\p{N}.,]|\p{N}[\s  ])(\d{1,3})[\s  ]000[\s  ]+milliards(?![\p{L}])/gu, "$1 billions")
        // « t réveillé ? », « t où ? » : tu es.
        .replace(new RegExp(`${S}t\\s+(?=(?:réveillée?|levée?|couchée?|là|où|ou|sûre?|sur|chaude?|dispo|prête?|occupée?|malade|fatiguée?|sérieuse?|serieuse?|fou|folle|nul|nulle|grave|en\\s+retard|chez|rentrée?|partie?|arrivée?|libre|seule?|contente?|sortie?|dehors|debout|vivante?|morte?|énervée?|fâchée?)${E})`, "giu"), (m) => keepCase("tu es ", m))
        // « la semaine pro » : prochaine.
        .replace(new RegExp(`${S}(semaine|fois|année|session|saison|rentrée|réunion|mois|week-end|weekend)\\s+pro(?=\\s*(?:[,.!?;]|$)|\\s+(?:on|je|j['’]|tu|il|elle|ça|ca|nous|vous)${E})`, "giu"), (m, noun) => `${noun} ${/^(?:mois|week-?end)$/i.test(noun) ? "prochain" : "prochaine"}`)
        // « il y'a » (faute courante) : il y a, sans doubler le « il ».
        .replace(/(?<![\p{L}])il\s+il\s+y\s+a(?![\p{L}])/giu, (m) => keepCase("il y a", m))
        // « cc » de salutation, en tête de message (le « cc » d'un courriel reste).
        .replace(/^(\s*)cc(?=\s*[,!]|\s+(?:toi|vous|tout|ça|ca|cv|les|à|a)\b)/giu, (m, space) => `${space}${keepCase("coucou", m.trim())}`)
        // « c bon », « c pas grave » : c'est.
        .replace(new RegExp(`${S}c(?=\\s+(?:pas|bon|bien|nul|cool|top|super|grave|vrai|faux|sûr|moi|toi|lui|elle|nous|vous|eux|ça|ca|la|le|les|un|une|trop|vraiment|juste|fini|mort|ouf|quoi|qui|quand|comment|pour|parce|normal|génial|dommage|chiant|marrant|possible|réglé|prêt|parti|ok|clair|pareil|chaud|cher|loin|tard|tôt|nickel|mieux|pire|sympa|relou|chelou|bizarre|énorme|incroyable|magnifique|horrible|dur|facile|simple|compliqué)${E})`, "giu"), (m) => keepCase("c'est", m))
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
const ETRE_AVOIR = { suis: "ai", es: "as", est: "a", sommes: "avons", êtes: "avez", sont: "ont", étais: "avais", était: "avait", étions: "avions", étiez: "aviez", étaient: "avaient", serai: "aurai", seras: "auras", sera: "aura", serons: "aurons", serez: "aurez", seront: "auront", serais: "aurais", serait: "aurait", être: "avoir", été: "eu" };
// Début de mot, ou juste après « j' » (« j'ai le trac »).
const SJ = "(?:(?<![\\p{L}\\p{N}_'’-])|(?<=(?<![\\p{L}\\p{N}_])j['’]))";
// « (j')ai / a / ont… » et « (j')étais / est… » devant une expression ; le « j' » est capturé à part.
const AVOIR_J = `(?:${S}(j)['’]\\s*|${S})(${AVOIR})`;
const ETRE_J = `(?:${S}(j)['’]\\s*|${S})(${ETRE})`;
// Adverbe facultatif entre le verbe et l'expression (« il a toujours le trac »).
const ADV = "(\\s+(?:toujours|souvent|parfois|encore|déjà|vraiment|carrément|complètement|totalement|un\\s+peu|tellement|trop|grave))?";
// « il a toujours le trac » → « il est toujours très nerveux » (avoir + expression → être + adjectif).
const asEtre = (adjective) => (match, j, verb, adverb) => `${j ? "je " : ""}${AVOIR_ETRE[verb.toLowerCase()] ?? verb}${adverb ?? ""} ${adjective}`;
// « il était dans la lune » → « il avait la tête dans les nuages » (être + expression → avoir + nom).
const asAvoir = (object, { keepAdverb = true } = {}) => (match, j, verb, adverb) => `${j ? "j'" : ""}${ETRE_AVOIR[verb.toLowerCase()] ?? verb}${keepAdverb && /toujours|souvent|parfois|encore|déjà/i.test(adverb ?? "") ? adverb : ""} ${object}`;
// Conjugaison d'après le sujet : forms = [je, tu, il, nous, vous, ils].
const PERSON = { je: 0, j: 0, tu: 1, il: 2, elle: 2, on: 2, nous: 3, vous: 4, ils: 5, elles: 5 };
const bySubject = (subject, forms) => forms[PERSON[String(subject).toLowerCase().replace(/['’]$/, "")] ?? 2];
// Pronom complément avant « a », « ont » : « lui a » → « l'a », « leur a » → « les a ».
const objectPronoun = (who) => ({ lui: "l'", leur: "les " })[who.toLowerCase()] ?? (/['’]$/.test(who) ? who : `${who} `);
const FR_HOURS = { une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, "dix-sept": 17, "dix-huit": 18, "dix-neuf": 19, vingt: 20, "vingt-deux": 22, "vingt-trois": 23, midi: 12, minuit: 0 };
const FR_HOUR_WORDS = "midi|minuit|\\d{1,2}|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix-sept|dix-huit|dix-neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt-deux|vingt-trois|vingt";
const FR_MINUTES = { "et quart": 15, "et demie": 30, "et demi": 30, "moins le quart": -15, "moins cinq": -5, "moins dix": -10, "moins vingt": -20, "moins vingt-cinq": -25 };
// « six heures moins dix » → « 5:50 », « midi et demi » → « 12:30 ».
function frenchClock(match, h, minutes) {
    const word = h.toLowerCase();
    const base = FR_HOURS[word] ?? Number(word);
    const delta = FR_MINUTES[minutes.toLowerCase().replace(/\s+/g, " ")];
    if (!Number.isFinite(base) || base > 23 || delta === undefined) {
        return match;
    }
    let hourValue = delta < 0 ? base - 1 : base;
    if (hourValue < 0) {
        hourValue = 23;
    }
    if (hourValue === 0 && word !== "minuit") {
        hourValue = 12;
    }
    const minute = delta < 0 ? 60 + delta : delta;
    return `${hourValue}:${String(minute).padStart(2, "0")}`;
}

const FR_RULES = compile([
    // --- Expressions figées et proverbes (06/11/2026). Chaque expression devient une tournure
    // simple, ou l'expression anglaise équivalente mot à mot, que le modèle traduit alors bien
    // (« quand les poules auront des dents » → « quand les cochons voleront » → « when pigs fly »).
    [`${S}quand\\s+les\\s+poules\\s+auront\\s+des\\s+dents${E}`, "quand les cochons voleront"],
    [`${S}(revenons|revenir|reviens|revenez|retournons|on\\s+revient|je\\s+reviens|j['’]en\\s+reviens)\\s+à\\s+nos\\s+moutons${E}`, "$1 au sujet"],
    [`${S}(mettre|mette|mettes|mettent|met|mets|mettez|mis|mise|mettait|mettais|mettaient)\\s+(son|ton|mon|leur|votre|notre)\\s+grain\\s+de\\s+sel${E}`, (m, verb, pos) => `${verb} ${({ son: "ses", ton: "tes", mon: "mes", leur: "leurs", votre: "vos", notre: "nos" })[pos.toLowerCase()]} deux centimes`],
    [`${AVOIR_J}${ADV}\\s+le\\s+c(?:œ|oe)ur\\s+sur\\s+la\\s+main${E}`, asEtre("très généreux")],
    [`${AVOIR_J}${ADV}\\s+le\\s+c(?:œ|oe)ur\\s+gros${E}`, asEtre("très triste")],
    [`${S}(me|te|se|nous|vous)\\s+(mets|met|mettent|mettez|mettons|mettre|mettais|mettait|suis\\s+mis|es\\s+mis|est\\s+mis|sont\\s+mis)\\s+(?:complètement\\s+)?le\\s+doigt\\s+dans\\s+l['’](?:œ|oe)il(?:\\s+jusqu['’]au\\s+coude)?${E}`, (m, pronoun, verb) => `${pronoun} ${({ mets: "fais", met: "fait", mettent: "font", mettez: "faites", mettons: "faisons", mettre: "faire", mettais: "faisais", mettait: "faisait" })[verb.toLowerCase()] ?? verb.replace(/mis$/i, "fait")} des illusions`],
    [`${SJ}(a|ai|as|avons|avez|ont|avait|avais|avaient|avoir)\\s+((?:vraiment|carrément|complètement|un\\s+peu)\\s+)?(?:pris|attrapé|chopé)\\s+le\\s+melon${E}`, "$1 $2la grosse tête"],
    [`${SJ}(${AVOIR}|avoir)\\s+((?:vraiment|carrément|un\\s+peu)\\s+)?(?:le\\s+melon|les\\s+chevilles\\s+qui\\s+enflent|la\\s+tête\\s+qui\\s+enfle)${E}`, "$1 $2la grosse tête"],
    // Seulement en attribut (« il est un peu soupe au lait ») : « faire de la soupe au lait » est un plat.
    [`(?<=(?:est|es|suis|sont|était|étais|sera|devient|reste)\\s+(?:un\\s+peu\\s+|très\\s+|assez\\s+|vraiment\\s+|super\\s+|trop\\s+|plutôt\\s+)?)soupe\\s+au\\s+lait${E}`, "irritable"],
    [`${S}(?:il\\s+)?(?:n['’])?y\\s+a\\s+pas\\s+de\\s+quoi\\s+fouetter\\s+un\\s+chat${E}`, "il n'y a pas de quoi s'inquiéter"],
    [`${S}pas\\s+de\\s+quoi\\s+fouetter\\s+un\\s+chat${E}`, "pas de quoi s'inquiéter"],
    [`(?<=${S}(?:une|la|des|les|cette|ma|ta|sa|petite|grosse|légère|simple)\\s+(?:petite\\s+|grosse\\s+|légère\\s+|simple\\s+)?)rayure(s?)(?=\\s*(?:[,.!?]|$)|\\s+(?:sur|à|au|aux|dans)${E})`, "égratignure$1"],
    [`${S}ray(é|ée|és|ées|er|e|es|ent|ait|aient)\\s+(?=(?:ma|ta|sa|la|notre|votre|leur|mon|ton|son|le|les|mes|tes|ses)\\s+(?:voiture|caisse|portière|carrosserie|écran|téléphone|portable|lunettes|disque|parquet|table|capot|peinture|vélo|moto|smartphone)|l['’](?:écran|ordinateur|iPhone))`, "égratign$1 "],
    [`${S}(coupons|coupez|couper|coupe|coupes|coupent|coupé)\\s+la\\s+poire\\s+en\\s+deux${E}`, (m, verb) => `${verb.toLowerCase().replace(/^coup/, "partag").replace(/^partago/, "partageo")} la différence`],
    [`${S}(m['’]|t['’]|lui|nous|vous|leur)\\s*(a|as|ont|avait|avaient|avez|ai)\\s+passé\\s+un\\s+(?:sacré\\s+|bon\\s+|de\\s+ces\\s+|gros\\s+|vrai\\s+)?savon${E}`, (m, who, aux) => `${objectPronoun(who)}${aux} engueulé`],
    [`${S}(me|m['’]|te|t['’]|se|s['’])\\s*(suis|es|est|sommes|êtes|sont)\\s+fait\\s+passer\\s+un\\s+(?:sacré\\s+|bon\\s+|gros\\s+)?savon${E}`, (m, who, aux) => `${who}${/['’]$/.test(who) ? "" : " "}${aux} fait engueuler`],
    [`${S}(se\\s+)?faire\\s+passer\\s+un\\s+(?:sacré\\s+|bon\\s+|gros\\s+)?savon${E}`, "$1faire engueuler"],
    [`${S}(lui|leur)\\s+tirer\\s+les\\s+vers\\s+du\\s+nez${E}`, (m, who) => (who.toLowerCase() === "lui" ? "le faire parler" : "les faire parler")],
    [`${S}(lui|leur)\\s+(ai|as|a|avons|avez|ont)\\s+tiré\\s+les\\s+vers\\s+du\\s+nez${E}`, (m, who, aux) => `${objectPronoun(who)}${aux} fait parler`],
    [`${S}(?:ne\\s+)?(te|vous)\\s+(?:fais|faites|fait)\\s+pas\\s+(?:de\\s+|trop\\s+de\\s+)?(?:mouron|bile)${E}`, (m, who) => (who.toLowerCase() === "te" ? "ne t'inquiète pas" : "ne vous inquiétez pas")],
    [`${S}(je|tu|il|elle|on|nous|vous|ils|elles)\\s+(?:me|te|se|nous|vous)\\s+(?:fais|fait|faisons|faites|font)\\s+du\\s+(?:mouron|bile|souci)${E}`, (m, who) => `${who} ${bySubject(who, ["m'inquiète", "t'inquiètes", "s'inquiète", "nous inquiétons", "vous inquiétez", "s'inquiètent"])}`],
    [`${S}(cherch\\p{L}*)((?:\\s+(?:toujours|sans\\s+arrêt|encore|tout\\s+le\\s+temps))?)\\s+la\\s+petite\\s+bête${E}`, "$1$2 des défauts"],
    [`${S}(je|tu|il|elle|on|nous|vous|ils|elles)\\s+(?:prends|prend|prenons|prenez|prennent)((?:\\s+(?:toujours|souvent|vite|facilement|tout\\s+de\\s+suite))?)\\s+la\\s+mouche${E}`, (m, who, adv) => `${who} ${bySubject(who, ["m'énerve", "t'énerves", "s'énerve", "nous énervons", "vous énervez", "s'énervent"])}${adv}`],
    [`(?<=${SJ}(?:ai|as|a|avons|avez|ont|avait|avais|aura|aurai)\\s+)fait\\s+d['’]une\\s+pierre\\s+deux\\s+coups${E}`, "tué deux oiseaux avec une pierre"],
    [`${S}(faire|fais|fait|faites|faisons|font)\\s+d['’]une\\s+pierre\\s+deux\\s+coups${E}`, (m, verb) => `${({ faire: "tuer", fais: "tue", fait: "tue", faites: "tuez", faisons: "tuons", font: "tuent" })[verb.toLowerCase()]} deux oiseaux avec une pierre`],
    [`${S}les\\s+doigts\\s+dans\\s+le\\s+nez${E}`, "très facilement"],
    [`${S}fauch(é|ée|és|ées)\\s+comme\\s+(?:les\\s+blés|un\\s+rat|les\\s+blé)${E}`, "complètement fauch$1"],
    [`${S}(m['’]|t['’]|lui|nous|vous|leur)\\s*(a|ont|avait|avaient|as|ai)\\s+mis\\s+la\\s+puce\\s+à\\s+l['’]oreille${E}`, (m, who, aux) => `${objectPronoun(who)}${aux} rendu méfiant`],
    [`${S}mettre\\s+la\\s+puce\\s+à\\s+l['’]oreille${E}`, "rendre méfiant"],
    [`${S}les\\s+carottes\\s+sont\\s+cuites${E}`, "c'est terminé"],
    [`${S}(?:le|ce)\\s+délai\\s+(?:est|a\\s+été)\\s+dépassé${E}`, "la date limite est passée"],
    [`${S}(?:ça|ca|cela)\\s+ne\\s+mange\\s+pas\\s+de\\s+pain${E}`, "ça ne fait pas de mal"],
    [`${S}(saut\\p{L}*)\\s+du\\s+coq\\s+à\\s+l['’]âne${E}`, (m, verb) => `${verb.toLowerCase().replace(/^saut/, "chang").replace(/^chang(?=[aoâ])/, "change")} de sujet sans arrêt`],
    [`${S}je\\s+ne\\s+(te|vous)\\s+suis\\s+(?:plus|pas)(?=\\s*(?:[,.!?]|$)|\\s+(?:du\\s+tout|là)${E})`, (m, who) => (who.toLowerCase() === "te" ? "tu m'as perdu" : "vous m'avez perdu")],
    [`${S}(m['’]|t['’]|lui|nous|vous|leur)\\s*(a|ont|avait|avaient|as|ai)\\s+tenu\\s+la\\s+jambe${E}`, (m, who, aux) => `${objectPronoun(who)}${aux} retenu à bavarder`],
    [`${S}(me|te|lui|nous|vous|leur)\\s+(tient|tiens|tiennent|tenait|tenaient)\\s+la\\s+jambe${E}`, (m, who, verb) => `${({ lui: "le", leur: "les" })[who.toLowerCase()] ?? who} re${verb.toLowerCase()} à bavarder`],
    [`${AVOIR_J}\\s+pété\\s+(?:un\\s+câble|les\\s+plombs|une\\s+durite|un\\s+boulon|un\\s+plomb|une\\s+pile)${E}`, (m, j, aux) => `${j ? "je " : ""}${AVOIR_ETRE[aux.toLowerCase()]} devenu fou`],
    [`${S}(pète|pètes|pètent|péter|pétait|pétais|pétaient|pétera)\\s+(?:un\\s+câble|les\\s+plombs|une\\s+durite|un\\s+boulon|un\\s+plomb|une\\s+pile)${E}`, (m, verb) => ({ pète: "devient fou", pètes: "deviens fou", pètent: "deviennent fous", péter: "devenir fou", pétait: "devenait fou", pétais: "devenais fou", pétaient: "devenaient fous", pétera: "deviendra fou" })[verb.toLowerCase()]],
    [`${S}(je|tu|il|elle|on|nous|vous|ils|elles)\\s+((?:me|m['’]|te|t['’]|lui|nous|vous|leur)\\s*)?(?:fais|fait|faisons|faites|font)\\s+la\\s+(?:tête|gueule)(?!\\s+(?:de|d['’]|du|des|à)${E})${E}`, (m, who, obj) => `${who} ${obj ? `${({ lui: "le", leur: "les" })[obj.trim().toLowerCase()] ?? obj.trim()} ` : ""}${bySubject(who, ["boude", "boudes", "boude", "boudons", "boudez", "boudent"])}`],
    [`${S}(?:faisais|faisait|faisions|faisiez|faisaient)\\s+la\\s+(?:tête|gueule)(?!\\s+(?:de|d['’]|du|des|à)${E})${E}`, (m) => m.toLowerCase().replace(/^fais/, "boud").replace(/\s+la\s+(?:tête|gueule)$/, "")],
    [`${S}(faire|a\\s+fait|ai\\s+fait|as\\s+fait|ont\\s+fait)\\s+la\\s+(?:tête|gueule)(?!\\s+(?:de|d['’]|du|des|à)${E})${E}`, (m, verb) => (/^faire$/i.test(verb) ? "bouder" : `${verb.split(/\s+/)[0]} boudé`)],
    [`${AVOIR_J}${ADV}\\s+le\\s+trac${E}`, asEtre("très nerveux")],
    [`${S}avoir\\s+le\\s+trac${E}`, "être très nerveux"],
    [`${S}(?:(je)\\s+)?(tire|tires|tirent|tirez|tirons|tirer|tirait|tirais|tiraient|tiré)\\s+le\\s+diable\\s+par\\s+la\\s+queue${E}`, (m, je, verb) => `${je ? "j'ai" : ({ tire: "a", tires: "as", tirent: "ont", tirez: "avez", tirons: "avons", tirer: "avoir", tirait: "avait", tirais: "avais", tiraient: "avaient", tiré: "eu" })[verb.toLowerCase()]} du mal à joindre les deux bouts`],
    [`${S}(?:(je)\\s+)?(roule|roules|roulent|roulez|roulons|rouler|roulait|roulais|roulaient)\\s+sur\\s+l['’]or${E}`, (m, je, verb) => `${je ? "je suis" : ({ roule: "est", roules: "es", roulent: "sont", roulez: "êtes", roulons: "sommes", rouler: "être", roulait: "était", roulais: "étais", roulaient: "étaient" })[verb.toLowerCase()]} très riche`],
    [`${S}(?:je\\s+)?n['’]en\\s+(?:mettrais|mettrai|mets|mettrait|mettrions)\\s+pas\\s+(?:ma|la)\\s+main\\s+(?:au\\s+feu|à\\s+couper)${E}`, "je ne le jurerais pas"],
    [`${S}(?:j['’])?en\\s+(?:mettrais|mettrai|mets|mettrait)\\s+(?:ma|la)\\s+main\\s+(?:au\\s+feu|à\\s+couper)${E}`, "j'en suis absolument certain"],
    [`${AVOIR_J}${ADV}\\s+(?:un\\s+)?(?:petit\\s+|bon\\s+|sacré\\s+)?(?:verre|coup)\\s+dans\\s+le\\s+nez${E}`, asEtre("un peu ivre")],
    [`${S}(me|te|se|nous|vous)\\s+(noyer|noie|noies|noient|noyez|noyons|noyait|noyais)\\s+dans\\s+un\\s+verre\\s+d['’]eau${E}`, (m, who, verb) => `${({ me: "m'", te: "t'", se: "s'" })[who.toLowerCase()] ?? `${who} `}${({ noyer: "affoler", noie: "affole", noies: "affoles", noient: "affolent", noyez: "affolez", noyons: "affolons", noyait: "affolait", noyais: "affolais" })[verb.toLowerCase()]} pour un rien`],
    [`${S}(levée?s?|lever|lève|lèves|lèvent|levait|levais)\\s+du\\s+pied\\s+gauche${E}`, "$1 du mauvais pied"],
    [`${S}n['’]y\\s+(suis|es|est|sommes|êtes|sont|était|étais|étaient)\\s+pas\\s+all(é|ée|és|ées)\\s+par\\s+quatre\\s+chemins${E}`, "$1 all$2 droit au but"],
    [`${S}n['’]y\\s+(va|vais|vas|vont|allons|allez|allait|allais|allaient|ira|irai)\\s+pas\\s+par\\s+quatre\\s+chemins${E}`, "$1 droit au but"],
    [`${S}sans\\s+(?:y\\s+)?aller\\s+par\\s+quatre\\s+chemins${E}`, "sans détour"],
    [`${ETRE_J}${ADV}\\s+dans\\s+la\\s+lune${E}`, asAvoir("la tête dans les nuages")],
    [`(?<=${SJ}(?:ai|as|a|avons|avez|ont|avait|avais|avaient|aura|aurai|aurons)\\s+)fait\\s+(?:la\\s+)?grasse\\s+mat(?:inée)?${E}`, "dormi tard"],
    [`${S}(faire|fais|fait|faites|faisons|font|faisait|faisais|faisaient|ferai|fera|ferons)\\s+(?:la\\s+)?grasse\\s+mat(?:inée)?${E}`, (m, verb) => `${({ faire: "dormir", fais: "dors", fait: "dort", faites: "dormez", faisons: "dormons", font: "dorment", faisait: "dormait", faisais: "dormais", faisaient: "dormaient", ferai: "dormirai", fera: "dormira", ferons: "dormirons" })[verb.toLowerCase()]} tard`],
    [`${S}(je|tu|il|elle|on|nous|vous|ils|elles)\\s+(?:ne\\s+|n['’])?(suis|es|est|sommes|êtes|sont|étais|était|étions|étiez|étaient)\\s+pas\\s+(?:très\\s+|vraiment\\s+|trop\\s+)?dans\\s+(?:mon|ton|son|notre|votre|leur|leurs|mes|tes|ses|nos|vos)\\s+assiettes?${E}`, (m, who, verb) => `${who} ${/^ét/i.test(verb) ? bySubject(who, ["ne me sentais", "ne te sentais", "ne se sentait", "ne nous sentions", "ne vous sentiez", "ne se sentaient"]) : bySubject(who, ["ne me sens", "ne te sens", "ne se sent", "ne nous sentons", "ne vous sentez", "ne se sentent"])} pas bien`],
    [`${S}j['’](?:étais|étai)\\s+pas\\s+dans\\s+mon\\s+assiette${E}`, "je ne me sentais pas bien"],
    [`${S}(racont\\p{L}*)\\s+(?:des|de\\s+ces)\\s+(?:salades|bobards|craques|histoires\\s+à\\s+dormir\\s+debout)${E}`, "$1 des mensonges"],
    [`${AVOIR_J}${ADV}\\s+un\\s+(?:sacré\\s+|gros\\s+)?poil\\s+dans\\s+la\\s+main${E}`, asEtre("très paresseux")],
    [`${S}(fait|fais|faites|font|faire|faisait|faisais)\\s+la\\s+sourde\\s+oreille${E}`, "$1 semblant de ne pas entendre"],
    [`${AVOIR_J}${ADV}\\s+la\\s+tête\\s+dans\\s+le\\s+guidon${E}`, asEtre("débordé de travail")],
    [`${S}(mettre|mets|met|mettez|mettons|mettent|mis)\\s+la\\s+charrue\\s+avant\\s+les\\s+b(?:œ|oe)ufs${E}`, "$1 la charrette avant le cheval"],
    [`${S}(mis|mise|mises|mettre|met|mets)\\s+sur\\s+(?:son|mon|ton|leur|notre|votre)\\s+trente(?:-|\\s+)et(?:-|\\s+)un${E}`, (m, verb) => `${({ mis: "habillé", mise: "habillée", mises: "habillées", mettre: "habiller", met: "habille", mets: "habille" })[verb.toLowerCase()]} très élégamment`],
    [`${S}sur\\s+(?:son|mon|ton|leur|notre|votre)\\s+trente(?:-|\\s+)et(?:-|\\s+)un${E}`, "très bien habillé"],
    [`${S}(mettre|mets|met|mettez|mettons|mettent|mis)\\s+de\\s+l['’]eau\\s+dans\\s+(?:son|mon|ton|notre|votre|leur)\\s+vin${E}`, (m, verb) => `${({ mettre: "faire", mets: "fais", met: "fait", mettez: "faites", mettons: "faisons", mettent: "font", mis: "fait" })[verb.toLowerCase()]} des compromis`],
    [`${S}(?:ça|ca|cela)\\s+(?:coule\\s+de\\s+source|saute\\s+aux\\s+yeux|tombe\\s+sous\\s+le\\s+sens)${E}`, "c'est évident"],
    [`${S}(?:une\\s+)?(?:vraie\\s+|sacrée\\s+)?langue\\s+de\\s+vipère${E}`, "une vraie commère"],
    [`${AVOIR_J}${ADV}\\s+la\\s+langue\\s+bien\\s+pendue${E}`, asEtre("très bavard")],
    [`${S}n['’](a|ai|as|ont|avait|avez|avons)\\s+pas\\s+froid\\s+aux\\s+yeux${E}`, (m, aux) => `${AVOIR_ETRE[aux.toLowerCase()]} très audacieux`],
    [`${S}(?:ça|ca|cela)\\s+(me|m['’]|te|t['’]|nous|vous)\\s*(?:donne|a\\s+donné|fait|a\\s+fait)\\s+froid\\s+dans\\s+le\\s+dos${E}`, (m, who) => `ça ${({ "m'": "me", "m’": "me", "t'": "te", "t’": "te" })[who.toLowerCase()] ?? who} donne des frissons`],
    [`${S}(fait|fais|faites|font|faire|faisait)(\\s+(?:pas|plus|jamais))?\\s+la\\s+fine\\s+bouche${E}`, "$1$2 le difficile"],
    [`${S}(?:ne\\s+)?(fais|faites)\\s+pas\\s+la\\s+(?:tête|gueule)${E}`, (m, verb) => (/ites$/i.test(verb) ? "ne boudez pas" : "ne boude pas")],
    [`${S}(vendu|vendre|vend|vends|vendent|vendez)\\s+la\\s+mèche${E}`, (m, verb) => `${({ vendu: "révélé", vendre: "révéler", vend: "révèle", vends: "révèles", vendent: "révèlent", vendez: "révélez" })[verb.toLowerCase()]} le secret`],
    [`${S}(?:se\\s+)?(fait|font|fais|faire|faisons)\\s+la\\s+bise${E}`, (m, verb) => `${/^se/i.test(m) ? "s'" : ""}${({ fait: "embrasse", font: "embrassent", fais: "embrasse", faire: "embrasser", faisons: "embrassons" })[verb.toLowerCase()]} sur la joue`],
    [`(?<=${S}(?:on|nous|je|tu|vous|ils|elles|il|elle)\\s+(?:se\\s+|nous\\s+|vous\\s+)?)(fait|fais|faisons|faites|font|ferai|fera|ferons|ferez|feront)\\s+le\\s+pont(?=\\s+(?:en|ce|du|de|pour|le|à)${E}|\\s*[,.!?]|\\s*$)`, (m, verb) => `${({ fait: "prend", fais: "prends", faisons: "prenons", faites: "prenez", font: "prennent", ferai: "prendrai", fera: "prendra", ferons: "prendrons", ferez: "prendrez", feront: "prendront" })[verb.toLowerCase()]} un long week-end`],
    [`(${PERSON_ETRE}${ADVERBS}\\s+)à\\s+l['’]ouest(?!\\s+(?:de|du|des|d['’])${E})${E}`, (m, before) => `${before}${/complètement|totalement/i.test(before) ? "" : "complètement "}perdu`],
    [`${S}à\\s+la\\s+bonne\\s+franquette${E}`, "sans chichis"],
    [`${S}sur\\s+les\\s+chapeaux\\s+de\\s+roues?${E}`, "à toute vitesse"],
    [`${S}de\\s+(?:mauvais|sale)\\s+poil${E}`, "de mauvaise humeur"],
    [`${S}de\\s+bon\\s+poil${E}`, "de bonne humeur"],
    [`${S}(?:ça|ca)\\s+va\\s+pas\\s+la\\s+tête(?:\\s*,?\\s*non)?(?=\\s*[?!])`, "tu es fou"],
    [`${S}(c['’]est|c['’]était|ce\\s+sera)\\s+(?:vraiment\\s+|trop\\s+|carrément\\s+)?le\\s+pied${E}`, "$1 génial"],
    [`${S}(?:c['’]est|ce\\s+n['’]est)\\s+pas\\s+(?:très\\s+)?terrible${E}`, "ce n'est pas très bien"],
    [`${S}(?:c['’]était|ce\\s+n['’]était)\\s+pas\\s+(?:très\\s+)?terrible${E}`, "ce n'était pas très bien"],
    [`(${S}(?:est|sont|était|étaient|n['’]est|n['’]était|ne\\s+sont)\\s+)pas\\s+(?:très\\s+)?terribles?${E}`, (m, before) => `${before}pas très bien`],
    [`${S}(tu|vous)\\s+(me|m['’]|nous)\\s*(?:fais|faites)\\s+marcher${E}`, (m, who, obj) => `${who} ${who.toLowerCase() === "tu" ? "te moques" : "vous moquez"} de ${/^n/i.test(obj) ? "nous" : "moi"}`],
    [`${S}(m['’]|t['’]|nous|vous|l['’]|les)\\s*(a|as|ont|avez|avait)\\s+mené(e?s?)\\s+en\\s+bateau${E}`, (m, who, aux, end) => `${objectPronoun(who)}${aux} trompé${end}`],
    [`${S}(a|ont)\\s+(?:cassé\\s+sa\\s+pipe|passé\\s+l['’]arme\\s+à\\s+gauche)${E}`, (m, aux) => (aux.toLowerCase() === "a" ? "est mort" : "sont morts")],
    [`${S}(?:casser\\s+sa\\s+pipe|passer\\s+l['’]arme\\s+à\\s+gauche)${E}`, "mourir"],
    [`${S}(jette|jettes|jettent|jeter|jeté|jetez|jetait|jetais)\\s+l['’]argent\\s+par\\s+les\\s+fenêtres${E}`, (m, verb) => `${verb.toLowerCase().replace(/^jett?/, "gaspill")} l'argent`],
    [`${AVOIR_J}\\s+la\\s+main\\s+verte${E}`, (m, j, verb) => `${j ? "j'" : ""}${verb} le pouce vert`],
    [`${S}comme\\s+(?:chien\\s+et\\s+chat|chat\\s+et\\s+chien)${E}`, "comme des chats et des chiens"],
    [`${S}(?:il\\s+)?(?:n['’])?y\\s+a\\s+pas\\s+le\\s+feu(?:\\s+au\\s+lac)?${E}`, "on n'est pas pressés"],
    [`(?<=${SJ}(?:ai|as|a|avons|avez|ont|avait)\\s+)fait\\s+l['’]école\\s+buissonnière${E}`, "manqué l'école volontairement"],
    [`${S}(faire|fais|fait|faites|font)\\s+l['’]école\\s+buissonnière${E}`, (m, verb) => `${({ faire: "manquer", fais: "manques", fait: "manque", faites: "manquez", font: "manquent" })[verb.toLowerCase()]} l'école volontairement`],
    [`${S}bête\\s+comme\\s+(?:ses|ses\\s+deux|mes|tes|leurs)\\s+pieds${E}`, "vraiment très bête"],
    [`${S}haut(e?s?)\\s+comme\\s+trois\\s+pommes${E}`, "tout petit"],
    [`${S}(mettre|mets|met|mettez|mettons|mettent|mis)\\s+les\\s+bouchées\\s+doubles${E}`, (m, verb) => `${({ mettre: "redoubler", mets: "redouble", met: "redouble", mettez: "redoublez", mettons: "redoublons", mettent: "redoublent", mis: "redoublé" })[verb.toLowerCase()]} d'efforts`],
    [`${S}(me|te|se|nous|vous|m['’]|t['’]|s['’])\\s*(?:suis\\s+|es\\s+|est\\s+|sommes\\s+|êtes\\s+|sont\\s+)?(cass\\p{L}*)(\\s+(?:pas|plus|jamais))?\\s+la\\s+tête${E}`, (m) => m.replace(/cass/i, "compliqu").replace(/la\s+tête$/i, "la vie")],
    [`${S}(mettre|mets|met|mettez|mettons|mettent|mis)\\s+le\\s+paquet${E}`, (m, verb) => `${({ mettre: "faire", mets: "fais", met: "fait", mettez: "faites", mettons: "faisons", mettent: "font", mis: "fait" })[verb.toLowerCase()]} un énorme effort`],
    [`${S}pris(e?s?)\\s+la\\s+main\\s+dans\\s+le\\s+sac${E}`, "pris$1 en flagrant délit"],
    [`${S}en\\s+(fait|fais|faire|faites|font|faisait|faisais)\\s+(?:tout\\s+)?(?:un\\s+fromage|un\\s+plat|une\\s+montagne|des\\s+tonnes|des\\s+caisses|des\\s+kilos)${E}`, (m, verb) => ({ fait: "exagère", fais: "exagères", faire: "exagérer", faites: "exagérez", font: "exagèrent", faisait: "exagérait", faisais: "exagérais" })[verb.toLowerCase()]],
    [`${S}(je|tu|il|elle|on)\\s+(mets|met)\\s+les\\s+voiles${E}`, (m, who) => `${who} ${bySubject(who, ["pars", "pars", "part"])}`],
    [`${AVOIR_J}\\s+mis\\s+les\\s+voiles${E}`, (m, j, aux) => `${j ? "je " : ""}${AVOIR_ETRE[aux.toLowerCase()]} parti`],
    [`${S}(s['’]est|se\\s+sont|me\\s+suis|t['’]es)\\s+fait\\s+la\\s+malle${E}`, (m, aux) => `${({ "s'est": "est", "s’est": "est", "se sont": "sont", "me suis": "suis", "t'es": "es", "t’es": "es" })[aux.toLowerCase().replace(/\s+/g, " ")] ?? "est"} parti`],
    [`${S}(lève|lèves|lèvent|lever|levé|levait|levais)\\s+(?:un\\s+peu\\s+trop\\s+|trop\\s+|souvent\\s+|beaucoup\\s+)?le\\s+coude${E}`, (m, verb) => `${({ lève: "boit", lèves: "bois", lèvent: "boivent", lever: "boire", levé: "bu", levait: "buvait", levais: "buvais" })[verb.toLowerCase()]} beaucoup trop d'alcool`],
    [`${AVOIR_J}\\s+une\\s+dent\\s+contre${E}`, (m, j, verb) => `${j ? "j'" : ""}${verb} de la rancune contre`],
    [`${S}tirée?s?\\s+à\\s+quatre\\s+épingles${E}`, "habillé très élégamment"],
    [`${S}qui\\s+vivra\\s+verra${E}`, "on verra bien avec le temps"],
    [`${S}petit\\s+à\\s+petit\\s*,?\\s+l['’]oiseau\\s+fait\\s+son\\s+nid${E}`, "petit à petit, on avance"],
    [`${S}l['’]habit\\s+ne\\s+fait\\s+pas\\s+le\\s+moine${E}`, "il ne faut pas juger les gens sur leur apparence"],
    [`${S}après\\s+la\\s+pluie\\s*,?\\s+(?:vient\\s+)?le\\s+beau\\s+temps${E}`, "les choses finissent toujours par s'arranger"],
    [`${S}qui\\s+se\\s+ressemble\\s+s['’]assemble${E}`, "les oiseaux du même plumage volent ensemble"],
    [`${S}chat\\s+échaudé\\s+craint\\s+l['’]eau\\s+froide${E}`, "après une mauvaise expérience, on devient prudent"],
    [`${S}c['’]est\\s+en\\s+forgeant\\s+qu['’]on\\s+devient\\s+forgeron${E}`, "c'est la pratique qui rend parfait"],
    [`${S}(veut|veux|voulez|veulent|vouloir|voulait)\\s+le\\s+beurre\\s+et\\s+l['’]argent\\s+du\\s+beurre${E}`, "$1 tout avoir"],
    [`${S}(tombé|tombée|tombés|tombées|tomber|tombe|tombons|tombent)\\s+sur\\s+un\\s+os${E}`, (m, verb) => `${({ tomber: "rencontrer", tombe: "rencontre", tombons: "rencontrons", tombent: "rencontrent" })[verb.toLowerCase()] ?? "rencontré"} un problème`],
    [`(?<=${S}(?:on|nous|je|il|elle|ils|elles|tu|vous)\\s+(?:est|sommes|suis|es|êtes|sont)\\s+)rencontré\\s+un\\s+problème`, "tombé sur un problème"],
    [`${S}(?:ça|ca|cela)\\s+me\\s+botte${E}`, "ça me plaît"],
    [`${S}malin(?:e?s?)\\s+comme\\s+un\\s+singe${E}`, "très malin"],
    [`${S}comme\\s+un\\s+poisson\\s+dans\\s+l['’]eau${E}`, "parfaitement à l'aise"],
    [`${S}dormi(?:r|s|t)?\\s+comme\\s+(?:un\\s+loir|une\\s+souche|une\\s+marmotte|un\\s+bébé)${E}`, (m) => m.replace(/comme\s+.+$/i, "comme une bûche")],
    [`${AVOIR_J}${ADV}\\s+les\\s+nerfs${E}`, asEtre("furieux")],
    [`${AVOIR_J}${ADV}\\s+les\\s+boules${E}`, asEtre("très déçu")],
    [`${S}(?:c['’]est|ça\\s+c['’]est)\\s+(?:vraiment\\s+)?le\\s+(?:bouquet|comble|pompon)${E}`, "c'est la goutte de trop"],
    [`${S}il\\s+ne\\s+(?:manquait|manquerait)\\s+plus\\s+que\\s+ça${E}`, "c'était vraiment la dernière chose dont j'avais besoin"],
    [`${AVOIR_J}${ADV}(\\s+eu)?\\s+du\\s+(?:bol|pot|cul)${E}`, (m, j, verb, adv, eu) => `${j ? "j'" : ""}${verb}${adv ?? ""}${eu ?? ""} de la chance`],
    [`${S}pas\\s+de\\s+(?:bol|pot|chance)(?=\\s*[!.,]|\\s*$)`, "quelle malchance"],
    [`${S}(c['’]est|c['’]était|quelle)\\s+(?:la\\s+|une\\s+|vraiment\\s+la\\s+)?galère${E}`, (m, what) => (/^quelle/i.test(what) ? "quel cauchemar" : `${what} très compliqué`)],
    [`${S}(je|j['’]|tu|il|elle|on|nous|vous|ils|elles)\\s*(galère|galères|galèrent|galérons|galérez|galérais|galérait|galérions|galériez|galéraient)${E}`, (m, who, verb) => {
        const past = /ai|ion|iez/i.test(verb.slice(5));
        const forms = past ? ["avais", "avais", "avait", "avions", "aviez", "avaient"] : ["ai", "as", "a", "avons", "avez", "ont"];
        const avoir = bySubject(who, forms);
        return `${/^j/i.test(who) ? "j'" : `${who} `}${avoir} du mal`;
    }],
    [`${SJ}(ai|as|a|avons|avez|ont|avait|avais)\\s+galéré${E}`, "$1 eu du mal"],
    [`${S}(galère|galères|galèrent|galérer|galéré|galérais|galérait|galérons|galérez)${E}`, (m) => ({ galère: "peine", galères: "peines", galèrent: "peinent", galérer: "peiner", galéré: "peiné", galérais: "peinais", galérait: "peinait", galérons: "peinons", galérez: "peinez" })[m.toLowerCase()]],
    [`${S}(je|tu|il|elle|on|nous|vous|ils|elles)\\s+(flippe|flippes|flippent|flippez|flippons)${E}`, (m, who) => `${who.toLowerCase() === "je" ? "j'ai" : `${who} ${bySubject(who, ["ai", "as", "a", "avons", "avez", "ont"])}`} peur`],
    [`${S}(?:ça|ca|cela)\\s+(me|te|nous|vous)\\s+(?:fait|fout)\\s+flipper${E}`, "ça $1 fait peur"],
    [`${S}(flippante?s?)${E}`, (m) => m.toLowerCase().replace(/^flipp/, "effray")],
    [`${S}(je|tu|il|elle|on)\\s+(?:me|m['’]|te|t['’]|se|s['’])\\s*(?:suis|es|est)\\s+fait(e?)\\s+(?:larguer|plaquer|jeter)${E}`, (m, who, e) => `${/^je$/i.test(who) ? "j'ai" : `${who} ${bySubject(who, ["ai", "as", "a"])}`} été largué${e}`],
    [`${S}(m['’]|t['’]|l['’]|nous|vous|les)\\s*(a|as|ont|avez)\\s+largué(e?s?)${E}`, "$1$2 quitté$3"],
    [`${S}(se\\s+faire|me\\s+suis\\s+fait|t['’]es\\s+fait|s['’]est\\s+fait|se\\s+sont\\s+fait|nous\\s+sommes\\s+fait|vous\\s+êtes\\s+fait)\\s+(?:gauler|pécho|choper|serrer)${E}`, "$1 attraper"],
    [`${S}(pécho|péchô|chopé)\\s+(?=(?:une|un|la|le|cette|ce)\\s+(?:meuf|fille|nana|mec|gars|keum|fille|femme|copine|blonde|brune))`, "ramassé "],
    [`${S}(j['’]ai|il\\s+a|elle\\s+a|on\\s+a|tu\\s+as|ils\\s+ont)\\s+pécho${E}`, "$1 séduit quelqu'un"],
    [`${S}(m['’]|t['’]|l['’]|nous|vous|les)\\s*(a|as|ont|avez|avait)\\s+balancée?s?\\s+(?=(?:aux?|à\\s+la|à\\s+l['’])\\s+(?:flics?|keufs?|police|prof|profs|patron|chef|direction|surveillant|parents|gendarmes|douane))`, "$1$2 dénoncé "],
    [`${S}(m['’]|t['’]|l['’]|nous|vous|les|lui|leur)\\s*(a|as|ont|avez|avait)\\s+mis\\s+un\\s+(?:gros\\s+|sacré\\s+|de\\s+ces\\s+)?vent${E}`, (m, who, aux) => `${({ lui: "l'", leur: "les " })[who.toLowerCase()] ?? (/['’]$/.test(who) ? who : `${who} `)}${aux} ignoré`],
    [`${S}(?:me|m['’])\\s*(?:suis|étais)\\s+pris\\s+un\\s+(?:gros\\s+|sacré\\s+|de\\s+ces\\s+)?vent${E}`, "j'ai été ignoré"],
    [`${S}(s['’]est|se\\s+sont|me\\s+suis|t['’]es|nous\\s+sommes|vous\\s+êtes)\\s+(?:pris|mis|pris\\s+une|mis\\s+une)\\s+(?:une\\s+)?(?:de\\s+ces\\s+|grosse\\s+|sacrée\\s+|bonne\\s+|belle\\s+)?(?:cuites?|murges?|caisses?)${E}`, (m, aux) => `${aux} complètement saoulé`],
    [`${S}(prendre|prend|prends|prennent|pris)\\s+une\\s+(?:de\\s+ces\\s+|grosse\\s+|sacrée\\s+|bonne\\s+|belle\\s+)?(?:cuite|murge)${E}`, (m, verb) => ({ prendre: "se saouler", prend: "se saoule", prends: "me saoule", prennent: "se saoulent", pris: "saoulé" })[verb.toLowerCase()]],
    [`${S}(?:se\\s+)?bourrer\\s+la\\s+gueule${E}`, "se saouler"],
    [`(${PERSON_ETRE}${ADVERBS}\\s+)bourrée?s?(?!\\s+(?:de|d['’]|à|aux))${E}`, "$1ivre"],
    [`${S}(?:boulot|job|travail|poste|taf|vie)\\s+pépère${E}`, (m) => m.replace(/\s+pépère$/i, " facile et tranquille")],
    [`${S}(je|tu|il|elle|on)\\s+(?:sature|satures)(?=\\s*(?:[,.!?]|$)|\\s+(?:là|complètement|grave|en\\s+ce\\s+moment)${E})`, (m, who) => `${who} ${bySubject(who, ["suis débordé", "es débordé", "est débordé"])}`],
    [`${S}(?:bande|tas|équipe|paquet)\\s+de\\s+bras\\s+cassés${E}`, (m) => m.replace(/de\s+bras\s+cassés/i, "d'incompétents")],
    [`${S}(?:un|une|des|les|ces|ce|cette)\\s+bras\\s+cassés?${E}`, (m) => (/s$/i.test(m) ? "des nuls" : "un nul")],
    // « une balance » (mouchard) seulement en insulte : « t'es qu'une balance », « sale balance ».
    [`${S}(?:sale|espèce\\s+de)\\s+balance${E}`, (m) => m.replace(/balance$/i, "mouchard")],
    [`(?<=${S}(?:es|est|êtes|sont|était)\\s+(?:qu['’]|vraiment\\s+|juste\\s+)?)une\\s+(?:vraie\\s+|sale\\s+)?balance(?=\\s*[!.,]|\\s*$)`, "un mouchard"],
    [`(?<=qu['’])une\\s+balance(?=\\s*[!.,]|\\s*$)`, "un mouchard"],
    [`${S}pauvre\\s+(con|conne|cons|connes|type|tache|naze|nul)${E}`, (m, word) => `espèce de ${/^conne/i.test(word) ? "connasse" : /^cons$/i.test(word) ? "connards" : "connard"}`],
    [`${S}(?:gros|sale|petit|tête\\s+de)\\s+con${E}`, "connard"],
    [`${S}va\\s+chier${E}`, "va te faire voir"],
    [`${S}lèche-(?:cul|culs|bottes)${E}`, (m) => (/s$/i.test(m) ? "flatteurs" : "flatteur")],
    [`${S}(faire|fais|fait|faites|faisait)\\s+(?:l['’]andouille|le\\s+zouave|le\\s+guignol|le\\s+clown|le\\s+pitre|l['’]imbécile|le\\s+mariole)${E}`, "$1 l'idiot"],
    [`${S}(fais|faites|faire)\\s+gaffe${E}`, (m, verb) => `${verb} attention`],
    [`${S}j['’]en\\s+reviens\\s+pas${E}`, "je n'y crois pas"],
    [`${S}laisse\\s+béton${E}`, "laisse tomber"],
    [`${S}(tomb\\p{L}*)\\s+dans\\s+le\\s+panneau${E}`, "$1 dans le piège"],
    [`${S}(?:il\\s+)?y\\s+a\\s+un\\s+hic${E}`, "il y a un problème"],
    [`${AVOIR_J}${ADV}(\\s+eu)?\\s+une\\s+peur\\s+bleue${E}`, (m, j, verb, adv, eu) => `${j ? "j'" : ""}${verb}${adv ?? ""}${eu ?? ""} terriblement peur`],
    [`${S}(?:ça|ca|cela)\\s+(?:ne\\s+)?(?:me|m['’])\\s*fait\\s+ni\\s+chaud\\s+ni\\s+froid${E}`, "ça m'est complètement indifférent"],
    [`${S}appeler\\s+un\\s+chat\\s+un\\s+chat${E}`, "appeler les choses par leur nom"],
    [`${S}(?:rentré|rentrée|rentrés|revenu|revenue|revenus)\\s+bredouilles?${E}`, (m) => m.replace(/\s+bredouilles?$/i, " les mains vides")],
    [`${S}(?:se\\s+)?tourn(?:er|e|es|ent|ait|ais|ez|ons)\\s+les\\s+pouces${E}`, (m) => m.replace(/(?:se\s+)?tourn\p{L}*\s+les\s+pouces/iu, (v) => (/^se/i.test(v) ? "ne rien faire" : "ne fait rien"))],
    [`(${PERSON_ETRE}${ADVERBS}\\s+)chaud(e?s?)\\s+(?=pour\\s+(?:un|une|aller|faire|venir|sortir|ce|cette)${E})`, "$1partant$2 "],
    [`(?<=^\\s*|[.!?]\\s+)n['’]importe\\s+quoi(?=\\s*[!.]|\\s*$)`, "c'est absurde"],
    [`${S}(?:c['’]est|c['’]était)\\s+(?:vraiment\\s+|complètement\\s+)?n['’]importe\\s+quoi${E}`, (m) => (/était/i.test(m) ? "c'était absurde" : "c'est absurde")],
    [`${S}(${ETRE})\\s+(?:complètement\\s+|vraiment\\s+)?sur\\s+la\\s+paille${E}`, "$1 complètement fauché"],
    [`${S}(travaill\\p{L}*|bûch\\p{L}*|bosse|bossent|bosses|bossait)\\s+comme\\s+(?:un|une|des)\\s+(?:dingues?|fous|fou|folles?|malades?|tarés?|acharnée?s?|brutes?|damnée?s?)${E}`, "$1 extrêmement dur"],
    [`${S}(boi\\p{L}*|bu|buvait|buvais|fume|fumes|fument|fumer|fumait|fumé)\\s+comme\\s+(?:un\\s+trou|une\\s+éponge|un\\s+pompier|une\\s+cheminée|un\\s+sapeur)${E}`, "$1 énormément"],
    [`${S}(tenu|tenir|tiens|tient|tenais|tenait)\\s+la\\s+chandelle${E}`, (m, verb) => `${({ tenu: "été", tenir: "être", tiens: "suis", tient: "est", tenais: "étais", tenait: "était" })[verb.toLowerCase()]} la troisième roue`],
    [`(?<=${SJ}(?:ai|as|a|avons|avez|ont|avait|avais)\\s+)fait\\s+le\\s+pied\\s+de\\s+grue(?=\\s+(?:pendant|depuis|une|deux|trois|\\d)${E})`, "attendu debout"],
    [`(?<=${SJ}(?:ai|as|a|avons|avez|ont|avait|avais)\\s+)fait\\s+le\\s+pied\\s+de\\s+grue${E}`, "attendu très longtemps"],
    [`${S}(fais|fait|faire|faisons|faites|font)\\s+le\\s+pied\\s+de\\s+grue${E}`, (m, verb) => `${({ fais: "attends", fait: "attend", faire: "attendre", faisons: "attendons", faites: "attendez", font: "attendent" })[verb.toLowerCase()]} très longtemps`],
    [`${S}(cass\\p{L}*)\\s+du\\s+sucre\\s+sur\\s+le\\s+dos(?=\\s+(?:de|d['’]|des|du)${E})`, (m, verb) => ({ casse: "dit du mal", casses: "dis du mal", cassent: "disent du mal", casser: "dire du mal", cassé: "dit du mal", cassait: "disait du mal", cassez: "dites du mal" })[verb.toLowerCase()] ?? "dit du mal"],
    [`${AVOIR_J}${ADV}\\s+la\\s+tête\\s+(?:bien\\s+)?sur\\s+les\\s+épaules${E}`, asEtre("très raisonnable")],
    [`${S}n['’](a|ai|as|ont|avait|avez)\\s+pas\\s+(?:sa|ma|ta|leur|la|votre)\\s+langue\\s+dans\\s+(?:sa|ma|ta|leur|la|votre)\\s+poche${E}`, (m, aux) => `${AVOIR_ETRE[aux.toLowerCase()]} très franc`],
    [`${AVOIR_J}\\s+des\\s+fourmis\\s+dans\\s+les\\s+(jambes|pieds|mains|bras|doigts)${E}`, (m, j, verb, part) => `${j ? "j'" : ""}${verb} des picotements dans les ${part}`],
    [`${S}(je|tu|il|elle|on|nous|vous|ils|elles)\\s+(?:me|te|se|nous|vous)\\s+(?:fais|fait|faisons|faites|font)\\s+des\\s+cheveux\\s+blancs${E}`, (m, who) => `${who} ${bySubject(who, ["m'inquiète", "t'inquiètes", "s'inquiète", "nous inquiétons", "vous inquiétez", "s'inquiètent"])} beaucoup`],
    [`${AVOIR_J}${ADV}\\s+une\\s+araignée\\s+au\\s+plafond${E}`, asEtre("un peu fou")],
    [`${S}(?:il\\s+)?y\\s+a\\s+de\\s+l['’]eau\\s+dans\\s+le\\s+gaz${E}`, "il y a des tensions"],
    [`${S}(${ETRE})\\s+aux\\s+petits\\s+soins\\s+(?:pour|avec)${E}`, "$1 très attentionné avec"],
    [`${S}(mis|mettre|met|mets|mettent|mettez)\\s+les\\s+petits\\s+plats\\s+dans\\s+les\\s+grands${E}`, (m, verb) => `${({ mis: "préparé", mettre: "préparer", met: "prépare", mets: "prépare", mettent: "préparent", mettez: "préparez" })[verb.toLowerCase()]} un repas exceptionnel`],
    [`${S}(m['’]|t['’]|lui|nous|vous|leur)\\s*(a|as|ont|avez|ai|avait)\\s+fait\\s+une\\s+(?:fleur|faveur)${E}`, (m, who, aux) => `${/['’]$/.test(who) ? who : `${who} `}${aux} rendu un service`],
    [`${S}(me\\s+suis|t['’]es|s['’]est|nous\\s+sommes|vous\\s+êtes|se\\s+sont)\\s+fait\\s+(?:rouler\\s+dans\\s+la\\s+farine|mener\\s+en\\s+bateau|berner)${E}`, "$1 fait duper"],
    [`${S}(noy\\p{L}*|noie|noies|noient)\\s+le\\s+poisson${E}`, (m, verb) => `${({ noyer: "changer", noie: "change", noies: "changes", noient: "changent", noyé: "changé", noyez: "changez", noyait: "changeait", noyons: "changeons" })[verb.toLowerCase()] ?? "changer"} de sujet`],
    [`${S}(a|ont|ai|as)\\s+pris\\s+la\\s+poudre\\s+d['’]escampette${E}`, (m, aux) => ({ a: "s'est enfui", ont: "se sont enfuis", ai: "me suis enfui", as: "t'es enfui" })[aux.toLowerCase()]],
    [`${S}prendre\\s+la\\s+poudre\\s+d['’]escampette${E}`, "s'enfuir"],
    [`${S}(nous|vous|lui|leur|me|te)\\s+en\\s+(mettre|met|mets|mettent|mis)\\s+plein\\s+la\\s+vue${E}`, (m, who, verb) => `${({ lui: "l'", leur: "les ", me: "m'", te: "t'" })[who.toLowerCase()] ?? `${who} `}${({ mettre: "impressionner", met: "impressionne", mets: "impressionne", mettent: "impressionnent", mis: "impressionné" })[verb.toLowerCase()]}`],
    [`${S}(${ETRE})\\s+(?:tous\\s+)?sur\\s+les\\s+dents${E}`, "$1 très tendu"],
    [`${S}(né|née|nés|nées)\\s+de\\s+la\\s+dernière\\s+pluie${E}`, "$1 d'hier"],
    [`${S}(?:ça|ce|cela)\\s+n['’](?:est|a)\\s+pas\\s+tombé\\s+dans\\s+l['’]oreille\\s+d['’]un\\s+sourd${E}`, "je l'ai bien noté"],
    [`${S}(me|te|lui|nous|vous|leur)\\s+(met|mets|mettent|mettait|mettre|a\\s+mis|ont\\s+mis)\\s+des\\s+bâtons\\s+dans\\s+les\\s+roues${E}`, (m, who, verb) => `${who} ${({ met: "complique", mets: "compliques", mettent: "compliquent", mettait: "compliquait", mettre: "compliquer", "a mis": "a compliqué", "ont mis": "ont compliqué" })[verb.toLowerCase().replace(/\s+/g, " ")]} la tâche`],
    [`${S}(porter|porte|portes|portent|porté|portera|porterai)\\s+le\\s+chapeau${E}`, (m, verb) => `${verb.toLowerCase().replace(/^port/, "endoss")} la responsabilité`],
    [`${S}(${ETRE})\\s+(?:très\\s+|super\\s+|assez\\s+|vraiment\\s+)?à\\s+cheval\\s+sur${E}`, "$1 très strict sur"],
    [`${S}les\\s+bras\\s+m['’]en\\s+tombent${E}`, "je suis stupéfait"],
    [`${S}(perdu|perdre|perd|perds)\\s+le\\s+nord${E}`, "$1 la tête"],
    [`${S}à\\s+côté\\s+de\\s+(?:mes|tes|ses|nos|vos|leurs)\\s+pompes${E}`, "complètement distrait"],
    [`${S}(pète|pètes|pètent|péter)\\s+plus\\s+haut\\s+que\\s+(?:son|ton|mon|leur)\\s+cul${E}`, (m, verb) => ({ pète: "se croit supérieur", pètes: "te crois supérieur", pètent: "se croient supérieurs", péter: "se croire supérieur" })[verb.toLowerCase()]],
    [`${S}(fait|fais|faire|faisait|faisons)\\s+du\\s+stop${E}`, "$1 de l'auto-stop"],
    [`${S}(on\\s+est|je\\s+suis|nous\\s+sommes|ils\\s+sont|elle\\s+est|il\\s+est|tu\\s+es|vous\\s+êtes)\\s+(?:complètement\\s+|vraiment\\s+|un\\s+peu\\s+)?charrette${E}`, "$1 débordé"],
    [`${S}(connais|connaît|connaissent|connaître|connaissez|connaissons)\\s+([^,.!?\\n]{1,40}?)\\s+comme\\s+(?:ma|ta|sa|notre|votre|leur)\\s+poche${E}`, "$1 $2 par cœur"],
    [`${S}(?:(je)\\s+)?(t['’]en\\s+es|s['’]en\\s+est|m['’]en\\s+suis|vous\\s+en\\s+êtes|nous\\s+en\\s+sommes|s['’]en\\s+sont)\\s+(?:tiré|tirée|tirés|sorti|sortie|sortis)\\s+à\\s+bon\\s+compte${E}`, (m, je, who) => `${je ? "j'ai" : ({ "t'en es": "as", "t’en es": "as", "s'en est": "a", "s’en est": "a", "m'en suis": "ai", "m’en suis": "ai", "vous en êtes": "avez", "nous en sommes": "avons", "s'en sont": "ont", "s’en sont": "ont" })[who.toLowerCase().replace(/\s+/g, " ")]} évité le pire`],
    [`${S}(a|ai|as|ont|avait|avez)\\s+eu\\s+la\\s+main\\s+(?:un\\s+peu\\s+|très\\s+|trop\\s+)?lourde\\s+(?:sur|avec)\\s+(?:le|la|les|l['’])\\s*(?=(\\p{L}))`, (m, aux, letter) => `${aux} mis trop ${/[aeéèêiouyh]/i.test(letter) ? "d'" : "de "}`],
    [`${S}grave\\s+(?=(?:fatiguée?s?|contente?s?|bien|cool|stylée?s?|beaux?|belles?|bons?|bonnes?|chaude?s?|déçue?s?|relous?|chiante?s?|drôles?|marrante?s?|faim|soif|envie|peur|mal|énervée?s?|occupée?s?|malades?|en\\s+retard|stressée?s?|heureux|heureuses?|tristes?|nuls?|nulles?|chaud|bizarres?|dégoûtée?s?|saoulée?s?)${E})`, "vraiment "],
    [`${S}trop\\s+(pénibles?|relous?|chiante?s?|nuls?|nulles?|bizarres?|débiles?|top|classe|chelous?|stylée?s?|canons?|chou|choux|adorables?)${E}`, "vraiment $1"],
    [`(?<=${S}tu\\s+es\\s+)sur(?=\\s*[?!.]|\\s*$)`, "sûr"],
    [`${S}(?:un\\s+)?échange\\s+téléphonique${E}`, (m) => (/^un/i.test(m) ? "une conversation téléphonique" : "conversation téléphonique")],
    [`${S}de\\s+Charybde\\s+en\\s+Scylla${E}`, "de mal en pis"],
    [`${S}(payé|payer|paie|paies|paient|payait)\\s+(?:ça\\s+|cela\\s+)?(?:la\\s+peau\\s+(?:du\\s+dos|des\\s+fesses)|les\\s+yeux\\s+de\\s+la\\s+tête|un\\s+bras|une\\s+blinde)${E}`, "$1 une fortune"],
    [`(?<=${SJ}(?:ai|as|a|avons|avez|ont|avait)\\s+)fait\\s+jouer\\s+(ses|mes|tes|leurs|nos|vos)\\s+(?:relations|contacts|connaissances|réseaux?)${E}`, "utilisé $1 contacts"],
    [`${S}faute\\s+de\\s+grives\\s*,?\\s+on\\s+mange\\s+des\\s+merles${E}`, "il faut se contenter de ce qu'on a"],
    [`${S}un\\s+(?:«\\s*)?tiens(?:\\s*»)?\\s+vaut\\s+mieux\\s+que\\s+deux\\s+(?:«\\s*)?tu\\s+l['’]auras(?:\\s*»)?${E}`, "mieux vaut un oiseau dans la main que deux dans les buissons"],
    [`${S}(un|le|son|mon|ton|notre|votre|leur)\\s+pot\\s+de\\s+départ${E}`, (m, det) => `${({ un: "une", le: "la", son: "sa", mon: "ma", ton: "ta" })[det.toLowerCase()] ?? det} fête d'adieu`],
    [`${S}en\\s+PJ${E}`, "en pièce jointe"],
    [`(?<=^\\s*|[.!?]\\s+)bonne\\s+réception(?=\\s*[.!]?\\s*$)`, "bien cordialement"],
    [`${S}(?:ça|ca|il|elle|l['’]appli|le\\s+site|mon\\s+ordi|le\\s+jeu)\\s+(?:bugu?e|buggu?e|bugge|beugue)(?:nt)?${E}`, (m) => m.replace(/\s+\S+$/, " a des bugs")],
    [`${S}(?:la\\s+)?mise\\s+en\\s+prod(?:uction)?${E}`, (m) => (/^la/i.test(m) ? "le déploiement en production" : "déploiement en production")],
    [`${S}en\\s+(?:pleine\\s+)?(?:phase\\s+de\\s+)?recette(?=\\s*[,.!?]|\\s*$|\\s+(?:sur|cette|pour|jusqu)${E})`, "en pleine phase de tests d'acceptation"],
    [`${S}(du|le|au)\\s+front(?=[^.!?\\n]*\\bback\\b)`, "$1 front-end"],
    [`(?<=\\bfront(?:-end)?\\b[^.!?\\n]*)\\b(du|le|au)\\s+back(?![\\p{L}-])`, "$1 back-end"],
    [`${S}(dépassé|dépasser|dépasse|dépassez)\\s+(mon|ton|son|votre|leur|notre|le)\\s+forfait(?:\\s+(?:mobile|internet|data))?${E}`, (m, verb, det) => `${({ dépassé: "utilisé", dépasser: "utiliser", dépasse: "utilise", dépassez: "utilisez" })[verb.toLowerCase()]} tout ${det} forfait de données mobiles`],
    [`${S}en\\s+(me|te|se|nous|vous)\\s+garant${E}`, (m, who) => `en garant ${({ me: "ma", te: "ta", se: "sa", nous: "notre", vous: "votre" })[who.toLowerCase()]} voiture`],
    [`${S}(pris|prendre|prends|prend|eu|récolté|chopé|reçu)\\s+(?:une\\s+prune|un\\s+PV|une\\s+contredanse|un\\s+procès-verbal)${E}`, (m, verb) => `${({ pris: "eu", chopé: "eu", récolté: "eu", prendre: "avoir", prends: "ai", prend: "a" })[verb.toLowerCase()] ?? verb} une amende`],
    [`${S}(des|les|de|gros|plein\\s+de)\\s+bouchons(?=\\s+(?:sur|à|dans|au|entre|ce|depuis|partout)${E}|\\s*[,.!?]|\\s*$)`, "$1 embouteillages"],
    [`${S}(?:le|du|au|sur\\s+le)\\s+périph${E}`, (m) => m.replace(/périph$/i, "périphérique")],
    [`${S}(il\\s+y\\s+a|dans|depuis|d['’]ici|en|pendant)\\s+huit\\s+jours${E}`, "$1 une semaine"],
    [`${S}(il\\s+y\\s+a|depuis|d['’]ici|en|pendant)\\s+quinze\\s+jours${E}`, "$1 deux semaines"],
    [`${S}(s['’]est|se\\s+sont|me\\s+suis|t['’]es|nous\\s+sommes|vous\\s+êtes|on\\s+s['’]est)\\s+tapé(?:e?s?)\\s+(?:un|une)\\s+(?:bon\\s+|gros\\s+|sacré\\s+)?(?:fou\\s+rire|crise\\s+de\\s+rire|barre\\s+de\\s+rire|délire)${E}`, (m, aux) => `${({ "s'est": "a", "s’est": "a", "se sont": "ont", "me suis": "ai", "t'es": "as", "t’es": "as", "nous sommes": "avons", "vous êtes": "avez", "on s'est": "on a", "on s’est": "on a" })[aux.toLowerCase().replace(/\s+/g, " ")]} eu un fou rire`],
    [`${S}(m['’]|t['’]|l['’]|nous|vous|les)\\s*(a|as|ont|avait|avez)\\s+(?:saoulée?s?|soûlée?s?|gonflée?s?|gavée?s?)(?!\\s+(?:de|d['’]|à|au)${E})${E}`, (m, who, aux) => `${objectPronoun(who)}${aux} agacé`],
    [`${S}(?:n['’])?(a|ont|as|avait|ai)\\s+pas\\s+inventé\\s+(?:l['’]eau\\s+chaude|la\\s+poudre|le\\s+fil\\s+à\\s+couper\\s+le\\s+beurre)${E}`, (m, aux) => `${({ a: "n'est", ont: "ne sont", as: "n'es", avait: "n'était", ai: "ne suis" })[aux.toLowerCase()]} pas très malin`],
    [`${S}(un|une|gros|grosse|espèce\\s+de|quel|quelle|sale|des|ces|vrai|vraie)\\s+(?:gros\\s+|vrai\\s+)?nazes?${E}`, (m, det) => `${/^(?:des|ces)$/i.test(det) ? det : /^(?:quel|quelle)$/i.test(det) ? "quel" : "un vrai"} ${/s$/i.test(m) && /^(?:des|ces)$/i.test(det) ? "losers" : "loser"}`],
    [`${S}va\\s+te\\s+faire\\s+voir${E}`, "dégage"],
    [`${S}comme\\s+(?:un|une|des)\\s+malpropres?${E}`, "brutalement"],
    [`${S}koi\\s+(?:de\\s+|2\\s+)?9${E}`, "quoi de neuf"],
    [`${S}quoi\\s+de\\s+9${E}`, "quoi de neuf"],
    [`(?<=${S}tu\\s+es\\s+)ou(?=\\s*\\?)`, "où"],
    [`${S}t\\s+(?:ki|qui)(?=\\s*\\?)`, "tu es qui"],
    [`${S}(qu['’]il|qu['’]elle|qu['’]ils|qu['’]elles|qu['’]on|que\\s+tu|que\\s+vous|que\\s+je|que\\s+nous)\\s+(soit|soient|sois|soyez|soyons)\\s+d['’]accord${E}`, (m, who, verb) => `${who} ${({ soit: "accepte", soient: "acceptent", sois: "acceptes", soyez: "acceptiez", soyons: "acceptions" })[verb.toLowerCase()]}`],
    [`(?<=^\\s*|[.!?—–-]\\s*|[«"“]\\s*)volontiers(?=\\s*[.!]|\\s*$)`, "avec plaisir"],
    [`${S}c['’]est\\s+à\\s+qui\\s+de\\s+(?:jouer|parler|commencer|passer|choisir)(?=\\s*\\?)`, "c'est au tour de qui"],
    [`(?<=(?:cassé|cassée|blessé|blessée|tordu|tordue|foulé|foulée|fait\\s+mal|fracturé|fracturée|luxé|luxée)\\s+[^.!?\\n]{0,30}?)au\\s+(ski|snowboard|surf|judo|patinage|vélo)${E}`, (m, sport) => `en faisant du ${sport}`],
    [`(?<=(?:cassé|cassée|blessé|blessée|tordu|tordue|foulé|foulée|fait\\s+mal|fracturé|fracturée|luxé|luxée)\\s+[^.!?\\n]{0,30}?)au\\s+(foot|football|rugby|tennis|basket|hand|hockey|volley|golf)${E}`, (m, sport) => `en jouant au ${sport}`],
    [`${S}faute\\s+de\\s+(temps|moyens|argent|place|preuves|budget|personnel)${E}`, "par manque de $1"],
    [`${S}(se\\s+prend|se\\s+prenait|te\\s+prends|se\\s+prennent)\\s+pour\\s+le\\s+nombril\\s+du\\s+monde${E}`, (m, verb) => `${({ "se prend": "se croit", "se prenait": "se croyait", "te prends": "te crois", "se prennent": "se croient" })[verb.toLowerCase().replace(/\s+/g, " ")]} le centre du monde`],
    [`${S}(je|tu|il|elle|ils|elles)\\s+(?:ne\\s+|n['’])?(suis|es|est|sont)\\s+pas\\s+(?:encore\\s+)?sortie?s?\\s+de\\s+l['’]auberge${E}`, (m, who) => `ce n'est pas encore fini pour ${({ je: "moi", tu: "toi", il: "lui", elle: "elle", ils: "eux", elles: "elles" })[who.toLowerCase()]}`],
    [`${S}blanc(?:he)?s?\\s+comme\\s+(?:un\\s+linge|un\\s+cachet\\s+d['’]aspirine|neige)${E}`, "très pâle"],
    [`${S}rouges?\\s+comme\\s+(?:une\\s+tomate|une\\s+pivoine|une\\s+écrevisse|un\\s+coquelicot)${E}`, "tout rouge"],
    [`${S}(fait|fais|font|faire|faisait|faisons|faites)\\s+des\\s+pieds\\s+et\\s+des\\s+mains${E}`, "$1 tout son possible"],
    [`${S}comme\\s+sur\\s+des\\s+roulettes${E}`, "parfaitement bien"],
    [`${S}comme\\s+(?:des\\s+)?larrons\\s+en\\s+foire${E}`, "à merveille"],
    [`${S}(?:il\\s+)?fait\\s+un\\s+temps\\s+à\\s+ne\\s+pas\\s+mettre\\s+un\\s+chien\\s+dehors${E}`, "la météo est horrible"],
    [`${S}(?:le\\s+)?ciel\\s+(est|était|sera)\\s+(?:très\\s+)?couvert${E}`, "le ciel $1 très nuageux"],
    [`${S}(?:ça|ca|cela|il|elle)\\s+m['’](?:est|a)\\s+passée?\\s+sous\\s+le\\s+nez${E}`, "ça m'a échappé de justesse"],
    [`${S}le\\s+cadet\\s+de\\s+(mes|tes|ses|nos|vos|leurs)\\s+soucis${E}`, "le moindre de $1 soucis"],
    [`${S}un\\s+(?:sale\\s+)?caractère\\s+de\\s+(?:cochon|chien)${E}`, "un très mauvais caractère"],
    [`${S}(faire|fais|fait|faisons|faites|font)\\s+un\\s+(?:petit\\s+)?somme${E}`, "$1 une sieste"],
    [`${S}(trouvé|trouver|trouve|trouvera)\\s+chaussure\\s+à\\s+(?:son|mon|ton|leur)\\s+pied${E}`, "$1 l'âme sœur"],
    [`${S}(?:j['’])?en\\s+mettrais\\s+ma\\s+main\\s+à\\s+couper${E}`, "j'en suis absolument certain"],
    [`${S}(lâche|lâchent|lâcher|lâchait)\\s+(jamais|pas|plus)\\s+le\\s+morceau${E}`, (m, verb, neg) => `${({ lâche: "abandonne", lâchent: "abandonnent", lâcher: "abandonner", lâchait: "abandonnait" })[verb.toLowerCase()]} ${neg}`],
    [`${AVOIR_J}${ADV}\\s+la\\s+tête\\s+dure${E}`, asEtre("très têtu")],
    [`${S}(?:un|une|vrai|vraie)\\s+(?:vrai\\s+)?dure?\\s+à\\s+cuire${E}`, "une personne très coriace"],
    [`${S}(?:ça|ca|cela|ton\\s+histoire|son\\s+histoire|cette\\s+histoire)\\s+ne\\s+tient\\s+pas\\s+debout${E}`, (m) => m.replace(/\s*ne\s+tient\s+pas\s+debout$/i, " n'a aucun sens")],
    [`${S}(je|on|il|elle|tu)\\s+ne\\s+(?:sais|sait)\\s+plus\\s+où\\s+donner\\s+de\\s+la\\s+tête${E}`, (m, who) => `${who} ${bySubject(who, ["suis", "es", "est"])} complètement débordé`],
    [`${S}(a|ont|ai|as|avait)\\s+filé\\s+à\\s+l['’]anglaise${E}`, (m, aux) => `${({ a: "est", ont: "sont", ai: "suis", as: "es", avait: "était" })[aux.toLowerCase()]} parti sans dire au revoir`],
    [`${S}(c['’]est|c['’]était)\\s+la\\s+croix\\s+et\\s+la\\s+bannière${E}`, "$1 très compliqué"],
    [`${S}(roule|roules|roulent|roulait)\\s+des\\s+mécaniques${E}`, (m, verb) => ({ roule: "se vante", roules: "te vantes", roulent: "se vantent", roulait: "se vantait" })[verb.toLowerCase()]],
    [`${AVOIR_J}${ADV}\\s+(?:une\\s+|la\\s+)?langue\\s+de\\s+bois${E}`, (m, j, verb) => `${j ? "je " : ""}${({ a: "parle", ai: "parle", as: "parles", avons: "parlons", avez: "parlez", ont: "parlent", avait: "parlait", avais: "parlais", avaient: "parlaient" })[verb.toLowerCase()] ?? "parle"} pour ne rien dire`],
    [`${S}(pionc|roupill)(er|e|es|ent|é|ais|ait|ons|ez)${E}`, (m, stem, ending) => ({ er: "dormir", e: "dort", es: "dors", ent: "dorment", é: "dormi", ais: "dormais", ait: "dormait", ons: "dormons", ez: "dormez" })[ending.toLowerCase()]],
    [`${S}(me|te|se|nous|vous)\\s+pieut(er|e|es|ent|ons|ez)${E}`, (m, who, ending) => `${who} couch${ending}`],
    [`${S}(je|tu|il|elle|on|nous|vous|ils|elles)\\s+(?:glande|glandes|glandent|glandons|glandez|glandais|glandait)${E}`, (m, who) => `${who} ${bySubject(who, ["ne fais rien", "ne fais rien", "ne fait rien", "ne faisons rien", "ne faites rien", "ne font rien"])}`],
    [`${S}glander${E}`, "ne rien faire"],
    [`${S}(me|m['’]|te|lui|nous|vous|leur)\\s*taxer\\s+(?=(?:une|un|des|deux|trois|quelques|\\d)${E})`, (m, who) => `${({ "m'": "me", "m’": "me" })[who.toLowerCase()] ?? who} donner `],
    [`${S}(squatte|squattes|squattent|squatter|squatté|squattons|squattez)\\s+chez${E}`, (m, verb) => `${({ squatte: "loge", squattes: "loges", squattent: "logent", squatter: "loger", squatté: "logé", squattons: "logeons", squattez: "logez" })[verb.toLowerCase()]} chez`],
    [`${S}(a|ai|as|ont|avait|avez)\\s+été\\s+pistonnée?s?${E}`, "$1 utilisé ses contacts"],
    [`${S}(?:grâce\\s+au|par)\\s+piston${E}`, "grâce à ses contacts"],
    [`${S}(c['’]est|c['’]était)\\s+(?:trop\\s+|vraiment\\s+)?le\\s+feu(?=\\s*[,.!?]|\\s*$)`, "$1 génial"],
    [`${S}(?:ça|ca)\\s+(?:déchire|claque|envoie\\s+du\\s+lourd|envoie\\s+du\\s+pâté)(?:\\s+grave)?(?=\\s*[,.!?]|\\s*$)`, "c'est génial"],
    [`${S}(c['’]est|c['’]était)\\s+(?:trop\\s+|vraiment\\s+)?mortel(?:le)?(?=\\s*[,.!?]|\\s*$)`, "$1 génial"],
    [`${S}j['’]hallucine(?:\\s+complètement)?${E}`, "je n'arrive pas à y croire"],
    [`${S}(?:t['’]|tu\\s+)abuses${E}`, "tu exagères"],
    [`${S}vous\\s+abusez(?!\\s+(?:de|d['’]))${E}`, "vous exagérez"],
    [`${S}(tu\\s+déconnes|vous\\s+déconnez|je\\s+déconne|il\\s+déconne|elle\\s+déconne)(?=\\s*[,.!?]|\\s*$)`, (m) => ({ "tu déconnes": "tu plaisantes", "vous déconnez": "vous plaisantez", "je déconne": "je plaisante", "il déconne": "il plaisante", "elle déconne": "elle plaisante" })[m.toLowerCase().replace(/\s+/g, " ")]],
    [`${S}(l['’]imprimante|le\\s+PC|l['’]ordi|l['’]ordinateur|le\\s+wifi|le\\s+wi-fi|la\\s+box|internet|mon\\s+téléphone|le\\s+site|l['’]appli|ça|ca)\\s+déconne${E}`, "$1 ne marche pas bien"],
    [`${S}sans\\s+(?:déc|dec|déconner|déconner|blague|rire)(?=\\s*[,.!?]|\\s*$)`, "sérieusement"],
    [`${S}(?:on\\s+)?(m['’]|t['’]|lui|nous|vous|leur)\\s*(a|ont|as)\\s+(?:piqué|chipé|tiré|fauché)\\s+(?=(?:mon|ma|mes|ton|ta|tes|son|sa|ses|notre|nos|votre|vos|leur|leurs)${E})`, (m, who, aux) => `${/^on/i.test(m) ? "on " : ""}${/['’]$/.test(who) ? who : `${who} `}${aux} volé `],
    [`${S}(une|quelle|sale|vraie|cette|espèce\\s+d['’])\\s*ordure${E}`, (m, det) => `${({ une: "un", quelle: "quel", sale: "sale", vraie: "vrai", cette: "ce" })[det.toLowerCase()] ?? "espèce de"} salaud`],
    [`${S}(?:gros|grosse)\\s+(?:lard|vache|tas)${E}`, "gros porc"],
    [`${S}(un|une|qu['’]un|qu['’]une|espèce\\s+de|bande\\s+de|pauvre|sale|des|ces)\\s*minables?(?=\\s*[,.!?]|\\s*$)`, (m, det) => `${/^qu/i.test(det) ? "qu'un" : /^(?:des|ces|bande\s+de)$/i.test(det) ? det : /^une$/i.test(det) ? "un" : det} ${/^(?:des|ces|bande\s+de)$/i.test(det) ? "losers" : "loser"}`],
    [`${S}(?:un|une|vraiment|trop|complètement|super|vieux)\\s+ringarde?s?${E}`, (m) => (/^une?\s/i.test(m) ? "quelqu'un de démodé" : "complètement démodé")],
    [`${S}(?:un|une|vrai|vraie|sacré|gros)\\s+(?:vrai\\s+)?beauf${E}`, "un type vraiment vulgaire"],
    [`${S}(un|le|des|les|ce|mon|ton)\\s+(?:super\\s+|vrai\\s+|très\\s+)?bons?\\s+plans?${E}`, (m, det) => `${({ un: "une", le: "la", des: "des", les: "les", ce: "cette", mon: "ma", ton: "ta" })[det.toLowerCase()]} ${/^(?:des|les)$/i.test(det) ? "bonnes affaires" : "bonne affaire"}`],
    [`${S}(est|sont|était|étaient|suis|es|sommes|êtes)\\s+(?:complètement\\s+)?dans\\s+les\\s+choux${E}`, (m, verb) => `${({ est: "n'a", sont: "n'ont", était: "n'avait", étaient: "n'avaient", suis: "n'ai", es: "n'as", sommes: "n'avons", êtes: "n'avez" })[verb.toLowerCase()]} plus aucune chance`],
    [`${S}(?:une\\s+)?(?:vraie\\s+)?bonne\\s+pâte${E}`, "une personne très gentille"],
    [`${S}(?:la|cette)\\s+note\\s+(?=(?:du|de\\s+l['’]|au)\\s+(?:restaurant|resto|hôtel|bar|café)${E}|(?:était|est|a\\s+été|sera)\\s+(?:très\\s+|un\\s+peu\\s+|vraiment\\s+)?(?:salée|élevée|chère|corsée)${E})`, "la facture "],
    [`(?<=(?:addition|facture|note|douloureuse)[^.!?\\n]{0,30}(?:était|est|a\\s+été|sera)\\s+)(?:très\\s+|un\\s+peu\\s+|vraiment\\s+)?salée${E}`, "très chère"],
    [`${S}d['’]astreinte${E}`, "de garde"],
    [`${S}heures?\\s+sup(?![\\p{L}])`, (m) => (/^heures/i.test(m) ? "heures supplémentaires" : "heure supplémentaire")],
    [`${S}(?:une|la|votre|deuxième|troisième|dernière)?\\s*relances?\\s+de\\s+paiement${E}`, (m) => m.replace(/relances?\s+de\s+paiement/i, (r) => (/^relances/i.test(r) ? "rappels de paiement" : "rappel de paiement"))],
    [`(?<=(?:pleut|pluie|pleuvoir|averse|pleuvait)[^.!?\\n]{0,40})un\\s+pépin${E}`, "un parapluie"],
    [`${S}une\\s+(?:petite\\s+|grosse\\s+|bonne\\s+)?bouffe${E}`, "un repas"],
    [`${S}(on\\s+s['’]est|nous\\s+nous\\s+sommes|je\\s+me\\s+suis|ils\\s+se\\s+sont|elles\\s+se\\s+sont|tu\\s+t['’]es)\\s+fait\\s+un\\s+(ciné|cinéma|resto|restaurant|bowling|karaoké|concert|musée)${E}`, (m, who, what) => `${({ "on s'est": "on est allés", "on s’est": "on est allés", "nous nous sommes": "nous sommes allés", "je me suis": "je suis allé", "ils se sont": "ils sont allés", "elles se sont": "elles sont allées", "tu t'es": "tu es allé", "tu t’es": "tu es allé" })[who.toLowerCase().replace(/\s+/g, " ")]} ${({ ciné: "au cinéma", cinéma: "au cinéma", resto: "au restaurant", restaurant: "au restaurant", bowling: "au bowling", karaoké: "au karaoké", concert: "à un concert", musée: "au musée" })[what.toLowerCase()]}`],
    [`(?<=(?:coûte|coûtait|coûté|coûter|coûtent|prêter|prête|filer|file|payé|payer|paie|vaut|valait|gagné|gagne|donne|donné|rends|rendre|dois|doit|demande|pour|à)[^.!?\\n]{0,20}?)(\\d+|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|vingt|trente|cinquante|cent|mille|quelques)\\s+balles${E}`, "$1 euros"],
    [`${S}(\\d+|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|vingt|trente|cinquante|cent|mille|quelques)\\s+balles(?=\\s+(?:à\\s+me\\s+prêter|à\\s+prêter|à\\s+me\\s+filer|pour\\s+(?:le|la|un|une|manger|boire)|chacun|par\\s+mois|par\\s+jour|par\\s+personne|de\\s+l['’]heure|l['’]heure)${E})`, "$1 euros"],
    [`${S}magne-toi${E}`, "dépêche-toi"],
    [`${S}magnez-vous${E}`, "dépêchez-vous"],
    [`${S}(je|j['’]|tu|il|elle|on|nous|vous|ils|elles)\\s*(ai|as|a|avons|avez|ont|avais|avait)\\s+plus\\s+(un|une|aucun|aucune|rien|personne|le\\s+temps|envie|faim|soif|peur|le\\s+choix|la\\s+force|d['’]idée)${E}`, (m, who, aux, what) => `${/^j/i.test(who) ? "je" : who} n'${aux} plus ${what}`],
    [`${S}on\\s+se\\s+voit\\s+toujours\\s+(?=(?:samedi|dimanche|lundi|mardi|mercredi|jeudi|vendredi|demain|ce\\s+soir|ce\\s+week-end|cet\\s+après-midi)${E})`, "c'est toujours prévu "],
    [`${S}(m['’]|t['’]|l['’]|nous|vous|les)\\s*(a|as|ont|avez|avait)\\s+grillée?s?${E}`, (m, who, aux) => `${objectPronoun(who)}${aux} surpris`],
    [`${S}(?:c['’]est|quelle|c['’]était)\\s+la\\s+(?:hess|dèche|misère)${E}`, (m) => (/était/i.test(m) ? "j'étais fauché" : "je suis fauché")],
    [`${S}(s['’]est|se\\s+sont|me\\s+suis|t['’]es|nous\\s+sommes|vous\\s+êtes|on\\s+s['’]est)\\s+embrouillée?s?(?=\\s+(?:pour|avec|à\\s+cause)${E})`, (m, aux) => `${aux} disputés`],
    [`(?<=${S}pour\\s+)une\\s+connerie${E}`, "une bêtise"],
    [`${S}(faire|fais|fait|faites|faisait)\\s+le\\s+malin${E}`, (m, verb) => `${({ faire: "jouer", fais: "joues", fait: "joue", faites: "jouez", faisait: "jouait" })[verb.toLowerCase()]} au plus malin`],
    [`${S}(tu\\s+es|vous\\s+êtes|t['’]es)(${ADVERBS})\\s+lourde?s?(?=\\s*(?:[,.!?]|$)|\\s+(?:là|avec|quand)${E})`, "$1$2 pénible"],
    [`${S}(?:un|une|vrai|vraie|quel|sacré|gros)\\s+(?:vrai\\s+|gros\\s+)?boulet${E}`, "un vrai poids mort"],
    [`${AVOIR_J}${ADV}\\s+(?:la|une)\\s+(?:sacrée\\s+|bonne\\s+|grosse\\s+)?crève${E}`, (m, j, verb, adv) => `${j ? "j'" : ""}${verb}${adv ?? ""} un gros rhume`],
    [`${S}(?:ça|ca|sa)\\s+(?:me|m['’])\\s*(?:saoule|soûle|gave|gonfle|énerve|agace)\\s+de\\s+`, "je déteste "],
    [`${S}(s['’]est|se\\s+sont|me\\s+suis|t['’]es)\\s+pris\\s+une\\s+(?:sacrée\\s+|belle\\s+|grosse\\s+)?veste${E}`, (m, aux) => `${({ "s'est": "a", "s’est": "a", "se sont": "ont", "me suis": "ai", "t'es": "as", "t’es": "as" })[aux.toLowerCase().replace(/\s+/g, " ")]} été rejeté`],
    [`${S}(?:une\\s+)?bande\\s+de\\s+nazes${E}`, "bande de losers"],
    [`${S}(me|m['’]|te|lui|nous|vous|leur)\\s*faire\\s+suivre${E}`, (m, who) => `${({ "m'": "me", "m’": "me" })[who.toLowerCase()] ?? who} transférer`],
    [`${S}(mon|ton|son|votre|leur|un|en|l['’]|cet)\\s*arrêt\\s+de\\s+travail${E}`, (m, det) => `${/['’]$/.test(det) ? det : `${det} `}arrêt maladie`],
    [`(?<=${S}(?:colis|paquet|commande|livraison|lettre|courrier|meuble|article|recommandé)\\s+)(devait|devrait|doit|aurait\\s+dû|va)\\s+arriver${E}`, "$1 être livré"],
    [`${S}(mon|le|un|ton|votre|ce|du)\\s+prélèvement(?!\\s+(?:sanguin|de\\s+sang|d['’]échantillon|à\\s+la\\s+source|de\\s+salive))${E}`, "$1 prélèvement automatique"],
    [`${S}(fait|faire|faites|fais)\\s+opposition\\s+(?:sur|à)\\s+(ma|ta|sa|votre|notre|leur|la|cette|mon|ton|son)\\s+(carte|chèque|carte\\s+bancaire|carte\\s+bleue)${E}`, "$1 bloquer $2 $3"],
    [`(?<=${S}(?:à|vers|il\\s+est|il\\s+était|dès|avant|après|jusqu['’]à|entre)\\s+)(${FR_HOUR_WORDS}|vingt\\s+et\\s+une|vingt-et-une)\\s+heures?\\s+(cinquante-cinq|cinquante|quarante-cinq|quarante|trente-cinq|trente|vingt-cinq|vingt|quinze|dix|cinq)${E}`, (m, h, minutes) => {
        const word = h.toLowerCase().replace(/\s+/g, "-");
        const value = word === "vingt-et-une" ? 21 : FR_HOURS[word] ?? Number(word);
        const mm = { cinq: 5, dix: 10, quinze: 15, vingt: 20, "vingt-cinq": 25, trente: 30, "trente-cinq": 35, quarante: 40, "quarante-cinq": 45, cinquante: 50, "cinquante-cinq": 55 }[minutes.toLowerCase()];
        return Number.isFinite(value) && value <= 23 ? `${value}:${String(mm).padStart(2, "0")}` : m;
    }],
    // --- Argot et familier (verbes) ---
    [`${S}(bousill\\p{L}*)${E}`, (m) => m.toLowerCase().replace(/^bousill/, "abîm")],
    [`(?<=${S}(?:ma|ta|sa|leur|notre|votre|nouvelle|vieille|grosse|belle)\\s+)caisse(?=\\s*(?:[,.!?]|$)|\\s+(?:neuve|garée|rayée|toute\\s+neuve|devant\\s+chez|de\\s+sport)${E})`, "voiture"],
    [`(?<=${S}(?:on\\s+se\\s+fait|on\\s+se\\s+mange|se\\s+faire|manger|mange|prendre|prend|on\\s+prend|je\\s+prends|un\\s+petit)\\s+)un\\s+grec${E}`, "un kebab"],
    [`${S}piger${E}`, "comprendre"],
    [`${S}(pigé|pige|piges|pigez|pigent)${E}`, (m) => ({ pigé: "compris", pige: "comprends", piges: "comprends", pigez: "comprenez", pigent: "comprennent" })[m.toLowerCase()]],
    [`${S}(mat(?:er|e|es|ent|é|ais|ait))\\s+(?=(?:un|une|le|la|les|des|ce|cette|mon|ton|son)\\s+(?:film|série|séries|match|télé|vidéo|vidéos|épisode|émission|filles|mecs|meufs)${E})`, (m, verb) => `${verb.toLowerCase().replace(/^mat/, "regard")} `],
    // --- Langage SMS et oral ---
    [`${S}(le\\s+temps|tps)\\s+(?:la|là)(?=\\s*[,.!?]|\\s*$)`, "le temps maintenant"],
    [`${S}(?:ça|ca|sa)\\s+(?:ne\\s+)?capte\\s+(?:pas|plus|rien|mal)${E}`, "je n'ai pas de signal"],
    [`${S}bien\\s+ou\\s+quoi(?=\\s*\\?)`, "comment ça va"],
    [`${S}(?:ça|ca|sa)\\s+va\\s+ou\\s+quoi(?=\\s*\\?)`, "comment ça va"],
    [`${S}(viens|venez|passe|passez)\\s+à\\s+la\\s+maison(?=\\s*[!.,]|\\s*$|\\s+(?:ce|demain|samedi|dimanche|si|quand|après)${E})`, "$1 chez moi"],
    [`(?<=^\\s*|[.!?]\\s+)petite\\s+question(?=\\s*[:,!?.])`, "une question rapide"],
    [`${S}trop\\s+(fier|fière|fiers|fières|heureux|heureuse|heureuses|triste|tristes|déçu|déçue|fatigué|fatiguée|content|contente|pressé|pressée|impatient|impatiente)\\s+(?=de|d['’]|que|qu['’])`, "tellement $1 "],
    [`${S}(?:la\\s+)?double\\s+authentification${E}`, "l'authentification à deux facteurs"],
    [`${S}(?:la\\s+)?double\\s+(?:facteur|vérification)${E}`, "l'authentification à deux facteurs"],
    // --- Faux amis et vie courante ---
    [`${S}éventuellement${E}`, "peut-être"],
    [`${S}de\\s+la\\s+monnaie\\s+sur\\s+(?=\\d)`, "de la monnaie pour "],
    [`${S}(passé|passer|passe|passes|passera|passerai|repasser|repasse)\\s+(mon|ton|son|le|notre|votre|leur)\\s+permis(?:\\s+de\\s+conduire)?${E}`, (m, verb, det) => `${({ passé: "fait", passer: "faire", passe: "fais", passes: "fais", passera: "fera", passerai: "ferai", repasser: "refaire", repasse: "refais" })[verb.toLowerCase()]} ${det.toLowerCase() === "le" ? "l'" : `${det} `}examen de conduite`],
    [`${S}(\\d+|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|quelques|plusieurs)\\s+kilos${E}`, "$1 kilogrammes"],
    [`${S}un\\s+kilo(?=\\s+(?:de|d['’])|\\s*[,.!?]|\\s*$)`, "un kilogramme"],
    [`(?<=^\\s*|[.!?,;]\\s+)on\\s+sonne(?:\\s+à\\s+la\\s+porte)?(?=\\s*[,.!?;]|\\s+[-—])`, "quelqu'un sonne à la porte"],
    [`${S}se\\s+boi(t|vent)\\s+(?:bien\\s+|très\\s+)?(?:frais|fraîche|fraîches|froid|froids)${E}`, (m, ending) => (ending === "t" ? "doit être servi bien froid" : "doivent être servis bien froids")],
    [`${S}(vous\\s+êtes|vous\\s+serez|vous\\s+étiez|on\\s+est|on\\s+sera|on\\s+était|nous\\s+sommes|nous\\s+serons|ils\\s+sont|elles\\s+sont|ils\\s+seront)\\s+combien(?=\\s*\\?)`, (m, who) => `combien de personnes ${({ "vous êtes": "êtes-vous", "vous serez": "serez-vous", "vous étiez": "étiez-vous", "on est": "sommes-nous", "on sera": "serons-nous", "on était": "étions-nous", "nous sommes": "sommes-nous", "nous serons": "serons-nous", "ils sont": "sont-ils", "elles sont": "sont-elles", "ils seront": "seront-ils" })[who.toLowerCase().replace(/\s+/g, " ")]}`],
    [`${S}(le|un|mon|faire\\s+le|fait\\s+le|fais\\s+le|refaire\\s+le)\\s+plein(?=\\s+(?:chez|à|au|ce|hier|aujourd|avant)${E}|\\s*[,.!?]|\\s*$)`, "$1 plein d'essence"],
    [`${S}(range|rangez|ranger|rangeons|rangé|ranges)\\s+(?=(?:ta|votre|sa|ma|leur|notre|la|tes|vos|ses|mes|leurs|les)\\s+(?:chambres?|bureau|pièce|maison|appartement|salle\\s+de\\s+jeux|placard)${E})`, (m, verb) => `${({ range: "nettoie", rangez: "nettoyez", ranger: "nettoyer", rangeons: "nettoyons", rangé: "nettoyé", ranges: "nettoies" })[verb.toLowerCase()]} `],
    [`${SJ}(ai|as|a|avons|avez|ont)\\s+pris\\s+froid${E}`, "$1 attrapé un rhume"],
    [`${S}prendre\\s+froid${E}`, "attraper un rhume"],
    [`${S}(batt\\p{L}*|mont\\p{L}*|fouett\\p{L}*)\\s+(les|des|deux|trois|quatre|\\d+)\\s+blancs(?:\\s+d['’](?:œ|oe)ufs?)?\\s+en\\s+neige(?:\\s+(?:bien\\s+|très\\s+)?ferme)?${E}`, "$1 $2 blancs d'œufs jusqu'à ce qu'ils soient fermes"],
    [`${S}(raté|manqué|loupé|perdu|gagné|évité|échappé|réussi)([^.!?,\\n]{0,40}?)\\s+de\\s+peu(?=\\s*[,.!?;]|\\s*$)`, "$1$2 de justesse"],
    [`${S}(le|un|du|au|en|ce|mon|notre|leur|les|des|ces)\\s+car(s?)(?![\\p{L}\\p{N}'’-])(?!\\s+(?:je|tu|il|elle|on|nous|vous|ils|elles|c['’]|ça|j['’]|la|le|les)${E})`, (m, det, s) => `${({ le: "l'", du: "de l'", au: "à l'", ce: "cet" })[det.toLowerCase()] ?? `${det} `}autocar${s}`],
    // --- Bureau, banque, informatique ---
    [`${S}(mon|ma|ton|ta|son|sa|notre|votre|leur|le|la|du|au|un|une|mes|tes|ses|nos|vos|leurs|les|des)\\s+N\\s*\\+\\s*1(?![\\p{N}])`, (m, det) => `${det} ${/s$/i.test(det) ? "responsables" : "responsable"}`],
    [`${S}visio(s?)${E}`, "visioconférence$1"],
    [`${S}(mes|tes|ses|nos|vos|leurs|les|des|en|de|mes\\s+premiers|mes\\s+prochains)\\s+congés(?!\\s+(?:payés|maladie|maternité|paternité|parental|sans\\s+solde|sabbatiques?))${E}`, "$1 vacances"],
    [`${S}(un|une|des|mes|deux|trois|\\d+)\\s+RTT${E}`, (m, det) => `${det} ${/^(un|une)$/i.test(det) ? "jour" : "jours"} de congé`],
    [`${S}(boucl\\p{L}*)\\s+(?=(?:ce|le|un|mon|ton|son|notre|votre|leur|les|mes|ces|cette|la)\\s+(?:dossiers?|projets?|rapport|budget|travail|chantier|affaire|mission|présentation)${E})`, (m, verb) => `${verb.toLowerCase().replace(/^boucl/, "termin")} `],
    [`${S}(?:un|l['’]|cet|son|mon|votre|d['’])\\s*avis\\s+de\\s+passage${E}`, (m) => m.replace(/avis\s+de\s+passage/i, "avis de livraison")],
    [`${S}(est|suis|es|sont|était|sera|être|soit|reste|restera)\\s+(?:à|a|en)\\s+découvert${E}`, "$1 dans le rouge"],
    [`${S}compost(er|ez|e|es|é|ée|és|ées|ons|ent)\\s+(?=(?:votre|ton|son|le|mon|leur|vos|tes|les|ses|mes|leurs|un|son)\\s+(?:billets?|tickets?|titres?\\s+de\\s+transport)${E})`, "valid$1 "],
    [`(?<=(?:mise\\s+à\\s+jour|mises\\s+à\\s+jour|modifications?|changements?|paramètres?|réglages?)[^.!?\\n]{0,30}?)(soit|soient|est|sont|sera|seront)\\s+pris(e?s?)\\s+en\\s+compte${E}`, "$1 appliqué$2"],
    [`${S}je\\s+vous\\s+saurais\\s+gré\\s+de\\s+(?:bien\\s+vouloir\\s+)?`, "je vous serais reconnaissant de "],
    [`${S}(contacter|contacte|écrire|écris|appeler|appelle|joindre|écrivons|contactons)\\s+de\\s+la\\s+part\\s+de${E}`, "$1 au nom de"],
    [`(?<![\\p{L}\\p{N}_'’]|(?:la|le|les|une|un|en|de|sur|à|au|des|ma|ta|sa|cette|du)\\s)(lun|mar|mer|jeu|ven|sam|dim)\\.(?=\\s*(?:[-–—/]|au\\s|à\\s|\\d))`, (m, day) => ({ lun: "lundi", mar: "mardi", mer: "mercredi", jeu: "jeudi", ven: "vendredi", sam: "samedi", dim: "dimanche" })[day.toLowerCase()]],
    [`(?<=^\\s*(?:coucou|salut|bonjour|bonsoir|hello|hey|yo|wesh))\\s*,?\\s*(?:ça|ca|sa)\\s+va(?=\\s*\\?)`, ", comment ça va"],
    [`(?<=^\\s*|[.!?]\\s+)rendez-vous\\s+(?=\\d{1,2}\\s?h(?![\\p{L}]))`, "on se retrouve à "],
    [`(?<=^\\s*|[.!?]\\s+)(on\\s+se\\s+retrouve|on\\s+se\\s+voit|retrouve-moi|retrouvez-moi)\\s+(?=\\d{1,2}\\s?h(?![\\p{L}]))`, "$1 à "],
    // « Ce dernier retard » : le modèle comprend « le dernier » (« the last one ») et perd le nom.
    [`(?<=^\\s*|[.!?]\\s+)(ce|cette)\\s+(dernier|dernière)\\s+(?=(?:retard|incident|problème|bug|oubli|erreur|panne|mensonge|coup|rebondissement|échec|refus|message|mail|courriel|appel|épisode)${E})`, (m, det) => `${det} nouve${/^cette$/i.test(det) ? "lle" : "au"} `],
    [`${S}(il|elle|tu|vous|ils|elles|ce\\s+mec|cette\\s+meuf|ce\\s+type)\\s+(?:me|m['’])\\s*(soule|saoule|soûle|gave|gonfle|saoulent|soûlent|soulent|gavent|gonflent)${E}`, (m, who, verb) => `${who} ${/nt$/i.test(verb) ? "me tapent" : /^vous$/i.test(who) ? "me tapez" : /^tu$/i.test(who) ? "me tapes" : "me tape"} sur les nerfs`],
    // --- Heures à la française ---
    // Midi et minuit sont toujours des heures ; « deux heures et demie » seulement après « à », « il
    // est », « vers »… (« pendant deux heures et demie » est une durée).
    [`${S}(midi|minuit)\\s+(et\\s+quart|et\\s+demie?|moins\\s+le\\s+quart|moins\\s+vingt-cinq|moins\\s+vingt|moins\\s+dix|moins\\s+cinq)${E}`, frenchClock],
    [`(?<=${S}(?:à|il\\s+est|il\\s+était|il\\s+sera|vers|dès|avant|après|jusqu['’]à|entre)\\s+)(${FR_HOUR_WORDS})\\s+heures?\\s+(et\\s+quart|et\\s+demie?|moins\\s+le\\s+quart|moins\\s+vingt-cinq|moins\\s+vingt|moins\\s+dix|moins\\s+cinq)${E}`, frenchClock],
    [`${S}(?:à\\s+)?(\\d{1,2})\\s?h(?:eures?)?(?:\\s?(\\d\\d))?\\s+(?:précises|pile|tapantes|pétantes|précise)${E}`, (m, h, mm) => `${/^à/i.test(m) ? "à " : ""}exactement ${h} h${mm ? ` ${mm}` : ""}`],
    [`${S}(?:à\\s+)?midi\\s+(?:pile|précis|tapant)${E}`, (m) => `${/^à/i.test(m) ? "à " : ""}exactement midi`],
    [`${S}(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\\s+en\\s+huit${E}`, "$1 de la semaine prochaine"],
    [`${S}(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\\s+en\\s+quinze${E}`, "$1 dans deux semaines"],
    [`(?<![\\p{N}:,.])([01]?\\d|2[0-3])h(?![\\p{L}\\p{N}])`, "$1 h"],
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
    [`${SJ}(avoir|ai|as|a|avons|avez|ont|avais|avait)\\s+d['’]autres\\s+chats\\s+à\\s+fouetter${E}`, "$1 des choses plus importantes à faire"],
    [`${S}(?:il\\s+y\\s+a\\s+|y\\s+a\\s+)anguille\\s+sous\\s+roche${E}`, "il y a quelque chose de louche"],
    [`${S}(poser|pose|poses|posez|posé)\\s+une\\s+colle${E}`, "$1 une question difficile"],
    [`${S}(?:en\\s+)?un\\s+clin\\s+d['’]œil${E}`, "très vite"],
    [`${S}(?:c['’]est|ce\\s+n['’]est)\\s+pas\\s+(?:ma|ta|sa)\\s+tasse\\s+de\\s+thé${E}`, "ce n'est pas mon truc"],
    [`${S}(?:il\\s+(?:n['’])?y\\s+a\\s+|y\\s+a\\s+)pas\\s+photo${E}`, "c'est évident"],
    [`${S}(?:ça|ca)\\s+(?:caille|pèle)${E}`, "il fait très froid"],
    [`${S}(?:il\\s+)?(fait|faisait|fera)\\s+un\\s+(?:temps\\s+de\\s+chien|temps\\s+de\\s+cochon|temps\\s+pourri|sale\\s+temps|temps\\s+de\\s+merde)${E}`, (m, verb) => ({ fait: "la météo est horrible", faisait: "la météo était horrible", fera: "la météo sera horrible" })[verb.toLowerCase()]],
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
    [`${S}(?:il\\s+ne\\s+faut\\s+pas|faut\\s+pas)\\s+pousser\\s+mémé\\s+dans\\s+les\\s+orties${E}`, "il ne faut pas aller trop loin"],
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
    [`${S}(c['’]est|c['’]était)\\s+du\\s+(?:pipeau|vent)${E}`, "$1 des mensonges"],
    [`${S}(c['’]est|c['’]était)\\s+du\\s+(?:flan|bidon)${E}`, "$1 faux"],
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
    [`(?<=^\\s*|[.!?,]\\s+)c['’]est\\s+mort(?=\\s*[,.!])`, "c'est fichu"],
    [`${S}(?:ça|ca|cela)\\s+(me|m['’]|te|t['’]|nous|vous)\\s*a\\s+(?:donné|fait)\\s+froid\\s+dans\\s+le\\s+dos${E}`, (m, who) => `ça ${({ "m'": "m'", "m’": "m'", me: "m'", "t'": "t'", "t’": "t'", te: "t'" })[who.toLowerCase()] ?? `${who} `}a donné des frissons`],
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
    [`${S}on\\s+se\\s+capte${E}`, "on se voit"],
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
    [`(?<=^\\s*|[.!?]\\s+)(pense|pensez)\\s+à\\s+(?=(\\p{L})\\p{L}*(?:er|ir|re|oir)${E})`, (m, verb, letter) => `${/ez$/i.test(verb) ? "n'oubliez pas" : "n'oublie pas"} ${/[aeéèêiouyh]/i.test(letter) ? "d'" : "de "}`],
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
    [`${AVOIR_J}${ADV}\\s+(?:un\\s+)?(?:gros\\s+|sacré\\s+|petit\\s+|bon\\s+|vrai\\s+)?coup\\s+de\\s+(?:barre|mou|pompe)${E}`, asEtre("très fatigué")],
    [`${SUBJECT}(${AVOIR})\\s+le\\s+seum${E}`, avoirToEtre("très déçu")],
    [`(${SJ}(?:${AVOIR})\\s+)(?:trop\\s+|grave\\s+|vraiment\\s+|carrément\\s+)?(?:la\\s+dalle|les\\s+crocs)${E}`, "$1très faim"],
    [`(${SJ}(?:${AVOIR})\\s+)la\\s+flemme${E}`, "$1aucune envie"],
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
    // Élision après les paraphrases (« de éviter » → « d'éviter »).
    [`${S}(de|que|ne|je|me|te|se|le|la)\\s+(?=(?:éviter|exagér\\p{L}*|abîm\\p{L}*|ignor\\p{L}*|attrap\\p{L}*|impressionn\\p{L}*|endoss\\p{L}*|utilis\\p{L}*|inquiét\\p{L}*|inquièt\\p{L}*|énerv\\p{L}*|embrass\\p{L}*|affol\\p{L}*|amus\\p{L}*|habill\\p{L}*|étal\\p{L}*|abandonn\\p{L}*|activer|accéder|aller)${E})`, (m, word) => `${word.slice(0, -1)}'`],
]);

// ===================================================================================
// Anglais, avant traduction vers le français
// ===================================================================================

const EN_SMS = {
    pls: "please", plz: "please", plse: "please", plsss: "please", thx: "thanks", thnx: "thanks", tnx: "thanks",
    thanx: "thanks", tysm: "thank you so much", btw: "by the way", idk: "I don't know", idc: "I don't care",
    imo: "in my opinion", imho: "in my opinion", tbh: "to be honest", brb: "I'll be right back,", omg: "oh my God",
    lmao: "lol", lmfao: "lol", rofl: "lol", fyi: "for your information", afaik: "as far as I know",
    irl: "in real life", nvm: "never mind", ttyl: "I'll talk to you later", gtg: "I have to go", g2g: "I have to go",
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
    lmk: "let me know", ngl: "to be honest", tbf: "to be fair", istg: "I swear to God", fml: "my life sucks",
    idgaf: "I don't give a fuck", gtfo: "get the fuck out",
    // Ajouts du 06/11/2026.
    hmu: "call me", wyd: "what are you doing", nbd: "it's not serious", tmi: "too much information",
    ily: "I love you", ilysm: "I love you so much", ily2: "I love you too", imy: "I miss you", gn: "good night", gm: "good morning", wont: "won't",
    cya: "see you", l8r: "later", gr8: "great", m8: "mate", txt: "text", ttys: "talk to you soon", yw: "you're welcome",
    hbd: "happy birthday", xoxo: "kisses", jw: "just wondering", wdym: "what do you mean", dw: "don't worry",
    smh: "unbelievable", idts: "I don't think so", otw: "on the way", bff: "best friend", bf: "boyfriend", gf: "girlfriend",
    bae: "my love", fomo: "fear of missing out", yolo: "you only live once", tryna: "trying to", finna: "going to",
    imma: "I'm going to", ima: "I'm going to", whatcha: "what are you", "c'mon": "come on", cmon: "come on",
    outta: "out of", lotta: "lot of", "y'know": "you know", whatevs: "whatever", whatev: "whatever", "w/e": "whatever",
    obvs: "obviously", deets: "details", vacay: "vacation", fave: "favorite", fav: "favorite",
    smth: "something", sth: "something", luv: "love", nite: "night", frfr: "seriously", highkey: "really",
    lowkey: "kind of", "jk jk": "just kidding",
    pto: "time off", wfh: "working from home", eod: "end of day", tbd: "to be determined", lgtm: "looks good to me",
    rsvp: "confirm your attendance", byob: "bring your own drinks", fwiw: "for what it's worth",
    "tl;dr": "in short", tldr: "in short", nsfw: "not appropriate for work",
};
const EN_SKIP_UPPER = new Set(["IM", "DEF", "PROB", "PIC", "PICS", "MSG", "ABT", "OFC", "BOUT", "GM", "GF", "BF", "JW", "DW", "TXT", "FAV", "Ima", "IMA"]);
// Sigles qu'on écrit d'ordinaire en capitales : leur développement n'est pas mis en capitales
// (« my BFF » → « my best friend », pas « my BEST FRIEND »).
const EN_ACRONYMS = new Set(["BFF", "FOMO", "YOLO", "TMI", "ILY", "ILYSM", "IMY", "HBD", "WDYM", "IDK", "IDC", "TBH", "IMO", "IMHO", "BTW", "FYI", "OMG", "ASAP", "BRB", "TTYL", "IRL", "NVM", "AFAIK", "SMH", "NGL", "LMK", "TBF", "WYD", "HMU", "NBD", "GTG", "IKR", "JK", "IDTS", "TTYS", "PTO", "WFH", "EOD", "TBD", "LGTM", "RSVP", "BYOB", "FWIW", "TLDR", "TL;DR", "NSFW", "IRL"]);

function enSms(text) {
    return replaceWords(text, EN_SMS, { skipUpper: EN_SKIP_UPPER, acronyms: EN_ACRONYMS })
        // « i » seul : I (pas dans « i.e. », « i) », « i-th »).
        .replace(/(?<![\p{L}\p{N}_'’.-])i(?=\s|['’](?:m|ve|ll|d)(?![\p{L}])|[,!?]|$)/gu, "I")
        // « u » et « r » : you / are (« r u ok », « how r u », « thank u »).
        .replace(/(?<![\p{L}\p{N}_'’-])u(?![\p{L}\p{N}_'’-])/gu, "you")
        .replace(/(?<![\p{L}\p{N}_'’-])r(?=\s+(?:you|we|they|the|these|those|there|all|so|not|going|coming|ready|ok|OK|done|sure|free|busy|home|here)(?![\p{L}]))/gu, "are")
        .replace(/(?<=(?<![\p{L}])(?:you|we|they|how|where|what|who|when|why)\s+)r(?![\p{L}\p{N}_'’-])/giu, "are")
        // « ur » : you're devant un adjectif, your sinon.
        .replace(/(?<![\p{L}\p{N}_'’-])ur(?=\s+(?:welcome|right|wrong|the\s+best|so|not|going|kidding|joking|amazing|awesome|great|late|early|sure|ready|done|free|busy|crazy|funny|sweet|kind|always|never|still|just|probably|coming|being|doing|making|lucky|wrong)(?![\p{L}]))/giu, (m) => keepCase("you're", m))
        // « ur talking about » : you're devant un verbe en -ing (pas « ur wedding »).
        .replace(/(?<![\p{L}\p{N}_'’-])ur(?=\s+(?:talking|saying|doing|going|coming|being|asking|thinking|getting|making|telling|trying|leaving|working|joking|kidding|lying|playing|eating|watching|looking|waiting|sleeping|driving|reading|calling|texting|acting|messing|freaking|overthinking|overreacting)(?![\p{L}]))/giu, (m) => keepCase("you're", m))
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
        .replace(/(?<![\p{L}\p{N}_'’-])w\/(?=\s)/giu, "with")
        // « fr fr », « no cap » : sérieusement.
        .replace(/(?<![\p{L}\p{N}_'’-])(?:fr\s+fr|no\s+cap)(?:\s*,)?(?=\s+\p{L})/giu, (m) => keepCase("frankly,", m))
        .replace(/(?<![\p{L}\p{N}_'’-])(?:fr\s+fr|no\s+cap)(?=\s*[.!?]|\s*$)/giu, (m) => keepCase("frankly", m))
        // « but like why… » : « like » de remplissage.
        .replace(/(?<=(?<![\p{L}])(?:but|and|so|or)\s+)like\s+(?=(?:why|what|how|when|where|who|seriously|really|totally|literally)(?![\p{L}]))/giu, "")
        // « ill call u » : I'll ; « id love to » : I'd.
        .replace(/(?<![\p{L}\p{N}_'’-])ill(?=\s+(?:call|text|be|see|send|do|let|get|ask|check|try|come|go|make|take|tell|talk|meet|pick|bring|have|need|wait|write|pay|buy|keep|look|think|email|ping|message|ttyl|stop|leave|drive|grab|show|explain|fix|join)(?![\p{L}]))/gu, "I'll")
        .replace(/(?<![\p{L}\p{N}_'’-])id(?=\s+(?:love|like|rather|prefer|be|have|go|say|never|better|do)(?![\p{L}]))/gu, "I'd")
        .replace(/(I['’]ll be right back),(?=\s*(?:[.!?]|$))/gu, "$1")
        // « gotta run », « have to run » : partir.
        .replace(/(?<![\p{L}])(have\s+to|got\s+to|need\s+to)\s+run(?=\s*[,.!]|\s*$)/giu, "$1 go")
        // « …, gotta go » en début de proposition : « I have to go ».
        .replace(/(?<=(?:^|[.!?,;])\s*)(?:have\s+to|got\s+to)(?=\s+\p{L})/giu, (m) => (/^h/i.test(m) ? "I have to" : "I have to"))
        // « your choice » seul : « you choose ».
        .replace(/(?<=^\s*|[.,!?;]\s*)(?:your|ur)\s+(?:choice|call)(?=\s*[.!]|\s*$)/giu, (m) => keepCase("you choose", m));
}

const COPULA = "(?:is|['’]s|was|be|been|are|['’]re|were|looks|seems|sounds|seemed|looked|sounded)";

const HOURS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const hour = (h) => HOURS[h.toLowerCase()] ?? Number(h);
const SUBJECT_HAVE = { "we're": "we have", "we are": "we have", "i'm": "I have", "i am": "I have", "you're": "you have", "you are": "you have", "they're": "they have", "they are": "they have" };

const EN_OBJECT = { my: "me", your: "you", his: "him", her: "her", our: "us", their: "them" };
// Modal ou négation devant le verbe : la paraphrase reste à l'infinitif (« don't let the cat out of
// the bag » → « don't reveal the secret »), sinon elle passe au passé (« she let… » → « she revealed… »).
const BASE_BEFORE = "((?:don['’]t|do\\s+not|didn['’]t|did\\s+not|never|to|will|['’]ll|can|can['’]t|could|would|should|might|must|let['’]s|please)\\s+)?";

const EN_RULES = compile([
    // « since he was six » : le modèle invente un mot (« depuis l'heize », « dix ana ») ; avec
    // « years old », il traduit bien (« depuis l'âge de six ans »).
    [`${S}(since\\s+(?:I|you|he|she|we|they)\\s+(?:was|were)\\s+(?:\\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety))(?!\\s*(?:years|months|weeks|days|hours|minutes|o['’]clock|percent|%|[\\p{L}\\p{N}-]))`, "$1 years old"],
    // --- Expressions figées et proverbes (06/11/2026) : tournure simple, ou équivalent français mot
    // à mot (« when pigs fly » → « when hens have teeth » → « quand les poules auront des dents »).
    [`${S}${BASE_BEFORE}(let|lets|letting)\\s+the\\s+cat\\s+out\\s+of\\s+the\\s+bag${E}`, (m, base, verb) => `${base ?? ""}${base ? "reveal" : ({ let: "revealed", lets: "reveals", letting: "revealing" })[verb.toLowerCase()]} the secret`],
    [`(all\\s+(?:your|my|our|their|his|her|the)\\s+eggs\\s+in\\s+)one\\s+basket${E}`, "$1the same basket"],
    [`(?<=(?:I['’]m|I\\s+am|you['’]re|you\\s+are|we['’]re|we\\s+are|they['’]re|they\\s+are|he['’]s|she['’]s|I\\s+was|still|kind\\s+of|a\\s+bit)\\s+)on\\s+the\\s+fence${E}`, "undecided"],
    [`${S}(?:sitting|sit)\\s+on\\s+the\\s+fence(?=\\s+(?:about|regarding|over|whether|on\\s+whether)${E})`, "being undecided"],
    [`${S}(?:the\\s+ball\\s+is|the\\s+ball['’]s)\\s+in\\s+(your|my|his|her|our|their)\\s+court${E}`, (m, pos) => `it is ${pos.toLowerCase()} turn to decide`],
    [`${S}(has|have|had|['’]s\\s+got|['’]ve\\s+got|got)\\s+a\\s+(?:big\\s+|huge\\s+|real\\s+)?chip\\s+on\\s+(?:her|his|my|your|their|our)\\s+shoulders?(?=\\s+(?:since|ever\\s+since|for)${E})`, (m, verb) => `${/^had$/i.test(verb) ? "had" : /^(?:have|['’]ve\s+got)$/i.test(verb) ? "have" : "has"} held a grudge`],
    [`${S}(has|have|had|['’]s\\s+got|['’]ve\\s+got|got)\\s+a\\s+(?:big\\s+|huge\\s+|real\\s+)?chip\\s+on\\s+(?:her|his|my|your|their|our)\\s+shoulders?${E}`, (m, verb) => `${/^had$/i.test(verb) ? "held" : /^(?:have|['’]ve\s+got)$/i.test(verb) ? "hold" : "holds"} a grudge`],
    [`(?<=^\\s*|[.!?;]\\s+)bite\\s+the\\s+bullet\\s+and\\s+`, "be brave: "],
    [`${S}(bite|bit|biting|bites)\\s+the\\s+bullet${E}`, (m, verb) => `${({ bite: "find", bit: "found", biting: "finding", bites: "finds" })[verb.toLowerCase()]} the courage`],
    [`${S}judge\\s+a\\s+book\\s+by\\s+its\\s+cover${E}`, "judge people by their appearance"],
    [`${S}(get|got|getting|gets|gotten)\\s+cold\\s+feet${E}`, (m, verb) => `${verb} scared`],
    [`${S}(has|have|had|having)\\s+cold\\s+feet${E}`, "$1 doubts"],
    [`${S}a\\s+blessing\\s+in\\s+disguise${E}`, "for the best"],
    [`${S}(?:all\\s+)?water\\s+under\\s+the\\s+bridge${E}`, "in the past"],
    [`${S}hold\\s+your\\s+horses${E}`, "not so fast"],
    [`${S}the\\s+apple\\s+of\\s+((?:my|his|her|our|their|your)\\s+[\\p{L}-]+['’]s|\\p{Lu}[\\p{L}-]+['’]s)\\s+eyes?${E}`, "$1 favorite"],
    [`${S}curiosity\\s+killed\\s+the\\s+cat${E}`, "curiosity is a bad flaw"],
    [`${S}actions\\s+speak\\s+louder\\s+than\\s+words${E}`, "actions count more than words"],
    [`${S}(can['’]t|cannot|can\\s+not|couldn['’]t|won['’]t)\\s+have\\s+(?:your|his|her|their|our|my)\\s+cake\\s+and\\s+eat\\s+it(?:\\s*,?\\s*too)?${E}`, "$1 have everything"],
    [`${S}(want|wants|wanted|wanting)\\s+to\\s+have\\s+(?:your|his|her|their|our|my)\\s+cake\\s+and\\s+eat\\s+it(?:\\s*,?\\s*too)?${E}`, "$1 everything"],
    [`${S}(?:it['’]s\\s+|it\\s+is\\s+)?six\\s+of\\s+one(?:\\s*,|\\s+and)?\\s+half\\s+a\\s+dozen\\s+of\\s+the\\s+other${E}`, "it's exactly the same thing"],
    [`${S}(has|have|had|['’]ve\\s+got|['’]s\\s+got|got)\\s+(?:a\\s+)?(?:real\\s+|big\\s+|huge\\s+|massive\\s+|serious\\s+|terrible\\s+)?sweet\\s+tooth${E}`, (m, verb) => `${/^had$/i.test(verb) ? "really loved" : /^(?:have|['’]ve\s+got)$/i.test(verb) ? "really love" : "really loves"} sweets`],
    [`${S}let\\s+sleeping\\s+dogs\\s+lie${E}`, "it's better not to wake a sleeping cat"],
    [`${S}every\\s+cloud\\s+has\\s+a\\s+silver\\s+lining${E}`, "every misfortune has a good side"],
    [`${S}the\\s+silver\\s+lining${E}`, "the good side"],
    [`${S}the\\s+early\\s+bird\\s+(?:catches|gets)\\s+the\\s+worm${E}`, "the future belongs to those who get up early"],
    [`${S}(?:an|the)\\s+early\\s+bird${E}`, (m) => m.replace(/bird$/i, "riser")],
    [`${S}(?:bigger|other|better)\\s+fish\\s+to\\s+fry${E}`, "more important things to do"],
    [`${S}when\\s+pigs\\s+(?:fly|can\\s+fly|will\\s+fly|start\\s+flying)${E}`, "when hens have teeth"],
    [`${S}(clean|cleans|cleaned|cleaning)\\s+(?:up\\s+)?(his|her|my|your|their|our|the)\\s+(room|bedroom)${E}`, (m, verb, pos, room) => `${({ clean: "tidy", cleans: "tidies", cleaned: "tidied", cleaning: "tidying" })[verb.toLowerCase()]} ${pos} ${room}`],
    [`${S}(?:(I|you|he|she|we|they)\\s+)?(bit|bite|bites|biting|bitten)\\s+off\\s+more\\s+than\\s+(?:I|you|he|she|we|they|one)\\s+(?:can|could)\\s+chew${E}`, (m, who, verb) => `${who ? `${who} ` : ""}${({ bit: /^(?:we|they|you)$/i.test(who ?? "") ? "were" : "was", bite: "be", bites: "is", biting: "being", bitten: "been" })[verb.toLowerCase()]} too ambitious`],
    [`(?<=(?:I['’]m|I\\s+am|is|['’]s|was|are|['’]re|were|be|been|feel|feeling)\\s+(?:a\\s+bit\\s+|so\\s+|really\\s+|totally\\s+)?)all\\s+thumbs${E}`, "clumsy"],
    [`(?:${S}(is|was|are|were|am)|(['’](?:s|re|m)))\\s+(?:a\\s+|such\\s+a\\s+)(?:total\\s+|real\\s+|complete\\s+|big\\s+)?couch\\s+potato(?:es)?${E}`, (m, full, short) => `${short ? " " : ""}${({ is: "spends", "'s": "spends", "’s": "spends", was: "spent", were: "spent", are: "spend", "'re": "spend", "’re": "spend", am: "spend", "'m": "spend", "’m": "spend" })[(full ?? short).toLowerCase()]} all day on the couch`],
    [`${S}couch\\s+potato(es)?${E}`, (m, es) => (es ? "lazy people glued to the TV" : "lazy person glued to the TV")],
    [`${S}spill\\s+the\\s+tea${E}`, "tell me everything"],
    [`${S}(?:that['’]s|that\\s+is|it['’]s)\\s+(?:just\\s+)?(?:the\\s+way|how)\\s+the\\s+cookie\\s+crumbles${E}`, "that's life"],
    [`${S}cold\\s+turkey${E}`, "all at once"],
    [`${S}${BASE_BEFORE}(cut|cuts|cutting)\\s+corners(\\s+on)?${E}`, (m, base, verb, on) => `${base ?? ""}${base ? "skimp" : ({ cut: "skimped", cuts: "skimps", cutting: "skimping" })[verb.toLowerCase()]} on ${on ? "" : "quality"}`.trimEnd()],
    [`${S}(paid|pay|pays|paying|work|works|worked|working|earn|earns|earned|earning|hired|employed)\\s+under\\s+the\\s+table${E}`, "$1 in cash, illegally"],
    [`${S}(burn|burned|burnt|burning|burns)\\s+the\\s+midnight\\s+oil${E}`, (m, verb) => `${({ burn: "work", burned: "worked", burnt: "worked", burning: "working", burns: "works" })[verb.toLowerCase()]} late into the night`],
    [`${S}(throw|threw|throwing|throws|thrown)\\s+(?:in\\s+the\\s+towel|the\\s+towel\\s+in)${E}`, (m, verb) => ({ throw: "give up", threw: "gave up", throwing: "giving up", throws: "gives up", thrown: "given up" })[verb.toLowerCase()]],
    [`${S}(?:let['’]s|we['’]ll|we\\s+will|I['’]ll|I\\s+will|we\\s+can|we\\s+should)\\s+cross\\s+that\\s+bridge\\s+when\\s+we\\s+(?:come|get)\\s+to\\s+it${E}`, "we'll see when we get there"],
    [`${S}(hit|hitting|hits)\\s+the\\s+books${E}`, (m, verb) => `${({ hit: "study", hitting: "studying", hits: "studies" })[verb.toLowerCase()]} hard`],
    [`${S}a\\s+dime\\s+a\\s+dozen${E}`, "very common"],
    [`(?<=(?:['’]re|are|is|['’]s|was|were|am|['’]m)\\s+)barking\\s+up\\s+the\\s+wrong\\s+tree${E}`, "on the wrong track"],
    [`${S}(beat|beating|beats)\\s+a\\s+dead\\s+horse${E}`, (m, verb) => `${({ beat: "waste", beating: "wasting", beats: "wastes" })[verb.toLowerCase()]} time on a lost cause`],
    [`${S}by\\s+the\\s+skin\\s+of\\s+(?:my|his|her|your|our|their)\\s+teeth${E}`, "narrowly"],
    [`${S}(cut|cutting)\\s+to\\s+the\\s+chase${E}`, (m, verb) => (/ing$/i.test(verb) ? "getting straight to the point" : "get straight to the point")],
    [`${S}in\\s+hot\\s+water${E}`, "in trouble"],
    [`${S}it\\s+takes\\s+two\\s+to\\s+tango${E}`, "both are responsible"],
    [`${S}(jump|jumping|jumped|jumps|get|getting|got|hop|hopping|hopped|climb|climbing)\\s+on\\s+(?:the|this)\\s+bandwagon${E}`, (m, verb) => `${/ing$/i.test(verb) ? "following" : /(?:ed|got)$/i.test(verb) ? "followed" : /s$/i.test(verb) ? "follows" : "follow"} the trend`],
    [`${S}(miss|missed|missing|misses)\\s+the\\s+boat${E}`, "$1 the opportunity"],
    [`${S}no\\s+pain\\s*,?\\s+no\\s+gain${E}`, "you get nothing without effort"],
    [`${S}on\\s+thin\\s+ice${E}`, "in a dangerous situation"],
    [`(?<=^\\s*|[.!?]\\s+)over\\s+my\\s+dead\\s+body(?=\\s*[!.]|\\s*$)`, "absolutely never"],
    [`${S}put\\s+a\\s+sock\\s+in\\s+it${E}`, "shut up"],
    [`${S}(see|saw|seeing|sees)\\s+eye\\s+to\\s+eye${E}`, (m, verb) => ({ see: "agree", saw: "agreed", seeing: "agreeing", sees: "agrees" })[verb.toLowerCase()]],
    [`${S}(stole|steal|steals|stealing|stolen)\\s+(my|your|his|her|our|their)\\s+thunder${E}`, (m, verb, pos) => `${verb} the spotlight from ${EN_OBJECT[pos.toLowerCase()]}`],
    [`${S}with\\s+a\\s+(?:grain|pinch)\\s+of\\s+salt${E}`, "with tweezers"],
    [`${S}time\\s+flies${E}`, "time passes very quickly"],
    [`${S}a\\s+wild\\s+goose\\s+chase${E}`, "a pointless search"],
    [`${S}a\\s+penny\\s+for\\s+your\\s+thoughts${E}`, "what are you thinking about"],
    [`${S}to\\s+add\\s+insult\\s+to\\s+injury${E}`, "to make matters worse"],
    [`${S}(bring|brings|brought|bringing)\\s+home\\s+the\\s+bacon${E}`, (m, verb) => `${({ bring: "earn", brings: "earns", brought: "earned", bringing: "earning" })[verb.toLowerCase()]} the family's money`],
    [`(?<=\\p{L}\\s)by\\s+the\\s+book(?=\\s*[,.!?]|\\s*$)`, "according to the rules"],
    [`${S}(?:cry|crying|cries)\\s+over\\s+spil(?:t|led)\\s+milk${E}`, (m) => (/ing$/i.test(m.split(/\s+/)[0]) ? "regretting the past" : "regret the past")],
    [`${S}(?:very\\s+|so\\s+|really\\s+)?down[-\\s]to[-\\s]earth${E}`, "very simple and realistic"],
    [`${S}(drive|drives|drove|driving|driven)\\s+(me|you|him|her|us|them)\\s+up\\s+the\\s+wall${E}`, "$1 $2 crazy"],
    [`${S}face\\s+the\\s+music${E}`, "accept the consequences"],
    [`${S}(get|gets|got|getting)\\s+a\\s+(?:real\\s+)?kick\\s+out\\s+of${E}`, (m, verb) => `really ${({ get: "enjoy", gets: "enjoys", got: "enjoyed", getting: "enjoying" })[verb.toLowerCase()]}`],
    [`${S}(give|gave|giving|gives|given)\\s+(me|you|him|her|us|them)\\s+the\\s+cold\\s+shoulder${E}`, (m, verb, who) => `${({ give: "ignore", gave: "ignored", giving: "ignoring", gives: "ignores", given: "ignored" })[verb.toLowerCase()]} ${who}`],
    [`${S}(go|goes|went|going|gone)\\s+down\\s+in\\s+flames${E}`, (m, verb) => `${({ go: "fail", goes: "fails", went: "failed", going: "failing", gone: "failed" })[verb.toLowerCase()]} miserably`],
    [`${S}let['’]s\\s+go\\s+Dutch${E}`, "let's each pay our share"],
    [`${S}(go|going|went)\\s+Dutch${E}`, (m, verb) => ({ go: "each pay our share", going: "each paying our share", went: "each paid our share" })[verb.toLowerCase()]],
    [`${S}head\\s+over\\s+heels(?:\\s+in\\s+love)?${E}`, "madly in love"],
    [`${S}(jump|jumped|jumping|jumps)\\s+the\\s+gun${E}`, (m, verb) => `${({ jump: "act", jumped: "acted", jumping: "acting", jumps: "acts" })[verb.toLowerCase()]} too quickly`],
    [`${S}(know|knows|knew|learn|learned|learning|learns|show|showed|showing|shows)\\s+(?:(me|you|him|her|us|them)\\s+)?the\\s+ropes${E}`, (m, verb, who) => `${verb} ${who ? `${who} ` : ""}how things work`],
    [`${S}(leave|left|leaving)\\s+no\\s+stone\\s+unturned${E}`, (m, verb) => `${({ leave: "try", left: "tried", leaving: "trying" })[verb.toLowerCase()]} everything`],
    [`${S}let\\s+(?:your|my|his|her|our|their)\\s+hair\\s+down${E}`, "relax and have fun"],
    [`(?<=(?:is|['’]s|are|['’]re|was|were)\\s+(?:really\\s+|always\\s+|so\\s+)?)on\\s+the\\s+ball(?=\\s*[,.!?]|\\s*$)`, "very efficient"],
    [`${S}at\\s+(\\d{1,2})(?::(\\d\\d))?\\s+(?:o['’]clock\\s+)?(?:on\\s+the\\s+dot|sharp)${E}`, (m, h, mm) => `at ${h}${mm ? `:${mm}` : " o'clock"}`],
    [`${S}out\\s+of\\s+the\\s+woods${E}`, "out of danger"],
    [`(?<=(?:is|['’]s|are|['’]re|was|were|be)\\s+(?:a\\s+bit\\s+|really\\s+|totally\\s+|completely\\s+|so\\s+|way\\s+)?)over\\s+the\\s+top(?=\\s*[,.!?]|\\s*$)`, "excessive"],
    [`${S}(shoot|shooting|shot)\\s+the\\s+breeze${E}`, (m, verb) => ({ shoot: "chat", shooting: "chatting", shot: "chatted" })[verb.toLowerCase()]],
    [`${S}the\\s+elephant\\s+in\\s+the\\s+room${E}`, "the obvious problem nobody talks about"],
    [`${S}the\\s+whole\\s+nine\\s+yards${E}`, "all the way"],
    [`${S}(threw|throw|throws|throwing|thrown)\\s+(me|you|him|her|us|them)\\s+under\\s+the\\s+bus${E}`, (m, verb, who) => `${({ threw: "betrayed", throw: "betray", throws: "betrays", throwing: "betraying", thrown: "betrayed" })[verb.toLowerCase()]} ${who}`],
    [`${S}(tie|tied|tying|ties)\\s+the\\s+knot${E}`, (m, verb) => `${({ tie: "get", tied: "got", tying: "getting", ties: "gets" })[verb.toLowerCase()]} married`],
    [`${S}through\\s+thick\\s+and\\s+thin${E}`, "in good times and bad"],
    [`(?<=(?:is|['’]s|are|['’]re|was|were)\\s+(?:still\\s+|all\\s+)?)up\\s+in\\s+the\\s+air(?=\\s*[,.!?]|\\s*$)`, "uncertain"],
    [`${S}wrap\\s+(?:my|your|his|her|our|their)\\s+(?:head|mind)\\s+around${E}`, "understand"],
    [`${S}at\\s+the\\s+drop\\s+of\\s+a\\s+hat${E}`, "without hesitation"],
    [`${S}(give|gave|giving|gives)\\s+(him|her|them|you)\\s+a\\s+piece\\s+of\\s+my\\s+mind${E}`, (m, verb, who) => `${({ give: "tell", gave: "told", giving: "telling", gives: "tells" })[verb.toLowerCase()]} ${who} exactly what I ${/^gave$/i.test(verb) ? "thought" : "think"}`],
    [`${S}let\\s+(it|this|that)\\s+slide${E}`, "drop $1"],
    [`(?<=(?:is|are|['’]s|['’]re|was|were)\\s+)on\\s+the\\s+house${E}`, "offered by the house"],
    [`${S}a\\s+storm\\s+in\\s+a\\s+(?:teacup|tea\\s+cup)${E}`, "a storm in a glass of water"],
    [`${S}(hit|hits|hitting)\\s+it\\s+off${E}`, (m, verb) => `${({ hit: "got along", hits: "gets along", hitting: "getting along" })[verb.toLowerCase()]} very well`],
    [`${S}a\\s+ballpark\\s+(?:figure|number|estimate)${E}`, "an approximate figure"],
    [`${S}back\\s+to\\s+the\\s+drawing\\s+board${E}`, "back to square one"],
    [`${S}get\\s+(your|his|her|their|our|my)\\s+act\\s+together${E}`, "get organized"],
    [`${S}sit\\s+tight${E}`, "wait here"],
    [`${S}(?:it['’]s|it\\s+is|that['’]s|this\\s+is)\\s+(?:all\\s+)?Greek\\s+to\\s+me${E}`, "it's Chinese to me"],
    [`${S}in\\s+the\\s+doghouse${E}`, "in disgrace"],
    [`${S}(pass|passing|passed|passes)\\s+the\\s+buck${E}`, (m, verb) => `${({ pass: "blame", passing: "blaming", passed: "blamed", passes: "blames" })[verb.toLowerCase()]} others`],
    [`${S}cut\\s+(me|him|her|them|us)\\s+some\\s+slack${E}`, "be less hard on $1"],
    [`${S}a\\s+tough\\s+cookie${E}`, "a very strong person"],
    [`${S}(?:to\\s+make\\s+a\\s+)?long\\s+story\\s+short${E}`, "in short"],
    [`${S}you\\s+get\\s+the\\s+picture${E}`, "you understand"],
    [`${S}(drop|dropped|dropping|drops)\\s+the\\s+ball${E}`, (m, verb) => `${({ drop: "make", dropped: "made", dropping: "making", drops: "makes" })[verb.toLowerCase()]} a mistake`],
    [`${S}the\\s+(?:last|final)\\s+straw${E}`, "the drop that makes the vase overflow"],
    [`${S}(?:you\\s+)?can['’]t\\s+teach\\s+an\\s+old\\s+dog\\s+new\\s+tricks${E}`, "it's hard to change your habits at a certain age"],
    [`${S}better\\s+safe\\s+than\\s+sorry${E}`, "it is better to be careful"],
    [`(?<=(?:feel|feeling|felt|feels)\\s+(?:a\\s+bit\\s+|a\\s+little\\s+|kind\\s+of\\s+|really\\s+)?)off(?=\\s*[,.!?]|\\s*$|\\s+(?:today|tonight|lately|this\\s+morning)${E})`, "unwell"],
    [`${S}in\\s+the\\s+nick\\s+of\\s+time${E}`, "just in time"],
    [`${S}(?:it['’]s|that['’]s|it\\s+is)\\s+a\\s+long\\s+shot${E}`, "it's unlikely"],
    [`${S}keep\\s+(?:your|my|his|her|our|their)\\s+eyes\\s+peeled${E}`, "keep your eyes open"],
    [`${S}out\\s+of\\s+the\\s+loop${E}`, "not informed"],
    [`${S}(pull|pulled|pulling|pulls)\\s+an\\s+all[-\\s]nighter${E}`, (m, verb) => `${({ pull: "stay", pulled: "stayed", pulling: "staying", pulls: "stays" })[verb.toLowerCase()]} up all night`],
    [`${S}rain\\s+on\\s+(?:my|your|his|her|our|their)\\s+parade${E}`, "spoil the fun"],
    [`${S}the\\s+real\\s+deal${E}`, "the real thing"],
    [`${S}a\\s+far\\s+cry\\s+from${E}`, "very different from"],
    [`${S}(?:as\\s+a\\s+)?rule\\s+of\\s+thumb${E}`, (m) => (/^as/i.test(m) ? "as a general rule" : "general rule")],
    [`(?<=\\p{L}\\s)hands\\s+down(?=\\s*[,.!?]|\\s*$)`, "without any doubt"],
    [`(?<=^\\s*|[.!?]\\s+)beats\\s+me(?=\\s*[,.!?]|\\s*$)`, "I have no idea"],
    [`${S}my\\s+lips\\s+are\\s+sealed${E}`, "I won't say anything"],
    [`${S}(?:has\\s+the\\s+)?cat\\s+got\\s+your\\s+tongue(?=\\s*\\?)`, "you're not saying anything"],
    [`(?<=^\\s*|[.!?]\\s+)keep\\s+it\\s+up(?=\\s*[,.!]|\\s*$)`, "continue like this"],
    [`(?<=^\\s*|[.!?]\\s+)you\\s+bet(?=\\s*[,.!]|\\s*$)`, "absolutely"],
    [`${S}(?:I['’]m|I\\s+am)\\s+game(?=\\s*[,.!]|\\s*$|\\s+for${E})`, "I'm up for it"],
    [`(?<=^\\s*|[.!?]\\s+)suit\\s+yourself(?=\\s*[,.!]|\\s*$)`, "do as you wish"],
    [`${S}fair\\s+and\\s+square${E}`, "honestly"],
    [`${S}the\\s+coast\\s+is\\s+clear${E}`, "nobody is around"],
    [`${S}the\\s+best\\s+thing\\s+since\\s+sliced\\s+bread${E}`, "the best invention in the world"],
    [`${S}(add|adding|added|adds)\\s+fuel\\s+to\\s+the\\s+(?:fire|flames)${E}`, (m, verb) => `${({ add: "pour", adding: "pouring", added: "poured", adds: "pours" })[verb.toLowerCase()]} oil on the fire`],
    [`${S}(burn|burned|burnt|burning|burns)\\s+(?:(?:his|her|my|your|our|their|all|the)\\s+)*bridges${E}`, (m, verb) => `${({ burn: "cut", burned: "cut", burnt: "cut", burning: "cutting", burns: "cuts" })[verb.toLowerCase()]} all ties`],
    [`${S}(?:come\\s+)?rain\\s+or\\s+shine${E}`, "whatever the weather"],
    [`${S}every\\s+dog\\s+has\\s+its\\s+day${E}`, "everyone has their moment of glory"],
    [`${S}like\\s+the\\s+back\\s+of\\s+(?:my|his|her|your|our|their)\\s+hands?${E}`, "by heart"],
    [`(?<=(?:['’]re|are|['’]s|is|['’]m|am|was|were|be|get|got|let\\s+(?:me|you|him|her|them|us))\\s+)off\\s+the\\s+hook(?=\\s*[,.!?]|\\s*$|\\s+(?:this|for|now)${E})`, "out of trouble"],
    [`${S}(?:(?:went|go|jumped|jump|going|jumping)\\s+)?out\\s+of\\s+the\\s+frying\\s+pan\\s+(?:and\\s+)?into\\s+the\\s+fire${E}`, (m) => `${/^(?:went|jumped)/i.test(m) ? "went " : /^going|^jumping/i.test(m) ? "going " : /^(?:go|jump)\s/i.test(m) ? "go " : ""}from bad to worse`],
    [`${S}(pay|paid|paying|pays)\\s+through\\s+the\\s+nose${E}`, "$1 a fortune"],
    [`${S}(pull|pulled|pulling|pulls)\\s+(?:some\\s+|a\\s+few\\s+)?strings${E}`, (m, verb) => `${({ pull: "use", pulled: "used", pulling: "using", pulls: "uses" })[verb.toLowerCase()]} contacts`],
    [`${S}(rub|rubbing|rubbed|rubs)\\s+salt\\s+(?:in|into)\\s+(?:the|my|his|her|your|an\\s+open)\\s+wounds?${E}`, (m, verb) => `${({ rub: "stir", rubbing: "stirring", rubbed: "stirred", rubs: "stirs" })[verb.toLowerCase()]} the knife in the wound`],
    [`${S}(?:through|on)\\s+the\\s+grapevine${E}`, "by word of mouth"],
    [`${S}your\\s+guess\\s+is\\s+as\\s+good\\s+as\\s+mine${E}`, "I have no idea either"],
    [`${S}(won['’]t|doesn['’]t|didn['’]t|will\\s+not|does\\s+not|wouldn['’]t|not|never)\\s+break\\s+the\\s+bank${E}`, "$1 cost a fortune"],
    [`${S}on\\s+a\\s+shoestring(?:\\s+budget)?${E}`, "on a very small budget"],
    [`${S}(?:the\\s+)?low[-\\s]hanging\\s+fruits?${E}`, "the easiest tasks"],
    [`${S}(won['’]t|doesn['’]t|didn['’]t|will\\s+not|does\\s+not|to|can|could|will|really)\\s+move\\s+the\\s+needle${E}`, "$1 make a real difference"],
    [`${S}(?:do\\s+|take\\s+|have\\s+)?a\\s+deep\\s+dive\\s+(?:on|into)${E}`, (m) => `${/^(do|take|have)/i.test(m) ? `${m.split(/\s+/)[0]} ` : ""}a detailed analysis of`],
    [`${S}(follow|following|followed|follows)\\s+up\\s+with${E}`, (m, verb) => `${({ follow: "get", following: "getting", followed: "got", follows: "gets" })[verb.toLowerCase()]} back in touch with`],
    [`(?<=(?:I|we|you|they|he|she)\\s+(?:don['’]t|do\\s+not|doesn['’]t|didn['’]t|won['’]t)\\s+(?:have|has)\\s+)(?:the\\s+|enough\\s+)?bandwidth${E}`, "the time"],
    [`${S}(let['’]s|we\\s+should|can\\s+we|we\\s+need\\s+to|we['’]ll)\\s+sync(?:\\s+up)?${E}`, "$1 have a quick meeting"],
    [`${S}(you|she|he|they|we)\\s+(?:totally\\s+|absolutely\\s+)?(?:slayed|slew)\\s+it${E}`, (m, who) => `${who} ${/^(?:he|she)$/i.test(who) ? "was" : "were"} amazing`],
    [`${S}(you['’]re|you\\s+are|she['’]s|he['’]s|they['’]re|we['’]re)\\s+(?:totally\\s+|absolutely\\s+|really\\s+)?(?:killing|slaying|crushing)\\s+it${E}`, "$1 doing an amazing job"],
    [`${S}the\\s+GOAT${E}`, "the greatest of all time"],
    [`(?<=^\\s*|[.!?]\\s+)bet(?=\\s*[,.!]|\\s*$)`, "OK"],
    [`(?<=(?:is|was|['’]s|so|looks|smells)\\s+)bussin['’g]?(?![\\p{L}])`, "really delicious"],
    [`(?<=(?:is|was|['’]s|so|kinda|pretty|really|lowkey|honestly)\\s+)mid(?=\\s*[,.!?]|\\s*$)`, "mediocre"],
    [`(?<=(?:I['’]m|I\\s+am|I\\s+was|we['’]re|she['’]s|he['’]s|we\\s+were)\\s+(?:so\\s+|totally\\s+|literally\\s+|still\\s+)?)shook${E}`, "in shock"],
    [`${S}(she|he|you|they)(['’]s|['’]re|\\s+is|\\s+are)\\s+(?:so\\s+|such\\s+|really\\s+|way\\s+too\\s+)extra(?=\\s*[,.!?]|\\s*$)`, (m, who) => `${who} always ${/^(?:she|he)$/i.test(who) ? "overdoes" : "overdo"} it`],
    [`(?<=(?:is|was|['’]s|so)\\s+)(?:straight\\s+)?fire(?=\\s*[,.!?🔥]|\\s*$)`, "amazing"],
    [`(?<=(?:is|was|['’]s|so|pretty|really)\\s+)dope(?=\\s*[,.!?]|\\s*$)`, "awesome"],
    [`${S}hella${E}`, "really"],
    [`(?<=(?:going\\s+to|gonna|gotta|have\\s+to|need\\s+to|I['’]ll|I\\s+will|might|should|to)\\s+)bail(?=\\s*[,.!?]|\\s*$|\\s+(?:early|now)${E})`, "leave"],
    [`${S}flaky\\s+(tests?|builds?|connection|network|wifi|wi-fi|internet)${E}`, "unstable $1"],
    [`(?<=(?:is|['’]s|so|are|['’]re|was|very|really|super|kinda)\\s+)flaky(?=\\s*[,.!?]|\\s*$|\\s+(?:he|she|they)${E})`, "unreliable"],
    [`${S}hangry${E}`, "irritable because I'm hungry"],
    [`(?<=(?:^|[.!?,]\\s*|ew\\s*,?\\s+|that['’]s\\s+|so\\s+|it['’]s\\s+|is\\s+|was\\s+))gross(?=\\s*[,.!?]|\\s*$)`, "disgusting"],
    [`(?<=(?:feel|feeling|felt|feels|am|['’]m|is|['’]s|was|look|looks|looked|so|really)\\s+)miserable${E}`, "really unhappy"],
    [`(?<=${S}(?:build|pipeline|CI|tests?|checks?))\\s+(is|are|was|were|['’]s)\\s+(?:all\\s+)?(green|red)(?=\\s*[,.!?;]|\\s*$|\\s+(?:again|now|today|on\\s+main|on\\s+master)${E})`, (m, verb, color) => {
        const past = /^w/i.test(verb);
        const plural = /^(?:are|were)$/i.test(verb);
        const pass = color.toLowerCase() === "green";
        return ` ${pass ? (past ? "passed" : plural ? "pass" : "passes") : (past ? "failed" : plural ? "fail" : "fails")}`;
    }],
    [`${S}(an?\\s+)?hot\\s*-?fix(es)?${E}`, (m, det, es) => `${det ? "an " : ""}urgent fix${es ?? ""}`],
    [`${S}(?:it['’]s|it\\s+is|this\\s+is|the\\s+party\\s+is)\\s+bring\\s+your\\s+own\\s+drinks${E}`, "everyone brings their own drinks"],
    [`${S}(ship|shipped|shipping|ships)\\s+(?=(?:a|an|the|this|that|our|my|your|their)\\s+(?:urgent\\s+fix|fix|patch|feature|update|release|version|build|change|PR)${E}|it(?=\\s*[!.,]|\\s*$))`, (m, verb) => `${({ ship: "deploy", shipped: "deployed", shipping: "deploying", ships: "deploys" })[verb.toLowerCase()]} `],
    [`${S}(a|the|our|my|daily|morning|quick)\\s+stand-?up(?:\\s+meeting)?(?=\\s+(?:at|tomorrow|today|this|every|in)${E}|\\s*[,.!?]|\\s*$)`, "$1 daily meeting"],
    [`${S}pay\\s*checks?${E}`, (m) => (/s$/i.test(m) ? "salaries" : "salary")],
    [`${S}store\\s+credit${E}`, "a credit note for the store"],
    [`${S}carry-?ons?(?:\\s+(?:bag|bags|luggage|suitcase))?${E}`, "hand luggage"],
    [`${S}(?:a|the|our|class|school)\\s+field\\s+trip${E}`, "a school outing"],
    [`${S}(got|get|gets|has|had|have|in|getting)\\s+(?:a\\s+)?detention${E}`, (m, verb) => `${verb} a school punishment`],
    [`${S}(?:the\\s+)?dorms?${E}`, (m) => (/^the/i.test(m) ? "the university residence" : "university residence")],
    [`${S}(major|majoring|majored|majors)\\s+in${E}`, (m, verb) => ({ major: "study", majoring: "studying", majored: "studied", majors: "studies" })[verb.toLowerCase()]],
    [`${S}(?:a|the)\\s+potluck(?:\\s+(?:dinner|party|lunch|meal))?${E}`, "a shared meal"],
    [`${S}(?:some\\s+)?downtime${E}`, "a service interruption"],
    [`${S}(bump|bumped|bumping)\\s+(?:up\\s+)?(?:the\\s+)?version(?:\\s+number)?${E}`, (m, verb) => `${({ bump: "increase", bumped: "increased", bumping: "increasing" })[verb.toLowerCase()]} the version number`],
    [`${S}this\\s+coming\\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|weekend|week)${E}`, "next $1"],
    [`(?<=^\\s*|[.!?]\\s+)(?:nah|no)\\s*,?\\s+I['’]m\\s+good(?=\\s*[.!]|\\s*$)`, "no thanks, I'm fine"],
    [`${S}(?:I['’]m|I\\s+am)\\s+all\\s+in(?=\\s*[,.!]|\\s*$)`, "I'm up for it"],
    [`${S}(grab|grabbing|grabbed)\\s+(a\\s+(?:quick\\s+)?bite(?:\\s+to\\s+eat)?|something\\s+to\\s+eat|lunch|dinner|breakfast|a\\s+coffee|coffee|a\\s+drink|drinks|a\\s+beer|a\\s+pizza)${E}`, (m, verb, what) => `${({ grab: "have", grabbing: "having", grabbed: "had" })[verb.toLowerCase()]} ${/bite|something/i.test(what) ? "something to eat" : what}`],
    [`${S}(?:make|making)\\s+(yourself|yourselves)\\s+at\\s+home${E}`, (m, who) => `${/^making/i.test(m) ? "feeling" : "feel"} at home`],
    [`${S}(was|were|got|been|be|being|is|are|get)\\s+let\\s+go(?=\\s*[,.!?]|\\s*$|\\s+(?:last|yesterday|this|after|from|in|today|because|on)${E})`, "$1 dismissed"],
    [`${S}(flake|flaked|flaking|flakes)\\s+on\\s+(me|you|him|her|us|them)${E}`, (m, verb, who) => `${({ flake: "let", flaked: "let", flaking: "letting", flakes: "lets" })[verb.toLowerCase()]} ${who} down`],
    [`(?<=(?:I['’]m|I\\s+am|I\\s+was|he['’]s|she['’]s|we['’]re|a\\s+(?:bit|little)|so|pretty|kinda|kind\\s+of|slightly)\\s+)(?:buzzed|tipsy)${E}`, "slightly drunk"],
    [`${S}(I['’]m|I\\s+am|I\\s+was|he['’]s|she['’]s|we['’]re|they['’]re|you['’]re)\\s+(?:so\\s+|really\\s+|totally\\s+|super\\s+|a\\s+bit\\s+)?hung\\s*-?over${E}`, (m, who) => `${({ "i'm": "I have", "i’m": "I have", "i am": "I have", "i was": "I had", "he's": "he has", "he’s": "he has", "she's": "she has", "she’s": "she has", "we're": "we have", "we’re": "we have", "they're": "they have", "they’re": "they have", "you're": "you have", "you’re": "you have" })[who.toLowerCase().replace(/\s+/g, " ")]} a terrible hangover`],
    [`${S}(pig|pigged|pigging|pigs)\\s+out(\\s+on)?${E}`, (m, verb, on) => `${({ pig: "eat", pigged: "ate", pigging: "eating", pigs: "eats" })[verb.toLowerCase()]} way too much${on ? "" : ""}`],
    [`${S}grub${E}`, "food"],
    [`${S}take\\s+a\\s+chill\\s+pill${E}`, "calm down"],
    [`${S}no\\s+biggie${E}`, "it's not a big deal"],
    [`(?<=(?:is|['’]s|looks|seems|sounds|was|so|kinda|pretty|really|a\\s+bit|super)\\s+)sketchy${E}`, "shady"],
    [`${S}bonkers${E}`, "crazy"],
    [`(?<=(?:['’]re|are|['’]s|is|was|were|go|going|went|totally|completely|absolutely)\\s+)nuts(?=\\s*[,.!?]|\\s*$)`, "crazy"],
    [`${S}chuffed(?:\\s+to\\s+bits)?${E}`, "really happy"],
    [`(?<=^\\s*|[.!?]\\s+)cheers(?=\\s*,\\s*(?:mate|man|buddy|pal|love|dude|mum|mom|dad)${E})`, "thanks"],
    [`${S}(\\d+|a|one|two|three|four|five|ten|twenty|fifty|a\\s+hundred|a\\s+few)\\s+quid${E}`, "$1 British pounds"],
    [`${S}(?:a|such\\s+a|big|total)\\s+(?:wuss|wimp|chicken|scaredy-?cat)(?=\\s*[,.!?]|\\s*$)`, "a coward"],
    [`(?:${S}(is|was|are)|(['’]s|['’]re))\\s+(?:such\\s+a|a\\s+(?:real|total)|a|so)\\s+(?:cheapskate|tightwad|penny-pincher|stingy)${E}`, (m, full, short) => `${short ? short : full} so stingy`],
    [`${S}(\\d+|a|one|two|three|four|five|six|seven|eight|nine|ten|twenty|fifty|a\\s+hundred|a\\s+few)\\s+grand(?![\\p{L}])(?!\\s+(?:piano|prix|canyon|slam|jury|total|opening|finale|tour|hotel|central|prize|national|theft|scheme))`, "$1 thousand"],
    [`${S}skint${E}`, "broke"],
    [`${S}(?:kiss\\s+my\\s+(?:ass|arse)|bite\\s+me|up\\s+yours|eat\\s+shit|drop\\s+dead)${E}`, "go to hell"],
    [`(?<=^\\s*|[.!?,]\\s+)you\\s+(?:dirty\\s+|little\\s+|filthy\\s+)?rat(?=\\s*[!.,]|\\s*$)`, "you traitor"],
    [`${S}(rat|ratted|ratting|rats)\\s+(me|him|her|us|them|you)\\s+out${E}`, (m, verb, who) => `${({ rat: "denounce", ratted: "denounced", ratting: "denouncing", rats: "denounces" })[verb.toLowerCase()]} ${who}`],
    [`${S}(?:a|such\\s+a|big)\\s+cry-?baby${E}`, "a big whiner"],
    [`${S}(?:a|such\\s+a|total|real|big)\\s+(?:party\\s+pooper|killjoy|wet\\s+blanket)${E}`, "a killjoy"],
    [`${S}(is|['’]s|are|['’]re|was)\\s+(?:such\\s+a|a\\s+(?:real|total)|a|so)\\s+(?:cheapskate|tightwad|penny-pincher|stingy)${E}`, "$1 so stingy"],
    [`(?:${S}(is|was)|(['’]s))\\s+(?:such\\s+)?(?:a\\s+)?(?:nosy\\s+)?(?:busybody|nosy\\s+parker)${E}`, (m, full, short) => `${short ? " " : ""}${full === "was" ? "meddled" : "meddles"} in everything`],
    [`${S}(?:an|such\\s+an|a\\s+total|a\\s+real|total)\\s+airhead${E}`, "very scatterbrained"],
    [`${S}(?:a|such\\s+a|the)\\s+(?:political\\s+)?hot\\s+potato${E}`, "a very sensitive subject"],
    [`${S}bite\\s+your\\s+tongue${E}`, "hold your tongue"],
    [`${S}(call|calls|called|calling)\\s+the\\s+shots${E}`, (m, verb) => `${({ call: "make", calls: "makes", called: "made", calling: "making" })[verb.toLowerCase()]} the decisions`],
    [`${S}the\\s+cat(?:['’]s|\\s+is)\\s+out\\s+of\\s+the\\s+bag${E}`, "everyone knows the secret now"],
    [`${S}(went|go|goes|going|gone)\\s+(?:right\\s+)?down\\s+the\\s+(?:drain|toilet|tubes)${E}`, (m, verb) => `${verb} up in smoke`],
    [`${S}(?:straight\\s+|right\\s+)?from\\s+the\\s+horse['’]s\\s+mouth${E}`, "directly from the person concerned"],
    [`${S}in\\s+(?:a\\s+)?(?:real\\s+|bit\\s+of\\s+a\\s+)?pickle${E}`, "in trouble"],
    [`${S}keep\\s+your\\s+shirt\\s+on${E}`, "calm down"],
    [`${S}(make|making|made|makes)\\s+a\\s+mountain\\s+(?:out\\s+)?of\\s+a\\s+molehill${E}`, (m, verb) => `${verb} a big drama out of nothing`],
    [`${S}(passed|pass|passing|passes)\\s+with\\s+flying\\s+colou?rs${E}`, (m, verb) => `${({ passed: "succeeded", pass: "succeed", passing: "succeeding", passes: "succeeds" })[verb.toLowerCase()]} brilliantly`],
    [`${S}(playing|plays|play|played)\\s+hard\\s+to\\s+get${E}`, (m, verb) => `${({ playing: "pretending", plays: "pretends", play: "pretend", played: "pretended" })[verb.toLowerCase()]} not to be interested`],
    [`${S}rock(?:ing)?\\s+the\\s+boat${E}`, (m) => (/ing/i.test(m) ? "making waves" : "make waves")],
    [`${S}for\\s+a\\s+rainy\\s+day${E}`, "for hard times"],
    [`${S}(I|we|you|they)\\s+smell\\s+a\\s+rat${E}`, "$1 find this suspicious"],
    [`(?<=(?:is|are|['’]s|['’]re|was|were)\\s+(?:still\\s+)?)up\\s+for\\s+grabs${E}`, "available to anyone"],
    [`${S}(?:still\\s+)?wet\\s+behind\\s+the\\s+ears${E}`, "still very inexperienced"],
    [`${S}(?:I|we)\\s+(?:was|were|got|have\\s+been)\\s+overcharged${E}`, (m) => (/^we/i.test(m) ? "they billed us too much" : "they billed me too much")],
    [`${S}(overcharged|overcharge|overcharging)\\s+(me|us|you|him|her|them)${E}`, (m, verb, who) => `${({ overcharged: "billed", overcharge: "bill", overcharging: "billing" })[verb.toLowerCase()]} ${who} too much`],
    [`${S}(is|are|was|['’]s)\\s+back-?ordered${E}`, "$1 temporarily out of stock"],
    [`${S}what\\s+time\\s+is\\s+check-?out${E}`, "what time do we have to leave the room"],
    [`${S}(?:a\\s+)?wake-?up\\s+call\\s+at\\s+(\\d{1,2})(?::(\\d\\d))?${E}`, (m, h, mm) => `a call to wake me up at ${h}${mm ? `:${mm}` : " o'clock"}`],
    [`${S}(cram|cramming|crammed|crams)\\s+for${E}`, (m, verb) => `${({ cram: "revise", cramming: "revising", crammed: "revised", crams: "revises" })[verb.toLowerCase()]} intensively for`],
    [`(?<=(?:my|your|his|her|our|their|the)\\s+)finals${E}`, "final exams"],
    [`${S}fold\\s+in\\s+((?:the|your|some)\\s+(?:[\\p{L}-]+\\s+){0,2}?(?:whites|egg\\s+whites|flour|cream|mixture|batter|chocolate|berries|sugar|eggs))${E}`, "incorporate $1 gently"],
    [`${S}split\\s+the\\s+(?:check|bill|tab)${E}`, "pay separately"],
    [`${S}(?:is\\s+(?:it|that|this)\\s+)?for\\s+here\\s+or\\s+to\\s+go(?=\\s*\\?)`, "is it to eat here or to take away"],
    [`${S}(revert|reverted|reverting|reverts)\\s+(?=(?:the|this|that|my|your|our|his|her|a|last|these|those)${E})`, (m, verb) => `${({ revert: "undo", reverted: "undid", reverting: "undoing", reverts: "undoes" })[verb.toLowerCase()]} `],
    [`${S}(push|pushing|pushed|pushes|deploy|deploying|deployed|ship|shipping)\\s+(?:it\\s+)?to\\s+prod(?:uction)?${E}`, (m, verb) => `${({ push: "deploy", pushing: "deploying", pushed: "deployed", pushes: "deploys", ship: "deploy", shipping: "deploying" })[verb.toLowerCase()] ?? verb} to production`],
    [`${S}(?:a\\s+)?(?:generous\\s+)?severance(?:\\s+(?:package|pay))?${E}`, (m) => `${/^a\s/i.test(m) ? "a " : ""}${/generous/i.test(m) ? "generous " : ""}compensation for dismissal`],
    [`${S}(cried|cry|cries|crying)\\s+all\\s+(night|day)(?:\\s+long)?${E}`, "$1 for the entire $2"],
    [`${S}(proposed|propose|proposing|proposes)\\s+to\\s+(her|him)(?=\\s*[,.!?]|\\s*$|\\s+(?:last|yesterday|on|in|at|during|after|before|tonight|today)${E})`, (m, verb, who) => `${({ proposed: "asked", propose: "ask", proposing: "asking", proposes: "asks" })[verb.toLowerCase()]} ${who} to marry ${/her/i.test(who) ? "him" : "her"}`],
    // Comparaisons figées (« as busy as a bee ») : l'adjectif renforcé.
    [`${S}as\\s+(busy|easy|cool|fit|quiet|light|good|old|clear|happy|hungry|white|red|blind|strong|sharp|dead|flat|right|safe|snug|smooth|tough|thin|pale|brave|proud|cold|hard|dry|bright|sick|poor|rich|fresh|free)\\s+as\\s+(?:a\\s+|an\\s+)?(?:bee|beaver|pie|ABC|cucumber|fiddle|mouse|feather|gold|hills|day|crystal|lark|clam|horse|sheet|ghost|beetroot|beet|bat|mole|ox|tack|razor|doornail|pancake|rain|houses|bug\\s+in\\s+a\\s+rug|silk|nails|rake|lion|peacock|ice|rock|bone|button|church\\s+mouse|daisy|bird|dog)${E}`, (m, adj) => ({ busy: "very busy", easy: "very easy", cool: "perfectly calm", fit: "in great shape", quiet: "very quiet", light: "very light", good: "very good", old: "very old", clear: "perfectly clear", happy: "very happy", hungry: "starving", white: "very pale", red: "very red", blind: "very short-sighted", strong: "very strong", sharp: "very sharp", dead: "completely dead", flat: "completely flat", right: "perfectly fine", safe: "perfectly safe", snug: "very cozy", smooth: "very smooth", tough: "very tough", thin: "very thin", pale: "very pale", brave: "very brave", proud: "very proud", cold: "very cold", hard: "very hard", dry: "very dry", bright: "very bright", sick: "very sick", poor: "very poor", rich: "very rich", fresh: "very fresh", free: "completely free" })[adj.toLowerCase()]],
    [`${S}(?:I['’]m|I\\s+am)\\s+at\\s+my\\s+wits['’]?\\s+end${E}`, "I don't know what to do anymore"],
    [`${S}keep\\s+(?:your|my|his|her|our|their)\\s+eyes\\s+(?:peeled|open)${E}`, "keep your eyes open"],
    [`(?<=^\\s*|[.!?]\\s+)better\\s+luck\\s+next\\s+time${E}`, "you'll have more luck next time"],
    [`${S}(?:it['’]s|it\\s+is)\\s+anyone['’]s\\s+guess${E}`, "nobody knows"],
    [`${S}(?:that['’]s|it['’]s|that\\s+is|what)\\s+a\\s+(?:huge\\s+|big\\s+|real\\s+)?weight\\s+off\\s+(?:my|our|his|her)\\s+(?:shoulders|mind|chest)${E}`, "that's a great relief"],
    [`${S}money\\s+is\\s+(?:really\\s+|a\\s+bit\\s+|very\\s+)?tight${E}`, "we don't have much money"],
    [`${S}(living|live|lives|lived)\\s+(?:from\\s+)?(?:pay\\s*check|salary)\\s+to\\s+(?:pay\\s*check|salary)${E}`, (m, verb) => `barely ${({ living: "making", live: "make", lives: "makes", lived: "made" })[verb.toLowerCase()]} ends meet`],
    [`${S}(cost|costs|costing|for|paid|pay|earn|earns|earned|get|got)\\s+peanuts${E}`, "$1 almost nothing"],
    [`${S}(we['’]re|we\\s+are|it['’]s|it\\s+is|they['’]re|they\\s+are|we\\s+were|it\\s+was)\\s+(?:way\\s+|already\\s+|well\\s+)?over\\s+budget${E}`, (m, who) => `${({ "we're": "we have", "we’re": "we have", "we are": "we have", "it's": "it has", "it’s": "it has", "it is": "it has", "they're": "they have", "they’re": "they have", "they are": "they have", "we were": "we had", "it was": "it had" })[who.toLowerCase().replace(/\s+/g, " ")]} exceeded the budget`],
    [`${S}(?:a|the)\\s+jack\\s+of\\s+all\\s+trades${E}`, "someone who can do everything"],
    [`${S}(?:a|such\\s+a|real|total)\\s+social\\s+butterfly${E}`, "very sociable"],
    [`${S}(?:a\\s+)?dog-eat-dog\\s+world${E}`, "a ruthless world"],
    [`${S}the\\s+life\\s+(?:and\\s+soul\\s+)?of\\s+the\\s+party${E}`, "the person who livens up every party"],
    [`${S}like\\s+two\\s+peas\\s+in\\s+a\\s+pod${E}`, "like two drops of water"],
    [`${S}(split|splitting)\\s+hairs${E}`, (m, verb) => `${/ing$/i.test(verb) ? "cutting" : "cut"} hairs into four`],
    [`${S}(he['’]s|she['’]s|you['’]ve|he\\s+has|she\\s+has|you\\s+have)\\s+got\\s+(?:a\\s+lot\\s+of|some)\\s+nerve${E}`, (m, who) => `${({ "he's": "he is", "he’s": "he is", "she's": "she is", "she’s": "she is", "you've": "you are", "you’ve": "you are", "he has": "he is", "she has": "she is", "you have": "you are" })[who.toLowerCase().replace(/\s+/g, " ")]} really shameless`],
    [`${S}a\\s+dirty\\s+look${E}`, "a black look"],
    [`${S}(gave|give|gives|giving)\\s+(me|us|him|her|them)\\s+(?:a|the)\\s+thumbs[-\\s]up${E}`, (m, verb, who) => `${verb} ${who} the green light`],
    [`${S}turn\\s+(the\\s+(?:music|volume|sound|TV|radio|heat|heating|AC|air\\s+conditioning)|it)\\s+down${E}`, "lower $1"],
    [`${S}turn\\s+down\\s+(the\\s+(?:music|volume|sound|TV|radio|heat|heating))${E}`, "lower $1"],
    [`${S}turn\\s+(the\\s+(?:music|volume|sound|TV|radio)|it)\\s+up${E}`, "raise the volume"],
    [`${S}(that|it|this|the\\s+name)\\s+(doesn['’]t|does\\s+not|didn['’]t)\\s+ring\\s+(?:a|any)\\s+bells?${E}`, "$1 $2 sound familiar"],
    [`(?<=(?:broke|hurt|injured|sprained|twisted|fractured|dislocated)\\s+(?:my|his|her|your|their|our)\\s+[\\p{L}-]+\\s+)(skiing|snowboarding|running|cycling|surfing|skating|climbing|hiking|playing\\s+\\p{L}+)${E}`, "while $1"],
    [`${S}(?:you\\s+)piece\\s+of\\s+(?:shit|crap)${E}`, "you bastard"],
    [`${S}(a|what\\s+a|this|that)\\s+piece\\s+of\\s+(?:crap|shit|junk|garbage)${E}`, (m, det) => (/^what/i.test(det) ? "what crap" : /^a$/i.test(det) ? "complete crap" : `${det} crap`)],
    [`${S}(?:get|take|keep)\\s+your\\s+(?:dirty\\s+)?(?:hands|paws)\\s+off\\s+(me|him|her|it|them|my\\s+[\\p{L}-]+)${E}`, "don't touch $1"],
    [`${S}(?:I['’]m|I\\s+am|I['’]ve\\s+been)\\s+running\\s+on\\s+fumes${E}`, "I have almost no energy left"],
    [`${S}(?:we['’]re|we\\s+are|we['’]ve\\s+been)\\s+running\\s+on\\s+fumes${E}`, "we have almost no energy left"],
    [`(['’]s|['’]re)\\s+(?:a|such\\s+a)\\s+(?:real\\s+|total\\s+|huge\\s+)?pain(?:\\s+in\\s+the\\s+(?:neck|butt|ass))?${E}`, "$1 very annoying"],
    [`${S}(nailed|aced)\\s+(?:the|my|his|her|their|our|that|this|your)\\s+(presentation|speech|pitch|performance|demo|talk)${E}`, (m, verb, what) => `gave a brilliant ${what}`],
    [`${S}(nailed|aced)\\s+(the|my|his|her|their|our|that|this|your)\\s+(interview|exam|test|audition|finals?|job\\s+interview|driving\\s+test)${E}`, "brilliantly passed $2 $3"],
    [`${S}(five|ten|twenty|twenty-five)\\s+(?:minutes\\s+)?(to|past|after)\\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\\d{1,2})(?=\\s*[,.!?]|\\s*$|\\s+(?:in|this|tomorrow|tonight|today|p\\.?m|a\\.?m|o['’]clock|sharp)${E})`, (m, mins, rel, h) => {
        const minutes = { five: 5, ten: 10, twenty: 20, "twenty-five": 25 }[mins.toLowerCase()];
        const base = hour(h);
        return /^to$/i.test(rel) ? `${((base + 10) % 12) + 1}:${String(60 - minutes).padStart(2, "0")}` : `${base}:${String(minutes).padStart(2, "0")}`;
    }],
    [`${S}at\\s+(\\d{1,2})(?::(\\d\\d))?(?=\\s+(?:tomorrow\\s+|this\\s+|in\\s+the\\s+|on\\s+\\p{L}+\\s+)?(?:afternoon|evening)${E})`, (m, h, mm) => `at ${Number(h) < 12 ? Number(h) + 12 : h}:${mm ?? "00"}`],
    // --- Argot, verlan et langage SMS anglais ---
    [`(?<=^\\s*|[.!?]\\s+)(?:kind\\s+of\\s+)?want\\s+to(?=\\s+\\p{L}[^.!?\\n]*\\?)`, "do you want to"],
    [`(?<=^\\s*|[.!?]\\s+)(kind\\s+of\\s+)?want\\s+to(?=\\s+\\p{L})`, (m, kind) => `I ${kind ? "kind of " : ""}want to`],
    [`(?<=^\\s*|[.!?]\\s+)(?:are\\s+)?you\\s+(still\\s+)?up(?=\\s*\\?)`, "are you $1awake"],
    [`${S}(skip|skipping|skipped|skips|cut|cutting|ditch|ditching|ditched)\\s+(class|classes|school|lectures?)${E}`, (m, verb, what) => `${/ing$/i.test(verb) ? "not going" : /(?:ed|cut)$/i.test(verb) && !/^cut$/i.test(verb) ? "didn't go" : "not go"} to ${/school/i.test(what) ? "school" : "class"}`],
    [`(?<=(?:party|concert|show|night|club|game|festival|vibe|place|weekend|wedding|this|that|it)\\s+(?:is|was|['’]s|will\\s+be|gonna\\s+be|going\\s+to\\s+be)\\s+(?:so\\s+|totally\\s+|absolutely\\s+|super\\s+|really\\s+)?)lit(?=\\s*[!.,?]|\\s*$)`, "amazing"],
    [`(?<=(?:was|is|['’]s|so|kinda|kind\\s+of|really|super|very|totally|lowkey|a\\s+bit|that['’]s|it['’]s)\\s+)cringe(?:y|worthy)?(?![\\p{L}])`, "embarrassing"],
    [`${S}cringey${E}`, "embarrassing"],
    [`(?<=(?:that['’]s|that\\s+is|it['’]s|so|kinda|kind\\s+of|pretty|very|really|super|totally|lowkey|is|was|looks|sounds|seems)\\s+)sus(?![\\p{L}])`, "suspicious"],
    [`(?<=(?:is|['’]s|was|so|really|super|still|are|['’]re|were|very)\\s+)salty(?=\\s+(?:about|because|that|since)${E}|\\s*[,.!?]|\\s*$)`, "bitter"],
    [`${S}(ghosted|ghosting|ghost|ghosts)\\s+(me|you|him|her|us|them)${E}`, (m, verb, who) => `${({ ghosted: "stopped answering", ghosting: "ignoring", ghost: "stop answering", ghosts: "ignores" })[verb.toLowerCase()]} ${who}`],
    [`(?<=(?:I['’]m|I\\s+am|we['’]re|we\\s+are|I\\s+was|we\\s+were)\\s+)(?:so\\s+|really\\s+|super\\s+|totally\\s+)?(?:pumped|stoked|psyched|hyped)\\s+(?:for|about)${E}`, "really excited about"],
    [`${S}(?:pumped|stoked|psyched|hyped)(?=\\s*[!.]|\\s*$)`, "really excited"],
    [`(?<=${S}(?:I|he|she|we|they|you)\\s+(?:got|get|was|were|am|['’]m|is|['’]s|are|['’]re)\\s+(?:so\\s+|totally\\s+|completely\\s+|absolutely\\s+|really\\s+)?)(?:wasted|hammered|plastered|trashed|smashed|sloshed)(?=\\s*[,.!?]|\\s*$|\\s+(?:last|at|again|tonight|yesterday|on)${E})`, "very drunk"],
    [`${S}crash\\s+(at|on)\\s+(your|my|his|her|our|their)\\s+(place|house|couch|sofa)${E}`, "sleep $1 $2 $3"],
    [`(?<=(?:is|was|['’]s|that|this)\\s+)legit(?=\\s*[?!.,]|\\s*$)`, "genuine"],
    [`${S}DM\\s+(me|him|her|us|them)${E}`, "send $1 a private message"],
    [`${S}(?:such\\s+a|a|what\\s+a|total|complete|big)\\s+(?:total\\s+|complete\\s+|big\\s+|huge\\s+)?show-?off${E}`, (m) => m.replace(/show-?off$/i, "braggart")],
    [`${S}chill\\s+out${E}`, "calm down"],
    [`(?<=^\\s*|[.!?]\\s+)chill(?=\\s*[,.!])`, "relax"],
    [`${S}rip-?offs?${E}`, (m) => (/s$/i.test(m) ? "scams" : "scam")],
    [`${S}(?:a|such\\s+a|total|real|complete)\\s+(?:total\\s+|real\\s+|complete\\s+)?slob${E}`, (m) => m.replace(/slob$/i, "pig")],
    [`${S}what['’]?s\\s+good(?=\\s*[?!.,])`, "what's new"],
    [`${S}(bombed|bomb|bombing|bombs|flunked|flunk|blew)\\s+(the|my|his|her|your|our|their|that)\\s+(interview|job\\s+interview|exam|test|audition|presentation|pitch|finals?)${E}`, (m, verb, det, what) => `${/ing$/i.test(verb) ? "completely failing" : /^(?:bomb|flunk|bombs)$/i.test(verb) ? "completely fail" : "completely failed"} ${det} ${what.toLowerCase() === "interview" ? "job interview" : what}`],
    [`${S}(being|be|is|['’]s|are|['’]re)\\s+(?:such\\s+|a\\s+|a\\s+real\\s+|a\\s+total\\s+|such\\s+a\\s+)+drama\\s+queens?${E}`, (m, verb) => `${/^['’]/.test(verb) ? verb : verb} so dramatic`],
    [`(?<![\\p{L}\\p{N}_'’-]|the\\s)(?:you\\s+)?creeps?(?=\\s*[!.,]|\\s*$)`, (m) => (/^you/i.test(m) ? "you pervert" : "pervert")],
    [`(?<=^\\s*|[.!?,]\\s+)(?:get\\s+lost|take\\s+a\\s+hike|fuck\\s+off|bugger\\s+off|sod\\s+off|get\\s+out\\s+of\\s+here)(?=\\s*[!.,]|\\s*$|\\s+(?:and|you)${E})`, "go away"],
    [`${S}(?:a|such\\s+a|total|complete|big|what\\s+a)\\s+(?:total\\s+|complete\\s+|big\\s+|huge\\s+)?loser${E}`, (m) => m.replace(/(?:total\s+|complete\s+|big\s+|huge\s+)?loser$/i, "good-for-nothing")],
    [`${S}(?:don['’]t|do\\s+not|stop)\\s+(?:be(?:ing)?\\s+)?(?:such\\s+)?a\\s+(?:smart-?ass|wise-?ass|smart\\s+aleck|wise\\s+guy)${E}`, (m) => (/^stop/i.test(m) ? "stop trying to be clever" : "don't try to be clever")],
    [`${S}(?:a|such\\s+a|total|complete|big|what\\s+a|you)\\s+(?:total\\s+|complete\\s+|big\\s+|little\\s+)?(?:smart-?ass|wise-?ass|smart\\s+aleck|wise\\s+guy)${E}`, (m) => m.replace(/(?:smart-?ass|wise-?ass|smart\s+aleck|wise\s+guy)$/i, "know-it-all")],
    [`${S}(?:a|such\\s+a|total|complete|big|what\\s+a)\\s+(?:total\\s+|complete\\s+|big\\s+)?know-?it-?all${E}`, (m) => m.replace(/know-?it-?all$/i, "person who thinks he knows everything")],
    [`${S}(?:a|such\\s+a|total|complete|big|what\\s+a)\\s+(?:total\\s+|complete\\s+|big\\s+)?(?:suck-?up|kiss-?ass|ass-?kisser|brown-?noser)${E}`, (m) => m.replace(/(?:suck-?up|kiss-?ass|ass-?kisser|brown-?noser)$/i, "flatterer")],
    // --- Faux amis et vie courante ---
    [`${S}(un)?sympathetic${E}`, (m, un) => (un ? "not very understanding" : "understanding")],
    [`${S}change\\s+for\\s+a\\s+(five|ten|twenty|fifty|hundred)${E}`, "change for a $1-dollar bill"],
    [`(?<=${S}you\\s+)(?:need|want)\\s+a\\s+(?:ride|lift)(?=\\s+(?:to|home|back)${E}|\\s*[?.!,]|\\s*$)`, "want me to drive you"],
    [`${S}(give|gave|giving|gives)\\s+(me|you|him|her|us|them)\\s+a\\s+(?:ride|lift)${E}`, (m, verb, who) => `${({ give: "drive", gave: "drove", giving: "driving", gives: "drives" })[verb.toLowerCase()]} ${who}`],
    [`(?<=(?:my|our|his|her|their|the)\\s+(?:parents|folks|mom|mum|dad|roommates?|flatmates?)\\s+(?:are|is|were|was)\\s+)out(?=\\s*[,.!?;]|\\s*$|\\s+(?:tonight|today|this|for|until|till)${E})`, "not at home"],
    [`${S}(?:just\\s+|only\\s+)?messing\\s+(?:with|around\\s+with)\\s+(you|him|her|them|me|us)(?=\\s*[,.!]|\\s*$)`, (m, who) => `${/^just/i.test(m) ? "just " : ""}teasing ${who}`],
    [`${S}(put|putting|puts)\\s+off\\s+(?=(?:the|our|my|this|that|it|his|her|their|your|a)${E})`, (m, verb) => `${({ put: "postpone", putting: "postponing", puts: "postpones" })[verb.toLowerCase()]} `],
    [`${S}(?:I['’]m|I\\s+am)\\s+(?:so\\s+|very\\s+|truly\\s+|really\\s+)?sorry\\s+for\\s+your\\s+loss${E}`, "my deepest condolences"],
    [`${S}help\\s+(yourself|yourselves)\\s+to${E}`, "serve $1"],
    [`(?<=^\\s*|[.!?]\\s+)please\\s+hold(?=\\s*[.!]|\\s*$)`, "please wait"],
    [`${S}(was|were|has\\s+been|have\\s+been|got|is|are)\\s+(taken|withdrawn|charged|deducted)\\s+(from|out\\s+of)\\s+(my|your|his|her|our|their|the)\\s+(account|card)${E}`, "$1 debited from $4 $5"],
    [`${S}(is|are|['’]s)\\s+(?:now\\s+)?out\\s+for\\s+delivery${E}`, "$1 on its way"],
    [`${S}between\\s+(\\d{1,2})\\s+and\\s+(\\d{1,2})\\s*(p\\.?m\\.?|a\\.?m\\.?)`, "between $1 $3 and $2 $3"],
    [`${S}at\\s+(\\d{1,2})(?:\\s+o['’]clock)?\\s+(last\\s+night|tonight|this\\s+evening|yesterday\\s+evening|tomorrow\\s+night|tomorrow\\s+evening)${E}`, (m, h, when) => `at ${h} p.m. ${when}`],
    [`${S}(I|he|she|we|they|you)\\s+got\\s+into\\s+(?=(?:Harvard|Yale|Stanford|Oxford|Cambridge|MIT|Princeton|Columbia|Berkeley|UCLA|NYU|Sciences\\s+Po|Polytechnique|HEC|college|university|uni|med\\s+school|medical\\s+school|law\\s+school|grad\\s+school|graduate\\s+school|my\\s+first\\s+choice|the\\s+program)${E})`, "$1 was accepted at "],
    [`${S}(?:are\\s+)?you\\s+(?:shitting|fucking\\s+with|fucking\\s+kidding)\\s+me${E}`, "are you kidding me"],
    // --- Bureau et informatique ---
    [`${S}roll\\s+back\\s+(?=(?:the|this|that|my|our|your|a)\\s+(?:last\\s+|latest\\s+|previous\\s+|recent\\s+)?(?:deploy|deployment|release|update|change|changes|migration|commit|version)${E})`, "undo "],
    [`${S}(production|prod|the\\s+site|the\\s+website|the\\s+server|the\\s+app|the\\s+service|the\\s+API|the\\s+database)\\s+(is|was)\\s+down(?=\\s*[,.!?;]|\\s*$|\\s+(?:again|since|for|right\\s+now)${E})`, (m, what, verb) => `${what} ${verb === "was" ? "was not working" : "is not working"}`],
    [`${S}(merged?|merging|pushed?|pushing|rebased?|rebasing|into|onto|to|from|off|on)\\s+(?:the\\s+)?(main|master)(?=\\s*[.,!?;]|\\s*$|\\s+(?:last|yesterday|today|this|tonight|now|before|after|and|but|so)${E})`, "$1 the $2 branch"],
    [`${S}(did|didn['’]t|have|haven['’]t|do|don['’]t|did\\s+not)\\s+(you|I|we|they|he|she)\\s+remember\\s+to${E}`, "$1 $2 think to"],
    [`${S}(was|were|got|been|be|being|get|is|are)\\s+laid\\s+off${E}`, "$1 dismissed"],
    [`${S}(lay|lays|laid|laying)\\s+off\\s+(?=(?:\\d|the|some|many|most|all|half|their|our|its|hundreds|thousands|staff|workers|employees|people)${E})`, (m, verb) => `${({ lay: "dismiss", lays: "dismisses", laid: "dismissed", laying: "dismissing" })[verb.toLowerCase()]} `],
    [`${S}(?:annual|yearly|performance)\\s+(?:review|appraisal|evaluation)${E}`, "annual appraisal"],
    [`${S}(?:I['’]m|I\\s+am|we['’]re|we\\s+are)\\s+(?:cc['’]?ing|cc-ing|copying)\\s+(?:in\\s+)?`, (m) => `${/^we/i.test(m) ? "we are" : "I'm"} putting in copy `],
    [`${S}(?:I['’]ve|I\\s+have|I)\\s+(?:cc['’]?d|cc['’]?ed|copied)\\s+(?:in\\s+)?`, "I have put in copy "],
    [`${S}(is|are|was|were|['’]s)\\s+overdrawn${E}`, "$1 in the red"],
    [`${S}blood\\s+tests?${E}`, (m) => (/s$/i.test(m) ? "blood analyses" : "blood analysis")],
    [`${S}(fasten|fastened|fastening)\\s+(?=(?:your|their|his|her|my)\\s+seat\\s*belts?)`, (m, verb) => `${verb.toLowerCase().replace(/^fasten/, "buckle").replace(/^buckleed$/, "buckled").replace(/^buckleing$/, "buckling")} `],
    [`${S}without\\s+a\\s+(?:note|doctor['’]s\\s+note|parent['’]s\\s+note)(?=\\s*[,.!?]|\\s*$)`, "without a written excuse"],
    [`${S}(?:take|have)\\s+your\\s+seats${E}`, "sit down"],
    [`${S}(roll|rolling)\\s+(it|them|the\\s+dough|the\\s+pastry)\\s+out${E}`, (m, verb, what) => `${/ing$/i.test(verb) ? "spreading" : "spread"} ${what} out`],
    [`${S}(roll|rolling)\\s+out\\s+(the\\s+dough|the\\s+pastry)${E}`, (m, verb, what) => `${/ing$/i.test(verb) ? "spreading" : "spread"} ${what} out`],
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
    [`${S}(we['’]re|we\\s+are|I['’]m|I\\s+am|you['’]re|you\\s+are|they['’]re|they\\s+are)\\s+(?:all\\s+|completely\\s+|totally\\s+)?out\\s+of\\s+(milk|bread|coffee|sugar|eggs|butter|toilet\\s+paper|gas|money|cash|time|ideas|ink|paper|water|beer|wine|food|salt|flour|pasta|rice|tea)(\\s+again)?${E}`, (m, who, what, again) => `${again ? "once again, " : ""}${SUBJECT_HAVE[who.toLowerCase().replace(/’/g, "'").replace(/\s+/g, " ")]} no more ${what}`],
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
    [`${S}hit\\s+me\\s+up${E}`, "call me"],
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

const PASSED_TEST = (src) => /\bpassed\s+(?:my|his|her|their|your|our|the|this|that|an?)\s+(?:[\w'’-]+\s+){0,2}(?:test|exam|exams|finals|interview|course|audition)\b/i.test(src);
const SCHOOL_CONTEXT = /\b(?:maths?|français|anglais|histoire|géo(?:graphie)?|physique|chimie|SVT|bio(?:logie)?|note|sur\s+20|\/20|profs?|élèves?|classe|interro|bulletin)\b/iu;
const FR_INFINITIVE = { dit: "dire", fait: "faire", vu: "voir", écrit: "écrire", reçu: "recevoir", entendu: "entendre", lu: "lire", pris: "prendre", mis: "mettre", répondu: "répondre", compris: "comprendre", perdu: "perdre", vendu: "vendre", bu: "boire", eu: "avoir", été: "être", fini: "finir", choisi: "choisir", parti: "partir", sorti: "sortir" };
const VENIR_DE = { "tu as": "tu viens", "vous avez": "vous venez", "il a": "il vient", "elle a": "elle vient", "on a": "on vient", "j'ai": "je viens", "j’ai": "je viens", "nous avons": "nous venons", "ils ont": "ils viennent", "elles ont": "elles viennent" };
const FEM_DET = { ton: "ta", mon: "ma", son: "sa", un: "une", "l'": "la", "l’": "la", le: "la", ce: "cette", cet: "cette", du: "de la", au: "à la", votre: "votre", notre: "notre", leur: "leur" };

const FR_FIX = compile([
    // --- Campagne du 06/11/2026 : idiomes, faux amis et vocabulaire, d'après la phrase anglaise.
    [`${S}(attention|faites\\s+attention|fais\\s+attention|soyez\\s+prudente?s?|sois\\s+prudente?)\\s+(?:au\\s+pas|à\\s+l['’]étape|avec\\s+l['’]étape|au\\s+palier|à\\s+l['’]échelon)${E}`, (m, what) => `${/^soyez/i.test(what) ? "faites attention" : /^sois/i.test(what) ? "fais attention" : what} à la marche`, /\b(?:mind|watch)\s+(?:the|your)\s+step\b/i],
    [`${S}je\\s+me\\s+fiche\\s+de\\s+(?:l['’]endroit|savoir)\\s+où${E}`, "je m'en fiche, peu importe où", /\bidc\b|\bI\s+don['’]t\s+care\s+where\b/i],
    [`${S}(révél\\p{L}*|révèl\\p{L}*)\\s+(?:le|un|ce)\\s+secret(\\s+(?:du|de\\s+la|des|de\\s+l['’]))?`, (m, verb, about) => `${({ révélé: "vendu", révéler: "vendre", révèle: "vend", révèles: "vends", révélez: "vendez", révèlent: "vendent", révélant: "vendant", révélera: "vendra" })[verb.toLowerCase()] ?? "vendu"} la mèche${about ? ` à propos${about}` : ""}`, /\bcat\s+out\s+of\s+the\s+bag\b|\bspill(?:ed|s|ing)?\s+the\s+beans\b/i],
    [`${S}(si|aussi|tellement|vraiment)\\s+(?:abruti|abrutie|idiot|idiote|crétin|crétine|imbécile)${E}`, "$1 con", /\b(?:dick|prick|asshole|arsehole|douche(?:bag)?)\b/i],
    [`${S}(un|espèce\\s+d['’]|quel|sale|ce|cet|petit)\\s*(?:abruti|idiot|crétin|imbécile)${E}`, (m, det) => `${/^espèce/i.test(det) ? "espèce de" : /^cet$/i.test(det) ? "ce" : det} connard`, /\b(?:dick|prick|asshole|arsehole|douche(?:bag)?)\b/i],
    [`${S}(tu\\s+te\\s+moques|vous\\s+vous\\s+moquez)\\s+de\\s+moi${E}`, (m, who) => (/^tu/i.test(who) ? "tu te fous de moi" : "vous vous foutez de moi"), /\bshitting\s+me\b|\bfucking\s+(?:with|kidding)\s+me\b/i],
    [`${S}(va-t['’]en|va\\s+t['’]en|pars|perds-toi|fiche\\s+le\\s+camp|allez-vous-en|partez|perdez-vous|fichez\\s+le\\s+camp)${E}`, (m) => (/(?:allez|partez|perdez|fichez)/i.test(m) ? "dégagez" : "dégage"), /\b(?:get\s+lost|take\s+a\s+hike|fuck\s+off|piss\s+off|bugger\s+off|sod\s+off|get\s+out\s+of\s+here)\b/i],
    [`^\\s*[^,.!?\\n]{1,30}(?=\\s*[,.!])`, "Tant pis", /^\s*screw\s+it\s*[,.!]/i],
    [`${S}(?:complètement\\s+)?échoué\\s+(à|au|aux)\\s+`, (m, prep) => `${/complètement/i.test(m) ? "complètement " : ""}raté ${({ à: "", au: "le ", aux: "les " })[prep.toLowerCase()]}`, /\b(?:bombed|bomb|bombing|flunked|flunk|blew)\s+(?:the|my|his|her|your|our|their|that)\b/i],
    [`${S}quel\\s+petit\\s+monde${E}`, "que le monde est petit", /small\s+world/i],
    [`${S}(?:un\\s+)?mauvais\\s+défaut${E}`, "un vilain défaut", /curiosity\s+killed/i],
    [`${S}les\\s+actions\\s+comptent\\s+plus\\s+que\\s+les\\s+mots${E}`, "les actes comptent plus que les paroles", /actions\s+speak/i],
    [`${S}(?:un|le)\\s+chat\\s+endormi${E}`, "le chat qui dort", /sleeping\s+dogs/i],
    [`${S}(ton|mon|son|votre|notre|leur|un|l['’]|le|ce|cet|du|au)\\s*étuis?\\s+à\\s+crayons?${E}`, (m, det) => `${FEM_DET[det.toLowerCase()] ?? det} trousse`, /pencil\s+cases?/i],
    [`${S}(du|le|de|ce)\\s+changement${E}`, (m, det) => `${({ du: "de la", le: "la", de: "de", ce: "cette" })[det.toLowerCase()]} monnaie`, /\bchange\s+for\b|\b(?:small|loose|spare|exact)\s+change\b|\bkeep\s+the\s+change\b/i],
    [`${SJ}(ai|as|a|avons|avez|ont|avait|avais)\\s+passé\\s+(mon|ton|son|notre|votre|leur)\\s+test\\s+de\\s+conduite${E}`, "$1 eu $2 permis", PASSED_TEST],
    [`${SJ}(ai|as|a|avons|avez|ont|avait|avais)\\s+passé\\s+(mon|ton|son|notre|votre|leur|mes|tes|ses|l['’]|le|la|les|ce|cet|cette)\\s*(test|examen|permis|bac|partiel|contrôle|oral|concours|épreuve|entretien|audition)`, (m, aux, det, what) => `${aux} réussi ${/['’]$/.test(det) ? det : `${det} `}${what}`, PASSED_TEST],
    [`${S}bouillit${E}`, "bout"],
    [`${S}bouillissent${E}`, "bouillent"],
    [`${S}(?:à|sur)\\s+la\\s+mer${E}`, "au bord de la mer", /\bby\s+the\s+sea(?:side)?\b|\bon\s+the\s+(?:coast|seaside)\b|\bat\s+the\s+seaside\b/i],
    [`${S}(fermé|fermée|fermer|ferme|fermes|fermez)\\s+(la|ta|votre|ma|sa|leur|notre)\\s+porte(?!\\s+à\\s+clé)${E}`, "$1 $2 porte à clé", /\block(?:ed|s|ing)?\s+(?:the|your|my|his|her|our|their)\s+(?:front\s+|back\s+)?door\b/i],
    [`${S}(brisé|brisée|brisés|brisées)${E}`, (m) => m.replace(/^bris/i, "cass"), (src) => /\b(?:is|are|was|were|['’]s|['’]re|got|been)\s+(?:\w+\s+)?broken\b/i.test(src) && /\b(?:environment|staging|build|server|site|website|app|link|pipeline|tests?|production|prod|deploy\w*|feature|code|script|page|API|endpoint|CI|database|login|checkout)\b/i.test(src)],
    [`${S}(le|un|ce|du|au|votre|ton|mon|son)\\s+drapeau${E}`, (m, det) => ({ le: "l'option", un: "une option", ce: "cette option", du: "de l'option", au: "à l'option", votre: "votre option", ton: "ton option", mon: "mon option", son: "son option" })[det.toLowerCase()], /--[a-z]|`[^`]*-/i],
    [`${S}(les|des|ces|vos|tes|mes|ses)\\s+drapeaux${E}`, "$1 options", /--[a-z]|`[^`]*-/i],
    [`${S}examen\\s+annuel${E}`, "entretien annuel", /\b(?:annual|yearly|performance)\s+(?:review|appraisal|evaluation)\b/i],
    [`${S}(j['’]ai|nous\\s+avons|il\\s+a|elle\\s+a|on\\s+a)\\s+voyagé\\s+pour\\s+(?:le\\s+travail|affaires|mon\\s+travail|le\\s+boulot)${E}`, (m, who) => `${({ "j'ai": "j'étais", "j’ai": "j'étais", "nous avons": "nous étions", "il a": "il était", "elle a": "elle était", "on a": "on était" })[who.toLowerCase().replace(/\s+/g, " ")]} en déplacement professionnel`, /travel(?:l)?ing\s+for\s+(?:work|business)/i],
    [`${S}(votre|ton|le|son|mon|leur|un|du)\\s+NIP${E}`, "$1 code PIN", /\bPIN\b/],
    [`${S}guichet\\s+automatique(?:\\s+bancaire)?${E}`, "distributeur automatique", /\bATMs?\b/],
    [`${S}(fixer|fixez|fixe|serrer|serrez|serre)\\s+(?=(?:votre|ta|vos|tes|leur|leurs)\\s+ceintures?)`, (m, verb) => `${({ fixer: "attacher", fixez: "attachez", fixe: "attache", serrer: "attacher", serrez: "attachez", serre: "attache" })[verb.toLowerCase()]} `, /\b(?:fasten|buckle)\b/i],
    [`${S}(tu\\s+as|vous\\s+avez|il\\s+a|elle\\s+a|on\\s+a|j['’]ai|nous\\s+avons|ils\\s+ont|elles\\s+ont)\\s+juste\\s+(dit|fait|vu|écrit|reçu|envoyé|appelé|parlé|demandé|répondu|mangé|acheté|entendu|lu|pris|mis|compris|perdu|fini|trouvé|raté|oublié|gagné|reçu)${E}`, (m, who, participle) => {
        const p = participle.toLowerCase();
        const infinitive = FR_INFINITIVE[p] ?? p.replace(/é$/, "er");
        return `${VENIR_DE[who.toLowerCase().replace(/\s+/g, " ")]} ${/^[aeéèêiouyh]/i.test(infinitive) ? "d'" : "de "}${infinitive}`;
    }, /\b(?:did|have|has)\s+(?:you|he|she|they|I|we)\s+just\b|\bjust\s+(?:said|told|did|saw)\b/i],
    [`${S}(tu\\p{L}*)\\s+deux\\s+oiseaux\\s+(?:avec|d['’])\\s*une\\s+(?:seule\\s+)?pierre${E}`, (m, verb) => `${({ tue: "fais", tues: "fais", tuez: "faites", tuer: "faire", tué: "fait", tuons: "faisons", tuent: "font", tuant: "faisant", tuera: "fera", tuerai: "ferai" })[verb.toLowerCase()] ?? "faire"} d'une pierre deux coups`, /two\s+birds\s+with\s+one\s+stone/i],
    [`${S}(?:il\\s+)?vaut\\s+mieux\\s+être\\s+(?:prudente?s?|en\\s+sécurité|sûre?)(?:\\s+que\\s+(?:désolée?|navrée?))?${E}`, "mieux vaut prévenir que guérir", /better\s+safe\s+than\s+sorry/i],
    [`${S}mieux\\s+vaut\\s+être\\s+(?:prudente?s?|en\\s+sécurité|sûre?)(?:\\s+que\\s+(?:désolée?|navrée?))?${E}`, "mieux vaut prévenir que guérir", /better\s+safe\s+than\s+sorry/i],
    [`${S}sans\\s+(?:une\\s+)?note${E}`, "sans mot d'excuse", /\babsen(?:t|ce)\b|\bmissed\s+school\b/i],
    [`${S}(c['’]est|tu\\s+es|il\\s+est|elle\\s+est|vous\\s+êtes)\\s+(un|une)\\s+tel(?:le)?\\s+`, "$1 vraiment $2 "],
    [`${S}(volé|vole|voler|volent|volait)\\s+(?:les\\s+projecteurs|le\\s+spectacle|le\\s+tonnerre|le\\s+show)${E}`, "$1 la vedette", /\bthunder\b|\bstole\s+the\s+show\b|\bsteal\w*\s+the\s+show\b/i],
    [`${S}(enterr\\p{L}*)\\s+la\\s+hachette${E}`, "$1 la hache de guerre", /bury\w*\s+the\s+hatchet/i],
    [`${S}(?:la\\s+|une\\s+)?réclamation\\s+(?:de|des)\\s+bagages${E}`, (m) => (/^une/i.test(m) ? "un retrait des bagages" : /^la/i.test(m) ? "le retrait des bagages" : "retrait des bagages"), /baggage\s+claim/i],
    [`${S}(?:le|ce|votre|ton)\\s+bordereau\\s+(?:de\\s+)?permission${E}`, "l'autorisation parentale", /permission\s+slip/i],
    [`${S}(?:une|la)\\s+conférence\\s+parents?-(?:enseignants?|professeurs?)${E}`, "une réunion parents-professeurs", /parent-teacher/i],
    [`${S}(?:pliez|plie|plier)\\s+(?:dans\\s+)?(les|le|la|l['’])\\s*`, (m, det) => `incorporez délicatement ${/['’]$/.test(det) ? det : `${det} `}`, /\bfold\b/i],
    [`${S}(?:sur|en)\\s+appel${E}`, "d'astreinte", /\bon[-\s]call\b/i],
    [`${S}(j['’]ai|tu\\s+as|il\\s+a|elle\\s+a|on\\s+a|nous\\s+avons|vous\\s+avez|ils\\s+ont|elles\\s+ont)\\s+réalisé(?=\\s+(?:que|qu['’]|à\\s+quel\\s+point|combien)${E})`, (m, who) => ({ "j'ai": "je me suis rendu compte", "j’ai": "je me suis rendu compte", "tu as": "tu t'es rendu compte", "il a": "il s'est rendu compte", "elle a": "elle s'est rendu compte", "on a": "on s'est rendu compte", "nous avons": "nous nous sommes rendu compte", "vous avez": "vous vous êtes rendu compte", "ils ont": "ils se sont rendu compte", "elles ont": "elles se sont rendu compte" })[who.toLowerCase().replace(/\s+/g, " ")], /\brealiz(?:e|ed|es|ing)\b|\brealis(?:e|ed|es|ing)\b/i],
    [`${S}(une|la|quelle|cette)\\s+déception${E}`, (m, det) => `${det} tromperie`, (src) => /\bdeception\b/i.test(src) && !/disappoint/i.test(src)],
    [`${S}(la|une|cette)\\s+conférence${E}`, (m, det) => `${({ la: "le", une: "un", cette: "ce" })[det.toLowerCase()]} cours`, (src) => /\blectures?\b/i.test(src) && /\b(?:college|university|professor|class|student|campus|semester|course|uni|biology|math|history|physics|chemistry|law|economics)\b/i.test(src)],
    [`${S}mauviète${E}`, "mauviette"],
    [`${S}je\\s+(?=[aeéèêiouâîôûœ]\\p{L})`, "j'"],
    [`${S}(?:aussi\\s+)?têtue?s?\\s+(?:qu['’]un\\s+mulet|qu['’]une\\s+mule|comme\\s+un\\s+mulet)${E}`, (m) => `${/têtues?/i.test(m) ? "têtue" : "têtu"} comme une mule`],
    [`${S}(boi\\p{L}*)\\s+comme\\s+un\\s+poisson${E}`, "$1 comme un trou", /drink\w*\s+like\s+a\s+fish/i],
    [`${S}un\\s+loup\\s+en\\s+(?:tenue|vêtements|habits)\\s+de\\s+(?:mouton|brebis)${E}`, "un loup déguisé en agneau"],
    [`${S}les\\s+poils\\s+en\\s+quatre${E}`, "les cheveux en quatre", /split\w*\s+hairs/i],
    [`${S}(donné|donne|donnent|donner)\\s+un\\s+regard\\s+(noir|sale|mauvais)${E}`, (m, verb) => `${({ donné: "lancé", donne: "lance", donnent: "lancent", donner: "lancer" })[verb.toLowerCase()]} un regard noir`],
    [`${S}(ne\\s+)?(pleure|pleurez|crie|criez)\\s+(pas\\s+)?(?:de\\s+|au\\s+)?loup${E}`, (m, ne, verb, not) => `${ne ?? ""}${/ez$/i.test(verb) ? "criez" : "crie"} ${not ?? ""}au loup`.replace(/\s+/g, " "), /\bcry\w*\s+wolf\b/i],
    // « I used to play » : imparfait (le modèle met le passé composé, ou un imparfait fautif).
    [`${S}(j['’]ai|tu\\s+as|il\\s+a|elle\\s+a|on\\s+a|nous\\s+avons|vous\\s+avez|ils\\s+ont|elles\\s+ont)\\s+(\\p{L}+é|fait|vu|pris|bu|eu|lu|dit|mis|vécu|couru|dormi|écrit|été)(?=\\s)`, (m, who, participle) => {
        const subject = who.toLowerCase().replace(/\s+/g, " ").replace(/^j['’]ai$/, "je").split(" ")[0];
        const irregular = { fait: "fais", vu: "voy", pris: "pren", bu: "buv", eu: "av", lu: "lis", dit: "dis", mis: "mett", vécu: "viv", couru: "cour", dormi: "dorm", écrit: "écriv", été: "ét" };
        const p = participle.toLowerCase();
        const stem = irregular[p] ?? p.replace(/é$/, "").replace(/(?<=g)$/, "e").replace(/c$/, "ç");
        const ending = bySubject(subject, ["ais", "ais", "ait", "ions", "iez", "aient"]);
        const fixedStem = /(?:ge|ç)$/.test(stem) && /^i/.test(ending) ? stem.replace(/e$/, "").replace(/ç$/, "c") : stem;
        const form = `${fixedStem}${ending}`;
        return `${subject === "je" ? (/^[aeéèêiouyh]/i.test(form) ? "j'" : "je ") : `${subject} `}${form}`;
    }, /\bused\s+to\s+[a-z]+/i],
    [`${S}(je|tu|il|elle|on|nous|vous|ils|elles)\\s+(?:jour|jonv|jouar)(ais|ait|ions|iez|aient)${E}`, "$1 jou$2"],
    [`${S}(elle|il|j['’]ai|tu\\s+as|on)\\s*(?:a\\s+)?(?:eu\\s+)?coupé\\s+(?:ses|mes|tes|leurs)\\s+cheveux${E}`, (m, who) => ({ elle: "elle s'est fait couper les cheveux", il: "il s'est fait couper les cheveux", "j'ai": "je me suis fait couper les cheveux", "j’ai": "je me suis fait couper les cheveux", "tu as": "tu t'es fait couper les cheveux", on: "on s'est fait couper les cheveux" })[who.toLowerCase().replace(/\s+/g, " ")], /\b(?:got|had|get|getting)\s+(?:her|his|my|your|their|our)\s+hair\s+(?:cut|done)\b/i],
    [`${S}(elle|il)\\s+a\\s+eu\\s+ses\\s+cheveux\\s+coupés${E}`, "$1 s'est fait couper les cheveux", /hair\s+cut/i],
    [`${S}(un|une)\\s+killjoys?${E}`, "un rabat-joie"],
    [`${S}compensation\\s+pour\\s+licenciement${E}`, "indemnité de licenciement"],
    [`^(\\s*)(?:vous|tu)\\s*,?\\s+(enfoiré|connard|salaud|crétin|idiot|abruti|imbécile|ordure|traître)(?=\\s*[!.,])`, (m, space, word) => `${space}Espèce ${/^[aeéèêiouyh]/i.test(word) ? "d'" : "de "}${word}`, /^\s*you\s+[\p{L}-]+\s*[!.,]/iu],
    [`${S}(inculpé|inculpée|inculpés)(?=\\s+(?:deux|trois|deux\\s+fois|à\\s+tort|plusieurs))`, "facturé", /\bcharged?\b[^.]*\b(?:twice|two\s+times|card|account|fee|bill|order)\b/i],
    [`${S}à\\s+(\\d{1,2})\\s+(heures?|h)(?:\\s+(\\d\\d))?(?!\\s*(?:pile|précises?|exactement))`, (m, h, unit, mm) => `à ${h} ${unit}${mm ? ` ${mm}` : ""} pile`, /\bon\s+the\s+dot\b|\b\d{1,2}(?::\d\d)?\s*(?:o['’]clock\s+)?sharp\b/i],
    [`${S}(?:rassemblez-vous|rassemble-toi|reprenez-vous|reprends-toi|mettez-vous\\s+ensemble|mets-toi\\s+ensemble)${E}`, (m) => (/(?:ez|vous)/i.test(m) ? "ressaisissez-vous" : "ressaisis-toi"), /\bpull\s+(?:yourself|yourselves)\s+together\b/i],
    [`${S}case\\s+à\\s+carré${E}`, "case départ"],
    [`${S}c['’]est\\s+de\\s+retour\\s+(?:à\\s+la\\s+case\\s+départ|au\\s+point\\s+de\\s+départ)${E}`, "c'est le retour à la case départ"],
    [`${S}(blâmer|blâme|blâmes|blâment|blâmez|blâmé)\\s+les\\s+autres${E}`, (m, verb) => `${({ blâmer: "rejeter", blâme: "rejette", blâmes: "rejettes", blâment: "rejettent", blâmez: "rejetez", blâmé: "rejeté" })[verb.toLowerCase()]} la faute sur les autres`, /\bpass\w*\s+the\s+buck\b/i],
    [`${S}bons?\\s+pour\\s+rien${E}`, (m) => (/^bons/i.test(m) ? "bons à rien" : "bon à rien")],
    [`${S}n['’](essaie|essaye|essayez)\\s+pas\\s+d['’]être\\s+(?:intelligente?|malin|maligne)${E}`, (m, verb) => (/ez$/i.test(verb) ? "ne faites pas le malin" : "ne fais pas le malin"), /smart-?ass|wise-?ass|smart\s+aleck|wise\s+guy/i],
    [`${S}(?:c['’]est|tout\\s+est)\\s+(?:du\\s+)?(?:chinois|grec)\\s+pour\\s+moi${E}`, "c'est du chinois pour moi", /Greek\s+to\s+me/i],
    [`${S}je\\s+ne\\s+peux\\s+pas\\s+attendre\\s+(de|d['’])`, "j'ai hâte $1", /can['’]t\s+wait\s+to\b/i],
    [`${S}parlons-en${E}`, "faisons le point", /\btouch\s+base\b/i],
    [`${S}(tu\\s+es|vous\\s+êtes|il\\s+est|elle\\s+est|t['’]es)\\s+(?:tellement\\s+|si\\s+)?plein(?:e?s?)\\s+de\\s+(?:merde|conneries|bêtises)${E}`, (m, who) => `${({ "tu es": "tu racontes", "t'es": "tu racontes", "t’es": "tu racontes", "vous êtes": "vous racontez", "il est": "il raconte", "elle est": "elle raconte" })[who.toLowerCase().replace(/\s+/g, " ")]} n'importe quoi`, /\bfull\s+of\s+(?:shit|crap|it|bull)/i],
    [`${S}(un|une)\\s+(connard|connasse|cochon|crétin|crétine|idiot|idiote|abruti|abrutie|arnaque|nul|nulle|loser|raté|ratée|imbécile|salaud|gâchis|désastre)\\s+total(?:e)?${E}`, (m, det, noun) => `${det} ${/^une$/i.test(det) ? "vraie" : "vrai"} ${noun}`],
    [`^(\\s*)C['’]est\\s+(?=\\d{1,2}\\s?h(?:\\s?\\d\\d)?(?:\\s*[.!?]|\\s*$))`, "$1Il est ", /^\s*it['’]s\s+(?:\d|ten|five|twenty|a\s+quarter|half|noon|midnight)/i],
    [`${S}à\\s+(midi|minuit)(?!\\s+(?:pile|précis|exactement))${E}`, "à $1 pile", /\b(?:noon|midnight)\s+sharp\b|\bsharp\s+at\s+(?:noon|midnight)\b|\b(?:noon|midnight)\s+on\s+the\s+dot\b/i],
    [`${S}(mélange|mélanges|mélangez|mélanger|mélangé|mélangeant|remuez|remue|remuer)(\\s+pas)?\\s+le\\s+couteau${E}`, (m, verb, not) => `${({ mélange: "remue", mélanges: "remues", mélangez: "remuez", mélanger: "remuer", mélangé: "remué", mélangeant: "remuant" })[verb.toLowerCase()] ?? verb}${not ?? ""} le couteau`, /\bsalt\s+in(?:to)?\s+(?:the|my|his|her|your|an\s+open)\s+wound/i],
    [`${S}(?:une|la)\\s+note\\s+de\\s+crédit(?:\\s+pour\\s+(?:la\\s+boutique|le\\s+magasin))?${E}`, "un avoir", /\bstore\s+credit\b/i],
    [`${S}(?:un\\s+)?siège\\s+(?:d['’]allée|côté\\s+allée|de\\s+couloir)${E}`, (m) => (/^un/i.test(m) ? "une place côté couloir" : "place côté couloir"), /\baisle\s+seat/i],
    [`${S}(?:un\\s+)?siège\\s+(?:de\\s+fenêtre|côté\\s+fenêtre|près\\s+de\\s+la\\s+fenêtre)${E}`, (m) => (/^un/i.test(m) ? "une place côté hublot" : "place côté hublot"), /\bwindow\s+seat/i],
    [`${S}(?:votre|ta|la)\\s+table\\s+(?:de\\s+plateau|à\\s+plateau|plateau)${E}`, (m) => `${m.split(/\s+/)[0]} tablette`, /\btray\s+tables?\b/i],
    [`${S}(?:faites-vous|fais-toi|mettez-vous|mets-toi|sentez-vous|sens-toi)\\s+(?:à\\s+la\\s+maison|chez\\s+vous|chez\\s+toi|à\\s+l['’]aise|comme\\s+(?:à\\s+la\\s+maison|chez\\s+vous|chez\\s+toi))${E}`, (m) => (/(?:vous|ez)/i.test(m) ? "faites comme chez vous" : "fais comme chez toi"), /\bmake\s+(?:yourself|yourselves)\s+at\s+home\b|\bfeel\s+at\s+home\b/i],
    [`${S}(demandé|demande|demandent|demander|demandez)\\s+(?=(?:un|une|le|la|les|des|qu['’]|que|son|sa|ses|leur|mon|ma|mes|à\\s+parler|à\\s+voir|des\\s+excuses)${E})`, (m, verb) => `${({ demandé: "exigé", demande: "exige", demandent: "exigent", demander: "exiger", demandez: "exigez" })[verb.toLowerCase()]} `, /\bdemand(?:ed|s|ing)?\s+(?:a|an|the|to|that|his|her|their|my|our|your|some|an?\s+apology|immediate)\b/i],
    [`${S}(ce\\s+n['’]est|ce\\s+n['’]était|c['’]est)\\s+pas\\s+(?:si\\s+|très\\s+)?sérieux${E}`, (m) => (/était/i.test(m) ? "ce n'était pas grave" : "ce n'est pas grave"), /\bbig\s+deal\b|\bnbd\b|\bbiggie\b/i],
    [`${S}(?:les|des)\\s+choses\\s+(?:douces|sucrées)${E}`, "les sucreries", /sweet\s+tooth|\bsweets\b/i],
    [`${S}la\\s+(?:dérouler|rouler|répandre)${E}`, "l'étaler", /\broll(?:ed|ing)?\s+(?:it|them|the\s+dough|the\s+pastry)\s+out\b|\broll\s+out\s+the\s+(?:dough|pastry)\b/i],
    [`${S}(?:dérouler|rouler|répandre)\\s+la\\s+pâte${E}`, "étaler la pâte", /\broll(?:ed|ing)?\s+(?:it|them|the\s+dough|the\s+pastry)\s+out\b|\broll\s+out\s+the\s+(?:dough|pastry)\b/i],
    [`(?<=${S}(?:veux|veut|voulons|voulez|veulent|voulais|voulait|envie\\s+de|vais|va|allons|vont)\\s+)(?:un\\s+peu\\s+)?ne\\s+pas\\s+aller\\s+(?:en\\s+classe|en\\s+cours|à\\s+l['’]école|au\\s+cours|à\\s+la\\s+fac)${E}`, "sécher les cours", /\b(?:skip|cut|ditch)\w*\s+(?:class|classes|school|lectures?)\b/i],
    [`(?:s['’]il\\s+vous\\s+plaît\\s*,?\\s+)?(?:attendez|patientez|tenez(?:\\s+bon)?|veuillez\\s+attendre|veuillez\\s+tenir(?:\\s+la\\s+ligne)?)(?=\\s*[.!]|\\s*$)`, "veuillez patienter, ne quittez pas", /\bplease\s+hold\b/i],
    [`${S}(est|sont|était)\\s+dans\\s+le\\s+rouge\\s+(?:par|de)\\s+`, "$1 à découvert de ", /\boverdrawn\b/i],
    [`${S}(êtes-vous|vous\\s+êtes)\\s+(satisfait|prêt|sûr|content|certain|ravi|intéressé|déçu|disponible|libre)(?![\\p{L}])`, (m, verb, adj) => `${verb} ${/(?:e|disponible|libre)$/i.test(adj) ? adj : `${adj}e`}`, /^\s*(?:Mrs|Ms|Miss)\.?\s+\p{Lu}[\p{L}'’-]*\s*,|^\s*(?:madam|ma['’]am)\s*,/iu],
    [`${S}(êtes-vous|vous\\s+êtes)\\s+(?:prête|prêt|prêts)(?=\\s*,?\\s*(?:les\\s+filles|mesdames|mes\\s+chéries)${E})`, "$1 prêtes", /\b(?:girls|ladies)\b/i],
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
    // « bike » : un vélo, sauf si l'anglais parle de moto.
    [`${S}(la|une|ma|ta|sa|cette|votre|notre|leur)\\s+moto${E}`, (m, det) => `${({ la: "le", une: "un", ma: "mon", ta: "ton", sa: "son", cette: "ce", votre: "votre", notre: "notre", leur: "leur" })[det.toLowerCase()]} vélo`, (src) => /\bbikes?\b/i.test(src) && !/\b(?:motor\s*bikes?|motorcycles?|dirt\s*bikes?)\b/i.test(src)],
    [`${S}(les|des|mes|tes|ses|ces|vos|nos|leurs)\\s+motos${E}`, "$1 vélos", (src) => /\bbikes?\b/i.test(src) && !/\b(?:motor\s*bikes?|motorcycles?|dirt\s*bikes?)\b/i.test(src)],
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
    [`${S}(une|la|ma|ta|sa|votre|notre|cette|leur|ma\\s+nouvelle)\\s+(?:demande|requête)\\s+de\\s+(?:tirage|traction|extraction)${E}`, "$1 pull request"],
    [`${S}(?:les|des|mes|tes|vos|nos|ces)\\s+(?:demandes|requêtes)\\s+de\\s+(?:tirage|traction|extraction)${E}`, (m) => `${m.split(/\s/)[0]} pull requests`],
    [`${S}(?:demande|requête)s?\\s+de\\s+(?:tirage|traction|extraction)${E}`, (m) => (/^(?:demandes|requêtes)/i.test(m) ? "pull requests" : "pull request")],
    [`${S}(mon|ton|son|votre|notre|leur|le|un|ce|cet|dernier|premier)\\s+engagement${E}`, (m, det) => `${/^cet$/i.test(det) ? "ce" : det} commit`, IT_SOURCE],
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

const EN_POSSESSIVE = { i: "my", you: "your", he: "his", she: "her", we: "our", they: "their" };
const BOOK_SOURCE = (src) => /épuisée?s?/i.test(src) && /\b(?:librair\p{L}*|libraire|livres?|romans?|exemplaires?|stock|éditions?|tomes?|BD|album|disque|magasin|rupture)\b/iu.test(src);

const EN_FIX = compile([
    // --- Campagne du 06/11/2026 : la paraphrase traduite, puis l'expression anglaise attendue.
    [`${S}(I|you|he|she|we|they)\\s+(made|make|makes|has\\s+made|have\\s+made|had\\s+made)\\s+(?:a\\s+)?(?:big\\s+|huge\\s+|real\\s+|terrible\\s+)?(?:gaffe|blunder|mistake|faux\\s+pas|faux-pas)${E}`, (m, who, verb) => `${who} ${({ made: "put", make: "put", makes: "puts" })[verb.toLowerCase()] ?? verb.replace(/made$/i, "put")} ${EN_POSSESSIVE[who.toLowerCase()]} foot in it`, /pieds\s+dans\s+le\s+plat/i],
    [`${S}(share|shared|sharing|shares|cut|divide|divided)\\s+the\\s+difference${E}`, (m, verb) => `${({ sharing: "splitting", shares: "splits" })[verb.toLowerCase()] ?? "split"} the difference`, /poire\s+en\s+deux/i],
    [`${S}(the\\s+|a\\s+|his\\s+|her\\s+|my\\s+|your\\s+|their\\s+)?bachelor['’]?s?(?:\\s+degree)?${E}`, (m, det) => `${det ?? ""}baccalaureate`, /\bbac(?:calauréat)?\b/i],
    [`${S}(taking|take|takes|took|pass|passed|passing|sitting|sit|sat|got|get|gets|had|failed|fail|preparing\\s+for|studying\\s+for|revising\\s+for)\\s+(?:the|her|his|my|your|their)\\s+high\\s+school(?!\\s+(?:diploma|exam|leaving|certificate))${E}`, "$1 the baccalaureate", /\bbac\b/i],
    [`${S}in\\s+(?:the\\s+|a\\s+)?(?:terminale?|senior\\s+year)${E}`, "in the final year of high school", /\bterminale\b/i],
    [`${S}(gently\\s+|carefully\\s+|delicately\\s+)?incorporate\\s+(them|it)(\\s+(?:gently|carefully|delicately))?${E}`, "$1fold $2 in$3", (src) => /incorpor/i.test(src) && /blancs|pâte|farine|crème|mélange|appareil|préparation|œufs|oeufs|beurre|sucre/i.test(src)],
    [`${S}(the|my|our|your|his|her|their)\\s+neighbou?r(s?)\\s+(?:from\\s+)?above${E}`, "$1 upstairs neighbor$2", /voisine?s?\s+(?:du\s+dessus|d['’]en\s+haut)/i],
    [`${S}(the|my|our|your|his|her|their)\\s+neighbou?r(s?)\\s+(?:from\\s+)?below${E}`, "$1 downstairs neighbor$2", /voisine?s?\s+(?:du\s+dessous|d['’]en\s+bas)/i],
    [`${S}(clean|cleans|cleaned|cleaning)\\s+(?:up\\s+)?(your|his|her|my|our|their|the)\\s+(room|bedroom|office|desk)${E}`, (m, verb, pos, room) => `${({ clean: "tidy", cleans: "tidies", cleaned: "tidied", cleaning: "tidying" })[verb.toLowerCase()]} up ${pos} ${room}`, /\brang(?:e|es|ez|er|é|eons)\b/i],
    [`${S}at\\s+the\\s+(last|next|first|final|latest)\\s+(?:check|control|inspection)${E}`, "in the $1 test", (src) => /\bcontrôles?\b/i.test(src) && SCHOOL_CONTEXT.test(src)],
    [`${S}(?:check|control|inspection)(s?)${E}`, "test$1", (src) => /\bcontrôles?\b/i.test(src) && SCHOOL_CONTEXT.test(src)],
    [`${S}(a|the|your|his|her|my|warm|wool|woolly)\\s+cap${E}`, "$1 hat", (src) => /\bbonnets?\b/i.test(src) && !/casquette/i.test(src)],
    [`${S}(?:some\\s+)?currency${E}`, "change", (src) => /\bmonnaie\b/i.test(src) && !/monnaies?\s+(?:unique|locale|étrangère|nationale|européenne|virtuelle|numérique)|\bcrypto/i.test(src)],
    [`${S}ring(s|ing)?\\s+(?:at\\s+)?the\\s+door(?![\\p{L}])`, "ring$1 the doorbell"],
    [`${S}(doesn['’]t|does\\s+not|isn['’]t|is\\s+not)\\s+work(?:ing)?\\s+(?:anymore\\s+|any\\s+more\\s+)?since${E}`, "hasn't been working since", /depuis/i],
    [`${S}(don['’]t|do\\s+not|aren['’]t|are\\s+not)\\s+work(?:ing)?\\s+(?:anymore\\s+|any\\s+more\\s+)?since${E}`, "haven't been working since", /depuis/i],
    [`${S}(is|has\\s+been|was)\\s+in\\s+the\\s+red\\s+(?:of|by)\\s+`, (m, verb) => `${/^was/i.test(verb) ? "was" : "has been"} overdrawn by `, /découvert/i],
    [`€[\\s\\u00a0\\u202f]?(\\d{1,3}),(\\d{2})(?![\\d])`, "€$1.$2"],
    [`^(\\s*)(?:Madam,\\s*Sir|Madam\\s+or\\s+Sir|Madam,\\s+Mister)(?=\\s*[,:])`, "$1Dear Sir or Madam", /^\s*Madame,?\s+Monsieur/i],
    [`(?<=^|[.!?]\\s+)Kindly\\s*[.,]?\\s*$`, "Best regards", /cordialement|bonne\s+réception/i],
    [`${S}come\\s+back\\s+to\\s+me${E}`, "get back to me", /revenir\s+vers\s+moi|reviens\s+vers\s+moi|revenez\s+vers\s+moi/i],
    [`${S}(my|your|his|her|the|an?)\\s+agenda${E}`, (m, det) => `${/^an$/i.test(det) ? "a" : det} planner`, /\bagenda\b/i],
    [`${S}(my|your|his|her|the)\\s+ID${E}`, "$1 username", /\bidentifiants?\b/i],
    [`${S}on\\s+(?:guard|strain|standby\\s+duty|duty)(?=\\s+(?:this|next|tonight|tomorrow|on|every|all)${E}|\\s*[,.!?]|\\s*$)`, "on call", /astreinte/i],
    [`${S}transfer(s|red|ring)?\\s+(?:me\\s+)?(the|this|that|your|my|his|her)\\s+(e-?mails?|mails?|messages?)${E}`, (m, ending, det, what) => `forward${({ s: "s", red: "ed", ring: "ing" })[ending ?? ""] ?? ""} me ${det} ${what}`, /\b(?:faire\s+suivre|transférer|transfère|transfères|transférez)\b/i],
    [`${S}(?:the\\s+)?Chained\\s+Duck${E}`, "Le Canard enchaîné", /Canard\s+enchaîné/i],
    [`${S}(it|the\\s+book|the\\s+novel|the\\s+album|the\\s+edition|the\\s+model|the\\s+item)\\s+(was|is|has\\s+been)\\s+exhausted${E}`, "$1 $2 sold out", BOOK_SOURCE],
    [`${S}sweet\\s+butter${E}`, "unsalted butter", /beurre\s+doux/i],
    [`${S}(?:bread\\s+of\\s+crumb|crumb\\s+bread)${E}`, "sliced bread", /pain\s+de\s+mie/i],
    [`${S}list\\s+of\\s+(?:races|errands|shopping)${E}`, "shopping list", /liste\s+de(?:s)?\s+courses/i],
    [`${S}the\\s+drop\\s+(?:of\\s+)?too\\s+much${E}`, "the last straw", /goutte|bouquet|comble/i],
    [`${S}(missed|miss|misses|missing)\\s+school\\s+(?:voluntarily|deliberately|on\\s+purpose|intentionally)${E}`, (m, verb) => `${({ missed: "skipped", miss: "skip", misses: "skips", missing: "skipping" })[verb.toLowerCase()]} school`, /séch\p{L}*|buissonnière/iu],
    [`${S}(missed|miss|misses|missing)\\s+(?:voluntarily|deliberately|on\\s+purpose|intentionally)\\s+(school|class|classes|the\\s+class|the\\s+lesson|the\\s+meeting)${E}`, (m, verb, what) => `${({ missed: "skipped", miss: "skip", misses: "skips", missing: "skipping" })[verb.toLowerCase()]} ${what}`, /séch\p{L}*|buissonnière/iu],
    [`${S}when\\s+the\\s+pigs\\s+(fly|will\\s+fly|can\\s+fly)${E}`, "when pigs $1", /poules\s+auront\s+des\s+dents/i],
    // « Il venait de partir » : « had just left ».
    [`${S}(I|you|he|she|it|we|they)\\s+just\\s+(\\p{L}+ed|left|gone|come|came|went|arrived|finished|said|told|done|did|seen|saw|got|eaten|ate|bought|sent|made|taken|took|given|gave|written|wrote|spoken|spoke|begun|began|lost|found|met|heard|fallen|fell)${E}`, (m, who, verb) => `${who} had just ${({ came: "come", went: "gone", did: "done", saw: "seen", ate: "eaten", took: "taken", gave: "given", wrote: "written", spoke: "spoken", began: "begun", fell: "fallen" })[verb.toLowerCase()] ?? verb}`, /\bvenai(?:s|t|ent)\s+d/i],
    // Réplique de dialogue (« — Si, j'arrive ») : le tiret devenu guillemet ouvrant.
    [`(?<=[.!?]\\s*)“(?![^”]*”)`, "— ", /\s[—–]\s/],
    // Prénom féminin en sujet (« Victoire a fêté sa victoire ») : « her », pas « his ».
    [`${S}(his|himself)${E}`, (m) => (/self$/i.test(m) ? "herself" : "her"), (src) => {
        const first = /^\s*(\p{Lu}[\p{L}'’-]+)\s+(?!et\s)/u.exec(src);
        return !!first && FEMININE_NAMES.has(first[1]) && !/\b(?:il|lui|ils|son\s+mari|son\s+frère|son\s+père|son\s+fils)\b/i.test(src);
    }],
    // Proverbes et expressions que le modèle rend mot à mot.
    [`${S}(throw|throwing|threw|thrown|pour|pouring|poured|add|adding|added|put|putting|pull|pulling)\\s+(?:some\\s+)?oil\\s+(?:on|onto|in|into)\\s+(?:the\\s+)?fire${E}`, (m, verb) => `${({ throwing: "adding", pouring: "adding", adding: "adding", putting: "adding", pulling: "adding", threw: "added", thrown: "added", poured: "added", added: "added" })[verb.toLowerCase()] ?? "add"} fuel to the fire`, /huile\s+sur\s+le\s+feu/i],
    [`${S}(stir|stirring|stirred|twist|twisting|twisted|turn|turning|turned|move|moving)\\s+the\\s+knife\\s+in\\s+the\\s+wound${E}`, (m, verb) => `${/ing$/i.test(verb) ? "rubbing" : /ed$/i.test(verb) ? "rubbed" : "rub"} salt in the wound`, /couteau\s+dans\s+la\s+plaie/i],
    [`^(\\s*)In\\s+Rome,\\s+(?:do|act)\\s+(?:like|as)\\s+(?:the\\s+)?Romans(?:\\s+do)?`, "$1When in Rome, do as the Romans do", /Rome[^.]*Romains/i],
    [`${S}your\\s+(?:opinion|guess|advice)\\s+is\\s+(?:worth|as\\s+good\\s+as)\\s+mine${E}`, "your guess is as good as mine", /vaut\s+le\s+mien/i],
    [`${S}the\\s+more\\s+(?:crazy|mad|fools?|crazies)[^,.!?\\n]{0,25},\\s+the\\s+more\\s+(?:you|we|one|people)\\s+laughs?${E}`, "the more the merrier", /plus\s+on\s+est\s+de\s+fous/i],
    [`${S}(?:a|one)\\s+misfortune\\s+never\\s+(?:comes|arrives)\\s+alone${E}`, "when it rains, it pours", /malheur\s+n['’]arrive\s+jamais\s+seul/i],
    [`${S}far\\s+from\\s+(?:the\\s+)?eyes,?\\s+(?:far|away)\\s+from\\s+(?:the\\s+)?heart${E}`, "out of sight, out of mind", /loin\s+des\s+yeux/i],
    [`${S}such\\s+(?:a\\s+)?father,\\s+such\\s+(?:a\\s+)?son${E}`, "like father, like son", /tel\s+père/i],
    [`${S}such\\s+(?:a\\s+)?mother,\\s+such\\s+(?:a\\s+)?daughter${E}`, "like mother, like daughter", /telle\s+mère/i],
    [`${S}(?:do\\s+not|don['’]t|never|you\\s+should\\s+not|you\\s+shouldn['’]t)\\s+wake\\s+(?:up\\s+)?(?:the|a)\\s+sleeping\\s+cat${E}`, "let sleeping dogs lie", /chat\s+qui\s+dort/i],
    [`${S}(in|at|to|from|into)\\s+college${E}`, "$1 middle school", (src) => /\bcollège\b/i.test(src) && !/Collège\s+de\s+France/.test(src)],
    [`${S}the\\s+world\\s+upside\\s+down${E}`, "the world turned upside down", /monde\s+à\s+l['’]envers/i],
    [`${S}(?:better\\s+)?a\\s+bird\\s+in\\s+the\\s+hand\\s+than\\s+two\\s+in\\s+the\\s+bush(?:es)?${E}`, "a bird in the hand is worth two in the bush", /tiens\s+vaut\s+mieux/i],
    [`${S}(?:you\\s+)?(?:have|had|got)\\s+(?:a|some)\\s+fine\\s+by\\s+parking${E}`, (m) => m.replace(/by\s+parking$/i, "for parking"), /garant/i],
    [`${S}(?:a|the)\\s+departure\\s+party${E}`, (m) => m.replace(/departure\s+party$/i, "farewell party")],
    [`(?:${S}(is|are)|(['’]s|['’]re))\\s+getting\\s+(angry|upset|annoyed|mad|irritated)\\s+(?:for|over|about)\\s+(?:nothing|anything)${E}`, (m, full, short, mood) => `${short ? " " : ""}${/re$/i.test(full ?? short) ? "get" : "gets"} ${mood} over nothing`, /\bprend\p{L}*\s+la\s+mouche/iu],
    [`^(\\s*)(?:Do|Shall)\\s+we\\s+(?:make|do|have|eat|get)\\s+(a|an|some)\\s+`, "$1How about $2 ", /^\s*on\s+se\s+(?:fait|mange|prend)\s+(?:un|une|des)\b/i],
    [`^(\\s*)(\\p{L}+!)\\s+\\2(?=\\s|$)`, "$1$2", (src) => !/(\p{L}+)\s*!\s*\1\s*!/iu.test(src)],
    [`${S}(?:with\\s+)?(?:a\\s+)?mention\\s+(?:very\\s+(?:well|good)|very\\s+fine)${E}`, "with highest honors", /mention\s+très\s+bien/i],
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
    [`(?<![\\p{N},.])(\\d{1,3}(?:,\\d{3})+|\\d+)(?:,(\\d{2}))?\\s?€`, (m, whole, cents) => `€${whole}${cents ? `.${cents}` : ""}`],
    // Civilités : « M. Dupont » → « Mr. Dupont », « Mme Leroy » → « Mrs. Leroy ».
    [`${S}M\\.\\s+(?=\\p{Lu})`, "Mr. "],
    [`${S}Mme\\.?\\s+(?=\\p{Lu})`, "Mrs. "],
    [`${S}Mlle\\.?\\s+(?=\\p{Lu})`, "Miss "],
    [`${S}good\\s+day\\s+to\\s+you${E}`, "have a nice day"],
    [`^\\s*good\\s+day(?=\\s*[!.]?\\s*$)`, "Have a nice day"],
    [`${S}bon\\s+app[eé]tite?${E}`, "enjoy your meal"],
    [`^\\s*cordially\\s*,?\\s*$`, "Best regards,"],
    [`^\\s*(?:good\\s+on\\s+you|well\\s+to\\s+you|good\\s+to\\s+you)\\s*,?\\s*$`, "Best regards,"],
    [`(?<=^\\s*|[.!?]\\s+)(?:good\\s+on\\s+you|well\\s+to\\s+you|good\\s+to\\s+you)\\s*\\.?\\s*$`, "Best regards.", /bien\s+à\s+(?:vous|toi)/i],
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

// Typographie française : espace insécable avant ? ! : ; et à l'intérieur des guillemets. Le code
// entre accents graves (« `Error: Cannot find module` ») n'est pas touché.
function frenchTypography(text) {
    const code = [];
    const masked = text.replace(/`[^`\n]*`/g, (span) => {
        code.push(span);
        return `\u0000${code.length - 1}\u0000`;
    });
    return frenchSpacing(masked).replace(/\u0000(\d+)\u0000/g, (m, n) => code[Number(n)]);
}

function frenchSpacing(text) {
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
const WEEKDAYS_MONTHS = /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December|The|A|An|It|This|That|My|Your|His|Her|Our|Their)$/;
// Prénoms féminins qui sont aussi des mots : cachés au modèle, qui ne sait plus que « sa » est « her ».
const FEMININE_NAMES = new Set("Victoire Blanche Claire Constance Prudence Patience Céleste Fleur Perle Reine Grâce Aimée Désirée Félicité Espérance Clémence Rose Violette Capucine Marguerite Olive Prune Cerise Mélodie Harmonie Aurore Océane Marine Ambre Jade Colombe Hermine Lune Étoile".split(" "));
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
        // marques après une préposition (« at Subway », « on Target ») sont cachées, ainsi que les
        // titres d'œuvres après « read », « watched »… (« I've read Beloved »).
        if (from === "en") {
            if (nameSets.brands.has(word) && /(?:^|\s)(?:at|from|on|with|to|in|via|by)\s+$/i.test(source.slice(0, start))) {
                add(start, start + word.length);
            } else if (!atStart && !WEEKDAYS_MONTHS.test(word) && /(?:^|\s)(?:read|reading|reread|re-read|watched|watching|seen|saw|finished|loved|recommend|recommended|bought|borrowed|lent|reviewed)\s+$/i.test(source.slice(0, start))) {
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

// --- Proverbes ---
// Un proverbe complet n'a pas d'équivalent mot à mot : avant la traduction, il est remplacé par un
// mot inventé que le modèle recopie tel quel, puis ce mot devient le proverbe de la langue cible
// (« Birds of a feather flock together » → « Qui se ressemble s'assemble »).
// [motif français, motif anglais, proverbe français, proverbe anglais] ; NEVER : sens unique.
const C = "\\s*,?\\s*";
const NEVER = "(?!)";
const PROVERBS = [
    ["qui\\s+se\\s+ressemble\\s+s['’]assemble", "birds\\s+of\\s+a\\s+feather(?:\\s+flock\\s+together)?", "qui se ressemble s'assemble", "birds of a feather flock together"],
    ["un\\s+malheur\\s+n['’]arrive\\s+jamais\\s+seul", "when\\s+it\\s+rains" + C + "it\\s+pours|it\\s+never\\s+rains\\s+but\\s+it\\s+pours", "un malheur n'arrive jamais seul", "when it rains, it pours"],
    ["loin\\s+des\\s+yeux" + C + "loin\\s+du\\s+c(?:œ|oe)ur", "out\\s+of\\s+sight" + C + "out\\s+of\\s+mind", "loin des yeux, loin du cœur", "out of sight, out of mind"],
    ["tel\\s+père" + C + "tel\\s+fils", "like\\s+father" + C + "like\\s+son", "tel père, tel fils", "like father, like son"],
    ["telle\\s+mère" + C + "telle\\s+fille", "like\\s+mother" + C + "like\\s+daughter", "telle mère, telle fille", "like mother, like daughter"],
    ["plus\\s+on\\s+est\\s+de\\s+fous" + C + "plus\\s+on\\s+rit", "the\\s+more\\s+the\\s+merrier", "plus on est de fous, plus on rit", "the more the merrier"],
    ["un\\s+(?:«\\s*)?tiens(?:\\s*»)?\\s+vaut\\s+mieux\\s+que\\s+deux\\s+(?:«\\s*)?tu\\s+l['’]auras(?:\\s*»)?", "a\\s+bird\\s+in\\s+the\\s+hand\\s+is\\s+worth\\s+two\\s+in\\s+the\\s+bush", "un tiens vaut mieux que deux tu l'auras", "a bird in the hand is worth two in the bush"],
    ["tout\\s+est\\s+bien\\s+qui\\s+finit\\s+bien", "all['’]s\\s+well\\s+that\\s+ends\\s+well|all\\s+is\\s+well\\s+that\\s+ends\\s+well", "tout est bien qui finit bien", "all's well that ends well"],
    ["les\\s+chiens\\s+ne\\s+font\\s+pas\\s+des\\s+chats", "the\\s+apple\\s+(?:doesn['’]t|does\\s+not|never)\\s+falls?\\s+far\\s+from\\s+the\\s+tree", "les chiens ne font pas des chats", "the apple doesn't fall far from the tree"],
    ["les\\s+grands\\s+esprits\\s+se\\s+rencontrent", "great\\s+minds\\s+think\\s+alike", "les grands esprits se rencontrent", "great minds think alike"],
    ["pas\\s+de\\s+nouvelles" + C + "bonnes\\s+nouvelles", "no\\s+news\\s+is\\s+good\\s+news", "pas de nouvelles, bonnes nouvelles", "no news is good news"],
    ["faute\\s+de\\s+grives" + C + "on\\s+mange\\s+des\\s+merles", "beggars\\s+can['’]t\\s+be\\s+choosers", "faute de grives, on mange des merles", "beggars can't be choosers"],
    ["(?:à|a)\\s+Rome" + C + "(?:il\\s+faut\\s+)?fai(?:s|re|tes)\\s+comme\\s+les\\s+Romains", "when\\s+in\\s+Rome(?:" + C + "do\\s+as\\s+the\\s+Romans(?:\\s+do)?)?", "à Rome, fais comme les Romains", "when in Rome, do as the Romans do"],
    ["(?:à|a)\\s+quelque\\s+chose\\s+malheur\\s+est\\s+bon", "every\\s+cloud\\s+has\\s+a\\s+silver\\s+lining", "à quelque chose malheur est bon", "every cloud has a silver lining"],
    ["après\\s+la\\s+pluie" + C + "(?:vient\\s+)?le\\s+beau\\s+temps", "after\\s+rain\\s+comes\\s+(?:sunshine|fair\\s+weather)", "après la pluie, le beau temps", "every cloud has a silver lining"],
    ["l['’]avenir\\s+appartient\\s+à\\s+ceux\\s+qui\\s+se\\s+lèvent\\s+tôt", "the\\s+early\\s+bird\\s+(?:catches|gets)\\s+the\\s+worm", "l'avenir appartient à ceux qui se lèvent tôt", "the early bird catches the worm"],
    ["la\\s+curiosité\\s+est\\s+un\\s+vilain\\s+défaut", "curiosity\\s+killed\\s+the\\s+cat", "la curiosité est un vilain défaut", "curiosity killed the cat"],
    ["les\\s+actes\\s+valent\\s+mieux\\s+que\\s+les\\s+(?:paroles|mots)", "actions\\s+speak\\s+louder\\s+than\\s+words", "les actes valent mieux que les paroles", "actions speak louder than words"],
    ["c['’]est\\s+en\\s+forgeant\\s+qu['’]on\\s+devient\\s+forgeron", "practice\\s+makes\\s+perfect", "c'est en forgeant qu'on devient forgeron", "practice makes perfect"],
    ["quand\\s+le\\s+chat\\s+n['’]est\\s+pas\\s+là" + C + "les\\s+souris\\s+dansent", "when\\s+the\\s+cat['’]s\\s+away" + C + "the\\s+mice\\s+will\\s+play|when\\s+the\\s+cat\\s+is\\s+away" + C + "the\\s+mice\\s+will\\s+play", "quand le chat n'est pas là, les souris dansent", "when the cat's away, the mice will play"],
    ["chat\\s+échaudé\\s+craint\\s+l['’]eau\\s+froide", "once\\s+bitten" + C + "twice\\s+shy", "chat échaudé craint l'eau froide", "once bitten, twice shy"],
    ["l['’]habit\\s+ne\\s+fait\\s+pas\\s+le\\s+moine", "(?:don['’]t|do\\s+not|never|you\\s+can['’]t|you\\s+shouldn['’]t)\\s+judge\\s+a\\s+book\\s+by\\s+its\\s+cover", "l'habit ne fait pas le moine", "don't judge a book by its cover"],
    ["qui\\s+vivra\\s+verra", "(?:only\\s+)?time\\s+will\\s+tell(?=\\s*[.!]|\\s*$)", "qui vivra verra", "time will tell"],
    ["c['’]est\\s+l['’]hôpital\\s+qui\\s+se\\s+moque\\s+de\\s+la\\s+charité", "(?:that['’]s\\s+|it['’]s\\s+)?the\\s+pot\\s+calling\\s+the\\s+kettle\\s+black", "c'est l'hôpital qui se moque de la charité", "that's the pot calling the kettle black"],
    ["rien\\s+ne\\s+sert\\s+de\\s+courir" + C + "il\\s+faut\\s+partir\\s+à\\s+point", "slow\\s+and\\s+steady\\s+wins\\s+the\\s+race", "rien ne sert de courir, il faut partir à point", "slow and steady wins the race"],
    ["tout\\s+ce\\s+qui\\s+brille\\s+n['’]est\\s+pas\\s+(?:d['’])?or", "all\\s+that\\s+glitters\\s+is\\s+not\\s+gold|all\\s+that\\s+glistens\\s+is\\s+not\\s+gold", "tout ce qui brille n'est pas or", "all that glitters is not gold"],
    ["il\\s+ne\\s+faut\\s+(?:jamais\\s+)?(?:pas\\s+)?remettre\\s+à\\s+demain\\s+ce\\s+qu['’]on\\s+peut\\s+faire\\s+(?:le\\s+jour\\s+même|aujourd['’]hui)", "(?:never\\s+|don['’]t\\s+)put\\s+off\\s+(?:until|till)\\s+tomorrow\\s+what\\s+you\\s+can\\s+do\\s+today", "il ne faut pas remettre à demain ce qu'on peut faire le jour même", "never put off until tomorrow what you can do today"],
    ["tout\\s+vient\\s+à\\s+point\\s+à\\s+qui\\s+sait\\s+attendre", "good\\s+things\\s+come\\s+to\\s+those\\s+who\\s+wait", "tout vient à point à qui sait attendre", "good things come to those who wait"],
    ["(?:il\\s+)?faut\\s+battre\\s+le\\s+fer\\s+tant\\s+qu['’]il\\s+est\\s+chaud", "strike\\s+while\\s+the\\s+iron\\s+is\\s+hot", "il faut battre le fer tant qu'il est chaud", "strike while the iron is hot"],
    ["on\\s+n['’]a\\s+rien\\s+sans\\s+rien", "no\\s+pain" + C + "no\\s+gain", "on n'a rien sans rien", "no pain, no gain"],
    ["qui\\s+ne\\s+tente\\s+rien\\s+n['’]a\\s+rien", "nothing\\s+ventured" + C + "nothing\\s+gained", "qui ne tente rien n'a rien", "nothing ventured, nothing gained"],
    ["vouloir" + C + "c['’]est\\s+pouvoir", "where\\s+there['’]s\\s+a\\s+will" + C + "there['’]s\\s+a\\s+way", "vouloir, c'est pouvoir", "where there's a will, there's a way"],
    ["ce\\s+qui\\s+est\\s+fait\\s+est\\s+fait", "what['’]s\\s+done\\s+is\\s+done", "ce qui est fait est fait", "what's done is done"],
    ["la\\s+nuit\\s+porte\\s+conseil", NEVER, "la nuit porte conseil", "sleep on it"],
    ["rien\\s+ne\\s+vaut\\s+son\\s+chez-soi", "there['’]s\\s+no\\s+place\\s+like\\s+home|home\\s+sweet\\s+home", "rien ne vaut son chez-soi", "there's no place like home"],
    ["les\\s+goûts\\s+et\\s+les\\s+couleurs" + C + "(?:ça\\s+)?ne\\s+se\\s+discutent?\\s+pas", "there['’]s\\s+no\\s+accounting\\s+for\\s+taste", "les goûts et les couleurs, ça ne se discute pas", "there's no accounting for taste"],
    ["(?:on\\s+ne\\s+peut\\s+pas|tu\\s+ne\\s+peux\\s+pas|vous\\s+ne\\s+pouvez\\s+pas)\\s+avoir\\s+le\\s+beurre\\s+et\\s+l['’]argent\\s+du\\s+beurre", "you\\s+can['’]t\\s+have\\s+your\\s+cake\\s+and\\s+eat\\s+it(?:" + C + "too)?", "on ne peut pas avoir le beurre et l'argent du beurre", "you can't have your cake and eat it too"],
    ["il\\s+n['’]y\\s+a\\s+pas\\s+de\\s+fumée\\s+sans\\s+feu", "(?:there['’]s\\s+)?no\\s+smoke\\s+without\\s+fire|where\\s+there['’]s\\s+smoke" + C + "there['’]s\\s+fire", "il n'y a pas de fumée sans feu", "there's no smoke without fire"],
    ["le\\s+temps" + C + "c['’]est\\s+de\\s+l['’]argent", "time\\s+is\\s+money", "le temps, c'est de l'argent", "time is money"],
    ["mieux\\s+vaut\\s+tard\\s+que\\s+jamais", "better\\s+late\\s+than\\s+never", "mieux vaut tard que jamais", "better late than never"],
    ["mieux\\s+vaut\\s+prévenir\\s+que\\s+guérir", "better\\s+safe\\s+than\\s+sorry", "mieux vaut prévenir que guérir", "better safe than sorry"],
    ["l['’]union\\s+fait\\s+la\\s+force", "united\\s+we\\s+stand|many\\s+hands\\s+make\\s+light\\s+work", "l'union fait la force", "united we stand"],
    ["(?:il\\s+ne\\s+faut\\s+pas|ne)\\s+réveill(?:er|e)\\s+(?:pas\\s+)?le\\s+chat\\s+qui\\s+dort", "let\\s+sleeping\\s+dogs\\s+lie", "il ne faut pas réveiller le chat qui dort", "let sleeping dogs lie"],
    ["il\\s+ne\\s+faut\\s+pas\\s+vendre\\s+la\\s+peau\\s+de\\s+l['’]ours\\s+avant\\s+de\\s+l['’]avoir\\s+tué", "don['’]t\\s+count\\s+your\\s+chickens(?:\\s+before\\s+they(?:['’]re|\\s+are)?\\s+hatch(?:ed)?)?", "il ne faut pas vendre la peau de l'ours avant de l'avoir tué", "don't count your chickens before they hatch"],
    ["paris\\s+ne\\s+s['’]est\\s+pas\\s+fait\\s+en\\s+un\\s+jour|rome\\s+ne\\s+s['’]est\\s+pas\\s+faite\\s+en\\s+un\\s+jour", "rome\\s+wasn['’]t\\s+built\\s+in\\s+a\\s+day", "Paris ne s'est pas fait en un jour", "Rome wasn't built in a day"],
    ["chacun\\s+(?:ses|son)\\s+goûts?(?=\\s*[.,!?;]|\\s*$)", "(?:each|to\\s+each)\\s+(?:to\\s+their|his|her|their)\\s+own(?=\\s*[.,!?;]|\\s*$)", "chacun ses goûts", "to each their own"],
    ["il\\s+ne\\s+faut\\s+jamais\\s+dire\\s+jamais", "never\\s+say\\s+never", "il ne faut jamais dire jamais", "never say never"],
    ["il\\s+y\\s+a\\s+un\\s+début\\s+à\\s+tout", "there['’]s\\s+a\\s+first\\s+time\\s+for\\s+everything", "il y a un début à tout", "there's a first time for everything"],
    ["jamais\\s+deux\\s+sans\\s+trois", "things\\s+come\\s+in\\s+threes|bad\\s+things\\s+come\\s+in\\s+threes", "jamais deux sans trois", "things come in threes"],
    ["le\\s+silence\\s+est\\s+d['’]or", "silence\\s+is\\s+golden", "le silence est d'or", "silence is golden"],
    ["chacun\\s+pour\\s+soi", "every\\s+man\\s+for\\s+himself", "chacun pour soi", "every man for himself"],
    ["il\\s+y\\s+a\\s+plusieurs\\s+façons\\s+de\\s+plumer\\s+un\\s+canard", "there['’]s\\s+more\\s+than\\s+one\\s+way\\s+to\\s+skin\\s+a\\s+cat", "il y a plusieurs façons de plumer un canard", "there's more than one way to skin a cat"],
    ["trop\\s+de\\s+cuisiniers\\s+gâtent\\s+la\\s+sauce", "too\\s+many\\s+cooks\\s+spoil\\s+the\\s+broth", "trop de cuisiniers gâtent la sauce", "too many cooks spoil the broth"],
    [NEVER, "there['’]s\\s+no\\s+such\\s+thing\\s+as\\s+a\\s+free\\s+lunch", "rien n'est gratuit", "there's no such thing as a free lunch"],
    ["une\\s+image\\s+vaut\\s+mille\\s+mots", "a\\s+picture\\s+is\\s+worth\\s+a\\s+thousand\\s+words", "une image vaut mille mots", "a picture is worth a thousand words"],
    ["deux\\s+précautions\\s+valent\\s+mieux\\s+qu['’]une", "look\\s+before\\s+you\\s+leap", "deux précautions valent mieux qu'une", "look before you leap"],
    [NEVER, "easy\\s+come" + C + "easy\\s+go", "ce qui vient facilement repart facilement", "easy come, easy go"],
    [NEVER, "you\\s+scratch\\s+my\\s+back" + C + "(?:and\\s+)?I['’]ll\\s+scratch\\s+yours", "un service en vaut un autre", "you scratch my back, I'll scratch yours"],
    ["si\\s+ça\\s+marche" + C + "(?:il\\s+ne\\s+faut\\s+pas|on\\s+ne)\\s+(?:y\\s+)?touche(?:r)?\\s+pas|on\\s+ne\\s+change\\s+pas\\s+une\\s+équipe\\s+qui\\s+gagne", "if\\s+it\\s+ain['’]t\\s+broke" + C + "don['’]t\\s+fix\\s+it|if\\s+it\\s+isn['’]t\\s+broken" + C + "don['’]t\\s+fix\\s+it", "on ne change pas une équipe qui gagne", "if it ain't broke, don't fix it"],
];
const PROVERB_TOKENS = ["Quorvadel", "Brentalix", "Vinskarod"];
const proverbRegex = (lang) => PROVERBS.map((p) => ({ re: new RegExp(B(lang === "fr" ? p[0] : p[1]), "giu"), fr: p[2], en: p[3] }));
const PROVERB_RE = { fr: proverbRegex("fr"), en: proverbRegex("en") };

// Proverbes du texte d'origine, dans l'ordre (au plus trois par texte).
function findProverbs(text, from) {
    const found = [];
    for (const p of PROVERB_RE[from] ?? []) {
        for (const m of String(text).matchAll(p.re)) {
            if (!found.some((f) => m.index < f.end && m.index + m[0].length > f.start)) {
                found.push({ start: m.index, end: m.index + m[0].length, target: from === "fr" ? p.en : p.fr });
            }
        }
    }
    return found.sort((a, b) => a.start - b.start).slice(0, PROVERB_TOKENS.length);
}

function maskProverbs(text, from) {
    const found = findProverbs(text, from);
    let out = text;
    for (let i = found.length - 1; i >= 0; i--) {
        out = out.slice(0, found[i].start) + PROVERB_TOKENS[i] + out.slice(found[i].end);
    }
    return out;
}

function restoreProverbs(output, source, to) {
    const found = findProverbs(source, to === "fr" ? "en" : "fr");
    let out = output;
    found.forEach((f, i) => {
        out = out.replace(new RegExp(`${PROVERB_TOKENS[i]}`, "gi"), (m, offset) => {
            const atStart = /(?:^|[.!?…:;]\s*["«“(]?\s*)$/u.test(out.slice(0, offset));
            return atStart ? f.target[0].toUpperCase() + f.target.slice(1) : f.target;
        });
    });
    return out;
}

const SMS_DIGITS = {
    fr: { bi1: "bien", ri1: "rien", dem1: "demain", a2m1: "à demain", "@2m1": "à demain", koi2n9: "quoi de neuf", "2m1": "demain" },
    en: { b4: "before", l8r: "later", gr8: "great", m8: "mate", w8: "wait", ily2: "I love you too", g2g: "I have to go", h8: "hate", str8: "straight", "2day": "today", "2morrow": "tomorrow", "2moro": "tomorrow", "2nite": "tonight", "4ever": "forever", "2u": "to you", "4u": "for you", any1: "anyone", some1: "someone", ne1: "anyone" },
};

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
    let input = String(text ?? "");
    if (!input.trim()) {
        return input;
    }
    input = maskProverbs(input, from);
    // Mots de SMS avec chiffres (« bi1 », « l8r ») : remplacés avant le repérage des zones protégées,
    // qui les prendrait pour des identifiants.
    const digits = SMS_DIGITS[from];
    if (digits) {
        input = input.replace(new RegExp(`(?<!\`)${B(Object.keys(digits).map(escape).join("|"))}(?!\`)`, "giu"), (m) => keepCase(digits[m.toLowerCase()], m));
    }
    // Plages horaires « 9 h-18 h » : « 9:00-18:00 » (avant le repérage des zones protégées, qui
    // prendrait « h-18 » pour un identifiant).
    if (from === "fr") {
        input = input.replace(/(?<![\p{N}:,.])([01]?\d|2[0-3])[\s  ]?h[\s  ]?[-–][\s  ]?([01]?\d|2[0-3])[\s  ]?h(?![\p{L}\p{N}])/gu, "$1:00-$2:00");
    } else {
        // « between 2 and 6 p.m. » : « between 2 p.m. and 6 p.m. » (« p.m. » serait une zone protégée).
        input = input.replace(/(?<![\p{L}])between\s+(\d{1,2})\s+and\s+(\d{1,2})\s*(p\.?m\.?|a\.?m\.?)(?![\p{L}])/giu, "between $1 $3 and $2 $3")
            // « the exam starts at 8 » : « at 8 o'clock » (vu ici en entier, avant les zones protégées).
            .replace(/(?<=(?:starts?|begins?|opens?|closes?|ends?|leaves?|arrives?|meet|meeting|wake\s+up|be\s+there|come|lands?)\s+at\s+)(\d{1,2})(?=\s*[.!,;]|\s*$)/giu, "$1 o'clock")
            // « 5ish » : vers 5 heures.
            .replace(/(?<![\p{L}\p{N}])(?:at\s+)?(\d{1,2})(?:-|\s)?ish(?![\p{L}])/giu, (m, h) => `${/^at/i.test(m) ? "at " : ""}around ${h} o'clock`);
    }
    return outsideProtected(input, (part) => (from === "fr"
        ? applyRules(frSms(part), FR_RULES)
        : applyRules(enSms(part), EN_RULES)));
}

// Garde-fou des nombres : le modèle perd parfois un chiffre (« 22,05 € » → « €2.05 »). Un nombre à
// décimales, ou de trois chiffres et plus, du texte d'origine qui ressort tronqué est remis en place,
// au format de la langue cible (virgule décimale en français, point en anglais).
function guardNumbers(output, source, to) {
    const fromFr = to === "en";
    const sourceRe = fromFr ? /(?<![\d:.,])\d{1,3}(?:[   ]\d{3})+(?:,\d+)?(?![\d:])|(?<![\d:.,])\d+(?:,\d+)?(?![\d:h])/g : /(?<![\d:.,])\d{1,3}(?:,\d{3})+(?:\.\d+)?(?![\d:])|(?<![\d:.,])\d+(?:\.\d+)?(?![\d:])/g;
    const outRe = fromFr ? /(?<![\d:.,])\d{1,3}(?:,\d{3})+(?:\.\d+)?(?![\d:])|(?<![\d:.,])\d+(?:\.\d+)?(?![\d:])/g : /(?<![\d:.,])\d{1,3}(?:[   ]\d{3})+(?:,\d+)?(?![\d:])|(?<![\d:.,])\d+(?:,\d+)?(?![\d:h])/g;
    const value = (raw, french) => (french ? raw.replace(/[   ]/g, "").replace(",", ".") : raw.replace(/,/g, ""));
    const wanted = [...String(source).matchAll(sourceRe)].map((m) => value(m[0], fromFr)).filter((v) => /\./.test(v) || v.replace(/\D/g, "").length >= 3);
    if (!wanted.length) {
        return output;
    }
    const found = [...output.matchAll(outRe)].map((m) => ({ raw: m[0], index: m.index, v: value(m[0], !fromFr) }));
    let result = output;
    for (const v of wanted) {
        if (found.some((f) => f.v === v)) {
            continue;
        }
        const broken = found.find((f) => f.v !== v && v.endsWith(f.v) && f.v.length >= v.length - 2 && !wanted.includes(f.v));
        if (broken) {
            const [whole, decimals] = v.split(".");
            const formatted = fromFr
                ? `${Number(whole).toLocaleString("en-US")}${decimals ? `.${decimals}` : ""}`
                : `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}${decimals ? `,${decimals}` : ""}`;
            result = result.slice(0, broken.index) + formatted + result.slice(broken.index + broken.raw.length);
            found.splice(found.indexOf(broken), 1);
        }
    }
    return result;
}

export function fixTarget(text, to, { source = "" } = {}) {
    const input = String(text ?? "");
    if (!input.trim()) {
        return input;
    }
    let fixed = outsideProtected(guardNumbers(restoreProverbs(input, source, to), source, to), (part) => applyRules(part, to === "fr" ? FR_FIX : EN_FIX, { source }));
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
