import { describe, expect, it } from "vitest";
import { traiterLot } from "@/modules/envois/service";
import { creerTestDependancesEnvois, TEST_ENVOI } from "../doubles/TEST_dependances-envois";

describe("traiterLot", () => {
  it("n'envoie rien quand la boîte est vide", async () => {
    const { deps, appels } = creerTestDependancesEnvois();
    expect(await traiterLot(deps)).toEqual({ reserves: 0, envoyes: 0, ignores: 0, reessais: 0, erreurBase: false });
    expect(appels.envoyes).toHaveLength(0);
  });

  it("ne pose « envoyé » qu'avec l'identifiant renvoyé par le prestataire", async () => {
    const { deps, appels } = creerTestDependancesEnvois({ envois: [TEST_ENVOI("e1"), TEST_ENVOI("e2")] });
    const bilan = await traiterLot(deps);
    expect(bilan).toMatchObject({ reserves: 2, envoyes: 2, reessais: 0 });
    expect(appels.marquesEnvoyes).toEqual([
      { id: "e1", idPrestataire: "TEST_resend_e1" },
      { id: "e2", idPrestataire: "TEST_resend_e2" },
    ]);
  });

  it("un refus du prestataire devient un échec, jamais un envoi", async () => {
    const { deps, appels } = creerTestDependancesEnvois({ envois: [TEST_ENVOI("e1")], envoyer: () => ({ erreur: "Resend TEST_refus", idPrestataire: null }) });
    const bilan = await traiterLot(deps);
    expect(bilan).toMatchObject({ envoyes: 0, reessais: 1 });
    expect(appels.marquesEnvoyes).toHaveLength(0);
    expect(appels.echecs).toEqual([{ id: "e1", erreur: "Resend TEST_refus" }]);
  });

  it("une réponse sans identifiant n'est pas un envoi", async () => {
    const { deps, appels } = creerTestDependancesEnvois({ envois: [TEST_ENVOI("e1")], envoyer: () => ({ erreur: null, idPrestataire: null }) });
    const bilan = await traiterLot(deps);
    expect(bilan.envoyes).toBe(0);
    expect(appels.marquesEnvoyes).toHaveLength(0);
    expect(appels.echecs).toHaveLength(1);
  });

  it("une exception du prestataire n'arrête pas le lot", async () => {
    const { deps, appels } = creerTestDependancesEnvois({
      envois: [TEST_ENVOI("e1"), TEST_ENVOI("e2")],
      envoyer: (id) => (id === "e1" ? "exception" : { erreur: null, idPrestataire: "TEST_resend_ok" }),
    });
    const bilan = await traiterLot(deps);
    expect(bilan).toMatchObject({ envoyes: 1, reessais: 1 });
    expect(appels.echecs.map((e) => e.id)).toEqual(["e1"]);
    expect(appels.marquesEnvoyes.map((e) => e.id)).toEqual(["e2"]);
  });

  it("un envoi sans objet est ignoré sans appel au prestataire", async () => {
    const { deps, appels } = creerTestDependancesEnvois({ envois: [TEST_ENVOI("e1")], rendu: () => ({ statut: "ignorer", raison: "commande non payée" }) });
    const bilan = await traiterLot(deps);
    expect(bilan).toMatchObject({ ignores: 1, envoyes: 0 });
    expect(appels.envoyes).toHaveLength(0);
    expect(appels.ignores).toEqual([{ id: "e1", raison: "commande non payée" }]);
  });

  it("une lecture à refaire plus tard devient un échec sans appel au prestataire", async () => {
    const { deps, appels } = creerTestDependancesEnvois({ envois: [TEST_ENVOI("e1")], rendu: () => ({ statut: "reessayer", raison: "lecture impossible" }) });
    const bilan = await traiterLot(deps);
    expect(bilan.reessais).toBe(1);
    expect(appels.envoyes).toHaveLength(0);
  });

  it("une panne de réservation est signalée et rien n'est traité", async () => {
    const { deps, appels } = creerTestDependancesEnvois({ erreurReservation: "TEST_panne" });
    const bilan = await traiterLot(deps);
    expect(bilan.erreurBase).toBe(true);
    expect(appels.envoyes).toHaveLength(0);
  });

  it("une panne d'enregistrement après envoi est signalée", async () => {
    const { deps } = creerTestDependancesEnvois({ envois: [TEST_ENVOI("e1")], erreurMarquage: true });
    const bilan = await traiterLot(deps);
    expect(bilan).toMatchObject({ envoyes: 0, erreurBase: true });
  });
});
