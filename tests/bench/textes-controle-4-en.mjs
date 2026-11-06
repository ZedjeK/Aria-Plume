// Banc « controle4-en » : série de contrôle de la campagne 100 % anglais du 06/11/2026, écrite
// en même temps que textes-4-en.mjs, AVANT tout correctif et à l'aveugle (sans lire le code du
// moteur ni lancer le moteur). Même esprit, phrases différentes : anglais AMÉRICAIN, supports
// variés (SMS, chat, Slack, mails, tickets, revues de code, forums, avis, devoirs, récits,
// recettes), fautes d'anglophones et de francophones, environ un quart de textes justes
// piégeux. Elle n'est pas regardée pendant la mise au point : elle dit si les progrès tiennent
// sur des phrases que les correctifs n'ont jamais vues.
//
// Balisage et catégories : voir textes-4-en.mjs.

export const textes = [
    // --- SMS ---
    { lang: "en", genre: "sms", text: "Honestly, cooking sounds like {{to=>too|hom}} much work tonight. Should we order pizza?" },
    { lang: "en", genre: "sms", text: "{{Were=>We're|hom}} almost at the gas station. Do you need anything?" },
    { lang: "en", genre: "sms", text: "Ugh, I {{past=>passed|hom}} my exit again. I'll be ten minutes late." },
    { lang: "en", genre: "sms", text: "{{Lets=>Let's|typo}} grab lunch tomorrow. I'll text you as soon as I {{will get=>get|conj}} out of my meeting." },
    { lang: "en", genre: "sms", text: "If it {{will rain=>rains|conj}} tomorrow, we'll move the picnic to {{sunday=>Sunday|maj}}." },
    { lang: "en", genre: "sms", text: "The dog {{digged=>dug|pp}} a hole under the fence again. Can you pick up some chicken wire on the way home?" },
    { lang: "en", genre: "sms", text: "The {{tempature=>temperature|ortho}} dropped below freezing last night, and my car {{wouldnt=>wouldn't|typo}} start this morning." },
    { lang: "en", genre: "sms", text: "{{Waht=>What|frappe}} time does the store open on {{sundays=>Sundays|maj}}?" },
    { lang: "en", genre: "sms", text: "We're flying to {{tokyo=>Tokyo|maj}} in {{june=>June|maj}}!" },

    // --- Chat ---
    { lang: "en", genre: "chat", text: "We {{where=>were|hom}} about to leave when you called." },
    { lang: "en", genre: "chat", text: "We walk the dog {{everyday=>every day|hom}} after dinner." },
    { lang: "en", genre: "chat", text: "I bought {{to=>two|hom}} tickets for the concert, one for you and one for me." },
    { lang: "en", genre: "chat", text: "I'm {{loosing=>losing|hom}} my mind with this assignment." },
    { lang: "en", genre: "chat", text: "Have you {{spoke=>spoken|pp}} to your landlord about the leak?" },
    { lang: "en", genre: "chat", text: "He can {{speaks=>speak|conj}} four languages fluently." },
    { lang: "en", genre: "chat", text: "Last summer we {{visit=>visited|conj}} my grandparents in Ohio." },
    { lang: "en", genre: "chat", text: "{{This=>These|acc}} two printers are always jammed." },
    { lang: "en", genre: "chat", text: "These cookies {{is=>are|acc}} delicious! Can I have the recipe?" },
    { lang: "en", genre: "chat", text: "The {{restaraunt=>restaurant|ortho}} on Main Street finally reopened." },
    { lang: "en", genre: "chat", text: "Do you {{knwo=>know|frappe}} if the pharmacy is open on Sundays?" },
    { lang: "en", genre: "chat", text: "{{Thats=>That's|typo}} a great idea! Let's do it." },
    { lang: "en", genre: "chat", text: "Can {{i=>I|maj}} borrow your umbrella? It's pouring outside." },
    { lang: "en", genre: "chat", text: "My sister doesn't {{wants=>want|conj}} to move to another city." },
    { lang: "en", genre: "chat", text: "Yesterday I {{forget=>forgot|conj}} my lunch at home, so I {{eated=>ate|pp}} a sad sandwich from the vending machine." },
    { lang: "en", genre: "chat", text: "We {{are=>have been|conj}} friends since kindergarten, and {{shes=>she's|typo}} still my favorite person." },
    { lang: "en", genre: "chat", text: "My grandfather {{is=>has been|conj}} in the hospital since Tuesday, but the doctors say he's doing better." },
    { lang: "en", genre: "chat", text: "Did she {{called=>call|conj}} you back about the apartment?" },
    { lang: "en", genre: "chat", text: "I {{am knowing=>know|conj}} this neighborhood very well; I grew up two blocks from here." },
    { lang: "en", genre: "chat", text: "He {{throwed=>threw|pp}} the ball over the fence, and we never found it." },
    { lang: "en", genre: "chat", text: "Have you ever {{rode=>ridden|pp}} a horse? {{Its=>It's|hom}} harder than it looks." },
    { lang: "en", genre: "chat", text: "Has the package {{came=>come|pp}} yet? The tracking page says it was delivered." },
    { lang: "en", genre: "chat", text: "I {{leaved=>left|pp}} my keys on the kitchen table. Can you let me in?" },
    { lang: "en", genre: "chat", text: "We {{winned=>won|pp}} the trivia night at the pub! {{Theyre=>They're|typo}} giving us a $50 gift card." },
    { lang: "en", genre: "chat", text: "She has {{began=>begun|pp}} training for the marathon, and she runs ten miles every {{saturday=>Saturday|maj}}." },
    { lang: "en", genre: "chat", text: "We've {{ate=>eaten|pp}} at that diner twice, and the pancakes were great both times." },
    { lang: "en", genre: "chat", text: "Her {{pronounciation=>pronunciation|ortho}} is almost perfect after only a year of lessons." },
    { lang: "en", genre: "chat", text: "My {{nieghbor=>neighbor|ortho}} plays the drums at midnight." },
    { lang: "en", genre: "chat", text: "We're out {{fo=>of|frappe}} printer paper again. Who's ordering supplies this month?" },
    { lang: "en", genre: "chat", text: "I need {{ot=>to|frappe}} leave early today for a doctor's appointment." },
    { lang: "en", genre: "chat", text: "She {{doesnt=>doesn't|typo}} eat meat, so I'll make a veggie lasagna." },
    { lang: "en", genre: "chat", text: "I think {{youre=>you're|typo}} right about the recipe: it only needs twenty {{minute=>minutes|acc}} in the oven." },
    { lang: "en", genre: "chat", text: "{{Todays=>Today's|typo}} special is clam chowder, and {{its=>it's|hom}} amazing." },
    { lang: "en", genre: "chat", text: "{{i'm=>I'm|maj}} not sure yet. Let me check my calendar." },
    { lang: "en", genre: "chat", text: "Two {{woman=>women|acc}} from our team won the hackathon!" },
    { lang: "en", genre: "chat", text: "My {{foots=>feet|acc}} hurt after the hike, but the view was worth it." },
    { lang: "en", genre: "chat", text: "Whether we go hiking depends {{of=>on|hom}} the weather." },
    { lang: "en", genre: "chat", text: "The kids were {{aloud=>allowed|hom}} to stay up late on New Year's Eve." },

    // --- Slack ---
    { lang: "en", genre: "slack", text: "Everyone {{have=>has|acc}} access to the shared drive now. Ping me if something's missing." },
    { lang: "en", genre: "slack", text: "The deploy failed {{wiht=>with|frappe}} a timeout error, so I rolled it back." },
    { lang: "en", genre: "slack", text: "I'll send the {{udpate=>update|frappe}} after lunch. The numbers look good so far." },
    { lang: "en", genre: "slack", text: "The {{databse=>database|frappe}} migration took 40 minutes on the staging cluster." },

    // --- Mails ---
    { lang: "en", genre: "mail", text: "All items can be returned within 30 days, {{accept=>except|hom}} those marked as final sale." },
    { lang: "en", genre: "mail", text: "We're planning a small party for Dad's 60th. Could you bring {{a=>an|acc}} extra folding table?" },
    { lang: "en", genre: "mail", text: "I'm sorry for the delay. The {{maintainance=>maintenance|ortho}} window ran longer than planned." },
    { lang: "en", genre: "mail", text: "Could we {{reschedual=>reschedule|ortho}} our call to next week?" },
    { lang: "en", genre: "mail", text: "The hotel can {{acommodate=>accommodate|ortho}} up to 200 guests." },
    { lang: "en", genre: "mail", text: "We {{have=>have had|conj}} this car since 2018, and it has never broken down." },
    { lang: "en", genre: "mail", text: "Could you {{sent=>send|conj}} me the slides after the meeting? I'd like to share them with the {{comittee=>committee|ortho}}." },
    { lang: "en", genre: "mail", text: "We {{have visited=>visited|conj}} Rome last year and loved it. This time we want to see {{florence=>Florence|maj}} and Venice." },
    { lang: "en", genre: "mail", text: "We {{meeted=>met|pp}} at a friend's wedding in Austin, and we've been inseparable ever since." },
    { lang: "en", genre: "mail", text: "They have {{chose=>chosen|pp}} a venue for the wedding, a small vineyard near Napa." },
    { lang: "en", genre: "mail", text: "We need to {{garantee=>guarantee|ortho}} the delivery date, or the client will cancel the order." },
    { lang: "en", genre: "mail", text: "I'm {{greatful=>grateful|ortho}} for all your help this year. Merry {{christmas=>Christmas|maj}} to you and your family!" },
    { lang: "en", genre: "mail", text: "Hi Olivia,\n\nThanks again for hosting us last weekend. Your garden is {{beautifull=>beautiful|ortho}}, and the kids {{has=>have|acc}} talked about your chickens ever since.\n\nHugs,\nNadia" },
    { lang: "en", genre: "mail", text: "I'll forward the invoice to {{the the=>the|frappe}} accounting team this afternoon." },
    { lang: "en", genre: "mail", text: "We {{werent=>weren't|typo}} told about the schedule change until this morning." },
    { lang: "en", genre: "mail", text: "My boss and her assistant {{is=>are|acc}} on vacation this week, so replies may be slow." },
    { lang: "en", genre: "mail", text: "I have lived here {{since=>for|hom}} three years, and I still get lost downtown." },

    // --- Tickets de support ---
    { lang: "en", genre: "ticket", text: "Hi, the badge reader on the third floor {{reject=>rejects|acc}} my card every morning." },
    { lang: "en", genre: "ticket", text: "I was charged twice for the same subscription. Could you refund one of the {{payment=>payments|acc}}?" },
    { lang: "en", genre: "ticket", text: "I received the wrong size. I ordered {{an=>a|acc}} medium, but the label says XL." },
    { lang: "en", genre: "ticket", text: "The {{porblem=>problem|frappe}} started after I changed my email address." },
    { lang: "en", genre: "ticket", text: "The package {{arrive=>arrived|conj}} two days ago, but the box was empty. Could you look into it?" },
    { lang: "en", genre: "ticket", text: "Hello,\n\nMy router {{restart=>restarts|acc}} by itself several times a day. I have already {{reseted=>reset|pp}} it to factory settings, but the problem is still there. Could you help?" },
    { lang: "en", genre: "ticket", text: "There's {{noone=>no one|ortho}} at the front desk, and the phone just keeps ringing." },
    { lang: "en", genre: "ticket", text: "All the {{softwares=>software|acc}} on this laptop is outdated. Can IT update it?" },

    // --- Revue de code ---
    { lang: "en", genre: "review", text: "A couple of notes:\n- `fetchUser` {{dont=>doesn't|acc}} handle the 404 case.\n- The retry delay should be configurable.\n- {{Its=>It's|hom}} worth adding a test for expired tokens." },

    // --- Forums ---
    { lang: "en", genre: "forum", text: "This mod is {{absolutly=>absolutely|ortho}} worth installing, especially if you play on hard mode." },
    { lang: "en", genre: "forum", text: "The {{occurence=>occurrence|ortho}} of this bug seems completely random." },

    // --- Avis clients ---
    { lang: "en", genre: "avis", text: "The shoes look nice, but they're {{to=>too|hom}} narrow for my feet." },
    { lang: "en", genre: "avis", text: "The food was good, but the portions {{was=>were|acc}} tiny for the price." },
    { lang: "en", genre: "avis", text: "The quality of the photos {{are=>is|acc}} excellent, even in low light." },
    { lang: "en", genre: "avis", text: "The car wouldn't stop because the {{breaks=>brakes|hom}} were worn out. The mechanic fixed them in an hour." },

    // --- Devoir ---
    { lang: "en", genre: "devoir", text: "The Industrial Revolution {{begun=>began|pp}} in Britain in the late 18th century. New machines made it possible to produce goods faster {{then=>than|hom}} ever before." },

    // --- Récits ---
    { lang: "en", genre: "recit", text: "When I opened the door, the {{hole=>whole|hom}} room smelled of cinnamon." },
    { lang: "en", genre: "recit", text: "When I was a kid, we {{use=>used|conj}} to spend every summer at my uncle's farm. I still remember the smell of the hay and the sound of the tractor at dawn. Those {{where=>were|hom}} the best days of my life." },
    { lang: "en", genre: "recit", text: "She {{sitted=>sat|pp}} next to me on the bus and talked the whole way to Boston." },
    { lang: "en", genre: "recit", text: "The smoke was so thick that I couldn't {{breath=>breathe|hom}}." },

    // --- Recettes ---
    { lang: "en", genre: "recette", text: "Season with salt and pepper to taste. Serve {{immediatly=>immediately|ortho}}." },
    { lang: "en", genre: "recette", text: "Cut the chicken into bite-size pieces. Heat the oil in a large skillet, add the garlic, and cook for one {{minutes=>minute|acc}}. Add the chicken and cook until it's no longer pink." },

    // --- Textes justes (pièges à fausses alertes) ---
    { lang: "en", genre: "juste", text: "You're welcome to use your own laptop, but you'll need to install the VPN client first." },
    { lang: "en", genre: "juste", text: "I'd rather lose a day of work than lose all the data." },
    { lang: "en", genre: "juste", text: "Whose car is parked in front of the garage? Who's going to move it?" },
    { lang: "en", genre: "juste", text: "Here's my advice: talk to a lawyer before you sign anything. I'd advise against signing today." },
    { lang: "en", genre: "juste", text: "It took us an hour to reach a university campus on the edge of town." },
    { lang: "en", genre: "juste", text: "Run `kubectl rollout restart deployment/api -n prod` if the pods don't pick up the new config." },
    { lang: "en", genre: "juste", text: "Your total is $1,249.99, including tax and free shipping." },
    { lang: "en", genre: "juste", text: "The train leaves at 6:45 a.m., so set your alarm for 5:30." },
    { lang: "en", genre: "juste", text: "Her résumé was impressive, but she seemed a bit naïve during the interview." },
    { lang: "en", genre: "juste", text: "The menu is à la carte, and the crème brûlée is a must." },
    { lang: "en", genre: "juste", text: "I've lived in Seattle for six years, and I still haven't gotten used to the rain." },
    { lang: "en", genre: "juste", text: "If I were in your position, I would ask for a raise." },
    { lang: "en", genre: "juste", text: "The number of applicants has doubled this year." },
    { lang: "en", genre: "juste", text: "Each of the servers has its own power supply." },
    { lang: "en", genre: "juste", text: "One of the reasons we chose this provider is its support team." },
    { lang: "en", genre: "juste", text: "The news was better than we expected." },
    { lang: "en", genre: "juste", text: "I read the whole report last night, and I put my comments in the doc." },
    { lang: "en", genre: "juste", text: "The pipes in this old house still contain lead, so we only drink filtered water." },
    { lang: "en", genre: "juste", text: "She led the project for two years before moving to the Denver office." },
    { lang: "en", genre: "juste", text: "There's a loose screw on the hinge; tighten it before you lose it." },
    { lang: "en", genre: "juste", text: "The red wine complements the steak, and the chef deserves a compliment." },
    { lang: "en", genre: "juste", text: "Our principal concern is safety, and we won't compromise on that principle." },
    { lang: "en", genre: "juste", text: "I go running every day, but these everyday aches are getting old." },
    { lang: "en", genre: "juste", text: "It may be too late to change the venue. Maybe we can move the date instead." },
    { lang: "en", genre: "juste", text: "Then we realized the bus was faster than the train." },
    { lang: "en", genre: "juste", text: "Siobhan and Krzysztof will present the roadmap on Thursday." },
    { lang: "en", genre: "juste", text: "I've known Alex since college, and he's always been the funniest person in the room." },
    { lang: "en", genre: "juste", text: "The store accepts all major credit cards except American Express." },
    { lang: "en", genre: "juste", text: "The new policy will affect remote workers, but its effect on productivity is still unclear." },
    { lang: "en", genre: "juste", text: "Rock 'n' roll was born in the '50s, and it's still going strong." },
];
