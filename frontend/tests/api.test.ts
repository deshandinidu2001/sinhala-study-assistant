import { afterEach, describe, expect, it, vi } from "vitest";
import { getHealth } from "@/lib/api";

afterEach(() => vi.unstubAllGlobals());

describe("health API", () => {
  it("recognizes a migrated backend", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ status: "ok", database: "ok" })));
    await expect(getHealth()).resolves.toEqual({ status: "ok", database: "ok" });
  });

  it("rejects an unavailable backend with a Sinhala error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(getHealth()).rejects.toThrow("සේවාවට සම්බන්ධ විය නොහැක.");
  });

  it("rejects malformed readiness responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ status: "ok" })));
    await expect(getHealth()).rejects.toThrow("සේවාවේ තත්ත්වය තහවුරු කළ නොහැක.");
  });
});
