/**
 * Decorative system diagram for the hero: an AI orchestration core exchanging data with the
 * systems of an online business. Pure SVG + CSS (stroke-dashoffset / transform / opacity only),
 * no JavaScript. Moving "packets" are hidden for users who prefer reduced motion.
 */
const CENTER = { x: 260, y: 250 };

const nodes = [
  { x: 100, y: 92, label: "Онлайн магазин", sub: "Shopify · WooCommerce", inbound: false },
  { x: 420, y: 92, label: "CRM и ERP", sub: "API · webhooks", inbound: true },
  { x: 92, y: 250, label: "SEO", sub: "индексиране · CWV", inbound: true },
  { x: 428, y: 250, label: "Анализи", sub: "GA4 · табла", inbound: false },
  { x: 100, y: 408, label: "Автоматизации", sub: "планирани задачи", inbound: false },
  { x: 420, y: 408, label: "Сигурност", sub: "достъп · журнал", inbound: true },
];

function connector(x: number, y: number): string {
  const midX = (CENTER.x + x) / 2;
  return `M${CENTER.x} ${CENTER.y} C ${midX} ${CENTER.y}, ${midX} ${y}, ${x} ${y}`;
}

export function HeroVisual() {
  return (
    <div className="relative" aria-hidden="true">
      <div className="absolute -inset-8 rounded-[2.5rem] bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-violet-500/10 blur-2xl" />
      <div className="card-accent relative rounded-[1.75rem] p-3 sm:p-4">
        <svg viewBox="0 0 520 500" className="h-auto w-full" role="presentation">
          <defs>
            <linearGradient id="hv-stroke" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#22d3ee" />
              <stop offset="0.5" stopColor="#3b82f6" />
              <stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
            <radialGradient id="hv-core" cx="0.5" cy="0.4" r="0.7">
              <stop offset="0" stopColor="#1e3a8a" stopOpacity="0.95" />
              <stop offset="1" stopColor="#0d1426" />
            </radialGradient>
            <radialGradient id="hv-halo" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#22d3ee" stopOpacity="0.22" />
              <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
            </radialGradient>
            <pattern id="hv-grid" width="26" height="26" patternUnits="userSpaceOnUse">
              <path d="M26 0H0V26" fill="none" stroke="rgb(148 163 184 / 0.07)" strokeWidth="1" />
            </pattern>
          </defs>

          <rect x="0" y="0" width="520" height="500" rx="20" fill="url(#hv-grid)" />
          <circle cx={CENTER.x} cy={CENTER.y} r="150" fill="url(#hv-halo)" />

          {/* static connectors */}
          {nodes.map((node) => (
            <path
              key={`c-${node.label}`}
              d={connector(node.x, node.y)}
              fill="none"
              stroke="url(#hv-stroke)"
              strokeOpacity="0.4"
              strokeWidth="1.3"
              strokeDasharray="3 6"
            />
          ))}

          {/* moving data packets */}
          <g className="motion-decorative">
            {nodes.map((node, index) => (
              <path
                key={`p-${node.label}`}
                d={connector(node.x, node.y)}
                pathLength={260}
                fill="none"
                stroke={index % 2 ? "#a78bfa" : "#67e8f9"}
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeDasharray="16 600"
                className="animate-packet"
                style={{
                  animationDelay: `${index * 0.7}s`,
                  animationDirection: node.inbound ? "reverse" : "normal",
                }}
              />
            ))}
          </g>

          {/* orbit */}
          <g
            className="animate-spin-slow"
            style={{ transformOrigin: `${CENTER.x}px ${CENTER.y}px`, transformBox: "view-box" }}
          >
            <circle cx={CENTER.x} cy={CENTER.y} r="104" fill="none" stroke="rgb(34 211 238 / 0.22)" strokeDasharray="2 10" />
            <circle cx={CENTER.x + 104} cy={CENTER.y} r="3" fill="#67e8f9" />
            <circle cx={CENTER.x - 74} cy={CENTER.y - 73} r="2.2" fill="#a78bfa" />
          </g>
          <circle cx={CENTER.x} cy={CENTER.y} r="70" fill="none" stroke="rgb(139 92 246 / 0.22)" className="animate-pulse-soft" />

          {/* core */}
          <rect x="174" y="212" width="172" height="76" rx="20" fill="url(#hv-core)" stroke="url(#hv-stroke)" strokeWidth="1.6" />
          <text x={CENTER.x} y="244" textAnchor="middle" className="fill-white font-display" fontSize="15.5" fontWeight="600">
            AI оркестрация
          </text>
          <text x={CENTER.x} y="266" textAnchor="middle" className="fill-cyan-200" fontSize="11">
            с човешко одобрение
          </text>

          {/* system nodes */}
          {nodes.map((node, index) => (
            <g key={node.label}>
              <rect
                x={node.x - 76}
                y={node.y - 26}
                width="152"
                height="52"
                rx="14"
                fill="#0d1426"
                stroke="rgb(148 163 184 / 0.25)"
                strokeWidth="1"
              />
              <circle
                cx={node.x - 57}
                cy={node.y}
                r="4"
                fill={index % 2 ? "#a78bfa" : "#22d3ee"}
                className="animate-pulse-soft"
                style={{ animationDelay: `${index * 0.5}s` }}
              />
              <text x={node.x - 45} y={node.y - 3} className="fill-white" fontSize="12.5" fontWeight="600">
                {node.label}
              </text>
              <text x={node.x - 45} y={node.y + 13} className="fill-slate-300" fontSize="9.5">
                {node.sub}
              </text>
            </g>
          ))}
        </svg>

        <div className="glass animate-float absolute -bottom-5 left-6 hidden rounded-2xl px-4 py-3 text-left shadow-[0_20px_50px_-20px_rgb(0_0_0_/_0.8)] sm:block">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
            <span className="h-2 w-2 rounded-full bg-amber-300" />
            Действие на AI агент
          </p>
          <p className="mt-1 text-sm font-semibold text-white">Промяна на цена → чака одобрение</p>
        </div>
      </div>
    </div>
  );
}
