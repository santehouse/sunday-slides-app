import { describe, expect, it } from "vitest";
import { buildScriptureDrafts } from "@/lib/sunday/scripture";

const VERSES = [
  { verse: 38, text: "Et mon juste vivra par la foi; mais, s’il se retire, mon âme ne prend pas plaisir en lui." },
  { verse: 39, text: "Nous, nous ne sommes pas de ceux qui se retirent pour se perdre, mais de ceux qui ont la foi pour sauver leur âme." },
  { verse: 1, text: "Or la foi est une ferme assurance des choses qu’on espère, une démonstration de celles qu’on ne voit pas." },
];

describe("buildScriptureDrafts", () => {
  it("makes one bare-text slide per verse, titled with its reference", () => {
    const drafts = buildScriptureDrafts("HEB", 10, VERSES.slice(0, 2), 1);
    expect(drafts.map((d) => d.reference)).toEqual(["Hébreux 10:38", "Hébreux 10:39"]);
    expect(drafts[0]?.text).toBe(VERSES[0]!.text);
    expect(drafts[0]?.verses).toEqual([38]);
  });

  it("groups verses per slide with their numbers, and names the range", () => {
    const drafts = buildScriptureDrafts("HEB", 10, VERSES.slice(0, 2), 2);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.reference).toBe("Hébreux 10:38-39");
    expect(drafts[0]?.text).toBe(`38 ${VERSES[0]!.text}\n39 ${VERSES[1]!.text}`);
  });

  it("puts the remainder on its own slide and rejects unknown books", () => {
    expect(buildScriptureDrafts("HEB", 10, VERSES, 2)).toHaveLength(2);
    expect(buildScriptureDrafts("NOPE", 10, VERSES, 1)).toEqual([]);
    expect(buildScriptureDrafts("HEB", 10, [], 1)).toEqual([]);
  });
});
