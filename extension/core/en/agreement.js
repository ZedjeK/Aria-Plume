// Aria Plume — accords en anglais, d'après la nature des mots (WordNet et terminaisons, voir
// shared/ngrammes.js : natureOfEnglish) plutôt que des listes de noms et de verbes :
//   - déterminant et nom : « this cookies », « these recipe », « several member », « each employees »,
//     « one of my friend » ;
//   - « there is / there are » selon ce qui suit ;
//   - questions : « Where is my headphones? », « Why does the lights flicker? », « Do he… » ;
//   - sujet en tête de phrase et son verbe, par-dessus un complément (« The author of these articles
//     write ») ou une relative (« The software that controls the pumps need ») ; sujets indéfinis
//     (« Neither of the printers are », « Each player receive », « Anyone who parks here… get »).
// On ne signale que si le nombre du sujet est sûr (déterminant, pluriel régulier, pronom) : dans le
// doute, rien.

const WORD = /[A-Za-z]+(?:[-'’][A-Za-z]+)*/g;
const SG_DETS = new Set(["a", "an", "this", "that", "each", "every", "another", "one"]);
const PL_DETS = new Set(["these", "those", "both", "several", "many", "few", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "twenty", "thirty", "fifty", "hundred", "thousand"]);
const ANY_DETS = new Set(["the", "my", "your", "his", "her", "our", "their", "its", "some", "all", "most", "no", "any"]);
const PREPS = new Set(["except", "but", "besides", "than", "of", "in", "on", "at", "with", "for", "from", "by", "about", "behind", "near", "under", "over", "between", "inside", "outside", "across", "around", "through", "without", "like", "including", "beside", "above", "below", "after", "before", "against", "along", "among"]);
const ADVERBS = new Set(["yesterday", "tomorrow", "tonight", "finally", "suddenly", "soon", "again", "once", "twice", "always", "often", "usually", "never", "still", "also", "really", "sometimes", "rarely", "just", "only", "now", "currently", "already", "probably", "clearly", "here", "there", "today", "barely", "hardly"]);
// Auxiliaires et modaux : après eux, pas d'accord à vérifier. Y compris les contractions écrites sans
// apostrophe (« The update wont install » : la faute est « wont », pas « install »).
const STOP = new Set(["wont", "dont", "cant", "doesnt", "didnt", "isnt", "arent", "wasnt", "werent", "couldnt", "shouldnt", "wouldnt", "havent", "hasnt", "hadnt", "cannot", "gonna", "gotta", "wanna", "will", "would", "can", "could", "should", "must", "might", "may", "shall", "to", "not", "did", "didn't", "won't", "can't", "couldn't", "wouldn't", "shouldn't", "had", "hadn't", "been", "being", "be"]);
const IRREGULAR_PLURALS = new Set(["people", "children", "men", "women", "feet", "teeth", "mice", "geese", "police", "cattle", "clothes", "scissors", "pants", "glasses", "jeans", "shorts", "trousers", "goods", "thanks", "earnings", "savings", "stairs", "surroundings", "bacteria", "criteria", "phenomena", "alumni", "headquarters", "dice", "outskirts", "headphones", "pliers", "tongs", "binoculars", "pajamas", "leggings", "belongings", "outskirts", "remains", "premises", "odds"]);
const PRONOUNS = new Set(["i", "you", "he", "she", "we", "they", "it"]);
// Noms dont le nombre ne se lit pas à la forme, ou qui admettent les deux accords.
const UNSURE = new Set(["score", "dozen", "aspirin", "offspring", "aircraft", "judiciary", "dead", "blind", "unemployed", "bereaved", "poor", "rich", "young", "old", "elderly", "sick", "homeless", "lot", "lots", "couple", "number", "majority", "minority", "rest", "bunch", "variety", "kind", "kinds", "sort", "sorts", "type", "types", "half", "percent", "plenty", "pair", "pairs", "team", "staff", "family", "crew", "committee", "audience", "band", "class", "company", "group", "government", "public", "data", "media", "series", "species", "means", "fish", "sheep", "deer", "none", "any", "all", "some", "most", "more", "what", "who", "which", "kind", "part", "total", "amount", "news", "physics", "mathematics", "economics", "politics", "athletics", "statistics"]);
const SINGULAR_ICS = new Set(["news", "mathematics", "physics", "economics", "politics", "athletics", "measles", "linguistics", "electronics", "gymnastics"]);
const UNCOUNTABLE = new Set(["time", "money", "water", "milk", "information", "advice", "furniture", "equipment", "software", "hardware", "traffic", "luggage", "baggage", "homework", "work", "research", "evidence", "knowledge", "weather", "music", "bread", "rice", "coffee", "tea", "sugar", "salt", "butter", "cheese", "progress", "luck", "fun", "feedback", "space", "room", "damage", "experience", "energy", "food", "fruit", "hair", "paper", "wine", "beer", "juice", "trouble", "attention", "interest", "pressure", "noise", "light", "rain", "snow", "traffic", "content", "effort", "support", "detail", "code", "mail", "email", "spam", "storage", "memory", "power", "use", "help", "sleep", "exercise", "practice", "damage", "doubt", "hope", "choice", "change"]);
const SG_PRONOUNS = new Set(["he", "she", "it", "this", "that", "anyone", "anybody", "everyone", "everybody", "someone", "somebody", "nobody", "no one", "everything", "something", "nothing", "anything"]);
const PL_PRONOUNS = new Set(["we", "they", "you", "these", "those"]);
const TO_PLURAL = { is: "are", was: "were", has: "have", does: "do", "isn't": "aren't", "wasn't": "weren't", "hasn't": "haven't", "doesn't": "don't", am: "are" };
const TO_SINGULAR = { are: "is", were: "was", have: "has", do: "does", "aren't": "isn't", "weren't": "wasn't", "haven't": "hasn't", "don't": "doesn't" };
const AUX_SG = new Set(["is", "was", "has", "does", "isn't", "wasn't", "hasn't", "doesn't"]);
const AUX_PL = new Set(["are", "were", "have", "do", "aren't", "weren't", "haven't", "don't"]);
const WH = new Set(["what", "where", "when", "why", "how", "who", "long", "often", "much", "many", "far", "soon"]);

const third = (verb) => ({ have: "has", do: "does", go: "goes", be: "is" }[verb] ?? (/(s|sh|ch|x|z|o)$/.test(verb) ? `${verb}es` : /[^aeiou]y$/.test(verb) ? `${verb.slice(0, -1)}ies` : `${verb}s`));
const base = (verb) => ({ has: "have", does: "do", goes: "go", is: "are", lies: "lie", dies: "die", ties: "tie" }[verb] ?? (/ies$/.test(verb) ? `${verb.slice(0, -3)}y` : /(ss|sh|ch|x|z|o)es$/.test(verb) ? verb.slice(0, -2) : verb.slice(0, -1)));
const pluralOf = (noun) => (/(s|sh|ch|x|z)$/.test(noun) ? `${noun}es` : /[^aeiou]y$/.test(noun) ? `${noun.slice(0, -1)}ies` : `${noun}s`);
const singularOf = (noun) => (/ies$/.test(noun) ? `${noun.slice(0, -3)}y` : /(ss|sh|ch|x|z)es$/.test(noun) ? noun.slice(0, -2) : noun.slice(0, -1));
const sameCase = (original, fix) => (/^[A-Z]/.test(original) ? fix[0].toUpperCase() + fix.slice(1) : fix);

export function findAgreement(text, natureOf) {
    const found = [];
    const add = (token, fix, rule, message) => {
        if (fix && fix.toLowerCase() !== token.lower && !found.some((m) => m.start < token.end && m.end > token.start)) {
            found.push({ start: token.start, end: token.end, kind: "grammaire", detail: "aria", message, suggestions: [sameCase(token.text, fix)], rule: `aria_en_agreement_${rule}` });
        }
    };
    for (const sentence of text.matchAll(/[^.!?;:\n]+[.!?]?/g)) {
        const tokens = [...sentence[0].matchAll(WORD)].map((m) => {
            const lower = m[0].toLowerCase().replace("’", "'");
            return { text: m[0], lower, start: sentence.index + m.index, end: sentence.index + m.index + m[0].length, nature: natureOf(m[0]) };
        });
        const question = /\?\s*$/.test(sentence[0]);
        const gap = (i) => (tokens[i + 1] ? text.slice(tokens[i].end, tokens[i + 1].start) : "");
        const tags = (t) => (t ? t.nature.split("+") : []);
        const has = (t, tag) => tags(t).includes(tag);
        const pluralNoun = (t) => !!t && (IRREGULAR_PLURALS.has(t.lower) || /[a-z](?:men|women)$/.test(t.lower) || (has(t, "S:N") && !SINGULAR_ICS.has(t.lower)));
        // Ce qui peut suivre un verbe : un complément (déterminant, nombre, pronom), un adverbe, une forme en -ing.
        const objectLike = (t) => !!t && (SG_DETS.has(t.lower) || PL_DETS.has(t.lower) || ANY_DETS.has(t.lower) || t.nature === "#" || ["it", "them", "him", "me", "us", "you", "to"].includes(t.lower) || t.nature === "W" || ADVERBS.has(t.lower));
        const spaced = (a, b) => /^\s+$/.test(text.slice(a.end, b.start));
        const pluralOnly = (t) => !!t && (IRREGULAR_PLURALS.has(t.lower) || t.nature === "S:N" || t.nature === "N+S:N");
        const singularNoun = (t) => !!t && has(t, "N") && !pluralNoun(t);
        const nominal = (t) => !!t && (has(t, "N") || has(t, "A") || pluralNoun(t) || has(t, "G") || t.nature === "M" || t.nature === "#") && !has(t, "D") && !ADVERBS.has(t.lower)
            && !PREPS.has(t.lower) && !STOP.has(t.lower) && !AUX_SG.has(t.lower) && !AUX_PL.has(t.lower);
        const baseVerb = (t) => !!t && has(t, "V") && !/s$/.test(t.lower) && !IRREGULAR_PLURALS.has(t.lower);
        const thirdVerb = (t) => !!t && has(t, "S:V");

        // --- Déterminant et nom ---
        tokens.forEach((t, i) => {
            const next = tokens[i + 1];
            const after = tokens[i + 2];
            if (!next || !/^\s+$/.test(gap(i)) || /[,(]/.test(gap(i)) || /['’]s?$/.test(next.text) || /^[A-Z]/.test(next.text) || /[-–]/.test(gap(i)) || /^[-–]/.test(gap(i + 1))) {
                return;
            }
            const startsClause = i === 0 || /[,(]\s*$/.test(text.slice(tokens[i - 1].end, t.start)) || ["all", "of", "in", "on", "at", "with", "for", "about"].includes(tokens[i - 1].lower);
            if ((t.lower === "this" || (t.lower === "that" && startsClause)) && pluralNoun(next) && !(after && has(after, "N") && !pluralNoun(after) && spaced(next, after)) && (pluralOnly(next) || (after && (AUX_PL.has(after.lower) || baseVerb(after)) && !nominal(after))) && !UNSURE.has(next.lower)) {
                add(t, t.lower === "this" ? "these" : "those", "det", `“${next.text}” is plural: use “${t.lower === "this" ? "these" : "those"}”.`);
            } else if ((t.lower === "this" || (t.lower === "that" && startsClause)) && next.nature === "#" || (t.lower === "this" && PL_DETS.has(next.lower) && pluralNoun(after))) {
                if (pluralNoun(after)) {
                    add(t, t.lower === "this" ? "these" : "those", "det", "A plural noun follows: use the plural determiner.");
                }
            } else if ((t.lower === "these" || t.lower === "those") && singularNoun(next) && !UNSURE.has(next.lower) && !UNCOUNTABLE.has(next.lower) && !nominal(after) && tags(next).includes("N") && !has(next, "A")) {
                add(t, t.lower === "these" ? "this" : "that", "det", `“${next.text}” is singular: use “${t.lower === "these" ? "this" : "that"}”.`);
            } else if ((["several", "many", "both", "few"].includes(t.lower) || (PL_DETS.has(t.lower) && !["these", "those", "hundred", "thousand"].includes(t.lower)) || /^(?:[2-9]|\d{2,})$/.test(t.text))
                && singularNoun(next) && t.nature !== "#" && next.nature === "N" && after?.lower !== "and" && !UNSURE.has(next.lower) && !UNCOUNTABLE.has(next.lower) && !nominal(after) && !(after && /^(?:hundred|thousand|million|billion|dozen|more|other|of)$/.test(after.lower))) {
                add(next, pluralOf(next.lower), "noun", `After “${t.text}”, the noun is plural.`);
            } else if ((t.lower === "each" || t.lower === "every") && pluralOnly(next) && !UNSURE.has(next.lower) && !(after && nominal(after) && !thirdVerb(after))) {
                add(next, singularOf(next.lower), "noun", `After “${t.text}”, the noun is singular.`);
            } else if (t.lower === "one" && next.lower === "of" && after && (ANY_DETS.has(after.lower) || after.lower === "these" || after.lower === "those")) {
                const noun = tokens[i + 3];
                const then = tokens[i + 4];
                if (noun && noun.nature === "N" && singularNoun(noun) && !UNSURE.has(noun.lower) && !UNCOUNTABLE.has(noun.lower) && !nominal(then)) {
                    add(noun, pluralOf(noun.lower), "noun", "After “one of”, the noun is plural.");
                }
            }
        });

        // --- There is / there are ---
        tokens.forEach((t, i) => {
            const verb = tokens[i + 1];
            const next = tokens[i + 2];
            const after = tokens[i + 3];
            if (!["there", "here"].includes(t.lower) || !verb || !next || !(AUX_SG.has(verb.lower) || AUX_PL.has(verb.lower)) || /^(?:has|have|does|do)/.test(verb.lower)) {
                return;
            }
            const plural = (PL_DETS.has(next.lower) && !["few", "hundred", "thousand"].includes(next.lower) && pluralNoun(after ?? null) || (/^(?:[2-9]|\d{2,})$/.test(next.text) && pluralNoun(after ?? null)) || (next.lower === "some" && pluralOnly(after ?? null)));
            const singular = (next.lower === "a" || next.lower === "an") && after && !/^(?:few|lot|number|couple|dozen|hundred|thousand|million|variety|bunch|handful|total|great|large|small|wide|whole)$/.test(after.lower);
            if (plural && AUX_SG.has(verb.lower)) {
                add(verb, TO_PLURAL[verb.lower], "there", "Several things follow: use the plural verb.");
            } else if (singular && AUX_PL.has(verb.lower)) {
                add(verb, TO_SINGULAR[verb.lower], "there", "One thing follows: use the singular verb.");
            }
        });

        // Groupe nominal qui commence en i : nombre et position du dernier mot.
        // { number: "sg" | "pl" | null, end: indice après le groupe }
        const nounPhrase = (i, allowBare = false) => {
            const first = tokens[i];
            if (!first) {
                return null;
            }
            let number = null;
            let k = i;
            if (SG_DETS.has(first.lower)) {
                number = "sg";
                k++;
            } else if (PL_DETS.has(first.lower)) {
                number = "pl";
                k++;
            } else if (ANY_DETS.has(first.lower)) {
                k++;
            } else if (!allowBare) {
                return null;
            }
            const from = k;
            while (tokens[k] && nominal(tokens[k]) && (k === 0 || spaced(tokens[k - 1], tokens[k])) && !(k > from && has(tokens[k], "G") && has(tokens[k - 1], "N"))) {
                k++;
            }
            if (k === from) {
                return null;
            }
            // « Ten dollars is too much » : une quantité se dit au singulier comme au pluriel.
            const numbered = first.nature === "#" || (PL_DETS.has(first.lower) && !["these", "those", "both", "several", "many", "few"].includes(first.lower));
            return { det: number, from, end: k, numbered };
        };
        const headNumber = (phrase, headIndex) => {
            const head = tokens[headIndex];
            if (!head || UNSURE.has(head.lower) || PL_DETS.has(head.lower) || SG_DETS.has(head.lower) || head.nature === "#") {
                return null;
            }
            if (SINGULAR_ICS.has(head.lower)) {
                return "sg";
            }
            // Nom propre ou possessif (« The United States », « This year's crop ») : on ne conclut pas.
            if (/^[A-Z]/.test(head.text) && headIndex > 0 || /['’]s?$/.test(head.text) || phrase.numbered) {
                return null;
            }
            const number = pluralNoun(head) ? "pl" : has(head, "N") ? "sg" : null;
            return number && (!phrase.det || phrase.det === number) ? number : null;
        };
        const fixVerb = (verb, number, rule) => {
            if (!verb) {
                return;
            }
            const message = number === "sg" ? "The subject is singular: use the singular verb." : "The subject is plural: use the plural verb.";
            if (number === "sg" && (AUX_PL.has(verb.lower) || verb.lower === "am")) {
                add(verb, TO_SINGULAR[verb.lower] ?? "is", rule, message);
            } else if (number === "pl" && (AUX_SG.has(verb.lower) || verb.lower === "am")) {
                add(verb, TO_PLURAL[verb.lower], rule, message);
            } else if (number === "sg" && baseVerb(verb) && !has(verb, "D") && !AUX_SG.has(verb.lower) && !AUX_PL.has(verb.lower)) {
                add(verb, third(verb.lower), rule, message);
            } else if (number === "pl" && thirdVerb(verb) && !AUX_SG.has(verb.lower)) {
                add(verb, base(verb.lower), rule, message);
            }
        };

        // --- Questions : (mot interrogatif) auxiliaire sujet … ? ---
        if (question && tokens.length >= 2) {
            let i = 0;
            while (tokens[i] && WH.has(tokens[i].lower) && i < 3) {
                i++;
            }
            const aux = tokens[i];
            const subject = tokens[i + 1];
            if (aux && subject && !(i > 0 && tokens[i - 1].lower === "who") && (AUX_SG.has(aux.lower) || AUX_PL.has(aux.lower)) && !(i > 0 && ["who", "what", "which"].includes(tokens[i - 1].lower) && !ANY_DETS.has(subject.lower) && !SG_DETS.has(subject.lower) && !PL_DETS.has(subject.lower))) {
                let number = null;
                if (["he", "she", "it", "anyone", "anybody", "everyone", "everybody", "someone", "somebody", "nobody"].includes(subject.lower)) {
                    number = "sg";
                } else if (["you", "we", "they"].includes(subject.lower)) {
                    number = "pl";
                } else {
                    const phrase = nounPhrase(i + 1);
                    if (phrase) {
                        // Avec do/does/have/has, un verbe suit le sujet : c'est le dernier mot du groupe s'il
                        // peut être un verbe et que rien d'autre ne peut l'être ensuite.
                        let head = phrase.end - 1;
                        const lexical = /^(?:do|does|don't|doesn't|have|has|haven't|hasn't)$/.test(aux.lower);
                        const nextIsVerb = tokens[phrase.end] && (baseVerb(tokens[phrase.end]) || has(tokens[phrase.end], "D") || has(tokens[phrase.end], "G")) && !PREPS.has(tokens[phrase.end].lower);
                        if (lexical && !nextIsVerb && head > phrase.from && (baseVerb(tokens[head]) || thirdVerb(tokens[head]) || has(tokens[head], "D"))) {
                            head--;
                        }
                        number = headNumber(phrase, head);
                        // Un pluriel suivi de mots qui peuvent être attributs (« Are the kids ready? ») : c'est lui le sujet.
                        const plural = tokens.slice(phrase.from, head).findLastIndex((t) => pluralNoun(t));
                        if (!lexical && plural >= 0 && tokens.slice(phrase.from + plural + 1, phrase.end).every((t) => has(t, "A") || has(t, "W") || has(t, "G"))) {
                            number = headNumber(phrase, phrase.from + plural);
                        } else if (!lexical && tokens.slice(phrase.from, phrase.end).some((t) => pluralNoun(t)) !== pluralNoun(tokens[head])) {
                            number = null;
                        }
                        if (tokens.slice(i + 1, phrase.end + 2).some((t) => t.lower === "and" || t.lower === "or")) {
                            number = null;
                        }
                    }
                }
                if (number === "sg" && AUX_PL.has(aux.lower) && !(subject.lower === "it" && false)) {
                    add(aux, TO_SINGULAR[aux.lower], "question", "The subject is singular: use the singular verb.");
                } else if (number === "pl" && AUX_SG.has(aux.lower)) {
                    add(aux, TO_PLURAL[aux.lower], "question", "The subject is plural: use the plural verb.");
                }
            }
        }

        // --- Sujet en tête de phrase ---
        if (!question && tokens.length >= 3) {
            let i = 0;
            // « I think (that) », « I guess » en tête : le sujet vient après.
            if (tokens[0].lower === "i" && tokens[1] && ["think", "guess", "believe", "hope", "suppose"].includes(tokens[1].lower)) {
                i = tokens[2]?.lower === "that" && tokens[3] && (ANY_DETS.has(tokens[3].lower) || SG_DETS.has(tokens[3].lower) || PL_DETS.has(tokens[3].lower)) ? 3 : 2;
            }
            const first = tokens[i];
            const second = tokens[i + 1];
            let number = null;
            let k = null;      // indice du premier mot après le sujet
            let sure = true;
            if (first && second && ["neither", "either", "each"].includes(first.lower) && second.lower === "of") {
                const phrase = nounPhrase(i + 2);
                if (phrase) {
                    number = "sg";
                    k = phrase.end;
                }
            } else if (first && first.lower === "every" && second?.lower === "one" && tokens[i + 2]?.lower === "of") {
                const phrase = nounPhrase(i + 3);
                if (phrase) {
                    number = "sg";
                    k = phrase.end;
                }
            } else if (first && first.lower === "both" && second?.lower === "of") {
                const phrase = nounPhrase(i + 2);
                if (phrase) {
                    number = "pl";
                    k = phrase.end;
                }
            } else if (first && first.lower === "most" && second?.lower === "of") {
                const phrase = nounPhrase(i + 2);
                if (phrase) {
                    const head = tokens[phrase.end - 1];
                    number = pluralNoun(head) ? "pl" : UNCOUNTABLE.has(head.lower) ? "sg" : null;
                    k = phrase.end;
                }
            } else if (first && ["anyone", "anybody", "everyone", "everybody", "someone", "somebody", "nobody"].includes(first.lower)) {
                number = "sg";
                k = i + 1;
            } else if (first) {
                const phrase = nounPhrase(i);
                if (phrase) {
                    k = phrase.end;
                    // Le verbe est peut-être le dernier mot du groupe (« The battery last two days »).
                    const last = tokens[phrase.end - 1];
                    const following = tokens[phrase.end];
                    const followingIsVerb = following && (AUX_SG.has(following.lower) || AUX_PL.has(following.lower) || following.lower === "am" || STOP.has(following.lower) || ADVERBS.has(following.lower) || has(following, "W")
                        || ((baseVerb(following) || thirdVerb(following) || has(following, "D")) && !PREPS.has(following.lower))
                        || PREPS.has(following.lower) || ["who", "that", "which", "and", "or"].includes(following.lower));
                    if (objectLike(following) && spaced(last, following) && !followingIsVerb && phrase.end - 1 > phrase.from && (baseVerb(last) || thirdVerb(last)) && !has(last, "A") && !has(last, "D")) {
                        k = phrase.end - 1;
                    }
                    if (following && PRONOUNS.has(following.lower)) {
                        sure = false;  // relative sans « that » (« The reason I stayed is… »)
                    }
                    number = headNumber(phrase, k - 1);
                }
            }
            if (number && k !== null) {
                // Compléments (« of these articles », « , along with its puppies, »), relatives, adverbes.
                let guard = 0;
                while (tokens[k] && guard++ < 6) {
                    const t = tokens[k];
                    if (PREPS.has(t.lower) || (t.lower === "as" && tokens[k + 1]?.lower === "well")) {
                        let j = k + 1;
                        while (tokens[j] && (["with", "as", "to", "of"].includes(tokens[j].lower) && j === k + 1 || tokens[j].lower === "well")) {
                            j++;
                        }
                        const phrase = nounPhrase(j, true);
                        if (!phrase) {
                            sure = false;
                            break;
                        }
                        k = phrase.end;
                        // « the food trucks park behind… » : si rien ne peut être le verbe ensuite, c'est le dernier mot.
                        const following = tokens[k];
                        const last = tokens[k - 1];
                        if (k - 1 > phrase.from && (baseVerb(last) || thirdVerb(last)) && !has(last, "A") && !has(last, "D") && objectLike(following) && spaced(last, following) && !ADVERBS.has(following.lower) && following.nature !== "W") {
                            k--;
                        }
                    } else if (["who", "that", "which"].includes(t.lower)) {
                        // Relative : son verbe, puis ses compléments, jusqu'au verbe principal.
                        let j = k + 1;
                        while (tokens[j] && ADVERBS.has(tokens[j].lower)) {
                            j++;
                        }
                        if (!tokens[j] || AUX_SG.has(tokens[j].lower) || AUX_PL.has(tokens[j].lower) || !(baseVerb(tokens[j]) || thirdVerb(tokens[j]) || has(tokens[j], "D"))) {
                            sure = false;
                            break;
                        }
                        j++;
                        let steps = 0;
                        while (tokens[j] && steps++ < 4) {
                            if (ADVERBS.has(tokens[j].lower)) {
                                j++;
                                continue;
                            }
                            const start = PREPS.has(tokens[j].lower) ? j + 1 : j;
                            const phrase = nounPhrase(start, start !== j);
                            if (!phrase) {
                                break;
                            }
                            j = phrase.end;
                            const following = tokens[j];
                            const last = tokens[j - 1];
                            if (j - 1 > phrase.from && (baseVerb(last) || thirdVerb(last)) && !has(last, "A") && !has(last, "D") && objectLike(following) && spaced(last, following) && !ADVERBS.has(following.lower) && following.nature !== "W") {
                                j--;
                                break;
                            }
                        }
                        k = j;
                    } else if (ADVERBS.has(t.lower) || t.nature === "W") {
                        k++;
                    } else if (t.lower === "and" || t.lower === "or") {
                        if (t.lower === "and" && tokens[k + 1]?.lower === "i") {
                            number = "pl";
                            k += 2;
                        } else {
                            sure = false;
                        }
                        break;
                    } else {
                        break;
                    }
                }
                const verb = tokens[k];
                const then = tokens[k + 1];
                const nounAfterAll = then && !AUX_SG.has(verb.lower) && !AUX_PL.has(verb.lower) && (has(then, "D") || has(then, "S:V") || AUX_SG.has(then.lower) || AUX_PL.has(then.lower) || STOP.has(then.lower)
                    || (has(then, "V") && !has(then, "A") && !pluralNoun(then) && !objectLike(then) && !PREPS.has(then.lower)));
                if (sure && verb && then && !nounAfterAll && spaced(tokens[k - 1], verb) && !(has(verb, "A") && !AUX_SG.has(verb.lower) && !AUX_PL.has(verb.lower)) && !STOP.has(verb.lower) && !/['’]/.test(verb.text) && !/^[A-Z]/.test(verb.text) && !(k > 0 && /[(]/.test(text.slice(tokens[k - 1].end, verb.start)))) {
                    fixVerb(verb, number, "subject");
                }
            }
        }
    }
    return found;
}
