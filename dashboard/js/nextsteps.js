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

    // Render saved comparisons
    renderSavedComparisons();

    // Update hint text
    if (hintText) {
        if (!hasAny) {
            hintText.textContent = 'Explore metrics first and mark ones that interest you — they\'ll appear here.';
        } else {
            const total = capturing.length + planned.length;
            const parts = [];
            if (capturing.length > 0) parts.push(`${capturing.length} tracking`);
            if (planned.length > 0) parts.push(`${planned.length} planned`);
            hintText.textContent = `Summary of your ${total} shortlisted metrics (${parts.join(', ')}). Click any metric on the left to edit its status.`;
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
        easeBadge = `<span class="ns-card-ease ns-card-ease--${easeKey}">${MATURITY_FULL_LABEL[metric.ease_of_collection] || metric.ease_of_collection}</span>`;
    }

    // Company links (up to 5, then "+N more")
    let companyHtml = '';
    if (Array.isArray(metric.company) && metric.company.length > 0) {
        const sorted = [...metric.company].sort((a, b) => a.name.localeCompare(b.name));
        const shown = sorted.slice(0, 5);
        const rest  = sorted.length - shown.length;
        const links = shown.map(s => {
            const logoHtml = typeof getEntityBadgeContent === 'function'
                ? getEntityBadgeContent('company', s.name, 12)
                : '';
            const inner = `${logoHtml}${s.name}`;
            return `<span class="source-chip">${s.url ? `<a href="${s.url}" target="_blank" rel="noopener noreferrer">${inner}</a>` : inner}</span>`;
        }).join('<span class="ns-card-sep">·</span>');
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

// ─── Saved comparisons section ───────────────────────────────────────────────

function renderSavedComparisons() {
    const el = document.getElementById('ns-saved-comparisons');
    if (!el) return;

    if (!savedComparisons || savedComparisons.length === 0) {
        el.style.display = 'none';
        el.innerHTML = '';
        return;
    }

    const hasShortlist = c => c.leftType === 'shortlist' || c.rightType === 'shortlist';
    const ordered = [...savedComparisons].sort((a, b) => hasShortlist(b) - hasShortlist(a));

    const cards = ordered.map((c) => {
        const i = savedComparisons.indexOf(c);
        const left   = c.leftOnlyMetrics.length;
        const shared = c.sharedMetrics.length;
        const right  = c.rightOnlyMetrics.length;
        const total  = left + shared + right;

        const leftPct   = total > 0 ? (left   / total * 100) : 0;
        const sharedPct = total > 0 ? (shared / total * 100) : 0;
        const rightPct  = total > 0 ? (right  / total * 100) : 0;

        const barTitle = `${left} unique to ${escapeHtml(c.leftLabel)} · ${shared} shared · ${right} unique to ${escapeHtml(c.rightLabel)}`;

        return `
            <div class="ns-saved-comparison-card">
                <div class="ns-saved-comparison-card-header">
                    <div class="ns-comparison-legend">
                        <span class="ns-comparison-legend-item ns-comparison-legend-item--left">${left} ${escapeHtml(c.leftLabel)} only</span>
                        <span class="ns-comparison-legend-item ns-comparison-legend-item--shared">${shared} shared</span>
                        <span class="ns-comparison-legend-item ns-comparison-legend-item--right">${right} ${escapeHtml(c.rightLabel)} only</span>
                    </div>
                    <button class="nextsteps-metric-remove ns-remove-comparison" data-comparison-index="${i}" title="Remove from PDF">&#215;</button>
                </div>
                <div class="ns-comparison-bar sort-chart-bar-track" title="${barTitle}">
                    ${leftPct   > 0 ? `<div class="sort-chart-bar-fill sort-chart-bar-fill--left"   style="width:${leftPct}%"></div>`   : ''}
                    ${sharedPct > 0 ? `<div class="sort-chart-bar-fill sort-chart-bar-fill--shared" style="width:${sharedPct}%"></div>` : ''}
                    ${rightPct  > 0 ? `<div class="sort-chart-bar-fill sort-chart-bar-fill--right"  style="width:${rightPct}%"></div>`  : ''}
                </div>
            </div>
        `;
    }).join('');

    el.style.display = '';
    el.innerHTML = `
        <div class="controls-title controls-title--download">Saved comparisons</div>
        <div class="ns-saved-comparisons-list">${cards}</div>
    `;

    el.querySelectorAll('.ns-remove-comparison').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.comparisonIndex);
            savedComparisons.splice(idx, 1);
            if (typeof saveSavedComparisonsToLocalStorage === 'function') saveSavedComparisonsToLocalStorage();
            if (typeof updateSaveButton === 'function') updateSaveButton();
            renderSavedComparisons();
        });
    });
}

// ─── Insights panel ───────────────────────────────────────────────────────────

function buildInsights(allSelected) {
    if (!allSelected || allSelected.length === 0) return [];

    const capturingInSelected = allSelected.filter(m => m.collectionStatus === 'capturing');
    const plannedInSelected   = allSelected.filter(m => m.collectionStatus === 'planning');

    const chips = []; // { text: string, type: 'positive' | 'action' | 'neutral' }

    // 1. No "planned to track" metrics
    if (capturingInSelected.length > 0 && plannedInSelected.length === 0) {
        chips.push({ text: 'All selected metrics are already being tracked — consider planning which ones to add next', type: 'action' });
    }

    // 2. No "capturing" metrics yet
    if (plannedInSelected.length > 0 && capturingInSelected.length === 0) {
        chips.push({ text: 'None of your metrics are being collected yet — pick 1–3 easy ones to start', type: 'action' });
    }

    // 3. Top 10% by value
    if (Array.isArray(originalData) && originalData.length > 0) {
        const leafMetrics = originalData.filter(m => m.value !== undefined && m.value !== null);
        if (leafMetrics.length > 0) {
            const sorted = [...leafMetrics].sort((a, b) => b.value - a.value);
            const threshold = Math.ceil(sorted.length * 0.1);
            const top10Set = new Set(sorted.slice(0, threshold).map(m => m.id));
            const topCount = allSelected.filter(m => top10Set.has(m.id)).length;
            if (topCount === 0) {
                chips.push({ text: `None of your metrics are among the <strong>top 10% most-tracked</strong>`, type: 'action' });
            } else if (topCount / allSelected.length >= 0.2) {
                chips.push({ text: `${topCount} of your ${allSelected.length} metrics are in the <strong>top 10% most-tracked</strong>`, type: 'positive' });
            } else {
                chips.push({ text: `${topCount} of your ${allSelected.length} metrics are in the <strong>top 10% most-tracked</strong>`, type: 'neutral' });
            }
        }
    }

    // 4. Outcome goal coverage
    const knownGoals = ['Developer Experience', 'Product Excellence', 'Organizational Effectiveness'];
    const goalLabels = { 'Developer Experience': 'Developer Experience', 'Product Excellence': 'Product Excellence', 'Organizational Effectiveness': 'Organizational Effectiveness' };
    const goalCounts = {};
    allSelected.forEach(m => {
        const g = m.outcome_goals;
        if (g && knownGoals.includes(g)) goalCounts[g] = (goalCounts[g] || 0) + 1;
    });
    const coveredGoals = knownGoals.filter(g => goalCounts[g] > 0);
    const missingGoals = knownGoals.filter(g => !goalCounts[g]);
    if (coveredGoals.length > 0) {
        if (missingGoals.length === 0) {
            chips.push({ text: `Covers all 3 <strong>outcome goals</strong> — good balance`, type: 'positive' });
        } else if (missingGoals.length === 1) {
            chips.push({ text: `No metrics for <strong>${goalLabels[missingGoals[0]]}</strong> yet — consider adding some`, type: 'action' });
        } else {
            const dominant = Object.entries(goalCounts).sort((a, b) => b[1] - a[1])[0];
            chips.push({ text: `Heavy on <strong>${goalLabels[dominant[0]]}</strong> — consider adding metrics for ${missingGoals.map(g => goalLabels[g]).join(' and ')}`, type: 'action' });
        }
    }

    // 5. Data type mix
    const typeCounts = { qualitative: 0, quantitative: 0, both: 0 };
    allSelected.forEach(m => { if (m.type in typeCounts) typeCounts[m.type]++; });
    const hasQuant = typeCounts.quantitative + typeCounts.both > 0;
    const hasQual  = typeCounts.qualitative  + typeCounts.both > 0;
    if (hasQuant && hasQual) {
        const parts = [];
        if (typeCounts.quantitative > 0) parts.push(`${typeCounts.quantitative} automated`);
        if (typeCounts.qualitative  > 0) parts.push(`${typeCounts.qualitative} self-reported`);
        if (typeCounts.both         > 0) parts.push(`${typeCounts.both} mixed`);
        chips.push({ text: `Good mix of <strong>collection types</strong>: ${parts.join(', ')}`, type: 'positive' });
    } else if (hasQual && !hasQuant) {
        chips.push({ text: `All <strong>self-reported</strong> — consider adding automated metrics for objective signals`, type: 'action' });
    } else if (hasQuant && !hasQual) {
        chips.push({ text: `All <strong>automated</strong> — consider adding self-reported metrics for developer sentiment`, type: 'action' });
    }

    // 6. Category (parent) coverage
    if (Array.isArray(originalData) && originalData.length > 0) {
        const rootIds = new Set(originalData.filter(m => !m.parent || m.parent === 0).map(m => m.id));
        const categoryIds = new Set(originalData.filter(m => m.parent && rootIds.has(m.parent)).map(m => m.id));
        const totalTopCategories = categoryIds.size;

        const parentOf = {};
        originalData.forEach(m => { if (m.parent) parentOf[m.id] = m.parent; });

        const selectedTopCategories = new Set();
        allSelected.forEach(m => {
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
                chips.push({ text: `Covering ${catLabel} <strong>metric categories</strong> — consider exploring different perspectives`, type: 'action' });
            } else if (ratio >= 0.6) {
                chips.push({ text: `Covering ${catLabel} <strong>metric categories</strong> — great breadth`, type: 'positive' });
            } else {
                chips.push({ text: `Covering ${catLabel} <strong>metric categories</strong> — room to diversify`, type: 'neutral' });
            }
        }
    }

    // 7. Framework alignment (SPACE, DORA, DX Core 4 prioritised over lesser-known ones)
    const knownFrameworks = ['SPACE Framework', 'DevEx Framework', 'DORA Framework', 'McKinsey Framework', 'EEBO Framework', 'DX Core 4 Framework'];
    const frameworkPriority = new Set(['SPACE Framework', 'DORA Framework', 'DX Core 4 Framework']);
    const frameworkCounts = {};
    allSelected.forEach(m => {
        if (!Array.isArray(m.research)) return;
        const seen = new Set();
        m.research.forEach(r => {
            if (knownFrameworks.includes(r.name) && !seen.has(r.name)) {
                seen.add(r.name);
                frameworkCounts[r.name] = (frameworkCounts[r.name] || 0) + 1;
            }
        });
    });
    const frameworkEntries = Object.entries(frameworkCounts).sort((a, b) => {
        const countDiff = b[1] - a[1];
        if (countDiff !== 0) return countDiff;
        return (frameworkPriority.has(b[0]) ? 1 : 0) - (frameworkPriority.has(a[0]) ? 1 : 0);
    });
    // Promote a priority framework if it's within 75% of the top count
    if (frameworkEntries.length > 1 && !frameworkPriority.has(frameworkEntries[0][0])) {
        const topCount = frameworkEntries[0][1];
        const priorityIdx = frameworkEntries.findIndex(([n, c]) => frameworkPriority.has(n) && c >= topCount * 0.75);
        if (priorityIdx > 0) {
            const [promoted] = frameworkEntries.splice(priorityIdx, 1);
            frameworkEntries.unshift(promoted);
        }
    }
    if (frameworkEntries.length > 0) {
        const total = allSelected.length;
        const [topName, topCount] = frameworkEntries[0];
        if (topCount === total && frameworkEntries.length === 1) {
            chips.push({ text: `All metrics align with <strong>${frameworkLink(topName)}</strong> — consider drawing from other frameworks`, type: 'action' });
        } else if (topCount / total > 0.5) {
            chips.push({ text: `${topCount} of ${total} metrics align with the <strong>${frameworkLink(topName)}</strong>`, type: 'neutral' });
        } else {
            const list = frameworkEntries.slice(0, 3).map(([n, c]) => `${n.replace(' Framework', '')} (${c})`).join(', ');
            const more = frameworkEntries.length > 3 ? `, +${frameworkEntries.length - 3} more` : '';
            const fwLabel = frameworkEntries.length === 1 ? 'framework' : 'frameworks';
            chips.push({ text: `Drawing from <strong>${frameworkEntries.length} ${fwLabel}</strong>: ${list}${more}`, type: 'positive' });
        }
    }

    // 8. SPACE Framework coverage
    const spaceTotal = originalData.filter(m => m.value !== undefined && Array.isArray(m.research) && m.research.some(r => r.name === 'SPACE Framework')).length;
    const spaceSelected = allSelected.filter(m => Array.isArray(m.research) && m.research.some(r => r.name === 'SPACE Framework')).length;
    if (spaceTotal > 0) {
        if (spaceSelected === 0) {
            chips.push({ text: `<strong>${frameworkLink('SPACE Framework', 'SPACE Framework')}:</strong> no metrics in your selection yet`, type: 'action' });
        } else if (spaceSelected === spaceTotal) {
            chips.push({ text: `Covers all ${spaceTotal} <strong>${frameworkLink('SPACE Framework', 'SPACE Framework')} metrics</strong>`, type: 'positive' });
        } else {
            chips.push({ text: `<strong>${frameworkLink('SPACE Framework', 'SPACE Framework')}:</strong> ${spaceSelected} of ${spaceTotal} metrics covered`, type: spaceSelected / spaceTotal >= 0.5 ? 'positive' : 'neutral' });
        }
    }

    // 9. DORA Framework coverage
    const doraTotal = originalData.filter(m => m.value !== undefined && Array.isArray(m.research) && m.research.some(r => r.name === 'DORA Framework')).length;
    const doraSelected = allSelected.filter(m => Array.isArray(m.research) && m.research.some(r => r.name === 'DORA Framework')).length;
    if (doraTotal > 0) {
        if (doraSelected === 0) {
            chips.push({ text: `<strong>${frameworkLink('DORA Framework', 'DORA Framework')}:</strong> no metrics in your selection yet`, type: 'action' });
        } else if (doraSelected === doraTotal) {
            chips.push({ text: `Covers all ${doraTotal} <strong>${frameworkLink('DORA Framework', 'DORA Framework')} metrics</strong>`, type: 'positive' });
        } else {
            chips.push({ text: `<strong>${frameworkLink('DORA Framework', 'DORA Framework')}:</strong> ${doraSelected} of ${doraTotal} metrics covered`, type: doraSelected / doraTotal >= 0.5 ? 'positive' : 'neutral' });
        }
    }

    // 10. Collection burden in planned list
    if (plannedInSelected.length >= 2) {
        const easyPlanned    = plannedInSelected.filter(m => m.ease_of_collection?.toLowerCase() === 'easy').length;
        const complexPlanned = plannedInSelected.filter(m => m.ease_of_collection?.toLowerCase() === 'complex').length;
        if (easyPlanned === 0 && complexPlanned >= 1) {
            chips.push({ text: `All planned metrics require significant collection effort`, type: 'neutral' });
        } else if (complexPlanned > 0 && complexPlanned / plannedInSelected.length >= 0.6) {
            chips.push({ text: `Most planned metrics require significant collection effort`, type: 'neutral' });
        }
    }

    // 11. Overload — soft meta-warning, shown last
    if (allSelected.length > 20) {
        const easyCapturing = capturingInSelected.filter(m => m.ease_of_collection?.toLowerCase() === 'easy').length;
        const lowOverhead = easyCapturing >= allSelected.length * 0.8;
        if (!lowOverhead) {
            chips.push({ text: `${allSelected.length} metrics is a lot to act on at once — consider narrowing to a more focused set for better traction`, type: 'action' });
        }
    }

    return chips;
}

function renderInsights() {
    const el = document.getElementById('ns-insights');
    if (!el) return;

    const allSelected = clickedMetrics.filter(m => m.collectionStatus === 'capturing' || m.collectionStatus === 'planning');

    if (allSelected.length === 0) {
        el.style.display = 'none';
        el.innerHTML = '';
        return;
    }

    const chips = buildInsights(allSelected);

    if (chips.length === 0) {
        el.style.display = 'none';
        el.innerHTML = '';
        return;
    }

    const iconMap = { positive: '&#10003;', action: '&rarr;', neutral: '&ndash;' };
    el.innerHTML = `
        <ul class="ns-insights-list">
            ${chips.map(({ text, type }) => `<li class="ns-insight ns-insight--${type}"><span class="ns-insight-icon">${iconMap[type]}</span>${text}</li>`).join('')}
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
