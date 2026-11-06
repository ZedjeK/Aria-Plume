// Banc « textes4-en » : campagne 100 % anglais du 06/11/2026, écrite AVANT tout correctif de
// cette campagne et à l'aveugle (sans lire le code du moteur ni lancer le moteur). Anglais
// AMÉRICAIN, le réglage par défaut du correcteur (color, organize, center, canceled, gotten…).
// Textes du quotidien de 1 à 4 phrases, quelques paragraphes, sur des supports variés : SMS,
// chat, Slack/Discord, mails pro et perso, tickets de support, revues de code, forums, avis
// clients, devoirs, récits, recettes, notes d'admin.
//
// Fautes d'anglophones et de francophones qui écrivent en anglais : homophones et confusions
// (their/there/they're, its/it's, then/than, to/too/two, affect/effect, lose/loose,
// accept/except, whose/who's, weather/whether, quiet/quite, advice/advise, during/for…),
// accords sujet-verbe et nombre (sujet éloigné, « one of … », « each of … », « everyone »,
// pluriels irréguliers, indénombrables comme information/advice/feedback, a/an), formes
// verbales (should of, did + prétérit, will dans une subordonnée de temps, present perfect
// avec « since », look forward to + -ing, must to, am agree), prétérits et participes
// irréguliers (have went, brung, has wrote, I seen…), orthographe d'usage, fautes de frappe,
// mots doublés, apostrophes manquantes (dont, cant, Im…), majuscules (I, jours, mois,
// langues, nationalités, début de phrase). Environ un quart de textes justes piégeux :
// homophones bien employés, jargon technique (kubectl, PR, LGTM, OAuth, srv-web-02…), code,
// adresses, montants, heures, émojis, mots français (café, résumé, crème brûlée),
// subjonctif, « gotten ».
//
// Même balisage que textes.mjs :
//
//     {{faute=>correction|catégorie}}
//
// Catégories : hom (homophones, confusions de mots), acc (accord sujet-verbe ou nombre, a/an),
// conj (temps ou forme verbale, « should of »), pp (prétérit ou participe irrégulier), ortho
// (orthographe d'usage), frappe (faute de frappe, mot doublé), typo (apostrophe manquante),
// maj (majuscule). Les textes sans balise sont entièrement justes : ils mesurent les fausses
// alertes.
//
// C'est la série de travail : les correctifs s'appuient dessus. La série de contrôle
// (textes-controle-4-en.mjs), écrite en même temps, n'est pas regardée pendant la mise au point.

export const textes = [
    // --- SMS ---
    { lang: "en", genre: "sms", text: "I'm running late, sorry! {{Their=>There|hom}} was an accident on the bridge, and traffic is crawling." },
    { lang: "en", genre: "sms", text: "Can you grab some milk on the way home? We're out, and I {{dont=>don't|typo}} want black coffee again tomorrow." },
    { lang: "en", genre: "sms", text: "Mom says {{its=>it's|hom}} fine if we stay until ten, but not a minute later." },
    { lang: "en", genre: "sms", text: "I {{seen=>saw|pp}} your sister at the mall yesterday. She looked great!" },
    { lang: "en", genre: "sms", text: "You should {{of=>have|conj}} told me the cheap seats were gone! The {{remainig=>remaining|frappe}} ones cost a fortune." },
    { lang: "en", genre: "sms", text: "Did you remember to feed the cat? She {{dont=>doesn't|acc}} touch the dry food anymore." },
    { lang: "en", genre: "sms", text: "We just landed in Denver. The flight was {{quiet=>quite|hom}} bumpy, but we made it." },
    { lang: "en", genre: "sms", text: "{{Whose=>Who's|hom}} picking up the kids from school today?" },
    { lang: "en", genre: "sms", text: "Where's my charger? Did you {{borrowed=>borrow|conj}} it {{wihtout=>without|frappe}} asking again?" },
    { lang: "en", genre: "sms", text: "Grandma loved the flowers. She said {{there=>they're|hom}} the prettiest roses she's ever gotten." },
    { lang: "en", genre: "sms", text: "{{i=>I|maj}} just realized I left my wallet at your place! 🤦" },
    { lang: "en", genre: "sms", text: "Don't forget that the dentist moved your appointment to {{thursday=>Thursday|maj}} at 4 p.m." },
    { lang: "en", genre: "sms", text: "Are you free {{friday=>Friday|maj}} night? There's a new {{thai=>Thai|maj}} place downtown." },
    { lang: "en", genre: "sms", text: "{{Who's=>Whose|hom}} jacket is on the couch? It's not mine." },
    { lang: "en", genre: "sms", text: "The pipes have {{froze=>frozen|pp}} again, so the plumber is on his way." },

    // --- Chat ---
    { lang: "en", genre: "chat", text: "Did you {{here=>hear|hom}} the news? Sam got the job!" },
    { lang: "en", genre: "chat", text: "I'm so {{board=>bored|hom}}. Do you want to watch a movie?" },
    { lang: "en", genre: "chat", text: "I'll {{except=>accept|hom}} the offer if they agree to remote Fridays." },
    { lang: "en", genre: "chat", text: "She has {{wrote=>written|pp}} two cookbooks and is working on a {{thrid=>third|frappe}}." },
    { lang: "en", genre: "chat", text: "My cousin {{brung=>brought|pp}} his new girlfriend to Thanksgiving dinner." },
    { lang: "en", genre: "chat", text: "I {{done=>did|pp}} all the dishes last night, so {{its=>it's|hom}} your turn." },
    { lang: "en", genre: "chat", text: "Somebody has {{took=>taken|pp}} my lunch from the office fridge again. This is the third time this {{weak=>week|hom}}!" },
    { lang: "en", genre: "chat", text: "I {{catched=>caught|pp}} a cold on the plane, so I'm staying home {{tomorow=>tomorrow|ortho}}." },
    { lang: "en", genre: "chat", text: "Did you {{went=>go|conj}} to the concert last night? I heard it was {{amazig=>amazing|frappe}}." },
    { lang: "en", genre: "chat", text: "I'll text you when I {{will arrive=>arrive|conj}} at the station." },
    { lang: "en", genre: "chat", text: "My sister {{is=>has been|conj}} married since 2010, and she still acts like a newlywed." },
    { lang: "en", genre: "chat", text: "Nobody {{know=>knows|acc}} where the spare keys are." },
    { lang: "en", genre: "chat", text: "Can you give me some {{advices=>advice|acc}} on buying a used car?" },
    { lang: "en", genre: "chat", text: "I {{realy=>really|ortho}} need a vacation. I haven't {{did=>done|pp}} anything fun since March." },
    { lang: "en", genre: "chat", text: "It's {{probaly=>probably|ortho}} going to snow tonight, so drive {{carefuly=>carefully|ortho}}." },
    { lang: "en", genre: "chat", text: "I {{finaly=>finally|ortho}} finished the puzzle! It only took three weeks." },
    { lang: "en", genre: "chat", text: "{{Thnaks=>Thanks|frappe}} for covering for me today!" },
    { lang: "en", genre: "chat", text: "I'm {{jsut=>just|frappe}} parking the car. See you in five minutes." },
    { lang: "en", genre: "chat", text: "{{Im=>I'm|typo}} at the front desk. Where are you?" },
    { lang: "en", genre: "chat", text: "That {{isnt=>isn't|typo}} what I meant. Sorry for the confusion." },
    { lang: "en", genre: "chat", text: "We're going to {{paris=>Paris|maj}} for spring break! I {{cant=>can't|typo}} wait." },
    { lang: "en", genre: "chat", text: "Can you help me with my {{english=>English|maj}} homework tonight? I have to {{right=>write|hom}} an essay about my summer." },
    { lang: "en", genre: "chat", text: "We missed the bus. {{luckily=>Luckily|maj}}, my dad picked us up." },
    { lang: "en", genre: "chat", text: "I've been learning {{japanese=>Japanese|maj}} on Duolingo for 200 days straight!" },
    { lang: "en", genre: "chat", text: "Everybody {{want=>wants|acc}} the window seat, so let's draw straws." },
    { lang: "en", genre: "chat", text: "Does your brother {{works=>work|conj}} at the hospital, or was that your cousin?" },
    { lang: "en", genre: "chat", text: "We didn't {{saw=>see|conj}} the sign and missed the turn." },
    { lang: "en", genre: "chat", text: "The sun {{rised=>rose|pp}} at 6:12 this morning, and I watched it from the balcony." },
    { lang: "en", genre: "chat", text: "My phone was {{stole=>stolen|pp}} on the subway last week." },

    // --- Slack, Discord ---
    { lang: "en", genre: "slack", text: "Heads up: the list of failing tests {{are=>is|acc}} in the thread below." },
    { lang: "en", genre: "slack", text: "Can someone review my PR? {{Its=>It's|hom}} only three lines." },
    { lang: "en", genre: "slack", text: "I have {{went=>gone|pp}} through all the logs and {{founded=>found|pp}} nothing unusual." },
    { lang: "en", genre: "slack", text: "Did my last commit {{brake=>break|hom}} the build? CI turned red right after I pushed." },
    { lang: "en", genre: "slack", text: "Quick question: does anyone know {{weather=>whether|hom}} the API rate limit applies per user or per token?" },
    { lang: "en", genre: "slack", text: "Reminder: the all-hands has been moved to Wednesday, so the sprint demo will {{happens=>happen|conj}} on Thursday." },
    { lang: "en", genre: "slack", text: "Thanks for the {{advise=>advice|hom}} on Redis. Rotating the password worked without any downtime." },
    { lang: "en", genre: "slack", text: "{{There=>They're|hom}} rolling out the new SSO flow to the Berlin office first." },
    { lang: "en", genre: "slack", text: "Our on-call rotation for {{november=>November|maj}} is posted in the wiki." },
    { lang: "en", genre: "slack", text: "Can you send me the link {{agian=>again|frappe}}? It expired." },
    { lang: "en", genre: "slack", text: "I think the {{affect=>effect|hom}} of the caching change is small: about 5% on p95 latency." },
    { lang: "en", genre: "discord", text: "Sorry, guys, I {{cant=>can't|typo}} join tonight. My internet provider is doing {{maintenence=>maintenance|ortho}}." },
    { lang: "en", genre: "discord", text: "The new patch nerfed my favorite character {{to=>too|hom}} hard. He's {{basicly=>basically|ortho}} useless now." },

    // --- Mails professionnels ---
    { lang: "en", genre: "mail", text: "Hi Priya,\n\nThanks for sending the {{contrat=>contract|ortho}}. I'll review it this afternoon and get back to you by noon tomorrow.\n\nBest,\nTom" },
    { lang: "en", genre: "mail", text: "Dear Mr. Alvarez,\n\nI am writing to follow up on the invoice we sent on October 2. According to our records, it {{have=>has|acc}} not been paid yet. Could you {{chek=>check|frappe}} with your accounting department?" },
    { lang: "en", genre: "mail", text: "Thank you for considering our proposal. I look forward to {{hear=>hearing|conj}} from you." },
    { lang: "en", genre: "mail", text: "Could you send me more {{informations=>information|acc}} about the training schedule?" },
    { lang: "en", genre: "mail", text: "Hi team,\n\nAttached {{is=>are|acc}} the slides from {{todays=>today's|typo}} workshop. Feel free to share them with your teams." },
    { lang: "en", genre: "mail", text: "Please keep the {{reciept=>receipt|ortho}} in case you need to return the item." },
    { lang: "en", genre: "mail", text: "Thank you for your {{feedbacks=>feedback|acc}}. We've {{update=>updated|conj}} the draft accordingly." },
    { lang: "en", genre: "mail", text: "Let me know if you have any questions.\n\n{{Sincerly=>Sincerely|ortho}},\nMarc Dubois" },
    { lang: "en", genre: "mail", text: "I {{know=>have known|conj}} Daniel since 2015, and I can vouch for his work ethic." },
    { lang: "en", genre: "mail", text: "The new hire starts on {{monday=>Monday|maj}}; please make sure her laptop is ready by then." },
    { lang: "en", genre: "mail", text: "Our office will be closed for {{thanksgiving=>Thanksgiving|maj}} on November 26 and 27." },
    { lang: "en", genre: "mail", text: "I'd like to {{recomend=>recommend|ortho}} Sarah for the team lead position. She has {{lead=>led|pp}} three major projects this year." },
    { lang: "en", genre: "mail", text: "It was a bit {{embarassing=>embarrassing|ortho}} to present the wrong slides to the client." },
    { lang: "en", genre: "mail", text: "All {{personal=>personnel|hom}} must wear a badge at all times in the server room." },
    { lang: "en", genre: "mail", text: "This change will {{effect=>affect|hom}} all users on the legacy plan." },
    { lang: "en", genre: "mail", text: "The meeting {{maybe=>may be|hom}} postponed if the client can't attend." },
    { lang: "en", genre: "mail", text: "Visitors {{must to=>must|conj}} sign in at the front desk." },
    { lang: "en", genre: "mail", text: "Please {{acknowlege=>acknowledge|ortho}} receipt of this message." },
    { lang: "en", genre: "mail", text: "The number of support tickets {{have=>has|acc}} doubled since the launch." },
    { lang: "en", genre: "mail", text: "We appreciate your patience {{adn=>and|frappe}} understanding during the outage." },
    { lang: "en", genre: "mail", text: "Please send the files to {{Davids=>David's|typo}} new address." },
    { lang: "en", genre: "mail", text: "Our {{german=>German|maj}} partners will join the call at 9 a.m. Eastern." },
    { lang: "en", genre: "mail", text: "Hi Mark,\n\nI wanted to give you a quick update on the migration. Most of the services {{has=>have|acc}} already switched over to the new cluster, and the remaining ones should be done by {{Wensday=>Wednesday|ortho}}. We {{run=>ran|conj}} into a DNS issue yesterday, but it's fixed now.\n\nThanks,\nLeila" },
    { lang: "en", genre: "mail", text: "Thanks for checking in. I'm {{use=>used|conj}} to working late, so the deadline isn't a problem." },
    { lang: "en", genre: "mail", text: "The meeting is {{in in=>in|frappe}} room 4B, right next to the elevators." },
    { lang: "en", genre: "mail", text: "I got an email {{form=>from|frappe}} HR about the new vacation policy." },

    // --- Mails personnels ---
    { lang: "en", genre: "mail", text: "We had a wonderful time in Lisbon. The food was amazing, and the {{whether=>weather|hom}} was perfect the whole week." },
    { lang: "en", genre: "mail", text: "The kids {{has=>have|acc}} been asking about you all week. When are you coming to visit?" },
    { lang: "en", genre: "mail", text: "I {{finded=>found|pp}} the old photo albums in the attic yesterday. You won't {{belive=>believe|ortho}} how young we look!" },
    { lang: "en", genre: "mail", text: "Hey Sam,\n\nIt was so good to see you last weekend! The kids haven't {{stop=>stopped|conj}} talking about the zoo. Let us know when you're free again, and we'll plan something." },

    // --- Tickets de support ---
    { lang: "en", genre: "ticket", text: "Hello,\n\nI can't log in to my account. The page keeps saying my {{pasword=>password|frappe}} is incorrect, even after I reset it twice." },
    { lang: "en", genre: "ticket", text: "My order #48213 {{hasnt=>hasn't|typo}} shipped yet, and it's been ten days. Can you check {{whats=>what's|typo}} going on?" },
    { lang: "en", genre: "ticket", text: "The app crashes every time I try to upload a photo. I {{allready=>already|ortho}} tried reinstalling it." },
    { lang: "en", genre: "ticket", text: "Your website says the item is in stock, but the checkout page says {{its=>it's|hom}} unavailable." },
    { lang: "en", genre: "ticket", text: "I have {{send=>sent|pp}} three emails about this issue, and nobody has answered." },
    { lang: "en", genre: "ticket", text: "After the update, the screen brightness {{keep=>keeps|acc}} resetting to 50%." },
    { lang: "en", genre: "ticket", text: "Will I {{loose=>lose|hom}} my saved projects if I downgrade to the free plan?" },
    { lang: "en", genre: "ticket", text: "Hello,\n\nI ordered a coffee maker on October 28 (order #A-77120). The box arrived on time, but the glass carafe was {{broke=>broken|pp}}. Could you send a replacement? I have {{attach=>attached|conj}} a photo of the damage." },
    { lang: "en", genre: "ticket", text: "The printer on the second floor {{is=>has been|conj}} broken since Monday. Could someone take a look?" },

    // --- Revues de code ---
    { lang: "en", genre: "review", text: "This function {{return=>returns|acc}} `null` when the list is empty, which breaks the caller." },
    { lang: "en", genre: "review", text: "I'm not sure this check is {{necesary=>necessary|ortho}}, since `validate()` already rejects empty strings." },
    { lang: "en", genre: "review", text: "This looks good overall, but {{their=>there|hom}} is a race condition if two workers pick up the same job." },
    { lang: "en", genre: "review", text: "We {{shouldnt=>shouldn't|typo}} log the full token here; it ends up in Datadog." },
    { lang: "en", genre: "review", text: "The {{seperation=>separation|ortho}} between the parser and the renderer is much cleaner now. Nice work!" },
    { lang: "en", genre: "review", text: "This loop {{run=>runs|acc}} on every request, so compile the regex once at module level." },
    { lang: "en", genre: "review", text: "I've {{wrote=>written|pp}} a small benchmark; the new version is about twice as fast." },
    { lang: "en", genre: "review", text: "Can you rebase on main? There {{si=>is|frappe}} a conflict in `package.json`." },
    { lang: "en", genre: "review", text: "The {{dependancy=>dependency|ortho}} on lodash can go; we only use `debounce`." },
    { lang: "en", genre: "review", text: "Thanks for the PR! A few comments:\n- The new endpoint {{doesnt=>doesn't|typo}} check permissions.\n- `parseDate` could reuse the helper in `utils.ts`.\n- Please add a changelog entry." },
    { lang: "en", genre: "review", text: "Can you double-check the {{configuraiton=>configuration|frappe}} file before we deploy?" },

    // --- Forums ---
    { lang: "en", genre: "forum", text: "Has anyone else noticed faster battery drain after the last update? Mine {{lose=>loses|acc}} about 10% overnight." },
    { lang: "en", genre: "forum", text: "I {{tryed=>tried|ortho}} every solution in this thread yesterday, but none of them {{fix=>fixed|conj}} the problem." },
    { lang: "en", genre: "forum", text: "Thanks, that fixed it! I would never {{of=>have|conj}} figured that out on my own." },
    { lang: "en", genre: "forum", text: "Does anybody {{knows=>know|conj}} where the config file is stored on macOS? I've {{search=>searched|conj}} everywhere." },
    { lang: "en", genre: "forum", text: "I've been using this keyboard for two years, and {{it's=>its|hom}} keycaps still look new." },
    { lang: "en", genre: "forum", text: "I {{am agree=>agree|conj}} with the previous poster: the sequel is better than the original." },
    { lang: "en", genre: "forum", text: "My {{neice=>niece|ortho}} wants to learn Python. Is this course a good starting point for {{a=>an|acc}} 11-year-old?" },
    { lang: "en", genre: "forum", text: "I've had this laptop for three years. Last month the fan started making a grinding noise, and now it {{shut=>shuts|acc}} down whenever I open more {{then=>than|hom}} two browser windows. Is it worth repairing, or should I buy a new one?" },
    { lang: "en", genre: "forum", text: "I have {{much=>many|acc}} questions about the setup process. Is there a beginner's guide somewhere?" },
    { lang: "en", genre: "forum", text: "{{An=>A|acc}} user on Reddit suggested resetting the BIOS." },

    // --- Avis clients ---
    { lang: "en", genre: "avis", text: "The hotel room was clean, but the walls were so thin that it was never {{quite=>quiet|hom}}, even at night." },
    { lang: "en", genre: "avis", text: "I {{buyed=>bought|pp}} these headphones for my commute, and the noise canceling is excellent." },
    { lang: "en", genre: "avis", text: "Do not order from this seller. The package arrived damaged, and customer {{servise=>service|ortho}} never answered my emails." },
    { lang: "en", genre: "avis", text: "The battery {{last=>lasts|acc}} two full days. That's much better {{then=>than|hom}} I expected." },
    { lang: "en", genre: "avis", text: "Our waiter suggested the crème brûlée, and it was the best {{desert=>dessert|hom}} I've had all year." },
    { lang: "en", genre: "avis", text: "We stayed {{during=>for|hom}} five nights and loved every minute of it." },
    { lang: "en", genre: "avis", text: "I was {{dissapointed=>disappointed|ortho}} by the ending, but the first half of the book is brilliant." },
    { lang: "en", genre: "avis", text: "Don't waste your money. The handle has already {{fell=>fallen|pp}} off, and I've only used it twice." },
    { lang: "en", genre: "avis", text: "The repair {{costed=>cost|pp}} only $40, and the mechanic explained everything clearly." },

    // --- Devoirs ---
    { lang: "en", genre: "devoir", text: "In my opinion, the main reason for the war {{were=>was|acc}} economic, not political." },
    { lang: "en", genre: "devoir", text: "One of the main causes of climate change {{are=>is|acc}} the burning of fossil fuels." },
    { lang: "en", genre: "devoir", text: "Our results {{proof=>prove|hom}} that the plants grew faster with more light." },
    { lang: "en", genre: "devoir", text: "During the {{renaissance=>Renaissance|maj}}, artists began to study human anatomy in detail." },
    { lang: "en", genre: "devoir", text: "Each of the students {{have=>has|acc}} to present a project in front of the class." },
    { lang: "en", genre: "devoir", text: "The {{childs=>children|acc}} in the story are left alone in the forest." },
    { lang: "en", genre: "devoir", text: "The French Revolution began in 1789. Many historians argue that the {{economical=>economic|hom}} crisis and the rising price of bread {{was=>were|acc}} the main causes." },

    // --- Récits ---
    { lang: "en", genre: "recit", text: "She {{knowed=>knew|pp}} the house was empty, but she {{knock=>knocked|conj}} anyway." },
    { lang: "en", genre: "recit", text: "We drove for hours through the desert. By the time we reached the motel, the sun had {{sank=>sunk|pp}} behind the mountains." },
    { lang: "en", genre: "recit", text: "Yesterday the guide {{lead=>led|pp}} us down a narrow path to the river." },
    { lang: "en", genre: "recit", text: "She {{through=>threw|hom}} the letter into the fire without reading it." },
    { lang: "en", genre: "recit", text: "Last winter, my brother and I {{decide=>decided|conj}} to drive to Montreal for New Year's Eve. The roads were icy, and {{their=>there|hom}} were trucks stuck on every hill." },
    { lang: "en", genre: "recit", text: "By the time I got to class, the bell had already {{rang=>rung|pp}}." },

    // --- Recettes ---
    { lang: "en", genre: "recette", text: "Let the dough rest for at least an hour, {{than=>then|hom}} roll it out on a floured surface." },
    { lang: "en", genre: "recette", text: "Bake for 25 minutes, or until a toothpick inserted in the center {{come=>comes|acc}} out clean. Let it cool {{completly=>completely|ortho}} before slicing." },

    // --- Notes d'admin ---
    { lang: "en", genre: "admin", text: "The cron job {{didnt=>didn't|typo}} run last night, so the reports are missing." },
    { lang: "en", genre: "admin", text: "Someone {{shutted=>shut|pp}} down srv-web-02 during the backup window." },
    { lang: "en", genre: "admin", text: "The certificate {{expire=>expires|acc}} on December 3, so let's renew it this week." },
    { lang: "en", genre: "admin", text: "The backup script {{wasnt=>wasn't|typo}} executable, so the job failed silently." },
    { lang: "en", genre: "admin", text: "The OAuth tokens {{expires=>expire|acc}} after one hour, so the client needs to refresh them." },
    { lang: "en", genre: "admin", text: "Our Kubernetes cluster is running out of memory {{becuase=>because|frappe}} of a leaky sidecar." },
    { lang: "en", genre: "admin", text: "Two of the disks in the RAID array {{needs=>need|acc}} to be replaced." },
    { lang: "en", genre: "admin", text: "I {{sended=>sent|pp}} the access logs to the security team this morning." },
    { lang: "en", genre: "admin", text: "The alert was {{trigger=>triggered|conj}} at 2:14 a.m. by a spike in 500 errors." },

    // --- Textes justes (pièges à fausses alertes) ---
    { lang: "en", genre: "juste", text: "I'm leaving the office now. I should be there in about 20 minutes." },
    { lang: "en", genre: "juste", text: "Who's bringing the chips? I've got drinks covered, and Jen's making her famous guacamole." },
    { lang: "en", genre: "juste", text: "Congrats on the new job! 🎉 Let's celebrate this weekend." },
    { lang: "en", genre: "juste", text: "It's a two-hour drive to the lake, so let's leave by eight." },
    { lang: "en", genre: "juste", text: "It's been a long week, and the team has earned its weekend." },
    { lang: "en", genre: "juste", text: "They're moving their servers there next month, assuming the contract is signed." },
    { lang: "en", genre: "juste", text: "I wasn't sure whether the weather would hold, so I packed an umbrella." },
    { lang: "en", genre: "juste", text: "The library is quiet in the morning, and it's quite pleasant to work there." },
    { lang: "en", genre: "juste", text: "She could have taken the train, but she chose to drive." },
    { lang: "en", genre: "juste", text: "I can't believe it's already November. Where did the year go?" },
    { lang: "en", genre: "juste", text: "Do you have too many tabs open again? Close a few, and your laptop will thank you." },
    { lang: "en", genre: "juste", text: "I've already told him twice. He just doesn't listen." },
    { lang: "en", genre: "juste", text: "The new manager wants to effect real change, not just affect the quarterly numbers." },
    { lang: "en", genre: "juste", text: "She has an MBA from a European business school and speaks French, Spanish, and Mandarin." },
    { lang: "en", genre: "juste", text: "We've gotten a lot of positive feedback since the redesign." },
    { lang: "en", genre: "juste", text: "LGTM! 👍 I'll merge after lunch unless someone objects." },
    { lang: "en", genre: "juste", text: "Who's up for a match tonight? I'll host the server around 9 p.m. Eastern." },
    { lang: "en", genre: "juste", text: "@here The VPN certificate expires on Friday. Please run the updater before you log off today." },
    { lang: "en", genre: "juste", text: "PR #482 is ready for review. It touches the billing service, so @dana should take a look at the migration." },
    { lang: "en", genre: "juste", text: "FYI, staging will be unavailable between 2 a.m. and 4 a.m. UTC while we patch the database." },
    { lang: "en", genre: "juste", text: "Let's sync tomorrow at 10. I'll send a calendar invite." },
    { lang: "en", genre: "juste", text: "Morning, all! Quick status: the API is back up, the queue is draining, and error rates are normal again. I'll share the post-mortem doc this afternoon." },
    { lang: "en", genre: "juste", text: "As discussed, Thursday's meeting has been canceled. We'll reschedule once the budget is approved." },
    { lang: "en", genre: "juste", text: "Hi Jordan,\n\nThe quarterly report is attached. Revenue grew 12% compared with Q2, mostly thanks to the new subscription plans. Let me know if you'd like me to walk you through the numbers.\n\nBest,\nAnna" },
    { lang: "en", genre: "juste", text: "Contact us at support@brightlane.io or call (555) 014-2290, Monday through Friday." },
    { lang: "en", genre: "juste", text: "I apologize for the confusion. The correct meeting link is in the updated invite." },
    { lang: "en", genre: "juste", text: "It's important that every employee complete the training by Friday." },
    { lang: "en", genre: "juste", text: "A number of customers have asked about the new pricing, so we've added a section to the help center." },
    { lang: "en", genre: "juste", text: "Hi Aunt Linda,\n\nThank you so much for the sweater! The color is perfect, and it fits like a glove.\n\nLove,\nEmma" },
    { lang: "en", genre: "juste", text: "Ticket #10293: the user reports that Outlook freezes when opening attachments larger than 10 MB. I reproduced it on Windows 11, build 26100. Workaround: save the file first, then open it." },
    { lang: "en", genre: "juste", text: "The license key you sent doesn't activate the Pro edition. Please advise." },
    { lang: "en", genre: "juste", text: "Nit: this variable name is a bit vague. Could we rename `tmp` to `retryCount`?" },
    { lang: "en", genre: "juste", text: "LGTM once CI is green. One optional suggestion: we could memoize `getUserRoles()`, since it's called on every render." },
    { lang: "en", genre: "juste", text: "The function returns early if the input is empty; otherwise, it parses the header and validates the checksum." },
    { lang: "en", genre: "juste", text: "Update: it was a loose cable. I can't believe I spent three hours on this. 😅" },
    { lang: "en", genre: "juste", text: "Could a moderator move this thread to the hardware section? I posted it in the wrong place by mistake." },
    { lang: "en", genre: "juste", text: "Great little café! The croissants were flaky, and the staff was super friendly." },
    { lang: "en", genre: "juste", text: "The vacuum is quiet, light, and easy to empty. It's not quite as powerful as our old one, though." },
    { lang: "en", genre: "juste", text: "We booked this cabin for a family reunion. The kitchen was well equipped, the beds were comfortable, and the view of the lake was stunning. The only downside was the Wi-Fi, which barely worked." },
    { lang: "en", genre: "juste", text: "Five stars! The instructions were clear, and the whole assembly took about 40 minutes." },
    { lang: "en", genre: "juste", text: "Shakespeare wrote Hamlet around 1600, and scholars still debate its meaning." },
    { lang: "en", genre: "juste", text: "Photosynthesis takes place in the chloroplasts, where light energy is converted into chemical energy." },
    { lang: "en", genre: "juste", text: "The old man sat on the porch, watching the storm roll in from the west." },
    { lang: "en", genre: "juste", text: "The wind howled all night. Nobody slept except the dog." },
    { lang: "en", genre: "juste", text: "Preheat the oven to 350°F. Mix the flour, sugar, and salt in a large bowl." },
    { lang: "en", genre: "juste", text: "Whisk the eggs with a pinch of salt. Melt the butter over medium heat, then pour in the eggs and stir gently." },
    { lang: "en", genre: "juste", text: "Please run `kubectl get pods -n staging` and paste the output here." },
    { lang: "en", genre: "juste", text: "Run `npm install` and then `npm run build`. If you see an EACCES error, check the permissions on ~/.npm." },
    { lang: "en", genre: "juste", text: "The PostgreSQL replica in us-east-1 is lagging by about 30 seconds. I've opened INC-4471 to track it." },
    { lang: "en", genre: "juste", text: "OAuth 2.0 tokens are stored in Redis with a TTL of 3600 seconds." },
];
