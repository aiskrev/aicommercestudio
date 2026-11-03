"use client";

import { useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";

import { ContactForm } from "@/components/contact/ContactForm";

/**
 * Pre-fills the form from the URL. Bulgarian URLs use `?usluga=<service key>&tip=oferta&sreshta=<workshop key>`,
 * English URLs `?service=<service key>&type=quote&workshop=<workshop key>` (see `localizeSearch`); both are accepted.
 * An unknown workshop key is ignored.
 */
export function ContactFormWithParams({
  workshopTitles = {},
  ...props
}: Omit<ComponentProps<typeof ContactForm>, "initialService" | "initialInquiry" | "initialWorkshop"> & {
  workshopTitles?: Record<string, string>;
}) {
  const searchParams = useSearchParams();
  const service = searchParams.get("usluga") ?? searchParams.get("service") ?? "";
  const quote = searchParams.get("tip") === "oferta" || searchParams.get("type") === "quote";
  const workshopKey = searchParams.get("sreshta") ?? searchParams.get("workshop") ?? "";
  const workshop = Object.hasOwn(workshopTitles, workshopKey) ? { key: workshopKey, title: workshopTitles[workshopKey] } : undefined;
  return <ContactForm {...props} initialService={service} initialInquiry={quote ? "quote" : "contact"} initialWorkshop={workshop} />;
}
