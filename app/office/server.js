// Aria Plume (application) — serveur HTTPS local du complément Office (Word, Outlook).
//
// https://localhost:47823, écoute sur 127.0.0.1 et ::1 seulement (jamais sur le réseau).
//   GET  /office/…        pages du complément (dossier office/pages/)
//   GET  /office/ping     { app, version } : vérification du certificat depuis un navigateur
//   POST /api/<commande>  le moteur et les réglages d'Aria Plume (corps et réponse en JSON)
//
// Gardes : nom d'hôte attendu (contre le « DNS rebinding »), et pour /api une origine égale à
// celle du serveur. Une page d'un autre site ne peut donc ni lire les réponses (pas d'en-têtes
// CORS) ni déclencher une commande (origine refusée).

import fs from "node:fs";
import https from "node:https";
import path from "node:path";

export const OFFICE_PORT = 47823;
const MAX_BODY = 10 * 1024 * 1024;
const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".json": "application/json; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
};
// office.js doit venir du serveur de Microsoft (exigence des compléments Office).
const CSP = "default-src 'none'; script-src 'self' https://appsforoffice.microsoft.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors *";

function send(res, status, body, headers = {}) {
    res.writeHead(status, {
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
        "cache-control": "no-store",
        ...headers,
    });
    res.end(body);
}
const json = (res, status, value) => send(res, status, JSON.stringify(value), { "content-type": "application/json; charset=utf-8" });

// roots : { prefix → dossier } servis en GET sous /office/.
export async function startOfficeServer({ port = OFFICE_PORT, cert, key, version, roots, handle, log = () => {} }) {
    const origin = `https://localhost:${port}`;
    const hosts = new Set([`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`]);

    async function onRequest(req, res) {
        if (!hosts.has(String(req.headers.host ?? "").toLowerCase())) {
            send(res, 421, "Hôte refusé");
            return;
        }
        const url = new URL(req.url, origin);
        if (req.method === "POST" && url.pathname.startsWith("/api/")) {
            const from = req.headers.origin;
            if (from !== origin && from !== `https://127.0.0.1:${port}`) {
                log(`complément Office : origine refusée (${from ?? "aucune"})`);
                json(res, 403, { ok: false, error: "Origine refusée." });
                return;
            }
            if (!/^application\/json\b/.test(String(req.headers["content-type"] ?? ""))) {
                json(res, 415, { ok: false, error: "JSON attendu." });
                return;
            }
            const chunks = [];
            let size = 0;
            for await (const chunk of req) {
                size += chunk.length;
                if (size > MAX_BODY) {
                    // Réponse d'abord, puis fermeture de cette connexion seulement (le client ne la
                    // réutilisera pas : « connection: close »).
                    res.on("finish", () => req.destroy());
                    send(res, 413, JSON.stringify({ ok: false, error: "Demande trop volumineuse." }), { "content-type": "application/json; charset=utf-8", connection: "close" });
                    return;
                }
                chunks.push(chunk);
            }
            let msg;
            try {
                msg = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
            } catch {
                json(res, 400, { ok: false, error: "JSON illisible." });
                return;
            }
            const cmd = decodeURIComponent(url.pathname.slice(5));
            try {
                json(res, 200, { ok: true, ...(await handle({ ...msg, cmd })) });
            } catch (error) {
                json(res, 200, { ok: false, error: String(error?.message ?? error) });
            }
            return;
        }
        if (req.method !== "GET" && req.method !== "HEAD") {
            send(res, 405, "Méthode refusée", { allow: "GET, HEAD, POST" });
            return;
        }
        if (url.pathname === "/office/ping") {
            json(res, 200, { app: "Aria Plume", version });
            return;
        }
        // Fichiers : /office/<préfixe>/… → dossier correspondant, sans sortir de ce dossier.
        const relative = decodeURIComponent(url.pathname).replace(/^\/office\/?/, "");
        const entry = url.pathname.startsWith("/office/") || url.pathname === "/office"
            ? roots.find(({ prefix }) => relative === prefix.replace(/\/$/, "") || relative.startsWith(prefix))
            : null;
        let file = entry ? path.resolve(entry.root, relative.slice(entry.prefix.length) || "index.html") : null;
        if (file && fs.existsSync(file) && fs.statSync(file).isDirectory()) {
            file = path.join(file, "index.html");
        }
        const type = TYPES[path.extname(file ?? "")];
        if (!file || !type || !(file === entry.root || file.startsWith(entry.root + path.sep))) {
            send(res, 404, "Introuvable");
            return;
        }
        let body;
        try {
            body = await fs.promises.readFile(file);
        } catch {
            send(res, 404, "Introuvable");
            return;
        }
        send(res, 200, req.method === "HEAD" ? undefined : body, { "content-type": type, "content-security-policy": CSP, "cache-control": "no-cache" });
    }

    const servers = [];
    for (const host of ["127.0.0.1", "::1"]) {
        const server = https.createServer({ cert, key, minVersion: "TLSv1.2" }, (req, res) => {
            onRequest(req, res).catch((error) => {
                log(`complément Office : ${error?.message ?? error}`);
                if (!res.headersSent) {
                    send(res, 500, "Erreur");
                }
            });
        });
        try {
            await new Promise((resolve, reject) => {
                server.once("error", reject);
                server.listen(port, host, () => {
                    server.off("error", reject);
                    resolve();
                });
            });
            servers.push(server);
        } catch (error) {
            // ::1 absent (IPv6 coupé) : 127.0.0.1 suffit. 127.0.0.1 occupé : erreur.
            if (host === "127.0.0.1") {
                throw error;
            }
        }
    }
    return {
        origin,
        close: () => Promise.all(servers.map((server) => new Promise((resolve) => {
            server.closeAllConnections?.();
            server.close(() => resolve());
        }))),
    };
}
