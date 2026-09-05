// @vitest-environment node
//
// jose's WebCrypto build checks `key instanceof Uint8Array` against the
// realm's own Uint8Array constructor; jsdom's globals live in a different
// realm than Node's `TextEncoder` output, which makes that check fail
// spuriously. This file needs no DOM, so it runs under the plain Node
// environment instead of the project-wide jsdom default.
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.CP_MOCK_DATA = "1";

interface FakeCookie {
  value: string;
}

const cookieJar = new Map<string, FakeCookie>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieJar.get(name),
    getAll: () => [...cookieJar.entries()].map(([name, { value }]) => ({ name, value })),
    set: (name: string, value: string) => {
      cookieJar.set(name, { value });
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

vi.mock("next-intl/server", () => ({
  getLocale: async () => "en",
}));

vi.mock("@/i18n/navigation", () => ({
  redirect: () => {
    throw new Error("redirect() should not be called in these tests");
  },
}));

const { getDb } = await import("@/lib/data");
const { resetMockStore } = await import("@/lib/data/mockDb");
const { SUNDAY_PIN } = await import("@/lib/data/mockSeed");
const { verifyPinAndCreateSession, getSundaySession, clearSundaySession, PinError, SUNDAY_SESSION_COOKIE } =
  await import("@/lib/auth/sunday-session");

const IP = "203.0.113.7";

beforeEach(() => {
  cookieJar.clear();
  resetMockStore();
});

describe("verifyPinAndCreateSession / getSundaySession", () => {
  it("signs a session on a correct PIN and getSundaySession reads it back", async () => {
    const session = await verifyPinAndCreateSession(SUNDAY_PIN, IP);
    expect(session.pinVersion).toBe(1);
    expect(cookieJar.has(SUNDAY_SESSION_COOKIE)).toBe(true);

    const read = await getSundaySession();
    expect(read).toEqual({ pinVersion: 1 });
  });

  it("rejects an incorrect PIN and sets no session", async () => {
    await expect(verifyPinAndCreateSession("00000", IP)).rejects.toMatchObject({ code: "invalid" });
    expect(cookieJar.has(SUNDAY_SESSION_COOKIE)).toBe(false);
    expect(await getSundaySession()).toBeNull();
  });

  it("rejects with PinError instances carrying a typed code", async () => {
    try {
      await verifyPinAndCreateSession("wrong", IP);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(PinError);
      expect((error as InstanceType<typeof PinError>).code).toBe("invalid");
    }
  });

  it("getSundaySession returns null with no cookie set", async () => {
    expect(await getSundaySession()).toBeNull();
  });

  it("clearSundaySession removes the cookie", async () => {
    await verifyPinAndCreateSession(SUNDAY_PIN, IP);
    expect(await getSundaySession()).not.toBeNull();
    await clearSundaySession();
    expect(cookieJar.has(SUNDAY_SESSION_COOKIE)).toBe(false);
    expect(await getSundaySession()).toBeNull();
  });

  it("invalidates an existing session once the PIN is rotated (version bump)", async () => {
    await verifyPinAndCreateSession(SUNDAY_PIN, IP);
    expect(await getSundaySession()).toEqual({ pinVersion: 1 });

    const db = getDb();
    await db.setSundayPin("some-new-bcrypt-hash", 5);

    // Old cookie still carries v: 1, but settings.sundayPinVersion is now 2.
    expect(await getSundaySession()).toBeNull();
  });

  it("not_configured when the PIN hash is empty", async () => {
    const db = getDb();
    await db.setSundayPin("", 5);
    await expect(verifyPinAndCreateSession(SUNDAY_PIN, IP)).rejects.toMatchObject({ code: "not_configured" });
  });
});

describe("PIN rate limiting", () => {
  it("locks out after 5 recent failures, even with the correct PIN", async () => {
    for (let i = 0; i < 5; i++) {
      await expect(verifyPinAndCreateSession("00000", IP)).rejects.toMatchObject({ code: "invalid" });
    }

    await expect(verifyPinAndCreateSession(SUNDAY_PIN, IP)).rejects.toMatchObject({ code: "rate_limited" });
    expect(await getSundaySession()).toBeNull();
  });

  it("rate limiting is scoped per hashed IP", async () => {
    for (let i = 0; i < 5; i++) {
      await expect(verifyPinAndCreateSession("00000", IP)).rejects.toMatchObject({ code: "invalid" });
    }
    // A different IP is not affected by the first IP's failures.
    const session = await verifyPinAndCreateSession(SUNDAY_PIN, "198.51.100.20");
    expect(session.pinVersion).toBe(1);
  });

  it("a successful attempt does not count toward the failure window", async () => {
    await verifyPinAndCreateSession(SUNDAY_PIN, IP);
    for (let i = 0; i < 4; i++) {
      await expect(verifyPinAndCreateSession("00000", IP)).rejects.toMatchObject({ code: "invalid" });
    }
    // Only 4 failures recorded — still under the limit of 5.
    const session = await verifyPinAndCreateSession(SUNDAY_PIN, IP);
    expect(session.pinVersion).toBe(1);
  });
});
