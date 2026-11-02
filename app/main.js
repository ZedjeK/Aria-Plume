// Aria Plume (application) — point d'entrée.
//   Aria Plume.exe          l'application : fenêtre, icône près de l'horloge, raccourci global (app-main.js)
//   Aria Plume.exe --mcp    serveur MCP sur stdio, sans fenêtre, pour Claude Desktop, LM Studio… (mcp/electron.js)

// Toutes les données dans C:\Users\<toi>\.Aria-Plume (voir paths.js), avant tout le reste.
const { useDataDir, migrateOldSettings } = await import("./paths.js");
useDataDir();
const migrated = migrateOldSettings();
if (migrated) {
    console.error(`Réglages repris de ${migrated}`);
}

if (process.argv.includes("--mcp")) {
    await import("./mcp/electron.js");
} else {
    await import("./app-main.js");
}
