// Aria Plume — serveur MCP avec Node seul (sans Electron) : pour les tests, ou pour qui a Node 22.
//
//     node app/mcp/standalone.mjs [chemin/vers/aria-plume-reglages.json]
//
// Les réglages (dictionnaire, glossaire, mots ignorés, français soigné…) sont lus dans le fichier
// donné, sinon ceux par défaut. L'application, elle, se lance en serveur MCP avec « --mcp ».

import fs from "node:fs";
import { createAria } from "../../extension/core/index.js";
import { nodePlatform } from "../../extension/core/platform/node.js";
import { createService } from "../../extension/core/service.js";
import { DEFAULTS, sanitize } from "../../extension/core/shared/settings.js";
import { startMcpServer } from "./server.js";

const file = process.argv[2];
let stored = {};
if (file) {
    try {
        stored = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
        console.error(`Réglages illisibles (${file}) : valeurs par défaut.`, error.message);
    }
}
const settings = { ...DEFAULTS, ...sanitize(stored) };
const version = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

const aria = createAria(nodePlatform);
const service = createService({
    aria,
    getSettings: async (defaults) => Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, key in settings ? settings[key] : fallback])),
    saveValues: async () => {},
});

startMcpServer({
    service,
    serverInfo: { name: "aria-plume", title: "Aria Plume", version },
    onClose: () => aria.close().finally(() => process.exit(0)),
});
