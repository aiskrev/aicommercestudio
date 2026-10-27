"use client";

import { type KeyboardEvent, useId, useMemo, useRef, useState } from "react";

import { cx } from "@/components/ui/primitives";
import type { teamTool } from "@/content/bg/tool-team";
import { type ArchitectureEdge, type ArchitectureNode, LANES, type NodeLane, connectedNodes } from "@/lib/ai-team";

type Content = typeof teamTool;
type Orientation = "horizontal" | "vertical";

interface Placed {
  node: ArchitectureNode;
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
  sub?: string;
}

const LANE_COLOUR: Record<NodeLane, string> = {
  users: "var(--color-fg-secondary)",
  orchestration: "var(--color-brand-soft)",
  agents: "var(--color-brand)",
  approvals: "var(--color-warning)",
  data: "var(--color-brand-2)",
  systems: "var(--color-fg-muted)",
};
const EDGE_COLOUR: Record<ArchitectureEdge["kind"], string> = {
  request: "var(--color-line-strong)",
  route: "var(--color-line-strong)",
  read: "var(--color-brand-2)",
  act: "var(--color-brand)",
  review: "var(--color-warning)",
  supervise: "var(--color-warning)",
};

/** Greedy word wrap into at most `maxLines` lines of `max` characters (the last one is shortened). */
export function wrapLabel(text: string, max: number, maxLines = 3): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (!line) line = word;
    else if ((line + " " + word).length <= max) line += " " + word;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, max - 1)}…`;
  return kept;
}

const LINE_HEIGHT = 15;
const nodeHeight = (lines: number, sub: boolean) => 20 + lines * LINE_HEIGHT + (sub ? 14 : 0);

function layout(nodes: ArchitectureNode[], labelOf: (n: ArchitectureNode) => { label: string; sub?: string }, orientation: Orientation) {
  const placed: Placed[] = [];
  const titles: { lane: NodeLane; x: number; y: number }[] = [];
  const byLane = (lane: NodeLane) => nodes.filter((n) => n.lane === lane);

  if (orientation === "horizontal") {
    const W = 172;
    const columnX: Partial<Record<NodeLane, number>> = { users: 16, orchestration: 214, agents: 412, approvals: 610, systems: 808 };
    const columns = (["users", "orchestration", "agents", "approvals", "systems"] as const).map((lane) =>
      byLane(lane).map((node) => {
        const { label, sub } = labelOf(node);
        const lines = wrapLabel(label, 22);
        return { node, lines, sub, h: nodeHeight(lines.length, Boolean(sub)) };
      }),
    );
    const heights = columns.map((col) => col.reduce((sum, n) => sum + n.h, 0) + Math.max(0, col.length - 1) * 14);
    const mainHeight = Math.max(...heights, 60);
    const top = 52;
    columns.forEach((col, index) => {
      const lane = (["users", "orchestration", "agents", "approvals", "systems"] as const)[index];
      if (col.length === 0) return;
      titles.push({ lane, x: columnX[lane]!, y: 26 });
      let y = top + (mainHeight - heights[index]) / 2;
      for (const item of col) {
        placed.push({ node: item.node, x: columnX[lane]!, y, w: W, h: item.h, lines: item.lines, sub: item.sub });
        y += item.h + 14;
      }
    });
    const data = byLane("data");
    let height = top + mainHeight + 24;
    if (data.length > 0) {
      const rowTitle = top + mainHeight + 52;
      titles.push({ lane: "data", x: 412, y: rowTitle });
      data.forEach((node, index) => {
        const { label, sub } = labelOf(node);
        const lines = wrapLabel(label, 22);
        placed.push({ node, x: 412 + index * 198, y: rowTitle + 18, w: W, h: nodeHeight(lines.length, Boolean(sub)), lines, sub });
      });
      height = rowTitle + 18 + Math.max(...placed.filter((p) => p.node.lane === "data").map((p) => p.h)) + 20;
    }
    return { placed, titles, width: 1000, height };
  }

  // Vertical: one row per lane, two nodes per line.
  const W = 162;
  let y = 8;
  for (const lane of LANES) {
    const items = byLane(lane);
    if (items.length === 0) continue;
    titles.push({ lane, x: 12, y: y + 14 });
    y += 26;
    for (let i = 0; i < items.length; i += 2) {
      const pair = items.slice(i, i + 2).map((node) => {
        const { label, sub } = labelOf(node);
        const lines = wrapLabel(label, 20);
        return { node, lines, sub, h: nodeHeight(lines.length, Boolean(sub)) };
      });
      const rowH = Math.max(...pair.map((p) => p.h));
      pair.forEach((p, j) => {
        const x = pair.length === 1 ? (360 - W) / 2 : j === 0 ? 12 : 186;
        placed.push({ node: p.node, x, y, w: W, h: p.h, lines: p.lines, sub: p.sub });
      });
      y += rowH + 12;
    }
    y += 18;
  }
  return { placed, titles, width: 360, height: y };
}

function edgePath(from: Placed, to: Placed, kind: ArchitectureEdge["kind"], orientation: Orientation): string {
  if (orientation === "horizontal") {
    if (to.node.lane === "data") {
      const sx = from.x + from.w / 2;
      const sy = from.y + from.h;
      const tx = to.x + to.w / 2;
      const ty = to.y;
      return `M${sx},${sy} C${sx},${sy + 48} ${tx},${ty - 48} ${tx},${ty}`;
    }
    if (kind === "supervise") {
      const x = from.x;
      const sy = from.y + from.h / 2;
      const ty = to.y + to.h / 2;
      return `M${x},${sy} C${x - 30},${sy} ${x - 30},${ty} ${x},${ty}`;
    }
    const sx = from.x + from.w;
    const sy = from.y + from.h / 2;
    const tx = to.x;
    const ty = to.y + to.h / 2;
    const dx = Math.max(24, (tx - sx) / 2);
    return `M${sx},${sy} C${sx + dx},${sy} ${tx - dx},${ty} ${tx},${ty}`;
  }
  if (Math.abs(from.y - to.y) < 4) {
    const leftToRight = from.x < to.x;
    const sx = leftToRight ? from.x + from.w : from.x;
    const tx = leftToRight ? to.x : to.x + to.w;
    const sy = from.y + from.h / 2;
    return `M${sx},${sy} L${tx},${sy}`;
  }
  const sx = from.x + from.w / 2;
  const sy = from.y + from.h;
  const tx = to.x + to.w / 2;
  const ty = to.y;
  const dy = Math.max(18, (ty - sy) / 2);
  return `M${sx},${sy} C${sx},${sy + dy} ${tx},${ty - dy} ${tx},${ty}`;
}

/**
 * Interactive architecture of the configured team. Each element is a toggle button (roving focus:
 * Tab enters the diagram, arrow keys move, Enter/Space select, Escape clears). Selecting or hovering
 * highlights its direct connections; a details panel and a text list describe the same graph.
 */
export function TeamArchitecture({
  content,
  nodes,
  edges,
  describe,
}: {
  content: Content;
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  /** Localized label, secondary line and description of a node. */
  describe: (node: ArchitectureNode) => { label: string; sub?: string; text?: string };
}) {
  const t = content.architecture;
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const hintId = useId();
  const panelId = useId();
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const selectedNode = selected ? byId.get(selected) : undefined;

  const connections = (id: string) =>
    edges
      .filter((e) => e.from === id || e.to === id)
      .map((e) =>
        e.from === id
          ? `→ ${t.edges[e.kind]} ${describe(byId.get(e.to)!).label}`
          : `← ${describe(byId.get(e.from)!).label} ${t.edges[e.kind]}`,
      );

  return (
    <div className="grid gap-5" data-testid="team-architecture">
      <p id={hintId} className="text-sm text-fg-muted">
        {t.hint}
      </p>
      <div className="diagram-frame diagram-grid overflow-hidden p-3 sm:p-4">
        {(["horizontal", "vertical"] as const).map((orientation) => (
          <div key={orientation} className={orientation === "horizontal" ? "hidden lg:block" : "mx-auto max-w-[34rem] lg:hidden"}>
            <Diagram
              orientation={orientation}
              nodes={nodes}
              edges={edges}
              describe={describe}
              content={content}
              selected={selected}
              hovered={hovered}
              onSelect={(id) => setSelected((current) => (current === id ? null : id))}
              onClear={() => setSelected(null)}
              onHover={setHovered}
              describedBy={`${hintId} ${panelId}`}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-fg-muted" aria-hidden="true">
        <Legend colour={EDGE_COLOUR.act} label={t.legendAct} />
        <Legend colour={EDGE_COLOUR.read} label={t.legendRead} dashed />
        <Legend colour={EDGE_COLOUR.review} label={t.legendApproval} dashed />
      </div>
      <div id={panelId} aria-live="polite" className="card p-5" data-testid="architecture-details">
        {selectedNode ? (
          <>
            <p className="t-label">{t.lanes[selectedNode.lane]}</p>
            <h3 className="t-h3 mt-1">{describe(selectedNode).label}</h3>
            {describe(selectedNode).text && <p className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">{describe(selectedNode).text}</p>}
            <p className="mt-4 text-sm font-semibold text-fg">{t.connections}</p>
            <ul className="mt-2 grid gap-1 text-sm text-fg-secondary">
              {connections(selectedNode.id).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-fg-muted">{t.selectPrompt}</p>
        )}
      </div>
      <details className="accordion rounded-[var(--radius-lg)] border border-line-subtle bg-surface-1 px-5 py-4">
        <summary className="cursor-pointer font-semibold text-fg">{t.listTitle}</summary>
        <ul className="mt-3 grid gap-3 text-sm" data-testid="architecture-list">
          {LANES.flatMap((lane) => nodes.filter((n) => n.lane === lane)).map((node) => (
            <li key={node.id}>
              <span className="font-semibold text-fg">{describe(node).label}</span>{" "}
              <span className="text-fg-subtle">({t.lanes[node.lane]})</span>
              <ul className="mt-1 grid gap-0.5 pl-4 text-fg-muted">
                {edges
                  .filter((e) => e.from === node.id)
                  .map((e) => (
                    <li key={`${e.from}-${e.to}`}>
                      → {t.edges[e.kind]} {describe(byId.get(e.to)!).label}
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function Legend({ colour, label, dashed }: { colour: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="28" height="6" aria-hidden="true">
        <line x1="0" y1="3" x2="28" y2="3" stroke={colour} strokeWidth="2" strokeDasharray={dashed ? "4 3" : undefined} />
      </svg>
      {label}
    </span>
  );
}

function Diagram({
  orientation,
  nodes,
  edges,
  describe,
  content,
  selected,
  hovered,
  onSelect,
  onClear,
  onHover,
  describedBy,
}: {
  orientation: Orientation;
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  describe: (node: ArchitectureNode) => { label: string; sub?: string };
  content: Content;
  selected: string | null;
  hovered: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  onHover: (id: string | null) => void;
  describedBy: string;
}) {
  const uid = useId().replace(/:/g, "");
  const t = content.architecture;
  const { placed, titles, width, height } = useMemo(() => layout(nodes, describe, orientation), [nodes, describe, orientation]);
  const order = useMemo(() => LANES.flatMap((lane) => placed.filter((p) => p.node.lane === lane)), [placed]);
  const [focusIndex, setFocusIndex] = useState(0);
  const refs = useRef<Map<string, SVGGElement>>(new Map());
  const position = new Map(placed.map((p) => [p.node.id, p]));
  const active = hovered ?? selected;
  const linked = active ? connectedNodes(edges, active) : null;

  function move(index: number) {
    const next = (index + order.length) % order.length;
    setFocusIndex(next);
    refs.current.get(order[next].node.id)?.focus();
  }

  function onKeyDown(event: KeyboardEvent<SVGGElement>, index: number, id: string) {
    const keys: Record<string, () => void> = {
      ArrowRight: () => move(index + 1),
      ArrowDown: () => move(index + 1),
      ArrowLeft: () => move(index - 1),
      ArrowUp: () => move(index - 1),
      Home: () => move(0),
      End: () => move(order.length - 1),
      Enter: () => onSelect(id),
      " ": () => onSelect(id),
      Escape: onClear,
    };
    const action = keys[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="block h-auto w-full"
      role="group"
      aria-label={t.title}
      aria-describedby={describedBy}
      data-orientation={orientation}
      onMouseLeave={() => onHover(null)}
    >
      <defs>
        {(Object.keys(EDGE_COLOUR) as ArchitectureEdge["kind"][]).map((kind) => (
          <marker key={kind} id={`${uid}-${kind}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={EDGE_COLOUR[kind]} />
          </marker>
        ))}
      </defs>
      {titles.map((title) => (
        <text
          key={title.lane}
          x={title.x}
          y={title.y}
          fontSize="11"
          letterSpacing="0.08em"
          style={{ fill: LANE_COLOUR[title.lane], fontFamily: "var(--font-mono)", textTransform: "uppercase" }}
        >
          {t.lanes[title.lane]}
        </text>
      ))}
      <g aria-hidden="true">
        {edges.map((edge) => {
          const from = position.get(edge.from);
          const to = position.get(edge.to);
          if (!from || !to) return null;
          const touches = active !== null && (edge.from === active || edge.to === active);
          return (
            <path
              key={`${edge.from}-${edge.to}-${edge.kind}`}
              d={edgePath(from, to, edge.kind, orientation)}
              fill="none"
              stroke={EDGE_COLOUR[edge.kind]}
              strokeWidth={touches ? 2.4 : 1.4}
              strokeDasharray={edge.kind === "read" || edge.kind === "review" || edge.kind === "supervise" ? "5 4" : undefined}
              markerEnd={`url(#${uid}-${edge.kind})`}
              className="arch-dim"
              opacity={active === null ? 0.7 : touches ? 1 : 0.12}
              data-edge={`${edge.from}->${edge.to}`}
            />
          );
        })}
      </g>
      {order.map((p, index) => {
        const id = p.node.id;
        const isSelected = selected === id;
        const dimmed = linked !== null && !linked.has(id);
        const { label } = describe(p.node);
        const colour = LANE_COLOUR[p.node.lane];
        return (
          <g
            key={id}
            ref={(el) => {
              if (el) refs.current.set(id, el);
              else refs.current.delete(id);
            }}
            role="button"
            tabIndex={index === focusIndex ? 0 : -1}
            aria-pressed={isSelected}
            aria-label={`${label} — ${t.lanes[p.node.lane]}`}
            data-node={id}
            className={cx("arch-dim cursor-pointer outline-none [&:focus-visible>rect]:stroke-[3]")}
            opacity={dimmed ? 0.3 : 1}
            onClick={() => {
              setFocusIndex(index);
              onSelect(id);
            }}
            onKeyDown={(event) => onKeyDown(event, index, id)}
            onFocus={() => setFocusIndex(index)}
            onMouseEnter={() => onHover(id)}
          >
            <rect
              x={p.x}
              y={p.y}
              width={p.w}
              height={p.h}
              rx="10"
              style={{
                fill: isSelected ? "color-mix(in oklab, var(--color-surface-3) 70%, " + colour + ")" : "var(--color-surface-2)",
                stroke: colour,
              }}
              strokeWidth={isSelected ? 2.4 : 1.2}
              strokeDasharray={p.node.lane === "approvals" ? "5 3" : undefined}
            />
            <text x={p.x + 12} y={p.y + 10 + LINE_HEIGHT} fontSize="12.5" style={{ fill: "var(--color-fg)" }}>
              {p.lines.map((line, i) => (
                <tspan key={i} x={p.x + 12} dy={i === 0 ? 0 : LINE_HEIGHT} fontWeight={i === 0 ? 600 : 500}>
                  {line}
                </tspan>
              ))}
            </text>
            {p.sub && (
              <text x={p.x + 12} y={p.y + p.h - 11} fontSize="10.5" style={{ fill: "var(--color-fg-muted)" }}>
                {p.sub.length > 30 ? `${p.sub.slice(0, 29)}…` : p.sub}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
