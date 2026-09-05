import { describe, expect, it } from "vitest";
import { buildExportFilenames, slugifyHeadline } from "@/lib/engines/slugFilename";

describe("slugifyHeadline", () => {
  it("lowercases, strips accents, and dasherizes", () => {
    expect(slugifyHeadline("Rendez-vous de la semaine")).toBe("rendez-vous-de-la-semaine");
    expect(slugifyHeadline("Étude biblique")).toBe("etude-biblique");
    expect(slugifyHeadline("Veillée des hommes")).toBe("veillee-des-hommes");
  });

  it("collapses punctuation runs into a single dash and trims edges", () => {
    expect(slugifyHeadline("Hello, World!!!")).toBe("hello-world");
    expect(slugifyHeadline("--Leading and trailing--")).toBe("leading-and-trailing");
  });

  it("truncates to 60 characters without a trailing dash", () => {
    const longHeadline = "A".repeat(80);
    const slug = slugifyHeadline(longHeadline);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);

    const wordyHeadline = Array.from({ length: 20 }, (_, i) => `word${i}`).join(" ");
    const wordySlug = slugifyHeadline(wordyHeadline);
    expect(wordySlug.length).toBeLessThanOrEqual(60);
    expect(wordySlug.endsWith("-")).toBe(false);
  });

  it("falls back to 'slide' when nothing usable remains", () => {
    expect(slugifyHeadline("")).toBe("slide");
    expect(slugifyHeadline("!!!???")).toBe("slide");
    expect(slugifyHeadline("   ")).toBe("slide");
  });
});

describe("buildExportFilenames", () => {
  it("produces zero-padded, ordered filenames", () => {
    const filenames = buildExportFilenames([
      { headline: "Rendez-vous de la semaine" },
      { headline: "Étude biblique" },
      { headline: "Veillée des hommes" },
    ]);
    expect(filenames).toEqual([
      "01-rendez-vous-de-la-semaine.jpg",
      "02-etude-biblique.jpg",
      "03-veillee-des-hommes.jpg",
    ]);
  });

  it("gives duplicate slugs a stable -2, -3 suffix in encounter order", () => {
    const filenames = buildExportFilenames([
      { headline: "Welcome" },
      { headline: "Welcome" },
      { headline: "Welcome" },
    ]);
    expect(filenames).toEqual(["01-welcome.jpg", "02-welcome-2.jpg", "03-welcome-3.jpg"]);
  });

  it("uses 3-digit padding once there are 100+ slides", () => {
    const slides = Array.from({ length: 101 }, (_, i) => ({ headline: `Slide ${i + 1}` }));
    const filenames = buildExportFilenames(slides);
    expect(filenames[0]).toBe("001-slide-1.jpg");
    expect(filenames[99]).toBe("100-slide-100.jpg");
    expect(filenames[100]).toBe("101-slide-101.jpg");
  });

  it("returns an empty array for no slides", () => {
    expect(buildExportFilenames([])).toEqual([]);
  });
});
