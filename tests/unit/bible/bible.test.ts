import { describe, expect, it } from "vitest";
import { BIBLE_BOOKS, formatReference, getChapter, getVerses, isBibleBookId } from "@/lib/bible";

describe("bundled Louis Segond 1910", () => {
  it("lists the 66 books in canonical order with the right chapter counts", () => {
    expect(BIBLE_BOOKS).toHaveLength(66);
    expect(BIBLE_BOOKS[0]?.name).toBe("Genèse");
    expect(BIBLE_BOOKS[18]).toMatchObject({ id: "PSA", chapters: 150 });
    expect(BIBLE_BOOKS[65]?.name).toBe("Apocalypse");
    expect(isBibleBookId("HEB")).toBe(true);
    expect(isBibleBookId("XYZ")).toBe(false);
  });

  it("returns the Segond text with typographic apostrophes", async () => {
    const verses = await getVerses("HEB", 10, [38]);
    expect(verses).toEqual([
      { verse: 38, text: "Et mon juste vivra par la foi; mais, s’il se retire, mon âme ne prend pas plaisir en lui." },
    ]);
    const gen = await getChapter("GEN", 1);
    expect(gen?.[0]?.text).toBe("Au commencement, Dieu créa les cieux et la terre.");
    expect(gen).toHaveLength(31);
  });

  it("rejects chapters that do not exist and skips unknown verse numbers", async () => {
    expect(await getChapter("JUD", 2)).toBeNull();
    expect(await getVerses("PSA", 117, [1, 2, 3, 99])).toHaveLength(2);
  });

  it("formats references with ranges", () => {
    expect(formatReference("HEB", 10, [38])).toBe("Hébreux 10:38");
    expect(formatReference("HEB", 10, [39, 38])).toBe("Hébreux 10:38-39");
    expect(formatReference("PSA", 23, [1, 2, 3, 5])).toBe("Psaumes 23:1-3, 5");
    expect(formatReference("JHN", 3, [])).toBe("Jean 3");
  });
});
