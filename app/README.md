# Aria Plume — application (en construction)

Application de bureau Electron autour du moteur Aria (`../extension/core`), 100 % locale.
Feuille de route : [`../docs/FEUILLE-DE-ROUTE.md`](../docs/FEUILLE-DE-ROUTE.md), phase 2.

## Lancer en développement

Il faut Node 22 ou plus récent.

```sh
cd app
npm install
npm start
```

L'application se loge près de l'horloge. Fermer la fenêtre la cache ; « Quitter Aria Plume »
dans le menu de l'icône l'arrête. Les réglages sont dans `dev-data/aria-plume-reglages.json`
(une fois empaquetée : à côté de l'exécutable).

## Fichiers

| Fichier | Rôle |
|---|---|
| `main.js` | Processus principal : instance unique, icône près de l'horloge, fenêtre, échanges avec la fenêtre |
| `engine.js` | Le moteur Aria (plateforme Node), dans le processus principal |
| `settings.js` | Réglages dans un fichier JSON, à côté de l'exécutable (portable) |
| `preload.cjs` | Pont sécurisé : la fenêtre ne voit que `window.aria` |
| `ui/` | La fenêtre |
| `tests/smoke.mjs` | Test de fumée (`xvfb-run -a npm test` sous Linux) |
