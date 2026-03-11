// ─── Global state & DOM references ───────────────────────────────────────────

let SOURCE_URL_MAPPING = {};

// Overlay elements
const myOverlay = document.getElementById('myOverlay');
const closeOverlayBtn = document.getElementById('closeOverlayBtn');

// Button that opens the mode-selection welcome screen
const openMaturityAssessmentBtn = document.getElementById('openMaturityAssessmentBtn');

// Overlay screens
const initialChoiceScreen = document.getElementById('initial-choice-screen');
const question1Screen = document.getElementById('question1-screen');
const question2Screen = document.getElementById('question2-screen');
const question3Screen = document.getElementById('question3-screen');
const question4Screen = document.getElementById('question4-screen');
const question5Screen = document.getElementById('question5-screen');

// Navigation hint elements
const navigationHint = document.getElementById('navigation-hint');
const closeHintButton = document.getElementById('close-hint');

// Slider elements
const minMentionsSlider = document.getElementById('min-mentions-slider');
const minMentionsDisplay = document.getElementById('min-mentions-display');

// Data stores
let originalData = [];
let filteredData = [];
let chart = null;
let activeFilters = {
    dataType: 'all',
    aiMetric: 'all',
    focus: 'all',
    companySize: 'all',
    outcomeGoals: 'all',
    easeOfCollection: 'all',
    specificCompany: 'all',
    specificFramework: 'all',
    minMentions: 0
};

// Named mode constants for clarity and logging
const MODE = { BROWSE: 'browse', ADDITIVE: 'additive', GUIDED: 'guided' };
let currentMode = MODE.BROWSE;

// In additive mode, tracks whether the canvas should be blank.
// true  = blank canvas (entry state or after "Clear all filters").
// false = show matching metrics (set whenever the user interacts with any filter).
let additiveBlankCanvas = false;

// Selected metrics shortlist
let clickedMetrics = [];

// Misc DOM refs
const noMetricsMessage = document.getElementById('no-metrics-message');
const customTooltip = document.getElementById('custom-tooltip');

// Overlay navigation: tracks the currently visible screen
let currentOverlayScreen = initialChoiceScreen;
