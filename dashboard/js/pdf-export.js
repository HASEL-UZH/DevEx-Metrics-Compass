// ─── PDF Export ───────────────────────────────────────────────────────────────

async function fetchAsBase64(url) {
    const res  = await fetch(url);
    const blob = await res.blob();
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function typeLabel(type) {
    if (type === 'quantitative') return 'Automated';
    if (type === 'qualitative')  return 'Self-reported';
    if (type === 'both')         return 'Self-reported & Automated';
    return '';
}

// ─── PDF comparison block ─────────────────────────────────────────────────────

function buildComparisonBlock(comparison) {
    const left  = escapeHtml(comparison.leftLabel);
    const right = escapeHtml(comparison.rightLabel);
    const lCount = comparison.leftOnlyMetrics.length;
    const sCount = comparison.sharedMetrics.length;
    const rCount = comparison.rightOnlyMetrics.length;
    const total  = lCount + sCount + rCount;
    const lPct   = total > 0 ? (lCount / total * 100) : 0;
    const sPct   = total > 0 ? (sCount / total * 100) : 0;
    const rPct   = 100 - lPct - sPct;

    const nameList = metrics => metrics.length === 0
        ? '<em style="color:#aaa">None</em>'
        : metrics.map(m => escapeHtml(m.name)).join(', ');

    const tdLabel = 'width:28%;font-weight:700;padding:4pt 8pt 4pt 0;vertical-align:top;white-space:nowrap;';
    const tdMetrics = 'color:#444;padding:4pt 0;vertical-align:top;line-height:1.5;';
    const trBorder = 'border-bottom:0.3pt solid #eee;';

    return `
        <div class="pdf-comparison-block">
            <div class="pdf-comparison-title">${left} vs. ${right}</div>
            <table style="width:100%;border-collapse:collapse;table-layout:fixed;margin:5pt 0 3pt;">
                <tr>
                    ${lPct > 0 ? `<td style="background:#7c3aed;width:${lPct}%;height:8pt;padding:0;"></td>` : ''}
                    ${sPct > 0 ? `<td style="background:#9ca3af;width:${sPct}%;height:8pt;padding:0;"></td>` : ''}
                    ${rPct > 0 ? `<td style="background:#16a34a;width:${rPct}%;height:8pt;padding:0;"></td>` : ''}
                </tr>
            </table>
            <div style="display:flex;gap:14pt;font-size:7.5pt;margin-bottom:6pt;">
                <span style="color:#7c3aed;font-weight:700">${left} only (${lCount})</span>
                <span style="color:#888">Shared (${sCount})</span>
                <span style="color:#16a34a;font-weight:700">${right} only (${rCount})</span>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:9pt;">
                <tr style="${trBorder}">
                    <td style="${tdLabel}color:#7c3aed;">${left} only (${lCount})</td>
                    <td style="${tdMetrics}">${nameList(comparison.leftOnlyMetrics)}</td>
                </tr>
                <tr style="${trBorder}">
                    <td style="${tdLabel}color:#888;">Shared (${sCount})</td>
                    <td style="${tdMetrics}">${nameList(comparison.sharedMetrics)}</td>
                </tr>
                <tr>
                    <td style="${tdLabel}color:#16a34a;">${right} only (${rCount})</td>
                    <td style="${tdMetrics}">${nameList(comparison.rightOnlyMetrics)}</td>
                </tr>
            </table>
        </div>`;
}

// ─── PDF metric card ──────────────────────────────────────────────────────────

function buildPdfCard(metric) {
    const easeKey   = (metric.ease_of_collection || '').toLowerCase();
    const easeBadge = metric.ease_of_collection
        ? `<span class="pdf-card-ease pdf-card-ease--${easeKey}">${escapeHtml(MATURITY_FULL_LABEL[metric.ease_of_collection] || metric.ease_of_collection)}</span>`
        : '';

    const aka = metric.alsoknownas && metric.alsoknownas !== '-'
        ? `<div class="pdf-card-aka"><span class="pdf-card-sources-label">Also known as: </span>${escapeHtml(metric.alsoknownas)}</div>`
        : '';

    const tags = (() => {
        const pills = [];
        if (metric.type)          pills.push(`<span class="pdf-tag">${escapeHtml(typeLabel(metric.type))}</span>`);
        if (metric.outcome_goals) pills.push(`<span class="pdf-tag">${escapeHtml(metric.outcome_goals)}</span>`);
        if (metric.ai_specific_category) pills.push(`<span class="pdf-tag">AI: ${escapeHtml(metric.ai_specific_category)}</span>`);
        return pills.length > 0 ? `<div class="pdf-card-tags">${pills.join('')}</div>` : '';
    })();

    const companyHtml = (() => {
        if (!Array.isArray(metric.company) || metric.company.length === 0) return '';
        const links = [...metric.company]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(s => s.url
                ? `<a href="${escapeHtml(s.url)}">${escapeHtml(s.name)}</a>`
                : escapeHtml(s.name))
            .join('<span class="pdf-card-sep"> · </span>');
        return `<div class="pdf-card-sources"><span class="pdf-card-sources-label">Companies tracking it: </span>${links}</div>`;
    })();

    const researchHtml = (() => {
        if (!Array.isArray(metric.research) || metric.research.length === 0) return '';
        const links = [...metric.research]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(s => s.url
                ? `<a href="${escapeHtml(s.url)}">${escapeHtml(s.name)}</a>`
                : escapeHtml(s.name))
            .join('<span class="pdf-card-sep"> · </span>');
        return `<div class="pdf-card-sources"><span class="pdf-card-sources-label">Research recommending it: </span>${links}</div>`;
    })();

    return `
        <div class="pdf-card">
            <div class="pdf-card-header">
                <span class="pdf-card-name">${escapeHtml(metric.name)}</span>
                ${easeBadge}
            </div>
            ${metric.description ? `<div class="pdf-card-desc">${escapeHtml(metric.description)}</div>` : ''}
            ${aka}
            ${companyHtml}
            ${researchHtml}
            ${tags}
        </div>`;
}

// ─── Print styles ─────────────────────────────────────────────────────────────

function getPrintStyles() {
    return `
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

        body {
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            font-size: 10pt;
            color: #1a1a1a;
            background: #fff;
            line-height: 1.55;
            padding-bottom: 30pt; /* room for fixed footer */
        }

        @page {
            size: A4;
            margin: 18mm 18mm 26mm 18mm;
        }

        /* ── Running footer (position:fixed repeats on every printed page) ── */
        .pdf-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 5pt 0 4pt;
            border-top: 0.5pt solid #ccc;
            font-size: 7.5pt;
            color: #888;
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            background: #fff;
        }

        /* ── Typography ── */
        h1 { font-size: 20pt; color: #1B1AFF; margin-bottom: 10pt; font-weight: 700; display: flex; align-items: center; gap: 8pt; }
        .pdf-compass-logo { height: 22pt; width: auto; flex-shrink: 0; }
        h2 {
            font-size: 13pt;
            color: #1B1AFF;
            margin-top: 28pt;
            margin-bottom: 10pt;
            padding-bottom: 5pt;
            border-bottom: 1pt solid #1B1AFF;
        }
        a { color: #1B1AFF; text-decoration: none; }
        strong { font-weight: 600; }

        /* ── Header ── */
        .pdf-header { margin-bottom: 8pt; }
        .pdf-header p { font-size: 10pt; color: #333; margin-top: 8pt; max-width: 90%; }
        .pdf-header .pdf-date { font-size: 8.5pt; color: #888; margin-top: 10pt; }

        /* ── Section 1: Already Tracking list ── */
        .pdf-tracking-list { list-style: none; columns: 2; column-gap: 20pt; margin-top: 6pt; }
        .pdf-tracking-list li {
            padding: 5pt 0 5pt 16pt;
            position: relative;
            break-inside: avoid;
            border-bottom: 0.3pt solid #eee;
        }
        .pdf-tracking-list li::before {
            content: '✓';
            position: absolute; left: 0;
            color: #16a34a;
            font-weight: bold;
            font-size: 9pt;
        }
        .pdf-tracking-list .pdf-tracking-name { font-weight: 600; font-size: 10pt; }
        .pdf-tracking-list .pdf-tracking-desc { font-size: 8.5pt; color: #666; display: block; margin-top: 2pt; }
        .pdf-tracking-list .pdf-tracking-type {
            display: inline-block;
            font-size: 7.5pt;
            color: #555;
            background: #f0f0f0;
            border-radius: 8pt;
            padding: 0pt 5pt;
            margin-top: 2pt;
        }

        /* ── Section 2: Insights block ── */
        .pdf-insights {
            background: #f0f4ff;
            border-left: 3pt solid #1B1AFF;
            padding: 10pt 14pt;
            margin-bottom: 16pt;
            border-radius: 0 4pt 4pt 0;
        }
        .pdf-insights-title { font-size: 8pt; font-weight: 700; color: #1e3a5f; text-transform: uppercase; letter-spacing: 0.5pt; margin-bottom: 6pt; }
        .pdf-insights ul { list-style: none; }
        .pdf-insights li {
            font-size: 9pt;
            color: #444;
            padding: 2pt 0 2pt 14pt;
            position: relative;
        }
        .pdf-insight-icon { position: absolute; left: 0; font-style: normal; }
        .pdf-insight--positive .pdf-insight-icon { color: #16a34a; }
        .pdf-insight--action   .pdf-insight-icon { color: #1B1AFF; }
        .pdf-insight--neutral  .pdf-insight-icon { color: #aaa; }
        .pdf-insights li strong { color: #111; }

        /* ── Section 2: Metric cards ── */
        .pdf-card {
            border: 0.5pt solid #ccc;
            border-radius: 4pt;
            padding: 10pt 12pt;
            margin-bottom: 8pt;
            break-inside: avoid;
            background: #fff;
        }
        .pdf-card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 8pt;
            margin-bottom: 4pt;
        }
        .pdf-card-name { font-weight: 700; font-size: 11pt; color: #1B1AFF; }
        .pdf-card-desc { font-size: 9pt; color: #555; margin-bottom: 5pt; line-height: 1.45; }
        .pdf-card-aka  { font-size: 8.5pt; color: #666; margin-bottom: 5pt; font-style: italic; }
        .pdf-card-tags { display: flex; flex-wrap: wrap; gap: 4pt; margin-top: 5pt; }
        .pdf-tag {
            display: inline-block;
            padding: 1pt 6pt;
            border: 0.5pt solid #aaa;
            color: #555;
            border-radius: 8pt;
            font-size: 7.5pt;
        }
        .pdf-card-ease {
            display: inline-block;
            padding: 1pt 7pt;
            border-radius: 10pt;
            font-size: 8pt;
            font-weight: 600;
        }
        .pdf-card-ease--easy     { background: #dcfce7; color: #15803d; border: 0.75pt solid #15803d; }
        .pdf-card-ease--moderate { background: #fef9c3; color: #854d0e; border: 0.75pt solid #854d0e; }
        .pdf-card-ease--complex  { background: #fee2e2; color: #b91c1c; border: 0.75pt solid #b91c1c; }
        .pdf-card-sources { font-size: 8.5pt; color: #555; margin-top: 4pt; line-height: 1.5; }
        .pdf-card-sources-label { color: #777; font-weight: 600; }
        .pdf-card-sep { color: #bbb; }

        /* ── Authors section ── */
        .pdf-authors {
            margin-top: 28pt;
            padding-top: 20pt;
            border-top: 1pt solid #ddd;
            display: flex;
            align-items: center;
            gap: 24pt;
        }
        .pdf-authors-logos { display: flex; align-items: center; gap: 16pt; flex-shrink: 0; }
        .pdf-authors-logos img { height: 36pt; width: auto; }
        .pdf-authors-text { font-size: 9pt; color: #444; line-height: 1.6; }
        .pdf-authors-text strong { color: #1e3a5f; }
        .pdf-authors-text a { color: #1B1AFF; }

        /* ── Section 3: Saved comparisons ── */
        .pdf-comparison-block {
            margin-bottom: 16pt;
            padding-bottom: 12pt;
            border-bottom: 0.3pt solid #eee;
            break-inside: avoid;
        }
        .pdf-comparison-title {
            font-weight: 700;
            font-size: 11pt;
            color: #1B1AFF;
        }

        /* ── Page breaks ── */
        .page-break-before { break-before: page; }

        /* ── Suppress "URL in parentheses" some browsers add after links ── */
        @media print { a[href]::after { content: none !important; } }
    `;
}

// ─── Full HTML document ───────────────────────────────────────────────────────

function buildPdfHtml(capturing, planned, chips, uzhUri, haselUri, compassUri, comparisons) {
    const now      = new Date();
    const dateStr  = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const fileDate = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const totalCount = capturing.length + planned.length;

    const iconMap = { positive: '&#10003;', action: '&rarr;', neutral: '&ndash;' };
    const insightsBlock = chips.length > 0
        ? `<div class="pdf-insights">
               <div class="pdf-insights-title">Selection Insights</div>
               <ul>${chips.map(({ text, type }) => `<li class="pdf-insight pdf-insight--${type}"><span class="pdf-insight-icon">${iconMap[type]}</span>${text}</li>`).join('')}</ul>
           </div>`
        : '';

    const capturingSection = capturing.length === 0 ? '' : `
    <section>
        <h2>Already Tracking (${capturing.length})</h2>
        <ul class="pdf-tracking-list">
            ${capturing.map(m => `
                <li>
                    <span class="pdf-tracking-name">${escapeHtml(m.name)}</span>
                    ${m.type ? `<span class="pdf-tracking-type">${escapeHtml(typeLabel(m.type))}</span>` : ''}
                    ${m.description ? `<span class="pdf-tracking-desc">${escapeHtml(m.description)}</span>` : ''}
                </li>`).join('')}
        </ul>
    </section>`;

    const plannedSection = `
    <section>
        <h2>Plan to Track (${planned.length})</h2>
        ${planned.length === 0
            ? `<p style="color:#555;font-size:9pt;margin-top:6pt;">No metrics selected yet. Consider identifying additional metrics that fit your context using the <a href="https://devex-metrics-compass.hasel.dev/">Developer Experience Metrics Compass</a>.</p>`
            : planned.map(m => buildPdfCard(m)).join('')}
    </section>`;

    const comparisonsSection = comparisons && comparisons.length > 0 ? `
    <section class="page-break-before">
        <h2>Saved Comparisons (${comparisons.length})</h2>
        ${comparisons.map(c => buildComparisonBlock(c)).join('')}
    </section>` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>DevEx Metrics Compass – My Selection ${fileDate}</title>
    <style>${getPrintStyles()}</style>
</head>
<body>

    <div class="pdf-footer">
        <span>Developer Experience Metrics Compass &nbsp;·&nbsp; https://devex-metrics-compass.hasel.dev/</span>
        <span>Provided for research and informational purposes only.</span>
    </div>

    <div class="pdf-header">
        <h1>${compassUri ? `<img src="${compassUri}" alt="" class="pdf-compass-logo">` : ''}Developer Experience Metrics Compass</h1>
        <p>
            The Developer Experience Metrics Compass is a research-based tool that helps engineering
            teams navigate the landscape of developer experience metrics drawn from both academic
            research and industry practice. Using a three-step process — exploring the full metric
            landscape, comparing metrics across frameworks and companies, and selecting those most
            relevant to your context — this report captures the ${totalCount} metric${totalCount !== 1 ? 's' : ''}
            you identified as part of your developer experience measurement strategy.
        </p>
        <p class="pdf-date">Generated on ${dateStr} &nbsp;·&nbsp; https://devex-metrics-compass.hasel.dev/</p>
    </div>

    ${insightsBlock}

    ${capturingSection}

    ${plannedSection}

    ${comparisonsSection}

    <section class="pdf-authors page-break-before">
        <div class="pdf-authors-logos">
            ${uzhUri   ? `<img src="${uzhUri}"   alt="University of Zurich">` : ''}
            ${haselUri ? `<img src="${haselUri}" alt="HASEL Research Group">` : ''}
        </div>
        <div class="pdf-authors-text">
            <strong>Created by</strong><br>
            Dr. André N. Meyer, Patrick Meyer, Prof. Dr. Gail C. Murphy &amp; Prof. Dr. Thomas Fritz<br>
            University of Zurich (UZH) &nbsp;·&nbsp; <a href="https://hasel.dev">HASEL Research Group</a><br>
            <a href="https://devex-metrics-compass.hasel.dev/">https://devex-metrics-compass.hasel.dev/</a>
        </div>
    </section>

</body>
</html>`;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function downloadPdf() {
    if ((!clickedMetrics || clickedMetrics.length === 0) && (!savedComparisons || savedComparisons.length === 0)) return;

    const btn = document.getElementById('download-pdf-nextsteps');
    if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }

    try {
        const capturing = [...clickedMetrics]
            .filter(m => m.collectionStatus === 'capturing')
            .sort((a, b) => a.name.localeCompare(b.name));
        const planned = [...clickedMetrics]
            .filter(m => m.collectionStatus === 'planning')
            .sort((a, b) => a.name.localeCompare(b.name));

        const [uzhUri, haselUri, compassUri] = await Promise.all([
            fetchAsBase64('assets/uzh-logo.svg').catch(() => ''),
            fetchAsBase64('assets/hasel-logo.png').catch(() => ''),
            fetchAsBase64('assets/favicon.png').catch(() => '')
        ]);

        const chips = buildInsights([...capturing, ...planned]);
        const hasShortlist = c => c.leftType === 'shortlist' || c.rightType === 'shortlist';
        const orderedComparisons = [...savedComparisons].sort((a, b) => hasShortlist(b) - hasShortlist(a));
        const html  = buildPdfHtml(capturing, planned, chips, uzhUri, haselUri, compassUri, orderedComparisons);

        const win = window.open('', '_blank');
        if (!win) {
            alert('Could not open the print window. Please allow pop-ups for this site and try again.');
            return;
        }
        win.document.open();
        win.document.write(html);
        win.document.close();
        setTimeout(() => win.print(), 600);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Export PDF'; }
    }
}
