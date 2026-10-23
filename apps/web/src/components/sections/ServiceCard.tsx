import Link from "next/link";

import { Icon } from "@/components/ui/Icon";
import { IconBadge } from "@/components/ui/primitives";
import type { Service } from "@/content/types";

export function ServiceCard({ service, href, cta }: { service: Service; href: string; cta: string }) {
  return (
    <Link href={href} className="glass glass-hover group flex h-full flex-col rounded-2xl p-6 sm:p-7">
      <IconBadge name={service.icon} />
      <h2 className="mt-5 text-xl font-semibold">{service.shortTitle}</h2>
      <p className="mt-2 leading-relaxed text-slate-400">{service.summary}</p>
      <ul className="mt-5 grid flex-1 content-start gap-2 text-sm text-slate-400">
        {service.capabilities.slice(0, 4).map((capability) => (
          <li key={capability.title} className="flex gap-2">
            <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
            {capability.title}
          </li>
        ))}
      </ul>
      <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-300">
        {cta}
        <Icon name="arrowRight" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  );
}
