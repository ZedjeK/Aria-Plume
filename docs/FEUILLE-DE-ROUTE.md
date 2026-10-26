# Aria Plume — feuille de route

> Objectif : une application Aria Plume sur le PC, qui fait tourner les moteurs une seule fois
> et les met à disposition de partout : navigateur, mails, n'importe quel logiciel, et les IA via MCP.
> Ensuite, remplacer pas à pas les moteurs tiers par le nôtre, mesuré à chaque étape.

Dernière mise à jour : 26 octobre 2026 — extension en version 0.29.0. **Phase 1 terminée.**

## Règles du chantier

- **Rien ne casse en route.** L'extension continue de fonctionner seule à chaque étape.
- **Une étape à la fois**, validée par Jérémy avant de passer à la suivante.
- **On mesure avant de remplacer.** Une pièce maison ne remplace un moteur tiers que si le banc de tests prouve qu'elle fait au moins aussi bien.
- **Tout est écrit ici et dans le dépôt.** Claude ne garde pas la mémoire d'une session à l'autre : ce fichier est le fil à reprendre.
- **100 % local** : aucun texte ne sort du PC (sauf si l'utilisateur branche lui-même le MCP sur une IA en ligne).
- **Licence** : GPL-3.0, comme aujourd'hui (Grammalecte l'impose, et on s'en inspire).

## Niveau d'effort de Claude

Le réglage d'effort dit à Claude combien réfléchir avant d'agir : plus c'est haut, plus c'est soigné, mais plus c'est lent et consommateur. Le niveau conseillé pour chaque tâche figure dans les tableaux ci-dessous.

| Niveau | Pour quoi |
|---|---|
| `low` | Tâches mécaniques : doc, renommage, déplacement de fichiers sans changer leur logique |
| `medium` | Code classique bien balisé : interface, fenêtre, outil MCP qui appelle une fonction existante |
| `high` | Code délicat : refonte sans régression, adaptateurs Node, sécurité, intégration Windows |
| `xhigh` | Algorithmes et linguistique : correcteur d'orthographe, analyse des mots |
| `max` | Le cœur dur : moteur de règles de grammaire et règles qui doivent égaler Grammalecte |

---

## Vue d'ensemble

| Phase | Contenu | Effort |
|---|---|---|
| 1 | Socle `core/` : une interface unique, utilisable dans le navigateur et sous Node | `high` |
| 2 | Application portable (Electron) : fenêtre, icône près de l'horloge, raccourci global | `medium` → `high` |
| 3 | Pont extension ↔ application (localhost sécurisé) | `high` |
| 4 | Serveur MCP (`aria-plume --mcp`) | `medium` |
| 5 | Thunderbird | `medium` → `high` |
| 6 | Outlook et Word (compléments Office) | `high` |
| 7 | Moteur Aria : orthographe, analyse, règles, puis langues | `xhigh` → `max` |

Les phases 2 à 6 dépendent de la 1. La phase 7 peut avancer en parallèle dès que la phase 1 est faite : chaque pièce réécrite profite automatiquement à l'extension, à l'application et au MCP.

---

## Phase 1 — Le socle `core/`

**But** : sortir la logique des moteurs de la plomberie MV3 (offscreen, service worker) pour qu'elle tourne à l'identique dans l'extension, dans l'application et sous Node pour les tests et le MCP.

**Critère de réussite** : l'extension se comporte exactement comme en 0.28.0 (toute la suite Playwright au vert, corpus FR 118/120 sans fausse alerte, corpus EN 20/20), et un script Node peut corriger, conjuguer et donner des synonymes, en français comme en anglais, avec les mêmes résultats.

### Structure proposée

```
extension/
    core/                     ← NOUVEAU : notre code, sans dépendance à Chrome
        index.js              createAria(platform) → { check, translate, conjugate, synonyms, info }
        api.md                contrat de l'interface (entrées, sorties, erreurs)
        fr/
            worker.js         ← workers/fr_worker.js
            homophones.js     ← workers/fr_homophones.js
        en/
            worker.js         ← workers/en_worker.js
            rules.js          ← workers/en_rules.js
            repetitions.js    ← offscreen/repetitions-en.js
            thesaurus.js      ← offscreen/thesaurus-en.js
        translate/
            translator.js     pilotage de Bergamot, sorti de offscreen.js
            glossary.js       ← offscreen/glossary.js
        shared/
            settings.js       ← shared/settings.js
            mistakes.js       ← shared/mistakes.js
        platform/
            browser.js        chargement des fichiers et des workers dans un navigateur
            node.js           idem sous Node (fs + worker_threads, shims pour Grammalecte)
    engines/                  moteurs tiers, inchangés
    models/  data/            inchangés
    offscreen/offscreen.js    réduit à : createAria(browserPlatform) + relais des messages
    background.js, content/, popup/, options/   inchangés sauf les chemins d'import
tests/
    bench/                    banc unifié : corpus FR et EN, tests Grammalecte, exemples WordNet,
                              lancé sous Node via core/ (plus besoin de Chromium pour mesurer)
```

**Pourquoi `core/` dans `extension/`** : une extension ne peut charger que des fichiers de son propre dossier. En gardant `core/` dedans, le dossier `extension/` reste chargeable tel quel (ton `git pull` + « Charger l'extension non empaquetée » ne changent pas), sans étape de construction et sans dupliquer les 90 Mo de moteurs. L'application ira chercher `extension/core` et `extension/engines` directement.

### Interface (aperçu)

```js
const aria = await createAria(platform);

await aria.check({ text, lang: "fr" | "en", dialect, formal, repetitions, dictionary });
// → { lang, results: [{ start, end, kind, message, suggestions, rule }] }

await aria.translate({ text, from: "fr", to: "en", html: false, glossary });
// → { text }

await aria.conjugate({ verb: "prendre" });
await aria.synonyms({ word: "rapide", lang: "fr" });
aria.info();   // versions des moteurs, temps de chargement
```

Les moteurs restent chargés à la demande, comme aujourd'hui.

### Étapes

| # | Tâche | Effort |
|---|---|---|
| 1.1 | Déplacer nos fichiers dans `core/` sans changer leur logique, corriger les chemins, suite complète au vert | `medium` |
| 1.2 | Écrire `core/index.js` et `platform/browser.js`, réduire `offscreen.js` à un relais | `high` |
| 1.3 | Écrire `platform/node.js` : Grammalecte (scripts classiques et `loadFile` synchrone), Harper (WebAssembly) | `high` |
| 1.4 | Bergamot sous Node : à vérifier. Si ça résiste, la traduction passera par la partie Chromium d'Electron (aucun impact sur l'application) | `high` |
| 1.5 | Banc unifié `tests/bench/` sous Node, mêmes chiffres qu'aujourd'hui | `medium` |
| 1.6 | `api.md`, README, version 0.29.0 | `low` |

---

## Phase 2 — L'application portable

**Choix recommandé : Electron.** Il embarque Chromium et Node : nos trois moteurs tournent tels quels, et le MCP est simple. Prix : environ 250 Mo avec les modèles de traduction. Alternative écartée pour l'instant : Tauri (beaucoup plus léger, mais Rust et adaptations partout).

**Portable d'abord** : un dossier ou un `.exe`, sans droits administrateur. Un installeur plus tard, si besoin.

| # | Tâche | Effort |
|---|---|---|
| 2.1 | Squelette Electron : fenêtre cachée qui héberge `core/`, icône près de l'horloge, démarrage avec Windows (option) | `medium` |
| 2.2 | Fenêtre de correction : reprise du correcteur de la popup (texte, liste des fautes, Tout corriger, Traduire, Conjugaison) | `medium` |
| 2.3 | Raccourci global « à la Antidote » : sélection dans n'importe quel logiciel → copie → correction dans la fenêtre → recollage. Le presse-papiers d'origine est restauré | `high` |
| 2.4 | Réglages partagés avec l'extension (dictionnaire, glossaire, mots ignorés…) | `medium` |
| 2.5 | Paquet portable (`electron-builder`), test sur le PC de Jérémy avec son antivirus | `medium` |

**Points d'attention** :
- **SmartScreen** : avertissement sur un `.exe` non signé. Un certificat de signature coûte plusieurs centaines d'euros par an. Pour un usage perso, « Exécuter quand même » suffit.
- **Antivirus** : surveiller le presse-papiers et un raccourci global peut éveiller les soupçons. À tester tôt.

---

## Phase 3 — Le pont extension ↔ application

Quand l'application tourne, l'extension lui confie le travail (moteurs déjà chargés, mémoire économisée). Sinon, elle continue seule.

| # | Tâche | Effort |
|---|---|---|
| 3.1 | Serveur local dans l'application (`127.0.0.1` uniquement, port fixe configurable) | `medium` |
| 3.2 | Sécurité : n'importe quel site web peut appeler `localhost`, donc jeton partagé + vérification de l'origine (`chrome-extension://<id>`). Aucun accès sans jeton | `high` |
| 3.3 | Côté extension : détection de l'application, bascule automatique, retour au mode autonome si elle disparaît | `high` |

---

## Phase 4 — Le serveur MCP

Le même `.exe`, lancé avec `--mcp`, parle le protocole MCP sur l'entrée et la sortie standard.

| # | Tâche | Effort |
|---|---|---|
| 4.1 | Outils `corriger`, `traduire`, `conjuguer`, `synonymes` (+ `info`), décrits pour les IA | `medium` |
| 4.2 | Vérifier qu'un exécutable Electron communique bien en stdio sous Windows. Sinon, petit lanceur Node qui relaie vers l'application | `high` |
| 4.3 | Configuration prête à copier pour Claude Desktop, LM Studio et Ollama (via un client MCP) | `low` |

Avec une IA locale, tout reste sur le PC. Avec une IA en ligne (Claude Desktop), le texte part de toute façon chez elle : Aria Plume n'y change rien.

---

## Phase 5 — Thunderbird

Les extensions Thunderbird reposent sur les WebExtensions, comme la nôtre : une bonne partie du code se réutilise. Il faut adapter la fenêtre de rédaction (`compose_scripts`) et la relecture avant envoi.

| # | Tâche | Effort |
|---|---|---|
| 5.1 | Portage : correction en direct dans la fenêtre de rédaction | `high` |
| 5.2 | Relecture avant envoi, branchement sur l'application (phase 3) | `medium` |

---

## Phase 6 — Outlook et Word

Compléments Office (« Office Add-ins ») : un manifeste à installer, contenu servi en HTTPS, API Office.js. C'est faisable, mais c'est le morceau le plus contraignant. On y viendra en dernier.

| # | Tâche | Effort |
|---|---|---|
| 6.1 | Complément Outlook : volet de correction du message en cours | `high` |
| 6.2 | Complément Word : volet de correction du document | `high` |
| 6.3 | HTTPS local et installation du manifeste sans droits administrateur (à vérifier) | `high` |

---

## Phase 7 — Le moteur Aria

On remplace les moteurs tiers pièce par pièce, chaque pièce mesurée contre l'ancienne sur le banc de tests.

| # | Pièce | Comment | Effort |
|---|---|---|---|
| 7.1 | Format de règles déclaratif | Réécrire nos règles actuelles (FR et EN) dans un format lisible, testable une par une | `xhigh` |
| 7.2 | Correcteur d'orthographe | Dictionnaires libres (LibreOffice, Grammalecte : licences à vérifier), suggestions selon le clavier AZERTY/QWERTY. Comparé à Grammalecte et Harper | `xhigh` |
| 7.3 | Analyse des mots | Nature, genre, nombre, conjugaison, à partir des lexiques ouverts | `xhigh` |
| 7.4 | Moteur de règles de grammaire | Désambiguïsation, groupes de mots, accords | `max` |
| 7.5 | Règles, famille par famille | Accords, homophones, conjugaison… jusqu'à égaler Grammalecte sur ses propres tests | `max` |
| 7.6 | Même chemin pour l'anglais | Comparé à Harper | `max` |
| 7.7 | Nouvelles langues | Orthographe (dictionnaires libres) puis grammaire, langue par langue | `high` → `max` |

**Ce qui ne change pas : la traduction reste sur Bergamot et les modèles Mozilla.** Entraîner nos propres modèles demanderait des millions de phrases et des cartes graphiques pendant des jours, pour un résultat probablement moins bon. On peut en revanche ajouter facilement des paires de langues : Mozilla en publie déjà beaucoup.

---

## Journal

| Date | Étape | Résultat |
|---|---|---|
| 26/10/2026 | Feuille de route rédigée | Validée par Jérémy |
| 26/10/2026 | 1.1 — fichiers déplacés dans `core/` | Suite Playwright au vert (19 scénarios), corpus FR 118/120 sans fausse alerte, corpus EN 20/20, tests Grammalecte inchangés (1 signalement hors zone, correct), WordNet 2 signalements sur 47 478 (deux vraies fautes). Seul changement de logique : le thésaurus anglais trouve son fichier par rapport à son propre module |
| 26/10/2026 | 1.2 — `core/index.js` (`createAria`) et `core/platform/browser.js` ; `offscreen.js` réduit à un relais | Suite Playwright au vert (19 scénarios, du premier coup), corpus FR et EN inchangés. Le thésaurus et les répétitions anglaises reçoivent leurs données de la plateforme : ils tournent déjà sous Node. Nouvelle commande `info` (moteurs chargés, temps de chargement) |
| 26/10/2026 | 1.3 — `core/platform/node.js` et `node-worker.js` | Grammalecte et Harper tournent sous Node du premier coup : vérification FR (avec le français soigné et les répétitions), EN (avec dialecte et répétitions), conjugaison, synonymes FR et EN. Chargement : FR 0,7 s, EN 1,2 s ; `tests/node/smoke.mjs` complet en 2,9 s. Sortie standard propre (journaux de Grammalecte coupés, `ARIA_DEBUG=1` pour les voir). Ajout de `aria.close()`. Repéré au passage : Grammalecte propose « n'va » pour « On va pas » (au lieu de « ne va ») |
| 26/10/2026 | 1.4 — Bergamot sous Node | La traduction marche sous Node sans adaptation (Bergamot a sa propre couche Node) : FR→EN, EN→FR, HTML, 11 demandes en parallèle en 1,8 s. Reste le glossaire, qui s'appuie sur le DOM du navigateur : sous Node, il renvoie pour l'instant une erreur claire. Décision demandée à Jérémy sur la façon de le rendre indépendant du DOM |
| 26/10/2026 | 1.4 (suite) — glossaire sans DOM | Choix de Jérémy : réécriture plutôt que dépendance. Petit analyseur HTML maison (balises recopiées telles quelles, entités décodées). Comparé à l'ancienne version (navigateur) sur 20 cas texte et HTML, avec les vraies traductions de Bergamot : préparation identique 20/20, résultat final identique 20/20. Tests du glossaire et de la traduction dans l'extension au vert ; le glossaire marche sous Node. Défauts déjà présents notés pour plus tard : « Le arbre » (élision), « la lien montant » (genre de l'article), « lognewspaper » (mot doublé dans une phrase HTML découpée) |
| 26/10/2026 | 1.5 — banc unifié `tests/bench/run.mjs` | Une commande, quatre suites, 3,6 s au total, sans Chromium. Mêmes chiffres qu'avant : FR 118/120 (118 en 1re position), 0 fausse alerte sur 212 ; EN 20/20 ; Grammalecte 1 hors zone, 44 dans les zones ; WordNet 2 signalements. Référence dans `baseline.json` : le banc sort en erreur au moindre recul (`--update` pour enregistrer un progrès). Les données (tests Grammalecte, exemples WordNet) sont dans le dépôt, compressées. Ancien `tests/francais` et `tests/anglais` remplacés |
| 26/10/2026 | 1.6 — `core/api.md`, README, version 0.29.0 | Contrat de l'interface écrit et vérifié sur les vraies réponses du moteur. **Phase 1 terminée** : critère de réussite atteint (extension identique, moteur complet sous Node avec les mêmes résultats). Prochaine : phase 2, l'application portable |
| 26/10/2026 | 2.1 — squelette Electron (`app/`) | Electron 44.7.0. Moteur Aria directement dans le processus principal (plateforme Node), fenêtre isolée (contextIsolation, sandbox, pas de Node) qui ne voit que `window.aria`, icône près de l'horloge (Ouvrir, Démarrer avec Windows, fichier de réglages, Quitter), instance unique, fermeture = cacher, réglages JSON portables. Test `app/tests/smoke.mjs` au vert : correction FR et EN, traduction, réglages contrôlés, cacher/réafficher, sortie propre. Deux pièges notés : pas de `await app.whenReady()` au niveau du module (Electron attend la fin du module pour émettre `ready`), et pas de `will-quit` retardé (Electron ne se termine plus). Non testable ici : l'icône et « Démarrer avec Windows » sous Windows |
| 26/10/2026 | 2.2 — le correcteur dans la fenêtre | La logique du service worker (détection, réglages, traduction ligne par ligne, synonymes, fautes récurrentes) passe dans `core/service.js`, partagé par l'extension et l'application (suite Playwright de l'extension au vert). La fenêtre affiche le correcteur de l'extension lui-même, servi en `aria://app/`, avec un pont `chrome.*` (messages → service, stockage → fichier de réglages) : Traduction, Correction, Conjugaison et « Tout corriger » à l'identique. Fichiers servis limités, CSP stricte. Test `app/tests/smoke.mjs` : 22 vérifications au vert. Limite : pas de détecteur de langue du navigateur dans l'application (mots-outils seulement) |
