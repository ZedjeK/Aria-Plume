// Aria Plume (application) — y a-t-il une version plus récente ?
//
// Seul accès à internet de l'application : une demande à l'API de GitHub,
//     GET https://api.github.com/repos/ZedjeK/Aria-Plume/releases/latest
// qui ne donne que la dernière version publiée (ni brouillon, ni préversion). Rien n'est envoyé :
// ni texte, ni réglage, ni identifiant ; GitHub voit l'adresse IP et la demande. Rien n'est
// téléchargé ni installé : « Télécharger » ouvre la page de la version dans le navigateur.

export const REPOSITORY = "ZedjeK/Aria-Plume";
export const LATEST_URL = `https://api.github.com/repos/${REPOSITORY}/releases/latest`;
export const RELEASES_PAGE = `https://github.com/${REPOSITORY}/releases`;
const TIMEOUT_MS = 10000;

// « v0.36.0 » → [0, 36, 0]. Une préversion (« 1.0.0-beta ») compte comme sa version de base.
export function parseVersion(text) {
    const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(String(text ?? "").trim());
    return match ? [match[1], match[2] ?? "0", match[3] ?? "0"].map(Number) : null;
}

// < 0 si a est plus ancienne que b, 0 si égales, > 0 si plus récente.
export function compareVersions(a, b) {
    const left = parseVersion(a);
    const right = parseVersion(b);
    if (!left || !right) {
        return 0;
    }
    for (let i = 0; i < 3; i++) {
        if (left[i] !== right[i]) {
            return left[i] - right[i];
        }
    }
    return 0;
}

// Les nouveautés : les puces de la section « Ce qui change » (ou « Nouveautés ») des notes, sans le
// balisage Markdown (au plus six).
export function summarizeNotes(body) {
    const lines = String(body ?? "").split(/\r?\n/);
    const start = lines.findIndex((line) => /^#{2,4}\s*(Ce qui change|Nouveautés)/i.test(line));
    const section = start >= 0 ? lines.slice(start + 1) : lines;
    const end = section.findIndex((line) => /^#{1,4}\s/.test(line));
    return (end >= 0 ? section.slice(0, end) : section)
        .filter((line) => /^\s*[-*]\s+/.test(line))
        .map((line) => line
            .replace(/^\s*[-*]\s+/, "")
            .replace(/\*\*([^*]+)\*\*/g, "$1")
            .replace(/`([^`]+)`/g, "$1")
            .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
            .trim())
        .filter(Boolean)
        .slice(0, 6)
        .map((line) => (line.length > 220 ? `${line.slice(0, 217)}…` : line));
}

// Le fichier qui correspond à ce qu'on utilise : exe portable ou zip Windows.
export function pickAsset(assets, kind) {
    const pattern = kind === "portable" ? /-portable\.exe$/i : kind === "zip" ? /-win-x64\.zip$/i : null;
    const asset = pattern ? (assets ?? []).find((item) => pattern.test(item?.name ?? "")) : null;
    return asset ? { name: asset.name, size: asset.size ?? null } : null;
}

// Seules les pages de ce dépôt sur GitHub sont ouvertes.
export const isReleaseUrl = (url) => typeof url === "string" && url.startsWith(`https://github.com/${REPOSITORY}/releases`);

// Résultat : { status: "up-to-date" | "available" | "error", current, latest, url, publishedAt,
// notes, asset, error }. fetchImpl : fetch (net.fetch d'Electron dans l'application).
export async function checkForUpdate({ current, kind, fetchImpl, url = LATEST_URL }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const base = { current, latest: null, url: RELEASES_PAGE, publishedAt: null, notes: [], asset: null, error: null };
    try {
        const response = await fetchImpl(url, {
            signal: controller.signal,
            headers: { accept: "application/vnd.github+json", "user-agent": "Aria-Plume", "x-github-api-version": "2022-11-28" },
        });
        if (response.status === 404) {
            return { ...base, status: "up-to-date", error: "Aucune version publiée pour l'instant." };
        }
        if (response.status === 403 || response.status === 429) {
            return { ...base, status: "error", error: "GitHub limite les demandes pour l'instant : réessaie dans une heure." };
        }
        if (!response.ok) {
            return { ...base, status: "error", error: `GitHub a répondu ${response.status}.` };
        }
        const release = await response.json();
        const latest = parseVersion(release?.tag_name) ? String(release.tag_name).replace(/^v/, "") : null;
        if (!latest) {
            return { ...base, status: "error", error: "Réponse de GitHub illisible." };
        }
        const result = {
            ...base,
            latest,
            url: isReleaseUrl(release.html_url) ? release.html_url : RELEASES_PAGE,
            publishedAt: typeof release.published_at === "string" ? release.published_at : null,
        };
        if (compareVersions(latest, current) <= 0) {
            return { ...result, status: "up-to-date" };
        }
        return { ...result, status: "available", notes: summarizeNotes(release.body), asset: pickAsset(release.assets, kind) };
    } catch (error) {
        const message = error?.name === "AbortError"
            ? "GitHub ne répond pas (pas de connexion à internet ?)."
            : "Impossible de joindre GitHub (pas de connexion à internet ?).";
        return { ...base, status: "error", error: message };
    } finally {
        clearTimeout(timer);
    }
}

// Faut-il vérifier maintenant ? Une fois par 24 heures au plus.
export function isDue(lastCheck, now = Date.now()) {
    const last = Date.parse(lastCheck ?? "");
    return Number.isNaN(last) || now - last >= 24 * 3600 * 1000 || last > now;
}
