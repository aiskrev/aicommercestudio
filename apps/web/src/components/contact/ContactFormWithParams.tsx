"use client";

import { useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";

import { ContactForm } from "@/components/contact/ContactForm";

/**
 * Pre-fills the form from the URL. Bulgarian URLs use `?usluga=<service key>&tip=oferta`, English
 * URLs `?service=<service key>&type=quote` (see `localizeSearch`); both are accepted.
 */
export function ContactFormWithParams(
  props: Omit<ComponentProps<typeof ContactForm>, "initialService" | "initialInquiry">,
) {
  const searchParams = useSearchParams();
  const service = searchParams.get("usluga") ?? searchParams.get("service") ?? "";
  const quote = searchParams.get("tip") === "oferta" || searchParams.get("type") === "quote";
  return <ContactForm {...props} initialService={service} initialInquiry={quote ? "quote" : "contact"} />;
}
