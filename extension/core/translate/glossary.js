// Aria Plume — glossaire de traduction.
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
// Aucun DOM : le HTML est découpé en jetons (balises et texte) par un petit analyseur.
// Rien n'est jamais interprété (aucun script, aucune image), les balises d'origine sont
// recopiées telles quelles, et le même code tourne dans le navigateur comme sous Node.

const MARK = "data-ag";
const LETTER = "[\\p{L}\\p{N}_-]";
const VOWEL_START = /^[aeiouyhàâäéèêëîïôöùûü]/iu;
const ARTICLES = {
    fr: /^((?:(?:le|la|les|un|une|des|du|de|au|aux|ce|cet|cette|ces|mon|ma|mes|ton|ta|tes|son|sa|ses|notre|nos|votre|vos|leur|leurs)\s+|(?:l|d|qu)['’])+)/iu,
    en: /^((?:(?:the|a|an|this|that|these|those|my|your|our|their|its|his|her)\s+)+)/iu,
};

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

// --- Mini-analyseur HTML ---
// Jetons : { raw } pour une balise ou un commentaire (recopiée telle quelle),
// { text, raw? } pour du texte (entités décodées ; raw = forme d'origine si inchangé).
const TOKEN = /<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>|<![^>]*>|[^<]+|</g;
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(raw) {
    return raw.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/giu, (entity, name) => {
        if (name[0] === "#") {
            const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
            return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
        }
        return ENTITIES[name.toLowerCase()] ?? entity;
    });
}

// Comme le navigateur quand il sérialise du texte.
const encodeText = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/ /g, "&nbsp;");

function tokenize(html) {
    return Array.from(html.matchAll(TOKEN), ([raw]) => (raw.length > 1 && raw[0] === "<" ? { raw } : { text: decodeEntities(raw), raw }));
}

// Parcourt les jetons visibles : texte d'un jeton, puis texte posé à sa suite (after).
function textOf(tokens, from = 0, to = tokens.length) {
    let text = "";
    for (let i = from; i < to; i++) {
        const token = tokens[i];
        if (token.removed) {
            continue;
        }
        text += token.text ?? "";
        text += token.after ?? "";
    }
    return text;
}

function serialize(tokens) {
    let html = "";
    for (const token of tokens) {
        if (token.removed) {
            continue;
        }
        if (!token.unwrap) {
            html += token.text !== undefined ? (token.raw ?? encodeText(token.text)) : token.raw;
        }
        html += token.after !== undefined ? encodeText(token.after) : "";
    }
    return html;
}

// Pose les marqueurs dans les jetons de texte. Renvoie la liste des termes attendus.
function markTerms(tokens, compiled) {
    const markers = [];
    const out = [];
    for (const token of tokens) {
        if (token.text === undefined) {
            out.push(token);
            continue;
        }
        const text = token.text;
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
            if (match.index > last) {
                parts.push({ text: text.slice(last, match.index) });
            }
            parts.push({ raw: `<span ${MARK}="${markers.length}">` }, { text: surface }, { raw: "</span>" });
            markers.push({ expected, base: rule.target, keep: rule.keep });
            last = match.index + surface.length;
        }
        if (parts.length) {
            if (last < text.length) {
                parts.push({ text: text.slice(last) });
            }
            out.push(...parts);
        } else {
            out.push(token);
        }
    }
    return { tokens: out, markers };
}

// Les marqueurs <span data-ag="n"> de la traduction : { id, open, close } (indices des jetons).
const SPAN_OPEN = /^<span\b/i;
const SPAN_CLOSE = /^<\/span\s*>$/i;
const MARK_ID = new RegExp(`\\b${MARK}\\s*=\\s*["']?(\\d+)`, "i");

function findSpans(tokens) {
    const spans = [];
    const stack = [];
    tokens.forEach((token, i) => {
        if (token.text !== undefined) {
            return;
        }
        if (SPAN_OPEN.test(token.raw) && !/\/\s*>$/.test(token.raw)) {
            const id = MARK_ID.exec(token.raw)?.[1];
            stack.push({ id: id === undefined ? null : Number(id), open: i });
        } else if (SPAN_CLOSE.test(token.raw) && stack.length) {
            const span = stack.pop();
            if (span.id !== null) {
                spans.push({ ...span, close: i });
            }
        }
    });
    // Marqueur jamais refermé : il court jusqu'à la fin.
    for (const span of stack) {
        if (span.id !== null) {
            spans.push({ ...span, close: tokens.length });
        }
    }
    return spans.sort((a, b) => a.open - b.open);
}

// Remplace le contenu d'un marqueur par un texte (comme textContent = … dans le DOM).
function setText(tokens, span, text) {
    for (let i = span.open + 1; i < span.close; i++) {
        tokens[i].removed = true;
    }
    tokens[span.open].after = text;
}

function containsTerm(text, marker, lang) {
    const forms = new Set([marker.expected, marker.base, pluralize(marker.base, lang)]);
    const body = [...forms].map((f) => f.split(/\s+/u).map(escapeRegex).join("\\s+")).join("|");
    return new RegExp(`(?<!${LETTER})(?:${body})(?!${LETTER})`, "iu").test(text);
}

// Remplace la traduction proposée par le terme imposé, en gardant l'article devant.
function replacement(text, marker, lang) {
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
    return `${prefix}${term}${trailing}`;
}

function resolveMarkers(tokens, markers, lang) {
    const fullText = textOf(tokens);
    const spans = findSpans(tokens);
    markers.forEach((marker, id) => {
        // Un marqueur effacé avec le contenu d'un autre ne compte plus.
        const found = spans.filter((span) => span.id === id && !tokens[span.open].removed);
        if (!found.length) {
            return;
        }
        const texts = found.map((span) => textOf(tokens, span.open + 1, span.close));
        if (texts.some((text) => containsTerm(text, marker, lang)) || containsTerm(fullText, marker, lang)) {
            return;
        }
        const index = texts.findIndex((text) => /[\p{L}\p{N}]/u.test(text));
        if (index >= 0) {
            setText(tokens, found[index], replacement(texts[index], marker, lang));
        } else {
            setText(tokens, found[0], marker.expected);
        }
    });
    for (const span of spans) {
        tokens[span.open].unwrap = true;
        if (span.close < tokens.length) {
            tokens[span.close].unwrap = true;
        }
    }
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
    const { tokens, markers } = markTerms(html ? tokenize(text) : [{ text }], compiled);
    if (!markers.length) {
        return null;
    }
    return {
        html: serialize(tokens),
        hits: markers.length,
        finish(translated) {
            const out = tokenize(translated);
            resolveMarkers(out, markers, to);
            return html ? serialize(out) : textOf(out);
        },
    };
}
