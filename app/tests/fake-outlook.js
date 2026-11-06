// Faux Office.js pour le complément Outlook (chargé à la place de celui de Microsoft).
// Imite la partie de l'API Mailbox utilisée par le panneau : un message ouvert, en lecture ou en
// rédaction, et ses fonctions à rappel (asyncResult.status / value / error).
//
// Message : window.__fakeOutlook = { mode: "read" (par défaut) ou "compose", subject, body,
//     bodyError: "message" (body.getAsync échoue) }
// Rempli par ce script : log (appels faits).

(() => {
    const mail = window.__fakeOutlook ?? { mode: "read", subject: "", body: "" };
    mail.log = [];
    window.__fakeOutlook = mail;

    const Status = { Succeeded: "succeeded", Failed: "failed" };
    const Coercion = { Text: "text", Html: "html" };

    // Comme Office : options facultatives avant le rappel, rappel appelé plus tard.
    function answer(args, produce) {
        const callback = args.find((arg) => typeof arg === "function");
        setTimeout(() => {
            try {
                callback?.({ status: Status.Succeeded, value: produce() });
            } catch (error) {
                callback?.({ status: Status.Failed, error: { name: "GenericResponseError", message: error.message, code: 9020 } });
            }
        }, 0);
    }

    const body = {
        getAsync(coercion, ...rest) {
            mail.log.push(`body.getAsync:${coercion}`);
            answer(rest, () => {
                if (mail.bodyError) {
                    throw new Error(mail.bodyError);
                }
                if (coercion !== Coercion.Text) {
                    throw new Error("Faux Outlook : seul le texte est imité");
                }
                return mail.body;
            });
        },
    };

    // En lecture, subject est une chaîne ; en rédaction, un objet avec getAsync/setAsync.
    const item = mail.mode === "compose"
        ? {
            itemType: "message",
            body,
            subject: {
                getAsync: (...args) => answer(args, () => mail.subject),
                setAsync: (value, ...args) => answer(args, () => {
                    mail.subject = value;
                }),
            },
        }
        : { itemType: "message", body, subject: mail.subject };

    window.Office = {
        HostType: { Word: "Word", Outlook: "Outlook" },
        AsyncResultStatus: Status,
        CoercionType: Coercion,
        context: {
            requirements: { isSetSupported: (name, version) => name === "Mailbox" && Number(version) <= 1.3 },
            mailbox: { item },
        },
        onReady(callback) {
            const info = { host: "Outlook", platform: "PC" };
            setTimeout(() => callback?.(info), 0);
            return Promise.resolve(info);
        },
    };
})();
