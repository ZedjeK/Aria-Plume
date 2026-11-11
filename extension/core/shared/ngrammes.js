// Aria Plume — modèle de langue par paires de mots (bigrammes), français et anglais, sans réseau ni IA.
//
// Les données (ngrammes-fr.js, ngrammes-en.js) viennent de tools/build-ngrammes.mjs : combien de fois
// chaque mot et chaque paire de mots voisins apparaît dans les phrases de Tatoeba. On en tire la
// probabilité d'un mot entre ses deux voisins : « servir les tartes » est bien plus probable que
// « servir les tettes », « we arrive home » que « we aerie home ».
//
// Script classique (sans import/export), chargé à la demande par les workers ; il dépose
// self.AriaNgrammes. Le découpage en mots doit rester celui de tools/build-ngrammes.mjs.
(function () {
    const ELISION = /^(?:[cdjlmnst]|qu|jusqu|lorsqu|puisqu|quoiqu)'/;
    function tokens(text, lang) {
        const words = String(text).toLowerCase().replace(/[’`]/g, "'").match(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*'?/gu) ?? [];
        const out = [];
        for (const word of words) {
            const elided = lang === "fr" ? ELISION.exec(word) : null;
            if (elided && word.length > elided[0].length) {
                out.push(elided[0], word.slice(elided[0].length));
            } else {
                out.push(word);
            }
        }
        return out;
    }

    const models = {};
    function model(lang) {
        if (!models[lang]) {
            const data = self[`ARIA_NGRAMS_${lang.toUpperCase()}`];
            if (!data) {
                return null;
            }
            const read = (text) => {
                const map = new Map();
                for (const line of String(text).split("\n")) {
                    const tab = line.lastIndexOf("\t");
                    if (tab > 0) {
                        map.set(line.slice(0, tab), Number(line.slice(tab + 1)));
                    }
                }
                return map;
            };
            models[lang] = { total: data.total, unigrams: read(data.unigrams), bigrams: read(data.bigrams) };
        }
        return models[lang];
    }

    // Probabilité de « word » après « prev », avec repli sur la fréquence du mot seul (« stupid
    // backoff ») quand la paire n'a jamais été vue.
    function logPair(m, prev, word) {
        const pair = m.bigrams.get(`${prev} ${word}`);
        const before = m.unigrams.get(prev);
        if (pair && before) {
            return Math.log(pair / before);
        }
        const alone = m.unigrams.get(word) ?? 0.5;
        return Math.log(0.4 * alone / m.total);
    }

    // Probabilité d'une suite de mots (la suggestion) entre le mot d'avant et le mot d'après.
    function score(lang, before, suggestion, after) {
        const m = model(lang);
        if (!m) {
            return null;
        }
        const prev = tokens(before, lang).at(-1) ?? "<s>";
        const next = tokens(after, lang)[0] ?? "</s>";
        const words = [prev, ...tokens(suggestion, lang), next];
        let total = 0;
        for (let i = 1; i < words.length; i++) {
            total += logPair(m, words[i - 1], words[i]);
        }
        return total;
    }

    // Distance d'édition (Damerau, sans les accents ni la casse) entre le mot écrit et une suggestion.
    const plain = (text) => String(text).toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    function distance(a, b) {
        a = plain(a);
        b = plain(b);
        const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
        for (let j = 1; j <= b.length; j++) {
            d[0][j] = j;
        }
        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
                if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                    d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
                }
            }
        }
        return d[a.length][b.length];
    }

    // Remonte en tête la suggestion que le contexte rend nettement plus probable que la première,
    // à condition qu'elle ne soit pas plus loin du mot écrit (« lancait » reste lançait, pas « lance »).
    // Écart demandé en log : 2 (≈ 7 fois plus probable) si elle est plus proche, 6 (≈ 400 fois) à
    // distance égale. Sinon, l'ordre ne change pas.
    function rerank(lang, line, start, end, suggestions, limit = 5) {
        if (suggestions.length < 2) {
            return suggestions;
        }
        // Le contexte s'arrête aux ponctuations fortes : la phrase seulement.
        const before = line.slice(0, start).split(/[.!?;:\n]/).at(-1);
        const after = line.slice(end).split(/[.!?;:\n]/)[0];
        const scored = suggestions.slice(0, limit).map((suggestion) => ({ suggestion, value: score(lang, before, suggestion, after) }));
        if (scored.some((x) => x.value === null)) {
            return suggestions;
        }
        const written = line.slice(start, end);
        const firstDistance = distance(written, suggestions[0]);
        const candidates = scored.filter((x) => distance(written, x.suggestion) <= firstDistance);
        const best = candidates.reduce((a, b) => (b.value > a.value ? b : a));
        const margin = distance(written, best.suggestion) < firstDistance ? 2 : 6;
        if (best.suggestion === suggestions[0] || best.value - scored[0].value < margin) {
            return suggestions;
        }
        return [best.suggestion, ...suggestions.filter((s) => s !== best.suggestion)];
    }

    // --- Détection des homophones par le contexte (sans règle par paire) ---
    // Familles de formes qui se prononcent pareil (ou presque) et qu'on confond à l'écrit, séparées
    // par « / ». Une forme peut tenir en plusieurs mots (« m'a », « plus tôt », « par ce que »).
    // « * » en tête : famille grammaticale, dont les formes n'ont pas la même nature (« a » verbe,
    // « à » préposition) ; la nature des voisins suffit alors à les départager. Pour les homophones de
    // sens (« cote » et « côte », deux noms), seuls les mots exacts comptent. « et/est » n'a pas
    // l'étoile : après un nom propre, les deux se disent (« Margaux et tout… », « Margaux est… »).
    const FAMILIES = {
        fr: [
            // Homophones grammaticaux. « ces » et « ses » ne sont pas opposés l'un à l'autre : les deux
            // se disent au même endroit (« elle a acheté ses gâteaux », « ces gâteaux »).
            "*a/à", "*ou/où", "*ça/sa", "*la/là/l'a/l'as", "*mais/mes/m'est/met/mets", "*ma/m'a", "*ta/t'a", "*mon/m'ont", "*ton/t'ont",
            "*on/ont", "*son/sont", "*ce/se", "*ces/c'est/s'est", "*ses/c'est/s'est", "*ni/n'y", "*si/s'y", "*dans/d'en/dent", "*quand/quant/qu'en",
            "*quelle/qu'elle", "*quelles/qu'elles", "*peu/peut/peux", "*plutôt/plus tôt", "*près/prêt", "*tout/tous",
            "*davantage/d'avantage", "*parce que/par ce que", "*quoique/quoi que", "*voir/voire", "*or/hors", "*dû/du",
            "*sur/sûr", "*notre/nôtre", "*votre/vôtre", "*peut-être/peut être", "*bientôt/bien tôt", "*aussitôt/aussi tôt",
            "*sans/sang/cent/s'en/sent/sens", "et/est", "*cette/sept", "*même/mêmes", "*quelque/quelques",
            // Homophones de sens.
            "mer/mère/maire", "vers/vert/verre/ver", "voie/voix/voit", "cour/cours/court", "foi/fois/foie",
            "tant/temps/t'en", "pain/pin", "compte/conte/comte", "faim/fin", "cou/coup/coût",
            "champ/chant", "chêne/chaîne", "poids/pois", "signe/cygne", "tante/tente", "date/datte", "dates/dattes",
            "père/paire/pair/perd", "chair/chère", "vain/vin/vingt", "mal/mâle/malle", "dessin/dessein", "porc/port", "golf/golfe",
            "cœur/chœur", "pause/pose", "balade/ballade", "tâche/tache", "sceau/seau/saut/sot", "air/aire/ère", "fée/fait",
            "cuir/cuire", "sel/selle", "plaine/pleine", "vice/vis", "mur/mûr", "pâte/patte",
            "boue/bout", "cane/canne", "chaud/chaux", "conter/compter", "point/poing", "col/colle", "pot/peau",
            "pots/peaux", "reine/rêne/renne", "reines/rênes/rennes", "bal/balle", "mettre/maître/mètre", "haut/eau",
            "amande/amende", "amandes/amendes", "censé/sensé", "censée/sensée", "différend/différent", "exprès/express",
            "fond/fonds/font", "martyr/martyre", "raisonner/résonner", "repaire/repère", "session/cession",
            "tribu/tribut", "cote/côte/côté", "guerre/guère", "pouce/pousse", "sale/salle", "sain/saint", "toi/toit",
            "poil/poêle", "balai/ballet", "ancre/encre", "ton/thon", "statue/statut", "mots/maux", "moi/mois",
            "pris/prix", "tôt/taux", "lait/laid", "sol/sole", "cher/chair", "foret/forêt", "chat/chas", "ver/verre",
        ],
        en: ["*there/their/they're", "*your/you're", "*its/it's", "*to/too/two", "*then/than", "*lose/loose", "*affect/effect",
            "*accept/except", "*weather/whether", "brake/break", "peace/piece", "weak/week", "*know/no", "*buy/by/bye",
            "*hear/here", "*right/write", "*sea/see", "sun/son", "hole/whole", "meat/meet", "mail/male", "tail/tale",
            "flour/flower", "plain/plane", "principal/principle", "stationary/stationery", "complement/compliment",
            "desert/dessert", "*quite/quiet", "*advice/advise", "*passed/past", "*threw/through", "waist/waste",
            "wait/weight", "bare/bear", "fair/fare", "pair/pear", "steal/steel", "which/witch", "*whose/who's",
            "*where/were/we're", "*of/off", "allowed/aloud", "board/bored", "cell/sell", "die/dye", "flu/flew", "*hour/our",
            "*knew/new", "not/knot", "*one/won", "road/rode", "role/roll", "scene/seen", "sole/soul", "sore/soar",
            "suite/sweet", "tide/tied", "toe/tow", "wear/where", "weigh/way", "*wood/would"],
    };
    // Par premier mot : les formes qui commencent par lui, chacune avec les autres formes de sa famille.
    const confusable = {};
    for (const [lang, families] of Object.entries(FAMILIES)) {
        confusable[lang] = new Map();
        for (const family of families) {
            const grammatical = family.startsWith("*");
            const forms = family.replace(/^\*/, "").split("/").map((text) => ({ text, words: tokens(text, lang), grammatical }));
            for (const form of forms) {
                const list = confusable[lang].get(form.words[0]) ?? [];
                const entry = list.find((e) => e.text === form.text) ?? { ...form, alternatives: [] };
                if (!list.includes(entry)) {
                    list.push(entry);
                }
                for (const other of forms) {
                    if (other.text !== form.text && !entry.alternatives.some((a) => a.text === other.text)) {
                        entry.alternatives.push(other);
                    }
                }
                confusable[lang].set(form.words[0], list);
            }
        }
    }

    // Mots du texte avec leur position ; les élisions françaises sont séparées comme dans tokens().
    function positioned(text, lang) {
        const out = [];
        for (const m of String(text).matchAll(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*['’]?/gu)) {
            const lower = m[0].toLowerCase().replace(/[’`]/g, "'");
            const elided = lang === "fr" ? ELISION.exec(lower) : null;
            if (elided && lower.length > elided[0].length) {
                out.push({ word: elided[0], start: m.index, end: m.index + elided[0].length });
                out.push({ word: lower.slice(elided[0].length), start: m.index + elided[0].length, end: m.index + m[0].length });
            } else {
                out.push({ word: lower, start: m.index, end: m.index + m[0].length });
            }
        }
        return out;
    }

    // Une paire vue dans le corpus (pas un repli) : c'est elle qui fait la preuve.
    const seen = (m, a, b) => m.bigrams.has(`${a} ${b}`);
    const BREAK = /[.!?;:\n«»"“”()]/;

    // Chaque forme d'une famille présente dans le texte, avec ses voisins (null au bord de la phrase).
    // Les formes les plus longues d'abord (« plus tôt » avant « plus ») ; onFound renvoie true pour
    // passer à la suite du texte sans essayer les formes plus courtes au même endroit.
    function eachForm(lang, text, onFound) {
        const words = positioned(text, lang);
        let taken = -1;
        words.forEach((token, i) => {
            if (i <= taken) {
                return;
            }
            const entries = (confusable[lang].get(token.word) ?? [])
                .filter((entry) => entry.words.every((word, k) => words[i + k]?.word === word && (k === 0 || !BREAK.test(text.slice(words[i + k - 1].end, words[i + k].start)))))
                .sort((a, b) => b.words.length - a.words.length);
            for (const entry of entries) {
                const last = words[i + entry.words.length - 1];
                const before = words[i - 1];
                const after = words[i + entry.words.length];
                const occurrence = {
                    entry,
                    start: token.start,
                    end: last.end,
                    before: before && !BREAK.test(text.slice(before.end, token.start)) ? before : null,
                    after: after && !BREAK.test(text.slice(last.end, after.start)) ? after : null,
                    // Une virgule entre la forme et son voisin : le lien est plus lâche.
                    commaBefore: !!before && text.slice(before.end, token.start).includes(","),
                    commaAfter: !!after && text.slice(last.end, after.start).includes(","),
                    first: i === 0,
                };
                if (onFound(occurrence)) {
                    taken = i + entry.words.length - 1;
                    break;
                }
            }
        });
    }

    // --- Nature des mots voisins ---
    // Les paires de mots exacts manquent vite (« Le plombier à promis » : « plombier a » n'est pas dans
    // le corpus). On compte donc aussi chaque forme d'une famille entre les NATURES de ses voisins :
    // « nom + a + participe » vaut pour tous les plombiers. La nature vient des étiquettes du
    // dictionnaire (Grammalecte) : mot grammatical ou auxiliaire → le mot lui-même ; sinon l'ensemble
    // de ses lectures possibles (nom et genre/nombre, adjectif, infinitif, participe, verbe conjugué
    // et sa personne, adverbe). Données : contextes-fr.js, construit par tools/build-contextes.mjs
    // avec cette même fonction.
    function natureOf(word, morphs, capitalized) {
        if (/^\p{N}/u.test(word)) {
            return "#";
        }
        if (!morphs || morphs.length === 0) {
            return capitalized ? "M" : "?";
        }
        if (morphs.some((m) => /:G|:V0/.test(m))) {
            return word;
        }
        const tags = new Set();
        for (const m of morphs) {
            const gn = (/:([mfe]):([spi])/.exec(m) ?? []).slice(1).join("");
            if (/:M[12P]?/.test(m)) {
                tags.add("M");
            }
            if (/:N/.test(m)) {
                tags.add(`N${gn}`);
            }
            if (/:A/.test(m) && !/:Q/.test(m)) {
                tags.add(`A${gn}`);
            }
            if (/:Q/.test(m)) {
                tags.add("Q");
            }
            if (/:Y/.test(m)) {
                tags.add("Y");
            }
            if (/:P(?=[:/]|$)/.test(m)) {
                tags.add("P");
            }
            if (/:V/.test(m) && /:(?:I[pqsf]|S[pq]|K|E)/.test(m)) {
                for (const person of m.match(/:[123][sp]/g) ?? []) {
                    tags.add(`V${person.slice(1)}`);
                }
            }
            if (/:W/.test(m)) {
                tags.add("W");
            }
        }
        return tags.size ? [...tags].sort().join("+") : "?";
    }

    // Nature d'un mot anglais. Pas de dictionnaire étiqueté côté anglais : on part des natures de
    // WordNet pour les formes de base (nom, verbe, adjectif, adverbe ; table « lexicon » de
    // contextes-en.js, construite par tools/build-contextes.mjs), et on reconnaît les formes fléchies
    // à leur terminaison : S: (pluriel ou 3e personne), D (prétérit ou participe), G (-ing).
    // Mot grammatical → le mot lui-même.
    const EN_FUNCTION = new Set(("a an the this that these those my your his her its our their some any no every each all both either neither "
        + "i you he she it we they me him us them myself yourself himself herself itself ourselves themselves who whom whose which what "
        + "am is are was were be been being have has had having do does did will would shall should can could may might must "
        + "isn't aren't wasn't weren't don't doesn't didn't won't wouldn't can't couldn't shouldn't haven't hasn't hadn't "
        + "i'm you're he's she's it's we're they're i've you've we've they've i'll you'll he'll she'll we'll they'll i'd you'd he'd she'd we'd they'd "
        + "that's there's here's what's who's let's "
        + "and or but nor so yet if because although though while when where why how than then as since until unless whether "
        + "of in on at to for with from by about into over under after before between through during without within against "
        + "not very too also just only even still already never always often really quite there here now up out off down").split(" "));
    // Prétérits et participes irréguliers, y compris ceux qui ont la forme de l'infinitif (put, hit, cut).
    const EN_IRREGULAR = new Set(("went gone saw seen took taken gave given wrote written ate eaten drank drunk began begun broke broken chose chosen came did done drove driven fell fallen flew flown forgot forgotten got gotten grew grown knew known rode ridden rang rung ran sang sung spoke spoken stole stolen swam swum threw thrown wore worn brought bought caught taught thought found felt kept left lost made meant met paid said sent sold told understood built held heard led stood won sat slept spent was were been had arose arisen awoke awoken bore borne born beat beaten became bent bet bid bade bound bit bitten bled blew blown bred burnt burst cast clung cost crept cut dealt dug dove drew drawn dreamt dwelt fed fought fled flung forbade forbidden forgave forgiven froze frozen hid hidden hit hung hurt knelt knit laid lay lain leapt learnt lent let lit meant mistook mistaken mowed overcame overtook put quit read rid rose risen sank sunk sought set sewn shook shaken shed shone shot shown shrank shrunk shut slid slung slit smelt sowed sown sped spelt spilt spun spat split spoilt spread sprang sprung stuck stung stank stunk strode struck stricken strung strove swore sworn swept swollen swung tore torn thrust trod trodden undid undone underwent upset woke woken wept wet withdrew withdrawn withheld withstood wound wrung wove woven ground fit wed broadcast forecast overlay input output offset reset beset overcast recast typecast").split(" "));
    function natureOfEnglish(original, lexicon) {
        const word = String(original).toLowerCase().replace(/[’`]/g, "'");
        if (/^\p{N}/u.test(word)) {
            return "#";
        }
        if (EN_FUNCTION.has(word)) {
            return word;
        }
        const tags = new Set((lexicon.get(word) ?? "").split("+").filter(Boolean));
        if (EN_IRREGULAR.has(word)) {
            tags.add("D");
        }
        const base = (candidates) => candidates.map((c) => lexicon.get(c)).find(Boolean);
        if (tags.size === 0 || word.length > 3) {
            const stem = word.replace(/(?:ies|es|s|ied|ed|d|ing)$/, "");
            if (/[^s]s$/.test(word) && !/(?:us|is|ics|ous|as|os)$/.test(word)) {
                const pos = base([word.slice(0, -1), word.slice(0, -2), /ies$/.test(word) ? `${word.slice(0, -3)}y` : ""]);
                for (const p of (pos ?? "").split("+").filter((p) => p === "N" || p === "V")) {
                    tags.add(`S:${p}`);
                }
            } else if (/ed$/.test(word)) {
                const pos = base([word.slice(0, -2), word.slice(0, -1), /ied$/.test(word) ? `${word.slice(0, -3)}y` : "", stem.replace(/(.)\1$/, "$1")]);
                if (pos && /V/.test(pos)) {
                    tags.add("D");
                }
            } else if (/ing$/.test(word) && word.length > 4) {
                const pos = base([word.slice(0, -3), `${word.slice(0, -3)}e`, word.slice(0, -3).replace(/(.)\1$/, "$1")]);
                if (pos && /V/.test(pos)) {
                    tags.add("G");
                }
            }
        }
        if (tags.size === 0) {
            // Mot inconnu : la terminaison, sinon un nom propre s'il porte une majuscule.
            return /ly$/.test(word) ? "W" : /^\p{Lu}/u.test(original) ? "M" : /[a-z]{3}ed$/.test(word) ? "D" : /[a-z]{3}ing$/.test(word) ? "G" : "?";
        }
        return [...tags].sort().join("+");
    }

    const lexicons = {};
    function lexicon(lang) {
        if (lexicons[lang] === undefined) {
            const data = self[`ARIA_CONTEXTS_${lang.toUpperCase()}`];
            lexicons[lang] = data?.lexicon ? new Map(String(data.lexicon).split("\n").map((line) => line.split("\t"))) : null;
        }
        return lexicons[lang];
    }

    const contextModels = {};
    function contextModel(lang) {
        if (contextModels[lang] === undefined) {
            const data = self[`ARIA_CONTEXTS_${lang.toUpperCase()}`];
            if (!data) {
                return null;
            }
            // Une ligne par compte : « forme \t gauche \t droite \t nombre » ; gauche ou droite vide = marge.
            const forms = new Map();
            for (const line of String(data.counts).split("\n")) {
                const [form, left, right, count] = line.split("\t");
                if (count === undefined) {
                    continue;
                }
                const entry = forms.get(form) ?? { total: 0, both: new Map(), left: new Map(), right: new Map() };
                if (left === "" && right === "") {
                    entry.total = Number(count);
                } else if (right === "") {
                    entry.left.set(left, Number(count));
                } else if (left === "") {
                    entry.right.set(right, Number(count));
                } else {
                    entry.both.set(`${left}\t${right}`, Number(count));
                }
                forms.set(form, entry);
            }
            contextModels[lang] = forms;
        }
        return contextModels[lang];
    }

    // Formes d'une famille d'homophones que le contexte contredit nettement. Deux preuves possibles :
    //   - les mots exacts : une autre forme est au moins e^THRESHOLD fois (≈ 400 fois) plus probable
    //     entre les deux voisins, toutes ses paires de mots ont été vues dans le corpus, et une paire de
    //     la forme écrite ne l'a jamais été alors qu'on l'attendait au moins MIN_EXPECTED fois si ses
    //     deux mots se suivaient au hasard ;
    //   - la nature des voisins (si natureOfWord est fourni et les données chargées), pour les familles
    //     grammaticales : entre ces deux natures, l'autre forme a été vue au moins CONTEXT.min fois et
    //     CONTEXT.ratio fois plus souvent que la forme écrite, elle-même vue au plus CONTEXT.maxOwn fois.
    // Réglés le 11/11/2026 sur la série de travail 7 et les textes justes de toutes les séries
    // françaises. Mots exacts : 6 et 0,5 trouvent 45 homophones sur 300 sans fausse alerte ; sans le
    // second garde-fou, 73 mais 5 fausses alertes sur des mots rares (« la cession de », « au pair »).
    // Nature des voisins : 5 et 50 suffisaient sur les séries de travail (77 sur 300, aucune fausse
    // alerte sur 1 900 textes justes) mais ajoutaient 3 fausses alertes au contrôle 5 ; 30 et 100
    // n'en ajoutent aucune et gardent l'essentiel du gain sur le contrôle 7.
    const THRESHOLD = 6;
    const MIN_EXPECTED = 0.5;
    // Preuve par un seul côté (voir confusions) : l'autre forme vue au moins minCount fois à côté du
    // voisin, la forme écrite jamais alors qu'on l'y attendait au moins minExpected fois — ou alors
    // l'autre forme y est une vraie tournure, vue e^minLift fois plus que le hasard (« of course ») —,
    // et un gain total d'au moins « gain ». Réglés le 11/11/2026 sur les séries de travail 7 (français :
    // 60 → 102 homophones sur 300) et 8 (anglais : 36 → 72 sur 142), sans fausse alerte de plus sur
    // les textes justes ; des seuils plus bas en trouvaient davantage, avec 2 à 5 fausses alertes.
    const SIDE = { fr: { minCount: 5, minExpected: 1, gain: 7, minLift: 3, gainGrammatical: 10 }, en: { minCount: 3, minExpected: 1, gain: 5, minLift: 2, gainGrammatical: 7 } };
    const CONTEXT = { min: 30, ratio: 100, maxOwn: 0 };
    function confusions(lang, text, options = {}) {
        const m = model(lang);
        if (!m || !confusable[lang]) {
            return [];
        }
        const threshold = options.threshold ?? THRESHOLD;
        // En anglais, la nature des mots vient de la table livrée avec les données.
        const natureOfWord = options.natureOfWord ?? (lang === "en" && lexicon("en") ? (word) => natureOfEnglish(word, lexicon("en")) : null);
        const contexts = natureOfWord ? contextModel(lang) : null;
        const tuning = { ...CONTEXT, ...(options.context ?? {}) };
        const found = [];
        eachForm(lang, text, ({ entry, start, end, before, after, commaBefore, commaAfter }) => {
            // Il faut au moins un vrai voisin (pas deux bords de phrase).
            if (!before && !after) {
                return false;
            }
            const prev = before ? before.word : "<s>";
            const next = after ? after.word : "</s>";
            const pairs = (form) => [prev, ...form.words, next].slice(1).map((word, k) => [[prev, ...form.words, next][k], word]);
            const value = (form) => pairs(form).reduce((sum, [a, b]) => sum + logPair(m, a, b), 0);
            const attested = (form) => pairs(form).every(([a, b]) => seen(m, a, b));
            let best = null;
            // Preuve par les mots exacts.
            const expected = ([a, b]) => (m.unigrams.get(a) ?? 0) * (m.unigrams.get(b) ?? 0) / m.total;
            if (pairs(entry).some((pair) => !seen(m, pair[0], pair[1]) && expected(pair) >= MIN_EXPECTED)) {
                const own = value(entry);
                for (const alternative of entry.alternatives) {
                    if (!attested(alternative)) {
                        continue;
                    }
                    const gain = value(alternative) - own;
                    if (gain >= threshold && (!best || gain > best.gain)) {
                        best = { alternative, gain };
                    }
                }
            }
            // Preuve par un seul côté : la forme écrite manque à côté d'un voisin alors qu'on l'y attendait,
            // et l'autre forme s'y trouve bien plus souvent que le hasard ne le voudrait. L'autre voisin
            // peut être un mot rare, que le corpus n'a vu avec aucune des deux (« a would stove »). On
            // compare, de chaque côté, le nombre vu au nombre attendu si les deux mots se suivaient au hasard.
            const side = options.side ?? SIDE[lang];
            if (!best && side) {
                const count = ([a, b]) => m.bigrams.get(`${a} ${b}`) ?? 0;
                const lift = (pair) => Math.log((count(pair) + 0.1) / Math.max(expected(pair), 0.1));
                const edges = (form) => [pairs(form)[0], pairs(form).at(-1)];
                const own = edges(entry);
                for (const alternative of entry.alternatives.filter((alt) => !side.senseOnly || !alt.grammatical)) {
                    const other = edges(alternative);
                    const inner = pairs(alternative).slice(1, -1).every(([a, b]) => seen(m, a, b));
                    // Un côté qui prouve : forme écrite jamais vue là où on l'attendait, autre forme bien vue.
                    const proof = own.some((pair, k) => !(k === 0 ? commaBefore : commaAfter) && count(pair) === 0 && count(other[k]) >= side.minCount && (expected(pair) >= side.minExpected || lift(other[k]) >= (side.minLift ?? Infinity)));
                    // Aucun côté qui contredit : la forme écrite vue là où l'autre ne l'est pas.
                    const against = own.some((pair, k) => count(pair) > 0 && count(other[k]) === 0);
                    if (!inner || !proof || against) {
                        continue;
                    }
                    const gain = other.reduce((sum, pair, k) => sum + lift(pair) - lift(own[k]), 0);
                    if (gain >= (alternative.grammatical ? side.gainGrammatical ?? side.gain : side.gain) && (!best || gain > best.gain)) {
                        best = { alternative, gain };
                    }
                }
            }
            // Preuve par la nature des voisins, si les mots exacts n'ont rien dit et ne disent pas le
            // contraire (la forme écrite attestée entre ces deux mots reste intouchable).
            // Il faut deux vrais voisins : au bord d'une phrase, une seule nature ne prouve rien (« Ces très
            // bons amis… » n'est pas « C'est très… »).
            if (!best && contexts && before && after && (options.acrossCommas || (!commaBefore && !commaAfter)) && !attested(entry)) {
                const left = natureOfWord(text.slice(before.start, before.end));
                const right = natureOfWord(text.slice(after.start, after.end));
                const key = `${left}\t${right}`;
                const own = contexts.get(entry.text)?.both.get(key) ?? 0;
                // La forme écrite déjà vue à côté d'un voisin qui n'est pas un mot grammatical : on se tait
                // (« à coup sûr son examen » : « coup sûr » est dans le corpus).
                const known = (seen(m, prev, entry.words[0]) && left !== prev) || (seen(m, entry.words.at(-1), next) && right !== next);
                if (own <= tuning.maxOwn && !known) {
                    for (const alternative of entry.alternatives.filter((a) => a.grammatical)) {
                        const count = contexts.get(alternative.text)?.both.get(key) ?? 0;
                        if (count >= tuning.min && count >= tuning.ratio * (own + 0.1) && (!best || count > best.count)) {
                            best = { alternative, gain: Math.log(count / (own + 0.1)), count };
                        }
                    }
                }
            }
            if (!best) {
                return false;
            }
            const original = text.slice(start, end);
            const fix = best.alternative.text;
            const suggestion = /^\p{Lu}/u.test(original) ? fix[0].toUpperCase() + fix.slice(1) : fix;
            // from, to : l'étendue des voisins qui ont servi de preuve.
            found.push({ start, end, word: original, suggestion, gain: best.gain, by: best.count === undefined ? "mots" : "natures", from: before ? before.start : start, to: after ? after.end : end });
            return true;
        });
        return found;
    }

    // Une forme entre ses voisins : toutes ses paires de mots ont-elles été vues (attested), et quelle
    // est sa probabilité (value) ? Sert à valider une correction proposée par une autre voie.
    function fit(lang, before, form, after) {
        const m = model(lang);
        if (!m) {
            return null;
        }
        const prev = tokens(String(before).split(BREAK).at(-1), lang).at(-1) ?? "<s>";
        const next = tokens(String(after).split(BREAK)[0], lang)[0] ?? "</s>";
        const words = [prev, ...tokens(form, lang), next];
        let value = 0;
        let attested = true;
        for (let i = 1; i < words.length; i++) {
            value += logPair(m, words[i - 1], words[i]);
            attested = attested && seen(m, words[i - 1], words[i]);
        }
        return { value, attested, edge: prev === "<s>" && next === "</s>" };
    }

    self.AriaNgrammes = { tokens, score, rerank, confusions, fit, eachForm, natureOf, natureOfEnglish, english: (word) => (lexicon("en") ? natureOfEnglish(word, lexicon("en")) : "?"), ready: (lang) => !!model(lang) };
})();
