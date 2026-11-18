import { afterEach, describe, expect, it } from "vitest";

import { GET } from "@/app/.well-known/security.txt/route";

describe("GET /.well-known/security.txt", () => {
  const saved = { contact: process.env.SECURITY_CONTACT, expires: process.env.SECURITY_TXT_EXPIRES };
  afterEach(() => {
    for (const [key, value] of [["SECURITY_CONTACT", saved.contact], ["SECURITY_TXT_EXPIRES", saved.expires]] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("answers 404 and is not cached while no contact is approved", async () => {
    delete process.env.SECURITY_CONTACT;
    delete process.env.SECURITY_TXT_EXPIRES;
    const response = GET();
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("serves plain UTF-8 text once both values are valid", async () => {
    process.env.SECURITY_CONTACT = "mailto:security@example.com";
    const inSixMonths = new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10);
    process.env.SECURITY_TXT_EXPIRES = inSixMonths;
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    const text = await response.text();
    expect(text).toContain("Contact: mailto:security@example.com");
    expect(text).toContain(`Expires: ${inSixMonths}T00:00:00Z`);
  });
});
