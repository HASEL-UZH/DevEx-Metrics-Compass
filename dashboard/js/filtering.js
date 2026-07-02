// ─── Search helpers ───────────────────────────────────────────────────────────

const SYNONYM_GROUPS = [
    { terms: ['pull request', 'merge request', 'diff', 'code review'], aliases: ['pr', 'mr'] },
    { terms: ['percentage', 'percent'], aliases: ['%'] },
    { terms: ['number'], aliases: ['num'] },
    { terms: ['continuous integration'], aliases: ['ci'] },
    { terms: ['continuous delivery'], aliases: ['cd'] },
    { terms: ['lines of code'], aliases: ['loc'] },
    { terms: ['time', 'time spent', 'duration'], aliases: ['spent'] },
    { terms: ['documentation'], aliases: ['docs'] },
    { terms: ['bug', 'defect', 'error', 'fault', 'failure'], aliases: [] },
    { terms: ['deployment', 'deploy', 'ship', 'release', 'rollout'], aliases: [] },
    { terms: ['technical debt', 'tech debt'], aliases: ['debt'] },
    { terms: ['on-call', 'on call', 'incident', 'pager', 'alert'], aliases: ['oncall'] },
];

const SYNONYM_MAP = {};
SYNONYM_GROUPS.forEach(({ terms, aliases }) => {
    [...terms, ...aliases].forEach(key => { SYNONYM_MAP[key] = terms; });
});

function fieldContains(item, term) {
    return (item.name        && item.name.toLowerCase().includes(term)) ||
           (item.description && item.description.toLowerCase().includes(term)) ||
           (item.alsoknownas && item.alsoknownas.toLowerCase().includes(term)) ||
           (Array.isArray(item.company)  && item.company.some(s  => s.name.toLowerCase().includes(term))) ||
           (Array.isArray(item.research) && item.research.some(s => s.name.toLowerCase().includes(term)));
}

function metricMatchesTokens(item, tokens) {
    return tokens.every(token => {
        const group = SYNONYM_MAP[token];
        if (group) return group.some(alt => fieldContains(item, alt));
        return fieldContains(item, token);
    });
}

function tokenizeKeyword(raw) {
    return raw.toLowerCase().trim().split(/\s+/).filter(Boolean);
}

// ─── Filtering logic ─────────────────────────────────────────────────────────

// Map descriptive focus filter values to is_research integers
function focusFilterValue(focusValue) {
    if (focusValue === 'research-only') return 1;
    if (focusValue === 'industry-only') return 2;
    if (focusValue === 'research-and-industry') return 3;
    return null;
}

// Transform source strings into an array of objects for 'company' and 'research'
function transformSources(sourceString, type) {
    if (typeof sourceString === 'string' && sourceString !== '-') {
        const ids = sourceString.split(';').map(s => s.trim());
        return ids.map(id => {
            const sourceInfo = Object.values(SOURCE_URL_MAPPING).find(source => source.ref_number === id);
            return {
                name: sourceInfo ? sourceInfo.ref_name : id,
                url: sourceInfo ? sourceInfo.ref_link : null,
                company_size: sourceInfo ? (sourceInfo.company_size || 'N/A') : 'N/A'
            };
        });
    }
    return [];
}

/**
 * Apply a filter and visually update the corresponding buttons/dropdown.
 * @param {string} filterGroup  - The filter group key (e.g. 'dataType', 'specificCompany').
 * @param {string} filterValue  - The value to set.
 * @param {string} [htmlGroupId] - Optional HTML group id to update active states.
 */
function applySpecificFilter(filterGroup, filterValue, htmlGroupId = null) {
    if (filterGroup === 'easeOfCollection') {
        activeFilters.easeOfCollection = filterValue === 'all' ? [] : [filterValue];
    } else {
        activeFilters[filterGroup] = filterValue;
    }

    if (htmlGroupId) {
        const buttonsInGroup = document.querySelectorAll(`.filter-btn[data-group="${htmlGroupId}"]`);
        if (buttonsInGroup.length > 0) {
            buttonsInGroup.forEach(btn => {
                if (btn.dataset.filter === filterValue) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        const dropdown = document.getElementById(htmlGroupId);
        if (dropdown && dropdown.tagName === 'SELECT') {
            dropdown.value = filterValue;
        }
    }
}

// Extract unique companies from the data, considering current filters
function extractCompanies(data, currentFilters) {
    const companies = new Set();
    companies.add('all');

    data.forEach(item => {
        let matches = true;

        if (!item.type) { matches = false; }
        if (currentFilters.dataType !== 'all' && item.type !== currentFilters.dataType && item.type !== 'both') { matches = false; }
        if (currentFilters.companySize !== 'all' && !(Array.isArray(item.company) && item.company.some(source => source.company_size === currentFilters.companySize))) { matches = false; }

        const tokens = tokenizeKeyword(document.getElementById('keyword-search').value);
        if (tokens.length && !metricMatchesTokens(item, tokens)) { matches = false; }

        if (matches && Array.isArray(item.company)) {
            item.company.forEach(source => {
                const companyName = source.name.trim();
                const lowerCompanyName = companyName.toLowerCase();
                if (
                    companyName &&
                    !lowerCompanyName.includes("framework") &&
                    !lowerCompanyName.includes("metrics overview") &&
                    !lowerCompanyName.includes("used widely")
                ) {
                    companies.add(companyName);
                }
            });
        }
    });

    return Array.from(companies).sort((a, b) => {
        if (a === 'all') return -1;
        if (b === 'all') return 1;
        return a.localeCompare(b);
    });
}

// Populate the company dropdown
function populateCompanyDropdown(companies, selectedCompany) {
    const dropdown = document.getElementById('company-dropdown');
    dropdown.innerHTML = '';

    companies.forEach(company => {
        const option = document.createElement('option');
        option.value = company;
        option.textContent = company === 'all' ? 'No company selected' : company;
        dropdown.appendChild(option);
    });

    dropdown.value = selectedCompany || 'all';
}

// Extract unique research frameworks from the data
function extractFrameworks(data, currentFilters) {
    const frameworks = new Set();
    frameworks.add('all');

    data.forEach(item => {
        let matches = true;

        if (currentFilters.dataType !== 'all' && item.type !== currentFilters.dataType && item.type !== 'both') { matches = false; }
        if (currentFilters.companySize !== 'all' && !(Array.isArray(item.company) && item.company.some(source => source.company_size === currentFilters.companySize))) { matches = false; }

        const tokens = tokenizeKeyword(document.getElementById('keyword-search').value);
        if (tokens.length && !metricMatchesTokens(item, tokens)) { matches = false; }

        if (matches && Array.isArray(item.research)) {
            item.research.forEach(source => {
                const frameworkName = source.name.trim();
                if (frameworkName.toLowerCase().includes("framework")) {
                    frameworks.add(frameworkName);
                }
            });
        }
    });

    return Array.from(frameworks).sort((a, b) => {
        if (a === 'all') return -1;
        if (b === 'all') return 1;
        return a.localeCompare(b);
    });
}

// Populate the research framework dropdown
function populateFrameworkDropdown(frameworks, selectedFramework) {
    const dropdown = document.getElementById('research-dropdown');
    dropdown.innerHTML = '';

    frameworks.forEach(framework => {
        const option = document.createElement('option');
        option.value = framework;
        option.textContent = framework === 'all' ? 'No research framework selected' : framework.replace(/\s*Framework\s*$/i, '');
        dropdown.appendChild(option);
    });

    dropdown.value = selectedFramework || 'all';
}

// Returns true if the user has applied any filter
function hasAnyActiveFilter() {
    const keyword = document.getElementById('keyword-search').value.trim();
    return keyword !== '' ||
        activeFilters.dataType !== 'all' ||
        activeFilters.aiMetric !== 'all' ||
        activeFilters.focus !== 'all' ||
        activeFilters.companySize !== 'all' ||
        activeFilters.outcomeGoals !== 'all' ||
        activeFilters.easeOfCollection.length > 0 ||
        activeFilters.specificCompany !== 'all' ||
        activeFilters.specificFramework !== 'all' ||
        activeFilters.minMentions !== 'all';
}

// Compute the minimum mention count for a given top-percentile filter value.
// e.g. '25' → return the threshold so only the top 25% of metrics (by value) pass.
function getMinMentionsThreshold(percentileFilter) {
    if (percentileFilter === 'all') return 0;

    const allValues = originalData
        .filter(item => item.value !== undefined && item.type)
        .map(item => item.value)
        .sort((a, b) => b - a); // descending

    const topN = Math.ceil((parseInt(percentileFilter) / 100) * allValues.length);
    return topN > 0 ? allValues[topN - 1] : 0;
}

// Filter data and redraw chart
function filterData() {
    const searchTokens = tokenizeKeyword(document.getElementById('keyword-search').value);
    const specificCompany = activeFilters.specificCompany;
    const specificFramework = activeFilters.specificFramework;
    const minMentions = getMinMentionsThreshold(activeFilters.minMentions);

    const actualMatchingMetrics = originalData.filter(item => {
        if (!item.type) { return false; }

        let matches = true;

        if (activeFilters.dataType !== 'all' && item.type !== activeFilters.dataType && item.type !== 'both') { matches = false; }
        if (activeFilters.aiMetric === 'ai-impact' && item.ai_specific_category !== 'Impact') { matches = false; }
        if (activeFilters.aiMetric === 'ai-utilization' && item.ai_specific_category !== 'Utilization') { matches = false; }
        if (activeFilters.aiMetric === 'ai-cost' && item.ai_specific_category !== 'Cost') { matches = false; }
        if (activeFilters.focus !== 'all' && item.is_research !== focusFilterValue(activeFilters.focus)) { matches = false; }
        if (activeFilters.companySize !== 'all' && !(Array.isArray(item.company) && item.company.some(source => source.company_size === activeFilters.companySize))) { matches = false; }
        if (activeFilters.outcomeGoals !== 'all' && item.outcome_goals !== activeFilters.outcomeGoals) { matches = false; }
        if (activeFilters.easeOfCollection.length > 0 && !activeFilters.easeOfCollection.includes(item.ease_of_collection)) { matches = false; }
        if (specificCompany !== 'all' && !(Array.isArray(item.company) && item.company.some(source => source.name === specificCompany))) { matches = false; }
        if (specificFramework !== 'all' && !(Array.isArray(item.research) && item.research.some(source => source.name === specificFramework))) { matches = false; }

        if (searchTokens.length && !metricMatchesTokens(item, searchTokens)) { matches = false; }

        if (item.value !== undefined && item.value < minMentions) { matches = false; }

        return matches;
    });

    filteredData = [];
    const includedIds = new Set();

    actualMatchingMetrics.forEach(metric => {
        if (!includedIds.has(metric.id)) {
            filteredData.push(metric);
            includedIds.add(metric.id);
        }
        let currentParentId = metric.parent;
        while (currentParentId) {
            const parentNode = originalData.find(item => item.id === currentParentId);
            if (parentNode && !includedIds.has(parentNode.id)) {
                filteredData.push(parentNode);
                includedIds.add(parentNode.id);
            }
            currentParentId = parentNode ? parentNode.parent : null;
        }
    });

    const availableCompanies = extractCompanies(originalData, activeFilters);
    populateCompanyDropdown(availableCompanies, activeFilters.specificCompany);

    const availableFrameworks = extractFrameworks(originalData, activeFilters);
    populateFrameworkDropdown(availableFrameworks, activeFilters.specificFramework);

    // Auto-reset framework if it becomes unavailable due to focus filter
    // (research frameworks can't have industry-only metrics, so this is a genuine conflict)
    if (activeFilters.specificFramework !== 'all' && !availableFrameworks.includes(activeFilters.specificFramework)) {
        activeFilters.specificFramework = 'all';
        document.getElementById('research-dropdown').value = 'all';
    }

    if (actualMatchingMetrics.length === 0) {
        if (chart) { chart.dispose(); chart = null; }
        if (typeof hideMetricClickHint === 'function') hideMetricClickHint();
        noMetricsMessage.style.display = 'block';
        updateMetricsCount(actualMatchingMetrics);
    } else {
        noMetricsMessage.style.display = 'none';
        updateMetricsCount(actualMatchingMetrics);
        createChart(filteredData);
    }

    updateClearFiltersVisibility(actualMatchingMetrics.length);
    updateActiveFilterPills();
    if (typeof updateStepBar === 'function') updateStepBar();
    if (typeof refreshCompareValueDropdowns === 'function') refreshCompareValueDropdowns();
    if (typeof loadSavedComparisonsFromLocalStorage === 'function') loadSavedComparisonsFromLocalStorage();
}

// Reads a segmented-control filter button's own display text (icon + label)
// straight from the DOM, so pill labels can never drift out of sync with what
// the button actually shows — one place defines the text, not two.
function getFilterButtonLabel(group, value) {
    const btn = document.querySelector(`.filter-btn[data-group="${group}"][data-filter="${value}"]`);
    return btn ? btn.textContent.trim() : value;
}

// Same idea for dropdown-based filters (<select><option>).
function getSelectOptionLabel(selectId, value) {
    const select = document.getElementById(selectId);
    const opt = select ? select.querySelector(`option[value="${CSS.escape(value)}"]`) : null;
    return opt ? opt.textContent.trim() : value;
}

// Builds the list of currently active filters as { dimension, label, clear } triples,
// one per pill. `dimension` is the human-readable filter name, shown together with
// `label` in the pill's hover tooltip (e.g. "Outcome goal: Product Excellence").
function buildActiveFilterPills() {
    const pills = [];
    const keywordInput = document.getElementById('keyword-search');
    const keyword = keywordInput.value.trim();
    if (keyword) {
        pills.push({ dimension: 'Search', label: `Search: "${keyword}"`, clear: () => {
            keywordInput.value = '';
            const clearBtn = document.getElementById('keyword-clear');
            if (clearBtn) clearBtn.style.display = 'none';
            onUserFilterChange();
        } });
    }
    if (activeFilters.minMentions !== 'all') {
        pills.push({ dimension: 'Popularity', label: getFilterButtonLabel('minMentions', activeFilters.minMentions), clear: () => {
            applySpecificFilter('minMentions', 'all', 'minMentions'); onUserFilterChange();
        } });
    }
    if (activeFilters.dataType !== 'all') {
        pills.push({ dimension: 'Data collection type', label: getFilterButtonLabel('dataType', activeFilters.dataType), clear: () => {
            applySpecificFilter('dataType', 'all', 'dataType'); onUserFilterChange();
        } });
    }
    if (activeFilters.specificCompany !== 'all') {
        pills.push({ dimension: 'Company', label: activeFilters.specificCompany, clear: () => {
            applySpecificFilter('specificCompany', 'all', 'company-dropdown');
            const companyDropdown = document.getElementById('company-dropdown');
            if (companyDropdown && typeof applyLogoBg === 'function') applyLogoBg(companyDropdown, 'company', 'all');
            onUserFilterChange();
        } });
    }
    if (activeFilters.specificFramework !== 'all') {
        pills.push({ dimension: 'Framework', label: getSelectOptionLabel('research-dropdown', activeFilters.specificFramework), clear: () => {
            applySpecificFilter('specificFramework', 'all', 'research-dropdown'); onUserFilterChange();
        } });
    }
    if (activeFilters.focus !== 'all') {
        pills.push({ dimension: 'Focus', label: getSelectOptionLabel('focus-dropdown', activeFilters.focus), clear: () => {
            applySpecificFilter('focus', 'all', 'focus-dropdown'); onUserFilterChange();
        } });
    }
    if (activeFilters.aiMetric !== 'all') {
        pills.push({ dimension: 'AI impact metric', label: getFilterButtonLabel('aiMetric', activeFilters.aiMetric), clear: () => {
            applySpecificFilter('aiMetric', 'all', 'aiMetric'); onUserFilterChange();
        } });
    }
    if (activeFilters.outcomeGoals !== 'all') {
        pills.push({ dimension: 'Outcome goal', label: getFilterButtonLabel('outcomeGoals', activeFilters.outcomeGoals), clear: () => {
            applySpecificFilter('outcomeGoals', 'all', 'outcomeGoals'); onUserFilterChange();
        } });
    }
    activeFilters.easeOfCollection.forEach(tier => {
        pills.push({ dimension: 'Collection maturity', label: getFilterButtonLabel('easeOfCollection', tier), clear: () => {
            toggleMaturityFilter(tier); onUserFilterChange();
        } });
    });
    if (activeFilters.companySize !== 'all') {
        pills.push({ dimension: 'Company size', label: getFilterButtonLabel('companySize', activeFilters.companySize), clear: () => {
            applySpecificFilter('companySize', 'all', 'companySize'); onUserFilterChange();
        } });
    }
    return pills;
}

// Renders the active-filter pills in Box 1, each removable via its own "x".
function updateActiveFilterPills() {
    const container = document.getElementById('active-filter-pills');
    if (!container) return;
    const pills = buildActiveFilterPills();
    container.innerHTML = '';
    pills.forEach(({ dimension, label, clear }) => {
        const pill = document.createElement('span');
        pill.className = 'filter-pill';
        // The Search pill's label already reads "Search: ...", so don't double it up.
        pill.title = dimension === 'Search' ? label : `${dimension}: ${label}`;
        const labelSpan = document.createElement('span');
        labelSpan.textContent = label;
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'filter-pill-remove';
        removeBtn.setAttribute('aria-label', `Remove filter: ${label}`);
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', clear);
        pill.appendChild(labelSpan);
        pill.appendChild(removeBtn);
        container.appendChild(pill);
    });
    container.style.display = pills.length ? '' : 'none';
}

// Show/hide "Clear all filters" buttons based on whether the full list is shown
function updateClearFiltersVisibility(shownCount) {
    const totalCount = originalData.filter(item => item.type).length;
    const display = shownCount < totalCount ? '' : 'none';
    document.getElementById('clear-filters').style.display = display;
    document.getElementById('clear-filters-chart').style.display = display;
}

// Update metrics count display
function updateMetricsCount(data) {
    const metricsWithType = data.filter(item => item.type);
    const totalMetrics = originalData.filter(item => item.type).length;
    const titleEl = document.getElementById('explore-panel-title');
    if (titleEl) {
        titleEl.textContent = metricsWithType.length === totalMetrics
            ? `Exploring all ${totalMetrics} DevEx metrics`
            : `Exploring ${metricsWithType.length} of ${totalMetrics} DevEx metrics`;
    }
}

// Wrapper called by all user-triggered filter interactions.
function onUserFilterChange() {
    if (!modeChosen) {
        modeChosen = true;
        currentMode = MODE.BROWSE;
        hideExploreStartView();
    }
    filterData();
    logEvent(TELEMETRY.FILTER_CHANGED, { activeFilters: Object.assign({}, activeFilters), resultCount: filteredData.filter(m => m.type).length });
}

// Set active button style
function setActiveButton(activeBtn) {
    const group = activeBtn.dataset.group;
    if (group) {
        document.querySelectorAll(`.filter-btn[data-group="${group}"]`).forEach(btn => {
            btn.classList.remove('active');
        });
        activeBtn.classList.add('active');
    }
}

// Toggle a single maturity tier on/off (multi-select, unlike the other
// exclusive-select filter groups). Selecting every tier collapses back to
// "all", and clearing the last active tier also reverts to "all" — the
// filter never lands on a state that matches zero metrics.
const MATURITY_TIERS = ['Easy', 'Moderate', 'Complex'];
function toggleMaturityFilter(value) {
    if (value === 'all') {
        activeFilters.easeOfCollection = [];
    } else {
        const selected = activeFilters.easeOfCollection;
        const idx = selected.indexOf(value);
        if (idx === -1) { selected.push(value); } else { selected.splice(idx, 1); }
        if (selected.length === MATURITY_TIERS.length) { activeFilters.easeOfCollection = []; }
    }
    updateMaturityButtonStates();
}

// Sync the maturity segmented-control buttons' active state with activeFilters.easeOfCollection
function updateMaturityButtonStates() {
    const selected = activeFilters.easeOfCollection;
    document.querySelectorAll('.filter-btn[data-group="easeOfCollection"]').forEach(btn => {
        const isAllBtn = btn.dataset.filter === 'all';
        btn.classList.toggle('active', selected.length === 0 ? isAllBtn : !isAllBtn && selected.includes(btn.dataset.filter));
    });
}

// Clear all filters (currentMode is intentionally NOT reset here)
function clearAllFilters() {
    activeFilters = {
        dataType: 'all',
        aiMetric: 'all',
        focus: 'all',
        companySize: 'all',
        outcomeGoals: 'all',
        easeOfCollection: [],
        specificCompany: 'all',
        specificFramework: 'all',
        minMentions: 'all'
    };
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === 'all') { btn.classList.add('active'); }
    });
    document.getElementById('keyword-search').value = '';
    const clearBtn = document.getElementById('keyword-clear');
    if (clearBtn) clearBtn.style.display = 'none';
    document.getElementById('focus-dropdown').value = 'all';
    const companyDropdown = document.getElementById('company-dropdown');
    companyDropdown.value = 'all';
    if (typeof applyLogoBg === 'function') applyLogoBg(companyDropdown, 'company', 'all');
    document.getElementById('research-dropdown').value = 'all';
    const colorBySelect = document.getElementById('color-by-select');
    if (colorBySelect && colorBySelect.value !== 'categorization') {
        colorBySelect.value = 'categorization';
        currentColorBy = 'categorization';
        if (typeof updateColorLegend === 'function') updateColorLegend('categorization');
    }
    filterData();
    logEvent(TELEMETRY.FILTERS_CLEARED, { shortlistCount: clickedMetrics.length });
}

// Reset the other source filter (company/framework are mutually exclusive; focus is independent)
function resetOtherSourceFilters(except) {
    if (except !== 'specificFramework') {
        activeFilters.specificFramework = 'all';
        document.getElementById('research-dropdown').value = 'all';
    }
    if (except !== 'specificCompany') {
        activeFilters.specificCompany = 'all';
        const companyDropdown = document.getElementById('company-dropdown');
        companyDropdown.value = 'all';
        if (typeof applyLogoBg === 'function') applyLogoBg(companyDropdown, 'company', 'all');
        // Also reset company size when company is reset
        activeFilters.companySize = 'all';
        document.querySelectorAll('.filter-btn[data-group="companySize"]').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.filter === 'all') btn.classList.add('active');
        });
    }
}

// Look up a company's size from SOURCE_URL_MAPPING
function getCompanySizeForCompany(companyName) {
    const source = Object.values(SOURCE_URL_MAPPING).find(s => s.ref_name === companyName);
    return (source && source.company_size && source.company_size !== 'N/A') ? source.company_size : null;
}

// Reorder/collapse the filter panel for the given role. Purely static: a dim is
// key or collapsed based only on the role's configured keyFilters/collapsedFilters
// lists — never on what was asked/answered during the wizard this session.
function applyRoleFilterLayout(role) {
    const cfg = ROLE_CONFIG[role];
    if (!cfg) return;

    const keyContainer = document.getElementById('key-filters-container');
    const moreBody = document.getElementById('more-filters-body');

    cfg.keyFilters.forEach(dim => {
        const el = document.querySelector(`.filter-group[data-role-filter="${dim}"]`);
        if (el) keyContainer.appendChild(el);
    });
    cfg.collapsedFilters.forEach(dim => {
        const el = document.querySelector(`.filter-group[data-role-filter="${dim}"]`);
        if (el) moreBody.appendChild(el);
    });

    document.getElementById('more-filters-details').style.display = cfg.collapsedFilters.length ? '' : 'none';
}

// ─── Filter event listeners ───────────────────────────────────────────────────

document.querySelectorAll('.filter-btn').forEach(button => {
    button.addEventListener('click', function() {
        if (this.dataset.group === 'easeOfCollection') {
            toggleMaturityFilter(this.dataset.filter);
        } else {
            applySpecificFilter(this.dataset.group, this.dataset.filter, this.dataset.group);
        }
        onUserFilterChange();
    });
});

document.getElementById('company-dropdown').addEventListener('change', function() {
    applySpecificFilter('specificCompany', this.value);
    if (this.value !== 'all') {
        resetOtherSourceFilters('specificCompany');
        const size = getCompanySizeForCompany(this.value);
        if (size) applySpecificFilter('companySize', size, 'companySize');
    }
    onUserFilterChange();
});

document.getElementById('focus-dropdown').addEventListener('change', function() {
    applySpecificFilter('focus', this.value);
    // Reset company size when focus changes
    activeFilters.companySize = 'all';
    document.querySelectorAll('.filter-btn[data-group="companySize"]').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === 'all') btn.classList.add('active');
    });
    onUserFilterChange();
});

document.getElementById('research-dropdown').addEventListener('change', function() {
    applySpecificFilter('specificFramework', this.value);
    if (this.value !== 'all') resetOtherSourceFilters('specificFramework');
    onUserFilterChange();
});

document.querySelectorAll('input[name="dataType"]').forEach(radio => {
    radio.addEventListener('change', function() {
        activeFilters.dataType = this.value;
        onUserFilterChange();
    });
});

document.getElementById('clear-filters').addEventListener('click', function() {
    clearAllFilters();
    noMetricsMessage.style.display = 'none';
});

document.getElementById('keyword-search').addEventListener('input', function() {
    const clearBtn = document.getElementById('keyword-clear');
    if (clearBtn) clearBtn.style.display = this.value ? '' : 'none';
    onUserFilterChange();
});
document.getElementById('keyword-clear').addEventListener('click', function() {
    document.getElementById('keyword-search').value = '';
    this.style.display = 'none';
    onUserFilterChange();
});

document.getElementById('color-by-select').addEventListener('change', function() {
    currentColorBy = this.value;
    createChart(filteredData);
    updateColorLegend(currentColorBy);
    logEvent(TELEMETRY.COLORBY_CHANGED, { value: this.value });
});

(function () {
    let kwTimer = null;
    document.getElementById('keyword-search').addEventListener('input', function () {
        clearTimeout(kwTimer);
        kwTimer = setTimeout(function () {
            const kw = document.getElementById('keyword-search').value.trim();
            if (kw.length > 0) logEvent(TELEMETRY.KEYWORD_SEARCH, { query: kw, length: kw.length, resultCount: filteredData.filter(m => m.type).length });
        }, 600);
    });
}());

// Set button title attributes from DIMENSION_TOOLTIPS (single source of truth shared with step 2)
document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
    const key = FILTER_TO_TOOLTIP_KEY[btn.dataset.filter] || btn.dataset.filter;
    if (DIMENSION_TOOLTIPS[key]) btn.title = DIMENSION_TOOLTIPS[key];
});
