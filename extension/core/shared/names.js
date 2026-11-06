// Aria Plume — noms propres et grossièretés : ce que le correcteur ne doit pas souligner.
//
// Les dictionnaires de Grammalecte et de Harper connaissent beaucoup de noms, mais pas tous :
// « Jira », « Sosh », « Bezos », « Deloitte », « Mbappé » ressortaient comme fautes d'orthographe.
// Et Harper « censure » les grossièretés (« Fuck » → « **** ») : ce n'est pas une faute, c'est un
// registre, que l'utilisateur choisit.
//
// Une remarque d'orthographe est retirée quand le mot :
//   - est un nom connu (marques, produits, entreprises, services, personnalités, lieux) ;
//   - fait partie d'une suite de mots à majuscule (« Elon Musk », « Accor Arena », « Parc des Princes ») ;
//   - suit une civilité (« Mme Lebrun », « Dr Okafor ») ;
//   - (anglais) porte une majuscule au milieu d'une phrase et les suggestions ne proposent que des
//     mots ordinaires (« Deloitte » → delete, delicate) : c'est un nom, pas une faute.

const KNOWN = `
Jira Confluence Trello Asana Notion Slack Teams Zoom Webex Skype Discord Twitch Steam Epic Valve Ubisoft Blizzard Riot
Proxmox VMware ESXi vSphere Hyper-V Kubernetes Docker Podman Ansible Terraform Puppet Jenkins GitLab GitHub Bitbucket
Grafana Prometheus Kibana Elasticsearch Logstash Splunk Datadog Zabbix Nagios Centreon PRTG Sentry PagerDuty Okta
Nginx Apache Tomcat Redis MongoDB PostgreSQL MySQL MariaDB SQLite Oracle Kafka RabbitMQ Cloudflare Akamai OVH OVHcloud
Scaleway Hetzner Azure AWS Heroku Vercel Netlify DigitalOcean Linode Vultr Synology QNAP Ubiquiti UniFi Fortinet FortiGate
Palo Alto Sophos Kaspersky Bitdefender Avast Norton McAfee Malwarebytes Veeam Acronis Bitwarden Vaultwarden KeePass LastPass Dashlane
Windows Linux Ubuntu Debian Fedora CentOS RHEL Arch Manjaro Mint macOS iOS iPadOS Android HarmonyOS ChromeOS
Microsoft Apple Google Alphabet Amazon Meta Facebook Instagram WhatsApp Messenger Threads Twitter TikTok Snapchat Pinterest LinkedIn Reddit
YouTube Netflix Disney Hulu Spotify Deezer Tidal SoundCloud Shazam Twitch Dailymotion Vimeo Canal Molotov Prime
OpenAI ChatGPT Anthropic Claude Gemini Bard Copilot Mistral Llama Perplexity Midjourney DALL-E Ollama LM Studio Hugging Face
Nvidia NVIDIA GeForce RTX Radeon AMD Ryzen Intel Xeon Qualcomm Snapdragon Exynos Logitech Razer Corsair SteelSeries HyperX
Samsung Galaxy Xiaomi Redmi Huawei Honor Oppo OnePlus Realme Vivo Sony Xperia Nokia Motorola Pixel iPhone iPad iMac MacBook AirPods
PlayStation PS4 PS5 Xbox Nintendo Switch Wii Fortnite Minecraft Roblox Valorant Overwatch Zelda Pokémon Mario Tetris
Tesla SpaceX Uber Lyft Bolt Heetch BlaBlaCar Airbnb Booking Expedia Tripadvisor Ryanair EasyJet Transavia Lufthansa
Renault Peugeot Citroën Dacia Toyota Volkswagen Audi BMW Mercedes Porsche Ferrari Fiat Ford Kia Hyundai Skoda Seat Opel Volvo
Clio Mégane Captur Twingo Zoé Scénic Kadjar Austral Arkana Sandero Duster Jogger Yaris Corolla Golf Polo Tiguan Model
Ikea Leroy Merlin Castorama Brico Dépôt Boulanger Darty Fnac Cdiscount Vinted Leboncoin AliExpress Temu Shein Zalando Etsy Shopify eBay
Carrefour Leclerc Auchan Intermarché Lidl Aldi Monoprix Franprix Casino Picard Biocoop Grand Frais Décathlon Kiabi Action Gifi Primark
Orange Sosh SFR RED Bouygues Free Freebox Livebox Bbox Proximus Swisscom Vodafone Verizon AT&T T-Mobile
Doctolib Ameli Pôle Emploi France Travail Lydia Revolut Boursorama Fortuneo Qonto PayPal Stripe Visa Mastercard Amex
Capgemini Accenture Deloitte KPMG PwC EY Atos Sopra Steria Thales Dassault Airbus Safran Alstom Orano EDF Engie TotalEnergies Veolia
McDonald's McDo Burger King KFC Subway Domino's Starbucks Pizza Hut Quick O'Tacos Five Guys Nespresso Danone Nestlé
Mbappé Griezmann Zidane Zinedine Kylian Messi Ronaldo Neymar Benzema Dembélé Giroud Lloris Pogba Kanté Hakimi Wembanyama Djokovic Nadal Federer
Musk Elon Bezos Zuckerberg Gates Jobs Cook Altman Pichai Nadella Huang Jensen Wozniak Torvalds
Macron Mélenchon Bardella Attal Borne Philippe Hollande Sarkozy Chirac Mitterrand Biden Trump Obama Harris Poutine Zelensky Merkel Scholz Meloni Sunak Starmer
Beyoncé Rihanna Shakira Adele Drake Eminem Stromae Angèle Aya Nakamura Jul Orelsan Nekfeu Booba Ninho Damso Indochine Daft Punk
Accor Arena Bercy Défense Élysée Matignon Louvre Orsay Versailles Montmartre Champs-Élysées Wembley Coachella Roland-Garros
`.split(/\s+/).filter(Boolean);
const KNOWN_SET = new Set(KNOWN);

const TITLES = /(?:^|[\s(])(?:M\.|Mme|Mlle|Mmes|MM\.|Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Pr\.?|Me|Prof\.?|Monsieur|Madame|Mademoiselle|Docteur|Maître|Sir|Lady|Lord)\s+$/u;
const PARTICLES = new Set(["de", "des", "du", "d'", "la", "le", "les", "von", "van", "der", "den", "di", "da", "del", "della", "dos", "das", "el", "al", "ben", "bin", "ibn", "y", "of", "the", "and"]);
const CAPITAL = /^\p{Lu}[\p{L}\p{N}'’.-]*$/u;
// Ce qui ouvre une phrase : début du texte, ponctuation forte, saut de ligne, puce, guillemet.
const SENTENCE_START = /(?:^|[.!?…:;\n•*-]\s*|["«“(]\s*)$/u;

function wordsAround(text, start, end) {
    const before = text.slice(0, start);
    const after = text.slice(end);
    const prev = /([\p{L}\p{N}'’.-]+)\s+$/u.exec(before)?.[1] ?? "";
    const prev2 = /([\p{L}\p{N}'’.-]+)\s+[\p{L}\p{N}'’.-]+\s+$/u.exec(before)?.[1] ?? "";
    const next = /^\s+([\p{L}\p{N}'’.-]+)/u.exec(after)?.[1] ?? "";
    const next2 = /^\s+[\p{L}\p{N}'’.-]+\s+([\p{L}\p{N}'’.-]+)/u.exec(after)?.[1] ?? "";
    return { before, prev, prev2, next, next2 };
}

// Une remarque d'orthographe sur un nom propre ? (lang : "fr" ou "en")
export function isProperName(text, match, lang) {
    const word = text.slice(match.start, match.end).trim();
    if (!word) {
        return false;
    }
    const bare = word.replace(/['’]s$/u, "");
    if (KNOWN_SET.has(bare) || KNOWN_SET.has(word)) {
        return true;
    }
    const { before, prev, prev2, next, next2 } = wordsAround(text, match.start, match.end);
    // « de », « des », « van » au milieu d'un nom (« Parc des Princes », « Vincent van Gogh »).
    if (PARTICLES.has(word.toLowerCase()) && CAPITAL.test(prev) && CAPITAL.test(next)) {
        return true;
    }
    if (!/^\p{Lu}/u.test(word)) {
        return false;
    }
    if (TITLES.test(before)) {
        return true;
    }
    const startOfSentence = SENTENCE_START.test(before.trimEnd()) || before.trim() === "";
    // Suite de mots à majuscule (prénom + nom, nom composé) : « Elon Musk », « Antoine Griezmann ».
    const capitalBefore = CAPITAL.test(prev) && !(SENTENCE_START.test(text.slice(0, match.start - prev.length - 1).trimEnd()) && !CAPITAL.test(word));
    const capitalAfter = CAPITAL.test(next) || (PARTICLES.has(next.toLowerCase()) && CAPITAL.test(next2));
    if ((capitalBefore && prev.length > 1) || capitalAfter || (PARTICLES.has(prev.toLowerCase()) && CAPITAL.test(prev2))) {
        return true;
    }
    // Anglais : majuscule au milieu d'une phrase, suggestions sans majuscule → un nom.
    if (lang === "en" && !startOfSentence) {
        const capitalSuggestion = (match.suggestions ?? []).slice(0, 3).some((s) => /^\p{Lu}/u.test(s) && s.toLowerCase() !== word.toLowerCase());
        return !capitalSuggestion;
    }
    return false;
}

// Abréviations de messagerie et sigles techniques : pas des fautes d'orthographe.
const CHAT_WORDS = new Set("ngl tbh lgtm omg idk imo imho btw fyi afaik iirc smh lol lmao brb tldr tl;dr ty np wfh eod eta asap ooo ptal wip irl dm dms pm ama jk nvm rn tbf ftw ikr bc cuz gonna wanna gotta kinda sorta lemme gimme y'all ya".split(" "));
// Mots composés connus dont Harper souligne les morceaux (« Wi-Fi » → Wi, Fi).
const COMPOUNDS = new Set(["wi-fi", "hi-fi", "sci-fi", "k-pop", "x-ray", "e-mail", "t-shirt", "häagen-dazs", "coca-cola", "rolls-royce", "mercedes-benz", "jay-z", "wi-fi's"]);
// Mots anglais que le dictionnaire de Harper ignore.
const EXTRA_ENGLISH = new Set(["chaperone", "chaperoned", "chaperones", "trailhead", "trailheads", "standup", "standups", "onboarding", "offboarding", "frontend", "backend", "dev", "devs", "repo", "repos", "config", "configs", "async", "auth", "boolean", "localhost", "middleware", "runtime", "timestamp", "uptime", "upvote", "downvote", "workflow", "workflows"]);

// Une remarque d'orthographe à retirer en anglais : sigle, abréviation de messagerie, mot composé connu,
// emprunt accentué (déjà vu, fiancée, soufflé), nombre suivi de « s » (502s, 1990s), liste de prénoms.
export function englishNonWord(text, match) {
    if (match.kind !== "orthographe") {
        return false;
    }
    const word = text.slice(match.start, match.end).trim();
    const lower = word.toLowerCase();
    if (CHAT_WORDS.has(lower) || EXTRA_ENGLISH.has(lower)) {
        return true;
    }
    // Sigle tout en majuscules (« GKE », « LGTM »), hors phrase entièrement en majuscules.
    if (/^[A-Z][A-Z0-9]{1,5}s?$/.test(word) && !/\b[A-Z]{3,}\s+[A-Z]{3,}\b/.test(text.slice(Math.max(0, match.start - 30), match.end + 30).replace(word, ""))) {
        return true;
    }
    // Emprunts accentués : un mot anglais n'a pas d'accent ; « vu » après « déjà ».
    if (/[à-ÿ]/i.test(word) || (lower === "vu" && /déjà\s*$/i.test(text.slice(0, match.start)))) {
        return true;
    }
    // « 502s », « 1990s ».
    if (lower === "s" && /\d$/.test(text.slice(0, match.start))) {
        return true;
    }
    const compound = /[\p{L}-]*$/u.exec(text.slice(0, match.start))[0] + word + /^[\p{L}-]*/u.exec(text.slice(match.end))[0];
    if (compound.includes("-") && COMPOUNDS.has(compound.toLowerCase())) {
        return true;
    }
    // Liste de prénoms : « Thuy, Oluwaseun, and Xochitl joined ».
    if (/^\p{Lu}\p{Ll}+$/u.test(word)) {
        const around = text.slice(Math.max(0, match.start - 40), match.end + 40);
        const listed = new RegExp(`(?:\\p{Lu}\\p{Ll}+,\\s+(?:and\\s+)?)${word}\\b|${word},\\s+(?:and\\s+)?\\p{Lu}\\p{Ll}+|\\p{Lu}\\p{Ll}+\\s+and\\s+${word}\\b|${word}\\s+and\\s+\\p{Lu}\\p{Ll}+`, "u");
        if (listed.test(around)) {
            return true;
        }
    }
    return false;
}

// Remarques de Harper à ne pas montrer : grossièretés « censurées », unités développées (GB → gigabytes).
export function unwantedEnglishRemark(text, match) {
    if ((match.suggestions ?? []).some((s) => /\*{2,}|\w\*+\w/.test(s))) {
        return true;
    }
    const word = text.slice(match.start, match.end);
    // « OMG » → « Oh my god » : un registre, pas une faute.
    if (CHAT_WORDS.has(word.toLowerCase()) || englishNonWord(text, match)) {
        return true;
    }
    // « throw the trash » → « throw away the trash » : un conseil de style, pas une faute.
    const particleOnly = (match.suggestions ?? []).length > 0 && match.suggestions.every((s) => s.replace(/\s+(?:away|out|up|off|down|back|over)\b/gi, "").replace(/\s+/g, " ").trim().toLowerCase() === word.replace(/\s+/g, " ").trim().toLowerCase());
    if (match.rule === "Miscellaneous" && particleOnly) {
        return true;
    }
    return match.rule === "WordChoice" && /^(?:[KMGTP]B|[KMGT]iB|GHz|MHz|kHz|Mbps|Gbps|ms|KB|kb)$/.test(word);
}

// Jargon technique et mots anglais courants dans un texte français (« merger la branche », « le pod »).
const FRENCH_JARGON = new Set("merger merge mergé mergée commit commits commiter commité push pusher pushé pull rebase rebaser forker fork build builds builder deploy déployer debug debugger débugger débugguer release releases hotfix hotfixes staging prod préprod backlog sprint sprints standup daily review reviews reviewer feature features branch cluster clusters pod pods node nodes container containers pipeline pipelines workflow workflows dashboard dashboards frontend backend framework runtime repo repos checkout token tokens callback endpoint endpoints payload timeout logs logger monitoring scaler scalable helm kube kubectl lint linter linters refacto refactoring refactorer bug bugs bugué buggé crash crashé crasher spam spammer liker liké follower followers story stories replay live lives stream streamer streamé gamer gameplay setup check checker checké mail mails mailing newsletter meeting meetings call calls brief briefer débriefer process deadline deadlines feedback feedbacks booké booker".split(" "));
// Mots-outils anglais : une citation qui en contient au moins deux est de l'anglais.
const ENGLISH_FUNCTION = /\b(?:the|to|be|is|are|you|your|it|in|of|and|for|with|will|good|me|go|there|this|that|what|i'll|i'm|i|we|they|my|on|at|do|not|can|please|thanks|ahead|looks|okay)\b/gi;

// Remarques de Grammalecte à ne pas montrer dans un texte français : citation en anglais, jargon
// technique, tirets de liste, genre d'un sigle (« la CI »), prénom après une salutation (« Salut Romain »).
export function unwantedFrenchRemark(text, match) {
    const word = text.slice(match.start, match.end).trim();
    const rule = String(match.rule ?? "");
    if (match.kind === "orthographe" || /spell/i.test(rule)) {
        if (FRENCH_JARGON.has(word.toLowerCase())) {
            return true;
        }
        const before = text.slice(0, match.start);
        const open = Math.max(before.lastIndexOf("«"), before.lastIndexOf("“"), before.lastIndexOf("\""));
        const close = open >= 0 ? text.slice(open + 1).search(/[»”"]/) : -1;
        if (open >= 0 && close >= 0 && open + 1 + close >= match.end) {
            const quote = text.slice(open + 1, open + 1 + close);
            if ((quote.match(ENGLISH_FUNCTION) ?? []).length >= 2) {
                return true;
            }
        }
    }
    // « - » en tête de ligne dans une liste à puces (au moins deux lignes qui commencent ainsi).
    if (/tiret_début_ligne/.test(rule) && (text.match(/^\s*- /gm) ?? []).length >= 2) {
        return true;
    }
    // « la CI », « le PR » : genre d'un sigle.
    if (/gn_(?:la|le|un|une)_/.test(rule) && /\b\p{Lu}{2,}\b/u.test(word)) {
        return true;
    }
    // « Salut Romain, », « Bonjour Romain » : un prénom, pas un gentilé.
    if (/maj_gentilés/.test(rule) && (/(?:salut|bonjour|bonsoir|coucou|merci|cher|chère|hello|hey|à|avec|pour|de)\s*$/i.test(text.slice(0, match.start)) || /^\s*,/.test(text.slice(match.end)))) {
        return true;
    }
    return false;
}

export function filterNames(text, matches, lang) {
    return matches.filter((m) => {
        if (lang === "en" && unwantedEnglishRemark(text, m)) {
            return false;
        }
        if (lang === "fr" && unwantedFrenchRemark(text, m)) {
            return false;
        }
        const word = text.slice(m.start, m.end).trim();
        if (PARTICLES.has(word.toLowerCase())) {
            const { prev, next } = wordsAround(text, m.start, m.end);
            if (CAPITAL.test(prev) && CAPITAL.test(next)) {
                return false;  // « Parc des Princes » : pas de remarque sur « des »
            }
        }
        return !(m.kind === "orthographe" && isProperName(text, m, lang));
    });
}
