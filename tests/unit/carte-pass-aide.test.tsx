// @vitest-environment jsdom
// Story 7.11 : sur la carte Pass de l'aide d'un Stand, le nom reste à saisir jusqu'au début de l'Événement ; ensuite le Pass reste valable avec son
// nom provisoire et la carte le dit. Pass de test seulement.
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";
import type { PassLu } from "@/modules/evenements/pass-types";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/navigation")>()), useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/modules/evenements/candidature-actions", () => ({ nommerAideAction: vi.fn() }));
vi.mock("@/modules/evenements/annulation-actions", () => ({ demanderAnnulationPassAction: vi.fn() }));

import { CartePass } from "@/components/compte/CartePass";

function passDeTest(surcharge: Partial<PassLu> = {}): PassLu {
  return {
    id: "TEST_pass_aide",
    nomTitulaire: "TEST_ Aide du stand",
    statut: "valide",
    typeNom: "TEST_Stand",
    jeton: "0123456789abcdef0123456789abcdef0123456789abcdef",
    codeCourt: "ABCD2345",
    offert: false,
    evenement: { id: "TEST_evt", slug: "test-evt", titre: "TEST_Festival", debutLe: "2099-03-01T14:00:00Z", finLe: null, lieu: null },
    ...surcharge,
  };
}

describe("Carte Pass : nom de l'aide d'un Stand", () => {
  it("nom à saisir et encore possible : le formulaire est proposé, le Pass montre son nom provisoire et son Code QR", () => {
    rendre(<CartePass pass={passDeTest({ nomASaisir: true, aideNommable: true })} />);
    expect(screen.getByLabelText("Nom de l'aide à saisir")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 4, name: "TEST_ Aide du stand" })).toBeTruthy();
    expect(screen.getByText(/Code court/)).toBeTruthy();
  });

  it("Événement commencé (ou Pass non valide) : plus de formulaire, la carte dit que le nom n'a pas été saisi", () => {
    rendre(<CartePass pass={passDeTest({ nomASaisir: true, aideNommable: false })} />);
    expect(screen.queryByLabelText("Nom de l'aide à saisir")).toBeNull();
    expect(screen.getByText("Le nom de l'aide n'a pas été saisi. Ce Pass reste valable à l'entrée.")).toBeTruthy();
  });

  it("nom déjà saisi : ni formulaire ni mention", () => {
    rendre(<CartePass pass={passDeTest({ nomTitulaire: "TEST_Bob", nomASaisir: false, aideNommable: false })} />);
    expect(screen.queryByLabelText("Nom de l'aide à saisir")).toBeNull();
    expect(screen.queryByText(/n'a pas été saisi/)).toBeNull();
  });
});
