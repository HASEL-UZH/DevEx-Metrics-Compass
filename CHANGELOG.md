# Changelog

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
