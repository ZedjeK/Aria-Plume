<p align="center">
  <img src="docs/logo.png" width="160" alt="Logo d'Aria Plume : un A néon glitché traversé d'une plume orange">
</p>

<h1 align="center">Aria Plume</h1>

<p align="center">
  Un correcteur et un traducteur français ↔ anglais pour Opera GX et les navigateurs Chromium.<br>
  Tout se passe sur ton PC : aucun serveur, aucun compte, pas un octet ne sort de ta machine.<br>
  Rien à installer : une extension, et c'est tout.
</p>

<p align="center">
  <a href="#installation"><b>Installer l'extension</b></a> · v0.34 · Opera GX et navigateurs Chromium récents · licence MIT (code d'Aria) / GPL-3.0 (ensemble)
</p>

La plume de l'écrivain, pour des textes soignés. Anciennement *Aria ODL* (**O**util **D**e **L**angage).

## Ce qu'il fait

| Fonction | Ce que ça fait | Moteur |
| --- | --- | --- |
| **Correction en direct** | Souligne les fautes pendant que tu écris, dans n'importe quel champ (Gmail, Discord, claude.ai…). Clic droit sur un mot souligné : l'infobulle propose la correction | Grammalecte (français), Harper (anglais) |
| **Accords complets** | Quand un accord touche plusieurs mots, une seule vague couvre le passage et propose la phrase entièrement corrigée (« Les enfant sont prêt » → « Les enfants sont prêts ») | Grammalecte, relancé jusqu'à ce que le passage soit sans faute |
| **Homophones** | Ce que Grammalecte laisse passer ou corrige mal : « **Sa** marche pas » → *Ça*, « le serveur **et** tombé » → *est*, « il **à** fini » → *a*, « **ces** pas grave » → *C'est*, « il **ses** trompé » → *s'est*, « ils **on** fini » → *ont*, « je pense **quel** viendra » → *qu'elle*, « il **ni** a plus rien » → *n'y*. Règles prudentes : dans le doute, rien n'est souligné | Règles d'Aria sur la morphologie de Grammalecte |
| **Synonymes** | Clic droit sur un mot d'un champ (ou sur une sélection d'un à trois mots) → *Synonymes avec Aria Plume*. Un clic remplace le mot (Ctrl+Z annule) ; dans le texte d'une page, il copie le synonyme. Les synonymes français sont accordés comme le mot (« marchaient » → « cheminaient », « belles » → « charmantes ») | Thésaurus de Grammalecte (français), WordNet 3.1 (anglais) |
| **Conjugueur** | Onglet *Conjugaison* de la popup et de la fenêtre séparée : tous les temps d'un verbe, avec négation, forme interrogative, temps composés, forme pronominale et féminin. Accepte un verbe conjugué (« marchait » → *marcher*) et propose les verbes proches d'une faute (« conjuger » → *conjuguer*) | Module de conjugaison de Grammalecte |
| **Grammaire en plus** | Ce que Grammalecte ne voit pas : participe passé des verbes pronominaux (« elles se sont lavé » → *lavées*, mais « elles se sont parlé » reste invariable), concordance après « si » (« si j'avais su, je **serai** venu » → *serais*), *tout* devant un adjectif féminin (« **tout** contente » → *toute*), *prêt*/*près* (« **prêt** de la gare » → *près*), « va s'y » → *vas-y*. Et les cas relevés dans la Banque de dépannage linguistique de l'OQLF : « **tant qu'à** moi » → *quant à*, « **quoique** tu fasses » → *quoi que*, « **si non** » → *sinon*, « il est **la** » → *là*, « plus d'un technicien **sont** venus » → *est*, « j'en ai **mangées** trois » → *mangé*, « combien de pommes as-tu **mangé** » → *mangées*, « elle s'en est **prise** à moi » → *pris*, « **achète-en** » → *achètes-en*, « les enfants **obéissant** sont rares » → *obéissants* | Règles d'Aria sur la morphologie et la conjugaison de Grammalecte |
| **Anglais en plus** | Ce que Harper laisse passer : « rather walk **then** drive » → *than*, « and **than** we left » → *then*, « **your** welcome » → *you're*, « **its** not working » → *it's*, « **it's** own » → *its*, « don't **loose** » → *lose*, « **who's** car » → *whose*, « **there** going » → *they're*, « I **seen** » → *saw*, « **borrow** me » → *lend*, « **less** people » → *fewer* | Règles d'Aria (core/en/rules.js) |
| **Formes fautives** | Les fautes qui ne sont pas des fautes de frappe reçoivent la bonne forme en premier : « faisez » → *faites*, « disez » → *dites*, « envoierai » → *enverrai*, « chevals » → *chevaux* | Règles du pluriel et module de conjugaison de Grammalecte |
| **Panneau complet** | Toutes les fautes du champ actif ou de la sélection, avec leur explication. **Tout corriger** applique d'un clic la première suggestion de chaque faute d'orthographe et de grammaire (un seul Ctrl+Z l'annule dans un champ de texte, un Ctrl+Z par correction dans une zone éditable) | Grammalecte, Harper |
| **Traduction de sélection** | Sélection ou champ : infobulle avec la traduction, sens inversable, Copier, Remplacer (Ctrl+Z annule) | Bergamot + modèles Mozilla |
| **Traduction de page** | Toute la page, au fil du défilement, liens et mise en forme conservés, bascule original ↔ traduction | Bergamot + modèles Mozilla |
| **Dictionnaire personnel** | « Ajouter au dictionnaire » dans l'infobulle ou le panneau : le mot n'est plus souligné, en français comme en anglais, et il est proposé quand tu l'écris avec une faute de frappe. Liste modifiable, import et export en .txt | — |
| **Glossaire de traduction** | Impose la traduction d'un terme dans les deux sens (« serveur ↔ server » : fini le « waiter ») et garde tels quels les termes à ne jamais traduire (« logs », « VLAN »). Vaut pour la sélection, la page entière et la traduction rapide | Bergamot, guidé par des marqueurs posés autour des termes |
| **Répétitions** | Vague bleue sous un mot plein revenu trop vite (« il faut vérifier… il faut aussi **vérifier** »), avec des synonymes dans l'infobulle. En français, les formes d'un même mot comptent ensemble (serveur, serveurs). Sigles, noms propres, petits mots, unités (« huit heures… deux heures ») et mots du dictionnaire personnel ne comptent pas. Distance réglable de 10 à 60 mots | Morphologie et thésaurus de Grammalecte (français), WordNet (anglais) |
| **Français écrit soigné** | Réglage décoché par défaut : signale aussi ce que les grammaires condamnent à l'écrit mais qui passe à l'oral, comme le *ne* oublié (« j'ai pas le temps »), « je n'ai **pas** vu personne », « se rappeler **de** cette journée », « pallier **à** », « aller **au** coiffeur ». Réglable site par site : activé d'office sur Gmail et Outlook, coupé sur Discord, et un choix *Comme d'habitude / Toujours / Jamais* dans la popup pour le site ouvert | Grammalecte (règle du *ne*) et règles d'Aria |
| **Relecture avant envoi** | Dans Gmail, au clic sur « Envoyer » (ou Ctrl+Entrée), s'il reste des fautes d'orthographe ou de grammaire dans ce que tu as écrit (citation et signature exclues), le mail est retenu : *Voir les fautes* ou *Envoyer quand même*. Sans faute, il part normalement ; en cas de doute (analyse trop longue, page de Gmail modifiée), il part aussi | Grammalecte, Harper |
| **Tes fautes récurrentes** | Les corrections que tu acceptes sont comptées par famille (homophones, participe passé, -er/-é, conjugaison…) ; la page de réglages montre le top 5 avec tes derniers exemples et la règle en une ligne. Tout reste dans le navigateur, comptage désactivable, bouton pour tout effacer | Familles des règles de Grammalecte et d'Aria |
| **Réglages** | Délai avant analyse, variante d'anglais, catégories signalées, répétitions et leur distance, français écrit soigné, couleurs des vagues, correcteur du navigateur masqué, mots ignorés, dictionnaire, glossaire et sites désactivés, export et import dans un fichier | — |
| **Correcteur dans la popup** | Onglet *Correction* de la popup et de la fenêtre séparée : écris ou colle un texte, les fautes se soulignent comme dans les pages (clic droit pour corriger, *Tout corriger*, Copier). Langue automatique, ou imposée en français ou en anglais. **Récupérer** prend le texte sélectionné dans la page, **Renvoyer** l'y remet corrigé ; **Traduire** l'envoie dans l'onglet Traduction ; un compteur donne fautes, répétitions, mots et temps de lecture ; dans la fenêtre séparée assez large, la liste des fautes s'affiche à droite du texte. Marche même si la correction en direct est coupée | Grammalecte, Harper |
| **Traduction rapide** | Deux bulles dans la popup ou dans une fenêtre séparée : écrire dans l'une traduit vers l'autre, dans les deux sens | Bergamot + modèles Mozilla |

La langue est détectée toute seule. Le banc d'essai, accessible depuis la popup, mesure les temps de réponse et vérifie que le navigateur accepte l'extension.

## Installation

L'extension n'est pas publiée sur un store : elle se charge en mode développeur. Avec l'application de bureau, c'est guidé : **Réglages → Application → Extension du navigateur**, un clic sur ton navigateur, puis les trois clics que les navigateurs réservent à l'utilisateur.

1. Récupère le dossier `extension` : le plus simple est `Aria-Plume-extension-<version>.zip` dans les [Releases](https://github.com/ZedjeK/Aria-Plume/releases) (à décompresser), sinon **Code → Download ZIP** sur cette page, ou `git clone`.
2. Ouvre `opera://extensions` (ou `chrome://extensions`, `edge://extensions`…) et active le **Mode développeur**.
3. **Charger l'extension non empaquetée** → choisis le dossier `extension`.
4. Ouvre `opera://extensions/shortcuts` et vérifie les raccourcis : **Alt+Maj+V** (panneau complet) et **Alt+Maj+L** (traduire la sélection). Saisis-les à la main s'ils sont vides.
5. Recharge les onglets déjà ouverts (F5) : la correction en direct ne s'active que dans les pages chargées après l'installation.

Testé sur Opera GX 136 (Chromium 152). L'extension utilise le document offscreen et l'API CSS Custom Highlight : il faut un navigateur Chromium récent.

**Pour mettre à jour** : remplace le dossier `extension`, puis clique sur ⟳ sur la carte d'Aria Plume et recharge tes onglets.

### L'application de bureau (Windows)

Dans les [Releases](https://github.com/ZedjeK/Aria-Plume/releases) : `Aria-Plume-<version>-portable.exe` (un seul fichier, rien à installer) ou `Aria-Plume-<version>-win-x64.zip` (un dossier à décompresser, démarrage immédiat). Correcteur, traduction, conjugaison, raccourci global **Alt+Maj+C** sur une sélection dans n'importe quel logiciel, et **serveur MCP** (`--mcp`) pour prêter ces outils à Claude Desktop, LM Studio ou toute IA qui parle MCP. Détails : [`app/README.md`](app/README.md). Au premier lancement, SmartScreen avertit (exe non signé) : « Informations complémentaires » → « Exécuter quand même ».

## Premiers pas

1. **Écris** dans n'importe quel champ : les fautes se soulignent 500 ms après ta dernière frappe. Rouge pour l'orthographe, orange pour la grammaire, bleu pour le style et la typographie.
2. **Clic droit sur un mot souligné** : l'infobulle explique la faute et propose la correction. « Ajouter au dictionnaire » apprend un mot (`systemd`, `Elegoo`…) une fois pour toutes. Ailleurs, le menu habituel du navigateur reste là.
3. **Trouver un synonyme** : clic droit sur un mot → *Aria Plume* → *Synonymes avec Aria Plume*, puis clic sur le synonyme choisi.
4. **Traduire un passage** : sélectionne-le, clic droit → *Aria Plume* → *Traduire avec Aria Plume* (ou Alt+Maj+L).
5. **Traduire la page** : clic droit sur la page → *Traduire la page avec Aria Plume*, ou le bouton de la popup. La barre en haut à droite bascule entre la traduction et l'original ; la croix remet tout comme avant.
6. **La popup** (clic sur l'icône) : correction en direct on/off, désactivation par site, français soigné pour le site ouvert, traduction rapide, correcteur, conjugueur, réglages et banc d'essai. Le bouton ⧉ l'ouvre dans une **fenêtre séparée**, redimensionnable, qui reste ouverte et suit l'onglet que tu regardes.

## Sécurité

- **Aucun accès réseau** : la politique de sécurité de l'extension (`connect-src 'self'`) bride le service worker, le document offscreen et les moteurs : même en cas de bug, ils ne peuvent rien envoyer à l'extérieur. Le script injecté dans les pages n'est pas couvert par cette politique, mais il ne fait aucun appel réseau et ne communique qu'avec l'extension. Les moteurs et les modèles sont dans le dossier `extension`.
- **Champs ignorés** : les champs de mot de passe, ceux que le site déclare comme numéro de carte bancaire ou code à usage unique (attribut `autocomplete`) et les éditeurs de code ne sont jamais lus. Un champ sensible mal balisé par le site peut être analysé, mais toujours en local.
- **Modèles vérifiés** : l'empreinte SHA-256 publiée par Mozilla est contrôlée à chaque chargement d'un modèle.
- **Rien d'envoyé** : les réglages, les mots ignorés, le dictionnaire personnel, le glossaire et le décompte de tes fautes restent dans le stockage local du navigateur ; les textes de la traduction rapide dans le stockage de session, effacé à la fermeture du navigateur. L'export des réglages crée un fichier sur ton PC, rien de plus.

| Permission | Pourquoi |
| --- | --- |
| Lire et modifier les données de tous les sites | Souligner les fautes et traduire dans les pages. La lecture reste locale : rien n'est envoyé |
| `offscreen` | Faire tourner les moteurs WebAssembly dans un document caché de l'extension |
| `scripting` | Réinjecter le script dans un onglet ouvert avant une mise à jour de l'extension |
| `contextMenus` | Entrées du clic droit |
| `storage` | Réglages, mots ignorés, dictionnaire personnel, glossaire et textes de la traduction rapide |

### Limites à connaître

- Les règles d'homophones sont prudentes et laissent passer les cas ambigus (« **Sa** plante encore », où « plante » peut être un nom) et les mots inconnus du dictionnaire.
- Les règles de grammaire d'Aria restent prudentes : « elle s'est **coupée** le doigt » (*coupé*, à cause du complément « le doigt ») n'est pas encore repéré, et avec *nous* ou *vous* (qui peuvent désigner une seule personne), l'accord du participe pronominal est laissé à Grammalecte.
- Les homophones couverts par Aria sont sa/ça, et/est, a/à, ces/ses/c'est/s'est, on/ont, quel/qu'elle et ni/n'y ; son/sont, ou/où ou ce/se restent à la charge de Grammalecte.
- La traduction manque parfois de contexte : seul, « Le serveur est tombé en panne » devient « The **waiter** broke down ». Le glossaire corrige les termes que tu y mets ; relis le reste du jargon technique.
- Un terme imposé par le glossaire ne change pas les mots autour : en français, l'article reste celui que le modèle avait choisi (« le borne Wi-Fi » si le modèle pensait à « le point d'accès »).
- La traduction de page ne traite pas le contenu des iframes, et traduit toute la page dans le même sens.
- La relecture avant envoi repose sur la structure de la page de Gmail (bouton « Envoyer », zone de rédaction) : testée sur une reproduction locale, à confirmer sur le vrai Gmail. Si Gmail change sa page, la relecture ne se déclenche plus, mais n'empêche jamais l'envoi.
- Les applications de bureau (Discord, Gmail…) et Google Docs, qui dessine son texte sur un canvas, sont hors de portée d'une extension.
- Les synonymes proposés pour une répétition viennent des mêmes thésaurus, qui ignorent le contexte : pour « serveur », ils proposent « barman ». Choisis, ou clique sur « Ignorer » pour ne plus voir ce mot signalé.
- Les thésaurus mélangent les sens d'un mot : pour « rapide », « agile » côtoie « bref » ou « alarme », et « serveur » n'a pas de sens informatique en français. En anglais, seules les formes régulières retrouvent leur base (« servers », « running », pas « broke »).
- Projet personnel, sans audit de sécurité indépendant.

## Moteur Aria

Toute la logique (correction, traduction, conjugaison, synonymes) vit dans `extension/core/`, sans dépendance à Chrome : le même moteur tourne dans l'extension et sous Node, première brique de l'application et du serveur MCP à venir. Contrat de l'interface : [`extension/core/api.md`](extension/core/api.md). Feuille de route : [`docs/FEUILLE-DE-ROUTE.md`](docs/FEUILLE-DE-ROUTE.md).

```sh
node tests/node/smoke.mjs     # le moteur sous Node : vérification, traduction, conjugaison, synonymes
node tests/bench/run.mjs      # banc de mesure : corpus FR et EN, textes avec fautes, tests de Grammalecte, exemples WordNet
node tests/bench/robustesse.mjs   # cas limites : vide, énorme, emojis, code, URL, chemins, accents décomposés…
node tests/bench/endurance.mjs --minutes 60   # phrases générées à la volée pendant une heure
```

Node 22 ou plus récent. Aucune dépendance npm.

## Provenance des composants embarqués

Les fichiers des moteurs sont copiés sans modification depuis leur source officielle.

| Composant | Source | Vérification |
| --- | --- | --- |
| Grammalecte 2.3.0 | Extension officielle `grammalecte_fr-2.3.0.xpi`, addons.mozilla.org | SHA-256 de l'xpi : `443030004dbf62ecd5fc42f7b96872b96c9e3765f1cba4704a2a4170bb945256`. Seuls les fichiers du moteur, le dictionnaire `fr-allvars.json` et le thésaurus (`thesaurus1_data.json`, `thesaurus2_data.json`) sont repris |
| harper.js 2.10.0 | Paquet npm `harper.js` | Intégrité npm : `sha512-s6BDuqtRbX8M/5exH1G5M7VzAuv6l0TagbRxMY37OsrT/1kWFjWmqHydWrkYFqTUW+fFhu4Hj2yUxvChp862Pg==`. SHA-256 de `harper_wasm_slim_bg.wasm` : `8d354f62d697194235959cb6fa58699b195c058de36d59e914f4078410e9e0a1` |
| Bergamot Translator 0.4.9 | Paquet npm `@browsermt/bergamot-translator` | Intégrité npm : `sha512-bNuuCwM/JnsIYQCKXcYKFT4Qc5vLMoB8Nbvz8ReIgs7xzebK8Sa+R8iEK8mLvNBe/WaZ6zrPaUQilLsRT/ea8Q==`. SHA-256 de `bergamot-translator-worker.wasm` : `95a2b58dd6773bf1b3f345d71f9149928b9f75f4ec9c9064c0b3e42c298671b2` |
| WordNet 3.1 | Paquet npm `wordnet-db` 3.1.14 | Intégrité npm : `sha512-zVyFsvE+mq9MCmwXUWHIcpfbrHHClZWZiVOzKSxNJruIcFn2RbY55zkhiAMMxM8zCVSmtNiViq8FsAZSFpMYag==`. Converti en `extension/data/thesaurus-en.json.gz` par `tools/build-thesaurus-en.mjs` (même entrée, même fichier) |
| Modèles Mozilla fr→en et en→fr 2.0 | Mozilla Remote Settings, collection `translations-models` | Empreintes SHA-256 publiées par Mozilla, recopiées dans `extension/models/registry.json` et contrôlées par l'extension après décompression |

## Structure

```text
extension/
├── manifest.json               # Manifest V3 : permissions, raccourcis, CSP sans réseau
├── background.js               # service worker : menus, raccourcis, détection de langue, routage
├── offscreen/                  # document caché qui fait tourner le moteur (relais vers core/)
├── core/                       # moteur Aria : notre code, sans dépendance à Chrome (voir docs/FEUILLE-DE-ROUTE.md)
│   ├── api.md                  # contrat de l'interface
│   ├── index.js                # interface unique : createAria(plateforme) → check, translate, conjugate, synonyms
│   ├── service.js              # réglages, détection de langue, fautes récurrentes : partagé par l'extension et l'application
│   ├── platform/
│   │   ├── browser.js          # lecture des fichiers, workers et imports dans un navigateur
│   │   ├── node.js             # la même chose sous Node (worker_threads)
│   │   └── node-worker.js      # amorce : donne aux workers l'environnement d'un navigateur
│   ├── fr/
│   │   ├── worker.js           # Grammalecte : suggestions améliorées, accords complets, synonymes, conjugaison, répétitions
│   │   └── homophones.js       # règles d'Aria : homophones, participes, concordance, registre…
│   ├── en/
│   │   ├── worker.js           # Harper
│   │   ├── rules.js            # règles anglaises d'Aria (then/than, your/you're, its/it's…)
│   │   ├── repetitions.js      # répétitions en anglais
│   │   └── thesaurus.js        # synonymes anglais (WordNet)
│   ├── translate/
│   │   └── glossary.js         # glossaire de traduction
│   └── shared/
│       ├── settings.js         # réglages par défaut et contrôle des valeurs importées
│       └── mistakes.js         # familles de fautes récurrentes
├── content/
│   ├── checker.js              # script de page : vagues, infobulles, panneau, traduction
│   └── highlight.css           # couleurs des vagues dans les zones éditables
├── popup/                      # interrupteurs, traduction rapide, correcteur, conjugueur, fenêtre séparée
├── options/                    # page de réglages
├── test/                       # banc d'essai
├── icons/                      # logo (SVG) et icônes de l'extension
├── data/                       # thésaurus anglais tiré de WordNet et sa licence
├── engines/                    # Grammalecte (et son thésaurus), Harper, Bergamot (tiers, non modifiés)
└── models/                     # modèles de traduction Mozilla (gzip) et leurs empreintes
app/                            # application de bureau (Electron, en construction) : voir app/README.md
tools/
└── build-thesaurus-en.mjs      # conversion de WordNet en thésaurus anglais
tests/
├── bench/                      # banc de mesure (run.mjs), robustesse (robustesse.mjs), endurance (endurance.mjs)
└── node/                       # le moteur sous Node : node tests/node/smoke.mjs
```

## Licence

Code d'Aria Plume sous licence [MIT](LICENSE). Les composants tiers gardent leur propre licence : Grammalecte sous GPL-3.0, Harper sous Apache-2.0, Bergamot et les modèles Mozilla sous MPL-2.0, WordNet sous la licence de Princeton. Comme l'extension embarque Grammalecte, l'extension prise comme un tout est diffusée selon les termes de la GPL-3.0. Détails et textes complets : [LICENCES-TIERS.txt](LICENCES-TIERS.txt).

Aria Plume n'est ni affilié ni approuvé par les projets Grammalecte, Harper, Bergamot, Mozilla ou WordNet.
