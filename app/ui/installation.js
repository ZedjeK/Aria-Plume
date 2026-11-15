// Aria Plume (application) — fenêtre « Installer Aria Plume » (voir installation.js).
// La page n'a accès à rien d'autre qu'aux trois demandes de window.ariaApp.install*.

const $ = (id) => document.getElementById(id);

function etat(texte, genre = "") {
    $("etat").textContent = texte;
    $("etat").className = `etat ${genre}`.trim();
}

async function demarrer() {
    const info = await window.ariaApp.installInfo();
    $("version").textContent = info.version;
    $("destination").textContent = info.destination;
    $("precedente").textContent = info.installee
        ? `la ${info.installee}, gardée dans sauvegardes\\versions\\ et remplacée par celle-ci`
        : "non";
    if (info.raccourciExiste) {
        $("raccourci-texte").textContent = "Mettre à jour le raccourci du Bureau";
    }
    if (!info.complet) {
        $("installer").disabled = true;
        etat(`Il manque ${info.manque.join(", ")} à côté de l'exe. Décompresse d'abord le zip en entier (clic droit, « Extraire tout »), puis relance l'exe depuis le dossier décompressé : lancé depuis l'aperçu du zip, l'exe est seul.`, "erreur");
    }

    $("installer").addEventListener("click", async () => {
        for (const id of ["installer", "lancer", "raccourci", "ne-plus"]) {
            $(id).disabled = true;
        }
        etat("Copie en cours… la fenêtre se fermera d'elle-même, puis Aria Plume se relancera depuis son dossier.", "occupe");
        const resultat = await window.ariaApp.installRun({ raccourci: $("raccourci").checked });
        if (!resultat.ok) {
            etat(`Installation impossible : ${resultat.error}`, "erreur");
            for (const id of ["lancer", "raccourci", "ne-plus"]) {
                $(id).disabled = false;
            }
            $("installer").disabled = !info.complet;
        }
    });
    $("lancer").addEventListener("click", () => window.ariaApp.installSkip({ nePlusProposer: $("ne-plus").checked }));
    (info.complet ? $("installer") : $("lancer")).focus();
}

demarrer().catch((error) => etat(String(error?.message ?? error), "erreur"));
