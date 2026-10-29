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
const YOUR_NOUNS = new Set(["password", "account", "email", "car", "computer", "phone", "house", "name", "order", "friend", "mother", "father", "family", "team", "request", "file", "files", "code", "laptop", "keys", "job", "work", "help", "application", "profile", "data", "message", "ticket", "address", "payment", "subscription", "appointment", "username", "login", "server", "website", "birthday", "boss", "wife", "husband", "dog", "cat", "kids", "children", "parents", "mom", "dad", "brother", "sister", "room", "bag", "wallet", "money", "turn", "fault", "idea", "question", "answer", "report", "browser", "device", "settings", "screen", "license"]);
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
const THEYRE_ADJ = new Set(["late", "early", "here", "there", "right", "wrong", "ready", "busy", "back", "gone", "coming", "going", "doing", "not", "sure", "happy", "sad", "tired", "sick", "fine", "okay", "ok", "home", "away", "together", "done", "finished", "available", "online", "offline", "always", "still", "really", "very", "too", "so", "both", "all"]);
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
                if (isPrev && prev.lower === "and" && isNext && (SUBJECTS.has(next.lower) || ["the", "everything", "nothing", "suddenly", "it's", "we'll", "i'll", "you'll"].includes(next.lower))) {
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
    return results;
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
            if (TO_PLURAL[lower] && (ANY_DETS.has(detToken.lower) || PLURAL_DETS.has(detToken.lower)) && isPluralNoun(head) && !COLLECTIVE.has(head.lower) && !/^[A-Z]/.test(head.text)) {
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
    if (lower === "to" && isPrev && COPULAS.has(prev.lower) && isNext && TOO_ADJECTIVES.has(next.lower)) {
        const after = tokens[i + 2];
        const end = !after || !adjacent(text, next, after) || ["to", "for", "and", "but", "now"].includes(after.lower);
        if (end) {
            push(token, token.end, "too", MESSAGES.too, "to_too");
            return;
        }
    }
    // 8. « The screws are lose » → loose.
    if (lower === "lose" && isPrev && LOOSE_BEFORE.has(prev.lower) && (!next || !isNext || ["and", "but", "again", "now"].includes(next.lower))) {
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
