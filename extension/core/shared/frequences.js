// Aria Plume — fréquence d'usage d'un mot, en français comme en anglais.
//
// Les données (frequences-data.js) viennent du vocabulaire des modèles de traduction : chaque
// morceau a une log-probabilité apprise sur un très grand corpus. Un mot du vocabulaire (« ▁morning »)
// a la sienne ; un mot plus rare est découpé en morceaux (« tar|tes »), et sa probabilité est celle du
// meilleur découpage : plus il faut de morceaux, plus le mot est rare. Aucun modèle de langue, aucun
// appel extérieur : une table et un calcul.
//
// Script classique (sans import/export) : chargé par importScripts dans le worker français et par
// un import simple dans le worker anglais. Il dépose self.AriaFrequences.
(function () {
    const pieces = new Map();
    let longest = 1;
    for (const line of String(self.ARIA_PIECES ?? "").split("\n")) {
        const tab = line.lastIndexOf("\t");
        if (tab > 0) {
            const piece = line.slice(0, tab);
            pieces.set(piece, Number(line.slice(tab + 1)) / 10);
            longest = Math.max(longest, piece.length);
        }
    }
    const UNKNOWN_CHAR = -20;
    const cache = new Map();

    // Log-probabilité du meilleur découpage de « ▁mot » en morceaux du vocabulaire.
    function segment(text) {
        const best = new Array(text.length + 1).fill(-Infinity);
        best[0] = 0;
        for (let i = 0; i < text.length; i++) {
            if (best[i] === -Infinity) {
                continue;
            }
            for (let length = 1; length <= longest && i + length <= text.length; length++) {
                const score = pieces.get(text.slice(i, i + length));
                if (score !== undefined && best[i] + score > best[i + length]) {
                    best[i + length] = best[i] + score;
                }
            }
            if (best[i + 1] === -Infinity) {
                best[i + 1] = best[i] + UNKNOWN_CHAR;
            }
        }
        return best[text.length];
    }

    function logp(word) {
        const key = String(word);
        if (!cache.has(key)) {
            if (cache.size > 20000) {
                cache.clear();
            }
            const lower = key.toLowerCase();
            // Le vocabulaire distingue les majuscules : on garde la meilleure des deux formes.
            cache.set(key, Math.max(segment(`▁${lower}`), segment(`▁${key}`)));
        }
        return cache.get(key);
    }

    self.AriaFrequences = {
        ready: pieces.size > 0,
        logp,
        // 0 (mot rare ou inventé) … 1 (mot très courant : « the », « de », « temps »). Un mot absent du
        // vocabulaire reste sous 0,45 : son découpage en morceaux fréquents (« a|erie ») ne doit pas le
        // faire passer pour un mot courant.
        commonness(word) {
            const value = Math.min(1, Math.max(0, (logp(word) + 26) / 20));
            return this.known(word) ? value : Math.min(value, 0.45);
        },
        // Le mot entier est un morceau du vocabulaire : un mot courant.
        known(word) {
            return pieces.has(`▁${String(word).toLowerCase()}`) || pieces.has(`▁${word}`);
        },
    };
})();
