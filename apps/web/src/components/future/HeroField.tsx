/**
 * Hero technical field (docs/MOTION_SYSTEM.md → Hero signature): a decorative circuit of nodes and orthogonal
 * traces behind the hero preview. Two depth layers follow a fine pointer (--fx/--fy from the pointer layer,
 * ≤ 14 px) and one faint scan line sweeps the field (the single ambient loop, paused off screen). Static SVG,
 * aria-hidden; hidden in forced colours.
 */
const TRACES = [
  "M40 70 H180 V140 H300",
  "M300 140 H420 V60 H560",
  "M120 260 H240 V200 H380 V250 H520",
  "M60 340 H200 V300",
  "M380 250 V330 H560",
  "M180 140 V200 H240",
];
const NODES: [number, number, number][] = [
  [40, 70, 2.5], [180, 70, 2], [300, 140, 3.5], [420, 60, 2], [560, 60, 2.5], [120, 260, 2], [240, 200, 2.5],
  [380, 200, 2], [380, 250, 3.5], [520, 250, 2], [60, 340, 2], [200, 300, 2.5], [560, 330, 2.5], [240, 260, 2],
];

export function HeroField() {
  return (
    <div className="fc-field" aria-hidden="true">
      <svg className="fc-field-layer fc-field-back" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice">
        {TRACES.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
      <svg className="fc-field-layer fc-field-front" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice">
        {NODES.map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} className={r > 3 ? "is-hub" : undefined} />
        ))}
        <circle cx={300} cy={140} r={11} className="fc-field-ring" />
        <circle cx={380} cy={250} r={11} className="fc-field-ring" />
      </svg>
      <span className="fc-scan" />
    </div>
  );
}
