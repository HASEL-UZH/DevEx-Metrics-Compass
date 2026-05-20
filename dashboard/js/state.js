// ─── Global state & DOM references ───────────────────────────────────────────

// Shared tooltip texts for filter dimensions — used in step 1 button titles and step 2 diff/sort views
const DIMENSION_TOOLTIPS = {
    // Maturity (ease_of_collection values)
    'Easy':     'Getting started: Includes metrics available out-of-the-box from standard tooling (e.g. code repo, CI, issue tracker) or a single survey question. No custom instrumentation required.',
    'Moderate': 'Established: Includes Getting started metrics, plus those requiring combining data sources, adding a structured survey instrument, or light custom instrumentation. Achievable within a few weeks of setup.',
    'Complex':  'Advanced: Includes all metrics, up to those requiring significant custom tooling, IDE/calendar integration, dedicated research infrastructure, or ongoing qualitative data collection. Typically needs a dedicated DevEx or research team.',
    // Outcome goals
    'Developer Experience':         'Developer Experience: metrics about developer well-being, satisfaction, flow/focus, tooling friction, and onboarding (e.g. Burnout, Flow State, Cognitive Load, Feedback Loops, Sentiment).',
    'Product Excellence':           'Product Excellence: metrics about software quality, reliability, user-facing outcomes, and test quality (e.g. Change Failure Rate, Defects, Reliability, Test Coverage, Customer-Reported Defects).',
    'Organizational Effectiveness': 'Organizational Effectiveness: metrics about delivery throughput, business outcomes, DORA core metrics, and resource efficiency (e.g. Deployment Frequency, Lead Time, MTTR, Revenue per Engineer, Retention).',
    // AI categories (keys match getGroupKeyForMetric output in compare.js)
    '🎯 AI Impact':      'AI Impact: metrics that show whether AI tools improve delivery speed, code quality, and developer experience.',
    '📊 AI Utilization': 'AI Utilization: metrics that reveal how many and what types of developers are adopting AI tooling, and how much work is being touched by AI.',
    '💰 AI Cost':        'AI Cost: metrics related to AI spend, license usage, and identifying power users to optimize AI investment.',
};

// Maps step-1 data-filter values to DIMENSION_TOOLTIPS keys (only where they differ from the key)
const FILTER_TO_TOOLTIP_KEY = {
    'ai-impact':      '🎯 AI Impact',
    'ai-utilization': '📊 AI Utilization',
    'ai-cost':        '💰 AI Cost',
};

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
    minMentions: 'all'
};

// Current "color by" dimension for the sunburst chart
let currentColorBy = 'categorization';

// Named mode constants for clarity and logging
const MODE = { BROWSE: 'browse', ADDITIVE: 'additive', GUIDED: 'guided', COMPARE: 'compare', NEXTSTEPS: 'nextsteps' };
let currentMode = MODE.BROWSE;

// Step constants for the 3-step progress bar
const STEP = { EXPLORE: 'explore', COMPARE: 'compare', NEXTSTEPS: 'nextsteps' };
let currentStep = STEP.EXPLORE;

// State for Compare step (Step 2)
let compareState = { leftType: 'company', leftValue: 'all', rightType: 'company', rightValue: 'all' };

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
