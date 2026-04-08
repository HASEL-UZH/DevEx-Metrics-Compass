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
        countEl.textContent = count;
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

// ─── Password gate (temporary – remove before public launch) ──────────────────

const PASSWORD_KEY = 'dxmetrics_unlocked';
const CORRECT_PASSWORD = 'dxmetrics';

const passwordScreen = document.getElementById('password-screen');
const passwordInput = document.getElementById('password-input');
const passwordError = document.getElementById('password-error');

function unlockAndProceed() {
    localStorage.setItem(PASSWORD_KEY, 'true');
    myOverlay.classList.remove('password-locked');
    passwordError.style.display = 'none';
    showOverlayScreen(initialChoiceScreen);
}

document.getElementById('password-submit-btn').addEventListener('click', () => {
    if (passwordInput.value === CORRECT_PASSWORD) {
        unlockAndProceed();
    } else {
        passwordError.style.display = 'block';
        passwordInput.value = '';
        passwordInput.focus();
    }
});

passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('password-submit-btn').click();
});

// Initial state: show password screen or skip if already unlocked
if (localStorage.getItem(PASSWORD_KEY) === 'true') {
    showOverlayScreen(initialChoiceScreen);
} else {
    myOverlay.classList.add('password-locked');
    showOverlayScreen(passwordScreen);
}

// ─── Mode selection buttons ───────────────────────────────────────────────────

document.getElementById('start-additive-btn').addEventListener('click', () => {
    myOverlay.style.display = 'none';
    currentMode = MODE.ADDITIVE;
    clearAllFilters();

});

document.getElementById('start-scratch-btn').addEventListener('click', () => {
    myOverlay.style.display = 'none';
    currentMode = MODE.BROWSE;
    clearAllFilters();

});

document.getElementById('start-assessment-btn').addEventListener('click', () => {
    resetWizardAnswers();
    myOverlay.style.display = 'flex';
    showOverlayScreen(question1Screen);

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

// ─── "Switch exploration mode" button ────────────────────────────────────────

openMaturityAssessmentBtn.addEventListener('click', () => {
    myOverlay.style.display = 'flex';
    showOverlayScreen(initialChoiceScreen);

});

// ─── Close overlay ────────────────────────────────────────────────────────────

closeOverlayBtn.addEventListener('click', () => {
    if (currentOverlayScreen === passwordScreen) return;
    myOverlay.style.display = 'none';
    showOverlayScreen(initialChoiceScreen);

});

myOverlay.addEventListener('click', (event) => {
    if (event.target === myOverlay) {
        if (currentOverlayScreen === passwordScreen) return;
        myOverlay.style.display = 'none';
        showOverlayScreen(initialChoiceScreen);

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
    myOverlay.style.display = 'none';
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
    companySize:      'Company size',
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
        let targetId = this.dataset.targetScreen;
        // (special case) Skip Q4 on the way back unless "used in practice" was chosen in Q3 (only that path includes Q4)
        if (targetId === 'question4-screen' && wizardAnswers.focus !== 'industry-only') {
            targetId = 'question3-screen';
        }
        const targetScreen = document.getElementById(targetId);
        if (targetScreen) { showOverlayScreen(targetScreen); }
    });
});
