// Aria Plume — page de test du serveur local du complément Office : une correction par l'API.
(async () => {
    const result = document.getElementById("result");
    const text = document.getElementById("sample").textContent;
    try {
        const response = await fetch("/api/check", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ text, lang: "auto" }),
        });
        const data = await response.json();
        if (!data.ok) {
            throw new Error(data.error);
        }
        const words = data.matches.map((m) => `« ${text.slice(m.start, m.end)} » → ${m.suggestions[0] ?? "?"}`);
        result.textContent = `✓ Le moteur répond : ${words.join(", ")}.`;
        result.className = "ok";
    } catch (error) {
        result.textContent = `Le moteur ne répond pas : ${error.message}`;
        result.className = "error";
    }
})();
