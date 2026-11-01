// Aria Plume — complément Office : appels au moteur de l'application (même serveur, /api/…).

export async function call(cmd, payload = {}) {
    let response;
    try {
        response = await fetch(`/api/${encodeURIComponent(cmd)}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
        });
    } catch {
        throw new Error("L'application Aria Plume ne répond pas : vérifie qu'elle tourne (icône près de l'horloge).");
    }
    const data = await response.json().catch(() => ({ ok: false, error: `Réponse illisible de l'application (${response.status}).` }));
    if (!data.ok) {
        throw new Error(data.error ?? "Erreur de l'application.");
    }
    const { ok, ...rest } = data;
    return rest;
}
