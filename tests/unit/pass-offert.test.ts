// Story 8.5 : opération « 10 Pass gratuits ». Service d'attribution (droit, entrée, nom du titulaire jamais inventé, erreurs de la base, Événement complet,
// invalidation seulement après une réponse réelle). Faux accès nommés TEST ; rien de réel.
import { describe, expect, it, vi } from "vitest";
import { attribuerPassOffert, type DependancesPassOffert } from "@/modules/communaute/pass-offert";

const PHOTO = "00000000-0000-4000-8000-0000000000a1";
const TYPE = "00000000-0000-4000-8000-0000000000b1";
const REALISATION = "00000000-0000-4000-8000-0000000000c1";
const COMPTE = "00000000-0000-4000-8000-0000000000d1";
const AUTEUR = { type: "compte", id: "00000000-0000-4000-8000-0000000000e9", role: "admin" } as never;

function deps(surcharges: Partial<DependancesPassOffert> = {}, droit = true) {
  const invalider = vi.fn(async () => {});
  const attribuer = vi.fn(async () => ({ attribue: true, rang: 3, erreur: null as string | null }));
  const d: DependancesPassOffert = {
    exigerDroit: async () => {
      if (!droit) throw new Error("KS_DROIT_REFUSE");
      return { auteur: AUTEUR };
    },
    lireRealisation: async () => ({ realisationId: REALISATION, compteId: COMPTE, nomAffiche: null }),
    nomDuCompte: async () => "  Alice   Test ",
    attribuer,
    invalider,
    ...surcharges,
  };
  return { d, invalider, attribuer };
}

describe("attribuerPassOffert", () => {
  it("sans droit : refusé, la base n'est pas appelée", async () => {
    const { d, attribuer } = deps({}, false);
    expect(await attribuerPassOffert(d, { photoId: PHOTO, typePassId: TYPE })).toEqual({ ok: false, erreur: "non_autorise" });
    expect(attribuer).not.toHaveBeenCalled();
  });
  it("entrée invalide : identifiants mal formés ou absents", async () => {
    const { d } = deps();
    expect(await attribuerPassOffert(d, { photoId: "x", typePassId: TYPE })).toEqual({ ok: false, erreur: "entree_invalide" });
    expect(await attribuerPassOffert(d, { photoId: PHOTO })).toEqual({ ok: false, erreur: "entree_invalide" });
    expect(await attribuerPassOffert(d, null)).toEqual({ ok: false, erreur: "entree_invalide" });
  });
  it("succès : nom du Compte nettoyé, rang rendu, cache vidé une seule fois", async () => {
    const { d, invalider, attribuer } = deps();
    expect(await attribuerPassOffert(d, { photoId: PHOTO, typePassId: TYPE })).toEqual({ ok: true, rang: 3 });
    expect(attribuer).toHaveBeenCalledWith({ auteur: AUTEUR, realisationId: REALISATION, typePassId: TYPE, titulaire: "Alice Test" });
    expect(invalider).toHaveBeenCalledTimes(1);
  });
  it("sans nom de Compte : le pseudo de la Réalisation sert de titulaire", async () => {
    const { d, attribuer } = deps({ nomDuCompte: async () => null, lireRealisation: async () => ({ realisationId: REALISATION, compteId: COMPTE, nomAffiche: "TEST_Pseudo" }) });
    expect(await attribuerPassOffert(d, { photoId: PHOTO, typePassId: TYPE })).toEqual({ ok: true, rang: 3 });
    expect(attribuer).toHaveBeenCalledWith(expect.objectContaining({ titulaire: "TEST_Pseudo" }));
  });
  it("sans nom ni pseudo : « nom_requis », la base n'est pas appelée (jamais un nom inventé)", async () => {
    const { d, attribuer, invalider } = deps({ nomDuCompte: async () => null });
    expect(await attribuerPassOffert(d, { photoId: PHOTO, typePassId: TYPE })).toEqual({ ok: false, erreur: "nom_requis" });
    expect(attribuer).not.toHaveBeenCalled();
    expect(invalider).not.toHaveBeenCalled();
  });
  it("Réalisation introuvable ou lecture impossible", async () => {
    expect(await attribuerPassOffert(deps({ lireRealisation: async () => ({ erreur: "P0001 KS_REALISATION_INTROUVABLE" }) }).d, { photoId: PHOTO, typePassId: TYPE })).toEqual({ ok: false, erreur: "introuvable" });
    expect(await attribuerPassOffert(deps({ lireRealisation: async () => ({ erreur: "panne" }) }).d, { photoId: PHOTO, typePassId: TYPE })).toEqual({ ok: false, erreur: "generique" });
  });
  it.each([
    ["KS_REALISATION_NON_VALIDEE", "non_validee"],
    ["KS_KIT_NON_PAYE", "kit_non_paye"],
    ["KS_TYPE_PASS_INTROUVABLE", "type_introuvable"],
    ["KS_EVENEMENT_INDISPONIBLE", "evenement_indisponible"],
    ["KS_REALISATION_DEJA_UTILISEE", "deja_utilisee"],
    ["KS_DEJA_OFFERT", "deja_offert"],
    ["KS_OPERATION_TERMINEE", "terminee"],
    ["KS_TITULAIRE_INVALIDE", "nom_requis"],
    ["KS_DROIT_REFUSE", "non_autorise"],
    ["KS_AUTRE", "generique"],
  ])("erreur de la base %s → %s, cache non vidé", async (message, attendu) => {
    const { d, invalider } = deps({ attribuer: async () => ({ attribue: false, rang: 0, erreur: `P0001 ${message}` }) });
    expect(await attribuerPassOffert(d, { photoId: PHOTO, typePassId: TYPE })).toEqual({ ok: false, erreur: attendu });
    expect(invalider).not.toHaveBeenCalled();
  });
  it("Événement complet : rien attribué, erreur « complet », cache vidé (l'anomalie est créée par la base)", async () => {
    const { d, invalider } = deps({ attribuer: async () => ({ attribue: false, rang: 0, erreur: null }) });
    expect(await attribuerPassOffert(d, { photoId: PHOTO, typePassId: TYPE })).toEqual({ ok: false, erreur: "complet" });
    expect(invalider).toHaveBeenCalledTimes(1);
  });
  it("exception inattendue : erreur générique", async () => {
    const { d, invalider } = deps({
      attribuer: async () => {
        throw new Error("réseau");
      },
    });
    expect(await attribuerPassOffert(d, { photoId: PHOTO, typePassId: TYPE })).toEqual({ ok: false, erreur: "generique" });
    expect(invalider).not.toHaveBeenCalled();
  });
});
