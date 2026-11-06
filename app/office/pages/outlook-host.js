// Aria Plume — complément Outlook : ce que le panneau demande à Outlook.
// API Mailbox 1.3 (Outlook classique, nouvel Outlook, Outlook sur le web).
// Lecture d'un message : traduction du message (sans l'historique cité), synonymes, conjugaison.
// Rédaction : correction et traduction viennent à l'étape 2.

/* global Office */

const MAX_TRANSLATED = 20000;

// Début de l'historique cité d'une réponse ou d'un transfert, en texte brut. Renvoie sa position,
// ou -1. Le tout premier caractère ne compte pas (un message transféré sans mot commence par là).
const QUOTE_MARKERS = [
    /^[ \t]*-{2,}\s*(Original Message|Message d'origine|Message original|Forwarded message|Message transféré)\s*-*\s*$/im,
    /^[ \t]*_{10,}\s*$/m,
    /^[ \t]*(De|From)\s*:.*\r?\n[ \t]*(Envoyé|Sent|Date)\s*:/im,
    /^[ \t]*Le .{3,120} a écrit\s*:\s*$/im,
    /^[ \t]*On .{3,120} wrote:\s*$/im,
];
export function quoteStart(text) {
    let first = -1;
    for (const pattern of QUOTE_MARKERS) {
        const match = pattern.exec(text);
        if (match && match.index > 0 && (first < 0 || match.index < first)) {
            first = match.index;
        }
    }
    return first;
}

// Le message à traduire : la partie nouvelle, sans l'historique, raccourcie si énorme.
export function messageToTranslate(body) {
    const text = String(body ?? "").replace(/\r\n/g, "\n");
    const cut = quoteStart(text);
    let part = (cut >= 0 ? text.slice(0, cut) : text).trim();
    const notes = [];
    if (cut >= 0) {
        notes.push("L'historique cité (messages précédents) n'est pas traduit.");
    }
    if (part.length > MAX_TRANSLATED) {
        part = part.slice(0, MAX_TRANSLATED);
        notes.push(`Message très long : seuls les ${MAX_TRANSLATED.toLocaleString("fr-FR")} premiers caractères sont traduits.`);
    }
    return { text: part, note: notes.join(" ") };
}

// Les fonctions d'Office à rappel, en promesses.
function promised(call) {
    return new Promise((resolve, reject) => {
        call((result) => {
            if (result.status === Office.AsyncResultStatus.Succeeded) {
                resolve(result.value);
            } else {
                reject(new Error(result.error?.message ?? "Outlook a refusé l'opération."));
            }
        });
    });
}

export const isCompose = (item) => typeof item?.subject?.getAsync === "function";

export function createOutlookHost(item = Office.context.mailbox.item) {
    if (isCompose(item)) {
        return {
            name: "Outlook",
            tabs: ["synonyms", "conj"],
            notice: "En rédaction, la correction et la traduction du message arrivent dans la prochaine version d'Aria Plume.",
        };
    }
    return {
        name: "Outlook",
        tabs: ["translate", "synonyms", "conj"],
        translateSource: {
            label: "Traduire le message",
            async read() {
                const body = await promised((done) => item.body.getAsync(Office.CoercionType.Text, done));
                return messageToTranslate(body);
            },
        },
    };
}
