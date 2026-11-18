import { describe, expect, it } from "vitest";

import { securityTxt, validContact, validExpires } from "@/lib/security-txt";

const NOW = new Date("2026-11-18T10:00:00Z");

describe("validContact", () => {
  it("accepts a mailto or https URI and nothing else", () => {
    expect(validContact("mailto:security@example.com")).toBe("mailto:security@example.com");
    expect(validContact(" https://example.com/security ")).toBe("https://example.com/security");
    for (const bad of [undefined, "", "security@example.com", "http://example.com", "javascript:alert(1)", "mailto:a b@x.io", "mailto:x@y"]) {
      expect(validContact(bad)).toBeNull();
    }
  });
  it("refuses control characters and markup", () => {
    expect(validContact("mailto:a@b.io\nContact: mailto:evil@x.io")).toBeNull();
    expect(validContact("https://example.com/<x>")).toBeNull();
  });
});

describe("validExpires", () => {
  it("needs a future date within a year and normalises it", () => {
    expect(validExpires("2027-06-30", NOW)).toBe("2027-06-30T00:00:00Z");
    expect(validExpires("2027-06-30T12:30:00+02:00", NOW)).toBe("2027-06-30T10:30:00Z");
  });
  it("refuses past, distant, malformed or missing dates", () => {
    for (const bad of [undefined, "", "yesterday", "2026-11-17", "2026-11-18T09:00:00Z", "2028-01-01", "2027-02-30x"]) {
      expect(validExpires(bad, NOW)).toBeNull();
    }
  });
});

describe("securityTxt", () => {
  it("is not published without an approved contact and a valid expiry", () => {
    expect(securityTxt({}, NOW)).toBeNull();
    expect(securityTxt({ contact: "mailto:security@example.com" }, NOW)).toBeNull();
    expect(securityTxt({ expires: "2027-06-30" }, NOW)).toBeNull();
    expect(securityTxt({ contact: "mailto:security@example.com", expires: "2026-01-01" }, NOW)).toBeNull();
  });
  it("renders the RFC 9116 fields with a trailing newline", () => {
    const body = securityTxt(
      { contact: "mailto:security@example.com", expires: "2027-06-30", canonical: "https://example.com/.well-known/security.txt" },
      NOW,
    );
    expect(body).toBe(
      [
        "Contact: mailto:security@example.com",
        "Expires: 2027-06-30T00:00:00Z",
        "Preferred-Languages: bg, en",
        "Canonical: https://example.com/.well-known/security.txt",
        "",
      ].join("\n"),
    );
  });
  it("leaves out a canonical URL that is not https", () => {
    const body = securityTxt({ contact: "mailto:s@example.com", expires: "2027-06-30", canonical: "http://localhost:3000/x" }, NOW);
    expect(body).not.toContain("Canonical");
  });
});
