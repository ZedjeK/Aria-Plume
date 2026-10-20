<p align="center">
  <img src="docs/logo.png" width="160" alt="Logo d'Aria ODL : un A néon glitché avec une bulle de texte orange et sa vague de correction">
</p>

<h1 align="center">Aria ODL</h1>

<p align="center">
  Un correcteur et un traducteur français ↔ anglais pour Opera GX et les navigateurs Chromium.<br>
  Tout se passe sur ton PC : aucun serveur, aucun compte, pas un octet ne sort de ta machine.<br>
  Rien à installer : une extension, et c'est tout.
</p>

<p align="center">
  <a href="#installation"><b>Installer l'extension</b></a> · v0.10 · Opera GX et navigateurs Chromium récents · licence MIT (code d'Aria) / GPL-3.0 (ensemble)
</p>

ODL = **O**util **D**e **L**angage.

## Ce qu'il fait

| Fonction | Ce que ça fait | Moteur |
| --- | --- | --- |
| **Correction en direct** | Souligne les fautes pendant que tu écris, dans n'importe quel champ (Gmail, Discord, claude.ai…). Clic droit sur un mot souligné : l'infobulle propose la correction | Grammalecte (français), Harper (anglais) |
| **Accords complets** | Quand un accord touche plusieurs mots, une seule vague couvre le passage et propose la phrase entièrement corrigée (« Les enfant sont prêt » → « Les enfants sont prêts ») | Grammalecte, relancé jusqu'à ce que le passage soit sans faute |
| **Homophones** | Ce que Grammalecte laisse passer : « **Sa** marche pas » → *Ça*, « le serveur **et** tombé » → *est*, « il **à** fini » → *a*, « **ces** pas grave » → *C'est*, « il **ses** trompé » → *s'est*, « ils **on** fini » → *ont*. Règles prudentes : dans le doute, rien n'est souligné | Règles d'Aria sur la morphologie de Grammalecte |
| **Panneau complet** | Toutes les fautes du champ actif ou de la sélection, avec leur explication | Grammalecte, Harper |
| **Traduction de sélection** | Sélection ou champ : infobulle avec la traduction, sens inversable, Copier, Remplacer (Ctrl+Z annule) | Bergamot + modèles Mozilla |
| **Traduction de page** | Toute la page, au fil du défilement, liens et mise en forme conservés, bascule original ↔ traduction | Bergamot + modèles Mozilla |
| **Dictionnaire personnel** | « Ajouter au dictionnaire » dans l'infobulle ou le panneau : le mot n'est plus souligné, en français comme en anglais, et il est proposé quand tu l'écris avec une faute de frappe. Liste modifiable, import et export en .txt | — |
| **Glossaire de traduction** | Impose la traduction d'un terme dans les deux sens (« serveur ↔ server » : fini le « waiter ») et garde tels quels les termes à ne jamais traduire (« logs », « VLAN »). Vaut pour la sélection, la page entière et la traduction rapide | Bergamot, guidé par des marqueurs posés autour des termes |
| **Réglages** | Délai avant analyse, variante d'anglais, catégories signalées, couleurs des vagues, correcteur du navigateur masqué, mots ignorés, dictionnaire, glossaire et sites désactivés, export et import dans un fichier | — |
| **Traduction rapide** | Deux bulles dans la popup ou dans une fenêtre séparée : écrire dans l'une traduit vers l'autre, dans les deux sens | Bergamot + modèles Mozilla |

La langue est détectée toute seule. Le banc d'essai, accessible depuis la popup, mesure les temps de réponse et vérifie que le navigateur accepte l'extension.

## Installation

L'extension n'est pas publiée sur un store : elle se charge en mode développeur.

1. Récupère le dossier `extension` : bouton **Code → Download ZIP** sur cette page (puis décompresse), ou `git clone`.
2. Ouvre `opera://extensions` (ou `chrome://extensions`, `edge://extensions`…) et active le **Mode développeur**.
3. **Charger l'extension non empaquetée** → choisis le dossier `extension`.
4. Ouvre `opera://extensions/shortcuts` et vérifie les raccourcis : **Alt+Maj+V** (panneau complet) et **Alt+Maj+L** (traduire la sélection). Saisis-les à la main s'ils sont vides.
5. Recharge les onglets déjà ouverts (F5) : la correction en direct ne s'active que dans les pages chargées après l'installation.

Testé sur Opera GX 136 (Chromium 152). L'extension utilise le document offscreen et l'API CSS Custom Highlight : il faut un navigateur Chromium récent.

**Pour mettre à jour** : remplace le dossier `extension`, puis clique sur ⟳ sur la carte d'Aria ODL et recharge tes onglets.

## Premiers pas

1. **Écris** dans n'importe quel champ : les fautes se soulignent 500 ms après ta dernière frappe. Rouge pour l'orthographe, orange pour la grammaire, bleu pour le style et la typographie.
2. **Clic droit sur un mot souligné** : l'infobulle explique la faute et propose la correction. « Ajouter au dictionnaire » apprend un mot (`systemd`, `Elegoo`…) une fois pour toutes. Ailleurs, le menu habituel du navigateur reste là.
3. **Traduire un passage** : sélectionne-le, clic droit → *Aria ODL* → *Traduire avec Aria ODL* (ou Alt+Maj+L).
4. **Traduire la page** : clic droit sur la page → *Traduire la page avec Aria ODL*, ou le bouton de la popup. La barre en haut à droite bascule entre la traduction et l'original ; la croix remet tout comme avant.
5. **La popup** (clic sur l'icône) : correction en direct on/off, désactivation par site, traduction rapide, réglages et banc d'essai. Le bouton ⧉ l'ouvre dans une **fenêtre séparée**, redimensionnable, qui reste ouverte et suit l'onglet que tu regardes.

## Sécurité

- **Aucun accès réseau** : la politique de sécurité de l'extension (`connect-src 'self'`) bride le service worker, le document offscreen et les moteurs : même en cas de bug, ils ne peuvent rien envoyer à l'extérieur. Le script injecté dans les pages n'est pas couvert par cette politique, mais il ne fait aucun appel réseau et ne communique qu'avec l'extension. Les moteurs et les modèles sont dans le dossier `extension`.
- **Champs ignorés** : les champs de mot de passe, ceux que le site déclare comme numéro de carte bancaire ou code à usage unique (attribut `autocomplete`) et les éditeurs de code ne sont jamais lus. Un champ sensible mal balisé par le site peut être analysé, mais toujours en local.
- **Modèles vérifiés** : l'empreinte SHA-256 publiée par Mozilla est contrôlée à chaque chargement d'un modèle.
- **Rien d'envoyé** : les réglages, les mots ignorés, le dictionnaire personnel et le glossaire restent dans le stockage local du navigateur ; les textes de la traduction rapide dans le stockage de session, effacé à la fermeture du navigateur. L'export des réglages crée un fichier sur ton PC, rien de plus.

| Permission | Pourquoi |
| --- | --- |
| Lire et modifier les données de tous les sites | Souligner les fautes et traduire dans les pages. La lecture reste locale : rien n'est envoyé |
| `offscreen` | Faire tourner les moteurs WebAssembly dans un document caché de l'extension |
| `scripting` | Réinjecter le script dans un onglet ouvert avant une mise à jour de l'extension |
| `contextMenus` | Entrées du clic droit |
| `storage` | Réglages, mots ignorés, dictionnaire personnel, glossaire et textes de la traduction rapide |

### Limites à connaître

- Les règles d'homophones sont prudentes et laissent passer les cas ambigus (« **Sa** plante encore », où « plante » peut être un nom) et les mots inconnus du dictionnaire.
- Les homophones couverts sont sa/ça, et/est, a/à, ces/ses/c'est/s'est et on/ont ; son/sont, ou/où ou ce/se restent à la charge de Grammalecte.
- La traduction manque parfois de contexte : seul, « Le serveur est tombé en panne » devient « The **waiter** broke down ». Le glossaire corrige les termes que tu y mets ; relis le reste du jargon technique.
- Un terme imposé par le glossaire ne change pas les mots autour : en français, l'article reste celui que le modèle avait choisi (« le borne Wi-Fi » si le modèle pensait à « le point d'accès »).
- La traduction de page ne traite pas le contenu des iframes, et traduit toute la page dans le même sens.
- Les applications de bureau (Discord, Gmail…) et Google Docs, qui dessine son texte sur un canvas, sont hors de portée d'une extension.
- Projet personnel, sans audit de sécurité indépendant.

## Provenance des composants embarqués

Les fichiers des moteurs sont copiés sans modification depuis leur source officielle.

| Composant | Source | Vérification |
| --- | --- | --- |
| Grammalecte 2.3.0 | Extension officielle `grammalecte_fr-2.3.0.xpi`, addons.mozilla.org | SHA-256 de l'xpi : `443030004dbf62ecd5fc42f7b96872b96c9e3765f1cba4704a2a4170bb945256`. Seuls les fichiers du moteur et le dictionnaire `fr-allvars.json` sont repris |
| harper.js 2.10.0 | Paquet npm `harper.js` | Intégrité npm : `sha512-s6BDuqtRbX8M/5exH1G5M7VzAuv6l0TagbRxMY37OsrT/1kWFjWmqHydWrkYFqTUW+fFhu4Hj2yUxvChp862Pg==`. SHA-256 de `harper_wasm_slim_bg.wasm` : `8d354f62d697194235959cb6fa58699b195c058de36d59e914f4078410e9e0a1` |
| Bergamot Translator 0.4.9 | Paquet npm `@browsermt/bergamot-translator` | Intégrité npm : `sha512-bNuuCwM/JnsIYQCKXcYKFT4Qc5vLMoB8Nbvz8ReIgs7xzebK8Sa+R8iEK8mLvNBe/WaZ6zrPaUQilLsRT/ea8Q==`. SHA-256 de `bergamot-translator-worker.wasm` : `95a2b58dd6773bf1b3f345d71f9149928b9f75f4ec9c9064c0b3e42c298671b2` |
| Modèles Mozilla fr→en et en→fr 2.0 | Mozilla Remote Settings, collection `translations-models` | Empreintes SHA-256 publiées par Mozilla, recopiées dans `extension/models/registry.json` et contrôlées par l'extension après décompression |

## Structure

```text
extension/
├── manifest.json               # Manifest V3 : permissions, raccourcis, CSP sans réseau
├── background.js               # service worker : menus, raccourcis, détection de langue, routage
├── offscreen/                  # document caché qui héberge les moteurs, glossaire de traduction
├── workers/
│   ├── fr_worker.js            # Grammalecte : suggestions améliorées, accords complets
│   ├── fr_homophones.js        # règles d'homophones (sa/ça, et/est, a/à, c'est/s'est, on/ont)
│   └── en_worker.js            # Harper
├── content/
│   ├── checker.js              # script de page : vagues, infobulles, panneau, traduction
│   └── highlight.css           # couleurs des vagues dans les zones éditables
├── popup/                      # interrupteurs, traduction rapide, fenêtre séparée
├── options/                    # page de réglages
├── shared/                     # réglages par défaut et contrôle des valeurs importées
├── test/                       # banc d'essai
├── icons/                      # logo (SVG) et icônes de l'extension
├── engines/                    # Grammalecte, Harper, Bergamot (tiers, non modifiés)
└── models/                     # modèles de traduction Mozilla (gzip) et leurs empreintes
tests/
└── homophones/                 # corpus de phrases justes et fautives : node tests/homophones/run.js
```

## Licence

Code d'Aria ODL sous licence [MIT](LICENSE). Les composants tiers gardent leur propre licence : Grammalecte sous GPL-3.0, Harper sous Apache-2.0, Bergamot et les modèles Mozilla sous MPL-2.0. Comme l'extension embarque Grammalecte, l'extension prise comme un tout est diffusée selon les termes de la GPL-3.0. Détails et textes complets : [LICENCES-TIERS.txt](LICENCES-TIERS.txt).

Aria ODL n'est ni affilié ni approuvé par les projets Grammalecte, Harper, Bergamot ou Mozilla.
