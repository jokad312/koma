import { ATTRIBUT_THEME, CLE_STOCKAGE_THEME } from "./theme";
import { SCRIPT_GARDE_TRADUCTION } from "@/lib/dom/garde-traduction";

// Script inline placé dans <head> : il pose l'attribut avant le premier rendu, donc sans flash.
// Sans JavaScript, ou si le stockage est inaccessible, le thème crème s'applique.
export const SCRIPT_THEME = `try{if(window.localStorage.getItem(${JSON.stringify(CLE_STOCKAGE_THEME)})==="dark"){document.documentElement.setAttribute(${JSON.stringify(ATTRIBUT_THEME)},"dark")}}catch(e){}`;

// Script complet de <head> : garde contre la traduction du navigateur (bug A3), puis thème. Les deux s'exécutent avant l'hydratation.
export const SCRIPT_TETE = SCRIPT_GARDE_TRADUCTION + SCRIPT_THEME;
