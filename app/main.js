// Aria Plume (application) — point d'entrée.
//   Aria Plume.exe          l'application : fenêtre, icône près de l'horloge, raccourci global (app-main.js)
//   Aria Plume.exe --mcp    serveur MCP sur stdio, sans fenêtre, pour Claude Desktop, LM Studio… (mcp/electron.js)

if (process.argv.includes("--mcp")) {
    await import("./mcp/electron.js");
} else {
    await import("./app-main.js");
}
