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

// ─── Assessment question handlers ─────────────────────────────────────────────

document.getElementById('q1-yes-btn').addEventListener('click', () => showOverlayScreen(question2Screen));
document.getElementById('q1-no-btn').addEventListener('click', () => showOverlayScreen(level1Screen));

document.getElementById('q2-yes-btn').addEventListener('click', () => showOverlayScreen(question3Screen));
document.getElementById('q2-no-btn').addEventListener('click', () => showOverlayScreen(level2Screen));

document.getElementById('q3-yes-btn').addEventListener('click', () => showOverlayScreen(question4Screen));
document.getElementById('q3-no-btn').addEventListener('click', () => showOverlayScreen(level3Screen));

document.getElementById('q4-yes-btn').addEventListener('click', () => showOverlayScreen(level5Screen));
document.getElementById('q4-no-btn').addEventListener('click', () => showOverlayScreen(level4Screen));

// ─── Go-back buttons ──────────────────────────────────────────────────────────

document.querySelectorAll('.go-back-btn').forEach(button => {
    button.addEventListener('click', function() {
        const targetScreen = document.getElementById(this.dataset.targetScreen);
        if (targetScreen) { showOverlayScreen(targetScreen); }
    });
});

// ─── Show-metrics buttons (guided assessment result) ──────────────────────────

document.querySelectorAll('.show-metrics-btn').forEach(button => {
    button.addEventListener('click', function() {
        myOverlay.style.display = 'none';
        currentMode = MODE.GUIDED;
        clearAllFilters();

        const filterFramework = this.dataset.filterFramework;
        const filterDataType = this.dataset.filterDatatype;
        const filterFocus = this.dataset.filterFocus;
        const filterCompanySize = this.dataset.filterCompanySize;
        const filterAll = this.dataset.filterAll;

        if (filterAll) {
            // filters already cleared to 'all'
        } else if (filterFramework) {
            applySpecificFilter('specificFramework', filterFramework, 'research-dropdown');
        } else if (filterDataType && filterFocus) {
            applySpecificFilter('dataType', filterDataType, 'dataType');
            applySpecificFilter('focus', filterFocus, 'focus-dropdown');
        } else if (filterCompanySize) {
            applySpecificFilter('companySize', filterCompanySize, 'companySize');
        }

        filterData();
        updateHintVisibility();
    });
});
