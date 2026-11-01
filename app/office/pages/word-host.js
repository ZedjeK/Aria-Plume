// Aria Plume — complément Word : ce que le panneau demande à Word.
// Bases de l'API Word présentes depuis Word 2016 (WordApi 1.1), plus Range.expandTo (1.3) pour
// les très longs passages. Un « bloc » est un paragraphe du corps du document : { index, text, id }.
// id : identifiant stable du paragraphe (WordApi 1.6), absent sur les Word plus anciens.
//
// Soulignés dans le texte (WordApi 1.8, Word avec un abonnement Microsoft 365) : chaque faute
// devient une annotation de Word, avec ses suggestions dans la bulle de Word ; un paragraphe
// modifié est signalé au panneau, qui le revérifie.

/* global Office, Word */

import { escapeSearch, searchPlan } from "./locate.js";

// Le paragraphe a changé depuis l'analyse : on ne touche à rien.
export class ChangedError extends Error {}

const supports = (version) => !!globalThis.Office?.context?.requirements?.isSetSupported?.("WordApi", version);

async function paragraphAt(context, block) {
    let paragraph;
    if (block.id && supports("1.6")) {
        paragraph = context.document.getParagraphByUniqueLocalId(block.id);
        paragraph.load("text");
        try {
            await context.sync();
        } catch {
            throw new ChangedError("Le texte a changé depuis l'analyse.");
        }
    } else {
        const paragraphs = context.document.body.paragraphs;
        paragraphs.load("items/text");
        await context.sync();
        paragraph = paragraphs.items[block.index];
    }
    if (!paragraph || paragraph.text !== block.text) {
        throw new ChangedError("Le texte a changé depuis l'analyse.");
    }
    return paragraph;
}

// La plage Word du passage [start, end[ du paragraphe, ou null.
async function locate(context, paragraph, text, match) {
    const plan = searchPlan(text, match);
    if (plan.kind === "none") {
        return null;
    }
    if (plan.kind === "direct") {
        const results = paragraph.search(escapeSearch(plan.needle), { matchCase: true });
        results.load("items/text");
        await context.sync();
        const range = results.items[plan.index];
        return range && range.text === plan.needle ? range : null;
    }
    const heads = paragraph.search(escapeSearch(plan.head), { matchCase: true });
    const tails = paragraph.search(escapeSearch(plan.tail), { matchCase: true });
    heads.load("items/text");
    tails.load("items/text");
    await context.sync();
    const head = heads.items[plan.headIndex];
    const tail = tails.items[plan.tailIndex];
    if (!head || !tail) {
        return null;
    }
    const range = head.expandTo(tail);
    range.load("text");
    await context.sync();
    return range.text === plan.needle ? range : null;
}

// Tous les paragraphes du corps : [{ index, text, id }].
async function readAll(context) {
    const withIds = supports("1.6");
    const paragraphs = context.document.body.paragraphs;
    paragraphs.load(withIds ? "items/text,items/uniqueLocalId" : "items/text");
    await context.sync();
    return paragraphs.items.map((paragraph, index) => ({ index, text: paragraph.text, id: withIds ? paragraph.uniqueLocalId : null }));
}

// --- Soulignés dans le texte ---
const COLORS = { orthographe: "Red", grammaire: "Blue", style: "Lavender", typographie: "Lavender" };
const TITLES = { orthographe: "Critique.Ortho", grammaire: "Critique.Gram", style: "Critique.Style", typographie: "Critique.Style" };

function createAnnotations() {
    // Nos annotations : paragraphe → identifiants, identifiant → élément du panneau.
    const byBlock = new Map();
    const items = new Map();

    async function remove(context, ids) {
        if (!ids.length) {
            return;
        }
        for (const id of ids) {
            items.delete(id);
            context.document.getAnnotationById(id).delete();
        }
        try {
            await context.sync();
        } catch {
            // Word les a déjà retirées (texte modifié) : rien à faire.
        }
    }

    async function insert(context, block, blockItems) {
        await remove(context, byBlock.get(block.id) ?? []);
        byBlock.delete(block.id);
        const critiques = blockItems.map((item) => ({
            colorScheme: globalThis.Word?.CritiqueColorScheme?.[COLORS[item.match.kind]?.toLowerCase()] ?? COLORS[item.match.kind] ?? "Lavender",
            start: item.match.start,
            length: item.match.end - item.match.start,
            popupOptions: {
                brandingTextResourceId: "Critique.Brand",
                titleResourceId: TITLES[item.match.kind] ?? "Critique.Style",
                subtitleResourceId: "Critique.Sub",
                suggestions: item.match.suggestions.filter(Boolean).slice(0, 5),
            },
        })).filter((critique) => critique.length > 0);
        if (!critiques.length) {
            return;
        }
        const paragraph = context.document.getParagraphByUniqueLocalId(block.id);
        paragraph.load("text");
        await context.sync();
        // Le texte a bougé depuis l'analyse : les positions ne valent plus, on ne souligne pas.
        if (paragraph.text !== block.text) {
            return;
        }
        const ids = paragraph.insertAnnotations({ critiques });
        await context.sync();
        byBlock.set(block.id, ids.value);
        ids.value.forEach((id, i) => items.set(id, blockItems[i]));
    }

    return {
        // Remplace nos soulignés par ceux de ces paragraphes ([{ block, items }]). all : tout le
        // document est concerné (les autres paragraphes perdent leurs soulignés).
        async show(groups, { all = false } = {}) {
            return Word.run(async (context) => {
                if (all) {
                    const keep = new Set(groups.map(({ block }) => block.id));
                    for (const [id, ids] of byBlock) {
                        if (!keep.has(id)) {
                            await remove(context, ids);
                            byBlock.delete(id);
                        }
                    }
                }
                for (const { block, items: blockItems } of groups) {
                    if (block.id) {
                        await insert(context, block, blockItems);
                    }
                }
            });
        },
        async clear() {
            return Word.run(async (context) => {
                for (const ids of byBlock.values()) {
                    await remove(context, ids);
                }
                byBlock.clear();
            });
        },
        itemFor: (id) => items.get(id) ?? null,
        // Événements de Word : bulle (suggestion acceptée ou refusée), clic, paragraphes modifiés.
        async listen({ onPopup, onClick, onParagraphs }) {
            return Word.run(async (context) => {
                context.document.onAnnotationPopupAction.add(async (args) => onPopup(args, items.get(args.id) ?? null));
                context.document.onAnnotationClicked.add(async (args) => onClick(items.get(args.id) ?? null));
                for (const event of ["onParagraphChanged", "onParagraphAdded", "onParagraphDeleted"]) {
                    context.document[event]?.add(async (args) => onParagraphs(args.uniqueLocalIds ?? [], args.type ?? event));
                }
                await context.sync();
            });
        },
    };
}

export function createWordHost() {
    return {
        name: "Word",
        scopes: [
            { id: "document", label: "Vérifier le document" },
            { id: "selection", label: "Vérifier la sélection" },
        ],
        // Soulignés et vérification en direct : Word avec WordApi 1.8 (Microsoft 365).
        annotations: supports("1.8") ? createAnnotations() : null,

        // Paragraphes à analyser : tout le document, ou ceux que touche la sélection.
        async readBlocks(scope) {
            return Word.run(async (context) => {
                const all = await readAll(context);
                if (scope !== "selection") {
                    return all;
                }
                const selected = context.document.getSelection().paragraphs;
                selected.load("items/text");
                await context.sync();
                // Les paragraphes de la sélection, retrouvés dans le corps (même suite de textes).
                const wanted = selected.items.map((paragraph) => paragraph.text);
                for (let i = 0; i + wanted.length <= all.length; i++) {
                    if (wanted.every((text, j) => all[i + j].text === text)) {
                        return all.slice(i, i + wanted.length);
                    }
                }
                return [];
            });
        },

        // Tous les paragraphes (vérification en direct : positions à jour, paragraphes modifiés).
        async readAll() {
            return Word.run((context) => readAll(context));
        },

        // Montre le passage dans le document. Renvoie false s'il est introuvable.
        async select(block, match) {
            return Word.run(async (context) => {
                const paragraph = await paragraphAt(context, block);
                const range = await locate(context, paragraph, block.text, match);
                if (!range) {
                    return false;
                }
                range.select();
                await context.sync();
                return true;
            });
        },

        // Remplace des passages d'un même paragraphe (du dernier au premier). Renvoie le nouveau
        // texte du paragraphe et le nombre de remplacements faits.
        async replace(block, edits) {
            return Word.run(async (context) => {
                const paragraph = await paragraphAt(context, block);
                let done = 0;
                for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
                    const range = await locate(context, paragraph, block.text, edit);
                    if (range) {
                        range.insertText(edit.replacement, "Replace");
                        await context.sync();
                        done++;
                    }
                }
                paragraph.load("text");
                await context.sync();
                return { text: paragraph.text, done };
            });
        },

        async selectionText() {
            return Word.run(async (context) => {
                const range = context.document.getSelection();
                range.load("text");
                await context.sync();
                return range.text;
            });
        },

        // Texte du paragraphe où se trouve la sélection (contexte des synonymes).
        async selectionContext() {
            return Word.run(async (context) => {
                const paragraphs = context.document.getSelection().paragraphs;
                paragraphs.load("items/text");
                await context.sync();
                return paragraphs.items.map((paragraph) => paragraph.text).join(" ");
            });
        },

        // where : "Replace" (remplace la sélection) ou "After" (insère après).
        async writeSelection(text, where = "Replace") {
            return Word.run(async (context) => {
                const range = context.document.getSelection();
                const inserted = range.insertText(text, where);
                inserted.select();
                await context.sync();
                return true;
            });
        },
    };
}
