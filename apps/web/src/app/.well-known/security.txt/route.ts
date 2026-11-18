import { absoluteUrl } from "@/lib/site";
import { securityTxt } from "@/lib/security-txt";

/**
 * /.well-known/security.txt (RFC 9116). Answers 404 until SECURITY_CONTACT and SECURITY_TXT_EXPIRES are set on the
 * server (owner decision, see docs/audits/SECURITY_OWNER_ACTIONS_2026-11-18.md). Read at run time, so one image fits
 * every environment; the answer depends on the clock (expiry), hence never prerendered.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const body = securityTxt({
    contact: process.env.SECURITY_CONTACT,
    expires: process.env.SECURITY_TXT_EXPIRES,
    canonical: absoluteUrl("/.well-known/security.txt"),
  });
  if (body === null) return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
