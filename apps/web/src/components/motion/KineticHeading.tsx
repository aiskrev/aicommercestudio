import { type CSSProperties, Fragment } from "react";

import { cx } from "@/components/ui/primitives";

/**
 * Kinetic headline (docs/MOTION_SYSTEM.md → Hero signature). The heading is split into phrases at commas, and each
 * word sits in its own mask (`.kw`, clip-path) and rises into it (`.kw-in`, transform only, 760 ms). Phrases start
 * 80 ms apart; the words of a phrase follow 20 ms apart. Words, never characters, so Bulgarian text is never broken
 * up. The text content is unchanged ("title highlight"), and the words are opaque from the first frame: each starts
 * partly inside its mask, so the heading is painted at once and stays the LCP element. CSS only (runs without
 * JavaScript); with reduced motion the words are simply static.
 */
export function KineticHeading({ title, highlight, className }: { title: string; highlight: string; className?: string }) {
  const phrases = title.split(/(?<=[,;:])\s+/).filter(Boolean);
  const word = (text: string, phrase: number, index: number, last: boolean) => (
    <Fragment key={`${phrase}-${index}`}>
      <span className="kw">
        <span className="kw-in" style={{ "--p": phrase, "--w": index } as CSSProperties}>
          {text}
        </span>
      </span>
      {last ? null : " "}
    </Fragment>
  );
  const highlightWords = highlight.split(/\s+/).filter(Boolean);
  return (
    <h1 className={cx("fc-kinetic", className)}>
      {phrases.map((phrase, p) => phrase.split(/\s+/).map((text, w) => word(text, p, w, false)))}
      <span className="text-brand">{highlightWords.map((text, w) => word(text, phrases.length, w, w === highlightWords.length - 1))}</span>
    </h1>
  );
}
