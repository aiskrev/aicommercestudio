"use client";

import { useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";

import { ContactForm } from "@/components/contact/ContactForm";

/**
 * Pre-fills the form from the URL: `?usluga=<service key>` selects the service and
 * `?tip=oferta` opens the quote-request variant (used by "Поискай оферта" links).
 */
export function ContactFormWithParams(
  props: Omit<ComponentProps<typeof ContactForm>, "initialService" | "initialInquiry">,
) {
  const searchParams = useSearchParams();
  return (
    <ContactForm
      {...props}
      initialService={searchParams.get("usluga") ?? ""}
      initialInquiry={searchParams.get("tip") === "oferta" ? "quote" : "contact"}
    />
  );
}
