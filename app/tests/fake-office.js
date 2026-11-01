// Faux Office.js pour les tests du complément (chargé à la place de celui de Microsoft).
// Imite la partie de l'API Word utilisée par le panneau, avec ses règles : les opérations sont
// mises en file et ne s'exécutent qu'à context.sync(), et lire une propriété non chargée
// (load + sync) lève une erreur, comme dans Word.
//
// Document : window.__fakeWord = {
//     paragraphs: [textes], selection: { p, start, end, endP?, endOffset? },
//     wordApi: "1.3" (par défaut) ou "1.8" (identifiants, annotations, événements),
//     noSubscription: true (annotations refusées, comme sans Microsoft 365),
//     officeTheme: { bodyBackgroundColor } }
// Rempli par ce script : ids (identifiants des paragraphes), annotations, log, et les commandes
// de test edit(p, texte), insertParagraph(p, texte), deleteParagraph(p), click(id),
// accept(id, suggestion), reject(id).

(() => {
    const doc = window.__fakeWord ?? { paragraphs: [""], selection: { p: 0, start: 0, end: 0 } };
    doc.log = [];
    doc.annotations = [];
    let nextId = 1;
    doc.ids = doc.paragraphs.map(() => `para-${nextId++}`);
    const handlers = { onAnnotationClicked: [], onAnnotationPopupAction: [], onParagraphChanged: [], onParagraphAdded: [], onParagraphDeleted: [] };
    window.__fakeWord = doc;
    const apiAtLeast = (version) => Number(version) <= Number(doc.wordApi ?? "1.3");

    class NotLoaded extends Error {
        constructor(what) {
            super(`PropertyNotLoaded : ${what} lu sans load() + sync()`);
            this.code = "PropertyNotLoaded";
        }
    }

    function fire(event, args) {
        setTimeout(() => handlers[event].forEach((handler) => handler(args)), 0);
    }

    // Texte d'un paragraphe changé : Word retire les annotations qui s'y trouvent.
    function textChanged(p) {
        const pid = doc.ids[p];
        doc.annotations = doc.annotations.filter((annotation) => annotation.pid !== pid);
        fire("onParagraphChanged", { type: "ParagraphChanged", uniqueLocalIds: [pid] });
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
        const event = (name) => ({
            add: (handler) => {
                if (!apiAtLeast(name.startsWith("onParagraph") ? "1.6" : name === "onAnnotationPopupAction" ? "1.8" : "1.7")) {
                    throw new Error(`Faux Word : ${name} demande une version plus récente`);
                }
                handlers[name].push(handler);
                return { remove: () => handlers[name].splice(handlers[name].indexOf(handler), 1) };
            },
        });
        context.document = {
            body: { get paragraphs() {
                return new ParagraphCollection(context, () => [...doc.ids]);
            } },
            getSelection: () => new Range(context, () => selectionBounds()),
            getParagraphByUniqueLocalId: (pid) => new Paragraph(context, pid),
            getAnnotationById: (id) => ({
                delete: () => context.queue.push(() => {
                    const index = doc.annotations.findIndex((annotation) => annotation.id === id);
                    if (index < 0) {
                        throw new Error("ItemNotFound");
                    }
                    doc.annotations.splice(index, 1);
                }),
            }),
            onAnnotationClicked: event("onAnnotationClicked"),
            onAnnotationPopupAction: event("onAnnotationPopupAction"),
            onParagraphChanged: event("onParagraphChanged"),
            onParagraphAdded: event("onParagraphAdded"),
            onParagraphDeleted: event("onParagraphDeleted"),
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
                if (where === "Replace") {
                    doc.paragraphs[b.p] = value.slice(0, b.start) + text + value.slice(b.end);
                    result = { p: b.p, start: b.start, endP: b.p, end: b.start + text.length };
                } else if (where === "After") {
                    doc.paragraphs[b.p] = value.slice(0, b.end) + text + value.slice(b.end);
                    result = { p: b.p, start: b.end, endP: b.p, end: b.end + text.length };
                } else {
                    throw new Error(`Faux Word : emplacement ${where} non pris en charge`);
                }
                doc.log.push(["insertText", where, textOf(b), text]);
                textChanged(b.p);
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
                return doc.ids.slice(b.p, b.endP + 1);
            });
        }
    }

    // Un paragraphe suit son identifiant : sa position est recalculée à chaque opération.
    class Paragraph extends Range {
        constructor(context, pid) {
            super(context, () => {
                const p = doc.ids.indexOf(pid);
                if (p < 0) {
                    throw new Error("ItemNotFound");
                }
                return { p, start: 0, endP: p, end: doc.paragraphs[p].length };
            });
            this.pid = pid;
            this.idLoaded = false;
        }
        get uniqueLocalId() {
            if (!apiAtLeast("1.6")) {
                throw new Error("Faux Word : uniqueLocalId demande WordApi 1.6");
            }
            if (!this.idLoaded) {
                throw new NotLoaded("Paragraph.uniqueLocalId");
            }
            return this.pid;
        }
        load(spec = "") {
            super.load();
            if (/uniqueLocalId/.test(spec)) {
                this.context.queue.push(() => {
                    this.idLoaded = true;
                });
            }
            return this;
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
                const { p } = this.bounds();
                const literal = needle.replace(/\^\^/g, "^");
                const text = doc.paragraphs[p];
                const found = [];
                for (let from = 0; ;) {
                    const at = text.indexOf(literal, from);
                    if (at < 0) {
                        break;
                    }
                    found.push(at);
                    from = at + literal.length;
                }
                return found.map((at) => new Range(this.context, () => ({ p, start: at, endP: p, end: at + literal.length })));
            };
            return collection;
        }
        insertAnnotations(set) {
            if (!apiAtLeast("1.7")) {
                throw new Error("Faux Word : insertAnnotations demande WordApi 1.7");
            }
            const result = {
                get value() {
                    if (!this.ready) {
                        throw new NotLoaded("ClientResult.value");
                    }
                    return this.ids;
                },
            };
            this.context.queue.push(() => {
                if (doc.noSubscription) {
                    throw new Error("GeneralException : service d'annotations indisponible (pas d'abonnement Microsoft 365)");
                }
                const { end } = this.bounds();
                result.ids = set.critiques.map((critique) => {
                    if (critique.start < 0 || critique.start + critique.length > end) {
                        throw new Error("Faux Word : annotation hors du paragraphe");
                    }
                    const id = `annotation-${nextId++}`;
                    doc.annotations.push({ id, pid: this.pid, ...critique, suggestions: critique.popupOptions?.suggestions ?? [] });
                    return id;
                });
                result.ready = true;
            });
            return result;
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
                for (const item of this.loadedItems) {
                    if (/text/.test(spec)) {
                        item.snapshot = textOf(item.bounds());
                        item.loaded = true;
                    }
                    if (/uniqueLocalId/.test(spec)) {
                        item.idLoaded = true;
                    }
                }
            });
            return this;
        }
    }

    class ParagraphCollection extends RangeCollection {
        constructor(context, pids) {
            super(context);
            this.compute = () => pids().map((pid) => new Paragraph(context, pid));
        }
    }

    // --- Commandes de test : ce que ferait l'utilisateur dans Word ---
    doc.edit = (p, text) => {
        doc.paragraphs[p] = text;
        textChanged(p);
    };
    doc.insertParagraph = (p, text) => {
        const pid = `para-${nextId++}`;
        doc.paragraphs.splice(p, 0, text);
        doc.ids.splice(p, 0, pid);
        fire("onParagraphAdded", { type: "ParagraphAdded", uniqueLocalIds: [pid] });
    };
    doc.deleteParagraph = (p) => {
        const [pid] = doc.ids.splice(p, 1);
        doc.paragraphs.splice(p, 1);
        doc.annotations = doc.annotations.filter((annotation) => annotation.pid !== pid);
        fire("onParagraphDeleted", { type: "ParagraphDeleted", uniqueLocalIds: [pid] });
    };
    doc.click = (id) => fire("onAnnotationClicked", { id });
    // Suggestion acceptée dans la bulle : Word remplace le passage.
    doc.accept = (id, suggestion) => {
        const annotation = doc.annotations.find((item) => item.id === id);
        const p = doc.ids.indexOf(annotation.pid);
        const value = doc.paragraphs[p];
        doc.paragraphs[p] = value.slice(0, annotation.start) + suggestion + value.slice(annotation.start + annotation.length);
        fire("onAnnotationPopupAction", { id, action: "Accept", critiqueSuggestion: suggestion });
        textChanged(p);
    };
    doc.reject = (id) => {
        doc.annotations = doc.annotations.filter((item) => item.id !== id);
        fire("onAnnotationPopupAction", { id, action: "Reject" });
    };

    window.Word = {
        run: async (batch) => batch(createContext()),
        CritiqueColorScheme: { red: "Red", green: "Green", blue: "Blue", lavender: "Lavender", berry: "Berry" },
    };
    window.Office = {
        HostType: { Word: "Word", Outlook: "Outlook" },
        context: {
            requirements: { isSetSupported: (name, version) => name === "WordApi" && apiAtLeast(version) },
            officeTheme: doc.officeTheme,
        },
        onReady(callback) {
            const info = { host: "Word", platform: "PC" };
            setTimeout(() => callback?.(info), 0);
            return Promise.resolve(info);
        },
    };
})();
