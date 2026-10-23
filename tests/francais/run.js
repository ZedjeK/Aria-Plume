// node tests/francais/run.js [-v] : passe le corpus dans workers/fr_worker.js (Grammalecte + règles
// d'Aria) et compte les fautes trouvées et les fausses alertes. Sort en erreur à la moindre fausse alerte
// (les fautes ratées sont seulement listées).
const fs = require("fs"), vm = require("vm"), pathm = require("path");
const root = pathm.resolve(__dirname, "../../extension") + "/";
const toPath = (u) => root + u.replace("ext://x/", "");
class XHR { open(m, u) { this.u = u; } overrideMimeType() {} send() { this.responseText = fs.readFileSync(toPath(this.u), "utf8"); } }
const out = [];
const ctx = { console: { log() {}, error: console.error, warn() {} }, XMLHttpRequest: XHR, URL, performance, location: "ext://x/workers/fr_worker.js" };
ctx.self = ctx;
ctx.postMessage = (m) => out.push(m);
ctx.importScripts = (...files) => { for (const f of files) vm.runInContext(fs.readFileSync(toPath(f), "utf8"), ctx, { filename: f }); };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(root + "workers/fr_worker.js", "utf8"), ctx);
ctx.self.onmessage({ data: { id: 1, cmd: "init" } });
(async () => {
  const { corpus } = await import(pathm.join(__dirname, "corpus.mjs"));
  let hit = 0, miss = 0, fa = 0, wrongFix = 0, ok = 0, first = 0;
  const verbose = process.argv.includes("-v");
  for (const [text, bad, fix, opts] of corpus) {
    // 4e élément facultatif : { formal: true } pour le réglage « Français écrit soigné ».
    ctx.self.onmessage({ data: { id: 2, cmd: "check", payload: { text, formal: !!opts?.formal } } });
    const ms = out.at(-1).result.matches;
    const show = ms.map((m) => `«${text.slice(m.start, m.end)}»→${m.suggestions.slice(0, 3).join("|")} [${m.rule}]`).join("  ");
    if (bad) {
      const after = /\p{L}$/u.test(bad) ? "(?![\\p{L}])" : "";
      const idx = text.search(new RegExp(`(?<![\\p{L}])${bad}${after}`, "u"));
      const m = ms.find((m) => m.start <= idx && m.end >= idx + bad.length);
      if (!m) { miss++; console.log(`RATÉ     ${text}   ${show}`); }
      else if (!m.suggestions.some((s) => s.includes(fix))) { wrongFix++; console.log(`MAUVAISE ${text}   ${show}`); }
      else { hit++; if (m.suggestions[0].replace("’", "'").includes(fix)) first++; else console.log(`2e RANG   ${text}   ${show}`); if (verbose) console.log(`OK       ${text}   ${show}`); }
    } else {
      const homo = ms.filter((m) => m.kind !== "orthographe" && m.kind !== "typographie" && !/apostrophe|typo/.test(m.rule));
      if (homo.length) { fa++; console.log(`FAUSSE   ${text}   ${show}`); }
      else { ok++; if (verbose) console.log(`OK       ${text}`); }
    }
  }
  console.log(`\nfautes détectées ${hit}/${hit + miss + wrongFix} (ratées ${miss}, mauvaise correction ${wrongFix}, bonne correction en 1re position ${first}) | phrases correctes sans alerte ${ok}/${ok + fa}`);
  process.exitCode = fa > 0 ? 1 : 0;
})();
