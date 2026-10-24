import type { ReactNode } from "react";

import type { ServiceKey } from "@/content/types";

/**
 * Small abstract line drawing per discipline (decorative, aria-hidden). Each motif hints at the
 * shape of the work — a maintenance cycle, a crawl tree, a flow — without pretending to be data.
 */
export function ServiceMotif({ service, className }: { service: ServiceKey; className?: string }) {
  const stroke = "var(--color-brand)";
  const muted = "var(--color-line-strong)";
  const accent = "var(--color-brand-2)";
  const common = { fill: "none", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  const motifs: Record<ServiceKey, ReactNode> = {
    // update → test → release cycle
    maintenance: (
      <>
        <circle cx="60" cy="40" r="24" stroke={muted} {...common} strokeDasharray="3 5" />
        <path d="M60 16a24 24 0 0 1 23 17" stroke={stroke} {...common} />
        <path d="m80 27 3 6 6-3" stroke={stroke} {...common} />
        {[[36, 40], [60, 64], [84, 40], [60, 16]].map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x - 5} y={y - 5} width="10" height="10" rx="2.5" fill="var(--color-surface-2)" stroke={x === 60 && y === 16 ? stroke : muted} strokeWidth="1.5" />
        ))}
      </>
    ),
    // site tree: root → categories → products
    seo: (
      <>
        <path d="M60 14v12M30 38h60M30 38v10M60 38v10M90 38v10M30 58v8M90 58v8" stroke={muted} {...common} />
        <rect x="50" y="8" width="20" height="10" rx="2.5" stroke={stroke} {...common} />
        {[30, 60, 90].map((x) => <rect key={x} x={x - 9} y="46" width="18" height="10" rx="2.5" stroke={x === 60 ? stroke : muted} {...common} />)}
        {[30, 90].map((x) => <circle key={x} cx={x} cy="69" r="3" stroke={accent} {...common} />)}
      </>
    ),
    // application: UI → API → model
    ai_tools: (
      <>
        <rect x="14" y="22" width="28" height="36" rx="4" stroke={muted} {...common} />
        <path d="M20 31h16M20 38h11" stroke={muted} {...common} />
        <path d="M42 40h18M78 40h14" stroke={stroke} {...common} strokeDasharray="2 4" />
        <rect x="60" y="30" width="18" height="20" rx="4" stroke={stroke} {...common} />
        <circle cx="100" cy="40" r="9" stroke={accent} {...common} />
        <path d="m97 40 2 2 4-4" stroke={accent} {...common} />
      </>
    ),
    // connected process boxes with an approval gate
    automation: (
      <>
        {[18, 50, 82].map((x, i) => (
          <rect key={x} x={x} y="30" width="22" height="20" rx="4" stroke={i === 1 ? accent : stroke} {...common} />
        ))}
        <path d="M40 40h10M72 40h10" stroke={muted} {...common} />
        <path d="M61 22v-6M61 58v6" stroke={muted} {...common} strokeDasharray="2 3" />
      </>
    ),
    // measurement framework: events → metrics → decision (funnel)
    analytics: (
      <>
        <path d="M18 18h84l-20 22H38z" stroke={muted} {...common} />
        <path d="M38 40h44l-14 16H52z" stroke={stroke} {...common} />
        <path d="M60 56v10" stroke={accent} {...common} />
        <circle cx="60" cy="68" r="3" stroke={accent} {...common} />
      </>
    ),
    // hub and systems
    integrations: (
      <>
        <rect x="50" y="30" width="20" height="20" rx="4" stroke={stroke} {...common} />
        {[[22, 16], [98, 16], [22, 64], [98, 64]].map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <path d={`M${x < 60 ? 50 : 70} ${y < 40 ? 34 : 46}L${x} ${y}`} stroke={muted} {...common} />
            <rect x={x - 7} y={y - 6} width="14" height="12" rx="3" fill="var(--color-surface-2)" stroke={muted} strokeWidth="1.5" />
          </g>
        ))}
        <circle cx="60" cy="40" r="3" fill={stroke} />
      </>
    ),
    // operations loop: monitor → evaluate → improve
    ai_managed: (
      <>
        <path d="M24 40c0-14 16-22 36-22s36 8 36 22-16 22-36 22" stroke={muted} {...common} />
        <path d="M60 62c-20 0-36-8-36-22" stroke={stroke} {...common} />
        <path d="m28 48-4-8-6 5" stroke={stroke} {...common} />
        {[[24, 40], [60, 18], [96, 40]].map(([x, y], i) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="5" fill="var(--color-surface-2)" stroke={i === 1 ? accent : stroke} strokeWidth="1.5" />
        ))}
      </>
    ),
    // checklist
    audit: (
      <>
        <rect x="36" y="10" width="48" height="60" rx="5" stroke={muted} {...common} />
        {[24, 38, 52].map((y, i) => (
          <g key={y}>
            <path d={`m44 ${y}3 3 5-6`} stroke={i < 2 ? stroke : muted} {...common} />
            <path d={`M58 ${y + 1}h18`} stroke={muted} {...common} />
          </g>
        ))}
      </>
    ),
  };

  return (
    <svg viewBox="0 0 120 80" className={className} aria-hidden="true" focusable="false">
      {motifs[service]}
    </svg>
  );
}
