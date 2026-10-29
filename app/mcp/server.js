// Aria Plume — serveur MCP (Model Context Protocol) sur stdio.
//
// Donne aux IA (Claude Desktop, LM Studio, tout client MCP) quatre outils locaux : corriger,
// traduire, conjuguer, synonymes. Rien ne sort du PC du fait d'Aria Plume : c'est le client qui
// choisit ce qu'il envoie, et à quelle IA.
//
// Compatible avec les deux générations du protocole (serveur « dual-era ») :
//   - ancienne : poignée de main « initialize » (versions 2024-11-05 à 2025-11-25) ;
//   - nouvelle : 2026-07-28, sans poignée de main, version et capacités dans le _meta de chaque
//     requête, et « server/discover » obligatoire.
// Un message JSON par ligne sur la sortie standard, et rien d'autre (les journaux vont sur stderr).
//
// Aucune dépendance : le service du moteur Aria est passé en paramètre (voir app/main.js en
// mode --mcp, et app/mcp/standalone.mjs pour le lancer avec Node seul).

import readline from "node:readline";

const MODERN_VERSIONS = ["2026-07-28"];
const LEGACY_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const META = "io.modelcontextprotocol/";
const MAX_TEXT = 100_000;

const INSTRUCTIONS = "Aria Plume corrige et traduit le français et l'anglais, entièrement en local (Grammalecte, Harper, "
    + "Bergamot et les règles d'Aria). Utilise « corriger » pour relire un texte (il renvoie les fautes et le texte corrigé), "
    + "« traduire » pour le français ↔ anglais (avec le glossaire de l'utilisateur), « conjuguer » pour un verbe français, "
    + "« synonymes » pour un mot. Le dictionnaire personnel et les mots ignorés de l'utilisateur sont respectés.";

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export const TOOLS = [
    {
        name: "corriger",
        title: "Corriger un texte (français ou anglais)",
        description: "Relit un texte en français ou en anglais : orthographe, grammaire, accords, conjugaison, homophones, "
            + "typographie et style. Renvoie chaque faute (extrait, position, explication, suggestions) et le texte corrigé "
            + "en appliquant la première suggestion de chaque faute d'orthographe, de grammaire et de typographie. "
            + "Proofreads French or English text and returns the errors and a corrected version.",
        inputSchema: {
            type: "object",
            properties: {
                texte: { type: "string", description: "Le texte à relire (100 000 caractères au plus)." },
                langue: { type: "string", enum: ["auto", "fr", "en"], default: "auto", description: "Langue du texte ; « auto » la détecte." },
                francais_soigne: { type: "boolean", description: "Français écrit soigné (« ne » de la négation, « se rappeler de »…). Par défaut : le réglage de l'utilisateur." },
            },
            required: ["texte"],
            additionalProperties: false,
        },
        outputSchema: {
            type: "object",
            properties: {
                langue: { type: "string" },
                nombre_fautes: { type: "integer" },
                fautes: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            extrait: { type: "string" },
                            debut: { type: "integer" },
                            fin: { type: "integer" },
                            type: { type: "string" },
                            message: { type: "string" },
                            suggestions: { type: "array", items: { type: "string" } },
                            regle: { type: "string" },
                        },
                        required: ["extrait", "debut", "fin", "type", "message", "suggestions"],
                    },
                },
                texte_corrige: { type: "string" },
            },
            required: ["langue", "nombre_fautes", "fautes", "texte_corrige"],
        },
        annotations: READ_ONLY,
    },
    {
        name: "traduire",
        title: "Traduire (français ↔ anglais)",
        description: "Traduit un texte du français vers l'anglais ou de l'anglais vers le français, avec le glossaire de "
            + "l'utilisateur (termes imposés, termes à ne jamais traduire). Translates between French and English, locally.",
        inputSchema: {
            type: "object",
            properties: {
                texte: { type: "string", description: "Le texte à traduire (100 000 caractères au plus)." },
                de: { type: "string", enum: ["auto", "fr", "en"], default: "auto", description: "Langue d'origine ; « auto » la détecte." },
                vers: { type: "string", enum: ["fr", "en"], description: "Langue d'arrivée (par défaut : l'autre langue)." },
            },
            required: ["texte"],
            additionalProperties: false,
        },
        outputSchema: {
            type: "object",
            properties: {
                de: { type: "string" },
                vers: { type: "string" },
                texte_traduit: { type: "string" },
            },
            required: ["de", "vers", "texte_traduit"],
        },
        annotations: READ_ONLY,
    },
    {
        name: "conjuguer",
        title: "Conjuguer un verbe français",
        description: "Conjugue un verbe français à tous les temps (indicatif, subjonctif, conditionnel, impératif). Accepte "
            + "un infinitif ou une forme conjuguée (« prenons » → prendre). Conjugates a French verb.",
        inputSchema: {
            type: "object",
            properties: {
                verbe: { type: "string", description: "Le verbe : infinitif (prendre, se lever) ou forme conjuguée." },
                pronominal: { type: "boolean", default: false },
                negation: { type: "boolean", default: false },
                interrogatif: { type: "boolean", default: false },
                temps_composes: { type: "boolean", default: false },
                feminin: { type: "boolean", default: false },
            },
            required: ["verbe"],
            additionalProperties: false,
        },
        annotations: READ_ONLY,
    },
    {
        name: "synonymes",
        title: "Synonymes (français ou anglais)",
        description: "Donne des synonymes d'un mot français ou anglais, groupés par sens et accordés comme le mot demandé "
            + "quand c'est possible. Le contexte (la phrase) aide à choisir la langue. Finds synonyms.",
        inputSchema: {
            type: "object",
            properties: {
                mot: { type: "string", description: "Le mot." },
                contexte: { type: "string", description: "Facultatif : la phrase où se trouve le mot." },
            },
            required: ["mot"],
            additionalProperties: false,
        },
        annotations: READ_ONLY,
    },
];

class ToolError extends Error {}

const text = (value) => (typeof value === "string" ? value : "");
const bool = (value) => value === true;

function checkText(value, name) {
    const s = text(value);
    if (!s.trim()) {
        throw new ToolError(`Le paramètre « ${name} » est vide.`);
    }
    if (s.length > MAX_TEXT) {
        throw new ToolError(`Le texte est trop long (${s.length} caractères, ${MAX_TEXT} au plus) : découpe-le.`);
    }
    return s;
}

// Texte corrigé : première suggestion des fautes d'orthographe, de grammaire et de typographie,
// sans chevauchement (comme « Tout corriger »).
function applyFirstSuggestions(source, matches) {
    const edits = [];
    for (const m of [...matches].sort((a, b) => a.start - b.start)) {
        if (!["orthographe", "grammaire", "typographie"].includes(m.kind) || !m.suggestions.length || edits.some((e) => m.start < e.end && m.end > e.start)) {
            continue;
        }
        edits.push(m);
    }
    let out = source;
    for (const e of edits.reverse()) {
        out = out.slice(0, e.start) + e.suggestions[0] + out.slice(e.end);
    }
    return out;
}

export function createTools(service) {
    return {
        async corriger(args) {
            const source = checkText(args.texte, "texte");
            const lang = ["fr", "en"].includes(args.langue) ? args.langue : "auto";
            const result = await service.check({ text: source, lang, formal: typeof args.francais_soigne === "boolean" ? args.francais_soigne : null, personal: true });
            const fautes = result.matches.map((m) => ({
                extrait: source.slice(m.start, m.end),
                debut: m.start,
                fin: m.end,
                type: m.kind,
                message: m.message,
                suggestions: m.suggestions.slice(0, 5),
                regle: m.rule,
            }));
            const corrige = applyFirstSuggestions(source, result.matches);
            const lines = fautes.map((f, i) => `${i + 1}. « ${f.extrait} » (${f.type}) → ${f.suggestions.length ? f.suggestions.map((s) => `« ${s} »`).join(", ") : "pas de suggestion"} : ${f.message}`);
            const summary = fautes.length
                ? `${fautes.length} remarque${fautes.length > 1 ? "s" : ""} (langue : ${result.lang}).\n\n${lines.join("\n")}\n\nTexte corrigé :\n${corrige}`
                : `Aucune faute trouvée (langue : ${result.lang}).`;
            return { text: summary, structured: { langue: result.lang, nombre_fautes: fautes.length, fautes, texte_corrige: corrige } };
        },

        async traduire(args) {
            const source = checkText(args.texte, "texte");
            const to = ["fr", "en"].includes(args.vers) ? args.vers : undefined;
            // Langue d'arrivée donnée sans langue d'origine : l'origine est l'autre langue.
            const from = ["fr", "en"].includes(args.de) ? args.de : to ? (to === "fr" ? "en" : "fr") : "auto";
            if (to === from) {
                throw new ToolError("La langue d'origine et la langue d'arrivée sont identiques.");
            }
            const result = await service.translate({ text: source, from, to });
            return { text: result.text, structured: { de: result.from, vers: result.to, texte_traduit: result.text } };
        },

        async conjuguer(args) {
            const verb = checkText(args.verbe, "verbe").trim().slice(0, 60);
            const options = { pronominal: bool(args.pronominal), negative: bool(args.negation), interrogative: bool(args.interrogatif), compound: bool(args.temps_composes), feminine: bool(args.feminin) };
            const r = await service.conjugate({ verb, options });
            if (!r.found) {
                throw new ToolError(`« ${r.input} » : verbe inconnu.${r.suggestions?.length ? ` Tu voulais dire : ${r.suggestions.join(", ")} ?` : ""}`);
            }
            const head = [`${r.infinitiveForm}${r.fromForm ? ` (depuis « ${r.input} »)` : ""} — ${r.info}, auxiliaire ${r.auxiliary}`,
                `Participe présent : ${r.presentParticiple} · participes passés : ${r.pastParticiples.join(", ")}`];
            const body = r.moods.map((mood) => `\n${mood.name.toUpperCase()}\n${mood.tenses.map((t) => `${t.name} : ${t.forms.filter(Boolean).join(", ")}`).join("\n")}`);
            return { text: [...head, ...body].join("\n"), structured: r };
        },

        async synonymes(args) {
            const word = checkText(args.mot, "mot").trim().slice(0, 80);
            const r = await service.synonyms({ word, context: text(args.contexte).slice(0, 2000) });
            if (!r.groups?.length) {
                return { text: `Pas de synonyme trouvé pour « ${word} ».`, structured: { mot: word, langue: r.lang, groupes: [] } };
            }
            const lines = r.groups.map((g) => `${g.pos} : ${g.words.join(", ")}`);
            return { text: `Synonymes de « ${word} » (${r.lang}${r.lemma && r.lemma !== word ? `, ${r.lemma}` : ""}) :\n${lines.join("\n")}`, structured: { mot: word, langue: r.lang, groupes: r.groups } };
        },
    };
}

// --- Protocole ---

const rpcError = (code, message, data) => ({ code, message, ...(data === undefined ? {} : { data }) });

export function startMcpServer({ service, serverInfo, input = process.stdin, output = process.stdout, log = (...args) => console.error(...args), onClose = () => {} }) {
    const tools = createTools(service);
    const send = (message) => {
        output.write(`${JSON.stringify(message)}\n`);
    };

    async function callTool(params) {
        const name = params?.name;
        const run = tools[name];
        if (!run) {
            return { error: rpcError(-32602, `Outil inconnu : ${name}`) };
        }
        try {
            const { text: body, structured } = await run(params.arguments ?? {});
            const result = { content: [{ type: "text", text: body }], isError: false };
            if (structured !== undefined && TOOLS.find((t) => t.name === name)?.outputSchema) {
                result.structuredContent = structured;
            }
            return { result };
        } catch (error) {
            if (!(error instanceof ToolError)) {
                log("Aria Plume MCP :", error);
            }
            return { result: { content: [{ type: "text", text: error instanceof ToolError ? error.message : `Erreur du moteur : ${error?.message ?? error}` }], isError: true } };
        }
    }

    async function handle(message) {
        const { id, method, params } = message;
        const meta = params?._meta ?? {};
        const modernVersion = meta[`${META}protocolVersion`];

        // --- Nouvelle génération (2026-07-28) : tout est dans le _meta de chaque requête ---
        if (modernVersion !== undefined) {
            if (!MODERN_VERSIONS.includes(modernVersion)) {
                return { error: rpcError(-32022, "Unsupported protocol version", { supported: [...MODERN_VERSIONS, ...LEGACY_VERSIONS], requested: modernVersion }) };
            }
            if (typeof meta[`${META}clientCapabilities`] !== "object" || meta[`${META}clientCapabilities`] === null) {
                return { error: rpcError(-32602, "Invalid params: io.modelcontextprotocol/clientCapabilities manquant") };
            }
            const complete = (result) => ({ result: { resultType: "complete", ...result, _meta: { ...(result._meta ?? {}), [`${META}serverInfo`]: serverInfo } } });
            switch (method) {
                case "server/discover":
                    return complete({ supportedVersions: [...MODERN_VERSIONS, ...LEGACY_VERSIONS], capabilities: { tools: {} }, instructions: INSTRUCTIONS });
                case "ping":
                    return complete({});
                case "tools/list":
                    return complete({ tools: TOOLS });
                case "tools/call": {
                    const outcome = await callTool(params);
                    return outcome.error ? outcome : complete(outcome.result);
                }
                default:
                    return { error: rpcError(-32601, `Méthode inconnue : ${method}`) };
            }
        }

        // --- Ancienne génération : poignée de main « initialize », puis requêtes simples ---
        switch (method) {
            case "initialize": {
                const requested = params?.protocolVersion;
                const protocolVersion = LEGACY_VERSIONS.includes(requested) ? requested : LEGACY_VERSIONS[0];
                return { result: { protocolVersion, capabilities: { tools: {} }, serverInfo, instructions: INSTRUCTIONS } };
            }
            case "ping":
                return { result: {} };
            case "tools/list":
                return { result: { tools: TOOLS } };
            case "tools/call":
                return callTool(params);
            case "server/discover":
                // Sonde d'un client moderne sans _meta : requête mal formée.
                return { error: rpcError(-32602, "Invalid params: _meta io.modelcontextprotocol/protocolVersion manquant") };
            default:
                return { error: rpcError(-32601, `Méthode inconnue : ${method}`) };
        }
    }

    const lines = readline.createInterface({ input, crlfDelay: Infinity });
    let pending = 0;
    let closing = false;
    const maybeClose = () => {
        if (closing && pending === 0) {
            onClose();
        }
    };
    lines.on("line", (line) => {
        if (!line.trim()) {
            return;
        }
        let message;
        try {
            message = JSON.parse(line);
        } catch {
            send({ jsonrpc: "2.0", id: null, error: rpcError(-32700, "Parse error") });
            return;
        }
        if (!message || typeof message !== "object" || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
            if (message?.id !== undefined && message?.method === undefined) {
                return;  // réponse d'un client : ce serveur n'envoie pas de requêtes
            }
            send({ jsonrpc: "2.0", id: message?.id ?? null, error: rpcError(-32600, "Invalid Request") });
            return;
        }
        if (message.id === undefined || message.id === null) {
            return;  // notification (initialized, cancelled…) : pas de réponse
        }
        pending += 1;
        handle(message)
            .catch((error) => {
                log("Aria Plume MCP :", error);
                return { error: rpcError(-32603, "Internal error") };
            })
            .then((outcome) => {
                send({ jsonrpc: "2.0", id: message.id, ...outcome });
            })
            .finally(() => {
                pending -= 1;
                maybeClose();
            });
    });
    lines.on("close", () => {
        closing = true;
        maybeClose();
    });
    log(`Aria Plume MCP ${serverInfo.version} prêt (stdio).`);
}
