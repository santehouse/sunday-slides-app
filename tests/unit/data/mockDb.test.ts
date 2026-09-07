import { beforeEach, describe, expect, it } from "vitest";
import { createMockDb, resetMockStore } from "@/lib/data/mockDb";
import type { Db } from "@/lib/data/types";

let db: Db;

beforeEach(() => {
  resetMockStore();
  db = createMockDb();
});

describe("mockDb.reorderSlides", () => {
  it("persists a new sort order for the given sunday only", async () => {
    const sunday = await db.getSundayByDate("2026-08-16");
    expect(sunday).not.toBeNull();

    const before = await db.listSlidesForSunday(sunday!.id);
    expect(before.length).toBeGreaterThan(1);
    const reversedIds = [...before].reverse().map((s) => s.id);

    const after = await db.reorderSlides(sunday!.id, reversedIds);

    expect(after.map((s) => s.id)).toEqual(reversedIds);
    // sortOrder is 0..n-1 in the new order.
    after.forEach((slide, index) => expect(slide.sortOrder).toBe(index));

    // listSlidesForSunday reflects the persisted order too.
    const relisted = await db.listSlidesForSunday(sunday!.id);
    expect(relisted.map((s) => s.id)).toEqual(reversedIds);
  });

  it("does not touch slides belonging to a different sunday", async () => {
    const sundayA = await db.getSundayByDate("2026-08-16");
    const sundayB = await db.getSundayByDate("2026-08-23");
    const beforeB = await db.listSlidesForSunday(sundayB!.id);

    const slidesA = await db.listSlidesForSunday(sundayA!.id);
    await db.reorderSlides(sundayA!.id, [...slidesA].reverse().map((s) => s.id));

    const afterB = await db.listSlidesForSunday(sundayB!.id);
    expect(afterB).toEqual(beforeB);
  });
});

describe("mockDb.replaceSlidesForSunday", () => {
  it("deletes existing slides and inserts the new set in order", async () => {
    const sunday = await db.getSundayByDate("2026-08-16");
    const templates = await db.listTemplates({ status: "published" });
    const templateId = templates[0]!.id;

    const before = await db.listSlidesForSunday(sunday!.id);
    expect(before.length).toBeGreaterThan(0);

    const replaced = await db.replaceSlidesForSunday(sunday!.id, [
      { sundayId: sunday!.id, templateId, headline: "ONE" },
      { sundayId: sunday!.id, templateId, headline: "TWO" },
    ]);

    expect(replaced).toHaveLength(2);
    expect(replaced[0]!.headline).toBe("ONE");
    expect(replaced[0]!.sortOrder).toBe(0);
    expect(replaced[1]!.headline).toBe("TWO");
    expect(replaced[1]!.sortOrder).toBe(1);

    const after = await db.listSlidesForSunday(sunday!.id);
    expect(after.map((s) => s.headline)).toEqual(["ONE", "TWO"]);
    // None of the old slide ids survive.
    const beforeIds = new Set(before.map((s) => s.id));
    expect(after.some((s) => beforeIds.has(s.id))).toBe(false);
  });

  it("replacing with an empty array clears the sunday's slides", async () => {
    const sunday = await db.getSundayByDate("2026-08-16");
    const replaced = await db.replaceSlidesForSunday(sunday!.id, []);
    expect(replaced).toEqual([]);
    expect(await db.listSlidesForSunday(sunday!.id)).toEqual([]);
  });

  it("leaves other sundays' slides untouched", async () => {
    const sundayA = await db.getSundayByDate("2026-08-16");
    const sundayB = await db.getSundayByDate("2026-08-23");
    const beforeB = await db.listSlidesForSunday(sundayB!.id);

    await db.replaceSlidesForSunday(sundayA!.id, []);

    expect(await db.listSlidesForSunday(sundayB!.id)).toEqual(beforeB);
  });
});

describe("mockDb.getNextSunday", () => {
  it("returns the seeded demo deck when the coming Sunday does not exist yet", async () => {
    const current = await db.getNextSunday("2026-09-07", { create: true });
    expect(current?.serviceDate).toBe("2026-09-06");
    expect((await db.listSlidesForSunday(current!.id)).length).toBeGreaterThan(0);
  });

  it("ignores a Sunday created further ahead — the current service is the coming Sunday only", async () => {
    await db.getOrCreateSundayByDate("2027-01-10");
    const current = await db.getNextSunday("2026-09-07", { create: true });
    expect(current?.serviceDate).toBe("2026-09-06");
    expect(await db.getNextSunday("2026-09-07", { create: false })).toBeNull();
  });

  it("returns the coming Sunday itself once it exists", async () => {
    const created = await db.getOrCreateSundayByDate("2026-09-13");
    const current = await db.getNextSunday("2026-09-07", { create: true });
    expect(current?.id).toBe(created.id);
    expect((await db.getNextSunday("2026-09-13", { create: false }))?.id).toBe(created.id);
  });
});
