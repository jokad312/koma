import { beforeEach, describe, expect, it, vi } from "vitest";
import { causeErreur, ErreurLectureCatalogue, journaliserLectureImpossible, lectureNommee } from "@/modules/catalogue/journal";

// Bug A2 : journal d'un échec de lecture du catalogue. Un seul format : « [catalogue] <contexte> (<lecture>) : <Nom>: <message> ».

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const derniereLigne = () => vi.mocked(console.error).mock.calls.at(-1)?.join(" ");

describe("causeErreur", () => {
  it("nom et message de l'erreur", () => {
    expect(causeErreur(new Error("Lecture des univers impossible."))).toBe("Error: Lecture des univers impossible.");
    expect(causeErreur(new TypeError("fetch failed"))).toBe("TypeError: fetch failed");
  });

  it("une seule ligne, 200 caractères de message au plus", () => {
    const cause = causeErreur(new Error(`ligne 1\nligne 2\r\n${"x".repeat(500)}`));
    expect(cause).not.toMatch(/[\r\n]/);
    expect(cause.startsWith("Error: ligne 1 ligne 2 ")).toBe(true);
    expect(cause.length).toBe("Error: ".length + 200);
  });

  it("valeur citée masquée (comme pour la fusion du Panier)", () => {
    const cause = causeErreur(new Error('invalid input syntax for type uuid: "pas-un-uuid"'));
    expect(cause).toBe('Error: invalid input syntax for type uuid: "…"');
    expect(cause).not.toContain("pas-un-uuid");
  });

  it("UUID, guillemets simples, guillemet double non fermé, forme =(…) et adresse : masqués", () => {
    const id = "0f1e2d3c-4b5a-4968-8776-655443322110";
    const cas: Array<[string, string]> = [
      [`aucun univers ${id}`, "Error: aucun univers …"],
      ["invalid input value for enum famille_produit: 'TEST_ valeur'", "Error: invalid input value for enum famille_produit: '…'"],
      ["invalid input value for enum famille_produit: 'TEST_ valeur sans fin", "Error: invalid input value for enum famille_produit: '…'"],
      ["echec pour test-a2.client@example.invalid ici", "Error: echec pour … ici"],
      ["echec pour +243 970 000 000 ici", "Error: echec pour … ici"],
      ["echec pour 0970-00.00.00 ici", "Error: echec pour … ici"],
      ["code 22P02 ligne 123456", "Error: code 22P02 ligne 123456"],
      ['invalid input syntax for type uuid: "TEST_ valeur sans fin', 'Error: invalid input syntax for type uuid: "…"'],
      ["Key (slug)=(test-secret) already exists.", "Error: Key (slug)=(…) already exists."],
      ["Key (slug)=(test-secret sans fin", "Error: Key (slug)=(…)"],
      ["request to https://exemple.invalid/rest/v1/rpc?p_univers=x failed", "Error: request to … failed"],
    ];
    for (const [message, attendu] of cas) expect(causeErreur(new Error(message))).toBe(attendu);
  });

  it("cause Supabase : code et message (assaini), un seul niveau, jamais details ni hint", () => {
    const supabase = {
      code: "22P02",
      message: 'invalid input syntax for type uuid: "TEST_ valeur"',
      details: "TEST_ détail test-a2@example.invalid",
      hint: "TEST_ indice",
    };
    const cause = causeErreur(new Error("Lecture du catalogue impossible.", { cause: supabase }));
    expect(cause).toBe('Error: Lecture du catalogue impossible. (code=22P02 message=invalid input syntax for type uuid: "…")');
    expect(cause).not.toContain("TEST_");
    expect(cause).not.toContain("example.invalid");
    expect(causeErreur(new Error("Lecture impossible.", { cause: { code: "", message: "TypeError: fetch failed" } }))).toBe(
      "Error: Lecture impossible. (code=? message=TypeError: fetch failed)",
    );
    const profonde = new Error("niveau 1", { cause: new Error("niveau 2", { cause: { code: "TEST_3", message: "TEST_ niveau 3" } }) });
    expect(causeErreur(profonde)).toBe("Error: niveau 1 (code=? message=niveau 2)");
    expect(causeErreur(new Error("sans cause objet", { cause: "TEST_ texte" }))).toBe("Error: sans cause objet");
  });

  it("erreur sans message : son nom ; autre chose qu'une Error : « erreur inconnue », jamais la valeur", () => {
    expect(causeErreur(new RangeError(""))).toBe("RangeError");
    expect(causeErreur("https://exemple.invalid/fr/vetements?univers=00000000-0000-4000-8000-000000000001")).toBe("erreur inconnue");
    expect(causeErreur({ adresse: "rue TEST_" })).toBe("erreur inconnue");
    expect(causeErreur(null)).toBe("erreur inconnue");
  });
});

describe("lectureNommee", () => {
  it("réussite : valeur inchangée", async () => {
    await expect(lectureNommee("univers", Promise.resolve([1, 2]))).resolves.toEqual([1, 2]);
  });

  it("échec : l'erreur dit quelle lecture a échoué et garde sa cause", async () => {
    const origine = new Error("Lecture des tranches de prix impossible.");
    const e = await lectureNommee("tranches", Promise.reject(origine)).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErreurLectureCatalogue);
    expect((e as ErreurLectureCatalogue).lecture).toBe("tranches");
    expect((e as ErreurLectureCatalogue).cause).toBe(origine);
    expect(Object.prototype.hasOwnProperty.call(e, "cause")).toBe(true);
  });

  it("journal : la cause Supabase gardée par la lecture apparaît", async () => {
    const origine = new Error("Lecture des univers impossible.", { cause: { code: "PGRST301", message: "JWT expired" } });
    const e = await lectureNommee("univers", Promise.reject(origine)).catch((x: unknown) => x);
    journaliserLectureImpossible("lecture impossible", e);
    expect(derniereLigne()).toBe("[catalogue] lecture impossible (univers) : Error: Lecture des univers impossible. (code=PGRST301 message=JWT expired)");
  });
});

describe("journaliserLectureImpossible", () => {
  it.each(["produits", "univers", "tranches"] as const)("lecture %s nommée, avec la cause", async (lecture) => {
    const e = await lectureNommee(lecture, Promise.reject(new Error("Lecture impossible."))).catch((x: unknown) => x);
    journaliserLectureImpossible("lecture impossible", e);
    expect(derniereLigne()).toBe(`[catalogue] lecture impossible (${lecture}) : Error: Lecture impossible.`);
  });

  it("erreur non nommée : même format, sans lecture", () => {
    journaliserLectureImpossible("voir plus : lecture impossible", new Error("Lecture du catalogue impossible."));
    expect(derniereLigne()).toBe("[catalogue] voir plus : lecture impossible : Error: Lecture du catalogue impossible.");
  });

  it("aucune adresse, aucun paramètre de requête, aucun identifiant", async () => {
    const id = "00000000-0000-4000-8000-000000000001";
    const e = await lectureNommee("produits", Promise.reject(new Error(`echec pour l'univers : "${id}"`))).catch((x: unknown) => x);
    journaliserLectureImpossible("lecture impossible", e);
    const ligne = derniereLigne() ?? "";
    expect(ligne).not.toContain(id);
    expect(ligne).not.toMatch(/https?:|\?univers=|\/fr\//);
    expect(vi.mocked(console.error).mock.calls.at(-1)).toHaveLength(1);
  });
});
