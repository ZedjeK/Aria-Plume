// Aria Plume (application) — chargé avant les scripts du correcteur : remplace l'objet
// window.chrome de Chromium par le pont de l'application (voir preload.cjs).
globalThis.chrome = globalThis.ariaChrome;
