import { Suspense } from "react";

import { ContactForm } from "@/components/contact/ContactForm";
import { ContactFormWithParams } from "@/components/contact/ContactFormWithParams";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Icon } from "@/components/ui/Icon";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { contactFormProps } from "@/lib/contact-form-props";
import { buildMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[locale]/kontakti">) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  return buildMetadata({
    locale,
    title: dict.contact.metaTitle,
    description: dict.contact.metaDescription,
    path: routes.contact,
  });
}

export default async function ContactPage({ params }: PageProps<"/[locale]/kontakti">) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);

  const formProps = contactFormProps(locale);

  return (
    <>
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: dict.nav.contact, path: href(routes.contact) },
        ]}
      />
      <div className="relative overflow-hidden">
        <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <Container className="relative grid gap-12 py-14 sm:py-20 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <Eyebrow>{dict.contact.eyebrow}</Eyebrow>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.1] sm:text-5xl">{dict.contact.title}</h1>
            <p className="mt-6 text-lg leading-relaxed text-slate-400">{dict.contact.lead}</p>

            <div className="mt-10 grid gap-5">
              <section className="card rounded-2xl p-6" aria-labelledby="next-steps-title">
                <h2 id="next-steps-title" className="text-lg font-semibold">
                  {dict.contact.nextTitle}
                </h2>
                <ol className="mt-4 grid gap-3">
                  {dict.contact.nextSteps.map((step, index) => (
                    <li key={step} className="flex gap-3 text-slate-300">
                      <span className="font-display text-sm font-semibold text-cyan-300">{index + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </section>

              <section className="card rounded-2xl p-6" aria-labelledby="direct-title">
                <h2 id="direct-title" className="text-lg font-semibold">
                  {dict.contact.directTitle}
                </h2>
                {site.contactEmail || site.contactPhone ? (
                  <ul className="mt-4 grid gap-2">
                    {site.contactEmail && (
                      <li>
                        <a href={`mailto:${site.contactEmail}`} className="inline-flex items-center gap-2 text-cyan-300">
                          <Icon name="mail" className="h-4 w-4" />
                          {site.contactEmail}
                        </a>
                      </li>
                    )}
                    {site.contactPhone && (
                      <li>
                        <a href={`tel:${site.contactPhone.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 text-cyan-300">
                          <Icon name="phone" className="h-4 w-4" />
                          {site.contactPhone}
                        </a>
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="mt-3 text-slate-400">{dict.contact.directPending}</p>
                )}
              </section>

              <section className="flex gap-3 rounded-2xl border border-white/[0.07] p-5" aria-labelledby="privacy-note-title">
                <Icon name="lock" className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
                <div>
                  <h2 id="privacy-note-title" className="font-semibold">
                    {dict.contact.privacyTitle}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">{dict.contact.privacyText}</p>
                </div>
              </section>
            </div>
          </div>

          <div>
            <Suspense fallback={<ContactForm {...formProps} />}>
              <ContactFormWithParams {...formProps} />
            </Suspense>
          </div>
        </Container>
      </div>
    </>
  );
}
