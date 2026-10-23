import { getContent } from "@/content";
import { type Locale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { routes } from "@/lib/routes";

/** Props shared by every inquiry form (contact page, AI advisor consultation, AI Managed Services). */
export function contactFormProps(locale: Locale) {
  const dict = getDictionary(locale);
  const { services } = getContent(locale);
  return {
    labels: dict.form,
    messages: dict.validation,
    inquiry: dict.inquiry,
    aiLabels: dict.aiManagedForm,
    locale,
    services: [
      ...services.map((s) => ({ value: s.key, label: s.shortTitle })),
      { value: "other", label: dict.form.serviceOther },
    ],
    privacyHref: localizePath(locale, routes.privacy),
    nextSteps: dict.contact.nextSteps,
  };
}
