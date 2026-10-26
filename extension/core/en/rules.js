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
                if (isPrev && prev.lower === "and" && isNext && (SUBJECTS.has(next.lower) || next.lower === "the")) {
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
    });
    return results;
}
