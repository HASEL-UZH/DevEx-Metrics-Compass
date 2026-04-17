// ─── 3-step progress bar ───────────────────────────────────────────────────────

function switchToStep(step) {
    currentStep = step;

    // Update active state on step buttons
    document.querySelectorAll('.step-btn').forEach(btn => {
        btn.classList.toggle('step-btn--active', btn.dataset.step === step);
    });

    // Swap the main-container step class (drives CSS panel visibility)
    const mc = document.getElementById('main-container');
    if (mc) {
        mc.classList.remove('step-explore', 'step-compare', 'step-nextsteps');
        mc.classList.add(`step-${step}`);
    }

    // Left panel: show the right visualization
    const sunburst     = document.getElementById('container');
    const diffView     = document.getElementById('diff-view');
    const nextstepsView = document.getElementById('nextsteps-view');

    if (sunburst)     sunburst.style.display     = step === STEP.EXPLORE   ? '' : 'none';
    if (diffView)     diffView.style.display     = step === STEP.COMPARE   ? 'flex' : 'none';
    if (nextstepsView) nextstepsView.style.display = step === STEP.NEXTSTEPS ? 'flex' : 'none';

    // Hide inline mode picker when leaving Explore step
    const exploreStartView = document.getElementById('explore-start-view');
    if (exploreStartView && step !== STEP.EXPLORE) exploreStartView.style.display = 'none';

    // Hide/show explore messages (only in Explore step)
    const msgs = ['no-metrics-message', 'additive-mode-message', 'clear-filters-chart'];
    msgs.forEach(id => {
        const el = document.getElementById(id);
        if (el && step !== STEP.EXPLORE) el.style.display = 'none';
    });

    // Right panel: show the right controls
    const explorePanel   = document.getElementById('explore-right-panel');
    const comparePanel   = document.getElementById('compare-panel');
    const nextstepsPanel = document.getElementById('nextsteps-panel');

    if (explorePanel)   explorePanel.style.display   = step === STEP.EXPLORE   ? '' : 'none';
    if (comparePanel)   comparePanel.style.display   = step === STEP.COMPARE   ? '' : 'none';
    if (nextstepsPanel) nextstepsPanel.style.display = step === STEP.NEXTSTEPS ? '' : 'none';

    // On entering Compare: re-render diff view
    if (step === STEP.COMPARE && typeof renderDiffView === 'function') {
        renderDiffView();
    }

    // On entering Next Steps: render the two-column view
    if (step === STEP.NEXTSTEPS && typeof renderNextStepsView === 'function') {
        renderNextStepsView();
    }

    // On returning to Explore: restore chart if needed
    if (step === STEP.EXPLORE && typeof filterData === 'function') {
        filterData();
    }

    updateStepBar();
}

// Called after any filter or shortlist change to keep the meta line current
function updateStepBar() {
    const totalMetrics = originalData.filter(item => item.type).length;
    const shownMetrics = (filteredData || []).filter(item => item.type).length;

    // Shortlist totals — computed early as they drive count and hint in steps 2/3
    const capturing   = clickedMetrics.filter(m => m.collectionStatus === 'capturing').length;
    const planned     = clickedMetrics.filter(m => m.collectionStatus === 'planning').length;
    const hasShortlist = capturing > 0 || planned > 0;

    // 1 — Metric count (step-specific)
    const countEl  = document.getElementById('step-metric-count');
    const sepCount = document.getElementById('step-sep-count');
    if (countEl) {
        if (currentStep === STEP.EXPLORE) {
            countEl.textContent = shownMetrics === totalMetrics
                ? `Showing all ${totalMetrics} metrics`
                : `Showing ${shownMetrics} of ${totalMetrics} metrics`;
            if (sepCount) sepCount.style.display = '';
        } else if (currentStep === STEP.COMPARE) {
            const isComparing = compareState && compareState.leftValue !== 'all' && compareState.rightValue !== 'all';
            if (isComparing) {
                const leftSet  = new Set((typeof filterMetricsByDimension === 'function'
                    ? filterMetricsByDimension(compareState.leftType,  compareState.leftValue)
                    : []).map(m => m.id));
                const rightSet = new Set((typeof filterMetricsByDimension === 'function'
                    ? filterMetricsByDimension(compareState.rightType, compareState.rightValue)
                    : []).map(m => m.id));
                const uniqueTotal = new Set([...leftSet, ...rightSet]).size;
                countEl.textContent = `${uniqueTotal} metrics in comparison`;
                if (sepCount) sepCount.style.display = '';
            } else {
                countEl.textContent = '';
                if (sepCount) sepCount.style.display = 'none';
            }
        } else if (currentStep === STEP.NEXTSTEPS) {
            if (hasShortlist) {
                countEl.textContent = `${capturing + planned} metrics in your shortlist`;
                if (sepCount) sepCount.style.display = '';
            } else {
                countEl.textContent = '';
                if (sepCount) sepCount.style.display = 'none';
            }
        }
    }

    // 2 — Shortlist breakdown (visible in all steps when shortlist has items)
    const shortlistEl  = document.getElementById('step-shortlist-summary');
    const sepShortlist = document.getElementById('step-sep-shortlist');
    if (shortlistEl) {
        if (hasShortlist) {
            const parts = [];
            if (capturing > 0) parts.push(`${capturing} already tracking`);
            if (planned > 0)   parts.push(`${planned} planned to track`);
            shortlistEl.textContent = 'Your shortlist: ' + parts.join(', ');
            if (sepShortlist) sepShortlist.style.display = '';
        } else {
            shortlistEl.textContent = '';
            if (sepShortlist) sepShortlist.style.display = 'none';
        }
    }

    // Highlight Step 3 button when shortlist has content
    const step3Btn = document.getElementById('step-btn-nextsteps');
    if (step3Btn) {
        step3Btn.classList.toggle('step-btn--has-content', hasShortlist);
    }

    // 3 — Action phrase (always visible)
    const hintEl = document.getElementById('step-hint');
    if (hintEl) {
        hintEl.textContent = getStepHint(hasShortlist);
    }
}

function getStepHint(hasShortlist) {
    const isComparing = compareState && compareState.leftValue !== 'all' && compareState.rightValue !== 'all';

    if (currentStep === STEP.EXPLORE) {
        if (hasShortlist) return 'Keep exploring and marking metrics you already track or plan to track';
        return 'Filter and mark metrics you already track or plan to track';
    }
    if (currentStep === STEP.COMPARE) {
        if (isComparing) return 'Compare profiles and mark metrics you already track or plan to track';
        return 'Select two profiles to compare using the controls on the right';
    }
    if (currentStep === STEP.NEXTSTEPS) {
        if (hasShortlist) return 'Review and export your shortlist';
        return 'Go back to explore and mark metrics to build your shortlist';
    }
    return '';
}

// Wire step button clicks
document.querySelectorAll('.step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        switchToStep(btn.dataset.step);
    });
});
