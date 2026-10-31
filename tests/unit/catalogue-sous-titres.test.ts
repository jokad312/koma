import { describe, expect, it } from "vitest";
import { formaterInstant, lireAnnonceSousTitres, lireInstant, objetSousTitresValide, verifierWebVtt } from "@/modules/catalogue/sous-titres";

const octets = (texte: string) => new TextEncoder().encode(texte);
const KIT = "00000000-0000-4000-8000-000000000001";

describe("verifierWebVtt", () => {
  it("accepte un WebVTT minimal, avec BOM, CRLF ou texte après WEBVTT", () => {
    expect(verifierWebVtt(octets("WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nBonjour\n"))).toBe(true);
    expect(verifierWebVtt(octets("﻿WEBVTT - Kit\r\n\r\n1\r\n00:00:01.000 --> 00:00:04.000 align:start\r\nBonjour\r\n"))).toBe(true);
    expect(verifierWebVtt(octets("WEBVTT\n\n01:59:59.000 --> 02:00:00.500\nFin\n"))).toBe(true);
    // Heures facultatives (norme WebVTT) : mm:ss.mmm, même mélangé à la forme longue.
    expect(verifierWebVtt(octets("WEBVTT\n\n00:01.000 --> 00:04.000\nCourt\n"))).toBe(true);
    expect(verifierWebVtt(octets("WEBVTT\n\n59:58.000 --> 01:00:02.000\nMixte\n"))).toBe(true);
  });

  it.each([
    ["sans en-tête WEBVTT", "00:00:01.000 --> 00:00:04.000\nBonjour\n"],
    ["en-tête collé à un autre mot", "WEBVTTX\n\n00:00:01.000 --> 00:00:04.000\nA\n"],
    ["aucune réplique", "WEBVTT\n\nNOTE rien\n"],
    ["minutes hors de 00-59 en forme courte", "WEBVTT\n\n75:01.000 --> 75:04.000\nA\n"],
    ["secondes hors de 00-59", "WEBVTT\n\n00:00:61.000 --> 00:01:04.000\nA\n"],
    ["millisecondes sur deux chiffres", "WEBVTT\n\n00:01.00 --> 00:04.00\nA\n"],
    ["fin avant le début", "WEBVTT\n\n00:00:04.000 --> 00:00:01.000\nA\n"],
    ["fin égale au début", "WEBVTT\n\n00:00:04.000 --> 00:00:04.000\nA\n"],
    ["une réplique valide puis une mal formée", "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nA\n\n00:00:03 --> 00:00:04\nB\n"],
    ["fichier vide", ""],
  ])("refuse : %s", (_cas, texte) => {
    expect(verifierWebVtt(octets(texte))).toBe(false);
  });

  it("refuse un contenu qui n'est pas de l'UTF-8 valide ou contient un octet nul", () => {
    const enTete = octets("WEBVTT\n\n00:00:01.000 --> 00:00:04.000\n");
    expect(verifierWebVtt(new Uint8Array([...enTete, 0xff, 0xfe, 0x0a]))).toBe(false);
    expect(verifierWebVtt(new Uint8Array([...enTete, 0x00]))).toBe(false);
  });

  it("refuse au-delà de 1 Mo", () => {
    const gros = octets(`WEBVTT\n\n00:00:01.000 --> 00:00:04.000\n${"a".repeat(1_048_576)}\n`);
    expect(verifierWebVtt(gros)).toBe(false);
  });
});

describe("annonce et objet des sous-titres", () => {
  it("extension .vtt et 1 Mo au plus", () => {
    expect(lireAnnonceSousTitres("fr.vtt", 10)).toEqual({ ok: true });
    expect(lireAnnonceSousTitres("FR.VTT", 1_048_576)).toEqual({ ok: true });
    expect(lireAnnonceSousTitres("fr.srt", 10)).toEqual({ ok: false, erreur: "format_invalide" });
    expect(lireAnnonceSousTitres("fr.vtt", 0)).toEqual({ ok: false, erreur: "format_invalide" });
    expect(lireAnnonceSousTitres("fr.vtt", 1_048_577)).toEqual({ ok: false, erreur: "fichier_trop_lourd" });
  });

  it("objet <produit>/sous-titres/<uuid>.vtt seulement", () => {
    expect(objetSousTitresValide(`${KIT}/sous-titres/11111111-1111-4111-8111-111111111111.vtt`, KIT)).toBe(true);
    expect(objetSousTitresValide(`${KIT}/11111111-1111-4111-8111-111111111111.vtt`, KIT)).toBe(false);
    expect(objetSousTitresValide(`${KIT}/sous-titres/../x.vtt`, KIT)).toBe(false);
    expect(objetSousTitresValide(`${KIT}/sous-titres/11111111-1111-4111-8111-111111111111.txt`, KIT)).toBe(false);
  });
});

describe("instants des chapitres", () => {
  it.each([
    ["0:00", 0],
    ["2:30", 150],
    ["12:00", 720],
    ["90:00", 5400],
    ["1:02:03", 3723],
    [" 10:05 ", 605],
  ])("lit %s", (saisie, secondes) => {
    expect(lireInstant(saisie)).toBe(secondes);
  });

  it.each(["", "150", "2:60", "1:2", "1:02:60", "-1:00", "a:bc", "1:00:00:00"])("refuse « %s »", (saisie) => {
    expect(lireInstant(saisie)).toBeNull();
  });

  it("affiche m:ss sous une heure, h:mm:ss au-delà", () => {
    expect(formaterInstant(0)).toBe("0:00");
    expect(formaterInstant(150)).toBe("2:30");
    expect(formaterInstant(3723)).toBe("1:02:03");
    expect(lireInstant(formaterInstant(5399))).toBe(5399);
  });
});
