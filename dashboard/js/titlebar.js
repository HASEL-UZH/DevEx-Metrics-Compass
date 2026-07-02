// ─── 3-step progress bar ───────────────────────────────────────────────────────

// Previous shortlist counts, used to detect changes and trigger the pill-bump animation
let prevCapturing = null;
let prevPlanned   = null;

function bumpPill(el) {
    el.classList.remove('shortlist-pill--bump');
    void el.offsetWidth; // force reflow so the animation restarts
    el.classList.add('shortlist-pill--bump');
}

function switchToStep(step) {
    const prevStep = currentStep;
    currentStep = step;
    logEvent(TELEMETRY.STEP_CHANGE, { from: prevStep, to: step, shortlistCount: clickedMetrics.length });

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

    // Blur only applies on step 1 when no mode has been chosen
    const leftContainer = document.querySelector('.left-container');
    if (leftContainer) {
        if (step !== STEP.EXPLORE) {
            leftContainer.classList.remove('chart-blurred');
        } else if (typeof modeChosen !== 'undefined' && !modeChosen) {
            leftContainer.classList.add('chart-blurred');
        }
    }

    // Hide/show explore messages (only in Explore step)
    const msgs = ['no-metrics-message', 'clear-filters-chart'];
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
                countEl.textContent = `${capturing + planned} metrics in my shortlist`;
                if (sepCount) sepCount.style.display = '';
            } else {
                countEl.textContent = '';
                if (sepCount) sepCount.style.display = 'none';
            }
        }
    }

    // 2 — Shortlist pills (top-right indicator, visible whenever the shortlist has items)
    const pillsWrap     = document.getElementById('shortlist-pills');
    const trackingPill  = document.getElementById('shortlist-pill-tracking');
    const plannedPill   = document.getElementById('shortlist-pill-planned');
    const trackingCount = document.getElementById('shortlist-pill-tracking-count');
    const plannedCount  = document.getElementById('shortlist-pill-planned-count');
    if (pillsWrap) {
        pillsWrap.style.display = hasShortlist ? '' : 'none';
        if (trackingPill && trackingCount) {
            trackingPill.style.display = capturing > 0 ? '' : 'none';
            trackingCount.textContent = capturing;
            if (capturing > 0 && prevCapturing !== null && capturing !== prevCapturing) bumpPill(trackingPill);
        }
        if (plannedPill && plannedCount) {
            plannedPill.style.display = planned > 0 ? '' : 'none';
            plannedCount.textContent = planned;
            if (planned > 0 && prevPlanned !== null && planned !== prevPlanned) bumpPill(plannedPill);
        }
    }
    prevCapturing = capturing;
    prevPlanned   = planned;

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
        return 'Filter to your context, then mark what you track or plan to track';
    }
    if (currentStep === STEP.COMPARE) {
        if (isComparing) return 'Compare profiles and mark metrics you already track or plan to track';
        return 'Select two profiles to compare using the controls on the right';
    }
    if (currentStep === STEP.NEXTSTEPS) {
        if (hasShortlist) return 'Review and export my shortlist';
        return 'Go back to explore and mark metrics to build my shortlist';
    }
    return '';
}

// Wire step button clicks
document.querySelectorAll('.step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        switchToStep(btn.dataset.step);
    });
});

// Wire next/back panel buttons
document.getElementById('btn-go-compare')?.addEventListener('click', () => switchToStep(STEP.COMPARE));
document.getElementById('btn-go-nextsteps')?.addEventListener('click', () => switchToStep(STEP.NEXTSTEPS));
document.getElementById('btn-back-explore')?.addEventListener('click', () => switchToStep(STEP.EXPLORE));
document.getElementById('btn-back-compare')?.addEventListener('click', () => switchToStep(STEP.COMPARE));

// ─── Shortlist hover popup ────────────────────────────────────────────────────

(function () {
    const trigger      = document.getElementById('shortlist-pills');
    const popup        = document.getElementById('shortlist-hover-popup');
    const trackingPill = document.getElementById('shortlist-pill-tracking');
    const plannedPill  = document.getElementById('shortlist-pill-planned');
    if (!trigger || !popup) return;

    function showPopup() {
        const byName = (a, b) => a.name.localeCompare(b.name);
        const capturing = clickedMetrics.filter(m => m.collectionStatus === 'capturing').sort(byName);
        const planned   = clickedMetrics.filter(m => m.collectionStatus === 'planning').sort(byName);
        if (capturing.length === 0 && planned.length === 0) return;

        let html = '';
        if (capturing.length > 0) {
            html += `<div class="shortlist-hover-popup-label tracking"><span class="shortlist-hover-popup-icon shortlist-hover-popup-icon--tracking">✓</span>Already tracking</div>`;
            capturing.forEach(m => { html += `<div class="shortlist-hover-popup-metric">${m.name}</div>`; });
        }
        if (capturing.length > 0 && planned.length > 0) html += '<hr>';
        if (planned.length > 0) {
            html += `<div class="shortlist-hover-popup-label planned"><span class="shortlist-hover-popup-icon shortlist-hover-popup-icon--planned">+</span>Planned to track</div>`;
            planned.forEach(m => { html += `<div class="shortlist-hover-popup-metric">${m.name}</div>`; });
        }
        popup.innerHTML = html;

        // Center the popup over the pills only (excluding the "My metrics shortlist:" label)
        const pillRects = [trackingPill, plannedPill]
            .filter(el => el && el.offsetParent !== null)
            .map(el => el.getBoundingClientRect());
        const rects = pillRects.length > 0 ? pillRects : [trigger.getBoundingClientRect()];
        const spanLeft  = Math.min(...rects.map(r => r.left));
        const spanRight = Math.max(...rects.map(r => r.right));
        const spanBottom = Math.max(...rects.map(r => r.bottom));

        const popupWidth = 260;
        let left = spanLeft + (spanRight - spanLeft - popupWidth) / 2;
        left = Math.max(8, Math.min(left, window.innerWidth - popupWidth - 8));
        popup.style.top  = (spanBottom + 6) + 'px';
        popup.style.left = left + 'px';
        popup.classList.add('visible');
    }

    function hidePopup() {
        popup.classList.remove('visible');
    }

    trigger.addEventListener('mouseenter', showPopup);
    trigger.addEventListener('mouseleave', hidePopup);
})();
