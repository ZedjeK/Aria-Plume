# Aria Plume — application

Application de bureau Electron autour du moteur Aria (`../extension/core`), 100 % locale.
Feuille de route : [`../docs/FEUILLE-DE-ROUTE.md`](../docs/FEUILLE-DE-ROUTE.md), phases 2 à 4.

## Version portable (Windows)

Deux formats, aucun n'installe quoi que ce soit :

- **`Aria-Plume-<version>-portable.exe`** : un seul fichier. À chaque lancement, il se décompresse
  dans un dossier temporaire (quelques secondes), puis démarre.
- **`Aria-Plume-<version>-win-x64.zip`** : un dossier à décompresser où tu veux, puis
  `Aria Plume.exe`. Démarrage immédiat.

**Tout ce qu'Aria Plume enregistre est dans un seul dossier**, le même pour les deux formats :

```text
C:\Users\<toi>\.Aria-Plume\
├── aria-plume-reglages.json   réglages (dictionnaire, glossaire, mots ignorés…)
├── extension\                 copie de l'extension que lit le navigateur
├── pont\                      relais et jeton du pont avec l'extension
├── office\                    certificat local et manifeste du complément Word
└── electron\                  données internes de l'application (caches, verrou)
```

Seule exception, hors de notre main : l'exe portable se décompresse d'abord dans le dossier
temporaire de Windows. Les versions d'avant la 0.36 rangeaient les réglages à côté de l'exe : au
premier lancement, ce fichier est **copié** dans `.Aria-Plume` (l'original reste, à supprimer quand
tu veux), tout comme l'ancien dossier `Aria Plume - extension` et `%APPDATA%\aria-plume`, qui ne
servent plus.

Pas de signature de code : au premier lancement, Windows SmartScreen affiche « Windows a protégé
votre ordinateur » → « Informations complémentaires » → « Exécuter quand même ».

Construire (depuis Linux ou Windows) : `npm run dist`, résultats dans `dist/`.

**Avant chaque livraison**, tester le paquet lui-même et pas seulement les sources :
`xvfb-run -a npm run test:package` (Linux) construit l'application empaquetée et y passe tout le test
de fumée. C'est lui qui aurait attrapé l'oubli du dossier `options/` dans la 0.30.0.

## Installer l'extension dans un navigateur

Réglages → Application → **Extension du navigateur** : un bouton par navigateur Chromium trouvé sur le
PC (Chrome, Edge, Brave, Opera, Opera GX, Vivaldi, Chromium), plus « Autre navigateur ».

Un vrai « un clic » est impossible, et c'est voulu par les navigateurs : sous Windows, une extension
installée de l'extérieur doit venir du Chrome Web Store, Chrome 137 a retiré `--load-extension`, et
une adresse `chrome://…` passée au lancement n'est pas ouverte. « Charger l'extension non
empaquetée » reste réservé à l'utilisateur. Le bouton fait donc tout le reste :

1. copie l'extension (embarquée dans l'application, identique au zip de la release) dans
   `C:\Users\<toi>\.Aria-Plume\extension` : un dossier fixe, que le navigateur lit
   à chaque démarrage (l'exe portable, lui, se décompresse ailleurs à chaque lancement) ;
2. ouvre le navigateur et met l'adresse de sa page d'extensions (`opera://extensions`…) dans le
   presse-papiers ;
3. affiche les étapes : Mode développeur, « Charger l'extension non empaquetée », puis
   « Copier le chemin du dossier » à coller dans la fenêtre de choix du dossier.

**Mise à jour** : quand l'application est plus récente que la copie, le bouton devient « Mettre à
jour dans… ». Il recopie les fichiers ; dans le navigateur, un clic sur ↻ (Recharger) sur la carte
d'Aria Plume suffit. Seuls les fichiers posés par une copie précédente sont remplacés ou retirés
(liste dans `.aria-plume-copie.json`), et un dossier du même nom qui ne contient pas Aria Plume est
refusé. Pour que l'extension partage les réglages de l'application, connecte les navigateurs
(ci-dessous). Firefox n'est pas pris en charge (format d'extension différent, signature Mozilla
obligatoire).

Tests : `node tests/extension-install.mjs` (copie, mise à jour, refus) et `npm test` (le parcours
complet avec un navigateur simulé).

## Connecter les navigateurs (pont avec l'extension)

Réglages → Application → **Connexion avec l'extension** → « Connecter les navigateurs ». Ensuite,
l'extension confie l'analyse, la traduction, la conjugaison et les synonymes à l'application, et les
deux partagent les mêmes réglages (dictionnaire, glossaire, mots ignorés, catégories…). La popup de
l'extension affiche « Moteur : application ✓ ».

- **Sans droits administrateur** : l'inscription se fait dans `HKEY_CURRENT_USER`, pour Chrome (lue
  aussi par Opera, Opera GX et Vivaldi), Edge, Brave et Chromium. « Déconnecter » retire tout.
- **Application fermée** : l'extension la démarre en arrière-plan, près de l'horloge, sans ouvrir
  de fenêtre. En attendant, et si elle ne répond pas, l'extension travaille avec son propre moteur.
  Quitter l'application pendant que le navigateur tourne : elle revient à la demande suivante.
- **Première connexion** : les deux côtés sont réunis. Dictionnaire, glossaire, termes gardés, mots
  ignorés et sites exclus sont fusionnés ; pour les autres réglages, c'est celui de l'application
  qui compte, sauf s'il est encore à sa valeur par défaut (alors celui de l'extension gagne).
- **Sécurité** : seul l'identifiant de l'extension Aria Plume est autorisé par le navigateur, et le
  canal entre le relais et l'application (`\\.\pipe\aria-plume-<utilisateur>`) exige un jeton
  stocké dans un fichier lisible par toi seul. Aucun port réseau n'est ouvert.
- **Version zip uniquement** : l'exe portable se décompresse ailleurs à chaque lancement, le
  navigateur ne saurait pas où le trouver. Si tu déplaces le dossier de l'application, elle met
  l'inscription à jour à son prochain démarrage.
- **Extension 0.35 ou plus récente**, chargée une nouvelle fois depuis la 0.35 : son identifiant est
  désormais fixe (voir les notes de version).

Détails du protocole : [`../extension/core/api.md`](../extension/core/api.md#pont-avec-lapplication-appbridge-extensionbridge-clientjs).

Tests : `node tests/bridge.mjs` (relais, jeton, démarrage automatique, limites, inscription),
`npm test` (un vrai relais parle à l'application) et, depuis `app/`,
`xvfb-run -a node ../tests/extension/pont.mjs` (Chromium + extension + relais + application).

### À vérifier sur Windows

1. Version zip : Réglages → « Connecter les navigateurs » → « Navigateurs connectés (Google Chrome,
   Opera, Vivaldi, Microsoft Edge, Brave, Chromium) ».
2. Recharger l'extension 0.35 (voir les notes de version), ouvrir sa popup : « Application… » puis
   « Moteur : application ✓ ».
3. Ajouter un mot au dictionnaire dans l'extension : il apparaît dans les réglages de l'application,
   et inversement.
4. « Quitter Aria Plume », puis écrire une faute dans une page : elle est soulignée, et l'icône
   d'Aria Plume revient près de l'horloge quelques secondes plus tard.

## Le complément Word

Réglages → Application → **Complément Word** → « Installer dans Word » : certificat local
(Windows demande une fois de l'approuver), serveur `https://localhost:47823` et inscription dans
Word. Redémarre Word : onglet **Accueil → Aria Plume**.

La section affiche ce qui est vérifié pour de vrai, pas ce qui a été tenté :

- ✓ **Certificat local approuvé par Windows** (`certutil -user -verifystore`) ;
- ✓ **Serveur prêt** : l'application se connecte à son propre serveur en HTTPS et compare
  l'empreinte du certificat présenté au sien ;
- ✓ **Inscrit dans Word** : la valeur `HKCU\Software\Microsoft\Office\16.0\WEF\Developer` est
  écrite par PowerShell (script encodé, chemin passé par variable d'environnement, sortie en UTF-8
  sans BOM), puis **relue**. Si elle ne peut pas l'être (un antivirus qui bloque l'écriture dans le
  registre, par exemple), la section affiche la commande PowerShell à lancer soi-même, prête à copier.

« Réparer » refait tout et revérifie. Le pont avec l'extension inscrit ses clés
(`HKCU\Software\<navigateur>\NativeMessagingHosts`) de la même façon.

- **Correction** : document entier ou sélection ; un clic sur une remarque sélectionne le passage,
  un clic sur une suggestion corrige, « Tout corriger » applique l'orthographe et la grammaire ;
  « Ignorer » et « Ajouter au dictionnaire » vont dans les réglages de l'application (partagés avec
  l'extension). Si le texte a changé depuis l'analyse, rien n'est touché : nouvelle vérification.
- **Soulignés dans le texte et vérification pendant la frappe** (Word avec un abonnement Microsoft
  365) : les fautes sont soulignées comme celles de l'Éditeur (rouge pour l'orthographe, bleu pour
  la grammaire, lavande pour le style), la bulle de Word propose les suggestions d'Aria Plume, et
  chaque paragraphe modifié est revérifié une seconde après la frappe. Case « Souligner dans le
  texte » pour couper. Sans abonnement (Office 2021 ou 2024 acheté une fois), Microsoft refuse ces
  annotations : le panneau le dit et garde la liste.
- **Traduction**, **Synonymes**, **Conjugaison** : comme dans l'extension, avec « Remplacer la
  sélection » et « Insérer après ».

L'application doit tourner pendant que tu utilises le complément (« Démarrer avec Windows »).
Tests : `node tests/office-word.mjs` (faux Word strict sur load/sync, vrai moteur, Word ancien,
Microsoft 365 et sans abonnement) et `node tests/registry.mjs` (inscriptions dans le registre avec
un faux PowerShell ; le vrai ne tourne que sous Windows).

## Le serveur MCP (pour les IA)

`Aria Plume.exe --mcp` démarre Aria Plume en **serveur MCP** sur l'entrée et la sortie standard,
sans fenêtre : une IA qui parle MCP (Claude Desktop, LM Studio…) peut alors utiliser quatre outils.

| Outil | Ce qu'il fait |
|---|---|
| `corriger` | Relit un texte français ou anglais : chaque faute (extrait, position, explication, suggestions) et le texte corrigé. Option `francais_soigne`. |
| `traduire` | Français ↔ anglais, avec ton glossaire. |
| `conjuguer` | Tous les temps d'un verbe français (infinitif ou forme conjuguée). |
| `synonymes` | Synonymes groupés par sens, accordés comme le mot. |

Tes réglages s'appliquent (dictionnaire personnel, mots ignorés, catégories, glossaire, dialecte
anglais, français soigné) et sont relus dès que le fichier change. Le serveur ne modifie rien.

**Configuration** : Réglages → section Application → « Serveur MCP » donne le bloc à copier, avec le
bon chemin. Il ressemble à ceci (Claude Desktop : `claude_desktop_config.json` ; LM Studio : `mcp.json`) :

```json
{
  "mcpServers": {
    "aria-plume": {
      "command": "C:\\Users\\toi\\Aria Plume\\Aria Plume.exe",
      "args": ["--mcp"]
    }
  }
}
```

Utilise la **version zip** pour le MCP : l'exe portable se décompresse dans un dossier temporaire
différent à chaque lancement. Avec Node 22, `node app/mcp/standalone.mjs [fichier de réglages]`
lance le même serveur sans Electron.

Le serveur parle les deux générations du protocole : la poignée de main `initialize` (versions
2024-11-05 à 2025-11-25) et la version 2026-07-28 (sans poignée de main, `server/discover`).
Les corrections tournent sur ton PC ; ce que l'IA fait du reste de la conversation dépend de l'IA
que tu utilises (en ligne ou locale).

Tests : `node tests/mcp.mjs` (serveur Node) et `xvfb-run -a node tests/mcp.mjs --app` (application).

## Publier une version

Une release GitHub se construit toute seule (`.github/workflows/release.yml`) :

1. Mettre la même version dans `extension/manifest.json` et `app/package.json` (ex. `0.30.2`).
2. Écrire les notes de version dans `docs/releases/v0.30.2.md` (facultatif : sinon GitHub les génère).
3. Pousser sur `main`, puis **au choix** : onglet **Actions → Release → Run workflow** avec le tag
   `v0.30.2`, ou `git tag v0.30.2` puis `git push origin v0.30.2`.

GitHub vérifie que le tag correspond aux versions, passe le banc de mesure et le test complet de
l'application empaquetée, construit l'exe portable, le zip Windows et le zip de l'extension, puis
publie la release. Si une étape échoue, rien n'est publié.

## Mises à jour

Réglages → Application → **Mises à jour** : « Vérifier au démarrage » (cochée d'office) demande à
GitHub, une fois par jour au plus, la dernière version publiée. Si elle est plus récente, une bulle
s'affiche près de l'horloge, le menu de l'icône propose « Mise à jour disponible : … », et les
réglages montrent les nouveautés et le fichier à prendre (exe portable ou zip, selon celui que tu
utilises). « Ouvrir la page de téléchargement » ouvre la page de la version dans ton navigateur :
rien n'est téléchargé ni installé tout seul. « Vérifier maintenant » et « Rechercher une mise à
jour » (menu de l'icône) vérifient à la demande.

C'est le **seul accès à internet de l'application** : une demande à
`https://api.github.com/repos/ZedjeK/Aria-Plume/releases/latest`, sans texte, sans réglage, sans
identifiant (GitHub voit ton adresse IP). Décocher la case le coupe.

Tests : `node tests/updates.mjs` (GitHub simulé) et `npm test` (vérification au démarrage, bulle,
menu, réglages, avec un faux GitHub local).

## Lancer en développement

Il faut Node 22 ou plus récent.

```sh
cd app
npm install
npm start
```

L'application se loge près de l'horloge. Fermer la fenêtre la cache ; « Quitter Aria Plume »
dans le menu de l'icône l'arrête. En développement, les données sont dans `dev-data/`
(une fois empaquetée : `C:\Users\<toi>\.Aria-Plume\`).

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

Pour avoir les mêmes réglages partout : **Connecter les navigateurs** (voir plus haut), ou
**Exporter** dans les réglages de l'extension puis **Importer** ce fichier dans ceux de
l'application. Les exports passent par la boîte « Enregistrer sous » de Windows.

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
| `engine.js` | Le moteur Aria (plateforme Node) et son service (`core/service.js`), dans le processus principal |
| `settings.js` | Réglages dans un fichier JSON, à côté de l'exécutable (portable) |
| `preload.cjs` | Pont sécurisé : les quelques API `chrome.*` dont le correcteur a besoin, branchées sur le processus principal |
| `windows-input.js` | Raccourci global sous Windows : copie de la sélection, recollage, presse-papiers |
| `ui/chrome.js` | Pose ce pont à la place de `window.chrome` avant les scripts du correcteur |
| `app-main.js` | L'application (fenêtre, icône, raccourci) ; `main.js` choisit entre elle et le serveur MCP |
| `mcp/server.js` | Serveur MCP (outils, protocole, stdio) |
| `mcp/electron.js` | `--mcp` : le serveur dans l'application, avec ses réglages |
| `mcp/standalone.mjs` | Le serveur avec Node seul |
| `extension-install.js` | Installation assistée de l'extension : navigateurs détectés, copie, ouverture |
| `updates.js` | Vérification des mises à jour (API de GitHub), comparaison des versions, nouveautés |
| `bridge/server.js` | Pont avec l'extension : canal local de la session, jeton, messages |
| `bridge/relay.cjs` | Relais lancé par le navigateur (messagerie native), démarre l'application au besoin |
| `bridge/register.js` | Inscription du relais auprès des navigateurs (registre de Windows, dossiers sous Linux) |
| `ui/options-app.js` | Section « Application » de la page de réglages, et exports par « Enregistrer sous » |
| `ui/app.css` | Retouches du correcteur pour la fenêtre (éléments propres au navigateur masqués) |
| `tests/smoke.mjs` | Test de fumée (`xvfb-run -a npm test` sous Linux) |
| `tests/bridge.mjs` | Test du pont sans Electron |
