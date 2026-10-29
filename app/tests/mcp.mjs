// Test du serveur MCP d'Aria Plume, sur stdio, avec les deux générations du protocole.
//     node tests/mcp.mjs                       serveur Node seul (app/mcp/standalone.mjs)
//     xvfb-run -a node tests/mcp.mjs --app      l'application (Electron) lancée avec --mcp
//     APP_BINARY=… xvfb-run -a node tests/mcp.mjs --app   l'application empaquetée
import { spawn } from "node:child_process";
import readline from "node:readline";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const appDir = new URL("..", import.meta.url).pathname;
const useApp = process.argv.includes("--app");
// Serveur Node seul : un fichier de réglages de test (dictionnaire, glossaire).
const settingsFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "aria-mcp-")), "aria-plume-reglages.json");
fs.writeFileSync(settingsFile, JSON.stringify({ dictionary: ["Elegoo"], glossary: [{ fr: "serveur", en: "host" }] }));
const command = !useApp
    ? [process.execPath, [`${appDir}/mcp/standalone.mjs`, settingsFile]]
    : process.env.APP_BINARY
        ? [process.env.APP_BINARY, ["--mcp", "--no-sandbox"]]
        : [`${appDir}/node_modules/electron/dist/electron`, [appDir, "--mcp", "--no-sandbox"]];
const proc = spawn(...command, { env: { ...process.env, NODE_OPTIONS: "" }, stdio: ["pipe", "pipe", "pipe"] });
let stderr = "";
proc.stderr.on("data", (d) => {
    stderr += d;
});
const exited = new Promise((resolve) => proc.on("exit", (code) => resolve(code)));
const waiting = new Map();
const badLines = [];
readline.createInterface({ input: proc.stdout }).on("line", (line) => {
    let message;
    try {
        message = JSON.parse(line);
    } catch {
        badLines.push(line);
        return;
    }
    waiting.get(message.id)?.(message);
});
let seq = 0;
const request = (method, params) => new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => reject(new Error(`pas de réponse à ${method}`)), 60000);
    waiting.set(id, (message) => {
        clearTimeout(timer);
        resolve(message);
    });
    proc.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) })}\n`);
});
const notify = (method) => proc.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method })}\n`);
const modern = (extra = {}) => ({ ...extra, _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientInfo": { name: "test", version: "1" }, "io.modelcontextprotocol/clientCapabilities": {} } });

let failures = 0;
const check = (label, ok, detail = "") => {
    console.log(`${ok ? "OK   " : "ÉCHEC"} ${label}${detail ? ` : ${detail}` : ""}`);
    failures += ok ? 0 : 1;
};

try {
    // Ancienne génération : initialize, puis outils.
    const init = await request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } });
    check("initialize : même version renvoyée", init.result?.protocolVersion === "2025-06-18" && !!init.result.capabilities.tools, JSON.stringify(init.result?.serverInfo));
    const future = await request("initialize", { protocolVersion: "2099-01-01", capabilities: {}, clientInfo: { name: "test", version: "1" } });
    check("initialize : version inconnue → la plus récente de l'ancienne génération", future.result?.protocolVersion === "2025-11-25");
    notify("notifications/initialized");
    const list = await request("tools/list", {});
    check("tools/list", JSON.stringify(list.result?.tools.map((t) => t.name)) === '["corriger","traduire","conjuguer","synonymes"]');

    const fr = await request("tools/call", { name: "corriger", arguments: { texte: "Je pense que il viendras demain, sa va être génial." } });
    const s = fr.result?.structuredContent;
    check("corriger (fr)", s?.langue === "fr" && s.nombre_fautes >= 3, s?.texte_corrige);
    check("corriger : texte corrigé", s?.texte_corrige === "Je pense qu'il viendra demain, ça va être génial.", s?.texte_corrige);
    check("corriger : texte lisible pour l'IA", /Texte corrigé/.test(fr.result?.content?.[0]?.text ?? ""));
    const en = await request("tools/call", { name: "corriger", arguments: { texte: "Your welcome, I'd rather walk then drive.", langue: "en" } });
    check("corriger (en)", en.result?.structuredContent?.texte_corrige === "You're welcome, I'd rather walk than drive.", en.result?.structuredContent?.texte_corrige);
    const formal = await request("tools/call", { name: "corriger", arguments: { texte: "J'ai pas le temps.", francais_soigne: true } });
    check("corriger : français soigné imposé", formal.result?.structuredContent?.nombre_fautes >= 1);
    const tr = await request("tools/call", { name: "traduire", arguments: { texte: "Le pare-feu bloque les connexions entrantes.", vers: "en" } });
    check("traduire", /firewall/i.test(tr.result?.structuredContent?.texte_traduit ?? ""), tr.result?.structuredContent?.texte_traduit);
    const conj = await request("tools/call", { name: "conjuguer", arguments: { verbe: "prenons" } });
    check("conjuguer", /prendre/.test(conj.result?.content?.[0]?.text ?? "") && /nous prenons/.test(conj.result?.content?.[0]?.text ?? ""));
    const syn = await request("tools/call", { name: "synonymes", arguments: { mot: "rapide" } });
    check("synonymes", /vif|prompt/.test(syn.result?.content?.[0]?.text ?? ""));
    const unknownVerb = await request("tools/call", { name: "conjuguer", arguments: { verbe: "conjuger" } });
    check("erreur d'outil lisible (isError)", unknownVerb.result?.isError === true && /conjuguer/.test(unknownVerb.result.content[0].text), unknownVerb.result?.content?.[0]?.text);
    const empty = await request("tools/call", { name: "corriger", arguments: { texte: "  " } });
    check("paramètre vide → isError", empty.result?.isError === true);
    const unknownTool = await request("tools/call", { name: "effacer", arguments: {} });
    check("outil inconnu → erreur -32602", unknownTool.error?.code === -32602);
    const unknownMethod = await request("resources/list", {});
    check("méthode inconnue → -32601", unknownMethod.error?.code === -32601);
    check("ping", !!(await request("ping")).result);

    if (!useApp) {
        const dico = await request("tools/call", { name: "corriger", arguments: { texte: "J'imprime avec mon Elegoo." } });
        check("réglages : dictionnaire respecté", dico.result?.structuredContent?.nombre_fautes === 0, JSON.stringify(dico.result?.structuredContent?.fautes?.map((f) => f.extrait)));
        const glo = await request("tools/call", { name: "traduire", arguments: { texte: "Le serveur est tombé.", vers: "en" } });
        check("réglages : glossaire respecté", /host/i.test(glo.result?.structuredContent?.texte_traduit ?? ""), glo.result?.structuredContent?.texte_traduit);
    }

    // Nouvelle génération (2026-07-28).
    const discover = await request("server/discover", modern());
    check("server/discover", discover.result?.resultType === "complete" && discover.result.supportedVersions.includes("2026-07-28") && discover.result.supportedVersions.includes("2025-11-25") && !!discover.result._meta?.["io.modelcontextprotocol/serverInfo"]);
    const list2 = await request("tools/list", modern());
    check("tools/list (moderne)", list2.result?.resultType === "complete" && list2.result.tools.length === 4);
    const call2 = await request("tools/call", modern({ name: "corriger", arguments: { texte: "Les enfant sont partit." } }));
    check("tools/call (moderne)", call2.result?.resultType === "complete" && call2.result.structuredContent?.texte_corrige === "Les enfants sont partis.", call2.result?.structuredContent?.texte_corrige);
    const old = await request("tools/list", { _meta: { "io.modelcontextprotocol/protocolVersion": "1900-01-01", "io.modelcontextprotocol/clientCapabilities": {} } });
    check("version inconnue → -32022 avec la liste", old.error?.code === -32022 && old.error.data.supported.includes("2026-07-28"));
    const noCaps = await request("tools/list", { _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" } });
    check("capacités client manquantes → -32602", noCaps.error?.code === -32602);
    const probe = await request("server/discover", {});
    check("sonde sans _meta → erreur (client moderne : se rabattre sur initialize)", !!probe.error);

    // Requêtes en parallèle, chacune reçoit sa réponse.
    const many = await Promise.all(["Il à fini.", "Sa va bien.", "Ils on gagné."].map((texte) => request("tools/call", { name: "corriger", arguments: { texte } })));
    check("requêtes en parallèle", many.every((m) => m.result?.structuredContent?.nombre_fautes >= 1));
    check("sortie standard : uniquement du JSON-RPC", badLines.length === 0, badLines.slice(0, 2).join(" | "));
} catch (error) {
    failures += 1;
    console.log("ERREUR", error.message, stderr.slice(-500));
}
proc.stdin.end();
const code = await Promise.race([exited, new Promise((r) => setTimeout(() => r("toujours en vie"), 10000))]);
check("arrêt à la fermeture de l'entrée", code === 0, String(code));
if (code === "toujours en vie") proc.kill();
console.log(failures ? `\n${failures} échec(s)` : "\ntout est bon");
process.exitCode = failures ? 1 : 0;
