"use server";

import { attribuerPassOffert } from "./pass-offert";
import { dependancesPassOffert } from "./pass-offert-dependances";

// « Attribuer un Pass offert » (Admin) : droit evenements.gerer vérifié par le service, puis par la fonction SQL.
export async function attribuerPassOffertAction(entree: unknown) {
  return attribuerPassOffert(dependancesPassOffert(), entree);
}
