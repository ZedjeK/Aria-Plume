# Composants tiers

Les fichiers des moteurs sont copiés sans modification. Seuls les modèles de traduction sont recompressés en gzip ; leur empreinte SHA-256 d'origine est vérifiée après décompression. Le thésaurus anglais est converti depuis WordNet par un script du dépôt, de façon reproductible.

| Composant | Version | Licence | Dossier |
|---|---|---|---|
| Grammalecte (moteur + dictionnaire) | 2.3.0 | GPL-3.0 | `engines/grammalecte/` |
| Harper (harper.js, binaire slim) | 2.10.0 | Apache-2.0 (voir `engines/harper/LICENSE`) | `engines/harper/` |
| Bergamot Translator | 0.4.9 | MPL-2.0 | `engines/bergamot/` |
| Modèles de traduction fr→en et en→fr | 2.0 | MPL-2.0 | `models/` |
| Thésaurus français de Grammalecte | 2.3.0 | GPL-3.0 | `engines/grammalecte/fr/thesaurus*_data.json` |
| WordNet (synonymes anglais, converti par `tools/build-thesaurus-en.mjs`) | 3.1 | licence WordNet (Princeton, voir `data/LICENSE-WordNet.txt`) | `data/thesaurus-en.json.gz` |

Provenance, empreintes et textes complets des licences : `LICENCES-TIERS.txt` à la racine du dépôt.
Comme l'extension embarque Grammalecte, l'extension prise comme un tout est diffusée selon les termes de la GPL-3.0.
