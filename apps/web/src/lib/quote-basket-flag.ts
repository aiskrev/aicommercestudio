/**
 * The quote basket stays hidden until it is switched on: read at runtime so one image fits every environment.
 * While off, its page answers 404 and the configurator keeps its own quote form. The API has the same flag.
 */
export function quoteBasketEnabled(): boolean {
  return process.env.QUOTE_BASKET_ENABLED === "true";
}
