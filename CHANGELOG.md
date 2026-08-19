# Changelog

## 2026-08-19 — SEO landing pages moved from `/seo/` to `/library/`

- The static landing pages now live under `compass/library/` and are served from `https://devexcompass.com/library/…`. A path segment named "seo" carries no ranking penalty, but it reads as SEO bait to anyone who sees the URL in a search result or a shared link, which costs clicks and inbound links — the signals that do matter. `/library/` describes what the pages actually are, and one folder keeps the deploy simple.
- `dataset/generate_seo_pages.py`: the canonical/sitemap URL prefix is now the constant `LIBRARY_URL` instead of `BASE_URL + "seo/"` repeated in eight places; the generated stylesheet is `library.css`.
- `compass/.htaccess`: added `RewriteRule ^seo/(.*)$ /library/$1 [R=301,L]` so already-indexed `/seo/` URLs, and any links shared before the move, redirect to their `/library/` counterpart instead of 404ing.
- `compass/js/url-state.js`: the landing-page referrer check matches `/library/` (it drives the `fromSeo` / `seoPage` entry-point tracking, which silently stopped firing otherwise).

## 2026-08-19 — The plain homepage URL no longer picks up default state

- Opening the Compass rewrote the address bar to `?role=…&leftType=shortlist&leftValue=shortlist` before the visitor had chosen anything: Step 2's left dropdown defaults to "My metrics shortlist", and `initCompareControls()` copied that DOM default into `compareState`, which the URL sync then treated as a real selection. A new `compareSelectionMade` flag (`state.js`) keeps the compare parameters out of the URL until the selection is actually the user's — set by the Step 2 dropdowns, the presets, and the URL restore, but not by the init-time DOM sync.
- A URL whose only state is `?role=…` no longer suppresses the welcome overlay, and no longer counts as URL state in `restoreStateFromUrl()`. Since the role is live-synced into the address bar for anyone with a saved role, such links are almost always someone copying their own address bar rather than sharing a view — so first-time visitors following them now get the welcome page. The role is still applied (filter layout and badge), and links carrying any other state — `/paper-step1`, `/paper-step2`, metric, comparison, filter, and shortlist links — are unaffected.

## 2026-08-19 — Paper integrated into the welcome page, About, and README

- Welcome overlay: replaced the "How was the Compass created?" / "Who created the compass?" toggles with a light-blue banner pointing to the ACM Queue article. Both toggles duplicated text that already exists in the About overlay, so the banner shortens the overlay while making the paper the authoritative answer to how the Compass was built.
- About overlay: added a "The paper behind the Compass" section (after "How we created the Compass") with the full citation and DOI.
- `README.md`: added a "Paper" section with the citation, DOI, short link, and a collapsible BibTeX block; the dataset attribution note now also points at the paper.
- Added `CITATION.cff` so GitHub shows a native "Cite this repository" button.
- `compass/.htaccess`: `/paper` now redirects to the published ACM Queue article instead of a local PDF that was never committed, and the `/contribute` redirect was restored after it was lost in a sync from the server.

## 2026-08-19 — Compass paper published in ACM Queue

- The paper behind the DevEx Metrics Compass is out in ACM Queue. It is linked from the app via <https://devexcompass.com/paper>, which redirects to the article on the ACM site; the `/paper-step1`, `/paper-step2`, and `/paper-step3` links printed in the paper open the matching step of the app.

## 2026-07-28 — Paper redirects

- Added `compass/.htaccess` with four permanent redirects for links printed in the paper: `/paper` to the paper PDF, and `/paper-step1`, `/paper-step2`, `/paper-step3` to the matching step of the app (with filter/compare state on the query string).

## 2026-07-28 — Step 2 grouping in the URL, plus an alphabetical grouping

- The Step 2 grouping dimension (Category, Outcome goals, Maturity, Data collection type, AI impact) is now part of the shareable URL as `?sort=`, so a shared or bookmarked comparison reopens with the same grouping instead of falling back to Category. The default (Category) stays out of the URL.
- Added an "Alphabetical" grouping as the sixth Step 2 sort card, filling the empty slot in the 2-column grid. It groups metric names into four letter ranges (A–C, D–F, G–P, Q–Z) rather than per-letter, so the mini chart stays readable; the ranges are uneven because metric names cluster in A–F.

## 2026-07-27 — Repo folders renamed: `compass/` and `dataset/`

- Renamed `dashboard/` to `compass/` and `metrics and parser/` to `dataset/` (no more space in the path). Purely a repo-layout change: the deployed site is unaffected, since `compass/`'s contents are uploaded to the web root as before.
- Updated `generate_seo_pages.py` (its `COMPASS_DIR` path constant), `.gitignore`, `CLAUDE.md`, and both READMEs to match. Entries below this one refer to the old folder names.

## 2026-07-13 — Usable on tablets and small laptops; graceful phone message

- Below 768px (phones), the app now shows a short "best viewed on a larger screen" message instead of a broken layout, since the sunburst and side-by-side comparison need a wider screen. All iPads and larger pass through to the full app.
- On tablets and small laptops (up to 1100px), the layout adapts: the sidebar narrows, the 3-step bar wraps and condenses, the metric detail popup becomes fluid (no more forced horizontal scrolling), and the footer/shortlist pills reflow to avoid overlap.
- On narrower tablets, the Step 3 "Already tracking" and "Plan to track" columns stack vertically so each list stays readable.
- The desktop layout (above 1100px) is unchanged.

## 2026-07-10 — SEO: static landing pages and homepage meta tags

- Added `metrics and parser/generate_seo_pages.py`, a stdlib-only generator that reads the app's `data.json`/`source_ids.json` and emits static, crawlable landing pages into `dashboard/seo/` — one per research framework (SPACE, DORA, DX Core 4, …), one per company above a metric threshold (Microsoft, Google, …), one per top-10% (most-referenced) metric, diff-style comparison pages matching the app's Compare presets (Google vs Microsoft, SPACE vs DORA, …), and an index.
- Landing pages match the Compass design language (brand color, compass logo, footer) and show the same company favicons and research chips as the app (labelled as the other companies applying / research recommending each metric), plus a trimmed set of detail pills (outcome goal, AI category, and a top-5%/top-10% "most-referenced" badge). Comparison pages are a name-only diff (shared / unique to each side), mirroring the app's Step 2 diff view.
- Each page carries real metric content plus a CTA that opens the live app pre-filtered via deep-link URL state; metric links include their filter context, and a bare `?metric=<id>` link now dismisses the welcome overlay too, so shared/landing links land on the intended view instead of the blank start screen.
- Generated `dashboard/sitemap.xml` and `dashboard/robots.txt`.
- Added meta description, Open Graph/Twitter tags, canonical URL, and `WebApplication` JSON-LD to `dashboard/index.html`; fixed the favicon MIME type. Regenerate the SEO pages after each `parser.py` run and upload the `seo/` folder, `sitemap.xml`, and `robots.txt`.

## 2026-07-08 — Broadened reporting: metrics, companies, and research/frameworks

- Renamed "Report a missing metric" to "Report something missing" and generalized the report form: a subject picker lets people report a missing metric, a missing company, or a missing research publication/framework, each with tailored wording and reference prompts.
- Added report entry points where gaps surface: a "Report a missing company" item at the bottom of the company filter dropdown, a "Report a missing publication / framework" item in the research framework dropdown, a link in the Step 1 "no metrics match" empty state, and an in-app link in the About page.
- Reporting an issue with an existing metric (from the metric detail popup) is unchanged.

## 2026-07-08 — Shareable URL state for filters, role, step, compare, and metrics

- Step 1 filters/role, Step 2 compare selection, the current step, and the open metric popup now live-sync to the URL via `history.replaceState`, so the address bar is always a valid link to the current view.
- Added "Copy shareable link" (Step 3) to share just the shortlist (split into `shortlist_current`/`shortlist_planned` to preserve tracking status), and "Copy link to this metric" inside the metric detail popup — both scoped to just their own data, not the ambient live state.
- Opening a shared shortlist link merges into the recipient's existing shortlist (confirm to proceed, cancel to do nothing); loads directly with no prompt if their shortlist is empty.
- Renamed "Clear selection" to "Clear shortlist" for consistency with existing terminology; reworked the Step 3 export-row button layout and added hover tooltips.
- Removed dead `MODE`/`currentMode` state (superseded by role-based onboarding and step-based navigation).

## 2026-07-06 — Refined the per-role onboarding questions

- Newcomers are now asked their outcome goal before the data-collection question, so the wizard leads with intent rather than mechanics.
- The Practitioner "quick questions" path is down to three questions (measurement maturity, outcome goal, AI interest); the data-collection question is no longer asked of practitioners, who already have measurement in place.
- Reworded the data-collection question ("How would you like to collect metrics?") and its options to read as a collection preference rather than a passive "what do you have access to".

## 2026-07-03 — Company size added as a Step 2 comparison dimension

- The Step 2 "Custom comparison" dropdowns now include "Company size" alongside Company, Framework, Maturity, and Outcome goals, so users can compare e.g. Enterprise-tracked metrics vs Mid-size-tracked metrics.

## 2026-07-03 — AI impact metric, Outcome goal, and Company size filters are now multi-select

- These filters no longer restrict to a single value at a time. Each option is now an independent toggle, so users can combine any subset (e.g. "AI impact" + "AI cost", or "Enterprise" + "Large") and see exact matches only.
- Selecting every option in a group automatically collapses back to "All"; deselecting the last active option also reverts to "All" rather than showing zero results — same behavior already shipped for the "Collection maturity" filter.

## 2026-07-02 — Collection maturity filter is now multi-select

- The "Collection maturity" filter (Easy / Moderate / Complex) no longer works cumulatively (e.g. "Moderate" used to also include "Easy" results). Each tier is now an independent toggle, so users can combine any subset (e.g. Easy + Complex) and see exact matches only.
- Selecting all three tiers automatically collapses back to "All"; deselecting the last active tier also reverts to "All" rather than showing zero results.

## 2026-07-02 — Fixed incorrect "all planned metrics" collection-effort insight

- The "All planned metrics require significant collection effort" insight chip could fire even when only some planned metrics were actually rated "Complex" (as long as none were rated "Easy"). It now only appears when every planned metric is "Complex"; the existing "Most planned metrics..." chip still covers the 60%+ case.

## 2026-07-02 — First-time hint pointing at a clickable metric

- Added a one-time hint (curved arrow + "click for details" note) pointing at the most-mentioned metric in the current view, to teach that individual metrics in the outer ring are clickable
- Shown only until the user clicks any metric segment for the first time, then never again (persisted via localStorage)

## 2026-07-02 — Refined the role-based onboarding flow

- Grouped the filter sidepanel into titled boxes (role status, key filters with active-filter pills, advanced filters, chart coloring), tuned per-role filter visibility and quick questions, and reworded several onboarding prompts based on user feedback

## 2026-07-01 — Role-based onboarding redesigned into a single sidepanel wizard

- Replaced the flat 4-option "How would you like to start?" screen with a role-first flow: pick Newcomer/Practitioner/Researcher, then answer role-specific questions, embedded directly in the sidepanel instead of a separate modal
- Chart stays blurred but updates live behind the blur as each question is answered, then unblurs once the flow finishes
- Newcomer path shortened to 2 questions (data access, outcome goal); measurement maturity is now assumed "Getting started" automatically and hidden from the newcomer's filter panel
- Practitioner/Researcher get a shared "how would you like to get started?" menu: start from scratch, explore by filtering, answer a couple of quick questions, benchmark against a company, benchmark against a framework, or import a previous export
- Practitioner's quick questions expanded to include company size and AI-assisted development interest
- Filter panel now adapts per role: relevant filters shown by default, less relevant ones (and anything already answered via the wizard) collapse into a new "More filters" expander
- AI impact metrics filter is hidden entirely for Newcomers; the "appears in research/industry/both" filter always sorts last
- Filter group headers simplified: removed the separate blue title above each "Filter by ...:" description
- "Restart wizard" replaced by a persistent "Exploring as [Role] · Change role" indicator

## 2026-07-01 — Clearer goal messaging, shortlist indicator, feedback relocation

- Welcome overlay reordered so the problem statement is followed directly by the goal statement and a step-strip intro; step pills are no longer clickable (first-time visitors now always go through "Start exploring metrics")
- Explore step's cold-start hint reworded to "Filter to your context, then mark what you track or plan to track"; hint text made slightly larger across all steps
- Added a small brand icon next to the "DevEx Metrics Compass" title
- Shortlist summary ("My metrics shortlist") moved from the meta row into an animated pill indicator fixed top-right, with a bump animation on add/remove; hover popup preserved and now centered over the pills
- Feedback widget (thumbs up/down) moved from a fixed top-right position into the footer, appearing as a small popup above the footer bar when expanded
- Renamed "Save comparison to PDF" button to "Save comparison to PDF Report"

## 2026-06-29 — Comparison legend, UI refinements, and security fix

- Comparison sidebar legend now shows "Left (type) VS Right (type)" instead of item counts, using violet/green coloring to match the compare view
- Blur effect on the chart is now limited to step 1 only (while "How would you like to start?" is shown)
- Unmapped source references are now hidden in metric popups and next-steps cards
- Security: replaced substring-based `check_origin()` host check with `parse_url()` exact match to prevent CSRF bypass (e.g. `evil-hasel.dev` no longer passes when the server host is `hasel.dev`)

## 2026-06-19 — Anonymized telemetry logging

- Added server-side telemetry logger (`api/telemetry.php`) that records anonymized events (IP last octet zeroed, no cookies, ephemeral session ID)
- Logs 28 event types: page load, step navigation, filter changes, keyword search, metric opens/adds/removes, wizard flow, predefined list usage, compare interactions, PDF/JSON exports, feedback and metric reports
- Browser family and referrer domain detected once on page load; all events fire-and-forget with no effect on UI
- `metric_added` events include a `source` field distinguishing manual selection from company preset and JSON import
- Rate limits: telemetry 2000/hr, feedback 5/hr, metric reports 20/hr (each in separate buckets)

## 2026-06-19 — Improved metrics search and title case

- Search now supports multi-word queries regardless of word order and spacing ("deploy speed" matches "Deployment Speed")
- Added synonym/abbreviation expansion: "pr" finds pull request, merge request, diff, and code review; "docs" → documentation; "bug" also matches defect, error, fault, failure; "ship" and "release" match deployment; "debt" → technical debt; "oncall" → on-call and incident
- Added a clear (×) button on the search field to reset it in one click
- Metric names are now consistently displayed in title case throughout the app

## 2026-06-18 — Report missing or incorrect metrics

- Added a form to report missing or incorrect metrics, accessible from the footer and from each metric's detail popup
- "Report a missing metric" pre-fills nothing and requires a verifiable URL reference; "Report an issue" pre-fills the metric name
- Submissions are stored server-side; includes email validation and URL validation for the reference field
- Added "Report a missing metric" shortcut link in the thumbs-down feedback widget

## 2026-06-17 — Related metrics in popup

- Metric detail popup now shows related metrics as inline links; clicking one opens it side-by-side in a second panel

## 2026-06-17 — Predefined list wizard option and JSON export

- Added "Start with a predefined list" as a fourth way to begin: load metrics tracked by a company in the dataset (pre-selects the company filter and sets up a comparison against SPACE Framework), or import a previously saved DevEx Compass export (JSON)
- Added JSON export in Step 3 — exports the shortlist as a versioned, re-importable JSON file

## 2026-06-17 — Dataset refinement

- Unified similar metrics and added new ones to improve coverage and reduce redundancy

## 2026-06-12 — About overlay and visual refresh

- Added About overlay (accessible from footer) with background on the Compass, its creators, and methodology
- Refreshed chart colors and icons to a colorblind-accessible palette

## 2026-06-12 — Refined export options and comparison handling

- Refined export options when no metrics are selected but comparisons are present
- Refined CSS layout and visual polish

## 2026-05-01 — Comparison step and PDF export

- Added ability to compare own shortlist with other dimensions (e.g. companies)
- Added ability to include comparisons in the PDF export
- Improved visualization of metrics overlaps in the diff view
- Added steps panel to the side panel

## 2026-04-01 — Three-step workflow and PDF export

- Added three-step workflow for metrics identification: select metrics, compare with a benchmark or peer, and export results
- Added PDF export of selected metrics that are already tracked or the user plans to track

## 2026-03-01 — Redesigned getting started

- Redesigned getting started with three exploration modes: Guided selection, Browse all metrics, and Explore by filtering
- Added Guided Selection mode where the user answers questions to help filter the right metrics

## 2026-02-01 — AI metrics and filter updates

- Added AI metrics and filter
- Updated company size filter categories and labels

## 2026-01-01 — Initial release

- Initial release of the DevEx Metrics Compass dashboard
- Sunburst visualization with filtering by data type, research/industry focus, company size, and specific framework or company
