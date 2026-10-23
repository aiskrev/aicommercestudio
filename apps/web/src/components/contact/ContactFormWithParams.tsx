"use client";

import { useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";

import { ContactForm } from "@/components/contact/ContactForm";

/** Pre-selects the service from `?usluga=<key>` (used by "Request a quote" links on service pages). */
export function ContactFormWithParams(props: Omit<ComponentProps<typeof ContactForm>, "initialService">) {
  const searchParams = useSearchParams();
  return <ContactForm {...props} initialService={searchParams.get("usluga") ?? ""} />;
}
