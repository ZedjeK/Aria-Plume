// Aria ODL — « tes fautes récurrentes » : familles de fautes et règle en une ligne.
// Seules les corrections que tu acceptes sont comptées, par famille, avec 3 exemples au plus.
// Tout reste dans le stockage local du navigateur.

export const MAX_EXAMPLES = 3;

export const FAMILIES = {
    orthographe: { label: "Orthographe d'usage", rule: "Fautes de frappe et mots mal orthographiés. Les mots du métier (systemd, Elegoo…) peuvent aller dans ton dictionnaire personnel." },
    homophones: { label: "Homophones", rule: "Remplace par un autre mot pour tester : « était » pour et/est, « avait » pour a/à, « cela » pour sa/ça, « ces… -là » pour ces/ses." },
    participe: { label: "Accord du participe passé", rule: "Avec « être », il s'accorde avec le sujet ; avec « avoir », avec le complément direct placé avant (les pommes que j'ai mangées)." },
    infinitif: { label: "Infinitif ou participe (-er / -é)", rule: "Remplace par « vendre » ou « vendu » : si « vendre » va, c'est -er (je vais manger) ; si « vendu » va, c'est -é (j'ai mangé)." },
    conjugaison: { label: "Conjugaison", rule: "Vérifie qui fait l'action : je/tu -s, il -t ou -e, nous -ons, vous -ez, ils -ent." },
    groupe: { label: "Accord dans le groupe nominal", rule: "Déterminant, nom et adjectif s'accordent ensemble en genre et en nombre (les grandes maisons)." },
    verbe: { label: "Accord du verbe avec le sujet", rule: "Le verbe s'accorde avec son sujet, même éloigné ou placé après (c'est moi qui ai, la plupart pensent)." },
    concordance: { label: "Concordance des temps", rule: "Si + imparfait → conditionnel (si j'avais su, je serais venu) ; jamais de conditionnel juste après « si »." },
    mode: { label: "Subjonctif ou indicatif", rule: "Subjonctif après « bien que », « pour que », « il faut que » ; indicatif après « après que »." },
    elision: { label: "Élision", rule: "Devant une voyelle ou un h muet : que il → qu'il, de un → d'un, si il → s'il." },
    imperatif: { label: "Impératif", rule: "Les verbes en -e prennent un -s devant « en » et « y » : manges-en, penses-y, vas-y." },
    tout: { label: "Accord de « tout »", rule: "« tout » (= tout à fait) s'accorde devant un adjectif féminin qui commence par une consonne : toute contente." },
    adjectif: { label: "Participe présent ou adjectif", rule: "Avec un complément, le mot en -ant reste invariable (obéissant à ses parents) ; sans, il s'accorde (des enfants obéissants)." },
    majuscule: { label: "Majuscules", rule: "Majuscule en début de phrase et aux noms propres ; minuscule aux noms de langues et aux mois." },
    trait: { label: "Traits d'union", rule: "Trait d'union dans l'inversion et les mots composés : viens-tu, peut-être, c'est-à-dire, dix-sept." },
    expressions: { label: "Expressions et pléonasmes", rule: "Expressions déformées ou redondantes : « au jour d'aujourd'hui », « monter en haut », « malgré que »." },
    soigne: { label: "Français écrit soigné", rule: "À l'écrit : le « ne » de la négation, « se rappeler quelque chose », « pallier un problème », « chez le coiffeur »." },
    grammaire: { label: "Autres fautes de grammaire", rule: "Relis la phrase à voix haute en t'arrêtant sur le mot souligné : l'explication de l'infobulle dit ce qui cloche." },
    anglaisOrthographe: { label: "Anglais : orthographe", rule: "Fautes de frappe et mots anglais mal orthographiés (vérifie aussi la variante, américaine ou britannique, dans les réglages)." },
    anglaisGrammaire: { label: "Anglais : grammaire", rule: "Accords et tournures en anglais : their/there, its/it's, accord du verbe avec le sujet…" },
};

const ARIA_RULES = [
    [/^aria_homophone_(sa_ca|et_est|a_a|ces_cest|ses_sest|cest_sest|on_ont|quel_quelle|ni_ny|pret_pres|tant_qua|quoique_quoi_que|si_non|la_adverbe)$/, "homophones"],
    [/^aria_homophone_(ppas_\w+|sen_prendre)$/, "participe"],
    [/^aria_homophone_si_conditionnel$/, "concordance"],
    [/^aria_homophone_tout_adverbe$/, "tout"],
    [/^aria_homophone_plus_dun$/, "verbe"],
    [/^aria_homophone_(imperatif_s|vas_y)$/, "imperatif"],
    [/^aria_homophone_adjectif_verbal$/, "adjectif"],
    [/^aria_homophone_(double_negation|se_rappeler_de|pallier_a|aller_chez)$/, "soigne"],
];

// Règles de Grammalecte : la famille suit le niveau (« gv1__ppas_… », « g2__conf_… »).
const GRAMMALECTE_FAMILIES = {
    conf: "homophones", quel: "homophones", gn: "groupe", substantifs: "groupe", ppas: "participe",
    conj: "conjugaison", vmode: "mode", infi: "infinitif", imp: "imperatif", inte: "trait", tu: "trait",
    maj: "majuscule", eleu: "elision", neg: "soigne", pleo: "expressions", bs: "expressions",
    loc: "expressions", locutions: "expressions", simplification: "expressions",
};
// Typographie, ponctuation, dates : pas des fautes de langue, on ne les compte pas.
const NOT_COUNTED = new Set(["typo", "virg", "date", "esp", "nbsp", "p", "num", "unit", "html", "latex", "md"]);

// Famille d'une correction acceptée, ou null si elle ne compte pas (style, typographie, répétitions).
export function familyOf({ rule = "", kind = "", lang = "fr" }) {
    if (kind !== "orthographe" && kind !== "grammaire") {
        return null;
    }
    if (lang === "en") {
        return kind === "orthographe" ? "anglaisOrthographe" : "anglaisGrammaire";
    }
    if (rule === "spelling") {
        return "orthographe";
    }
    // Accords regroupés par Aria : « g3__gn_…+gv1__ppas_… » → la première famille trouvée.
    for (const part of rule.split("+")) {
        const aria = ARIA_RULES.find(([re]) => re.test(part));
        if (aria) {
            return aria[1];
        }
        const stem = /^[gp]v?\d*__([a-zA-Z]+)/.exec(part)?.[1];
        if (stem && NOT_COUNTED.has(stem)) {
            return null;
        }
        if (stem && GRAMMALECTE_FAMILIES[stem]) {
            return GRAMMALECTE_FAMILIES[stem];
        }
    }
    return "grammaire";
}

// Ajoute des corrections aux statistiques (objet du stockage, modifié et renvoyé).
export function addMistakes(stats, items, now = new Date().toISOString()) {
    const result = { ...(stats && typeof stats === "object" ? stats : {}) };
    for (const item of items) {
        const family = familyOf(item);
        if (!family) {
            continue;
        }
        const entry = { count: 0, last: now, examples: [], ...(result[family] ?? {}) };
        entry.count += 1;
        entry.last = now;
        const from = String(item.word ?? "").trim().slice(0, 60);
        const to = String(item.suggestion ?? "").trim().slice(0, 60);
        if (from && !entry.examples.some((e) => e.from.toLowerCase() === from.toLowerCase() && e.to.toLowerCase() === to.toLowerCase())) {
            entry.examples = [{ from, to }, ...entry.examples].slice(0, MAX_EXAMPLES);
        }
        result[family] = entry;
    }
    return result;
}

// Le top N, du plus fréquent au moins fréquent.
export function topMistakes(stats, n = 5) {
    return Object.entries(stats ?? {})
        .filter(([family, entry]) => FAMILIES[family] && entry?.count > 0)
        .sort((a, b) => b[1].count - a[1].count || String(b[1].last).localeCompare(String(a[1].last)))
        .slice(0, n)
        .map(([family, entry]) => ({ family, ...FAMILIES[family], ...entry }));
}
