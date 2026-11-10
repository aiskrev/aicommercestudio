"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type KeyboardEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/i18n/config";
import { search, type SearchEntry, type SearchType } from "@/lib/search";

export interface SearchLabels {
  open: string;
  title: string;
  placeholder: string;
  hint: string;
  loading: string;
  error: string;
  /** Contains `{query}`. */
  empty: string;
  /** Contains `{count}`. */
  count: string;
  close: string;
  types: Record<SearchType, string>;
}

const indexes = new Map<Locale, Promise<SearchEntry[]>>();

/** The index is fetched the first time the box opens and kept for the rest of the visit. */
function loadIndex(locale: Locale): Promise<SearchEntry[]> {
  let pending = indexes.get(locale);
  if (!pending) {
    pending = fetch(`/api/search-index?locale=${locale}`)
      .then((response) => {
        if (!response.ok) throw new Error(`search index ${response.status}`);
        return response.json() as Promise<{ entries: SearchEntry[] }>;
      })
      .then((data) => data.entries);
    pending.catch(() => indexes.delete(locale)); // a failed load is tried again next time
    indexes.set(locale, pending);
  }
  return pending;
}

/** Test helper. */
export function resetSearchIndexCache() {
  indexes.clear();
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * Search box for the whole site: a button in the header that opens a dialog. Results appear as you type, from
 * an index of the site's own pages (no third-party service, nothing the visitor types leaves the browser).
 * Opens with the button, with "/" or with Ctrl/Cmd+K; arrow keys choose, Enter opens, Esc closes.
 */
export function SiteSearch({ locale, labels }: { locale: Locale; labels: SearchLabels }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const listId = useId();

  const hits = useMemo(() => (entries ? search(entries, query, 12) : []), [entries, query]);
  const optionId = (index: number) => `${listId}-${index}`;

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
    triggerRef.current?.focus();
  }, []);

  // "/" and Ctrl/Cmd+K open the box from anywhere on the page.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const slash = event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !isTyping(event.target);
      const palette = event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey);
      if (slash || palette) {
        event.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Load the index when the box opens; lock page scroll and focus the field while it is open.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    loadIndex(locale).then(
      (loaded) => {
        if (!alive) return;
        setFailed(false);
        setEntries(loaded);
      },
      () => alive && setFailed(true),
    );
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    return () => {
      alive = false;
      document.body.style.overflow = previousOverflow;
    };
  }, [open, locale]);

  const onDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "Tab") {
      // Keep focus inside the dialog.
      const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (hits.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((value) => (value + 1) % hits.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((value) => (value - 1 + hits.length) % hits.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(hits.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const hit = hits[Math.min(active, hits.length - 1)];
      close();
      router.push(hit.entry.url);
    }
  };

  const hasQuery = query.trim().length > 0;
  const status = failed
    ? labels.error
    : !entries
      ? labels.loading
      : !hasQuery
        ? labels.hint
        : hits.length === 0
          ? labels.empty.replace("{query}", query.trim())
          : labels.count.replace("{count}", String(hits.length));

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-line-default text-fg transition-colors hover:border-brand/50"
        aria-label={labels.open}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Icon name="search" className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] bg-ink-950/85 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && close()}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onKeyDown={onDialogKeyDown}
            className="mx-auto mt-[8vh] flex max-h-[84dvh] w-[min(42rem,calc(100%-2rem))] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-line-default bg-ink-950 shadow-[var(--shadow-panel)]"
          >
            <h2 id={titleId} className="sr-only">
              {labels.title}
            </h2>
            <div className="flex items-center gap-3 border-b border-line-subtle px-4">
              <Icon name="search" className="h-5 w-5 shrink-0 text-fg-muted" />
              <input
                ref={inputRef}
                type="text"
                inputMode="search"
                role="combobox"
                aria-expanded={hits.length > 0}
                aria-controls={listId}
                aria-activedescendant={hits.length > 0 ? optionId(Math.min(active, hits.length - 1)) : undefined}
                aria-autocomplete="list"
                aria-label={labels.placeholder}
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="search"
                placeholder={labels.placeholder}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={onInputKeyDown}
                className="h-14 min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle"
              />
              <button
                type="button"
                onClick={close}
                aria-label={labels.close}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-fg-muted hover:text-fg"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <p role="status" aria-live="polite" className="px-4 py-2 text-xs text-fg-subtle">
              {status}
            </p>

            <ul id={listId} role="listbox" aria-label={labels.title} className="overflow-y-auto px-2 pb-2">
              {hits.map((hit, index) => (
                <li
                  key={hit.entry.url}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === active}
                  onMouseMove={() => setActive(index)}
                >
                  <Link
                    href={hit.entry.url}
                    tabIndex={-1}
                    onClick={close}
                    className={`block rounded-[var(--radius-md)] px-3 py-2.5 ${index === active ? "bg-surface-2" : ""}`}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-semibold text-fg">{hit.entry.title}</span>
                      <span className="shrink-0 text-xs text-brand">{labels.types[hit.entry.type]}</span>
                    </span>
                    {hit.entry.description && <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-fg-muted">{hit.entry.description}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
