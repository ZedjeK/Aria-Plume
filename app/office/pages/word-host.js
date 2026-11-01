// Aria Plume — complément Word : ce que le panneau demande à Word.
// Bases de l'API Word présentes depuis Word 2016 (WordApi 1.1), plus Range.expandTo (1.3) pour
// les très longs passages. Un « bloc » est un paragraphe du corps du document : { index, text }.

/* global Word */

import { escapeSearch, searchPlan } from "./locate.js";

// Le paragraphe a changé depuis l'analyse : on ne touche à rien.
export class ChangedError extends Error {}

async function paragraphAt(context, block) {
    const paragraphs = context.document.body.paragraphs;
    paragraphs.load("items/text");
    await context.sync();
    const paragraph = paragraphs.items[block.index];
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

export function createWordHost() {
    return {
        name: "Word",
        scopes: [
            { id: "document", label: "Vérifier le document" },
            { id: "selection", label: "Vérifier la sélection" },
        ],

        // Paragraphes à analyser : tout le document, ou ceux que touche la sélection.
        async readBlocks(scope) {
            return Word.run(async (context) => {
                const paragraphs = context.document.body.paragraphs;
                paragraphs.load("items/text");
                let selected = null;
                if (scope === "selection") {
                    selected = context.document.getSelection().paragraphs;
                    selected.load("items/text");
                }
                await context.sync();
                const all = paragraphs.items.map((paragraph, index) => ({ index, text: paragraph.text }));
                if (!selected) {
                    return all;
                }
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
