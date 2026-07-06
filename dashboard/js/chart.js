// ─── AnyChart sunburst & custom tooltip ──────────────────────────────────────

const DIMENSION_COLORS = {
    'Process':              '#0EA5E9',
    'System':               '#F97316',
    'Developer Enablement': '#22C55E',
    'Business':             '#EF4444',
    'Quality':              '#8B5CF6',
    'Team':                 '#F59E0B',
    'Output':               '#EC4899',
    'Customer':             '#14B8A6',
};

const COLOR_BY_CONFIG = {
    type: {
        label: 'Data collection type',
        map: { qualitative: '#0072B2', quantitative: '#E69F00', both: '#009E73' },
        legend: [
            { color: '#0072B2', label: 'Self-reported' },
            { color: '#E69F00', label: 'Automated' },
            { color: '#009E73', label: 'Both' },
        ],
        getValue: d => d.type,
    },
    is_research: {
        label: 'Research vs industry',
        map: { 1: '#009E73', 2: '#0072B2', 3: '#E69F00' },
        legend: [
            { color: '#009E73', label: 'Proposed by research only' },
            { color: '#0072B2', label: 'Applied in industry only' },
            { color: '#E69F00', label: 'Applied by both' },
        ],
        getValue: d => d.is_research,
    },
    outcome_goals: {
        label: 'Outcome goals',
        map: {
            'Developer Experience': '#0072B2',
            'Product Excellence': '#009E73',
            'Organizational Effectiveness': '#E69F00',
        },
        legend: [
            { color: '#0072B2', label: 'Developer Experience' },
            { color: '#009E73', label: 'Product Excellence' },
            { color: '#E69F00', label: 'Organizational Effectiveness' },
        ],
        getValue: d => d.outcome_goals,
    },
    ease_of_collection: {
        label: 'Collection maturity',
        map: { Easy: '#009E73', Moderate: '#E69F00', Complex: '#0072B2' },
        legend: [
            { color: '#009E73', label: 'Getting started (easy)' },
            { color: '#E69F00', label: 'Established (moderate)' },
            { color: '#0072B2', label: 'Advanced (complex)' },
        ],
        getValue: d => d.ease_of_collection,
    },
    collection_status: {
        label: 'Collection status',
        map: { capturing: '#16a34a', planning: '#3b82f6' },
        legend: [
            { color: '#9e9e9e', label: 'No status' },
            { color: '#16a34a', label: 'Already tracking' },
            { color: '#3b82f6', label: 'Plan to track' },
        ],
        getValue: d => {
            const found = clickedMetrics.find(m => m.id === d.id);
            return found ? found.collectionStatus : null;
        },
    },
    popularity: {
        label: 'Popularity',
        legend: 'gradient',
        getValue: d => d.value,
    },
};

function lerpColor(hex1, hex2, t) {
    const parse = h => [
        parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)
    ];
    const [r1, g1, b1] = parse(hex1), [r2, g2, b2] = parse(hex2);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

// Maps metric id → fill color for the current colorBy dimension.
// Populated by computeColors(); read by the chart.fill() callback via this.iterator.get('id').
const _colorLookup = new Map();

function computeColors(data, colorBy) {
    _colorLookup.clear();
    if (colorBy === 'categorization') return;

    if (colorBy === 'popularity') {
        const vals = data.filter(d => d.type).map(d => d.value || 0);
        const min = Math.min(...vals), max = Math.max(...vals);
        data.filter(d => d.type).forEach(d => {
            const t = max > min ? (d.value - min) / (max - min) : 0.5;
            _colorLookup.set(d.id, lerpColor('#FDBA74', '#B45309', t));
        });
        return;
    }

    const config = COLOR_BY_CONFIG[colorBy];
    if (!config) return;
    data.filter(d => d.type).forEach(d => {
        const val = config.getValue(d);
        _colorLookup.set(d.id, (val != null && config.map[val]) ? config.map[val] : '#9e9e9e');
    });
}

function updateColorLegend(colorBy) {
    const el = document.getElementById('color-legend');
    if (!el) return;
    if (colorBy === 'categorization') {
        el.innerHTML = '';
        el.style.display = 'none';
        return;
    }
    el.style.display = 'flex';
    if (colorBy === 'popularity') {
        el.innerHTML = `
            <div class="color-legend-gradient">
                <div class="color-legend-gradient-bar"></div>
                <div class="color-legend-gradient-labels">
                    <span>Fewer mentions</span><span>More mentions</span>
                </div>
            </div>`;
        return;
    }
    const config = COLOR_BY_CONFIG[colorBy];
    if (!config) return;
    el.innerHTML = config.legend.map(e =>
        `<span class="color-legend-item">
            <span class="color-legend-swatch" style="background:${e.color}"></span>
            <span class="color-legend-label">${e.label}</span>
        </span>`
    ).join('');
}

function addMetricCounts(data) {
    const childrenMap = {};
    for (const node of data) {
        if (node.parent != null) {
            (childrenMap[node.parent] ??= []).push(node);
        }
    }
    function countMetrics(nodeId) {
        const children = childrenMap[nodeId] ?? [];
        return children.reduce((sum, child) =>
            sum + (child.type ? 1 : countMetrics(child.id)), 0);
    }
    for (const node of data) {
        if (!node.type) {
            node.metricCount = countMetrics(node.id);
        }
    }
}

// ─── First-time hint: points an arrow at a metric to teach that the outer ring is clickable ──

const METRIC_HINT_DISMISSED_KEY = 'metricClickHintDismissed';

function dismissMetricClickHint() {
    localStorage.setItem(METRIC_HINT_DISMISSED_KEY, '1');
    hideMetricClickHint();
}

function hideMetricClickHint() {
    const bubble = document.getElementById('metric-hint-bubble');
    const svg = document.getElementById('metric-hint-arrow-svg');
    if (bubble) bubble.style.display = 'none';
    if (svg) svg.style.display = 'none';
}

// Labels are rendered via chart.labels().useHtml(true), i.e. as real HTML text nodes
// inside #container — find the one showing this metric's name so the hint can point
// at wherever AnyChart actually laid it out (this varies with filters/data/screen size).
function findMetricLabelEl(name) {
    return Array.from(document.querySelectorAll('#container *')).find(el =>
        el.children.length === 0 && el.textContent.trim() === name && el.getClientRects().length > 0
    );
}

function showMetricClickHint(data) {
    if (localStorage.getItem(METRIC_HINT_DISMISSED_KEY) === '1') return;

    const candidates = data.filter(d => d.type);
    if (!candidates.length) { hideMetricClickHint(); return; }
    const target = candidates.reduce((best, d) => (d.value || 0) > (best.value || 0) ? d : best);

    // AnyChart hides labels that don't fit their arc — if the target's label isn't
    // actually rendered, skip the hint rather than pointing at nothing.
    const labelEl = findMetricLabelEl(target.name);
    const leftContainer = document.querySelector('.left-container');
    const chartEl = document.getElementById('container');
    const bubble = document.getElementById('metric-hint-bubble');
    const svg = document.getElementById('metric-hint-arrow-svg');
    const path = document.getElementById('metric-hint-arrow-path');
    const textEl = document.getElementById('metric-hint-text');
    if (!labelEl || !leftContainer || !chartEl || !bubble || !svg || !path || !textEl) { hideMetricClickHint(); return; }

    const containerRect = leftContainer.getBoundingClientRect();
    const chartRect = chartEl.getBoundingClientRect();
    const labelRect = labelEl.getBoundingClientRect();

    const labelCenterX = labelRect.left + labelRect.width / 2 - containerRect.left;
    const labelCenterY = labelRect.top + labelRect.height / 2 - containerRect.top;
    const centerX = chartRect.left + chartRect.width / 2 - containerRect.left;
    const centerY = chartRect.top + chartRect.height / 2 - containerRect.top;

    // Direction from the sunburst's center out through the target label — used both
    // to place the text just outside the ring, and to find where the arrow should
    // touch the label's box (its outer edge, not the text itself).
    let dx = labelCenterX - centerX, dy = labelCenterY - centerY;
    const dist = Math.hypot(dx, dy) || 1;
    dx /= dist; dy /= dist;

    // Point where a ray from the label's center in direction (dx, dy) exits its
    // bounding box — i.e. the edge of the metric's box facing the hint text.
    const halfW = labelRect.width / 2, halfH = labelRect.height / 2;
    const edgeT = Math.min(Math.abs(dx) > 1e-6 ? halfW / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-6 ? halfH / Math.abs(dy) : Infinity);
    const tipX = labelCenterX + dx * edgeT;
    const tipY = labelCenterY + dy * edgeT;

    textEl.textContent = 'click for details';
    bubble.style.display = 'flex';
    bubble.style.left = '0px';
    bubble.style.top = '0px';
    const bubbleRect = bubble.getBoundingClientRect();

    const offset = 45;
    let left = tipX + dx * offset - bubbleRect.width / 2;
    let top = tipY + dy * offset - bubbleRect.height / 2;
    left = Math.min(Math.max(left, 10), containerRect.width - bubbleRect.width - 10);
    top = Math.min(Math.max(top, 10), containerRect.height - bubbleRect.height - 10);
    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;

    // Arrow starts from whichever edge of the text box faces back toward the metric.
    const boxCenterX = left + bubbleRect.width / 2;
    const boxCenterY = top + bubbleRect.height / 2;
    const anchorX = boxCenterX - dx * (bubbleRect.width / 2 + 4);
    const anchorY = boxCenterY - dy * (bubbleRect.height / 2 + 4);

    // Curve the arrow via a control point offset perpendicular to the anchor→tip line,
    // for a hand-drawn feel instead of a straight ruler line.
    const midX = (anchorX + tipX) / 2;
    const midY = (anchorY + tipY) / 2;
    const perpX = -(tipY - anchorY), perpY = (tipX - anchorX);
    const perpLen = Math.hypot(perpX, perpY) || 1;
    const curl = 18;
    const ctrlX = midX + (perpX / perpLen) * curl;
    const ctrlY = midY + (perpY / perpLen) * curl;

    svg.setAttribute('width', containerRect.width);
    svg.setAttribute('height', containerRect.height);
    svg.style.display = 'block';
    path.setAttribute('d', `M${anchorX},${anchorY} Q${ctrlX},${ctrlY} ${tipX},${tipY}`);
}

function createChart(data) {
    if (chart) { chart.dispose(); }

    computeColors(data, currentColorBy);
    addMetricCounts(data);

    // Category/subcategory nodes have `normal.fill` baked into data.json, which
    // overrides chart.fill() callbacks. Strip it for non-default coloring so the
    // fill callback can make them gray. Must truly remove the key (not set to
    // undefined) so AnyChart doesn't fall back to the baked-in value.
    const chartData = currentColorBy === 'categorization'
        ? data
        : data.map(d => {
            if (d.type) return d;
            const { normal, ...rest } = d;
            return rest;
        });

    const dataTree = anychart.data.tree(chartData, 'as-table');
    chart = anychart.sunburst(dataTree);

    chart.tooltip().format(function() {
        if (this.getData('type')) {
            return this.getData('name') + '\n' + this.getData('value') + ' mentions · Click for details';
        }
        const count = this.getData('metricCount');
        if (count) {
            return this.getData('name') + '\n' + count + ' metric' + (count !== 1 ? 's' : '');
        }
        return this.getData('name');
    });
    chart.tooltip().title(false);
    chart.tooltip().separator(false);
    chart.contextMenu().enabled(false);
    chart.calculationMode('parent-independent');
    chart.labels().useHtml(true);
    chart.labels().format(function() {
        const name = this.getData('name');
        // In non-categorization mode, parent/subcategory nodes get a gray fill —
        // use dark text so labels are readable against the light background.
        if (currentColorBy !== 'categorization' && !this.getData('type')) {
            return `<span style="color:#333333;">${name}</span>`;
        }
        return name;
    });
    chart.labels().position("radial");

    function normalFill() {
        if (currentColorBy === 'categorization') {
            if (!this.parent) return '#1B1AFF';
            const name = this.iterator && this.iterator.get('name');
            if (name && DIMENSION_COLORS[name]) return DIMENSION_COLORS[name];
            return anychart.color.lighten(this.parentColor, 0.15);
        }
        const isLeaf = this.iterator && this.iterator.get('type');
        if (isLeaf) {
            const id = this.iterator.get('id');
            const color = (id != null) ? _colorLookup.get(id) : null;
            return color || '#9e9e9e';
        }
        return '#e8e8e8';
    }

    chart.fill(normalFill);

    chart.hovered().fill(function() {
        const isLeaf = this.iterator && this.iterator.get('type');
        if (!isLeaf) return this.sourceColor;
        return anychart.color.lighten(this.sourceColor, 0.3);
    });

    chart.listen('pointMouseMove', function(e) {
        const isLeaf = e.point && e.point.node && e.point.node.meta('isLeaf');
        document.getElementById('container').style.cursor = isLeaf ? 'pointer' : 'auto';
    });
    chart.listen('pointMouseOut', function() {
        document.getElementById('container').style.cursor = 'auto';
    });

    chart.listen('chartDraw', function() {
        showMetricClickHint(data);
    });

    chart.listen('pointClick', function(e) {
        const point = e.point;
        if (point && point.get('type')) {
            dismissMetricClickHint();
            logEvent(TELEMETRY.METRIC_OPENED, { metricId: point.get('id'), metricName: point.get('name'), currentStep: typeof currentStep !== 'undefined' ? currentStep : null });
            const metricData = {
                id: point.get('id'),
                name: point.get('name'),
                alsoknownas: point.get('alsoknownas'),
                company: point.get('company'),
                research: point.get('research'),
                type: point.get('type'),
                description: point.get('description'),
                value: point.get('value'),
                is_research: point.get('is_research'),
                ai_specific_category: point.get('ai_specific_category'),
                outcome_goals: point.get('outcome_goals'),
                ease_of_collection: point.get('ease_of_collection')
            };
            showCustomTooltip(metricData, e.originalEvent);
        }
    });

    chart.interactivity().selectionMode("none"); // disable drill-down
    chart.container('container');
    chart.draw();
}

function buildTooltipContent(metricData, excludeId = null) {
    const metricName = metricData.name;
    const metricAlsoKnownAs = metricData.alsoknownas;
    const metricType = metricData.type;
    const metricDescription = metricData.description;
    const metricValue = metricData.value;
    const metricId = metricData.id;
    const metricIs_Research = metricData.is_research;
    const metricAISpecificCategory = metricData.ai_specific_category;
    const metricOutcomeGoals = metricData.outcome_goals;
    const metricEaseOfCollection = metricData.ease_of_collection;

    let typeTagClass = '';
    let typeTagText = '';
    if (metricType === 'qualitative') {
        typeTagClass = 'survey-based';
        typeTagText = '📋 Self-reported';
    } else if (metricType === 'quantitative') {
        typeTagClass = 'telemetry-log-based';
        typeTagText = '⚙️ Automated';
    } else if (metricType === 'both') {
        typeTagClass = 'both-types';
        typeTagText = '📋⚙️ Self-reported & Automated';
    }

    let focusTagClass = '';
    let focusTagText = '';
    if (metricIs_Research === 2) {
        focusTagClass = 'practitioners-only';
        focusTagText = '🏭 Applied in industry';
    } else if (metricIs_Research === 1) {
        focusTagClass = 'research-only';
        focusTagText = '🔬 Proposed by research';
    } else {
        focusTagClass = 'research-and-practitioners';
        focusTagText = '🔬🏭 Applied by industry and research';
    }

    let AImetricTagText = '';
    if (metricAISpecificCategory === "Utilization") {
        AImetricTagText = "📊 AI Utilization";
    } else if (metricAISpecificCategory === "Impact") {
        AImetricTagText = "🎯 AI Impact";
    } else if (metricAISpecificCategory === "Cost") {
        AImetricTagText = "💰 AI Cost";
    }

    let companyUsedByHtml = 'no mentions';
    if (Array.isArray(metricData.company) && metricData.company.length > 0) {
        companyUsedByHtml = [...metricData.company].filter(s => s.url).sort((a, b) => a.name.localeCompare(b.name)).map(source => {
            const logoHtml = typeof getEntityBadgeContent === 'function'
                ? getEntityBadgeContent('company', source.name, 12)
                : '';
            const inner = `${logoHtml}${source.name}`;
            if (source.url && source.url !== '') {
                return `<span class="source-chip"><a href="${source.url}" target="_blank" rel="noopener noreferrer">${inner}</a></span>`;
            }
            return `<span class="source-chip">${inner}</span>`;
        }).join('; ');
    }

    let researchUsedByHtml = 'no mentions';
    if (Array.isArray(metricData.research) && metricData.research.length > 0) {
        researchUsedByHtml = [...metricData.research].filter(s => s.url).sort((a, b) => a.name.localeCompare(b.name)).map(source => {
            if (source.url && source.url !== '') {
                return `<a href="${source.url}" target="_blank" rel="noopener noreferrer">${source.name}</a>`;
            }
            return source.name;
        }).join('; ');
    }

    const companySizeOrder = ['Enterprise', 'Large', 'Mid-size', 'Small'];
    const companySizes = Array.isArray(metricData.company)
        ? [...new Set(metricData.company.map(s => s.company_size).filter(s => s && s !== 'N/A'))]
            .sort((a, b) => companySizeOrder.indexOf(a) - companySizeOrder.indexOf(b))
        : [];

    const srcMetric = originalData.find(m => m.id === metricId);
    const resolvedRelated = srcMetric
        ? (srcMetric.resolvedRelated || []).filter(m => m.id !== excludeId)
        : [];

    let content = `
        <span class="close-tooltip-button">&times;</span>
        <div class="metric-name-title">${metricName}</div> `;

    content += `${metricDescription || 'No description available'}</div>`;

    content += `
        <hr>
        <div class="metric-detail"><strong>Number of mentions:</strong> ${metricValue}</div>
        <div class="metric-detail"><strong>Companies:</strong> ${companyUsedByHtml}</div>
        <div class="metric-detail"><strong>Research:</strong> ${researchUsedByHtml}</div>
        <hr>
        <div class="metric-detail">
            <strong>Tags:</strong>
                <span class="metric-type-tag ${typeTagClass}">${typeTagText}</span>
                <span class="metric-focus-tag ${focusTagClass}">${focusTagText}</span>
                ${metricAISpecificCategory ? `<span class="metric-ai-specific-category-tag">${AImetricTagText}</span>` : ''}
                ${companySizes.map(s => `<span class="metric-company-size-tag size-${s.toLowerCase().replace('-', '')}">${{ Enterprise: '🏢', Large: '🏬', 'Mid-size': '🏠', Small: '🏡' }[s] || ''} ${s} Company</span>`).join('')}
                ${metricOutcomeGoals ? `<span class="metric-outcome-goals-tag outcome-${metricOutcomeGoals.toLowerCase().replace(/\s+/g, '-')}">${{ 'Developer Experience': '🧑‍💻 Developer Experience', 'Product Excellence': '⭐ Product Excellence', 'Organizational Effectiveness': '📈 Organizational Effectiveness' }[metricOutcomeGoals] || metricOutcomeGoals}</span>` : ''}
                ${metricEaseOfCollection ? `<span class="metric-ease-tag ease-${metricEaseOfCollection.toLowerCase()}">${MATURITY_FULL_LABEL[metricEaseOfCollection] || metricEaseOfCollection}</span>` : ''}
        </div>`;

    if (metricAlsoKnownAs && metricAlsoKnownAs !== '-') {
        content += `<hr><div class="metric-detail"><strong>Also known as:</strong> ${metricAlsoKnownAs}</div>`;
    }

    if (resolvedRelated.length > 0) {
        content += `
        <hr>
        <div class="metric-detail"><strong>Related metrics:</strong> ${resolvedRelated.map(m =>
            `<span class="related-metric-link" data-related-id="${m.id}">${m.name}</span>`
        ).join('; ')}</div>`;
    }

    content += `
        ${(function() {
            const existing = clickedMetrics.find(m => m.id === metricId);
            const status = existing ? existing.collectionStatus : null;
            const activeNone      = !status      ? 'active' : '';
            const activeCapturing = status === 'capturing' ? 'active' : '';
            const activePlanning  = status === 'planning'  ? 'active' : '';
            return `
        <hr>
        <div class="metric-detail"><strong>Your collection status</strong></div>
        <div class="segmented-control tooltip-status-control">
            <button class="filter-btn ${activeNone}"      data-metric-id="${metricId}" data-status="none">No status</button>
            <button class="filter-btn ${activeCapturing}" data-metric-id="${metricId}" data-status="capturing">✓ Already tracking</button>
            <button class="filter-btn ${activePlanning}"  data-metric-id="${metricId}" data-status="planning">+ Plan to track</button>
        </div>`;
        })()}
    `;

    content += `<div class="metric-detail report-metric-row">
        <button class="report-metric-btn" data-report-metric-id="${metricId}" data-report-metric-name="${metricName.replace(/"/g, '&quot;')}">Report an issue with this metric</button>
    </div>`;

    return content;
}

function wireTooltipListeners(tooltipEl, metricData, onClose) {
    tooltipEl.querySelectorAll('button[data-metric-id]').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const status = this.getAttribute('data-status');
            if (status === 'none') {
                removeClickedMetric(metricData.id);
            } else {
                addClickedMetric(metricData, status);
            }
            if (currentColorBy === 'collection_status') {
                createChart(filteredData);
                updateColorLegend(currentColorBy);
            }
            if (status !== 'none') {
                onClose();
                return;
            }
            // Update active state in-place without closing the tooltip
            tooltipEl.querySelectorAll('button[data-metric-id]').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });

    const reportBtn = tooltipEl.querySelector('.report-metric-btn');
    if (reportBtn) {
        reportBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            onClose();
            if (typeof window.openReportMetricOverlay === 'function') {
                window.openReportMetricOverlay('wrong', {
                    id:   parseInt(this.getAttribute('data-report-metric-id'), 10),
                    name: this.getAttribute('data-report-metric-name'),
                });
            }
        });
    }

    const closeButton = tooltipEl.querySelector('.close-tooltip-button');
    if (closeButton) {
        closeButton.addEventListener('click', function(e) {
            e.stopPropagation();
            onClose();
        });
    }
}

function showCustomTooltip(metricData, event) {
    hideCustomTooltip();

    customTooltip.innerHTML = buildTooltipContent(metricData);
    customTooltip.classList.add('active');

    const x = event.clientX + 15;
    const y = event.clientY + 15;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const tooltipRect = customTooltip.getBoundingClientRect();

    const left = (x + tooltipRect.width > viewportWidth - 20)
        ? event.clientX - tooltipRect.width - 15
        : x;
    const top = (y + tooltipRect.height > viewportHeight - 20)
        ? event.clientY - tooltipRect.height - 15
        : y;
    customTooltip.style.left = `${Math.max(10, left)}px`;
    customTooltip.style.top = `${Math.max(10, top)}px`;

    wireTooltipListeners(customTooltip, metricData, hideCustomTooltip);

    customTooltip.querySelectorAll('.related-metric-link').forEach(chip => {
        chip.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = parseInt(this.getAttribute('data-related-id'), 10);
            const related = originalData.find(m => m.id === id);
            if (related) showSecondaryTooltip(related, metricData.id);
        });
    });

    setTimeout(() => document.addEventListener('click', handleDocumentClick), 0);
}

function showSecondaryTooltip(metricData, excludeId = null) {
    customTooltip2.innerHTML = buildTooltipContent(metricData, excludeId);
    customTooltip2.classList.add('active');

    const rect1 = customTooltip.getBoundingClientRect();
    const rect2 = customTooltip2.getBoundingClientRect();
    const gap = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = rect1.right + gap;
    if (left + rect2.width > viewportWidth - 20) {
        left = rect1.left - rect2.width - gap;
    }
    customTooltip2.style.left = `${Math.max(10, left)}px`;

    let top = rect1.top;
    if (top + rect2.height > viewportHeight - 20) {
        top = viewportHeight - rect2.height - 20;
    }
    customTooltip2.style.top = `${Math.max(10, top)}px`;

    wireTooltipListeners(customTooltip2, metricData, () => customTooltip2.classList.remove('active'));

    customTooltip2.querySelectorAll('.related-metric-link').forEach(chip => {
        chip.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = parseInt(this.getAttribute('data-related-id'), 10);
            const related = originalData.find(m => m.id === id);
            if (related) showSecondaryTooltip(related, excludeId);
        });
    });
}

function hideCustomTooltip() {
    customTooltip.classList.remove('active');
    customTooltip2.classList.remove('active');
    document.removeEventListener('click', handleDocumentClick);
}

function handleDocumentClick(event) {
    if (customTooltip.classList.contains('active') &&
        !customTooltip.contains(event.target) &&
        !customTooltip2.contains(event.target)) {
        hideCustomTooltip();
    }
}

