import { afterEach, describe, expect, it } from "vitest";

import { GET } from "@/app/api/account-flag/route";

describe("GET /api/account-flag", () => {
  const original = process.env.CUSTOMER_ACCOUNTS_ENABLED;
  afterEach(() => {
    if (original === undefined) delete process.env.CUSTOMER_ACCOUNTS_ENABLED;
    else process.env.CUSTOMER_ACCOUNTS_ENABLED = original;
  });

  it("answers false by default and true only when the flag is exactly \"true\"", async () => {
    delete process.env.CUSTOMER_ACCOUNTS_ENABLED;
    expect(await GET().json()).toEqual({ enabled: false });
    process.env.CUSTOMER_ACCOUNTS_ENABLED = "yes";
    expect(await GET().json()).toEqual({ enabled: false });
    process.env.CUSTOMER_ACCOUNTS_ENABLED = "true";
    expect(await GET().json()).toEqual({ enabled: true });
  });

  it("is never cached", () => {
    expect(GET().headers.get("Cache-Control")).toBe("no-store");
  });
});
