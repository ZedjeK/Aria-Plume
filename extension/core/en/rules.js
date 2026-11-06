// Aria Plume — règles anglaises en plus de Harper (comme pour le français : prudentes,
// et dans le doute, rien n'est signalé). Chaque règle repère un motif sûr sur les mots voisins.

const WORD = /[A-Za-z]+(?:['’][A-Za-z]+)*/g;

const COMPARATIVES = new Set(["rather", "more", "less", "other", "fewer", "better", "worse", "later", "sooner", "greater", "smaller", "larger", "higher", "lower", "faster", "slower", "bigger", "older", "younger", "easier", "harder", "longer", "shorter"]);
const SUBJECTS = new Set(["i", "we", "you", "he", "she", "they", "it"]);
const YOURE_NEXT = new Set(["welcome", "going", "not", "doing", "being", "gonna", "kidding", "joking", "sure", "a", "an", "the", "so", "too", "always", "really", "getting", "coming", "trying"]);
const ITS_NEXT = new Set(["not", "going", "been", "getting", "also", "so", "too", "really", "probably", "almost", "already", "always", "a", "an", "the"]);
const LOSE_BEFORE = new Set(["to", "will", "would", "could", "should", "might", "may", "can", "can't", "cannot", "don't", "didn't", "won't", "never", "not", "must", "gonna"]);
const WHOSE_NEXT = new Set(["car", "turn", "fault", "idea", "phone", "house", "job", "book", "name", "side", "team", "place", "money", "bag", "laptop", "computer", "account", "password", "responsibility", "code", "file", "files", "server", "machine", "dog", "cat", "kids", "children"]);
const THEYRE_NEXT = new Set(["going", "doing", "coming", "gonna", "trying", "getting", "being"]);
const COUNTABLE = new Set(["people", "cars", "servers", "users", "items", "things", "problems", "errors", "mistakes", "files", "bugs", "computers", "machines", "options", "issues", "requests", "messages", "emails", "customers", "employees", "words", "books", "steps"]);

// Passé simple irrégulier → participe passé (« had went » → had gone).
export const IRREGULAR_PP = {
    went: "gone", saw: "seen", did: "done", took: "taken", wrote: "written", ate: "eaten", gave: "given", knew: "known", broke: "broken",
    chose: "chosen", forgot: "forgotten", began: "begun", drank: "drunk", drove: "driven", rode: "ridden", rose: "risen", fell: "fallen",
    flew: "flown", grew: "grown", threw: "thrown", sang: "sung", swam: "swum", rang: "rung", stole: "stolen", wore: "worn", tore: "torn",
    spoke: "spoken", froze: "frozen", woke: "woken", hid: "hidden", bit: "bitten", shook: "shaken", ran: "run", came: "come", became: "become",
    mistook: "mistaken", forgave: "forgiven", undertook: "undertaken", overtook: "overtaken", sank: "sunk", shrank: "shrunk", sprang: "sprung",
    drew: "drawn", blew: "blown", withdrew: "withdrawn", wove: "woven", swore: "sworn", arose: "arisen", forbade: "forbidden",
    underwent: "undergone", foresaw: "foreseen", rewrote: "rewritten", overcame: "overcome", forsook: "forsaken", strode: "stridden",
};
const PERFECT_AUX = new Set(["have", "has", "had", "having", "i've", "you've", "we've", "they've", "i'd", "you'd", "he'd", "she'd", "we'd", "they'd", "haven't", "hasn't", "hadn't", "he's", "she's", "it's"]);
const PERFECT_ADVERBS = new Set(["already", "just", "never", "ever", "not", "recently", "finally", "also", "always", "since", "now", "only", "still", "really", "probably", "certainly", "obviously"]);
// Pronom sujet + être / avoir : la bonne forme.
const BE_HAVE = {
    i: { is: "am", are: "am", were: "was", has: "have", "isn't": "am not", "aren't": "am not", "hasn't": "haven't", "weren't": "wasn't" },
    you: { is: "are", am: "are", was: "were", has: "have", "isn't": "aren't", "wasn't": "weren't", "hasn't": "haven't", does: "do", "doesn't": "don't" },
    we: { is: "are", am: "are", was: "were", has: "have", "isn't": "aren't", "wasn't": "weren't", "hasn't": "haven't", does: "do", "doesn't": "don't" },
    they: { is: "are", am: "are", was: "were", has: "have", "isn't": "aren't", "wasn't": "weren't", "hasn't": "haven't", does: "do", "doesn't": "don't" },
    he: { are: "is", am: "is", were: "was", have: "has", "aren't": "isn't", "weren't": "wasn't", "haven't": "hasn't" },
    she: { are: "is", am: "is", were: "was", have: "has", "aren't": "isn't", "weren't": "wasn't", "haven't": "hasn't" },
    it: { are: "is", am: "is", were: "was", have: "has", "aren't": "isn't", "weren't": "wasn't", "haven't": "hasn't" },
};
const TO_PLURAL = { is: "are", was: "were", has: "have", "isn't": "aren't", "wasn't": "weren't", "hasn't": "haven't", does: "do", "doesn't": "don't" };
const TO_SINGULAR = { are: "is", were: "was", have: "has", "aren't": "isn't", "weren't": "wasn't", "haven't": "hasn't", do: "does", "don't": "doesn't" };
// « make it have », « does it have », « if I were » : pas un sujet + verbe conjugué ordinaire.
const BEFORE_OBJECT = new Set(["let", "lets", "make", "makes", "made", "help", "helps", "helped", "see", "saw", "watch", "hear", "heard", "have", "has", "had", "do", "does", "did", "can", "could", "will", "would", "shall", "should", "may", "might", "must", "to", "if", "wish", "though", "as", "than", "that", "whether", "suppose", "imagine", "pretend"]);
const PLURAL_DETS = new Set(["these", "those", "many", "several", "both", "few", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "twelve", "twenty", "hundreds", "thousands", "various", "numerous"]);
const ANY_DETS = new Set(["the", "my", "your", "his", "her", "our", "their", "its", "these", "those", "some", "all", "many", "several", "both", "few", "most", "other"]);
const SINGULAR_DETS = new Set(["a", "an", "this", "that", "each", "every", "another", "the", "my", "your", "his", "her", "our", "their", "its"]);
// Noms singuliers courants : sans dictionnaire des natures, on ne corrige « the X have » que pour eux
// (« the team should have », « the President lives is » ne sont pas des fautes).
const SINGULAR_NOUNS = new Set(["intern", "manager", "server", "technician", "user", "customer", "client", "boss", "teacher", "student", "computer", "laptop", "printer", "router", "file", "report", "system", "website", "application", "app", "software", "program", "project", "meeting", "car", "friend", "brother", "sister", "mother", "father", "wife", "husband", "son", "daughter", "child", "kid", "dog", "cat", "house", "room", "door", "window", "phone", "book", "letter", "email", "message", "ticket", "update", "backup", "database", "network", "switch", "engineer", "developer", "admin", "director", "neighbor", "neighbour", "colleague", "doctor", "nurse", "driver", "player", "baby", "machine", "device", "screen", "keyboard", "cable", "disk", "drive", "account", "password", "invoice", "order", "package", "box", "key", "game", "movie", "song", "book", "girl", "boy", "man", "woman", "person", "guy", "lady", "student", "office", "store", "shop", "restaurant", "hotel", "train", "bus", "plane", "flight", "patch", "bug", "issue", "error", "problem", "question", "answer", "idea", "plan", "list", "table", "chair", "bed", "kitchen", "garden", "street", "city", "town", "country"]);
const IRREGULAR_PLURALS = new Set(["children", "people", "men", "women", "feet", "teeth", "mice", "geese", "oxen", "dice"]);
const NOT_PLURAL = /(ss|us|is|ics|ness|ous|ws|ys)$/;
const NOT_PLURAL_WORDS = new Set(["news", "series", "species", "means", "measles", "whereabouts", "gas", "bus", "lens", "chaos", "canvas", "atlas", "alias", "bias", "plus", "status", "yes", "this", "its", "his", "has", "was", "does", "always", "perhaps", "nowadays", "sometimes", "headquarters", "politics", "physics", "mathematics", "economics", "thanks", "ones", "less", "unless"]);
const COLLECTIVE = new Set(["team", "staff", "police", "family", "government", "crew", "committee", "audience", "band", "class", "company", "group", "management", "board", "public", "majority", "couple", "jury", "council", "army", "cattle", "data", "fish", "sheep", "deer", "aircraft", "series", "species", "media", "personnel", "number", "lot", "rest", "half", "bunch", "pair", "variety"]);
const PREPOSITIONS = new Set(["of", "in", "on", "at", "with", "for", "from", "by", "about", "to", "into", "under", "over", "between", "near", "behind", "without", "through", "like", "than", "among", "across", "after", "before", "during", "per"]);
const CLAUSE_OPENERS = new Set(["because", "when", "if", "that", "since", "while", "although", "though", "but", "so", "whether", "once", "until", "unless", "where"]);
const NUMBER_WORDS = new Set(["two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "fifteen", "twenty", "thirty", "fifty", "hundred", "hundreds", "thousands", "many", "several", "multiple", "numerous", "various", "lots", "dozens"]);
const COPULAS = new Set(["is", "are", "was", "were", "am", "i'm", "you're", "we're", "they're", "he's", "she's", "it's", "be", "been", "being", "seems", "seem", "seemed", "looks", "look", "looked", "feel", "feels", "felt", "get", "gets", "got", "getting", "became", "become", "sounds", "sounded", "isn't", "aren't", "wasn't", "weren't"]);
const TOO_ADJECTIVES = new Set(["hot", "cold", "late", "early", "big", "small", "loud", "tired", "busy", "expensive", "cheap", "long", "short", "fast", "slow", "much", "many", "far", "close", "hard", "difficult", "easy", "heavy", "high", "low", "young", "old", "good", "bad", "full", "dangerous", "risky", "complicated", "complex", "large", "little", "dark", "bright", "warm", "sick", "sad", "happy", "quiet", "noisy", "weak", "strong", "thin", "thick", "wide", "narrow", "deep", "shy", "lazy", "scared", "afraid", "angry", "nervous", "slow", "soon", "often", "bored", "boring", "simple", "slow", "short", "tight", "loose", "sweet", "salty", "spicy", "dry", "wet", "small", "tall", "fat", "rich", "poor", "drunk", "old", "new", "fragile", "sensitive", "important", "stupid", "smart", "good", "nice", "kind", "polite", "rude", "honest", "proud", "lucky"]);
const LOOSE_BEFORE = new Set(["is", "are", "was", "were", "be", "been", "come", "comes", "came", "coming", "get", "gets", "got", "getting", "hang", "hangs", "hung", "cut", "set", "break", "breaks", "broke", "let", "turn", "turned", "too", "very", "bit", "little", "slightly", "completely"]);
const YOUR_NOUNS = new Set(["umbrella", "jacket", "coat", "shoes", "seat", "desk", "glasses", "own", "password", "account", "email", "car", "computer", "phone", "house", "name", "order", "friend", "mother", "father", "family", "team", "request", "file", "files", "code", "laptop", "keys", "job", "work", "help", "application", "profile", "data", "message", "ticket", "address", "payment", "subscription", "appointment", "username", "login", "server", "website", "birthday", "boss", "wife", "husband", "dog", "cat", "kids", "children", "parents", "mom", "dad", "brother", "sister", "room", "bag", "wallet", "money", "turn", "fault", "idea", "question", "answer", "report", "browser", "device", "settings", "screen", "license"]);
const WHOS_NEXT = new Set(["coming", "going", "doing", "been", "calling", "talking", "speaking", "next", "ready", "responsible", "there", "here", "online", "available", "joining", "bringing", "driving", "paying", "playing", "in", "on", "out", "gonna", "the", "a", "your", "my"]);
const CHOOSE_NEXT = new Set(["a", "an", "the", "between", "from", "one", "which", "what", "wisely", "carefully", "your", "their", "his", "her", "my", "our", "it", "them", "this", "that", "whether", "to", "among"]);
const MODALS = new Set(["can", "could", "will", "would", "should", "must", "might", "may", "shall", "to", "didn't", "don't", "doesn't", "can't", "won't", "wouldn't", "couldn't", "shouldn't", "cannot"]);
// Fautes d'orthographe très répandues : la bonne forme en premier (Harper propose parfois autre chose).
const MISSPELLINGS = {
    untill: "until", adress: "address", adresses: "addresses", definately: "definitely", seperate: "separate", seperately: "separately",
    occured: "occurred", occuring: "occurring", occurence: "occurrence", tommorow: "tomorrow", tomorow: "tomorrow", wierd: "weird",
    goverment: "government", enviroment: "environment", wich: "which", thier: "their", becuase: "because", existance: "existence",
    independant: "independent", publically: "publicly", arguement: "argument", embarass: "embarrass", millenium: "millennium",
    truely: "truly", sucess: "success", succesful: "successful", buisness: "business", concious: "conscious", comming: "coming",
    writting: "writing", refered: "referred", prefered: "preferred", transfered: "transferred", commited: "committed", occassion: "occasion",
    posession: "possession", recomend: "recommend", reccomend: "recommend", mispell: "misspell", noticable: "noticeable",
    persistant: "persistent", priviledge: "privilege", maintainance: "maintenance", maintenence: "maintenance", seige: "siege",
    acheive: "achieve", agressive: "aggressive", apparantly: "apparently", basicly: "basically", collegue: "colleague",
    comittee: "committee", completly: "completely", enviroments: "environments", foward: "forward", garantee: "guarantee",
    immediatly: "immediately", knowlege: "knowledge", lisence: "license", occurance: "occurrence", paralel: "parallel",
    reciept: "receipt", relevent: "relevant", remeber: "remember", responsability: "responsibility", tecnical: "technical",
    threshhold: "threshold", wether: "whether", writen: "written",
};
// Verbes courants (base verbale) : pour l'accord avec un sujet nom (« my friend watch » → watches).
const THEYRE_ADJ = new Set(["stuck", "lost", "stranded", "late", "early", "here", "there", "right", "wrong", "ready", "busy", "back", "gone", "coming", "going", "doing", "not", "sure", "happy", "sad", "tired", "sick", "fine", "okay", "ok", "home", "away", "together", "done", "finished", "available", "online", "offline", "always", "still", "really", "very", "too", "so", "both", "all"]);
const THEYRE_AFTER = new Set(["because", "and", "but", "to", "for", "with", "now", "again", "today", "tonight", "tomorrow", "yesterday", "at", "in", "on", "so", "since", "as", "if", "when"]);
const COMMON_VERBS = new Set(["work", "play", "start", "stop", "fix", "check", "install", "update", "call", "need", "want", "like", "love", "hate", "use",
    "make", "take", "give", "see", "know", "think", "say", "tell", "ask", "help", "try", "send", "write", "read", "buy", "sell", "bring", "find",
    "keep", "leave", "lose", "open", "close", "watch", "wait", "run", "go", "come", "get", "do", "eat", "drink", "drive", "clean", "cook", "build",
    "break", "choose", "forget", "remember", "learn", "teach", "understand", "explain", "show", "pay", "plan", "move", "change", "turn", "walk",
    "talk", "speak", "listen", "live", "look", "feel", "seem", "become", "begin", "carry", "fall", "grow", "hold", "hear", "lend", "meet", "mean",
    "ride", "sing", "sit", "sleep", "spend", "stand", "swim", "throw", "wake", "wear", "win", "wash", "push", "pull", "print", "deploy",
    "restart", "reboot", "configure", "manage", "support", "provide", "create", "delete", "save", "load", "share", "review", "monitor", "crash",
    "fail", "respond", "reply", "answer", "agree", "arrive", "belong", "believe", "cost", "cry", "depend", "enjoy", "expect", "follow", "happen",
    "hope", "improve", "include", "join", "laugh", "leave", "miss", "own", "prefer", "prepare", "receive", "remain", "repair", "return", "smile",
    "study", "teach", "travel", "visit", "worry", "contain", "allow", "require", "seem", "cover", "offer", "accept", "add", "affect", "apply"]);
const OBJECT_STARTS = new Set(["the", "a", "an", "my", "your", "his", "her", "their", "our", "its", "this", "that", "these", "those", "it", "them", "me", "us", "him", "some", "every", "all", "no", "each"]);
const AMBIGUOUS_VERBS = new Set(["like", "open", "close", "mean", "live", "own", "near", "lead", "wind", "present", "object"]);
const thirdPerson = (verb) => ({ have: "has", do: "does", go: "goes", be: "is" }[verb] ?? (/(s|sh|ch|x|z|o)$/.test(verb) ? `${verb}es` : /[^aeiou]y$/.test(verb) ? `${verb.slice(0, -1)}ies` : `${verb}s`));
const BASE_OF_THIRD = new Map([...COMMON_VERBS].map((v) => [thirdPerson(v), v]));
const VERBISH_AFTER = new Set(["is", "was", "has", "will", "can", "should", "would", "must", "may", "might", "are", "were", "had", "could", "does", "did", "isn't", "wasn't", "won't", "can't", "doesn't"]);
const MESSAGES = {
    than: "« then » marque la suite dans le temps ; pour comparer, c'est « than » (rather than, more than).",
    then: "« than » sert à comparer ; pour « ensuite », c'est « then » (and then).",
    youre: "« your » est un possessif (your car) ; ici, il faut « you're » (= you are).",
    itsIs: "« its » est un possessif (its color) ; ici, il faut « it's » (= it is / it has).",
    itsOwn: "Possessif : « its own », sans apostrophe.",
    lose: "« loose » veut dire « lâche, desserré » ; le verbe « perdre », c'est « lose ».",
    whose: "« who's » = who is ; pour le possessif (à qui ?), c'est « whose ».",
    theyre: "« there » indique un lieu ; ici, il faut « they're » (= they are).",
    saw: "« seen » s'emploie avec have : « I saw » ou « I've seen ».",
    lend: "On emprunte (borrow) à quelqu'un, on prête (lend) à quelqu'un : « lend me ».",
    fewer: "Devant un nom pluriel dénombrable, on écrit plutôt « fewer » (fewer people).",
    your: "« you're » = you are ; pour le possessif (ton, votre), c'est « your » (for your help).",
    doesnt: "Avec he, she ou it, la négation est « doesn't » (he doesn't know) ; « don't » va avec I, you, we, they.",
    participle: "Après have, has ou had, il faut le participe passé (had gone, have seen), pas le prétérit.",
    agreement: "Le verbe s'accorde avec le sujet",
    there: "Avec un nom pluriel après, c'est « there are » / « there were ».",
    oneOf: "Le sujet est « one » (un seul) : le verbe reste au singulier (one of the disks is).",
    compound: "Deux sujets reliés par « and » : le verbe se met au pluriel (my brother and I were).",
    too: "« to » est une préposition ; pour « trop », c'est « too » (too hot, too late).",
    loose: "« lose » = perdre ; pour « desserré, lâche », c'est « loose ».",
    yourNoun: "« you're » = you are ; devant un nom, il faut le possessif « your » (your password).",
    thanThen: "« than » sert à comparer ; pour « ensuite, alors », c'est « then ».",
    whos: "« whose » est un possessif (whose car) ; ici, il faut « who's » (= who is / who has).",
    choose: "« chose » est le prétérit ; après « to » ou un modal, c'est la base verbale « choose ».",
    misspelling: "Faute d'orthographe courante.",
    wont: "« wont » (habitude) est un mot rare ; pour « will not », c'est « won't ».",
};

const keepCase = (original, replacement) => (/^[A-Z]/.test(original) ? replacement[0].toUpperCase() + replacement.slice(1) : replacement);

function tokenize(text) {
    const tokens = [];
    for (const match of text.matchAll(WORD)) {
        tokens.push({ text: match[0], lower: match[0].toLowerCase().replace("’", "'"), start: match.index, end: match.index + match[0].length });
    }
    return tokens;
}

// Deux mots voisins seulement s'il n'y a qu'un espace entre eux (pas de virgule, de point…).
const adjacent = (text, a, b) => !!a && !!b && /^\s+$/.test(text.slice(a.end, b.start)) && !/\n/.test(text.slice(a.end, b.start));

// Début de proposition : début du texte, ponctuation forte, ou mot de liaison juste avant.
function clauseStartAt(text, tokens, i) {
    if (i === 0) {
        return !/[,\w]/.test(text.slice(0, tokens[0].start).trim().slice(-1));
    }
    const between = text.slice(tokens[i - 1].end, tokens[i].start);
    return /[.!?;:\n(«"“]/.test(between) || CLAUSE_OPENERS.has(tokens[i - 1].lower);
}

const isPluralNoun = (token) => !!token && !token.lower.includes("'") && (IRREGULAR_PLURALS.has(token.lower)
    || (/^[a-z]{3,}s$/.test(token.lower) && !NOT_PLURAL.test(token.lower) && !NOT_PLURAL_WORDS.has(token.lower)));
const isSingularNoun = (token) => !!token && /^[a-z]{2,}$/.test(token.lower) && !/s$/.test(token.lower) && !COLLECTIVE.has(token.lower) && !IRREGULAR_PLURALS.has(token.lower);

export function findEnglishRules(text) {
    const tokens = tokenize(text);
    const results = [];
    const push = (token, end, fix, message, rule, kind = "grammaire") => {
        results.push({
            start: token.start,
            end,
            kind,
            detail: "aria",
            message,
            suggestions: [keepCase(token.text, fix)],
            rule: `aria_en_${rule}`,
        });
    };
    tokens.forEach((token, i) => {
        const prev = tokens[i - 1];
        const next = tokens[i + 1];
        const isPrev = adjacent(text, prev, token);
        // « its so-called », « your always-on » : le mot suivant est composé, on ne dit rien.
        const isNext = adjacent(text, token, next) && text[next.end] !== "-";
        switch (token.lower) {
            case "then":
                // « rather then », « more then » → than (Harper repère déjà « faster then »).
                if (isPrev && COMPARATIVES.has(prev.lower)) {
                    push(token, token.end, "than", MESSAGES.than, "then_than");
                } else if (tokens.slice(Math.max(0, i - 6), i).some((t) => t.lower === "rather")) {
                    // « I'd rather walk then drive », « I'd rather call you tomorrow then send… » :
                    // « rather » jusqu'à six mots avant, sans ponctuation entre.
                    const from = tokens.slice(Math.max(0, i - 6), i).find((t) => t.lower === "rather");
                    if (!/[,.;:!?\n]/.test(text.slice(from.end, token.start))) {
                        push(token, token.end, "than", MESSAGES.than, "then_than");
                    }
                }
                break;
            case "than":
                // « and than we deployed » → and then.
                if (isPrev && ["and", "but"].includes(prev.lower) && isNext && (SUBJECTS.has(next.lower) || ["the", "everything", "nothing", "suddenly", "it's", "we'll", "i'll", "you'll"].includes(next.lower))) {
                    push(token, token.end, "then", MESSAGES.then, "than_then");
                }
                break;
            case "your":
                // « Your welcome! » → You're ; « outstay your welcome » reste (expression).
                if (isNext && YOURE_NEXT.has(next.lower) && !(next.lower === "welcome" && isPrev)) {
                    push(token, token.end, "you're", MESSAGES.youre, "your_youre");
                }
                break;
            case "its":
                if (isNext && (ITS_NEXT.has(next.lower) || (next.lower === "time" && tokens[i + 2]?.lower === "to"))) {
                    push(token, token.end, "it's", MESSAGES.itsIs, "its_its");
                }
                break;
            case "it's":
                if (isNext && next.lower === "own") {
                    push(token, token.end, "its", MESSAGES.itsOwn, "its_own");
                }
                break;
            case "loose":
                if (isPrev && LOSE_BEFORE.has(prev.lower)) {
                    push(token, token.end, "lose", MESSAGES.lose, "loose_lose");
                }
                break;
            case "you're":
                // « Thanks for you're quick reply » → your : après une préposition, c'est le possessif.
                if (isPrev && ["for", "of", "to", "with", "about", "on", "in", "at", "by", "from", "into"].includes(prev.lower) && isNext && !["welcome", "not", "going", "right", "sure"].includes(next.lower)) {
                    push(token, token.end, "your", MESSAGES.your, "youre_your");
                }
                break;
            case "dont":
            case "don't":
                // « He dont know », « She don't like » → doesn't.
                if (isPrev && ["he", "she", "it"].includes(prev.lower) && isNext) {
                    push(token, token.end, "doesn't", MESSAGES.doesnt, "dont_doesnt");
                }
                break;
            case "who's":
                if (isNext && WHOSE_NEXT.has(next.lower)) {
                    push(token, token.end, "whose", MESSAGES.whose, "whos_whose");
                }
                break;
            case "there":
                // « There going to… » → They're ; « are there going… » (question) reste.
                if (isNext && THEYRE_NEXT.has(next.lower) && !["are", "is", "was", "were", "be", "been"].includes(prev?.lower)) {
                    push(token, token.end, "they're", MESSAGES.theyre, "there_theyre");
                }
                break;
            case "seen":
                // « I seen it » → saw ; « Have you seen it? » reste.
                if (isPrev && SUBJECTS.has(prev.lower) && prev.lower !== "it" && !["have", "has", "had", "having"].includes(tokens[i - 2]?.lower)) {
                    push(token, token.end, "saw", MESSAGES.saw, "seen_saw");
                }
                break;
            case "borrow":
                if (isNext && ["me", "us"].includes(next.lower)) {
                    push(token, token.end, "lend", MESSAGES.lend, "borrow_lend");
                }
                break;
            case "less":
                if (isNext && COUNTABLE.has(next.lower)) {
                    push(token, token.end, "fewer", MESSAGES.fewer, "less_fewer", "style");
                }
                break;
            default:
                break;
        }
        moreRules(text, tokens, i, push);
    });
    // Motifs de la campagne du 06/11/2026 : seulement là où aucune autre règle n'a parlé.
    for (const found of campaignPatterns(text)) {
        if (!results.some((r) => r.start < found.end && found.start < r.end)) {
            results.push(found);
        }
    }
    return results;
}

// --- Campagne du 06/11/2026 : motifs sûrs, en contexte ---
// Chaque motif : expression (avec un groupe nommé « w » : le passage à corriger), correction
// (chaîne ou fonction des groupes), nom de règle, catégorie.
const IRREGULAR_PAST = { brung: "brought", bringed: "brought", knowed: "knew", finded: "found", catched: "caught", teached: "taught", thinked: "thought", buyed: "bought", seeked: "sought", fighted: "fought", sended: "sent", spended: "spent", builded: "built", lended: "lent", feeled: "felt", keeped: "kept", sleeped: "slept", meeted: "met", losed: "lost", payed: "paid", sayed: "said", maked: "made", heared: "heard", winned: "won", sitted: "sat", standed: "stood", understanded: "understood", runned: "ran", comed: "came", goed: "went", taked: "took", gived: "gave", writed: "wrote", drived: "drove", eated: "ate", drinked: "drank", speaked: "spoke", breaked: "broke", choosed: "chose", freezed: "froze", throwed: "threw", growed: "grew", blowed: "blew", drawed: "drew", hided: "hid", shaked: "shook", stealed: "stole", swimmed: "swam", weared: "wore", rised: "rose", falled: "fell", forgetted: "forgot", hitted: "hit", cutted: "cut", setted: "set", shutted: "shut", hurted: "hurt", quitted: "quit", spreaded: "spread", readed: "read", feeded: "fed", holded: "held", telled: "told", selled: "sold", digged: "dug", stinged: "stung", swinged: "swung", wringed: "wrung" };
const BASE_TO_PP = { send: "sent", spend: "spent", build: "built", lend: "lent", bend: "bent", bring: "brought", buy: "bought", think: "thought", teach: "taught", catch: "caught", fight: "fought", seek: "sought", sell: "sold", tell: "told", hold: "held", find: "found", leave: "left", feel: "felt", keep: "kept", sleep: "slept", meet: "met", lose: "lost", pay: "paid", say: "said", make: "made", hear: "heard", win: "won", sit: "sat", stand: "stood", understand: "understood", take: "taken", give: "given", write: "written", drive: "driven", eat: "eaten", speak: "spoken", break: "broken", choose: "chosen", forget: "forgotten", know: "known", see: "seen", go: "gone", do: "done", get: "gotten", fall: "fallen", grow: "grown", throw: "thrown", wear: "worn", steal: "stolen", begin: "begun", drink: "drunk", ring: "rung", sing: "sung", swim: "swum", fly: "flown", ride: "ridden", rise: "risen", wake: "woken", hide: "hidden", show: "shown" };
const REGULAR_VERBS = "update stop search finish start try call check fix install test review merge push deploy ask answer open close add change clean cook help move play talk walk watch wait work want need use visit plan order email text reply contact receive return finish complete attach apply book cancel confirm create delete download upload save share submit sign print scan mention notice decide expect explain follow happen hope improve include join like love miss prepare remember report request schedule solve suggest support travel turn wash worry".split(" ");
const PP_OF = (base) => BASE_TO_PP[base] ?? (/e$/.test(base) ? `${base}d` : /[^aeiou]y$/.test(base) ? `${base.slice(0, -1)}ied` : /^(stop|plan|drop|ship|chat|shop|skip|step|swap|tap|tag|log|jog|grab)$/.test(base) ? `${base}${base.slice(-1)}ed` : `${base}ed`);
const THIRD = (verb) => ({ have: "has", do: "does", go: "goes", be: "is" }[verb] ?? (/(s|sh|ch|x|z|o)$/.test(verb) ? `${verb}es` : /[^aeiou]y$/.test(verb) ? `${verb.slice(0, -1)}ies` : `${verb}s`));
// Verbes rarement employés comme noms (ni « work », ni « crash », ni « cost » : « the plane crash »,
// « her work », « the cost of ») et dont le passé n'a pas la même forme (ni « shut », ni « put »).
const PRESENT_VERBS = "return run lose last take make seem give get go come fail send load save throw handle know want like have say mean contain require include depend happen begin".split(" ");
const PRESENT_RE = PRESENT_VERBS.join("|");
const MODAL_OR_AUX = "is|was|has|are|were|have|had|will|would|could|should|can|may|might|must|does|did|do|also|always|never|often|still|just|really|usually|only|even";
const NUMBER_WORD = "two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|a\\s+few|several|\\d+";
const UNCOUNTABLE = { advices: "advice", informations: "information", feedbacks: "feedback", softwares: "software", equipments: "equipment", furnitures: "furniture", homeworks: "homework", knowledges: "knowledge", luggages: "luggage", baggages: "baggage", evidences: "evidence", trainings: "training", researchs: "research", staffs: "staff" };
const HOLIDAYS = { thanksgiving: "Thanksgiving", christmas: "Christmas", easter: "Easter", halloween: "Halloween", hanukkah: "Hanukkah", ramadan: "Ramadan", renaissance: "Renaissance" };
const PEOPLES = { thai: "Thai", english: "English", french: "French", spanish: "Spanish", german: "German", italian: "Italian", chinese: "Chinese", japanese: "Japanese", korean: "Korean", american: "American", canadian: "Canadian", mexican: "Mexican", indian: "Indian", british: "British", irish: "Irish", scottish: "Scottish", portuguese: "Portuguese", russian: "Russian", greek: "Greek", turkish: "Turkish", vietnamese: "Vietnamese", brazilian: "Brazilian", european: "European", african: "African", asian: "Asian", dutch: "Dutch", swedish: "Swedish", polish: "Polish", arabic: "Arabic" };
const DAYS = { monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday", january: "January", february: "February", april: "April", june: "June", july: "July", august: "August", september: "September", october: "October", november: "November", december: "December" };
const MORE_TYPOS = { adn: "and", teh: "the", taht: "that", waht: "what", hte: "the", nad: "and", jsut: "just", allready: "already", alredy: "already", belive: "believe", beleive: "believe", pasword: "password", passwrod: "password", neice: "niece", dependancy: "dependency", dependancies: "dependencies", tryed: "tried", alot: "a lot", recieve: "receive", recieved: "received", wensday: "Wednesday", wendsday: "Wednesday", febuary: "February", chek: "check", contrat: "contract", wierdly: "weirdly", accomodation: "accommodation", accomodate: "accommodate", begining: "beginning", beggining: "beginning", finaly: "finally", realy: "really", usualy: "usually", actualy: "actually", tommorrow: "tomorrow", untill: "until", thru: "through", gaurd: "guard", grammer: "grammar", happend: "happened", neccessary: "necessary", necesary: "necessary", occassionally: "occasionally", publically: "publicly", recomendation: "recommendation", resturant: "restaurant", sincerly: "sincerely", suprise: "surprise", truely: "truly", vaccum: "vacuum", wich: "which" };
const SINGULAR_HEADS = "list|number|set|collection|series|amount|lack|quality|cost|price|total|percentage|result|reason|cause|source|value|size|length";

const PATTERNS = [
    // Homophones.
    [/\b(?<w>its)\s+(?=(?:fine|okay|ok|not|only|been|going|gonna|true|important|hard|easy|too|really|just|still|already|unavailable|available|broken|working|done|over|getting|raining|cold|hot|late|early|my|your|our|their|his|her|a|an|the|no|all|always|probably|almost|clear|possible|impossible|worth|free|ready|here|there|up|down)\b(?!-))/gi, "it's", "its_its"],
    [/\b(?<w>it['’]s)\s+(?=(?:own|keycaps|keys|battery|screen|color|colour|owner|name|price|size|value|users|features|website|logo|engine|wheels|tail|paws|leaves|roof|walls|doors|cover|lid|case|interface|settings|contents|purpose|members|staff|employees|customers)\b)/gi, "its", "its_its"],
    [/(?:^|[.!?]\s+)(?<w>Whose)\s+(?=(?:\w+ing|going|coming|there|ready|next|in|on|up|that)\b)/g, "Who's", "whose_whos"],
    [/\b(?<w>[Ww]ho['’]s)\s+(?=(?:jacket|car|bag|phone|turn|fault|idea|coat|keys|laptop|book|pen|cup|mug|shoes|house|dog|cat|kid|kids|seat|desk|code|file|PR|commit|money|wallet|umbrella)\s+(?:is|are|was|were|this|that)\b)/g, (m) => (m[0] === "W" ? "Whose" : "whose"), "whos_whose"],
    [/(?:^|[.!?]\s+)(?<w>There)\s+(?=(?:\w+ing\s+(?:out|up|the|a|an|our|their|to|on)|so\s+\w+|really\s+\w+|not\s+(?:coming|going|here|ready|sure)))/g, "They're", "there_theyre"],
    [/\b(?:said|says|think|thought|know|knew|guess|bet|hope)\s+(?<w>there)\s+(?=the\s+\w+est\b)/gi, "they're", "there_theyre"],
    [/\b(?:you|I|we|they|to|can['’]t|couldn['’]t|didn['’]t|can|could|did|do|don['’]t|will|would|never)\s+(?<w>here)\s+(?=(?:the|about|from|that|me|you|him|her|us|them|it|anything|something|what|of|a|an)\b)/gi, "hear", "here_hear"],
    [/\b(?:I['’]m|I\s+am|so|very|really|getting|get|got|was|were|be|being|feel|feeling|always|kinda|super)\s+(?<w>board)(?=\s*(?:[.!?,;]|$|\s+(?:of|with|to|and|out|at|today|now|tonight)\b))/gi, "bored", "board_bored"],
    [/\b(?:will|['’]ll|to|can|cannot|can['’]t|would|please|must|should|did|didn['’]t|won['’]t|happily|gladly|I|we)\s+(?<w>except)\s+(?=(?:the|your|my|this|that|an|a|our|their|his|her|it|them|all|any|payment|cookies|terms|offer|invitation)\b)/gi, "accept", "except_accept"],
    [/\b(?:this|next|last|per|every|each|that)\s+(?<w>weak)(?=\s*(?:[.!?,;]|$|\s+(?:and|or|but|before|after|ago|again|end)\b))/gi, "week", "weak_week"],
    [/\b(?:to|will|can|must|should|please|['’]ll|gonna|need\s+to|have\s+to|has\s+to|had\s+to)\s+(?<w>right)\s+(?=(?:an?|the|my|your|some|this|that|down|back)\s*(?:essay|letter|email|report|code|book|song|note|story|paper|article|review|message|test|tests|program|script|function|down|back|it)?\b)/gi, "write", "right_write"],
    [/\b(?<w>brake)\s+(?=(?:the\s+(?:build|code|app|site|rules|news|law|ice|record|glass|deal|bank|internet|tests|pipeline)|my\s+heart|up\b|down\b|it\b|everything\b))/gi, "break", "brake_break"],
    [/\b(?:know|knows|knew|wonder|wondering|ask|asking|asked|sure|decide|deciding|check|checking|see|tell|unclear|unsure|matter|doubt|question)\s+(?<w>weather)\b/gi, "whether", "weather_whether"],
    [/\b(?:the|some|any|your|my|good|great|for|much|of|his|her|their|expert|legal|medical|financial|helpful)\s+(?<w>advise)(?=\s*(?:[.!?,;]|$|\s+(?:on|about|for|from|and|is|was|regarding)\b))/gi, "advice", "advise_advice"],
    [/\b(?:all|the|our|medical|military|security|hospital)\s+(?<w>personal)\s+(?=(?:must|should|are|is|will|need|have|has|were|was|shall)\b)/gi, "personnel", "personal_personnel"],
    [/\b(?:meeting|it|this|that|he|she|there|event|flight|game|class|launch|store|office|session|call|delivery|order|train|concert)\s+(?<w>maybe)\s+(?=(?:postponed|cancel+ed|delayed|late|closed|available|required|done|ready|necessary|moved|rescheduled|over|full|busy|free|open|a|an|the|too|possible)\b)/gi, "may be", "maybe_may_be"],
    [/\b(?:was|is|be|so|very|stay|kept|keep|it['’]s|never|nice\s+and|really|pretty|too|remained|remain|totally)\s+(?<w>quite)(?=\s*(?:[.!?,;]|$|\s+(?:at|even|in|please|now|for|during|tonight|and|outside|inside)\b))/gi, "quiet", "quite_quiet"],
    [/\b(?:results|data|evidence|tests|studies|they|we|can|to|will|would|could|might|this|these|experiments|numbers)\s+(?<w>proof)\s+(?=that\b)/gi, (m, g) => "prove", "proof_prove"],
    [/(?<!\b(?:walk|walked|walking|go|went|going|get|got|look|looked|read|run|ran|pass|passed|see|saw|follow|guide|guided|take|took|put|talk|talked|help|helped|lead|led|sit|sat|live|lived|scroll|browse|flip|flipped|skim|dig|went)\s+)\b(?:he|she|I|they|we|someone|somebody)\s+(?<w>through)\s+(?=(?:the|a|an|his|her|my|their|our|your|it|them|up|away|out)\b)/gi, "threw", "through_threw"],
    [/(?:,|;|^|[.!?])\s*(?<w>than)\s+(?=(?:roll|add|go|we|I|you|he|she|they|it|the|click|press|wait|mix|bake|put|let|turn|open|close|restart|run|try|check|enter|select|choose|cook|stir|serve|repeat|leave)\b)/gim, "then", "than_then"],
    [/\b(?:will|can|could|would|might|may|did|do|does|shall|should)\s+(?:I|you|we|they|he|she|it)\s+(?<w>loose)\b/gi, "lose", "loose_lose"],
    [/\b(?:email|e-mail|letter|message|call|note|text|gift|package|news|update|invite|invitation|notice|reply|response|request|feedback|answer|card|present)\s+(?<w>form)\s+(?=(?:HR|IT|the|my|your|our|their|his|her|a|an|[A-Z])\b)/g, "from", "form_from"],
    [/\b(?:there|it|this|that|he|she|what|where|who|here)\s+(?<w>si)\s+(?=(?:a|an|the|no|not|nothing|something|\w+ing)\b)/gi, "is", "si_is"],
    [/\b(?<w>during)\s+(?=(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|a\s+few|several|\d+)\s+(?:days|nights|weeks|months|years|hours|minutes|seconds|decades)\b)/gi, "for", "during_for"],
    [/\b(?<w>economical)\s+(?=(?:crisis|growth|policy|policies|situation|development|reasons|factors|problems|system|sanctions|recovery|downturn|history|theory|crises)\b)/gi, "economic", "economical_economic"],
    // Formes verbales.
    [/\b(?:I|you|we|they|he|she)\s+(?<w>done)\s+(?=(?:all|the|my|your|it|that|this|everything|nothing|a|an|some|his|her|our|their)\b)/gi, "did", "done_did"],
    // « blowed » → blew ; après un auxiliaire (« has blowed », « was blowed »), le participe : blown.
    [new RegExp(`(?:\\b(?<aux>have|has|had|having|['’]ve|haven['’]t|hasn['’]t|hadn['’]t|was|were|been|is|are|be|being|got|get)\\s+(?:not\\s+|never\\s+|already\\s+|just\\s+|ever\\s+|all\\s+)?)?\\b(?<w>${Object.keys(IRREGULAR_PAST).join("|")})\\b`, "gi"), (m, g) => {
        const past = IRREGULAR_PAST[m.toLowerCase()];
        return g.aux ? PAST_TO_PP[past] ?? past : past;
    }, "irregular_past", "grammaire"],
    [/\b(?<w>founded)\s+(?=(?:nothing|anything|something|it|them|out|that|the\s+(?:bug|issue|problem|file|error|cause|solution|key|keys))\b)/gi, "found", "founded_found"],
    [/\b(?:has|have|had|['’]ve)\s+(?:never\s+|already\s+|just\s+|not\s+)?(?<w>lead)\s+(?=(?:three|two|four|five|several|many|the|a|an|our|their|his|her|my|us|them|me|him|projects|teams|meetings)\b)/gi, "led", "lead_led"],
    [/\b(?:yesterday|last\s+\w+|ago)\b[^.!?]*\b(?:the\s+\w+|he|she|they|we|I)\s+(?<w>lead)\s+(?=(?:us|them|me|him|her|the|a|our|their)\b)/gi, "led", "lead_led"],
    [/\b(?:has|have|had|['’]ve|haven['’]t|hasn['’]t|hadn['’]t)\s+(?:never\s+|already\s+|just\s+|not\s+|ever\s+|finally\s+|recently\s+|also\s+)?(?<w>send|spend|build|lend|bring|buy|think|teach|catch|sell|tell|hold|find|leave|feel|keep|sleep|meet|lose|pay|say|make|hear|win|understand|take|give|write|drive|eat|speak|break|choose|forget|see|grow|throw|wear|steal|begin|fly|ride|wake|hide|show)\s+(?=(?:three|two|several|many|the|a|an|my|your|our|their|his|her|it|them|me|us|him|you|everything|nothing|some|all|this|that|these|those|emails|messages|everywhere|anything)\b)/gi, (m) => BASE_TO_PP[m.toLowerCase()], "perfect_pp"],
    [new RegExp(`\\b(?:has|have|had|['’]ve|haven['’]t|hasn['’]t|hadn['’]t)\\s+(?:never\\s+|already\\s+|just\\s+|not\\s+|ever\\s+|finally\\s+|recently\\s+|also\\s+)?(?<w>${REGULAR_VERBS.join("|")})(?=\\s+(?:the|a|an|my|your|our|their|his|her|it|them|everything|everywhere|all|this|that|talking|accordingly|yet|already|since|for)\\b|\\s*[.!?,]|\\s*$)`, "gi"), (m) => PP_OF(m.toLowerCase()), "perfect_pp"],
    [/\b(?:has|have)\s+(?<w>took)\b/gi, "taken", "perfect_pp"],
    [/\b(?:when|as\s+soon\s+as|once|after|until|till)\s+(?<s>I|you|we|they|he|she|it)\s+(?<w>will\s+(?<v>[a-z]+))\b/gi, (m, g) => (/^(?:he|she|it)$/i.test(g.s) ? THIRD(g.v.toLowerCase()) : g.v), "will_after_when", "grammaire"],
    [/\b(?:I|you|we|they)\s+(?<w>know)\s+(?=\p{Lu}\p{Ll}+\s+since\b|(?:him|her|them|each\s+other|it)\s+since\b)/gu, "have known", "present_since"],
    [/\b(?<w>(?:is|am|are))\s+(?=(?:married|divorced|broken|closed|open|sick|down|here|there|engaged|retired|unemployed|pregnant|vegetarian|vegan|single|together|friends|offline|online|empty|full)\s+since\b)/gi, (m) => ({ is: "has been", am: "have been", are: "have been" })[m.toLowerCase()], "present_since"],
    [/\b(?:I|you|we|they)\s+(?<w>am\s+agree|are\s+agree)\b/gi, "agree", "am_agree"],
    [/\b(?:I|he|she|it)\s+(?<w>is\s+agree)\b/gi, "agrees", "am_agree"],
    [/\b(?<w>must\s+to|should\s+to|can\s+to|could\s+to|might\s+to)\s+(?=[a-z]+\b)/gi, (m) => m.split(/\s+/)[0], "modal_to"],
    [/\blook(?:ing|s|ed)?\s+forward\s+to\s+(?<w>hear|see|meet|work|speak|talk|receive|seeing|get|join|have|discuss)\b/gi, (m) => (/ing$/.test(m) ? m : ingOf(m.toLowerCase())), "look_forward_to"],
    [/\b(?:would|could|should|might|must)\s+(?:never\s+|not\s+|just\s+|really\s+)?(?<w>of)\s+(?=[a-z]+(?:ed|en|t|wn|ne)\b)/gi, "have", "would_of"],
    [/\b(?<w>a)\s+(?=(?:8|11|18|80|81|82|83|84|85|86|87|88|89|800|8000)(?:\b|-))/g, "an", "a_an"],
    [/\b(?<w>much)\s+(?=(?:questions|people|things|friends|times|problems|issues|ideas|days|years|cars|books|errors|mistakes|users|options|changes|bugs|emails|files|reasons|tickets|requests|students|children|kids)\b)/gi, "many", "much_many"],
    [/\b(?<w>(?:advices|informations|feedbacks|softwares|equipments|furnitures|homeworks|knowledges|luggages|baggages|evidences|researchs))\b/gi, (m) => UNCOUNTABLE[m.toLowerCase()], "uncountable", "grammaire"],
    [/\b(?<w>(?:Davids|Sarahs|Marks|Johns|Toms|Emmas|Annas|Pauls|Peters|Lisas|Mikes|Daves|Kates|Sams|Bens|Jacks|Alexs|Chris's))\s+(?=(?:new|old|car|house|address|phone|office|birthday|wife|husband|mom|dad|mother|father|sister|brother|dog|cat|team|desk|email|laptop|room|party|place|idea|fault|turn)\b)/g, (m) => `${m.slice(0, -1)}'s`, "possessive_s"],
    [new RegExp(`\\b(?<w>${Object.keys(MORE_TYPOS).join("|")})\\b`, "gi"), (m) => MORE_TYPOS[m.toLowerCase()], "orthographe_courante", "orthographe"],
    [/\b(?<w>todays|tonights)\s+(?=(?:workshop|meeting|session|class|game|match|show|episode|news|lunch|dinner|menu|special|agenda|call|webinar|talk|event|weather|schedule|forecast|update|deal|deals|lesson|presentation)\b)/gi, (m) => `${m.slice(0, -1)}'s`, "possessive_s"],
    // Accords.
    [/(?<!\b(?:make|makes|made|making|let|lets|letting|help|helps|helped|have|has|had|watch|see|saw|seen|hear|heard|bid|does|did|do|doesn['’]t|didn['’]t|don['’]t|will|would|can|could|should|might|must|may|shall)\s+)\b(?:nobody|everybody|somebody|anybody|everyone|someone|anyone|no\s+one|everything)\s+(?<w>know|want|need|have|seem|care|think|remember|understand|believe|mind|use)\b(?!\s+(?:to\b)?\s*$)/gi, (m) => (/s$/.test(m) ? m : THIRD(m.toLowerCase())), "indefinite_3s"],
    [/(?:^|[.!?]\s+|\b(?:why|how|where|when|what|who|which)\s+)(?:[Dd]oes|[Dd]id|[Dd]oesn['’]t|[Dd]idn['’]t)\s+(?:(?:your|my|his|her|their|our|the|this|that)\s+[a-z]+|anybody|anyone|somebody|someone|everybody|everyone|nobody|he|she|it)(?:\s+(?:really|actually|even|still|ever|always|usually|also|just|often|never))?\s+(?<w>[a-z]+s)\b(?=\s+(?:at|in|on|where|the|a|an|to|for|with|here|there|it|them|me|you|that|this)\b|\s*\?)/gi, (m) => (/(?:ss|us|is)$/.test(m) ? m : /ies$/.test(m) ? `${m.slice(0, -3)}y` : /(?:ches|shes|xes|sses|oes)$/.test(m) ? m.slice(0, -2) : m.slice(0, -1)), "does_base"],
    // « the number of tickets have » → has ; mais « a number of customers have » (= plusieurs) reste.
    [new RegExp(`\\b(?:the\\s+(?:${SINGULAR_HEADS})|a\\s+(?!number\\b)(?:${SINGULAR_HEADS}))\\s+(?:of|for)\\s+(?:[a-z-]+\\s+){1,4}?(?<w>are|were|have)\\b`, "gi"), (m) => ({ are: "is", were: "was", have: "has" })[m.toLowerCase()], "head_of_agreement"],
    [/\b(?:one)\s+of\s+(?:the|my|your|our|their|his|her|these|those)\s+(?:[a-z-]+\s+){0,3}?[a-z]+s\s+(?:[a-z-]+\s+){0,4}?(?<w>are|were|have)\b/gi, (m) => ({ are: "is", were: "was", have: "has" })[m.toLowerCase()], "one_of_agreement"],
    [/\b(?:most|many|some|all|both|several|none)\s+of\s+(?:the|my|your|our|their|his|her|these|those)\s+(?:[a-z-]+\s+)?[a-z]+s\s+(?:already\s+|now\s+|still\s+|just\s+)?(?<w>has|is|was)\b/gi, (m) => ({ has: "have", is: "are", was: "were" })[m.toLowerCase()], "most_of_agreement"],
    [/\b(?:attached|enclosed|included|below|here)\s+(?<w>is)\s+(?=(?:the|my|our|your|two|three|all|some|both)\s+(?:[a-z-]+\s+)?[a-z]+s\b)/gi, "are", "attached_are"],
    // Sujet singulier : « it », « mine », ou « this/that/the/my… + nom singulier » (pas un pluriel, pas un
    // auxiliaire, pas un nom propre) ; « This function return `null` », « The battery last two days ».
    [new RegExp(`(?:^|[.!?;:]\\s+|,\\s+(?:and|but|so|now)\\s+)(?:(?:it|mine|yours)\\s+|(?:this|that|the|my|your|our|their|his|her)\\s+(?!(?:${MODAL_OR_AUX})\\b)[a-z]{2,}(?<![sd]|ly|ing)\\s+)(?<w>${PRESENT_RE})\\b(?=\\s+(?:\`|on|in|about|every|two|three|all|the|a|an|null|true|false|down|up|out|over|at|with|when|to)\\b)`, "gm"), (m) => THIRD(m.toLowerCase()), "subject_3s"],
    [/\b(?:the|my|your|our|this|that)\s+(?:[a-z]+\s+)?[a-z]*[^s\s]\s+(?<w>keep|start|stop)\s+(?=[a-z]+ing\b)/gi, (m) => `${m.toLowerCase()}s`, "keep_ing_3s"],
    // Majuscules.
    [new RegExp(`\\b(?<w>${Object.keys(HOLIDAYS).join("|")})\\b`, "g"), (m) => HOLIDAYS[m], "holiday_capital", "grammaire"],
    [new RegExp(`\\b(?<w>${Object.keys(PEOPLES).join("|")})\\b(?=\\s+(?:food|restaurant|place|cuisine|homework|class|lesson|teacher|people|friend|friends|culture|language|guy|girl|team|version|book|movie|music|wine|cheese|accent|speaker|speakers|citizen|national|grammar|test|exam|course|essay|translation)\\b)`, "g"), (m) => PEOPLES[m], "nationality_capital", "grammaire"],
    [new RegExp(`\\b(?:on|this|next|last|every|until|by|since|from|before|after|in|early|late|mid)\\s+(?<w>${Object.keys(DAYS).join("|")})\\b`, "g"), (m) => DAYS[m], "day_capital", "grammaire"],
];

// --- Grand banc génératif (06/11/2026) ---
const IRREGULAR_PAST_OF = { go: "went", see: "saw", do: "did", take: "took", give: "gave", write: "wrote", eat: "ate", drink: "drank", begin: "began", break: "broke", choose: "chose", forget: "forgot", know: "knew", throw: "threw", drive: "drove", ride: "rode", speak: "spoke", steal: "stole", wear: "wore", win: "won", fly: "flew", grow: "grew", rise: "rose", hide: "hid", shake: "shook", run: "ran", come: "came", become: "became", buy: "bought", bring: "brought", think: "thought", teach: "taught", catch: "caught", fight: "fought", sell: "sold", tell: "told", hold: "held", find: "found", leave: "left", feel: "felt", keep: "kept", sleep: "slept", meet: "met", lose: "lost", pay: "paid", say: "said", make: "made", hear: "heard", sit: "sat", stand: "stood", understand: "understood", send: "sent", spend: "spent", build: "built", lend: "lent", get: "got", have: "had", fall: "fell", swim: "swam", sing: "sang", wake: "woke", mean: "meant" };
const SAME_FORMS = new Set(["read", "put", "cut", "let", "hit", "set", "cost", "hurt", "quit", "shut", "spread", "bet", "split", "cast"]);
const BASE_VERBS = new Set([...COMMON_VERBS, ...Object.keys(IRREGULAR_PAST_OF), "steal", "drink", "throw", "catch", "teach", "choose", "speak", "wear", "begin", "fix", "finish", "print", "open", "watch", "clean", "install", "update", "check"]);
const pastOf = (base) => IRREGULAR_PAST_OF[base] ?? (/e$/.test(base) ? `${base}d` : /[^aeiou]y$/.test(base) ? `${base.slice(0, -1)}ied` : /^(?:stop|plan|drop|ship|chat|shop|skip|step|swap|tap|tag|log|jog|grab)$/.test(base) ? `${base}${base.slice(-1)}ed` : `${base}ed`);
const INFLECTED = new Map();
for (const base of BASE_VERBS) {
    INFLECTED.set(THIRD(base), base);
    if (!SAME_FORMS.has(base)) {
        INFLECTED.set(pastOf(base), base);
    }
}
const INFLECTED_RE = [...INFLECTED.keys()].sort((a, b) => b.length - a.length).join("|");
const BASE_RE = [...BASE_VERBS].filter((v) => !SAME_FORMS.has(v)).sort((a, b) => b.length - a.length).join("|");
const THIRD_RE = [...BASE_VERBS].map(THIRD).sort((a, b) => b.length - a.length).join("|");
// Début de complément : déterminant, pronom, nom propre (langue, ville), ou nom de matière courant.
const OBJECT_START = "(?:the|a|an|my|your|his|her|their|our|its|this|that|these|those|every|some|it|them|him|me|us|her|all|no|any|two|three|several|a\\s+few|(?-i:[A-Z][a-z]+)|coffee|tea|water|juice|milk|math|music|money|time|lunch|dinner|breakfast|homework|sports?|football|soccer|tennis|chess)";
// Participe passé employé seul comme prétérit : « we drunk the juice » → drank.
const PP_AS_PAST = { given: "gave", eaten: "ate", done: "did", drunk: "drank", seen: "saw", gone: "went", taken: "took", written: "wrote", broken: "broke", chosen: "chose", spoken: "spoke", stolen: "stole", driven: "drove", forgotten: "forgot", begun: "began", sung: "sang", swum: "swam", rung: "rang", flown: "flew", grown: "grew", thrown: "threw", worn: "wore", ridden: "rode", risen: "rose", fallen: "fell", hidden: "hid", shaken: "shook" };
// Prénoms courants : sujet nommé (« Sarah update the file » → updates). Sans dictionnaire des
// natures, un mot à majuscule en tête de phrase peut être n'importe quoi (« Clothes make the man »).
const FIRST_NAMES = new Set("Sarah Emma Olivia Ava Sophia Mia Emily Hannah Anna Laura Julia Lisa Kate Jessica Jennifer Rachel Rebecca Amy Megan Lauren Chloe Grace Lucy Ella Zoe Nina Maria Sofia Clara Alice Julie Marie Camille Léa Manon Inès Priya Aisha Fatima Yuki Mei Liam Noah James John Michael David Daniel Matthew Andrew Mark Paul Peter Tom Thomas Chris Ben Sam Jack Harry Charlie Oliver Ethan Lucas Leo Max Alex Ryan Kevin Brian Eric Jason Josh Adam Luke Nick Mike Steve Dave Jake Tyler Kyle Sean Omar Ali Raj Arjun Hugo Louis Jules Arthur Gabriel Karim Mehdi Jordan Taylor Morgan Casey Robin Jamie".split(" "));
// Débuts de phrase qui ne sont pas des prénoms (impératifs, adverbes, mots de liaison).
const NOT_NAMES = new Set(["please", "let", "then", "also", "today", "yesterday", "tomorrow", "maybe", "now", "so", "and", "but", "if", "when", "after", "before", "here", "there", "thanks", "sorry", "hey", "hi", "hello", "yes", "no", "well", "just", "only", "even", "still", "sometimes", "usually", "always", "never", "everyone", "nobody", "somebody", "someone", "anyone", "everybody"]);
const INFINITIVE_TAKERS = "want|wants|wanted|need|needs|needed|decide|decides|decided|forget|forgets|forgot|try|tries|tried|plan|plans|planned|hope|hopes|hoped|going|used|able|like|likes|liked|love|loves|loved|start|started|begin|began|learn|learned|agree|agreed|refuse|refused|promise|promised|seem|seems|seemed|manage|managed|remember|remembered|choose|chose|prefer|preferred|expect|expected|offer|offered|have|has|had|asked|told|wanted";
const SINCE_PP = { live: "lived", work: "worked", know: "known", study: "studied", teach: "taught", wait: "waited", play: "played", use: "used", own: "owned", stay: "stayed", run: "run", love: "loved", want: "wanted", need: "needed", drive: "driven", feel: "felt", lead: "led", manage: "managed" };
const SINCE_TIME = "(?:\\d{4}|\\d{1,2}\\s*(?:am|pm|a\\.m\\.|p\\.m\\.)|last\\s+\\w+|this\\s+\\w+|early\\s+\\w+|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|college|childhood|high\\s+school|school|then|the\\s+(?:beginning|start|summer|spring|winter|fall|pandemic|war)|my\\s+childhood|birth|ages|forever)";
const IRREGULAR_NOUN_PLURALS = { mans: "men", womans: "women", childs: "children", foots: "feet", tooths: "teeth", mouses: "mice", gooses: "geese", persons: null, criterias: "criteria", phenomenons: "phenomena", sheeps: "sheep", deers: "deer", fishs: "fish" };
const DOUBLE_COMPARATIVE = /\b(?<w>more\s+(?<c>better|worse|easier|harder|faster|slower|bigger|smaller|cheaper|older|younger|larger|higher|lower|longer|shorter|happier|nicer|safer|simpler|stronger|quicker)|most\s+(?<s>best|worst|easiest|hardest|fastest|biggest|smallest|cheapest|oldest|youngest|largest|highest|lowest|longest|shortest|happiest|nicest|safest|simplest|strongest|quickest))\b/gi;

const BIG_PATTERNS = [
    // Présent avec « since » + date → present perfect.
    [new RegExp(`\\b(?<s>I|you|we|they|he|she|it|my\\s+[a-z]+|our\\s+[a-z]+|the\\s+[a-z]+|his\\s+[a-z]+|her\\s+[a-z]+|their\\s+[a-z]+)\\s+(?<w>${Object.keys(SINCE_PP).flatMap((b) => [b, THIRD(b)]).join("|")})\\b(?=(?:\\s+[\\p{L}'-]+){0,4}?\\s+since\\s+${SINCE_TIME}\\b)`, "giu"), (m, g) => {
        const base = INFLECTED.get(m.toLowerCase()) ?? m.toLowerCase().replace(/s$/, "");
        const pp = SINCE_PP[base] ?? SINCE_PP[m.toLowerCase()];
        const third = /^(?:he|she|it)$/i.test(g.s) || (!/^(?:I|you|we|they)$/i.test(g.s) && !/s$/i.test(g.s.split(/\s+/).pop()));
        return pp ? `${third ? "has" : "have"} ${pp}` : null;
    }, "present_since"],
    // Forme fléchie après un auxiliaire ou un modal : « doesn't sees », « might throws ».
    [new RegExp(`(?<!\\b(?i:the|a|an|his|her|their|my|your|our|its|free|good|ill|last|this|that|tin|watering|trash|garbage|paint|soda|beer)\\s+)\\b(?:doesn['’]t|don['’]t|didn['’]t|does\\s+not|do\\s+not|did\\s+not|won['’]t|can['’]t|cannot|couldn['’]t|shouldn['’]t|wouldn['’]t|mustn['’]t|can|could|should|would|must|might|may|will|shall)\\s+(?:not\\s+|never\\s+|really\\s+|always\\s+|just\\s+|still\\s+)?(?<w>${INFLECTED_RE})\\b(?=\\s+${OBJECT_START}\\b|\\s+(?:up|out|down|in|on|off|back|home|here|there|now|today|tomorrow)\\b|\\s*[.!?,])`, "gi"), (m) => INFLECTED.get(m.toLowerCase()), "base_after_modal"],
    // « Did you threw », « Does she likes ».
    [new RegExp(`\\b(?:did|does|do|didn['’]t|doesn['’]t)\\s+(?:I|you|he|she|it|we|they|(?:the|your|my|his|her|our|their)\\s+[a-z]+)\\s+(?<w>${INFLECTED_RE})\\b(?=\\s+${OBJECT_START}\\b|\\s*[?.!])`, "gi"), (m) => INFLECTED.get(m.toLowerCase()), "base_after_do"],
    // « decided to teaches » → teach.
    [new RegExp(`\\b(?:${INFINITIVE_TAKERS})\\s+to\\s+(?<w>${INFLECTED_RE})\\b(?=\\s+${OBJECT_START}\\b)`, "gi"), (m) => INFLECTED.get(m.toLowerCase()), "base_after_to"],
    // Sujet nom singulier (avec complément) + base verbale : « My brother from the third floor find ».
    [new RegExp(`(?:^|[.!?]\\s+)(?:The|My|Our|Your|His|Her|Their|This|That)\\s+(?:new\\s+|old\\s+)?(?!(?:may|might|must|will|would|can|could|should|shall|does|did|has|had|was|were|also|just|never|always|really|only|still|children|people|men|women|feet|teeth|mice|police|staff|data|media|cattle|sheep|fish|deer|crew|team|family)\\b)(?<n>[a-z]{3,})(?<!s)(?:\\s+(?:from|in|at|on|near|with)\\s+(?:the\\s+|my\\s+|our\\s+|a\\s+|an\\s+)?(?:[a-zA-Z-]+\\s+){0,2}?[a-zA-Z-]+|\\s+who\\s+(?:lives|works|sits|stays)\\s+(?:next\\s+door|here|there|upstairs|downstairs|nearby))?\\s+(?<w>${BASE_RE})\\b(?=\\s+${OBJECT_START}\\b)`, "gm"), (m) => THIRD(m.toLowerCase()), "subject_singular_base"],
    // Sujet nom pluriel + 3e personne : « The kids watches », « The developers from Berlin fixes ».
    [new RegExp(`(?:^|[.!?]\\s+)(?:The|My|Our|Your|His|Her|Their|These|Those)\\s+(?:new\\s+|old\\s+)?[a-z]{2,}[abcdefghjklmnopqrtvxz]s(?:\\s+(?:from|in|at|on|near|with)\\s+(?:the\\s+|my\\s+|our\\s+|a\\s+|an\\s+)?(?:[a-zA-Z-]+\\s+){0,2}?[a-zA-Z-]+|\\s+who\\s+(?:live|work|sit|stay)\\s+(?:next\\s+door|here|there|upstairs|downstairs|nearby))?\\s+(?<w>${THIRD_RE})\\b(?=\\s+${OBJECT_START}\\b)`, "gm"), (m) => INFLECTED.get(m.toLowerCase()), "subject_plural_third"],
    // Indéfinis + base : « Everyone know », « Each student need ».
    [new RegExp(`(?<!\\b(?:make|makes|made|making|let|lets|letting|help|helps|helping|have|has|had|having|watch|watching|see|saw|seeing|hear|heard|does|did|do|will|would|can|could|should|might|must|may)\\s+)\\b(?:everyone|everybody|someone|somebody|anyone|anybody|nobody|no\\s+one|each\\s+[a-z]+|every\\s+[a-z]+|neither\\s+of\\s+(?:them|us|you|the\\s+[a-z]+))\\s+(?<w>${BASE_RE})\\b(?=\\s+${OBJECT_START}\\b)`, "gi"), (m) => THIRD(m.toLowerCase()), "indefinite_3s"],
    // Prénom (avec complément) + base : « Sarah from the third floor bring » → brings. Un mot qui est
    // un verbe ou un début de phrase courant (« Check », « Please ») n'est pas un prénom.
    [new RegExp(`(?:^|[.!?]\\s+)(?<name>[A-Z][a-z]{2,})(?:\\s+(?:from|in|at|on|near|with)\\s+(?:the\\s+|my\\s+|our\\s+|a\\s+|an\\s+)?(?:[a-zA-Z-]+\\s+){0,2}?[a-zA-Z-]+|\\s+who\\s+(?:lives|works|sits|stays)\\s+(?:next\\s+door|here|there|upstairs|downstairs|nearby))?\\s+(?<w>${BASE_RE})\\b(?=\\s+${OBJECT_START}\\b)`, "gm"), (m, g) => (FIRST_NAMES.has(g.name) && !NOT_NAMES.has(g.name.toLowerCase()) ? THIRD(m.toLowerCase()) : null), "subject_singular_base"],
    // Nom composé de métier : « The team lead see » → sees.
    [new RegExp(`(?:^|[.!?]\\s+)(?:The|My|Our|Your|His|Her|Their)\\s+[a-z]+\\s+(?:lead|manager|leader|member|director|owner|captain|engineer|assistant|officer)(?:\\s+(?:from|in|at|on|near|with)\\s+(?:the\\s+|my\\s+|our\\s+|a\\s+|an\\s+)?(?:[a-zA-Z-]+\\s+){0,2}?[a-zA-Z-]+|\\s+who\\s+(?:lives|works|sits|stays)\\s+(?:next\\s+door|here|there|upstairs|downstairs|nearby))?\\s+(?<w>${BASE_RE})\\b(?=\\s+${OBJECT_START}\\b)`, "gm"), (m) => THIRD(m.toLowerCase()), "subject_singular_base"],
    // « we drunk the juice », « it given a gift » → drank, gave.
    [new RegExp(`(?<!\\b(?i:have|has|had|having|'ve|’ve|'s|’s|'d|’d|be|been|being|is|are|was|were|get|got)\\s+)\\b(?:I|you|he|she|it|we|they)\\s+(?<w>${Object.keys(PP_AS_PAST).join("|")})\\b(?=\\s+${OBJECT_START}\\b|\\s*[.!?,])`, "g"), (m) => PP_AS_PAST[m.toLowerCase()], "pp_as_past"],
    // There is + pluriel, there are + singulier.
    [/\b[Tt]here\s+(?<w>is|was|['’]s)\s+(?=(?:many|several|two|three|four|five|six|seven|eight|nine|ten|some|a\s+few|lots\s+of|plenty\s+of|dozens\s+of|hundreds\s+of|numerous|multiple)\s+[a-z]+s\b)/g, (m) => (/was/.test(m) ? "were" : "are"), "there_are"],
    [/\b[Tt]here\s+(?<w>are|were)\s+(?=(?:a|an|one|only\s+one|just\s+one)\s+(?!few\b|lot\b|number\b|couple\b|bunch\b|dozen\b|handful\b|variety\b|series\b|total\b)[a-z]+(?<!s)\b)/g, (m) => (/were/.test(m) ? "was" : "is"), "there_is"],
    // Pluriels irréguliers, doubles comparatifs, badder.
    [/\b(?<w>mans|womans|childs|foots|tooths|mouses|gooses|criterias|phenomenons|sheeps|deers|fishs)\b/gi, (m) => IRREGULAR_NOUN_PLURALS[m.toLowerCase()], "irregular_plural"],
    [DOUBLE_COMPARATIVE, (m, g) => g.c ?? g.s, "double_comparative"],
    [/\b(?<w>badder|baddest|gooder|goodest)\b/gi, (m) => ({ badder: "worse", baddest: "worst", gooder: "better", goodest: "best" })[m.toLowerCase()], "irregular_comparative"],
    // « im on my way », « todays notes ».
    [/(?<![\p{L}'’])(?<w>im)(?=\s+(?:on|going|not|so|at|in|here|sorry|tired|fine|ok|okay|done|ready|home|late|good|a|the|very|really|just|still|almost|already|busy|free|back|[a-z]+ing)\b)/gu, "I'm", "im_contraction"],
    [/\b(?<w>todays|tonights|yesterdays)\s+(?=(?!and\b|or\b|of\b|is\b|are\b)[a-z]+)/g, (m) => `${m.slice(0, -1)}'s`, "possessive_s"],
];

// --- Banc réaliste à l'aveugle (06/11/2026, textes-5) ---
// Accord sujet-verbe au-delà du début de phrase (après une virgule, « if », « says »…, avec un
// complément « of the… »), temps (present perfect + date passée, « since », « will » après « when »),
// homophones courants (lose/loose, quite/quiet, brake/break…), adjectif employé comme adverbe,
// pronoms (« Him and his brother are », « asked Sam and I »), a/an devant un sigle.
const ingOf = (base) => (/ie$/.test(base) ? `${base.slice(0, -2)}ying`
    : /(?:ee|ye|oe)$/.test(base) || base === "be" ? `${base}ing`
        : /[^aeiou]e$/.test(base) ? `${base.slice(0, -1)}ing`
            : /^(?:get|put|run|sit|swim|stop|plan|shop|set|cut|hit|let|begin|win|forget|chat|drop|jog|shut|dig|wrap|skip|grab|travel)$/.test(base) ? `${base}${base.slice(-1)}ing` : `${base}ing`);
const PAST_TO_PP = { saw: "seen", did: "done", went: "gone", came: "come", ate: "eaten", drank: "drunk", wrote: "written", took: "taken", gave: "given", spoke: "spoken", broke: "broken", chose: "chosen", forgot: "forgotten", knew: "known", threw: "thrown", drove: "driven", rode: "ridden", stole: "stolen", wore: "worn", flew: "flown", grew: "grown", rose: "risen", hid: "hidden", shook: "shaken", ran: "run", began: "begun", swam: "swum", sang: "sung", rang: "rung", fell: "fallen", became: "become", woke: "woken", blew: "blown", drew: "drawn", froze: "frozen" };
const PP_TO_PAST = {};
const PP_TO_BASE = {};
for (const [base, pp] of Object.entries(BASE_TO_PP)) {
    PP_TO_PAST[pp] = IRREGULAR_PAST_OF[base] ?? pp;
    PP_TO_BASE[pp] = base;
}
const IRREG_PP_RE = Object.keys(PP_TO_PAST).sort((a, b) => b.length - a.length).join("|");
const baseOfParticiple = (pp) => PP_TO_BASE[pp] ?? INFLECTED.get(pp) ?? null;
const UNITS = new Set(["dollars", "euros", "pounds", "cents", "bucks", "hours", "minutes", "seconds", "days", "weeks", "months", "years", "miles", "kilometers", "kilometres", "km", "meters", "metres", "feet", "inches", "percent", "degrees", "times", "grams", "kilos", "kilograms", "liters", "litres", "gallons", "points", "calories", "decades", "centuries", "nights", "laps", "rounds", "yards", "steps", "pages"]);
const NON_S_PLURALS = new Set(["criteria", "phenomena", "bacteria", "alumni", "personnel", "clergy", "offspring", "aircraft", "fish", "sheep", "deer", "species", "series", "cattle", "media", "data", "people", "police", "staff"]);
// Ce qui peut suivre un déterminant sans être le nom sujet (adjectifs substantivés, quantités…).
const NOT_HEADS = new Set(["new", "old", "own", "other", "same", "best", "worst", "most", "only", "first", "last", "next", "way", "kind", "sort", "type", "rest", "majority", "minority", "number", "lot", "half", "all", "both", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "each", "none", "some", "many", "few", "several", "rich", "poor", "elderly", "young", "wealthy", "unemployed", "injured", "wounded", "dead", "homeless", "sick", "blind", "deaf", "disabled", "living", "accused", "latter", "former", "following", "above", "below", "variety", "range", "couple", "bunch", "pair", "group", "total", "percentage", "plenty", "part", "remainder", "oldest", "youngest", "eldest", "biggest", "smallest", "largest", "greatest", "latest", "fastest", "tallest", "richest", "strongest", "highest", "lowest", "newest", "more", "less", "who", "which", "what", "there", "here", "very", "really", "too", "much", "other", "others", "whole", "entire", "main", "same", "usual"]);
// Modaux, auxiliaires, adverbes, pronoms, nombres, adjectifs courants : jamais le nom sujet.
const COMMON_ADJECTIVES = "hard|good|great|bad|quick|nice|free|final|real|high|low|long|short|early|late|fast|slow|full|open|close|deep|fresh|clean|clear|cold|hot|warm|cool|dark|light|heavy|easy|simple|strong|weak|safe|key|extra|sure|daily|weekly|monthly|annual|public|private|social|political|personal|special|general|common|human|natural|physical|total|overall|initial|major|minor|basic|recent|original|actual|proper|normal|serious|important|popular|possible|available|perfect|brief|rough|smooth|wide|narrow|meteoric|flip|sudden|huge|whole|bright|loud|quiet|busy|happy|sad|angry|funny|weird|strange|odd|poor|rich|cheap|expensive|famous|favorite|favourite|best|worst";
for (const word of `${COMMON_ADJECTIVES}|will|would|can|could|should|may|might|must|shall|does|did|has|had|was|were|also|just|never|always|really|only|still|even|often|usually|sometimes|already|you|they|we|she|he|him|her|them|it|his|its|our|their|your|mine|yours|ours|theirs|this|these|those|score|dozen|hundred|thousand|million|billion|elect|chosen|faithful|brave|innocent|guilty|miss|mister`.split("|")) {
    NOT_HEADS.add(word);
}
const ED_NOUNS = new Set(["bed", "shed", "seed", "need", "speed", "feed", "creed", "deed", "steed", "weed", "greed", "reed", "breed", "sled", "shred"]);
const MEN_SINGULARS = new Set(["specimen", "abdomen", "omen", "regimen", "semen", "hymen", "acumen", "stamen", "amen"]);
const singularHead = (n, one = false) => !!n && /^[a-z]{3,}$/.test(n) && !/s$/.test(n) && !/iest$/.test(n) && !COLLECTIVE.has(n) && !IRREGULAR_PLURALS.has(n) && !NON_S_PLURALS.has(n) && (!NOT_HEADS.has(n) || (one && n === "one"))
    && !(/ed$/.test(n) && !ED_NOUNS.has(n)) && !/(?:i|ia)$/.test(n) && !(/men$/.test(n) && !MEN_SINGULARS.has(n));
const pluralHead = (n) => !!n && /^[a-z]{3,}$/.test(n) && (IRREGULAR_PLURALS.has(n) || (/[^s]s$/.test(n) && !/(?:us|is|ics|ness|ous)$/.test(n) && !NOT_PLURAL_WORDS.has(n) && !NOT_HEADS.has(n)));
// Début de proposition : début de phrase ou de ligne, virgule, conjonction, verbe introducteur.
const CLAUSE_WORDS = "when|because|unless|until|once|while|whenever|although|why|how|where|that|says|said|thinks|think|thought|hopes|hope|know|knows|believe|believes|guess|feel|feels|sure";
const clauseAt = (extra = "") => `(?:^|[.!?;:]\\s+|\\n\\s*|,\\s+(?:(?:and|but|so|or)\\s+)?|\\b(?:${CLAUSE_WORDS}${extra})\\s+)`;
const CLAUSE = clauseAt("|if|though|whether");
const CLAUSE_REAL = clauseAt();
const ADJ_SLOT = `(?:(?:new|old|little|big|small|young|other|same|whole|local|main|current|previous|last|first|next|latest|tiny|younger|older|only|own|entire|usual|regular|${COMMON_ADJECTIVES})\\s+)?`;
// Mot d'un complément : pas un auxiliaire, un article, un relatif ni une conjonction (sinon le
// complément « avale » le verbe : « the price of real estate will rise »).
const PP_WORD = "(?!(?:will|would|can|could|should|may|might|must|shall|does|did|do|has|have|had|is|are|was|were|also|just|never|always|really|only|still|even|often|usually|to|not|a|an|the|which|who|whom|that|whose|where|when|and|or|but)\\b)[a-z-]+";
const PP_SLOT = `(?:\\s+(?:from|in|at|on|near|with|of|for|to|behind|under|above|across)\\s+(?:the\\s+|my\\s+|our\\s+|a\\s+|an\\s+|this\\s+|that\\s+|your\\s+|his\\s+|her\\s+|their\\s+)?(?:${PP_WORD}\\s+){0,2}?${PP_WORD})?`;
const AFTER_VERB = `(?=\\s+(?:${OBJECT_START}|zero|once|twice|forever|anymore|perfectly|properly|correctly|smoothly)\\b|\\s+to\\s+(?:${BASE_RE})\\b)`;
const SUBJ_DET = "(?:the|my|your|his|her|our|their|this|that|every|each)";
const PLURAL_SUBJ_DET = "(?:the|my|your|his|her|our|their|these|those|some|many|all|both|several|most)";
const STATIVE_ING = { knowing: "know", believing: "believe", understanding: "understand", owning: "own", belonging: "belong", preferring: "prefer", seeming: "seem", containing: "contain", consisting: "consist", recognizing: "recognize", possessing: "possess", resembling: "resemble" };
const STATIVE = new Set(["know", "need", "want", "have", "like", "love", "hate", "think", "believe", "understand", "live", "own", "seem", "mean", "prefer", "remember", "feel", "look", "cost", "belong", "contain", "agree", "depend", "hope", "include", "require", "see", "hear", "be"]);
const ADVERB_OF = { careful: "carefully", perfect: "perfectly", honest: "honestly", good: "well", bad: "badly", terrible: "terribly", awful: "awfully", horrible: "horribly", beautiful: "beautifully", careless: "carelessly", serious: "seriously", smooth: "smoothly", proper: "properly", correct: "correctly", incorrect: "incorrectly", polite: "politely", rude: "rudely", efficient: "efficiently", consistent: "consistently", professional: "professionally", fluent: "fluently", poor: "poorly", nervous: "nervously", calm: "calmly", patient: "patiently", silent: "silently", successful: "successfully", regular: "regularly", easy: "easily" };
const ACTION_VERBS = "drive|drives|drove|driving|speak|speaks|spoke|speaking|play|plays|played|playing|work|works|worked|working|run|runs|ran|running|sing|sings|sang|singing|dance|dances|danced|dancing|write|writes|wrote|writing|cook|cooks|cooked|cooking|treat|treats|treated|behave|behaves|behaved|answer|answers|answered|respond|responds|responded|perform|performs|performed|handle|handles|handled|sleep|sleeps|slept|sleeping|explain|explains|explained|went|go|goes|going|did|mix|stir|blend|swim|swims|swam|draw|draws|drew|paint|paints|painted|type|types|typed|listen|listened|communicate|communicates|install|installed|function|functions|functioned|read|reads|fit|fits|sew|knit";
// Sigles qui se lisent comme un mot (« a NASA engineer ») : on ne touche pas à l'article.
const WORD_ACRONYMS = new Set(["NASA", "NATO", "SIM", "FAQ", "SQL", "RAM", "ROM", "LAN", "WAN", "NAS", "GIF", "JPEG", "PNG", "MIME", "SAML", "SOAP", "REST", "JSON", "YAML", "SWAT", "SCSI", "LASER", "RADAR", "UNESCO", "UNICEF", "OPEC", "ASAP", "FOMO", "YOLO", "NIMBY", "IKEA", "AIDS", "ISIS", "SARS", "COVID", "HIPAA", "FIFA", "NAFTA", "AWOL", "OLED", "LED", "ESPN", "MRI", "NBA", "NFL"]);
export function articleForAcronym(word) {
    if (!/^[A-Z][A-Z0-9]{1,4}s?$/.test(word) || WORD_ACRONYMS.has(word.replace(/s$/, ""))) {
        return null;
    }
    return /^[AEFHILMNORSX]/.test(word) ? "an" : "a";
}
const DAY_OR_MONTH = "monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december";
const PAST_MARKER = `(?:yesterday|last\\s+(?:week|month|year|night|summer|winter|spring|fall|autumn|weekend|${DAY_OR_MONTH})|ago|in\\s+(?:19\\d\\d|20[01]\\d|202[0-5]))`;

const REAL_EARLY = [
    // Apostrophes oubliées, contractions.
    [/\b(?<w>[Tt]heir['’]s)\b/g, "there's", "theirs_there"],
    [/\b(?<w>hisself|theirselves|theirself|themselfs|yourselfs|ourselfs)\b/gi, (m) => ({ hisself: "himself", theirselves: "themselves", theirself: "themselves", themselfs: "themselves", yourselfs: "yourselves", ourselfs: "ourselves" })[m.toLowerCase()], "reflexive"],
    [/(?<![\w'’@#/.-])(?<w>whats|thats|theres|isnt|arent|wasnt|werent|doesnt|didnt|hasnt|havent|hadnt|couldnt|shouldnt|wouldnt|mustnt|youre|theyre|youve|weve|theyve|youll|theyll|cant)(?![\w'’-])/gi, (m) => {
        const lower = m.toLowerCase();
        return { youre: "you're", theyre: "they're", youve: "you've", weve: "we've", theyve: "they've", youll: "you'll", theyll: "they'll", cant: "can't", whats: "what's", thats: "that's", theres: "there's" }[lower] ?? lower.replace(/nt$/, "n't");
    }, "contraction", "orthographe"],
    // « dont » : doesn't après he/she/it ou un nom singulier (« the gate code dont work »).
    [/(?:\b(?<p>he|she|it|everyone|everybody|someone|somebody|anyone|anybody|nobody)\s+|\b(?:the|my|your|his|her|our|their|this|that|a|an)\s+(?:[a-z]+\s+)?(?<n>[a-z]+)\s+|(?<c>`[^`\n]+`)\s+)?(?<![\w'’])(?<w>dont)(?![\w'’])/gi, (m, g) => ((g.p || g.c || singularHead(g.n)) ? "doesn't" : "don't"), "contraction", "orthographe"],
    [/(?<![\p{L}'’@#/.-])(?<w>im)(?=\s+[a-z])/gu, "I'm", "im_contraction"],
    [/\b(?<w>definatly|definately|definitly|definetly|defenitely|definitley|latly|ofr)\b/gi, (m) => ({ latly: "lately", ofr: "for" })[m.toLowerCase()] ?? "definitely", "orthographe_courante", "orthographe"],
    [/\b(?<w>defiantly)\s+(?=(?:not|a|an|the|worth|recommend|going|will|be|need|one|getting|something|true|better|worse|more|less|agree|want|coming|my|your|our)\b)/gi, "definitely", "defiantly"],
    [/\b(?:my|your|his|her|our|their)\s+(?<w>(?:mom|dad|mum|wife|husband|sister|brother|son|daughter|aunt|uncle|grandma|grandpa|grandmother|grandfather|girlfriend|boyfriend|partner|roommate|landlord|neighbor|neighbour|cousin|friend|teacher|manager|coworker|colleague)s)\s+(?=(?:birthday|car|house|place|phone|name|job|office|wedding|party|room|idea|fault|turn|cooking|recipe|advice|dog|cat|new|old|favorite|favourite|apartment|number|email|address|garden|kitchen|laptop|wallet|bag|kids|husband|wife|family|parents|funeral|graduation|retirement|anniversary|surgery|health)\b)/gi, (m) => `${m.slice(0, -1)}'s`, "possessive_s"],
    // a/an devant un sigle : « an SUV », « a URL ».
    [/(?<![A-Z]{2,}\s+)\b(?<w>[Aa]n?)\s+(?=(?<x>[A-Z][A-Z0-9]{1,4}s?)\b(?!\s+[A-Z]{2,}\b))/g, (m, g) => {
        const want = articleForAcronym(g.x);
        return want && m.toLowerCase() !== want ? want : null;
    }, "a_an_sigle"],
    // Homophones.
    [/\b(?:if|when|because|since|unless|while|as|and|but|so|hope|think|know|sure|guess|bet|that)\s+(?<w>[Yy]our)\s+(?=(?:on\s+(?:your|the)\s+way|stuck|done|not|kidding|joking|gonna|going\s+to|about\s+to|supposed\s+to|allowed\s+to|able\s+to|in\s+charge|out\s+of\s+\w+|(?:ready|sure|late|early|busy|free|lucky|right|wrong|here|there|home|back|welcome|coming|leaving|done)(?=\s*[.!?,;]|\s*$|\s+(?:to|for|with|about|at|in|on|by|and|but|so|now|today|tonight|again|because|yet)\b)))/g, "you're", "your_youre"],
    [/\b(?:left|lost|forgot|took|brought|finished|sold|bought|parked|washed|cleaned|packed|opened|closed|locked|unlocked|turned|checked|changed|updated|shared|showed|kept|made|love|loves|loved|hate|hates|miss|missed|visited|called|did|lose|forget|take|bring|finish|sell|buy|park|wash|clean|pack|open|close|lock|check|change|update|share|show|keep|make|visit|call|leave|leaves|need|needs|needed|want|wants|wanted|got|get|put|grab|grabbed|raise|raised|walked|walk|feed|fed|charge|charged|pay|paid|meet|met)\s+(?<w>there)\s+(?=(?:own|new|old|kids|children|parents|car|cars|house|dog|dogs|cat|cats|bags|keys|phones|phone|stuff|things|friends|homework|lunch|money|jobs|job|team|names|best|sprinklers|lights|shoes|coats|jackets|seats|tickets|passports|bikes|toys|books|laptops|room|rooms|bills|rent|taxes|plans|minds|hands|way)\b|(?!(?:hours|days|weeks|months|years|minutes|times|always|sometimes|afterwards|upstairs|downstairs|indoors|outdoors|overseas|towards|perhaps|besides)\b)[a-z]{3,}s\s+(?:on|off|in|at|out|outside|behind|overnight|unattended|everywhere|all\s+night)\b)/gi, "their", "there_their"],
    [/(?:^|[.!?]\s+)(?:Me|Mine|Same|You)\s+(?<w>to)(?=\s*[.!,]|\s*$)/gm, "too", "to_too"],
    [/\b(?:play|join|eat|swim|dance|sing|stay|cook|drink|laugh|cry|sleep|read)\s+(?<w>to)(?=\s*[,.!?]|\s*$)/gi, "too", "to_too"],
    [/\b(?<w>too)\s+(?=(?:hours|days|weeks|months|years|minutes|seconds|times|people|kids|dogs|cats|cars|tickets|cups|slices|pieces|things|options|nights|bedrooms|blocks|miles|dollars|bucks|ways|weekends|games|bottles|glasses|boxes)\b)/gi, "two", "too_two"],
    [/\b(?:more|less|fewer|better|worse|rather|bigger|smaller|faster|slower|cheaper|harder|easier|older|younger|longer|shorter|higher|lower|larger|greater|earlier|later|happier|busier|colder|warmer|hotter)\b(?:\s+(?!then\b)[\p{L}'-]+){0,6}?\s+(?<w>then)\s+(?=(?:last|ever|before|usual|expected|planned|anticipated|necessary|needed|required|anyone|anybody|anything|everyone|everybody|everything|average|normal|twice|double|half|\d|(?:I|we|you|they|he|she)\s+(?:did|do|does|thought|expected|hoped|had|have|has|imagined|planned|needed)\b|(?:the|a|an|my|your|his|her|our|their)\s+[a-z]+\s*[.!?,;]|(?:the|my|your|his|her|our|their)\s+(?:last|previous|other|first|original)\b))/giu, "than", "then_than"],
    [/\b(?:but|and|so|just)\s+(?<w>than)\s+(?=(?:I|you|he|she|it|we|they|the|everything|nothing|suddenly|it['’]s|there|this|that)\b)/gi, "then", "than_then"],
    [/(?<s>\b(?:I|you|we|they|he|she|it|to|will|would|can|could|should|might|may|must|don['’]t|didn['’]t|doesn['’]t|never|not|gonna|if\s+you)\s+|\b(?:the|my|your|his|her|our|their|this|that)\s+[a-z]+\s+)(?<w>loose)\s+(?=(?:the|my|your|his|her|their|our|a|an|it|them|this|that|weight|money|time|track|interest|sleep|hope|control|focus|patience|suction|power|signal|connection|data|everything|anything|all|faith|touch)\b)/gi, (m, g) => (/^(?:he|she|it)\s*$/i.test(g.s) || /^(?:the|my|your|his|her|our|their|this|that)\s/i.test(g.s) ? "loses" : "lose"), "loose_lose"],
    [/\b(?<w>loosing)\b/gi, "losing", "loose_lose"],
    [/\b(?:not|is|was|it['’]s|that['’]s|I['’]m|isn['’]t|wasn['’]t|am|are|aren['’]t|you['’]re|we['’]re|they['’]re|he['’]s|she['’]s)\s+(?<w>quiet)\s+(?=(?:done|sure|ready|right|finished|a|an|the\s+same|the\s+opposite|the\s+case|good|bad|clear|certain|true|similar|different|possible|impossible|often|far|honestly|frankly)\b)/gi, "quite", "quiet_quite"],
    [/\b(?:keep|kept|keeping|stay|stayed)\s+(?:it|them|things|everything|the\s+noise)\s+(?<w>quite)\b(?=\s*[.!?,;]|\s*$|\s+(?:please|now|for|during|tonight|and)\b)/gi, "quiet", "quite_quiet"],
    [/\b(?:I|we|they|you|he|she|I['’]d|I['’]ll|we['’]d|we['’]ll|would|will|strongly|can|could|should|to|please|must|might)\s+(?<w>advice)\s+(?=(?:you|him|her|them|us|me|everyone|anyone|against|that|caution|people|customers|users|all)\b)/gi, "advise", "advice_advise"],
    [/\b(?:take|took|taking|takes|need|needs|needed|have|had|grab|deserve|deserved)\s+(?:a\s+)?(?:quick\s+|short\s+|long\s+|little\s+|well-deserved\s+|\w+-(?:minute|hour|day|week)\s+)?(?<w>brake)\b(?!\s+(?:pads?|fluid|lights?|pedal|lines?|discs?|rotors?|calipers?|shoes?|system)\b)/gi, "break", "brake_break"],
    [/\b(?:lunch|coffee|spring|summer|winter|christmas|commercial|bathroom|\w+-minute|\w+-hour|\w+-day|\w+-week)\s+(?<w>brake)\b(?!\s+(?:pads?|fluid|lights?|pedal|lines?|discs?|rotors?|calipers?|shoes?|system)\b)/gi, "break", "brake_break"],
    [/\b(?<w>break)\s+(?=(?:pads?|fluid|lights?|pedal|lines?|discs?|rotors?|calipers?)\b)/gi, "brake", "break_brake"],
    [/\b(?:a|another|one|this|that|each|every|last|small|big|single|tiny|huge|second|third)\s+(?<w>peace)\s+(?=of\s+(?!mind\b))/gi, "piece", "peace_piece"],
    [/\b(?:feel|feels|felt|feeling|so|too|very|really|still|seems|seemed|looks|looked|getting|got|grew|pretty|kinda|a\s+bit)\s+(?<w>week)(?=\s*[.!?,;]|\s*$|\s+(?:and|after|since|from|ever|today|because|but|lately|now)\b)/gi, "weak", "week_weak"],
    [/\b(?:I|you|we|they|didn['’]t|don['’]t|doesn['’]t|to|let\s+me|you\s+never)\s+(?<w>no)\s+(?=(?:you|you['’]re|that|what|how|why|where|who|him|her|them|this|about|if|whether|anything|everything|it|the\s+answer|better)\b)/gi, "know", "no_know"],
    [/\b(?:there['’]s|there\s+is|there\s+was|is|was|have|had|got|with|of|by|in|at)\s+(?<w>know)\s+(?=(?:way|idea|one|reason|time|problem|need|chance|doubt|longer|more|matter|clue|point|excuse|sign|option|choice)\b)/gi, "no", "know_no"],
    [/\b(?:stop|stopped|stopping|drop|dropped|dropping|swing|swung|walk|walked|walking|drive|drove|driving|pass|passed|passing|stand|stood|standing|fly|flew|flying|come|came|coming)\s+(?<w>buy)\s+(?=(?:your|my|his|her|their|our|the|later|tomorrow|soon|anytime|tonight)\b)/gi, (m) => "by", "buy_by"],
    [/\b(?<w>buy|bye)\s+(?=the\s+way\b)/gi, "by", "buy_by"],
    [/\b(?:I|[Yy]ou|[Hh]e|[Ss]he|[Ww]e|[Tt]hey)\s+(?<w>past)\s+(?=(?:the|my|his|her|their|our|your|a|an|all|every|both|me|him|us|them|away|out)\b)/g, "passed", "past_passed"],
    [/\b(?:drove|drive|driving|walked|walk|walking|went|go|going|ran|run|running|rode|ride|flew|fly|zoomed|sped|rushed|hurried|cycled|biked|jogged|strolled|wandered|moved|move|look|looked|looking|swam|sailed|marched|came|come|slipped|crept|got)\s+(?:right\s+|straight\s+)?(?<w>passed)\s+(?=(?:the|a|an|my|your|his|her|our|their|it|them|me|us|him|this|that|some|each)\b)/gi, "past", "passed_past"],
    [/\b(?:the|our|my|school|assistant|vice|his|her|their|new)\s+(?<w>principle)(?=['’]s\b|\s+(?:called|said|told|asked|is|was|has|announced|wants|sent|of\s+the\s+school)\b)/gi, "principal", "principle_principal"],
    [/\b(?<w>complementary)\s+(?=(?:breakfast|drinks?|coffee|tickets?|upgrade|shuttle|wifi|wi-fi|parking|meal|snacks?|water|champagne|copy|access|consultation|room|bottle)\b)/gi, "complimentary", "complementary"],
    [/\b(?<w>stationery)\s+(?=(?:bike|bicycle|car|vehicle|object|position|state|point|front|target|phase|cycle|engine|wave)\b)/gi, "stationary", "stationary"],
    [/\b(?:new|office|school|wedding|personalized|custom|printed|buy|bought|ordered|order|some|our|my|nice)\s+(?<w>stationary)(?=\s*[.!?,;]|\s*$|\s+(?:with|for|from|and|supplies|store|shop|set|items|order)\b)/gi, "stationery", "stationary"],
    [/\b(?:the|our|my|his|her|their|this|that|a)\s+(?!(?:team|tech|project|sales|design|engineering|product|marketing|squad|group|lead)\b)(?:[a-z]+\s+){0,2}?[a-z]+(?<!s)(?:\s+of\s+\d{4})?\s+(?<!\b(?:that|which|who|to|will|would|can|could|should|may|might|must|did|do|does|not|and|or|they|we|you|I)\s+)(?<w>lead)\s+(?=(?:to|the|us|them|me|him|her|a|an|our|their|his|my)\b)/gi, "led", "lead_led"],
    [/\b(?:have|need|want|get|buy|any)\s+(?<w>anymore)\s+(?=[a-z])/gi, "any more", "anymore"],
    [/\b(?:can|could|may|might)\s+(?:I|we)\s+(?<w>lend)\s+(?=(?:your|his|her|their|the|some)\b)(?!(?:a\s+hand|an\s+ear|my\s+support)\b)/gi, "borrow", "lend_borrow"],
    [/\b(?:a|the|my|our|your|their|his|her|bank|home|student|car|personal)\s+(?<w>lend)(?=\s*[.!?,;]|\s*$|\s+(?:to|from|for|of|and|with|at)\b)/gi, "loan", "lend_loan"],
    [/\b(?<w>thought)\s+(?=(?:me|us|him|her|them|you)\s+(?:how|to\s+(?!be\b)|everything|a\s+lot|so\s+much|English|French|Spanish|math|maths)\b)/g, "taught", "thought_taught"],
    [/\b(?<w>many)\s+(?=(?:time|money|work|information|advice|help|water|coffee|sleep|luck|fun|space|room|patience|experience|traffic|noise|homework|stuff|food|furniture|equipment|software|feedback|research|progress)(?:\s*[.!?,;]|\s+(?:this|that|to|for|left|now|today|yet|anymore|at|in|on|with|and|but|so|because|lately)\b))/gi, "much", "many_much"],
    [/(?<!\b(?:no|more\s+or|much|far|nothing)\s+)\b(?<w>less)\s+(?=(?!(?:stress|fuss|mess|business|success|access|progress|news|loss|series|fitness|glass|gas|status|bus|focus|chaos|thanks|physics|economics|politics|always|sometimes|afterwards|is|was|has|does|this|its|his|us|than)\b)(?![a-z]*(?:ous|us|is|ss|ness|ics)\b)[a-z]{3,}[^s\W]s\b)/gi, "fewer", "less_fewer"],
    [new RegExp(`\\b(?<v>${ACTION_VERBS})(?:\\s+(?:it|this|that|them|him|her|me|us|you|everything|(?:the|a|an|every|each|my|your|his|her|our|their)\\s+[a-z]+|(?-i:[A-Z][a-z]+)))?(?:\\s+(?:really|very|so|pretty|super|quite|extremely))?\\s+(?<w>${Object.keys(ADVERB_OF).join("|")})(?=\\s*[.!?,;:)]|\\s*$|\\s+(?:and|but|for|in|on|at|after|before|when|today|now|so|because|even|this|last|every|all|too|with|again|anymore|though|during|until|since|tonight|yesterday|lately)\\b)`, "gi"), (m, g) => ((m.toLowerCase() === "easy" && /^(?:go|goes|going|went)$/i.test(g.v)) ? null : ADVERB_OF[m.toLowerCase()]), "adjective_adverb"],
    [/(?:^|[.!?]\s+|\n)(?<w>Him|Her|Them)\s+(?=and\s+(?:I|me|my|his|her|their|our|your|the|him|her|them|[A-Z][a-z]+)\b[^.!?]*?\b(?:are|were|have|had|went|will|can|did|do|got|is|was)\b)/gm, (m) => ({ Him: "He", Her: "She", Them: "They" })[m], "object_pronoun_subject"],
    [/(?:^|[.!?]\s+|\n)(?<w>Her|Him|Them|Us)\s+(?=(?:is|was|are|were|has|have|had|will|can|does|did|isn['’]t|wasn['’]t|doesn['’]t|didn['’]t|went|said|told|wants|thinks|knows)\b)/gm, (m) => ({ Him: "He", Her: "She", Them: "They", Us: "We" })[m], "object_pronoun_subject"],
    [/\b(?:[A-Z][a-z]+|him|her|them|you|he|she|they|my\s+[a-z]+|the\s+[a-z]+)\s+and\s+(?<w>myself)\s+(?=(?:will|are|were|have|had|went|can|could|would|should|did|do|need|want|plan|['’]ll|met|decided|agreed)\b)/g, "I", "myself_i"],
    [/\b(?i:asked|told|invited|inviting|gave|sent|called|helped|thanked|showed|took|between|for|with|to|from|about|like|by|against|without|among|join|joined|emailed|texted|brought|met|tell|ask|invite|give|send|call|help|thank|show|take|let|including|asking|telling|giving)\s+(?:[A-Z][a-z]+|him|her|them|us|you|my\s+[a-z]+|the\s+[a-z]+|his\s+[a-z]+)\s+and\s+(?<w>I)\b(?!['’])(?=\s+(?:to|for|at|in|on|a|an|the|some|lunch|dinner|tickets|that|this|about|with|yesterday|today|tomorrow|last|next|after|before|back|home|out|up|over|together|everything|anything|something|it|them)\b|\s*[.!?;)]|\s*$)/g, "me", "i_me"],
    [/\b(?:I|[Ww]e|[Tt]hey|[Hh]e|[Ss]he|[Yy]ou)\s+(?<w>set)\s+(?=(?:by|around|near|next\s+to|beside|outside|inside|together|quietly|on\s+(?:the|my|his|her|a)|in\s+(?:the|my|his|her|a)|at\s+(?:the|my|his|her|a))\b)/g, "sat", "set_sat"],
    [/\b(?:I|[Hh]e|[Ss]he|[Ww]e|[Tt]hey|[Yy]ou)\s+(?<w>laid)\s+(?=down\s+(?:for|on|in|and|to|after|because)\b|down\s*[.!?,]|on\s+(?:the|my|his|her)\s+(?:couch|bed|floor|sofa|grass|beach|ground)\b|in\s+bed\b|awake\b)/g, "lay", "lay_lie"],
    [/\b(?:I|[Hh]e|[Ss]he|[Ww]e|[Tt]hey|[Yy]ou)\s+(?<w>lied)\s+(?=(?:down|in\s+bed|on\s+(?:the|my|his|her)\s+(?:couch|bed|floor|sofa|grass|beach|ground)|awake)\b)/g, "lay", "lay_lie"],
    [/\b(?:am|is|are|was|were|been|I['’]m|you['’]re|he['’]s|she['’]s|we['’]re|they['’]re)\s+(?<w>laying)\s+(?=(?:down(?!\s+(?:the|a|some|new|my|his|her|their)\b)|in\s+bed|on\s+the\s+(?:couch|bed|floor|sofa|grass|beach))\b)/gi, "lying", "lay_lie"],
    [/\b(?:for|up|make|making|made|cook|cooking|cooked|have|having|had|eat|eating|ate|after|before|during|grab|order|ordered|over|and|skip|skipped|start|started|tonight['’]s)\s+(?<w>diner)\b(?!\s+(?:on|in|at|near|down|across|by|downtown|called|named|with|that|which|where)\b)/gi, "dinner", "diner_dinner"],
    [/\b(?:to|could|can|didn['’]t|did|you|I|we)\s+(?<w>here)\s+(?=(?:all\s+about|more\s+about|everything|anything|something|nothing|your|his|her|their|my|our|back\s+from)\b)/gi, "hear", "here_hear"],
    [/\b(?<w>its)\s+(?=(?:used|called|supposed|meant|based|located|designed|built|made|written|scheduled|set)\s+(?:in|to|for|by|as|on|at|from)\b)/gi, "it's", "its_its"],
    [/\b(?:the|small|these|those|some|many|all|its|their|our|your)\s+(?:[a-z]+\s+)?[a-z]+s\s+(?<w>maybe)\s+(?=(?:a|an|the|too|late|delayed|available|required|necessary|possible|closed|harmful|dangerous|toxic|hot|sharp|fragile|different|missing)\b)/gi, "may be", "maybe_may_be"],
    [/(?<![\d.,]|\b(?:a|an|the|per|each|every|this|that|my|his|her|our|their|your)\s+)\b(?:[2-9]|[1-9]\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|ninety|hundred|several|many|few)\s+(?<w>minute|hour|day|week|month|year|second|mile|dollar|euro|pound|kilometer|kilometre|meter|metre|inch|cup|egg|tablespoon|teaspoon|person|time)\b(?![’'-])(?=\s*[.!?,;)]|\s*$|\s+(?:ago|later|before|after|left|of|in|at|on|to|for|from|and|or|until|each|per|every|now|away|late|early|straight|apart|total|so\s+far)\b|\s+(?:long|old)(?=\s*[.!?,;]|\s*$))/gi, (m) => ({ person: "people", inch: "inches" })[m.toLowerCase()] ?? `${m.toLowerCase()}s`, "unit_plural"],
    // Calques du français (« depuis 3 ans », « dépendre de », « expliquer à quelqu'un », « avoir 25 ans »…).
    [/\b(?<w>since)\s+(?=(?:\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|a\s+few|several|many)\s+(?:years|months|weeks|days|hours|minutes|seconds|decades)\b(?!\s+ago))/gi, "for", "since_for"],
    [/\bdepend(?:s|ed|ing)?\s+(?<w>of)\b/gi, "on", "depend_on"],
    [/\bexplain(?:s|ed|ing)?\s+(?<w>me|us|him)\b(?!\s+(?:as|to)\b)/gi, (m) => `to ${m}`, "explain_to"],
    [/\b(?<w>discuss(?:es|ed|ing)?\s+about)\b/gi, (m) => m.replace(/\s+about$/i, ""), "discuss_about"],
    [/\bmarried\s+(?<w>with)\s+(?=(?:[A-Z][a-z]+|a|an|my|his|her|their|the)\b)/g, "to", "married_to"],
    [/\b(?<w>listen(?:s|ed|ing)?)\s+(?=(?:music|the\s+radio|podcasts?|me|him|her|them|us|my|your|his|our|their|this|that)\b)/gi, (m) => `${m} to`, "listen_to"],
    [/\barrive(?:s|d)?\s+(?<w>to)\s+(?=(?:the|my|your|our|his|her|their|work|school|[A-Z][a-z]+)\b)/g, (m, g) => "at", "arrive_at"],
    [/\b(?<w>make|makes|made|making)\s+(?=(?:a|some|the|lots\s+of|many)\s+(?:photo|photos|picture|pictures|selfie|selfies)\b)/gi, (m) => ({ make: "take", makes: "takes", made: "took", making: "taking" })[m.toLowerCase()], "make_photo"],
    [/\b(?<w>say|says|said|saying)\s+(?=(?:me|him|us)\b(?!['’]))/gi, (m) => ({ say: "tell", says: "tells", said: "told", saying: "telling" })[m.toLowerCase()], "say_tell"],
    [/(?:^|[.!?]\s+)(?<w>How)\s+(?=do\s+you\s+call\s+(?:it|this|that|them)\b)/gm, "What", "how_call"],
    [/\b(?<s>I|you|we|they|he|she)\s+(?<w>have|has)\s+(?=(?:\d{1,3}|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[\s-](?:one|two|three|four|five|six|seven|eight|nine))?\s+years(?:\s+old)?\s*(?:[.!?,;]|$|and|but|now|today|tomorrow|next|this|soon))/gi, (m, g) => ({ i: "am", he: "is", she: "is" })[g.s.toLowerCase()] ?? "are", "have_years"],
    // « cake for desert » → dessert ; « Were going » → We're ; « Were is my phone? » → Where ; « Turn of the lights » → off.
    [/\b(?:for|after|no|any|some|dinner\s+and|lunch\s+and)\s+(?<w>desert)(?=\s*[.!?,;]|\s*$|\s+(?:menu|spoon|wine|cart|tray|plate|course|options?|tonight)\b)/gi, "dessert", "desert_dessert"],
    [/(?:^|[.!?]\s+)(?<w>Were)\s+(?=(?:going|gonna|not\s+(?:going|sure|ready|coming|done)|so\s+(?:excited|happy|tired|sorry|proud)|almost|already|still|just|really|about\s+to|on\s+(?:our|the)\s+way|leaving|coming|done|ready)\b)/gm, "We're", "were_were"],
    [/(?:^|[.!?]\s+)(?<w>Were)\s+(?=(?:is|are|was|do|did|does|can|should|would|will|have|has)\s+(?:my|your|the|his|her|our|their|it|you|we|they|he|she|I)\b)/gm, "Where", "were_where"],
    [/\b(?:know|wonder|tell\s+me|guess|idea|sure|remember|that['’]s)\s+(?<w>were)\s+(?=(?:it|he|she|they|you|we|I|the|my|your)\s+(?:is|are|was|went|lives?|keeps?|put|left|parked|stays?|goes)\b)/gi, "where", "were_where"],
    [/(?<!\b(?:the|a|an|this|that|every|each|one)\s+)\b(?:turn|turned|turning|switch|switched|switching|shut|log|logged|logging|kick|kicked)\s+(?<w>of)\s+(?=(?:the|your|my|his|her|all|this|that|it|them|everything)\b)(?!(?:the|this|that)\s+(?:century|tide|screw|events|millennium|decade|phrase|year|season)\b)/gi, "off", "of_off"],
    [/\b(?:Everyone|everyone|Everybody|everybody|Everything|everything|All|all|Anyone|anyone|Nobody|nobody)\s+(?<w>accept)\s+(?=(?:[A-Z][a-z]+|me|him|her|us|them|you|the\s+\w+)\s+(?:[a-z]+ed|came|went|was|were|got|showed|left|had|did|knew|seemed|is|are|has|have)\b)/g, "except", "accept_except"],
];

const REAL_LATE = [
    // Pronom sujet + base : « It seem like », « she never call ».
    [new RegExp(`(?<!\\b(?i:make|makes|made|making|let|lets|letting|help|helps|helped|helping|have|has|had|having|watch|watched|watching|see|saw|seeing|seen|hear|heard|hearing|feel|felt|notice|noticed|bid|does|did|do|doesn['’]t|didn['’]t|don['’]t|will|would|can|could|should|might|must|may|shall|won['’]t|can['’]t|wouldn['’]t|couldn['’]t|shouldn['’]t|to|lest|rather|suggest|suggests|suggested|recommend|recommends|recommended|insist|insists|insisted|demand|demanded|request|requested|require|required|propose|proposed|important|essential|vital|crucial|necessary|imperative)\\s+(?:that\\s+)?)\\b(?:he|she|it|He|She|It)\\s+(?:also\\s+|always\\s+|never\\s+|really\\s+|usually\\s+|often\\s+|still\\s+|just\\s+|sometimes\\s+|only\\s+)?(?<w>${BASE_RE})\\b(?!['’-])`, "g"), (m) => THIRD(m.toLowerCase()), "pronoun_3s"],
    // « Dr. Kim see patients ».
    [new RegExp(`(?:^|[.!?]\\s+|\\n)(?:Dr|Mr|Mrs|Ms|Prof)\\.?\\s+[A-Z][a-z]+\\s+(?<w>${BASE_RE})\\b(?=\\s+[a-z])`, "gm"), (m) => THIRD(m.toLowerCase()), "subject_singular_base"],
    // Groupe nominal singulier (+ complément) en tête de proposition + base : « In the novel, the narrator describe his… ».
    [new RegExp(`${CLAUSE}${SUBJ_DET}\\s+${ADJ_SLOT}(?<n>[a-z]{3,})${PP_SLOT}\\s+(?<w>${BASE_RE})\\b${AFTER_VERB}`, "gim"), (m, g) => (singularHead(g.n) && m === m.toLowerCase() && m !== "like" ? THIRD(m) : null), "subject_singular_base"],
    // Groupe nominal pluriel (+ complément) + 3e personne : « The results of the survey shows a… ».
    [new RegExp(`${CLAUSE}${PLURAL_SUBJ_DET}\\s+${ADJ_SLOT}(?<n>[a-z]{3,})${PP_SLOT}\\s+(?<w>${THIRD_RE})\\b${AFTER_VERB}`, "gim"), (m, g) => (pluralHead(g.n) && m === m.toLowerCase() ? INFLECTED.get(m) : null), "subject_plural_third"],
    // Verbe d'état + attribut : « If the display stay blank ».
    [new RegExp(`${CLAUSE}${SUBJ_DET}\\s+${ADJ_SLOT}(?<n>[a-z]{3,})\\s+(?<w>stay|seem|remain|look|sound|appear|become|feel|get)\\s+(?=(?:blank|empty|open|closed|quiet|calm|good|great|fine|nice|bad|happy|sad|tired|weird|strange|odd|broken|stuck|frozen|dark|black|white|like|so|too|very|really|pretty|a\\s+bit|kind\\s+of|a\\s+little|different|same|normal|busy|full|cold|hot|warm|wet|dry|clean|dirty)\\b)`, "gim"), (m, g) => (singularHead(g.n) && m === m.toLowerCase() ? THIRD(m) : null), "subject_singular_base"],
    // Pluriel + complément + is/was/has : « The keys to the storage unit is ».
    [new RegExp(`${CLAUSE}(?:the|my|your|his|her|our|their|these|those)\\s+${ADJ_SLOT}(?<n>[a-z]{3,})\\s+(?:to|of|in|on|for|from|at|with|near|behind|under|above)\\s+(?:the|my|our|a|an|this|that|your|his|her|their)\\s+(?:${PP_WORD}\\s+){0,2}?${PP_WORD}\\s+(?<w>is|was|has|isn['’]t|wasn['’]t|hasn['’]t)\\b(?!\\s+(?:one|a|an)\\b)`, "gim"), (m, g) => (pluralHead(g.n) ? TO_PLURAL[m.toLowerCase().replace("’", "'")] : null), "accord_groupe"],
    // Relative sans pronom : « The documents you requested has been sent ».
    [new RegExp(`${CLAUSE}(?:the|my|your|his|her|our|their|these|those)\\s+${ADJ_SLOT}(?<n>[a-z]{3,})\\s+(?:you|we|they|I|he|she)\\s+(?:[a-z]+ed|sent|bought|made|gave|got|found|left|brought|wrote|took|told|need|want|ordered)\\s+(?<w>has|is|was)\\b`, "gim"), (m, g) => (pluralHead(g.n) ? TO_PLURAL[m.toLowerCase()] : null), "accord_groupe"],
    // Singulier + complément au pluriel + are/were/have : « Her research on coral reefs have been ».
    [new RegExp(`${CLAUSE}(?:the|my|your|his|her|our|their|this|that|a|an)\\s+${ADJ_SLOT}(?<n>[a-z]{3,})\\s+(?:of|on|in|for|about|from|with|to|at|between|among)\\s+(?:the\\s+|my\\s+|our\\s+|these\\s+|those\\s+|their\\s+|his\\s+|her\\s+|your\\s+|all\\s+|some\\s+|many\\s+|several\\s+)?(?:${PP_WORD}\\s+){0,2}?${PP_WORD}(?<=s)\\s+(?<w>are|were|have|aren['’]t|weren['’]t|haven['’]t)\\b`, "gim"), (m, g) => (singularHead(g.n) ? TO_SINGULAR[m.toLowerCase().replace("’", "'")] : null), "accord_groupe"],
    // Singulier + were/are/have : « My little sister were too scared » (pas après « if » : subjonctif).
    [new RegExp(`${CLAUSE_REAL}(?:the|my|your|his|her|our|their|this|that|a|an)\\s+${ADJ_SLOT}(?<n>[a-z]{3,})\\s+(?<w>were|are|have|weren['’]t|aren['’]t|haven['’]t)\\b`, "gim"), (m, g) => (singularHead(g.n) ? TO_SINGULAR[m.toLowerCase().replace("’", "'")] : null), "accord_groupe"],
    // Pluriel quantifié + was/is/has : « many families was forced ».
    [new RegExp(`(?<!\\b(?:of|in|on|at|for|with|between|among|from|by|to|about|than|like|into|over|under|after|before|during|per|through|across|without)\\s+)\\b(?:many|several|both|few|these|those|two|three|four|five|six|seven|eight|nine|ten|\\d+|all\\s+the|most)\\s+${ADJ_SLOT}(?<n>[a-z]{3,})\\s+(?<w>was|is|has|wasn['’]t|isn['’]t|hasn['’]t)\\b(?!\\s+(?:the|a|an|my|your|his|her|our|their|this|that|it|there|one|he|she|they|we|you|I|been\\s+(?:a|an|one))\\b)`, "gi"), (m, g) => (pluralHead(g.n) && !UNITS.has(g.n.toLowerCase()) ? TO_PLURAL[m.toLowerCase().replace("’", "'")] : null), "accord_groupe"],
    // Do + singulier : « Do your manager know…? » ; Does/Has/Is + pluriel : « Has your parents decided ».
    [new RegExp(`(?:^|[.!?]\\s+|\\b(?:why|how|where|when|what|who|which)\\s+)(?<w>[Dd]o|[Dd]on['’]t)\\s+(?=(?:your|my|his|her|our|their|the|this|that)\\s+${ADJ_SLOT}(?<n>[a-z]{3,})\\s+(?:really\\s+|actually\\s+|even\\s+|still\\s+|ever\\s+|usually\\s+|always\\s+)?(?:${BASE_RE})\\b[^.!?]*\\?)`, "g"), (m, g) => (singularHead(g.n) ? (/n/i.test(m.slice(1)) ? "doesn't" : "does") : null), "do_does"],
    [new RegExp(`(?:^|[.!?]\\s+|\\b(?:why|how|where|when|what|who|which)\\s+)(?<w>[Dd]oes|[Hh]as|[Ii]s|[Ww]as|[Dd]oesn['’]t|[Hh]asn['’]t|[Ii]sn['’]t|[Ww]asn['’]t)\\s+(?=(?:the|your|my|his|her|our|their|these|those)\\s+${ADJ_SLOT}(?<n>[a-z]{3,})\\s+(?:(?:always|still|ever|really|already|even|usually|never|actually|all)\\s+[a-z]+|[a-z]+ing|[a-z]+ed|been|done|gone|seen|ready|here|there|okay|ok|good|bad|right|wrong|safe|open|closed|available|broken|asleep|awake|home|back|still|not|in|on|out|\\?)\\b)`, "g"), (m, g) => (pluralHead(g.n) ? { does: "do", has: "have", is: "are", was: "were", "doesn't": "don't", "hasn't": "haven't", "isn't": "aren't", "wasn't": "weren't" }[m.toLowerCase().replace("’", "'")] : null), "does_do"],
    // Singulier + don't : « The vending machine on the second floor don't take cards ».
    [new RegExp(`${CLAUSE}(?:the|my|your|his|her|our|their|this|that|a|an)\\s+${ADJ_SLOT}(?:[a-z]+\\s+)?(?<n>[a-z]{3,})${PP_SLOT}\\s+(?<w>don['’]t|do\\s+not)\\b`, "gim"), (m, g) => (singularHead(g.n) ? (/not/i.test(m) ? "does not" : "doesn't") : null), "doesnt"],
    [/(?<c>`[^`\n]+`)\s+(?<w>don['’]t|do\s+not)\b/g, (m) => (/not/i.test(m) ? "does not" : "doesn't"), "doesnt"],
    // Relative : « The guy who live upstairs », « a tool that help us », « Anyone who need access ».
    [new RegExp(`\\b(?:a|an|the|my|your|his|her|our|their|this|that|every|each|any)\\s+${ADJ_SLOT}(?<n>[a-z]{3,})\\s+who\\s+(?:really\\s+|always\\s+|never\\s+|still\\s+|just\\s+|usually\\s+|actually\\s+|also\\s+|only\\s+|often\\s+)?(?<w>${BASE_RE})\\b(?=\\s+[a-z]|\\s*[.!?,])`, "gi"), (m, g) => (singularHead(g.n, true) ? THIRD(m.toLowerCase()) : null), "relative_3s"],
    [new RegExp(`\\b(?:a|an|the|my|your|his|her|our|their|this|that|every|each|any)\\s+${ADJ_SLOT}(?<n>[a-z]{3,})\\s+(?:that|which)\\s+(?:really\\s+|always\\s+|never\\s+|still\\s+|just\\s+|usually\\s+|actually\\s+|also\\s+|only\\s+|often\\s+)?(?<w>${BASE_RE})\\b(?=\\s+(?:${OBJECT_START})\\b)`, "gi"), (m, g) => (singularHead(g.n, true) ? THIRD(m.toLowerCase()) : null), "relative_3s"],
    [new RegExp(`\\b(?:anyone|everyone|someone|anybody|everybody|somebody|nobody|no\\s+one)\\s+(?:who|that)\\s+(?<w>${BASE_RE})\\b(?=\\s+[a-z]|\\s*[.!?,])`, "gi"), (m) => THIRD(m.toLowerCase()), "relative_3s"],
    // Indéfinis + complément : « Everyone in my family love », « Every room in the hotel have ».
    [new RegExp(`(?<!\\b(?:make|makes|made|making|let|lets|letting|help|helps|helping|have|has|had|having|watch|watching|see|saw|seeing|hear|heard|does|did|do|will|would|can|could|should|might|must|may|for|to|with|from|about|of|by|than|like)\\s+)\\b(?:everyone|everybody|someone|somebody|anyone|anybody|nobody|no\\s+one|everything|nothing|something|each\\s+[a-z]+|every\\s+(?!(?:day|time|week|month|year|morning|night|evening|weekend|minute|hour|second|other|now|so)\\b)[a-z]+)\\s+(?:in|on|at|from|of|with)\\s+(?:the|my|our|your|his|her|their|this|that)\\s+(?:[a-z-]+\\s+)?[a-z-]+\\s+(?<w>${BASE_RE})\\b(?=\\s+[a-z])`, "gi"), (m) => THIRD(m.toLowerCase()), "indefinite_3s"],
    [new RegExp(`(?<!\\b(?:does|did|do|will|would|can|could|should|might|must|may|has|have|had|if|for|to|with|from|about|of|by|than|like|let|make|made|help|watch|see|saw|hear|heard)\\s+)\\b(?:everyone|everybody|someone|somebody|anyone|anybody|nobody|no\\s+one|everything|nothing|something)(?:\\s+(?:in|on|at|from|of|with)\\s+(?:the|my|our|your|his|her|their|this|that)\\s+(?:[a-z-]+\\s+)?[a-z-]+)?\\s+(?<w>were|are|have|don['’]t|weren['’]t|aren['’]t|haven['’]t)\\b`, "gi"), (m) => TO_SINGULAR[m.toLowerCase().replace("’", "'")], "indefinite_3s"],
    [new RegExp(`\\b(?:[Nn]either|[Ee]ither)\\s+(?<n>[a-z]{3,})\\s+(?<w>${BASE_RE})\\b`, "g"), (m, g) => (singularHead(g.n) ? THIRD(m.toLowerCase()) : null), "indefinite_3s"],
    [/\b(?:[Nn]either|[Ee]ither)\s+(?:the\s+|my\s+|your\s+|his\s+|her\s+|our\s+|their\s+)?[a-z]+\s+(?:nor|or)\s+(?:the|my|your|his|her|our|their|a|an)\s+(?<n>[a-z]{3,})\s+(?<w>were|are|have)\b/g, (m, g) => (singularHead(g.n) ? TO_SINGULAR[m] : null), "accord_groupe"],
    [new RegExp(`\\b[Oo]ne\\s+of\\s+(?:the|my|your|our|their|his|her|these|those)\\s+(?:[a-z-]+\\s+){0,2}?[a-z]+s\\s+(?<w>${BASE_RE})\\b(?=\\s+[a-z]|\\s*[.!?,])`, "g"), (m) => THIRD(m.toLowerCase()), "one_of_agreement"],
    [/\b[Aa]\s+(?:large\s+|small\s+|growing\s+|huge\s+|certain\s+|record\s+)?number\s+of\s+(?:[a-z-]+\s+){0,2}?[a-z]+s\s+(?<w>has|is|was|hasn['’]t|isn['’]t|wasn['’]t)\b/g, (m) => TO_PLURAL[m.replace("’", "'")], "head_of_agreement"],
    [/\b[Tt]here\s+(?<w>is|was)\s+(?=(?:still|only|also|now|already|just|currently|usually|always|probably|at\s+least)\s+(?:many|several|two|three|four|five|six|seven|eight|nine|ten|\d+|some|a\s+few|lots\s+of|plenty\s+of|dozens\s+of|hundreds\s+of|numerous|multiple)\s+[a-z]+s\b)/g, (m) => (m === "was" ? "were" : "are"), "there_are"],
    // Sujets coordonnés : « My brother and his wife lives ».
    [new RegExp(`(?:^|[.!?]\\s+|\\n)(?:(?:My|The|Our|His|Her|Your|Their)\\s+[a-z]+\\s+and\\s+(?:(?:my|his|her|their|our|your|the)\\s+[a-z]+|[A-Z][a-z]+|I|he|she)|[A-Z][a-z]+\\s+and\\s+(?:(?:my|his|her|their|our|your|the)\\s+[a-z]+|I|he|she))\\s+(?<w>${THIRD_RE}|is|was|has|doesn['’]t|isn['’]t|wasn['’]t|hasn['’]t)\\b`, "gm"), (m) => TO_PLURAL[m.replace("’", "'")] ?? INFLECTED.get(m), "sujet_compose"],
    // Temps.
    [new RegExp(`\\b(?:I|you|we|they|he|she|it)\\s+(?<w>(?:have|has)\\s+(?:already\\s+|just\\s+|finally\\s+)?(?<pp>(?!(?:need|seed|feed|speed|bleed|breed|weed|deed|shed|embed|proceed|succeed|exceed)\\b)[a-z]{2,}ed|${IRREG_PP_RE}))\\b(?=(?![^.!?;\\n]*\\b(?:since|for|so\\s+far|ever|never|yet|recently|lately|before|in\\s+the\\s+(?:last|past))\\b)(?<tail>[^.!?;\\n]*)\\b${PAST_MARKER}\\b)`, "gi"), (m, g) => {
        // « worked here snice last year » : un « since » mal tapé, ce n'est pas une date passée.
        if ((g.tail ?? "").split(/\s+/).some((w) => /^s[a-z]{3,5}$/i.test(w) && [...w.toLowerCase()].every((c) => "sinec".includes(c)))) {
            return null;
        }
        return PP_TO_PAST[g.pp.toLowerCase()] ?? (/ed$/i.test(g.pp) ? g.pp.toLowerCase() : null);
    }, "perfect_past_marker"],
    [new RegExp(`(?<!\\bsince\\s+)\\b[Ww]hen\\s+(?<w>(?:have|has)\\s+(?<s>you|he|she|they|we|I|it|(?:your|the|my|his|her|our|their)\\s+[a-z]+)\\s+(?<pp>[a-z]{2,}ed|${IRREG_PP_RE}))\\b`, "g"), (m, g) => {
        const base = baseOfParticiple(g.pp.toLowerCase());
        return base ? `did ${g.s} ${base}` : null;
    }, "perfect_past_marker"],
    [/\b[Hh]ow\s+long\s+(?<w>(?:do|does)\s+(?<s>you|we|they|I|he|she|it|your\s+[a-z]+|the\s+[a-z]+)\s+(?<v>know|own|live))\b/g, (m, g) => `${/^does/i.test(m) ? "has" : "have"} ${g.s} ${SINCE_PP[g.v] ?? `${g.v}ed`}`, "present_since"],
    [new RegExp(`\\b(?<s>I|you|we|they|he|she|it)\\s+(?<w>am|are|is)\\s+(?=(?:[a-z-]+\\s+){0,3}?(?:for\\s+(?:\\d+|two|three|four|five|six|seven|eight|nine|ten|a\\s+few|several|many)\\s+(?:years|months|weeks|days|hours)\\s+(?:now|already)|since\\s+${SINCE_TIME})\\b)`, "gi"), (m) => (m.toLowerCase() === "is" ? "has been" : "have been"), "present_since"],
    [new RegExp(`\\b(?<s>I|you|we|they|he|she)\\s+(?<w>have|has)\\s+(?=(?:the|a|an|my|our|your|his|her|their|this|that)\\s+(?:[a-z-]+\\s+){0,3}?since\\s+${SINCE_TIME}\\b)`, "gi"), (m) => `${m.toLowerCase()} had`, "present_since"],
    // « I'm here since Monday » → I've been.
    [new RegExp(`\\b(?<w>I['’]m|you['’]re|we['’]re|they['’]re|he['’]s|she['’]s)\\s+(?!(?:been|got|gotten|had|known|done|gone|seen)\\b|(?!(?:married|divorced|engaged|retired|closed|unemployed|separated|single)\\b)[a-z]+ed\\b)(?=(?:[a-z-]+\\s+){0,3}?since\\s+${SINCE_TIME}\\b)`, "gi"), (m) => {
        const lower = m.toLowerCase().replace("’", "'");
        return { "i'm": "I've been", "you're": "you've been", "we're": "we've been", "they're": "they've been", "he's": "he's been", "she's": "she's been" }[lower];
    }, "present_since"],
    [new RegExp(`(?<!\\b(?:ask|asked|asking|wonder|wondering|sure|certain|idea|unclear|clear|decide|decided|confirm|check|see|say|said|predict|tell\\s+(?:me|us|you|him|her|them)|(?<!let\\s+(?:me|us)\\s+)know|knows|knew)\\s+)(?:\\b(?:when|as\\s+soon\\s+as|once|after|until|till|whenever)|(?:^|[.!?]\\s+)Before)\\s+(?<s>(?:the|my|your|his|her|our|their|this|that)\\s+${ADJ_SLOT}(?<n>[a-z]+)|I|you|we|they|he|she|it)\\s+(?<w>will\\s+(?<v>[a-z]+))\\b`, "gi"), (m, g) => {
        const v = g.v.toLowerCase();
        if (/ly$/.test(v) || ["not", "never", "also", "still", "just", "have", "probably", "really"].includes(v)) {
            return null;
        }
        const s = g.s.toLowerCase();
        const third = /^(?:he|she|it)$/.test(s) || (g.n && singularHead(g.n.toLowerCase()));
        if (v === "be") {
            return s === "i" ? "am" : third ? "is" : "are";
        }
        return third ? THIRD(v) : v;
    }, "will_after_when"],
    [/\b[Ii]f\s+(?:I|he|she|it)\s+(?<w>was)\s+(?=(?:you|him|her|me|them|in\s+your\s+(?:shoes|place|position))\b)/g, "were", "if_i_were"],
    [new RegExp(`(?:\\b[Ii]f\\s+[^,.!?]{1,60}?\\bhad\\s+(?:not\\s+|never\\s+|already\\s+)?[a-z]+(?:ed|en|wn|ne|t)\\b|(?:^|[.!?]\\s+)Had\\s+[^,.!?]{1,60}?)[^.!?]*?\\b(?:would|could|might)\\s+(?:not\\s+)?(?<w>[a-z]+)\\b(?=(?:\\s+[\\w'-]+){0,4}?\\s+${PAST_MARKER}\\b)`, "gm"), (m) => {
        const v = m.toLowerCase();
        return /ly$/.test(v) || ["have", "never", "not", "still", "also", "just", "even", "ever"].includes(v) ? null : `have ${v === "be" ? "been" : PP_OF(v)}`;
    }, "third_conditional"],
    [/(?:\b[Ii]f\s+[^,.!?]{1,60}?\bhad\s+[^,.!?]{1,40}?|(?:^|[.!?]\s+)Had\s+[^,.!?]{1,60}?),\s*[^.!?]{0,40}?\b(?<w>will)\s+(?:not\s+)?have\s+[a-z]+(?:ed|en|wn|ne|t)\b/gm, "would", "third_conditional"],
    [new RegExp(`(?:^|[.!?]\\s+|\\n)(?:Yesterday|Last\\s+(?:night|week|month|year|weekend|summer|winter|spring|fall|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)|Two\\s+days\\s+ago|A\\s+week\\s+ago)\\s*,?\\s+(?:I|we|they|you|he|she|my\\s+[a-z]+|our\\s+[a-z]+|the\\s+[a-z]+)\\s+(?<w>${BASE_RE}|${THIRD_RE})\\b(?!\\s+(?:been|had|to|got|gotten|[a-z]+ed)\\b)`, "gm"), (m) => {
        const base = BASE_VERBS.has(m.toLowerCase()) ? m.toLowerCase() : INFLECTED.get(m.toLowerCase());
        return base ? pastOf(base) : null;
    }, "past_marker_present"],
    [new RegExp(`\\b(?:I|you|we|they|he|she|it)\\s+(?<w>(?:am|is|are|was|were)\\s+(?<v>${Object.keys(STATIVE_ING).join("|")}))\\b`, "gi"), (m, g) => {
        const base = STATIVE_ING[g.v.toLowerCase()];
        const aux = m.split(/\s+/)[0].toLowerCase();
        return /^(?:was|were)$/.test(aux) ? pastOf(base) : aux === "is" ? THIRD(base) : base;
    }, "stative_progressive"],
    [new RegExp(`\\b(?:[Rr]ight\\s+now|[Aa]t\\s+the\\s+moment)\\s*,?\\s+(?<s>I|you|we|they|he|she|it)\\s+(?<w>${BASE_RE}|${THIRD_RE})\\b`, "g"), (m, g) => {
        const lower = m.toLowerCase();
        const third = /^(?:he|she|it)$/i.test(g.s);
        const base = third ? (INFLECTED.get(lower) && THIRD(INFLECTED.get(lower)) === lower ? INFLECTED.get(lower) : null) : (BASE_VERBS.has(lower) ? lower : null);
        if (!base || STATIVE.has(base)) {
            return null;
        }
        return `${g.s === "I" ? "am" : third ? "is" : "are"} ${ingOf(base)}`;
    }, "right_now_progressive"],
    // Modal + pronom + forme fléchie : « Could you sent us » ; modal + 3e personne : « will flashes ».
    [new RegExp(`\\b(?:can|could|will|would|should|shall|may|might|must)\\s+(?:I|you|we|they|he|she|it)\\s+(?:not\\s+|please\\s+|just\\s+|really\\s+)?(?<w>${INFLECTED_RE})\\b(?=\\s+${OBJECT_START}\\b|\\s*[.!?,])`, "gi"), (m) => INFLECTED.get(m.toLowerCase()), "base_after_modal"],
    [new RegExp(`(?<!\\b(?i:the|a|an|his|her|their|my|your|our|its|this|that|last|in|of|since|until|by|from|early|late|mid|next|free|good|ill|own)\\s+)\\b(?:will|would|can|could|should|must|might|may|shall|won['’]t|can['’]t|cannot|couldn['’]t|shouldn['’]t|wouldn['’]t|doesn['’]t|didn['’]t|don['’]t)\\s+(?:not\\s+|never\\s+|really\\s+|always\\s+|just\\s+|still\\s+|also\\s+)?(?!needs\\b)(?<w>${INFLECTED_RE})\\b(?=\\s+[a-z])`, "g"), (m) => INFLECTED.get(m.toLowerCase()), "base_after_modal"],
    [new RegExp(`\\b(?:${INFINITIVE_TAKERS})\\s+to\\s+(?<w>${INFLECTED_RE})\\b(?=\\s+(?:closer|away|back|home|here|there|forward|abroad|out|in|up|down|on|off|again|together|soon|now|faster|quickly|early|late|first)\\b|\\s*[.!?,])`, "gi"), (m) => INFLECTED.get(m.toLowerCase()), "base_after_to"],
    [new RegExp(`\\b(?:I['’]m|I\\s+am|you['’]re|we['’]re|they['’]re|he['’]s|she['’]s|(?:I|you|we|they|he|she)\\s+(?:am|is|are|was|were|get|got|getting))\\s+(?:so\\s+|really\\s+|not\\s+|very\\s+|completely\\s+|totally\\s+|already\\s+|still\\s+)?used\\s+to\\s+(?<w>${[...BASE_VERBS].join("|")})\\b`, "gi"), (m) => ingOf(m.toLowerCase()), "used_to_ing"],
    [/\b(?:avoid|avoids|avoided|avoiding|enjoy|enjoys|enjoyed|enjoying|finish|finishes|finished|(?:(?:would|do|does|did)\s+(?:you|he|she|they)|don['’]t|doesn['’]t|wouldn['’]t)\s+mind)\s+(?<w>to\s+(?!(?:the|a|an|my|your|his|her|our|their|this|that|these|those|it|them|me|him|us|you|everyone|anyone|some|all|any|every|each|no|one|be)\b)[a-z]+)\b/gi, (m) => ingOf(m.split(/\s+/)[1].toLowerCase()), "verb_ing"],
    [new RegExp(`\\b(?:consider|considering|suggest|suggests|recommend|recommends)\\s+(?<w>to\\s+(?:${[...BASE_VERBS].filter((v) => v !== "be").join("|")}))\\b`, "gi"), (m) => ingOf(m.split(/\s+/)[1].toLowerCase()), "verb_ing"],
    [new RegExp(`\\b(?:[Pp]lease|[Kk]indly)\\s+(?<w>${THIRD_RE})\\b`, "g"), (m) => INFLECTED.get(m.toLowerCase()), "please_base"],
    [/\b(?:have|has|had|['’]ve|haven['’]t|hasn['’]t|hadn['’]t)\s+(?:(?:I|you|we|they|he|she|it|anyone|anybody|everyone|someone|somebody|nobody|(?:the|your|my|his|her|our|their)\s+[a-z]+)\s+)?(?:ever\s+|never\s+|already\s+|just\s+|not\s+|finally\s+|recently\s+|also\s+)?(?<w>saw|did|went|came|ate|drank|wrote|took|gave|spoke|broke|chose|forgot|knew|threw|drove|rode|stole|wore|flew|grew|hid|shook|ran|began|swam|sang|rang|fell|became|woke|blew|drew|froze)\b/gi, (m) => PAST_TO_PP[m.toLowerCase()], "perfect_pp"],
    [new RegExp(`(?<!\\b(?i:have|has|had|having|'ve|’ve|'s|’s|'d|’d|be|been|being|is|are|was|were|get|got|gets|getting|am|'m|’m|'re|’re)\\s+)(?:\\b(?:I|he|she|we|they|[Ww]ho)|(?:^|[.!?]\\s+)(?:It|You))\\s+(?<w>${Object.keys(PP_AS_PAST).join("|")})\\b(?![’'-])(?!\\s+by\\b)`, "gm"), (m) => PP_AS_PAST[m.toLowerCase()], "pp_as_past"],
];
Object.assign(MESSAGES, {
    theirs_there: "« their's » n'existe pas : c'est « there's » (= there is).",
    reflexive: "Forme du réfléchi : himself, themselves, ourselves, yourselves.",
    contraction: "Il manque l'apostrophe de la contraction.",
    defiantly: "« defiantly » = avec défi ; pour « sans aucun doute », c'est « definitely ».",
    a_an_sigle: "Devant un sigle, l'article suit la prononciation de la première lettre : an SUV (« ess »), a URL (« you »).",
    your_youre: "« your » est un possessif ; ici, il faut « you're » (= you are).",
    there_their: "« there » indique un lieu ; devant un nom, le possessif est « their ».",
    to_too: "« to » est une préposition ; pour « aussi » ou « trop », c'est « too ».",
    too_two: "« too » = trop, aussi ; le nombre, c'est « two ».",
    then_than: "« then » marque la suite dans le temps ; pour comparer, c'est « than ».",
    than_then: "« than » sert à comparer ; pour « ensuite », c'est « then ».",
    loose_lose: "« loose » veut dire « lâche, desserré » ; le verbe « perdre », c'est « lose ».",
    quiet_quite: "« quiet » = calme ; pour « tout à fait, assez », c'est « quite ».",
    quite_quiet: "« quite » = assez ; pour « calme, silencieux », c'est « quiet ».",
    advice_advise: "« advice » est le nom (un conseil) ; le verbe (conseiller), c'est « advise ».",
    brake_break: "« brake » = le frein ; une pause, c'est « a break ».",
    break_brake: "« break » = casser, une pause ; le frein, c'est « brake ».",
    peace_piece: "« peace » = la paix ; un morceau, c'est « a piece ».",
    week_weak: "« week » = la semaine ; pour « faible », c'est « weak ».",
    no_know: "« no » = non ; le verbe savoir, c'est « know ».",
    know_no: "« know » = savoir ; pour « aucun, pas de », c'est « no ».",
    buy_by: "« buy » = acheter ; la préposition (chez, par, près de), c'est « by ».",
    past_passed: "« past » n'est pas un verbe : le prétérit de « pass » est « passed ».",
    passed_past: "Après un verbe de mouvement, « devant, au-delà » se dit « past ».",
    principle_principal: "« principle » = un principe ; le directeur d'école, c'est « principal ».",
    complementary: "Offert, gratuit : « complimentary » (« complementary » = complémentaire).",
    stationary: "« stationary » = immobile ; « stationery » = la papeterie.",
    lead_led: "Le prétérit de « lead » est « led ».",
    anymore: "Devant un nom, on écrit « any more » (any more paper) ; « anymore » = plus maintenant.",
    lend_borrow: "On emprunte avec « borrow » (can I borrow your car) ; « lend » = prêter.",
    lend_loan: "Le nom (un prêt), c'est « a loan ».",
    thought_taught: "Le prétérit de « teach » (enseigner) est « taught » ; « thought » vient de « think ».",
    many_much: "Devant un nom indénombrable, c'est « much » (much time).",
    less_fewer: "Devant un nom pluriel dénombrable, on écrit « fewer » (fewer complaints).",
    adjective_adverb: "Pour dire comment on fait l'action, il faut l'adverbe (carefully, well, badly).",
    object_pronoun_subject: "Sujet du verbe : le pronom sujet (he, she, they, we).",
    myself_i: "Sujet du verbe : « I », pas « myself » (John and I will…).",
    i_me: "Complément du verbe ou de la préposition : « me » (asked Sam and me, between you and me).",
    set_sat: "Le prétérit de « sit » (s'asseoir) est « sat » ; « set » = poser.",
    lay_lie: "« lie » (s'allonger) : lie, lay, lain, lying ; « lay » (poser) : lay, laid ; « lie » (mentir) : lied.",
    diner_dinner: "Le repas du soir, c'est « dinner » ; un « diner » est un petit restaurant.",
    here_hear: "« here » = ici ; le verbe entendre, c'est « hear ».",
    maybe_may_be: "« maybe » = peut-être (adverbe) ; le verbe, c'est « may be ».",
    unit_plural: "Après un nombre, l'unité se met au pluriel (25 minutes).",
    accept_except: "« accept » = accepter ; pour « sauf », c'est « except ».",
    desert_dessert: "« desert » = le désert ; le dessert, c'est « dessert » (deux s).",
    since_for: "Pour une durée, c'est « for » (for three years) ; « since » se met devant une date (since 2020).",
    depend_on: "En anglais, on dit « depend on » (dépendre de).",
    explain_to: "On explique quelque chose « to » quelqu'un : « explain to me ».",
    discuss_about: "« discuss » s'emploie sans « about » : « discuss the plan ».",
    married_to: "Marié à quelqu'un : « married to ».",
    listen_to: "« listen » se construit avec « to » : « listen to music ».",
    arrive_at: "On arrive « at » un lieu (« in » une ville) ; « arrive to » ne se dit pas.",
    make_photo: "Prendre une photo : « take a photo ».",
    say_tell: "Dire à quelqu'un : « tell me » (« say » ne prend pas de complément de personne).",
    how_call: "Comment ça s'appelle : « What do you call it? ».",
    have_years: "L'âge se dit avec « be » : « I am 25 (years old) ».",
    were_were: "« were » est le verbe être au passé ; ici, il faut « we're » (= we are).",
    were_where: "« were » est le verbe être ; pour « où », c'est « where ».",
    of_off: "« turn off », « switch off » : la particule est « off » (éteindre).",
    pronoun_3s: "Avec he, she ou it, le verbe prend un -s au présent (it seems).",
    subject_singular_base: "Le sujet est singulier : le verbe prend un -s au présent.",
    subject_plural_third: "Le sujet est pluriel : pas de -s au verbe.",
    accord_groupe: "Le verbe s'accorde avec le nom principal du sujet.",
    do_does: "Avec un sujet singulier, la question se fait avec « does ».",
    does_do: "Avec un sujet pluriel, c'est « do / have / are / were ».",
    doesnt: "Avec un sujet singulier, la négation est « doesn't ».",
    relative_3s: "Le verbe de la relative s'accorde avec le nom repris par « who / that » (the guy who lives).",
    indefinite_3s: "Everyone, nobody, each…, neither… : le verbe se met au singulier.",
    one_of_agreement: "Le sujet est « one » (un seul) : le verbe se met au singulier.",
    head_of_agreement: "« A number of » + pluriel = plusieurs : le verbe se met au pluriel.",
    there_are: "Avec un nom pluriel après, c'est « there are » / « there were ».",
    sujet_compose: "Deux sujets reliés par « and » : le verbe se met au pluriel.",
    perfect_past_marker: "Avec un moment passé précis (yesterday, last June, ago), on emploie le prétérit, pas le present perfect.",
    present_since: "Avec « since » ou « for … now », l'action dure encore : present perfect (have been, have known).",
    will_after_when: "Après when, as soon as, before, until…, le futur se dit au présent (when it lands).",
    if_i_were: "Dans une hypothèse, on écrit « If I were you ».",
    third_conditional: "Hypothèse passée (if … had + participe) : la conséquence est « would have + participe ».",
    past_marker_present: "Avec un marqueur du passé (yesterday, last week), le verbe se met au prétérit.",
    stative_progressive: "Ce verbe d'état ne s'emploie pas à la forme en -ing (I knew, not I was knowing).",
    right_now_progressive: "Pour une action en cours (right now), on emploie la forme en -ing (he is working).",
    base_after_modal: "Après un modal (can, could, will…), le verbe reste à la base verbale.",
    base_after_to: "Après « to », le verbe reste à la base verbale.",
    used_to_ing: "« be used to » (être habitué à) se construit avec la forme en -ing.",
    verb_ing: "Ce verbe se construit avec la forme en -ing (avoid using, enjoy gardening).",
    please_base: "Après « please », l'impératif : la base verbale, sans -s.",
    perfect_pp: "Après have, has ou had, il faut le participe passé (have seen), pas le prétérit.",
    pp_as_past: "Sans auxiliaire, il faut le prétérit (it began), pas le participe passé.",
    irregular_past: "Verbe irrégulier : forme correcte du prétérit ou du participe.",
    look_forward_to: "Après « look forward to », la forme en -ing (look forward to seeing you).",
    possessive_s: "Possessif : il manque l'apostrophe (my mom's birthday).",
    im_contraction: "« I'm » prend une majuscule et une apostrophe.",
    orthographe_courante: "Faute d'orthographe courante.",
});

function campaignPatterns(text) {
    const out = [];
    for (const [re, fix, rule, kind = "grammaire"] of [...REAL_EARLY, ...PATTERNS, ...BIG_PATTERNS, ...REAL_LATE]) {
        if (!rule) {
            continue;
        }
        const pattern = new RegExp(re.source, re.flags.includes("d") ? re.flags : `${re.flags}d`);
        for (const m of text.matchAll(pattern)) {
            const span = m.indices?.groups?.w;
            if (!span) {
                continue;
            }
            const original = text.slice(span[0], span[1]);
            const value = typeof fix === "function" ? fix(original, m.groups ?? {}) : fix;
            if (!value || value === original) {
                continue;
            }
            out.push({
                start: span[0],
                end: span[1],
                kind: kind === "orthographe" ? "orthographe" : "grammaire",
                detail: "aria",
                message: MESSAGES[rule] ?? "Forme attendue ici.",
                // « I » est toujours en majuscule : « Sam and I » → « me », pas « Me ».
                suggestions: [original === "I" ? value : keepCase(original, value)],
                rule: `aria_en_${rule}`,
            });
        }
    }
    return out;
}

function moreRules(text, tokens, i, push) {
    const token = tokens[i];
    const prev = tokens[i - 1];
    const next = tokens[i + 1];
    const isPrev = adjacent(text, prev, token);
    const isNext = adjacent(text, token, next);
    const lower = token.lower;
    // 1. « had already went » → gone.
    if (IRREGULAR_PP[lower]) {
        let k = i - 1;
        while (k >= 0 && k > i - 3 && PERFECT_ADVERBS.has(tokens[k].lower) && adjacent(text, tokens[k], tokens[k + 1])) {
            k--;
        }
        if (k >= 0 && k < i && PERFECT_AUX.has(tokens[k].lower) && adjacent(text, tokens[k], tokens[k + 1])
            && !(["he's", "she's", "it's"].includes(tokens[k].lower) && !["went", "came", "became"].includes(lower))) {
            push(token, token.end, IRREGULAR_PP[lower], MESSAGES.participle, "participe_passe");
            return;
        }
    }
    // 2. Pronom sujet + être / avoir : « You is », « We was », « I has », « he have ».
    const table = BE_HAVE[prev?.lower];
    if (table && isPrev && table[lower] && !(prev.lower === "it" && false)) {
        const before = tokens[i - 2];
        const objectUse = before && adjacent(text, before, prev) && (BEFORE_OBJECT.has(before.lower) || PREPOSITIONS.has(before.lower) || (prev.text === "I" && /^[A-Z]/.test(before.text)));
        const subjunctive = ["were", "weren't"].includes(lower) && tokens.slice(Math.max(0, i - 6), i - 1).some((t) => ["if", "wish", "wished", "wishes", "though", "as"].includes(t.lower));
        const question = /\?/.test(text.slice(token.end, (text.slice(token.end).search(/[.!?]/) + 1 || text.length - token.end) + token.end));
        if (!objectUse && !subjunctive && !(question && i >= 2 && !clauseStartAt(text, tokens, i - 1))) {
            push(token, token.end, table[lower], `${MESSAGES.agreement} (${prev.lower} ${table[lower]}).`, "accord_pronom");
            return;
        }
    }
    // 3. « One of the disks are » → is.
    if (TO_SINGULAR[lower] && i >= 3) {
        let k = i - 1;
        while (k > 0 && k > i - 5 && tokens[k].lower !== "of") {
            k--;
        }
        if (tokens[k]?.lower === "of" && ["one", "each"].includes(tokens[k - 1]?.lower) && isPluralNoun(tokens[i - 1]) && clauseStartAt(text, tokens, k - 1)) {
            push(token, token.end, TO_SINGULAR[lower], MESSAGES.oneOf, "one_of");
            return;
        }
    }
    // 4. Groupe nominal + être / avoir : « The children was », « My friends is », « The new intern have ».
    if ((TO_PLURAL[lower] || TO_SINGULAR[lower]) && isPrev && i >= 2) {
        const head = prev;
        let det = i - 2;
        if (tokens[det] && !ANY_DETS.has(tokens[det].lower) && !SINGULAR_DETS.has(tokens[det].lower) && /^[a-z]+$/.test(tokens[det].lower) && det > 0) {
            det--;  // un adjectif : « the new intern »
        }
        const detToken = tokens[det];
        const startsClause = detToken && clauseStartAt(text, tokens, det) && !PREPOSITIONS.has(tokens[det - 1]?.lower) && !["and", "or", "nor"].includes(tokens[det - 1]?.lower)
            && !/,\s*$/.test(text.slice(0, detToken.start)) && tokens.slice(det, i).every((t, k, list) => k === 0 || adjacent(text, list[k - 1], t));
        const adjectiveSlot = det === i - 3 ? tokens[i - 2] : null;
        const subjunctive = ["were", "weren't"].includes(lower) && tokens.slice(Math.max(0, i - 7), i).some((t) => ["if", "wish", "wished", "wishes", "though"].includes(t.lower));
        if (detToken && startsClause && !subjunctive && !(adjectiveSlot && /^[A-Z]/.test(adjectiveSlot.text))) {
            // « Ten dollars is too much », « Two weeks is enough » : une quantité, pas un pluriel.
            if (TO_PLURAL[lower] && (ANY_DETS.has(detToken.lower) || PLURAL_DETS.has(detToken.lower)) && isPluralNoun(head) && !COLLECTIVE.has(head.lower) && !/^[A-Z]/.test(head.text) && !UNITS.has(head.lower)) {
                push(token, token.end, TO_PLURAL[lower], `${MESSAGES.agreement} (${head.text} ${TO_PLURAL[lower]}).`, "accord_groupe");
                return;
            }
            if (TO_SINGULAR[lower] && SINGULAR_DETS.has(detToken.lower) && isSingularNoun(head) && SINGULAR_NOUNS.has(head.lower)) {
                push(token, token.end, TO_SINGULAR[lower], `${MESSAGES.agreement} (${head.text} ${TO_SINGULAR[lower]}).`, "accord_groupe");
                return;
            }
        }
    }
    // 5. « My brother and I was late » → were.
    if (["was", "is", "has"].includes(lower) && isPrev && ["i", "he", "she"].includes(prev.lower) && tokens[i - 2]?.lower === "and") {
        let k = i - 3;
        while (k >= 0 && k > i - 6 && !clauseStartAt(text, tokens, k)) {
            k--;
        }
        const first = tokens[k];
        if (first && clauseStartAt(text, tokens, k) && i - 2 - k <= 2 && !tokens.slice(k, i - 2).some((t) => /ed$/.test(t.lower)) && (ANY_DETS.has(first.lower) || /^[A-Z]/.test(first.text) && i - 2 - k === 1 && !["I", "He", "She", "It", "We", "They", "You"].includes(first.text))) {
            const fix = { was: "were", is: "are", has: "have" }[lower];
            push(token, token.end, fix, MESSAGES.compound, "sujet_compose");
            return;
        }
    }
    // 6. « There is three servers » → are.
    if (["is", "was", "there's"].includes(lower) && (lower === "there's" || (prev?.lower === "there" && isPrev)) && isNext) {
        const quantity = NUMBER_WORDS.has(next.lower) || (/^\d+$/.test(next.text) && Number(next.text) > 1) || (next.lower === "a" && tokens[i + 2]?.lower === "few");
        if (quantity) {
            const start = lower === "there's" ? token : token;
            push(start, token.end, lower === "there's" ? "there are" : lower === "is" ? "are" : "were", MESSAGES.there, "there_are");
            return;
        }
    }
    // 7. « is to hot » → too.
    // « way to long », « a bit to much », « Is it to much water? ».
    const tooBefore = isPrev && (COPULAS.has(prev.lower) || ["way", "far", "bit"].includes(prev.lower)
        || (["it", "this", "that"].includes(prev.lower) && isNext && ["much", "late", "long", "early", "hot", "cold", "expensive", "loud", "far", "soon"].includes(next.lower)));
    if (lower === "to" && tooBefore && isNext && TOO_ADJECTIVES.has(next.lower)) {
        const after = tokens[i + 2];
        const end = !after || !adjacent(text, next, after) || ["to", "for", "and", "but", "now"].includes(after.lower) || (next.lower === "much" && !OBJECT_STARTS.has(after.lower));
        if (end) {
            push(token, token.end, "too", MESSAGES.too, "to_too");
            return;
        }
    }
    // 8. « The screws are lose » → loose.
    if (lower === "lose" && isPrev && LOOSE_BEFORE.has(prev.lower) && (!next || !isNext || ["and", "but", "again", "now", "since", "because", "after", "on", "around", "at", "in", "so", "when"].includes(next.lower))) {
        push(token, token.end, "loose", MESSAGES.loose, "lose_loose");
        return;
    }
    // 9. « You're password expires » → Your.
    if (lower === "you're" && isNext && YOUR_NOUNS.has(next.lower)) {
        push(token, token.end, "your", MESSAGES.yourNoun, "youre_your_nom");
        return;
    }
    // 10. « Than we restarted » → Then (en tête de phrase, ou après une virgule sans comparatif avant).
    if (lower === "than" && isNext && (SUBJECTS.has(next.lower) || ["the", "everything", "nothing", "it's", "i'll", "we'll", "you'll"].includes(next.lower))) {
        const sentenceStart = clauseStartAt(text, tokens, i) && !CLAUSE_OPENERS.has(prev?.lower);
        const afterComma = prev && /,\s*$/.test(text.slice(prev.end, token.start)) && !tokens.slice(Math.max(0, i - 6), i).some((t) => COMPARATIVES.has(t.lower) || /er$/.test(t.lower) && t.lower.length > 4);
        if (sentenceStart || afterComma) {
            push(token, token.end, "then", MESSAGES.thanThen, "than_then");
            return;
        }
    }
    // 11. « Whose coming tonight? » → Who's.
    if (lower === "whose" && isNext && WHOS_NEXT.has(next.lower) && !(["the", "a", "your", "my"].includes(next.lower))) {
        push(token, token.end, "who's", MESSAGES.whos, "whose_whos");
        return;
    }
    // 12. « to chose a password » → choose.
    if (lower === "chose" && isPrev && MODALS.has(prev.lower) && (!next || !isNext || CHOOSE_NEXT.has(next.lower))) {
        push(token, token.end, "choose", MESSAGES.choose, "chose_choose");
        return;
    }
    // 13. Fautes d'orthographe courantes.
    if (MISSPELLINGS[lower]) {
        push(token, token.end, MISSPELLINGS[lower], MESSAGES.misspelling, "orthographe_courante", "orthographe");
        return;
    }
    // 15. Groupe nominal + verbe courant : « My friend watch » → watches, « My parents buys » → buy.
    if ((COMMON_VERBS.has(lower) || BASE_OF_THIRD.has(lower)) && isPrev && i >= 2) {
        const after = tokens[i + 1];
        // « the software update is… » : un nom composé, le verbe vient après.
        const nounCompound = after && adjacent(text, token, after) && (VERBISH_AFTER.has(after.lower) || BASE_OF_THIRD.has(after.lower));
        let det = i - 2;
        if (tokens[det] && !ANY_DETS.has(tokens[det].lower) && !SINGULAR_DETS.has(tokens[det].lower) && /^[a-z]+$/.test(tokens[det].lower) && det > 0) {
            det--;
        }
        const detToken = tokens[det];
        const adjectiveSlot = det === i - 3 ? tokens[i - 2] : null;
        const startsClause = detToken && clauseStartAt(text, tokens, det) && !PREPOSITIONS.has(tokens[det - 1]?.lower) && !["and", "or", "nor"].includes(tokens[det - 1]?.lower)
            && !/,\s*$/.test(text.slice(0, detToken.start)) && tokens.slice(det, i).every((t, k, list) => k === 0 || adjacent(text, list[k - 1], t))
            && !(adjectiveSlot && (/^[A-Z]/.test(adjectiveSlot.text) || COMMON_VERBS.has(adjectiveSlot.lower)));
        if (!nounCompound && startsClause) {
            // Singulier : le verbe doit être suivi de son complément (« my friend watch a… ») ; sinon
            // c'est souvent un nom composé (« the plane crash in Milan », « the server update ran »).
            const objectNext = after && adjacent(text, token, after) && OBJECT_STARTS.has(after.lower);
            if (COMMON_VERBS.has(lower) && !AMBIGUOUS_VERBS.has(lower) && objectNext && SINGULAR_DETS.has(detToken.lower) && SINGULAR_NOUNS.has(prev.lower)) {
                push(token, token.end, thirdPerson(lower), `${MESSAGES.agreement} (${prev.text} ${thirdPerson(lower)}).`, "accord_verbe");
                return;
            }
            if (BASE_OF_THIRD.has(lower) && (ANY_DETS.has(detToken.lower) || PLURAL_DETS.has(detToken.lower)) && isPluralNoun(prev) && !COLLECTIVE.has(prev.lower) && !/^[A-Z]/.test(prev.text)) {
                push(token, token.end, BASE_OF_THIRD.get(lower), `${MESSAGES.agreement} (${prev.text} ${BASE_OF_THIRD.get(lower)}).`, "accord_verbe");
                return;
            }
        }
    }
    // 16. « Their late because… » → They're.
    if (lower === "their" && isNext && THEYRE_ADJ.has(next.lower)) {
        const after = tokens[i + 2];
        if (!after || !adjacent(text, next, after) || THEYRE_AFTER.has(after.lower)) {
            push(token, token.end, "they're", MESSAGES.theyre, "their_theyre");
            return;
        }
    }
    // 14. « The update wont install » → won't.
    if (lower === "wont" && isPrev && isNext && !["his", "her", "their", "its", "my", "your", "our", "as", "is", "was"].includes(prev.lower) && /^[a-z]+$/.test(next.lower)) {
        push(token, token.end, "won't", MESSAGES.wont, "wont");
    }
}
