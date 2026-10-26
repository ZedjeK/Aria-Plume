// Aria Plume (application) — fenêtre provisoire de l'étape 2.1 : vérifie que le moteur répond.
const $ = (id) => document.getElementById(id);

async function refreshStatus() {
    const [version, info] = await Promise.all([window.aria.version(), window.aria.info()]);
    const loaded = Object.entries(info.loaded).filter(([, on]) => on).map(([name]) => name);
    $("status").textContent = `Version ${version} · moteur ${info.platform} · chargé : ${loaded.join(", ") || "rien pour l'instant"}`;
}

$("check").addEventListener("click", async () => {
    const text = $("text").value;
    const list = $("results");
    list.replaceChildren();
    try {
        const { matches } = await window.aria.check({ text, lang: $("lang").value, repetitions: 30 });
        for (const m of matches) {
            const item = document.createElement("li");
            const word = document.createElement("b");
            word.textContent = text.slice(m.start, m.end);
            item.append(word, ` → ${m.suggestions[0] ?? "?"} · ${m.message}`);
            list.append(item);
        }
        if (!matches.length) {
            list.append(Object.assign(document.createElement("li"), { textContent: "Aucune faute trouvée." }));
        }
    } catch (error) {
        list.append(Object.assign(document.createElement("li"), { textContent: `Erreur : ${error.message}` }));
    }
    refreshStatus();
});

refreshStatus();
setInterval(refreshStatus, 3000);
