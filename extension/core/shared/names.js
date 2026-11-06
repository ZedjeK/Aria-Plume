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

// Remarques de Harper à ne pas montrer : grossièretés « censurées », unités développées (GB → gigabytes).
export function unwantedEnglishRemark(text, match) {
    if ((match.suggestions ?? []).some((s) => /\*{2,}|\w\*+\w/.test(s))) {
        return true;
    }
    const word = text.slice(match.start, match.end);
    return match.rule === "WordChoice" && /^(?:[KMGTP]B|[KMGT]iB|GHz|MHz|kHz|Mbps|Gbps|ms|KB|kb)$/.test(word);
}

export function filterNames(text, matches, lang) {
    return matches.filter((m) => {
        if (lang === "en" && unwantedEnglishRemark(text, m)) {
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
