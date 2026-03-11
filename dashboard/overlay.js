// ─── Overlay navigation, hint system, assessment flow, changelog ──────────────

function showOverlayScreen(screenToShow) {
    document.querySelectorAll('.overlay-screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    screenToShow.classList.remove('hidden');
    currentOverlayScreen = screenToShow;
}

function updateHintVisibility() {
    const overlayIsActive = window.getComputedStyle(myOverlay).display !== 'none';
    if (!overlayIsActive) {
        if (localStorage.getItem('navigationHintDismissed') !== 'true') {
            navigationHint.style.display = 'block';
        }
    } else {
        navigationHint.style.display = 'none';
    }
}

// Initial state: show the choice screen and update hint
showOverlayScreen(initialChoiceScreen);
updateHintVisibility();

// ─── Mode selection buttons ───────────────────────────────────────────────────

document.getElementById('start-additive-btn').addEventListener('click', () => {
    myOverlay.style.display = 'none';
    currentMode = MODE.ADDITIVE;
    clearAllFilters();
    updateHintVisibility();
});

document.getElementById('start-scratch-btn').addEventListener('click', () => {
    myOverlay.style.display = 'none';
    currentMode = MODE.BROWSE;
    clearAllFilters();
    updateHintVisibility();
});

document.getElementById('start-assessment-btn').addEventListener('click', () => {
    resetWizardAnswers();
    myOverlay.style.display = 'flex';
    showOverlayScreen(question1Screen);
    updateHintVisibility();
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
    updateHintVisibility();
});

// ─── Close overlay ────────────────────────────────────────────────────────────

closeOverlayBtn.addEventListener('click', () => {
    myOverlay.style.display = 'none';
    showOverlayScreen(initialChoiceScreen);
    updateHintVisibility();
});

myOverlay.addEventListener('click', (event) => {
    if (event.target === myOverlay) {
        myOverlay.style.display = 'none';
        showOverlayScreen(initialChoiceScreen);
        updateHintVisibility();
    }
});

// ─── Hint dismissal ───────────────────────────────────────────────────────────

if (navigationHint && closeHintButton) {
    closeHintButton.addEventListener('click', function(event) {
        event.stopPropagation();
        navigationHint.style.display = 'none';
        localStorage.setItem('navigationHintDismissed', 'true');
    });

    navigationHint.addEventListener('click', function() {
        this.style.display = 'none';
        localStorage.setItem('navigationHintDismissed', 'true');
    });
}

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
    updateHintVisibility();
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

// ─── Go-back buttons ──────────────────────────────────────────────────────────

document.querySelectorAll('.go-back-btn').forEach(button => {
    button.addEventListener('click', function() {
        const targetScreen = document.getElementById(this.dataset.targetScreen);
        if (targetScreen) { showOverlayScreen(targetScreen); }
    });
});
