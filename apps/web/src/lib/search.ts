/** Search over the site's own pages: types shared by the index builder and the browser, and the ranking. */

export const SEARCH_TYPES = ["service", "workshop", "tool", "agent", "reference", "article", "page"] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

export interface SearchEntry {
  type: SearchType;
  /** Localised path, e.g. `/bg/uslugi/seo-optimizatsiya`. */
  url: string;
  title: string;
  /** Shown under the title in the result. */
  description: string;
  /** Extra words used only for matching (headings, capabilities, audiences). */
  text: string;
}

export interface SearchHit {
  entry: SearchEntry;
  score: number;
}

/** Lower case, one kind of space, no punctuation; "й"/"и" and the Latin look-alikes are left alone. */
export function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function tokens(query: string): string[] {
  return normalize(query).split(" ").filter(Boolean);
}

/**
 * Bulgarian and English words change their endings («поддръжка», «поддръжката», «поддържате»), so a word
 * matches when it starts with the query word cut back a little. Short words must match from the start
 * of a word as they are typed; this keeps «AI» from matching every «аi…» fragment.
 */
export function stem(word: string): string {
  if (word.length >= 8) return word.slice(0, word.length - 3);
  if (word.length >= 6) return word.slice(0, word.length - 2);
  if (word.length >= 4) return word.slice(0, word.length - 1);
  return word;
}

function wordsOf(value: string): string[] {
  return normalize(value).split(" ").filter(Boolean);
}

/** Per query word: how well it matches this text (0 = not at all). */
function wordScore(queryWord: string, words: string[], full: string): number {
  const prefix = stem(queryWord);
  if (words.includes(queryWord)) return 4;
  if (words.some((word) => word.startsWith(prefix))) return 3;
  if (queryWord.length >= 3 && full.includes(queryWord)) return 1;
  return 0;
}

const TYPE_ORDER: Record<SearchType, number> = { service: 0, workshop: 1, tool: 2, agent: 3, reference: 4, article: 5, page: 6 };

/**
 * Every query word has to match somewhere (title, description or the extra words). Matches in the title
 * count most, then the description, then the extra words; an exact title or a title that starts with the
 * query goes first.
 */
export function search(entries: readonly SearchEntry[], query: string, limit = 20): SearchHit[] {
  const queryWords = tokens(query);
  if (queryWords.length === 0) return [];
  const phrase = queryWords.join(" ");
  const hits: SearchHit[] = [];

  for (const entry of entries) {
    const title = normalize(entry.title);
    const titleWords = wordsOf(entry.title);
    const description = normalize(entry.description);
    const descriptionWords = wordsOf(entry.description);
    const text = normalize(entry.text);
    const textWords = wordsOf(entry.text);

    let score = 0;
    let matchedAll = true;
    for (const word of queryWords) {
      const inTitle = wordScore(word, titleWords, title);
      const inDescription = wordScore(word, descriptionWords, description);
      const inText = wordScore(word, textWords, text);
      const best = Math.max(inTitle * 5, inDescription * 2, inText);
      if (best === 0) {
        matchedAll = false;
        break;
      }
      score += best;
    }
    if (!matchedAll) continue;

    if (title === phrase) score += 40;
    else if (title.startsWith(phrase)) score += 20;
    else if (title.includes(phrase)) score += 10;
    hits.push({ entry, score });
  }

  return hits
    .sort((a, b) => b.score - a.score || TYPE_ORDER[a.entry.type] - TYPE_ORDER[b.entry.type] || a.entry.title.localeCompare(b.entry.title))
    .slice(0, limit);
}
