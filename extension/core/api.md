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
