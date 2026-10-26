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

## La fenêtre

La fenêtre est le correcteur de l'extension lui-même (`extension/popup/popup.html` et le script de
page `extension/content/checker.js`), servi par le protocole `aria://app/` : Traduction, Correction
(vagues, liste des fautes, « Tout corriger », compteur) et Conjugaison, à l'identique. Seuls les
dossiers `popup/`, `content/`, `icons/`, `core/shared/` de l'extension et `ui/` sont servis, avec une
politique de sécurité qui interdit à la page tout autre chargement.

Sans le détecteur de langue du navigateur, le mode « Langue : auto » s'appuie sur les mots-outils
(le, the, est, is…) : sur un texte très court, choisis la langue à la main.

## Fichiers

| Fichier | Rôle |
|---|---|
| `main.js` | Processus principal : instance unique, icône près de l'horloge, fenêtre, protocole `aria:`, demandes de la fenêtre |
| `engine.js` | Le moteur Aria (plateforme Node) et son service (`core/service.js`), dans le processus principal |
| `settings.js` | Réglages dans un fichier JSON, à côté de l'exécutable (portable) |
| `preload.cjs` | Pont sécurisé : les quelques API `chrome.*` dont le correcteur a besoin, branchées sur le processus principal |
| `ui/chrome.js` | Pose ce pont à la place de `window.chrome` avant les scripts du correcteur |
| `ui/app.css` | Retouches du correcteur pour la fenêtre (éléments propres au navigateur masqués) |
| `tests/smoke.mjs` | Test de fumée (`xvfb-run -a npm test` sous Linux) |
