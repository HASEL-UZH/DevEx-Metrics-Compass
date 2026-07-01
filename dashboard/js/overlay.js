// ─── Overlay navigation, hint system, assessment flow, changelog ──────────────

// ─── Compass needle mouse tracking ───────────────────────────────────────────
(function () {
    function enableMouseTracking(needle) {
        needle.style.animation = 'none';
        document.addEventListener('mousemove', (e) => {
            const rect = needle.closest('svg').getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const angle = Math.atan2(e.clientX - cx, -(e.clientY - cy)) * (180 / Math.PI);
            needle.style.transform = `rotate(${angle}deg)`;
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.compass-needle').forEach(needle => {
            needle.addEventListener('animationend', () => enableMouseTracking(needle), { once: true });
        });
    });
})();

document.querySelectorAll('.welcome-provenance-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const key = tab.dataset.tab;
        const isActive = tab.classList.contains('active');
        document.querySelectorAll('.welcome-provenance-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.welcome-provenance-body').forEach(b => b.classList.add('hidden'));
        if (!isActive) {
            tab.classList.add('active');
            document.querySelector(`.welcome-provenance-body[data-tab="${key}"]`).classList.remove('hidden');
        }
    });
});

function countMetricsForOption(filterKey, filterValue) {
    const hypothetical = Object.assign({}, wizardAnswers, { [filterKey]: filterValue });
    return originalData.filter(item => {
        if (!item.type) return false;
        if (hypothetical.dataType !== 'all' && item.type !== hypothetical.dataType && item.type !== 'both') return false;
        if (hypothetical.easeOfCollection !== 'all') {
            const eocTiers = { 'Easy': ['Easy'], 'Moderate': ['Easy', 'Moderate'], 'Complex': ['Easy', 'Moderate', 'Complex'] };
            if (!eocTiers[hypothetical.easeOfCollection]?.includes(item.ease_of_collection)) return false;
        }
        if (hypothetical.focus !== 'all' && item.is_research !== focusFilterValue(hypothetical.focus)) return false;
        if (hypothetical.companySize !== 'all' && !(Array.isArray(item.company) && item.company.some(s => s.company_size === hypothetical.companySize))) return false;
        if (hypothetical.outcomeGoals !== 'all' && item.outcome_goals !== hypothetical.outcomeGoals) return false;
        return true;
    }).length;
}

function updateWizardOptionCounts(screenEl) {
    screenEl.querySelectorAll('.wizard-option-btn').forEach(btn => {
        const countEl = btn.querySelector('.wizard-option-count');
        if (!countEl) return;
        const count = countMetricsForOption(btn.dataset.filterKey, btn.dataset.filterValue);
        countEl.textContent = `${count} metric${count !== 1 ? 's' : ''}`;
    });
}

function showOverlayScreen(screenToShow) {
    document.querySelectorAll('.overlay-screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    screenToShow.classList.remove('hidden');
    currentOverlayScreen = screenToShow;
    if (screenToShow.querySelector('.wizard-option-btn')) {
        updateWizardOptionCounts(screenToShow);
    }
    if (screenToShow.id === 'wizard-summary-screen') populateWizardSummary();
}

// ─── Inline mode picker state ────────────────────────────────────────────────

let modeChosen = false;

// Initial state: show welcome or skip if returning user with a shortlist
showOverlayScreen(initialChoiceScreen);
const saved = localStorage.getItem('clickedMetrics');
const hasShortlist = saved ? JSON.parse(saved).length > 0 : false;
if (hasShortlist) {
    myOverlay.style.display = 'none';
    modeChosen = true;
    hideExploreStartView();
}

// ─── Inline mode picker helpers ──────────────────────────────────────────────

function showExploreStartView() {
    const entryPanel    = document.getElementById('explore-entry-panel');
    const filtersSection = document.getElementById('explore-filters-section');
    const goCompareBtn  = document.getElementById('btn-go-compare');
    const nextStepBar   = document.querySelector('.next-step-bar');
    const c  = document.getElementById('container');
    const cf = document.getElementById('clear-filters-chart');
    const leftContainer = document.querySelector('.left-container');
    if (entryPanel)     entryPanel.style.display     = '';
    if (filtersSection) filtersSection.style.display = 'none';
    if (goCompareBtn)   goCompareBtn.style.display   = 'none';
    if (nextStepBar)    nextStepBar.style.display    = 'none';
    if (c)  c.style.display  = '';
    if (cf) cf.style.display = 'none';
    if (leftContainer)  leftContainer.classList.add('chart-blurred');
    ['no-metrics-message', 'additive-mode-message'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    currentMode = MODE.BROWSE;
    clearAllFilters();
}

function hideExploreStartView() {
    const entryPanel    = document.getElementById('explore-entry-panel');
    const filtersSection = document.getElementById('explore-filters-section');
    const goCompareBtn  = document.getElementById('btn-go-compare');
    const nextStepBar   = document.querySelector('.next-step-bar');
    const leftContainer = document.querySelector('.left-container');
    if (entryPanel)     entryPanel.style.display     = 'none';
    if (filtersSection) filtersSection.style.display = '';
    if (goCompareBtn)   goCompareBtn.style.display   = '';
    if (nextStepBar)    nextStepBar.style.display    = '';
    if (leftContainer)  leftContainer.classList.remove('chart-blurred');
}

// ─── CTA button: "Start exploring metrics" ───────────────────────────────────

document.getElementById('start-exploring-btn').addEventListener('click', () => {
    myOverlay.style.display = 'none';
    if (currentStep !== STEP.EXPLORE) switchToStep(STEP.EXPLORE);
    showExploreStartView();
});

// ─── Inline mode selection buttons (in left panel) ───────────────────────────

document.getElementById('start-assessment-inline-btn').addEventListener('click', () => {
    logEvent(TELEMETRY.WIZARD_STARTED, { mode: 'guided' });
    resetWizardAnswers();
    myOverlay.style.display = 'flex';
    showOverlayScreen(question1Screen);
});

document.getElementById('start-scratch-inline-btn').addEventListener('click', () => {
    logEvent(TELEMETRY.WIZARD_STARTED, { mode: 'browse' });
    modeChosen = true;
    hideExploreStartView();
    currentMode = MODE.BROWSE;
    clearAllFilters();
});

document.getElementById('start-additive-inline-btn').addEventListener('click', () => {
    logEvent(TELEMETRY.WIZARD_STARTED, { mode: 'additive' });
    modeChosen = true;
    hideExploreStartView();
    currentMode = MODE.ADDITIVE;
    clearAllFilters();
});

// ─── About overlay ────────────────────────────────────────────────────────────

const aboutOverlay = document.getElementById('aboutOverlay');

function openAbout() {
    aboutOverlay.style.display = 'flex';
}

function closeAbout() {
    aboutOverlay.style.display = 'none';
}

document.getElementById('openAboutBtnFooter').addEventListener('click', (e) => {
    e.preventDefault();
    openAbout();
});

document.getElementById('closeAboutBtn').addEventListener('click', closeAbout);

aboutOverlay.addEventListener('click', (e) => {
    if (e.target === aboutOverlay) closeAbout();
});

// ─── Changelog ────────────────────────────────────────────────────────────────

const changelogOverlay = document.getElementById('changelogOverlay');

function openChangelog() {
    changelogOverlay.style.display = 'flex';
}

function closeChangelog() {
    changelogOverlay.style.display = 'none';
}

['openChangelogBtnFooter', 'openChangelogBtnOverlay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', (e) => { e.preventDefault(); openChangelog(); });
});

document.getElementById('closeChangelogBtn').addEventListener('click', closeChangelog);

changelogOverlay.addEventListener('click', (e) => {
    if (e.target === changelogOverlay) closeChangelog();
});

// ─── "Restart wizard" button (Step 1 right panel) ────────────────────────────

openMaturityAssessmentBtn.addEventListener('click', () => {
    logEvent(TELEMETRY.WIZARD_RESTARTED, { shortlistCount: clickedMetrics.length, currentStep });
    modeChosen = false;
    if (currentStep !== STEP.EXPLORE) switchToStep(STEP.EXPLORE);
    showExploreStartView();
});

// ─── Close overlay ────────────────────────────────────────────────────────────

function dismissOverlay() {
    if (currentOverlayScreen && currentOverlayScreen !== initialChoiceScreen) {
        logEvent(TELEMETRY.WIZARD_ABANDONED, { atScreen: currentOverlayScreen.id });
    }
    myOverlay.style.display = 'none';
    showOverlayScreen(initialChoiceScreen);
    if (!modeChosen) {
        if (currentStep !== STEP.EXPLORE) switchToStep(STEP.EXPLORE);
        showExploreStartView();
    }
}

closeOverlayBtn.addEventListener('click', () => {
    dismissOverlay();
});

myOverlay.addEventListener('click', (event) => {
    if (event.target === myOverlay) {
        dismissOverlay();
    }
});

// ─── Guided wizard ─────────────────────────────────────────────────────────────

let wizardAnswers = {};

function resetWizardAnswers() {
    wizardAnswers = {
        dataType: 'all',
        easeOfCollection: 'all',
        focus: 'all',
        companySize: 'all',
        outcomeGoals: 'all'
    };
}
resetWizardAnswers();

function applyWizardFilters() {
    logEvent(TELEMETRY.WIZARD_COMPLETED, { answers: Object.assign({}, wizardAnswers) });
    modeChosen = true;
    myOverlay.style.display = 'none';
    hideExploreStartView();
    currentMode = MODE.GUIDED;
    clearAllFilters();
    if (wizardAnswers.dataType !== 'all')         applySpecificFilter('dataType',         wizardAnswers.dataType,         'dataType');
    if (wizardAnswers.easeOfCollection !== 'all') applySpecificFilter('easeOfCollection', wizardAnswers.easeOfCollection, 'easeOfCollection');
    if (wizardAnswers.focus !== 'all')            applySpecificFilter('focus',            wizardAnswers.focus,            'focus-dropdown');
    if (wizardAnswers.companySize !== 'all')      applySpecificFilter('companySize',      wizardAnswers.companySize,      'companySize');
    if (wizardAnswers.outcomeGoals !== 'all')     applySpecificFilter('outcomeGoals',     wizardAnswers.outcomeGoals,     'outcomeGoals');
    filterData();

}

document.querySelectorAll('.wizard-option-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const key = this.dataset.filterKey;
        const value = this.dataset.filterValue;
        const nextScreen = this.dataset.next;
        logEvent(TELEMETRY.WIZARD_STEP, { screen: currentOverlayScreen ? currentOverlayScreen.id : null, answer: value });
        if (key) wizardAnswers[key] = value;
        if (nextScreen) {
            showOverlayScreen(document.getElementById(nextScreen));
        } else {
            applyWizardFilters();
        }
    });
});

document.querySelectorAll('.skip-wizard-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const nextScreen = this.dataset.next;
        logEvent(TELEMETRY.WIZARD_SKIPPED, { skippedScreen: currentOverlayScreen ? currentOverlayScreen.id : null });
        if (nextScreen) {
            showOverlayScreen(document.getElementById(nextScreen));
        } else {
            applyWizardFilters();
        }
    });
});

// ─── Wizard summary screen ────────────────────────────────────────────────────

const WIZARD_QUESTION_LABELS = {
    easeOfCollection: 'Maturity',
    dataType:         'Data access',
    focus:            'Evidence',
    outcomeGoals:     'Outcome goal'
};

function populateWizardSummary() {
    const list = document.getElementById('wizard-summary-list');
    const seeBtn = document.getElementById('wizard-see-metrics-btn');
    list.innerHTML = Object.entries(WIZARD_QUESTION_LABELS).map(([key, label]) => {
        const value = wizardAnswers[key];
        let valueText = 'Any';
        if (value !== 'all') {
            const btn = document.querySelector(`.wizard-option-btn[data-filter-key="${key}"][data-filter-value="${value}"]`);
            if (btn) {
                const strong = btn.querySelector('strong');
                if (strong) {
                    valueText = strong.innerText.trim();
                } else {
                    const span = [...btn.querySelectorAll('span')].find(s => !s.classList.contains('option-num') && !s.classList.contains('wizard-option-count'));
                    valueText = span ? span.innerText.trim() : value;
                }
            }
        }
        return `<div class="wizard-summary-row">
            <span class="wizard-summary-row-label">${label}</span>
            <span class="wizard-summary-row-value${value === 'all' ? ' wizard-summary-row-value--any' : ''}">${valueText}</span>
        </div>`;
    }).join('');
    const count = countMetricsForOption('outcomeGoals', wizardAnswers.outcomeGoals);
    seeBtn.textContent = `See ${count} metric${count !== 1 ? 's' : ''} →`;
}

document.getElementById('wizard-see-metrics-btn').addEventListener('click', applyWizardFilters);

// ─── Go-back buttons ──────────────────────────────────────────────────────────

document.querySelectorAll('.go-back-btn').forEach(button => {
    button.addEventListener('click', function() {
        const targetId = this.dataset.targetScreen;
        const targetScreen = document.getElementById(targetId);
        if (targetScreen) { showOverlayScreen(targetScreen); }
    });
});

// ─── Predefined list overlay ──────────────────────────────────────────────────

const predefinedOverlay = document.getElementById('predefinedOverlay');

function openPredefinedOverlay() {
    const select = document.getElementById('predefined-company-select');
    select.innerHTML = '<option value="">Select a company…</option>';
    const companies = new Set();
    originalData.forEach(item => {
        if (!Array.isArray(item.company)) return;
        item.company.forEach(c => { if (c.name) companies.add(c.name.trim()); });
    });
    [...companies].sort((a, b) => a.localeCompare(b)).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
    });
    document.getElementById('predefined-company-info').textContent = '';
    document.getElementById('predefined-company-load-btn').disabled = true;
    document.getElementById('predefined-import-info').textContent = '';
    document.getElementById('predefined-import-btn').disabled = true;
    document.getElementById('predefined-import-file').value = '';
    predefinedOverlay.style.display = 'flex';
}

function closePredefinedOverlay() {
    predefinedOverlay.style.display = 'none';
}

document.getElementById('closePredefinedBtn').addEventListener('click', closePredefinedOverlay);
predefinedOverlay.addEventListener('click', e => { if (e.target === predefinedOverlay) closePredefinedOverlay(); });

document.getElementById('start-predefined-inline-btn').addEventListener('click', () => {
    logEvent(TELEMETRY.WIZARD_STARTED, { mode: 'predefined' });
    openPredefinedOverlay();
});

document.getElementById('predefined-company-select').addEventListener('change', function () {
    const name = this.value;
    const infoEl  = document.getElementById('predefined-company-info');
    const loadBtn = document.getElementById('predefined-company-load-btn');
    if (!name) { infoEl.textContent = ''; loadBtn.disabled = true; return; }
    const metrics = originalData.filter(m =>
        Array.isArray(m.company) && m.company.some(c => c.name === name)
    );
    infoEl.textContent = `${metrics.length} metric${metrics.length !== 1 ? 's' : ''} tracked by ${name}`;
    loadBtn.disabled = metrics.length === 0;
});

document.getElementById('predefined-company-load-btn').addEventListener('click', () => {
    const name = document.getElementById('predefined-company-select').value;
    if (!name) return;
    const companyMetrics = originalData.filter(m => Array.isArray(m.company) && m.company.some(c => c.name === name));
    logEvent(TELEMETRY.PREDEFINED_COMPANY_LOADED, { company: name, metricCount: companyMetrics.length });
    companyMetrics.forEach(m => addClickedMetric(m, 'capturing', 'company'));
    closePredefinedOverlay();
    modeChosen = true;
    hideExploreStartView();
    currentMode = MODE.BROWSE;
    clearAllFilters();

    // Pre-select the company in the Step 1 filter (mirrors the company-dropdown change handler)
    const companyDd = document.getElementById('company-dropdown');
    if (companyDd) {
        companyDd.value = name;
        applySpecificFilter('specificCompany', name);
        resetOtherSourceFilters('specificCompany');
        const size = typeof getCompanySizeForCompany === 'function' ? getCompanySizeForCompany(name) : null;
        if (size) applySpecificFilter('companySize', size, 'companySize');
        if (typeof applyLogoBg === 'function') applyLogoBg(companyDd, 'company', name);
        filterData();
    }

    // Pre-configure Step 2: selected company (left) vs SPACE Framework (right)
    if (typeof applyComparePreset === 'function') {
        applyComparePreset('company', name, 'framework', 'SPACE Framework');
    }
});

let _predefinedImportCandidates = [];

document.getElementById('predefined-import-file').addEventListener('change', function () {
    const infoEl    = document.getElementById('predefined-import-info');
    const importBtn = document.getElementById('predefined-import-btn');
    _predefinedImportCandidates = [];
    importBtn.disabled = true;
    const file = this.files[0];
    if (!file) { infoEl.textContent = ''; return; }
    const reader = new FileReader();
    reader.onload = function (e) {
        let parsed;
        try { parsed = JSON.parse(e.target.result); }
        catch (_) { infoEl.textContent = 'Invalid JSON file.'; return; }
        if (parsed.schema_version !== 1 || !Array.isArray(parsed.metrics)) {
            infoEl.textContent = 'Unrecognised format (expected a version 1 DevEx Compass export).';
            return;
        }
        let skipped = 0;
        const candidates = [];
        parsed.metrics.forEach(entry => {
            const full = originalData.find(m => m.id === entry.id);
            if (!full) { skipped++; return; }
            const status = (entry.collectionStatus === 'capturing' || entry.collectionStatus === 'planning')
                ? entry.collectionStatus : 'planning';
            candidates.push({ metric: full, status });
        });
        if (candidates.length === 0) {
            infoEl.textContent = skipped > 0
                ? `No importable metrics found (${skipped} not in current dataset).`
                : 'No metrics found in file.';
            return;
        }
        _predefinedImportCandidates = candidates;
        const note = skipped > 0 ? ` (${skipped} not found in current dataset)` : '';
        infoEl.textContent = `Ready to import ${candidates.length} metric${candidates.length !== 1 ? 's' : ''}${note}.`;
        importBtn.disabled = false;
    };
    reader.readAsText(file);
});

document.getElementById('predefined-import-btn').addEventListener('click', () => {
    if (_predefinedImportCandidates.length === 0) return;
    logEvent(TELEMETRY.IMPORT_JSON, { importedCount: _predefinedImportCandidates.length });
    _predefinedImportCandidates.forEach(({ metric, status }) => addClickedMetric(metric, status, 'import'));
    closePredefinedOverlay();
    modeChosen = true;
    hideExploreStartView();
    currentMode = MODE.BROWSE;
    clearAllFilters();
});
