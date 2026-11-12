"use client";

import Link from "next/link";
import { useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { buttonClass, cx } from "@/components/ui/primitives";
import type { FutureContent } from "@/content/v5-types";
import type { ServiceKey } from "@/content/types";
import type { PackageKey } from "@/lib/configurator";
import type { CarePlanKey } from "@/lib/care-plans";
import { recommendService, type SelectorGoal, type SelectorNeed } from "@/lib/service-selector";

export interface SelectorLinks {
  /** Service page and quote form per service (already localized). */
  services: Partial<Record<ServiceKey, { title: string; href: string; quote: string }>>;
  packages: Record<PackageKey, { name: string; href: string }>;
  carePlans: Partial<Record<CarePlanKey, { name: string; href: string }>>;
  careSeparate: string;
}

/**
 * Interactive service selector (Future Commerce, "functional interactivity"): goal + needs → the package, its
 * service, related services and the care plan, by lib/service-selector.ts (the configurator's shared model).
 * Contextual call to action: the quote form preselected with the recommended service (`?usluga=<key>&tip=oferta`).
 * Pure client state; nothing is stored or sent, and the configurator flag stays off.
 */
export function ServiceSelector({ text, links, testId = "service-selector" }: { text: FutureContent["selector"]; links: SelectorLinks; testId?: string }) {
  const [goal, setGoal] = useState<SelectorGoal>("website");
  const [needs, setNeeds] = useState<SelectorNeed[]>([]);
  const result = recommendService({ goal, needs });
  const service = links.services[result.service];
  const pkg = result.packageKey ? links.packages[result.packageKey] : null;
  const care = result.carePlan ? links.carePlans[result.carePlan] : null;

  const toggle = (need: SelectorNeed) => setNeeds((list) => (list.includes(need) ? list.filter((item) => item !== need) : [...list, need]));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-10" data-testid={testId}>
      <form className="grid content-start gap-6" onSubmit={(event) => event.preventDefault()}>
        <fieldset>
          <legend className="t-label">{text.goalLabel}</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {text.goals.map((item) => (
              <label key={item.key} className="fc-choice">
                <input type="radio" name={`${testId}-goal`} value={item.key} checked={goal === item.key} onChange={() => setGoal(item.key)} data-testid={`selector-goal-${item.key}`} />
                <span className="items-start">
                  <span className="fc-choice-mark mt-0.5" aria-hidden="true" />
                  <span className="grid gap-0.5">
                    <span className="font-semibold">{item.label}</span>
                    <span className="text-xs font-normal text-fg-muted">{item.hint}</span>
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="t-label">{text.needsLabel}</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {text.needs.map((item) => (
              <label key={item.key} className="fc-choice">
                <input type="checkbox" value={item.key} checked={needs.includes(item.key)} onChange={() => toggle(item.key)} data-testid={`selector-need-${item.key}`} />
                <span>
                  <span className="fc-choice-mark" aria-hidden="true">
                    {needs.includes(item.key) && <Icon name="check" className="h-3 w-3" />}
                  </span>
                  {item.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {needs.length > 0 && (
          <button type="button" className="link justify-self-start text-sm" onClick={() => setNeeds([])}>
            {text.reset}
          </button>
        )}
      </form>

      <section aria-labelledby={`${testId}-result`} className="fc-cta self-start p-6 sm:p-7" data-testid="selector-result">
        <p id={`${testId}-result`} className="t-eyebrow">
          {text.resultLabel}
        </p>
        <div aria-live="polite" className="mt-4 grid gap-4">
          {result.adjusted && <p className="alert alert-info text-body-sm">{text.adjusted}</p>}
          <dl className="spec-list">
            <div>
              <dt>{text.packageLabel}</dt>
              <dd data-testid="selector-package">
                {pkg ? (
                  <Link href={pkg.href} className="link">
                    {pkg.name}
                  </Link>
                ) : (
                  text.noPackage
                )}
              </dd>
            </div>
            <div>
              <dt>{text.serviceLabel}</dt>
              <dd data-testid="selector-service">{service?.title}</dd>
            </div>
            {result.related.length > 0 && (
              <div>
                <dt>{text.relatedLabel}</dt>
                <dd>
                  <ul className="flex flex-wrap gap-2 pt-1">
                    {result.related.map((key) => {
                      const related = links.services[key];
                      return related ? (
                        <li key={key}>
                          <Link href={related.href} className="badge badge-accent min-h-9 hover:border-brand">
                            {related.title}
                          </Link>
                        </li>
                      ) : null;
                    })}
                  </ul>
                </dd>
              </div>
            )}
            {needs.includes("maintenance") && (
              <div>
                <dt>{text.careLabel}</dt>
                <dd>
                  {care ? (
                    <Link href={care.href} className="link">
                      {care.name}
                    </Link>
                  ) : (
                    links.careSeparate
                  )}
                </dd>
              </div>
            )}
          </dl>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {service && (
            <Link href={service.quote} className={cx(buttonClass("primary", "md"))} data-testid="selector-quote">
              <span className="btn-label">{text.quote}</span>
              <Icon name="arrowRight" className="btn-icon h-4 w-4" />
            </Link>
          )}
          {service && (
            <Link href={service.href} className={buttonClass("secondary", "md")}>
              <span className="btn-label">{text.open}</span>
            </Link>
          )}
        </div>
        <p className="mt-5 text-xs leading-relaxed text-fg-subtle">{text.disclaimer}</p>
      </section>
    </div>
  );
}
