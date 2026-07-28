// ─── Shareable URL state ──────────────────────────────────────────────────────
// Live-syncs Step 1 filters/role, Step 2 compare selection, the current step,
// and the open metric popup to the URL via history.replaceState, so the
// address bar is always a valid link to the current view. The shortlist is
// NOT part of this ambient sync — see metrics-selection.js's
// restoreShortlistFromUrl() and nextsteps.js's "Copy shareable link" button.

const SCALAR_URL_FILTERS = {
    dataType: ['qualitative', 'quantitative', 'both'],
    focus: ['research-only', 'industry-only', 'research-and-industry'],
    minMentions: ['50', '25', '10'],
};
const SCALAR_URL_FILTER_DOM_GROUP = { dataType: 'dataType', focus: 'focus-dropdown', minMentions: 'minMentions' };

const COMPARE_URL_TYPES = ['company', 'framework', 'maturity', 'outcome', 'companySize', 'shortlist'];

// The Step 2 grouping dimensions offered as sort cards (see compare.js's
// buildSortChartData); 'category' is the default and stays out of the URL.
const COMPARE_URL_SORTS = ['category', 'outcome', 'maturity', 'datatype', 'ai', 'alpha'];

// Builds a URLSearchParams from current live-synced state, omitting anything
// at its default. Deliberately does NOT include the shortlist — that's
// scoped and built separately by nextsteps.js's "Copy shareable link"
// button (see shortlistUrlParams() below), since a shortlist link should
// carry just the shortlist, not whatever filters/role/compare/metric the
// sender happened to have active at that moment.
function serializeStateToParams() {
    const params = new URLSearchParams();

    if (currentStep !== STEP.EXPLORE) params.set('step', currentStep);
    if (currentRole) params.set('role', currentRole);

    if (activeFilters.dataType !== 'all') params.set('dataType', activeFilters.dataType);
    if (activeFilters.focus !== 'all') params.set('focus', activeFilters.focus);
    if (activeFilters.minMentions !== 'all') params.set('minMentions', activeFilters.minMentions);
    if (activeFilters.specificCompany !== 'all') params.set('specificCompany', activeFilters.specificCompany);
    if (activeFilters.specificFramework !== 'all') params.set('specificFramework', activeFilters.specificFramework);
    if (activeFilters.aiMetric.length > 0) params.set('aiMetric', activeFilters.aiMetric.join(','));
    if (activeFilters.outcomeGoals.length > 0) params.set('outcomeGoals', activeFilters.outcomeGoals.join(','));
    if (activeFilters.easeOfCollection.length > 0) params.set('easeOfCollection', activeFilters.easeOfCollection.join(','));
    if (activeFilters.companySize.length > 0) params.set('companySize', activeFilters.companySize.join(','));

    const keywordEl = document.getElementById('keyword-search');
    const keyword = keywordEl ? keywordEl.value.trim() : '';
    if (keyword) params.set('q', keyword);

    if (compareState.leftValue !== 'all') {
        params.set('leftType', compareState.leftType);
        params.set('leftValue', compareState.leftValue);
    }
    if (compareState.rightValue !== 'all') {
        params.set('rightType', compareState.rightType);
        params.set('rightValue', compareState.rightValue);
    }

    if (typeof compareSort !== 'undefined' && compareSort !== 'category') params.set('sort', compareSort);

    if (openMetricId) params.set('specificMetric', openMetricId);

    return params;
}


// Shortlist status IS carried across (unlike other shared state) — "already
// tracking vs. plan to track" is the whole point of sharing a shortlist, not
// something the recipient should have to redo. Split into two id-list params
// by status rather than `<id>:<code>` pairs — avoids colons in the URL
// entirely (simpler than decoding them back for readability) and reads more
// like plain data: shortlist_current=1,2&shortlist_planned=3,4.
function shortlistUrlParams() {
    const current = clickedMetrics.filter(m => m.collectionStatus === 'capturing').map(m => m.id).join(',');
    const planned = clickedMetrics.filter(m => m.collectionStatus === 'planning').map(m => m.id).join(',');
    return { current, planned };
}

// URLSearchParams.toString() percent-encodes commas even though they're a
// legal, unreserved character in a URL query string (RFC 3986) — decoding
// them back keeps multi-value params (filters, shortlist) human-readable
// without changing what gets parsed back out on restore.
function readableQueryString(params) {
    return params.toString().replace(/%2C/g, ',');
}

// The single choke point that touches history. By default preserves existing
// shortlist_current/shortlist_planned params verbatim (the ambient path
// never regenerates them — only the explicit "Copy shareable link" action
// writes them). Pass preserveShortlist: false once a shared-link shortlist
// has actually been acted on (see restoreShortlistFromUrl() in
// metrics-selection.js) so a page refresh doesn't re-prompt / re-import it.
function syncStateToUrl({ preserveShortlist = true } = {}) {
    const params = serializeStateToParams();
    if (preserveShortlist) {
        const existing = new URLSearchParams(window.location.search);
        ['shortlist_current', 'shortlist_planned'].forEach(key => {
            const val = existing.get(key);
            if (val) params.set(key, val);
        });
    }
    const qs = readableQueryString(params);
    const newUrl = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
    history.replaceState(null, '', newUrl);
}

let _urlSyncTimer = null;
function scheduleUrlSync() {
    clearTimeout(_urlSyncTimer);
    _urlSyncTimer = setTimeout(syncStateToUrl, 250);
}

// Called once from init.js after originalData is loaded, before the first
// filterData() call. Mutates the relevant globals + DOM controls; unknown or
// stale values are silently ignored rather than thrown.
function restoreStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    let hadUrlState = false;

    let step = null;
    const stepParam = params.get('step');
    if (stepParam && Object.values(STEP).includes(stepParam)) {
        step = stepParam;
        hadUrlState = true;
    }

    const roleParam = params.get('role');
    if (roleParam && Object.values(ROLE).includes(roleParam)) {
        currentRole = roleParam;
        localStorage.setItem('currentRole', roleParam);
        if (typeof showRoleBadge === 'function') showRoleBadge();
        if (typeof applyRoleFilterLayout === 'function') applyRoleFilterLayout(roleParam);
        hadUrlState = true;
    }

    Object.keys(SCALAR_URL_FILTERS).forEach(key => {
        const val = params.get(key);
        if (val && SCALAR_URL_FILTERS[key].includes(val)) {
            applySpecificFilter(key, val, SCALAR_URL_FILTER_DOM_GROUP[key]);
            hadUrlState = true;
        }
    });

    Object.keys(MULTI_SELECT_FILTER_GROUPS).forEach(group => {
        const raw = params.get(group);
        if (!raw) return;
        const values = raw.split(',').filter(v => MULTI_SELECT_FILTER_GROUPS[group].includes(v));
        if (values.length > 0) {
            activeFilters[group] = values;
            if (typeof updateMultiSelectButtonStates === 'function') updateMultiSelectButtonStates(group);
            hadUrlState = true;
        }
    });

    const companyNames = new Set();
    const frameworkNames = new Set();
    originalData.forEach(item => {
        if (Array.isArray(item.company)) item.company.forEach(c => c.name && companyNames.add(c.name));
        if (Array.isArray(item.research)) item.research.forEach(r => r.name && frameworkNames.add(r.name));
    });

    const specificCompany = params.get('specificCompany');
    if (specificCompany && companyNames.has(specificCompany)) {
        applySpecificFilter('specificCompany', specificCompany, 'company-dropdown');
        hadUrlState = true;
    }
    const specificFramework = params.get('specificFramework');
    if (specificFramework && frameworkNames.has(specificFramework)) {
        applySpecificFilter('specificFramework', specificFramework, 'research-dropdown');
        hadUrlState = true;
    }

    const q = params.get('q');
    if (q) {
        const keywordEl = document.getElementById('keyword-search');
        if (keywordEl) keywordEl.value = q;
        hadUrlState = true;
    }

    function restoreCompareSide(side) {
        const type = params.get(`${side}Type`);
        const value = params.get(`${side}Value`);
        if (!type || !value || !COMPARE_URL_TYPES.includes(type)) return;
        if (type === 'shortlist') {
            if (value !== 'shortlist') return;
        } else {
            const opts = typeof getOptionsForDimension === 'function' ? getOptionsForDimension(type) : [];
            if (!opts.some(o => o.value === value)) return;
        }
        compareState[`${side}Type`] = type;
        compareState[`${side}Value`] = value;
        const typeEl = document.getElementById(`compare-${side}-type`);
        const valueEl = document.getElementById(`compare-${side}-value`);
        if (typeEl) typeEl.value = type;
        if (valueEl && typeof populateValueDropdown === 'function') populateValueDropdown(valueEl, type, value);
        // Same as the step 1 company dropdown: setting the value in code fires no
        // 'change', so the favicon/letter badge has to be applied explicitly.
        if (valueEl && typeof applyLogoBg === 'function') applyLogoBg(valueEl, type, value, side);
        hadUrlState = true;
    }
    restoreCompareSide('left');
    restoreCompareSide('right');

    const sortParam = params.get('sort');
    if (sortParam && COMPARE_URL_SORTS.includes(sortParam)) {
        compareSort = sortParam;
        hadUrlState = true;
    }

    // A bare ?specificMetric=<id> link (e.g. an SEO metric landing page or "Copy
    // link to this metric") should also count as URL state, so init.js dismisses
    // the welcome overlay and the shared metric popup isn't hidden behind it.
    const specificMetric = parseInt(params.get('specificMetric'), 10);
    if (Number.isInteger(specificMetric) &&
        originalData.some(m => m.id === specificMetric && m.description !== undefined)) {
        hadUrlState = true;
    }

    // ?reportMissing=<metric|company|research> (e.g. from an SEO page footer) opens
    // the report overlay on load — see report-metric.js — so dismiss the welcome
    // overlay behind it.
    if (params.get('reportMissing')) {
        hadUrlState = true;
    }

    return { hadUrlState, step };
}

// Classifies how the visitor arrived, for PAGE_LOAD telemetry. `entry` is the
// kind of link they followed (most specific intent wins); `seoPage` names the
// static landing page that sent them, so we can see which ones actually convert.
// Must be called before filterData(), since that rewrites the URL via replaceState.
function getUrlEntry() {
    const params = new URLSearchParams(window.location.search);

    let entry = 'direct';
    if (params.get('reportMissing'))                    entry = 'report_missing';
    else if (params.get('shortlist_current') ||
             params.get('shortlist_planned'))           entry = 'shared_shortlist';
    else if (params.get('leftValue') || params.get('rightValue')) entry = 'comparison';
    else if (params.get('specificCompany'))             entry = 'company';
    else if (params.get('specificFramework'))           entry = 'framework';
    else if (params.get('specificMetric'))              entry = 'metric';
    else if ([...params.keys()].length > 0)             entry = 'shared_view';

    // Same-origin referrer under /seo/ means they came from a landing page.
    let seoPage = null;
    try {
        const ref = new URL(document.referrer);
        if (ref.origin === window.location.origin && ref.pathname.includes('/seo/')) {
            seoPage = ref.pathname.split('/').pop() || null;
        }
    } catch (e) { /* no referrer, or cross-origin — leave null */ }

    return { entry, fromSeo: !!seoPage, seoPage };
}

// Opens the shared metric's popup, centered (no click position to anchor to
// since this runs on load, not from a real click). Called last in init.js's
// restore sequence, after the chart has drawn.
function restoreMetricPopupFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const id = parseInt(params.get('specificMetric'), 10);
    if (!Number.isInteger(id)) return;
    const metric = originalData.find(m => m.id === id && m.description !== undefined);
    if (metric && typeof showCustomTooltipCentered === 'function') showCustomTooltipCentered(metric);
}
