// Banc « controle3 » : série de contrôle de la campagne 100 % français du 30/10/2026, écrite en
// même temps que textes-3.mjs, AVANT tout correctif. Jamais regardée pendant la mise au point.
// Balisage : voir textes-3.mjs.

export const textes = [
    // --- Sujet éloigné, inversé, coordonné ---
    { lang: "fr", genre: "sujet", text: "Le groupe de stagiaires {{arrivent=>arrive|conj}} à neuf heures." },
    { lang: "fr", genre: "sujet", text: "Les clés que je t'ai prêtées la semaine dernière {{a=>ont|conj}} disparu." },
    { lang: "fr", genre: "sujet", text: "La réunion prévue avec les fournisseurs {{ont=>a|conj}} été annulée." },
    { lang: "fr", genre: "sujet", text: "Chacune des salles {{disposent=>dispose|conj}} d'un vidéoprojecteur." },
    { lang: "fr", genre: "sujet", text: "Quand {{arrive=>arrivent|conj}} tes cousins ?" },
    { lang: "fr", genre: "sujet", text: "Ma femme et moi {{sont=>sommes|conj}} ravis de votre visite." },
    { lang: "fr", genre: "sujet", text: "C'est vous qui {{a=>avez|conj}} gagné le concours ?" },
    { lang: "fr", genre: "sujet", text: "Les écrans du bureau d'en face {{reste=>restent|conj}} allumés toute la nuit." },
    { lang: "fr", genre: "sujet", text: "Le prix des composants {{augmentent=>augmente|conj}} chaque année." },

    // --- Participe passé ---
    { lang: "fr", genre: "pp", text: "Les vidéos que tu m'as {{montré=>montrées|acc}} étaient hilarantes." },
    { lang: "fr", genre: "pp", text: "Ta lettre, je l'ai {{lu=>lue|acc}} avec émotion." },
    { lang: "fr", genre: "pp", text: "Combien de kilomètres as-tu {{parcouru=>parcourus|acc}} cette année ?" },
    { lang: "fr", genre: "pp", text: "Elle s'est {{brossée=>brossé|acc}} les dents avant de dormir." },
    { lang: "fr", genre: "pp", text: "Ils se sont {{souris=>souri|acc}} timidement." },
    { lang: "fr", genre: "pp", text: "Mes sœurs sont {{parti=>parties|acc}} au ski." },
    { lang: "fr", genre: "pp", text: "Les mesures que la direction a {{annoncé=>annoncées|acc}} ne plaisent à personne." },

    // --- Participe ou infinitif ---
    { lang: "fr", genre: "inf", text: "Il faudrait {{réparé=>réparer|pp}} la fuite avant l'hiver." },
    { lang: "fr", genre: "inf", text: "Tu peux m'{{aidé=>aider|pp}} à déménager samedi ?" },
    { lang: "fr", genre: "inf", text: "La facture a été {{envoyer=>envoyée|pp}} hier." },
    { lang: "fr", genre: "inf", text: "J'ai oublié de {{fermé=>fermer|pp}} la fenêtre." },
    { lang: "fr", genre: "inf", text: "Ils ont {{terminer=>terminé|pp}} le projet en avance." },
    { lang: "fr", genre: "inf", text: "Je viens de {{terminé=>terminer|pp}} mon rapport." },

    // --- Homophones ---
    { lang: "fr", genre: "hom", text: "{{Quant=>Quand|hom}} est-ce que tu reviens ?" },
    { lang: "fr", genre: "hom", text: "{{Quand=>Quant|hom}} à ton idée, elle me plaît beaucoup." },
    { lang: "fr", genre: "hom", text: "Elle {{peu=>peut|hom}} compter sur nous." },
    { lang: "fr", genre: "hom", text: "Il ne {{sans=>s'en|hom}} souvient plus." },
    { lang: "fr", genre: "hom", text: "Elle a répondu {{s'en=>sans|hom}} réfléchir." },
    { lang: "fr", genre: "hom", text: "Cette mise à jour est inutile, {{voir=>voire|hom}} dangereuse." },
    { lang: "fr", genre: "hom", text: "Je {{leurs=>leur|acc}} ai envoyé un message." },
    { lang: "fr", genre: "hom", text: "{{Tout=>Tous|acc}} mes collègues sont en télétravail aujourd'hui." },
    { lang: "fr", genre: "hom", text: "J'arriverai {{plutôt=>plus tôt|hom}} que prévu." },
    { lang: "fr", genre: "hom", text: "{{Quelque soit=>Quel que soit|hom}} le résultat, on fêtera ça." },
    { lang: "fr", genre: "hom", text: "Il {{ma=>m'a|hom}} prêté sa voiture." },
    { lang: "fr", genre: "hom", text: "Il {{la=>l'a|hom}} rangé dans le placard." },
    { lang: "fr", genre: "hom", text: "Je voulais venir, {{mes=>mais|hom}} j'étais malade." },
    { lang: "fr", genre: "hom", text: "Il a oublié {{c'est=>ses|hom}} lunettes au bureau." },
    { lang: "fr", genre: "hom", text: "{{Qu'en=>Quand|hom}} pars-tu en vacances ?" },
    { lang: "fr", genre: "hom", text: "Je suis {{près=>prêt|hom}} à t'aider." },
    { lang: "fr", genre: "hom", text: "Tu es {{sur=>sûr|hom}} de toi ?" },
    { lang: "fr", genre: "hom", text: "Il y a très {{peut=>peu|hom}} de monde ce soir." },

    // --- Conjugaison ---
    { lang: "fr", genre: "conj", text: "Il faut que vous {{faites=>fassiez|conj}} attention." },
    { lang: "fr", genre: "conj", text: "Je veux que tu {{viens=>viennes|conj}} avec moi." },
    { lang: "fr", genre: "conj", text: "Bien qu'elle {{a=>ait|conj}} raison, personne ne l'écoute." },
    { lang: "fr", genre: "conj", text: "Si tu {{serais=>étais|conj}} venu, tu aurais adoré." },
    { lang: "fr", genre: "conj", text: "L'année prochaine, je {{partirais=>partirai|conj}} au Japon." },
    { lang: "fr", genre: "conj", text: "Je {{voudrai=>voudrais|conj}} un renseignement, s'il vous plaît." },
    { lang: "fr", genre: "conj", text: "Vous {{faisez=>faites|conj}} du bon travail." },
    { lang: "fr", genre: "conj", text: "Il {{peind=>peint|conj}} ses figurines le dimanche." },
    { lang: "fr", genre: "conj", text: "Tu {{voudra=>voudras|conj}} un dessert ?" },
    { lang: "fr", genre: "conj", text: "{{Achètes=>Achète|conj}} du pain en rentrant." },

    // --- Accords, pluriels, couleurs, nombres ---
    { lang: "fr", genre: "acc", text: "Les {{travails=>travaux|ortho}} commencent lundi." },
    { lang: "fr", genre: "acc", text: "Elle a acheté des rideaux {{oranges=>orange|acc}}." },
    { lang: "fr", genre: "acc", text: "Une {{bel=>belle|acc}} journée nous attend." },
    { lang: "fr", genre: "acc", text: "Il habite dans un {{vieux=>vieil|acc}} immeuble." },
    { lang: "fr", genre: "acc", text: "Ces résultats sont {{décevant=>décevants|acc}}." },
    { lang: "fr", genre: "acc", text: "Il est une heure et {{demi=>demie|acc}}." },
    { lang: "fr", genre: "acc", text: "Cela coûte {{deux-cents=>deux cents|acc}} euros." },
    { lang: "fr", genre: "acc", text: "Ils ont réparé la voiture {{eux-même=>eux-mêmes|acc}}." },

    // --- Orthographe d'usage et frappe ---
    { lang: "fr", genre: "ortho", text: "Il a {{rappellé=>rappelé|ortho}} le client ce matin." },
    { lang: "fr", genre: "ortho", text: "C'est une {{personalité=>personnalité|ortho}} attachante." },
    { lang: "fr", genre: "ortho", text: "Le {{language=>langage|ortho}} Python est facile à apprendre." },
    { lang: "fr", genre: "ortho", text: "Il faut {{acceuillir=>accueillir|ortho}} les nouveaux arrivants." },
    { lang: "fr", genre: "ortho", text: "Je suis {{entrain=>en train|ortho}} de manger." },
    { lang: "fr", genre: "ortho", text: "Le {{réseaux=>réseau|acc}} est saturé." },
    { lang: "fr", genre: "frappe", text: "Le {{serveru=>serveur|frappe}} est redémarré." },
    { lang: "fr", genre: "frappe", text: "Je t'appelle {{demian=>demain|frappe}} matin." },
    { lang: "fr", genre: "frappe", text: "La {{sauvegrade=>sauvegarde|frappe}} est terminée." },

    // --- Majuscules ---
    { lang: "fr", genre: "maj", text: "Rendez-vous {{Mardi=>mardi|maj}} à dix heures." },
    { lang: "fr", genre: "maj", text: "Il apprend le {{Japonais=>japonais|maj}} depuis deux ans." },

    // --- Textes justes ---
    { lang: "fr", genre: "juste", text: "Les arbres qu'on a fait abattre étaient malades." },
    { lang: "fr", genre: "juste", text: "Ils se sont rendu compte du problème trop tard." },
    { lang: "fr", genre: "juste", text: "Les vingt minutes qu'a duré le trajet m'ont semblé longues." },
    { lang: "fr", genre: "juste", text: "Elles se sont parlé pendant des heures." },
    { lang: "fr", genre: "juste", text: "C'est vous qui avez raison." },
    { lang: "fr", genre: "juste", text: "Quelles que soient tes raisons, je les respecte." },
    { lang: "fr", genre: "juste", text: "Il est tombé une pluie torrentielle toute la nuit." },
    { lang: "fr", genre: "juste", text: "Bien que nous soyons en retard, nous allons y arriver." },
    { lang: "fr", genre: "juste", text: "Les gars, on y va !" },
    { lang: "fr", genre: "juste", text: "Le chef de service, entouré de son équipe, a présenté les résultats." },
    { lang: "fr", genre: "juste", text: "Ils sont tout contents de leur cadeau." },
    { lang: "fr", genre: "juste", text: "Je ne sais pas où j'ai mis mes lunettes." },
    { lang: "fr", genre: "juste", text: "Elle porte une robe vert foncé et des chaussures marron." },
    { lang: "fr", genre: "juste", text: "Nous nous sommes demandé pourquoi il était parti." },
    { lang: "fr", genre: "juste", text: "Les sauvegardes ont été restaurées sans problème." },
    { lang: "fr", genre: "juste", text: "Les tâches qu'il nous a laissé faire étaient simples." },
    { lang: "fr", genre: "juste", text: "Ni toi ni moi ne pouvons y aller demain." },
    { lang: "fr", genre: "juste", text: "Où que tu ailles, je te suivrai." },
    { lang: "fr", genre: "juste", text: "Il y a eu beaucoup de pannes ce mois-ci." },
    { lang: "fr", genre: "juste", text: "Vous êtes priés de vous présenter à l'accueil." },
];
