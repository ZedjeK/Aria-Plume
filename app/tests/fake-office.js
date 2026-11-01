// Faux Office.js pour les tests du complément (chargé à la place de celui de Microsoft).
// Imite la partie de l'API Word utilisée par le panneau, avec ses règles : les opérations sont
// mises en file et ne s'exécutent qu'à context.sync(), et lire une propriété non chargée
// (load + sync) lève une erreur, comme dans Word.
//
// Document : window.__fakeWord.paragraphs (textes), window.__fakeWord.selection
// ({ p, start, end, endP?, endOffset? }), window.__fakeWord.log (opérations faites).

(() => {
    const doc = window.__fakeWord ?? { paragraphs: [""], selection: { p: 0, start: 0, end: 0 } };
    doc.log = [];
    window.__fakeWord = doc;

    class NotLoaded extends Error {
        constructor(what) {
            super(`PropertyNotLoaded : ${what} lu sans load() + sync()`);
            this.code = "PropertyNotLoaded";
        }
    }

    // Une file par contexte : chaque opération s'exécute au sync, dans l'ordre.
    function createContext() {
        const queue = [];
        const context = {
            queue,
            sync: async () => {
                await new Promise((resolve) => setTimeout(resolve, 0));
                for (const op of queue.splice(0)) {
                    op();
                }
            },
        };
        context.document = {
            body: { get paragraphs() {
                return new ParagraphCollection(context, () => doc.paragraphs.map((_, p) => p));
            } },
            getSelection: () => new Range(context, () => selectionBounds()),
        };
        return context;
    }

    function selectionBounds() {
        const s = doc.selection;
        return { p: s.p, start: s.start, endP: s.endP ?? s.p, end: s.endP === undefined ? s.end : s.endOffset };
    }

    function textOf({ p, start, endP, end }) {
        if (p === endP) {
            return doc.paragraphs[p].slice(start, end);
        }
        const parts = [doc.paragraphs[p].slice(start)];
        for (let i = p + 1; i < endP; i++) {
            parts.push(doc.paragraphs[i]);
        }
        parts.push(doc.paragraphs[endP].slice(0, end));
        return parts.join("\r");
    }

    class Range {
        // bounds() : position calculée au moment où une opération s'exécute.
        constructor(context, bounds) {
            this.context = context;
            this.bounds = bounds;
            this.loaded = false;
            this.snapshot = null;
        }
        get text() {
            if (!this.loaded) {
                throw new NotLoaded("Range.text");
            }
            return this.snapshot;
        }
        load() {
            this.context.queue.push(() => {
                this.snapshot = textOf(this.bounds());
                this.loaded = true;
            });
            return this;
        }
        select() {
            this.context.queue.push(() => {
                const b = this.bounds();
                doc.selection = b.p === b.endP ? { p: b.p, start: b.start, end: b.end } : { p: b.p, start: b.start, endP: b.endP, endOffset: b.end };
                doc.log.push(["select", textOf(b)]);
            });
        }
        insertText(text, where) {
            let result = null;
            this.context.queue.push(() => {
                const b = this.bounds();
                if (b.p !== b.endP) {
                    throw new Error("Faux Word : insertion sur plusieurs paragraphes non prise en charge");
                }
                const value = doc.paragraphs[b.p];
                const at = where === "After" ? b.end : b.start;
                const until = where === "After" ? b.end : b.end;
                if (where === "Replace") {
                    doc.paragraphs[b.p] = value.slice(0, b.start) + text + value.slice(b.end);
                } else if (where === "After") {
                    doc.paragraphs[b.p] = value.slice(0, at) + text + value.slice(until);
                } else {
                    throw new Error(`Faux Word : emplacement ${where} non pris en charge`);
                }
                result = { p: b.p, start: at, endP: b.p, end: at + text.length };
                doc.log.push(["insertText", where, textOf(b), text]);
            });
            return new Range(this.context, () => result);
        }
        expandTo(other) {
            return new Range(this.context, () => {
                const a = this.bounds();
                const b = other.bounds();
                return { p: a.p, start: Math.min(a.start, b.start), endP: a.endP, end: Math.max(a.end, b.end) };
            });
        }
        get paragraphs() {
            return new ParagraphCollection(this.context, () => {
                const b = this.bounds();
                return Array.from({ length: b.endP - b.p + 1 }, (_, i) => b.p + i);
            });
        }
    }

    class Paragraph extends Range {
        constructor(context, p) {
            super(context, () => ({ p, start: 0, endP: p, end: doc.paragraphs[p].length }));
            this.p = p;
        }
        // Recherche de Word : texte exact (casse respectée), de gauche à droite, sans chevauchement.
        search(needle, options = {}) {
            const collection = new RangeCollection(this.context);
            if (needle.length > 255) {
                throw new Error("Faux Word : SearchStringInvalidOrTooLong");
            }
            if (!options.matchCase) {
                throw new Error("Faux Word : le panneau doit chercher avec matchCase");
            }
            collection.compute = () => {
                const literal = needle.replace(/\^\^/g, "^");
                const text = doc.paragraphs[this.p];
                const found = [];
                for (let from = 0; ;) {
                    const at = text.indexOf(literal, from);
                    if (at < 0) {
                        break;
                    }
                    found.push(at);
                    from = at + literal.length;
                }
                return found.map((at) => new Range(this.context, () => ({ p: this.p, start: at, endP: this.p, end: at + literal.length })));
            };
            return collection;
        }
    }

    class RangeCollection {
        constructor(context) {
            this.context = context;
            this.loadedItems = null;
        }
        get items() {
            if (!this.loadedItems) {
                throw new NotLoaded("items");
            }
            return this.loadedItems;
        }
        load(spec = "") {
            this.context.queue.push(() => {
                this.loadedItems = this.compute();
                if (/text/.test(spec)) {
                    for (const item of this.loadedItems) {
                        item.snapshot = textOf(item.bounds());
                        item.loaded = true;
                    }
                }
            });
            return this;
        }
    }

    class ParagraphCollection extends RangeCollection {
        constructor(context, indexes) {
            super(context);
            this.compute = () => indexes().map((p) => new Paragraph(context, p));
        }
    }

    window.Word = {
        run: async (batch) => batch(createContext()),
    };
    window.Office = {
        HostType: { Word: "Word", Outlook: "Outlook" },
        context: {
            requirements: { isSetSupported: (name, version) => name === "WordApi" && Number(version) <= Number(doc.wordApi ?? "1.3") },
            officeTheme: doc.officeTheme,
        },
        onReady(callback) {
            const info = { host: "Word", platform: "PC" };
            setTimeout(() => callback?.(info), 0);
            return Promise.resolve(info);
        },
    };
})();
