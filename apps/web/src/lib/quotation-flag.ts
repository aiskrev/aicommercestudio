/**
 * Customer-facing quotations stay hidden until they are switched on: read at runtime so one image fits every
 * environment. While off, the quotation page answers 404. The API has the same flag.
 */
export function quotationsEnabled(): boolean {
  return process.env.QUOTATIONS_ENABLED === "true";
}
