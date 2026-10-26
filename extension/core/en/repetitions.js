// Aria Plume — répétitions en anglais : même mot plein revenu à moins de « distance » mots.
// Pas de lemmes ici (Harper n'en fournit pas) : on compare le mot sans sa marque du pluriel
// ou de la 3e personne (« server » / « servers »), et on propose les synonymes de WordNet.
// Les synonymes viennent du thésaurus (createEnglishThesaurus), passé en paramètre.

const WORD = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;
const MAX_SYNONYMS = 4;
// Mots-outils et mots trop courants pour qu'une répétition gêne.
const STOP = new Set(("about above after again against also always another anything around because been before being below between both cannot could does doing done down during each either else even ever every from further going gone have having here hers herself himself however into itself just know like made make many more most much must myself need never none nothing often only other ours ourselves over own perhaps quite rather same should since some something still such than that their theirs them themselves then there these they thing things this those though through thus together under until upon very want well were what whatever when where whether which while whom whose will with within without would your yours yourself yourselves thanks thank please people time times today tomorrow yesterday good great back take took come came give gave said says tell told look used using sure maybe also yeah okay").split(" "));

function key(word) {
    const w = word.toLowerCase().replace(/['’]s$/, "");
    if (/ies$/.test(w) && w.length > 5) {
        return `${w.slice(0, -3)}y`;
    }
    if (/(ss|us|is)$/.test(w)) {
        return w;
    }
    if (/(ch|sh|x|z)es$/.test(w)) {
        return w.slice(0, -2);
    }
    return w.endsWith("s") ? w.slice(0, -1) : w;
}

async function synonymsFor(word, synonyms) {
    try {
        const result = await synonyms(word);
        return [...new Set(result.groups.flatMap((g) => g.words))].filter((w) => !/\s/.test(w)).slice(0, MAX_SYNONYMS);
    } catch {
        return [];
    }
}

export async function findEnglishRepetitions(text, distance, taken, synonyms) {
    const words = [];
    let previousEnd = 0;
    for (const match of text.matchAll(WORD)) {
        const between = text.slice(previousEnd, match.index);
        const sentenceStart = words.length === 0 || /[.!?…\n]\s*$/.test(between);
        words.push({ text: match[0], start: match.index, end: match.index + match[0].length, sentenceStart });
        previousEnd = match.index + match[0].length;
    }
    const lastSeen = new Map();
    const found = [];
    words.forEach((word, index) => {
        const w = word.text;
        if (w.length < 4 || (w === w.toUpperCase() && w.length > 1) || (/^[A-Z]/.test(w) && !word.sentenceStart)) {
            return;  // mots courts, sigles, noms propres
        }
        const k = key(w);
        if (k.length < 4 || STOP.has(k) || STOP.has(w.toLowerCase())) {
            return;
        }
        const before = lastSeen.get(k);
        lastSeen.set(k, index);
        if (before === undefined || index - before > distance || taken.some((m) => word.start < m.end && word.end > m.start)) {
            return;
        }
        found.push({ word, before, gap: index - before });
    });
    const results = [];
    for (const { word, before, gap } of found) {
        results.push({
            start: word.start,
            end: word.end,
            kind: "style",
            detail: "répétition",
            message: `« ${words[before].text} » est déjà employé ${gap} mot${gap > 1 ? "s" : ""} plus tôt. Un synonyme ?`,
            suggestions: await synonymsFor(word.text, synonyms),
            rule: "aria_repetition",
        });
    }
    return results;
}
