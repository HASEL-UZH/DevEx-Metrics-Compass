// ─── Metrics shortlist ───────────────────────────────────────────────────────

function addClickedMetric(metric, status) {
    const existingIndex = clickedMetrics.findIndex(m => m.id === metric.id);
    if (existingIndex >= 0) {
        clickedMetrics[existingIndex].collectionStatus = status;
    } else {
        clickedMetrics.push({ ...metric, collectionStatus: status });
    }
    saveClickedMetricsToLocalStorage();
    if (typeof updateStepBar === 'function') updateStepBar();
    if (typeof currentStep !== 'undefined' && currentStep === STEP.COMPARE   && typeof renderDiffView       === 'function') renderDiffView();
    if (typeof currentStep !== 'undefined' && currentStep === STEP.NEXTSTEPS && typeof renderNextStepsView === 'function') renderNextStepsView();
    if (typeof syncShortlistOptionVisibility === 'function') syncShortlistOptionVisibility();
}

function removeClickedMetric(metricId) {
    clickedMetrics = clickedMetrics.filter(m => m.id !== metricId);
    saveClickedMetricsToLocalStorage();
    if (typeof updateStepBar === 'function') updateStepBar();
    if (typeof currentStep !== 'undefined' && currentStep === STEP.COMPARE   && typeof renderDiffView       === 'function') renderDiffView();
    if (typeof currentStep !== 'undefined' && currentStep === STEP.NEXTSTEPS && typeof renderNextStepsView === 'function') renderNextStepsView();
    if (typeof syncShortlistOptionVisibility === 'function') syncShortlistOptionVisibility();
}

function clearAllClickedMetrics() {
    clickedMetrics = [];
    saveClickedMetricsToLocalStorage();
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

// ─── Event listeners ──────────────────────────────────────────────────────────

