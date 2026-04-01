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
    activeFilters[filterGroup] = filterValue;

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
        if (currentFilters.focus !== 'all' && item.is_research !== focusFilterValue(currentFilters.focus)) { matches = false; }
        if (currentFilters.companySize !== 'all' && !(Array.isArray(item.company) && item.company.some(source => source.company_size === currentFilters.companySize))) { matches = false; }

        const keyword = document.getElementById('keyword-search').value.toLowerCase();
        if (keyword && !(
            (item.name && item.name.toLowerCase().includes(keyword)) ||
            (item.description && item.description.toLowerCase().includes(keyword)) ||
            (item.alsoknownas && item.alsoknownas.toLowerCase().includes(keyword)) ||
            (Array.isArray(item.company) && item.company.some(source => source.name.toLowerCase().includes(keyword))) ||
            (Array.isArray(item.research) && item.research.some(source => source.name.toLowerCase().includes(keyword)))
        )) { matches = false; }

        if (currentFilters.specificFramework !== 'all' && Array.isArray(item.research)) {
            const frameworkNames = item.research.map(source => source.name);
            if (!frameworkNames.includes(currentFilters.specificFramework)) { matches = false; }
        }

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
        if (currentFilters.focus !== 'all' && item.is_research !== focusFilterValue(currentFilters.focus)) { matches = false; }
        if (currentFilters.companySize !== 'all' && !(Array.isArray(item.company) && item.company.some(source => source.company_size === currentFilters.companySize))) { matches = false; }

        const keyword = document.getElementById('keyword-search').value.toLowerCase();
        if (keyword && !(
            (item.name && item.name.toLowerCase().includes(keyword)) ||
            (item.description && item.description.toLowerCase().includes(keyword)) ||
            (Array.isArray(item.company) && item.company.some(source => source.name.toLowerCase().includes(keyword))) ||
            (Array.isArray(item.research) && item.research.some(source => source.name.toLowerCase().includes(keyword))) ||
            (item.alsoknownas && item.alsoknownas.toLowerCase().includes(keyword))
        )) { matches = false; }

        if (currentFilters.specificCompany !== 'all' && Array.isArray(item.company)) {
            const companyNames = item.company.map(source => source.name);
            if (!companyNames.includes(currentFilters.specificCompany)) { matches = false; }
        }

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
        option.textContent = framework === 'all' ? 'No research framework selected' : framework;
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
        activeFilters.easeOfCollection !== 'all' ||
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
    const keyword = document.getElementById('keyword-search').value.toLowerCase();
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
        if (activeFilters.easeOfCollection !== 'all') {
            const eocTiers = { 'Easy': ['Easy'], 'Moderate': ['Easy', 'Moderate'], 'Complex': ['Easy', 'Moderate', 'Complex'] };
            if (!eocTiers[activeFilters.easeOfCollection]?.includes(item.ease_of_collection)) { matches = false; }
        }

        if (specificCompany !== 'all' && !(Array.isArray(item.company) && item.company.some(source => source.name === specificCompany))) { matches = false; }
        if (specificFramework !== 'all' && !(Array.isArray(item.research) && item.research.some(source => source.name === specificFramework))) { matches = false; }

        if (keyword && !(
            (item.name && item.name.toLowerCase().includes(keyword)) ||
            (item.description && item.description.toLowerCase().includes(keyword)) ||
            (item.alsoknownas && item.alsoknownas.toLowerCase().includes(keyword)) ||
            (Array.isArray(item.company) && item.company.some(source => source.name.toLowerCase().includes(keyword))) ||
            (Array.isArray(item.research) && item.research.some(source => source.name.toLowerCase().includes(keyword)))
        )) { matches = false; }

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

    const additiveModeMessage = document.getElementById('additive-mode-message');
    const rightContainer = document.querySelector('.right-container');

    if (currentMode === MODE.ADDITIVE && additiveBlankCanvas) {
        if (chart) { chart.dispose(); chart = null; }
        noMetricsMessage.style.display = 'none';
        if (additiveModeMessage) additiveModeMessage.style.display = 'block';
        updateMetricsCount([]);
    } else if (actualMatchingMetrics.length === 0) {
        if (chart) { chart.dispose(); chart = null; }
        noMetricsMessage.style.display = 'block';
        if (additiveModeMessage) additiveModeMessage.style.display = 'none';
        updateMetricsCount(actualMatchingMetrics);
    } else {
        noMetricsMessage.style.display = 'none';
        if (additiveModeMessage) additiveModeMessage.style.display = 'none';
        updateMetricsCount(actualMatchingMetrics);
        createChart(filteredData);
    }

    if (currentMode === MODE.ADDITIVE && additiveBlankCanvas) {
        rightContainer.classList.add('mode-additive-unset');
    } else {
        rightContainer.classList.remove('mode-additive-unset');
    }

    updateClearFiltersVisibility(actualMatchingMetrics.length);
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
    document.getElementById('metrics-count').textContent = metricsWithType.length;
}

// Wrapper called by all user-triggered filter interactions.
// Clears the blank-canvas state so the user's action reveals metrics.
function onUserFilterChange() {
    additiveBlankCanvas = false;
    filterData();
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

// Clear all filters (currentMode is intentionally NOT reset here)
function clearAllFilters() {
    if (currentMode === MODE.ADDITIVE) additiveBlankCanvas = true;
    activeFilters = {
        dataType: 'all',
        aiMetric: 'all',
        focus: 'all',
        companySize: 'all',
        outcomeGoals: 'all',
        easeOfCollection: 'all',
        specificCompany: 'all',
        specificFramework: 'all',
        minMentions: 'all'
    };
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === 'all') { btn.classList.add('active'); }
    });
    document.getElementById('keyword-search').value = '';
    document.getElementById('focus-dropdown').value = 'all';
    document.getElementById('company-dropdown').value = 'all';
    document.getElementById('research-dropdown').value = 'all';
    filterData();
}

// ─── Filter event listeners ───────────────────────────────────────────────────

document.querySelectorAll('.filter-btn').forEach(button => {
    button.addEventListener('click', function() {
        applySpecificFilter(this.dataset.group, this.dataset.filter, this.dataset.group);
        onUserFilterChange();
    });
});

document.getElementById('company-dropdown').addEventListener('change', function() {
    applySpecificFilter('specificCompany', this.value);
    onUserFilterChange();
});

document.getElementById('focus-dropdown').addEventListener('change', function() {
    applySpecificFilter('focus', this.value);
    onUserFilterChange();
});

document.getElementById('research-dropdown').addEventListener('change', function() {
    applySpecificFilter('specificFramework', this.value);
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

document.getElementById('keyword-search').addEventListener('input', onUserFilterChange);
