import { ButtonLink, Container } from "@/components/ui/primitives";
import { defaultLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { routes } from "@/lib/routes";

export default function NotFound() {
  const dict = getDictionary(defaultLocale);
  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <p className="font-display text-7xl font-semibold text-gradient">404</p>
      <h1 className="mt-6 text-3xl font-semibold">{dict.notFound.title}</h1>
      <p className="mt-3 max-w-md text-slate-400">{dict.notFound.lead}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href={routes.home}>{dict.notFound.back}</ButtonLink>
        <ButtonLink href={routes.services} variant="secondary">
          {dict.common.allServices}
        </ButtonLink>
      </div>
    </Container>
  );
}
