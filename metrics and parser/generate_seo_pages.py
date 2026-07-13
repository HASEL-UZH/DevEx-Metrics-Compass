"""
Generate static SEO landing pages for the DevEx Metrics Compass.

The Compass itself is a client-rendered single-page app: its metric data is
fetched from data.json and rendered by JavaScript, so search engines see almost
no metric content. This script reads the SAME data the app reads and emits
static, crawlable HTML landing pages -- one per research framework, one per
company above a threshold, one per top-10% (most-referenced) metric, plus a few
curated comparison pages and an index. Each page holds real metric content for
indexing (styled to match the Compass design language, with company icons and
detail pills) and a call-to-action that opens the live app pre-filtered via its
existing deep-link URL state.

NOTE: the landing pages link into the app with relative URLs (../index.html?...).
Those work when the site is served over HTTP (local dev server or the live
server) -- not when the .html files are opened directly from disk (file://),
because the SPA fetches data.json over HTTP.

Standalone, stdlib-only. Run AFTER parser.py (whenever data.json changes). Never
modifies the app's own files -- only writes dashboard/seo/ plus sitemap.xml and
robots.txt at the dashboard root.

Usage:
    python "generate_seo_pages.py"
"""

import html
import json
import math
import os
import re
from datetime import date
from urllib.parse import urlencode

# ─── Config ──────────────────────────────────────────────────────────────────

# Public URL of the deployed site (trailing slash required). Used for absolute
# canonical / Open Graph / sitemap URLs.
BASE_URL = "https://devexcompass.com/"

# Minimum metric count for a page to be generated (avoids thin-content pages).
FRAMEWORK_MIN_METRICS = 3
COMPANY_MIN_METRICS = 5

# Percentile tiers by mention count (mirrors the app's minMentions filter,
# getMinMentionsThreshold in filtering.js). Metrics in the top 10% each get their
# own landing page; the top-5%/10% tier is shown as a pill on every metric.
TOP_PAGE_PERCENTILE = 10

# Curated comparison pages -- the same presets the app offers on the Compare
# step (dashboard/index.html .compare-preset-btn), minus the shortlist preset
# which is user-specific and can't be static. Each label is the short heading
# shown on the page; type is one of company | framework, and value must be the
# exact resolved source name present in the data.
COMPARISONS = [
    {"label": "Google vs Microsoft",
     "left": {"type": "company", "value": "Google"},
     "right": {"type": "company", "value": "Microsoft"}},
    {"label": "SPACE vs DORA",
     "left": {"type": "framework", "value": "SPACE Framework"},
     "right": {"type": "framework", "value": "DORA Framework"}},
    {"label": "SPACE vs DX Core 4",
     "left": {"type": "framework", "value": "SPACE Framework"},
     "right": {"type": "framework", "value": "DX Core 4 Framework"}},
    {"label": "SPACE vs Microsoft",
     "left": {"type": "framework", "value": "SPACE Framework"},
     "right": {"type": "company", "value": "Microsoft"}},
    {"label": "DORA vs Google",
     "left": {"type": "framework", "value": "DORA Framework"},
     "right": {"type": "company", "value": "Google"}},
]

# Paths (this script lives in "metrics and parser/", data lives in dashboard/).
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DASHBOARD_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "dashboard"))
DATA_DIR = os.path.join(DASHBOARD_DIR, "data")
SEO_DIR = os.path.join(DASHBOARD_DIR, "seo")

SITE_NAME = "Developer Experience Metrics Compass"

# Names to exclude from the "company" facet (mirrors extractCompanies() in
# dashboard/js/filtering.js).
COMPANY_EXCLUDE_SUBSTRINGS = ("framework", "metrics overview", "used widely")

# Detail pills we keep (mirrors chart.js labels). We intentionally drop the
# type / focus / company-size / maturity pills and keep only outcome goal, AI
# category, and the top-tier badge.
AI_PILLS = {"Utilization": "📊 AI Utilization", "Impact": "🎯 AI Impact",
            "Cost": "💰 AI Cost"}
OUTCOME_PILLS = {
    "Developer Experience": "🧑‍💻 Developer Experience",
    "Product Excellence": "⭐ Product Excellence",
    "Organizational Effectiveness": "📈 Organizational Effectiveness",
}

# Populated in main(): metric ids in the top 5% / top 10% by mention count.
TOP5_IDS = set()
TOP10_IDS = set()

# Inline compass logo (mirrors dashboard/js/compass.js SVG_INNER, including the
# animated .compass-needle group).
COMPASS_SVG_INNER = (
    '<circle cx="28" cy="28" r="26" fill="#e8eafd" stroke="#1B1AFF" stroke-width="2"/>'
    '<line x1="28" y1="4" x2="28" y2="10" stroke="#1B1AFF" stroke-width="2" stroke-linecap="round"/>'
    '<line x1="28" y1="46" x2="28" y2="52" stroke="#1B1AFF" stroke-width="2" stroke-linecap="round"/>'
    '<line x1="4" y1="28" x2="10" y2="28" stroke="#1B1AFF" stroke-width="2" stroke-linecap="round"/>'
    '<line x1="46" y1="28" x2="52" y2="28" stroke="#1B1AFF" stroke-width="2" stroke-linecap="round"/>'
    '<g class="compass-needle">'
    '<polygon points="28,10 32,28 28,32 24,28" fill="#1B1AFF"/>'
    '<polygon points="28,46 32,28 28,24 24,28" fill="#1B1AFF" opacity="0.25"/>'
    '<circle cx="28" cy="28" r="3.5" fill="#1B1AFF"/>'
    '</g>'
)


def compass_svg(size):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 56 56" fill="none" '
            f'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">{COMPASS_SVG_INNER}</svg>')


# ─── Load & join (mirrors dashboard/js/filtering.js) ─────────────────────────

def load_json(path):
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def build_source_map(source_rows):
    mapping = {}
    for row in source_rows:
        mapping[row["ref_number"]] = {
            "name": row.get("ref_name", row["ref_number"]),
            "url": row.get("ref_link") or None,
            "company_size": row.get("company_size") or "N/A",
        }
    return mapping


def transform_sources(source_string, source_map):
    if not isinstance(source_string, str) or source_string.strip() in ("", "-"):
        return []
    resolved = []
    for raw in source_string.split(";"):
        ref = raw.strip()
        if not ref:
            continue
        info = source_map.get(ref)
        if info:
            resolved.append({"name": info["name"], "url": info["url"],
                             "company_size": info["company_size"]})
        else:
            resolved.append({"name": ref, "url": None, "company_size": "N/A"})
    return resolved


def clean_text(value):
    if not isinstance(value, str):
        return ""
    return value.replace("�", "").strip()


def build_model(data_rows, source_map):
    categories = {row["id"]: row for row in data_rows if "description" not in row}
    metrics = []
    for row in data_rows:
        if "description" not in row:
            continue
        metric = dict(row)
        metric["name"] = clean_text(row.get("name"))
        metric["description"] = clean_text(row.get("description"))
        metric["alsoknownas"] = clean_text(row.get("alsoknownas"))
        metric["company"] = transform_sources(row.get("company", ""), source_map)
        metric["research"] = transform_sources(row.get("research", ""), source_map)
        metric["top_category"] = top_category_name(row, categories)
        metrics.append(metric)
    return categories, metrics


def top_category_name(metric, categories):
    node = categories.get(metric.get("parent"))
    top = None
    guard = 0
    while node is not None and guard < 20:
        guard += 1
        parent_id = node.get("parent")
        if parent_id is None or parent_id == 9999 or parent_id not in categories:
            top = node
            break
        node = categories.get(parent_id)
    return clean_text(top["name"]) if top else ""


def index_by_facet(metrics, facet, exclude_substrings=()):
    buckets = {}
    for metric in metrics:
        seen = set()
        for source in metric[facet]:
            name = source["name"].strip()
            lower = name.lower()
            if not name or lower in seen:
                continue
            if facet == "research" and "framework" not in lower:
                continue
            if any(sub in lower for sub in exclude_substrings):
                continue
            seen.add(lower)
            buckets.setdefault(name, {"url": source["url"],
                                      "company_size": source.get("company_size", "N/A"),
                                      "metrics": []})
            buckets[name]["metrics"].append(metric)
    return buckets


def top_percentile_ids(metrics, percentile):
    """Mirror getMinMentionsThreshold(): ids of the top N% of metrics by 'value'."""
    values = sorted((m["value"] for m in metrics if m.get("value") is not None),
                    reverse=True)
    if not values:
        return set(), 0
    top_n = math.ceil((percentile / 100) * len(values))
    threshold = values[top_n - 1] if top_n > 0 else 0
    ids = {m["id"] for m in metrics
           if m.get("value") is not None and m["value"] >= threshold}
    return ids, threshold


# ─── HTML helpers ────────────────────────────────────────────────────────────

def esc(value):
    return html.escape(str(value if value is not None else ""), quote=True)


def slugify(value):
    slug = re.sub(r"[^a-z0-9]+", "-", str(value).lower()).strip("-")
    return slug or "page"


def app_link(params):
    """Relative deep link into the live app (../index.html from /seo/)."""
    return "../index.html?" + urlencode(params)


def strip_framework_suffix(name):
    return re.sub(r"\s*Framework\s*$", "", name, flags=re.IGNORECASE).strip()


def company_domain(name):
    """Mirror getCompanyDomainMap() domain derivation in helpers.js."""
    d = name.lower()
    d = re.sub(r"\s*\([^)]*\)", "", d)   # "Amazon (AWS)" -> "amazon"
    d = re.sub(r"/.*", "", d)             # "Twitter/X" -> "twitter"
    d = re.sub(r"[^a-z0-9]", "", d)
    return (d + ".com") if d else None


def company_favicon(name, company_size, size=16):
    """Company favicon <img> (no letter fallback -- broken icon simply removed)."""
    if company_size == "N/A":
        return ""
    domain = company_domain(name)
    if not domain:
        return ""
    src = f"https://www.google.com/s2/favicons?sz=32&domain={domain}"
    return (f'<img class="entity-favicon" src="{esc(src)}" width="{size}" '
            f'height="{size}" alt="" loading="lazy" onerror="this.remove()">')


def source_chip(source, is_company):
    if is_company:
        badge = company_favicon(source["name"], source.get("company_size", "N/A"))
    else:
        badge = '<span class="entity-badge" aria-hidden="true">📄</span>'
    inner = badge + esc(source["name"])
    if source.get("url"):
        return (f'<span class="source-chip"><a href="{esc(source["url"])}" '
                f'target="_blank" rel="noopener nofollow">{inner}</a></span>')
    return f'<span class="source-chip">{inner}</span>'


def source_chips(sources, is_company, exclude_name=None):
    """Chips for sources with a URL. Returns '' when there are none (caller then
    omits the whole row rather than printing a placeholder)."""
    filtered = sorted([s for s in sources if s.get("url") and s["name"] != exclude_name],
                      key=lambda s: s["name"].lower())
    return "".join(source_chip(s, is_company) for s in filtered)


def meta_row(label, chips_html):
    return (f'      <div class="metric-meta"><span class="meta-label">{label}:</span> '
            f'{chips_html}</div>\n') if chips_html else ""


def top_tier_pill(metric):
    if metric["id"] in TOP5_IDS:
        return '<span class="pill pill--top">🏆 Top 5% most-referenced</span>'
    if metric["id"] in TOP10_IDS:
        return '<span class="pill pill--top">🏅 Top 10% most-referenced</span>'
    return ""


def metric_pills(metric):
    pills = [top_tier_pill(metric)]
    if metric.get("outcome_goals"):
        pills.append(f'<span class="pill">'
                     f'{esc(OUTCOME_PILLS.get(metric["outcome_goals"], metric["outcome_goals"]))}</span>')
    ai = AI_PILLS.get(metric.get("ai_specific_category"))
    if ai:
        pills.append(f'<span class="pill">{esc(ai)}</span>')
    return "".join(p for p in pills if p)


COMPANIES_LABEL = "Other companies applying the metric"
RESEARCH_LABEL = "Research recommending the metric"


def metric_href(metric, context_params, page_slugs):
    """Own landing page if the metric has one, else an app deep link with context."""
    own_page = page_slugs.get(metric["id"]) if page_slugs else None
    if own_page:
        return own_page + ".html"
    return app_link({**context_params, "specificMetric": metric["id"]})


def category_pill(metric):
    cat = metric.get("top_category")
    return f'<span class="pill">Category: {esc(cat)}</span>' if cat else ""


def synonyms(metric):
    """'Also known as' names, split from the ';'-separated alsoknownas field."""
    raw = metric.get("alsoknownas") or ""
    return [s.strip() for s in raw.split(";") if s.strip() and s.strip() != "-"]


def tag_row(metric):
    """Category pill followed by the detail pills, all on one uniform row."""
    tags = category_pill(metric) + metric_pills(metric)
    return f'      <div class="metric-pills">{tags}</div>\n' if tags else ""


def metric_card(metric, context_params, page_slugs=None):
    """One metric <li>: title, then the category + detail pills on one row, the
    description, and the two 'others who use/recommend it' lists (omitted when
    there are none)."""
    href = metric_href(metric, context_params, page_slugs)
    comp = source_chips(metric["company"], True, context_params.get("specificCompany"))
    res = source_chips(metric["research"], False, context_params.get("specificFramework"))
    return (
        '    <li class="metric">\n'
        f'      <h3><a href="{esc(href)}">{esc(metric["name"])}</a></h3>\n'
        f'{tag_row(metric)}'
        f'      <p class="metric-desc">{esc(metric["description"])}</p>\n'
        f'{meta_row(COMPANIES_LABEL, comp)}'
        f'{meta_row(RESEARCH_LABEL, res)}'
        "    </li>"
    )


def metric_list_html(metrics, context_params, page_slugs=None, sort=True):
    ordered = sorted(metrics, key=lambda m: m["name"].lower()) if sort else metrics
    rows = [metric_card(m, context_params, page_slugs) for m in ordered]
    return '  <ul class="metric-list">\n' + "\n".join(rows) + "\n  </ul>"


def compact_metric_list(metrics, context_params, page_slugs=None):
    """Name-only list for the comparison diff — no per-metric details."""
    if not metrics:
        return '\n  <p class="muted">None.</p>'
    items = [f'      <li><a href="{esc(metric_href(m, context_params, page_slugs))}">'
             f'{esc(m["name"])}</a></li>'
             for m in sorted(metrics, key=lambda m: m["name"].lower())]
    return '\n  <ul class="diff-list">\n' + "\n".join(items) + "\n  </ul>"


def jsonld_itemlist(name, description, canonical, metrics):
    items = [{"@type": "ListItem", "position": pos, "name": m["name"],
              "description": m["description"]}
             for pos, m in enumerate(sorted(metrics, key=lambda m: m["name"].lower()), 1)]
    payload = {
        "@context": "https://schema.org", "@type": "ItemList",
        "name": name, "description": description, "url": canonical,
        "numberOfItems": len(metrics), "itemListElement": items,
    }
    return _jsonld(payload)


def _jsonld(payload):
    return ('  <script type="application/ld+json">\n'
            + json.dumps(payload, ensure_ascii=False, indent=2) + "\n  </script>")


def meta_desc(text, limit=160):
    text = " ".join(str(text).split())
    return text if len(text) <= limit else text[:limit - 1].rstrip() + "…"


def render_page(*, slug, title, description, h1_html, intro_html, cta_href,
                cta_label, body_html, jsonld_html, related_html, keywords=None):
    canonical = BASE_URL + "seo/" + slug + ".html"
    og_image = BASE_URL + "assets/favicon.png"
    keywords_html = (f'\n  <meta name="keywords" content="{esc(", ".join(keywords))}">'
                     if keywords else "")
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{esc(title)}</title>
  <meta name="description" content="{esc(description)}">{keywords_html}
  <link rel="canonical" href="{esc(canonical)}">
  <link rel="icon" type="image/png" href="../assets/favicon.png">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="{esc(SITE_NAME)}">
  <meta property="og:title" content="{esc(title)}">
  <meta property="og:description" content="{esc(description)}">
  <meta property="og:url" content="{esc(canonical)}">
  <meta property="og:image" content="{esc(og_image)}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="{esc(title)}">
  <meta name="twitter:description" content="{esc(description)}">
  <link rel="stylesheet" href="seo.css">
{jsonld_html}
</head>
<body>
{header_html()}
  <main>
    <h1>{h1_html}</h1>
    {intro_html}
    <p class="cta"><a class="cta-btn" href="{esc(cta_href)}">{esc(cta_label)}</a></p>
{body_html}
{related_html}
  </main>
{footer_html()}
</body>
</html>
"""


def header_html():
    return (f'  <header class="site-header">\n'
            f'    <a class="brand" href="../index.html">{compass_svg(26)}'
            f'<span class="brand-title">DevEx Metrics Compass</span></a>\n'
            f'  </header>')


def footer_html():
    """Mirrors the app's footer, plus the author credit from the About overlay —
    named authors are also an authorship signal for search engines."""
    return (
        '  <footer class="site-footer">\n'
        '    <div><a href="../index.html">Open the interactive Compass</a> &bull; '
        '<a href="index.html">All metric collections</a> &bull; '
        '<a href="../index.html?reportMissing=metric">Report something missing</a></div>\n'
        '    <div>Created at <a href="https://hasel.dev" target="_blank" rel="noopener">HASEL</a>, '
        '<a href="https://uzh.ch" target="_blank" rel="noopener">University of Zurich</a> by '
        '<a href="mailto:ameyer@ifi.uzh.ch">Meyer</a>, Meyer, Murphy &amp; Fritz</div>\n'
        '    <div class="footer-disclaimer">Provided for research and informational use only '
        '&bull; Based on a literature review, not exhaustive</div>\n'
        '  </footer>'
    )


def related_block(title, links):
    if not links:
        return ""
    items = "\n".join(f'      <li><a href="{esc(href)}">{esc(label)}</a></li>'
                      for href, label in links)
    return ('  <nav class="related">\n'
            f'    <h2>{esc(title)}</h2>\n    <ul>\n' + items + "\n    </ul>\n  </nav>")


# ─── Page builders ───────────────────────────────────────────────────────────

def build_framework_page(name, bucket, all_frameworks, page_slugs):
    metrics = bucket["metrics"]
    short = strip_framework_suffix(name)
    slug = slugify(short + "-framework-metrics")
    count = len(metrics)
    title = f"{count} Developer Experience Metrics in the {name} | {SITE_NAME}"
    description = (f"Explore the {count} developer experience metrics associated with the "
                  f"{name} in research and industry. Open the interactive DevEx Metrics "
                  f"Compass pre-filtered to {short}.")
    h1_html = f"{count} Developer Experience Metrics in the {esc(name)}"
    ref = bucket.get("url")
    ref_html = (f' See the <a href="{esc(ref)}" target="_blank" rel="noopener nofollow">'
                f'{esc(short)} source</a>.' if ref else "")
    intro_html = (f'<p>The <strong>{esc(name)}</strong> is referenced by '
                  f'<strong>{count}</strong> developer experience metrics in the DevEx '
                  f'Metrics Compass, a curated catalogue of DevEx metrics from academic '
                  f'research and industry practice.{ref_html}</p>')
    cta_href = app_link({"specificFramework": name})
    cta_label = f"Open these {short} metrics in the interactive Compass →"
    canonical = BASE_URL + "seo/" + slug + ".html"
    context = {"specificFramework": name}
    related = [(slugify(strip_framework_suffix(o) + "-framework-metrics") + ".html",
                f"{strip_framework_suffix(o)} framework metrics")
               for o in all_frameworks if o != name]

    page = render_page(
        slug=slug, title=title, description=description, h1_html=h1_html,
        intro_html=intro_html, cta_href=cta_href, cta_label=cta_label,
        body_html=metric_list_html(metrics, context, page_slugs),
        jsonld_html=jsonld_itemlist(strip_framework_suffix(name) + " metrics",
                                    description, canonical, metrics),
        related_html=related_block("Other frameworks", related),
    )
    return slug, page


def build_company_page(name, bucket, other_companies, page_slugs):
    metrics = bucket["metrics"]
    slug = slugify(name + "-devex-metrics")
    count = len(metrics)
    size = bucket.get("company_size", "Enterprise")
    title = f"{count} Developer Experience Metrics used at {name} | {SITE_NAME}"
    description = (f"Discover the {count} developer experience metrics reportedly used at "
                  f"{name}. Open the interactive DevEx Metrics Compass pre-filtered to {name}.")
    logo = company_favicon(name, size if size != "N/A" else "Enterprise", size=30)
    h1_html = (f'{count} Developer Experience Metrics used at '
               f'<span class="entity-inline">{logo}{esc(name)}</span>')
    intro_html = (f'<p><strong>{esc(name)}</strong> is associated with '
                  f'<strong>{count}</strong> developer experience metrics in the DevEx '
                  f'Metrics Compass, a curated catalogue of DevEx metrics from academic '
                  f'research and industry practice.</p>')
    cta_href = app_link({"specificCompany": name})
    cta_label = f"Open {name}'s metrics in the interactive Compass →"
    canonical = BASE_URL + "seo/" + slug + ".html"
    context = {"specificCompany": name}
    related = [(slugify(o + "-devex-metrics") + ".html", f"Metrics used at {o}")
               for o in other_companies]

    page = render_page(
        slug=slug, title=title, description=description, h1_html=h1_html,
        intro_html=intro_html, cta_href=cta_href, cta_label=cta_label,
        body_html=metric_list_html(metrics, context, page_slugs),
        jsonld_html=jsonld_itemlist(f"Metrics used at {name}", description, canonical, metrics),
        related_html=related_block("Metrics at other companies", related),
    )
    return slug, page


def build_metric_page(metric, slug, sibling_links):
    name = metric["name"]
    title = f"{name} — Developer Experience Metric | {SITE_NAME}"
    description = meta_desc(f"{name}: {metric['description']}")
    h1_html = esc(name)
    syns = synonyms(metric)
    intro_html = f'<p class="metric-lead">{esc(metric["description"])}</p>'

    cta_href = app_link({"specificMetric": metric["id"]})
    cta_label = "Open this metric in the interactive Compass →"
    canonical = BASE_URL + "seo/" + slug + ".html"

    # Everything sits inside the white card so the pills read as pills against it.
    # "Also known as" comes last (the synonyms also go into the keywords meta + JSON-LD).
    inner = (tag_row(metric)
             + meta_row(COMPANIES_LABEL, source_chips(metric["company"], True))
             + meta_row(RESEARCH_LABEL, source_chips(metric["research"], False))
             + meta_row("Also known as", esc("; ".join(syns)) if syns else ""))
    body = f'  <div class="metric-detail-block">\n{inner}  </div>' if inner else ""

    payload = {
        "@context": "https://schema.org", "@type": "DefinedTerm",
        "name": name, "description": metric["description"], "url": canonical,
        "inDefinedTermSet": {"@type": "DefinedTermSet", "name": SITE_NAME, "url": BASE_URL},
    }
    if syns:
        payload["alternateName"] = syns
    jsonld = _jsonld(payload)
    keywords = [name] + syns + ["developer experience metric", "DevEx metric"]
    page = render_page(
        slug=slug, title=title, description=description, h1_html=h1_html,
        intro_html=intro_html, cta_href=cta_href, cta_label=cta_label,
        body_html=body, jsonld_html=jsonld, keywords=keywords,
        related_html=related_block("Other most-referenced metrics", sibling_links),
    )
    return page


def facet_bucket_for(side, framework_index, company_index):
    if side["type"] == "framework":
        return framework_index.get(side["value"])
    if side["type"] == "company":
        return company_index.get(side["value"])
    return None


def build_comparison_page(cfg, framework_index, company_index, page_slugs):
    left, right = cfg["left"], cfg["right"]
    left_bucket = facet_bucket_for(left, framework_index, company_index)
    right_bucket = facet_bucket_for(right, framework_index, company_index)
    if not left_bucket or not right_bucket:
        return None
    label = cfg["label"]
    slug = slugify(label + "-devex-metrics")
    left_metrics, right_metrics = left_bucket["metrics"], right_bucket["metrics"]
    left_label = strip_framework_suffix(left["value"])
    right_label = strip_framework_suffix(right["value"])

    by_id = {m["id"]: m for m in left_metrics + right_metrics}
    left_ids = {m["id"] for m in left_metrics}
    right_ids = {m["id"] for m in right_metrics}
    shared = [by_id[i] for i in left_ids & right_ids]
    left_only = [by_id[i] for i in left_ids - right_ids]
    right_only = [by_id[i] for i in right_ids - left_ids]

    title = f"{label} — Developer Experience Metrics | {SITE_NAME}"
    description = (f"{label}: {len(shared)} shared developer experience metrics, "
                  f"{len(left_only)} unique to {left_label} and {len(right_only)} unique to "
                  f"{right_label}. See the diff and open it in the interactive Compass.")
    intro_html = (f'<p>How the developer experience metrics associated with '
                  f'<strong>{esc(left_label)}</strong> and <strong>{esc(right_label)}</strong> '
                  f'overlap and differ: <strong>{len(shared)}</strong> shared, '
                  f'<strong>{len(left_only)}</strong> unique to {esc(left_label)}, '
                  f'<strong>{len(right_only)}</strong> unique to {esc(right_label)}.</p>')
    context = {"step": "compare", "leftType": left["type"], "leftValue": left["value"],
               "rightType": right["type"], "rightValue": right["value"]}
    cta_href = app_link(context)
    cta_label = "Open this comparison in the interactive Compass →"
    canonical = BASE_URL + "seo/" + slug + ".html"

    def group(heading, cls, group_metrics):
        inner = compact_metric_list(group_metrics, context, page_slugs)
        return (f'  <section class="diff-group {cls}">\n'
                f'    <h2>{heading} <span class="diff-count">{len(group_metrics)}</span></h2>'
                f'{inner}\n  </section>')

    body = "\n".join([
        group(f"Shared by {esc(left_label)} and {esc(right_label)}", "diff-shared", shared),
        group(f"Only in {esc(left_label)}", "diff-left", left_only),
        group(f"Only in {esc(right_label)}", "diff-right", right_only),
    ])
    all_metrics = list(by_id.values())
    page = render_page(
        slug=slug, title=title, description=description, h1_html=esc(label),
        intro_html=intro_html, cta_href=cta_href, cta_label=cta_label,
        body_html=body,
        jsonld_html=jsonld_itemlist(label, description, canonical, all_metrics),
        related_html="",
    )
    return slug, page


def build_index_page(metric_entries, framework_entries, company_entries, comparison_entries):
    def section(heading, entries):
        items = "\n".join(
            f'        <li><a href="{esc(slug)}.html">{badge}{esc(label)}</a></li>'
            for slug, label, badge in entries)
        return (f'    <section class="index-section">\n      <h2>{esc(heading)}</h2>\n'
                f'      <ul>\n{items}\n      </ul>\n    </section>')

    body = "\n".join([
        section("Most-referenced metrics (top 10%)", metric_entries),
        section("By framework", framework_entries),
        section("By company", company_entries),
        section("Comparisons", comparison_entries),
    ])
    title = f"DevEx Metric Collections | {SITE_NAME}"
    description = ("Browse curated collections of developer experience metrics: the most-"
                  "referenced metrics, by research framework (SPACE, DORA, DX Core 4) and by "
                  "company (Microsoft, Google, and more).")
    canonical = BASE_URL + "seo/index.html"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{esc(title)}</title>
  <meta name="description" content="{esc(description)}">
  <link rel="canonical" href="{esc(canonical)}">
  <link rel="icon" type="image/png" href="../assets/favicon.png">
  <meta property="og:type" content="website">
  <meta property="og:title" content="{esc(title)}">
  <meta property="og:description" content="{esc(description)}">
  <meta property="og:url" content="{esc(canonical)}">
  <link rel="stylesheet" href="seo.css">
</head>
<body>
{header_html()}
  <main>
    <h1>Developer Experience Metric Collections</h1>
    <p>Curated collections of developer experience metrics drawn from research and industry.
       Each collection opens in the interactive
       <a href="../index.html">DevEx Metrics Compass</a>.</p>
    <div class="index-grid">
{body}
    </div>
  </main>
{footer_html()}
</body>
</html>
"""


SEO_CSS = """/* Static SEO landing pages for the DevEx Metrics Compass. Generated file.
   Colors and type mirror the app's design language (brand #1B1AFF, bg #f0f0f0). */
* { box-sizing: border-box; }
/* Sticky footer: body is a column flex box and main grows, so the footer sits at
   the bottom of the viewport on short pages and is pushed down on long ones. */
body { margin: 0; font-family: Helvetica, Arial, sans-serif; color: #333;
       background-color: #f0f0f0; line-height: 1.55;
       display: flex; flex-direction: column; min-height: 100vh; }
a { color: #1B1AFF; }
.site-header { background: #fff; border-bottom: 1px solid #e0e0e0; padding: 12px 24px; }
.brand { display: inline-flex; align-items: center; gap: 8px; text-decoration: none; }
.brand-title { font-size: 20px; font-weight: 700; color: #1B1AFF; }
main { max-width: 960px; width: 100%; margin: 0 auto; padding: 24px; flex: 1; }
h1 { font-size: 1.9rem; line-height: 1.3; color: #222; }
h2 { font-size: 1.3rem; margin-top: 2rem; color: #222; }
.entity-inline { display: inline-flex; align-items: center; gap: 8px; vertical-align: middle;
                 margin-left: 8px; white-space: nowrap; }
.cta { margin: 1.5rem 0; }
.cta-btn { display: inline-block; background: #1B1AFF; color: #fff; text-decoration: none;
           padding: 12px 28px; border-radius: 40px; font-weight: 600; font-size: 16px; }
.cta-btn:hover { background: #0f0ecc; }
.metric-lead { font-size: 1.05rem; color: #444; }
.metric-detail-block { background: #fff; border: 1px solid #e0e0e0; border-radius: 12px;
                       padding: 18px; margin-top: 1rem; }
.metric-detail-block .metric-pills { margin: 0 0 4px; }
.metric-list { list-style: none; padding: 0; margin: 1.5rem 0; }
.metric { background: #fff; border: 1px solid #e0e0e0; border-radius: 12px;
          padding: 16px 18px; margin-bottom: 12px; }
.metric h3 { margin: 0 0 6px; font-size: 1.1rem; display: flex; align-items: baseline;
             gap: 10px; flex-wrap: wrap; }
.metric h3 a { color: #1B1AFF; text-decoration: none; }
.metric h3 a:hover { text-decoration: underline; }
.metric-desc { margin: 0 0 10px; color: #555; }
.metric-meta { font-size: 0.86rem; color: #555; margin: 14px 0 0; display: flex;
               align-items: center; flex-wrap: wrap; gap: 4px 10px; }
.meta-label { font-weight: 700; color: #444; }
.muted { color: #999; }
.metric-pills { margin: 8px 0 10px; display: flex; align-items: center; flex-wrap: wrap;
                gap: 6px; }
.pill { display: inline-flex; align-items: center; height: 22px; padding: 0 10px;
        background-color: #f0f0f0; border-radius: 40px; font-size: 12px; color: #555;
        white-space: nowrap; }
.pill--top { background: #e8eafd; color: #1B1AFF; font-weight: 700; }
.source-chip { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.source-chip a { display: inline-flex; align-items: center; gap: 4px; color: #1B1AFF;
                 text-decoration: none; }
.source-chip a:hover { text-decoration: underline; }
.entity-favicon { display: inline-block; border-radius: 2px; object-fit: contain;
                  vertical-align: middle; }
.entity-badge { display: inline-block; font-size: 11px; line-height: 1; }
.diff-group { margin-top: 1.5rem; }
.diff-group h2 { display: flex; align-items: center; gap: 8px; padding-left: 10px;
                 border-left: 4px solid #ccc; }
.diff-shared h2 { border-left-color: #1B1AFF; }
.diff-left h2 { border-left-color: #34a853; }
.diff-right h2 { border-left-color: #ea8600; }
.diff-count { font-size: 0.8rem; font-weight: 700; color: #fff; background: #999;
              border-radius: 999px; padding: 1px 9px; }
.diff-shared .diff-count { background: #1B1AFF; }
.diff-left .diff-count { background: #34a853; }
.diff-right .diff-count { background: #ea8600; }
.diff-list { list-style: none; padding: 0 0 0 14px; margin: 0.6rem 0; columns: 2; }
.diff-list li { margin-bottom: 5px; break-inside: avoid; }
.diff-list li a { color: #1B1AFF; text-decoration: none; }
.diff-list li a:hover { text-decoration: underline; }
.index-grid { display: block; }
.index-section ul { columns: 2; list-style: none; padding: 0; }
.index-section li { margin-bottom: 6px; break-inside: avoid; }
.index-section li a { display: inline-flex; align-items: center; gap: 6px; text-decoration: none; }
.index-section li a:hover { text-decoration: underline; }
.li-badge { display: inline-flex; }
.related { margin-top: 2.5rem; border-top: 1px solid #e0e0e0; padding-top: 1rem; }
.related ul { columns: 2; }
.site-footer { border-top: 1px solid #e0e0e0; background: #fafafa; padding: 12px 24px;
               color: #999; font-size: 12px; text-align: center; }
.site-footer a { color: #999; }
.site-footer a:hover { color: #1B1AFF; }
/* All three footer lines share one line-height — no extra margin on any of them,
   otherwise the gaps between the lines read as uneven. */
.site-footer > div { line-height: 1.6; }
@media (max-width: 640px) { .index-section ul, .related ul { columns: 1; } }
"""


# ─── Sitemap & robots ────────────────────────────────────────────────────────

def write_sitemap(slugs):
    today = date.today().isoformat()
    urls = [BASE_URL, BASE_URL + "seo/index.html"]
    urls += [BASE_URL + "seo/" + slug + ".html" for slug in slugs]
    entries = "\n".join(
        f"  <url>\n    <loc>{esc(url)}</loc>\n    <lastmod>{today}</lastmod>\n  </url>"
        for url in urls)
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
           + entries + "\n</urlset>\n")
    with open(os.path.join(DASHBOARD_DIR, "sitemap.xml"), "w", encoding="utf-8") as fh:
        fh.write(xml)


def write_robots():
    txt = f"User-agent: *\nAllow: /\n\nSitemap: {BASE_URL}sitemap.xml\n"
    with open(os.path.join(DASHBOARD_DIR, "robots.txt"), "w", encoding="utf-8") as fh:
        fh.write(txt)


# ─── Main ────────────────────────────────────────────────────────────────────

def write_page(slug, content):
    with open(os.path.join(SEO_DIR, slug + ".html"), "w", encoding="utf-8") as fh:
        fh.write(content)


def main():
    global TOP5_IDS, TOP10_IDS
    data_rows = load_json(os.path.join(DATA_DIR, "data.json"))
    source_rows = load_json(os.path.join(DATA_DIR, "source_ids.json"))
    source_map = build_source_map(source_rows)
    _categories, metrics = build_model(data_rows, source_map)

    TOP10_IDS, _ = top_percentile_ids(metrics, 10)
    TOP5_IDS, _ = top_percentile_ids(metrics, 5)

    framework_index = index_by_facet(metrics, "research")
    company_index = index_by_facet(metrics, "company",
                                   exclude_substrings=COMPANY_EXCLUDE_SUBSTRINGS)

    os.makedirs(SEO_DIR, exist_ok=True)
    # Clear previously generated pages so renamed/removed slugs don't linger.
    for old in os.listdir(SEO_DIR):
        if old.endswith(".html"):
            os.remove(os.path.join(SEO_DIR, old))
    with open(os.path.join(SEO_DIR, "seo.css"), "w", encoding="utf-8") as fh:
        fh.write(SEO_CSS)

    all_slugs = []

    # Per-metric pages for the top 10% (most-referenced) metrics.
    top_metrics = sorted([m for m in metrics if m["id"] in TOP10_IDS],
                         key=lambda m: (-(m.get("value") or 0), m["name"].lower()))
    page_slugs = {}
    used = set()
    for m in top_metrics:
        slug = slugify(m["name"]) + "-metric"
        while slug in used:
            slug = f'{slugify(m["name"])}-{m["id"]}-metric'
        used.add(slug)
        page_slugs[m["id"]] = slug

    metric_entries = []
    for m in top_metrics:
        slug = page_slugs[m["id"]]
        siblings = [(page_slugs[o["id"]] + ".html", o["name"])
                    for o in top_metrics if o["id"] != m["id"]][:8]
        write_page(slug, build_metric_page(m, slug, siblings))
        all_slugs.append(slug)
        badge = ('<span class="li-badge">🏆</span>' if m["id"] in TOP5_IDS
                 else '<span class="li-badge">🏅</span>')
        metric_entries.append((slug, m["name"], badge))

    # Frameworks
    eligible_frameworks = sorted(
        [n for n, b in framework_index.items() if len(b["metrics"]) >= FRAMEWORK_MIN_METRICS])
    framework_entries = []
    for name in eligible_frameworks:
        slug, page = build_framework_page(name, framework_index[name], eligible_frameworks,
                                          page_slugs)
        write_page(slug, page)
        all_slugs.append(slug)
        framework_entries.append(
            (slug, f"{strip_framework_suffix(name)} ({len(framework_index[name]['metrics'])})",
             '<span class="li-badge">📄</span>'))

    # Companies
    eligible_companies = sorted(
        [n for n, b in company_index.items() if len(b["metrics"]) >= COMPANY_MIN_METRICS],
        key=lambda n: (-len(company_index[n]["metrics"]), n.lower()))
    company_entries = []
    for name in eligible_companies:
        others = [o for o in eligible_companies if o != name][:8]
        slug, page = build_company_page(name, company_index[name], others, page_slugs)
        write_page(slug, page)
        all_slugs.append(slug)
        size = company_index[name].get("company_size", "Enterprise")
        badge = company_favicon(name, size if size != "N/A" else "Enterprise", size=16)
        company_entries.append(
            (slug, f"{name} ({len(company_index[name]['metrics'])})",
             f'<span class="li-badge">{badge}</span>' if badge else ""))

    # Comparisons
    comparison_entries = []
    for cfg in COMPARISONS:
        built = build_comparison_page(cfg, framework_index, company_index, page_slugs)
        if not built:
            print(f"Skipped comparison '{cfg['label']}': a side has no metrics.")
            continue
        slug, page = built
        write_page(slug, page)
        all_slugs.append(slug)
        comparison_entries.append((slug, cfg["label"], ""))

    # Index
    write_page("index", build_index_page(metric_entries, framework_entries,
                                         company_entries, comparison_entries))

    write_sitemap(all_slugs)
    write_robots()

    print(f"Generated {len(all_slugs)} landing pages + index into {SEO_DIR}")
    print(f"  top-metric pages: {len(metric_entries)}  frameworks: {len(framework_entries)}  "
          f"companies: {len(company_entries)}  comparisons: {len(comparison_entries)}")
    print("Wrote sitemap.xml and robots.txt to", DASHBOARD_DIR)


if __name__ == "__main__":
    main()
