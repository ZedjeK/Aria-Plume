// Aria Plume — serveur MCP dans l'application (Aria Plume.exe --mcp).
// Aucune fenêtre, pas d'icône, pas de verrou d'instance unique (chaque client MCP lance le sien) ;
// les réglages sont ceux de l'application (dictionnaire, glossaire, mots ignorés…), relus quand
// le fichier change. Le processus s'arrête quand le client ferme l'entrée standard.

import { app } from "electron";
import { startMcpServer } from "./server.js";

const { aria, createService } = await import("../engine.js");
const { getValues } = await import("../settings.js");

const service = createService({
    aria,
    getSettings: async (defaults) => getValues(defaults),
    saveValues: async () => {},  // le serveur MCP ne modifie pas les réglages
});

startMcpServer({
    service,
    serverInfo: { name: "aria-plume", title: "Aria Plume", version: app.getVersion() },
    onClose: () => {
        aria.close().catch(() => {});
        app.exit(0);
    },
});
