import localFont from "next/font/local";

/**
 * Fonts are served from this repository, so a build never depends on Google Fonts. Each family has a
 * Latin and a Cyrillic file; the browser downloads the one a page's text needs (`unicode-range`).
 * A family is a stack of both variables, Cyrillic first (see app/globals.css). Only the last in that
 * stack keeps the metric-adjusted fallback: a fallback before it would catch the Latin text.
 * next/font needs literal options here, which is why the ranges are repeated.
 */
const interCyrillic = localFont({
  src: [{ path: "../assets/fonts/inter-cyrillic-wght-normal.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-inter-cyrillic",
  display: "swap",
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116" }],
});

const interLatin = localFont({
  src: [{ path: "../assets/fonts/inter-latin-wght-normal.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-inter-latin",
  display: "swap",
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" }],
});

const manropeCyrillic = localFont({
  src: [{ path: "../assets/fonts/manrope-cyrillic-wght-normal.woff2", weight: "200 800", style: "normal" }],
  variable: "--font-manrope-cyrillic",
  display: "swap",
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116" }],
});

const manropeLatin = localFont({
  src: [{ path: "../assets/fonts/manrope-latin-wght-normal.woff2", weight: "200 800", style: "normal" }],
  variable: "--font-manrope-latin",
  display: "swap",
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" }],
});

const monoCyrillic = localFont({
  src: [{ path: "../assets/fonts/jetbrains-mono-cyrillic-wght-normal.woff2", weight: "100 800", style: "normal" }],
  variable: "--font-mono-cyrillic",
  display: "swap",
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116" }],
});

const monoLatin = localFont({
  src: [{ path: "../assets/fonts/jetbrains-mono-latin-wght-normal.woff2", weight: "100 800", style: "normal" }],
  variable: "--font-mono-latin",
  display: "swap",
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" }],
});

export const fontVariables = [interCyrillic, interLatin, manropeCyrillic, manropeLatin, monoCyrillic, monoLatin]
  .map((font) => font.variable)
  .join(" ");
