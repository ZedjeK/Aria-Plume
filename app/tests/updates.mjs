// Test de la vérification des mises à jour, sans réseau (GitHub simulé) : comparaison des
// versions, nouveautés, fichier proposé, erreurs (limite de GitHub, délai, réponse illisible),
// adresses ouvertes, rythme d'une fois par jour.
//     node tests/updates.mjs
import { LATEST_URL, RELEASES_PAGE, checkForUpdate, compareVersions, isDue, isReleaseUrl, parseVersion, pickAsset, summarizeNotes } from "../updates.js";

let failures = 0;
const check = (label, ok, detail = "") => {
    console.log(`${ok ? "OK   " : "ÉCHEC"} ${label}${detail ? ` : ${detail}` : ""}`);
    failures += ok ? 0 : 1;
};

// --- Versions ---
check("versions : 0.10 plus récente que 0.9", compareVersions("0.10.0", "0.9.5") > 0);
check("versions : préfixe v, égalité", compareVersions("v0.35.0", "0.35.0") === 0);
check("versions : correctif", compareVersions("0.35.1", "0.35.0") > 0 && compareVersions("0.35.0", "0.35.1") < 0);
check("versions : préversion = sa version de base", compareVersions("1.0.0-beta", "1.0.0") === 0);
check("versions : illisible", parseVersion("nimporte") === null && compareVersions("x", "1.0.0") === 0);

// --- Nouveautés ---
const body = [
    "## Aria Plume 0.36.0 — titre",
    "### Téléchargements",
    "- pas une nouveauté",
    "### Ce qui change",
    "- **Complément Word** : un panneau dans `Word`, voir [la doc](https://exemple.fr).",
    "- Deuxième point.",
    "",
    "Moteurs embarqués : …",
    "### Autre section",
    "- hors section",
].join("\n");
const notes = summarizeNotes(body);
check("nouveautés : la section « Ce qui change » seulement, sans Markdown", notes.length === 2 && notes[0] === "Complément Word : un panneau dans Word, voir la doc." && notes[1] === "Deuxième point.", JSON.stringify(notes));
check("nouveautés : titre « Nouveautés » des anciennes notes", summarizeNotes("### Téléchargements\n- non\n### Nouveautés depuis la 0.28\n**Application**\n- Le **raccourci** global.\n### Fin").join("|") === "Le raccourci global.");
check("nouveautés : sans section, toutes les puces (au plus 6)", summarizeNotes(Array.from({ length: 9 }, (_, i) => `- point ${i}`).join("\n")).length === 6);

// --- Fichier proposé ---
const assets = [{ name: "Aria-Plume-0.36.0-portable.exe", size: 1 }, { name: "Aria-Plume-0.36.0-win-x64.zip", size: 2 }, { name: "Aria-Plume-extension-0.36.0.zip", size: 3 }];
check("fichier : exe portable", pickAsset(assets, "portable")?.name === "Aria-Plume-0.36.0-portable.exe");
check("fichier : zip Windows", pickAsset(assets, "zip")?.name === "Aria-Plume-0.36.0-win-x64.zip");
check("fichier : rien en développement", pickAsset(assets, "dev") === null);

// --- Adresses ---
check("adresse : page des versions du dépôt acceptée", isReleaseUrl("https://github.com/ZedjeK/Aria-Plume/releases/tag/v0.36.0"));
check("adresse : autre site refusé", !isReleaseUrl("https://exemple.fr/ZedjeK/Aria-Plume/releases") && !isReleaseUrl("https://github.com/autre/depot/releases") && !isReleaseUrl("javascript:alert(1)"));

// --- GitHub simulé ---
const requests = [];
const github = (status, json) => async (url, options) => {
    requests.push({ url, headers: options.headers });
    return { ok: status >= 200 && status < 300, status, json: async () => json };
};
const release = {
    tag_name: "v0.36.0",
    html_url: "https://github.com/ZedjeK/Aria-Plume/releases/tag/v0.36.0",
    published_at: "2026-11-02T10:00:00Z",
    body,
    assets,
};
const available = await checkForUpdate({ current: "0.35.0", kind: "portable", fetchImpl: github(200, release) });
check("nouvelle version : disponible, fichier, nouveautés, page", available.status === "available" && available.latest === "0.36.0" && available.asset?.name.endsWith("-portable.exe")
    && available.notes.length === 2 && available.url === release.html_url, JSON.stringify(available).slice(0, 160));
check("demande : API de GitHub, aucun identifiant envoyé", requests[0].url === LATEST_URL && requests[0].headers["user-agent"] === "Aria-Plume" && !("authorization" in requests[0].headers));
const same = await checkForUpdate({ current: "0.36.0", kind: "zip", fetchImpl: github(200, release) });
check("même version : à jour", same.status === "up-to-date" && same.notes.length === 0);
const newer = await checkForUpdate({ current: "0.37.0", kind: "zip", fetchImpl: github(200, release) });
check("version plus récente que GitHub (développement) : à jour", newer.status === "up-to-date");
const foreign = await checkForUpdate({ current: "0.35.0", kind: "zip", fetchImpl: github(200, { ...release, html_url: "https://exemple.fr/piege" }) });
check("page d'un autre site dans la réponse : remplacée par celle du dépôt", foreign.url === RELEASES_PAGE);
const none = await checkForUpdate({ current: "0.35.0", kind: "zip", fetchImpl: github(404, {}) });
check("aucune version publiée : pas une erreur", none.status === "up-to-date" && /Aucune version/.test(none.error));
const limited = await checkForUpdate({ current: "0.35.0", kind: "zip", fetchImpl: github(403, {}) });
check("limite de GitHub : message clair", limited.status === "error" && /réessaie dans une heure/.test(limited.error));
const garbage = await checkForUpdate({ current: "0.35.0", kind: "zip", fetchImpl: github(200, { tag_name: "n'importe" }) });
check("réponse illisible : erreur", garbage.status === "error" && /illisible/.test(garbage.error));
const offline = await checkForUpdate({ current: "0.35.0", kind: "zip", fetchImpl: async () => {
    throw new TypeError("fetch failed");
} });
check("hors ligne : erreur en français", offline.status === "error" && /internet/.test(offline.error));

// --- Rythme ---
const now = Date.parse("2026-11-01T12:00:00Z");
check("jamais vérifié : à faire", isDue(null, now));
check("vérifié il y a 3 heures : pas encore", !isDue("2026-11-01T09:00:00Z", now));
check("vérifié hier : à faire", isDue("2026-10-31T11:00:00Z", now));
check("date dans le futur (horloge changée) : à faire", isDue("2026-12-01T00:00:00Z", now));

console.log(failures ? `\n${failures} échec(s)` : "\ntout est bon");
process.exitCode = failures ? 1 : 0;
