// Aria ODL — glossaire de traduction.
//
// Bergamot ne sait pas qu'un « serveur » est une machine et pas un garçon de café.
// Avant la traduction, chaque terme du glossaire trouvé dans le texte est entouré
// d'un marqueur <span data-ag="n">. Le modèle, en mode HTML, replace le marqueur
// autour du mot aligné dans sa traduction. Après la traduction :
//   - si le terme imposé est déjà là (le modèle l'a trouvé seul), on ne touche à rien ;
//   - sinon, le contenu du marqueur (hors article) est remplacé par le terme.
// Les marqueurs sont ensuite retirés. Les termes « à ne jamais traduire » suivent
// le même chemin, avec le terme d'origine comme cible.
//
// Tout se passe dans un <template> : son contenu est inerte (aucun script exécuté,
// aucune image chargée), même quand il vient d'une page web traduite.

const MARK = "data-ag";
const LETTER = "[\\p{L}\\p{N}_-]";
const VOWEL_START = /^[aeiouyhàâäéèêëîïôöùûü]/iu;
const ARTICLES = {
    fr: /^((?:(?:le|la|les|un|une|des|du|de|au|aux|ce|cet|cette|ces|mon|ma|mes|ton|ta|tes|son|sa|ses|notre|nos|votre|vos|leur|leurs)\s+|(?:l|d|qu)['’])+)/iu,
    en: /^((?:(?:the|a|an|this|that|these|those|my|your|our|their|its|his|her)\s+)+)/iu,
};

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const escapeHtml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const isSingleWord = (text) => !/\s/u.test(text);

function pluralize(word, lang) {
    if (!isSingleWord(word) || /[sxz]$/iu.test(word)) {
        return word;
    }
    const upper = word === word.toUpperCase() && /\p{L}/u.test(word);
    let plural;
    if (lang === "en") {
        if (/[^aeiou]y$/iu.test(word)) {
            plural = `${word.slice(0, -1)}ies`;
        } else if (/(ch|sh)$/iu.test(word)) {
            plural = `${word}es`;
        } else {
            plural = `${word}s`;
        }
    } else {
        plural = /(au|eau|eu)$/iu.test(word) ? `${word}x` : `${word}s`;
    }
    return upper ? plural.toUpperCase() : plural;
}

// Adapte la casse de la cible à celle du mot trouvé dans le texte.
function matchCase(target, surface) {
    const letters = surface.replace(/[^\p{L}]/gu, "");
    if (letters.length > 1 && letters === letters.toUpperCase() && target === target.toLowerCase()) {
        return target.toUpperCase();
    }
    if (/^\p{Lu}/u.test(surface) && /^\p{Ll}/u.test(target)) {
        return target[0].toUpperCase() + target.slice(1);
    }
    return target;
}

// Règles pour un sens donné : les paires du glossaire, puis les termes à garder.
// Les plus longues d'abord, pour que « mot de passe » passe avant « mot ».
function buildRules({ glossary = [], keepTerms = [] }, from, to) {
    const rules = [];
    const seen = new Set();
    for (const pair of glossary) {
        const source = pair?.[from]?.trim();
        const target = pair?.[to]?.trim();
        if (source && target && !seen.has(source.toLowerCase())) {
            seen.add(source.toLowerCase());
            rules.push({ source, target, keep: false });
        }
    }
    for (const term of keepTerms) {
        const source = term?.trim();
        if (source && !seen.has(source.toLowerCase())) {
            seen.add(source.toLowerCase());
            rules.push({ source, target: source, keep: true });
        }
    }
    rules.sort((a, b) => b.source.length - a.source.length);
    if (!rules.length) {
        return null;
    }
    const plural = from === "en" ? "(?:es|s)" : "(?:s|x)";
    const alternatives = rules.map((rule) => {
        const body = rule.source.split(/\s+/u).map(escapeRegex).join("\\s+");
        return `(${body})(${isSingleWord(rule.source) ? `${plural}?` : ""})`;
    });
    const regex = new RegExp(`(?<!${LETTER})(?:${alternatives.join("|")})(?!${LETTER})`, "giu");
    return { rules, regex, from, to };
}

const cache = new Map();
function rulesFor(glossaryData, from, to) {
    const key = `${from}>${to}:${JSON.stringify(glossaryData)}`;
    if (!cache.has(key)) {
        if (cache.size > 8) {
            cache.clear();
        }
        cache.set(key, buildRules(glossaryData, from, to));
    }
    return cache.get(key);
}

function textNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
        nodes.push(walker.currentNode);
    }
    return nodes;
}

// Pose les marqueurs dans le fragment. Renvoie la liste des termes attendus.
function markTerms(root, compiled) {
    const markers = [];
    for (const node of textNodes(root)) {
        const text = node.nodeValue;
        compiled.regex.lastIndex = 0;
        let match;
        let last = 0;
        const parts = [];
        while ((match = compiled.regex.exec(text))) {
            const index = match.slice(1).findIndex((group, i) => i % 2 === 0 && group !== undefined);
            const rule = compiled.rules[index / 2];
            const surface = match[0];
            const pluralSuffix = match[index + 2];
            let expected;
            if (rule.keep) {
                // « Logs » en début de phrase reste « logs » ailleurs ; « LOGS » reste en capitales.
                const allCaps = surface.length > 1 && surface === surface.toUpperCase();
                expected = !allCaps && /^\p{Ll}/u.test(rule.target) ? surface[0].toLowerCase() + surface.slice(1) : surface;
            } else {
                expected = matchCase(pluralSuffix ? pluralize(rule.target, compiled.to) : rule.target, match[index + 1]);
            }
            parts.push(document.createTextNode(text.slice(last, match.index)));
            const span = document.createElement("span");
            span.setAttribute(MARK, String(markers.length));
            span.textContent = surface;
            parts.push(span);
            markers.push({ expected, base: rule.target, keep: rule.keep });
            last = match.index + surface.length;
        }
        if (parts.length) {
            parts.push(document.createTextNode(text.slice(last)));
            node.replaceWith(...parts);
        }
    }
    return markers;
}

function containsTerm(text, marker, lang) {
    const forms = new Set([marker.expected, marker.base, pluralize(marker.base, lang)]);
    const body = [...forms].map((f) => f.split(/\s+/u).map(escapeRegex).join("\\s+")).join("|");
    return new RegExp(`(?<!${LETTER})(?:${body})(?!${LETTER})`, "iu").test(text);
}

// Remplace la traduction proposée par le terme imposé, en gardant l'article devant.
function replaceContent(span, marker, lang) {
    const text = span.textContent;
    const article = (ARTICLES[lang]?.exec(text) ?? [""])[0];
    const rest = text.slice(article.length);
    let term = marker.expected;
    if (/^\p{Lu}/u.test(rest || text) && /^\p{Ll}/u.test(term)) {
        term = term[0].toUpperCase() + term.slice(1);
    }
    let prefix = article;
    if (lang === "fr") {
        // « l'interrupteur » → « le switch », « le coffre » → « l'arbre » : l'élision suit le nouveau mot.
        const elided = /(l|d|qu)['’]$/iu.exec(prefix);
        if (elided && !VOWEL_START.test(term)) {
            const word = { l: "le", d: "de", qu: "que" }[elided[1].toLowerCase()];
            const cased = /^\p{Lu}/u.test(elided[1]) ? word[0].toUpperCase() + word.slice(1) : word;
            prefix = `${prefix.slice(0, elided.index)}${cased} `;
        } else if (VOWEL_START.test(term)) {
            prefix = prefix.replace(/(^|\s)(l)[ea]\s+$/iu, "$1$2'").replace(/(^|\s)(d)e\s+$/iu, "$1$2'");
        }
    }
    const trailing = /\s*$/u.exec(rest)[0];
    span.textContent = `${prefix}${term}${trailing}`;
}

function resolveMarkers(root, markers, lang) {
    const fullText = root.textContent;
    markers.forEach((marker, id) => {
        const spans = [...root.querySelectorAll(`span[${MARK}="${id}"]`)];
        if (!spans.length) {
            return;
        }
        if (spans.some((span) => containsTerm(span.textContent, marker, lang)) || containsTerm(fullText, marker, lang)) {
            return;
        }
        const target = spans.find((span) => /[\p{L}\p{N}]/u.test(span.textContent));
        if (target) {
            replaceContent(target, marker, lang);
        } else {
            spans[0].textContent = marker.expected;
        }
    });
    for (const span of root.querySelectorAll(`span[${MARK}]`)) {
        span.replaceWith(...span.childNodes);
    }
    root.normalize();
}

// Prépare un texte (brut ou HTML) pour Bergamot. Renvoie null si aucun terme
// du glossaire n'y figure : la traduction suit alors son chemin habituel.
export function prepareGlossary({ text, html, from, to, glossary }) {
    const compiled = glossary ? rulesFor(glossary, from, to) : null;
    if (!compiled) {
        return null;
    }
    compiled.regex.lastIndex = 0;
    const plain = html ? text.replace(/<[^>]*>/g, " ") : text;
    if (!compiled.regex.test(plain)) {
        return null;
    }
    const template = document.createElement("template");
    template.innerHTML = html ? text : escapeHtml(text);
    const markers = markTerms(template.content, compiled);
    if (!markers.length) {
        return null;
    }
    return {
        html: template.innerHTML,
        hits: markers.length,
        finish(translated) {
            const out = document.createElement("template");
            out.innerHTML = translated;
            resolveMarkers(out.content, markers, to);
            return html ? out.innerHTML : out.content.textContent;
        },
    };
}
