// ─── Step 2: Compare view ─────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────

const SORT_CARD_TOOLTIPS = {
    category: 'Group metrics by their top-level DevEx category (e.g. Performance, Developer Experience, Process).',
    outcome:  'Group by intended outcome goal: Developer Experience, Product Excellence, or Organizational Effectiveness.',
    maturity: 'Group by collection maturity: Getting started (easy), Established (moderate), or Advanced (complex).',
    datatype: 'Group by data collection method: Self-reported (surveys, pop-ups) or Automated (logs, telemetry).',
    ai:       'Group by AI-specific focus area: AI Impact, Utilization, or Cost.',
};

// ─── Value options per dimension type ────────────────────────────────────────

const COMPARE_DIMENSION_OPTIONS = {
    maturity: [
        { value: 'Easy',     label: '🟢 Getting started (easy)' },
        { value: 'Moderate', label: '🟡 Established (moderate)' },
        { value: 'Complex',  label: '🔴 Advanced (complex)' },
    ],
    outcome: [
        { value: 'Developer Experience',       label: '🧑‍💻 Developer Experience' },
        { value: 'Product Excellence',         label: '⭐ Product Excellence' },
        { value: 'Organizational Effectiveness', label: '📈 Organizational Effectiveness' },
    ],
};

const GROUP_SORT_ORDER = {
    // maturity
    'Easy':     0,
    'Moderate': 1,
    'Complex':  2,
    // outcome
    'Developer Experience':           0,
    'Product Excellence':             1,
    'Organizational Effectiveness':   2,
    // data type
    '📋 Self-reported': 0,
    '⚙️ Automated':     1,
    '📋⚙️ Both':        2,
};

function sortGroupKey(a, b) {
    const oa = GROUP_SORT_ORDER[a] ?? 999;
    const ob = GROUP_SORT_ORDER[b] ?? 999;
    return oa !== ob ? oa - ob : a.localeCompare(b);
}

function getOptionsForDimension(type) {
    if (type === 'maturity') return COMPARE_DIMENSION_OPTIONS.maturity;
    if (type === 'outcome')  return COMPARE_DIMENSION_OPTIONS.outcome;

    // Extract dynamically from data
    const names = new Set();
    originalData.forEach(item => {
        if (!item.type) return;
        if (type === 'framework' && Array.isArray(item.research)) {
            item.research.forEach(r => {
                if (r.name && r.name.toLowerCase().includes('framework')) names.add(r.name);
            });
        }
        if (type === 'company' && Array.isArray(item.company)) {
            item.company.forEach(c => {
                const n = c.name && c.name.trim();
                if (n && !n.toLowerCase().includes('framework') &&
                    !n.toLowerCase().includes('metrics overview') &&
                    !n.toLowerCase().includes('used widely')) {
                    names.add(n);
                }
            });
        }
    });
    return [...names].sort().map(n => ({ value: n, label: n }));
}

function populateValueDropdown(selectEl, type, currentValue) {
    if (type === 'shortlist') {
        selectEl.style.display = 'none';
        selectEl.value = 'shortlist';
        return;
    }
    selectEl.style.display = '';
    const options = getOptionsForDimension(type);
    selectEl.innerHTML = '<option value="all">Select...</option>';
    options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        selectEl.appendChild(o);
    });
    selectEl.value = currentValue !== 'all' && options.some(o => o.value === currentValue)
        ? currentValue : 'all';
}

// ─── Metric filtering by dimension ───────────────────────────────────────────

function filterMetricsByDimension(type, value) {
    if (type === 'shortlist') {
        const ids = new Set(clickedMetrics.map(m => m.id));
        return originalData.filter(item => item.type && ids.has(item.id));
    }
    if (!value || value === 'all') return [];
    return originalData.filter(item => {
        if (!item.type) return false;
        if (type === 'framework') {
            return Array.isArray(item.research) && item.research.some(r => r.name === value);
        }
        if (type === 'company') {
            return Array.isArray(item.company) && item.company.some(c => c.name === value);
        }
        if (type === 'maturity') {
            return item.ease_of_collection === value;
        }
        if (type === 'outcome') {
            return item.outcome_goals === value;
        }
        return false;
    });
}

// ─── Category helper ─────────────────────────────────────────────────────────

function getTopCategoryForMetric(metric) {
    let current = metric;
    let category = null;
    while (current && current.parent) {
        const parent = originalData.find(d => d.id === current.parent);
        if (!parent) break;
        // A top-level category has parent === root (id 9999) or no parent of its own
        if (!parent.parent || parent.parent === 9999) {
            category = parent;
            break;
        }
        category = parent;
        current = parent;
    }
    return category ? category.name : 'Other';
}

// ─── Diff view renderer ───────────────────────────────────────────────────────

function renderDiffView() {
    const diffView = document.getElementById('diff-view');
    if (!diffView) return;

    const { leftType, leftValue, rightType, rightValue } = compareState;
    const bothSelected = leftValue !== 'all' && rightValue !== 'all';

    const sortWrapper = document.getElementById('compare-sort-group-wrapper');
    if (!bothSelected) {
        diffView.innerHTML = '<div class="centered-message">Choose what you want to compare →</div>';
        updateCompareSummary(null);
        if (sortWrapper) sortWrapper.style.display = 'none';
        return;
    }
    if (sortWrapper) sortWrapper.style.display = '';

    const leftMetrics  = filterMetricsByDimension(leftType,  leftValue);
    const rightMetrics = filterMetricsByDimension(rightType, rightValue);

    const leftIds  = new Set(leftMetrics.map(m => m.id));
    const rightIds = new Set(rightMetrics.map(m => m.id));

    // Merge deduped
    const allMetrics = [...new Map([...leftMetrics, ...rightMetrics].map(m => [m.id, m])).values()];

    // Stats
    const shared    = allMetrics.filter(m => leftIds.has(m.id) && rightIds.has(m.id)).length;
    const leftOnly  = leftMetrics.length  - shared;
    const rightOnly = rightMetrics.length - shared;
    updateCompareSummary({ shared, leftOnly, rightOnly, leftValue, rightValue, leftType, rightType });
    if (typeof updateStepBar === 'function') updateStepBar();

    // Popularity tiers: computed from all metrics globally so labels are consistent across comparisons
    const popularityScore = m => ((m.company || []).length + (m.research || []).length);
    const globalScores = originalData.filter(m => m.type).map(popularityScore).sort((a, b) => a - b);
    const pThreshold = pct => globalScores[Math.floor(globalScores.length * pct)] ?? Infinity;
    const pop1  = pThreshold(0.99);
    const pop5  = pThreshold(0.95);
    const pop10 = pThreshold(0.90);

    // Group by selected sort dimension
    const byCategory = {};
    allMetrics.forEach(metric => {
        const key = getGroupKeyForMetric(metric, compareSort);
        if (!byCategory[key]) byCategory[key] = [];
        byCategory[key].push(metric);
    });

    let html = `<div class="diff-categories">`;

    Object.entries(byCategory)
        .sort(([a], [b]) => sortGroupKey(a, b))
        .forEach(([cat, metrics]) => {
            const sorted = [...metrics].sort((a, b) => {
                // Shared (gray) first, then left-only (purple), then right-only (green)
                const uniqueness = m => {
                    const l = leftIds.has(m.id), r = rightIds.has(m.id);
                    if (l && r)  return 0;
                    if (l && !r) return 1;
                    return 2;
                };
                const diff = uniqueness(a) - uniqueness(b);
                return diff !== 0 ? diff : a.name.localeCompare(b.name);
            });

            const sharedCount = sorted.filter(m =>  leftIds.has(m.id) &&  rightIds.has(m.id)).length;
            const leftOnlyCount  = sorted.filter(m =>  leftIds.has(m.id) && !rightIds.has(m.id)).length;
            const rightOnlyCount = sorted.filter(m => !leftIds.has(m.id) &&  rightIds.has(m.id)).length;
            const total = sorted.length;
            const lPct = total > 0 ? Math.round(leftOnlyCount  / total * 100) : 0;
            const sPct = total > 0 ? Math.round(sharedCount    / total * 100) : 0;
            const rPct = 100 - lPct - sPct;

            const catTooltip = DIMENSION_TOOLTIPS[cat] ? ` title="${DIMENSION_TOOLTIPS[cat]}"` : '';
            const catDisplay = (compareSort === 'maturity' && MATURITY_FULL_LABEL[cat]) ? MATURITY_FULL_LABEL[cat] : cat;
            html += `<div class="diff-category">
                <div class="diff-category-header" onclick="this.parentElement.classList.toggle('diff-category--collapsed')">
                    <span class="diff-category-chevron">▾</span>
                    <span class="diff-category-name"${catTooltip}>${catDisplay}</span>
                    <span class="diff-category-bar" title="${leftOnlyCount} unique to ${shortLabel(leftValue)} · ${sharedCount} shared · ${rightOnlyCount} unique to ${shortLabel(rightValue)}">${leftOnlyCount > 0 ? `<span class="sort-chart-bar-fill sort-chart-bar-fill--left" style="width:${leftOnlyCount/total*100}%"></span>` : ''}${sharedCount > 0 ? `<span class="sort-chart-bar-fill sort-chart-bar-fill--shared" style="width:${sharedCount/total*100}%"></span>` : ''}${rightOnlyCount > 0 ? `<span class="sort-chart-bar-fill sort-chart-bar-fill--right" style="width:${rightOnlyCount/total*100}%"></span>` : ''}</span>
                </div>
                <div class="diff-metrics">`;

            sorted.forEach(metric => {
                const inLeft  = leftIds.has(metric.id);
                const inRight = rightIds.has(metric.id);
                let cls, badgeContent;
                if (inLeft && inRight) {
                    cls = 'diff-badge--shared';
                    badgeContent = '↔';
                } else if (inLeft) {
                    cls = 'diff-badge--left';
                    badgeContent = getEntityBadgeContent(leftType, leftValue, 14);
                } else {
                    cls = 'diff-badge--right';
                    badgeContent = getEntityBadgeContent(rightType, rightValue, 14);
                }

                const shortlisted = clickedMetrics.find(m => m.id === metric.id);
                const statusBadge = shortlisted
                    ? `<span class="metric-status-badge ${shortlisted.collectionStatus === 'capturing' ? 'status-capturing' : 'status-planning'}">${shortlisted.collectionStatus === 'capturing' ? '✓ Tracking' : '+ Planned'}</span>`
                    : '';

                const score = popularityScore(metric);
                const popLabel = score >= pop1 ? 'top 1%' : score >= pop5 ? 'top 5%' : score >= pop10 ? 'top 10%' : null;
                const popularityBadge = popLabel
                    ? `<span class="diff-popularity-badge" title="Used by ${score} companies/frameworks">&#9733; ${popLabel}</span>`
                    : '';

                html += `<div class="diff-metric-row" data-metric-id="${metric.id}" role="button" tabindex="0">
                    <span class="diff-badge ${cls}">${badgeContent}</span>
                    <span class="diff-metric-name">${metric.name}</span>
                    ${popularityBadge}
                    ${statusBadge}
                </div>`;
            });

            html += `</div></div>`;
        });

    html += `</div>`;
    diffView.innerHTML = html;

    // Wire metric clicks → same tooltip as Explore (pass the mouse event for positioning)
    diffView.querySelectorAll('.diff-metric-row').forEach(row => {
        row.addEventListener('click', (e) => {
            e.stopPropagation();
            const metric = originalData.find(m => m.id === parseInt(row.dataset.metricId));
            if (metric && typeof showCustomTooltip === 'function') showCustomTooltip(metric, e);
        });
    });

    renderSortCharts(buildSortChartData(leftMetrics, rightMetrics));
}

function shortLabel(value) {
    return value.replace(/ Framework$/i, '');
}

function updateCompareSummary(stats) {
    const el = document.getElementById('compare-summary');
    if (!el) return;
    if (!stats) { el.innerHTML = ''; return; }
    const { shared, leftOnly, rightOnly, leftValue, rightValue, leftType, rightType } = stats;
    const typeLabel = t => ({ company: 'company', framework: 'framework', maturity: 'maturity', outcome: 'outcome', shortlist: 'shortlist' }[t] || t);
    const labelFor = (type, value) => {
        if (type === 'shortlist') return 'My Shortlist';
        if (type === 'framework') return frameworkLink(value, shortLabel(value));
        if (type === 'maturity')  return MATURITY_FULL_LABEL[value] || value;
        return shortLabel(value);
    };
    const comparingLabel = `Comparing ${labelFor(leftType, leftValue)} (${typeLabel(leftType)}) to ${labelFor(rightType, rightValue)} (${typeLabel(rightType)})`;
    el.innerHTML = `<div class="filter-group-label">${comparingLabel}</div><div class="compare-stats">
        <div class="compare-stat compare-stat--shared">
            <span class="compare-stat-badge compare-stat-badge--shared">↔</span>
            <strong>${shared}</strong> shared
        </div>
        <div class="compare-stat compare-stat--left">
            <span class="compare-stat-badge compare-stat-badge--left">${getEntityBadgeContent(leftType, leftValue, 12)}</span>
            <strong>${leftOnly}</strong><span> unique to ${labelFor(leftType, leftValue)}</span>
        </div>
        <div class="compare-stat compare-stat--right">
            <span class="compare-stat-badge compare-stat-badge--right">${getEntityBadgeContent(rightType, rightValue, 12)}</span>
            <strong>${rightOnly}</strong><span> unique to ${labelFor(rightType, rightValue)}</span>
        </div>
    </div>`;
}

// ─── Current sort mode ───────────────────────────────────────────────────────

let compareSort = 'category';

function getGroupKeyForMetric(metric, sort) {
    if (sort === 'outcome')  return metric.outcome_goals || 'Other';
    if (sort === 'maturity') return metric.ease_of_collection || 'Other';
    if (sort === 'alpha')    return metric.name[0].toUpperCase();
    if (sort === 'datatype') {
        if (metric.type === 'qualitative')  return '📋 Self-reported';
        if (metric.type === 'quantitative') return '⚙️ Automated';
        if (metric.type === 'both')         return '📋⚙️ Both';
        return 'Other';
    }
    if (sort === 'ai') {
        if (metric.ai_specific_category === 'Impact')      return '🎯 AI Impact';
        if (metric.ai_specific_category === 'Utilization') return '📊 AI Utilization';
        if (metric.ai_specific_category === 'Cost')        return '💰 AI Cost';
        return 'Other';
    }
    return getTopCategoryForMetric(metric); // 'category' (default)
}

// ─── Sort dimension mini charts ───────────────────────────────────────────────

function buildSortChartData(leftMetrics, rightMetrics) {
    const leftIds = new Set(leftMetrics.map(m => m.id));
    const rightIds = new Set(rightMetrics.map(m => m.id));
    const allMetrics = [...new Map([...leftMetrics, ...rightMetrics].map(m => [m.id, m])).values()];

    const dims = [
        { sort: 'category', label: 'Category' },
        { sort: 'outcome',  label: 'Outcome goals' },
        { sort: 'maturity', label: 'Maturity' },
        { sort: 'datatype', label: 'Data type' },
        { sort: 'ai',       label: 'AI impact' },
    ];

    return dims.map(({ sort, label }) => {
        const groups = {};
        allMetrics.forEach(metric => {
            const key = getGroupKeyForMetric(metric, sort);
            if (!groups[key]) groups[key] = { left: 0, shared: 0, right: 0 };
            if (leftIds.has(metric.id) && rightIds.has(metric.id)) groups[key].shared++;
            else if (leftIds.has(metric.id)) groups[key].left++;
            else groups[key].right++;
        });
        const allGroups = Object.entries(groups)
            .map(([key, counts]) => ({ key, ...counts }))
            .filter(g => g.left + g.shared + g.right > 0)
            .filter(g => !(sort === 'ai' && g.key === 'Other'))
            .sort((a, b) => sortGroupKey(a.key, b.key));
        const hiddenCount = Math.max(0, allGroups.length - 4);
        return { sort, label, groups: allGroups.slice(0, 4), hiddenCount };
    });
}

function renderSortCharts(chartDataArray) {
    const container = document.getElementById('compare-sort-charts');
    if (!container) return;
    container.innerHTML = '';

    chartDataArray.forEach(({ sort, label, groups, hiddenCount }) => {
        const card = document.createElement('div');
        card.className = 'compare-sort-chart-card' + (compareSort === sort ? ' compare-sort-chart-card--active' : '');
        card.dataset.sort = sort;

        const titleEl = document.createElement('div');
        titleEl.className = 'compare-sort-chart-label';
        titleEl.textContent = label;
        if (SORT_CARD_TOOLTIPS[sort]) titleEl.title = SORT_CARD_TOOLTIPS[sort];
        card.appendChild(titleEl);

        const barsEl = document.createElement('div');
        barsEl.className = 'sort-chart-bars';

        groups.forEach(g => {
            const total = g.left + g.shared + g.right;
            const row = document.createElement('div');
            row.className = 'sort-chart-row';
            const rowDesc = (sort === 'maturity' && MATURITY_FULL_LABEL[g.key])
                ? MATURITY_FULL_LABEL[g.key]
                : (DIMENSION_TOOLTIPS[g.key] || g.key);
            const typeLabel = t => ({ company: 'company', framework: 'framework', maturity: 'maturity', outcome: 'outcome' }[t] || t);
            const leftLabel  = `${shortLabel(compareState.leftValue)} (${typeLabel(compareState.leftType)})`;
            const rightLabel = `${shortLabel(compareState.rightValue)} (${typeLabel(compareState.rightType)})`;
            row.title = `${rowDesc} — ${g.left} unique to ${leftLabel} / ${g.shared} shared / ${g.right} unique to ${rightLabel}`;

            const labelEl = document.createElement('div');
            labelEl.className = 'sort-chart-row-label';
            const displayKey = (sort === 'maturity' && MATURITY_SHORT_LABEL[g.key]) ? MATURITY_SHORT_LABEL[g.key] : g.key;
            // Strip all leading non-letter chars (emoji, symbols, spaces)
            labelEl.textContent = displayKey.replace(/^[^\p{L}]+/u, '');

            const track = document.createElement('div');
            track.className = 'sort-chart-bar-track';

            [
                { count: g.left,   cls: 'sort-chart-bar-fill--left' },
                { count: g.shared, cls: 'sort-chart-bar-fill--shared' },
                { count: g.right,  cls: 'sort-chart-bar-fill--right' },
            ].forEach(({ count, cls }) => {
                if (count <= 0) return;
                const fill = document.createElement('div');
                fill.className = `sort-chart-bar-fill ${cls}`;
                // Proportional within bar (full-width stacked)
                fill.style.width = (count / total * 100) + '%';
                track.appendChild(fill);
            });

            const countEl = document.createElement('div');
            countEl.className = 'sort-chart-row-count';
            countEl.textContent = total;

            row.appendChild(labelEl);
            row.appendChild(track);
            row.appendChild(countEl);
            barsEl.appendChild(row);
        });

        if (hiddenCount > 0) {
            const moreEl = document.createElement('div');
            moreEl.className = 'sort-chart-more';
            moreEl.textContent = `+${hiddenCount} more`;
            barsEl.appendChild(moreEl);
        }

        card.appendChild(barsEl);
        card.addEventListener('click', () => {
            compareSort = sort;
            renderDiffView();
        });
        container.appendChild(card);
    });
}

function syncShortlistOptionVisibility() {
    const leftOpt  = document.querySelector('#compare-left-type  option[value="shortlist"]');
    const rightOpt = document.querySelector('#compare-right-type option[value="shortlist"]');
    if (leftOpt)  leftOpt.hidden  = compareState.rightType === 'shortlist';
    if (rightOpt) rightOpt.hidden = compareState.leftType  === 'shortlist';
}

// ─── Compare panel initialization ────────────────────────────────────────────

function initCompareControls() {
    const leftType  = document.getElementById('compare-left-type');
    const leftValue = document.getElementById('compare-left-value');
    const rightType  = document.getElementById('compare-right-type');
    const rightValue = document.getElementById('compare-right-value');

    function updateLogoPreview(side) {
        const valueEl = document.getElementById(`compare-${side}-value`);
        if (valueEl) applyLogoBg(valueEl, compareState[side + 'Type'], compareState[side + 'Value'], side);
    }

    function clearPresetHighlight() {
        document.querySelectorAll('.compare-preset-btn').forEach(b => b.classList.remove('compare-preset-btn--active'));
    }

    function onTypeChange(typeEl, valueEl, side) {
        compareState[side + 'Type'] = typeEl.value;
        populateValueDropdown(valueEl, typeEl.value, 'all');
        if (typeEl.value === 'shortlist') {
            compareState[side + 'Value'] = 'shortlist';
        } else {
            // Pre-select a random value from the populated options
            const opts = [...valueEl.options].filter(o => o.value !== 'all');
            const randomOpt = opts[Math.floor(Math.random() * opts.length)];
            const picked = randomOpt ? randomOpt.value : 'all';
            valueEl.value = picked;
            compareState[side + 'Value'] = picked;
        }
        syncShortlistOptionVisibility();
        clearPresetHighlight();
        renderDiffView();
        updateLogoPreview(side);
        if (typeof updateStepBar === 'function') updateStepBar();
    }

    function onValueChange(valueEl, side) {
        compareState[side + 'Value'] = valueEl.value;
        clearPresetHighlight();
        renderDiffView();
        updateLogoPreview(side);
        if (typeof updateStepBar === 'function') updateStepBar();
    }

    leftType.addEventListener('change',  () => onTypeChange(leftType, leftValue, 'left'));
    leftValue.addEventListener('change', () => onValueChange(leftValue, 'left'));
    rightType.addEventListener('change',  () => onTypeChange(rightType, rightValue, 'right'));
    rightValue.addEventListener('change', () => onValueChange(rightValue, 'right'));

    // Populate initial value dropdowns
    populateValueDropdown(leftValue,  leftType.value,  compareState.leftValue);
    populateValueDropdown(rightValue, rightType.value, compareState.rightValue);
    updateLogoPreview('left');
    updateLogoPreview('right');

}

// Wire preset buttons
function applyComparePreset(leftType, leftValue, rightType, rightValue) {
    const ltEl = document.getElementById('compare-left-type');
    const lvEl = document.getElementById('compare-left-value');
    const rtEl = document.getElementById('compare-right-type');
    const rvEl = document.getElementById('compare-right-value');
    if (!ltEl || !lvEl || !rtEl || !rvEl) return;

    ltEl.value = leftType;
    rtEl.value = rightType;
    compareState.leftType  = leftType;
    compareState.rightType = rightType;
    populateValueDropdown(lvEl, leftType,  leftValue);
    populateValueDropdown(rvEl, rightType, rightValue);
    compareState.leftValue  = leftValue;
    compareState.rightValue = rightValue;

    // Highlight active preset
    document.querySelectorAll('.compare-preset-btn').forEach(b => b.classList.remove('compare-preset-btn--active'));
    const active = [...document.querySelectorAll('.compare-preset-btn')].find(
        b => b.dataset.leftType === leftType && b.dataset.leftValue === leftValue &&
             b.dataset.rightType === rightType && b.dataset.rightValue === rightValue
    );
    if (active) active.classList.add('compare-preset-btn--active');

    syncShortlistOptionVisibility();
    renderDiffView();
    ['left', 'right'].forEach(side => {
        const valueEl = document.getElementById(`compare-${side}-value`);
        if (valueEl) applyLogoBg(valueEl, compareState[side + 'Type'], compareState[side + 'Value'], side);
    });
    if (typeof updateStepBar === 'function') updateStepBar();
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.compare-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            applyComparePreset(btn.dataset.leftType, btn.dataset.leftValue, btn.dataset.rightType, btn.dataset.rightValue);
        });
    });

    // Show company favicon as background-image inside the step 1 company filter dropdown
    const companyDropdown = document.getElementById('company-dropdown');

    function updateCompanyFilterLogo() {
        if (companyDropdown) applyLogoBg(companyDropdown, 'company', companyDropdown.value);
    }

    if (companyDropdown) {
        companyDropdown.addEventListener('change', updateCompanyFilterLogo);
        updateCompanyFilterLogo();
    }
});

// Called once on DOMContentLoaded — wires events but can't populate data-driven dropdowns yet
document.addEventListener('DOMContentLoaded', initCompareControls);

// Called from filterData() after originalData is populated — populates value dropdowns
function refreshCompareValueDropdowns() {
    const leftType  = document.getElementById('compare-left-type');
    const leftValue = document.getElementById('compare-left-value');
    const rightType  = document.getElementById('compare-right-type');
    const rightValue = document.getElementById('compare-right-value');
    if (!leftType || !leftValue || !rightType || !rightValue) return;
    // Only repopulate if the dropdown is still empty (first load)
    // Sync compareState type from actual select value (covers page-load race)
    compareState.leftType  = leftType.value;
    compareState.rightType = rightType.value;
    if (leftValue.options.length <= 1) {
        populateValueDropdown(leftValue,  leftType.value,  compareState.leftValue);
    }
    if (rightValue.options.length <= 1) {
        populateValueDropdown(rightValue, rightType.value, compareState.rightValue);
    }
}
