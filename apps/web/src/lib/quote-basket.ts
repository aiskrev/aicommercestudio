import { CONFIGURATOR_MODEL_VERSION, type ConfiguratorAnswers, type ConfiguratorReview, type ReviewBand } from "@/lib/configurator";
import type { QuoteContact } from "@/lib/configurator-api";

/**
 * Quote basket: a draft request for a written quote, kept on the server (POST /api/public/quote-basket).
 *
 * The browser keeps one thing: the secret token of its basket, in localStorage, so the draft can be resumed later.
 * It is sent in the X-Basket-Token header (never in a URL, never as a cookie). No answer, amount or contact detail
 * is stored in the browser; every view comes from the server, which computes each line from the published
 * schedule. This is not a shop cart and nothing here is a payment.
 */
export const BASKET_TOKEN_KEY = "acs.quote-basket";
const BASE = "/api/public/quote-basket";

export type ExtraGroup = "service" | "workshop" | "care_plan" | "ai_managed";

export interface BasketItem {
  id: string;
  kind: "configuration" | "extra";
  needs_update: boolean;
  answers: Record<string, unknown> | null;
  review: ConfiguratorReview | null;
  extra: { group: ExtraGroup; key: string; band: ReviewBand } | null;
}

export interface BasketView {
  status: "open" | "submitted";
  version: number;
  expires_at: string;
  locale: string;
  model_version: string;
  schedule_version: string;
  currency: string;
  owner_approval: "pending" | "approved";
  tax_treatment: string;
  binding: false;
  max_items: number;
  items: BasketItem[];
  totals: { one_time_from: number; monthly_from: number; priced_lines: number; unpriced_lines: number };
  unpriced: { item_id: string; key: string }[];
  assumptions: string[];
  exclusions: string[];
  human_review: { required: true; reasons: string[] };
  reference: string | null;
}

export type BasketFailure = "none" | "changed" | "submitted" | "full" | "duplicate" | "unsupported" | "needs_update" | "empty" | "rate_limited" | "unavailable" | "failed";
export type BasketResult = { ok: true; basket: BasketView } | { ok: false; kind: BasketFailure };

export function readBasketToken(): string | null {
  try {
    return window.localStorage.getItem(BASKET_TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeBasketToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(BASKET_TOKEN_KEY, token);
    else window.localStorage.removeItem(BASKET_TOKEN_KEY);
  } catch {
    // Storage may be blocked: the basket then lives only as long as this page.
  }
}

export const forgetBasket = () => writeBasketToken(null);

const FAILURES: Record<string, BasketFailure> = {
  basket_not_found: "none",
  basket_changed: "changed",
  basket_submitted: "submitted",
  basket_full: "full",
  duplicate_item: "duplicate",
  unsupported_combination: "unsupported",
  basket_needs_update: "needs_update",
  basket_empty: "empty",
};

async function call(method: string, path: string, token: string | null, body?: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  try {
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(token ? { "X-Basket-Token": token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const data = response.status === 204 ? {} : ((await response.json().catch(() => ({}))) as Record<string, unknown>);
    return { status: response.status, data };
  } catch {
    return { status: 0, data: {} };
  }
}

function failure(status: number, data: Record<string, unknown>): BasketFailure {
  const known = FAILURES[String(data.code)];
  if (known) {
    if (known === "none") forgetBasket(); // unknown or expired: the token is useless now
    return known;
  }
  if (status === 429) return "rate_limited";
  if (status === 404) return "unavailable"; // the feature is switched off
  return "failed";
}

function asBasket(status: number, data: Record<string, unknown>): BasketResult {
  return status >= 200 && status < 300 && Array.isArray(data.items) ? { ok: true, basket: data as unknown as BasketView } : { ok: false, kind: failure(status, data) };
}

/** The basket this browser owns, or `none` when it has none (or it expired). */
export async function fetchBasket(): Promise<BasketResult> {
  const token = readBasketToken();
  if (!token) return { ok: false, kind: "none" };
  const { status, data } = await call("GET", "", token);
  return asBasket(status, data);
}

async function createWith(item: unknown, locale: string): Promise<BasketResult> {
  const { status, data } = await call("POST", "", null, { locale, item });
  if (status === 201 && typeof data.token === "string") {
    writeBasketToken(data.token);
    return { ok: true, basket: data.basket as BasketView };
  }
  return { ok: false, kind: failure(status, data) };
}

/** Adds an item, or replaces `itemId`. Creates the basket when there is none; retries once after a concurrent change. */
async function write(item: unknown, locale: string, itemId?: string): Promise<BasketResult> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const current = await fetchBasket();
    if (!current.ok) return current.kind === "none" ? createWith(item, locale) : current;
    if (current.basket.status !== "open") {
      forgetBasket(); // a sent request is closed: the next item starts a new one
      return createWith(item, locale);
    }
    const token = readBasketToken();
    const body = { expected_version: current.basket.version, item };
    const { status, data } = itemId ? await call("PUT", `/items/${itemId}`, token, body) : await call("POST", "/items", token, body);
    const result = asBasket(status, data);
    if (result.ok || result.kind !== "changed") return result;
  }
  return { ok: false, kind: "changed" };
}

export function saveConfiguration(answers: ConfiguratorAnswers, locale: string, itemId?: string): Promise<BasketResult> {
  return write({ kind: "configuration", model_version: CONFIGURATOR_MODEL_VERSION, answers }, locale, itemId);
}

export function addExtra(group: ExtraGroup, key: string, locale: string): Promise<BasketResult> {
  return write({ kind: "extra", group, key }, locale);
}

export async function removeItem(itemId: string, version: number): Promise<BasketResult> {
  const { status, data } = await call("DELETE", `/items/${itemId}?expected_version=${version}`, readBasketToken());
  return asBasket(status, data);
}

export async function discardBasket(): Promise<boolean> {
  const { status } = await call("DELETE", "", readBasketToken());
  if (status === 204 || status === 404) forgetBasket();
  return status === 204 || status === 404;
}

export type BasketSubmitResult =
  | { ok: true; reference: string }
  | { ok: false; kind: "validation"; fieldErrors: Record<string, string> }
  | { ok: false; kind: BasketFailure | "token" | "spam" };

/** Sends the basket as one quote request. Contact details go only into this request. */
export async function submitBasket(contact: QuoteContact, version: number, formToken: string, locale: string): Promise<BasketSubmitResult> {
  const { status, data } = await call("POST", "/submit", readBasketToken(), { expected_version: version, locale, form_token: formToken, ...contact });
  if ((status === 201 || status === 200) && typeof data.reference === "string") {
    forgetBasket(); // sent: the draft is finished
    return { ok: true, reference: data.reference };
  }
  if (status === 400 && data.code === "form_token_invalid") return { ok: false, kind: "token" };
  if (status === 400 && data.code === "spam_suspected") return { ok: false, kind: "spam" };
  if (status === 422 && !FAILURES[String(data.code)]) {
    const fieldErrors: Record<string, string> = {};
    for (const error of (data.errors as { field: string | null; message: string }[] | undefined) ?? []) {
      if (error.field && !fieldErrors[error.field]) fieldErrors[error.field] = error.message;
    }
    return { ok: false, kind: "validation", fieldErrors };
  }
  return { ok: false, kind: failure(status, data) };
}
