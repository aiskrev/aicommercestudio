import { ImageResponse } from "next/og";

// Latin-only text: the built-in OG font has no Cyrillic glyphs, and loading a remote
// font at build time would add an external dependency.
export const alt = "A.I. Commerce Studio — AI, automation and e-commerce engineering";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "radial-gradient(circle at 15% 0%, #0e3b4f 0%, #04070f 55%), #04070f",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              border: "3px solid #22d3ee",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              fontWeight: 700,
              color: "#67e8f9",
            }}
          >
            A
          </div>
          <div style={{ fontSize: 34, fontWeight: 600 }}>A.I. Commerce Studio</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.05, maxWidth: 980 }}>
            AI, automation & e-commerce engineering
          </div>
          <div style={{ fontSize: 30, color: "#94a3b8" }}>Shopify · WooCommerce · SEO · Integrations · Analytics</div>
        </div>
        <div style={{ height: 6, width: 320, borderRadius: 3, background: "linear-gradient(90deg, #22d3ee, #3b82f6, #8b5cf6)" }} />
      </div>
    ),
    size,
  );
}
