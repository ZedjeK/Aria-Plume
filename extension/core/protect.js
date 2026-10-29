// Aria Plume — préparation du texte avant correction, et zones à ne jamais souligner.
//
// 1. Texte nettoyé : caractères invisibles retirés (espace de largeur nulle, trait d'union
//    conditionnel, marque d'ordre des octets) et accents décomposés recomposés (« e » + « ´ » → « é »,
//    fréquent dans un texte copié d'un PDF ou d'un Mac). Les moteurs analysent ce texte propre ;
//    les positions trouvées sont ramenées dans le texte d'origine.
// 2. Zones protégées : code (`…` et blocs ```), adresses web, courriels, chemins de fichiers,
//    partages réseau, identifiants techniques (srv-fic-01, eth0, max_retry), noms à majuscule
//    interne (GitLab, iPhone), sigles au pluriel (VMs), mentions et hashtags, balises HTML.
//    Une remarque qui touche une de ces zones est retirée : ce n'est pas de la langue.

const INVISIBLE = /[​⁠﻿­]/;
const NEEDS_PREP = /[​⁠﻿­\p{M}]/u;

// Texte propre et correspondance des positions vers le texte d'origine.
export function prepareText(text) {
    if (!NEEDS_PREP.test(text)) {
        return { clean: text, toOriginal: null };
    }
    let clean = "";
    const starts = [];  // pour chaque unité UTF-16 du texte propre : début dans l'original
    const ends = [];    // … et fin (exclue) dans l'original
    let i = 0;
    while (i < text.length) {
        const char = text[i];
        if (INVISIBLE.test(char)) {
            i++;
            continue;
        }
        // Une lettre (avec sa paire UTF-16 éventuelle) suivie de ses marques combinantes.
        let j = i + (/[\uD800-\uDBFF]/.test(char) && i + 1 < text.length ? 2 : 1);
        while (j < text.length && /\p{M}/u.test(text[j])) {
            j++;
        }
        const unit = text.slice(i, j).normalize("NFC");
        for (let k = 0; k < unit.length; k++) {
            starts.push(i);
            ends.push(j);
        }
        clean += unit;
        i = j;
    }
    const toOriginal = (start, end) => ({
        start: start < starts.length ? starts[start] : text.length,
        end: end > 0 ? ends[Math.min(end, ends.length) - 1] : 0,
    });
    return { clean, toOriginal };
}

const ZONES = [
    /```[\s\S]*?(?:```|$)/g,                                  // bloc de code Markdown
    /`[^`\n]+`/g,                                             // code en ligne
    /\b(?:https?|ftp):\/\/[^\s<>"«»]+|\bwww\.[^\s<>"«»]+/gi,  // adresses web
    /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu, // courriels
    /(?:\b[A-Za-z]:\\|\\\\)[^\s"'<>|*?]+/g,                   // chemins Windows, partages réseau
    /(?<![\p{L}\p{N}])(?:~|\.{1,2})?\/[\p{L}\p{N}._@%+~-]+(?:\/[\p{L}\p{N}._@%+~-]*)*/gu, // /etc/nginx/…
    /(?<![\p{L}\p{N}_/])[\p{L}\p{N}_.-]+(?:\/[\p{L}\p{N}_.-]+)+/gu, // feature/vlan-20, sites-available/default
    /(?<![\p{L}\p{N}_-])[\p{L}_][\p{L}\p{N}_]*(?:[-_.][\p{L}\p{N}_]+)*(?![\p{L}\p{N}_])/gu, // identifiants (filtrés plus bas)
    /(?<![\p{L}\p{N}])[@#][\p{L}\p{N}_-]+/gu,                 // mentions, hashtags
    /<\/?[a-zA-Z][^<>]*>/g,                                   // balises HTML
];
const IDENTIFIER = 7;
// Un identifiant : chiffre ou tiret bas dedans (eth0, srv-fic-01, max_retry), majuscule interne
// après une minuscule (GitLab, iPhone, teamInfra), ou sigle au pluriel (VMs, PCs).
// Nom de fichier : « error.log », « config.yaml ».
const TECHNICAL = /[\p{N}_]|\p{Ll}\p{Lu}|^\p{Lu}{2,}s$|^[\p{L}-]+(?:\.[\p{Ll}]{1,5})+$/u;
const TRAILING = /[.,;:!?)\]»”'"]+$/;

export function protectedSpans(text) {
    if (!/[`/\\@#<_\p{N}]|www\.|\p{Ll}\p{Lu}|\p{Lu}{2}s|\p{L}\.\p{Ll}/u.test(text)) {
        return [];
    }
    const spans = [];
    ZONES.forEach((re, index) => {
        for (const match of text.matchAll(re)) {
            let value = match[0];
            if (index === IDENTIFIER) {
                // Un identifiant commence par une lettre ou un tiret bas : « 12novembre » ou « 300Mo »
                // (nombre collé) restent analysés.
                if (!TECHNICAL.test(value) || /^\p{N}/u.test(value)) {
                    continue;
                }
            } else if (index >= 2 && index <= 6) {
                value = value.replace(TRAILING, "");  // ponctuation de fin de phrase
            }
            if (value) {
                spans.push({ start: match.index, end: match.index + value.length });
            }
        }
    });
    return spans;
}

// Retire les remarques qui touchent une zone protégée, et celles qui ne soulignent qu'une
// tabulation (colonnes d'un tableau collé).
export function filterProtected(text, matches) {
    const spans = protectedSpans(text);
    return matches.filter((m) => {
        const part = text.slice(m.start, m.end);
        if (/^\s*$/.test(part) && part.includes("\t")) {
            return false;
        }
        return !spans.some((s) => m.start < s.end && m.end > s.start);
    });
}
