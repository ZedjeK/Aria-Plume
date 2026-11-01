# Moteur Aria — contrat de l'interface

Le moteur Aria (`extension/core/`) offre une interface unique, identique dans le navigateur
(extension, fenêtre cachée de l'application) et sous Node (application, serveur MCP, banc de mesure).

```js
import { createAria } from "./core/index.js";
import { browserPlatform } from "./core/platform/browser.js";   // dans un navigateur
import { nodePlatform } from "./core/platform/node.js";         // sous Node 22 et plus

const aria = createAria(nodePlatform);
const { matches } = await aria.check({ text: "Il à fini.", lang: "fr" });
await aria.close();
```

Toutes les méthodes sont asynchrones, sauf `info()`. Les moteurs se chargent au premier usage :
le premier appel est plus lent (Grammalecte ≈ 0,7 s, Harper ≈ 1,2 s, Bergamot ≈ 1,3 s par paire de langues).
En cas de problème, la promesse est rejetée avec une `Error` dont le message est en français.

---

## `check({ text, lang, dialect?, formal?, repetitions? })`

Cherche les fautes d'un texte.

| Entrée | Type | Rôle |
|---|---|---|
| `text` | chaîne | Le texte, une ou plusieurs lignes |
| `lang` | `"fr"` ou `"en"` | Langue du texte (pas de détection automatique ici) |
| `dialect` | `"american"`, `"british"`, `"canadian"`, `"australian"`, `"indian"` | Anglais seulement. Par défaut : `"american"` |
| `formal` | booléen | Français écrit soigné : `ne` de la négation, « se rappeler de », « pallier à »… Par défaut : `false` |
| `repetitions` | nombre | Signale un mot plein revenu à moins de *n* mots. `0` (par défaut) : pas de répétitions |

Avant l'analyse, le texte est nettoyé (espaces de largeur nulle et traits d'union conditionnels retirés, accents décomposés recomposés) ; les positions renvoyées restent celles du texte d'origine. Rien n'est jamais signalé dans le code (`…` et blocs ```), les adresses web, les courriels, les chemins de fichiers et partages réseau, les identifiants techniques (`srv-fic-01`, `eth0`, `max_retry`), les noms à majuscule interne (GitLab), les mentions, hashtags et balises HTML : voir `protect.js`.

Réponse :

```js
{
    matches: [
        {
            start: 3, end: 4,            // positions dans text (unités UTF-16, comme text.slice)
            kind: "grammaire",           // "orthographe", "grammaire", "typographie" ou "style"
            message: "…",                // explication en français
            suggestions: ["a"],          // la meilleure en premier (peut être vide)
            rule: "aria_homophone_a_a",  // identifiant de la règle
            detail: "aria",              // facultatif : origine ou précision ("aria", "répétition"…)
        },
    ],
    engineMs: 12.5,     // temps d'analyse
    loadMs: 0,          // temps de chargement du moteur si cet appel l'a chargé
    cold: false,        // true si cet appel a chargé le moteur
}
```

Les résultats sont triés par position. Les règles d'Aria commencent par `aria_`, celles de
Grammalecte par `g…__` ou `p…__`, celles de Harper par leur nom, la faute d'orthographe par `spelling`.

## `translate({ text, from, to, html?, glossary?, priority?, jobId? })`

Traduit un texte avec Bergamot et les modèles de Mozilla.

| Entrée | Type | Rôle |
|---|---|---|
| `text` | chaîne | Texte brut, ou fragment HTML si `html` |
| `from`, `to` | `"fr"` / `"en"` | Paires disponibles : fr→en et en→fr |
| `html` | booléen | Le texte est du HTML : balises et attributs sont conservés |
| `glossary` | `{ glossary: [{ fr, en }], keepTerms: [] }` | Termes imposés et termes à ne jamais traduire |
| `priority` | nombre | Plus petit = plus urgent (une sélection passe avant les blocs d'une page) |
| `jobId` | chaîne | Regroupe des demandes pour pouvoir les annuler ensemble |

Réponse : `{ text, glossaryHits, engineMs, loadMs, cold, pairCold }`. `text` est du HTML si `html`
était vrai. `glossaryHits` compte les termes du glossaire trouvés dans le texte d'origine.

## `cancelTranslation(jobId)`

Retire de la file d'attente les demandes encore en attente de ce `jobId` (traduction de page arrêtée).

## `conjugate({ verb, options? })`

Conjugue un verbe français. `verb` peut être un infinitif ou une forme conjuguée (« prenons » → prendre).
`options` : `{ pronominal, negative, compound, interrogative, feminine }`, tous booléens.

Réponse si le verbe est trouvé :

```js
{
    found: true, input: "prenons", infinitive: "prendre", others: [], fromForm: true,
    info: "3ᵉ groupe · transitif …", auxiliary: "avoir", pronominable: 0, incomplete: false,
    options: { pronominal: false, negative: false, compound: false, interrogative: false, feminine: false },
    infinitiveForm: "prendre", presentParticiple: "prenant", pastParticiples: ["pris", …],
    moods: [{ name: "Indicatif", tenses: [{ name: "Présent", forms: ["je prends", …] }, …] }, …],
}
```

Sinon : `{ found: false, input, suggestions: ["conjuguer", …] }`.

## `synonyms({ word, lang? })`

Synonymes d'un mot (`lang` : `"fr"` par défaut, ou `"en"`). Les synonymes sont accordés comme le mot
demandé quand c'est possible (« marchaient » → « avançaient »).

Réponse : `{ word, lemma, inflected, groups: [{ pos: "adjectif", words: ["vif", "prompt", …] }] }`
(en anglais, en plus : `base`, vrai quand des formes de base sont montrées).

## `rulesFr({ text, formal? })`

Pour le banc de mesure : les résultats des règles françaises d'Aria seules, sans Grammalecte ni filtrage.

## `info()`

Synchrone. `{ platform: "node", loaded: { fr, en, translation }, loadTimes: { fr, en, translation } }`.

## `close()`

Arrête les workers. Indispensable sous Node pour que le programme se termine.

---

## Service (`core/service.js`)

Au-dessus du moteur, le service applique ce que l'extension et l'application font de la même façon :
détection du français et de l'anglais (`lang: "auto"`), réglages (dialecte, français soigné, répétitions,
dictionnaire personnel, glossaire), traduction ligne par ligne, synonymes cherchés dans la langue de la
phrase puis dans l'autre, fautes récurrentes.

```js
import { createService } from "./core/service.js";
const service = createService({ aria, getSettings, saveValues, detectNative });
await service.check({ text, lang: "auto", host: "mail.google.com" });   // + { lang, detection }
await service.translate({ text, from: "auto", hint: "fr" });           // + { from, to, detection }
await service.synonyms({ word, context });                              // + { lang }
await service.conjugate({ verb, options });
await service.recordMistakes([{ rule, kind, lang, word, suggestion }]);
service.detectLanguage(text);
```

`getSettings(valeursParDéfaut)` et `saveValues(objet)` suivent `chrome.storage.local`. `detectNative`
(facultatif) est le détecteur de langue du navigateur ; sans lui, la détection repose sur les mots-outils.

## Plateformes

Une plateforme fournit ce qui dépend de l'environnement :

| Membre | Rôle |
|---|---|
| `name` | Nom de la plateforme |
| `readFile(url)` | Contenu brut d'un fichier → `Promise<ArrayBuffer>` |
| `createWorker(url, { type? })` | Lance un worker (`type: "module"` ou classique) → `{ post, onMessage, onError, terminate }` |
| `importModule(url)` | Import dynamique d'un module |

Le moteur utilise aussi les objets standard présents dans les navigateurs récents et dans Node 22 :
`fetch`, `Response`, `Blob`, `DecompressionStream`, `crypto.subtle`, `TextDecoder`, `performance`.

---

## Pont avec l'application (`app/bridge/`, `extension/bridge-client.js`)

L'application Aria Plume prête son moteur et ses réglages à l'extension par la messagerie native
des navigateurs Chromium. Rien ne passe par le réseau.

```text
extension ──connectNative("fr.aria_plume.app")──▶ relais (relay.cjs) ──canal local──▶ application
             trames : longueur sur 4 octets + JSON          une ligne JSON par message
```

- **Inscription** : Réglages de l'application → « Connecter les navigateurs ». Dans le dossier
  `Aria Plume - pont` (à côté des réglages) : `relay.cjs`, `relay-config.json`, `relay.cmd` (ou
  `relay.sh`), le manifeste `fr.aria_plume.app.json` et le jeton `jeton`. Sous Windows, une clé
  `HKCU\Software\<navigateur>\NativeMessagingHosts\fr.aria_plume.app` pour Google\Chrome (lue aussi
  par Opera et Vivaldi), Microsoft\Edge, BraveSoftware\Brave-Browser et Chromium. Seule l'extension
  `chrome-extension://fpgalamdbelhkacggnnglgcljhdcioca/` est autorisée (identifiant fixé par la clé
  publique du manifeste, `core/shared/ids.js`). L'exe portable ne peut pas être inscrit.
- **Relais** : lancé par le navigateur avec l'exécutable d'Aria Plume en mode Node
  (`ELECTRON_RUN_AS_NODE=1`). Si l'application ne répond pas, il la démarre (`--hidden`) et réessaie
  pendant 20 s. Il refuse de transmettre au navigateur un message de plus de 1 Mo (réponse d'erreur
  à la place).
- **Canal** : `\\.\pipe\aria-plume-<utilisateur>` sous Windows, socket Unix
  `$XDG_RUNTIME_DIR/aria-plume-<uid>.sock` ailleurs. Premier message obligatoire :
  `{ id: 0, cmd: "hello", token }`, avec le jeton du fichier `jeton` (lisible par l'utilisateur seul) ;
  sinon la connexion est fermée.

Messages de l'application :

| Message | Quand |
|---|---|
| `{ event: "ready", version }` | Jeton accepté : les demandes peuvent partir |
| `{ id, ok: true, ... }` / `{ id, ok: false, error }` | Réponse à une demande |
| `{ event: "settings-changed", changes }` | Réglages modifiés (format de `chrome.storage.onChanged`), à toutes les connexions |

Messages du relais lui-même : `{ event: "starting" }` (il démarre l'application) et
`{ event: "unavailable", error }` (application injoignable, le relais s'arrête).

Demandes (`{ id, cmd, ... }`) :

| `cmd` | Rôle |
|---|---|
| `engine-check`, `engine-translate`, `engine-conjugate`, `engine-synonyms`, `engine-cancel` | Le moteur seul : mêmes entrées que `check`, `translate`, `conjugate`, `synonyms`, `cancelTranslation` ci-dessus. C'est ce qu'utilise l'extension, qui garde son service (détection de langue du navigateur, français soigné selon le site) |
| `check`, `detect`, `translate`, `synonyms`, `conjugate`, `record-mistakes`, `translate-cancel` | Le service de l'application, avec ses réglages (comme sa fenêtre). `check` accepte `host` |
| `settings-get` (`spec`), `settings-set` (`values`), `settings-remove` (`keys`) | Réglages de l'application, comme `chrome.storage.local` ; `settings-set` et `settings-remove` renvoient `changes` |
| `ping` | `{ version }` |

Côté extension (`background.js`), une demande passe par l'application si la connexion est prête, et
par le document offscreen sinon ; une coupure en cours de route se rattrape avec le moteur de
l'extension. Les réponses portent `engine: "application"` ou `"extension"`. Les réglages de
l'application sont recopiés dans `chrome.storage.local` (les pages de l'extension lisent leur
stockage habituel) : fusion à la première connexion, puis changements dans les deux sens, et ceux
faits pendant une coupure sont envoyés à la reconnexion.
