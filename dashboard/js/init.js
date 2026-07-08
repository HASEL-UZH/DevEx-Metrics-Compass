// ─── App initialization ───────────────────────────────────────────────────────

anychart.onDocumentReady(function() {
    loadClickedMetricsFromLocalStorage();

    Promise.all([
        fetch("data/data.json").then(response => response.json()),
        fetch("data/source_ids.json").then(response => response.json())
    ])
    .then(([data, urls]) => {
        SOURCE_URL_MAPPING = urls.reduce((acc, current) => {
            acc[current.ref_number] = current;
            return acc;
        }, {});

        originalData = data.map(item => {
            if (item.name) item.name = toTitleCase(item.name);
            if (item.company) { item.company = transformSources(item.company, 'company'); }
            if (item.research) { item.research = transformSources(item.research, 'research'); }
            return item;
        });

        originalData.forEach(m => {
            if (m.related_metrics && m.related_metrics !== '-') {
                m.resolvedRelated = m.related_metrics.split(';')
                    .map(s => parseInt(s.trim(), 10))
                    .map(id => originalData.find(r => r.id === id && r.description !== undefined))
                    .filter(Boolean);
            } else {
                m.resolvedRelated = [];
            }
        });

        const restored = restoreStateFromUrl();

        if (restored.hadUrlState) {
            // First-time visitor arriving via a shared link (no localStorage yet) —
            // dismiss the welcome wizard so the restored view isn't blocked by it.
            myOverlay.style.display = 'none';
            modeChosen = true;
            hideExploreStartView();
        }

        filterData();
        updateStepBar();
        updateColorLegend('categorization');

        // Run after filterData(), not before: filterData() re-shows the "Clear
        // all filters" chart button whenever active filters narrow the result
        // set, which would undo switchToStep()'s own explore-only-chrome hide
        // if switchToStep ran first — so switchToStep must be the last word on
        // step-specific visibility.
        if (restored.step && restored.step !== STEP.EXPLORE) {
            switchToStep(restored.step);
        }

        restoreShortlistFromUrl();
        restoreMetricPopupFromUrl();

        logEvent(TELEMETRY.PAGE_LOAD, { totalMetrics: originalData.filter(m => m.type).length, shortlistCount: clickedMetrics.length, hasShortlist: clickedMetrics.length > 0, viewport: window.innerWidth < 768 ? 'mobile' : 'desktop' });
    })
    .catch(error => {
        console.error("Error loading JSON data:", error);
    });
});
