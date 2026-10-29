// Aria Plume (application) — chargé avant les scripts du correcteur : remplace l'objet
// window.chrome de Chromium par le pont de l'application (voir preload.cjs).
globalThis.chrome = globalThis.ariaChrome;
// Classe de la page, pour les retouches de app.css (réglages ou correcteur).
document.documentElement.classList.add(location.pathname.startsWith("/options/") ? "app-options" : "app-popup");
