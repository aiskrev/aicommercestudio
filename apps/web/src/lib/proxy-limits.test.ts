import { describe, expect, it } from "vitest";

import {
  bodyLimitFor,
  DEFAULT_UPLOAD_BYTES,
  isUploadRoute,
  MAX_BODY_BYTES,
  MAX_WEBHOOK_BYTES,
  readLimitedBody,
  uploadLimit,
} from "./proxy-limits";

const ID = "3f2b8c1e-9d4a-4b6f-8a7e-1c2d3e4f5a6b";
const OCTET = "application/octet-stream";

describe("the proxy's request-size policy", () => {
  it("recognises exactly the four upload routes", () => {
    expect(isUploadRoute("POST", ["projects", ID, "documents"])).toBe(true);
    expect(isUploadRoute("POST", ["projects", ID, "documents", ID, "versions"])).toBe(true);
    expect(isUploadRoute("POST", ["admin", "projects", ID, "documents"])).toBe(true);
    expect(isUploadRoute("POST", ["admin", "projects", ID, "documents", ID, "versions"])).toBe(true);
  });

  it("does not widen anything else near them", () => {
    expect(isUploadRoute("GET", ["projects", ID, "documents"])).toBe(false);
    expect(isUploadRoute("PATCH", ["projects", ID, "documents"])).toBe(false);
    expect(isUploadRoute("POST", ["projects", "not-a-uuid", "documents"])).toBe(false);
    expect(isUploadRoute("POST", ["projects", ID, "documents", ID, "versions", "1", "publish"])).toBe(false);
    expect(isUploadRoute("POST", ["projects", ID, "documents", ID, "approvals"])).toBe(false);
    expect(isUploadRoute("POST", ["projects", ID, "approvals", ID, "decision"])).toBe(false);
    expect(isUploadRoute("POST", ["public", "leads"])).toBe(false);
    expect(isUploadRoute("POST", ["admin", "admin", "projects", ID, "documents"])).toBe(false);
  });

  it("gives an octet-stream upload the upload limit, and every other body the small cap", () => {
    const path = ["projects", ID, "documents"];
    expect(bodyLimitFor("POST", path, OCTET, {})).toBe(DEFAULT_UPLOAD_BYTES);
    expect(bodyLimitFor("POST", path, `${OCTET}; charset=binary`, {})).toBe(DEFAULT_UPLOAD_BYTES);
    expect(bodyLimitFor("POST", path, "application/json", {})).toBe(MAX_BODY_BYTES);
    expect(bodyLimitFor("POST", path, "multipart/form-data; boundary=x", {})).toBe(MAX_BODY_BYTES);
    expect(bodyLimitFor("POST", path, null, {})).toBe(MAX_BODY_BYTES);
    expect(bodyLimitFor("POST", ["public", "leads"], OCTET, {})).toBe(MAX_BODY_BYTES);
    expect(bodyLimitFor("POST", ["billing", "stripe", "webhook"], "application/json", {})).toBe(MAX_WEBHOOK_BYTES);
  });

  it("follows the API's PROJECT_UPLOAD_MAX_BYTES within the API's own bounds", () => {
    expect(uploadLimit({})).toBe(DEFAULT_UPLOAD_BYTES);
    expect(uploadLimit({ PROJECT_UPLOAD_MAX_BYTES: "5242880" })).toBe(5 * 1024 * 1024);
    expect(uploadLimit({ PROJECT_UPLOAD_MAX_BYTES: "999999999999" })).toBe(50 * 1024 * 1024);
    expect(uploadLimit({ PROJECT_UPLOAD_MAX_BYTES: "banana" })).toBe(DEFAULT_UPLOAD_BYTES);
    expect(uploadLimit({ PROJECT_UPLOAD_MAX_BYTES: "10" })).toBe(DEFAULT_UPLOAD_BYTES);
  });
});

function post(body: BodyInit, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/x", { method: "POST", body, headers, duplex: "half" } as RequestInit);
}

describe("reading a limited body", () => {
  it("returns the bytes of a body within the limit", async () => {
    const body = await readLimitedBody(post(new Uint8Array(1000).fill(7)), 2000);
    expect(body?.byteLength).toBe(1000);
    expect(new Uint8Array(body!)[999]).toBe(7);
  });

  it("accepts a body that is exactly the limit and refuses one byte more", async () => {
    expect((await readLimitedBody(post(new Uint8Array(512)), 512))?.byteLength).toBe(512);
    expect(await readLimitedBody(post(new Uint8Array(513)), 512)).toBeNull();
  });

  it("refuses on the declared length without reading", async () => {
    expect(await readLimitedBody(post("x", { "content-length": "999999" }), 1024)).toBeNull();
  });

  it("stops a stream that is longer than it claimed or has no length at all", async () => {
    let produced = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        produced += 1024;
        controller.enqueue(new Uint8Array(1024));
        if (produced >= 1024 * 1024) controller.close();
      },
    });
    expect(await readLimitedBody(post(stream), 8 * 1024)).toBeNull();
    expect(produced).toBeLessThan(64 * 1024); // gave up long before the end
  });

  it("returns an empty body for a request without one", async () => {
    const request = new Request("http://localhost/api/x", { method: "POST" });
    expect((await readLimitedBody(request, 10))?.byteLength).toBe(0);
  });
});
