# Aria Plume — application

Application de bureau Electron autour du moteur Aria (`../extension/core`), 100 % locale.
Feuille de route : [`../docs/FEUILLE-DE-ROUTE.md`](../docs/FEUILLE-DE-ROUTE.md), phase 2.

## Version portable (Windows)

Deux formats, aucun n'installe quoi que ce soit :

- **`Aria-Plume-<version>-portable.exe`** : un seul fichier. À chaque lancement, il se décompresse
  dans un dossier temporaire (quelques secondes), puis démarre. Les réglages sont dans
  `aria-plume-reglages.json`, à côté de l'exe.
- **`Aria-Plume-<version>-win-x64.zip`** : un dossier à décompresser où tu veux (clé USB comprise),
  puis `Aria Plume.exe`. Démarrage immédiat. Les réglages sont à côté de `Aria Plume.exe`.

Pas de signature de code : au premier lancement, Windows SmartScreen affiche « Windows a protégé
votre ordinateur » → « Informations complémentaires » → « Exécuter quand même ».

Construire (depuis Linux ou Windows) : `npm run dist`, résultats dans `dist/`.

**Avant chaque livraison**, tester le paquet lui-même et pas seulement les sources :
`xvfb-run -a npm run test:package` (Linux) construit l'application empaquetée et y passe tout le test
de fumée. C'est lui qui aurait attrapé l'oubli du dossier `options/` dans la 0.30.0.

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

## Les réglages

Bouton **Réglages** en haut de la fenêtre, ou menu de l'icône près de l'horloge → **Réglages…** :
c'est la page de réglages de l'extension (catégories, répétitions, français soigné, couleurs, fautes
récurrentes, anglais, dictionnaire, glossaire, mots ignorés, sauvegarde), avec en tête une section
**Application** : raccourci global (clique dans la case, appuie sur la combinaison), démarrage avec
Windows, emplacement du fichier de réglages. Ce qui ne concerne que le navigateur (correction sur les
sites, relecture Gmail, réglages par site) est masqué.

Pour avoir les mêmes réglages partout : **Exporter** dans les réglages de l'extension, puis
**Importer** ce fichier dans ceux de l'application (et inversement). Les exports passent par la
boîte « Enregistrer sous » de Windows.

## Le raccourci global (Windows)

Sélectionne du texte dans n'importe quel logiciel (Word, Outlook, Bloc-notes, Teams…) et appuie sur
**Alt+Maj+C** : Aria Plume copie la sélection, l'ouvre dans l'onglet Correction, et **⇡ Renvoyer**
remplace la sélection d'origine par le texte corrigé, puis la fenêtre se cache.

- Le presse-papiers est sauvegardé avant et restauré après, tous formats compris.
- Pas de module natif : un PowerShell invisible, lancé au démarrage, appelle l'API Windows
  (`windows-input.js`). Il compile sa petite aide C# en une ou deux secondes au lancement.
- Le raccourci se change dans les réglages (section Application). S'il est déjà pris par un autre
  logiciel, la page et le menu de l'icône l'indiquent.

Limites connues : Windows interdit d'envoyer des touches à un logiciel lancé en administrateur
(la copie échoue, Aria Plume le dit) ; l'historique du presse-papiers (Win+V) garde une trace des
copies faites par Aria Plume ; certains antivirus peuvent se méfier d'un PowerShell qui simule le clavier.

### À vérifier sur Windows

1. `npm start` : l'icône apparaît près de l'horloge, son menu affiche « Raccourci : Alt+Maj+C ».
2. Dans le Bloc-notes, sélectionne « Je pense que il viendras demain. » et appuie sur Alt+Maj+C.
3. La fenêtre s'ouvre sur l'onglet Correction avec le texte et « Récupéré depuis « Sans titre - Bloc-notes » ».
4. Corrige les deux fautes, clique sur ⇡ Renvoyer : le Bloc-notes affiche la phrase corrigée.
5. Ctrl+V ailleurs : ton presse-papiers d'avant est toujours là.
6. Recommence dans Word, Outlook (nouveau message) et ton navigateur.
7. Raccourci sans rien sélectionner : message « Rien de sélectionné… ».

## Fichiers

| Fichier | Rôle |
|---|---|
| `main.js` | Processus principal : instance unique, icône près de l'horloge, fenêtre, protocole `aria:`, demandes de la fenêtre |
| `engine.js` | Le moteur Aria (plateforme Node) et son service (`core/service.js`), dans le processus principal |
| `settings.js` | Réglages dans un fichier JSON, à côté de l'exécutable (portable) |
| `preload.cjs` | Pont sécurisé : les quelques API `chrome.*` dont le correcteur a besoin, branchées sur le processus principal |
| `windows-input.js` | Raccourci global sous Windows : copie de la sélection, recollage, presse-papiers |
| `ui/chrome.js` | Pose ce pont à la place de `window.chrome` avant les scripts du correcteur |
| `ui/options-app.js` | Section « Application » de la page de réglages, et exports par « Enregistrer sous » |
| `ui/app.css` | Retouches du correcteur pour la fenêtre (éléments propres au navigateur masqués) |
| `tests/smoke.mjs` | Test de fumée (`xvfb-run -a npm test` sous Linux) |
