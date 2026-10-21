import { ATTRIBUT_THEME, CLE_STOCKAGE_THEME } from "./theme";

// Script inline placé dans <head> : il pose l'attribut avant le premier rendu, donc sans flash.
// Sans JavaScript, ou si le stockage est inaccessible, le thème crème s'applique.
export const SCRIPT_THEME = `try{if(window.localStorage.getItem(${JSON.stringify(CLE_STOCKAGE_THEME)})==="dark"){document.documentElement.setAttribute(${JSON.stringify(ATTRIBUT_THEME)},"dark")}}catch(e){}`;
