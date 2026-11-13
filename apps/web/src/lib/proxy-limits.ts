/**
 * Request-size policy of the same-origin API proxy (`app/api/[...path]/route.ts`).
 *
 * Every API route keeps the small form-sized cap, except two kinds of request that legitimately carry more:
 *  - the Stripe webhook (its signature covers the exact bytes of an event, which can be larger than a form);
 *  - the raw-body document upload of a project (`POST …/projects/{id}/documents` and `…/documents/{id}/versions`,
 *    customer side and staff side), sent as `application/octet-stream`.
 * The API stays the authority: it authenticates, applies its own exact limit (`PROJECT_UPLOAD_MAX_BYTES`), checks the
 * file's type and content and rate-limits uploads. This proxy only has to agree with it and must never read more than
 * the limit into memory.
 */

export const MAX_BODY_BYTES = 64 * 1024;
/** A Stripe event can be larger than a form; its signature covers these exact bytes. */
export const MAX_WEBHOOK_BYTES = 1024 * 1024;
export const DEFAULT_UPLOAD_BYTES = 10 * 1024 * 1024;
const MIN_UPLOAD_BYTES = 1024;
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The API's `PROJECT_UPLOAD_MAX_BYTES` (same default and same bounds); read at runtime so one image fits every environment. */
export function uploadLimit(env: Record<string, string | undefined> = process.env): number {
  const configured = Number(env.PROJECT_UPLOAD_MAX_BYTES);
  if (!Number.isInteger(configured) || configured < MIN_UPLOAD_BYTES) return DEFAULT_UPLOAD_BYTES;
  return Math.min(configured, MAX_UPLOAD_BYTES);
}

/** `projects/{id}/documents`, `projects/{id}/documents/{id}/versions`, each also under `admin/`. */
export function isUploadRoute(method: string, path: readonly string[]): boolean {
  if (method !== "POST") return false;
  const rest = path[0] === "admin" ? path.slice(1) : path;
  if (rest[0] !== "projects" || !UUID.test(rest[1] ?? "") || rest[2] !== "documents") return false;
  if (rest.length === 3) return true;
  return rest.length === 5 && UUID.test(rest[3]) && rest[4] === "versions";
}

function isOctetStream(contentType: string | null): boolean {
  return (contentType ?? "").split(";")[0].trim().toLowerCase() === "application/octet-stream";
}

/** The largest body this request may carry. */
export function bodyLimitFor(
  method: string,
  path: readonly string[],
  contentType: string | null,
  env: Record<string, string | undefined> = process.env,
): number {
  if (path.join("/") === "billing/stripe/webhook") return MAX_WEBHOOK_BYTES;
  if (isUploadRoute(method, path) && isOctetStream(contentType)) return Math.max(MAX_BODY_BYTES, uploadLimit(env));
  return MAX_BODY_BYTES;
}

/**
 * Reads the body, giving up as soon as it is larger than `limit` (null): the declared length is checked first, then the
 * stream, so a client that lies about its length or sends chunked data cannot make the server hold more than `limit`.
 */
export async function readLimitedBody(request: Request, limit: number): Promise<ArrayBuffer | null> {
  const declared = request.headers.get("content-length");
  if (declared !== null && /^\d+$/.test(declared) && Number(declared) > limit) {
    await request.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!request.body) return new ArrayBuffer(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}
