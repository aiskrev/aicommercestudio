/**
 * Decorative system diagram for the hero: an AI orchestration core connected to the systems
 * of an online business. Pure SVG + CSS animation (disabled with prefers-reduced-motion).
 */
const nodes = [
  { x: 92, y: 74, label: "Онлайн магазин", sub: "Shopify · WooCommerce" },
  { x: 428, y: 74, label: "CRM и ERP", sub: "API · webhooks" },
  { x: 84, y: 220, label: "SEO", sub: "индексиране · CWV" },
  { x: 436, y: 220, label: "Анализи", sub: "GA4 · табла" },
  { x: 92, y: 366, label: "Автоматизации", sub: "планирани задачи" },
  { x: 428, y: 366, label: "Сигурност", sub: "достъп · журнал" },
];

export function HeroVisual() {
  return (
    <div className="relative" aria-hidden="true">
      <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-violet-500/10 blur-2xl" />
      <div className="glass relative rounded-[1.75rem] p-3 sm:p-4">
        <svg viewBox="0 0 520 500" className="h-auto w-full" role="presentation">
          <defs>
            <linearGradient id="hv-stroke" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#22d3ee" />
              <stop offset="0.5" stopColor="#3b82f6" />
              <stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
            <radialGradient id="hv-core" cx="0.5" cy="0.5" r="0.6">
              <stop offset="0" stopColor="#1e3a8a" stopOpacity="0.9" />
              <stop offset="1" stopColor="#0c1222" />
            </radialGradient>
            <pattern id="hv-grid" width="26" height="26" patternUnits="userSpaceOnUse">
              <path d="M26 0H0V26" fill="none" stroke="rgb(148 163 184 / 0.07)" strokeWidth="1" />
            </pattern>
          </defs>

          <rect x="0" y="0" width="520" height="500" rx="20" fill="url(#hv-grid)" />

          {nodes.map((node) => (
            <line
              key={`l-${node.label}`}
              x1="260"
              y1="220"
              x2={node.x}
              y2={node.y}
              stroke="url(#hv-stroke)"
              strokeOpacity="0.55"
              strokeWidth="1.4"
              strokeDasharray="4 8"
              className="animate-dash"
            />
          ))}

          <circle cx="260" cy="220" r="92" fill="none" stroke="rgb(34 211 238 / 0.12)" strokeWidth="1" />
          <circle cx="260" cy="220" r="64" fill="none" stroke="rgb(139 92 246 / 0.16)" strokeWidth="1" className="animate-pulse-soft" />

          <g>
            <rect x="178" y="184" width="164" height="72" rx="18" fill="url(#hv-core)" stroke="url(#hv-stroke)" strokeWidth="1.6" />
            <text x="260" y="214" textAnchor="middle" className="fill-white font-display" fontSize="15" fontWeight="600">
              AI оркестрация
            </text>
            <text x="260" y="236" textAnchor="middle" className="fill-cyan-200" fontSize="11">
              с човешко одобрение
            </text>
          </g>

          {nodes.map((node) => (
            <g key={node.label}>
              <rect
                x={node.x - 74}
                y={node.y - 25}
                width="148"
                height="50"
                rx="13"
                fill="#0c1222"
                stroke="rgb(148 163 184 / 0.22)"
                strokeWidth="1"
              />
              <circle cx={node.x - 56} cy={node.y} r="4" fill="#22d3ee" className="animate-pulse-soft" />
              <text x={node.x - 44} y={node.y - 3} className="fill-white" fontSize="12.5" fontWeight="600">
                {node.label}
              </text>
              <text x={node.x - 44} y={node.y + 13} className="fill-slate-400" fontSize="9.5">
                {node.sub}
              </text>
            </g>
          ))}
        </svg>

        <div className="glass animate-float absolute -bottom-4 left-6 hidden rounded-2xl px-4 py-3 text-left sm:block">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Действие на AI агент</p>
          <p className="mt-1 text-sm font-semibold text-white">Промяна на цена → чака одобрение</p>
        </div>
      </div>
    </div>
  );
}
