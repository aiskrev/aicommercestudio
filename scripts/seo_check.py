"""SEO and localisation crawl of a LOCAL or TEST stack (audit phase 13). Read-only GET requests.

    docker compose -p <project> --profile test run --rm --no-deps -v "${PWD}:/repo:ro" api-tests \
        python /repo/scripts/seo_check.py http://web:3000

Checks every URL of /sitemap.xml: 200, exactly one <title>, a meta description, one <h1>, a canonical link equal to
the page itself, reciprocal hreflang pairs (bg <-> en, each page lists itself), no robots noindex, valid JSON-LD, and
that internal links in the HTML resolve (checked once per distinct link, sitemap pages only). Also robots.txt and the
redirect from the site root. Output: problems grouped by kind and a JSON summary on the last line.
Absolute URLs that the site builds from SITE_URL (http://localhost:3000 on a test stack) are mapped to the base given.
"""

from __future__ import annotations

import html
import json
import re
import sys
import urllib.error
import urllib.request
from collections import defaultdict
from urllib.parse import urljoin, urlsplit, urlunsplit

LOCAL_ORIGINS = ("http://localhost:3000", "http://web:3000")


def main(base: str) -> int:
    problems: dict[str, list[str]] = defaultdict(list)
    seen_status: dict[str, int] = {}

    def fetch(url: str, follow: bool = True) -> tuple[int, dict[str, str], str]:
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, *args, **kwargs):  # type: ignore[override]
                return None

        opener = urllib.request.build_opener() if follow else urllib.request.build_opener(NoRedirect)
        request = urllib.request.Request(url, headers={"User-Agent": "acs-seo-check/1.0"})
        try:
            with opener.open(request, timeout=30) as response:
                return response.status, {k.lower(): v for k, v in response.getheaders()}, response.read(2_000_000).decode("utf-8", "replace")
        except urllib.error.HTTPError as error:
            return error.code, {k.lower(): v for k, v in error.headers.items()}, ""

    def local(url: str) -> str:
        for origin in LOCAL_ORIGINS:
            if url.startswith(origin):
                return base + url[len(origin) :]
        return url

    def same(url: str) -> str:
        parts = urlsplit(local(url))
        return urlunsplit((parts.scheme, parts.netloc, parts.path.rstrip("/") or "/", parts.query, ""))

    status, _, sitemap = fetch(base + "/sitemap.xml")
    if status != 200:
        problems["sitemap"].append(f"/sitemap.xml answered {status}")
        return report(problems, 0)
    urls = [local(u) for u in re.findall(r"<loc>([^<]+)</loc>", sitemap)]
    if len(set(urls)) != len(urls):
        problems["sitemap"].append("duplicate <loc> entries")

    status, headers, robots = fetch(base + "/robots.txt")
    if status != 200 or "Sitemap:" not in robots or "Disallow: /admin" not in robots or "Disallow: /api/" not in robots:
        problems["robots"].append(f"robots.txt answered {status} or lacks Sitemap/Disallow rules")
    status, headers, _ = fetch(base + "/", follow=False)
    if status not in (307, 308) or not re.search(r"/(bg|en)$", headers.get("location", "")):
        problems["root"].append(f"/ should redirect to a language home, got {status} {headers.get('location')}")

    titles: dict[str, list[str]] = defaultdict(list)
    descriptions: dict[str, list[str]] = defaultdict(list)
    hreflangs: dict[str, dict[str, str]] = {}
    links: dict[str, str] = {}
    for url in urls:
        status, _, body = fetch(url)
        if status != 200:
            problems["status"].append(f"{url} -> {status}")
            continue
        path = urlsplit(url).path
        found_titles = re.findall(r"<title[^>]*>(.*?)</title>", body, re.S)
        if len(found_titles) != 1 or not found_titles[0].strip():
            problems["title"].append(f"{path}: {len(found_titles)} <title>")
        else:
            titles[html.unescape(found_titles[0].strip())].append(path)
        description = re.search(r'<meta[^>]+name="description"[^>]+content="([^"]*)"', body) or re.search(
            r'<meta[^>]+content="([^"]*)"[^>]+name="description"', body
        )
        if not description or len(description.group(1).strip()) < 40:
            problems["description"].append(f"{path}: missing or too short meta description")
        else:
            descriptions[description.group(1)].append(path)
        h1 = len(re.findall(r"<h1[\s>]", body))
        if h1 != 1:
            problems["h1"].append(f"{path}: {h1} <h1>")
        canonical = re.search(r'<link[^>]+rel="canonical"[^>]+href="([^"]+)"', body) or re.search(
            r'<link[^>]+href="([^"]+)"[^>]+rel="canonical"', body
        )
        if not canonical:
            problems["canonical"].append(f"{path}: no canonical link")
        elif same(html.unescape(canonical.group(1))) != same(url):
            problems["canonical"].append(f"{path}: canonical {canonical.group(1)} differs from the page")
        if re.search(r'<meta[^>]+name="robots"[^>]+content="[^"]*noindex', body):
            problems["noindex"].append(f"{path}: sitemap page is noindex")
        alt = {m[0]: same(html.unescape(m[1])) for m in re.findall(r'<link[^>]+rel="alternate"[^>]+hreflang="([^"]+)"[^>]+href="([^"]+)"', body, re.I)}
        alt |= {m[1]: same(html.unescape(m[0])) for m in re.findall(r'<link[^>]+href="([^"]+)"[^>]+hreflang="([^"]+)"[^>]+rel="alternate"', body, re.I)}
        hreflangs[same(url)] = alt
        for block in re.findall(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', body, re.S):
            try:
                json.loads(block)
            except ValueError:
                problems["json-ld"].append(f"{path}: invalid JSON-LD")
        for href in re.findall(r'<a [^>]*href="([^"#]+)', body):
            href = html.unescape(href)
            if href.startswith(("mailto:", "tel:", "javascript:")):
                continue
            absolute = urljoin(url, href)
            if urlsplit(absolute).netloc == urlsplit(base).netloc:
                links.setdefault(absolute.split("?")[0], path)

    for kind, grouped in (("title", titles), ("description", descriptions)):
        for text, paths in grouped.items():
            if len(paths) > 1:
                problems[f"duplicate {kind}"].append(f"{len(paths)} pages share '{text[:60]}': {', '.join(paths[:4])}")

    for page, alt in hreflangs.items():
        if not alt.get("bg") or not alt.get("en"):
            problems["hreflang"].append(f"{urlsplit(page).path}: bg/en alternates missing {sorted(alt)}")
            continue
        if page not in alt.values():
            problems["hreflang"].append(f"{urlsplit(page).path}: does not list itself")
        for lang, target in alt.items():
            if lang in ("bg", "en") and target in hreflangs and hreflangs[target].get(lang) != target:
                problems["hreflang"].append(f"{urlsplit(page).path}: {lang} alternate {urlsplit(target).path} does not point back to itself")
            if lang in ("bg", "en") and target not in hreflangs and local(target) not in urls and target not in {same(u) for u in urls}:
                problems["hreflang"].append(f"{urlsplit(page).path}: {lang} alternate {urlsplit(target).path} is not in the sitemap")

    for link, source in sorted(links.items()):
        if link in seen_status or re.search(r"\.(png|jpg|jpeg|webp|svg|ico|css|js|woff2?|pdf|xml|txt)$", link):
            continue
        code = fetch(link)[0]
        seen_status[link] = code
        if code >= 400:
            problems["broken link"].append(f"{link} -> {code} (first seen on {source})")
    return report(problems, len(urls), len(links))


def report(problems: dict[str, list[str]], pages: int, links: int = 0) -> int:
    for kind, items in sorted(problems.items()):
        print(f"\n[{kind}] {len(items)}")
        for item in items[:25]:
            print("  -", item)
        if len(items) > 25:
            print(f"  ... {len(items) - 25} more")
    print(json.dumps({"pages": pages, "internal_links_checked": links, "problem_kinds": {k: len(v) for k, v in problems.items()}}))
    return 1 if problems else 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    raise SystemExit(main(sys.argv[1].rstrip("/")))
