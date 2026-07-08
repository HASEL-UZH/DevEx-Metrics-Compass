// ─── Metrics shortlist ───────────────────────────────────────────────────────

function addClickedMetric(metric, status, source) {
    const existingIndex = clickedMetrics.findIndex(m => m.id === metric.id);
    if (existingIndex >= 0) {
        clickedMetrics[existingIndex].collectionStatus = status;
        saveClickedMetricsToLocalStorage();
        logEvent(TELEMETRY.METRIC_STATUS_CHANGED, { metricId: metric.id, newStatus: status, shortlistCount: clickedMetrics.length, currentStep });
    } else {
        clickedMetrics.push({ ...metric, collectionStatus: status });
        saveClickedMetricsToLocalStorage();
        logEvent(TELEMETRY.METRIC_ADDED, { metricId: metric.id, metricName: metric.name, status, source: source || 'manual', shortlistCount: clickedMetrics.length, currentStep });
    }
    if (typeof updateStepBar === 'function') updateStepBar();
    if (typeof currentStep !== 'undefined' && currentStep === STEP.COMPARE   && typeof renderDiffView       === 'function') renderDiffView();
    if (typeof currentStep !== 'undefined' && currentStep === STEP.NEXTSTEPS && typeof renderNextStepsView === 'function') renderNextStepsView();
    if (typeof syncShortlistOptionVisibility === 'function') syncShortlistOptionVisibility();
}

function removeClickedMetric(metricId) {
    clickedMetrics = clickedMetrics.filter(m => m.id !== metricId);
    saveClickedMetricsToLocalStorage();
    logEvent(TELEMETRY.METRIC_REMOVED, { metricId, shortlistCount: clickedMetrics.length, currentStep });
    if (typeof updateStepBar === 'function') updateStepBar();
    if (typeof currentStep !== 'undefined' && currentStep === STEP.COMPARE   && typeof renderDiffView       === 'function') renderDiffView();
    if (typeof currentStep !== 'undefined' && currentStep === STEP.NEXTSTEPS && typeof renderNextStepsView === 'function') renderNextStepsView();
    if (typeof syncShortlistOptionVisibility === 'function') syncShortlistOptionVisibility();
}

function clearAllClickedMetrics() {
    const prevCount = clickedMetrics.length;
    clickedMetrics = [];
    saveClickedMetricsToLocalStorage();
    logEvent(TELEMETRY.SHORTLIST_CLEARED, { previousCount: prevCount, currentStep });
    if (typeof savedComparisons !== 'undefined') {
        savedComparisons.length = 0;
        if (typeof saveSavedComparisonsToLocalStorage === 'function') saveSavedComparisonsToLocalStorage();
        if (typeof updateSaveButton === 'function') updateSaveButton();
    }
    if (typeof updateStepBar === 'function') updateStepBar();
    if (typeof currentStep !== 'undefined' && currentStep === STEP.NEXTSTEPS && typeof renderNextStepsView === 'function') renderNextStepsView();
    if (typeof syncShortlistOptionVisibility === 'function') syncShortlistOptionVisibility();
}

function saveClickedMetricsToLocalStorage() {
    const serializable = clickedMetrics.map(({ resolvedRelated, ...rest }) => rest);
    localStorage.setItem('clickedMetrics', JSON.stringify(serializable));
}

function loadClickedMetricsFromLocalStorage() {
    const saved = localStorage.getItem('clickedMetrics');
    if (saved) {
        clickedMetrics = JSON.parse(saved);
    }
}

// Restores a shortlist shared via a "Copy shareable link" URL. Each metric
// carries the sharer's own capturing/planning status (see shortlistUrlParams()
// in url-state.js, which splits the shortlist into shortlist_current/
// shortlist_planned id lists) — that distinction is the point of sharing a
// shortlist, so it's preserved rather than reset.
// If the recipient's own shortlist is empty there's nothing to conflict with,
// so it's loaded directly. Otherwise a plain confirm() asks to merge — OK
// merges (existing metrics preserved, shared ones added/updated by id),
// Cancel does nothing at all, matching confirm()'s normal semantics. There's
// no "replace" option here — to fully replace, use "Clear shortlist" first,
// then reopen the link (merging into an empty list has the same effect).
function restoreShortlistFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const currentRaw = params.get('shortlist_current');
    const plannedRaw = params.get('shortlist_planned');
    if (!currentRaw && !plannedRaw) return;

    function parseIds(raw) {
        return (raw || '').split(',').map(s => parseInt(s, 10)).filter(Number.isInteger);
    }
    const candidates = [
        ...parseIds(currentRaw).map(id => ({ id, status: 'capturing' })),
        ...parseIds(plannedRaw).map(id => ({ id, status: 'planning' })),
    ]
        .map(({ id, status }) => {
            const metric = originalData.find(m => m.id === id && m.description !== undefined);
            return metric ? { metric, status } : null;
        })
        .filter(Boolean);

    if (candidates.length > 0) {
        if (clickedMetrics.length === 0) {
            candidates.forEach(({ metric, status }) => addClickedMetric(metric, status, 'shared_url'));
        } else {
            const proceed = confirm(`Add ${candidates.length} shared metric${candidates.length !== 1 ? 's' : ''} to your current shortlist (${clickedMetrics.length} metric${clickedMetrics.length !== 1 ? 's' : ''})?\n\nTo use only the shared shortlist, click Cancel, then "Clear shortlist" and reopen this link.`);
            if (proceed) candidates.forEach(({ metric, status }) => addClickedMetric(metric, status, 'shared_url'));
        }
    }

    // Either way, the shared link has now been acted on (imported or declined)
    // — drop shortlist_current/shortlist_planned from the URL so refreshing
    // the page doesn't re-prompt or re-import the same metrics again.
    if (typeof syncStateToUrl === 'function') syncStateToUrl({ preserveShortlist: false });
}

// ─── Event listeners ──────────────────────────────────────────────────────────

