// ─── Step 3: Next Steps view ──────────────────────────────────────────────────

function renderNextStepsView() {
    const capturing = clickedMetrics.filter(m => m.collectionStatus === 'capturing');
    const planned   = clickedMetrics.filter(m => m.collectionStatus === 'planning');
    const hasAny    = capturing.length > 0 || planned.length > 0;

    const emptyMsg   = document.getElementById('nextsteps-empty-msg');
    const columns    = document.getElementById('nextsteps-columns');
    const hintText   = document.getElementById('nextsteps-hint-text');

    if (emptyMsg)  emptyMsg.style.display  = hasAny ? 'none' : '';
    if (columns)   columns.style.display   = hasAny ? '' : 'none';

    // Update counts
    const capCount = document.getElementById('ns-capturing-count');
    const planCount = document.getElementById('ns-planned-count');
    if (capCount)  capCount.textContent  = capturing.length > 0 ? `(${capturing.length})` : '';
    if (planCount) planCount.textContent = planned.length > 0   ? `(${planned.length})`   : '';

    // Render each column list
    renderNextStepsList('ns-capturing-list', capturing, false);
    renderNextStepsList('ns-planned-list', planned, true);

    // Render insights panel
    renderInsights();

    // Update hint text
    if (hintText) {
        if (!hasAny) {
            hintText.textContent = 'Explore metrics first and mark ones that interest you — they\'ll appear here.';
        } else {
            hintText.textContent = 'Here is a summary of your selection. Click any metric to edit its status.';
        }
    }

    // Update export button state
    const exportBtn = document.getElementById('download-pdf-nextsteps');
    if (exportBtn) {
        exportBtn.disabled = !hasAny;
        exportBtn.style.opacity = hasAny ? '' : '0.5';
    }
}

function renderNextStepsList(containerId, metrics, isPlanned) {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (metrics.length === 0) {
        el.innerHTML = '<div class="nextsteps-empty-col">None yet</div>';
        return;
    }

    const sorted = [...metrics].sort((a, b) => a.name.localeCompare(b.name));

    if (isPlanned) {
        el.innerHTML = sorted.map(metric => renderPlannedCard(metric)).join('');
    } else {
        el.innerHTML = sorted.map(metric => `
            <div class="nextsteps-metric-row" data-metric-id="${metric.id}" role="button" tabindex="0"
                 title="${metric.description || ''}">
                <span class="nextsteps-metric-name">${metric.name}</span>
                <span class="nextsteps-metric-remove" data-metric-id="${metric.id}" title="Remove">×</span>
            </div>
        `).join('');
    }

    // Wire clicks: metric name/card → tooltip; × → remove
    el.querySelectorAll(isPlanned ? '.nextsteps-planned-card' : '.nextsteps-metric-row').forEach(row => {
        row.addEventListener('click', e => {
            if (e.target.classList.contains('nextsteps-metric-remove')) {
                removeClickedMetric(parseInt(e.target.dataset.metricId));
                return;
            }
            // Don't open tooltip when clicking a link inside the card
            if (e.target.tagName === 'A') return;
            e.stopPropagation();
            const metric = originalData.find(m => m.id === parseInt(row.dataset.metricId));
            if (metric && typeof showCustomTooltip === 'function') showCustomTooltip(metric, e);
        });
    });
}

function renderPlannedCard(metric) {
    const desc = metric.description || '';

    // Ease badge
    let easeBadge = '';
    if (metric.ease_of_collection) {
        const easeKey = metric.ease_of_collection.toLowerCase();
        easeBadge = `<span class="ns-card-ease ns-card-ease--${easeKey}">${metric.ease_of_collection} to collect</span>`;
    }

    // Company links (up to 5, then "+N more")
    let companyHtml = '';
    if (Array.isArray(metric.company) && metric.company.length > 0) {
        const sorted = [...metric.company].sort((a, b) => a.name.localeCompare(b.name));
        const shown = sorted.slice(0, 5);
        const rest  = sorted.length - shown.length;
        const links = shown.map(s => s.url
            ? `<a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.name}</a>`
            : s.name
        ).join('<span class="ns-card-sep">·</span>');
        const more = rest > 0 ? `<span class="ns-card-more">+${rest} more</span>` : '';
        companyHtml = `<div class="ns-card-sources"><span class="ns-card-sources-label">Companies tracking it:</span> ${links}${more ? '<span class="ns-card-sep">·</span>' + more : ''}</div>`;
    }

    // Research links (up to 3)
    let researchHtml = '';
    if (Array.isArray(metric.research) && metric.research.length > 0) {
        const sorted = [...metric.research].sort((a, b) => a.name.localeCompare(b.name));
        const shown = sorted.slice(0, 3);
        const rest  = sorted.length - shown.length;
        const links = shown.map(s => s.url
            ? `<a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.name}</a>`
            : s.name
        ).join('<span class="ns-card-sep">·</span>');
        const more = rest > 0 ? `<span class="ns-card-more">+${rest} more</span>` : '';
        researchHtml = `<div class="ns-card-sources"><span class="ns-card-sources-label">Research recommending it:</span> ${links}${more ? '<span class="ns-card-sep">·</span>' + more : ''}</div>`;
    }

    return `
        <div class="nextsteps-planned-card" data-metric-id="${metric.id}" role="button" tabindex="0">
            <div class="ns-card-header">
                <span class="nextsteps-metric-name">${metric.name}</span>
                <span class="nextsteps-metric-remove" data-metric-id="${metric.id}" title="Remove">×</span>
            </div>
            ${desc ? `<div class="ns-card-desc">${desc}</div>` : ''}
            <div class="ns-card-meta">
                ${easeBadge}
            </div>
            ${companyHtml}
            ${researchHtml}
        </div>
    `;
}

// ─── Insights panel ───────────────────────────────────────────────────────────

function renderInsights() {
    const el = document.getElementById('ns-insights');
    if (!el) return;

    if (clickedMetrics.length === 0) {
        el.style.display = 'none';
        el.innerHTML = '';
        return;
    }

    const chips = [];

    // 1. Top 10% by value
    if (Array.isArray(originalData) && originalData.length > 0) {
        const leafMetrics = originalData.filter(m => m.value !== undefined && m.value !== null);
        if (leafMetrics.length > 0) {
            const sorted = [...leafMetrics].sort((a, b) => b.value - a.value);
            const threshold = Math.ceil(sorted.length * 0.1);
            const top10Set = new Set(sorted.slice(0, threshold).map(m => m.id));
            const topCount = clickedMetrics.filter(m => top10Set.has(m.id)).length;
            if (topCount > 0) {
                chips.push(`${topCount} of your ${clickedMetrics.length} metrics are in the <strong>top 10% most-tracked</strong>`);
            }
        }
    }

    // 2. Outcome goal coverage
    const knownGoals = ['Developer Experience', 'Product Excellence', 'Organizational Effectiveness'];
    const goalLabels = { 'Developer Experience': 'Developer Experience', 'Product Excellence': 'Product Excellence', 'Organizational Effectiveness': 'Org Effectiveness' };
    const goalCounts = {};
    clickedMetrics.forEach(m => {
        const g = m.outcome_goals;
        if (g && knownGoals.includes(g)) goalCounts[g] = (goalCounts[g] || 0) + 1;
    });
    const coveredGoals = knownGoals.filter(g => goalCounts[g] > 0);
    const missingGoals = knownGoals.filter(g => !goalCounts[g]);
    if (coveredGoals.length > 0) {
        if (missingGoals.length === 0) {
            chips.push(`Covers all 3 <strong>outcome goals</strong> — good balance`);
        } else if (missingGoals.length === 1) {
            chips.push(`No metrics for <strong>${goalLabels[missingGoals[0]]}</strong> yet — consider adding some`);
        } else {
            const dominant = Object.entries(goalCounts).sort((a, b) => b[1] - a[1])[0];
            chips.push(`Heavy on <strong>${goalLabels[dominant[0]]}</strong> — consider adding metrics for ${missingGoals.map(g => goalLabels[g]).join(' and ')}`);
        }
    }

    // 3. Data type mix
    const typeCounts = { qualitative: 0, quantitative: 0, both: 0 };
    clickedMetrics.forEach(m => { if (m.type in typeCounts) typeCounts[m.type]++; });
    const hasQuant = typeCounts.quantitative + typeCounts.both > 0;
    const hasQual  = typeCounts.qualitative  + typeCounts.both > 0;
    if (hasQuant && hasQual) {
        const parts = [];
        if (typeCounts.quantitative > 0) parts.push(`${typeCounts.quantitative} automated`);
        if (typeCounts.qualitative  > 0) parts.push(`${typeCounts.qualitative} self-reported`);
        if (typeCounts.both         > 0) parts.push(`${typeCounts.both} mixed`);
        chips.push(`Good mix of <strong>collection types</strong>: ${parts.join(', ')}`);
    } else if (hasQual && !hasQuant) {
        chips.push(`All <strong>self-reported</strong> — consider adding automated metrics for objective signals`);
    } else if (hasQuant && !hasQual) {
        chips.push(`All <strong>automated</strong> — consider adding self-reported metrics for developer sentiment`);
    }

    // 4. Category (parent) coverage
    if (Array.isArray(originalData) && originalData.length > 0) {
        // Root = node with no parent; categories = direct children of root
        const rootIds = new Set(originalData.filter(m => !m.parent || m.parent === 0).map(m => m.id));
        const categoryIds = new Set(originalData.filter(m => m.parent && rootIds.has(m.parent)).map(m => m.id));
        const totalTopCategories = categoryIds.size;

        // Build parent lookup to walk up from any metric to its top category
        const parentOf = {};
        originalData.forEach(m => { if (m.parent) parentOf[m.id] = m.parent; });

        const selectedTopCategories = new Set();
        clickedMetrics.forEach(m => {
            let id = m.id;
            while (id) {
                if (categoryIds.has(id)) { selectedTopCategories.add(id); break; }
                id = parentOf[id];
            }
        });

        const n = selectedTopCategories.size;
        if (n > 0 && totalTopCategories > 0) {
            const ratio = n / totalTopCategories;
            const catLabel = n === totalTopCategories ? `all ${totalTopCategories}` : `${n} of ${totalTopCategories}`;
            if (ratio < 0.3) {
                chips.push(`Covering ${catLabel} <strong>metric categories</strong> — consider different perspectives`);
            } else if (ratio >= 0.6) {
                chips.push(`Covering ${catLabel} <strong>metric categories</strong> — great breadth`);
            } else {
                chips.push(`Covering ${catLabel} <strong>metric categories</strong> — good spread`);
            }
        }
    }

    // 5. Framework alignment
    const knownFrameworks = ['SPACE Framework', 'DevEx Framework', 'DORA Framework', 'McKinsey Framework', 'EEBO Framework', 'DX Core 4 Framework'];
    const frameworkCounts = {};
    clickedMetrics.forEach(m => {
        if (!Array.isArray(m.research)) return;
        const seen = new Set();
        m.research.forEach(r => {
            if (knownFrameworks.includes(r.name) && !seen.has(r.name)) {
                seen.add(r.name);
                frameworkCounts[r.name] = (frameworkCounts[r.name] || 0) + 1;
            }
        });
    });
    const frameworkEntries = Object.entries(frameworkCounts).sort((a, b) => b[1] - a[1]);
    if (frameworkEntries.length > 0) {
        const total = clickedMetrics.length;
        const [topName, topCount] = frameworkEntries[0];
        if (topCount === total && frameworkEntries.length === 1) {
            chips.push(`All metrics align with <strong>${topName}</strong> — consider drawing from other frameworks`);
        } else if (topCount / total > 0.5) {
            chips.push(`${topCount} of ${total} metrics align with the <strong>${topName}</strong>`);
        } else {
            const list = frameworkEntries.slice(0, 3).map(([n, c]) => `${n.replace(' Framework', '')} (${c})`).join(', ');
            const more = frameworkEntries.length > 3 ? `, +${frameworkEntries.length - 3} more` : '';
            chips.push(`Drawing from <strong>${frameworkEntries.length} frameworks</strong>: ${list}${more}`);
        }
    }

    if (chips.length === 0) {
        el.style.display = 'none';
        el.innerHTML = '';
        return;
    }

    el.innerHTML = `
        <ul class="ns-insights-list">
            ${chips.map(c => `<li>${c}</li>`).join('')}
        </ul>
    `;
    el.style.display = '';
}

// ─── Button wiring ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    const downloadPdfBtn = document.getElementById('download-pdf-nextsteps');
    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', () => {
            if (typeof downloadPdf === 'function') downloadPdf();
        });
    }

    const clearBtn = document.getElementById('clear-all-metrics-nextsteps');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (clickedMetrics.length === 0) return;
            if (confirm('Clear all selected metrics?')) {
                if (typeof clearAllClickedMetrics === 'function') clearAllClickedMetrics();
            }
        });
    }
});
