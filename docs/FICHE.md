# Fiche projet : Aria Plume

Ce que cette appli a de propre. À relire avant toute modification, et à tenir à
jour quand l'appli change. « Prévu » marque ce qui est décidé mais pas encore dans le code.

| | |
| --- | --- |
| Nom | Aria Plume (dépôt et exe : `Aria-Plume`) |
| Promesse | Correcteur, conjugueur et traducteur français ↔ anglais, 100 % local, dans le navigateur et dans les logiciels de Windows |
| Élément orange du logo | une plume, posée en travers du « A » |
| Fond animé | prévu : « correction » — des lignes de texte fantômes où apparaissent les marques du correcteur (soulignés de faute, phrase en double qui s'estompe) ; aléatoires : les lignes, les marques et leur place ; nombre par défaut : à choisir sur la maquette |
| Stack | Electron 45 (application Windows) et extension Manifest V3 (Chrome, Edge, Brave, Opera) ; moteurs Grammalecte, Harper et Bergamot en WebAssembly ; Node.js pour les bancs |
| Droits administrateur | non |
| Démarrage automatique | proposé, désactivé par défaut ; lancement en arrière-plan avec `--silencieux` (`--hidden`, des versions d'avant la 0.40, reste compris) |
| Installation par l'exe | oui, dans `%USERPROFILE%\.Aria-Plume\programme`, version précédente gardée dans `sauvegardes\versions\` ; « Ne plus me proposer » et `--portable` ; livré en zip seulement (l'exe portable d'Electron, qui se décompressait dans `%TEMP%`, n'est plus livré) |
| Port local (interface web) | 47823, en HTTPS, sur `127.0.0.1` et `::1` : pages du complément Word et Outlook ; certificat local, `Host` et `Origin` vérifiés |
| Données de l'utilisateur | `%USERPROFILE%\.Aria-Plume` : réglages (`reglages.json`), journal des 500 dernières opérations (`journal.json`, sans valeur de réglage ni texte), sauvegardes (`sauvegardes\` : une copie des réglages par jour de modification, dix au plus), copie de l'extension (`extension\`), pont avec l'extension (`pont\`), certificat et manifeste du complément Office (`office\`), données internes d'Electron (`cache\`) ; secrètes : le jeton du pont avec l'extension (`pont\`, en clair et lisible par l'utilisateur seul ; prévu : chiffré par DPAPI) et la clé privée du certificat local (`office\`) |
| Écritures hors du dossier de données | entrée de démarrage automatique (registre, si activé) ; hôte de messagerie native déclaré pour chaque navigateur (`HKCU:\Software\<navigateur>\NativeMessagingHosts`), quand l'utilisateur connecte les navigateurs ; complément Office déclaré dans `HKCU:\Software\Microsoft\Office\16.0\WEF\Developer` et certificat local ajouté au magasin racine de l'utilisateur (`certutil -user`, confirmation demandée par Windows), quand l'utilisateur installe le complément ; le texte d'un autre logiciel, remplacé par le texte corrigé (presse-papiers et touches simulées) quand l'utilisateur le demande ; raccourci `Aria Plume.lnk` sur le Bureau de l'utilisateur, si la case est cochée à l'installation |
| Connexions sortantes | `api.github.com`, `repos/ZedjeK/Aria-Plume/releases/latest` : vérification des mises à jour, une fois par jour au plus, désactivable ; prévu : téléchargement de la version depuis `github.com`, avec accord et vérification du SHA-256. Le complément Office charge `office.js` depuis `appsforoffice.microsoft.com`, comme tout complément Office. L'extension n'a aucun accès au réseau (`connect-src 'self'`) |
| Composants tiers embarqués | Grammalecte 2.3.0, harper.js 2.10.0, Bergamot Translator 0.4.9, modèles de traduction de Mozilla fr→en et en→fr 2.0, WordNet 3.1, données tirées de Tatoeba (CC BY 2.0 FR), polices Space Grotesk et IBM Plex Mono (SIL OFL 1.1), Electron ; détail et licences dans `LICENCES-TIERS.txt` et `extension/THIRD_PARTY.md` |
| Réussite de la v0.1 | sans objet (l'appli en est à la 0.39) ; objectif en cours : contrat des applis Aria tenu et refonte visuelle validée, sans recul au banc (`node tests/bench/run.mjs`) |
