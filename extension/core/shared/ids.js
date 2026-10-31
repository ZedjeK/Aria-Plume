// Aria Plume — identifiants partagés entre l'extension et l'application.
//
// L'extension a un identifiant fixe grâce à la clé publique de son manifeste (champ « key ») :
// il ne dépend plus du dossier d'où elle est chargée. L'application s'en sert pour n'autoriser
// qu'elle à se connecter (native messaging, champ « allowed_origins »).

export const EXTENSION_ID = "fpgalamdbelhkacggnnglgcljhdcioca";
export const NATIVE_HOST = "fr.aria_plume.app";
