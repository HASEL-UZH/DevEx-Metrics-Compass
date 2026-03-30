// ─── AnyChart sunburst & custom tooltip ──────────────────────────────────────

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

function createChart(data) {
    if (chart) { chart.dispose(); }

    addMetricCounts(data);
    const dataTree = anychart.data.tree(data, 'as-table');
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
    chart.labels().format("{%name}");
    chart.labels().position("radial");

    chart.fill(function() {
        if (this.parent)
            return anychart.color.lighten(this.parentColor, 0.15);
        return this.mainColor;
    });

    chart.listen('pointClick', function(e) {
        const point = e.point;
        if (point && point.get('type')) {
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

function showCustomTooltip(metricData, event) {
    hideCustomTooltip();

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
        typeTagText = 'Self-reported';
    } else if (metricType === 'quantitative') {
        typeTagClass = 'telemetry-log-based';
        typeTagText = 'Automated';
    } else if (metricType === 'both') {
        typeTagClass = 'both-types';
        typeTagText = 'Self-reported & Automated';
    }

    let focusTagClass = '';
    let focusTagText = '';
    if (metricIs_Research === 2) {
        focusTagClass = 'practitioners-only';
        focusTagText = 'Applied in industry';
    } else if (metricIs_Research === 1) {
        focusTagClass = 'research-only';
        focusTagText = 'Proposed by research';
    } else {
        focusTagClass = 'research-and-practitioners';
        focusTagText = 'Applied by industry and research';
    }

    let AImetricTagText = '';
    if (metricAISpecificCategory === "Utilization") {
        AImetricTagText = "AI Utilization";
    } else if (metricAISpecificCategory === "Impact") {
        AImetricTagText = "AI Impact";
    } else if (metricAISpecificCategory === "Cost") {
        AImetricTagText = "AI Cost";
    }

    let companyUsedByHtml = 'no mentions';
    if (Array.isArray(metricData.company) && metricData.company.length > 0) {
        companyUsedByHtml = [...metricData.company].sort((a, b) => a.name.localeCompare(b.name)).map(source => {
            if (source.url && source.url !== '') {
                return `<a href="${source.url}" target="_blank" rel="noopener noreferrer">${source.name}</a>`;
            }
            return source.name;
        }).join('; ');
    }

    let researchUsedByHtml = 'no mentions';
    if (Array.isArray(metricData.research) && metricData.research.length > 0) {
        researchUsedByHtml = [...metricData.research].sort((a, b) => a.name.localeCompare(b.name)).map(source => {
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

    let content = `
        <span class="close-tooltip-button">&times;</span>
        <br>
        <div class="metric-name-title">${metricName}</div> `;

    content += `${metricDescription || 'No description available'}</div>`;

    if (metricAlsoKnownAs && metricAlsoKnownAs !== '-') {
        content += `<hr><div class="metric-detail"><strong>Also known as:</strong> ${metricAlsoKnownAs}</div>`;
    }

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
                ${companySizes.map(s => `<span class="metric-company-size-tag size-${s.toLowerCase().replace('-', '')}">${s} Company</span>`).join('')}
                ${metricOutcomeGoals ? `<span class="metric-outcome-goals-tag outcome-${metricOutcomeGoals.toLowerCase().replace(/\s+/g, '-')}">${metricOutcomeGoals}</span>` : ''}
                ${metricEaseOfCollection ? `<span class="metric-ease-tag ease-${metricEaseOfCollection.toLowerCase()}">${metricEaseOfCollection} to collect</span>` : ''}
        </div>
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
            <button class="filter-btn ${activeCapturing}" data-metric-id="${metricId}" data-status="capturing">✓ Already capturing</button>
            <button class="filter-btn ${activePlanning}"  data-metric-id="${metricId}" data-status="planning">+ Plan to capture</button>
        </div>`;
        })()}
    `;

    customTooltip.innerHTML = content;
    customTooltip.classList.add('active');

    const x = event.clientX + 15;
    const y = event.clientY + 15;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const tooltipRect = customTooltip.getBoundingClientRect();

    customTooltip.style.left = (x + tooltipRect.width > viewportWidth - 20)
        ? `${event.clientX - tooltipRect.width - 15}px`
        : `${x}px`;
    customTooltip.style.top = (y + tooltipRect.height > viewportHeight - 20)
        ? `${event.clientY - tooltipRect.height - 15}px`
        : `${y}px`;

    customTooltip.querySelectorAll('button[data-metric-id]').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const status = this.getAttribute('data-status');
            if (status === 'none') {
                removeClickedMetric(metricData.id);
            } else {
                addClickedMetric(metricData, status);
            }
            // Update active state in-place without closing the tooltip
            customTooltip.querySelectorAll('button[data-metric-id]').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });

    const closeButton = customTooltip.querySelector('.close-tooltip-button');
    if (closeButton) {
        closeButton.addEventListener('click', function(e) {
            e.stopPropagation();
            hideCustomTooltip();
        });
    }

    document.addEventListener('click', handleDocumentClick);
}

function hideCustomTooltip() {
    customTooltip.classList.remove('active');
    document.removeEventListener('click', handleDocumentClick);
}

function handleDocumentClick(event) {
    if (customTooltip.classList.contains('active') &&
        !customTooltip.contains(event.target) &&
        !document.getElementById('container').contains(event.target)) {
        hideCustomTooltip();
    }
}
