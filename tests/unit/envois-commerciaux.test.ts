// Story 9.4 : la boîte d'envoi soumet chaque Email commercial à email_commercial_autorise ; un email lié à un achat n'y passe jamais.
import { describe, expect, it } from "vitest";
import { traiterLot } from "@/modules/envois/service";
import { creerTestDependancesEnvois, TEST_ENVOI } from "../doubles/TEST_dependances-envois";

describe("Emails commerciaux dans la boîte d'envoi", () => {
  it("un email lié à un achat n'est jamais soumis à la règle", async () => {
    const { deps, appels } = creerTestDependancesEnvois({ envois: [TEST_ENVOI("TEST_1", "commande_payee")], autorisation: () => ({ autorise: false, motif: "sans_consentement" }) });
    await traiterLot(deps);
    expect(deps.autorisationCommerciale).not.toHaveBeenCalled();
    expect(appels.envoyes).toHaveLength(1);
  });

  it("refus : « ignore » avec son motif, sans rendu ni envoi", async () => {
    const { deps, appels } = creerTestDependancesEnvois({ envois: [TEST_ENVOI("TEST_2", "relance")], autorisation: () => ({ autorise: false, motif: "ecart_2_jours" }) });
    const bilan = await traiterLot(deps);
    expect(appels.ignores).toEqual([{ id: "TEST_2", raison: "ecart_2_jours" }]);
    expect(deps.rendre).not.toHaveBeenCalled();
    expect(appels.envoyes).toHaveLength(0);
    expect(bilan.ignores).toBe(1);
  });

  it("autorisé : l'email suit le chemin normal", async () => {
    const { deps, appels } = creerTestDependancesEnvois({ envois: [TEST_ENVOI("TEST_3", "nouveau_produit")] });
    await traiterLot(deps);
    expect(deps.autorisationCommerciale).toHaveBeenCalledWith("TEST_3");
    expect(appels.envoyes).toHaveLength(1);
  });

  it("vérification impossible : nouvel essai plus tard, jamais un envoi sans vérification", async () => {
    const { deps, appels } = creerTestDependancesEnvois({ envois: [TEST_ENVOI("TEST_4", "rappel_kit")], autorisation: () => ({ erreur: "TEST_panne" }) });
    const bilan = await traiterLot(deps);
    expect(appels.envoyes).toHaveLength(0);
    expect(appels.echecs).toEqual([{ id: "TEST_4", erreur: "vérification commerciale impossible" }]);
    expect(bilan.reessais).toBe(1);
  });
});
