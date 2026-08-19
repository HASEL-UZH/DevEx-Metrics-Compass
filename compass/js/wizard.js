// ─── Entry wizard (role selection, questions, benchmark/import) + About & changelog overlays ─

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

// ─── Per-option metric-count preview (shown next to each wizard answer) ──────

function countMetricsForOption(filterKey, filterValue) {
    const hypothetical = Object.assign({}, wizardAnswers, { [filterKey]: filterValue });
    return originalData.filter(item => {
        if (!item.type) return false;
        if (hypothetical.dataType !== 'all' && item.type !== hypothetical.dataType && item.type !== 'both') return false;
        if (hypothetical.easeOfCollection !== 'all' && item.ease_of_collection !== hypothetical.easeOfCollection) return false;
        if (hypothetical.focus !== 'all' && item.is_research !== focusFilterValue(hypothetical.focus)) return false;
        if (hypothetical.specificFramework !== 'all' && !(Array.isArray(item.research) && item.research.some(s => s.name === hypothetical.specificFramework))) return false;
        if (hypothetical.companySize !== 'all' && !(Array.isArray(item.company) && item.company.some(s => s.company_size === hypothetical.companySize))) return false;
        if (hypothetical.aiMetric === 'ai-impact' && item.ai_specific_category !== 'Impact') return false;
        if (hypothetical.aiMetric === 'ai-utilization' && item.ai_specific_category !== 'Utilization') return false;
        if (hypothetical.aiMetric === 'ai-cost' && item.ai_specific_category !== 'Cost') return false;
        if (hypothetical.outcomeGoals !== 'all' && item.outcome_goals !== hypothetical.outcomeGoals) return false;
        return true;
    }).length;
}

function updateWizardOptionCounts(stepEl) {
    stepEl.querySelectorAll('.wizard-option-btn').forEach(btn => {
        const countEl = btn.querySelector('.wizard-option-count');
        if (!countEl) return;
        const count = countMetricsForOption(btn.dataset.filterKey, btn.dataset.filterValue);
        countEl.textContent = `${count} metric${count !== 1 ? 's' : ''}`;
    });
}

// ─── One-time welcome overlay (#myOverlay) ───────────────────────────────────

let modeChosen = false;

const ROLE_BADGE_LABEL = { [ROLE.NEWCOMER]: 'Newcomer', [ROLE.PRACTITIONER]: 'Practitioner', [ROLE.RESEARCHER]: 'Researcher' };

// Initial state: show welcome or skip if returning user with a shortlist or a
// previously-picked role. Role is persisted across reloads (see role-select-btn/
// skip-wizard-link handlers and showExploreStartView() below) so the filter panel
// re-applies the same layout instead of showing the raw unrolled HTML order.
// A saved role alone (even with an empty shortlist) is enough to skip the wizard —
// someone who picked a role and hasn't added anything yet shouldn't see it again.
const saved = localStorage.getItem('clickedMetrics');
const hasShortlist = saved ? JSON.parse(saved).length > 0 : false;
const savedRole = localStorage.getItem('currentRole');
if (savedRole || hasShortlist) {
    myOverlay.style.display = 'none';
    modeChosen = true;
    currentRole = (savedRole && ROLE_CONFIG[savedRole]) ? savedRole : ROLE.PRACTITIONER;
    showRoleBadge();
    applyRoleFilterLayout(currentRole);
    hideExploreStartView();
}

function dismissOverlay() {
    myOverlay.style.display = 'none';
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

document.getElementById('start-exploring-btn').addEventListener('click', () => {
    myOverlay.style.display = 'none';
    if (currentStep !== STEP.EXPLORE) switchToStep(STEP.EXPLORE);
    showExploreStartView();
});

// ─── Entry panel show/hide (Step 1 right panel) ──────────────────────────────
// The chart stays blurred for the whole entry-panel lifetime (role pick + every
// wizard question) so users see the shape react without a full reveal; the blur
// is only lifted in finishWizard(), via hideExploreStartView().

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
    if (noMetricsMessage) noMetricsMessage.style.display = 'none';
    if (reportMissingChartBtn) reportMissingChartBtn.style.display = 'none';
    currentRole = null;
    localStorage.removeItem('currentRole');
    hideRoleBadge();
    showWizardStep('role-select-step');
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

// ─── Persistent role badge ────────────────────────────────────────────────────

function showRoleBadge() {
    document.getElementById('role-badge-name').textContent = ROLE_BADGE_LABEL[currentRole] || '';
    document.getElementById('role-badge').classList.remove('hidden');
    // Persisted so a page refresh can restore the same role/filter layout
    // instead of falling back to the raw, un-curated filter order.
    localStorage.setItem('currentRole', currentRole);
}

function hideRoleBadge() {
    document.getElementById('role-badge').classList.add('hidden');
}

// "Change role" button — replaces the old "Restart wizard" button, same id/element.
openMaturityAssessmentBtn.addEventListener('click', () => {
    logEvent(TELEMETRY.WIZARD_RESTARTED, { shortlistCount: clickedMetrics.length, currentStep, role: currentRole });
    modeChosen = false;
    if (currentStep !== STEP.EXPLORE) switchToStep(STEP.EXPLORE);
    showExploreStartView();
});

// ─── Wizard step sequencer (embedded in the sidepanel, not a modal) ──────────

let currentWizardStepId = 'role-select-step';

function showWizardStep(stepId) {
    document.querySelectorAll('.wizard-step').forEach(el => el.classList.add('hidden'));
    const stepEl = document.getElementById(stepId);
    stepEl.classList.remove('hidden');
    currentWizardStepId = stepId;
    if (stepEl.querySelector('.wizard-option-btn')) updateWizardOptionCounts(stepEl);
}

const QUESTION_STEP_ID = {
    easeOfCollection:  'q-easeOfCollection-step',
    dataType:          'q-dataType-step',
    aiMetric:          'q-aiMetric-step',
    outcomeGoals:      'q-outcomeGoals-step',
    specificFramework: 'q-specificFramework-step',
    focus:             'q-focus-step'
};

// Several question steps are shared across roles at different positions (e.g.
// dataType is Newcomer's question 1 of 2, Practitioner's question 4 of 4, and
// Researcher's question 1 of 3) — so label + back-target are computed fresh
// from the active sequence every time a question is shown, rather than hardcoded.
function updateQuestionStepChrome(key) {
    const cfg = ROLE_CONFIG[currentRole];
    const sequence = currentRole === ROLE.NEWCOMER ? cfg.sequence : cfg.quickSequence;
    const idx = sequence.indexOf(key);
    const prefix = 'Question';

    const label = document.getElementById(`q-${key}-label`);
    if (label) label.textContent = `${prefix} ${idx + 1} of ${sequence.length}`;

    const backBtn = document.getElementById(`q-${key}-back-btn`);
    if (backBtn) {
        const prevKey = sequence[idx - 1];
        backBtn.dataset.targetStep = prevKey
            ? QUESTION_STEP_ID[prevKey]
            : (currentRole === ROLE.NEWCOMER ? 'role-select-step' : 'start-choice-step');
    }
}

// The dataType step is shared, but its framing differs by role: Newcomers pick a
// collection approach, whereas Researchers (who don't collect metrics themselves)
// express which kind of metric they're interested in.
const DATATYPE_HEADING_DEFAULT = 'How would you like to collect metrics?';
const DATATYPE_HEADING_BY_ROLE = {
    [ROLE.RESEARCHER]: 'What kind of metrics are you most interested in?'
};

function goToWizardQuestion(key) {
    updateQuestionStepChrome(key);
    if (key === 'dataType') {
        const title = document.getElementById('q-dataType-title');
        if (title) title.textContent = DATATYPE_HEADING_BY_ROLE[currentRole] || DATATYPE_HEADING_DEFAULT;
    }
    showWizardStep(QUESTION_STEP_ID[key]);
}

let wizardAnswers = {};

function resetWizardAnswers() {
    wizardAnswers = {
        dataType: 'all',
        easeOfCollection: 'all',
        focus: 'all',
        companySize: 'all',
        aiMetric: 'all',
        outcomeGoals: 'all',
        specificFramework: 'all'
    };
}
resetWizardAnswers();

// Called once the active sequence (Newcomer's full sequence, or the Practitioner/
// Researcher "quick questions" sequence) is exhausted, or immediately for the
// Practitioner/Researcher "browse the full catalogue" / "answer a few questions" choices.
function finishWizard() {
    logEvent(TELEMETRY.WIZARD_COMPLETED, { role: currentRole, answers: Object.assign({}, wizardAnswers) });
    modeChosen = true;
    hideExploreStartView();
    applyRoleFilterLayout(currentRole);
    filterData();
}

// ─── Step 0: role selection ───────────────────────────────────────────────────

// Reads a role's description straight off its Step 0 card, so start-choice-step's
// reminder text can't drift out of sync with what the user actually saw/picked.
function getRoleCardDescription(role) {
    const btn = document.querySelector(`.role-select-btn[data-role="${role}"]`);
    const card = btn ? btn.closest('.explore-entry-card') : null;
    const desc = card ? card.querySelector('.explore-entry-card-description') : null;
    return desc ? desc.textContent.trim() : '';
}

function showStartChoiceStep() {
    const context = document.getElementById('start-choice-context');
    if (context) context.textContent = `${ROLE_BADGE_LABEL[currentRole]}: ${getRoleCardDescription(currentRole)}`;
    showWizardStep('start-choice-step');
}

document.querySelectorAll('.role-select-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        currentRole = this.dataset.role;
        resetWizardAnswers();
        logEvent(TELEMETRY.WIZARD_STARTED, { role: currentRole });
        showRoleBadge();
        if (currentRole === ROLE.NEWCOMER) {
            // Newcomers aren't asked about measurement maturity — assume "Getting
            // started" automatically (see hiddenFilters in ROLE_CONFIG).
            wizardAnswers.easeOfCollection = 'Easy';
            applySpecificFilter('easeOfCollection', 'Easy', 'easeOfCollection');
            filterData();
            goToWizardQuestion(ROLE_CONFIG[ROLE.NEWCOMER].sequence[0]);
        } else {
            showStartChoiceStep();
        }
    });
});

// Escape hatch from Step 0: skip straight to the full catalogue, no questions asked.
document.getElementById('skip-wizard-link').addEventListener('click', () => {
    currentRole = ROLE.PRACTITIONER;
    resetWizardAnswers();
    logEvent(TELEMETRY.WIZARD_STARTED, { role: currentRole, action: 'skip' });
    showRoleBadge();
    clearAllFilters();
    finishWizard();
});

// ─── Step 1 (Practitioner/Researcher only): how to get started ──────────────

document.querySelectorAll('.start-choice-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        const action = this.dataset.action;
        logEvent(TELEMETRY.WIZARD_STARTED, { role: currentRole, action });
        if (action === 'browse') {
            clearAllFilters();
            finishWizard();
        } else if (action === 'additive') {
            // "Answer a few questions" leads with a couple of quick questions (each
            // answer live-filters, same as any other filter change). Starts from
            // the full catalogue and narrows down as questions are answered —
            // not a blank canvas — matching how the Newcomer wizard already works.
            clearAllFilters();
            goToWizardQuestion(ROLE_CONFIG[currentRole].quickSequence[0]);
        } else if (action === 'benchmark') {
            populateBenchmarkStep();
            showWizardStep('benchmark-step');
        } else if (action === 'existingSelection') {
            populateExistingSelectionStep();
            showWizardStep('existing-selection-step');
        }
    });
});

// ─── Wizard questions (shared markup/handler across all question steps) ─────

document.querySelectorAll('.wizard-option-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        const key = this.dataset.filterKey;
        const value = this.dataset.filterValue;
        logEvent(TELEMETRY.WIZARD_STEP, { screen: currentWizardStepId, role: currentRole, answer: value });
        wizardAnswers[key] = value;
        const dropdownElementId = { focus: 'focus-dropdown', specificFramework: 'research-dropdown', specificCompany: 'company-dropdown' };
        applySpecificFilter(key, value, dropdownElementId[key] || key);
        filterData();

        const cfg = ROLE_CONFIG[currentRole];
        const sequence = cfg.sequence || cfg.quickSequence || [];
        const nextKey = sequence[sequence.indexOf(key) + 1];
        if (nextKey) {
            goToWizardQuestion(nextKey);
        } else {
            finishWizard();
        }
    });
});

// ─── Go-back links (shared across role/start-choice/question/company-list steps) ─

document.querySelectorAll('.go-back-btn').forEach(button => {
    button.addEventListener('click', function () {
        const targetStep = this.dataset.targetStep;
        if (targetStep) showWizardStep(targetStep);
    });
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

// ─── Start from an existing selection: my own company (inline sidepanel step) ─
// This pre-fills the shortlist — it's "I already track some of these", not a
// benchmark/comparison, so unlike the benchmark step below it doesn't touch
// filters or Step 2's compare preset beyond pre-selecting the company filter.

function populateExistingSelectionStep() {
    const select = document.getElementById('predefined-company-select');
    select.innerHTML = '<option value="">Select your company…</option>';
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
    _predefinedImportCandidates = [];
}

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
    logEvent(TELEMETRY.PREDEFINED_COMPANY_LOADED, { company: name, metricCount: companyMetrics.length, role: currentRole });
    companyMetrics.forEach(m => addClickedMetric(m, 'capturing', 'company'));
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
    }
    finishWizard();
});

// ─── Benchmark against a company or framework (inline sidepanel step) ───────
// View/compare only — must never touch the shortlist, unlike the step above.

function populateBenchmarkStep() {
    populateBenchmarkCompanySelect();
    populateBenchmarkFrameworkSelect();
}

function populateBenchmarkCompanySelect() {
    const select = document.getElementById('benchmark-company-select');
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
    document.getElementById('benchmark-company-info').textContent = '';
    document.getElementById('benchmark-company-btn').disabled = true;
}

document.getElementById('benchmark-company-select').addEventListener('change', function () {
    const name = this.value;
    const infoEl = document.getElementById('benchmark-company-info');
    const btn = document.getElementById('benchmark-company-btn');
    if (!name) { infoEl.textContent = ''; btn.disabled = true; return; }
    const metrics = originalData.filter(m => Array.isArray(m.company) && m.company.some(c => c.name === name));
    infoEl.textContent = `${metrics.length} metric${metrics.length !== 1 ? 's' : ''} tracked by ${name}`;
    btn.disabled = metrics.length === 0;
});

document.getElementById('benchmark-company-btn').addEventListener('click', () => {
    const name = document.getElementById('benchmark-company-select').value;
    if (!name) return;
    const companyMetrics = originalData.filter(m => Array.isArray(m.company) && m.company.some(c => c.name === name));
    logEvent(TELEMETRY.PREDEFINED_COMPANY_LOADED, { company: name, metricCount: companyMetrics.length, role: currentRole, mode: 'benchmark' });
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
    }
    finishWizard();

    // Pre-configure Step 2: My Shortlist (left) vs the selected company (right)
    if (typeof applyComparePreset === 'function') {
        applyComparePreset('shortlist', 'shortlist', 'company', name);
    }
});

function populateBenchmarkFrameworkSelect() {
    const select = document.getElementById('benchmark-framework-select');
    select.innerHTML = '<option value="">Select a framework…</option>';
    const frameworks = new Set();
    originalData.forEach(item => {
        if (!Array.isArray(item.research)) return;
        item.research.forEach(r => { if (r.name && r.name.toLowerCase().includes('framework')) frameworks.add(r.name.trim()); });
    });
    [...frameworks].sort((a, b) => a.localeCompare(b)).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name.replace(/\s*Framework\s*$/i, '');
        select.appendChild(opt);
    });
    document.getElementById('benchmark-framework-info').textContent = '';
    document.getElementById('benchmark-framework-btn').disabled = true;
}

document.getElementById('benchmark-framework-select').addEventListener('change', function () {
    const name = this.value;
    const infoEl = document.getElementById('benchmark-framework-info');
    const btn = document.getElementById('benchmark-framework-btn');
    if (!name) { infoEl.textContent = ''; btn.disabled = true; return; }
    const metrics = originalData.filter(m => Array.isArray(m.research) && m.research.some(r => r.name === name));
    infoEl.textContent = `${metrics.length} metric${metrics.length !== 1 ? 's' : ''} in ${name.replace(/\s*Framework\s*$/i, '')}`;
    btn.disabled = metrics.length === 0;
});

document.getElementById('benchmark-framework-btn').addEventListener('click', () => {
    const name = document.getElementById('benchmark-framework-select').value;
    if (!name) return;
    const frameworkMetrics = originalData.filter(m => Array.isArray(m.research) && m.research.some(r => r.name === name));
    logEvent(TELEMETRY.PREDEFINED_FRAMEWORK_LOADED, { framework: name, metricCount: frameworkMetrics.length, role: currentRole });
    clearAllFilters();

    // Pre-select the framework in the Step 1 filter (mirrors the research-dropdown change handler)
    const frameworkDd = document.getElementById('research-dropdown');
    if (frameworkDd) {
        frameworkDd.value = name;
        applySpecificFilter('specificFramework', name);
        resetOtherSourceFilters('specificFramework');
    }
    finishWizard();

    // Pre-configure Step 2: My Shortlist (left) vs selected framework (right)
    if (typeof applyComparePreset === 'function') {
        applyComparePreset('shortlist', 'shortlist', 'framework', name);
    }
});

// ─── Import a previous export (part of the "existing selection" step) ───────

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
    logEvent(TELEMETRY.IMPORT_JSON, { importedCount: _predefinedImportCandidates.length, role: currentRole });
    _predefinedImportCandidates.forEach(({ metric, status }) => addClickedMetric(metric, status, 'import'));
    clearAllFilters();
    finishWizard();
});
