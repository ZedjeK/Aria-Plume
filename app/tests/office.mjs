// Test du serveur HTTPS local du complément Office, sans Electron : certificats (autorité limitée
// à localhost, clé jetée), fichiers, connexion TLS vérifiée, pages, API, gardes (hôte, origine,
// type, taille, chemins).
//     node tests/office.mjs
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { createLocalhostCertificates } from "../office/cert.js";
import { ensureCertificates, isTrusted, loadCertificates, removeCertificates, trust } from "../office/install.js";
import { startOfficeServer } from "../office/server.js";

let failures = 0;
const check = (label, ok, detail = "") => {
    console.log(`${ok ? "OK   " : "ÉCHEC"} ${label}${detail ? ` : ${detail}` : ""}`);
    failures += ok ? 0 : 1;
};

// --- Certificats ---
const made = createLocalhostCertificates();
const ca = new crypto.X509Certificate(made.caDer);
const leaf = new crypto.X509Certificate(made.cert);
check("autorité : auto-signée, autorité", ca.ca && ca.verify(ca.publicKey));
check("serveur : signé par l'autorité, pas une autorité", !leaf.ca && leaf.verify(ca.publicKey) && leaf.checkIssued(ca));
check("serveur : localhost, 127.0.0.1 et ::1", leaf.checkHost("localhost") === "localhost" && leaf.checkIP("127.0.0.1") === "127.0.0.1" && !leaf.checkHost("exemple.fr"), leaf.subjectAltName);
const years = (cert) => (new Date(cert.validTo) - new Date(cert.validFrom)) / (365.25 * 24 * 3600 * 1000);
check("validité : 20 ans (autorité), 10 ans (serveur)", Math.round(years(ca)) === 20 && Math.round(years(leaf)) === 10, `${years(ca).toFixed(1)} / ${years(leaf).toFixed(1)}`);
check("clé de l'autorité jamais renvoyée", !Object.values(made).some((v) => typeof v === "string" && /PRIVATE KEY/.test(v) && v !== made.key)
    && crypto.createPublicKey(made.key).export({ type: "spki", format: "der" }).equals(leaf.publicKey.export({ type: "spki", format: "der" })));
check("empreinte SHA-1 de l'autorité", made.caThumbprint === ca.fingerprint.replace(/:/g, ""));
let opensslText = "";
try {
    opensslText = execFileSync("openssl", ["x509", "-inform", "DER", "-noout", "-text"], { input: made.caDer }).toString();
} catch {
    opensslText = "openssl absent";
}
check("contrainte de noms lue par OpenSSL", opensslText === "openssl absent" || (/Name Constraints: critical/.test(opensslText) && /DNS:localhost/.test(opensslText)), opensslText === "openssl absent" ? "non vérifié" : "");

// --- Fichiers ---
const root = fs.mkdtempSync(path.join(os.tmpdir(), "aria-office-"));
const dir = path.join(root, "Aria Plume - Office");
check("rien avant l'installation", loadCertificates(dir) === null);
const first = ensureCertificates(dir);
const again = ensureCertificates(dir);
check("certificats créés une fois, puis réutilisés", first.created && !again.created && first.caThumbprint === again.caThumbprint);
check("clé du serveur privée", (fs.statSync(path.join(dir, "serveur-cle.pem")).mode & 0o077) === 0);
check("hors Windows : rien à approuver", (await isTrusted(first, "linux")) === null && (await trust(first, "linux")).skipped);
const caPem = `-----BEGIN CERTIFICATE-----\n${fs.readFileSync(first.caFile).toString("base64")}\n-----END CERTIFICATE-----\n`;

// --- Serveur ---
const port = 47900 + Math.floor(Math.random() * 90);
const pages = path.join(root, "pages");
fs.mkdirSync(path.join(pages, "sous"), { recursive: true });
fs.writeFileSync(path.join(pages, "index.html"), "<p>accueil</p>");
fs.writeFileSync(path.join(pages, "sous", "page.js"), "// js");
fs.writeFileSync(path.join(root, "secret.txt"), "secret");
const received = [];
const server = await startOfficeServer({
    port,
    cert: first.cert,
    key: first.key,
    version: "9.9.9",
    roots: [{ prefix: "", root: pages }],
    handle: async (msg) => {
        received.push(msg);
        if (msg.cmd === "fail") {
            throw new Error("Échec voulu");
        }
        return { echo: msg.text };
    },
});

function request({ method = "GET", pathname, host = `localhost:${port}`, headers = {}, body = null, trusted = true, address = "127.0.0.1" }) {
    return new Promise((resolve) => {
        const req = https.request({
            host: address,
            port,
            servername: "localhost",
            method,
            path: pathname,
            headers: { host, ...headers },
            ...(trusted ? { ca: caPem } : {}),
        }, (res) => {
            const chunks = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString("utf8") }));
        });
        req.on("error", (error) => resolve({ status: 0, error: error.code ?? error.message }));
        req.end(body);
    });
}
const origin = `https://localhost:${port}`;
const api = (cmd, value, headers = {}) => request({ method: "POST", pathname: `/api/${cmd}`, headers: { origin, "content-type": "application/json", ...headers }, body: JSON.stringify(value) });

const home = await request({ pathname: "/office/" });
check("page d'accueil, connexion vérifiée par l'autorité", home.status === 200 && home.text === "<p>accueil</p>", `${home.status} ${home.error ?? ""}`);
check("en-têtes : CSP avec office.js de Microsoft, nosniff", /script-src 'self' https:\/\/appsforoffice\.microsoft\.com/.test(home.headers?.["content-security-policy"] ?? "") && home.headers?.["x-content-type-options"] === "nosniff");
check("sous-dossier servi", (await request({ pathname: "/office/sous/page.js" })).text === "// js");
check("ping", JSON.parse((await request({ pathname: "/office/ping" })).text).version === "9.9.9");
const untrusted = await request({ pathname: "/office/", trusted: false });
check("sans l'autorité : connexion refusée", untrusted.status === 0 && /SELF_SIGNED|UNABLE_TO|unable/i.test(untrusted.error ?? ""), untrusted.error);
const ipv6 = await request({ pathname: "/office/ping", address: "::1", host: `[::1]:${port}` });
check("écoute aussi sur ::1 (si IPv6)", ipv6.status === 200 || ["EADDRNOTAVAIL", "ECONNREFUSED", "EAFNOSUPPORT"].includes(ipv6.error), `${ipv6.status} ${ipv6.error ?? ""}`);

const ok = await api("check", { text: "Il à fini." });
check("API : demande transmise", ok.status === 200 && JSON.parse(ok.text).echo === "Il à fini." && received.at(-1).cmd === "check");
const failed = JSON.parse((await api("fail", {})).text);
check("API : erreur renvoyée en français", failed.ok === false && failed.error === "Échec voulu");
const count = received.length;
check("API : autre origine refusée", (await api("check", { text: "x" }, { origin: "https://exemple.fr" })).status === 403);
check("API : sans origine refusée", (await request({ method: "POST", pathname: "/api/check", headers: { "content-type": "application/json" }, body: "{}" })).status === 403);
check("API : pas de JSON refusé", (await api("check", {}, { "content-type": "text/plain" })).status === 415);
check("API : demande trop grosse refusée", (await api("check", { text: "x".repeat(11 * 1024 * 1024) })).status === 413);
check("aucune demande refusée n'a atteint le moteur", received.length === count);
const rebinding = await request({ pathname: "/office/", host: `attaquant.exemple:${port}` });
check("hôte inconnu refusé (DNS rebinding)", rebinding.status === 421, `${rebinding.status} ${rebinding.error ?? ""}`);
check("sortie du dossier refusée", (await request({ pathname: "/office/%2e%2e/secret.txt" })).status === 404 && (await request({ pathname: "/office/../secret.txt" })).status === 404);
check("hors /office refusé", (await request({ pathname: "/secret.txt" })).status === 404);
check("méthode refusée", (await request({ method: "DELETE", pathname: "/office/" })).status === 405);
await server.close();

// Port déjà pris : erreur claire pour l'application.
const blocker = await startOfficeServer({ port, cert: first.cert, key: first.key, version: "1", roots: [], handle: async () => ({}) });
let busy = null;
try {
    await startOfficeServer({ port, cert: first.cert, key: first.key, version: "1", roots: [], handle: async () => ({}) });
} catch (error) {
    busy = error.code;
}
check("port déjà pris : EADDRINUSE", busy === "EADDRINUSE", busy ?? "démarré");
await blocker.close();

await removeCertificates(dir, "linux");
check("désinstallation : fichiers retirés", !fs.existsSync(dir));

fs.rmSync(root, { recursive: true, force: true });
console.log(failures ? `\n${failures} échec(s)` : "\ntout est bon");
process.exitCode = failures ? 1 : 0;
