import Link from "next/link";

import { JsonLd } from "@/components/seo/JsonLd";
import { Icon } from "@/components/ui/Icon";
import { Container } from "@/components/ui/primitives";
import { getDictionary } from "@/i18n";
import { defaultLocale, splitLocale } from "@/i18n/config";
import { breadcrumbJsonLd } from "@/lib/seo";

export function Breadcrumbs({ items }: { items: { name: string; path: string }[] }) {
  // Every item path is a localized URL, so the locale is the first path segment.
  const locale = splitLocale(items[0]?.path ?? "")?.locale ?? defaultLocale;
  return (
    <Container className="pt-6">
      <JsonLd data={breadcrumbJsonLd(items)} />
      <nav aria-label={getDictionary(locale).ui.breadcrumbs}>
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-slate-400">
          {items.map((item, index) => {
            const last = index === items.length - 1;
            return (
              <li key={item.path} className="inline-flex items-center gap-1.5">
                {last ? (
                  <span aria-current="page" className="text-slate-300">
                    {item.name}
                  </span>
                ) : (
                  <>
                    <Link href={item.path} className="hover:text-white">
                      {item.name}
                    </Link>
                    <Icon name="chevronRight" className="h-3.5 w-3.5" />
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </Container>
  );
}
