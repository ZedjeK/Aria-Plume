// Aria Plume — complément Word : le panneau branché sur Word.
/* global Office */

import { createPanel } from "./panel.js";
import { createWordHost } from "./word-host.js";

const root = document.getElementById("app");
Office.onReady((info) => {
    if (info.host && info.host !== Office.HostType.Word) {
        root.textContent = "Ce panneau est fait pour Word.";
        return;
    }
    createPanel({ host: createWordHost(), root }).catch((error) => {
        root.textContent = `Aria Plume n'a pas pu démarrer : ${error?.message ?? error}`;
    });
});
