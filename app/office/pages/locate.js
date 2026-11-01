// Aria Plume — retrouver dans Word (ou Outlook) le passage signalé par le moteur.
//
// Le moteur donne des positions dans le texte d'un paragraphe ; l'API de Word, elle, ne sait que
// chercher un texte. On cherche donc le passage dans le paragraphe et on prend la bonne
// occurrence : la k-ième, en comptant comme Word (de gauche à droite, sans chevauchement, casse
// respectée). Au-delà de 255 caractères (limite de la recherche de Word), on cherche le début et
// la fin du passage, puis on les relie (Range.expandTo).

export const MAX_SEARCH = 255;
const EDGE = 100;

// Dans la recherche de Word, « ^ » introduit un code spécial (^p, ^t…) : il se double.
export const escapeSearch = (text) => text.replace(/\^/g, "^^");

// Rang de l'occurrence de « needle » qui commence à « start », ou -1 si la recherche de Word ne
// tomberait pas dessus (occurrences qui se chevauchent).
export function occurrenceIndex(text, needle, start) {
    if (!needle) {
        return -1;
    }
    let index = 0;
    let from = 0;
    for (;;) {
        const found = text.indexOf(needle, from);
        if (found < 0 || found > start) {
            return -1;
        }
        if (found === start) {
            return index;
        }
        index++;
        from = found + needle.length;
    }
}

// Comment retrouver le passage [start, end[ de « text ».
//   { kind: "direct", needle, index }                     une recherche
//   { kind: "span", head, headIndex, tail, tailIndex }     début et fin, puis expandTo
//   { kind: "none" }                                      introuvable par la recherche de Word
export function searchPlan(text, { start, end }) {
    const needle = text.slice(start, end);
    if (!needle.trim() || start < 0 || end > text.length) {
        return { kind: "none" };
    }
    if (needle.length <= MAX_SEARCH) {
        const index = occurrenceIndex(text, needle, start);
        return index < 0 ? { kind: "none" } : { kind: "direct", needle, index };
    }
    const head = needle.slice(0, EDGE);
    const tail = needle.slice(-EDGE);
    const headIndex = occurrenceIndex(text, head, start);
    const tailIndex = occurrenceIndex(text, tail, end - EDGE);
    return headIndex < 0 || tailIndex < 0 ? { kind: "none" } : { kind: "span", head, headIndex, tail, tailIndex, needle };
}

// Positions d'un passage après des remplacements faits plus loin dans le même paragraphe : rien
// ne bouge. Pour « Tout corriger », on applique donc du dernier au premier.
export const byEndDescending = (a, b) => b.start - a.start;
