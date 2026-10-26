// node tests/node/smoke.mjs : le moteur Aria tourne-t-il sous Node ? Vérification, conjugaison,
// synonymes, traduction, en français et en anglais, avec les temps de chargement.
import { createAria } from "../../extension/core/index.js";
import { nodePlatform } from "../../extension/core/platform/node.js";

const aria = createAria(nodePlatform);
const show = (label, value) => console.log(`${label.padEnd(22)} ${value}`);
const fixes = (r, text) => r.matches.map((m) => `${text.slice(m.start, m.end)}→${m.suggestions[0] ?? "?"}`).join(" | ");
let failures = 0;
const expect = (label, ok) => {
    if (!ok) {
        failures += 1;
        console.log(`ÉCHEC : ${label}`);
    }
};

try {
    const fr = "Les enfant sont partit a la plage et sa c'est bien passé.";
    const rFr = await aria.check({ text: fr, lang: "fr", repetitions: 30 });
    show(`check fr (${rFr.loadMs.toFixed(0)} ms)`, fixes(rFr, fr));
    expect("fr : « a » → « à »", rFr.matches.some((m) => fr.slice(m.start, m.end) === "a" && m.suggestions[0] === "à"));

    const formal = "On va pas au coiffeur.";
    const rFormal = await aria.check({ text: formal, lang: "fr", formal: true });
    show("check fr soigné", fixes(rFormal, formal));
    expect("fr soigné : quelque chose de signalé", rFormal.matches.length > 0);

    const en = "Your welcome, I'd rather walk then drive. The server crashed and the server rebooted.";
    const rEn = await aria.check({ text: en, lang: "en", repetitions: 30, dialect: "british" });
    show(`check en (${rEn.loadMs.toFixed(0)} ms)`, fixes(rEn, en));
    expect("en : then → than", rEn.matches.some((m) => en.slice(m.start, m.end) === "then" && m.suggestions[0] === "than"));
    expect("en : répétition de server", rEn.matches.some((m) => m.rule === "aria_repetition"));

    const conj = await aria.conjugate({ verb: "prendre" });
    show("conjugate prendre", JSON.stringify(conj).slice(0, 120));
    expect("conjugaison : « prendre » reconnu", JSON.stringify(conj).includes("prenons"));

    const synFr = await aria.synonyms({ word: "rapide", lang: "fr" });
    show("synonyms fr rapide", synFr.groups?.[0]?.words.slice(0, 6).join(", "));
    expect("synonymes fr", synFr.groups?.length > 0);

    const synEn = await aria.synonyms({ word: "servers", lang: "en" });
    show("synonyms en servers", synEn.groups?.map((g) => g.words.join(", ")).join(" ; "));
    expect("synonymes en", synEn.groups?.length > 0);

    const trFr = await aria.translate({ text: "Le pare-feu bloque les connexions entrantes.", from: "fr", to: "en" });
    show(`translate fr→en (${trFr.engineMs.toFixed(0)} ms)`, trFr.text);
    expect("traduction fr→en", /firewall/i.test(trFr.text));

    const trHtml = await aria.translate({ text: "Redémarre à <b>trois heures</b>.", from: "fr", to: "en", html: true });
    show("translate html", trHtml.text);
    expect("traduction html : balise conservée", trHtml.text.includes("<b>"));

    const trEn = await aria.translate({ text: "Remember to check the backups.", from: "en", to: "fr" });
    show("translate en→fr", trEn.text);
    expect("traduction en→fr", /sauvegardes/i.test(trEn.text));

    show("info", JSON.stringify(aria.info()));
} catch (error) {
    failures += 1;
    console.log("ERREUR :", error);
} finally {
    await aria.close();
}
console.log(failures ? `${failures} échec(s)` : "tout est bon");
process.exitCode = failures ? 1 : 0;
