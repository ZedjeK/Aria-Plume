// Aria Plume (application) — fond animé « correction » de la zone principale.
//
// Des lignes de texte fantômes. Chaque ligne vit sa propre vie, au hasard : elle s'écrit de gauche à
// droite (une tête cyan avance), reste un moment, s'efface de droite à gauche, puis se réécrit avec
// d'autres mots. Pendant qu'elle est là, des mots se font souligner en vague (rouge : faute, jaune :
// répétition, bleu : style), puis se corrigent : le mot se réécrit, le trait devient droit et cyan,
// puis s'éteint. Le fond dit ce que fait l'application : elle corrige.
//
// Réglages (reglages.json) : fond.actif, fond.vitesse (lente, normale, rapide), fond.minimum et
// fond.maximum (corrections visibles en même temps). En pause quand la fenêtre est cachée, image
// fixe si Windows demande moins d'animations.

(function () {
    "use strict";

    const VITESSE = { lente: 0.5, normale: 1, rapide: 1.8 };
    const COULEURS = { rouge: "#ff5c7a", jaune: "#ffd166", bleu: "#5c8bff", cyan: "#7df9ff" };
    const PAS = 34;
    const INTENSITE = 0.9;
    const hasard = (a, b) => a + Math.random() * (b - a);
    const choix = (liste) => liste[Math.floor(Math.random() * liste.length)];

    window.AriaFond = function creerFond(toile, valeursDepart) {
        const ctx = toile.getContext("2d");
        const reduit = window.matchMedia("(prefers-reduced-motion: reduce)");
        const reglage = { actif: true, vitesse: "normale", min: 3, max: 8 };
        let L = 0;
        let H = 0;
        let lignes = [];
        let marques = [];
        let dernier = 0;
        let attente = 0;
        let enPause = false;
        let tourne = false;

        function regler(valeurs) {
            if (typeof valeurs["fond.actif"] === "boolean") {
                reglage.actif = valeurs["fond.actif"];
            }
            if (VITESSE[valeurs["fond.vitesse"]]) {
                reglage.vitesse = valeurs["fond.vitesse"];
            }
            if (Number.isFinite(valeurs["fond.maximum"])) {
                reglage.max = Math.max(1, valeurs["fond.maximum"]);
            }
            if (Number.isFinite(valeurs["fond.minimum"])) {
                reglage.min = Math.max(0, valeurs["fond.minimum"]);
            }
            reglage.min = Math.min(reglage.min, reglage.max);
            toile.hidden = !reglage.actif;
            if (reduit.matches) {
                image();
            } else if (reglage.actif) {
                demarrer();
            }
        }

        // Les mots d'une ligne : des barres arrondies de longueurs variées, comme un texte vu flou.
        function nouveauxMots() {
            const mots = [];
            let x = hasard(16, 90);
            const fin = L - hasard(40, Math.max(60, L * 0.3));
            while (x < fin) {
                const w = hasard(24, 92);
                mots.push({ x, w, cible: w });
                x += w + hasard(9, 17);
            }
            return mots;
        }

        // Une ligne : états « ecrit » → « reste » → « efface » → « vide » → « ecrit »…
        function nouvelleLigne(y, depart) {
            const l = { y, mots: nouveauxMots(), etat: "ecrit", t: 0, duree: hasard(1.4, 2.6) };
            if (depart) {
                // Au lancement, la plupart des lignes sont déjà écrites, à des moments différents de leur vie.
                const tirage = Math.random();
                if (tirage < 0.7) {
                    l.etat = "reste";
                    l.duree = hasard(4, 16);
                    l.t = hasard(0, l.duree);
                } else if (tirage < 0.85) {
                    l.etat = "vide";
                    l.duree = hasard(0.5, 3);
                    l.t = hasard(0, l.duree);
                } else {
                    l.t = hasard(0, l.duree);
                }
            }
            return l;
        }

        function suivant(l) {
            l.t = 0;
            if (l.etat === "ecrit") {
                l.etat = "reste";
                l.duree = hasard(6, 16);
            } else if (l.etat === "reste") {
                l.etat = "efface";
                l.duree = hasard(0.8, 1.4);
            } else if (l.etat === "efface") {
                l.etat = "vide";
                l.duree = hasard(0.4, 3);
            } else {
                l.etat = "ecrit";
                l.duree = hasard(1.4, 2.6);
                l.mots = nouveauxMots();
            }
        }

        // Bord droit de la ligne visible : elle s'écrit et s'efface comme une tête de lecture.
        function bord(l) {
            const dernier = l.mots.length ? l.mots[l.mots.length - 1] : { x: 0, w: 0 };
            const debut = l.mots.length ? l.mots[0].x : 0;
            const total = dernier.x + dernier.w - debut;
            const p = Math.min(1, l.t / l.duree);
            if (l.etat === "ecrit") {
                return debut + total * p;
            }
            if (l.etat === "efface") {
                return debut + total * (1 - p);
            }
            return l.etat === "reste" ? Infinity : -Infinity;
        }

        function taille() {
            const r = toile.getBoundingClientRect();
            const d = window.devicePixelRatio || 1;
            L = r.width;
            H = r.height;
            toile.width = Math.max(1, Math.round(L * d));
            toile.height = Math.max(1, Math.round(H * d));
            ctx.setTransform(d, 0, 0, d, 0, 0);
            lignes = [];
            for (let y = 40; y < H - 20; y += PAS) {
                lignes.push(nouvelleLigne(y, true));
            }
            marques = [];
        }

        // Une correction : un mot d'une ligne écrite, pas déjà pris.
        function nouvelleMarque() {
            const libres = lignes.filter((l) => l.etat === "reste" && l.duree - l.t > 4);
            if (!libres.length) {
                return null;
            }
            const ligne = choix(libres);
            const mots = ligne.mots.filter((m) => !marques.some((k) => k.mot === m));
            if (!mots.length) {
                return null;
            }
            return { ligne, mot: choix(mots), couleur: choix(["rouge", "rouge", "jaune", "bleu"]), t: 0, duree: hasard(3, 5), corrige: false };
        }

        function vague(x, y, w, amplitude, phase) {
            ctx.beginPath();
            for (let i = 0; i <= w; i += 2) {
                const yy = y + Math.sin((i + phase) / 3.2) * amplitude;
                if (i === 0) {
                    ctx.moveTo(x + i, yy);
                } else {
                    ctx.lineTo(x + i, yy);
                }
            }
            ctx.stroke();
        }

        function barre(x, y, w) {
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(x, y - 6, w, 9, 4);
            } else {
                ctx.rect(x, y - 6, w, 9);
            }
            ctx.fill();
        }

        function dessinerLignes() {
            for (const l of lignes) {
                if (l.etat === "vide") {
                    continue;
                }
                const droite = bord(l);
                ctx.fillStyle = "rgba(147, 168, 200, 0.075)";
                for (const m of l.mots) {
                    if (m.x >= droite) {
                        break;
                    }
                    barre(m.x, l.y, Math.min(m.w, droite - m.x));
                }
                // La tête d'écriture : un trait cyan fin qui avance (ou recule) avec la ligne.
                if (l.etat === "ecrit" || l.etat === "efface") {
                    ctx.fillStyle = "rgba(125, 249, 255, 0.35)";
                    ctx.fillRect(droite + 2, l.y - 8, 1.5, 13);
                }
            }
        }

        function dessinerMarque(k) {
            const p = k.t / k.duree;
            const a = Math.min(1, p / 0.12) * (p > 0.82 ? 1 - (p - 0.82) / 0.18 : 1) * INTENSITE;
            const m = k.mot;
            const y = k.ligne.y;
            // À mi-vie, le mot se réécrit (sa barre change un peu de longueur) et la correction est faite.
            if (p > 0.5 && !k.corrige) {
                k.corrige = true;
                m.cible = Math.max(20, m.w * hasard(0.7, 1));
            }
            if (k.corrige) {
                m.w += (m.cible - m.w) * 0.12;
            }
            ctx.save();
            ctx.globalAlpha = a;
            ctx.fillStyle = k.corrige ? "rgba(125, 249, 255, 0.10)" : "rgba(221, 235, 255, 0.10)";
            barre(m.x, y, m.w);
            ctx.lineWidth = 1.6;
            ctx.strokeStyle = k.corrige ? COULEURS.cyan : COULEURS[k.couleur];
            if (k.corrige) {
                ctx.beginPath();
                ctx.moveTo(m.x, y + 7);
                ctx.lineTo(m.x + m.w, y + 7);
                ctx.stroke();
            } else {
                vague(m.x, y + 7, m.w * Math.min(1, p / 0.25), 2, k.t * 40);
            }
            ctx.restore();
        }

        function boucle(t) {
            if (enPause || reduit.matches || !reglage.actif) {
                tourne = false;
                return;
            }
            const dt = Math.min(0.1, (t - dernier) / 1000) * VITESSE[reglage.vitesse];
            dernier = t;
            ctx.clearRect(0, 0, L, H);
            for (const l of lignes) {
                l.t += dt;
                if (l.t >= l.duree) {
                    suivant(l);
                }
            }
            // Une ligne qui s'efface emporte ses corrections.
            marques.forEach((k) => {
                k.t += dt;
            });
            marques = marques.filter((k) => k.t < k.duree && k.ligne.etat === "reste");
            attente -= dt;
            if (marques.length < reglage.min || (marques.length < reglage.max && attente <= 0)) {
                const k = nouvelleMarque();
                if (k) {
                    marques.push(k);
                }
                attente = hasard(0.3, 1.2);
            }
            dessinerLignes();
            marques.forEach(dessinerMarque);
            requestAnimationFrame(boucle);
        }

        function demarrer() {
            if (tourne || enPause || reduit.matches || !reglage.actif) {
                return;
            }
            tourne = true;
            dernier = performance.now();
            requestAnimationFrame(boucle);
        }

        // Moins d'animations demandées : une image fixe, toutes les lignes écrites et quelques
        // corrections posées.
        function image() {
            ctx.clearRect(0, 0, L, H);
            if (!reglage.actif) {
                return;
            }
            lignes.forEach((l) => {
                l.etat = "reste";
                l.t = 0;
                l.duree = 10;
            });
            marques = [];
            for (let i = 0; i < reglage.min; i++) {
                const k = nouvelleMarque();
                if (k) {
                    k.t = k.duree * 0.3;
                    marques.push(k);
                }
            }
            dessinerLignes();
            marques.forEach(dessinerMarque);
        }

        document.addEventListener("visibilitychange", () => {
            enPause = document.hidden;
            demarrer();
        });
        new ResizeObserver(() => {
            taille();
            if (reduit.matches) {
                image();
            }
        }).observe(toile);
        reduit.addEventListener?.("change", () => regler({}));
        taille();
        regler(valeursDepart ?? {});
        return { regler };
    };
})();
