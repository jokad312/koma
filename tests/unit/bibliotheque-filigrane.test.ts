// @vitest-environment node
import { PDFDocument } from "@cantoo/pdf-lib";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { appliquerFiligrane, masquerEmail } from "@/modules/bibliotheque/filigrane";

const POLICE = path.join(process.cwd(), "src", "fonts", "filigrane", "Barlow-Regular.ttf");

async function pdfDeTest(pages: Array<[number, number]>): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const [l, h] of pages) doc.addPage([l, h]);
  return doc.save();
}

describe("masquerEmail", () => {
  it("garde 2 caractères, « ••• », puis le domaine", () => {
    expect(masquerEmail("jonathan@gmail.com")).toBe("jo•••@gmail.com");
  });
  it("un nom très court ne révèle rien de plus", () => {
    expect(masquerEmail("a@x.org")).toBe("a•••@x.org");
  });
  it("un email sans nom ou sans arobase ne laisse rien filtrer", () => {
    expect(masquerEmail("@x.org")).toBe("•••");
    expect(masquerEmail("pasdemail")).toBe("•••");
  });
});

describe("appliquerFiligrane", () => {
  it("écrit sur chaque page, garde le nombre de pages et leur taille, et laisse l'original intact", async () => {
    const original = await pdfDeTest([[595, 842], [612, 792], [300, 300]]);
    const avant = Uint8Array.from(original);
    const police = new Uint8Array(await readFile(POLICE));
    const texte = "Acheté par jo•••@gmail.com · Commande KS-2026-000042 · TEST_site";
    const sortie = await appliquerFiligrane(original, texte, police);

    expect(original).toEqual(avant);
    expect(sortie.length).toBeGreaterThan(original.length);
    const doc = await PDFDocument.load(sortie);
    expect(doc.getPageCount()).toBe(3);
    expect(doc.getPage(0).getSize()).toEqual({ width: 595, height: 842 });
    expect(doc.getPage(1).getSize()).toEqual({ width: 612, height: 792 });
    // Chaque page a reçu un flux de contenu de plus que la page vierge de départ.
    const base = await PDFDocument.load(original);
    for (let i = 0; i < 3; i++) {
      const avantContenu = base.getPage(i).node.Contents();
      const apresContenu = doc.getPage(i).node.Contents();
      expect(apresContenu).toBeDefined();
      expect(avantContenu).toBeUndefined();
    }
  });
  it("le caractère « • » et « · » passent dans la police embarquée (aucune erreur d'encodage)", async () => {
    const police = new Uint8Array(await readFile(POLICE));
    await expect(appliquerFiligrane(await pdfDeTest([[595, 842]]), "jo•••@gmail.com · KS-2026-000001", police)).resolves.toBeInstanceOf(Uint8Array);
  });
  it("refuse un fichier qui n'est pas un PDF", async () => {
    const police = new Uint8Array(await readFile(POLICE));
    await expect(appliquerFiligrane(new Uint8Array([1, 2, 3]), "x", police)).rejects.toThrow();
  });
});
