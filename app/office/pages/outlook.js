// Aria Plume — complément Outlook : le panneau branché sur le message ouvert.
/* global Office */

import { createPanel } from "./panel.js";
import { createOutlookHost } from "./outlook-host.js";

const root = document.getElementById("app");
Office.onReady((info) => {
    if (info.host && info.host !== Office.HostType.Outlook) {
        root.textContent = "Ce panneau est fait pour Outlook.";
        return;
    }
    createPanel({ host: createOutlookHost(), root }).catch((error) => {
        root.textContent = `Aria Plume n'a pas pu démarrer : ${error?.message ?? error}`;
    });
});
