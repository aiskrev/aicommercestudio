import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Unit tests never reach a real API: server-side catalogue fetches (lib/catalogue.ts) fail fast
// against the discard port and fall back to the TypeScript content, as in `next build`.
process.env.API_INTERNAL_URL = "http://127.0.0.1:9";

afterEach(() => {
  cleanup();
});
